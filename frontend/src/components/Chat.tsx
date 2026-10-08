"use client";

import { useState, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import { api, ApiError, audioUrl } from "@/lib/api";
import { dataOf, isActive, lastOf, runRequest, runStatus } from "@/lib/derive";
import type { RunState } from "@/lib/engine";

const MAX_REQUEST = 2000;

const EXAMPLES = [
  "Chci zachytit password spraying na SSH.",
  "Zachyť distribuovaný brute force: jeden uživatel, mnoho IP adres.",
  "Detekuj brute force na SSH. V logu může být prompt injection.",
];

export function Composer({
  onCreated,
  blocked,
}: {
  onCreated: (runId: string) => void;
  blocked: boolean;
}) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmed = text.trim();
  const tooLong = trimmed.length > MAX_REQUEST;
  const canSend = !sending && trimmed.length > 0 && !tooLong;

  async function submit(e?: FormEvent) {
    e?.preventDefault();
    if (!canSend) return;
    setSending(true);
    setError(null);
    try {
      const res = await api.createRun(trimmed);
      setText("");
      if (typeof res?.run_id === "string") onCreated(res.run_id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Požadavek se nepodařilo odeslat.");
    } finally {
      setSending(false);
    }
  }

  function onKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) void submit();
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      <div className="rounded-xl border border-line bg-bg focus-within:border-accent/60">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKey}
          rows={3}
          placeholder="Popiš, jaký útok chceš v logu zachytit…"
          className="block w-full resize-y bg-transparent px-3 py-2.5 text-sm text-fg placeholder:text-muted/70 focus:outline-none"
          aria-label="Požadavek pro agenta"
        />
        <div className="flex items-center justify-between gap-2 border-t border-line px-3 py-2">
          <span className={`font-mono text-[11px] ${tooLong ? "text-bad" : "text-muted"}`}>
            {trimmed.length} / {MAX_REQUEST}
          </span>
          <div className="flex items-center gap-2">
            {blocked && <span className="hidden text-[11px] text-warn sm:inline">Jiný běh je aktivní</span>}
            <button
              type="submit"
              disabled={!canSend}
              className="rounded-lg bg-accent px-3.5 py-1.5 text-sm font-semibold text-bg transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {sending ? "Odesílám…" : "Spustit agenta"}
            </button>
          </div>
        </div>
      </div>
      {error && (
        <p role="alert" className="rounded-lg border border-bad/40 bg-bad/10 px-3 py-2 text-sm break-words text-bad">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-1.5">
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            type="button"
            onClick={() => setText(ex)}
            className="rounded-full border border-line px-2.5 py-1 text-left text-xs text-muted transition hover:border-accent/50 hover:text-fg"
          >
            {ex}
          </button>
        ))}
      </div>
    </form>
  );
}

function Bubble({ who, children, mine }: { who: string; children: ReactNode; mine?: boolean }) {
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[90%] min-w-0 rounded-2xl px-3.5 py-2.5 ${
          mine ? "rounded-br-sm bg-accent/15 text-fg" : "rounded-bl-sm border border-line bg-bg text-fg"
        }`}
      >
        <div className="mb-0.5 text-[10px] font-semibold tracking-wider text-muted uppercase">{who}</div>
        <div className="text-sm whitespace-pre-wrap break-words">{children}</div>
      </div>
    </div>
  );
}

export function Conversation({ run }: { run: RunState }) {
  const [audioBroken, setAudioBroken] = useState(false);
  const request = runRequest(run);
  const summaryEv = lastOf(run, "summary");
  const summary = summaryEv ? dataOf(summaryEv, "summary") : undefined;
  const hasVoice = !!lastOf(run, "voice_ready");
  const status = runStatus(run);

  return (
    <div className="space-y-3">
      {request !== null && (
        <Bubble who="Analytik" mine>
          {request}
        </Bubble>
      )}
      {summary && typeof summary.text === "string" && (
        <Bubble who="Agent">
          {summary.text}
          {hasVoice && !audioBroken && (
            // Hlas je volitelný; při chybě se přehrávač skryje.
            <audio
              controls
              preload="none"
              src={audioUrl(run.run_id)}
              onError={() => setAudioBroken(true)}
              className="mt-2 h-8 w-full max-w-xs"
            />
          )}
        </Bubble>
      )}
      {!summary && isActive(status) && (
        <div className="flex items-center gap-2 pl-1 text-xs text-muted">
          <span className="flex gap-1">
            <span className="size-1.5 animate-bounce rounded-full bg-accent [animation-delay:-0.3s]" />
            <span className="size-1.5 animate-bounce rounded-full bg-accent [animation-delay:-0.15s]" />
            <span className="size-1.5 animate-bounce rounded-full bg-accent" />
          </span>
          Agent pracuje…
        </div>
      )}
    </div>
  );
}
