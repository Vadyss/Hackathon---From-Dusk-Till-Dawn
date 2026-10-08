# Kontrakt Frankenstein: frontend ↔ backend

- **Verze kontraktu:** 1
- **Platí od:** 2026-10-04
- **Backend:** Adam · **Frontend:** kolega
- **Umístění v repozitáři:** `docs/kontrakt.md`

Tento dokument je jediný zdroj pravdy o komunikaci mezi frontendem a backendem. Co v něm není, neexistuje.

---

## 0. Pravidla pro AI asistenty

Pokud jsi AI asistent a generuješ kód podle tohoto dokumentu, dodržuj tato pravidla.

**Vždy:**

1. Používej přesně názvy endpointů, typů událostí, polí a chybových kódů z tohoto dokumentu. Nic nepřejmenovávej a nic nevymýšlej.
2. Když tu něco chybí nebo je nejasné, zeptej se uživatele. Chybějící části nedoplňuj odhadem.
3. Všechny texty z API vykresluj jako prostý text.
4. Neznámé typy událostí a neznámá pole ignoruj. Nesmí způsobit chybu.
5. Stav běhu odvozuj jen z událostí (kapitola 12), ne z odpovědí HTTP.
6. Volej jen adresy pod `/api/` (nastavení pro vývoj je v kapitole 7.3).

**Nikdy:**

1. Nepoužívej `dangerouslySetInnerHTML`, `innerHTML`, `eval` ani převod Markdownu na HTML pro data z API.
2. Nevkládej do frontendu API klíče a nevolej z něj LLM ani ElevenLabs.
3. Nerozhoduj o úspěchu nebo schválení podle textu. Rozhodují jen pole `passed`, `status` a typ události.
4. Neměň tento dokument bez souhlasu obou autorů.

---

## 1. Slovníček

- **Běh (run):** zpracování jednoho požadavku analytika od zadání po schválení nebo zamítnutí.
- **Dovednost (skill):** malá funkce v Pythonu pro práci s logy (parser, agregace, obohacení).
- **Výchozí dovednost (seed):** dovednost, kterou napsal Adam. Je součástí aplikace.
- **Kandidát (candidate):** dovednost od agenta, která prošla testy, ale ještě nebyla schválena.
- **Registr:** úložiště schválených dovedností.
- **Recept (recipe):** pravidlo detekce ve formě JSON: parser → filtr → agregace → podmínka.
- **Vrátný (gatekeeper):** deterministická část backendu, která kontroluje a zapisuje. Jediná autorita.
- **Ladicí sada (tuning):** logy, na kterých agent ladí pravidlo.
- **Ověřovací sada (validation):** logy, které agent nikdy nevidí. Slouží k závěrečnému ověření.

---

## 2. Architektura v kostce

```
Prohlížeč ──► nginx (port 3000)
               ├── /        → statický frontend (Next.js, export)
               └── /api/... → backend (FastAPI): orchestrátor + vrátný
                                 ├── sandbox (interní síť, bez internetu)
                                 ├── LLM API
                                 └── ElevenLabs
```

Frontend mluví **jen** s backendem přes `/api/`. Nikdy přímo se sandboxem, LLM ani ElevenLabs.

---

## 3. Obecná pravidla

- Formát JSON, kódování UTF-8, názvy polí ve tvaru `snake_case`.
- Čas je řetězec ISO 8601 v UTC s milisekundami, například `2026-10-04T14:30:12.345Z`. Frontend ho zobrazuje v místním čase.
- Zápis typů v tomto dokumentu: `string`, `int`, `float`, `bool`, `T[]` (seznam), `T | null` (může být `null`), `object`.
- Pole bez `| null` je vždy přítomné a nikdy není `null`.
- Najednou může být aktivní nejvýš jeden běh. **Aktivní** znamená ve stavu `running` nebo `awaiting_approval`.
- Přihlašování není. Aplikace běží jen v lokální síti a schválit může kdokoli, kdo stránku otevře. Jde o známé omezení.
- Historie běhů a událostí je jen v paměti backendu a po restartu backendu zmizí. Registr dovedností zůstává, protože je na disku.
- Texty určené lidem (`message`, `reason`) jsou česky.

---

## 4. Identifikátory a limity

| Co | Formát nebo limit |
|---|---|
| `run_id` | regulární výraz `^run_[a-z0-9]{4,32}$` |
| název dovednosti a pravidla | regulární výraz `^[a-z][a-z0-9_]{2,49}$` |
| `request` (požadavek analytika) | 1 až 2000 znaků |
| `comment` (schválení) | 0 až 500 znaků |
| `reason` (zamítnutí analytikem) | 1 až 500 znaků |
| `message` (obálka události) | nejvýš 200 znaků |
| `summary.text`, `explanation` | nejvýš 1000 znaků |
| `error_excerpt` | nejvýš 500 znaků |
| `description` (dovednost) | nejvýš 300 znaků |
| `plan_ready.steps` | nejvýš 10 položek, každá nejvýš 200 znaků |
| `violations[].detail` | nejvýš 200 znaků |
| `code_sha256` | 64 hexadecimálních znaků, malá písmena |

