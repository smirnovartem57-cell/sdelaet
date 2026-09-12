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
- `BALCONY_GLAZING` — `RESEARCH`.
- `WINDOW_REPLACEMENT` — `RESEARCH`.
- `WINDOW_REPAIR` — `RESEARCH`.
- `BALCONY_FINISHING` — `RESEARCH`.
- `BALCONY_LEAK_REPAIR` — `RESEARCH`.

Routing and preliminary deterministic expert rules already exist for all six categories. For the five `RESEARCH` categories these rules are working hypotheses, not release evidence.

## Current focus
Complete category-specific RESEARCH for the five new seasonal categories: verified technical sources, realistic offers/estimates, hidden extras, search qualification, normalization, 12+ QA scenarios and category E2E. Then progress explicitly through `EXPERT_MODEL → TESTING → READY`.

## Release discipline
A category is not ready because a form, routing rule or expert function exists. Follow `docs/product/CATEGORY_LIFECYCLE.md` and category-specific production gates.