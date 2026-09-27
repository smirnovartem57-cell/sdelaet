# Expert Model — MINOR_APARTMENT_REPAIR

Status: TESTING  
Profile: `minor-apartment-repair` v1.0

## Назначение
Категория для небольших бытовых задач, которые разумно объединить в один выезд мастера, но которые не требуют профильного электрика, сантехника или специалиста по отоплению.

## Сценарии
- навес полок, карнизов, зеркал и других предметов;
- сборка / мелкий ремонт мебели;
- двери, ручки, петли, замки;
- локальные отделочные исправления;
- несколько мелких задач одним списком.

## Intake
Пользователь сообщает тип задачи, короткий список работ и количество, наличие крепежа / расходников и географию. Фото предпочтительнее дополнительных технических вопросов.

## Принцип сравнения
Сравнивать можно только одинаковый список работ. Цена за один выезд и цена за пять разных операций без перечня работ несопоставимы.

## Что должно быть в предложении
- итоговая цена и минимальный выезд;
- точный перечень и количество операций;
- кто предоставляет крепёж / расходники;
- подготовка / демонтаж, если нужны;
- исключения и доплаты;
- срок / длительность;
- гарантия на выполненные работы.

## Site inspection / фото
Исполнитель определяет материал основания, подходящий крепёж и отсутствие скрытых коммуникаций в зоне сверления. Пользователю не нужно выбирать тип анкера самостоятельно.

## Red flags
- тяжёлый предмет крепят без уточнения основания;
- исполнитель не раскрывает минимальную стоимость выезда;
- инженерные работы смешиваются с handyman-задачами;
- цена `от` без фиксированного списка операций;
- дополнительные материалы появляются только после выполнения работ.

Инженерные задачи (электрика, сантехника, отопление) должны выделяться в профильную категорию.

## Current lifecycle gate
Category is in `TESTING`.

Confirmed automated evidence:
- category routing: PASS;
- deterministic Expert QA: `14/14 PASS`;
- full E2E: PASS;
- complete 8 500 ₽ mounting offer is comparable and selected over advertising `от 3 000 ₽`;
- advertising / incomplete offer remains `NEEDS_CLARIFICATION`;
- 11 000 ₽ complete offer remains a valid `GOOD_ALTERNATIVE`;
- missing fasteners / consumables and minimum visit trigger contractor follow-up;
- mixed electrical/plumbing work routes to `EXPERT_REVIEW_REQUIRED`;
- heavy mounting surfaces explicit base / fixing risk instead of inventing a fastening solution.

Manual user-facing review 2026-09-27:
- Intake — PASS: work type, exact work list, quantity/objects and consumables are requested in household language;
- scope boundary — PASS: the user is not asked to select anchors / fixing systems or assess hidden utilities;
- engineering split — PASS: electrical, plumbing and heating work is not silently mixed into handyman work and requires a profile-specific path;
- heavy mounting — PASS: heavy TV / cabinet mounting surfaces the need to confirm the base and suitable fastening;
- Contractor Brief — PASS: total / minimum visit, work list, quantities, fasteners/consumables, exclusions, extras, duration and warranty are requested explicitly;
- normalization — PASS: `от` pricing without an exact work list is not treated as a confirmed comparable total offer;
- follow-up — PASS: missing fasteners/consumables and minimum visit are asked from the contractor rather than inferred;
- recommendation/comparison — PASS: complete comparable scope outranks the cheaper incomplete headline price;
- Action Layer — PASS by the shared recommendation pipeline after comparable winner selection.

No critical UX/safety finding.

Before `READY`: canonical production publication must succeed and the executable lifecycle gate requires `releaseGate.productionDeploy = PASS`. While production is locked/unpublished the category remains `TESTING`. `READY → ACTIVE` remains separate and requires representative/live verification.

