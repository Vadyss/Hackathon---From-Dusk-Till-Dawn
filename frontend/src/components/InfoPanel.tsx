"use client";

import { useState } from "react";
import { candidateSkills, reusedSkillNames } from "@/lib/derive";
import type { RunState } from "@/lib/engine";
import type { SkillInfo } from "@/lib/types";
import { Compare } from "./Compare";
import { IconX } from "./icons";
import { Tag } from "./ui";

const KIND_LABEL: Record<string, string> = {
  parser: "Parser",
  aggregation: "Aggregation",
  enrichment: "Enrichment",
};

// Right-hand panel: skill registry and run comparison.
export function InfoPanel({
  skills,
  run,
  runs,
  onClose,
}: {
  skills: SkillInfo[];
  run: RunState | undefined;
  runs: RunState[];
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"skills" | "compare">("skills");
  const reused = reusedSkillNames(run);
  const candidates = candidateSkills(run).filter((c) => !skills.some((s) => s.name === c.name));

  return (
    <div className="flex h-full w-[340px] max-w-[100vw] flex-col border-l border-line bg-bg">
      <div className="flex items-center justify-between px-4 pt-3">
        <div className="flex gap-1 rounded-lg bg-surface p-0.5 text-sm">
          {(["skills", "compare"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`rounded-md px-3 py-1 ${tab === t ? "bg-bg font-medium shadow-sm" : "text-muted hover:text-fg"}`}
            >
              {t === "skills" ? "Skills" : "Compare"}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close panel"
          className="rounded-lg p-1.5 text-muted hover:bg-hover hover:text-fg"
        >
          <IconX className="size-4" />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {tab === "skills" ? (
          <>
            <p className="mb-3 text-xs leading-relaxed text-subtle">
              Approved skills the agent can reuse. Skills used by the selected run are highlighted.
            </p>
            <ul className="space-y-2">
              {candidates.map((s) => (
                <SkillItem key={`c-${s.name}`} skill={s} note="Pending approval" noteClass="text-warn" dashed />
              ))}
              {skills.map((s) => (
                <SkillItem
                  key={s.name}
                  skill={s}
                  note={reused.has(s.name) ? "Used in this run" : undefined}
                  noteClass="text-info"
                  highlight={reused.has(s.name)}
                />
              ))}
              {skills.length === 0 && candidates.length === 0 && (
                <li className="text-sm text-subtle">The registry is empty.</li>
              )}
            </ul>
          </>
        ) : (
          <Compare runs={runs} />
        )}
      </div>
    </div>
  );
}

function SkillItem({
  skill,
  note,
  noteClass,
  highlight,
  dashed,
}: {
  skill: SkillInfo;
  note?: string;
  noteClass?: string;
  highlight?: boolean;
  dashed?: boolean;
}) {
  return (
    <li
      className={`rounded-xl border px-3 py-2.5 ${dashed ? "border-dashed" : ""} ${
        highlight ? "border-info/50" : "border-line"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 truncate font-mono text-[13px]">{skill.name}</span>
        <span className="shrink-0 text-[11px] text-subtle">v{skill.version}</span>
      </div>
      <p className="mt-1 text-xs leading-relaxed text-muted">{skill.description}</p>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <Tag>{KIND_LABEL[skill.kind] ?? skill.kind}</Tag>
        <Tag>{skill.origin === "agent" ? "Built by agent" : "Built-in"}</Tag>
        {note && <span className={`ml-auto text-[11px] font-medium ${noteClass}`}>{note}</span>}
      </div>
    </li>
  );
}
