# WP-B/J — sandbox a infrastruktura

Přečten celý BACKEND_SPEC, kontrakt v1, PLAN a sdílené typy. Vlastník: subagent sandbox_infra. Produkční stack `hackathon-*` na portu 3000 se nemění.

Hotovo:
- `sandbox/server.py`: validace protokolu, streamovaný limit těla 8 MB, vstup 5 MB, výstup 10 MB, dvě souběžné úlohy, nový podproces a dočasná složka na každou úlohu, setrlimit, killpg po timeoutu, úklid v finally.
- `sandbox/runner.py`: import/open guards, bezpečné veřejné pohledy stdlib modulů, blokování introspekce a transitive I/O audit hookem, zahřátí datetime, testy v pořadí definice, JSON bez NaN, zahazování stdout/stderr bez růstu bufferu.
- HTTP SandboxClient a testovací InProcessSandbox mají zmrazený protokol; chyby dovednosti jsou výsledky, chyby transportu jsou SandboxError.
- Bezpečnostní testy serveru/runneru a fake HTTP transportu: 63 passed / 1.55 s (Python 3.12 v `frankenstein-dev-tests`).
- Docker images neobsahují backendové testy. Oba procesy jsou neprivilegované, oba mají healthcheck. WebSocket ping 20 s podporuje lokálně ověřený uvicorn 0.39.0.
- Compose: frontend blok beze změny, backend read-only a pojmenovaný /data svazek, sandbox pouze interní síť a tmpfs noexec/nosuid. Demo override nahrazuje svazek dle cílové cesty /data, bez LLM/hlasových klíčů.
- test.sh pro Python 3.12 a smoke_e2e.py pro skutečné A → approve → B → approve přes HTTP i WebSocket.
- CI doplněno o sandbox závislosti a izolovanou integrační úlohu; existující deploy, health i bezpečnostní kontroly zachované. Deploy navíc čeká na integrační úlohu.

Compose konfigurace ověřena bez výpisu tajemství, oba image sestavené pod samostatným projektem `frankenstein-validation`. Izolovaný integrační smoke spouští koordinátor po dokončení Gatekeeper API/pipeline. Rozšířená modulová sada včetně architektury, skutečného souběhu maximálně dvou podprocesů a úklidu po všech stavech: 75 passed / 1.92 s.

WP-I: `orchestrator/voice.py` + transportové testy hotové (13 passed / 0.10 s). API ověřeno proti https://elevenlabs.io/docs/api-reference/text-to-speech/convert?explorer=true. Volitelný VoiceService s limity 30 s / 5 MB, žádné logování klíče, podpora voice_ready po koncovém stavu. Bez skutečného API volání.

Při revizi doplněn auditní zákaz dynamického exec/compile z rámců dovednosti, včetně volání přes standardní knihovnu. Do .gitignore přidána výjimka pro commitnuté datové logy.

READ-ONLY revize backendu, sandboxu a CI je v `SECURITY_REVIEW.md`. Nálezy byly předány koordinátorovi/vlastníkům; stav oprav se udržuje přímo v dokumentu. Předání nesmí být považováno za opravu otevřeného nálezu.

2026-10-08: po výpadku externí konektivity Docker VM sestaveny oba image `frankenstein-validation-backend` a `frankenstein-validation-sandbox` offline z hostitelem stažených wheelů. Dočasný kontext: `/tmp/frankenstein-offline-build-9fx69afw`, ukazatel `/tmp/frankenstein-offline-build-path`. Repo Dockerfiles zůstávají standardní; změna je pouze build-time `pip --no-index` v dočasné kopii. Izolovaný validační stack vlastní a spouští koordinátor na portu 13000. Před finální integrací je možné překopírovat aktuální produkční zdroje do tohoto kontextu a levně znovu sestavit image bez sítě; samotný restart/Compose smoke koordinuje root. Existující `hackathon-*` kontejnery ani port 3000 se nemění.

Finální předání: REPORT.md a ../backend-handoff.md vytvořené včetně startup/demo/testů/ručního LLM a hlasu. test.sh podporuje volitelné `BACKEND_TEST_IMAGE` a `BACKEND_TEST_SKIP_INSTALL=1`; výchozí čerstvá instalace zachovaná. Lokální snapshot dev kontejneru `frankenstein-tests:local` připraven bez bind mount obsahu, cílená sada přes skutečný skript 89 passed / 2.17 s. Koordinátor tímto skriptem ověřil celou sadu 505 passed / 18.01 s před poslední regresí custom preflight. CI předává vedle zachovaného APIFY_TOKEN také LLM_API_KEY z GitHub secrets, bez deploymentu. Backend image obsahuje dvě manuální read-only/probe utility. Oba offline image obnoveny z finálních zdrojů; po poslední custom preflight opravě opět backend build exit 0 (config c9b6fd3adfc2…). Root řídí nový čistý projekt `frankenstein-final` a smoke s `--idle-before-run 185`; jeho konečné výsledky doplní do REPORT/handoff.

Pokračování:
`docker exec -w /workspace/backend frankenstein-dev-tests python -m pytest ../sandbox/tests tests/unit/test_sandbox_client.py -q`

Bezpečnostní rozhodnutí: runner navíc odmítá soukromé Python atributy (ne pouze dunder), aby kód přes stdlib implementační detaily nezískal sys/os ani trusted runner. `_line` a `_lines` v JSON slovnících tím nejsou omezeny. Klasifikace sandboxu zůstává obranou do hloubky; hranicí procesu je neprivilegovaný kontejner bez sítě a dat.
