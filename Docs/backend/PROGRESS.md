# Obnovitelný stav

## Aktuální stav

2026-10-08: průzkum a úplné čtení specifikace dokončeno. PLAN.md vytvořen před první implementací. Aktivní větev feat/backend-toolsmith; nedotýkat se existujícího stacku hackathon-*.

## Milníky

| Milník | Stav | Ověření |
|---|---|---|
| M0 | sdílené typy a protokoly zmrazené; modely hotové | 9 passed, Python 3.12, 0.17 s |
| M1 | hotovo: API, české chyby, atomické intake/decisions, emitter, fronty WS | 75 cílených testů; celá dostupná sada 304 passed / 2.64 s |
| M2 | hotovo: izolovaný runner, kontroly, data, seed, skryté testy, metriky | kalibrace obou sad; celá sada 447 passed / 13.94 s |
| M3 | pipeline A–F hotová a e2e zelené; čeká Docker smoke | 5 e2e passed / 4.50 s; izolovaný compose build řeší Docker egress výpadek |
| M4 | klienti, role, JSON oprava, retry a rozpočet hotové | LLM unit testy a pipeline budget/failure testy zelené |
| M5 | registr, audit, poučení, restart, karanténa, CI a hardening hotové | facade regression a restart testy zelené, review probíhá |
| M6 | web E a volitelný hlas hotové; P3 zatím vypnutý | E e2e zelený; hlas 13 testů s fake HTTP |

## Další konkrétní krok

Koordinátor implementuje WP-A/H; gatekeeper vlastní WP-C/F/E, sandbox_infra WP-B/J, data_llm WP-D/G + seed + web. Jejich detailní stav je v PROGRESS_GATEKEEPER/SANDBOX/DATA_LLM.md. Vývojový kontejner `frankenstein-dev-tests` je spuštěn s mountem repozitáře jako `/workspace`; závislosti jsou nainstalované. Příkaz: `docker exec -w /workspace/backend frankenstein-dev-tests python -m pytest`. Test M0: `python -m pytest tests/test_health.py tests/unit/test_models.py tests/architecture -q`. Po integraci spouštět také `backend/scripts/test.sh`.

Následuje skutečný Docker smoke přes nezměněný nginx na 13000 v projektu frankenstein-validation. Host PyPI funguje, Docker build egress má dočasný výpadek; sandbox_infra připravuje offline image v dočasném kontextu, běžné Dockerfiles se nemění. Pak závěrečný audit všech požadavků, REPORT/ARCHITECTURE/handoff, finální celá sada a commity. P3 zůstává pod false, dokud nebude dokončen M5.

Opravené regresní nálezy: mutable návrhy/recepty se snapshotují před await; validation má jednorázový guard před await; promotion snapshotuje všechny ověřené artefakty před zápisy; group a `_lines` odpovídají deklarované skupině a oknu; zpětná vazba nevkládá neověřené názvy skupin; failure lessons obsahují metriky a bezpečný tvar posledního validního receptu.
