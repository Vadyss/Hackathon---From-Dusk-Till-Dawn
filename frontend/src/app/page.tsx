"use client";

import { useMemo, useState } from "react";
import { ApprovalPanel } from "@/components/Approval";
import { Composer, Conversation } from "@/components/Chat";
import { ComparePanel } from "@/components/Compare";
import { Header } from "@/components/Header";
import { PhaseStepper } from "@/components/PhaseStepper";
import { RunsList, SkillsPanel } from "@/components/Sidebar";
import { Timeline } from "@/components/Timeline";
import { Empty, Panel, StatusBadge } from "@/components/ui";
import { installedSkills, isActive, runStatus, sortRuns } from "@/lib/derive";
import { useStore } from "@/lib/useStore";

export default function Home() {
  const state = useStore();
  const [selected, setSelected] = useState<string | null>(null);
  const [justCreated, setJustCreated] = useState<string | null>(null);

  const runs = useMemo(() => sortRuns(state.runs), [state.runs]);
  const skills = useMemo(() => installedSkills(state.skills, state.runs), [state.skills, state.runs]);

  // Vybraný běh; nový běh čeká na první událost, jinak spadne na nejnovější.
  const waitingForNew = selected !== null && selected === justCreated && !state.runs[selected];
  const currentId = selected && state.runs[selected] ? selected : waitingForNew ? null : (runs[0]?.run_id ?? null);
  const run = currentId ? state.runs[currentId] : undefined;
  const anyActive = runs.some((r) => isActive(runStatus(r)));

  return (
    <div className="flex min-h-full flex-col">
      <Header connection={state.connection} syncError={state.syncError} />

      <main className="mx-auto grid w-full max-w-[1600px] flex-1 gap-4 p-4 lg:grid-cols-[280px_minmax(0,1fr)] xl:grid-cols-[300px_minmax(0,1fr)_380px]">
        <aside className="space-y-4 lg:row-span-2 xl:row-span-1">
          <RunsList
            runs={runs}
            selected={currentId}
            onSelect={(id) => {
              setSelected(id);
              setJustCreated(null);
            }}
          />
          <SkillsPanel skills={skills} run={run} />
        </aside>

        <section className="min-w-0 space-y-4">
          <Panel title="Nový požadavek">
            <Composer
              blocked={anyActive}
              onCreated={(id) => {
                setSelected(id);
                setJustCreated(id);
              }}
            />
          </Panel>

          <Panel
            title={
              run ? (
                <span className="flex items-center gap-2 normal-case">
                  <span className="font-mono tracking-normal">{run.run_id}</span>
                </span>
              ) : (
                "Průběh"
              )
            }
            right={run ? <StatusBadge status={runStatus(run)} /> : undefined}
          >
            {run ? (
              <div className="space-y-5">
                <PhaseStepper run={run} />
                <Conversation run={run} />
                <div className="max-h-[60vh] overflow-y-auto pr-1 pt-1">
                  <Timeline run={run} />
                </div>
              </div>
            ) : waitingForNew ? (
              <Empty>Požadavek přijat, čekám na první událost…</Empty>
            ) : (
              <Empty>{state.loaded ? "Zatím žádný běh." : "Načítám historii…"}</Empty>
            )}
          </Panel>
        </section>

        <aside className="min-w-0 space-y-4 lg:col-start-2 xl:col-start-auto">
          <ApprovalPanel run={run} />
          <ComparePanel runs={runs} />
        </aside>
      </main>
    </div>
  );
}
