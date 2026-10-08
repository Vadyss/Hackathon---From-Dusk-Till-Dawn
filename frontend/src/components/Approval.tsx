"use client";

import { useRef, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { dataOf, FAIL_LABEL, lastOf, runStatus } from "@/lib/derive";
import type { RunState } from "@/lib/engine";
import { MetricsCard } from "./Metrics";
import { Badge, Empty, JsonBlock, Panel } from "./ui";

const MAX_COMMENT = 500;
const MAX_REASON = 500;

export function ApprovalPanel({ run }: { run: RunState | undefined }) {
  // key = run_id, aby se rozpracovaný stav nepřenášel mezi běhy
  return (
    <Panel title="Schválení">
      {run ? <ApprovalBody key={run.run_id} run={run} /> : <Empty>Vyber běh.</Empty>}
    </Panel>
  );
}

function ApprovalBody({ run }: { run: RunState }) {
  const status = runStatus(run);

  if (status === "approved" || status === "rejected" || status === "failed") {
    return <Outcome run={run} />;
  }
  if (status !== "awaiting_approval") {
    return <Empty>Panel se odemkne, až pravidlo projde ověřovací sadou.</Empty>;
  }
  return <Decision run={run} />;
}

function Decision({ run }: { run: RunState }) {
  const [comment, setComment] = useState("");
  const [reason, setReason] = useState("");
  const [mode, setMode] = useState<"approve" | "reject">("approve");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lock = useRef(false); // synchronní pojistka proti dvojkliku

  const ev = lastOf(run, "awaiting_approval");
  if (!ev) return null;
  const d = dataOf(ev, "awaiting_approval");
  const newSkills = Array.isArray(d.new_skills) ? d.new_skills : [];

  async function send(kind: "approve" | "reject") {
    if (lock.current) return;
    lock.current = true;
    setPending(true);
    setError(null);
    try {
      if (kind === "approve") await api.approve(run.run_id, comment.trim());
      else await api.reject(run.run_id, reason.trim());
      // Tlačítka zůstanou zamčená, dokud nepřijde koncová událost (ApprovalBody se přepne).
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Požadavek se nepodařilo odeslat.");
      lock.current = false;
      setPending(false);
    }
  }

  const reasonOk = reason.trim().length >= 1 && reason.trim().length <= MAX_REASON;
  const commentOk = comment.trim().length <= MAX_COMMENT;

  return (
    <div className="space-y-4">
      <div>
        <div className="mb-1 text-[11px] tracking-wider text-muted uppercase">Pravidlo</div>
        <h3 className="mb-2 font-mono text-base font-semibold break-all text-fg">
          {typeof d.recipe?.name === "string" ? d.recipe.name : "—"}
        </h3>
        <JsonBlock value={d.recipe} />
      </div>

      <div className="grid gap-2">
        <MetricsCard title="Ladicí sada" metrics={d.metrics_tuning} />
        <MetricsCard title="Ověřovací sada" metrics={d.metrics_validation} />
      </div>

      <div>
        <div className="mb-1.5 text-[11px] tracking-wider text-muted uppercase">
          Nové dovednosti k instalaci ({newSkills.length})
        </div>
        {newSkills.length === 0 ? (
          <Empty>Agent nic nového nepostavil, jen znovu použil registr.</Empty>
        ) : (
          <ul className="space-y-1.5">
            {newSkills.map((s, i) => (
              <li key={`${s?.name}-${i}`} className="rounded-lg border border-warn/30 bg-warn/5 p-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="font-mono text-sm break-all text-fg">{String(s?.name ?? "")}</span>
                  <Badge tone="warn">kandidát</Badge>
                  <Badge>{String(s?.kind ?? "")}</Badge>
                </div>
                <p className="mt-1 text-xs break-words text-muted">{String(s?.description ?? "")}</p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-lg border border-line bg-bg/60 p-3">
        <div className="mb-2 grid grid-cols-2 gap-1 rounded-lg bg-panel p-1 text-xs font-medium">
          {(["approve", "reject"] as const).map((m) => (
            <button
              key={m}
              type="button"
              disabled={pending}
              onClick={() => setMode(m)}
              className={`rounded-md py-1.5 transition ${
                mode === m ? (m === "approve" ? "bg-ok/20 text-ok" : "bg-bad/20 text-bad") : "text-muted"
              }`}
            >
              {m === "approve" ? "Schválit" : "Zamítnout"}
            </button>
          ))}
        </div>

        {mode === "approve" ? (
          <>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              disabled={pending}
              rows={2}
              maxLength={MAX_COMMENT}
              placeholder="Komentář (nepovinný)"
              className="block w-full resize-y rounded-md border border-line bg-bg px-2.5 py-2 text-sm text-fg placeholder:text-muted/70 focus:border-accent/60 focus:outline-none disabled:opacity-60"
            />
            <button
              type="button"
              onClick={() => void send("approve")}
              disabled={pending || !commentOk}
              className="mt-2 w-full rounded-lg bg-ok px-3 py-2 text-sm font-semibold text-bg transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {pending ? "Odesláno, čekám na potvrzení…" : "Schválit a nasadit"}
            </button>
          </>
        ) : (
          <>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={pending}
              rows={2}
              maxLength={MAX_REASON}
              placeholder="Důvod zamítnutí (povinný)"
              className="block w-full resize-y rounded-md border border-line bg-bg px-2.5 py-2 text-sm text-fg placeholder:text-muted/70 focus:border-bad/60 focus:outline-none disabled:opacity-60"
            />
            <button
              type="button"
              onClick={() => void send("reject")}
              disabled={pending || !reasonOk}
              className="mt-2 w-full rounded-lg bg-bad px-3 py-2 text-sm font-semibold text-bg transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {pending ? "Odesláno, čekám na potvrzení…" : "Zamítnout"}
            </button>
          </>
        )}
        {error && (
          <p role="alert" className="mt-2 text-sm break-words text-bad">
            {error}
          </p>
        )}
        <p className="mt-2 text-[11px] text-muted">
          Tlačítko je jen žádost. O schválení rozhoduje backend.
        </p>
      </div>
    </div>
  );
}

function Outcome({ run }: { run: RunState }) {
  const approved = lastOf(run, "rule_approved");
  const rejected = lastOf(run, "rule_rejected");
  const failed = lastOf(run, "run_failed");
  const installed = run.events.filter((e) => e.type === "skill_installed");

  if (approved) {
    const d = dataOf(approved, "rule_approved");
    return (
      <div className="space-y-2">
        <Badge tone="ok">✓ Pravidlo schváleno</Badge>
        <p className="font-mono text-sm break-all text-fg">{String(d.rule_name ?? "")}</p>
        {typeof d.comment === "string" && d.comment && (
          <p className="text-sm break-words text-muted">„{d.comment}“</p>
        )}
        {installed.length > 0 && (
          <p className="text-xs text-muted">
            Do registru přibylo:{" "}
            {installed.map((e, i) => (
              <span key={e.seq} className="font-mono text-ok">
                {i > 0 && ", "}
                {String(dataOf(e, "skill_installed").skill?.name ?? "")}
              </span>
            ))}
          </p>
        )}
      </div>
    );
  }
  if (rejected) {
    const d = dataOf(rejected, "rule_rejected");
    return (
      <div className="space-y-2">
        <Badge>Pravidlo zamítnuto</Badge>
        <p className="text-sm break-words text-muted">{String(d.reason ?? "")}</p>
      </div>
    );
  }
  if (failed) {
    const d = dataOf(failed, "run_failed");
    const code = String(d.reason_code ?? "");
    return (
      <div className="space-y-2">
        <Badge tone="bad">
          ✗ Běh selhal · <span className="font-mono">{code}</span>
        </Badge>
        {FAIL_LABEL[code] && <p className="text-sm font-medium text-fg">{FAIL_LABEL[code]}</p>}
        <p className="text-sm break-words text-muted">{String(d.reason ?? "")}</p>
      </div>
    );
  }
  return null;
}
