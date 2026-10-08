import { dataOf, formatDuration, lastOf, runRequest, runStatus } from "@/lib/derive";
import type { RunState } from "@/lib/engine";
import type { RunStats } from "@/lib/types";

type Row = { key: keyof RunStats; label: string; fmt: (v: number | null | undefined) => string; lowerIsBetter: boolean };

const num = (v: number | null | undefined) => (typeof v === "number" ? v.toLocaleString("en-GB") : "—");

const ROWS: Row[] = [
  { key: "duration_ms", label: "Duration", fmt: formatDuration, lowerIsBetter: true },
  { key: "llm_calls", label: "LLM calls", fmt: num, lowerIsBetter: true },
  { key: "tokens_total", label: "Tokens", fmt: num, lowerIsBetter: true },
  { key: "skills_built", label: "Skills built", fmt: num, lowerIsBetter: true },
  { key: "skills_reused", label: "Skills reused", fmt: num, lowerIsBetter: false },
];

function statsOf(run: RunState): Partial<RunStats> | null {
  const e = lastOf(run, "summary");
  const s = e ? dataOf(e, "summary").stats : undefined;
  return s && typeof s === "object" ? s : null;
}

// Contract 12.5: summary.stats of the last two finished runs.
export function Compare({ runs }: { runs: RunState[] }) {
  const done = runs
    .filter((r) => {
      const st = runStatus(r);
      return (st === "approved" || st === "rejected") && statsOf(r);
    })
    .slice(0, 2)
    .reverse(); // older on the left

  if (done.length < 2) {
    return <p className="text-sm text-subtle">Finish two runs to compare them side by side.</p>;
  }
  const [a, b] = done;
  const sa = statsOf(a)!;
  const sb = statsOf(b)!;

  return (
    <div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-subtle">
            <th className="pb-2 font-normal" />
            <th className="max-w-0 truncate pb-2 text-right font-normal" title={runRequest(a) ?? ""}>
              Previous
            </th>
            <th className="max-w-0 truncate pb-2 text-right font-normal" title={runRequest(b) ?? ""}>
              Latest
            </th>
          </tr>
        </thead>
        <tbody>
          {ROWS.map((r) => {
            const va = sa[r.key];
            const vb = sb[r.key];
            let tone = "";
            if (typeof va === "number" && typeof vb === "number" && va !== vb) {
              tone = (r.lowerIsBetter ? vb < va : vb > va) ? "text-ok" : "text-bad";
            }
            return (
              <tr key={r.key} className="border-t border-line">
                <td className="py-2 text-muted">{r.label}</td>
                <td className="py-2 text-right tabular-nums text-muted">{r.fmt(va)}</td>
                <td className={`py-2 text-right font-medium tabular-nums ${tone}`}>{r.fmt(vb)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="mt-3 text-xs leading-relaxed text-subtle">
        Skills the agent builds once are reused in later runs, so repeat work gets faster and cheaper.
      </p>
    </div>
  );
}
