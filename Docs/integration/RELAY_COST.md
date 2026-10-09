# Timeout relay a cena LLM — integrační kontrola 2026-10-09

Relay má v nové lokální verzi celkový timeout 180 s a stejné HTTPX I/O limity;
odpovídá výchozímu `LLM_TIMEOUT_S=180` backendu. Nezměnily se způsob předání těla,
HTTP statusu, použití tokenu z prostředí ani potlačení logů. Oficiální dokumentace
Apify stanoví první odpověď do 5 minut a interní výběr běhu do 2 minut. Čas na
výběr/start se může přičíst k samotnému LLM volání. Není zavedené žádné domnělé
konfigurační pole pro timeout Standby.
[Dokumentace Standby](https://docs.apify.com/actors/development/programming-interface/standby#timeouts).

Nasazený Actor zůstává na timeoutu 120 s, dokud Adam nenahraje nový build a
Standby nezačne používat novou verzi. Agent nespouštěl deploy ani nezastavoval
vzdálené běhy. Z kořene repozitáře:

```sh
apify login
cd "apify/llm-relay"
apify push --build-tag latest
```

`usesStandbyMode: true` v `.actor/actor.json` se synchronizuje při push. V Console
zkontrolujte Standby build tag `latest`; starý běh může být nutné nechat doběhnout
dle idle timeoutu nebo jej ručně zastavit. `apify push` bez časově omezeného
`--wait-for-finish` standardně čeká na dokončení buildu.
[CLI push](https://docs.apify.com/cli/docs/reference#apify-actors-push--apify-push).

Backend nově vrací `summary.stats.cost_usd`: součet nezáporných konečných
číselných `usage.cost` z odpovědí LLM, včetně prázdných odpovědí a opakování kvůli
tokenům nebo parsování. Čítač je vázaný na běh stejně jako tokeny a volání,
funguje v async klientovi i synchronním `ask`. Hodnota je `null`, pokud žádná
odpověď neposkytla platnou cenu, a `0.0`, pokud poskytovatel oznámil nulovou cenu.
Při částečně chybějících cenách jde o součet oznámených hodnot; chybějící část
se neodhaduje. Cena nezahrnuje provoz Apify relay. Mock nemá cenu a vrací `null`.

Pro kolegu: jde pouze o zpětně kompatibilní rozšíření `RunStats` v kontraktu 1.
Stávající klienti a starší uložené události nové pole mohou ignorovat; jeho
zobrazení ve frontendu není implementováno.

Ověření v Pythonu 3.12 ve stávajícím testovacím kontejneru, bez síťových volání:

- Testy LLM/cost/modelů/událostí: 146 PASS; pokrývají součet, délkové opakování,
  prázdný obsah, izolaci běhů, synchronní API, nulovou/neznámou/neplatnou cenu,
  serializaci `summary` i kompatibilitu starších payloadů.
- Relay: 36 PASS; timeout klienta 180 s, vnější deadline, zachování odpovědí,
  absence citlivých informací v logu i chybách, startup/Standby nastavení.

Testy nepoužívají skutečný token, LLM ani internet. Politika, data a prahy metrik
se nezměnily. Jediné upozornění testovacího prostředí je deprecation warning
Starlette/AnyIO; všechny aserce procházejí.
