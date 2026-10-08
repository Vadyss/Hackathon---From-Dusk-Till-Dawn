# WP-L – nezávislý Zkoušeč

2026-10-08: koordinátor potvrdil M0–M5 a přidělil volitelný P3 balíček. Zadání kapitoly 18 znovu přečteno.

- Implementován `Examiner(client).generate(attack_description, log_format)`.
- Do modelu jde pouze popis útoku a formát logu ve dvou oddělených nedůvěryhodných blocích; `context=None`. Žádný plán, katalog, pravidlo, data, štítky, identity ani seedy.
- Samostatný cachovaný anglický prompt, role `examiner` používá `LLM_MODEL_EXAMINER`.
- Oprava JSON nejvýš jednou; opakuje pouze stejné dva vstupy se statickým připomenutím. Chyby poskytovatele nebo neplatný kódový obal vracejí bezpečný `ParseFailure`.
- Plánovací prompt povoluje `custom_attack` pouze při přesném `catalog.examiner_enabled == true`.
- Testovací `MockExaminer` načítá pevný referenční generátor z `examiner/fixtures`; produkce jej nikdy neimportuje ani nespouští. Testy spouštějí vygenerovaný kód jen v omezeném podprocesu sandboxu.
- Gatekeeper integrace, validace/merge dat a aktivace v main zůstávají koordinátorovi.

Rozhodnutí: referenční generátor používá dokumentační IPv6 RFC 3849 s prefixem odvozeným ze SHA-256 seedu, aby identity obou sad byly disjunktní bez malého prostoru 254 IPv4 adres a surový seed se neobjevil ve vzorku. SSH parser IPv6 podporuje. Vrátný i tak ověřuje skutečnou disjunktnost obou sad.

Modulové testy: **15 passed**. Ověřena izolace vstupů a opravy JSON, samostatný model, offline sandbox provádění, determinismus, všechny platné indexy, 100% parseability, disjunktní identity a odmítnutí neplatného UTF-8 zdroje.

Pokračování: `docker exec -w /workspace/backend frankenstein-dev-tests python -m pytest tests/unit/test_examiner.py -q`.
