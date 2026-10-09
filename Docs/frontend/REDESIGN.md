<!-- Copyright (c) 2026 Adam Krúpa and Ondra Csajka. All rights reserved. -->
# Frontend visual and copy review

The production frontend was reviewed in full before editing: all components, app pages, styles, copy, API/store helpers, request/context and dictation hooks, preferences, tests, configuration, assets, and frontend documentation. The relevant documentation shipped with Next.js was also read. Work started from `origin/main` commit `55db489` on the local `frontend` branch, as required by the repository workflow.

This is a focused visual/copy pass. The HTTP client, WebSocket engine, request assembly, backend logic, API contract, environment configuration, datasets, policy, sandbox isolation, and LLM configuration are unchanged. No dependency was added or upgraded. Only copyright comments and image authors labels changed the backend, sandbox, and relay Dockerfiles.

## Design and usability

- Neutral surfaces in light and dark mode; shared CSS variables for one blue accent and success, warning, and error colors.
- The existing system font stack, a 4px spacing scale, normal/medium/semibold weights, 6–8px radii, and subtle dialog shadows. No gradients, glow, glass, hero banner, decorative shield icons, pulse, shimmer, or entrance animation.
- One primary action in the editor and review panel. Navigation back to an existing draft is named **Request editor**, while **New detection** starts a fresh draft; neither behavior changed.
- Meaningful run state and per-event phases remain visible. Redundant approval notices and decorative labels were removed. The review action still says **Approve detection rule** and **Approve and install**.
- Rule JSON starts collapsed in a native keyboard-accessible disclosure; Copy and Download JSON remain available after expansion. Summaries longer than 400 characters also start collapsed behind Read full summary, retaining the full text in a scrollable monospace block. Short summaries stay readable paragraphs, and optional audio is unchanged. Long error/output text remains selectable monospace text inside expandable activity details.
- Closing run history returns focus to its opener, including when the opener was in the mobile menu. Selecting a result focuses the run content. The 320px keyboard regression remains in the browser harness.
- Activity timestamps are visible without hovering. Review fields have explicit accessible names and visible focus outlines. Rejection uses readable error text on a quiet tinted surface rather than white text on a pale background.
- The examples remain editable starting text, not fabricated runtime data. Tool counts, run status, results, usage, cost, and comparison continue to come from API data/events.
- The exact copyright footer is in the shared root layout, including the exported not-found page. nginx serves that page for missing static URLs while preserving HTTP 404 and the existing API/WS proxy behavior.

## Removed copy

These are removed occurrences, not a ban on meaningful use of the same word elsewhere. Dynamic review status remains in run history; identifiers, tool states, and counts remain available in their relevant panels.

| Removed text | Previous location / reason |
| --- | --- |
| `Detection workspace` | Three page eyebrows and fake sidebar profile; repeated decoration. |
| `Detection engineering` | Brand caption and production footer; product name already identifies the application. |
| `Human approval required` | Fake sidebar profile; review is communicated at the action. |
| `Human-reviewed detections` | Production footer tagline. |
| `Workspace` | Navigation heading and breadcrumb prefix; repeated screen labels. |
| Current view breadcrumb (`New detection`, `Current run`, `Skill library`, `Compare runs`) | Top bar; the page already has its heading and selected navigation. |
| `F` | Fake sidebar avatar. The product mark remains. |
| `Draft` | Static editor status pill. |
| `Connection needs attention` | Redundant error heading; the actual problem and Retry action remain. |
| `Session context` | Heading for facts the application had not actually established. |
| `Log source` / `Defined by your request` | Static home context row. |
| `Available skills` | Duplicate home count; the API-backed library count remains in navigation. |
| `Installation` / `Approval required` | Duplicate home approval row. |
| `Rules and new skills require your approval.` | Repeated home approval note. |
| `Needs review` | Redundant badge inside the review panel; meaningful history status remains. |
| `Detection / {run_id}` | Run eyebrow; the identifier is still in Details. |
| `Status`, `Phase`, `Approval`, `Human required` | Duplicate run context rows; meaningful run/event state is retained. |
| `Approval is required to install the rule and any new skills.` | Duplicate run context notice. |
| Duplicate `Reused`, `Installed`, `Candidate` badges | Tool state already explained in the same row. |
| `Installed` | Always-on badge for every entry in the installed tool library. |
| `Skills the agent builds once are reused in later runs, so repeat work gets faster and cheaper.` | Unsupported comparative promise below actual statistics. |
| `Default` | Decorative preference badge; Restore defaults remains. |
| `Plain language` | Composer badge. |
| `Every rule needs your approval.` | Always-on composer approval reminder. |
| `Voice: English` | Constant composer footer; dictation still uses `en-US` and its accessible control describes it. |
| `Frankenstein / Detection engineering` | Production and separate preview footers; replaced by copyright. Product name remains in its navigation. |
| `Local design preview · Sample data` | Separate preview footer; the preview warning remains near the top. |

