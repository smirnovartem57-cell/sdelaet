# First package READY audit

Updated: 2026-09-13

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
| Contractor search qualification | PASS | Category-aware service/exclusion signals, Moscow/MO compatibility, source strength and verification state are executable and regression-tested. |
| Production expert-layer wiring | PASS | All registered categories use the shared expert runtime; local deterministic output is authoritative and external LLM enhancement is optional. |
| Search backend category wiring | PASS | Search configuration and generated registries cover every registered production category. |
| Manual user-facing review | DEFERRED | User explicitly chose to perform this later. |
| Automatic VDS deploy | INFRA BLOCKED | GitHub VDS SSH secrets remain absent; this is separate from product logic. |

## Release rule
All automated product gates are closed. TESTING categories remain below READY until the deferred manual user-facing review is completed. ACTIVE additionally requires representative live-task verification.

## Automated evidence
`node tools/platform-readiness.mjs` is the canonical automated gate. It runs independently in `.github/workflows/platform-readiness.yml` on pull requests and main pushes, and is reused before VDS deployment.

## Remaining external gates
1. Perform the intentionally deferred manual review of Intake, warnings, Contractor Brief and recommendation text.
2. Restore `VDS_HOST`, `VDS_USER` and `VDS_SSH_KEY` to enable automatic deployment and production smoke verification.
