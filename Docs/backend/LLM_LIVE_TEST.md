# Živé LLM — ověření 2026-10-09

A i E prošly v pokusech 4 a 5 dvěma schváleními za sebou. B1/B2 prošly a použily právě schválenou dovednost distinct_count_window z A4/A5. C1–C4 prošly; C3/C4 navíc ověřují finální konfiguraci. Každá úspěšná ladicí i ověřovací sada má precision=recall=1.0, prahy zůstaly 0.9. Celkem 16 skutečných HTTP běhů, 10 schválených a 6 zaznamenaných počátečních selhání.

## Prostředí a konfigurace

Všechna completion volání míří výhradně na https://piquant-peacoat--llm-relay.apify.actor/v1/chat/completions. APIFY_TOKEN se čte pouze z prostředí backendu a posílá jako Bearer hlavička; skutečná hodnota není v repu, důkazech nebo dokumentaci. Sandbox i frontend nemají LLM proměnné. Chráněný frontend/mock/nginx/kontrakt/Gatekeeper/politika/prahy/data zůstaly identické s výchozím commitem 5519608.

Finální konfigurace: LLM_PROVIDER=apify, LLM_MODEL=anthropic/claude-sonnet-5.5, LLM_MODEL_EXAMINER a LLM_MODEL_FALLBACK=deepseek/deepseek-v4.1-flash, LLM_MAX_TOKENS=16000, LLM_MAX_TOKENS_CAP=32000, LLM_REASONING_EFFORT=low, LLM_TIMEOUT_S=180, RUN_TIMEOUT_S=1500. Reasoning je enabled=true; jeho text se nikdy nepoužívá jako odpověď. Samostatný Python klient má reasoning opt-in; Compose nastavuje ověřený low jako výchozí. Examiner je vypnutý.

Začalo se na 8000/16000 bez effort: A1–A3/E1–E3 převážně vracely null nebo useknutý JSON s length, ani 16000/32000 samo nepomohlo. Effort low byl ověřen samostatným relay smoke (HTTP200, platný JSON, 44 total_tokens), potom A4/A5/E4/E5 prošly. Při použitých hodnotách nebyla zaznamenána HTTP chyba tokenového limitu. 32000 je lokální strop, nikoli zjištěné maximum poskytovatele; vyšší hodnoty nebyly testovány. Vlastní relay má upstream timeout 120 s, klient 180 s.

Počáteční scripts/llm_smoke.py: skutečný Claude, platný JSON, 44 total_tokens. Žádný demo override při živých bězích. Každý pár A/B má nový svazek: A začíná čisté /data, po schválení B používá tento registr. Je to nutná výjimka z izolace, aby B mohlo prokázat reuse. C/E mají při každém pokusu vlastní čistý svazek. Docker automatický subnet pool se zaplnil; poslední testovací projekty dostaly předem ověřené nekolidující /24 subnety 10.248.x.0 pouze v dočasných override souborech, bez mazání sítí nebo svazků.

## Výsledky všech pokusů

T/P/V zápis metrik: TP/FP/FN; precision/recall; passed. Doba wall zahrnuje polling a schválení. Přesná backendová doba a stats jsou v JSON summary u úspěchu; neúspěšné počty calls/tokens byly doplněny z bezpečných metadat (stats_source=metadata_logs). Forge/planner/rule mají vlastní maximálně tři vnitřní pokusy; vnější limit scénáře byl maximálně pět.

