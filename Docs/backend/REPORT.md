# Backend Frankenstein — závěrečný report

Aktualizováno: 2026-10-09. Zdroj požadavků: celý dodaný `BACKEND_SPEC.md`; veřejné rozhraní odpovídá [kontraktu v1](../kontrakt.md). Architektura: [ARCHITECTURE.md](ARCHITECTURE.md), pokračování: [PROGRESS.md](PROGRESS.md), nálezy a opravy: [SECURITY_REVIEW.md](SECURITY_REVIEW.md).

## Výsledek

Backend přijímá český požadavek, sestaví plán, postaví chybějící Python dovednost, zkontroluje její kód/manifest/testy a měří JSON recept nad skutečnými daty. Ladění může návrh opravit; nezávislá validace se provede právě jednou. Schválením analytika se ověřené dovednosti a pravidlo uloží do trvalého registru. Další běh používá dovednosti i dřívější pravidlo.

LLM navrhuje, deterministický Gatekeeper rozhoduje a zapisuje. Backend kód dovedností nikdy neimportuje ani neprovádí; každá úloha běží v novém omezeném procesu sandboxu. HTTP i WebSocket vracejí stejné uložené události s rostoucím `seq`. Součástí jsou mock scénáře A–F, SSH i webová data, auditní řetěz, karanténa změněných artefaktů, poučení, volitelný hlas a klient skutečného poskytovatele.

Frontend, jeho mock, nginx, kontrakt, Gatekeeper, politika a data nebyly při živém ověřování upraveny. Výslovně požadovaný místní stack `hackathon` běží bez demo overridu na portu 3000. Žádná produkční data ani svazky se nemažou; cloudový deployment, push a merge se neprovedly. Podrobné živé důkazy: [LLM_LIVE_TEST.md](LLM_LIVE_TEST.md).

## Spuštění s poskytovatelem LLM

Příkazy spouštějte z kořene repozitáře. Potřebujete Docker Compose v2; pro lokální Python CLI Python 3.12. Nový projekt má vlastní datový svazek. Tento postup je určen pro lokální prostředí s volným portem 3000.

```sh
[ -f .env ] || cp .env.example .env
```

V editoru doplňte `.env`: `LLM_PROVIDER=apify` a `APIFY_TOKEN`, případně `LLM_API_KEY`. Pro jiného kompatibilního poskytovatele nastavte `LLM_PROVIDER=openai_compatible`, `LLM_API_KEY`, `LLM_BASE_URL` a `LLM_MODEL`. URL má končit na API prefix, typicky `/v1`, nikoli `/chat/completions`. Compose načte `.env`; hodnoty se nepředávají do sandboxu.

```sh
docker compose -p frankenstein-local -f docker-compose.yml up --build -d --wait
curl --fail http://localhost:3000/api/health
```

Očekávaná odpověď je `{"status":"ok","contract_version":1}`. Aplikace je na `http://localhost:3000`. Pokud port používá existující stack, použijte izolované demo níže. Produkční deployment vyžaduje samostatný souhlas; výše uvedené příkazy nebyly proti produkci spuštěny.

## Izolované demo na portu 13000

Demo používá skutečný Gatekeeper, data, testy a sandbox, ale deterministický mock LLM. API a hlasové klíče override výslovně vypíná. Zvolte dosud nepoužitý název projektu, chcete-li čistý registr pro přesný smoke A → B; existující svazky nemažte.

```sh
docker compose -p frankenstein-demo -f docker-compose.yml -f docker-compose.demo.yml up --build -d --wait backend sandbox
docker build -t frankenstein-demo-frontend ./frontend
docker run -d --name frankenstein-demo-proxy \
  --network frankenstein-demo_default \
  -p 127.0.0.1:13000:8080 \
  --mount "type=bind,source=$(pwd)/frontend/nginx.conf,target=/etc/nginx/conf.d/default.conf,readonly" \
  frankenstein-demo-frontend
curl --fail http://localhost:13000/api/health
```

Připojení existující `frontend/nginx.conf` read-only zaručí aktuální proxy konfiguraci i při použití staršího lokálního frontend image. Zdrojové soubory frontendu se tím nemění. Backend není publikován přímo a sandbox má pouze interní síť. Pokud 13000 už používá validační projekt, zvolte jiný volný port také v dalších příkazech.

Připravte CLI prostředí a spusťte skutečný HTTP/WS smoke:

