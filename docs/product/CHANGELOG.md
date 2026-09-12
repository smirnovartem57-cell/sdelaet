# CHANGELOG

## 2026-09-12 — BALCONY_GLAZING research completed
- Completed category-specific RESEARCH for `BALCONY_GLAZING` using current normative references, manufacturer guidance and Moscow/MO market offers.
- Expanded `docs/product/EXPERT_MODELS/BALCONY_GLAZING.md` into an approved Expert Model.
- Added estimate decomposition, hidden extras, technical/commercial red flags, non-comparable cases and contractor search qualification.
- Updated profile to v1.1 and lifecycle `EXPERT_MODEL`; `TESTING` and `READY` remain blocked.

## 2026-09-12 — Category lifecycle governance
- Added mandatory lifecycle `IDEA → RESEARCH → EXPERT_MODEL → TESTING → READY → ACTIVE → SEASONAL_PAUSE`.
- Added `docs/product/CATEGORY_LIFECYCLE.md`.
- Added `docs/product/EXPERT_MODELS/` registry and Expert Model/research dossiers.
- Reclassified five new seasonal categories from non-standard `DRAFT` to `RESEARCH`.
- Kept `BALCONY_INSULATION` as the only `READY` reference category.
- Added lifecycle metadata, trigger-question limit and extended contractor response requirements to new category profiles.
- Added category routing and category-specific deterministic expert rules for six seasonal categories.
- Added seasonal routing and expert regression tests.
- Added `PROJECT_STATE.md`, `SERVICE_TAXONOMY.md` and `BACKLOG.md` as project knowledge sources.

This change intentionally prevents routing/form completion from being treated as category readiness.