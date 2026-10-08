"use client";

import { useEffect, useRef } from "react";
import { dataOf, FAIL_LABEL, formatTime, PHASE_LABEL } from "@/lib/derive";
import type { RunState } from "@/lib/engine";
import type { RunEvent, SkillInfo } from "@/lib/types";
import { MetricsInline } from "./Metrics";
import { Badge, Empty, JsonBlock } from "./ui";

type Tone = "ok" | "bad" | "warn" | "info" | "neutral";

function toneOf(e: RunEvent): Tone {
  switch (e.type) {
    case "run_failed":
    case "policy_rejected":
    case "skill_tests_failed":
      return "bad";
    case "rule_evaluated":
      return dataOf(e, "rule_evaluated").metrics?.passed === true ? "ok" : "bad";
    case "validation_done":
      return dataOf(e, "validation_done").metrics?.passed === true ? "ok" : "bad";
    case "skill_candidate_ready":
    case "skill_installed":
    case "rule_approved":
      return "ok";
    case "awaiting_approval":
    case "capability_missing":
      return "warn";
    case "rule_rejected":
      return "neutral";
    default:
      return "info";
  }
}

const DOT: Record<Tone, string> = {
  ok: "bg-ok",
  bad: "bg-bad",
  warn: "bg-warn",
  info: "bg-info",
  neutral: "bg-muted",
};

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}
function arr<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

