// Mock backend podle docs/kontrakt.md, kapitola 13.
// Bez závislostí: node mock/server.mjs  (port 8001, nebo PORT=...)
import { createHash, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const PORT = Number(process.env.PORT ?? 8001);
const ALLOWED_ORIGINS = (process.env.CORS_ORIGINS ?? "http://localhost:3000,http://127.0.0.1:3000").split(",");
const HERE = dirname(fileURLToPath(import.meta.url));

const RUN_ID_RE = /^run_[a-z0-9]{4,32}$/;

// ---------- Scénáře ----------

const SCENARIOS = {
  A: "a_password_spraying.json",
  B: "b_distributed_brute_force.json",
  C: "c_prompt_injection.json",
  D: "d_forge_failed.json",
};

function loadScenario(key) {
  return JSON.parse(readFileSync(join(HERE, "scenarios", SCENARIOS[key]), "utf8"));
}

function pickScenario(text) {
  const t = text.toLowerCase();
  if (t.includes("spray")) return "A";
  if (t.includes("distrib")) return "B";
  if (t.includes("inject")) return "C";
  if (t.includes("fail")) return "D";
  return "A";
}

// ---------- Stav ----------

const now = () => new Date().toISOString();

const SEED_SKILLS = [
  {
    name: "count_window",
    version: 1,
    kind: "aggregation",
    description: "Counts events within a time window for each group.",
    origin: "seed",
    status: "installed",
    created_by_run: null,
    created_at: "2026-10-04T12:00:00.000Z",
  },
  {
    name: "ssh_parser",
    version: 1,
    kind: "parser",
    description: "Parses OpenSSH auth.log lines into events.",
    origin: "seed",
    status: "installed",
    created_by_run: null,
    created_at: "2026-10-04T12:00:00.000Z",
  },
];

const registry = new Map(SEED_SKILLS.map((s) => [s.name, s]));
const runs = new Map(); // run_id -> run

const STATUS_BY_EVENT = {
  run_started: "running",
  awaiting_approval: "awaiting_approval",
  rule_approved: "approved",
  rule_rejected: "rejected",
  run_failed: "failed",
};

function runInfo(run) {
  return {
    run_id: run.run_id,
    request: run.request,
    status: run.status,
    created_at: run.created_at,
    finished_at: run.finished_at,
    last_seq: run.events.length,
  };
}

function hasActiveRun() {
  for (const r of runs.values()) if (r.status === "running" || r.status === "awaiting_approval") return true;
  return false;
}

function fill(value, runId) {
  if (typeof value === "string") return value.replaceAll("{run_id}", runId).replaceAll("{now}", now());
  if (Array.isArray(value)) return value.map((v) => fill(v, runId));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, fill(v, runId)]));
  }
  return value;
}

function emit(run, tmpl) {
  const data = fill(tmpl.data ?? {}, run.run_id);
  if (tmpl.type === "run_started") data.request = run.request;
  if (tmpl.type === "skill_reused" && data.skill && registry.has(data.skill.name)) {
    data.skill = registry.get(data.skill.name);
  }
  if (tmpl.type === "skill_installed" && data.skill) {
    const prev = registry.get(data.skill.name);
    data.skill = { ...data.skill, status: "installed", version: prev ? prev.version + 1 : data.skill.version, created_at: now() };
    registry.set(data.skill.name, data.skill);
  }
  const ev = {
    type: tmpl.type,
    run_id: run.run_id,
    seq: run.events.length + 1,
    timestamp: now(),
    phase: tmpl.phase,
    message: fill(tmpl.message ?? "", run.run_id),
    data,
  };
  // Nejdřív uložit, potom odeslat (kapitola 15.3).
  run.events.push(ev);
  const st = STATUS_BY_EVENT[ev.type];
  if (st) {
    run.status = st;
    if (st !== "running" && st !== "awaiting_approval") run.finished_at = ev.timestamp;
  }
  broadcast(ev);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const jitter = () => 300 + Math.random() * 1200;

async function play(run, scenario) {
  for (let i = 0; i < scenario.length; i++) {
    const tmpl = scenario[i];
    if (tmpl.phase === "done" && tmpl.type !== "voice_ready") {
      // Čekej na rozhodnutí analytika (kapitola 13.3).
      const decision = run.decision ?? (await new Promise((resolve) => (run.decide = resolve)));
      await sleep(jitter());
      if (decision.kind === "reject") {
        emit(run, {
          type: "rule_rejected",
          phase: "done",
          message: "The analyst rejected the rule.",
          data: { reason: decision.reason },
        });
        return;
      }
      for (const rest of scenario.slice(i)) {
        const t = rest.type === "rule_approved" ? { ...rest, data: { ...rest.data, comment: decision.comment } } : rest;
        emit(run, t);
        await sleep(jitter());
      }
      return;
    }
    await sleep(jitter());
    emit(run, tmpl);
  }
}

function decideRun(run, decision) {
  run.decision = decision;
  run.decide?.(decision);
  run.decide = null;
}

// ---------- HTTP ----------

function send(req, res, status, body) {
  const origin = req.headers.origin;
  const headers = { "Content-Type": "application/json; charset=utf-8" };
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Vary"] = "Origin";
  }
  res.writeHead(status, headers);
  res.end(JSON.stringify(body));
}

