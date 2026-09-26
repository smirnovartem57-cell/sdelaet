# PROJECT_STATE

Updated: 2026-09-26

## Product
«Сделает» turns a plain-language household repair task into a short technically sufficient Contractor Brief, finds/qualifies contractors, normalizes offers and explains which option is actually comparable and preferable.

## Current MVP focus
Domain: `CONSTRUCTION / HOME_REPAIR`.
Launch geography: Moscow + Moscow Oblast; category logic must remain Russia-wide.
External LLM is optional behind the shared Expert Runtime; deterministic local expert output remains authoritative on missing provider, timeout, error or invalid response.

## Repository and production topology

Canonical repository: `smirnovartem57-cell/sdelaet`.
Production host: FirstVDS.
Server deploy clone: `/home/sdelaet-runner/deploy-repo`.
Application tree: `/opt/sdelaet/current`.
Data/runtime state: `/var/lib/sdelaet`.
Canonical publication: `sdelaet-main-deploy.service` with `sdelaet-main-deploy.timer`.

### Operational snapshot — 2026-09-26
- GitHub `main`: `298e27a88719d9d696007092ada14f7ecbfb6ab7`.
- Recorded production baseline: `f542e1c0f810377ed751eeefc2263de9db9ab55e`.
- Server deploy checkout is currently on `local-v20-ui`, not `main`.
- `/var/lib/sdelaet/deploy/PRODUCTION_LOCKED` exists.
- No production publication is authorized from this state.
- Before any deploy, production changes must be reconciled into Git, parity must be proven against the recorded baseline, concurrent work preserved, and the compare-and-swap guard from `PUBLISH_POLICY.md` must pass immediately before mutation.

## Category state
- `BALCONY_FINISHING` — `TESTING`, profile v1.1; manual review PASS 2026-09-26, production deploy gate pending.
- `BALCONY_GLAZING` — `TESTING`, profile v1.1.
- `BALCONY_INSULATION` — `READY`, reference category, profile v1.2.
- `BALCONY_LEAK_REPAIR` — `TESTING`, profile v1.1; manual review PASS 2026-09-26, production deploy gate pending.
- `ELECTRICAL_INSTALLATION` — `TESTING`, profile v1.0.
- `FLOORING_INSTALLATION` — `TESTING`, profile v1.0.
- `INTERIOR_DOORS` — `TESTING`, profile v1.0.
- `MINOR_APARTMENT_REPAIR` — `TESTING`, profile v1.0.
- `PLUMBING_WORKS` — `TESTING`, profile v1.0.
- `RADIATOR_HEATING` — `TESTING`, profile v1.0.
- `STRETCH_CEILING` — `TESTING`, profile v1.0.
- `TILE_INSTALLATION` — `TESTING`, profile v1.0.
- `WALL_FINISHING` — `TESTING`, profile v1.0.
- `WINDOW_REPAIR` — `TESTING`, profile v1.1; manual review PASS 2026-09-26, production deploy gate pending.
- `WINDOW_REPLACEMENT` — `TESTING`, profile v1.1; manual review PASS 2026-09-26, production deploy gate pending.
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
Global SEO catalogue is generated from the category manifest for all 71 service categories at `/uslugi/<category-id>/`, including `BALCONY_INSULATION`, with unique metadata, canonical URLs, Service/Breadcrumb/FAQ structured data, related services, `sitemap.xml` and `robots.txt`. Expansion waves 1–4 added high-demand task-specific categories in honest `RESEARCH` state across private-house, site, flooring, plumbing, heating, climate, window, door and finishing work.

Category factory automation is active. `config/service-categories.json` is the category registry; generated runtime/search registries, taxonomy, lifecycle tests and category QA/E2E runner are derived from it. `tools/platform-readiness.mjs` is the canonical automated launch gate and runs independently in CI. All automated product gates pass; manual review for TESTING categories remains deferred. Pilot evidence is tracked separately in `config/pilot-verification.json`; synthetic E2E never counts as real-task verification. Production deployment is server-side on FirstVDS and no longer depends on GitHub SSH secrets. The canonical deploy is fail-closed on production parity, baseline SHA, `PUBLISH_LOCK`, readiness, health and post-deploy parity.

