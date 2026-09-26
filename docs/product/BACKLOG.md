# BACKLOG

## P0 — reconcile production before any publication

Current operational state on 2026-09-26 is intentionally fail-closed:

- audit-start GitHub `main`: `298e27a88719d9d696007092ada14f7ecbfb6ab7`; current exact `main` must be re-read immediately before release;
- recorded production baseline: `f542e1c0f810377ed751eeefc2263de9db9ab55e`;
- server deploy checkout: `local-v20-ui`, currently pointing to the same `f542e1c0f810377ed751eeefc2263de9db9ab55e` baseline;
- `/var/lib/sdelaet/deploy/PRODUCTION_LOCKED` is present.

Required sequence:

1. prove production parity/drift against the recorded baseline for both `/opt/sdelaet/current` and public webroot; the local deploy branch already points at the baseline, but runtime/public parity still requires verification;
2. preserve every production-only/newer change in Git before any overwrite;
3. refresh/reconcile current feature/documentation/category work against the latest canonical `main`;
4. run the full readiness + Metrika + relevant product/category regression set on the reconciled exact SHA;
5. re-check baseline/parity immediately before mutation;
6. explicitly remove the production lock only when the release is ready;
7. publish through `sdelaet-main-deploy.service`;
8. verify exact production SHA, site/API health and post-deploy parity;
9. restore/confirm timer state.

Until this P0 is complete, `productionDeploy = PASS` is unavailable and categories that require it must remain below READY.

## P1 — finish TESTING → READY for priority categories

The seasonal package is no longer in research: `BALCONY_GLAZING`, `WINDOW_REPLACEMENT`, `WINDOW_REPAIR`, `BALCONY_FINISHING` and `BALCONY_LEAK_REPAIR` are already in `TESTING` with category-specific research, Expert Models, parser/normalizer/follow-up logic, QA and E2E coverage.

Current P1 sequence:

1. manually review user-facing Intake, warnings, Contractor Brief, recommendation and comparison text;
2. re-run the full category readiness gate on the latest `main`;
3. resolve any regression against the current shared offer/search runtime;
4. record the manual-review evidence in the category Expert Model/profile;
5. require canonical production publication evidence (`releaseGate.productionDeploy = PASS`) before READY;
6. promote `TESTING → READY` explicitly only after all current gates pass;
7. keep `READY → ACTIVE` separate and require representative/live product verification.

`BALCONY_GLAZING` manual text review was completed on 2026-09-26 with no critical UX/safety finding, and exact-main Platform Readiness passed. Its remaining blocker is the required production-deploy gate while production is locked; do not mark READY before that evidence exists.

`WINDOW_REPLACEMENT` manual text review was completed on 2026-09-26 with no critical UX/safety finding. QA 14/14 and E2E remain PASS; profile manual-review evidence is PASS. Its remaining READY blocker is also `productionDeploy = PASS`.

`WINDOW_REPAIR` manual text review was completed on 2026-09-26 with no critical UX/safety finding. QA 14/14 and E2E remain PASS; diagnostic-first and condensation safeguards were rechecked. Its remaining READY blocker is `productionDeploy = PASS`.

`BALCONY_FINISHING` manual text review was completed on 2026-09-26 with no critical UX/safety finding. QA 14/14 and E2E remain PASS; moisture, demolition/preparation and full-floor scope safeguards were rechecked. Its remaining READY blocker is `productionDeploy = PASS`.

`BALCONY_LEAK_REPAIR` manual text review was completed on 2026-09-26 with no critical UX/safety finding. QA 14/14 and E2E remain PASS; source-localization, condensation and anti-masking safeguards were rechecked. Its remaining READY blocker is `productionDeploy = PASS`.

`ELECTRICAL_INSTALLATION` manual text review was completed on 2026-09-26 with no critical UX/safety finding. QA 14/14 and E2E remain PASS; active-hazard, qualified-design and required protection/testing safeguards were rechecked. Its remaining READY blocker is `productionDeploy = PASS`.

`PLUMBING_WORKS` manual text review was completed on 2026-09-26 with no critical UX/safety finding. QA 14/14 and E2E remain PASS; emergency leak/riser handling, pressure testing and comparable-scope guards were rechecked. Its remaining READY blocker is `productionDeploy = PASS`.

`RADIATOR_HEATING` manual text review was completed on 2026-09-26 with no critical UX/safety finding. QA 14/14 and E2E remain PASS; emergency leak, relocation, riser/central-heating dependency and pressure-test safeguards were rechecked. Its remaining READY blocker is `productionDeploy = PASS`.

## SEO category expansion
- ✅ Generated indexable landing pages for all 71 categories from the canonical manifest.
- ✅ Added canonical URLs, structured data, internal linking, sitemap and robots directives.
- ✅ Expansion wave 1 added 11 categories for renovation, electrical, finishing, climate and plumbing demand.
- ✅ Expansion wave 2 added 10 categories for private houses, roofs, foundations, facades, utilities and site work.
- ✅ Expansion wave 3 added 10 categories for flooring, plumbing fixtures, heating systems, boilers and climate service.
- ✅ Expansion wave 4 added 10 categories for windows, doors, locks and task-specific finishing.
- Next: research and promote expansion categories through `EXPERT_MODEL` and `TESTING`; continue SEO expansion in separate waves.

- ✅ Unknown in-domain tasks now use the universal home/repair scenario instead of a category dead-end; raw requests are recorded as taxonomy signals for future catalogue expansion.

## Demand-led B2C expansion

- B2C is the only acquisition focus for the first commercial stage; B2B is deferred until the B2C model is proven with revenue and real task completion.
- Do not treat the current 71-service registry as a fixed product boundary.
- Build the next category waves from demand and audience research, prioritizing high-ticket, high-error-cost, comparison-heavy and opaque markets.
- Prioritize intent/situation clusters as well as service keywords: new apartment keys, active renovation, country-house ownership/building, expensive point improvements, multiple quotes/smetas, contractor comparison and uncertainty before purchase.
- Every proposed new niche should be screened for: average ticket, cost of a wrong choice, choice complexity, market opacity, supplier density, verification value, demand and ability to reach the user before commitment.
- Future expansion outside home/repair is allowed only when the same research → verify → normalize → compare → shortlist product value remains strong.

## Shared platform backlog
- ✅ Implemented shared `GEO_CLASSIFIER`: rawGeo → canonical region/locality/stable IDs, with confirmed Moscow/MO aliases and explicit uncertainty for unresolved localities.
- ✅ Extended the shared normalized offer schema with delivery, dismantling, contract terms, alternatives, uncertainties and missing items across all categories.
- ✅ Made contractor qualification category-aware with service/exclusion signals, geographic compatibility, source strength and explicit verification state; the common discover → deduplicate → qualify → enrich → verify → rank → shortlist → outreach pipeline is retained.
- ✅ External LLM is optional behind Expert Runtime: local expert output is produced first and retained on missing provider, timeout, error or invalid response.