# Expert Model — SOUNDPROOFING

Status: TESTING
Profile: `soundproofing` v0.2

## JTBD
Снизить конкретный бытовой шум в квартире с понятной конструкцией системы, её толщиной, потерей площади/высоты и без недоказуемых обещаний акустического результата.

## Минимальный Intake
- какие поверхности нужно изолировать;
- какой шум беспокоит — воздушный или ударный;
- примерная площадь;
- сколько площади / высоты допустимо потерять;
- география / фото.

## Нормализация предложения
Для сопоставимости обязательны: тип шумоизоляционной системы, итоговая толщина, количество слоёв, виброразвязка, обработка примыканий / акустическая герметизация и перечень материалов. Отдельно фиксируются площадь, поверхность, исключения, дополнительные расходы, срок, гарантия и заявленный акустический результат, если подрядчик его обещает.

Цена за м² без состава системы, толщины и примыканий не считается сопоставимой. Каркасные и бескаркасные системы, а также решения для разных поверхностей и типов шума нельзя ранжировать как одинаковый объём работ.

## Site inspection / red flags
- фактический источник и характер шума;
- конструкция стены / потолка / пола;
- фланговые и структурные пути передачи;
- скрытые щели и примыкания;
- допустимая потеря площади / высоты;
- реальный акустический эффект без измерений.

Ударный шум сверху нельзя автоматически трактовать как задачу только по облицовке стены. Фактическое снижение шума не должно обещаться только по описанию или рекламной характеристике материала.

## Current lifecycle gate
Category is in `TESTING`.

Confirmed automated evidence:
- category routing: PASS;
- deterministic Expert QA: `14/14 PASS`;
- full E2E: PASS;
- complete 148 000 ₽ frame-system offer is comparable and selected over advertising `от 1 900 ₽/м²`;
- incomplete advertising offer remains non-comparable;
- missing thickness, vibration isolation and junction treatment trigger contractor follow-up;
- impact-noise scenario surfaces a dedicated technical risk;
- site-inspection requirements remain explicit.

Manual user-facing review 2026-09-28:
- Intake — PASS: surfaces, noise type, area and acceptable space loss are asked in user language;
- diagnostic boundary — PASS: airborne and impact noise are not collapsed into one generic scenario;
- site-inspection boundary — PASS: actual acoustic effect, structural/flanking transmission and hidden junction defects are not inferred remotely;
- Contractor Brief — PASS: system type, thickness, layers, vibration isolation, junction treatment, materials, exclusions/extras, timing, warranty and any claimed acoustic result are requested explicitly;
- normalization — PASS: per-m² / `от` price without confirmed system composition and thickness is not treated as comparable;
- follow-up — PASS: missing thickness, vibration isolation and junction treatment are requested from the contractor rather than guessed;
- recommendation/comparison — PASS: complete comparable system outranks a cheaper incomplete headline price;
- promise boundary — PASS: the public page explicitly states that actual acoustic effect cannot be reliably determined without measurements.

No critical UX/safety finding.

Before `READY`: canonical production publication must succeed and the executable lifecycle gate requires `releaseGate.productionDeploy = PASS`. While production is locked/unpublished the category remains `TESTING`. `READY → ACTIVE` remains separate and requires representative/live verification.
