# Statická kontrola frontendu proti kontraktu v1

Kontrolovaný kontrakt: `Docs/kontrakt.md`; frontend: `frontend/src/lib/{api,types,engine,derive}.ts` a komponenty; backend: `backend/orchestrator/{main,models,events,run_store}.py`. Datum: 2026-10-09.

## Endpointy a URL

| Operace frontendu | Skutečná cesta backendu | Čtená / odesílaná pole | Výsledek |
|---|---|---|---|
| `api.health()` | GET `/health` | `status`, `contract_version` | PASS, verze 1 |
| `api.createRun()` | POST `/runs` | tělo `request`; odpověď `run_id`, `status` | PASS, stav běhu se odvozuje z událostí |
| `api.listRuns()` | GET `/runs` | `runs[].run_id`, `created_at`; ostatní pole neřídí stav panelů | PASS |
| `api.events(id, seq)` | GET `/runs/{id}/events?after_seq=N` | `events`, obálka + `data`; kurzor poslední souvislé sekvence | PASS |
| `api.approve()` | POST `/runs/{id}/approve` | volitelné `comment`; úspěch sám nepřepíná stav | PASS |
| `api.reject()` | POST `/runs/{id}/reject` | povinné `reason`; úspěch sám nepřepíná stav | PASS |
| `api.skills()` | GET `/skills` | `skills`: všechna pole `SkillInfo` | PASS |
| `audioUrl(id)` | GET `/runs/{id}/audio` | MP3 stream; chyba přehrávání skryje volitelné audio | PASS |
| `wsUrl()` | WebSocket `/ws` | události ve stejném formátu jako historie | PASS |

`NEXT_PUBLIC_API_BASE` je podle §7.3 absolutní origin backendu (výchozí `http://127.0.0.1:8000`); koncová lomítka se odstraní. WebSocket používá stejný origin s `ws:`/`wss:` a cestou `/ws`. ID jsou URL escapovaná. Kompatibilní nginx proxy `/api/` je kontrolovaná samostatně; frontend nadále používá přímý backend origin. Není důvod měnit jeho URL konfiguraci ani přímé připojení.

## Události a pole

Každá událost používá `type`, `run_id`, `seq`, `timestamp`, `phase`, `message`, `data`. Pole odpovídají backendovým modelům; není odlišný název události ani pole.

| Typ | Pole payloadu používaná frontendem / deklarovaná v `EventDataMap` |
|---|---|
| `run_started` | `request` |
| `plan_ready` | `steps`, `skills_needed` |
| `skill_reused` | `skill` (`SkillInfo`) |
| `capability_missing` | `skills[].name`, `skills[].description` |
| `forge_started` | `skill`, `attempt`, `max_attempts` |
| `skill_tests_failed` | `skill`, `attempt`, `tests_total`, `tests_failed`, `error_excerpt` |
| `skill_candidate_ready` | `skill`, `attempt`, `tests_total`, `code_sha256` |
| `rule_drafted` | `attempt`, `max_attempts`, `recipe`, `explanation` |
| `rule_evaluated` | `attempt`, `dataset`, `metrics` |
| `validation_done` | `dataset`, `metrics` |
| `summary` | `text`, `stats.duration_ms`, `llm_calls`, `tokens_total`, `skills_built`, `skills_reused` |
| `voice_ready` | `audio_url` je deklarované; audio se načte z kanonické cesty daného běhu |
| `awaiting_approval` | `recipe`, `metrics_tuning`, `metrics_validation`, `new_skills` |
| `skill_installed` | `skill` |
| `rule_approved` | `rule_name`, `comment` |
| `rule_rejected` | `reason` |
| `policy_rejected` | `target`, `name`, `attempt`, `violations[].code`, `violations[].detail` |
| `run_failed` | `reason_code`, `reason` |

`Metrics` používá `true_positives`, `false_positives`, `false_negatives`, `precision`, `recall`, `thresholds.min_precision`, `thresholds.min_recall`, `passed`. `SkillInfo` používá `name`, `version`, `kind`, `description`, `origin`, `status`, `created_by_run`, `created_at`. Recept se nevykonává ani neinterpretuje: zobrazí se JSON v `<pre>`.

Nové aditivní `summary.stats.cost_usd` frontend toleruje jako neznámé pole; **zobrazení ceny nebylo přidáno**. Zobrazení a případné rozšíření TypeScript typu zůstává kolegovi.

