# Integrační kontrola — 2026-10-09

Větev `fix/integration-check` vznikla pomocí `git fetch origin` a `git switch -c fix/integration-check origin/main` z main **8433698** (merge PR #16). Žádný push, merge, rebase ani vzdálený deployment nebyl proveden. Lokální standardní stack na portu 3000 zůstal spuštěný s `LLM_PROVIDER=apify`; živý registr i samostatný demo svazek byly zachovány.

Kontrakt v1 je zdroj pravdy pro protokol. Existující Git adresář se jmenuje **Docs/**; na tomto checkoutu není druhý `docs/` ani case-colliding soubory. Proto jsou nové důkazy v `Docs/integration/`, aby nevznikla duplicita na Linuxu. `BACKEND_SPEC.md` není v main; kapitola 0 byla načtena z původně poskytnutého `/Users/adam/Coding/AI Agents/BACKEND_SPEC.md`. Aktuální výslovné povolení oprav frontendu/nginx a pole ceny má přednost před starším omezením tohoto dokumentu.

Frontend nadále používá přímý origin `http://127.0.0.1:8000` podle §7.3. nginx nyní navíc umožňuje požadované stejnooriginové `/api/` a `/api/ws`; prefix odřezává na skutečné backendové cesty. Nezměnila se základní adresa frontendu ani protokol. UI běhy byly zadány v prohlížeči na portu 3000 s přímým backendovým spojením dle kontraktu; samostatné finální živé API běhy A/B proběhly celé přes nginx port 3000.

## Všechny kontroly

| Bod | Výsledek | Důkaz | Oprava / poznámka |
|---|---|---|---|
| 1. Backend, sandbox, relay, frontend v main | PASS | baseline 8433698, příslušné Dockerfiles a zdroje | všechny čtyři aplikace přítomné |
| 1. Docs/docs a duplicity | PASS | `test_integration_layout.py`, Git case scan | odstraněno 5 nepoužívaných nulových legacy souborů; sandbox/main.py je explicitní compatibility import server.app |
| 1. Compose duplicity | PASS | docker-compose.yml + demo override | demo je záměrný override backendu a odděleného /data, nikoli druhá aplikace |
| 1. Backend + sandbox testy | PASS | [test_results.json](test_results.json) | 652 PASS / 20.72 s, Python3.12; původní baseline627 PASS |
| 1. Relay testy | PASS | [test_results.json](test_results.json) | 36 PASS, falešný transport, žádný internet |
| 1. Frontend testy | PASS | [test_results.json](test_results.json) | 18 PASS i Node22 Docker --network none; TypeScript/ESLint PASS |
| 2. Endpointy, URL, WS | PASS | [FRONTEND_AUDIT.md](FRONTEND_AUDIT.md) | všech 9 operací odpovídá cestám kontraktu |
| 2. Názvy a pole všech událostí | PASS | audit + model tests | žádné přejmenované pole/type, 18 katalogových událostí |
| 2. Chybové kódy, ISO čas, null | PASS | audit, REST důkazy, safety screenshoty | RUN_ALREADY_ACTIVE zachován, UTC milisekundy Z; null zobrazeno jako — |
| 2. Historie/handshake/díry/reconnect | PASS | engine.test.mjs + browser reload/restart | opraven handshake race a chybějící retry HTTP doplnění událostí |
| 2. Časová osa message a phase | PASS | activity.test.mjs + demo screenshoty | zachovaný anglický UI titulek, doplněn původní escapovaný message a fáze každé události |
| 2. nginx /api/ a odříznutí prefixu | PASS | nginx.test.mjs, skutečná /api/health/runs/skills volání | `proxy_pass http://backend:8000/` |
| 2. nginx /api/ws upgrade | PASS | [ws_idle.json](ws_idle.json), demo WS==HTTP | HTTP1.1, Upgrade, Connection, proxy_read_timeout1800s |
| 2. Sandbox síť, read_only, tajemství | PASS | [stack_security.json](stack_security.json) | pouze interní síť, no-new-privileges, cap_drop ALL, bez LLM env a tajemství; internet a zápis /app odmítnuty |
| 2. /data, porty, healthchecky | PASS | stack_security.json, Compose + image health | backend/sandbox healthy; /data named volume jen backend; 8000 loopback; frontend dostupný3000 a externě hlídaný CI |
| 2. CI test/deploy/security | PASS | test_integration_layout.py | doplněn frontend-test, relay/sandbox testy a nginx smoke včetně180idle; všechny původní deploy/security kontroly zachovány |
| 2. Deploy nemaže svazky | PASS | statický CI test | žádné down -v ani --volumes; vzdálený deploy nebyl spouštěn |
| 3a. Standardní build a health3000 | PASS | opakované docker compose up -d --build bez override | HTTP200 {status:ok, contract_version:1} |
| 3b. WS nginx180s bez aplikačního provozu + event | PASS | [ws_idle.json](ws_idle.json) | 180s, 0 app zpráv, následně run_started; protokolový ping/pong není aplikační provoz |
| 3c. Reálné LLM UI A→approve→B→reuse | PASS | [browser_live.json](browser_live.json), [live_run_a.json](live_run_a.json), [live_run_b.json](live_run_b.json) | A vytvořilo distinct_count_window, B ji znovu použilo; skutečné metriky P=R=1.0 |
| 3c. Finální reálné HTTP A/B přes nginx3000 | PASS | [nginx_live_a.json](nginx_live_a.json), [nginx_live_b.json](nginx_live_b.json) | po obnovení živého stacku, obě schválení a agent skill reuse; P=R=1.0 |
| 3d. Zamítnutí | PASS | [rest_controls.json](rest_controls.json), rejection_before.json | run_794c4aa5 → rule_rejected; další approve409 NOT_AWAITING_APPROVAL |
| 3d. Souběžné approve/reject | PASS | rest_controls.json, [race_after.json](race_after.json) | run_b74fa29f: 200 approved a409 NOT_AWAITING_APPROVAL; jediná terminal událost |
| 3d. Aktivní běh | PASS | REST/browser kontrola při každém vytvoření | nový POST409 RUN_ALREADY_ACTIVE |
| 3e. Restart živého backendu | PASS | [restart.json](restart.json), before_restart.json | docker compose restart backend; všechny 4 staré běhy404, registry přesně zachován |
| 3f. Demo override A/B | PASS | [browser_demo.json](browser_demo.json), demo_run_a.json/demo_run_b.json | skutečný sandbox; přesná stávající SEQUENCE_A/B potvrzena; WS události se přesně rovnají HTTP historii |
| 3g. /skills a /runs | PASS | rest_controls.json | pouze installed skills seřazené podle name; seznam běhů |
| 3g. after_seq a neplatný kurzor | PASS | rest_controls.json | přesné seq>N; neplatný kurzor400 INVALID_REQUEST |
| 3g. Audio bez hlasu | PASS | rest_controls.json + backend testy | skutečné404 AUDIO_NOT_FOUND; žádný voice_ready bez konfigurace; externí ElevenLabs není nastavený |
| 4. UI activity/approval/library/compare | PASS | browser_live.json/browser_demo.json, [screenshots/](screenshots/) | zadání přes UI, kliknutí/dvojklik na Approve and install, knihovna a srovnání |
| 4. Reload | PASS | live/demo *_reload.png | stejné event-derived schválení a request po výběru Current run |
| 4. Literal text §5.3 + null + unknown | PASS | [browser_safety.json](browser_safety.json), safety screenshoty | skutečný Chromium s řízeným HTTP/WS payloadem; všechny4 řetězce doslova, žádné img/script/javascript link ani dialog, layout se nezvětší |
| 4. Konzole | PASS | browser_live/demo/safety JSON | 0 console errors a0 pageerrors při normálních tocích; dočasný výpadek při restartu testuje samostatný retry |
| 4. Browser reconnect po restartu | PASS | [browser_restart.json](browser_restart.json), restart_* screenshoty | finální UI + mock; historie zmizela, distinct_count_window zůstala, 0 pageerrors |
| 5. Relay lokální timeout180 a Standby limit | PASS | [RELAY_COST.md](RELAY_COST.md), relay testy | oficiální Apify první odpověď5min podporuje180s; Actor načítá ACTOR_WEB_SERVER_PORT, usesStandbyMode true |
| 5. Relay vzdálený rollout180 | FAIL | dosud nasazená verze120s | čeká na Adamovo apify push; nasazení není součástí oprávnění tohoto úkolu |
| 5. usage.cost→cost_usd | PASS | test_llm_cost.py, živé summary | sčítají se platné ceny včetně placených retry/parsefail; mock/neznámá cena null; verze1 bez změny |
| 6. Tajemství při cleanup exception | PASS | test_api_resource_cleanup.py | test nejprve reprodukoval únik syntetického tajemství v tracebacku; nyní se loguje pouze typ výjimky |
| 6. README odkaz | PASS | test_readme_local_document_links_exist | neexistující PLAN.md nahrazen skutečným ARCHITECTURE.md |
| 6. Data/politika/prahy/authority | PASS | git diff origin/main -- backend/policy backend/datasets backend/seed_skills; boundary tests | beze změny; Gatekeeper zůstává bez LLM a generated code jen v sandboxu |
| 6. Audit frontend dev závislostí | FAIL | [frontend_dependency_audit.json](frontend_dependency_audit.json) | 5 high nálezů v ESLint chain, mimo povolené opravy napojení; bez npm audit fix --force |

## Živé výsledky

Model `anthropic/claude-sonnet-5.5`, relay `https://piquant-peacoat--llm-relay.apify.actor/v1`, effort low, max_tokens16000, timeout180s, run_timeout1500s. Všechny níže uvedené běhy prošly napoprvé bez změny promptů, dat, politiky nebo prahů; ladicí i validační P=R=1.0.

| Běh | run_id | Doba do summary | LLM calls | tokens_total | cost_usd | built / reused |
|---|---|---|---|---|---|---|
| UI A | `run_9ccfb84a` | 29.262 s | 4 | 17438 | $0.059388 | 1 / 1 |
| UI B | `run_48888abf` | 14.071 s | 3 | 11768 | $0.032640 | 0 / 2 |
| nginx API A | `run_0e571e96` | 15.470 s | 3 | 11944 | $0.032496 | 0 / 2 |
| nginx API B | `run_bf27de72` | 12.058 s | 3 | 12029 | $0.032626 | 0 / 2 |

První UI A vytvořilo a nainstalovalo agent dovednost. Finální nginx API A/B po restartu používají zachovaný registr, proto už oba nic nestaví. Cena je součet poskytovatelem oznámených usage.cost; nezahrnuje cenu infrastruktury Apify ani neohlášené části.

## Změny pro kolegu

Každá změna produkčního frontendu/nginx je v samostatném `fix(frontend):` commitu:

| Commit | Soubory | Důvod |
|---|---|---|
| 482456d | frontend/nginx.conf + nginx.test.mjs | chybějící požadované API a WS kompatibilní cesty, Upgrade a1800s timeout; statický frontend i přímý API origin zachovány |
| ee2b484 | engine.ts, Activity.tsx, package.json a regresní testy | historie po WS handshake; retry díry; doslovná message dle §12.2/12.3/12.5; test script zahrnuje všechny testy |
| d8aedaf | Activity.tsx + activity.test.mjs | fáze každé události dle §12.5, bezpečný fallback neznámých hodnot |

Další předávka: kontrakt nově deklaruje nullable **summary.stats.cost_usd**, backend ho vrací. Frontend jej bezpečně ignoruje; zobrazení ceny záměrně nebylo přidáno. Typ a UI doplní kolega. Úplná mapa polí, času, null a kódů: [FRONTEND_AUDIT.md](FRONTEND_AUDIT.md).

## Známá omezení

1. Vzdálený relay zůstává120s do nového buildu od Adama. Lokální180s je otestovaný falešným transportem; všechny skutečné běhy byly kratší než120s. Po push zkontrolovat Standby tag latest a počkat na výměnu starého běhu. Apify první-response deadline5min obsahuje i interní výběr běhu s limitem2min, proto cold start může ubrat čas. [Oficiální Standby dokumentace](https://docs.apify.com/actors/development/programming-interface/standby#timeouts).
2. npm audit hlásí5 high zranitelností v ESLint dependency chain (braces/micromatch/fast-glob, eslint-config-next/plugin). Jsou to vývojové/build závislosti; výsledný nginx image obsahuje statický export, nikoli tyto Node balíky. Upgrade/downgrade lint toolchainu patří kolegovi a nepokrývá povolení minimálních oprav kontraktu. [Podkladové braces advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm).
3. ElevenLabs nebyl konfigurací aktivovaný. Ověřena funkčnost bez hlasu a unit testy s falešným voice transportem; žádný skutečný externí MP3 nebyl generovaný.
4. Informativní §13 kontraktu ještě popisuje starou skeleton pipeline, ačkoli katalog/sekvence §7–12 nyní skutečně fungují. Protokolová pole odpovídají; statusovou poznámku má potvrdit dvojice autorů. Mimo explicitně autorizované rozšíření cost se kontrakt neměnil.
5. Živé LLM nejsou deterministické. Uvedené běhy skutečně prošly, nejsou zárukou každého budoucího návrhu. Testy zůstávají offline a mock je spolehlivá záloha. Existující Starlette/AnyIO a Node22 MockTimers warnings neovlivňují aserce.

Při vývoji browser harnessu byly opraveny selektory tlačítka se skill-count suffixem, čekání na hydration, otevření detailu null metrik a tolerance krátké502 při restartu. Aserce nebyly odstraněny; finální kontroly byly zopakovány. Živé A/B se kvůli selektoru neopakovaly; resume doplnil knihovnu/srovnání bez dalších LLM volání. Finální API A/B přes nginx byly samostatné ověření hotového standardního stacku.

## Reprodukce a předání

```bash
# offline sady (Python3.12 + Node22)
(cd backend && python -m pytest)
(cd apify/llm-relay && python -m pytest tests)
npm --prefix frontend ci
npm --prefix frontend test

# standardní stack
docker compose up -d --build
curl --fail http://localhost:3000/api/health

# browser tooling
npm --prefix scripts/integration ci
npx --prefix scripts/integration playwright install chromium
node scripts/integration/ws_idle.mjs http://localhost:3000 Docs/integration/ws_idle.json 180
```

Po zprávě idle PASS180s spusť v druhém terminálu (první socket audit čeká na událost běhu):

```bash
node scripts/integration/browser.mjs live http://localhost:3000
node scripts/integration/browser.mjs safety http://localhost:3000
```

Live browser i smoke jsou ruční nástroje, mohou utratit LLM kredit a nainstalovat testovací dovednost; pytest/npm test žádnou síť nepoužívají. Demo A/B se spouští na novém izolovaném demo registru; existující svazky nemažte. Evidence už obsahuje skutečné provedené běhy a nepotřebuje opakovat. Screenshoty jsou v screenshots/.

Relay nasadí Adam z kořene repa, přihlášený do účtu vlastníka Actoru:

```bash
apify login
(cd apify/llm-relay && apify push --build-tag latest)
```

usesStandbyMode true a buildTag latest se synchronizují při push. Není potřeba vymýšlet další timeout parametr Standby. Ověření účtu/build tagu a přepnutí starého běhu je popsané v [RELAY_COST.md](RELAY_COST.md).

Push a PR až po kontrole Adama:

```bash
git push -u origin fix/integration-check
gh pr create --base main --head fix/integration-check \
  --title "fix: repair and verify full-stack integration" \
  --body-file Docs/integration/PR_DESCRIPTION.md
```
