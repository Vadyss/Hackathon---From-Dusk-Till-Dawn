# Revize bezpečnosti, správnosti a provozu backendu

Datum: 2026-10-08. Revize probíhá nad pracovním stromem ve větvi `feat/backend-toolsmith`, při průběžných opravách koordinátora a vlastníků modulů. Čten celý BACKEND_SPEC, kontrakt v1 i PLAN. Rozsah: backend, sandbox, Docker/CI a hranice důvěry. Produkční kontejnery, frontend a kontrakt se neměnily. Revize nevyvíjela exploity ani proof of concept.

Závěr k aktuálnímu stavu: hlavní invariant je implementovaný. Orchestrátor navrhuje, vrátný rozhoduje a zapisuje, veškerý kód dovedností se provádí v novém omezeném procesu sandboxu. Schválení kontroluje recept i přesné artefakty a metriky, které vrátný nezávisle ověřil. Níže uvedené nálezy byly předány vlastníkům; konečný stav musí potvrdit poslední integrační sada a izolovaný Compose smoke.

## Ověřené kontroly

| Oblast | Zjištěná implementace | Důkaz / test |
|---|---|---|
| Hranice autority | Produkční backend neimportuje kód dovedností, `tests`, importlib ani subprocess; orchestrátor importuje pouze veřejné Gatekeeper API a typy. Vrátný nemá LLM závislosti. | `tests/architecture/test_boundaries.py`; kontrola zdrojáků. |
| Politika | Frozen modely s tuple kolekcemi, kontrola minimálních zákazů; načtení YAML a SHA-256. Žádná cesta k zápisu politiky. | `policy.py`, architektonické testy. |
| Statické kontroly | Limity bajtů a AST, omezení importů, dunder jmen, volání, module/class body, dekorátorů a spouštěných výrazů v definicích. | `test_static_analysis.py`, legitimní seed a mock kód. |
| Recept | Neznámá pole/typy a operátory se odmítají, parametry mají schéma; výjimky pro identity a IP literály se zamítají. | `test_recipe.py`, `test_filter.py`. Kontrola malformovaných JSON typů neodhalila neošetřenou výjimku. |
| Sandbox proces | Nový izolovaný Python s prostředím pouze PATH; wall/CPU, adresní prostor 256 MB, soubor 10 MB, 64 FD, bez core dump; nejvýš dvě úlohy; killpg po timeoutu. | `sandbox/tests/test_sandbox.py` včetně skutečného měření limitů a souběhu. |
| Sandbox Python | Import/open hook, veřejné pohledy stdlib modulů, zákaz soukromých atributů, auditní zákaz I/O a dynamického exec/compile ze skill rámců. Stdout/stderr se zahazují bez růstu bufferu. | Runtime guard testy, standardní datetime/collections/json, úspěšný skutečný runner ve všech scénářích testů. |
| Sandbox kontejnery | Pouze interní síť, bez portů/dat/politiky/tajemství/socketu Dockeru; read-only, tmpfs noexec/nosuid, UID10001, cap_drop ALL, no-new-privileges, limity CPU/RAM/PIDs. | Compose config ověřen bez výpisu hodnot env; architektonické testy; původní CI security kroky zachované. |
| Oddělení dat | Obě pevné sady mají ověřené SHA-256, disjunktní identity, ověřené štítky. Katalog neobsahuje cesty. LLM vzorek vzniká pouze z tuning. | `test_datasets.py`, `datasets.py`. |
| Metriky | TP/FN počítané podle nezávislých štítků, FP jen na běžném provozu; jiný typ útoku je neutrální. Rozhoduje vrátný. | `test_evaluator.py`; M3 integrační scénáře koordinátora. |
| Povýšení | Kanonický SHA receptu, úspěšné tuning/validation, přesný seznam kandidátů, SHA kódu/manifestu/testů a otisky při každém čtení. | `test_registry.py`, `integration/test_gatekeeper_api.py`. |
| Zápisy | Registry používá RLock, stage soubory, fsync a os.replace; rollback při chybách transakce. Audit a poučení mají vlastní zámky a fsync. | Registry/audit testy; revize implementace. |
| Historie a souběh | Nejvýš 50 běhů, jediný aktivní běh, schválení/zamítnutí atomicky obsadí rozhodnutí. Události se validují a uloží před broadcastem. | API, events, decisions a WS testy. |
| Pomalý WebSocket | Každý klient vlastní omezenou frontu a sender; neblokující broadcast, timeout 5 s; ping 20 s v ověřeném uvicorn CLI. | `test_ws.py`; reálný smoke ověřuje shodu HTTP a WS. |
| Tajemství a externí služby | LLM omezen retry/rozpočtem, obecné chyby a redakce logů; sandbox request nemá klíče. Hlas je volitelný, 30 s/5 MB, bez logování klíče/remote body. | `test_llm.py`, `test_voice.py`, SandboxClient fake HTTP testy. |
| Restart | Registr/rules/audit/lessons na svazku, kandidáti se uklidí, běhy jsou v paměti, porušené artefakty jdou do karantény. | Registry a e2e restart/integrity testy. |
| Volitelný Examiner | Výchozí false; dostává pouze popis útoku a formátu, generátor podléhá AST/sandboxu, privátní dva seedy, parseability/štítky/disjunktnost a pevný běžný provoz. Privátní soubory zapisuje jen registry. | `test_examiner.py`, `test_examiner_data.py`, integrační pipeline testy; inspekce main/API. |
| CI | Původní deploy a health/security kroky zachované; další izolovaný integrační job s mockem, skutečným sandboxem a nginx. Deploy čeká také na integraci. | Revize diffu `.github/workflows/ci.yml`; žádný deploy se v této práci nespouštěl. |

