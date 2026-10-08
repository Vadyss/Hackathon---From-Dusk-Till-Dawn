# Obnovitelný stav

## Aktuální stav

2026-10-08: průzkum a úplné čtení specifikace dokončeno. PLAN.md vytvořen před první implementací. Aktivní větev feat/backend-toolsmith; nedotýkat se existujícího stacku hackathon-*.

## Milníky

| Milník | Stav | Ověření |
|---|---|---|
| M0 | sdílené typy a protokoly zmrazené; modely hotové | 9 passed, Python 3.12, 0.17 s |
| M1 | hotovo: API, české chyby, atomické intake/decisions, emitter, fronty WS | 75 cílených testů; celá dostupná sada 304 passed / 2.64 s |
| M2 | hotovo: izolovaný runner, kontroly, data, seed, skryté testy, metriky | kalibrace obou sad; celá sada 447 passed / 13.94 s |
| M3 | hotovo: pipeline, přesné A–F, skutečný Docker smoke přes nginx | 5 e2e passed / 4.50 s; A→approve→B→approve HTTP/WS 13000 zelené |
| M4 | klienti, role, JSON oprava, retry a rozpočet hotové | LLM unit testy a pipeline budget/failure testy zelené |
| M5 | hotovo: integrita, audit, poučení, restart, CI, hardening a revize | celá sada 449 passed / 13.87 s; konkrétní nálezy opraveny |
| M6 | web E, hlas a volitelný nezávislý Examiner hotové; samoopravy odložené dle §19 | custom e2e a původní události zelené; poslední celá sada 506 passed / 18.61 s; Examiner výchozí false |

## Pokračování a závěrečný stav

Koordinátor dokončil WP-A/H; gatekeeper WP-C/F/E a P3 data, sandbox_infra WP-B/J + hlas/revizi/předání, data_llm WP-D/G + seed/web/Examiner. Jejich detailní stav je v PROGRESS_GATEKEEPER/SANDBOX/DATA_LLM/EXAMINER/EXAMINER_DATA.md. Vývojový kontejner `frankenstein-dev-tests` je spuštěn s mountem repozitáře jako `/workspace`; závislosti jsou nainstalované. Příkaz: `docker exec -w /workspace/backend frankenstein-dev-tests python -m pytest`. Hlavní kompletní ověření: `backend/scripts/test.sh -q`.

M0–M5 dokončeny lokálně. První izolované demo `frankenstein-validation` prošlo na 13000 a jeho pomocné kontejnery/sítě se po ověření odstranily bez mazání svazku. Nezměněná nginx.conf se připojuje read-only, protože cachovaný frontend image obsahoval starší konfiguraci bez /api. Backend a sandbox image vznikly při Docker egress výpadku offline z hostem stažených wheelů v `/tmp/frankenstein-offline-build-9fx69afw`; standardní Dockerfiles nejsou změněné workaroundem. Produkční hackathon-* stack se nemění.

Finální stav: Examiner integrován, včetně celého custom běhu přes API a WS a opravy prvního neplatného plánu. **506 testů prošlo přes přesný test.sh / 18.61 s**, jeden dependency deprecation warning, bez skip/xfail. Finální oba image jsou sestavené; `frankenstein-final` a jeho read-only nginx proxy běží na **http://localhost:13001**. UID/tajemství/internet/read-only/capabilities/internal network ověřeny. Finální smoke prošel: 185 s nečinného WS s ping/pong, poté A → approve → B → approve; události HTTP/WS identické, registr používá schválenou dovednost, audit po schválení platný. REPORT/handoff dokončené. Self-repair je výslovně volitelný a odložený. Vzdálené CI, skutečné placené LLM/TTS, push/merge a deployment se neprováděly.

Pro další vývoj lze použít `BACKEND_TEST_IMAGE=frankenstein-tests:local BACKEND_TEST_SKIP_INSTALL=1 backend/scripts/test.sh -q`. Demo svazek nyní obsahuje schválenou dovednost A; opakování přesného čistého smoke vyžaduje nový projekt, nikoli mazání dat. Ruční provider/TTS kroky jsou v REPORT. Žádný povinný implementační krok nezůstává otevřený.

