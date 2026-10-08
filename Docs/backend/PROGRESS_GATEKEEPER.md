# Průběh WP-C/F/E

Stav k 2026-10-08: přidělené moduly i rozšířené integrační kontroly fasády jsou dokončené. Produkční akce ani commity se neprováděly; koordinátor řídí integraci a commity.

## Dokončené soubory

- `gatekeeper/{names,policy,static_analysis,manifest,plan_check,recipe}.py` a `policy/policy.yaml`: neměnná politika, path containment, AST, manifesty, struktura plánů, JSON DSL, zákaz výjimek a přeučení na konkrétní IP, přesná sémantika filtrů.
- `gatekeeper/{registry,audit,lessons}.py`, `scripts/verify_audit.py`: atomické soubory, SHA-256 kódu/manifestu/testů, karanténa, výchozí instalace a aktualizace, kandidáti, přesný recept a seznam kandidátů při povýšení, historie pravidel, počty použití, auditní řetěz a poučení.
- `gatekeeper/{evaluator,hidden_tests}.py`: pouze sandbox provádí kód; nezávislé incidenty a metriky, neutrální zásahy jiného útoku, anonymní příklady, kontraktové testy tří druhů dovedností, přesné skupiny a příslušnost řádků do časových oken.
- `tests/unit/{test_names,test_policy,test_static_analysis,test_manifest,test_plan_check,test_recipe,test_filter,test_audit,test_lessons,test_registry,test_evaluator,test_hidden_tests}.py` a fixture `tests/unit/conftest.py`.
- `tests/integration/test_gatekeeper_api.py`: 15 testů veřejné hranice vrátného včetně TOCTOU snapshotů, jediné validace i při souběhu/chybě, nejméně 4 LLM testů, falšování plánu/specifikace, změn receptu/disku, poučení a bezpečné zpětné vazby.

## Ověření

- Vlastní testy + datovým agentem napsaná kalibrace: **209 passed in 5.95s**, Python 3.12, `frankenstein-dev-tests`.
- Poslední doplněný regresní test snapshotů artefaktů při povýšení: sada registru **16 passed in 0.24s**. Celkově výše uvedený příkaz nyní sbírá 210 testů.
- A/B/C/E na tuning i validation: finální recepty mají precision/recall 1, FP/FN 0. První A s hranicí 25 má precision null, recall 0.
- AST pokrývá více než 40 škodlivých vzorků a 6 legitimních. Každý kód porušení plánů, manifestů a receptů má regresní test.
- Registr kryje integritu všech tří artefaktů, přesně povýší ověřený recept, nedělá částečnou instalaci při předběžném selhání a při chybě zápisu obnoví původní stav. Povýšení zapisuje předem ověřené snapshoty, takže pozdější změna kandidáta nezmění instalovaný kód.
- Peer review nalezla a opravila typové edgecases, spouštění těla třídy/default argumentů při importu, anonymní FP feedback, zachování kódů porušení v auditu a mutable návrhy napříč await ve fasádě (opravil koordinátor).

## Pokračování

Balíček nemá otevřené implementační kroky. Koordinátor pokračuje kompletní integrační sadou, izolovaným compose smoke a finálním reportem. Používaná rozhraní jsou skutečně implementována; nejsou potřeba další domnělé stuby.

```sh
docker exec -w /workspace/backend frankenstein-dev-tests python -m pytest tests/unit/test_names.py tests/unit/test_policy.py tests/unit/test_static_analysis.py tests/unit/test_manifest.py tests/unit/test_plan_check.py tests/unit/test_recipe.py tests/unit/test_filter.py tests/unit/test_audit.py tests/unit/test_lessons.py tests/unit/test_registry.py tests/unit/test_evaluator.py tests/unit/test_hidden_tests.py tests/integration/test_gatekeeper_api.py tests/integration/test_calibration.py -q
```
