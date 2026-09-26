# Expert Model — RADIATOR_HEATING

Status: TESTING  
Profile: `radiator-heating` v1.0  
Domain: `CONSTRUCTION / HOME_REPAIR / HEATING`

## JTBD
Пользователь хочет заменить, установить или обслужить радиатор и получить безопасную сопоставимую смету без неожиданных доплат за арматуру, стояк и отключение системы.

## Сценарии
- замена существующего радиатора;
- установка нового радиатора;
- замена кранов / клапанов / терморегулятора;
- перенос радиатора — только через `EXPERT_REVIEW_REQUIRED`;
- аварийная течь — сначала аварийное отключение / диагностика.

## Минимальный Intake
1. Что делаем.
2. Центральное или автономное отопление.
3. Количество радиаторов.
4. Нужны ли работы со стояком.
5. Фото радиатора, подводок и места установки — предпочтительно.

## Что обязан раскрыть исполнитель
- итоговую стоимость;
- модель, размер / секционность и применимость радиатора;
- схему подключения;
- краны, клапаны, терморегуляторы и комплектующие;
- демонтаж и монтаж;
- необходимость отключения и работ со стояком;
- опрессовку / проверку герметичности;
- исключения, доплаты, срок и гарантию.

## Нормализация
Предложения сравнимы только при одинаковом количестве приборов и сопоставимом составе: радиатор + подключение + арматура + демонтаж/монтаж + необходимые работы со стояком + проверка.

Цена `от` не считается подтверждённой стоимостью.

## Red flags
- перенос радиатора без технической проверки;
- вмешательство в общий стояк без согласования;
- отсутствие проверки герметичности после монтажа;
- предложение без спецификации прибора и арматуры;
- аварийная течь, которую пытаются оформить как обычный плановый монтаж.


## Current lifecycle gate
Category is in `TESTING`.

Confirmed automated evidence:
- category routing: PASS;
- deterministic Expert QA: `14/14 PASS`;
- full E2E: PASS;
- complete 42 000 ₽ replacement offer is comparable and selected over advertising `от 18 000 ₽`;
- advertising / incomplete offer remains `NEEDS_CLARIFICATION`;
- relocation and active leak scenarios route to `EXPERT_REVIEW_REQUIRED`;
- valves/riser/pressure-test omissions trigger clarification.

Manual user-facing review 2026-09-26:
- Intake — PASS: task type, system type, quantity and riser work are requested in household language; the user is not asked to design the heating system;
- central-heating framing — PASS: riser / management-company dependency is surfaced instead of hidden in a generic quote flow;
- emergency framing — PASS: active leak does not continue as ordinary estimate comparison;
- relocation framing — PASS: radiator relocation requires expert review before ordinary comparison;
- Contractor Brief — PASS: radiator specification, connection scheme, valves, riser work, demolition/mounting, pressure test, exclusions, extras, timing and warranty are requested explicitly;
- normalization — PASS: `от` pricing and offers without a confirmed comparable scope are not treated as confirmed total offers;
- follow-up — PASS: missing valves and pressure-test information is asked from the contractor rather than invented;
- recommendation/comparison — PASS: complete comparable scope outranks a cheaper incomplete headline price;
- Action Layer — PASS by the shared recommendation pipeline after comparable winner selection.

No critical UX/safety finding.

Before `READY`: canonical production publication must succeed and the executable lifecycle gate requires `releaseGate.productionDeploy = PASS`. While production is locked/unpublished the category remains `TESTING`. `READY → ACTIVE` remains separate and requires representative/live verification.
