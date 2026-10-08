# Předání backendu pro frontend

Backend implementuje existující [kontrakt v1](kontrakt.md). Frontend, jeho mock ani kontrakt nebyly upraveny. Existující produkční stack `hackathon-*` zůstává beze změny; finální validace používá samostatný projekt na portu 13001.

## Připojení a nginx

Současný `frontend/nginx.conf` odřezává prefix `/api/`: `proxy_pass http://backend:8000/`. WebSocket `/api/ws` směřuje na `http://backend:8000/ws` a již má `proxy_http_version 1.1`, hlavičky `Upgrade`/`Connection` a timeouty 3600 s. Backend nabízí totožné routery s `/api` i bez prefixu, proto funguje také s proxy, která prefix zachová. Zdrojová nginx konfigurace nevyžaduje opravu.

Při lokální validaci měl cachovaný frontend image starší konfiguraci bez API proxy. Použila se nezměněná aktuální konfigurace repozitáře připojená read-only do izolovaného proxy kontejneru. Při autorizovaném budoucím nasazení kolega znovu sestaví frontend image z aktuálního zdroje.

`frontend/src/lib/api.ts` používá prázdné `NEXT_PUBLIC_API_BASE` pro relativní adresy stejného originu. Pro Compose ponechte proměnnou nenastavenou nebo prázdnou. HTTP pak volá `/api/...`, WS používá podle stránky `ws:`/`wss:` a `/api/ws`. Frontend nepotřebuje žádný LLM nebo ElevenLabs klíč. Přepnutí na skutečný backend je změna spuštěné služby, nikoli změna UI.

## Chování důležité pro UI

- `GET /api/health` vrací `{"status":"ok","contract_version":1}`. HTTP chyby mají `{error:{code,message}}` s českým textem.
- Nejvýš jeden běh může být `running` nebo `awaiting_approval`; nový požadavek během něj vrací 409 `RUN_ALREADY_ACTIVE`.
- Nejprve připojit WS, potom načíst historii. HTTP `events?after_seq=N` i WS poskytují stejné uložené události; klient deduplikuje podle `(run_id, seq)` a chybějící rozsah dotáhne přes HTTP.
- Historie má nejvýš 50 běhů a přežívá pouze v paměti. Po restartu jsou staré run/audio endpointy 404, schválené dovednosti zůstávají v `/api/skills`.
- Povýšení nastává až po schválení; před ním se nový kandidát v `/api/skills` nenabízí. Dvojklik i současné approve/reject mají jediné vítězné rozhodnutí.
- Mock vrací `tokens_total: null`; UI má zobrazit neznámou hodnotu. `precision` může být `null`, například při první neúspěšné hranici A.
- D jmenuje chybějící dovednost `failure_ratio_window`, která se nikdy nenainstaluje. Typy a pořadí událostí odpovídají kontraktu. A/B používají skutečně schválený `distinct_count_window`.
- Webový scénář E postaví `nginx_access_parser` a použije existující `count_window`. Mock vybírá scénář podle textu nebo `MOCK_SCENARIO`; přesný A → B smoke potřebuje čistý samostatný registr.
- Hlas je volitelný. `voice_ready` má fázi `approval` a může přijít také po `rule_approved`; klient přijme tuto událost i pro ukončený běh. `audio_url` je relativní `/api/runs/{run_id}/audio`; MIME je `audio/mpeg`. Chyba hlasu nevytváří failure událost.

Žádná změna veřejného kontraktu se nenavrhuje. Policy kódy zůstávají otevřeným seznamem a názvy dovedností se vykreslují z dat.

## Lokální kontrola

Podrobný startup, izolované demo a ruční LLM/hlas jsou v [REPORT.md](backend/REPORT.md). Na čistém testovacím projektu:

```sh
curl --fail http://localhost:13000/api/health
python3.12 backend/scripts/smoke_e2e.py --base http://localhost:13000 --idle-before-run 185
```

CLI Python potřebuje závislosti z `backend/requirements.txt`; report obsahuje postup s venv. Smoke ověřuje i více než tři minuty nečinného WS, skutečné HTTP i WS přes nginx, A → approve → B → approve, statistiky a instalaci/reuse. Parametr čekání lze vynechat pro rychlé ověření.

Finální výsledek izolované validace: **prošel `frankenstein-final` na portu 13001, včetně 185 s nečinného WebSocketu a následného A → approve → B → approve se shodnými HTTP/WS událostmi**. Celá sada má 506 zelených testů. Automatické testy nepoužívají živého poskytovatele a skutečný hlas čeká na ruční ověření s uživatelovými klíči.
