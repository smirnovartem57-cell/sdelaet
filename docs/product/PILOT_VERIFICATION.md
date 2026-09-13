# Pilot verification — first seasonal package

Purpose: prevent synthetic QA/E2E data from being treated as proof that a category is ready for `ACTIVE`.

## Scope
- BALCONY_INSULATION
- BALCONY_GLAZING
- WINDOW_REPLACEMENT
- WINDOW_REPAIR
- BALCONY_FINISHING
- BALCONY_LEAK_REPAIR

## Minimum evidence per category
1. Three anonymized real user tasks from Moscow or Moscow Oblast.
2. At least three real contractor offers per task: nine offers total.
3. One evidence reference per task. Store only a safe internal reference, never personal data or raw contacts.
4. A completed review date after checking routing, brief, normalization, risks and recommendation.

The tracker is `config/pilot-verification.json`.

Run `node tools/pilot-verification.mjs` to see progress. This command is informational and exits successfully while evidence is pending.

Run `node tools/pilot-verification.mjs --require-live` only for the `READY → ACTIVE` gate. It exits with code 2 until every category has sufficient real evidence.

Synthetic regression fixtures never increment `realTasks`, `realOffers` or `evidenceRefs`.
