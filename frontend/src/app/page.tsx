"use client";

import { useEffect, useMemo, useState } from "react";
import { Composer, SUGGESTIONS, Thread } from "@/components/Conversation";
import { IconPanel, IconSidebar, Logo } from "@/components/icons";
import { InfoPanel } from "@/components/InfoPanel";
import { Sidebar } from "@/components/Sidebar";
import { StatusPill } from "@/components/ui";
import { api } from "@/lib/api";
import { installedSkills, isActive, runRequest, runStatus, sortRuns } from "@/lib/derive";
import { CONTRACT_VERSION } from "@/lib/types";
import { useStore } from "@/lib/useStore";

type Health = "checking" | "ok" | "mismatch" | "down";

function useHealth(dep: unknown): Health {
  const [health, setHealth] = useState<Health>("checking");
  useEffect(() => {
    let cancelled = false;
    api
      .health()
      .then((h) => !cancelled && setHealth(h?.contract_version === CONTRACT_VERSION ? "ok" : "mismatch"))
      .catch(() => !cancelled && setHealth("down"));
    return () => {
      cancelled = true;
    };
  }, [dep]);
  return health;
}

export default function Home() {
  const state = useStore();
  const health = useHealth(state.connection);
  const [selected, setSelected] = useState<string | null>(null); // null = new detection
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileNav, setMobileNav] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [prefill, setPrefill] = useState<{ text: string; n: number } | null>(null);

  const runs = useMemo(() => sortRuns(state.runs), [state.runs]);
  const skills = useMemo(() => installedSkills(state.skills, state.runs), [state.skills, state.runs]);

  const run = selected ? state.runs[selected] : undefined;
  const waiting = selected !== null && !run && selected === pendingId;
  const showHome = !run && !waiting;
  const busy = runs.some((r) => isActive(runStatus(r)));

  function select(id: string | null) {
    setSelected(id);
    setPendingId(null);
    setMobileNav(false);
  }

  const notice =
    health === "mismatch"
      ? `Contract version mismatch: the frontend expects version ${CONTRACT_VERSION}.`
      : health === "down"
        ? "The backend is not responding."
        : state.syncError;

  const sidebar = (
    <Sidebar
      runs={runs}
      selected={selected}
      onSelect={select}
      onNew={() => select(null)}
      onClose={() => {
        setSidebarOpen(false);
        setMobileNav(false);
      }}
      connection={state.connection}
    />
  );

  return (
    <div className="flex h-dvh overflow-hidden">
      {/* Desktop sidebar */}
      {sidebarOpen && <aside className="hidden shrink-0 lg:block">{sidebar}</aside>}

      {/* Mobile sidebar */}
      {mobileNav && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Close menu"
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileNav(false)}
          />
          <aside className="relative h-full w-[260px] shadow-xl">{sidebar}</aside>
        </div>
      )}

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-2 px-3">
          <button
            type="button"
            onClick={() => setMobileNav(true)}
            aria-label="Open menu"
            className="rounded-lg p-1.5 text-muted hover:bg-hover hover:text-fg lg:hidden"
          >
            <IconSidebar className="size-5" />
          </button>
          {!sidebarOpen && (
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open sidebar"
              className="hidden rounded-lg p-1.5 text-muted hover:bg-hover hover:text-fg lg:block"
            >
              <IconSidebar className="size-5" />
            </button>
          )}
          <div className="flex min-w-0 flex-1 items-center gap-2.5 px-1">
            {run ? (
              <>
                <span className="truncate text-sm font-medium">{runRequest(run) ?? run.run_id}</span>
                <span className="hidden sm:inline-flex">
                  <StatusPill status={runStatus(run)} />
                </span>
              </>
            ) : (
              <span className="text-sm font-medium text-muted">Frankenstein</span>
            )}
          </div>
          <button
            type="button"
            onClick={() => setPanelOpen((o) => !o)}
            aria-pressed={panelOpen}
            className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm ${
              panelOpen ? "bg-hover text-fg" : "text-muted hover:bg-hover hover:text-fg"
            }`}
          >
            <IconPanel className="size-4" />
            <span className="hidden sm:inline">Skills</span>
          </button>
        </header>

        {notice && (
          <div role="alert" className="mx-auto mb-2 w-full max-w-3xl px-4">
            <div className="rounded-lg border border-warn/40 px-3 py-2 text-sm text-warn">{notice}</div>
          </div>
        )}

        {showHome ? (
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto px-4 pb-[12vh]">
            <div className="w-full max-w-3xl">
              <div className="mb-8 text-center">
                <Logo className="mx-auto mb-4 size-10 text-fg" />
                <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">What should we detect?</h1>
                <p className="mt-2 text-sm text-muted">
                  Describe an attack. The agent plans a rule, builds missing skills, tests it on real logs and asks
                  you to approve it.
                </p>
              </div>
              <Composer
                busy={busy}
                autoFocus
                prefill={prefill}
                onCreated={(id) => {
                  setSelected(id);
                  setPendingId(id);
                }}
              />
              <div className="mt-6 grid gap-2 sm:grid-cols-3">
                {SUGGESTIONS.map((s, i) => (
                  <button
                    key={s.title}
                    type="button"
                    onClick={() => setPrefill({ text: s.text, n: i + Date.now() })}
                    className="rounded-xl border border-line px-3.5 py-3 text-left transition hover:bg-surface"
                  >
                    <div className="text-sm font-medium">{s.title}</div>
                    <div className="mt-0.5 line-clamp-2 text-xs text-subtle">{s.text}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <div className="mx-auto w-full max-w-3xl px-4 pt-4 pb-10">
                {run ? (
                  <Thread run={run} />
                ) : (
                  <p className="shimmer text-sm">Starting the agent…</p>
                )}
              </div>
            </div>
            <div className="shrink-0 px-4 pb-4">
              <div className="mx-auto w-full max-w-3xl">
                <Composer
                  busy={busy}
                  onCreated={(id) => {
                    setSelected(id);
                    setPendingId(id);
                  }}
                />
              </div>
            </div>
          </>
        )}
      </main>

      {panelOpen && (
        <>
          <button
            type="button"
            aria-label="Close panel"
            className="fixed inset-0 z-30 bg-black/40 xl:hidden"
            onClick={() => setPanelOpen(false)}
          />
          <aside className="fixed inset-y-0 right-0 z-40 xl:static xl:z-auto">
            <InfoPanel skills={skills} run={run} runs={runs} onClose={() => setPanelOpen(false)} />
          </aside>
        </>
      )}
    </div>
  );
}