## Rewritten copy

| Previous | Replacement |
| --- | --- |
| `New detection` (editor navigation) | `Request editor` |
| `The backend uses a different API version. This frontend requires version {version}.` | `API version mismatch. This frontend needs version {version}; update the backend and retry.` |
| `The backend is not responding. Your draft is kept here; retry the connection when it is available.` | `Cannot reach the backend. Your draft is safe; retry the connection.` |
| `The live connection was interrupted. Reconnecting to receive the latest run activity.` | `Connection lost. Reconnecting to load the latest events.` |
| `Workspace navigation` (accessible name) | `Navigation` |
| `Your runs will appear here.` | `Create a detection to see it here.` |
| `Waiting for run history.` | `Loading run history…` |
| `Describe the behavior you want to catch, the log source, and any constraints.` | `Describe what to detect and which logs to use.` |
| `Start from a template` | `Try an example` |
| `Use template` | `Use example` |
| `The request was accepted. The activity will appear as the backend sends events.` | `Request accepted. Waiting for the backend to send events.` |
| `This run may no longer exist after a backend restart. Choose a run from history.` | `This run is no longer available. Choose another run from history.` |
| `Approved building blocks the agent can reuse across detections.` | `Tools available for your detection rules.` |
| `Agent-built` (library origin) | `Custom` |
| `The skill registry is empty. Installed skills will appear here.` | `No tools yet. Approve a detection to add its new tools.` |
| `Compare the last two completed runs with reported usage statistics.` | `Time, usage, and tools for the last two completed runs.` |
| `An AI agent that builds, tests and validates detection rules for SOC analysts.` (page description) | `Build, test, and review detection rules.` |
| `Never seen by the agent` | `Checked separately` |
| `Recipe` | `Rule JSON` |
| `New skills that will be installed` | `New tools to install` |
| `Rule {name} is approved and active` | `Rule {name} approved` |
| `Added to the skill registry:` | `Installed tools:` |
| `Review comment (optional)` (accessible name) | `Approval comment (optional)` |
| `Reason for rejection` (accessible name) | `Reason for rejecting this rule` |
| `Agent activity` | `Activity` |
| `Run context` | `Details` |
| `Run statistics` | `Usage` |
| `Reused from the registry` | `Reused` |
| `Installed in the registry` | `Installed` |
| `No skills reported.` | `Tools will appear here as the run progresses.` |
| `True pos.` / `False pos.` / `False neg.` | `True positives` / `False positives` / `False negatives` |
| `built by agent` | `built during a run` |
| `Worked for {duration} · {count} steps` | `{duration} · {count} updates` |
| `Activity · {count} steps` | `{count} updates` |
| `Appearance, layout, and input settings for this browser.` | `Appearance and input settings.` |
| `Adjust the space between workspace items.` | `Adjust the space between items.` |
| `Workspace` (preference section) | `Layout` |
| `The table on the start page. Search runs remains available.` | `Recent runs on the start page. All runs stay available in search.` |
| `Show context panels` | `Show help and run details` |
| `Session details beside the editor and each run.` | `Help beside the editor and details beside each run.` |
| `Detection request` (editor label) | `What do you want to detect?` |
| `Look for a source IP failing to log in to multiple SSH accounts within five minutes. Exclude known monitoring accounts.` | `Detect repeated failed SSH logins from one IP across several accounts within five minutes.` |
| `Instructions and full file contents are included when you send this request. Draft context is kept for this page session only.` | `Instructions and file text are sent with this request. Unsent context is not saved.` |
| `Voice` / `Stop voice` | `Dictate` / `Stop dictation` |
| `Dictation is unavailable in this browser.` | `Dictation is unavailable here. Type your request instead.` |
| `Add constraints or conventions to include with this request.` | `Add details to include with this request.` |
| `Use UTC timestamps. Exclude monitoring accounts. Explain thresholds and list assumptions.` | `Use UTC timestamps and explain the thresholds.` |
| `Settings` (mobile preference button text) | `Preferences` |

