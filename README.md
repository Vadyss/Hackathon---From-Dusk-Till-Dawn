# Frankenstein

Frontend pro agenta, který připravuje detekční pravidla. Frontend komunikuje se skutečným FastAPI backendem ve složce `backend/orchestrator`.

## Spuštění v Dockeru

Z kořene projektu spusť:

```bash
docker compose up --build
```

Aplikace je na `http://localhost:3000`. nginx obsluhuje statický frontend; prohlížeč se přímo připojuje k backendu na `http://127.0.0.1:8000` a WebSocketu `ws://127.0.0.1:8000/ws`. Compose publikuje backend jako `127.0.0.1:8000:8000`. Stav backendu ověříš na `http://127.0.0.1:8000/health`.

Compose předává při buildu frontendu argument `NEXT_PUBLIC_API_BASE=${NEXT_PUBLIC_API_BASE:-http://127.0.0.1:8000}`. Pro jiný backend nastav `NEXT_PUBLIC_API_BASE` v prostředí příkazu Compose nebo v kořenovém `.env` a znovu spusť `docker compose up --build`. Adresa se při `next build` zapíše do JavaScriptu pro prohlížeč; změna vyžaduje nový build frontendu.

## Lokální vývoj

Backend používá Python (Docker image má verzi 3.12) a závislosti z `backend/requirements.txt`. Z kořene projektu:

```bash
python -m pip install -r backend/requirements.txt
python -m uvicorn main:app --app-dir backend/orchestrator --host 127.0.0.1 --port 8000
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

HTTP API a WebSocket jsou implementované. `run_pipeline` zatím odesílá pouze událost `run_started`; plánování, generování pravidel a validace nejsou zapojené. Po odeslání požadavku proto běh zůstane ve stavu `running` a další požadavek backend odmítne, dokud se nerestartuje. Stav běhů je uložený jen v paměti.