```sh
python3.12 -m venv /tmp/frankenstein-smoke-venv
/tmp/frankenstein-smoke-venv/bin/python -m pip install -r backend/requirements.txt
/tmp/frankenstein-smoke-venv/bin/python backend/scripts/smoke_e2e.py --base http://localhost:13000 --idle-before-run 185
```

Smoke otevře WS, udrží spojení nečinné 185 s s průběžným ping/pong ověřením, provede A, schválí kandidáta, provede B s opětovným použitím a schválí pravidlo. Kontroluje úplnou shodu událostí HTTP/WS, pořadí, statistiky, `tokens_total: null` a instalaci do registru. Parametr `--idle-before-run` lze vynechat pro rychlé ověření. Už schválený `distinct_count_window` znamená, že registr není čistý; použijte nový testovací projekt.

V UI lze ověřit další scénáře: `inject` → zamítnutí výjimky pro IP a opravený recept; `fail` → tři neúspěšné pokusy kovárny; `web`/`skenování adresářů` → nový nginx parser; `vypni politiku` → odmítnutí požadavku. A/B/C/E čekají na analytika, D/F končí chybou. `MOCK_SCENARIO` nechte prázdné pro výběr podle textu.

## Testy

Standardní skript vytvoří čistý kontejner Python 3.12, nainstaluje připnuté závislosti a provede backendové i sandboxové testy:

```sh
backend/scripts/test.sh -q
```

Volitelně lze použít připravený lokální image bez další instalace:

```sh
BACKEND_TEST_IMAGE=frankenstein-tests:local BACKEND_TEST_SKIP_INSTALL=1 backend/scripts/test.sh -q
```

`BACKEND_TEST_IMAGE` mění jen image testovacího kontejneru. `BACKEND_TEST_SKIP_INSTALL` přijímá `0` nebo `1`; výchozí `0` zachovává čerstvou instalaci. Image `frankenstein-tests:local` je v této pracovní relaci snapshot vývojového kontejneru s nainstalovanými závislostmi; workspace bind mount není součástí image. Nejde o distribuovaný či produkční image. Pro existující vývojový kontejner:

```sh
docker exec -w /workspace/backend frankenstein-dev-tests python -m pytest -q
```

| Ověření | Finální výsledek |
|---|---|
| Celá sada Python 3.12 po poslední integraci | **613 passed / 20.47 s; Docker --network none, jeden dependency warning, žádný skip/xfail.** |
| Nezměněný relay, falešný transport | **36 passed / 0.17 s.** |
| Finální backend/sandbox image build | **Standardní Dockerfiles, online build exit 0; poslední zdroje. Celý místní stack up -d --build a health přes 3000 prošly.** |
| Finální čistý Compose smoke A → approve → B → approve přes nginx | **Prošel: `frankenstein-final`, port 13001; 185 s nečinného WS s ping/pong, poté shodné HTTP/WS události A/B, instalace a opětovné použití. Auditní řetěz po schválení platný.** |
| Sandbox bez tajemství/internetu, read-only | **Finální kontejner: UID ≠ 0; API klíče chybí; internet a zápis do /app blokovány; interní síť, drop ALL, no-new-privileges ověřeno.** |
| GitHub CI na vzdáleném runneru | **Nespouštěno bez push; doplněné joby čekají na CI.** |
| Skutečný poskytovatel LLM / ElevenLabs | **Apify relay ověřen skutečnými A/B/C/E běhy; každý scénář dvě po sobě jdoucí schválení. ElevenLabs nevoláno.** |

Průběžná modulová ověření jsou v PROGRESS dokumentech. Automatické testy používají fake HTTP transporty, mock LLM, dočasná data a skutečný omezený podproces runneru. Externí LLM/hlasové volání není součástí testů.

## Konfigurace

`.env.example` obsahuje pouze názvy. Prázdné hodnoty s defaultem používají výchozí hodnotu; explicitně prázdné klíče, hlasové ID, CORS a scénář funkci vypínají. Konfigurace je centralizovaná v `orchestrator/config.py`.