The frontend README's obsolete claim that the backend emits only `run_started` was replaced with an accurate description of the implemented pipeline. Its voice instructions now say `Stop dictation`. Analyst-authored requests and all backend-supplied messages are displayed literally, without translating or rewriting them.

## Authorship

The product footer reads exactly **© 2026 Adam Krúpa & Ondra Csajka. All rights reserved.** The HTML author metadata is **Adam Krúpa, Ondra Csajka**. The title stays **Frankenstein** because an authors suffix would read awkwardly. All three project packages have author/contributors fields and `UNLICENSED`; dependencies are unchanged. All four Dockerfiles have the requested OCI authors label, including the final frontend stage. The root README has an Authors section and the root LICENSE requires prior written consent from both authors. Existing third-party licenses are respected.

Every touched source has the requested copyright comment. JSON cannot contain comments; its authors/contributors/license metadata carries the notice while preserving valid JSON. There is no `pyproject.toml` in this repository.

## Verification

Final checks: **36/36 frontend tests**, TypeScript, ESLint, and `git diff --check` pass. The existing API, WebSocket ordering/reconnect, approval, null statistics, text escaping, Unicode request limits, and file content assertions remain. Five new regressions cover native collapsed JSON, collapsed long summaries with full escaped output, visible timestamps, a single approval notice, and the exported not-found page.

The production Docker build passes. Only the local frontend container was rebuilt; the backend and sandbox container creation timestamps were unchanged. The final frontend image contains the exact OCI authors label.

The Chromium 156 browser harness passes all 17 checks. It first reads the real production health/runs/skills API and opens its WebSocket; interaction checks then use isolated browser transports against the production bundle. There are **zero real backend mutations, zero model calls, zero unexpected console/page errors, and zero unexpected dialogs**. Four deliberately induced HTTP error warnings (409, 503, 404) are recorded separately with their exact URLs rather than hiding all console errors.

| Check | Result / evidence |
| --- | --- |
| Production health, history, skills, WebSocket | PASS; real HTTP 200 and WS connected, no mutations. |
| Editor, examples, load state, file context and instructions | PASS; complete file text/request assembly preserved. |
| Review, metrics, usage, JSON keyboard expansion, Copy and Download | PASS; API statistics and full literal output preserved. |
| Approval, installation, rejection, conflict and reload | PASS; one decision request; completed state recovers from the backend. |
| Skill library, comparison and footer on all views | PASS; event/API data and both run names displayed. |
| History search, rename, pin, archive, restore and keyboard dialog dismissal | PASS; organization remains local and never mutates backend records. |
| Every preference, light/dark/system appearance and persistence | PASS; all existing controls remain functional. |
| Dictation, keyboard submission, unsupported-browser fallback | PASS with controlled recognition stub; English remains `en-US`. |
| Literal text, unknown events, null values and failure reason/code | PASS; no HTML/script interpretation or invented zero values. |
| Mobile at 320, 390 and 768px, long output, menus and dialogs | PASS; document width stays within viewport. |
| Connection interruption, Retry and retained draft | PASS. |
| Missing URL, author metadata and exact footer | PASS; HTTP 404 retained. |
| Text contrast and focus | PASS; measured dark text 7.65–8.92:1, light 5.46–7.03:1; visible 2px focus outline. |

