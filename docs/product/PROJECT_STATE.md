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
- `BALCONY_GLAZING` — `EXPERT_MODEL`, research PASS, profile v1.1.
- `WINDOW_REPLACEMENT` — `RESEARCH`.
- `WINDOW_REPAIR` — `RESEARCH`.
- `BALCONY_FINISHING` — `RESEARCH`.
- `BALCONY_LEAK_REPAIR` — `RESEARCH`.

Routing and deterministic expert rules exist for all six categories. `BALCONY_GLAZING` now has completed category-specific research covering normative references, manufacturer guidance, market offer structure, estimate lines, hidden extras, risk rules and contractor qualification.

## Current focus
Move `BALCONY_GLAZING` through `EXPERT_MODEL → TESTING`: category-specific offer parsing/normalization/follow-up, 12+ QA scenarios, realistic offers, search qualification regression and full E2E. In parallel continue RESEARCH for the remaining four seasonal categories.

## Release discipline
A category is not ready because a form, routing rule or expert function exists. Follow `docs/product/CATEGORY_LIFECYCLE.md` and category-specific production gates.