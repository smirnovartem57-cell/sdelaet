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
- `BALCONY_INSULATION` — `READY`, reference category, profile v1.2.
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
- `APARTMENT_RENOVATION` — `RESEARCH`, profile v0.1.
- `ROOM_RENOVATION` — `RESEARCH`, profile v0.1.
- `KITCHEN_RENOVATION` — `RESEARCH`, profile v0.1.
- `WIRING_REPLACEMENT` — `RESEARCH`, profile v0.1.
- `ELECTRICAL_PANEL_INSTALLATION` — `RESEARCH`, profile v0.1.
- `WALLPAPER_INSTALLATION` — `RESEARCH`, profile v0.1.
- `WALL_PAINTING` — `RESEARCH`, profile v0.1.
- `CEILING_FINISHING` — `RESEARCH`, profile v0.1.
- `AIR_CONDITIONER_INSTALLATION` — `RESEARCH`, profile v0.1.
- `PIPE_REPLACEMENT` — `RESEARCH`, profile v0.1.
- `PLUMBING_FIXTURE_INSTALLATION` — `RESEARCH`, profile v0.1.
- `HOUSE_CONSTRUCTION` — `RESEARCH`, profile v0.1.
- `FOUNDATION_CONSTRUCTION` — `RESEARCH`, profile v0.1.
- `ROOF_INSTALLATION` — `RESEARCH`, profile v0.1.
- `FACADE_FINISHING` — `RESEARCH`, profile v0.1.
- `FENCE_INSTALLATION` — `RESEARCH`, profile v0.1.
- `SEPTIC_INSTALLATION` — `RESEARCH`, profile v0.1.
- `WELL_DRILLING` — `RESEARCH`, profile v0.1.
- `SITE_DRAINAGE` — `RESEARCH`, profile v0.1.
- `BLIND_AREA_CONSTRUCTION` — `RESEARCH`, profile v0.1.
- `PAVING_INSTALLATION` — `RESEARCH`, profile v0.1.
- `LAMINATE_INSTALLATION` — `RESEARCH`, profile v0.1.
- `LINOLEUM_INSTALLATION` — `RESEARCH`, profile v0.1.
- `QUARTZ_VINYL_INSTALLATION` — `RESEARCH`, profile v0.1.
- `PARQUET_INSTALLATION` — `RESEARCH`, profile v0.1.
- `BATHTUB_INSTALLATION` — `RESEARCH`, profile v0.1.
- `TOILET_INSTALLATION` — `RESEARCH`, profile v0.1.
- `SHOWER_CABIN_INSTALLATION` — `RESEARCH`, profile v0.1.
- `HEATING_SYSTEM_INSTALLATION` — `RESEARCH`, profile v0.1.
- `BOILER_INSTALLATION` — `RESEARCH`, profile v0.1.
- `AIR_CONDITIONER_SERVICE` — `RESEARCH`, profile v0.1.
- `WINDOW_SLOPE_FINISHING` — `RESEARCH`, profile v0.1.
- `WINDOW_SILL_INSTALLATION` — `RESEARCH`, profile v0.1.
- `MOSQUITO_NET_INSTALLATION` — `RESEARCH`, profile v0.1.
- `INSULATED_GLASS_REPLACEMENT` — `RESEARCH`, profile v0.1.
- `DOOR_REPAIR` — `RESEARCH`, profile v0.1.
- `LOCK_REPLACEMENT` — `RESEARCH`, profile v0.1.
- `DRYWALL_CEILING` — `RESEARCH`, profile v0.1.
- `WALL_PUTTY` — `RESEARCH`, profile v0.1.
- `DECORATIVE_PLASTER` — `RESEARCH`, profile v0.1.
- `KITCHEN_BACKSPLASH_INSTALLATION` — `RESEARCH`, profile v0.1.

## Current focus
Global SEO catalogue is generated from the category manifest for 70 service categories at `/uslugi/<category-id>/`, with unique metadata, canonical URLs, Service/Breadcrumb/FAQ structured data, related services, `sitemap.xml` and `robots.txt`. Expansion waves 1–4 added 41 high-demand task-specific categories in honest `RESEARCH` state, including private-house, site, flooring, plumbing, heating, climate, window, door and finishing work. `BALCONY_INSULATION` is deliberately excluded because it is being developed in a parallel workstream.

Category factory automation is active. `config/service-categories.json` is the category registry; generated runtime/search registries, taxonomy, lifecycle tests and category QA/E2E runner are derived from it. `tools/platform-readiness.mjs` is the canonical automated launch gate and runs independently in CI. All automated product gates pass; manual review for TESTING categories remains deferred. Pilot evidence is tracked separately in `config/pilot-verification.json`; synthetic E2E never counts as real-task verification. Production deployment remains a separate infrastructure gate until FirstVDS SSH secrets are restored.

## Category Production Agents
Dev-time pipeline uses 9 independent roles: research, domain expert, intake, contractor brief, comparison, consistency, technical QA, regression and release controller. New categories are created with `tools/category-agents/create-category.mjs`; lifecycle promotion to `EXPERT_MODEL`/`TESTING` uses `promote-category.mjs`. External LLM is not a required dependency.

## Release discipline
A category is not ready because a form, routing rule or expert function exists. Follow `docs/product/CATEGORY_LIFECYCLE.md` and category-specific production gates.