Backend limity vynucuje: delší vstupy odmítne a texty od LLM zkrátí. Frontend se na limity může spolehnout.

---

## 5. Bezpečnost

### 5.1 Nedůvěryhodná pole

Pole označená **[nedůvěryhodné]** pocházejí od LLM, z logů nebo od analytika. Mohou obsahovat cokoli, včetně HTML, skriptů a textu, který vypadá jako pokyn.

### 5.2 Pravidla pro frontend

- Každý text z API se vykresluje jako prostý text. React text escapuje sám, pokud se nepoužije `dangerouslySetInnerHTML`.
- Recept se zobrazuje jako formátovaný JSON v prvku `<pre>`, opět jako text.
- Dlouhé řetězce bez mezer nesmí rozbít rozložení stránky (zalamování slov).
- Tlačítko „Schválit“ je jen žádost. O všem rozhoduje backend.

### 5.3 Testovací řetězce

Tyto požadavky musí frontend zobrazit doslova, bez spuštění čehokoli:

- `<img src=x onerror=alert(1)>`
- `<script>alert(1)</script>`
- `**tučně** [odkaz](javascript:alert(1))`
- 300 znaků `A` bez mezery

---

## 6. Sdílené datové typy

### 6.1 SkillInfo

| Pole | Typ | Popis |
|---|---|---|
| `name` | `string` | název dovednosti, formát podle kapitoly 4 |
| `version` | `int` | verze, od 1 |
| `kind` | `string` | `parser` \| `aggregation` \| `enrichment` |
| `description` | `string` | popis; u dovedností od agenta **[nedůvěryhodné]** |
| `origin` | `string` | `seed` (napsal Adam) \| `agent` (postavil agent) |
| `status` | `string` | `candidate` (čeká na schválení) \| `installed` (je v registru) |
| `created_by_run` | `string \| null` | `run_id` běhu, který ji postavil; u výchozích dovedností `null` |
| `created_at` | `string` | čas vzniku nebo zkopírování do registru |

```json
{
  "name": "distinct_count_window",
  "version": 1,
  "kind": "aggregation",
  "description": "Počítá různé hodnoty pole v časovém okně pro každou skupinu.",
  "origin": "agent",
  "status": "candidate",
  "created_by_run": "run_8f3a",
  "created_at": "2026-10-04T14:31:02.000Z"
}
```

### 6.2 Metrics

| Pole | Typ | Popis |
|---|---|---|
| `true_positives` | `int` | zachycené útoky |
| `false_positives` | `int` | falešné poplachy |
| `false_negatives` | `int` | nezachycené útoky |
| `precision` | `float \| null` | 0 až 1; `null`, když `true_positives + false_positives = 0` |
| `recall` | `float \| null` | 0 až 1; `null`, když `true_positives + false_negatives = 0` |
| `thresholds` | `object` | `{ "min_precision": float, "min_recall": float }` |
| `passed` | `bool` | výsledek rozhodl kód backendu podle `thresholds`, nikdy LLM |

Hodnotu `null` frontend zobrazí jako „—“.

```json
{
  "true_positives": 14,
  "false_positives": 1,
  "false_negatives": 0,
  "precision": 0.93,
  "recall": 1.0,
  "thresholds": { "min_precision": 0.9, "min_recall": 0.9 },
  "passed": true
}
```

Hodnoty hranic v příkladu jsou ukázkové. Skutečné stanoví backend.

### 6.3 Recipe

Typ `object`, celý **[nedůvěryhodné]**, protože ho napsalo LLM.

Frontend recept **nerozebírá**. Zobrazí jen pole `name` jako nadpis a celý recept jako formátovaný JSON. Backend tak může formát receptu měnit bez změny frontendu. Pole `name` je vždy přítomné. Pro představu:

```json
{
  "name": "ssh_password_spraying",
  "parser": "ssh_parser",
  "filter": [{ "field": "outcome", "op": "eq", "value": "failure" }],
  "aggregation": {
    "skill": "distinct_count_window",
    "params": { "group_by": "src_ip", "distinct_field": "user", "window_s": 300 }
  },
  "condition": { "field": "distinct_count", "op": "gte", "value": 5 }
}
```

### 6.4 RunInfo

| Pole | Typ | Popis |
|---|---|---|
| `run_id` | `string` | identifikátor běhu |
| `request` | `string` | požadavek analytika **[nedůvěryhodné]** |
| `status` | `string` | `running` \| `awaiting_approval` \| `approved` \| `rejected` \| `failed` |
| `created_at` | `string` | čas založení |
| `finished_at` | `string \| null` | čas konce; u aktivního běhu `null` |
| `last_seq` | `int` | `seq` poslední události běhu |

### 6.5 RunStats

| Pole | Typ | Popis |
|---|---|---|
| `duration_ms` | `int` | délka běhu od `run_started` po `summary` |
| `llm_calls` | `int` | počet volání LLM |
| `tokens_total` | `int \| null` | součet tokenů; `null`, pokud ho poskytovatel nevrací |
| `skills_built` | `int` | počet kandidátů vzniklých v běhu |
| `skills_reused` | `int` | počet dovedností použitých z registru |

---

## 7. HTTP API

