# Rozhodnutí a otevřené otázky

1. SPEC.md označuje přiložený BACKEND_SPEC.md. Použit celý dodaný dokument, kontrakt z `Docs/kontrakt.md` má přednost.
2. Scénář D: kontraktový příklad jmenuje distinct_count_window, specifikace failure_ratio_window. Zvolen failure_ratio_window, protože po scénáři A je distinct_count_window instalován. Veřejné rozhraní dovoluje libovolné platné názvy a přesná sekvence událostí je zachována.
3. Examiner a samoopravy jsou výslovně P3/stretch; provádějí se až po zeleném M5. Vypnutý Examiner bezpečně odmítá nepodporované útoky.
4. Existující stack na 3000 se považuje za uživatelský; integrační container smoke bude izolovaný a nepoužije jeho data ani kontejnery.
5. Kontrakt příkladu Metrics má precision zaokrouhlené na dvě místa; skutečné hodnoty specifikace zaokrouhluje na tři. Příklad není omezení přesnosti.
6. Existující adresář `Docs/` se zachovává i pro backend dokumentaci. macOS názvy nerozlišuje, Linux ano; odkazy používají skutečnou velikost písmen `Docs/backend`.
