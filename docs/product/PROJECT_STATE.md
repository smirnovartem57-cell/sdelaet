# PROJECT_STATE

Updated: 2026-09-13

## Product
«Сделает» turns a plain-language household repair task into a short technically sufficient Contractor Brief, finds/qualifies contractors, normalizes offers and explains which option is actually comparable and preferable.

## Current MVP focus
Domain: `CONSTRUCTION / HOME_REPAIR`.
Launch geography: Moscow + Moscow Oblast; category logic must remain Russia-wide.
External LLM is not a required dependency for the core flow.

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
- `UNDERFLOOR_HEATING` — `RESEARCH`, profile v0.1.
- `ENTRANCE_DOORS` — `RESEARCH`, profile v0.1.
- `DEMOLITION_WORKS` — `RESEARCH`, profile v0.1.
- `BATHROOM_RENOVATION` — `RESEARCH`, profile v0.1.
- `KITCHEN_INSTALLATION` — `RESEARCH`, profile v0.1.
- `WATER_HEATER_INSTALLATION` — `RESEARCH`, profile v0.1.
- `VENTILATION_EXHAUST` — `RESEARCH`, profile v0.1.
- `ROOF_REPAIR` — `TESTING`, profile v0.2.
- `FACADE_INSULATION` — `RESEARCH`, profile v0.1.
- `MOLD_REMEDIATION` — `RESEARCH`, profile v0.1.

## Current focus
Category factory automation is active. `config/service-categories.json` is the category registry; generated runtime/search registries, taxonomy, lifecycle tests and category QA/E2E runner are derived from it. Manual review for TESTING categories remains deferred. Production deployment remains a separate infrastructure gate until FirstVDS SSH secrets are restored.

## Category Production Agents
Dev-time pipeline uses 9 independent roles: research, domain expert, intake, contractor brief, comparison, consistency, technical QA, regression and release controller. New categories are created with `tools/category-agents/create-category.mjs`; lifecycle promotion to `EXPERT_MODEL`/`TESTING` uses `promote-category.mjs`. External LLM is not a required dependency.

## Release discipline
A category is not ready because a form, routing rule or expert function exists. Follow `docs/product/CATEGORY_LIFECYCLE.md` and category-specific production gates.
