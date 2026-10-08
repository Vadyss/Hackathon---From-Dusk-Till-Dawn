"use client";

import { useState, type ReactNode } from "react";
import { STATUS_LABEL } from "@/lib/derive";
import type { RunStatus } from "@/lib/types";
import { IconCheck, IconCopy } from "./icons";

const STATUS_DOT: Record<RunStatus, string> = {
  running: "bg-info animate-pulse",
  awaiting_approval: "bg-warn",
  approved: "bg-ok",
  rejected: "bg-subtle",
  failed: "bg-bad",
};

export function StatusDot({ status }: { status: RunStatus | null }) {
  return <span className={`inline-block size-1.5 shrink-0 rounded-full ${status ? STATUS_DOT[status] : "bg-subtle"}`} />;
}

export function StatusPill({ status }: { status: RunStatus | null }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-line px-2 py-0.5 text-xs text-muted">
      <StatusDot status={status} />
      {status ? STATUS_LABEL[status] : "Starting"}
    </span>
  );
}

export function Tag({ children, mono }: { children: ReactNode; mono?: boolean }) {
  return (
    <span
      className={`inline-flex items-center rounded-md bg-surface px-1.5 py-0.5 text-[11px] leading-4 text-muted ${
        mono ? "font-mono" : ""
      }`}
    >
      {children}
    </span>
  );
}

// Pretty-printed JSON rendered as plain text (contract 5.2).
export function CodeBlock({ value, label = "json" }: { value: unknown; label?: string }) {
  const [copied, setCopied] = useState(false);
  let text: string;
  try {
    text = JSON.stringify(value, null, 2);
  } catch {
    text = String(value);
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard not available
    }
  }
  return (
    <div className="overflow-hidden rounded-xl border border-line">
      <div className="flex items-center justify-between bg-surface px-3 py-1.5 text-xs text-muted">
        <span className="font-mono">{label}</span>
        <button type="button" onClick={copy} className="inline-flex items-center gap-1 rounded px-1 hover:text-fg">
          {copied ? <IconCheck className="size-3.5" /> : <IconCopy className="size-3.5" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="max-h-80 overflow-auto bg-bg p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap break-all">
        {text}
      </pre>
    </div>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return <div className="mb-2 text-xs font-medium text-subtle">{children}</div>;
}
