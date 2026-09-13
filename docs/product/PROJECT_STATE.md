# PROJECT_STATE

Updated: 2026-09-13

## Product
«Сделает» turns a plain-language household repair task into a short technically sufficient Contractor Brief, finds/qualifies contractors, normalizes offers and explains which option is actually comparable and preferable.

## Current MVP focus
Domain: `CONSTRUCTION / HOME_REPAIR`.
Launch geography: Moscow + Moscow Oblast; category logic must remain Russia-wide.
External LLM is optional behind the shared Expert Runtime; deterministic local expert output remains authoritative on missing provider, timeout, error or invalid response.

## Category state
- `BALCONY_FINISHING` — `TESTING`, profile v1.1.
- `BALCONY_GLAZING` — `TESTING`, profile v1.1.
- `BALCONY_INSULATION` — `READY`, reference category, profile v1.1.
- `BALCONY_LEAK_REPAIR` — `TESTING`, profile v1.1.
- `ELECTRICAL_INSTALLATION` — `TESTING`, profile v1.0.
- `FLOORING_INSTALLATION` — `TESTING`, profile v1.0.
- `INTERIOR_DOORS` — `TESTING`, profile v1.0.
- `MINOR_APARTMENT_REPAIR` — `TESTING`, profile v1.0.
- `PLUMBING_WORKS` — `TESTING`, profile v1.0.
- `RADIATOR_HEATING` — `TESTING`, profile v1.0.
- `STRETCH_CEILING` — `TESTING`, profile v1.0.
- `TILE_INSTALLATION` — `TESTING`, profile v1.0.
- `WALL_FINISHING` — `TESTING`, profile v1.0.
- `WINDOW_REPAIR` — `TESTING`, profile v1.1.
- `WINDOW_REPLACEMENT` — `TESTING`, profile v1.1.
- `WALL_PLASTERING` — `TESTING`, profile v0.2.
- `FLOOR_SCREED` — `TESTING`, profile v0.2.
- `DRYWALL_PARTITIONS` — `TESTING`, profile v0.2.
- `SOUNDPROOFING` — `TESTING`, profile v0.2.
- `BATHROOM_WATERPROOFING` — `TESTING`, profile v0.2.
- `UNDERFLOOR_HEATING` — `TESTING`, profile v0.2.
- `ENTRANCE_DOORS` — `TESTING`, profile v0.2.
- `DEMOLITION_WORKS` — `TESTING`, profile v0.2.
- `BATHROOM_RENOVATION` — `TESTING`, profile v0.2.
- `KITCHEN_INSTALLATION` — `TESTING`, profile v0.2.
- `WATER_HEATER_INSTALLATION` — `TESTING`, profile v0.2.
- `VENTILATION_EXHAUST` — `TESTING`, profile v0.2.
- `ROOF_REPAIR` — `TESTING`, profile v0.2.
- `FACADE_INSULATION` — `TESTING`, profile v0.2.
- `MOLD_REMEDIATION` — `TESTING`, profile v0.2.

## Current focus
Category factory automation is active. `config/service-categories.json` is the category registry; generated runtime/search registries, taxonomy, lifecycle tests and category QA/E2E runner are derived from it. `tools/platform-readiness.mjs` is the canonical automated launch gate and runs independently in CI. All automated product gates pass; manual review for TESTING categories remains deferred. Pilot evidence is tracked separately in `config/pilot-verification.json`; synthetic E2E never counts as real-task verification. Production deployment remains a separate infrastructure gate until FirstVDS SSH secrets are restored.

## Category Production Agents
Dev-time pipeline uses 9 independent roles: research, domain expert, intake, contractor brief, comparison, consistency, technical QA, regression and release controller. New categories are created with `tools/category-agents/create-category.mjs`; lifecycle promotion to `EXPERT_MODEL`/`TESTING` uses `promote-category.mjs`. External LLM is not a required dependency.

## Release discipline
A category is not ready because a form, routing rule or expert function exists. Follow `docs/product/CATEGORY_LIFECYCLE.md` and category-specific production gates.
