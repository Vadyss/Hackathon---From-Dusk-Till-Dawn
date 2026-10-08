import { dataOf, lastOf, runRequest, runStatus } from "@/lib/derive";
import type { RunState } from "@/lib/engine";
import type { RunStats } from "@/lib/types";
import { Empty, Panel } from "./ui";

type Row = { key: keyof RunStats; label: string; fmt: (v: number | null | undefined) => string; lowerIsBetter: boolean };

const num = (v: number | null | undefined) => (typeof v === "number" ? v.toLocaleString("cs-CZ") : "—");

const ROWS: Row[] = [
  {
    key: "duration_ms",
    label: "Délka běhu",
    fmt: (v) => (typeof v === "number" ? `${(v / 1000).toFixed(1)} s` : "—"),
    lowerIsBetter: true,
  },
  { key: "llm_calls", label: "Volání LLM", fmt: num, lowerIsBetter: true },
  { key: "tokens_total", label: "Tokeny", fmt: num, lowerIsBetter: true },
  { key: "skills_built", label: "Postavené dovednosti", fmt: num, lowerIsBetter: true },
  { key: "skills_reused", label: "Znovupoužité dovednosti", fmt: num, lowerIsBetter: false },
];

function statsOf(run: RunState): Partial<RunStats> | null {
  const e = lastOf(run, "summary");
  const s = e ? dataOf(e, "summary").stats : undefined;
  return s && typeof s === "object" ? s : null;
}

// Kapitola 12.5: summary.stats posledních dvou dokončených běhů.
export function ComparePanel({ runs }: { runs: RunState[] }) {
  const done = runs
    .filter((r) => {
      const st = runStatus(r);
      return (st === "approved" || st === "rejected") && statsOf(r);
    })
    .slice(0, 2)
    .reverse(); // starší vlevo, novější vpravo

  return (
    <Panel title="Srovnání běhů">
      {done.length < 2 ? (
        <Empty>Srovnání se ukáže po dvou dokončených bězích.</Empty>
      ) : (
        <Table a={done[0]} b={done[1]} />
      )}
    </Panel>
  );
}

function Table({ a, b }: { a: RunState; b: RunState }) {
  const sa = statsOf(a)!;
  const sb = statsOf(b)!;
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 text-[11px] text-muted">
        <span />
        <span className="w-16 truncate text-right font-mono" title={runRequest(a) ?? ""}>
          {a.run_id}
        </span>
        <span className="w-16 truncate text-right font-mono" title={runRequest(b) ?? ""}>
          {b.run_id}
        </span>
      </div>
      {ROWS.map((r) => {
        const va = sa[r.key];
        const vb = sb[r.key];
        let tone = "text-fg";
        if (typeof va === "number" && typeof vb === "number" && va !== vb) {
          const better = r.lowerIsBetter ? vb < va : vb > va;
          tone = better ? "text-ok" : "text-warn";
        }
        return (
          <div key={r.key} className="grid grid-cols-[1fr_auto_auto] items-baseline gap-x-3 border-t border-line pt-1.5 text-sm">
            <span className="text-muted">{r.label}</span>
            <span className="w-16 text-right font-mono text-fg/80">{r.fmt(va)}</span>
            <span className={`w-16 text-right font-mono font-semibold ${tone}`}>{r.fmt(vb)}</span>
          </div>
        );
      })}
      <p className="pt-1 text-[11px] text-muted">
        Zeleně je novější běh lepší. Agent se učí: co jednou postaví, příště jen znovu použije.
      </p>
    </div>
  );
}
