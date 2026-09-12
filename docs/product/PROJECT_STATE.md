# PROJECT_STATE

Updated: 2026-09-12

## Product
«Сделает» turns a plain-language household repair task into a short technically sufficient Contractor Brief, finds/qualifies contractors, normalizes offers and explains which option is actually comparable and preferable.

## Current MVP focus
Domain: `CONSTRUCTION / HOME_REPAIR`.
Launch geography: Moscow + Moscow Oblast; category logic must remain Russia-wide.
External LLM is not a required dependency for the core flow.

## Category state
- `BALCONY_INSULATION` — `READY`, reference category, profile v1.1.
- `BALCONY_GLAZING` — `TESTING`, research PASS, Expert Model PASS, QA 14/14 PASS, E2E PASS, profile v1.1.
- `WINDOW_REPLACEMENT` — `TESTING`, research PASS, Expert Model PASS, QA 14/14 PASS, E2E PASS, profile v1.1.
- `WINDOW_REPAIR` — `TESTING`, research PASS, Expert Model PASS, QA 14/14 PASS, E2E PASS, profile v1.1.
- `BALCONY_FINISHING` — `TESTING`, research PASS, Expert Model PASS, QA 14/14 PASS, E2E PASS, profile v1.1.
- `BALCONY_LEAK_REPAIR` — `TESTING`, research PASS, Expert Model PASS, QA 14/14 PASS, E2E PASS, profile v1.1.
- `ELECTRICAL_INSTALLATION` — `TESTING`, research PASS, Expert Model PASS, QA 14/14 PASS, E2E PASS, profile v1.0.
- `PLUMBING_WORKS` — `TESTING`, research PASS, Expert Model PASS, QA 14/14 PASS, E2E PASS, profile v1.0.

Routing and deterministic expert rules exist for all seven categories. `BALCONY_GLAZING` and `WINDOW_REPLACEMENT` now have category-specific parsing, follow-up, normalization, QA and full comparison E2E. Manual user-facing review for TESTING categories is intentionally deferred.

`WINDOW_REPAIR` now has diagnostic-first parsing, normalization and follow-up: offers are comparable only after the defect/cause and repair type are clear.

## Current focus
Continue category production work without waiting for manual review: `ELECTRICAL_INSTALLATION` is now in TESTING; next categories are plumbing, radiators/heating and minor apartment repair. Return to manual review before promoting TESTING categories to READY.

## Release discipline
A category is not ready because a form, routing rule or expert function exists. Follow `docs/product/CATEGORY_LIFECYCLE.md` and category-specific production gates.