Cesty v tomto dokumentu jsou vždy z pohledu prohlížeče, tedy včetně `/api`.

### 7.1 Přehled

| Metoda | Cesta | Účel |
|---|---|---|
| GET | `/api/health` | stav backendu a verze kontraktu |
| POST | `/api/runs` | nový požadavek analytika |
| GET | `/api/runs` | seznam běhů |
| GET | `/api/runs/{run_id}/events?after_seq=N` | události běhu |
| POST | `/api/runs/{run_id}/approve` | schválení |
| POST | `/api/runs/{run_id}/reject` | zamítnutí |
| GET | `/api/skills` | dovednosti v registru |
| GET | `/api/runs/{run_id}/audio` | hlasové shrnutí |
| WebSocket | `/api/ws` | proud událostí (kapitola 8) |

### 7.2 Detail

#### `GET /api/health`

- 200: `{"status": "ok", "contract_version": 1}`
- Frontend může při startu porovnat `contract_version` se svou verzí a při neshodě zobrazit varování.

#### `POST /api/runs`

- Tělo: `{"request": "Chci zachytit password spraying na SSH."}`
- `request`: `string`, 1 až 2000 znaků po oříznutí mezer na krajích, **[nedůvěryhodné]**
- 202: `{"run_id": "run_8f3a", "status": "running"}`
- Běh pokračuje na pozadí. Výsledky chodí jako události.
- Chyby: 400 `INVALID_REQUEST` (chybí, je prázdný nebo příliš dlouhý), 409 `RUN_ALREADY_ACTIVE`
- Kontrolu obsahu požadavku dělá vrátný až v běhu. Zamítnutí přijde jako událost `run_failed` s kódem `REQUEST_REJECTED`.

#### `GET /api/runs`

- 200: `{"runs": [RunInfo, ...]}`, seřazené od nejnovějšího

#### `GET /api/runs/{run_id}/events?after_seq=N`

- `after_seq`: `int`, nepovinný, výchozí hodnota 0
- 200: `{"events": [Event, ...]}`: všechny události běhu se `seq > N`, seřazené podle `seq`
- Chyby: 400 `INVALID_REQUEST` (neplatné `after_seq`), 404 `RUN_NOT_FOUND` (neexistující nebo neplatné `run_id`)

#### `POST /api/runs/{run_id}/approve`

- Tělo: `{"comment": "Vypadá dobře."}` nebo `{}`; `comment` je nepovinný, 0 až 500 znaků
- 200: `{"status": "approved"}`
- Chyby: 400 `INVALID_REQUEST`, 404 `RUN_NOT_FOUND`, 409 `NOT_AWAITING_APPROVAL`

#### `POST /api/runs/{run_id}/reject`

- Tělo: `{"reason": "Příliš mnoho falešných poplachů."}`; `reason` je povinný, 1 až 500 znaků
- 200: `{"status": "rejected"}`
- Chyby: 400 `INVALID_REQUEST`, 404 `RUN_NOT_FOUND`, 409 `NOT_AWAITING_APPROVAL`

#### `GET /api/skills`

- 200: `{"skills": [SkillInfo, ...]}`, jen dovednosti se stavem `installed`, seřazené podle `name`

#### `GET /api/runs/{run_id}/audio`

- 200: zvuk, `Content-Type: audio/mpeg`
- Chyby: 404 `RUN_NOT_FOUND`, 404 `AUDIO_NOT_FOUND`
- Hlas je volitelný. Frontend musí fungovat i bez něj.

### 7.3 Adresa backendu při vývoji

- V produkci volá frontend relativní adresy (`/api/...`) na stejném hostiteli.
- Pro vývoj proti mocku na jiném portu frontend čte jedinou hodnotu `NEXT_PUBLIC_API_BASE`, například `http://localhost:8001`. Výchozí hodnota je prázdná, což znamená relativní adresy.
- Adresa endpointu = `NEXT_PUBLIC_API_BASE` + `/api/...`.
- Adresa WebSocketu: z `NEXT_PUBLIC_API_BASE` se `http` nahradí za `ws` (a `https` za `wss`). Když je hodnota prázdná, použije se aktuální stránka: `ws://` nebo `wss://` podle `window.location.protocol` a hostitel z `window.location.host`.
- V produkčním Docker buildu nesmí být `NEXT_PUBLIC_API_BASE` nastavená.

### 7.4 Formát chyby

Všechny chybové odpovědi mají stejný tvar:

```json
{ "error": { "code": "RUN_ALREADY_ACTIVE", "message": "Předchozí běh ještě neskončil." } }
```

| HTTP | `code` | Kdy |
|---|---|---|
| 400 | `INVALID_REQUEST` | neplatné tělo nebo parametr |
| 404 | `RUN_NOT_FOUND` | běh neexistuje (například po restartu backendu) |
| 404 | `AUDIO_NOT_FOUND` | běh nemá hlasové shrnutí |
| 409 | `RUN_ALREADY_ACTIVE` | jiný běh je ve stavu `running` nebo `awaiting_approval` |
| 409 | `NOT_AWAITING_APPROVAL` | běh nečeká na schválení (už schválen, zamítnut nebo ještě běží) |
| 500 | `INTERNAL_ERROR` | neočekávaná chyba backendu |

