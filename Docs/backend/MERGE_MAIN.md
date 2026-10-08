# Merge PR #16 — 2026-10-09

Do `feat/backend-toolsmith` sloučen `origin/main` (`c0b833e`) pomocí `git fetch origin` a `git merge origin/main`. Bez rebase, force push, push nebo produkčního deploymentu. Historie každého konfliktního souboru byla zkontrolována před řešením.

## Rozhodnutí

- `.env.example`: sjednoceny názvy našich LLM, sandbox a voice proměnných s frontend/build/bind proměnnými z main; všechny hodnoty prázdné.
- `.github/workflows/ci.yml`: zachovány main joby test/deploy, přímý backend health, frontend health, repository variables a všechny sandbox kontroly; doplněny naše sandbox/relay testy a izolovaný mock HTTP/WS integration job. Smoke používá přímý backend dle main, zvlášť ověřuje statický frontend a kompatibilní health cestu.
- `README.md`: zachován Ondrův přímý frontend/backend, build argument, CORS a deployment nastavení; doplněn hotový backend, offline testy, demo override a evidence. Python příkaz opraven na skutečný balíček orchestrator.
- `backend/orchestrator/main.py`: zachován náš kompletní orchestrátor, Gatekeeper, sandbox, persistence schválených dovedností a oba prefixy HTTP/WS; doplněna main ochrana WS Origin a zachováno CORS včetně odpovědí 500 (api_errors.py) a localhost výchozích originů (config.py).
- `docker-compose.yml`: frontend blok je textově přesně main; backend/sandbox služby, resource/security limity, interní síť a svazky jsou naše, doplněny main publikace backendu pouze na loopback a CORS defaults pro fungující přímé volání prohlížeče.

Původní main pipeline odesílala jen run_started, takže nemohla dokončit běh, validaci ani schválení požadované kontraktem. Nahrazuje ji plná implementace naší větve. Main změnil některé zprávy na anglické; ponechány české zprávy podle kapitoly 4 aktuálního Docs/kontrakt.md. U převzatého test_cors.py změněna jen očekávaná řeč zprávy, všechny jeho kontroly zachovány.

Aktuální kontrakt používá voice_ready.audio_url `/runs/.../audio`; emitovaná cesta sjednocena s ním, schéma přijímá i starší `/api/runs/.../audio`. Docs/kontrakt.md je přesně main a nebyl upraven při řešení merge.

Main odstranil nginx API proxy. Po vysvětlení rozporu s požadavkem health na portu 3000 Adam autorizoval funkční řešení: přidána pouze přesná location `/api/health` na backend `/health`. Ostatní nginx a všechny frontend zdroje z main zachovány. Přímé frontend HTTP/WS volání zůstalo.

## Ověření

- Python 3.12: **627 passed**, backend + sandbox, offline mock výchozí, 21.32 s.
- Relay: **36 passed**, offline.
- Frontend: **5 passed**, node --test frontend/tests/request-context.test.mjs.
- docker compose up --build -d: úspěch, včetně Next/TypeScript buildu z main.
- GET http://localhost:3000/api/health a GET http://127.0.0.1:8000/health: HTTP 200, {"status":"ok","contract_version":1}; frontend / HTTP 200.
- Izolovaný dočasný backend, nový tmpfs /data, mock: skutečné HTTP/WS A (run_da9d3a61) → approve → B (run_01c91c8f) → approve. Přesné event sekvence, instalace, reuse i skutečný sandbox prošly.
- Sandbox: jen interní síť, read_only, cap_drop ALL, žádné tajemství ani LLM proměnné, zápis /app i internet zablokovány.
- git diff --check a kontrola konfliktních značek prošly; frontend Compose blok přesně main; env example pouze názvy.

Jediný warning testů je existující Starlette/AnyIO deprecation. Vzdálené CI ani deployment nebyly spouštěny; živé LLM znovu nevolány pro tento integrační merge. Dřívější živé důkazy zůstávají v LLM_LIVE_TEST.md.

## Zkontrolovaná historie main

### .env.example

b6fad94 — Ondra — Merge latest main into frontend and retain APIFY configuration
25659bf — Ondra — Connect frontend directly to backend and add English voice input
3e22e43 — Adam Krúpa — Rename secret LLM_API_KEY to APIFY_TOKEN
56f21ec — Adam Krúpa — Move LLM_API_KEY environment variable to backend service in docker-compose

### .github/workflows/ci.yml

b6fad94 — Ondra — Merge latest main into frontend and retain APIFY configuration
25659bf — Ondra — Connect frontend directly to backend and add English voice input
3e22e43 — Adam Krúpa — Rename secret LLM_API_KEY to APIFY_TOKEN
6e1ce36 — Adam Krúpa — Nginx reverse proxy to backend, close port 8000

### README.md

25659bf — Ondra — Connect frontend directly to backend and add English voice input
ccbc178 — Adam Krúpa — Finall setup

### backend/orchestrator/main.py

25659bf — Ondra — Connect frontend directly to backend and add English voice input
d14ae4d — Adam Krúpa — Health: return contract_version per contract 7.2
11840c8 — Adam Krúpa — Backend: contract endpoints, orchestrator/gatekeeper skeleton

### docker-compose.yml

b6fad94 — Ondra — Merge latest main into frontend and retain APIFY configuration
25659bf — Ondra — Connect frontend directly to backend and add English voice input
3e22e43 — Adam Krúpa — Rename secret LLM_API_KEY to APIFY_TOKEN
6e1ce36 — Adam Krúpa — Nginx reverse proxy to backend, close port 8000
