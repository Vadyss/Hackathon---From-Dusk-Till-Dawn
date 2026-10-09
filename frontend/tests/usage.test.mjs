// Copyright (c) 2026 Adam Krúpa and Ondra Csajka. All rights reserved.
import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { productionModule } from "./load-production-module.mjs";

const { Usage, usageCost } = productionModule("components/Usage.tsx");
const { Activity } = productionModule("components/Activity.tsx");
const { runStatus } = productionModule("lib/derive.ts");
const totals = { calls: 2, total_tokens: 230, known_tokens: 230, cost_usd: "0.0123456789",
  known_cost_usd: "0.0123456789", unknown_cost_calls: 0, estimated_calls: 0,
  calculated_cost_calls: 0, retries: 1, steps: [{ step: "forge", calls: 2, retries: 1, cost_usd: "0.0123456789", share_percent: "100.0" }] };
const record = { run_id: "run_usage", call_id: 1, step: "forge", model: "<script>bad()</script>",
  iteration: 1, attempt: 1, input_tokens: 100, output_tokens: 15, cached_tokens: 20,
  total_tokens: 115, cache_write_tokens: 0, estimated: false, retry: false,
  duration_ms: 1500, timestamp: "2026-10-09T12:00:00.000Z", cost_usd: "0.006", cost_source: "provider", warning: null, status: "success" };
const ev = (data, seq = 2) => ({ type: "llm_usage", run_id: "run_usage", seq, phase: "forge", timestamp: record.timestamp, message: "Usage recorded.", data });
const initial = { ...ev({}, 1), type: "run_started", phase: "intake", message: "Request received.", data: { request: "Detect spraying" } };
const run = (events) => ({ run_id: "run_usage", events: [initial, ...events], created_at: initial.timestamp, last_seq: events.length + 1 });
const render = (view) => renderToStaticMarkup(React.createElement(Usage, { run: view }));

test("usage table renders live records and server totals, escaping all text", () => {
  const html = render(run([ev({ kind: "call", record, totals, summary: null })]));
  assert.ok(html.includes("100 / 15"));
  assert.ok(html.includes("Cached input tokens</dt><dd>20"));
  assert.ok(html.includes("$0.0060"));
  assert.ok(html.includes("Running total"));
  assert.ok(html.includes("$0.0123456789"), "decimal cost is not truncated or summed in JS");
  assert.ok(html.includes("&lt;script&gt;bad()&lt;/script&gt;"));
  assert.ok(!html.includes("<script>"));
});

test("final usage exposes per-step shares, retries, average and observations", () => {
  const summary = { totals, most_expensive_step: "forge", average_cost_usd: "0.01", average_run_count: 2,
    observations: ["Forge used the most money.", "Retries account for 50% of cost."] };
  const view = run([ev({ kind: "call", record, totals, summary: null }), ev({ kind: "summary", record: null, totals, summary }, 3)]);
  const html = render(view);
  for (const text of ["Cost by step", "100.0%", "Most expensive step: forge", "Retries: 1", "Average across 2 runs", "$0.0100", "Retries account for 50% of cost."])
    assert.ok(html.includes(text), text);
  assert.equal((html.match(/Call 1 details/g) || []).length, 1);
});

test("unknown cost stays unknown and estimates are visible", () => {
  const html = render(run([ev({ kind: "call", record: { ...record, estimated: true, cost_usd: null, warning: "Pricing is unavailable." },
    totals: { ...totals, cost_usd: null, unknown_cost_calls: 1, estimated_calls: 1 }, summary: null })]));
  assert.ok(html.includes("Estimated tokens"));
  assert.ok(html.includes("Known subtotal"));
  assert.ok(html.includes("Cost is unknown for 1 calls."));
  assert.ok(html.includes("Pricing is unavailable."));
  assert.equal(usageCost(null), "—");
  assert.equal(usageCost("NaN"), "—");
  assert.equal(usageCost("0"), "$0.0000");
  assert.equal(usageCost("1234567.01"), "$1,234,567.0100");
});

test("usage does not alter run status or duplicate the activity timeline", () => {
  const view = run([ev({ kind: "call", record, totals, summary: null })]);
  assert.equal(runStatus(view), "running");
  const html = renderToStaticMarkup(React.createElement(Activity, { run: view }));
  assert.ok(!html.includes("Usage recorded."));
  assert.ok(render(run([])).includes("Older runs may not include it."));
});