Frontend zobrazí `message` uživateli jako prostý text.

---

## 8. WebSocket

- Adresa: `/api/ws` (sestavení adresy viz kapitola 7.3).
- Zprávy posílá jen backend. Frontend nic neposílá.
- Jedna zpráva = jedna událost ve tvaru JSON (kapitola 9).
- Backend posílá události všech běhů všem připojeným klientům.
- Po připojení backend historii neposílá. Frontend si ji stáhne přes HTTP (kapitola 12).
- Při výpadku se frontend sám připojí znovu (kapitola 12.3).

---

## 9. Obálka události

Každá událost, ať přijde přes WebSocket, nebo přes `GET .../events`, má stejný tvar:

| Pole | Typ | Popis |
|---|---|---|
| `type` | `string` | typ události (kapitola 10) |
| `run_id` | `string` | běh, ke kterému patří |
| `seq` | `int` | pořadí v běhu, začíná od 1 a roste bez mezer |
| `timestamp` | `string` | čas vzniku |
| `phase` | `string` | `intake` \| `plan` \| `forge` \| `rule` \| `validation` \| `approval` \| `done` |
| `message` | `string` | krátký český popis pro časovou osu; skládá ho kód backendu, ale může obsahovat názvy od LLM, proto **[nedůvěryhodné]** |
| `data` | `object` | obsah podle typu události; u typů bez dat `{}` |

```json
{
  "type": "skill_candidate_ready",
  "run_id": "run_8f3a",
  "seq": 9,
  "timestamp": "2026-10-04T14:30:12.345Z",
  "phase": "forge",
  "message": "Dovednost distinct_count_window prošla testy (pokus 2 ze 3).",
  "data": { }
}
```

---

## 10. Katalog událostí

U každé události je fáze, pole v `data` a příklad `data`.

### 10.1 Fáze `intake`

#### `run_started`

- `request`: `string` **[nedůvěryhodné]**

```json
{ "request": "Chci zachytit password spraying na SSH." }
```

### 10.2 Fáze `plan`

#### `plan_ready`

Přijde jen pro platný plán. Neplatný plán vyvolá `policy_rejected` s `target: "plan"`.

- `steps`: `string[]` **[nedůvěryhodné]**
- `skills_needed`: `string[]`, názvy dovedností

```json
{
  "steps": ["Rozparsovat SSH logy", "Spočítat různé uživatele na IP za 5 minut", "Upozornit nad hranicí"],
  "skills_needed": ["ssh_parser", "distinct_count_window"]
}
```

#### `skill_reused`

Jedna událost na každou dovednost z registru, kterou plán použije.

- `skill`: `SkillInfo` (vždy `status: "installed"`)

```json
{
  "skill": {
    "name": "ssh_parser", "version": 1, "kind": "parser",
    "description": "Převede řádky auth.log z OpenSSH na události.",
    "origin": "seed", "status": "installed",
    "created_by_run": null, "created_at": "2026-10-04T12:00:00.000Z"
  }
}
```

#### `capability_missing`

Přijde jen tehdy, když něco chybí.

- `skills`: seznam `{ "name": string, "description": string }`; `description` **[nedůvěryhodné]**

```json
{ "skills": [{ "name": "distinct_count_window", "description": "Počet různých hodnot pole v okně pro skupinu." }] }
```

### 10.3 Fáze `forge`

Opakuje se pro každou chybějící dovednost, postupně jedna po druhé.

#### `forge_started`

- `skill`: `string`, název
- `attempt`: `int`, 1 až 3
- `max_attempts`: `int`, vždy 3

```json
{ "skill": "distinct_count_window", "attempt": 1, "max_attempts": 3 }
```

#### `skill_tests_failed`

- `skill`: `string`
- `attempt`: `int`
- `tests_total`: `int`
- `tests_failed`: `int`
- `error_excerpt`: `string` **[nedůvěryhodné]**

```json
{ "skill": "distinct_count_window", "attempt": 1, "tests_total": 6, "tests_failed": 2, "error_excerpt": "AssertionError: expected 3, got 2" }
```

#### `skill_candidate_ready`

- `skill`: `SkillInfo` (vždy `status: "candidate"`, `origin: "agent"`)
- `attempt`: `int`
- `tests_total`: `int`
- `code_sha256`: `string`

```json
{
  "skill": {
    "name": "distinct_count_window", "version": 1, "kind": "aggregation",
    "description": "Počítá různé hodnoty pole v časovém okně pro každou skupinu.",
    "origin": "agent", "status": "candidate",
    "created_by_run": "run_8f3a", "created_at": "2026-10-04T14:31:02.000Z"
  },
  "attempt": 2,
  "tests_total": 6,
  "code_sha256": "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
}
```

### 10.4 Fáze `rule`

#### `rule_drafted`

Přijde hned po návrhu od LLM, ještě před kontrolou vrátného. Na časové ose tak bude vidět i recept, který vrátný potom zamítne.

- `attempt`: `int`, 1 až 3
- `max_attempts`: `int`, vždy 3
- `recipe`: `Recipe`
- `explanation`: `string` **[nedůvěryhodné]**

