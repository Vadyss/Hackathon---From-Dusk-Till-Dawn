"""Frontend contract v1 and dependency composition for the backend."""
from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager
from dataclasses import replace

from fastapi import APIRouter, FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response

from orchestrator.api_errors import ApiError, register_handlers
from orchestrator.config import Settings
from orchestrator.decisions import approve, reject
from orchestrator.events import EventEmitter
from orchestrator.models import ApproveBody, CreateRunBody, RejectBody
from orchestrator.run_store import RunStore
from orchestrator.ws import WebSocketHub

CONTRACT_VERSION = 1


def create_app(*, settings=None, gatekeeper=None, sandbox=None, roles=None, pipeline_runner=None, voice=None) -> FastAPI:
    config = settings or Settings.from_env()

    @asynccontextmanager
    async def lifespan(app):
        sandbox_client = sandbox
        if sandbox_client is None or gatekeeper is None:
            from gatekeeper.api import Gatekeeper, SandboxClient

            sandbox_client = sandbox_client or SandboxClient(config.sandbox_url, timeout_s=config.sandbox_timeout_s)
            app.state.gatekeeper = gatekeeper or Gatekeeper(config.gatekeeper_config(), sandbox_client)
        else:
            app.state.gatekeeper = gatekeeper
        role_config = replace(config, llm_max_calls_per_run=min(config.llm_max_calls_per_run,
                              getattr(app.state.gatekeeper, "max_llm_calls", config.llm_max_calls_per_run)))
        if roles is None:
            from orchestrator.planner import make_roles

            app.state.roles = make_roles(role_config)
        else:
            app.state.roles = roles
        if voice is None:
            from orchestrator.voice import VoiceService

            app.state.voice = VoiceService(config, app.state.emitter)
        else:
            app.state.voice = voice
        logging.basicConfig(level=getattr(logging, config.log_level.upper(), logging.INFO))
        try:
            try:
                available = await sandbox_client.health()
            except Exception:
                available = False
            if not available:
                logging.getLogger(__name__).warning("Sandbox není dostupný; běh skončí SANDBOX_ERROR.")
            yield
        finally:
            await app.state.store.close()
            await app.state.hub.close()
            await sandbox_client.close()
            if app.state.voice:
                await app.state.voice.close()
            close_roles = getattr(app.state.roles, "close", None)
            if close_roles:
                await close_roles()

    app = FastAPI(title="Frankenstein", lifespan=lifespan, docs_url=None, redoc_url=None)
    register_handlers(app)
    app.state.settings = config
    app.state.store = RunStore()
    app.state.hub = WebSocketHub()
    app.state.emitter = EventEmitter(app.state.hub)
    if config.cors_origins:
        app.add_middleware(CORSMiddleware, allow_origins=list(config.cors_origins),
                           allow_methods=["GET", "POST"], allow_headers=["Content-Type"])
    router = APIRouter()

    @router.get("/health")
    async def health():
        return {"status": "ok", "contract_version": CONTRACT_VERSION}

    @router.post("/runs", status_code=202)
    async def create_run(body: CreateRunBody):
        text = body.request.strip()
        if not 1 <= len(text) <= 2000:
            raise ApiError(400, "INVALID_REQUEST", "Požadavek musí mít 1 až 2000 znaků.")
        run = await app.state.store.create(text)
        pipeline = pipeline_runner
        if pipeline is None:
            from orchestrator.pipeline import run_pipeline

            pipeline = run_pipeline
        run.task = asyncio.create_task(pipeline(run, app.state.gatekeeper, app.state.roles,
                                                app.state.emitter, config, app.state.voice))
        return {"run_id": run.run_id, "status": "running"}

    @router.get("/runs")
    async def list_runs():
        return {"runs": app.state.store.list()}

    @router.get("/runs/{run_id:path}/events")
    async def get_events(run_id: str, after_seq: str = "0"):
        run = app.state.store.get(run_id)
        if not after_seq.isascii() or not after_seq.isdigit():
            raise ApiError(400, "INVALID_REQUEST", "Neplatný parametr after_seq.")
        try:
            number = int(after_seq)
        except ValueError:
            raise ApiError(400, "INVALID_REQUEST", "Neplatný parametr after_seq.") from None
        async with run.lock:
            return {"events": [e for e in run.events if e["seq"] > number]}

    @router.post("/runs/{run_id:path}/approve")
    async def approve_run(run_id: str, body: ApproveBody | None = None):
        run = app.state.store.get(run_id)
        return await approve(run, body.comment if body else None, app.state.gatekeeper, app.state.emitter)

    @router.post("/runs/{run_id:path}/reject")
    async def reject_run(run_id: str, body: RejectBody):
        run = app.state.store.get(run_id)
        reason = body.reason.strip()
        if not 1 <= len(reason) <= 500:
            raise ApiError(400, "INVALID_REQUEST", "Důvod musí mít 1 až 500 znaků.")
        return await reject(run, reason, app.state.gatekeeper, app.state.emitter)

    @router.get("/skills")
    async def list_skills():
        return {"skills": [s.model_dump(mode="json") for s in app.state.gatekeeper.installed_skills()]}

    @router.get("/runs/{run_id:path}/audio")
    async def get_audio(run_id: str):
        run = app.state.store.get(run_id)
        if run.audio is None:
            raise ApiError(404, "AUDIO_NOT_FOUND", "Běh nemá hlasové shrnutí.")
        return Response(run.audio, media_type="audio/mpeg")

    @router.websocket("/ws")
    async def websocket_events(ws: WebSocket):
        subscriber = await app.state.hub.connect(ws)
        try:
            while True:
                message = await ws.receive()
                if message["type"] == "websocket.disconnect":
                    break
        except WebSocketDisconnect:
            pass
        finally:
            await app.state.hub.disconnect(subscriber)

    app.include_router(router)
    app.include_router(router, prefix="/api")
    return app


app = create_app()
