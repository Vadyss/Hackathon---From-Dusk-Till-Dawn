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
| M6 | web E a hlas hotové; nyní se doplňuje volitelný Examiner | E e2e zelený; hlas 13 testů; P3 výchozí stále false |

## Další konkrétní krok

Koordinátor implementuje WP-A/H; gatekeeper vlastní WP-C/F/E, sandbox_infra WP-B/J, data_llm WP-D/G + seed + web. Jejich detailní stav je v PROGRESS_GATEKEEPER/SANDBOX/DATA_LLM.md. Vývojový kontejner `frankenstein-dev-tests` je spuštěn s mountem repozitáře jako `/workspace`; závislosti jsou nainstalované. Příkaz: `docker exec -w /workspace/backend frankenstein-dev-tests python -m pytest`. Test M0: `python -m pytest tests/test_health.py tests/unit/test_models.py tests/architecture -q`. Po integraci spouštět také `backend/scripts/test.sh`.

M0–M5 dokončeny lokálně. Izolovaný stack frankenstein-validation běží na 13000 s nezměněnou nginx.conf z repozitáře připojenou read-only (existující frontend image obsahoval starší konfiguraci bez /api). Backend a sandbox image vznikly při Docker egress výpadku offline z hostem stažených wheelů v `/tmp/frankenstein-offline-build-9fx69afw`; standardní Dockerfiles nejsou změněné workaroundem. Produkční hackathon-* stack se nemění. Následuje P3 Examiner: data_llm vlastní examiner/ a prompt; gatekeeper vlastní examiner_data.py a atomické uložení datasetů; koordinátor provede async integraci. Po nich REPORT/handoff a finální celá sada.

Opravené regresní nálezy: mutable návrhy/recepty se snapshotují před await; validation má jednorázový guard před await; promotion snapshotuje všechny ověřené artefakty před zápisy; group a `_lines` odpovídají deklarované skupině a oknu; zpětná vazba nevkládá neověřené názvy skupin; failure lessons obsahují metriky a bezpečný tvar posledního validního receptu.