```json
{
  "attempt": 1,
  "max_attempts": 3,
  "recipe": { "name": "ssh_password_spraying", "parser": "ssh_parser" },
  "explanation": "Hledám IP adresy, které za 5 minut zkusí mnoho různých uživatelů."
}
```

(Recept je v příkladu zkrácený. Celý tvar je v kapitole 6.3.)

#### `rule_evaluated`

- `attempt`: `int`
- `dataset`: `string`, vždy `"tuning"`
- `metrics`: `Metrics`

```json
{ "attempt": 1, "dataset": "tuning", "metrics": { "true_positives": 10, "false_positives": 4, "false_negatives": 4, "precision": 0.71, "recall": 0.71, "thresholds": { "min_precision": 0.9, "min_recall": 0.9 }, "passed": false } }
```

### 10.5 Fáze `validation`

#### `validation_done`

- `dataset`: `string`, vždy `"validation"`
- `metrics`: `Metrics`

```json
{ "dataset": "validation", "metrics": { "true_positives": 9, "false_positives": 0, "false_negatives": 1, "precision": 1.0, "recall": 0.9, "thresholds": { "min_precision": 0.9, "min_recall": 0.9 }, "passed": true } }
```

### 10.6 Fáze `approval`

#### `summary`

- `text`: `string` **[nedůvěryhodné]**
- `stats`: `RunStats`

```json
{
  "text": "Postavil jsem dovednost distinct_count_window a pravidlo zachytilo všechny útoky v ladicí sadě.",
  "stats": { "duration_ms": 48210, "llm_calls": 7, "tokens_total": 18340, "skills_built": 1, "skills_reused": 1 }
}
```

#### `voice_ready`

Volitelná. Může přijít kdykoli po `summary`, i po `awaiting_approval`, nebo vůbec.

- `audio_url`: `string`, vždy `/api/runs/{run_id}/audio`

```json
{ "audio_url": "/api/runs/run_8f3a/audio" }
```

Při vývoji s `NEXT_PUBLIC_API_BASE` se před `audio_url` přidá tato hodnota.

#### `awaiting_approval`

Obsahuje vše, co potřebuje panel schválení.

- `recipe`: `Recipe`
- `metrics_tuning`: `Metrics`
- `metrics_validation`: `Metrics`
- `new_skills`: `SkillInfo[]` (stav `candidate`; může být prázdný seznam)

```json
{
  "recipe": { "name": "ssh_password_spraying", "parser": "ssh_parser" },
  "metrics_tuning": { "true_positives": 14, "false_positives": 1, "false_negatives": 0, "precision": 0.93, "recall": 1.0, "thresholds": { "min_precision": 0.9, "min_recall": 0.9 }, "passed": true },
  "metrics_validation": { "true_positives": 9, "false_positives": 0, "false_negatives": 1, "precision": 1.0, "recall": 0.9, "thresholds": { "min_precision": 0.9, "min_recall": 0.9 }, "passed": true },
  "new_skills": []
}
```

(Recept je v příkladu zkrácený.)

### 10.7 Fáze `done`

#### `skill_installed`

Jen po schválení. Jedna událost na každou dovednost ze `new_skills`.

- `skill`: `SkillInfo` (vždy `status: "installed"`)

#### `rule_approved`

- `rule_name`: `string`
- `comment`: `string | null` **[nedůvěryhodné]**

```json
{ "rule_name": "ssh_password_spraying", "comment": null }
```

#### `rule_rejected`

- `reason`: `string` **[nedůvěryhodné]**

```json
{ "reason": "Příliš mnoho falešných poplachů." }
```

### 10.8 Události v kterékoli fázi

`phase` v obálce u nich vždy udává fázi, ve které nastaly.

#### `policy_rejected`

Vrátný něco zamítl. Spotřebuje se jeden pokus. Běh pokračuje dalším pokusem, nebo skončí `run_failed`.

- `target`: `string`, `plan` \| `skill` \| `recipe`
- `name`: `string | null`, název dovednosti nebo pravidla; u plánu `null`
- `attempt`: `int`
- `violations`: seznam `{ "code": string, "detail": string }`; `detail` **[nedůvěryhodné]**

Kódy porušení nejsou uzavřený seznam. Frontend zobrazí jakýkoli kód. Příklady: `FORBIDDEN_IMPORT`, `FORBIDDEN_CALL`, `INVALID_MANIFEST`, `INVALID_NAME`, `UNKNOWN_SKILL`, `RECIPE_INVALID`, `RECIPE_EXCEPTION`.

```json
{
  "target": "recipe",
  "name": "ssh_brute_force",
  "attempt": 1,
  "violations": [{ "code": "RECIPE_EXCEPTION", "detail": "Filtr vylučuje src_ip 10.0.0.5." }]
}
```

#### `run_failed`

Konec běhu.

- `reason_code`: `string`, jedna z hodnot:
  - `REQUEST_REJECTED`: vrátný odmítl požadavek
  - `PLAN_INVALID`: ani 3. plán neprošel
  - `FORGE_FAILED`: dovednost neprošla ani ve 3. pokusu
  - `RULE_FAILED`: pravidlo nesplnilo hranice ani ve 3. pokusu
  - `VALIDATION_FAILED`: pravidlo neprošlo na ověřovací sadě
  - `LLM_ERROR`: LLM API selhalo
  - `SANDBOX_ERROR`: sandbox selhal
  - `INTERNAL_ERROR`: jiná chyba backendu
