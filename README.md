# Frankenstein

Backend vytváří a ověřuje pravidla detekce útoků, staví chybějící dovednosti v izolovaném sandboxu a ukládá je až po schválení analytikem. Implementace zachovává frontendový kontrakt v1.

Spuštění, konfigurace, testy a známá omezení: [Docs/backend/REPORT.md](Docs/backend/REPORT.md). Architektura: [Docs/backend/ARCHITECTURE.md](Docs/backend/ARCHITECTURE.md). Předávka frontendu: [Docs/backend-handoff.md](Docs/backend-handoff.md).

Testy v Pythonu 3.12:

```sh
backend/scripts/test.sh -q
```

Plán práce je v [PLAN.md](PLAN.md); obnovitelný stav v [PROGRESS.md](PROGRESS.md).
