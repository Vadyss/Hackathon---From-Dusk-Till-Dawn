# LLM relay pro Apify Standby

Actor v `apify/llm-relay/` poskytuje `POST /v1/chat/completions` a předává tělo
požadavku na `https://openrouter.apify.actor/api/v1/chat/completions`. Používá
`Authorization: Bearer ...` s tokenem `APIFY_TOKEN` z prostředí Actoru; ten Apify
doplňuje při běhu jako token uživatele, který běh spustil.
[Proměnné prostředí Apify](https://docs.apify.com/actors/development/programming-interface/environment-variables).

Relay zachovává HTTP status a tělo odpovědi upstreamu, odstraňuje hop-by-hop
hlavičky a čeká nejvýše 120 sekund. SSE odpovědi také zachovává, ale doručí je
až po načtení celého těla. Timeout vrací `504`, chyba spojení `502`.
Tokeny, prompty ani těla požadavků a odpovědí neloguje.

## Ruční nasazení

Pro instalaci přes npm potřebujete Node.js 22 nebo novější.
[Instalace Apify CLI](https://docs.apify.com/cli/docs/installation).
Z kořene tohoto repozitáře spusťte:

```sh
npm install -g apify-cli
apify --version
apify login
cd "apify/llm-relay"
apify push
```

Přihlášení je interaktivní. `apify push` nahraje a sestaví Actor `llm-relay`;
`"usesStandbyMode": true` v `.actor/actor.json` zároveň zapne Standby.
[CLI příkazy](https://docs.apify.com/cli/docs/reference),
[zapnutí Standby](https://docs.apify.com/actors/development/programming-interface/standby).

Server naslouchá na `0.0.0.0` a portu `ACTOR_WEB_SERVER_PORT` poskytnutém
platformou, obvykle `4321`. `GET /health` i `GET /` vracejí `{"status":"ok"}`;
kořen obsluhuje také readiness probe s hlavičkou
`x-apify-container-server-readiness-probe`.
[Web server](https://docs.apify.com/actors/development/programming-interface/container-web-server),
[readiness probe](https://docs.apify.com/actors/development/programming-interface/standby).
V Python SDK se port jmenuje `web_server_port`; starý `standby_port` byl odstraněn.
[Migrace SDK v4](https://docs.apify.com/sdk/python/docs/upgrading/upgrading-to-v4).

## Lokální spuštění

Ve složce `apify/llm-relay/`, s již exportovaným `APIFY_TOKEN` a běžícím Dockerem:

```sh
docker build -t llm-relay-local .
docker run --rm -p 127.0.0.1:4321:4321 \
  -e APIFY_TOKEN -e ACTOR_WEB_SERVER_PORT=4321 llm-relay-local
```

`http://127.0.0.1:4321/health` ověří připravenost bez LLM volání.

## Jeden test completion

Po úspěšném buildu otevřete Actor v Apify Console → **Endpoints** a zkopírujte
jeho skutečnou **Standby URL**. Dosaďte ji do `RELAY_URL`; hostname neodvozujte
z názvu účtu ani nepoužívejte dočasnou URL jednoho běhu.
[Standby URL](https://docs.apify.com/actors/development/programming-interface/standby).

V shellu musí být už exportovaný váš `APIFY_TOKEN`. Platforma ověřuje volajícího
pomocí Bearer hlavičky; relay pro upstream použije token ze svého prostředí.
[Autentizace Standby](https://docs.apify.com/actors/running/standby).
Model `openrouter/auto` případně nahraďte modelem dostupným vašemu účtu.

```sh
RELAY_URL='SEM_VLOZTE_SKUTECNOU_STANDBY_URL_Z_ENDPOINTS'
curl --fail-with-body --max-time 300 \
  -H "Authorization: Bearer ${APIFY_TOKEN:?APIFY_TOKEN musi byt exportovany}" \
  -H 'Content-Type: application/json' \
  --data '{"model":"openrouter/auto","messages":[{"role":"user","content":"Odpověz pouze OK."}],"max_tokens":16,"stream":false}' \
  "${RELAY_URL%/}/v1/chat/completions"
```

Úspěšná odpověď je completion JSON z upstreamu. Příkazy jsou připravené pro ruční
provedení; během této změny neproběhlo cloudové nasazení ani skutečné LLM volání.

Lokální ověření: 36 testů prošlo v Pythonu 3.12; standardní Docker build také
prošel. Server ze sestaveného image odpověděl na health i readiness probe jako
neprivilegovaný uživatel bez sítě; při požadavcích s testovacím tokenem a promptem
zůstal stdout/stderr prázdný. Testy nepoužívají skutečný upstream.