- `reason`: `string`, popis od backendu

```json
{ "reason_code": "FORGE_FAILED", "reason": "Dovednost distinct_count_window neprošla testy ani ve 3. pokusu." }
```

---

## 11. Pořadí a stavy

### 11.1 Fáze

Fáze jdou vždy v pořadí `intake` → `plan` → `forge` → `rule` → `validation` → `approval` → `done` a nikdy se nevracejí. Fáze `forge` se přeskočí, pokud nic nechybí.

### 11.2 Začátek a konec

- Každý běh začíná událostí `run_started`.
- Každý běh končí právě jednou z událostí `rule_approved`, `rule_rejected`, `run_failed`.
- Po koncové události už žádná další událost toho běhu nepřijde, kromě případného `voice_ready`.

### 11.3 Plán

1. Neplatný plán vyvolá `policy_rejected` (`target: "plan"`). Po třetím neplatném plánu přijde `run_failed` s `PLAN_INVALID`.
2. Platný plán vyvolá `plan_ready`, potom `skill_reused` pro každou dovednost z registru a nakonec `capability_missing`, pokud něco chybí.

### 11.4 Kovárna (pro každou chybějící dovednost)

1. `forge_started` s pokusem *n*.
2. Pak právě jedna z událostí: `policy_rejected` (`target: "skill"`), `skill_tests_failed`, nebo `skill_candidate_ready`.
3. Po neúspěchu a *n* < 3 následuje `forge_started` s pokusem *n* + 1. Po neúspěchu ve 3. pokusu přijde `run_failed` s `FORGE_FAILED`.

### 11.5 Pravidlo

1. `rule_drafted` s pokusem *n*.
2. Pak právě jedna z událostí: `policy_rejected` (`target: "recipe"`), nebo `rule_evaluated`.
3. Když vrátný recept zamítl nebo `rule_evaluated` má `passed: false`:
   - při *n* < 3 následuje `rule_drafted` s pokusem *n* + 1,
   - při *n* = 3 přijde `run_failed` s `RULE_FAILED`.
4. Když `rule_evaluated` má `passed: true`, následuje `validation_done`.

### 11.6 Ověření a schválení

1. `validation_done` s `passed: false` vede na `run_failed` s `VALIDATION_FAILED`. Opakování není.
2. `validation_done` s `passed: true` vede na `summary` a pak `awaiting_approval`.
3. Po schválení: `skill_installed` pro každou dovednost z `new_skills`, potom `rule_approved`.
4. Po zamítnutí: jen `rule_rejected`. Kandidáti se zahodí.
5. `voice_ready` nemá pevné místo.

### 11.7 Stav běhu podle událostí

| Poslední rozhodující událost | `status` |
|---|---|
| `run_started` | `running` |
| `awaiting_approval` | `awaiting_approval` |
| `rule_approved` | `approved` |
| `rule_rejected` | `rejected` |
| `run_failed` | `failed` |

Ostatní události stav nemění.

---

## 12. Jak frontend skládá stav

### 12.1 Úložiště

- Pro každý běh: seznam událostí seřazený podle `seq` a hodnota `last_seq`.
- Všechny panely čtou z tohoto jednoho úložiště. Mezi sebou nekomunikují.

### 12.2 Načtení stránky

1. Otevři WebSocket. Příchozí události zatím ukládej do vyrovnávací paměti.
2. Zavolej `GET /api/runs`.
3. Pro každý běh zavolej `GET /api/runs/{run_id}/events?after_seq=0`.
4. Slij historii s vyrovnávací pamětí. Duplicity zahoď podle dvojice `run_id` + `seq`. Seřaď podle `seq`.
5. Zavolej `GET /api/skills`.

Pořadí kroků 1 a 2 je důležité. WebSocket se otevírá první, aby se neztratila událost, která přijde během stahování historie.

### 12.3 Každá příchozí událost

1. Je dvojice `run_id` + `seq` už známá? Zahoď ji.
2. Je `run_id` neznámý? Založ nový běh.
3. Je `seq` větší než `last_seq + 1`? Chybí události. Stáhni je přes `GET .../events?after_seq=<last_seq>` a slij.
4. Jinak událost přidej a zvyš `last_seq`.

### 12.4 Výpadek WebSocketu

1. Připoj se znovu po 1 s, pak 2 s, 4 s, nejvýš po 10 s.
2. Po připojení zopakuj kroky 2 až 4 z kapitoly 12.2, ale s `after_seq=<last_seq>` pro každý známý běh.
3. Vrátí-li backend pro běh 404 `RUN_NOT_FOUND`, backend se restartoval. Běh odeber z pohledu.

### 12.5 Zdroje dat pro panely