const err = (req, res, status, code, message) => send(req, res, status, { error: { code, message } });

async function readJson(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return {};
  return JSON.parse(raw);
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  const path = url.pathname;

  if (req.method === "OPTIONS") {
    const origin = req.headers.origin;
    res.writeHead(204, {
      ...(origin && ALLOWED_ORIGINS.includes(origin) ? { "Access-Control-Allow-Origin": origin, Vary: "Origin" } : {}),
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "600",
    });
    return res.end();
  }

  try {
    if (req.method === "GET" && path === "/api/health") {
      return send(req, res, 200, { status: "ok", contract_version: 1 });
    }

    if (path === "/api/runs" && req.method === "POST") {
      let body;
      try {
        body = await readJson(req);
      } catch {
        return err(req, res, 400, "INVALID_REQUEST", "The request body is not valid JSON.");
      }
      const text = typeof body?.request === "string" ? body.request.trim() : "";
      if (text.length < 1 || text.length > 2000) {
        return err(req, res, 400, "INVALID_REQUEST", "The request must be 1 to 2000 characters long.");
      }
      if (hasActiveRun()) {
        return err(req, res, 409, "RUN_ALREADY_ACTIVE", "Another run is still in progress.");
      }
      const run_id = "run_" + randomBytes(6).toString("hex").slice(0, 8);
      const run = {
        run_id,
        request: text,
        status: "running",
        created_at: now(),
        finished_at: null,
        events: [],
        decision: null, // rozhodnutí analytika (atomicky: jen první uspěje)
        decide: null,
      };
      runs.set(run_id, run);
      const key = pickScenario(text);
      console.log(`[mock] ${run_id}: scénář ${key}`);
      void play(run, loadScenario(key)).catch((e) => console.error(e));
      return send(req, res, 202, { run_id, status: "running" });
    }

    if (path === "/api/runs" && req.method === "GET") {
      const list = [...runs.values()].reverse().map(runInfo);
      return send(req, res, 200, { runs: list });
    }

    if (path === "/api/skills" && req.method === "GET") {
      const skills = [...registry.values()].sort((a, b) => a.name.localeCompare(b.name));
      return send(req, res, 200, { skills });
    }

    const m = path.match(/^\/api\/runs\/([^/]+)\/(events|approve|reject|audio)$/);
    if (m) {
      const [, runId, action] = m;
      const run = RUN_ID_RE.test(runId) ? runs.get(runId) : undefined;
      if (!run) return err(req, res, 404, "RUN_NOT_FOUND", "Run not found.");

      if (action === "events" && req.method === "GET") {
        const raw = url.searchParams.get("after_seq") ?? "0";
        if (!/^\d+$/.test(raw)) return err(req, res, 400, "INVALID_REQUEST", "Invalid after_seq.");
        const after = Number(raw);
        return send(req, res, 200, { events: run.events.filter((e) => e.seq > after) });
      }

      if (action === "audio" && req.method === "GET") {
        return err(req, res, 404, "AUDIO_NOT_FOUND", "This run has no voice summary.");
      }

      if ((action === "approve" || action === "reject") && req.method === "POST") {
        let body;
        try {
          body = await readJson(req);
        } catch {
          return err(req, res, 400, "INVALID_REQUEST", "The request body is not valid JSON.");
        }
        if (action === "approve") {
          const c = body?.comment;
          if (c !== undefined && (typeof c !== "string" || c.length > 500)) {
            return err(req, res, 400, "INVALID_REQUEST", "The comment can be at most 500 characters long.");
          }
          if (run.status !== "awaiting_approval" || run.decision) {
            return err(req, res, 409, "NOT_AWAITING_APPROVAL", "This run is not waiting for approval.");
          }
          decideRun(run, { kind: "approve", comment: c ? c : null });
          return send(req, res, 200, { status: "approved" });
        }
        const r = typeof body?.reason === "string" ? body.reason.trim() : "";
        if (r.length < 1 || r.length > 500) {
          return err(req, res, 400, "INVALID_REQUEST", "The reason must be 1 to 500 characters long.");
        }
        if (run.status !== "awaiting_approval" || run.decision) {
          return err(req, res, 409, "NOT_AWAITING_APPROVAL", "This run is not waiting for approval.");
        }
        decideRun(run, { kind: "reject", reason: r });
        return send(req, res, 200, { status: "rejected" });
      }
    }

    return err(req, res, 404, "INVALID_REQUEST", "Unknown path.");
  } catch (e) {
    console.error(e);
    return err(req, res, 500, "INTERNAL_ERROR", "Unexpected mock error.");
  }
});