function Details({ e }: { e: RunEvent }) {
  switch (e.type) {
    case "plan_ready": {
      const d = dataOf(e, "plan_ready");
      return (
        <div className="space-y-2">
          <ol className="list-decimal space-y-0.5 pl-5 text-sm text-fg/90">
            {arr<string>(d.steps).map((s, i) => (
              <li key={i}>{str(s)}</li>
            ))}
          </ol>
          <div className="flex flex-wrap gap-1">
            {arr<string>(d.skills_needed).map((s, i) => (
              <Badge key={i}>
                <span className="font-mono">{str(s)}</span>
              </Badge>
            ))}
          </div>
        </div>
      );
    }
    case "skill_reused":
    case "skill_installed": {
      const s = (e.data as { skill?: Partial<SkillInfo> }).skill;
      if (!s) return null;
      return (
        <p className="text-xs text-muted">
          <span className="font-mono text-fg">{str(s.name)}</span> v{s.version} · {str(s.kind)} ·{" "}
          {s.origin === "seed" ? "výchozí" : "od agenta"} — {str(s.description)}
        </p>
      );
    }
    case "capability_missing": {
      const d = dataOf(e, "capability_missing");
      return (
        <ul className="space-y-0.5 text-xs text-muted">
          {arr<{ name: string; description: string }>(d.skills).map((s, i) => (
            <li key={i}>
              <span className="font-mono text-warn">{str(s?.name)}</span> — {str(s?.description)}
            </li>
          ))}
        </ul>
      );
    }
    case "forge_started": {
      const d = dataOf(e, "forge_started");
      return (
        <p className="text-xs text-muted">
          <span className="font-mono text-fg">{str(d.skill)}</span> · pokus {d.attempt} z {d.max_attempts}
        </p>
      );
    }
    case "skill_tests_failed": {
      const d = dataOf(e, "skill_tests_failed");
      return (
        <div className="space-y-1">
          <p className="text-xs text-muted">
            <span className="font-mono text-fg">{str(d.skill)}</span> · pokus {d.attempt} · selhalo{" "}
            {d.tests_failed} z {d.tests_total} testů
          </p>
          {str(d.error_excerpt) && (
            <pre className="rounded-md border border-bad/30 bg-bad/5 p-2 font-mono text-xs whitespace-pre-wrap break-all text-bad/90">
              {str(d.error_excerpt)}
            </pre>
          )}
        </div>
      );
    }
    case "skill_candidate_ready": {
      const d = dataOf(e, "skill_candidate_ready");
      return (
        <p className="text-xs break-all text-muted">
          <span className="font-mono text-fg">{str(d.skill?.name)}</span> · pokus {d.attempt} · všech{" "}
          {d.tests_total} testů prošlo · sha256{" "}
          <span className="font-mono" title={str(d.code_sha256)}>
            {str(d.code_sha256).slice(0, 12)}…
          </span>
        </p>
      );
    }
    case "rule_drafted": {
      const d = dataOf(e, "rule_drafted");
      return (
        <div className="space-y-1.5">
          <p className="text-xs text-muted">
            Pokus {d.attempt} z {d.max_attempts} · recept{" "}
            <span className="font-mono text-fg">{str(d.recipe?.name)}</span>
          </p>
          {str(d.explanation) && <p className="text-sm text-fg/90">{str(d.explanation)}</p>}
          {d.recipe && (
            <details className="group">
              <summary className="cursor-pointer text-xs text-accent select-none">Zobrazit recept</summary>
              <div className="mt-1.5">
                <JsonBlock value={d.recipe} />
              </div>
            </details>
          )}
        </div>
      );
    }
    case "rule_evaluated": {
      const d = dataOf(e, "rule_evaluated");
      return (
        <div className="space-y-1">
          <p className="text-xs text-muted">Ladicí sada · pokus {d.attempt}</p>
          <MetricsInline metrics={d.metrics} />
        </div>
      );
    }
    case "validation_done": {
      const d = dataOf(e, "validation_done");
      return (
        <div className="space-y-1">
          <p className="text-xs text-muted">Ověřovací sada (agent ji nikdy neviděl)</p>
          <MetricsInline metrics={d.metrics} />
        </div>
      );
    }
    case "policy_rejected": {
      const d = dataOf(e, "policy_rejected");
      return (
        <div className="space-y-1">
          <p className="text-xs text-muted">
            Cíl: {str(d.target)}
            {d.name ? (
              <>
                {" "}
                · <span className="font-mono text-fg">{str(d.name)}</span>
              </>
            ) : null}{" "}
            · pokus {d.attempt}
          </p>
          <ul className="space-y-1">
            {arr<{ code: string; detail: string }>(d.violations).map((v, i) => (
              <li key={i} className="flex flex-wrap items-baseline gap-2 text-xs">
                <Badge tone="bad">
                  <span className="font-mono">{str(v?.code)}</span>
                </Badge>
                <span className="text-fg/90">{str(v?.detail)}</span>
              </li>
            ))}
          </ul>
        </div>
      );
    }
    case "run_failed": {
      const d = dataOf(e, "run_failed");
      return (
        <div className="space-y-1">
          <Badge tone="bad">
            <span className="font-mono">{str(d.reason_code)}</span>
            {FAIL_LABEL[str(d.reason_code)] && <span>· {FAIL_LABEL[str(d.reason_code)]}</span>}
          </Badge>
          {str(d.reason) && <p className="text-sm text-fg/90">{str(d.reason)}</p>}
        </div>
      );
    }
    case "rule_approved": {
      const d = dataOf(e, "rule_approved");
      return (
        <p className="text-xs text-muted">
          Pravidlo <span className="font-mono text-fg">{str(d.rule_name)}</span>
          {str(d.comment) && <> · „{str(d.comment)}“</>}
        </p>
      );
    }
    case "rule_rejected": {
      const d = dataOf(e, "rule_rejected");
      return <p className="text-xs text-muted">Důvod: {str(d.reason)}</p>;
    }
    default:
      return null;
  }
}

export function Timeline({ run }: { run: RunState | undefined }) {
  const endRef = useRef<HTMLLIElement>(null);
  const count = run?.events.length ?? 0;

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [count]);

  if (!run || count === 0) return <Empty>Zatím žádné události.</Empty>;

  return (
    <ol className="relative space-y-3 border-l border-line pl-5">
      {run.events.map((e) => {
        const tone = toneOf(e);
        return (
          <li key={e.seq} className="relative animate-in">
            <span
              className={`absolute top-1.5 -left-[25px] size-2.5 rounded-full ring-4 ring-panel ${DOT[tone]}`}
            />
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <time className="font-mono text-[11px] text-muted" dateTime={e.timestamp}>
                {formatTime(e.timestamp)}
              </time>
              <Badge>{PHASE_LABEL[e.phase] ?? e.phase}</Badge>
              <span className="min-w-0 text-sm break-words text-fg">{e.message}</span>
            </div>
            <div className="mt-1 min-w-0 break-words">
              <Details e={e} />
            </div>
          </li>
        );
      })}
      <li ref={endRef} aria-hidden className="h-0 list-none" />
    </ol>
  );
}
