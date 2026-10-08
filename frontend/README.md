# Frankenstein frontend

The Next.js frontend connects directly from the browser to the FastAPI backend. The default address is `http://127.0.0.1:8000`. HTTP requests use `/health`, `/runs`, and `/skills`; the WebSocket address is `ws://127.0.0.1:8000/ws`.

## Local development

You need Node.js with npm and Python (the Docker image uses version 3.12). In the first terminal, start the backend on port 8000 from the repository root:

```powershell
python -m pip install -r backend/requirements.txt
python -m uvicorn main:app --app-dir backend/orchestrator --host 127.0.0.1 --port 8000 --reload
```

In a second terminal, start the frontend from the repository root:

```powershell
cd frontend
npm.cmd ci
npm.cmd run dev
```

Open [http://localhost:3000](http://localhost:3000). Check the backend at [http://127.0.0.1:8000/health](http://127.0.0.1:8000/health).

If the backend runs elsewhere, create `.env.development.local` in the `frontend` directory with its address, for example:

```dotenv
NEXT_PUBLIC_API_BASE=http://127.0.0.1:8000
```

Set the backend origin without an `/api` prefix or a trailing slash. Restart `npm.cmd run dev` after changing it. On Linux and macOS, use `npm` instead of `npm.cmd`.

The backend allows frontend origins through `CORS_ORIGINS`, which defaults to `http://localhost:3000,http://127.0.0.1:3000`. For a different frontend address, set this variable in the backend environment before starting it, then restart the backend. HTTP CORS allows `GET`, `POST`, and the `Content-Type` header; the WebSocket checks `Origin` against the same list.

## Running with Docker

Run from the repository root:

```powershell
docker compose up --build
```

The application is available at [http://localhost:3000](http://localhost:3000). nginx serves static files, and the browser connects directly to the backend API and WebSocket. Compose publishes the backend as `127.0.0.1:8000:8000`.

Compose passes the build argument `NEXT_PUBLIC_API_BASE=${NEXT_PUBLIC_API_BASE:-http://127.0.0.1:8000}` when building the frontend. To use a different address, set `NEXT_PUBLIC_API_BASE` in the Compose command environment or the root `.env`, then run `docker compose up --build` again. `frontend/.env.development.local` applies only to the development server.

The public `NEXT_PUBLIC_API_BASE` value is embedded in the browser JavaScript during `next build`; changing the production address requires a new build. The address must be reachable from the user's browser: `localhost` and `127.0.0.1` are for local use; do not use the Docker service name `backend` here. When the frontend uses HTTPS, the backend must use HTTPS and the WebSocket must use WSS.

For access from another device, also set `BACKEND_BIND_HOST=0.0.0.0`, a publicly reachable `NEXT_PUBLIC_API_BASE`, and the frontend origin in `CORS_ORIGINS` in the Compose environment or root `.env`. CI passes these values from GitHub repository variables with the same names; without them, it uses the local defaults.

## Voice input

Click the microphone next to the text field and allow microphone access. Voice dictation uses English (`en-US`) only. There is no language selector. Recognized speech is added to the text as you speak.

To finish, click the stop button that replaces the microphone. Once transcription finishes, you can edit the text and submit it with `Send`. Typing manually or selecting a preset prompt stops dictation. Sending is disabled while transcription is in progress so the final result is preserved. The prompt limit remains 2000 characters.

This feature requires HTTPS or localhost and a browser that supports [SpeechRecognition](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition). If the API is unavailable or the browser denies microphone access, the interface displays a message and text input remains available. Some browsers, such as Chrome, may send audio to their online speech recognition service. Clicking `Send` submits the resulting text to the backend as a normal prompt.

## Current backend scope

After creating a run, the backend sends only the `run_started` event. Planning, skill generation, rule evaluation, summaries, and voice summaries are not yet implemented. The run remains active; another request returns `RUN_ALREADY_ACTIVE`. Until the pipeline is complete, restart the backend to start a new run.

The [contract](../Docs/kontrakt.md) describes the API format and intended event behavior.
