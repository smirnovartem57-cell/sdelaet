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
- `WINDOW_REPLACEMENT` — `RESEARCH`.
- `WINDOW_REPAIR` — `RESEARCH`.
- `BALCONY_FINISHING` — `RESEARCH`.
- `BALCONY_LEAK_REPAIR` — `RESEARCH`.

Routing and deterministic expert rules exist for all six categories. `BALCONY_GLAZING` now has category-specific parsing, follow-up, normalization, QA and full comparison E2E. The full validation suite is green before the deployment step; GitHub VDS SSH secrets remain an infrastructure blocker for automatic deploy only.

## Current focus
Finish manual/user-facing review and realistic contractor-offer checks for `BALCONY_GLAZING`, then decide `TESTING → READY`. Continue RESEARCH for the remaining four seasonal categories.

## Release discipline
A category is not ready because a form, routing rule or expert function exists. Follow `docs/product/CATEGORY_LIFECYCLE.md` and category-specific production gates.