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
- `RADIATOR_HEATING` — `TESTING`, research PASS, Expert Model PASS, QA 14/14 PASS, E2E PASS, profile v1.0.
- `MINOR_APARTMENT_REPAIR` — `TESTING`, research PASS, Expert Model PASS, QA 14/14 PASS, E2E PASS, profile v1.0.
- `TILE_INSTALLATION` — `TESTING`, research PASS, Expert Model PASS, QA 14/14 PASS, E2E PASS, profile v1.0.

Routing, deterministic expert rules, category-specific parsing, follow-up, normalization, search qualification and E2E coverage exist for all 10 launch categories. Mixed-category descriptions are now detected and marked for splitting into separate profile-specific Contractor Briefs. Manual user-facing review for TESTING categories is intentionally deferred.

## Current focus
Technical audit of the 10-category launch package. After automated audit fixes: run deferred manual user-facing review, resolve wording/UX findings, then promote eligible TESTING categories to READY. Production deployment remains a separate infrastructure gate.

## Category Production Agents
Dev-time pipeline из 8 независимых ролей введён в проект: research, domain expert, intake, contractor brief, comparison, technical QA, regression и release controller. Новые категории должны проходить `node tools/category-agents/run.mjs --all --ci`; внешняя LLM не является обязательной зависимостью.

## Release discipline
A category is not ready because a form, routing rule or expert function exists. Follow `docs/product/CATEGORY_LIFECYCLE.md` and category-specific production gates.