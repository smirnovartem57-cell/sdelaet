# BACKLOG

## P1 — finish TESTING → READY for priority categories

The seasonal package is no longer in research: `BALCONY_GLAZING`, `WINDOW_REPLACEMENT`, `WINDOW_REPAIR`, `BALCONY_FINISHING` and `BALCONY_LEAK_REPAIR` are already in `TESTING` with category-specific research, Expert Models, parser/normalizer/follow-up logic, QA and E2E coverage.

Current P1 sequence:

1. manually review user-facing Intake, warnings, Contractor Brief, recommendation and comparison text;
2. re-run the full category readiness gate on the latest `main`;
3. resolve any regression against the current shared offer/search runtime;
4. record the manual-review evidence in the category Expert Model/profile;
5. require canonical production publication evidence (`releaseGate.productionDeploy = PASS`) before READY;
6. promote `TESTING → READY` explicitly only after all current gates pass;
7. keep `READY → ACTIVE` separate and require representative/live product verification.

`BALCONY_GLAZING` manual text review was completed on 2026-09-26 with no critical UX/safety finding, and exact-main Platform Readiness passed. Its remaining blocker is the required production-deploy gate while production is locked; do not mark READY before that evidence exists.

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