## Nálezy a stav oprav

1. **Jednorázové ověření a snapshoty (opraveno koordinátorem).** Původně se jednorázový guard zapisoval až po await měření. Nyní `_validation_started` obsadí běh před await, a asynchronní hranice pracují s deepcopy receptu/kandidátů. Integrační testy pokrývají současná volání i selhání transportu bez opakování.
2. **Povolená standardní knihovna může nepřímo vykonávat Python výrazy (obrana zpřísněna).** Inspekce odhalila, že samotné jmenné/atributové kontroly nevymezují všechny helpery stdlib. Runner doplnil auditní zákaz exec/compile při přítomnosti rámce dovednosti. Načtení zdrojáku trusted runnerem probíhá mimo takový rámec; standardní testovaná rozhraní fungují. Jde o další vrstvu nad kontejnerovou izolací.
3. **Anonymní FP feedback a group shape (opraveno vlastníkem evaluatoru).** Zpětná vazba nyní používá pole ze schváleného `aggregation.params.group_by`. Runtime ověřuje přesné group klíče, existující skupinu i příslušnost `_lines` ke skupině a časovému oknu. Regrese pokrývá neplatné group klíče/hodnoty a členství v okně.
4. **Redakce auditních kódů (opraveno vlastníkem auditu).** Redakce zachovává bezpečný uppercase identifikátor `code` u přesného objektu `{code, detail}` porušení, zatímco raw kód a tajemství stále zakrývá. Regrese `test_violation_codes_retained_without_source_or_secrets` ověřuje obě vlastnosti i hashový řetěz.
5. **Prázdné hodnoty names-only `.env.example` (opraveno koordinátorem).** Compose používá `:-default`; přímé Settings.from_env nyní prázdné defaultované proměnné ignoruje. Explicitně prázdné klíče, voice_id, CORS a mock_scenario mají zachovaný vypínací význam.
6. **Commitnuté `.log` korpusy (opraveno).** Obecné `*.log` ignorovalo deterministická data. Přidána úzká výjimka `!/backend/datasets/**/*.log`.
7. **Chyba po perzistentním schválení (opraveno vlastníkem registru).** Auditní appendy jsou součástí rollback bloku. Při jejich chybě se vrátí index/historie/pravidlo i artefakty, případný dostupný audit zaznamená vrácení transakce. Úklid kandidátů probíhá až po commitnutí; jeho selhání se zaloguje a dokončí při restartu, přičemž schválení zůstává úspěšné. Regrese `test_audit_failure_rolls_back_promotion` a `test_postcommit_cleanup_failure_preserves_approval` ověřují shodu výsledku s perzistencí.
8. **Neplatný Unicode z JSON/modelu (opraveno vlastníkem vrátného).** Velikostní kontrola kódu nyní ošetřuje chybu UTF-8 a vrací `INVALID_OUTPUT`; manifesty a specifikace mají odpovídající vstupní validaci. Regrese `test_lone_surrogate_source_rejected` ověřuje řízené zamítnutí chybného kódování. Žádný takový zdroják se v revizi neprováděl.
9. **Oprava vlastního plánu před nezávislou zkouškou (opraveno koordinátorem).** Finální nezávislá revize našla, že neplatný vlastní plán mohl spotřebovat jednorázového Examinera dřív než běžnou kontrolu struktury plánu. Nyní preflight `check_plan` předchází spuštění Examinera, takže opravený druhý plán použije jedinou nezávislou zkoušku. Regrese `test_invalid_custom_plan_can_be_corrected_before_single_examination` pokrývá až schválení; koordinátor ověřil cílenou sadu 17 passed / 2.15 s. Poslední backend image byl znovu sestaven s touto opravou.