- **Časová osa:** všechny události; zobrazuje `timestamp`, `phase` a `message`.
- **Chat:** `run_started.request` a `summary.text`.
- **Schválení:** poslední `awaiting_approval` běhu ve stavu `awaiting_approval`. Po kliknutí na „Schválit“ nebo „Zamítnout“ se tlačítka zablokují, dokud nepřijde koncová událost nebo chyba. Při chybě se znovu odblokují a zobrazí se `error.message`.
- **Dovednosti:** výchozí seznam z `GET /api/skills`. Událost `skill_installed` dovednost přidá, `skill_reused` ji zvýrazní, `skill_candidate_ready` ji může ukázat jako kandidáta.
- **Srovnání:** `summary.stats` dvou běhů, například posledních dvou dokončených.

### 12.6 Odpovědi HTTP

Úspěšná odpověď na `approve`, `reject` nebo `runs` jen potvrzuje přijetí. Stav se mění až podle událostí. Chybová odpověď se zobrazí uživateli.

---

## 13. Mock backend

Slouží k vývoji frontendu bez skutečného backendu a jako záložní demo.

### 13.1 Požadavky

- Implementuje stejné cesty jako backend: všechny z kapitoly 7.1 včetně `/api/ws`.
- `GET /api/runs/{run_id}/audio` smí vždy vracet 404 `AUDIO_NOT_FOUND`.
- Povoluje CORS pro adresu vývojového serveru frontendu.
- Dodržuje stejná pravidla jako backend: limity, chyby, 409 při aktivním běhu, 409 při opakovaném schválení.

### 13.2 Scénáře

- Každý scénář je soubor `mock/scenarios/<název>.json` se seznamem událostí.
- V souboru stačí `type`, `phase`, `message`, `data`. Pole `run_id`, `seq` a `timestamp` doplní mock. Pokud je soubor obsahuje, mock je přepíše.
- Mock vybere scénář podle textu požadavku (bez ohledu na velikost písmen):
  - obsahuje `spray` → scénář A,
  - obsahuje `distrib` → scénář B,
  - obsahuje `inject` → scénář C,
  - obsahuje `fail` → scénář D,
  - jinak scénář A.

### 13.3 Přehrávání

1. Mezi událostmi náhodná prodleva 300 až 1500 ms.
2. Před první událostí fáze `done` mock čeká na schválení nebo zamítnutí.
3. Po `approve`: pošle zbytek scénáře (`skill_installed` a `rule_approved`; `comment` doplní z těla požadavku).
4. Po `reject`: zbytek scénáře zahodí a pošle `rule_rejected` s `reason` z těla požadavku.
5. `GET /api/skills` začíná výchozími dovednostmi `ssh_parser` a `count_window`. Událost `skill_installed` přidá dovednost do seznamu.

### 13.4 Záložní demo

Výstup `GET /api/runs/{run_id}/events` ze skutečného běhu se uloží jako soubor scénáře a mock ho přehraje stejně jako ostatní.

---

## 14. Typické sekvence

Výchozí dovednosti jsou `ssh_parser` a `count_window`. Pro obyčejný brute force agent nic nového nestaví.

### Scénář A: password spraying, agent staví novou dovednost

1. `run_started`
2. `plan_ready`
3. `skill_reused` (ssh_parser)
4. `capability_missing` (distinct_count_window)
5. `forge_started` (pokus 1)
6. `skill_tests_failed` (pokus 1)
7. `forge_started` (pokus 2)
8. `skill_candidate_ready` (pokus 2)
9. `rule_drafted` (pokus 1)
10. `rule_evaluated` (pokus 1, `passed: false`)
11. `rule_drafted` (pokus 2)
12. `rule_evaluated` (pokus 2, `passed: true`)
13. `validation_done` (`passed: true`)
14. `summary` (`skills_built: 1`, `skills_reused: 1`)
15. `awaiting_approval` (`new_skills`: distinct_count_window)
16. `voice_ready`
17. *čeká na schválení*
18. `skill_installed` (distinct_count_window)
19. `rule_approved`

### Scénář B: distribuovaný brute force, agent dovednost znovu použije

Jeden uživatel, mnoho IP adres. Stejná dovednost `distinct_count_window`, jiné parametry.

1. `run_started`
2. `plan_ready`
3. `skill_reused` (ssh_parser)
4. `skill_reused` (distinct_count_window)
5. `rule_drafted` (pokus 1)
6. `rule_evaluated` (pokus 1, `passed: true`)
7. `validation_done` (`passed: true`)
8. `summary` (`skills_built: 0`, `skills_reused: 2`)
9. `awaiting_approval` (`new_skills`: prázdný seznam)
10. `voice_ready`
11. *čeká na schválení*
12. `rule_approved`

### Scénář C: brute force s prompt injection v logu

1. `run_started`
2. `plan_ready`
3. `skill_reused` (ssh_parser)
4. `skill_reused` (count_window)
5. `rule_drafted` (pokus 1, recept s výjimkou pro jednu IP adresu)
6. `policy_rejected` (`target: "recipe"`, `RECIPE_EXCEPTION`, pokus 1)
7. `rule_drafted` (pokus 2)
8. `rule_evaluated` (pokus 2, `passed: true`)
9. `validation_done` (`passed: true`)
10. `summary`
11. `awaiting_approval`
12. *čeká na schválení*
13. `rule_approved`

### Scénář D: selhání kovárny

