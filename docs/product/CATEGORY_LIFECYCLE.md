# Category lifecycle — Сделает

Source of truth for category release discipline.

Lifecycle:

`IDEA → RESEARCH → EXPERT_MODEL → TESTING → READY → ACTIVE → SEASONAL_PAUSE`

## RESEARCH
Category-specific research only. Do not copy technical knowledge from another category without verification. Research must cover: Jobs to be Done, scope variants, technical solutions, price drivers, mandatory/optional works, adjacent services, exclusions, hidden extras, technical and commercial risks, inspection-only facts, typical contractor mistakes, and reasons quotes are not comparable.

## EXPERT_MODEL
Required artifacts:
- `docs/product/EXPERT_MODELS/<SERVICE_CODE>.md`
- `assets/category-profiles/<category-id>.json`
- category-specific Client Intake
- Contractor Brief requirements
- search qualification rules
- offer normalization rules
- risk / QA model

Client Intake: normally 3–6 primary actions, plus 1–3 trigger questions only when the answer changes price, scope, technical solution, risk, contractor selection, or comparability. Prefer free text and photos over professional questionnaires.

## TESTING
Required automated coverage: category routing, Client Intake, Contractor Brief, Expert QA, Offer Parser, Follow-up, Normalizer, Recommendation Status, Comparison, and one category E2E.

## READY gate
Do not set `READY` until all are true: research complete; Expert Model complete; category specification complete; Intake and Brief tested; contractor search qualification configured; normalization and risk model work; QA/regressions pass; E2E passes; realistic complete, incomplete, ambiguous and alternative offers tested; deterministic fallback confirmed; user-facing texts manually reviewed.

## ACTIVE
`READY → ACTIVE` only after real product verification with live/representative tasks and offers.

## Global rules
- External LLM is never a mandatory dependency for the core flow.
- Geography uses one shared `GEO_CLASSIFIER`; launch focus is Moscow + Moscow Oblast, architecture is Russia-wide.
- Trust uses `confirmed / claimed / unknown / risk`, never pseudo-precise trust percentages.
- Recommendation is explained in plain language; never rank only by total price.
- A category form or routing rule alone never makes a category ready.