Opravuje chybějící nginx API/WS proxy a chyby frontendu při inicializaci historie, opakování chybějících událostí a zobrazování zpráv/fází časové osy. Frontend nadále používá přímý backend origin dle kontraktu; jeho opravy jsou v samostatných fix(frontend): commitech.

Backend přidává zpětně kompatibilní summary.stats.cost_usd, bezpečně loguje chyby ukončování klientů; relay timeout je180s. Politika, metrikové prahy, data a Gatekeeper autorita se nezměnily. Vyčištěné prázdné legacy soubory a CI pokrytí všech sad.

Ověřeno:652 backend+sandbox,36relay,18frontend testů; TypeScript/ESLint a standardní Docker build; skutečné živé LLM A/B v UI i přes nginx3000;180s nečinný WS; zamítnutí, závod200/409, restart/persistence, mock demo; Chromium screenshoty, plain text/XSS a reload. Důkazy: Docs/integration/INTEGRATION_CHECK.md.

Předávka: Adam musí nasadit nový relay build pro vzdálený timeout180s; kolega řeší5high npm audit nálezů v lint dependencies a případné zobrazení ceny. Žádný cloud deploy nebyl proveden.