| Proměnné | Výchozí hodnota / význam |
|---|---|
| `LLM_PROVIDER` | `apify`; také `openai_compatible` nebo `mock` |
| `APIFY_TOKEN`, `LLM_API_KEY` | Prázdné; Apify přednostně používá APIFY_TOKEN, jinak LLM_API_KEY |
| `LLM_BASE_URL`, `LLM_MODEL` | `https://piquant-peacoat--llm-relay.apify.actor/v1`, `anthropic/claude-sonnet-5.5` |
| `LLM_MODEL_PLANNER`, `LLM_MODEL_FORGE`, `LLM_MODEL_RULE`, `LLM_MODEL_SUMMARY` | Dědí `LLM_MODEL` |
| `LLM_MODEL_EXAMINER`, `LLM_MODEL_FALLBACK` | `deepseek/deepseek-v4.1-flash`; fallback zůstane aktivní do konce běhu po dvou primárních provider chybách |
| `LLM_REASONING_EFFORT` | Compose `low`, standalone prázdné = provider default; při nastavení reasoning zůstává enabled=true |
| `LLM_TIMEOUT_S`, `LLM_MAX_TOKENS`, `LLM_MAX_TOKENS_CAP` | 180 s, 16000 / lokální strop 32000; počátečních 8000 nestačilo pro forge |
| `LLM_MAX_RETRIES`, `LLM_MAX_CALLS_PER_RUN` | Nejvýš 2 retry, nejvýš 25 volání; retry i JSON oprava se počítají |
| `MOCK_SCENARIO`, `MOCK_DELAY_MS` | Prázdný scénář = výběr podle textu; 400 ms, demo 600 ms |
| `SANDBOX_URL`, `SANDBOX_TIMEOUT_S` | Compose `http://sandbox:8000`, klient 30 s; politika test 10 s / run 15 s |
| `DATA_DIR` | Compose `/data` na svazku; běžný a demo svazek oddělené |
| `DATASETS_DIR`, `POLICY_PATH`, `SEED_SKILLS_DIR` | V image `/app/datasets`, `/app/policy/policy.yaml`, `/app/seed_skills` |
| `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID`, `ELEVENLABS_MODEL_ID` | Klíč/ID prázdné; model `eleven_multilingual_v2` |
| `EXAMINER_ENABLED` | `false`; pouze volitelný P3 režim |
| `RUN_TIMEOUT_S`, `CORS_ORIGINS`, `LOG_LEVEL` | 1500 s; prázdné CORS = stejný origin; `INFO` |

Politika stanovuje minimální precision/recall 0.9, tři pokusy plánu/kovárny/pravidla, jedinou validaci, povolené importy a DSL operátory. Změna `.env` nesmí tato omezení obejít. Politika se za běhu nezapisuje.

## Milníky a odchylky

| Milník | Stav |
|---|---|
| M0 | Hotovo: průzkum, PLAN před kódem, zmrazené typy a protokoly |
| M1 | Hotovo: HTTP, české chyby, 50 běhů, atomická rozhodnutí, uložené události a WS |
| M2 | Hotovo: sandbox, statické kontroly, manifest/DSL, pevná data, seedy, skryté testy a metriky |
| M3 | Hotovo: mock pipeline a sekvence A–D/F, schválení, opětovné použití |
| M4 | Hotovo: Apify/kompatibilní API, retry, rozpočet, role/prompty, ruční smoke |
| M5 | Hotovo: registr/audit/poučení/restart, hardening, CI, revize a opravy |
| M6 | Hlas, web E a volitelný nezávislý Examiner hotové; pokryté finální sadou. Samoopravy jsou odložené P3. |

Examiner je výchozí vypnutý. S `EXAMINER_ENABLED=true` a skutečným poskytovatelem může zpracovat vlastní typ SSH útoku; dostává pouze popis útoku a logového formátu. Vrátný kontroluje generátor, spouští jej v sandboxu s dvěma soukromými seedy, ověřuje parseability/štítky/disjunktní identity a přidává pevný běžný provoz. Privátní data existují jen pro daný běh; nevznikají nové typy veřejných událostí. Selhání přípravy vede k `REQUEST_REJECTED`. Mock scénáře A–F zůstávají pevné.

- `SPEC.md` znamená přiložený `BACKEND_SPEC.md`; zachovává se existující velikost písmen `Docs/`.
- Scénář D používá `failure_ratio_window`, aby nekolidoval s dovedností schválenou v A. Kontrakt ani pořadí událostí se nemění.
- Sandbox odmítá i soukromé atributy Pythonu, nikoli pouze dunder; navíc hlídá transitive I/O a dynamické exec/compile audit hookem. Jde o zpřísnění obrany.
- Kontejnery se ověřují na oddělených projektech/portech 13000 a 13001, protože 3000 patří existujícímu stacku.
- Po původním úspěšném standardním buildu ztratil Docker VM egress. Validační image se později sestavily z hostem stažených wheelů v dočasném kontextu mimo repo, s `pip --no-index`. Repo Dockerfiles a runtime izolace zůstávají standardní. Závěrečná tabulka rozlišuje tento režim od online buildu.
- CI zachovalo původní deployment a health/security kroky. Přidává izolovanou integraci, čekání deploy jobu také na ni a `LLM_API_KEY` z GitHub secrets vedle zachovaného `APIFY_TOKEN`. Samotný deployment se neprovedl.
- Samoopravy (`degraded`, automatická verze + 1) nejsou implementovány; SPEC §19 je označuje jako volitelný P3 krok. Selhání dovednosti se bezpečně vyhodnotí a audituje.

