import { currentPhase, PHASE_LABEL, phasesSeen, runStatus } from "@/lib/derive";
import type { RunState } from "@/lib/engine";
import { PHASES } from "@/lib/types";

export function PhaseStepper({ run }: { run: RunState }) {
  const cur = currentPhase(run);
  const curIdx = cur ? PHASES.indexOf(cur) : -1;
  const seen = phasesSeen(run);
  const status = runStatus(run);
  const failed = status === "failed";
  const finished = status === "approved" || status === "rejected";

  return (
    <ol className="grid grid-cols-7 gap-1">
      {PHASES.map((p, i) => {
        // Kapitola 11.1: kovárna se přeskočí, pokud nic nechybí.
        const skipped = p === "forge" && !seen.has("forge") && curIdx > i;
        const isCur = i === curIdx;
        let bar = "bg-line";
        let text = "text-muted";
        if (skipped) {
          bar = "bg-line/50";
          text = "text-muted/50 line-through";
        } else if (isCur && failed) {
          bar = "bg-bad";
          text = "text-bad";
        } else if (isCur && !finished) {
          bar = "bg-accent animate-pulse";
          text = "text-accent";
        } else if (i < curIdx || (isCur && finished)) {
          bar = status === "rejected" && isCur ? "bg-muted" : "bg-accent/70";
          text = "text-fg";
        }
        return (
          <li key={p} className="min-w-0">
            <div className={`h-1 rounded-full ${bar}`} />
            <div className={`mt-1 truncate text-[10px] font-medium sm:text-[11px] ${text}`}>
              {PHASE_LABEL[p]}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