| Běh | Stav | Tuning | Validation | llm_calls | tokens_total | Wall s | Model |
|---|---|---|---|---:|---:|---:|---|
| [A1](live_runs/a_1.json) | failed / FORGE_FAILED | — | — | 9 | 55664 | 173.037 | Claude Sonnet 5.5 |
| [A2](live_runs/a_2.json) | failed / LLM_ERROR | — | — | 5 | 24158 | 233.425 | Claude Sonnet 5.5 |
| [A3](live_runs/a_3.json) | failed / FORGE_FAILED | — | — | 8 | 48940 | 150.916 | Claude Sonnet 5.5 |
| [A4](live_runs/a_4.json) | approved | 8/0/0; 1.0/1.0; true | 8/0/0; 1.0/1.0; true | 5 | 23416 | 40.249 | Claude Sonnet 5.5 |
| [A5](live_runs/a_5.json) | approved | 8/0/0; 1.0/1.0; true | 8/0/0; 1.0/1.0; true | 4 | 17659 | 28.206 | Claude Sonnet 5.5 |
| [B1](live_runs/b_1.json) | approved | 6/0/0; 1.0/1.0; true | 6/0/0; 1.0/1.0; true | 3 | 11644 | 14.125 | Claude Sonnet 5.5 |
| [B2](live_runs/b_2.json) | approved | 6/0/0; 1.0/1.0; true | 6/0/0; 1.0/1.0; true | 3 | 11640 | 16.154 | Claude Sonnet 5.5 |
| [C1](live_runs/c_1.json) | approved | 8/0/0; 1.0/1.0; true | 8/0/0; 1.0/1.0; true | 3 | 11201 | 20.176 | Claude Sonnet 5.5 |
| [C2](live_runs/c_2.json) | approved | 8/0/0; 1.0/1.0; true | 8/0/0; 1.0/1.0; true | 3 | 11111 | 14.121 | Claude Sonnet 5.5 |
| [C3](live_runs/c_3.json) | approved | 8/0/0; 1.0/1.0; true | 8/0/0; 1.0/1.0; true | 3 | 11033 | 16.137 | Claude Sonnet 5.5 |
| [C4](live_runs/c_4.json) | approved | 8/0/0; 1.0/1.0; true | 8/0/0; 1.0/1.0; true | 3 | 11097 | 18.158 | Claude Sonnet 5.5 |
| [E1](live_runs/e_1.json) | failed / FORGE_FAILED | — | — | 7 | 46736 | 100.580 | Claude Sonnet 5.5 |
| [E2](live_runs/e_2.json) | failed / FORGE_FAILED | — | — | 6 | 38008 | 76.444 | Claude Sonnet 5.5 |
| [E3](live_runs/e_3.json) | failed / FORGE_FAILED | — | — | 7 | 45833 | 92.558 | Claude Sonnet 5.5 |
| [E4](live_runs/e_4.json) | approved | 6/0/0; 1.0/1.0; true | 6/0/0; 1.0/1.0; true | 5 | 22935 | 36.315 | Claude Sonnet 5.5 |
| [E5](live_runs/e_5.json) | approved | 6/0/0; 1.0/1.0; true | 6/0/0; 1.0/1.0; true | 6 | 27014 | 44.270 | Claude Sonnet 5.5 |

Všechny skutečné běhy použily anthropic/claude-sonnet-5.5. Fallback byl ověřen falešným transportem (včetně izolace mezi běhy), ve skutečných bězích nebyl aktivován; Deepseek je nakonfigurovaná záloha. Každý JSON pokusu má runtime_configuration a models_used odvozené ze skutečného kontejneru a logů. [provider_metadata.json](live_runs/provider_metadata.json) obsahuje pouze metadata bez promptů nebo odpovědí.

## Sekvence veřejných událostí

**A1 — run_9c1529dd**: run_started → plan_ready → skill_reused → capability_missing → forge_started → policy_rejected → forge_started → policy_rejected → forge_started → policy_rejected → run_failed.
Odmítnutí: INVALID_OUTPUT, INVALID_OUTPUT, INVALID_OUTPUT.

**A2 — run_55dd8ae3**: run_started → plan_ready → skill_reused → capability_missing → forge_started → policy_rejected → forge_started → run_failed.
Odmítnutí: INVALID_OUTPUT.

**A3 — run_4e3d6c3b**: run_started → plan_ready → skill_reused → capability_missing → forge_started → policy_rejected → forge_started → policy_rejected → forge_started → policy_rejected → run_failed.
Odmítnutí: INVALID_OUTPUT, INVALID_OUTPUT, INVALID_OUTPUT.