Časy backendu jsou UTC ISO 8601 s milisekundami a `Z`; frontend `Date` zobrazuje místní čas a zachovává původní hodnotu v atributu `dateTime`. Nullable `precision` / `recall` / `tokens_total` se zobrazují jako `—`; nullable `comment` a `policy_rejected.name` se bezpečně vynechají. Nullable `created_by_run` ani `finished_at` neřídí stav běhu. Neznámé typy událostí neovlivňují odvození stavu; neznámá pole se neinterpretují.

Chybová obálka je `error.code` + `error.message`. Backendové kódy `INVALID_REQUEST`, `RUN_NOT_FOUND`, `AUDIO_NOT_FOUND`, `RUN_ALREADY_ACTIVE`, `NOT_AWAITING_APPROVAL`, `INTERNAL_ERROR` zůstávají beze změny; frontend zobrazuje jejich `message` jako prostý text. `NETWORK_ERROR` a `UNKNOWN` jsou pouze lokální fallbacky HTTP klienta. `RUN_NOT_FOUND` při dosynchronizaci odstraní zaniklý běh po restartu backendu.

## Prokázané nesoulady a minimální opravy pro kolegu

| Nález | Důkaz / kontrakt | Oprava |
|---|---|---|
| Historie se stahovala před dokončením WS handshake; událost mezi snapshotem a skutečným připojením mohla chybět. | §12.2; regresní test nedovoluje `GET /runs` před `onopen` a simuluje událost během hydration. | `Engine.start()` pouze zahájí spojení; úvodní i opakovaná synchronizace se spustí po `onopen`. |
| Dočasné selhání HTTP při doplnění díry nemělo žádný retry při jinak zdravém WS. | §12.3; regresní test selže prvním požadavkem historie a ponechá socket otevřený. | Po selhání se za 3 s zopakuje synchronizace; nezměnily se události, politika ani testovací data. |
| U jednotlivých událostí nebyla vykreslená jejich fáze, pouze aktuální fáze celého běhu v záhlaví. | §12.5; regresní test rozlišuje řádky `intake`, `plan` a dvě neznámé fáze. | Každý řádek zobrazuje svoji fázi přes existující anglické `PHASE_LABEL`; neznámá hodnota je prostý escapovaný text a klíče prototypu se neinterpretují. |
| U známých událostí časová osa ukazovala pouze syntetizovaný anglický titulek a ne API `message`. | §12.5 vyžaduje `timestamp`, `phase`, `message`; regresní test kontroluje doslovný zprávový text i u `run_started`. | Zachovaný anglický UI titulek, doplněný původní API text bez překladu jako escapovaný zalamovaný text. |

Nginx opravy a jejich samostatný `fix(frontend):` commit jsou uvedené v hlavním integračním reportu; změny nginx ani Compose nebyly součástí této podúlohy.

## Ověření

- `npm --prefix frontend test`: **18 PASS** (5 původních request-context, 7 activity / bezpečnost / null, 4 engine / handshake / historie / restart, 2 nginx od hlavní kontroly).
- `npx --prefix frontend tsc --noEmit --project frontend/tsconfig.json`: **PASS**.
- `npm --prefix frontend run lint`: **PASS**.
- Žádné `dangerouslySetInnerHTML`, převod Markdown na HTML ani vykonávání API textu v `frontend/src`.
- Statické React testy používají všechny čtyři řetězce §5.3, kontrolují escapování, nepřítomnost `<img>` / `<script>` / `javascript:` odkazu a zalamování. Skutečný prohlížeč a screenshoty jsou evidované v hlavním integračním reportu.

## Selektory pro kontrolu prohlížeče

- Požadavek: `#prompt-input`; odeslání: tlačítko `Build detection`.
- Schválení: tlačítko `Approve and install`; volitelný komentář: `Review comment (optional)`.
- Zamítnutí: `Reject`, pole `Reason for rejection`, tlačítko `Reject rule`.
- Navigace: `Current run`, `Skill library`, `Compare runs`, `Search runs`.
- Úvodní běh: `#run-view`, `#run-request`, panel `Agent activity`; schválení: `Review detection rule`, `Needs review`.
- Historie se po reloadu obnoví z backendu; vybraný pohled není součástí kontraktu, běh lze znovu vybrat v `Recent runs`.