1. `run_started`
2. `plan_ready`
3. `skill_reused` (ssh_parser)
4. `capability_missing` (distinct_count_window)
5. `forge_started` (pokus 1)
6. `skill_tests_failed` (pokus 1)
7. `forge_started` (pokus 2)
8. `policy_rejected` (`target: "skill"`, `FORBIDDEN_IMPORT`, pokus 2)
9. `forge_started` (pokus 3)
10. `skill_tests_failed` (pokus 3)
11. `run_failed` (`FORGE_FAILED`, fáze `forge`)

---

## 15. Poznámky pro backend

1. **Formát chyb ve FastAPI.** FastAPI ve výchozím stavu vrací pro neplatný vstup kód 422 a tvar `{"detail": ...}`, stejně tak `HTTPException`. Kvůli kapitole 7.4 jsou potřeba vlastní obsluhy výjimek pro `RequestValidationError` a `HTTPException`.
2. **Názvy a cesty na disku.** `run_id` a názvy dovedností se používají v cestách (`candidates/<run_id>/<název>/`). Názvy dovedností vymýšlí LLM. Před každým použitím v cestě je ověř regulárním výrazem z kapitoly 4. Neplatný název dovednosti = `policy_rejected` s `INVALID_NAME`. Neplatné `run_id` v URL = 404 `RUN_NOT_FOUND`.
3. **Pořadí uložení a odeslání.** Událost dostane `seq` pod zámkem běhu, nejdřív se uloží do seznamu běhu a teprve potom odešle přes WebSocket. `GET .../events` tak vždy obsahuje vše, co už odešlo.
4. **Schválení a zamítnutí.** Kontrola stavu a přechod do nového stavu proběhnou atomicky pod zámkem. Ze dvou souběžných požadavků uspěje jen jeden, druhý dostane 409.
5. **Texty od LLM** zkrať na limity z kapitoly 4 dřív, než se dostanou do události.
6. **`message`** skládej ze šablon v kódu, ne z výstupu LLM.
7. **Pomalý klient WebSocketu** nesmí zdržet běh. Odesílání s časovým limitem, nefunkčního klienta odpoj.
8. **`POST /api/runs`** vrací 202 hned. Běh pokračuje na pozadí.
9. **Návrh pro `RECIPE_EXCEPTION`:** výjimkou je každý filtr, který vylučuje konkrétní identitu, například `neq` nebo `not_in` na polích `src_ip`, `user` nebo `host`. Přesné pravidlo určuje politika vrátného.

---

## 16. Infrastruktura (nginx)

- Pro `/api/ws` je potřeba vlastní `location`, protože WebSocket vyžaduje předání hlaviček `Upgrade` a `Connection` a `proxy_http_version 1.1`.
- nginx ve výchozím stavu zavře spojení bez provozu po 60 s (`proxy_read_timeout`). Pro `/api/ws` nastav delší limit, například 3600 s. Výpadky navíc řeší automatické připojení z kapitoly 12.4.
- `location /api/ws` musí s prefixem `/api` zacházet stejně jako stávající `location /api/`: buď ho oba odřezávají (`proxy_pass` s lomítkem na konci), nebo oba ponechávají. Podle toho mají být definované cesty ve FastAPI.

---

## 17. Změny kontraktu

- Každá změna je PR do `docs/kontrakt.md` a schvalují ji oba.
- Po změně zvýší autor PR `contract_version` (v hlavičce dokumentu i v `GET /api/health`), pokud jde o nekompatibilní změnu.
- Po změně kolega upraví mock a frontend, Adam backend.
- Přidat novou událost nebo nové pole je bezpečné. Přejmenovat nebo odebrat cokoli bezpečné není.

---

## 18. Kontrolní seznam před integrací

### Frontend s mockem

- [ ] Všechny čtyři scénáře projdou bez chyby v konzoli prohlížeče.
- [ ] Testovací řetězce z kapitoly 5.3 se zobrazí doslova.
- [ ] Událost neznámého typu stránku nerozbije.
- [ ] Po obnovení stránky se zobrazí stejný stav jako před ní.
- [ ] Po restartu mocku se WebSocket sám připojí a stav se obnoví.
- [ ] Dvojklik na „Schválit“ pošle jen jeden požadavek. Chyba 409 se zobrazí srozumitelně.
- [ ] Nový požadavek během aktivního běhu zobrazí chybu `RUN_ALREADY_ACTIVE`.
- [ ] Metriky s `null` se zobrazí jako „—“.
- [ ] Chybějící hlas nic nerozbije.

### Backend

- [ ] Všechny chyby mají tvar z kapitoly 7.4, i chyby validace (žádné 422).
- [ ] Neplatné `run_id` v URL vrací 404 `RUN_NOT_FOUND`.
- [ ] Každá událost je v `GET .../events` dřív, než odejde přes WebSocket.
- [ ] Souběžné `approve` a `reject` skončí jedním 200 a jedním 409.
- [ ] Texty od LLM jsou zkrácené na limity.
- [ ] WebSocket přes nginx vydrží několik minut bez provozu.

### Společně

- [ ] Skutečný běh projde frontendem stejně jako scénář z mocku.
