import {
  candidateSkills,
  formatDateTime,
  reusedSkillNames,
  runRequest,
  runStatus,
} from "@/lib/derive";
import type { RunState } from "@/lib/engine";
import type { SkillInfo } from "@/lib/types";
import { Badge, Empty, Panel, StatusBadge } from "./ui";

export function RunsList({
  runs,
  selected,
  onSelect,
}: {
  runs: RunState[];
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <Panel title="Běhy" right={<span className="font-mono text-[11px] text-muted">{runs.length}</span>}>
      {runs.length === 0 ? (
        <Empty>Zatím žádný běh. Zadej první požadavek.</Empty>
      ) : (
        <ul className="-mx-2 max-h-[40vh] space-y-1 overflow-y-auto">
          {runs.map((r) => {
            const active = r.run_id === selected;
            return (
              <li key={r.run_id}>
                <button
                  type="button"
                  onClick={() => onSelect(r.run_id)}
                  className={`w-full rounded-lg px-2 py-2 text-left transition ${
                    active ? "bg-accent/10 ring-1 ring-accent/40" : "hover:bg-bg"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[11px] text-muted">{r.run_id}</span>
                    <StatusBadge status={runStatus(r)} />
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm break-all text-fg">
                    {runRequest(r) ?? "…"}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted">{formatDateTime(r.created_at)}</p>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

const KIND_LABEL: Record<string, string> = {
  parser: "parser",
  aggregation: "agregace",
  enrichment: "obohacení",
};

export function SkillsPanel({ skills, run }: { skills: SkillInfo[]; run: RunState | undefined }) {
  const reused = reusedSkillNames(run);
  const candidates = candidateSkills(run).filter((c) => !skills.some((s) => s.name === c.name));

  return (
    <Panel
      title="Registr dovedností"
      right={<span className="font-mono text-[11px] text-muted">{skills.length}</span>}
    >
      {skills.length === 0 && candidates.length === 0 ? (
        <Empty>Registr je prázdný.</Empty>
      ) : (
        <ul className="space-y-1.5">
          {skills.map((s) => {
            const hot = reused.has(s.name);
            return (
              <li
                key={s.name}
                className={`rounded-lg border p-2 transition ${
                  hot ? "border-info/50 bg-info/5" : "border-line"
                }`}
              >
                <SkillRow skill={s} />
                {hot && (
                  <div className="mt-1">
                    <Badge tone="info">↻ použito v tomto běhu</Badge>
                  </div>
                )}
              </li>
            );
          })}
          {candidates.map((s) => (
            <li key={`cand-${s.name}`} className="rounded-lg border border-dashed border-warn/50 bg-warn/5 p-2">
              <SkillRow skill={s} />
              <div className="mt-1">
                <Badge tone="warn">kandidát · čeká na schválení</Badge>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function SkillRow({ skill }: { skill: SkillInfo }) {
  return (
    <>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="min-w-0 font-mono text-sm break-all text-fg">{skill.name}</span>
        <span className="font-mono text-[11px] text-muted">v{skill.version}</span>
        <Badge>{KIND_LABEL[skill.kind] ?? skill.kind}</Badge>
        {skill.origin === "agent" ? <Badge tone="accent">od agenta</Badge> : <Badge>výchozí</Badge>}
      </div>
      <p className="mt-1 text-xs break-words text-muted">{skill.description}</p>
    </>
  );
}