Opravené regresní nálezy: mutable návrhy/recepty se snapshotují před await; validation má jednorázový guard před await; promotion snapshotuje všechny ověřené artefakty před zápisy; group a `_lines` odpovídají deklarované skupině a oknu; zpětná vazba nevkládá neověřené názvy skupin; failure lessons obsahují metriky a bezpečný tvar posledního validního receptu.

Dodatečná revize: audit povýšení je součástí rollback transakce, úklid po úspěšném povýšení je best effort. Neplatné UTF-8 návrhy se bezpečně odmítnou. Examiner neuchovává ani nepředává seedy, skládá pouze generované označené útoky s pevnými benigními daty; všechny použité identity jsou mezi sadami disjunktní. Testovací skript podporuje explicitní lokální image bez instalace pro případ výpadku Docker sítě; generování dat běží v Pythonu 3.12 bez sítě.

## Živé LLM — 2026-10-09 (probíhá)

Aktivní úkol: Apify relay, hlavní Claude Sonnet 5.5, nezávislý Examiner/fallback Deepseek V4.1 Flash. Konfigurace 8000 tokenů / lokální bezpečnostní strop 16000, timeout 180 s, běh 1500 s. Token zůstal pouze v ignorované .env. Klient a null/length/fallback/regresní testy: 124 passed. Prompty zpřesněny podle skutečných schémat. Standardní backend/sandbox Docker build prošel. Následuje smoke a skutečné HTTP běhy; evidence bude v live_runs. A/B sdílí nový svazek pouze v rámci jedné dvojice; C/E nový svazek při každém pokusu. Autorita, politika, prahy a data se nemění.

Smoke skutečného relay: Claude HTTP 200, validní JSON, 44 total_tokens. Offline celá sada: 586 passed / 18.98 s (126 klient+config); jeden existující dependency warning. První A/C/E běží na projektech frankenstein-live-ab1/c1/e1, porty 13011/13012/13013. Checkpointy a run_id jsou v live_runs/a_1.json, c_1.json, e_1.json; runner opětovným spuštěním stejného --output běh obnoví.

První skutečné běhy dokončeny: C1/C2 schválené (P=R=1.0 v obou sadách, žádná identity výjimka; 3 calls/11201 a 11111 tokens, 19.486 a 13.194 s). A1 FORGE_FAILED po 3 INVALID_OUTPUT, 173 s; E1 stejný problém, 101 s. Jejich evidence zůstává beze změn. Zkracuje se pouze forge prompt; retry na length až do 16000 prošlo relay bez chyby tokenového limitu. Zatím nebyl zjištěn skutečný limit upstreamu. Další A/E je pokus 2 z nejvýše 5; B zatím nespouštěno, dokud A nepovýší novou dovednost.

Druhý build: kompaktní forge prompt o 24 % kratší, striktní plochý JSON a escapování; A2/E2 běží na 13015/13016. Demo override ověřen nový projekt frankenstein-live-demo: skutečné HTTP/WS/sandbox, přesné A→approve→B→approve/reuse, bez sítě LLM. Local non-demo docker compose up -d --build spuštěn dle explicitního požadavku; žádné svazky se nemažou. Doplňkové UTF-8 a budget regrese: 147 targeted passed.

Diagnostika A2/E2: finish_reason=length i při neprázdném krátkém content (306/2312/2018 znaků); JSON je skutečně useknutý. Zvětšena pouze místní .env na LLM_MAX_TOKENS=16000, cap=32000 pro následující pokusy a finální stack. 16000 bylo přijato bez HTTP chyby; maximální upstream strop se zatím nepotvrdil. Schémata/prompt kompaktní; politika a kontrolní limity se nemění. C dokončeno po dvou consecutivepasses.

A3/E3 rovněž FORGE_FAILED kvůli useknutému JSON, i při 16000/32000. Ověřen zdokumentovaný parametr reasoning.enabled=true/effort=low přímým relay smoke: HTTP200, validní JSON, 44 tokens. Přidána opt-in LLM_REASONING_EFFORT do backendu; místní .env low, reasoning nevypíná. Následující A4/E4 jsou poslední dva možné páry pokusů (A/E maximálně5); C dva consecutivepasses již splněny.
