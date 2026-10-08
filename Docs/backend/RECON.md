# Průzkum 2026-10-08

- Specifikace je mimo repozitář jako `../BACKEND_SPEC.md`; žádný `SPEC.md` v repozitáři není. Kontrakt existuje jako `Docs/kontrakt.md` (881 řádků); jeho umístění se zachová.
- Backend build context již je `./backend`, Dockerfile je v `backend/Dockerfile`, Python 3.12-slim, uživatel appuser, port 8000. CMD používá `main:app --app-dir orchestrator`; přejde na balíček `orchestrator.main:app`.
- `backend/orchestrator/main.py` je kostra HTTP/WS. Pipeline posílá jen run_started, registr je v paměti, není lifespan ani atomické trvalé povýšení. `llm.py` je jediná původní necommitnutá změna: requests POST na Apify s funkcí ask; zachováme její veřejné rozhraní.
- Prázdné: policy.yaml, planner.py, forge.py, events.py, examiner.py, všechny tři prompty; všechny Python moduly gatekeeperu. `backend/tools/registry.json` je prázdný placeholder. Data ani seed dovednosti nejsou.
- Sandbox má jen `sandbox/main.py` s health. Dockerfile používá Python 3.12 a appuser. Server/runner a `/execute` se musí doplnit.
- Compose: frontend 3000→8080, backend na default + sandbox_net, sandbox jen sandbox_net (`internal: true`), read_only/tmpfs/cap_drop/no-new-privileges/512 MB/1 CPU/100 PIDs. Žádné persistentní svazky. Doplní se jen backend, sandbox a top-level volumes.
- `frontend/nginx.conf` odřezává `/api/`; `/api/ws` směřuje na `/ws`, má Upgrade, Connection, HTTP 1.1 a timeout 3600 s. Úprava frontendu není potřebná.
- CI testuje jen backend v Pythonu 3.12; zachová se původní pytest i deploy job a bezpečnostní kontroly. Přidají se sandbox testy a izolovaný container smoke bez tajemství. Deploy nyní používá APIFY_TOKEN secret; nepoužívá down -v.
- Stávající test: `backend/tests/test_health.py`, import main, požaduje přesný health v1. Zachová se kompatibilita importu i test.
- Host Python je 3.9.6; Docker 29.8.1 funguje a Python 3.12-slim je dostupný. Existuje běžící stack `hackathon-*` na portu 3000, který se nebude měnit.
- Mimo frontend nejsou AGENTS.md. Žádné nadřazené AGENTS.md nebylo nalezeno. `frontend/AGENTS.md` se netýká autorizovaného backend rozsahu.

## Strom hlavních existujících souborů

```text
Docs/kontrakt.md
backend/{Dockerfile,requirements.txt,requirements-dev.txt,pytest.ini}
backend/orchestrator/{main,llm,events,planner,forge,examiner}.py
backend/orchestrator/prompts/{planner,forge,examiner}.md
backend/gatekeeper/{main,static_analysis,policy_check,sandbox_runner,evaluator,registry,audit}.py
backend/policy/policy.yaml
backend/tests/test_health.py
backend/tools/registry.json
sandbox/{Dockerfile,requirements.txt,main.py}
docker-compose.yml
.github/workflows/ci.yml
frontend/ (jen čtení)
mock/ (jen čtení)
```

## Rozpory

Kontrakt uvádí ve scénáři D distinct_count_window, specifikace failure_ratio_window. Po úspěšném A už distinct_count_window existuje, proto D použije failure_ratio_window; názvy a sekvence událostí zůstanou podle kontraktu. Podrobnosti v OPEN_QUESTIONS.
