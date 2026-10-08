# Testing

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

CORS_ORIGINS = [
    origin.strip()
    for origin in os.getenv(
        "CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000"
    ).split(",")
    if origin.strip()
]

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
    allow_credentials=False,
)

@app.get("/health")
def deploy_testing():
    return {"status": "ok", "contract_version": CONTRACT_VERSION}

# App

import asyncio
import re
import secrets
from datetime import datetime, timezone
from typing import Optional

from fastapi import Query, Request, WebSocket, WebSocketDisconnect
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel
from starlette.exceptions import HTTPException as StarletteHTTPException

CONTRACT_VERSION = 1
RUN_ID_RE = re.compile(r"^run_[a-z0-9]{4,32}$")
ACTIVE_STATUSES = {"running", "awaiting_approval"}
STATUS_BY_EVENT = {
    "run_started": "running",
    "awaiting_approval": "awaiting_approval",
    "rule_approved": "approved",
    "rule_rejected": "rejected",
    "run_failed": "failed",
}
FINISHED_STATUSES = {"approved", "rejected", "failed"}
WS_SEND_TIMEOUT_S = 2.0


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")

class ApiError(Exception):
    def __init__(self, status_code: int, code: str, message: str):
        self.status_code = status_code
        self.code = code
        self.message = message


def error_response(status_code: int, code: str, message: str) -> JSONResponse:
    return JSONResponse(status_code=status_code, content={"error": {"code": code, "message": message}})


@app.exception_handler(ApiError)
async def api_error_handler(request: Request, exc: ApiError):
    return error_response(exc.status_code, exc.code, exc.message)


@app.exception_handler(RequestValidationError)
async def validation_error_handler(request: Request, exc: RequestValidationError):
    return error_response(400, "INVALID_REQUEST", "Invalid request body or parameter.")


@app.exception_handler(StarletteHTTPException)
async def http_error_handler(request: Request, exc: StarletteHTTPException):
    if exc.status_code == 404:
        return error_response(404, "RUN_NOT_FOUND", "The requested resource does not exist.")
    if exc.status_code < 500:
        return error_response(400, "INVALID_REQUEST", "Invalid request.")
    return error_response(500, "INTERNAL_ERROR", "Unexpected backend error.")


@app.exception_handler(Exception)
async def internal_error_handler(request: Request, exc: Exception):
    response = error_response(500, "INTERNAL_ERROR", "Unexpected backend error.")
    # ServerErrorMiddleware calls this handler outside CORSMiddleware.
    origin = request.headers.get("origin")
    if origin is not None and origin in CORS_ORIGINS:
        response.headers["Access-Control-Allow-Origin"] = origin
    response.headers["Vary"] = "Origin"
    return response


# --- Stav v paměti ---

class Run:
    def __init__(self, run_id: str, request: str):
        self.run_id = run_id
        self.request = request
        self.status = "running"
        self.created_at = now_iso()
        self.finished_at: Optional[str] = None
        self.events: list[dict] = []
        self.lock = asyncio.Lock()
        self.awaiting_data: Optional[dict] = None  # data poslední události awaiting_approval
        self.audio: Optional[bytes] = None

    @property
    def last_seq(self) -> int:
        return len(self.events)

    def info(self) -> dict:
        return {
            "run_id": self.run_id,
            "request": self.request,
            "status": self.status,
            "created_at": self.created_at,
            "finished_at": self.finished_at,
            "last_seq": self.last_seq,
        }


runs: dict[str, Run] = {}
runs_lock = asyncio.Lock()
skills_registry: dict[str, dict] = {}  # name -> SkillInfo se stavem installed
ws_clients: set[WebSocket] = set()


def get_run(run_id: str) -> Run:
    if not RUN_ID_RE.match(run_id) or run_id not in runs:
        raise ApiError(404, "RUN_NOT_FOUND", "The run does not exist.")
    return runs[run_id]


def has_active_run() -> bool:
    return any(r.status in ACTIVE_STATUSES for r in runs.values())


# --- Události (kapitoly 9 a 15.3) ---

async def broadcast(event: dict) -> None:
    async def send(ws: WebSocket) -> None:
        try:
            await asyncio.wait_for(ws.send_json(event), timeout=WS_SEND_TIMEOUT_S)
        except Exception:
            ws_clients.discard(ws)
            try:
                await ws.close()
            except Exception:
                pass

    await asyncio.gather(*(send(ws) for ws in list(ws_clients)))


def append_event(run: Run, type_: str, phase: str, message: str, data: Optional[dict] = None) -> dict:
    """Přidá událost do běhu. Volat pod run.lock."""
    event = {
        "type": type_,
        "run_id": run.run_id,
        "seq": run.last_seq + 1,
        "timestamp": now_iso(),
        "phase": phase,
        "message": message[:200],
        "data": data or {},
    }
    run.events.append(event)
    if type_ in STATUS_BY_EVENT:
        run.status = STATUS_BY_EVENT[type_]
        if run.status in FINISHED_STATUSES:
            run.finished_at = event["timestamp"]
    if type_ == "awaiting_approval":
        run.awaiting_data = event["data"]
    return event


