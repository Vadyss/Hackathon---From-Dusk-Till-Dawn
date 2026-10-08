"use client";

import { useEffect, useState, type ReactNode } from "react";
import { api } from "@/lib/api";
import type { Connection } from "@/lib/engine";
import { CONTRACT_VERSION } from "@/lib/types";

type Health = { kind: "checking" } | { kind: "ok" } | { kind: "mismatch"; version: unknown } | { kind: "down" };

export function Header({ connection, syncError }: { connection: Connection; syncError: string | null }) {
  const [health, setHealth] = useState<Health>({ kind: "checking" });

  useEffect(() => {
    let cancelled = false;
    api
      .health()
      .then((h) => {
        if (cancelled) return;
        setHealth(
          h?.contract_version === CONTRACT_VERSION ? { kind: "ok" } : { kind: "mismatch", version: h?.contract_version },
        );
      })
      .catch(() => !cancelled && setHealth({ kind: "down" }));
    return () => {
      cancelled = true;
    };
  }, [connection]);

  const conn =
    connection === "open"
      ? { dot: "bg-ok", label: "Živě" }
      : connection === "connecting"
        ? { dot: "bg-warn animate-pulse", label: "Připojuji…" }
        : { dot: "bg-bad animate-pulse", label: "Znovu se připojuji…" };

  return (
    <header className="border-b border-line bg-panel/80 backdrop-blur">
      <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4 px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <Logo />
          <div className="min-w-0">
            <h1 className="text-base leading-tight font-bold tracking-tight text-fg">Frankenstein</h1>
            <p className="truncate text-xs text-muted">
              AI agent, který analytikům SOC staví a ověřuje detekční pravidla
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2 text-xs">
          <span className="flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-muted">
            <span className={`size-2 rounded-full ${conn.dot}`} />
            {conn.label}
          </span>
        </div>
      </div>
      {health.kind === "mismatch" && (
        <Banner>
          Verze kontraktu nesouhlasí: backend hlásí {String(health.version)}, frontend čeká {CONTRACT_VERSION}.
        </Banner>
      )}
      {health.kind === "down" && <Banner>Backend neodpovídá na /api/health.</Banner>}
      {syncError && health.kind !== "down" && <Banner>{syncError}</Banner>}
    </header>
  );
}

function Banner({ children }: { children: ReactNode }) {
  return (
    <div role="alert" className="border-t border-warn/30 bg-warn/10 px-4 py-1.5 text-center text-xs text-warn">
      {children}
    </div>
  );
}

function Logo() {
  return (
    <svg viewBox="0 0 32 32" className="size-9 shrink-0" aria-hidden>
      <rect x="2" y="2" width="28" height="28" rx="8" className="fill-accent/15 stroke-accent/60" strokeWidth="1.5" />
      <path d="M9 13h14M9 19h14" className="stroke-accent" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M13 9l-2 14M21 9l-2 14" className="stroke-accent/50" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M16 3l-2 6h4l-2 6" className="stroke-warn" strokeWidth="1.5" fill="none" strokeLinejoin="round" />
    </svg>
  );
}
