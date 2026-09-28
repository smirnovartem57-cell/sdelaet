# First package READY audit

Updated: 2026-09-28

Scope:
- BALCONY_INSULATION
- BALCONY_GLAZING
- WINDOW_REPLACEMENT
- WINDOW_REPAIR
- BALCONY_FINISHING
- BALCONY_LEAK_REPAIR

## Current lifecycle
- BALCONY_INSULATION — READY.
- The other five categories — `TESTING`; automated QA/E2E and manual user-facing review are PASS, but the executable READY gate still requires canonical `productionDeploy = PASS`.

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
| Manual user-facing review | PASS | Completed for BALCONY_GLAZING, WINDOW_REPLACEMENT, WINDOW_REPAIR, BALCONY_FINISHING and BALCONY_LEAK_REPAIR on 2026-09-26; BALCONY_INSULATION remains the READY reference. |
| Canonical production deploy | BLOCKED | Server-side deploy no longer depends on GitHub SSH secrets. Current blocker is production reconciliation/parity plus `/var/lib/sdelaet/deploy/PRODUCTION_LOCKED`; `productionDeploy = PASS` is unavailable until canonical publication succeeds. |

## Release rule
Automated product gates and manual user-facing review are closed for this six-category package. The five TESTING categories remain below READY only because the executable lifecycle gate requires canonical `productionDeploy = PASS`. ACTIVE additionally requires representative live-task verification.

## Automated evidence
`node tools/platform-readiness.mjs` is the canonical automated gate. It runs independently in `.github/workflows/platform-readiness.yml` on pull requests and main pushes, and is reused before VDS deployment.

## Remaining external gates
1. Reconcile running application/public webroot with the recorded production baseline without overwriting server-only work.
2. Remove `PRODUCTION_LOCKED` only as an explicit release step after parity/readiness are proven.
3. Publish through the canonical server-side deploy, verify exact SHA/site/API health/post-deploy parity, and record `productionDeploy = PASS` before TESTING → READY promotion.