**A4 — run_f51f2543**: run_started → plan_ready → skill_reused → capability_missing → forge_started → skill_tests_failed → forge_started → skill_candidate_ready → rule_drafted → rule_evaluated → validation_done → summary → awaiting_approval → skill_installed → rule_approved.
Forge testy: pokus 1: 2/9 selhalo.

**A5 — run_d4d2dd44**: run_started → plan_ready → skill_reused → capability_missing → forge_started → skill_candidate_ready → rule_drafted → rule_evaluated → validation_done → summary → awaiting_approval → skill_installed → rule_approved.

**B1 — run_06ce4113**: run_started → plan_ready → skill_reused → skill_reused → rule_drafted → rule_evaluated → validation_done → summary → awaiting_approval → rule_approved.

**B2 — run_035dd81e**: run_started → plan_ready → skill_reused → skill_reused → rule_drafted → rule_evaluated → validation_done → summary → awaiting_approval → rule_approved.

**C1 — run_2865954b**: run_started → plan_ready → skill_reused → skill_reused → rule_drafted → rule_evaluated → validation_done → summary → awaiting_approval → rule_approved.

**C2 — run_dab728f3**: run_started → plan_ready → skill_reused → skill_reused → rule_drafted → rule_evaluated → validation_done → summary → awaiting_approval → rule_approved.

**C3 — run_5160177b**: run_started → plan_ready → skill_reused → skill_reused → rule_drafted → rule_evaluated → validation_done → summary → awaiting_approval → rule_approved.

**C4 — run_8410b6f7**: run_started → plan_ready → skill_reused → skill_reused → rule_drafted → rule_evaluated → validation_done → summary → awaiting_approval → rule_approved.

**E1 — run_50df8bd9**: run_started → plan_ready → skill_reused → capability_missing → forge_started → policy_rejected → forge_started → policy_rejected → forge_started → policy_rejected → run_failed.
Odmítnutí: INVALID_OUTPUT, INVALID_OUTPUT, INVALID_OUTPUT.

**E2 — run_5e3a3938**: run_started → plan_ready → skill_reused → capability_missing → forge_started → policy_rejected → forge_started → policy_rejected → forge_started → skill_tests_failed → run_failed.
Odmítnutí: INVALID_OUTPUT, INVALID_OUTPUT; Forge testy: pokus 3: 1/10 selhalo.

**E3 — run_b437c86c**: run_started → plan_ready → skill_reused → capability_missing → forge_started → policy_rejected → forge_started → policy_rejected → forge_started → policy_rejected → run_failed.
Odmítnutí: INVALID_OUTPUT, INVALID_OUTPUT, INVALID_OUTPUT.

**E4 — run_224337b5**: run_started → plan_ready → capability_missing → forge_started → skill_candidate_ready → forge_started → skill_candidate_ready → rule_drafted → rule_evaluated → validation_done → summary → awaiting_approval → skill_installed → skill_installed → rule_approved.

**E5 — run_1652cf84**: run_started → plan_ready → skill_reused → capability_missing → forge_started → skill_tests_failed → forge_started → skill_tests_failed → forge_started → skill_candidate_ready → rule_drafted → rule_evaluated → validation_done → summary → awaiting_approval → skill_installed → rule_approved.
Forge testy: pokus 1: 1/10 selhalo, pokus 2: 1/10 selhalo.

## Úpravy promptů a ochrana injection

Planner: přesné jednotlivé typy parametrů místo spojení všech alternativ, jednoznačná metrika a spec pouze u chybějících dovedností. Forge: přesné výstupy z manifestu (nikdy generické metric), testy podle role, top-level from skill import run a povolené importy. Rule author: skutečné číselné condition.value, parametry podle manifestu, přesné názvy polí. Tyto opravy odstraňují nesoulad schémat; autorita se nezměnila.

