# Plán implementace backendu Frankenstein

Zdroj zadání: `/Users/adam/Coding/AI Agents/BACKEND_SPEC.md` (přečten celý, 1995 řádků). Veřejné rozhraní má přednost podle existujícího `Docs/kontrakt.md`, verze 1. Frontend, mock ani kontrakt se neupravují. Práce probíhá na větvi `feat/backend-toolsmith`; původní rozpracované rozhraní `ask()` v `llm.py` se zachová.

## Architektura

- FastAPI v Pythonu 3.12: HTTP router pod `/api` i bez prefixu, WebSocket se samostatnými omezenými frontami klientů, stav nejvýš 50 běhů v paměti.
- Orchestrátor řídí plán → kovárnu → návrh pravidla → ladění → jediné ověření → shrnutí → schválení. LLM pouze navrhuje; povýšení dovednosti je možné až po schválení člověkem a ověření receptu vrátným.
- Deterministický vrátný vlastní politiku, AST kontroly, manifesty, recepty, pevné datové sady, skryté testy, metriky, registr, audit a poučení. Orchestrátor importuje pouze `gatekeeper.api` a `gatekeeper.types`.
- Samostatný sandbox provádí každou úlohu v novém omezeném podprocesu. Jen interní síť, žádná tajemství, read-only kontejner, tmpfs a neprivilegovaný uživatel. Backend nikdy nespouští kód dovedností.
- Registr, pravidla, audit a poučení jsou v `/data`, v pojmenovaném svazku. Syntetická ladicí a ověřovací data v image mají disjunktní identity a ověřované SHA-256.

## Závislosti a rozhraní

Runtime: stávající FastAPI, uvicorn, websockets; doplnění připnutých pydantic v2, httpx a PyYAML. Testy: pytest, pytest-asyncio, HTTP/WebSocket TestClient a testovací transport sandboxu přes skutečný izolovaný runner. Testy používají mock LLM a blokují externí spojení.

Zmrazené sdílené typy: `gatekeeper/types.py` obsahuje konfiguraci, plán, specifikaci dovednosti, verdikty, metriky, SkillInfo, ParseFailure, SandboxError a protokol sandboxu. Katalog je JSON objekt s `skills` (manifesty), `log_sources`, `attack_types`, `policy`. Recept je JSON objekt. Rozhraní Gatekeeper odpovídá kapitole 11.1; role přijímají strukturovaný kontext a číslo pokusu. Protokol `/execute` odpovídá kapitole 14.1.

## Fáze a paralelní práce

1. **M0 – průzkum a rozhraní:** RECON, sdílené typy, politika, modely událostí, základ testů architektury. Zelené testy a commit.
2. **M1 – veřejné API:** konfigurace, validace a české chyby, run store, emitter, WS, atomická rozhodnutí. Koordinátor vlastní tyto soubory a integrační pipeline.
3. **M2 – bezpečné provádění:** paralelně agent pro sandbox a infrastrukturu (WP-B/J), agent pro deterministické kontroly vrátného a perzistenci (WP-C/F/E), agent pro pevná data, seed dovednosti a LLM role (WP-D/G). Každý vlastní jen přidělené soubory. Modulové testy po dokončení, následně integrační testy.
4. **M3 – kompletní mock smyčka:** Gatekeeper API, pipeline, přesné sekvence A–D/F, schválení/zamítnutí, restart, izolovaný demo smoke přes nginx. Celá sada testů a commit.
5. **M4 – skutečné LLM:** Apify/OpenAI kompatibilní transport, retry, rozpočet, bezpečné prompty, JSON oprava, ruční smoke skript. Testy s falešným transportem a commit.
6. **M5 – integrita a provoz:** audit s řetězením, karanténa, poučení, dřívější pravidla, architektonické testy, hardening a CI. Bezpečnostní revize, celá sada a commit.
7. **M6 – rozšíření:** volitelný hlas a webový scénář E; následně nezávislý Examiner a samoopravy, pokud základ funguje. P3 se implementuje až po dokončení M0–M5.
8. **Předání:** REPORT, ARCHITECTURE a backend-handoff s příkazy, výsledky testů, stavem všech požadavků a popisem omezení.

## Ověřování a pokračování

Testy se spouštějí v novém vývojovém kontejneru Python 3.12. Existující kontejnery `hackathon-*` se nemění; případný smoke běží v odděleném projektu a na volném portu. Produkční deployment ani změny existujícího svazku nejsou součástí práce.

`PROGRESS.md` v kořeni odkazuje na podrobný `docs/backend/PROGRESS.md`, který obsahuje vlastníky, aktuální výsledky testů, otevřené kroky a příkazy pro pokračování. Nejasnosti a rozpory se zapisují do `docs/backend/OPEN_QUESTIONS.md`. Commity používají Conventional Commits, bez push/merge/deploy.
