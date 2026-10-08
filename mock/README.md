# Mock backend

Mock podle `Docs/kontrakt.md`, kapitola 13. Nemá žádné závislosti, stačí Node 22+.

```bash
node mock/server.mjs          # http://localhost:8001, WebSocket ws://localhost:8001/api/ws
```

Frontend proti mocku: ve složce `frontend/` vytvoř `.env.development.local` s tímto obsahem

```
NEXT_PUBLIC_API_BASE=http://localhost:8001
```

a spusť `npm run dev`. Soubor načítá jen `next dev`, do produkčního buildu se nedostane (kapitola 7.3).

Mock vybírá scénář podle textu požadavku:

| text obsahuje | scénář |
|---|---|
| `spray` (nebo nic z ostatních) | A: password spraying, agent staví dovednost |
| `distrib` | B: distribuovaný brute force, dovednost se znovu použije |
| `inject` | C: prompt injection v logu, vrátný zamítne výjimku |
| `fail` | D: kovárna selže |

Stav je jen v paměti. Po restartu mocku zmizí běhy i dovednosti nainstalované agentem.
