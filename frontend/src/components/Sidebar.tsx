// Copyright (c) 2026 Adam Krúpa and Ondra Csajka. All rights reserved.
"use client";

import { formatRelative, runCreatedAt, runRequest, runStatus } from "@/lib/derive";
import type { Connection, RunState } from "@/lib/engine";
import { IconPlus, IconSidebar, Logo } from "./icons";
import { StatusDot } from "./ui";

export function Sidebar({
  runs,
  selected,
  onSelect,
  onNew,
  onClose,
  connection,
}: {
  runs: RunState[];
  selected: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onClose: () => void;
  connection: Connection;
}) {
  return (
    <div className="flex h-full w-[260px] flex-col bg-sidebar">
      <div className="flex items-center justify-between px-3 pt-3 pb-2">
        <div className="flex items-center gap-2 px-1.5">
          <Logo className="size-6 text-fg" />
          <span className="text-[15px] font-semibold tracking-tight">Frankenstein</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close sidebar"
          className="rounded-lg p-1.5 text-muted hover:bg-hover hover:text-fg"
        >
          <IconSidebar className="size-5" />
        </button>
      </div>

      <div className="px-3">
        <button
          type="button"
          onClick={onNew}
          className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm hover:bg-hover"
        >
          <IconPlus className="size-4" />
          New detection
        </button>
      </div>

      <nav className="mt-4 min-h-0 flex-1 overflow-y-auto px-3 pb-3">
        <div className="px-2.5 pb-1 text-xs font-medium text-subtle">Recent runs</div>
        {runs.length === 0 ? (
          <p className="px-2.5 py-1.5 text-sm text-subtle">No runs yet</p>
        ) : (
          <ul>
            {runs.map((r) => {
              const active = r.run_id === selected;
              return (
                <li key={r.run_id}>
                  <button
                    type="button"
                    onClick={() => onSelect(r.run_id)}
                    className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm ${
                      active ? "bg-hover" : "hover:bg-hover"
                    }`}
                    title={runRequest(r) ?? r.run_id}
                  >
                    <StatusDot status={runStatus(r)} />
                    <span className="min-w-0 flex-1 truncate">{runRequest(r) ?? r.run_id}</span>
                    <span className="shrink-0 text-[11px] text-subtle">{formatRelative(runCreatedAt(r))}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </nav>

      <div className="border-t border-line px-5 py-3 text-xs text-subtle">
        <span className="inline-flex items-center gap-2">
          <span
            className={`size-1.5 rounded-full ${
              connection === "open" ? "bg-ok" : connection === "connecting" ? "bg-warn" : "bg-bad"
            }`}
          />
          {connection === "open" ? "Connected" : connection === "connecting" ? "Connecting…" : "Reconnecting…"}
        </span>
      </div>
    </div>
  );
}
