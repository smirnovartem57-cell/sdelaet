# BACKLOG

## P1 — seasonal category research
For each of `BALCONY_GLAZING`, `WINDOW_REPLACEMENT`, `WINDOW_REPAIR`, `BALCONY_FINISHING`, `BALCONY_LEAK_REPAIR`:

1. complete category-specific RESEARCH with authoritative technical/manufacturer sources;
2. collect representative Moscow/MO contractor offers and estimate structures;
3. document price drivers, mandatory lines, hidden extras and non-comparable variants;
4. define contractor search queries, qualification/exclusion/profile signals;
5. complete Expert Model and full category specification;
6. add category-specific normalization and follow-up rules;
7. prepare at least 12 Expert QA scenarios;
8. add parser/normalizer/comparison regressions and category E2E;
9. manually review user-facing Intake, warnings, Contractor Brief and recommendation text;
10. move status explicitly `RESEARCH → EXPERT_MODEL → TESTING → READY` only when gates pass.

## Shared platform backlog
- ✅ Implemented shared `GEO_CLASSIFIER`: rawGeo → canonical region/locality/stable IDs, with confirmed Moscow/MO aliases and explicit uncertainty for unresolved localities.
- ✅ Extended the shared normalized offer schema with delivery, dismantling, contract terms, alternatives, uncertainties and missing items across all categories.
- Make contractor search qualification category-aware while retaining common discover → deduplicate → qualify → enrich → verify → rank → shortlist → outreach pipeline.
- Keep external LLM optional with deterministic fallback.