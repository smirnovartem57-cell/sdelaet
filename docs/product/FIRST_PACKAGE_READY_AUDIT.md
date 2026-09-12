# First package READY audit

Updated: 2026-09-12

Scope:
- BALCONY_INSULATION
- BALCONY_GLAZING
- WINDOW_REPLACEMENT
- WINDOW_REPAIR
- BALCONY_FINISHING
- BALCONY_LEAK_REPAIR

## Current lifecycle
- BALCONY_INSULATION — READY.
- The other five categories — TESTING; automated QA and category E2E pass, manual user-facing review intentionally deferred.

## READY gate audit
| Gate | State | Notes |
|---|---|---|
| Research | PASS | Category-specific research completed for all six categories. |
| Expert Model | PASS | Expert Model and category profile exist for all six. |
| Client Intake | PASS | Category routing/intake covered by regression tests. |
| Contractor Brief / Expert QA | PASS | Deterministic expert-agent coverage exists for all six. |
| Offer Parser | PASS | Category-specific parsing covered by QA scenarios. |
| Follow-up | PASS | Category-specific clarification logic exists. |
| Normalization / risks | PASS | Category-specific comparability rules covered by QA/E2E. |
| Recommendation / explanation / action | PASS | Shared deterministic layers tested by category E2E. |
| Realistic complete/incomplete/ambiguous offers | PASS | Covered in category QA/E2E suites. |
| Deterministic fallback without external LLM | PASS | Core category flow does not require external LLM. |
| Contractor search qualification | BLOCKED | Rules exist in Expert Models, but are not yet an executable production gate for all categories. |
| Production expert-layer wiring | BLOCKED | `assets/launch-v2.js` currently invokes the expert layer only for BALCONY_INSULATION. |
| Search backend category wiring | BLOCKED | `search-api/core.mjs` currently has automatic search config only for `balcony-insulation`; other categories can return CATEGORY_NOT_SUPPORTED. |
| Manual user-facing review | DEFERRED | User explicitly chose to perform this later. |
| Automatic VDS deploy | INFRA BLOCKED | GitHub VDS SSH secrets remain absent; this is separate from product logic. |

## Release rule
No TESTING category is promoted to READY until the three product blockers above are closed and the deferred manual review is completed.

## Immediate technical work
1. Wire Construction Domain Expert in the real UI for all six service codes.
2. Add automatic search config for all six category IDs.
3. Implement deterministic contractor qualification with category specialization + geography evidence and expose qualification state in search results.
4. Add regression tests for production wiring and contractor qualification.
5. Re-run the full validation gate and update this audit.
