# Expert Model — WALL_FINISHING

Status: TESTING  
Profile: `wall-finishing` v1.0

## JTBD
Пользователь хочет получить готовые стены под выбранный финиш и сравнить предложения не по цене одного слоя, а по одинаковой подготовке основания и одинаковому результату.

## Сценарии
- подготовка + покраска;
- подготовка + обои;
- только подготовка стен;
- замена старых обоев / старой краски;
- повышенное качество поверхности под боковой свет.

## Минимальный Intake
1. Финиш: обои / покраска / только подготовка.
2. Что сейчас на стенах.
3. Обычное или повышенное качество финиша.
4. Примерная площадь.
5. Фото стен предпочтительнее дополнительных технических вопросов.

## Сметная модель
Обязательные строки зависят от сценария, но должны явно раскрывать:
- демонтаж старого покрытия, если он есть;
- грунтовку;
- шпаклёвку / локальное выравнивание;
- шлифовку под покраску;
- стеклохолст / армирование, если предлагается;
- покраску или поклейку обоев;
- материалы / расходники;
- сложные углы, откосы и локальный ремонт основания;
- исключения и возможные доплаты.

## Несопоставимые предложения
- «только покраска» против «подготовка + покраска»;
- подготовка под обои против подготовки под высококачественную покраску;
- смета без демонтажа старого покрытия против сметы с демонтажом;
- цена `от` без подтверждённого объёма подготовки.

## Red flags
- чистовая отделка по активной сырости / плесени;
- обещание идеальной покраски без оценки основания;
- подготовительные слои появляются только после начала работ;
- неизвестно, кто закупает краску, обои, клей и расходники.

## Current lifecycle gate
Category is in `TESTING`.

Confirmed automated evidence:
- category routing: PASS;
- deterministic Expert QA: `15/15 PASS`;
- full E2E: PASS;
- complete 76 000 ₽ paint offer is comparable and selected over advertising `от 18 000 ₽`;
- advertising / incomplete offer remains `NEEDS_CLARIFICATION`;
- complete 89 000 ₽ offer remains a valid `GOOD_ALTERNATIVE`;
- old wallpaper without demolition remains incomplete;
- active dampness / mold routes to `EXPERT_REVIEW_REQUIRED`;
- missing preparation / putty / sanding triggers contractor follow-up.

Manual user-facing review 2026-09-27:
- Intake — PASS: finish, current wall state, target finish quality and approximate area are requested in household language;
- preparation boundary — PASS: the user is not asked to prescribe technical layer composition; contractor must disclose primer, putty, sanding and other preparation;
- moisture framing — PASS: active dampness / mold is not hidden under cosmetic finishing and requires separate expert review;
- old-covering framing — PASS: replacement of old wallpaper / paint requires demolition to be included or clarified;
- quality framing — PASS: ordinary finish and high-quality paint preparation are not treated as identical scope;
- Contractor Brief — PASS: demolition, primer, putty, sanding, fiberglass when proposed, finish, materials, exclusions, extras, timing and warranty are requested explicitly;
- normalization — PASS: `от` pricing and finish-only offers without required preparation are not treated as confirmed comparable totals;
- follow-up — PASS: missing preparation and sanding are asked from the contractor rather than inferred;
- recommendation/comparison — PASS: complete comparable scope outranks a cheaper incomplete headline price;
- Action Layer — PASS by the shared recommendation pipeline after comparable winner selection.

No critical UX/safety finding.

Before `READY`: canonical production publication must succeed and the executable lifecycle gate requires `releaseGate.productionDeploy = PASS`. While production is locked/unpublished the category remains `TESTING`. `READY → ACTIVE` remains separate and requires representative/live verification.

