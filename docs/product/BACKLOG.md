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

## SEO category expansion
- ✅ Generated indexable landing pages for all 71 categories from the canonical manifest.
- ✅ Added canonical URLs, structured data, internal linking, sitemap and robots directives.
- ✅ Expansion wave 1 added 11 categories for renovation, electrical, finishing, climate and plumbing demand.
- ✅ Expansion wave 2 added 10 categories for private houses, roofs, foundations, facades, utilities and site work.
- ✅ Expansion wave 3 added 10 categories for flooring, plumbing fixtures, heating systems, boilers and climate service.
- ✅ Expansion wave 4 added 10 categories for windows, doors, locks and task-specific finishing.
- Next: research and promote expansion categories through `EXPERT_MODEL` and `TESTING`; continue SEO expansion in separate waves.

- ✅ Unknown in-domain tasks now use the universal home/repair scenario instead of a category dead-end; raw requests are recorded as taxonomy signals for future catalogue expansion.

## Shared platform backlog
- ✅ Implemented shared `GEO_CLASSIFIER`: rawGeo → canonical region/locality/stable IDs, with confirmed Moscow/MO aliases and explicit uncertainty for unresolved localities.
- ✅ Extended the shared normalized offer schema with delivery, dismantling, contract terms, alternatives, uncertainties and missing items across all categories.
- ✅ Made contractor qualification category-aware with service/exclusion signals, geographic compatibility, source strength and explicit verification state; the common discover → deduplicate → qualify → enrich → verify → rank → shortlist → outreach pipeline is retained.
- ✅ External LLM is optional behind Expert Runtime: local expert output is produced first and retained on missing provider, timeout, error or invalid response.