## Current public/product flow
- Canonical service registry: 71 categories.
- Unknown in-domain home/repair tasks use `universal-home-repair` instead of being blocked; they preserve free description, region, object/place, desired result and attachments, and are recorded as `unclassified_in_domain` taxonomy signals.
- Public pricing is the newer two-tier model: `Подбор` — 990 ₽ (up to 5 candidates, one additional search) and `До выбора` — 2 590 ₽ (up to 15 candidates, repeat search within the task). Eligible repeat customers receive account-level 30% pricing (690 / 1 790 ₽); this is not a third public tariff.
- v20 flow persists recognized photo geometry, automatic region, tariff/payment entitlement and paid navigation to candidates.
- Company enrichment includes legal-identity discovery and FNS facts: status, registration, capital, employees, finance, MSP and published tax debt when available.

## Go-to-market direction
- First commercial acquisition stage: B2C only. B2B is postponed until the B2C model is validated by real usage and revenue.
- Primary audiences: new-apartment owners, people starting/doing renovation, country-house owners/builders, users planning expensive point improvements, and users already comparing contractors/quotes and struggling to choose.
- The current 71-category registry is a launch catalogue, not a ceiling. Category expansion is demand-led and should follow high-ticket / high-error-cost / opaque-market opportunities.
- Marketing should target both service demand and decision-problem intent: compare estimates, understand scope, verify contractors, reduce choice risk.
- Expansion beyond home/repair remains a future option when the same research/verification/comparison model is economically attractive.

## Category Production Agents
Dev-time pipeline uses 9 independent roles: research, domain expert, intake, contractor brief, comparison, consistency, technical QA, regression and release controller. New categories are created with `tools/category-agents/create-category.mjs`; lifecycle promotion to `EXPERT_MODEL`/`TESTING` uses `promote-category.mjs`. External LLM is not a required dependency.

## Current operational priority

P0 is production reconciliation, not category promotion:

1. compare the running application/public webroot against recorded baseline `f542e1c0f810377ed751eeefc2263de9db9ab55e`;
2. identify server-only or newer production changes and preserve them in Git instead of overwriting them;
3. reconcile the canonical GitHub `main` with the production-owned delta and all current parallel PRs;
4. run Platform Readiness, Metrika regression and relevant product/category tests on the reconciled exact SHA;
5. remove the production lock only as an explicit release step after parity is proven;
6. publish through the canonical server-side deploy and verify post-deploy parity/exact SHA;
7. only then use `productionDeploy = PASS` as evidence for further `TESTING → READY` promotions.

## Current next work
- Priority category lifecycle work is now `TESTING → READY`, not repeated research.
- `BALCONY_GLAZING`: manual user-facing text review completed 2026-09-26; no critical issue found. Exact `main` Platform Readiness passed, but category promotion remains blocked while the required `productionDeploy` gate is not PASS. Keep `TESTING` until canonical production publication succeeds and the READY metadata is recorded explicitly.
- `WINDOW_REPLACEMENT`: manual user-facing review completed 2026-09-26; no critical issue found. Profile testing evidence is now PASS; READY remains blocked by the same canonical production-deploy requirement.
- `WINDOW_REPAIR`: manual user-facing review completed 2026-09-26; no critical issue found. Diagnostic-first, condensation and non-comparable `от` pricing safeguards remain intact; READY remains blocked by canonical production-deploy evidence.
- `BALCONY_FINISHING`: manual user-facing review completed 2026-09-26; no critical issue found. Moisture, hidden-demolition/preparation and complete-scope safeguards remain intact; READY remains blocked by canonical production-deploy evidence.
- `BALCONY_LEAK_REPAIR`: manual user-facing review completed 2026-09-26; no critical issue found. Source-localization, condensation and anti-masking safeguards remain intact; READY remains blocked by canonical production-deploy evidence.
- Remaining seasonal TESTING categories still require the same manual-review + fresh-gate sequence.
- Production publication remains fail-closed under `PUBLISH_POLICY.md`. For categories promoted to `READY`, the current lifecycle regression also requires `releaseGate.productionDeploy = PASS`, so a locked/unpublished production state is a category READY blocker.

## Release discipline
A category is not ready because a form, routing rule or expert function exists. Follow `docs/product/CATEGORY_LIFECYCLE.md` and category-specific production gates.
