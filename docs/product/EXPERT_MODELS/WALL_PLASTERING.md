# Expert Model — WALL_PLASTERING

Status: TESTING
Profile: `wall-plastering` v0.2

## JTBD
Получить ровные стены под заданный финиш и сопоставимую смету без скрытой доплаты за толщину слоя, маяки, подготовку и армирование.

## Минимальный Intake
- под какой финиш готовим;
- тип основания;
- примерная площадь;
- наличие старого слоя;
- география / фото.

## Нормализация предложения
Обязательны: площадь, система штукатурки, средняя/максимальная толщина, подготовка, маяки, необходимость армирования, материалы, доплаты за слой/откосы, срок и гарантия.

Цена за м² без толщины и состояния основания не считается сопоставимой.

## Site inspection / red flags
Толщина определяется по фактической геометрии стен. Слабый старый слой, проблемное основание и необходимость сетки нельзя считать заранее подтверждёнными без осмотра.

## Current lifecycle gate
Category is in `TESTING`.

Confirmed automated evidence:
- category routing: PASS;
- deterministic Expert QA: `14/14 PASS`;
- full E2E: PASS;
- complete 92 000 ₽ offer is comparable and selected over advertising `от 350 ₽/м²`;
- incomplete advertising offer remains `NEEDS_CLARIFICATION`;
- complete 108 000 ₽ offer remains a valid `GOOD_ALTERNATIVE`;
- old plaster without demolition remains incomplete;
- missing thickness, primer and beacons trigger contractor follow-up;
- paint-preparation scenario surfaces higher geometry / preparation requirements.

Manual user-facing review 2026-09-27:
- Intake — PASS: target finish, base type, approximate area and old-layer state are requested in household language;
- measurement boundary — PASS: final geometry and layer thickness remain site-inspection facts, not user guesses;
- finish-quality boundary — PASS: preparation under paint is not treated as identical to basic plastering / wallpaper preparation;
- old-layer framing — PASS: weak / old plaster demolition must be explicit rather than hidden in extras;
- Contractor Brief — PASS: area, plaster system, average/max layer thickness, preparation/primer, beacons, reinforcement, materials, layer/slope extras, timing and warranty are requested explicitly;
- normalization — PASS: per-m² / `от` pricing without confirmed layer thickness and scope is not treated as a confirmed comparable total;
- follow-up — PASS: missing thickness, primer and beacons are asked from the contractor rather than inferred;
- recommendation/comparison — PASS: complete comparable scope outranks a cheaper incomplete headline price.

No critical UX/safety finding.

Before `READY`: canonical production publication must succeed and the executable lifecycle gate requires `releaseGate.productionDeploy = PASS`. While production is locked/unpublished the category remains `TESTING`. `READY → ACTIVE` remains separate and requires representative/live verification.

