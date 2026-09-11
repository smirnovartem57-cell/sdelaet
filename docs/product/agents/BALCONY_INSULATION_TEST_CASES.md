# BALCONY_INSULATION — Agent Acceptance Tests

These cases are the minimum regression suite for Construction Domain Expert v1.1 + Technical Expert Reviewer v1.1.

## T01 — winter office, glazing exists
Input: «Хочу утеплить лоджию и сделать кабинет, пользоваться зимой. Остекление есть, менять не хочу. Мытищи, примерно 3 × 1 м.»
Expected: category `BALCONY_INSULATION`; no question about insulation material/thickness; glazing suitability remains a check, not a confirmed fact; Contractor Brief requests total, works/materials, exclusions, term, warranty; QA `PASS_WITH_WARNINGS` until glazing suitability is confirmed.

## T02 — simple make-warmer scenario
Input: «На лоджии холодно. Хочу сделать теплее. Остекление есть. Отделки нет. Москва. Размеры примерно 3,2 × 1,1 м.»
Expected: preliminary quote is possible; system does not over-promise year-round comfort; exact construction layers are contractor-side; QA `PASS` or `PASS_WITH_WARNINGS`.

## T03 — condensation / mould
Input: «На балконе зимой мокрые углы и плесень, хочу утеплить чтобы это прошло.»
Expected: never state that insulation alone will solve the cause; diagnosis/inspection required; QA must not return clean `PASS` without warning.

## T04 — no dimensions
Input: «Хочу утеплить лоджию под ключ. Размеров не знаю.»
Expected: exact measurements do not block the scenario; use `requires_site_inspection`; final price explicitly depends on measurement.

## T05 — cold glazing for year-round use
Input: «Хочу сделать из балкона комнату на весь год. Сейчас обычное холодное алюминиевое остекление.»
Expected: explicit risk regarding glazing; replacement is not silently included; glazing solution requested separately; QA `PASS_WITH_WARNINGS` or `EXPERT_REVIEW_REQUIRED` if structural/facade changes appear.

## T06 — room merging / radiator relocation
Input: «Объединить лоджию с комнатой, убрать блок и вынести батарею на лоджию.»
Expected: standard insulation flow stops; separate legal/technical verification; radiator relocation is not approved automatically; QA `EXPERT_REVIEW_REQUIRED`.

## T07 — incomplete cheap offer
Task includes full thermal contour + finish. Offer A: `31 000 ₽`, materials excluded, floor and ceiling omitted. Offer B: `37 000 ₽`, materials and full contour included.
Expected: A is non-comparable until normalized; B may rank above A despite higher headline price.

## T08 — hidden existing finish
Input: «Балкон уже обшит, что внутри не знаю, зимой промерзает.»
Expected: hidden layers = `requires_site_inspection`; demolition/inspection may be separate cost; no invented insulation composition; QA `PASS_WITH_WARNINGS`.

## Automated regression
Executable suite: `tests/balcony-insulation-regression.mjs`.

Current result: **8/8 PASS** for deterministic baseline v1.1.

## Release gate
`BALCONY_INSULATION` has passed the gate from `EXPERT_MODEL` to `TESTING`.

Moving from `TESTING` to `READY` requires:
- successful end-to-end test in the real `create-task → task-tz → requests → replies → compare` flow;
- at least several realistic contractor-response fixtures, including incomplete and ambiguous offers;
- verification that no expert result depends on an external LLM;
- manual review of user-facing wording and warnings.
