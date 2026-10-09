// Copyright (c) 2026 Adam Krúpa and Ondra Csajka. All rights reserved.
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";

// Production bundle; intercepted API/WS only. No paid calls or runtime mutations.
const base = process.argv[2] || "http://localhost:3100";
const directory = "Docs/backend/screenshots-cost-tracking";
mkdirSync(directory, { recursive: true });
const timestamp = "2026-10-09T12:00:00.000Z";
const runId = "run_usage01";
const request = "Detect password spraying on SSH.";
const events = [{ type: "run_started", run_id: runId, seq: 1, timestamp, phase: "intake", message: "Request received.", data: { request } }];
const totals = { calls: 1, total_tokens: 1200, known_tokens: 1200, cost_usd: "0.0032", known_cost_usd: "0.0032",
  unknown_cost_calls: 0, estimated_calls: 0, calculated_cost_calls: 0, retries: 0,
  steps: [{ step: "planner", calls: 1, retries: 0, cost_usd: "0.0032", share_percent: "100.0" }] };
const record = { run_id: runId, call_id: 1, step: "planner", iteration: 1, attempt: 1,
  model: "anthropic/claude-sonnet-5.5", input_tokens: 1000, output_tokens: 200, cached_tokens: 500, cache_write_tokens: 0,
  total_tokens: 1200, cost_usd: "0.0032", cost_source: "provider", currency: "USD", duration_ms: 1900,
  timestamp, estimated: false, retry: false, status: "success", warning: null };
const summary = { totals, most_expensive_step: "planner", average_cost_usd: "0.0041", average_run_count: 2,
  observations: ["Planner used the most money (100.0% of the total).", "No retries were needed."] };
const sockets = new Set();
const errors = [], checks = [];
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
await context.routeWebSocket("ws://127.0.0.1:8000/ws", socket => { sockets.add(socket); socket.onClose(() => sockets.delete(socket)); });
await context.route("http://127.0.0.1:8000/**", async route => {
  const url = new URL(route.request().url());
  assert.equal(route.request().method(), "GET", "This browser check must not mutate real or fixture runs.");
  const values = { "/health": { status: "ok", contract_version: 1 }, "/skills": { skills: [] },
    "/runs": { runs: [{ run_id: runId, request, created_at: timestamp, finished_at: null, status: "running", last_seq: events.length }] },
    [`/runs/${runId}/events`]: { events: events.filter(event => event.seq > Number(url.searchParams.get("after_seq") || 0)) } };
  assert.ok(values[url.pathname], `Unexpected API path ${url.pathname}`);
  await route.fulfill({ contentType: "application/json", body: JSON.stringify(values[url.pathname]) });
});
const page = await context.newPage();
page.on("pageerror", error => errors.push(error.message));
page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
const send = (data) => {
  const event = { type: "llm_usage", run_id: runId, seq: events.length + 1, timestamp, phase: "plan", message: "Model usage recorded.", data };
  events.push(event); for (const socket of sockets) socket.send(JSON.stringify(event));
};
async function screenshot(options) {
  await page.evaluate(async () => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    window.scrollTo({ top: 0, behavior: "instant" });
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
  await page.screenshot(options);
}
async function check(name, operation) { await operation(); checks.push({ name, result: "PASS" }); console.log(`PASS ${name}`); }
try {
  await page.goto(base);
  await page.locator(".recent-title").first().click();
  await page.getByRole("heading", { name: "Model usage", exact: true }).waitFor();
  await check("Empty state before first call", async () => assert.ok(await page.getByText("Usage appears after each model call.", { exact: false }).isVisible()));
  await check("Live WebSocket record and running total", async () => {
    send({ kind: "call", record, totals, summary: null });
    await page.getByText("Running total: 1,200 tokens · $0.0032", { exact: true }).waitFor();
    await page.getByText("1,000 / 200", { exact: true }).waitFor();
    assert.equal(await page.locator(".run-aside dt").filter({ hasText: "LLM calls" }).locator("..").locator("dd").textContent(), "1");
    await screenshot({ path: `${directory}/live.png`, fullPage: true });
  });
  await check("Call metadata and cached counts", async () => {
    await page.getByText("Call 1 details", { exact: true }).click();
    assert.ok(await page.getByText("Cached input tokens", { exact: true }).isVisible());
    assert.equal(await page.locator(".usage-table details dd").first().textContent(), "500");
  });
  await check("Final step shares, average and observations", async () => {
    send({ kind: "summary", record: null, totals, summary });
    await page.getByRole("heading", { name: "Cost by step", exact: true }).waitFor();
    assert.ok(await page.getByText("100.0%", { exact: true }).isVisible());
    assert.ok((await page.locator(".usage-summary").textContent()).includes("$0.0041"));
    await screenshot({ path: `${directory}/summary.png`, fullPage: true });
  });
  await check("Reload restores the table from event history", async () => {
    await page.reload();
    await page.locator(".recent-title").first().click();
    await page.getByRole("heading", { name: "Cost by step", exact: true }).waitFor();
    assert.equal(await page.getByText("Call 1 details", { exact: true }).count(), 1);
  });
  await check("Unknown charges and literal untrusted model text", async () => {
    send({ kind: "call", record: { ...record, call_id: 2, model: "<img src=x onerror=alert(1)>", cost_usd: null, estimated: true,
      warning: "Cost is unknown: provider cost or verified pricing is unavailable." },
      totals: { ...totals, calls: 2, total_tokens: 2400, known_tokens: 2400, cost_usd: null, unknown_cost_calls: 1, estimated_calls: 1 }, summary: null });
    await page.getByText("Estimated tokens", { exact: true }).waitFor();
    assert.equal(await page.locator(".usage-panel img").count(), 0);
    assert.ok((await page.locator(".usage-panel").textContent()).includes("<img src=x onerror=alert(1)>"));
    assert.ok((await page.locator(".usage-panel").textContent()).includes("Known subtotal: $0.0032"));
    assert.equal(await page.locator(".run-aside dt").filter({ hasText: "Cost (USD)" }).locator("..").locator("dd").textContent(), "—");
  });
  await check("Mobile page has no horizontal overflow", async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    await screenshot({ path: `${directory}/mobile.png`, fullPage: true });
    const dimensions = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth }));
    assert.ok(dimensions.document <= dimensions.viewport + 1, JSON.stringify(dimensions));
  });
  await check("Dark theme retains the usage table", async () => {
    await page.emulateMedia({ colorScheme: "dark" });
    await screenshot({ path: `${directory}/dark.png`, fullPage: true });
    assert.ok(await page.getByRole("heading", { name: "Model usage", exact: true }).isVisible());
  });
  assert.deepEqual(errors, []);
  writeFileSync("Docs/backend/usage_browser.json", JSON.stringify({ status: "PASS", browser: browser.version(),
    checks, console_errors: errors, real_model_calls: 0, real_backend_mutations: 0 }, null, 2));
} finally { await browser.close(); }
