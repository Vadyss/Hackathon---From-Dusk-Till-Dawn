// Copyright (c) 2026 Adam Krúpa and Ondra Csajka. All rights reserved.
"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { api, ApiError, audioUrl } from "@/lib/api";
import { dataOf, lastOf, runRequest, runStatus } from "@/lib/derive";
import type { RunState } from "@/lib/engine";
import { useDictation } from "@/lib/useDictation";
import { Activity } from "./Activity";
import { Outcome, ReviewCard } from "./Approval";
import { IconArrowUp, IconMic, IconStop, Logo } from "./icons";

const MAX_REQUEST = 2000;

export const SUGGESTIONS = [
  { title: "Detect password spraying", text: "Detect password spraying against SSH." },
  { title: "Catch distributed brute force", text: "Catch distributed brute force: one user, many source IPs." },
  { title: "SSH brute force", text: "Detect SSH brute force. The logs may contain prompt injection." },
];

export function Thread({ run }: { run: RunState }) {
  const request = runRequest(run);
  const status = runStatus(run);
  const summaryEv = lastOf(run, "summary");
  const summary = summaryEv ? dataOf(summaryEv, "summary") : undefined;
  const hasVoice = !!lastOf(run, "voice_ready");
  const [audioBroken, setAudioBroken] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const stick = useRef(true); // follow new steps unless the user scrolled up

  useEffect(() => {
    const sc = endRef.current?.closest("[data-scroll]");
    if (!sc) return;
    const onScroll = () => {
      stick.current = sc.scrollHeight - sc.scrollTop - sc.clientHeight < 120;
    };
    sc.addEventListener("scroll", onScroll, { passive: true });
    return () => sc.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (stick.current) endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [run.events.length]);

  return (
    <div className="space-y-6">
      {request !== null && (
        <div className="flex justify-end">
          <div className="max-w-[85%] rounded-3xl bg-surface px-4 py-2.5 text-[15px] leading-relaxed whitespace-pre-wrap">
            {request}
          </div>
        </div>
      )}

      <div className="flex gap-3">
        <Logo className="mt-0.5 size-7 shrink-0 text-fg" />
        <div className="min-w-0 flex-1 space-y-4">
          <Activity key={run.run_id} run={run} />

          {summary && typeof summary.text === "string" && (
            <div className="space-y-3">
              <p className="text-[15px] leading-relaxed whitespace-pre-wrap">{summary.text}</p>
              {hasVoice && !audioBroken && (
                // Voice is optional; hide the player if the audio is unavailable.
                <audio
                  controls
                  preload="none"
                  src={audioUrl(run.run_id)}
                  onError={() => setAudioBroken(true)}
                  className="h-9 w-full max-w-sm"
                />
              )}
            </div>
          )}

          {status === "awaiting_approval" && <ReviewCard key={run.run_id} run={run} />}
          <Outcome run={run} />
        </div>
      </div>
      <div ref={endRef} />
    </div>
  );
}

export function Composer({
  onCreated,
  busy,
  autoFocus,
  prefill,
}: {
  onCreated: (runId: string) => void;
  busy: boolean;
  autoFocus?: boolean;
  prefill?: { text: string; n: number } | null;
}) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLTextAreaElement>(null);
  const dictation = useDictation({ text, onTextChange: setText });
  const { cancel: cancelDictation } = dictation;
  const dictationActive = dictation.starting || dictation.listening || dictation.stopping;

  const [lastPrefill, setLastPrefill] = useState(prefill);
  if (prefill !== lastPrefill) {
    setLastPrefill(prefill);
    if (prefill) setText(prefill.text);
  }

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [text]);

  useEffect(() => {
    if (prefill) {
      cancelDictation();
      ref.current?.focus();
    }
  }, [prefill, cancelDictation]);

  const trimmed = text.trim();
  const tooLong = trimmed.length > MAX_REQUEST;
  const canSend = !sending && !dictationActive && trimmed.length > 0 && !tooLong;

  function toggleDictation() {
    if (dictation.starting) {
      cancelDictation();
    } else if (dictation.listening) {
      dictation.stop();
    } else {
      setError(null);
      dictation.start();
      ref.current?.focus();
    }
  }

  async function submit(e?: FormEvent) {
    e?.preventDefault();
    if (!canSend) return;
    cancelDictation();
    setSending(true);
    setError(null);
    try {
      const res = await api.createRun(trimmed);
      setText("");
      if (typeof res?.run_id === "string") onCreated(res.run_id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't send the request.");
    } finally {
      setSending(false);
    }
  }

  function onKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void submit();
    }
  }

  return (
    <form onSubmit={submit} className="w-full">
      {error && (
        <p role="alert" className="mb-2 px-1 text-sm text-bad">
          {error}
        </p>
      )}
      {dictation.error && (
        <p role="alert" className="mb-2 px-1 text-sm text-bad">
          {dictation.error}
        </p>
      )}
      <div className="flex items-end gap-2 rounded-[28px] border border-line bg-bg p-2 pl-5 shadow-[0_2px_12px_rgba(0,0,0,0.06)] focus-within:border-subtle">
        <textarea
          ref={ref}
          value={text}
          onChange={(e) => {
            cancelDictation();
            dictation.clearError();
            setText(e.target.value);
          }}
          onKeyDown={onKey}
          rows={1}
          autoFocus={autoFocus}
          placeholder="Describe an attack you want to detect…"
          aria-label="Request for the agent"
          className="max-h-[200px] min-h-6 min-w-0 flex-1 resize-none self-center bg-transparent py-1.5 text-[15px] leading-6 placeholder:text-subtle focus:outline-none"
        />
        <button
          type="button"
          onClick={toggleDictation}
          disabled={dictation.supported !== true || sending || dictation.stopping}
          aria-label={dictationActive ? "Stop dictation" : "Start dictation"}
          aria-pressed={dictationActive}
          title={dictationActive ? "Stop dictation" : "Dictate your prompt"}
          className={`flex size-9 shrink-0 items-center justify-center rounded-full transition disabled:opacity-35 ${
            dictationActive ? "bg-bad/10 text-bad hover:bg-bad/20" : "text-muted hover:bg-hover hover:text-fg"
          }`}
        >
          {dictationActive ? <IconStop className="size-4.5" /> : <IconMic className="size-4.5" />}
        </button>
        <button
          type="submit"
          disabled={!canSend}
          aria-label="Send"
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-fg text-bg transition hover:opacity-85 disabled:opacity-25"
        >
          <IconArrowUp className="size-4.5" />
        </button>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 px-3 text-xs text-subtle">
        <span>Voice input: English</span>
        <span role="status" aria-live="polite" className={dictationActive ? "text-bad" : ""}>
          {dictation.starting
            ? "Starting microphone…"
            : dictation.stopping
              ? "Finishing transcription…"
              : dictation.listening
                ? "Listening… stop dictation before sending."
                : dictation.supported === false
                  ? "Voice input isn't available in this browser. You can still type."
                  : ""}
        </span>
      </div>
      <div className="mt-2 flex justify-between px-3 text-xs text-subtle">
        <span>{busy ? "Another run is in progress." : "The agent's rule is only installed after your approval."}</span>
        {trimmed.length > MAX_REQUEST - 200 && (
          <span className={tooLong ? "text-bad" : ""}>
            {trimmed.length} / {MAX_REQUEST}
          </span>
        )}
      </div>
    </form>
  );
}