## Limity revize a provozní poznámky

- Přihlašování zůstává podle kontraktu v1 vypnuté; kdokoli s přístupem k lokální aplikaci může schvalovat. Logická hranice orchestrátor/vrátný je v jednom kontejneru; toto není oddělená procesová autorita.
- Pythonové guardy jsou obrana do hloubky. Hranicí provádění je nový omezený proces uvnitř neprivilegovaného kontejneru bez dat, tajemství a internetu. Revize není důkazem absence všech chyb Python runtime ani hostitele.
- Testy používají pouze fake transporty a mock LLM, skutečný runner v podprocesu a dočasná data. Skutečné ElevenLabs/LLM volání se neprovádělo. ElevenLabs protokol ověřen proti [oficiální dokumentaci](https://elevenlabs.io/docs/api-reference/text-to-speech/convert?explorer=true).
- Lokální Docker buildy nejprve prošly standardními Dockerfiles. Později Docker VM ztratil externí spojení (hostitelský HTTP funguje, bridge i host networking v throwaway kontejnerech ne). Oba validační image se úspěšně sestavily bez sítě z wheelů stažených hostitelem, v dočasném kontextu mimo repozitář. Standardní repo Dockerfiles a runtime izolace se nemění; produkční stack se nerestartoval.
- Examiner byl po M5 dokončen a znovu prohlédnut včetně generátoru, merge/validace soukromých dat a API integrace. Podporuje jen vlastní SSH útoky a výchozí zůstává vypnutý. Samoopravy jsou výslovně volitelný P3 krok a nejsou implementované; REPORT to uvádí.

## Ověření

Poslední lokální modulová sada tohoto vlastníka: sandbox + SandboxClient + voice + architektura **88 passed / 1.90 s**, Python 3.12 v `frankenstein-dev-tests`. Opravy registry/Unicode nezávisle ověřeny sadou **90 passed / 0.44 s**. Volitelný připravený image přes přesný test.sh ověřen výběrem sandbox/voice **89 passed / 2.17 s**. Koordinátor potvrdil finální celou sadu stejným skriptem **506 passed / 18.61 s**, jeden dependency warning, žádný skip/xfail. Poslední oba image offline build exit 0. Finální izolovaný Compose A/B smoke v projektu `frankenstein-final` na portu 13001 prošel, včetně 185 s nečinného WS; audit po schválení platný. Kontroly sandboxu v tomto image potvrdily non-root, nepřítomnost API klíčů, blokovaný internet i zápis do /app a interní síť/capabilities/no-new-privileges.