async def emit(run: Run, type_: str, phase: str, message: str, data: Optional[dict] = None) -> dict:
    """Uloží událost pod zámkem běhu a teprve potom ji odešle přes WebSocket."""
    async with run.lock:
        event = append_event(run, type_, phase, message, data)
    await broadcast(event)
    return event


async def run_pipeline(run: Run) -> None:
    """Orchestrátor běhu. Sem patří plán, kovárna, pravidlo a ověření (kapitola 11)."""
    await emit(run, "run_started", "intake", "Run started.", {"request": run.request})


# --- Těla požadavků ---

class CreateRunBody(BaseModel):
    request: str


class ApproveBody(BaseModel):
    comment: Optional[str] = None


class RejectBody(BaseModel):
    reason: str


# --- HTTP API (kapitola 7) ---

@app.post("/runs", status_code=202)
async def create_run(body: CreateRunBody):
    request_text = body.request.strip()
    if not 1 <= len(request_text) <= 2000:
        raise ApiError(400, "INVALID_REQUEST", "The request must contain 1 to 2000 characters.")
    async with runs_lock:
        if has_active_run():
            raise ApiError(409, "RUN_ALREADY_ACTIVE", "The previous run has not finished yet.")
        run_id = f"run_{secrets.token_hex(4)}"
        while run_id in runs:
            run_id = f"run_{secrets.token_hex(4)}"
        run = Run(run_id, request_text)
        runs[run_id] = run
    asyncio.create_task(run_pipeline(run))
    return {"run_id": run_id, "status": "running"}


@app.get("/runs")
async def list_runs():
    ordered = sorted(runs.values(), key=lambda r: r.created_at, reverse=True)
    return {"runs": [r.info() for r in ordered]}


@app.get("/runs/{run_id}/events")
async def get_events(run_id: str, after_seq: int = Query(0, ge=0)):
    run = get_run(run_id)
    async with run.lock:
        events = [e for e in run.events if e["seq"] > after_seq]
    return {"events": events}


@app.post("/runs/{run_id}/approve")
async def approve_run(run_id: str, body: ApproveBody):
    run = get_run(run_id)
    if body.comment is not None and len(body.comment) > 500:
        raise ApiError(400, "INVALID_REQUEST", "The comment must contain at most 500 characters.")
    async with run.lock:
        if run.status != "awaiting_approval":
            raise ApiError(409, "NOT_AWAITING_APPROVAL", "The run is not awaiting approval.")
        data = run.awaiting_data or {}
        events = []
        for skill in data.get("new_skills", []):
            installed = {**skill, "status": "installed", "created_at": now_iso()}
            skills_registry[installed["name"]] = installed
            events.append(append_event(
                run, "skill_installed", "done",
                f"Skill {installed['name']} was installed in the registry.",
                {"skill": installed},
            ))
        rule_name = data.get("recipe", {}).get("name", "")
        events.append(append_event(
            run, "rule_approved", "done", f"Rule {rule_name} was approved.",
            {"rule_name": rule_name, "comment": body.comment},
        ))
    for event in events:
        await broadcast(event)
    return {"status": "approved"}


@app.post("/runs/{run_id}/reject")
async def reject_run(run_id: str, body: RejectBody):
    run = get_run(run_id)
    if not 1 <= len(body.reason) <= 500:
        raise ApiError(400, "INVALID_REQUEST", "The reason must contain 1 to 500 characters.")
    async with run.lock:
        if run.status != "awaiting_approval":
            raise ApiError(409, "NOT_AWAITING_APPROVAL", "The run is not awaiting approval.")
        event = append_event(run, "rule_rejected", "done", "Rule was rejected.", {"reason": body.reason})
    await broadcast(event)
    return {"status": "rejected"}


@app.get("/skills")
async def list_skills():
    return {"skills": [skills_registry[name] for name in sorted(skills_registry)]}


@app.get("/runs/{run_id}/audio")
async def get_audio(run_id: str):
    run = get_run(run_id)
    if run.audio is None:
        raise ApiError(404, "AUDIO_NOT_FOUND", "The run has no voice summary.")
    return Response(content=run.audio, media_type="audio/mpeg")


# --- WebSocket (kapitola 8) ---

@app.websocket("/ws")
async def websocket_events(ws: WebSocket):
    origin = ws.headers.get("origin")
    if origin is not None and origin not in CORS_ORIGINS:
        await ws.close(code=1008)
        return
    await ws.accept()
    ws_clients.add(ws)
    try:
        while True:
            await ws.receive_text()  # frontend nic neposílá; čteme jen kvůli detekci odpojení
    except WebSocketDisconnect:
        pass
    finally:
        ws_clients.discard(ws)
