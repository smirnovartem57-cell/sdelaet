# BALCONY_INSULATION — Agent Acceptance Tests

These cases are the minimum regression suite for Construction Domain Expert v1 + Technical Expert Reviewer v1.

## T01 — winter office, glazing exists

Input: «Хочу утеплить лоджию и сделать кабинет, пользоваться зимой. Остекление есть, менять не хочу. Мытищи, примерно 3 × 1 м.»

Expected:
- category `BALCONY_INSULATION`;
- no question about insulation material/thickness;
- glazing suitability remains a check, not a confirmed fact;
- Contractor Brief requests total, works/materials, exclusions, term, warranty;
- QA: `PASS_WITH_WARNINGS` until glazing suitability is confirmed.

## T02 — simple make-warmer scenario

Input: «На лоджии холодно. Хочу сделать теплее. Остекление есть. Отделки нет. Москва. Размеры примерно 3,2 × 1,1 м.»

Expected:
- preliminary quote is possible;
- system does not over-promise year-round comfort;
- exact construction layers are contractor-side;
- QA: `PASS` or `PASS_WITH_WARNINGS` depending on remaining uncertainty.

## T03 — condensation / mould

Input: «На балконе зимой мокрые углы и плесень, хочу утеплить чтобы это прошло.»

Expected:
- never state that insulation alone will solve the cause;
- risk: diagnosis/inspection required;
- missing geography and glazing/current-state details requested only if quote-critical;
- QA must not return clean `PASS` without warning.

## T04 — no dimensions

Input: «Хочу утеплить лоджию под ключ. Размеров не знаю.»

Expected:
- do not block the scenario on exact measurements;
- use `requires_site_inspection` for exact geometry;
- preliminary contractor request may proceed if other critical data is present;
- final price explicitly depends on measurement.

## T05 — cold glazing for year-round use

Input: «Хочу сделать из балкона комнату на весь год. Сейчас обычное холодное алюминиевое остекление.»

Expected:
- explicit risk/constraint regarding existing glazing;
- do not silently include window replacement inside insulation scope;
- request glazing solution as separate line/item;
- QA: `PASS_WITH_WARNINGS` or `EXPERT_REVIEW_REQUIRED` if structural/facade changes appear.

## T06 — room merging / radiator relocation

Input: «Объединить лоджию с комнатой, убрать блок и вынести батарею на лоджию.»

Expected:
- ordinary BALCONY_INSULATION flow must not treat this as a standard insulation-only task;
- flag separate legal/technical verification;
- central-heating radiator relocation is not approved automatically;
- QA: `EXPERT_REVIEW_REQUIRED`.

## T07 — incomplete cheap offer

Task includes full thermal contour + finish. Offer A: `31 000 ₽`, materials excluded, floor and ceiling omitted. Offer B: `37 000 ₽`, materials and full contour included.

Expected:
- A must not be ranked as cheaper comparable offer automatically;
- A marked incomplete/non-comparable until normalized;
- B can be more advantageous despite higher headline price.

## T08 — hidden existing finish

Input: «Балкон уже обшит, что внутри не знаю, зимой промерзает.»

Expected:
- hidden layers = `requires_site_inspection`;
- demolition/inspection may be separate cost;
- no invented statement about existing insulation thickness/material;
- QA: `PASS_WITH_WARNINGS`.

## Release gate

`BALCONY_INSULATION` cannot move from `EXPERT_MODEL` to `TESTING` until T01–T08 are reproducibly handled by the deterministic baseline or the LLM-backed agent using the same output contract.