Další rozhodnutí: [OPEN_QUESTIONS.md](OPEN_QUESTIONS.md). Předání frontendu: [backend-handoff.md](../backend-handoff.md).

## Ruční ověření skutečného LLM a hlasu

Živé LLM již prošlo podle [LLM_LIVE_TEST.md](LLM_LIVE_TEST.md). Následující příkazy umožní opakování; hlas zůstává volitelným ručním krokem. Demo override klíče vypíná.

Po nastavení `.env` a spuštění `frankenstein-local` proveďte jednoduchý provider probe:

```sh
docker compose -p frankenstein-local -f docker-compose.yml exec -T backend python scripts/llm_smoke.py
```

Skript žádá jen JSON potvrzení spojení; nenačítá data ani neprovádí vygenerovaný kód. Úspěch vypíše model a tokeny. Poté v UI zadejte password spraying, sledujte skutečné pokusy/metriky a schvalte až úspěšně ověřený výsledek. Chyby neobsahují odpověď poskytovatele ani klíče. Synchronní `llm.ask()` z původního IDE rozhraní zůstalo kompatibilní.

Pro hlas přidejte do `.env` `ELEVENLABS_API_KEY` a `ELEVENLABS_VOICE_ID`, případně model. Znovu vytvořte pouze svůj lokální backend:

```sh
docker compose -p frankenstein-local -f docker-compose.yml up -d --no-deps backend
```

Po shrnutí očekávejte `voice_ready` s `audio_url`; událost může přijít také po schválení. Ověřte, že dané URL vrací `Content-Type: audio/mpeg`, a poslechněte výsledek. Bez audia endpoint vrátí 404 `AUDIO_NOT_FOUND`; chyba TTS nemění stav běhu. Limity jsou 30 s / 5 MB. Protokol byl ověřen proti [oficiální dokumentaci ElevenLabs](https://elevenlabs.io/docs/api-reference/text-to-speech/convert?explorer=true), skutečný TTS request nebyl proveden.

Audit lze ověřit bez zápisu:

```sh
docker compose -p frankenstein-local -f docker-compose.yml exec -T backend python scripts/verify_audit.py /data/audit.jsonl
```

## Omezení a první lidská kontrola

Přihlašování není součástí kontraktu v1; aplikace je určená pro důvěryhodný lokální přístup. Orchestrátor a Gatekeeper sdílejí backendový proces, hranice autority je modulová a hlídaná testy. Syntetická data poskytují reprodukovatelné demo, nikoli důkaz účinnosti na produkčních logách. Běhy, události a audio jsou v paměti; restart je odstraní. Registr/pravidla/audit/poučení ve svazku přetrvají. Pythonové guardy jsou obrana do hloubky nad izolací procesu a kontejneru.

První lidská kontrola: `gatekeeper/api.py`, povýšení v `registry.py`, sandbox runner/server, `policy/policy.yaml` a [bezpečnostní revize](SECURITY_REVIEW.md). Živé LLM už je ověřené; hlas zůstává volitelný. Místní stack byl spuštěn dle explicitního požadavku, cloudový deployment se neprováděl.

## Živý relay a merge

Ověřená konfigurace je 16000 tokenů, lokální cap 32000, reasoning effort low, klient 180 s a běh 1500 s. Na čistých svazcích A4/A5 a E4/E5 prošly dvě po sobě jdoucí schválení, B1/B2 znovu použily distinct_count_window z těchto A běhů; C prošlo s nezměněnou injection v SSH vzorku. Všechny úspěšné sady mají precision=recall=1.0. Po schválení obou A/B dvojic auditní řetěz platný. Přesné záložní GET events: [run_a.json](live_runs/run_a.json), [run_b.json](live_runs/run_b.json).

Příkazy pro Adama (nebyly spuštěny):

```sh
git push -u origin feat/backend-toolsmith
gh pr create --base main --head feat/backend-toolsmith --title "Backend: live LLM through Apify relay" --body-file Docs/backend/PR_DESCRIPTION.md
```
