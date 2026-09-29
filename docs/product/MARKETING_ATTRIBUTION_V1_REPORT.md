# Marketing attribution v1 — implementation and acceptance report

Date: 2026-09-29

## Production
- Production SHA verified after final acceptance/documentation rollout: `f5e60771f4353cb5039537b4f39230f55c26954e`.
- Recorded production drift: empty.
- Public attribution runtime smoke: PASS.
- Post-rollout ProjectOS verification: deploy drift empty; production tree still contains getClientID, task attribution, CRM projection, retry-safe payment lifecycle and research attribution payload.

## Implemented
- Existing Yandex Metrika counter remains `112503660`; existing analytics bridge is extended, not replaced.
- First Touch: persisted once.
- Last Meaningful Touch: updated only by meaningful marketing visits; direct does not overwrite it.
- Captured fields: source, medium, campaign, content, term, YCLID, landing page, referrer, timestamp, intent cluster.
- Intent clusters include contractor_choose, contractor_check, contractor_compare, estimate_compare, contract_risk, repair_cost, repair_start.
- Metrika ClientID is obtained through `getClientID`, with retry and late binding.
- Server `task_attribution` stores immutable task snapshots and supports one ClientID to multiple tasks.
- Attribution is captured on first research run, before account/payment dependency.
- Server `crm_task_state` stores the full attribution JSON plus primary first/last/product/payment fields.
- Payment creation receives task attribution from the server source of truth.
- Confirmed payment success originates from the verified Tochka webhook; lifecycle projection is retry-safe.
- Privacy disclosure documents Metrika attribution and prohibits PII in analytics events.

## Metrika lifecycle
- task_created
- research_started
- result_ready
- result_viewed
- tariff_selected
- payment_start
- payment_success (browser goal only after server order reports paid; canonical payment fact is the Tochka webhook)

## Acceptance
1. Yandex CPC parameters / intent classification: PASS (automated).
2. Direct return preserves First and Last Meaningful Touch: PASS (automated).
3. Immutable task attribution snapshot contract: PASS (automated + production code deployed).
4. Yandex → Telegram changes Last Touch while preserving First Touch: PASS (automated).
5. Second task keeps same ClientID and receives new snapshot; first task remains unchanged: PASS (automated).
6. Public production runtime contains getClientID / First / Last / intent / task payload wiring: PASS.
7. Payment attribution and webhook-confirmed payment-success contract: PASS (automated); real bank payment not fabricated.
8. CRM server projection schema/lifecycle: PASS (automated); real task/payment rows require real user lifecycle.
9. Yandex Metrika source is registered in ProjectOS as `onsdelaet-russia / yandex-metrika`, but its current read-only datasets expose traffic sources, ecommerce and historical dimensions only; goal/event-parameter rows are not exposed. Actual visibility of the new reachGoal events therefore remains NOT VERIFIED through the available Data Gateway.
10. Actual real-bank payment_success: NOT EXECUTED intentionally; requires a genuine Tochka-approved payment.

## Main implementation PRs
- #110 task-level marketing attribution v1.
- #111 capture attribution at task creation/research.
- #113 retry-safe confirmed payment lifecycle.
- #115 deterministic Yandex → direct → Telegram acceptance sequence.

## Safety
No phone, email, name, exact address or free-form task description is intentionally added to Metrika goal parameters by attribution v1.
