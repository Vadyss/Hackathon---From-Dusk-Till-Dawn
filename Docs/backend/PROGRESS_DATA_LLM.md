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

2026-10-08: závěrečná revize odhalila, že původní `regen_datasets.sh` používal hostitelský Python 3.9.6, který nepodporuje použitý argument `Path.write_text(newline=...)`. Skript nyní standardně spouští Python 3.12 v Dockeru, s read-only zdrojovým bindem, odděleným výstupním bindem a bez sítě. Zachovává `--output CESTA` i `--output=CESTA`, relativní cesty a cesty s mezerami. Obraz lze přepsat přes `BACKEND_DATASET_IMAGE`.

Ověření: regenerace skriptem do nového adresáře `/tmp/frankenstein-data-review.*/output with spaces` reprodukovala všech **9 datových artefaktů a MANIFEST.sha256 bajt po bajtu**. Všechny SHA-256 odpovídají; commitované korpusy se neupravovaly. Hostitelský Python 3.9 použit pouze pro porovnání bajtů, nikoli generování.

Závěrečná optimalizace: `count_window` nyní před sestavením `_lines` ořízne vstupní okno na prvních 500 seřazených řádků. Metrika `count` nadále počítá celé okno, včetně všech shodných časových razítek. Odstraněno zbytečné procházení celého okna pro každý výstup; dva ukazatele, řazení a omezený výstup splňují požadovanou složitost. Přidán skutečný sandbox test 750 událostí v obráceném pořadí: count 750 a přesně prvních 500 seřazených `_lines`. Seed nyní obsahuje 8 vlastních testů. `distinct_count_window` má již ořezání před sestavením, úmyslně chybná `failure_ratio_window` vrací pouze jeden `_line` na řádek; žádná další úprava není potřeba.

Ověření optimalizace: `tests/unit/test_seed_skills.py` + `tests/integration/test_calibration.py` — **14 passed, 1,46 s**. Všechny čtyři recepty zůstávají na obou sadách kalibrované, bez změny korpusů.
