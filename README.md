<!-- Copyright (c) 2026 Adam Krúpa and Ondra Csajka. All rights reserved. -->
# Frankenstein

Frontend pro agenta, který připravuje detekční pravidla. Frontend komunikuje se skutečným FastAPI backendem ve složce `backend/orchestrator`.

## Authors

Adam Krúpa and Ondra Csajka. All rights reserved.

This project is proprietary. Use, copying, modification, and distribution require
written consent from both authors. See [LICENSE](LICENSE).

## Spuštění v Dockeru

Z kořene projektu spusť:

```bash
docker compose up --build
```

Aplikace je na `http://localhost:3000`. nginx obsluhuje statický frontend; prohlížeč se přímo připojuje k backendu na `http://127.0.0.1:8000` a WebSocketu `ws://127.0.0.1:8000/ws`. Compose publikuje backend jako `127.0.0.1:8000:8000`. Stav backendu ověříš na `http://127.0.0.1:8000/health` nebo přes kompatibilní cestu nginx `http://localhost:3000/api/health`.

Compose předává při buildu frontendu argument `NEXT_PUBLIC_API_BASE=${NEXT_PUBLIC_API_BASE:-http://127.0.0.1:8000}`. Pro jiný backend nastav `NEXT_PUBLIC_API_BASE` v prostředí příkazu Compose nebo v kořenovém `.env` a znovu spusť `docker compose up --build`. Adresa se při `next build` zapíše do JavaScriptu pro prohlížeč; změna vyžaduje nový build frontendu.

## Lokální vývoj

Backend používá Python (Docker image má verzi 3.12) a závislosti z `backend/requirements.txt`. Z kořene projektu:

```bash
python -m pip install -r backend/requirements.txt
python -m uvicorn orchestrator.main:app --app-dir backend --host 127.0.0.1 --port 8000
```

V druhém terminálu spusť frontend:

```bash
cd frontend
npm ci
npm run dev
```

Otevři `http://localhost:3000`. Prohlížeč používá přímo backendové cesty `/health`, `/runs`, `/skills` a WebSocket `/ws`. Jinou adresu backendu lze nastavit v `frontend/.env.development.local`:

```dotenv
NEXT_PUBLIC_API_BASE=http://127.0.0.1:8000
```

Nastav origin backendu bez prefixu `/api` a bez lomítka na konci, potom restartuj `npm run dev`. Soubor `.env.development.local` platí pouze pro lokální vývoj.

Backend i Compose používají proměnnou `CORS_ORIGINS`, výchozí hodnota je `http://localhost:3000,http://127.0.0.1:3000`. Pro jiný origin frontendu ji nastav v prostředí backendu (v Dockeru přes prostředí Compose nebo kořenový `.env`) a backend restartuj. HTTP CORS povoluje `GET`, `POST` a `Content-Type`; WebSocket ověřuje `Origin` proti stejnému seznamu.

Adresa backendu musí být dostupná z prohlížeče uživatele. `localhost` a `127.0.0.1` jsou pro lokální použití; jméno Docker služby `backend` prohlížeč nezná. Pro frontend na HTTPS musí backend používat HTTPS a WebSocket WSS. Podrobný návod je v [frontend/README.md](frontend/README.md).

Pro přístup z jiného zařízení nastav veřejnou `NEXT_PUBLIC_API_BASE`, odpovídající origin frontendu v `CORS_ORIGINS` a `BACKEND_BIND_HOST=0.0.0.0` pro publikování portu backendu i mimo lokální počítač. CI načítá tyto tři hodnoty z GitHub repository variables stejného jména. Výchozí nastavení je určené pro lokální použití.

## Aktuální stav backendu

Backend obsahuje úplný omezený běh plánování, znovupoužití dovedností, tvorby pravidel, ladění a validace přes izolovaný sandbox. Schválení instaluje dovednost do datového svazku; stav běhů a jejich události jsou v paměti. Vrátný kontroluje politiku i formát před spuštěním kódu.

Výchozí Docker konfigurace používá živé LLM přes Apify relay. Tajemství nastav pouze lokálně v ignorovaném `.env` nebo v prostředí; `.env.example` obsahuje jen názvy proměnných. Plný běh potřebuje sandbox, proto používej Docker stack; samostatný Python potřebuje odpovídající `SANDBOX_URL` a zapisovatelný `DATA_DIR`.

Záložní demo bez volání LLM:

```bash
docker compose -f docker-compose.yml -f docker-compose.demo.yml up --build
```

Offline testy backendu a sandboxu (Python 3.12):

```bash
cd backend
python -m pip install -r requirements.txt -r requirements-dev.txt -r ../sandbox/requirements.txt
python -m pytest
```

Architektura a stav: [ARCHITECTURE.md](Docs/backend/ARCHITECTURE.md), [PROGRESS.md](Docs/backend/PROGRESS.md), [REPORT.md](Docs/backend/REPORT.md). Důkazy živých běhů: [LLM_LIVE_TEST.md](Docs/backend/LLM_LIVE_TEST.md). Nastavení relay: [LLM_RELAY.md](Docs/backend/LLM_RELAY.md).
