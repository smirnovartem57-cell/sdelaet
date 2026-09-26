# BALCONY_FINISHING — Expert Model

Lifecycle: `TESTING`
Profile: `assets/category-profiles/balcony-finishing.json`
Version: 1.1

## JTBD
Сделать внутреннюю отделку балкона/лоджии, переделать старую отделку либо завершить пространство после утепления так, чтобы сравнивались одинаковые составы работ, а декоративная обшивка не скрывала нерешённые дефекты.

## Client Intake
QUOTE_REQUIRED: объём отделки; поверхности; текущее состояние; примерные размеры или unknown; фото; география. Вопросы не должны превращаться в техническую анкету.

## Site inspection only
Точная площадь; ровность и прочность основания; скрытые дефекты; влажность; фактический объём демонтажа; необходимость выравнивания; состояние и уровень пола.

## Contractor must specify
Итоговую цену; работы/материалы; систему чистовой отделки; демонтаж; подготовку основания; конструкцию пола; исключения; доплаты; срок; замер; гарантию; условия договора; альтернативы.

## Estimate model
1. Демонтаж старой отделки/мебели.
2. Очистка, грунтование, выравнивание и иная подготовка основания.
3. Каркас/обрешётка/основание под отделку.
4. Стены и потолок: материал + монтаж.
5. Пол: черновое основание + финишное покрытие + плинтус.
6. Откосы, подоконники, пороги при наличии.
7. Доставка/подъём/вывоз.
8. Утепление, электрика, тёплый пол, мебель — отдельными строками, если входят в задачу.
9. Допработы после демонтажа — только как отдельный потенциальный риск/согласование.
## Non-comparable offers
- цена «от» против фиксированной сметы;
- только декоративная обшивка против сметы с демонтажом и подготовкой;
- стены/потолок против полного состава со стенами/потолком/полом;
- материалы заказчика против материалов исполнителя без пересчёта;
- утепление/электрика включены только в одной смете;
- неизвестная подготовка основания или пола при заявленном полном объёме.

## Technical risks / red flags
- Нельзя закрывать отделкой сырость, плесень или активную протечку без устранения причины.
- После демонтажа старой отделки возможны скрытые дефекты и дополнительные восстановительные работы.
- Цена за м² без перечня подготовительных операций не является полной сметой.
- «Под ключ» должно раскрываться по составу, а не приниматься как доказательство полноты.
- Утепление и электрика не должны автоматически считаться частью отделки.

## Search qualification
Исполнитель должен реально выполнять внутреннюю отделку балконов/лоджий в Москве/МО, работать с подготовкой основания и полом, уметь дать смету с материалами/работами и не быть только продавцом окон/материалов.

## Research evidence
12.09.2026 изучены актуальные московские/МО предложения и прайс-листы. На рынке отдельно тарифицируются демонтаж, подготовка, обрешётка/основание, стены/потолок, черновой и чистовой пол, откосы/подоконники и дополнительные работы. Утепление/электрика часто являются отдельными опциями. Отдельно подтверждён риск закрытия сырого основания отделкой.

## Current lifecycle gate
Category is in `TESTING`.

Confirmed automated evidence:
- QA: `14/14 PASS`;
- E2E: `PASS`;
- complete 72 000 ₽ estimate is comparable and selected over `от 35 000 ₽`;
- missing floor scope is treated as critical for a full walls/ceiling/floor task;
- unknown preparation/demolition triggers clarification;
- wet substrate / active moisture blocks comparability until the cause is resolved;
- recommendation, comparison explanation and Action Layer are generated from comparable scope.

Manual user-facing review 2026-09-26:
- Intake — PASS: scope, surfaces, current state, dimensions and photos stay within a short user-oriented flow;
- moisture safety — PASS: active dampness, mould or leaks must be resolved before decorative finishing is treated as comparable;
- scope transparency — PASS: `под ключ` is not accepted without explicit demolition, preparation, surfaces/floor and exclusions;
- Contractor Brief — PASS: total/work/material prices, finish system, preparation, floor base, demolition, exclusions, extra costs, timing, measurement, warranty and contract terms are requested explicitly;
- comparison — PASS: partial decorative cladding and `от` pricing cannot outrank a full comparable estimate;
- hidden-work framing — PASS: defects discovered after demolition remain an explicit uncertainty requiring separate agreement;
- Action Layer — PASS: next steps are based on the recommended comparable offer.

No critical UX/safety finding.

Before `READY`: canonical production publication must succeed and the executable lifecycle gate requires `releaseGate.productionDeploy = PASS`. While production is locked/unpublished the category remains `TESTING`. `READY → ACTIVE` stays separate and requires representative/live verification.
