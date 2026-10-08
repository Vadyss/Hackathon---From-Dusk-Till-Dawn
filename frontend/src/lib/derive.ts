// Odvozené hodnoty z událostí (kapitoly 11 a 12.5).
import type { RunState } from "./engine";
import {
  PHASES,
  type EventDataMap,
  type KnownEventType,
  type Phase,
  type RunEvent,
  type RunStatus,
  type SkillInfo,
} from "./types";

export function dataOf<K extends KnownEventType>(e: RunEvent, type: K): Partial<EventDataMap[K]> {
  return (e.type === type ? e.data : {}) as Partial<EventDataMap[K]>;
}

export function lastOf<K extends KnownEventType>(run: RunState, type: K): RunEvent | undefined {
  for (let i = run.events.length - 1; i >= 0; i--) {
    if (run.events[i].type === type) return run.events[i];
  }
  return undefined;
}

// Kapitola 11.7
const STATUS_BY_EVENT: Record<string, RunStatus> = {
  run_started: "running",
  awaiting_approval: "awaiting_approval",
  rule_approved: "approved",
  rule_rejected: "rejected",
  run_failed: "failed",
};

export function runStatus(run: RunState): RunStatus | null {
  let status: RunStatus | null = null;
  for (const e of run.events) {
    const s = STATUS_BY_EVENT[e.type];
    if (s) status = s;
  }
  return status;
}

export function isActive(status: RunStatus | null) {
  return status === "running" || status === "awaiting_approval";
}

export function currentPhase(run: RunState): Phase | null {
  let idx = -1;
  for (const e of run.events) {
    const i = PHASES.indexOf(e.phase as Phase);
    if (i > idx) idx = i;
  }
  return idx >= 0 ? PHASES[idx] : null;
}

export function phasesSeen(run: RunState): Set<string> {
  return new Set(run.events.map((e) => e.phase));
}

export function runRequest(run: RunState): string | null {
  const e = run.events.find((x) => x.type === "run_started");
  const r = e ? dataOf(e, "run_started").request : undefined;
  return typeof r === "string" ? r : null;
}

export function runCreatedAt(run: RunState): number {
  const t = Date.parse(run.created_at ?? run.events[0]?.timestamp ?? "");
  return Number.isNaN(t) ? 0 : t;
}

export function sortRuns(runs: Record<string, RunState>): RunState[] {
  return Object.values(runs).sort((a, b) => runCreatedAt(b) - runCreatedAt(a));
}

// Dovednosti: výchozí seznam z GET /api/skills + každé skill_installed.
export function installedSkills(base: SkillInfo[], runs: Record<string, RunState>): SkillInfo[] {
  const byName = new Map<string, SkillInfo>();
  for (const s of base) if (s && typeof s.name === "string") byName.set(s.name, s);
  for (const run of Object.values(runs)) {
    for (const e of run.events) {
      if (e.type !== "skill_installed") continue;
      const s = dataOf(e, "skill_installed").skill;
      if (!s || typeof s.name !== "string") continue;
      const prev = byName.get(s.name);
      if (!prev || (s.version ?? 0) >= (prev.version ?? 0)) byName.set(s.name, s);
    }
  }
  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function reusedSkillNames(run: RunState | undefined): Set<string> {
  const names = new Set<string>();
  if (!run) return names;
  for (const e of run.events) {
    if (e.type !== "skill_reused") continue;
    const s = dataOf(e, "skill_reused").skill;
    if (s && typeof s.name === "string") names.add(s.name);
  }
  return names;
}

export function candidateSkills(run: RunState | undefined): SkillInfo[] {
  if (!run) return [];
  const status = runStatus(run);
  if (status !== "running" && status !== "awaiting_approval") return [];
  const out: SkillInfo[] = [];
  for (const e of run.events) {
    if (e.type !== "skill_candidate_ready") continue;
    const s = dataOf(e, "skill_candidate_ready").skill;
    if (s && typeof s.name === "string") out.push(s);
  }
  return out;
}

export function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString("cs-CZ", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("cs-CZ", {
    day: "numeric",
    month: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatRatio(v: number | null | undefined): string {
  return typeof v === "number" ? `${(v * 100).toFixed(0)} %` : "—";
}

export const PHASE_LABEL: Record<string, string> = {
  intake: "Příjem",
  plan: "Plán",
  forge: "Kovárna",
  rule: "Pravidlo",
  validation: "Ověření",
  approval: "Schválení",
  done: "Hotovo",
};

export const STATUS_LABEL: Record<RunStatus, string> = {
  running: "Běží",
  awaiting_approval: "Čeká na schválení",
  approved: "Schváleno",
  rejected: "Zamítnuto",
  failed: "Selhalo",
};

export const FAIL_LABEL: Record<string, string> = {
  REQUEST_REJECTED: "Požadavek odmítnut vrátným",
  PLAN_INVALID: "Neplatný plán",
  FORGE_FAILED: "Kovárna selhala",
  RULE_FAILED: "Pravidlo nesplnilo hranice",
  VALIDATION_FAILED: "Neprošlo ověřovací sadou",
  LLM_ERROR: "Chyba LLM API",
  SANDBOX_ERROR: "Chyba sandboxu",
  INTERNAL_ERROR: "Interní chyba backendu",
};
