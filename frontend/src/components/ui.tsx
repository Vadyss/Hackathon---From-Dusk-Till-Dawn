import type { ReactNode } from "react";
import { STATUS_LABEL } from "@/lib/derive";
import type { RunStatus } from "@/lib/types";

export function Panel({
  title,
  right,
  children,
  className = "",
}: {
  title: ReactNode;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-xl border border-line bg-panel ${className}`}>
      <header className="flex items-center justify-between gap-2 border-b border-line px-4 py-2.5">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">{title}</h2>
        {right}
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

type Tone = "neutral" | "ok" | "bad" | "warn" | "info" | "accent";

const TONE: Record<Tone, string> = {
  neutral: "border-line text-muted",
  ok: "border-ok/40 bg-ok/10 text-ok",
  bad: "border-bad/40 bg-bad/10 text-bad",
  warn: "border-warn/40 bg-warn/10 text-warn",
  info: "border-info/40 bg-info/10 text-info",
  accent: "border-accent/40 bg-accent/10 text-accent",
};

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium leading-none ${TONE[tone]}`}
    >
      {children}
    </span>
  );
}

const STATUS_TONE: Record<RunStatus, Tone> = {
  running: "info",
  awaiting_approval: "warn",
  approved: "ok",
  rejected: "neutral",
  failed: "bad",
};

export function StatusBadge({ status }: { status: RunStatus | null }) {
  if (!status) return <Badge>Čeká na události</Badge>;
  return (
    <Badge tone={STATUS_TONE[status]}>
      {status === "running" && <span className="size-1.5 animate-pulse rounded-full bg-current" />}
      {STATUS_LABEL[status]}
    </Badge>
  );
}

// Formátovaný JSON jako prostý text (kapitola 5.2).
export function JsonBlock({ value }: { value: unknown }) {
  let text: string;
  try {
    text = JSON.stringify(value, null, 2);
  } catch {
    text = String(value);
  }
  return (
    <pre className="max-h-80 overflow-auto rounded-lg border border-line bg-bg p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap break-all text-fg/90">
      {text}
    </pre>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="text-sm text-muted">{children}</p>;
}
