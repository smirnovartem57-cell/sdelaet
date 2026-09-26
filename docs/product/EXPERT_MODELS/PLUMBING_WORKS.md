# EXPERT MODEL — PLUMBING_WORKS

Status: `TESTING`  
Profile: `assets/category-profiles/plumbing-works.json`  
Domain: `CONSTRUCTION / HOME_REPAIR / PLUMBING`

## JTBD
Пользователь описывает сантехническую задачу бытовым языком. Сервис должен определить сценарий, собрать только данные, влияющие на объём и смету, сформировать Contractor Brief и привести предложения к сопоставимому виду.

## Supported scenarios
- устранение протечки / неисправности;
- замена или установка смесителя, унитаза, раковины, ванны / душа;
- новая или переделываемая разводка ХВС/ГВС;
- канализация / слив;
- перенос сантехнических точек и комплексная переделка санузла.

## Client intake — minimum
1. Тип задачи.
2. Состояние помещения: ремонт / чистовая отделка / shell.
3. Примерный объём: приборы, точки, метры или помещения.
4. Можно ли перекрыть воду / затрагивается ли стояк.
5. Фото — рекомендуется, но не обязательно.

Пользователь не обязан сам выбирать материал труб, диаметры, коллекторную/тройниковую схему, фитинги или уклон канализации.
## Contractor must determine
- система труб/фитингов и применимые диаметры;
- схема разводки;
- трассы, способ прокладки и необходимость штробления;
- состав коллекторного/запорного узла;
- трасса канализации и уклоны;
- необходимость демонтажа и восстановления;
- способ проверки герметичности / опрессовки.

## Offer normalization
Сопоставимость определяется не общей ценой, а одинаковым сценарием и одинаковым составом работ.

Для новой разводки критичны:
- подтверждённая итоговая цена, не `от`;
- система труб;
- схема разводки;
- сам монтаж водоснабжения;
- канализация, если входит в задачу;
- демонтаж / штробление, если требуется;
- опрессовка / проверка герметичности;
- материалы, исключения, доплаты, срок и гарантия.

Замена одного смесителя не сравнивается с переделкой разводки, а цена «за точку» не сравнивается с комплексной сметой без нормализации состава.
## Expert / safety gates
`EXPERT_REVIEW_REQUIRED`:
- активная сильная протечка / затопление;
- работа со стояком или общедомовыми коммуникациями;
- задача, где невозможно безопасно локализовать воду до осмотра.

Сервис не утверждает без подтверждения причину скрытой протечки, пригодность существующих труб, требуемые диаметры, схему разводки или возможность вмешательства в стояк.

## Research basis
- СП 30.13330.2020 «Внутренний водопровод и канализация зданий» — действующая базовая техническая рамка.
- Московские предложения показывают разные единицы расчёта: точка, погонный метр, узел и комплекс.
- В реальных сметах отдельно встречаются материалы, демонтаж, штробление, коллектор, канализация, опрессовка, доставка/вывоз и минимальная стоимость заказа.

## Testing gate
- category routing;
- Expert QA;
- parser / follow-up / normalizer;
- 14+ QA scenarios;
- multi-offer E2E;
- search qualification;
- production wiring;
- manual user-facing review before `READY`.

## Current lifecycle gate
Category is in `TESTING`.

Confirmed automated evidence:
- category routing: PASS;
- deterministic Expert QA: PASS;
- category-specific parser / normalizer / follow-up: PASS;
- QA regression: `14/14 PASS`;
- full E2E: PASS;
- complete 96 000 ₽ distribution offer is comparable and selected over advertising `от 45 000 ₽`;
- incomplete offers trigger clarification for pipe system, distribution scheme and pressure testing;
- riser/emergency scenarios route to `EXPERT_REVIEW_REQUIRED`.

Manual user-facing review 2026-09-26:
- Intake — PASS: task type, room state and rough scope are asked in household language; the user is not asked to design pipes, diameters or distribution scheme;
- emergency framing — PASS: strong leak/flooding first requires water localization/shutoff and urgent inspection instead of ordinary estimate comparison;
- riser/common-property framing — PASS: riser or common-building work requires separate approval and responsibility check;
- Contractor Brief — PASS: total price, points/meters, pipe system, distribution scheme, drainage, demolition/chasing, pressure testing, exclusions, extras, timing and warranty are requested explicitly;
- normalization — PASS: incomplete or `от` offers remain non-comparable; new distribution requires pipe system, scheme, included water distribution and pressure testing;
- follow-up — PASS: missing critical technical/scope items are asked from the contractor rather than invented by the service;
- recommendation/comparison — PASS: complete comparable scope outranks a cheaper incomplete headline price;
- Action Layer — PASS: next actions are generated only from a comparable recommended offer.

No critical UX/safety finding.

Before `READY`: canonical production publication must succeed and the executable lifecycle gate requires `releaseGate.productionDeploy = PASS`. While production is locked/unpublished the category remains `TESTING`. `READY → ACTIVE` remains separate and requires representative/live verification.
