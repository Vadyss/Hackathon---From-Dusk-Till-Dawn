# English application and UI wiring — 2026-10-09

Completed on `feat/english-and-wiring`, created from freshly fetched `origin/main` **0465cee** (PR #17 merge). No push, merge or remote deployment was performed. The canonical tracked directory is `Docs/`; no duplicate lowercase `docs/` was created.

The latest request authorizes English copy, UI wiring and contract documentation; it supersedes the older SPEC requirements for Czech copy and no frontend changes. Protocol version remains **1**. Endpoint names, JSON keys, event types, phases, statuses, error codes and reason codes are unchanged.

## Translation and protected behavior

All 18 event message templates, HTTP errors, run failure reasons, gatekeeper violation details, evaluator feedback, fallback summaries and operator diagnostics now use English. All five LLM prompts require English goals, steps, descriptions, explanations, summaries and generated test messages, regardless of request language. Mock scenarios A–F and manual backend smoke/live requests are English; legacy request-language selectors still work.

The dataset catalog and its six generator descriptions are English. Only the `catalog.json` row of `MANIFEST.sha256` changed. All eight log/label files, sandbox files, policy YAML, security settings and metric thresholds are byte-identical to starting main. Every gatekeeper module has the same AST after normalizing text literals: branches, identifiers, numeric values, calls and imports are unchanged. [Scope evidence](english_static.json).

Seed manifest descriptions are English. An English module docstring changes each seed's source SHA without changing its executable AST. This triggers the existing versioned seed update instead of bypassing integrity checks: legacy seeds become v2, usage counters survive, startup is idempotent and nothing is quarantined. This was verified in regression tests and against the original local persistent volume. Approved agent artifacts were preserved exactly. [Before](english_seed_upgrade_before.json), [after](english_seed_upgrade_after.json).

The sandbox itself remains unchanged. A presentation formatter translates only known sandbox diagnostics when producing `error_excerpt`; raw verdicts, feedback, counts and decisions are preserved. Unknown strings and analyst-authored text are never automatically translated. ElevenLabs still defaults to `eleven_multilingual_v2`.

Frontend application copy was already largely English. Remaining locale inconsistencies were replaced with `en-US`, including document language, dates, times, numbers and run-history search. Dictation remains fixed to `en-US`. Source and live/demo DOM checks include placeholders, titles, alt text and aria-labels. No Czech application copy remains in frontend source.

## Wiring inventory and fixes

| Panel/component | Actual source | Finding / result |
|---|---|---|
| RequestComposer | Analyst input, instructions and attached text → `POST /runs` | Preserves draft on error; templates are editable input suggestions, never simulated results. |
| Navigation, recent runs, RunHistory | `GET /runs` and run events through the shared Engine | Names/request, status, timestamps and run counts come from backend. Local pins/archive/rename are display preferences. |
| Activity | Sequenced events, their `timestamp`, `phase`, `message` and structured data | No generated timeline; unknown events are safe; HTTP gap recovery and WS reconnect are tested. |
| Chat/request and summary | `run_started.request`, `summary.text` | Literal text, no hardcoded answer or Markdown execution. |
| ReviewCard | Last `awaiting_approval`: recipe, tuning/validation metrics, `new_skills` | **Fixed:** heading “Approve detection rule”; separate new-tool list; empty list says “No new tools built in this run (reused existing tools)” and does not disable approval. |
| Run statistics | Latest `summary.stats` | **Missing panel fixed:** duration, calls, tokens, USD cost, skills built/reused. Missing summary or unknown usage displays `—`, never invented zeros. |
| Skill library | `GET /skills` merged with `skill_installed` | No fixed skill list. Candidate/reused/installed events drive selected-run skill details. |
| Compare | Last two terminal runs with actual `summary.stats` | **Fixed:** `cost_usd` row and USD formatting; failed completed runs with statistics participate; failed runs without a summary supply no invented statistics. |
| Outcome/errors | Terminal events and structured HTTP errors | `run_failed.reason_code` and literal `reason` are visible. HTTP status/code/message are preserved; decision controls unlock after errors. |
| Voice playback | `voice_ready`, canonical run audio endpoint | No player without the event; unavailable optional audio hides the player. |
| Health/offline | `GET /health`, Engine WS connection and sync errors | Actual connection state; English offline banner, reconnect and history recovery verified. |
| Preferences and context panels | Browser preferences or explicit user input | Static instructional copy is not operational backend data. |
| Older Conversation/Sidebar/InfoPanel components | API/event-derived props and the same helpers | Not mounted by the current page; English copy and no embedded operational mock values. |

No production frontend mock transport, scenario fixture, fake metrics, fixed duration/token totals or simulated skill/status data was found. Test-only controlled transports remain outside the production app. Frontend directly uses `NEXT_PUBLIC_API_BASE` per contract §7.3; the unchanged nginx `/api/` and `/api/ws` compatibility routes work on port 3000. HTTP/WS URL and request-body regression tests preserve the contract paths.

`summary.stats.cost_usd` was already declared by main and returned by the backend. The existing nullable field is now typed and displayed; no duplicate field or version bump was added. Contract §3 now requires English application text, §12.5 describes cost/approval/voice display, and obsolete skeleton-pipeline prose in §13 was corrected.

## Verification

| Check | Result | Evidence |
|---|---|---|
| Backend + sandbox, Python 3.12, offline tests | PASS — **703** | [Test results](english_test_results.json); +51 regressions, existing assertions retained |
| Relay, fake transport | PASS — **36** | Same test results |
| Frontend, Node 22, Docker `--network none` | PASS — **31** | Same test results; +13 regressions |
| TypeScript and ESLint | PASS | `npx tsc --noEmit`, `npm run lint` |
| Production static export and ordinary Compose build | PASS | `docker compose up -d --build`, no demo override; Next.js 16.3.8 / Node 22 |
| Health through nginx port 3000 | PASS | [Final stack](english_final_stack.json): HTTP 200, contract_version 1 |
| Live A/B/E submitted and approved in Chromium | PASS | [Live browser](english_browser_live.json), individual event JSON below |
| HTTP history equals WS events, reload preserves state | PASS | Same browser report and reload screenshots |
| English DOM and normal browser console | PASS | 8 live and 6 demo DOM checks; **0** console/page errors in live, demo and safety flows |
| Contract §5.3 literal text, null metrics, unknown events | PASS | [Browser safety](english_browser_safety.json); no executed HTML, scripts, links or dialogs |
| Browser WS interruption and reconnect | PASS | [Reconnect](english_reconnect.json); identical request/backend state after recovery |
| Active run conflict and rejection | PASS | [REST controls](english_rest_controls.json): 409 `RUN_ALREADY_ACTIVE`; rejection terminal event |
| Simultaneous approve/reject | PASS | Same controls: one 200, one 409 `NOT_AWAITING_APPROVAL`, one terminal event |
| Runs/skills, `after_seq`, invalid cursor, optional audio | PASS | Exact incremental history; bad cursor 400; voice-disabled audio 404 `AUDIO_NOT_FOUND` |
| Restart and registry persistence | PASS | [Restart](english_restart.json): all 5 old runs 404, all 4 installed skills unchanged |
| Demo override, mock A → B reuse | PASS | [Demo browser](english_browser_demo.json); unknown tokens/cost displayed as `—` |
| Gatekeeper logic, data, sandbox and policy protection | PASS | [Static checks](english_static.json), [final isolation](english_final_stack.json) |
| No configured secrets in tracked/new files | PASS | Byte scan against ignored local credential values; no values printed or recorded |

Total: **770 tests PASS**, no skipped assertions or relaxed policies. The deliberate offline browser check produced one expected native `ERR_INTERNET_DISCONNECTED` diagnostic, separately recorded; it produced no unexpected console or application errors. Original §5.3 Czech Markdown text is deliberately preserved in the safety fixture as user-authored data, not application copy.

## Actual live runs

Model **anthropic/claude-sonnet-5.5**, provider Apify, through our relay. Each scenario completed in its first run attempt; internal forge retries remained within the existing three-attempt limit. All tuning and validation precision/recall values were **1.0**, with zero false positives and zero false negatives; thresholds stayed **0.9/0.9**.

| Scenario | run_id / full events | Duration to summary | Calls | Tokens | USD cost | Built / reused | Result |
|---|---|---:|---:|---:|---:|---:|---|
| A — Detect password spraying on SSH. | [run_5f1733ba](english_live_run_a.json) | 40.978 s | 5 | 22,326 | $0.080340 | 1 / 1 | `distinct_count_window` built on forge attempt 2; approved |
| B — Detect distributed brute force on SSH. | [run_76214c86](english_live_run_b.json) | 11.039 s | 3 | 11,117 | $0.028810 | 0 / 2 | A's approved aggregation reused; no new tools; approved |
| E — Detect directory scanning on the web server. | [run_62e15d5c](english_live_run_e.json) | 35.746 s | 6 | 27,739 | $0.092094 | 1 / 1 | New `nginx_access_parser` built on forge attempt 3; approved |

A detects all 8 labeled attack instances on each dataset; B and E each detect all 6. Event JSON includes exact event sequences, human copy, metrics, recipe, skill metadata and measured summary statistics. No policy, threshold, label, log or forge validator was changed to obtain these results. Prompt changes concern English output only; no live-run-specific prompt or schema workaround was necessary.

Mock A: 5.990 s, 6 calls, one new tool; B: 2.466 s, 3 calls, zero new tools and two reused tools. Both passed with real sandbox execution; tokens and cost are correctly `null`. [A events](english_demo_run_a.json), [B events](english_demo_run_b.json).

Screenshots: [screenshots-en/](screenshots-en/) — live A/B/E activity, approval, result and reload; library and comparison; demo A/B; literal-text safety; offline/recovered states.

## Changes for the frontend colleague

| Commit | Files | Change |
|---|---|---|
| `07f1dd0` — `feat(frontend):` | layout; Approval, Compare, DetectionRun, RunHistory; derive/types; API, Engine and run-panel tests | en-US; real per-run usage panel; nullable USD cost; explicit rule/new-tool review; API/error/reconnect regressions |
| `9be381a` — `fix(frontend):` | Compare and run-panel regression | Include failed terminal runs when they have actual summary statistics; preserve last-two ordering |
| `e77e388` — `docs(contract):` | Docs/kontrakt.md | English application copy and display guidance; existing nullable `cost_usd`; v1 retained; stale skeleton status corrected |

No nginx, frontend dependency, deployment, policy or sandbox settings changed in this task. Backend English implementation and seed-safe upgrade are in `28916dd`; `6482cd0` completes the known sandbox serialization diagnostic presentation.

## Limits and local state

English generation is required by prompts and verified on actual runs; future LLM output is still nondeterministic. Forge needed a second attempt for A and a third for E. Deterministic safety checks and metric requirements remain the deciding authority.

Analyst requests, rejection comments, raw logs, historical approved agent descriptions and test attack strings are preserved as authored. They can be Czech; the application does not silently translate or rewrite immutable approved artifacts. Old seed descriptions do update safely. A fresh separate live registry was used for the English DOM check to keep historical artifacts from affecting new-output verification.

ElevenLabs credentials were absent: optional-audio behavior and mocked voice transport are tested, but no real external voice synthesis was performed. USD cost is provider-reported LLM usage, not an estimate or Apify infrastructure cost; absent usage is `null`.

The ordinary `hackathon` stack was built and its existing seeds safely upgraded. It is stopped with its original volume preserved. The final live stack is **hackathon-english** on port **3000**, with provider `apify` and all four English-described skills installed; its live and demo volumes are separate and retained. Backend restart/recreation intentionally clears in-memory run history, as required by contract; the run evidence remains in Git files.

This machine's default Docker address pools were already exhausted by older projects. A temporary `/tmp/english-networks.yml` supplies only unused test IPAM subnets `10.245.239.0/24` and `10.245.240.0/24`; sandbox `internal: true` and all service security settings remain inherited from the unchanged base Compose file. No existing networks or volumes were removed.

## Reproduction and push

In a Python 3.12 environment with backend, sandbox, relay and test requirements installed:

```bash
(cd backend && python -m pytest)
(cd apify/llm-relay && python -m pytest tests)
npm --prefix frontend test
npm --prefix frontend run lint
(cd frontend && npx tsc --noEmit)
python3 scripts/integration/english_static.py
```

The browser harness uses the existing `scripts/integration` Playwright installation. Run live creation tests only on an intended local test registry; they spend provider credits and approve skills. Use a new project/volume when the required tools are already installed, rather than deleting persistent data.

```bash
# Standard real-LLM stack (when port 3000 is free):
docker compose up -d --build
curl --fail http://localhost:3000/api/health

# Actual browser checks; live A/B/E must begin with only the seed tools:
node scripts/integration/english_browser.mjs live http://localhost:3000
node scripts/integration/english_browser.mjs safety http://localhost:3000
node scripts/integration/english_reconnect.mjs http://localhost:3000
node scripts/integration/english_controls.mjs http://localhost:3000 controls

# Mock backup (separate demo volume):
docker compose -f docker-compose.yml -f docker-compose.demo.yml up -d --build
node scripts/integration/english_browser.mjs demo http://localhost:3000

# Restore real LLM after demo:
docker compose up -d --build
```

To switch from the currently running English test project back to the original local project without deleting either registry:

```bash
docker compose -p hackathon-english -f docker-compose.yml -f /tmp/english-networks.yml stop
docker compose up -d --build
```

Push only when Adam is ready:

```bash
git switch feat/english-and-wiring
git push -u origin feat/english-and-wiring
```
