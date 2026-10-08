# WP-D/G – data, výchozí dovednosti a LLM

2026-10-08: celý BACKEND_SPEC a kontrakt přečteny; zmrazené typy a PLAN respektovány.

- Hotové deterministické SSH a webové generátory, pevné logy/štítky, katalog a SHA-256 manifest.
- Hotové `DatasetStore`, soukromé načítání a cachovaný 20řádkový vzorek pouze ladicí sady.
- Všech deset datových garancí ověřeno; datové testy: **8 passed** v Pythonu 3.12 Docker.
- Hotové seed `ssh_parser` a `count_window` včetně vlastních 9/7 testů; oba testy přes skutečný izolovaný runner: **2 passed**.
- Hotové mock LLM a scénáře A–F, skutečný HTTP transport, retry 1/3 s, rozpočet v ContextVar, čtyři role s jednou opravou JSON, český fallback shrnutí a bezpečné cachované prompty.
- Zpětně kompatibilní synchronní `ask()` zachovává requests a dotenv; testy nyní vyžadují instalaci těchto doplňkových závislostí ve vývojovém kontejneru.
- Dotenv načítání probíhá centrálně v `Settings.from_env(load_env_file=True)`, nikoli v LLM modulu.
- Celá vlastní sada včetně integrace evaluátoru: **59 passed, 1,80 s**. Skutečné izolované provádění receptů A/B/C/E dává na obou sadách precision/recall 1. První recept A má skutečný recall 0, precision null a osm FN. Neplatné nečíselné NaN/Infinity se při parsování JSON odmítají.
- Statická analýza všech legitimních fixtur prochází; úmyslný `socket` je odmítnut. Klíče nejsou ve výjimkách ani DEBUG výpisu.

Rozhodnutí: servisní účty `tune_backup` a `valid_backup` nahrazují obecné `backup`, aby také běžné identity byly mezi sadami disjunktní. Každá sada používá 36 běžných uživatelů. SSH útoky startují v hodinových rozestupech.

Pokračování: `docker exec -w /workspace/backend frankenstein-dev-tests python -m pytest tests/unit/test_datasets.py tests/unit/test_seed_skills.py tests/unit/test_llm.py tests/unit/test_mock_fixtures.py tests/integration/test_calibration.py -q`.

Rozhraní rolí: `from orchestrator.planner import make_roles, Roles`; `make_roles(settings, client=None)`. V pipeline předej kovárně `attempt=attempt, request=run.request`, aby druh scénáře nevycházel pouze z názvu dovednosti. `roles.close()` zavírá HTTP klienta. Run budget: `bind_run_counters(run.stats)` / `reset_run_counters(token)`.

WP-D/G připraveno na celkovou integraci. Volitelný nezávislý Examiner se začne až po potvrzení M5 koordinátorem.