// ---------- WebSocket (minimální, jen server → klient) ----------

const clients = new Set();
const WS_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";

server.on("upgrade", (req, socket) => {
  const url = new URL(req.url, "http://localhost");
  const key = req.headers["sec-websocket-key"];
  if (url.pathname !== "/api/ws" || !key) {
    socket.end("HTTP/1.1 400 Bad Request\r\n\r\n");
    return;
  }
  const accept = createHash("sha1").update(key + WS_GUID).digest("base64");
  socket.write(
    "HTTP/1.1 101 Switching Protocols\r\n" +
      "Upgrade: websocket\r\n" +
      "Connection: Upgrade\r\n" +
      `Sec-WebSocket-Accept: ${accept}\r\n\r\n`,
  );
  socket.setNoDelay(true);
  clients.add(socket);

  let buf = Buffer.alloc(0);
  socket.on("data", (chunk) => {
    buf = Buffer.concat([buf, chunk]);
    while (buf.length >= 2) {
      const opcode = buf[0] & 0x0f;
      const masked = (buf[1] & 0x80) !== 0;
      let len = buf[1] & 0x7f;
      let off = 2;
      if (len === 126) {
        if (buf.length < 4) return;
        len = buf.readUInt16BE(2);
        off = 4;
      } else if (len === 127) {
        if (buf.length < 10) return;
        len = Number(buf.readBigUInt64BE(2));
        off = 10;
      }
      const total = off + (masked ? 4 : 0) + len;
      if (buf.length < total) return;
      const mask = masked ? buf.subarray(off, off + 4) : null;
      const payload = Buffer.from(buf.subarray(off + (masked ? 4 : 0), total));
      if (mask) for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i % 4];
      buf = buf.subarray(total);
      if (opcode === 0x8) {
        socket.end(Buffer.from([0x88, 0x00]));
        clients.delete(socket);
        return;
      }
      if (opcode === 0x9) socket.write(frame(payload, 0xa));
      // Frontend nic neposílá, ostatní zprávy ignorujeme.
    }
  });
  const drop = () => clients.delete(socket);
  socket.on("close", drop);
  socket.on("error", drop);
});

function frame(payload, opcode = 0x1) {
  const len = payload.length;
  let header;
  if (len < 126) {
    header = Buffer.from([0x80 | opcode, len]);
  } else if (len < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x80 | opcode;
    header[1] = 126;
    header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x80 | opcode;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(len), 2);
  }
  return Buffer.concat([header, payload]);
}

function broadcast(ev) {
  const f = frame(Buffer.from(JSON.stringify(ev), "utf8"));
  for (const s of clients) {
    if (s.writableLength > 1_000_000) {
      // pomalý klient nesmí zdržet běh
      s.destroy();
      clients.delete(s);
      continue;
    }
    s.write(f);
  }
}

server.listen(PORT, () => {
  console.log(`[mock] poslouchám na http://localhost:${PORT}  (WebSocket ws://localhost:${PORT}/api/ws)`);
});
