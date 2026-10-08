# P3 – ověřování dat nezávislého Zkoušeče

Dokončeno 2026-10-08 po dokončení M0–M5; produkční operace se neprováděly.

## Implementace

- `gatekeeper/examiner_data.py`: `prepare_datasets(run_id, slug, code, baseline_datasets, sandbox, policy, skill_loader)` vrací `{"tuning": Dataset, "validation": Dataset}`.
- Pouze přesný `generate(seed)`; adaptér `run(inputs, params)` projde stejnou AST politikou jako dovednosti. Neplatné importy, vstupní body, Unicode, limity nebo výstupy se odmítají.
- Dva soukromé náhodné seedy. Generátor se provede pouze v sandboxu. Štítky jsou neprázdné, jedinečné a nepřekrývající se, indexy platné, instancí je nejméně 6 na sadu.
- Vygenerované řádky a pevný běžný provoz ověří `ssh_parser` s kontrolovaným otiskem; pokrytí generátoru musí být alespoň 95 %, všechny označené řádky musí být rozpoznané. Ověřuje se také limit vstupu, délka řádků a formát IP adres.
- Běžný provoz generovaný Zkoušečem se zahodí. Falešné poplachy se měří výhradně nad pevným běžným provozem z původních dat. Data se řadí podle skutečně rozparsovaného času a indexy útoků se přepočítají.
- IP i uživatelské identity všech ponechaných řádků jsou mezi sadami disjunktní, včetně porovnání vygenerovaného útoku s pevným běžným provozem opačné sady.
- `Registry.save_examiner_data()` uloží soukromý adresář atomickým přejmenováním, vrátí čtyři otisky souborů a odmítne opakovaný zápis. Metadata seed neobsahují. `data` je rezervováno a nenabízí se jako kandidátní dovednost.

## Regresní opravy po bezpečnostní revizi

- Zdrojový kód s neplatným UTF-8 vrací `INVALID_OUTPUT`; recept a manifest také odmítají neplatný Unicode před další serializací. Kanonické JSON zachovává stejnou identitu pro platné vstupy.
- Audit je součástí transakce povýšení. Selhání auditu vrátí instalaci a pravidlo zpět; selhání úklidu po úspěšném zápisu a auditu nemění úspěšný výsledek schválení. Úklid dočasných složek je rovněž best effort.

## Ověření a předání

Poslední cílená sada: **65 passed in 6.47s** (`test_examiner_data`: 31 testů; registr: 19 testů; veřejná fasáda: 15 testů). Testy provádějí kód skutečným izolovaným runnerem a pokrývají determinismus, správné slučování, přepočítání štítků, špatný kód/výstup/IP/Unicode, limity, parse coverage, disjunktnost, perzistenci, rezervovaný název a chyby po commit pointu.

```sh
docker exec -w /workspace/backend frankenstein-dev-tests python -m pytest tests/unit/test_examiner_data.py tests/unit/test_registry.py tests/integration/test_gatekeeper_api.py -q
```

Rozhraní jsou stabilní. Koordinátor vlastní integraci fasády/pipeline, kompletní sadu, Docker build a konečný report. Další editace tohoto balíčku nejsou plánované.
