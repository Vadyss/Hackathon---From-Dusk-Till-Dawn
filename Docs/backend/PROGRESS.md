# Obnovitelný stav

## Aktuální stav

2026-10-08: průzkum a úplné čtení specifikace dokončeno. PLAN.md vytvořen před první implementací. Aktivní větev feat/backend-toolsmith; nedotýkat se existujícího stacku hackathon-*.

## Milníky

| Milník | Stav | Ověření |
|---|---|---|
| M0 | sdílené typy a protokoly zmrazené; modely hotové | 9 passed, Python 3.12, 0.17 s |
| M1 | čeká | — |
| M2 | čeká na delegaci | — |
| M3 | čeká | — |
| M4 | čeká | — |
| M5 | čeká | — |
| M6 | čeká | — |

## Další konkrétní krok

Koordinátor implementuje WP-A/H; gatekeeper vlastní WP-C/F/E, sandbox_infra WP-B/J, data_llm WP-D/G + seed + web. Jejich detailní stav je v PROGRESS_GATEKEEPER/SANDBOX/DATA_LLM.md. Vývojový kontejner `frankenstein-dev-tests` je spuštěn s mountem repozitáře jako `/workspace`; závislosti jsou nainstalované. Příkaz: `docker exec -w /workspace/backend frankenstein-dev-tests python -m pytest`. Test M0: `python -m pytest tests/test_health.py tests/unit/test_models.py tests/architecture -q`. Po integraci spouštět také `backend/scripts/test.sh`.

Původní llm.py obsahuje necommitnutou funkci ask; rozšíření je autorizované, její kompatibilita se musí otestovat. Žádný token se nečte ani nevypisuje.