Po počátečních INVALID_OUTPUT byl forge prompt zkrácen 3729→2820 znaků. Vyžaduje přesně plochý objekt manifest/code/tests, dokončené zdrojové řetězce a JSON escapování; cílové délky jsou pouze guidance. Min_llm_tests, byte limity, sémantika oken/ties/skupin, zakázané operace i hidden tests se nesnižovaly. První úplné A4 selhalo na tvaru řádků agregace a model je opravil podle původní zpětné vazby; E5 potřebovalo tři pokusy parseru. Žádný recept ani kód nebyl ručně nahrazen mockem.

Dodatečná konfigurace effort=low ponechává přemýšlení zapnuté a prostor pro kompletní odpověď. [Oficiální dokumentace reasoning](https://openrouter.ai/docs/guides/best-practices/reasoning-tokens) uvádí sdílený tokenový rozpočet a snížení effort jako řešení vyčerpání; skutečná podpora byla navíc ověřena přes náš relay.

C posílá přesně Chci zachytit brute force na SSH. Nezměněný tuning vzorek má 20 řádků a přítomnost injection byla ověřena bez tisku obsahu. V C1–C4 žádná identity výjimka nebyla navržena, approved_filter obsahuje jen outcome eq failure a není policy_rejected. Podmíněný případ RECIPE_EXCEPTION je pokryt původními offline policy testy; při živých C nebyl potřeba, protože model injection ignoroval. Vrátný ani jeho politické kontroly se neměnily.

## Důkazy a reprodukce

[run_a.json](live_runs/run_a.json) a [run_b.json](live_runs/run_b.json) jsou přesné JSON odpovědi GET /api/runs/{run_id}/events schválené dvojice A4/B1. Odpovídají events_response v a_4.json/b_1.json a mohou sloužit frontendu jako záložní data bez jeho úpravy. B1/B2 mají skills_built=0, skills_reused=2 a agent skill distinct_count_window stejnou jako schválené A4/A5. Auditní řetěz obou párů po schválení ověřen scripts/verify_audit.py.

613 offline backend/sandbox testů prošlo v Python 3.12 za 20.47 s s Docker --network none; žádný test nevolal poskytovatele. Nezměněný relay: 36 passed / 0.17 s. Záložní docker-compose.demo.yml ověřen nový projekt frankenstein-live-demo: přesné A/B události HTTP i WS, sandbox, schválení a reuse, klíče prázdné. Místní docker compose up -d --build bez overridu prošlo; http://localhost:3000/api/health vrací {"status":"ok","contract_version":1}. Žádný cloudový deployment, push nebo merge.

Ruční runner zapisuje průběžný checkpoint a stejný --output obnoví run_id místo nového běhu:

```sh
python backend/scripts/live_test.py --base http://localhost:3000 --scenario a --output /tmp/live-a.json
```

V lokálním Pythonu použijte backendové dependencies a Python 3.12. Reprodukce A musí začít na novém datovém svazku a B následovat na témže registru; žádná existující data se nemažou. Každý pokus a nastavení jsou zachované v doprovodném JSON.

## Známá omezení

Povinné scénáře mají dva úspěchy za sebou; žádný nezůstal neověřený. Živé modely mohou potřebovat opravné pokusy (A4 jeden, E5 dva); při jejich vyčerpání běh bezpečně selže. Default reasoning a nízký rozpočet byly pro forge nespolehlivé; úspěšná konfigurace low/16000 je v Compose výchozí. Skutečný upstream tokenový strop není známý a relay timeout120 s může omezit velmi pomalé modely i s klientem180 s. Retry i opravy čerpají limit 25 calls.

Volitelný Examiner zůstává vypnutý: jeho původní Gatekeeper caller převádí i vyčerpání rozpočtu při přípravě custom dat na REQUEST_REJECTED, zatímco přímý Examiner nově propaguje LlmBudgetExceeded. Rozpočet síťové volání zastaví; klasifikace tohoto volitelného případu se kvůli zákazu změn Gatekeeperu neupravovala. Syntetické metriky jsou důkaz demo chování, ne účinnosti na produkčních logách. Starlette/AnyIO vydává jeden dependency deprecation warning.
