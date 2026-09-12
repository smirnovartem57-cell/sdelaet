# CHANGELOG

## 2026-09-12 — PLUMBING_WORKS moved to TESTING
- Completed research using SP 30.13330.2020 and Moscow/MO plumbing offer structures.
- Added scenario-aware intake: repair, fixture replacement, water distribution, drainage and point relocation.
- Added plumbing-specific parser/normalizer/follow-up for points/meters, pipe system, distribution scheme, drainage, demolition/chasing and pressure testing.
- Added safety/expert-review gates for active emergency leaks and riser/common-building work.
- Added 14 QA scenarios (`14/14 PASS`) and full E2E (`PASS`, complete 96 000 ₽ offer selected over `от 45 000 ₽`).
- Added search qualification and production wiring; manual user-facing review remains deferred before READY.

# 2026-09-12 — ELECTRICAL_INSTALLATION moved to TESTING
- Completed research and Expert Model for household electrical installation in apartments.
- Added routing, expert rules, parser fields, normalization and follow-up for points/lines, cable specification, route/chasing, panel/protection and post-install checks.
- Added 14 QA scenarios: `14/14 PASS`.
- Added full E2E: `PASS`; complete 148 000 ₽ offer selected over `от 95 000 ₽` incomplete offer.
- Added contractor search qualification and production wiring for the category.
- Manual user-facing review remains deferred before READY.

## 2026-09-12 — BALCONY_LEAK_REPAIR moved to TESTING
- Added diagnostic-first Expert Model and leak-source normalization.
- Added 14 QA scenarios: `14/14 PASS`.
- Added E2E: `PASS`; 18 000 ₽ diagnosed offer selected over `от 6 000 ₽` without confirmed cause.
- Manual user-facing review remains deferred before READY.

# 2026-09-12 — BALCONY_FINISHING moved to TESTING
- Completed category research on Moscow/MO estimate structure: demolition, substrate preparation, wall/ceiling finish, floor base/finish and optional extras.
- Added finishing-specific parser, normalization and follow-up rules.
- Added moisture gate: active dampness/mould/leak must be resolved before finish can be treated as comparable.
- Added 14 QA scenarios: `14/14 PASS`.
- Added full E2E: `PASS`, complete 72 000 ₽ offer selected over `от 35 000 ₽` incomplete offer.

# CHANGELOG

## 2026-09-12 — WINDOW_REPAIR moved to TESTING
- Completed category-specific RESEARCH for Moscow/MO window repair offers and pricing structure.
- Approved diagnostic-first Expert Model: adjustment, seals, hardware, glass unit and mounting-joint repairs are normalized as different scopes.
- Added repair-specific parser fields: visit/diagnostic cost, diagnosis, repair type and parts inclusion.
- Added category-specific normalization/follow-up, 14 QA scenarios (`14/14 PASS`) and full E2E (`PASS`, winner 2 500 ₽ over advertising price `от 800 ₽`).
- Manual user-facing review is deferred; `READY` remains blocked.

## 2026-09-12 — WINDOW_REPLACEMENT moved to TESTING
- Completed category-specific RESEARCH and approved Expert Model v1.1 for `WINDOW_REPLACEMENT`.
- Extended Offer Parser with window-specific fields: profile system, glass unit, hardware, sill, reveals and exterior flashing.
- Added window-specific normalization and follow-up rules. Offers without confirmed profile/glass/hardware, installation, required dismantling, sill, reveals or flashing are not treated as fully comparable.
- Added 14 QA scenarios; result `14/14 PASS`.
- Added `WINDOW_REPLACEMENT` E2E with three realistic offers; result `PASS`, selecting the complete 89 000 ₽ offer over a cheaper `от 55 000 ₽` headline.
- Regression checks for `BALCONY_GLAZING` and `BALCONY_INSULATION` remained green.
- Lifecycle changed `EXPERT_MODEL → TESTING`; manual user-facing review remains deferred and `READY` is still blocked.

## 2026-09-12 — BALCONY_GLAZING moved to TESTING
- Added glazing-specific Offer Parser fields: profile system, glass unit, opening scheme, parapet reinforcement and external water-management elements.
- Added glazing-specific normalization and follow-up rules.
- Added 14 QA scenarios; result `14/14 PASS`.
- Added `BALCONY_GLAZING` E2E covering category detection, Expert QA, three realistic offers, normalization, Recommendation Status, Comparison Explainer and Action Layer; result `PASS` with the complete 118 000 ₽ offer selected over a cheaper `от 75 000 ₽` offer.
- Restored two BALCONY_INSULATION safeguards discovered by the full regression suite: cold-glazing year-round warning and separate demolition of hidden old finish.
- Full GitHub validation step is green. Automatic VDS deploy remains blocked only by missing `VDS_HOST / VDS_USER / VDS_SSH_KEY` repository secrets.
- Lifecycle changed `EXPERT_MODEL → TESTING`; `READY` remains blocked pending manual user-facing review and remaining production-gate checks.

## 2026-09-12 — BALCONY_GLAZING research completed
- Completed category-specific RESEARCH for `BALCONY_GLAZING` using current normative references, manufacturer guidance and Moscow/MO market offers.
- Expanded `docs/product/EXPERT_MODELS/BALCONY_GLAZING.md` into an approved Expert Model.
- Added estimate decomposition, hidden extras, technical/commercial red flags, non-comparable cases and contractor search qualification.
- Updated profile to v1.1 and lifecycle `EXPERT_MODEL`.

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