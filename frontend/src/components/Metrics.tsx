import { formatRatio } from "@/lib/derive";
import type { Metrics } from "@/lib/types";
import { Badge } from "./ui";

function Ratio({ label, value, min }: { label: string; value: number | null; min?: number }) {
  const pct = typeof value === "number" ? Math.max(0, Math.min(1, value)) * 100 : 0;
  const below = typeof value === "number" && typeof min === "number" && value < min;
  return (
    <div>
      <div className="flex items-baseline justify-between text-xs">
        <span className="text-muted">{label}</span>
        <span className={`font-mono font-semibold ${below ? "text-bad" : "text-fg"}`}>
          {formatRatio(value)}
        </span>
      </div>
      <div className="relative mt-1 h-1.5 rounded-full bg-line">
        <div
          className={`h-full rounded-full ${below ? "bg-bad" : "bg-accent"}`}
          style={{ width: `${pct}%` }}
        />
        {typeof min === "number" && (
          <div
            className="absolute -top-0.5 h-2.5 w-px bg-fg/70"
            style={{ left: `${Math.max(0, Math.min(1, min)) * 100}%` }}
            title={`Hranice ${formatRatio(min)}`}
          />
        )}
      </div>
    </div>
  );
}

export function MetricsCard({ title, metrics }: { title: string; metrics: Partial<Metrics> | undefined }) {
  if (!metrics) return null;
  const th = metrics.thresholds;
  return (
    <div className="rounded-lg border border-line bg-bg/60 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-fg">{title}</span>
        {/* O úspěchu rozhoduje jen pole `passed`. */}
        {metrics.passed === true ? (
          <Badge tone="ok">✓ splněno</Badge>
        ) : metrics.passed === false ? (
          <Badge tone="bad">✗ nesplněno</Badge>
        ) : null}
      </div>
      <div className="mb-3 grid grid-cols-3 gap-2 text-center">
        <Count label="Zachyceno" hint="true positives" value={metrics.true_positives} tone="text-ok" />
        <Count label="Plané poplachy" hint="false positives" value={metrics.false_positives} tone="text-warn" />
        <Count label="Propuštěno" hint="false negatives" value={metrics.false_negatives} tone="text-bad" />
      </div>
      <div className="space-y-2">
        <Ratio label="Přesnost (precision)" value={metrics.precision ?? null} min={th?.min_precision} />
        <Ratio label="Záchyt (recall)" value={metrics.recall ?? null} min={th?.min_recall} />
      </div>
    </div>
  );
}

function Count({ label, hint, value, tone }: { label: string; hint: string; value?: number; tone: string }) {
  return (
    <div className="rounded-md bg-panel px-1 py-1.5" title={hint}>
      <div className={`font-mono text-lg font-semibold leading-tight ${tone}`}>
        {typeof value === "number" ? value : "—"}
      </div>
      <div className="text-[10px] leading-tight text-muted">{label}</div>
    </div>
  );
}

export function MetricsInline({ metrics }: { metrics: Partial<Metrics> | undefined }) {
  if (!metrics) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-xs text-muted">
      <span>
        P <span className="text-fg">{formatRatio(metrics.precision)}</span>
      </span>
      <span>
        R <span className="text-fg">{formatRatio(metrics.recall)}</span>
      </span>
      <span>
        TP <span className="text-ok">{metrics.true_positives ?? "—"}</span>
      </span>
      <span>
        FP <span className="text-warn">{metrics.false_positives ?? "—"}</span>
      </span>
      <span>
        FN <span className="text-bad">{metrics.false_negatives ?? "—"}</span>
      </span>
      {metrics.passed === true && <Badge tone="ok">splněno</Badge>}
      {metrics.passed === false && <Badge tone="bad">nesplněno</Badge>}
    </div>
  );
}
