# WINDOW_REPAIR — Expert Model

Lifecycle: `TESTING`
Profile: `assets/category-profiles/window-repair.json`
Version: `1.1`
Research completed: 2026-09-12

## JTBD
Пользователь хочет устранить конкретную неисправность окна без ненужной полной замены: продувание/холод, плохое открывание и закрывание, неисправность фурнитуры, износ уплотнителя, повреждение стеклопакета, конденсат либо профилактическая регулировка.

## Минимальный Client Intake
`QUOTE_REQUIRED`: симптом, количество проблемных окон, фото, география. Возраст окна и срочность спрашиваются только если реально меняют выбор исполнителя или объём.

## Главный принцип категории
Сначала диагностируется причина и узел, затем сравнивается цена конкретного ремонта. Регулировка, замена уплотнителя, ремонт фурнитуры, замена стеклопакета и ремонт монтажного шва — разные объёмы и не должны сравниваться как одинаковые предложения.

## Что определяется только после осмотра
Геометрия створки, прижим, состояние фурнитуры и уплотнителя, состояние монтажного шва, точный дефект стеклопакета, причина продувания и причина конденсата.
## Что должен вернуть исполнитель
- стоимость выезда / диагностики;
- подтверждённую причину неисправности;
- конкретный вид ремонта;
- стоимость работ;
- входят ли детали / расходники;
- возможные дополнительные работы;
- срок;
- гарантию на работы и заменённые детали.

## Сметная модель
Отдельно нормализуются: диагностика/выезд, регулировка, уплотнитель, фурнитура/детали, стеклопакет, ремонт монтажного шва, расходники, доставка крупногабаритных деталей, дополнительные работы.

## Red flags
- диагноз по телефону без осмотра;
- автоматическая рекомендация полной замены окна при локальной неисправности;
- конденсат объявляется дефектом окна без проверки влажности, вентиляции и температурного режима;
- цена «от» без стоимости выезда и деталей;
- предложение не указывает, что именно ремонтируется.
## Несопоставимые предложения
- регулировка vs замена фурнитуры;
- работа без деталей vs работа с деталями;
- замена стеклопакета vs замена всего окна;
- ремонт монтажного шва vs регулировка створки;
- цена после диагностики vs рекламная цена «от».

## Search qualification
Исполнитель должен явно заниматься ремонтом/регулировкой окон в Москве и МО, выполнять диагностику, работать с фурнитурой/уплотнителями/стеклопакетами и уметь выдавать понятную расшифровку работ. Компании, которые только продают новые окна, не проходят qualification.

## Research evidence
Проверены актуальные предложения московского рынка: отдельно тарифицируются регулировка, уплотнитель, фурнитура, стеклопакеты, герметизация/монтажные швы и диагностика; часть цен указана «от» и уточняется после осмотра. Это подтверждает обязательность diagnostic-first normalization.

## Current lifecycle gate
Category is in `TESTING`.

Confirmed automated evidence:
- category routing: PASS;
- deterministic Expert QA: PASS;
- category-specific parser / normalizer / follow-up: PASS;
- QA regression: `14/14 PASS`;
- full E2E: PASS;
- complete diagnosed repair offer is comparable;
- advertising `от` price remains non-comparable and triggers clarification;
- condensation scenario without diagnosis is incomplete and cannot be treated as comparable;
- Action Layer is produced for the recommended comparable offer.

Manual user-facing review 2026-09-26:
- Intake — PASS: symptom first, quantity, optional age/urgency, photo guidance; no professional questionnaire;
- diagnostic framing — PASS: cause and repair type are established before comparing price;
- replacement restraint — PASS: local problems do not trigger automatic full-window replacement;
- condensation framing — PASS: condensation is not declared an inherent window defect without checking ventilation, humidity and temperature regime;
- Contractor Brief — PASS: visit/diagnostics cost, diagnosis, repair type, included works/parts, exclusions, extra costs, timing, warranty and contract terms are requested explicitly;
- recommendation/comparison — PASS: a complete 2 500 ₽ diagnosed repair beats an advertising `от 800 ₽` non-comparable offer;
- Action Layer — PASS: next steps are generated only from the recommended comparable offer.

No critical UX/safety finding.

Before `READY`: canonical production publication must succeed and the executable lifecycle gate requires `releaseGate.productionDeploy = PASS`. While production is locked/unpublished the category remains `TESTING`. `READY → ACTIVE` stays separate and requires representative/live verification.