Detailed results: [redesign_browser.json](redesign_browser.json). Eight screenshots are in [screenshots-redesign](screenshots-redesign/). They depict isolated browser regression fixtures, not paid model runs or production records.

Reproduce from the repository root:

```sh
(cd frontend && npm test && npm run lint && npx tsc --noEmit)
docker compose -p hackathon up -d --build --no-deps frontend
node scripts/integration/redesign_browser.mjs http://localhost:3000 http://127.0.0.1:8000
```

The Docker command assumes the existing local `hackathon` stack. The browser harness uses the already installed integration Playwright dependency; if needed, install it with `npm ci --prefix scripts/integration` and `npx --prefix scripts/integration playwright install chromium`. No production deployment, push or merge was performed.

## Scope decisions / uncertainties

- The standalone `ui-concept` remains an explicitly separate scripted design preview. Its authorship metadata/footer were updated, but it was not rewritten or imported into the production frontend.
- Existing unused legacy component exports (`Sidebar`, `Conversation`, `InfoPanel`) were preserved. Only the legacy Sidebar pulse class was removed to keep motion consistent. Production rendering uses the reviewed workspace components.
- Native browser dictation and optional audio remain available; automated verification can check the integration and supported/unavailable states, not microphone hardware or an external speech provider.
- This pass verifies browser wiring without creating paid LLM runs or altering existing backend data.

## Every changed file

42 files, including eight screenshot artifacts. Paths are relative to the repository root.

