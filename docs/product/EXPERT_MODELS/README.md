# Expert Models registry

| Service code | Category | Lifecycle | Expert Model |
|---|---|---|---|
| `BALCONY_INSULATION` | Утепление балкона / лоджии | READY | complete / validated |
| `BALCONY_GLAZING` | Остекление балкона / лоджии | RESEARCH | research dossier |
| `WINDOW_REPLACEMENT` | Замена / установка окон | RESEARCH | research dossier |
| `WINDOW_REPAIR` | Ремонт / регулировка окон | RESEARCH | research dossier |
| `BALCONY_FINISHING` | Отделка балкона / лоджии | RESEARCH | research dossier |
| `BALCONY_LEAK_REPAIR` | Протечки / сырость балкона | RESEARCH | research dossier |

A research dossier is not an approved Expert Model. It becomes authoritative only after category-specific research, source verification, full specification, QA and regression gates described in `docs/product/CATEGORY_LIFECYCLE.md`.

Every model must eventually cover: JTBD, quote-required data, installation-only data, photo/automatic facts, contractor-only facts, estimate structure, hidden extras, technical/commercial red flags, non-comparable variants, search qualification, Contractor Brief, normalization and QA scenarios.