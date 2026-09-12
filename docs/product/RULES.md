# RULES

## Category development
1. Allowed lifecycle only: `IDEA`, `RESEARCH`, `EXPERT_MODEL`, `TESTING`, `READY`, `ACTIVE`, `SEASONAL_PAUSE`.
2. Form/routing presence never implies readiness.
3. Do not copy expert facts from another service category without category-specific verification.
4. Client Intake normally uses 3–6 primary actions and at most 1–3 trigger questions; every question must materially affect price, scope, technical solution, risk, contractor selection or comparability.
5. Do not ask users for professional solutions that the contractor/service must determine.
6. Facts that require site inspection must remain `unknown` / `requires_site_inspection` until verified.
7. External LLM must never be a mandatory dependency for the core task/brief/normalization/comparison path.
8. Recommendation must not be based on total price alone.
9. Trust uses provenance-aware `confirmed / claimed / unknown / risk`, never pseudo-precise reliability percentages.
10. `READY` requires the complete gate in `CATEGORY_LIFECYCLE.md`; `ACTIVE` additionally requires real product verification.
11. All categories must ultimately use the shared `GEO_CLASSIFIER`; category-specific hard-coded city logic is transitional only.