| File | Change |
| --- | --- |
| [Docs/frontend/REDESIGN.md](REDESIGN.md) | This complete design/copy/file inventory and verification report. |
| [Docs/frontend/redesign_browser.json](redesign_browser.json) | Machine-readable final browser check results and measured evidence. |
| [Docs/frontend/screenshots-redesign/01_home_dark.png](screenshots-redesign/01_home_dark.png) | Browser fixture screenshot of the final visual pass. |
| [Docs/frontend/screenshots-redesign/02_approval_dark_expanded_json.png](screenshots-redesign/02_approval_dark_expanded_json.png) | Browser fixture screenshot of the final visual pass. |
| [Docs/frontend/screenshots-redesign/03_skills_dark.png](screenshots-redesign/03_skills_dark.png) | Browser fixture screenshot of the final visual pass. |
| [Docs/frontend/screenshots-redesign/04_comparison_dark.png](screenshots-redesign/04_comparison_dark.png) | Browser fixture screenshot of the final visual pass. |
| [Docs/frontend/screenshots-redesign/05_preferences_light.png](screenshots-redesign/05_preferences_light.png) | Browser fixture screenshot of the final visual pass. |
| [Docs/frontend/screenshots-redesign/06_home_light.png](screenshots-redesign/06_home_light.png) | Browser fixture screenshot of the final visual pass. |
| [Docs/frontend/screenshots-redesign/07_mobile_review_light.png](screenshots-redesign/07_mobile_review_light.png) | Browser fixture screenshot of the final visual pass. |
| [Docs/frontend/screenshots-redesign/08_failure_literal_output_light.png](screenshots-redesign/08_failure_literal_output_light.png) | Browser fixture screenshot of the final visual pass. |
| [LICENSE](../../LICENSE) | Proprietary license requiring both authors’ written consent. |
| [README.md](../../README.md) | Authors section and copyright notice. |
| [apify/llm-relay/Dockerfile](../../apify/llm-relay/Dockerfile) | Copyright comment and exact OCI image authors label; build commands unchanged. |
| [backend/Dockerfile](../../backend/Dockerfile) | Copyright comment and exact OCI image authors label; build commands unchanged. |
| [frontend/Dockerfile](../../frontend/Dockerfile) | Copyright comment and exact OCI image authors label; build commands unchanged. |
| [frontend/README.md](../../frontend/README.md) | Correct implemented backend scope and revised dictation label; copyright. |
| [frontend/nginx.conf](../../frontend/nginx.conf) | Serve the exported not-found page for static 404s; existing API/WS blocks unchanged. |
| [frontend/package-lock.json](../../frontend/package-lock.json) | Root package license metadata only; dependency entries unchanged. |
| [frontend/package.json](../../frontend/package.json) | Author/contributors and UNLICENSED metadata; dependencies/scripts unchanged. |
| [frontend/src/app/globals.css](../../frontend/src/app/globals.css) | Responsive output, shared footer, summary disclosures and readable monospace blocks. |
| [frontend/src/app/layout.tsx](../../frontend/src/app/layout.tsx) | Plain description, exact author metadata and shared copyright footer. |
| [frontend/src/app/page.tsx](../../frontend/src/app/page.tsx) | Remove repeated labels and fake context; preserve every editor/navigation/API behavior. |
| [frontend/src/app/workspace.css](../../frontend/src/app/workspace.css) | Shared neutral themes, spacing/type/radius tokens, restrained surfaces and focus. |
| [frontend/src/components/Activity.tsx](../../frontend/src/components/Activity.tsx) | Visible timestamps, wrapping metadata, quieter timeline and readable errors. |
| [frontend/src/components/Approval.tsx](../../frontend/src/components/Approval.tsx) | Single review action, accessible fields, simpler panels and readable rejection. |
| [frontend/src/components/Compare.tsx](../../frontend/src/components/Compare.tsx) | Show actual run names and remove the unsupported speed/cost slogan. |
| [frontend/src/components/DetectionRun.tsx](../../frontend/src/components/DetectionRun.tsx) | Details/usage panels without repeated state; collapse long summaries. |
| [frontend/src/components/Metrics.tsx](../../frontend/src/components/Metrics.tsx) | Readable full labels and simpler metric groups; values/thresholds unchanged. |
| [frontend/src/components/Preferences.tsx](../../frontend/src/components/Preferences.tsx) | Plain descriptions and useful controls with unchanged settings behavior. |
| [frontend/src/components/RequestComposer.tsx](../../frontend/src/components/RequestComposer.tsx) | Concrete examples, dictation labels and reduced boilerplate; request assembly unchanged. |
| [frontend/src/components/RunHistory.tsx](../../frontend/src/components/RunHistory.tsx) | Restore opener focus after dismissal, including mobile navigation; focus selected run content. |
| [frontend/src/components/Sidebar.tsx](../../frontend/src/components/Sidebar.tsx) | Remove an unused legacy pulse animation; preserve exports and behavior. |
| [frontend/src/components/ui.tsx](../../frontend/src/components/ui.tsx) | Native collapsible JSON viewer, quieter tags and state, copy/download preserved. |
| [frontend/tests/activity.test.mjs](../../frontend/tests/activity.test.mjs) | Regression for timestamps visible without hover. |
| [frontend/tests/nginx.test.mjs](../../frontend/tests/nginx.test.mjs) | Regression for the exported 404; existing proxy/WS assertions preserved. |
| [frontend/tests/run-panels.test.mjs](../../frontend/tests/run-panels.test.mjs) | Regressions for single review notice and complete escaped collapsed output. |
| [sandbox/Dockerfile](../../sandbox/Dockerfile) | Copyright comment and exact OCI image authors label; build commands unchanged. |
| [scripts/integration/package-lock.json](../../scripts/integration/package-lock.json) | Root package license metadata only; dependency entries unchanged. |
| [scripts/integration/package.json](../../scripts/integration/package.json) | Author/contributors and UNLICENSED metadata; dependencies/scripts unchanged. |
| [scripts/integration/redesign_browser.mjs](../../scripts/integration/redesign_browser.mjs) | Real read-only smoke plus isolated browser regressions against the production bundle. |
| [ui-concept/index.html](../../ui-concept/index.html) | Exact authors metadata/footer and copyright; separate preview behavior retained. |
| [ui-concept/package.json](../../ui-concept/package.json) | Author/contributors and UNLICENSED metadata; dependencies/scripts unchanged. |
