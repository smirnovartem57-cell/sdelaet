# Expert Model — FLOOR_SCREED

Status: TESTING
Profile: `floor-screed` v0.2

## JTBD
Получить ровное и технологически корректное основание под финишное покрытие без скрытых доплат за толщину, демонтаж, армирование и логистику.

## Минимальный Intake
- тип стяжки или «предложить»;
- площадь;
- наличие старой стяжки;
- наличие тёплого пола;
- география / фото.

## Нормализация предложения
Обязательны: тип стяжки, площадь, средняя/максимальная толщина, марка/прочность для мокрых систем, подготовка основания, краевой узел/демпфер, материалы, доставка/подъём, срок технологической готовности и гарантия.

Цена за м² без толщины слоя не считается сопоставимой.

## Site inspection / red flags
Толщина определяется лазерным замером. Нужно учитывать коммуникации, тёплый пол, старую стяжку и нагрузку на основание.

## Current lifecycle gate
Category is in `TESTING`.

Confirmed automated evidence:
- category routing: PASS;
- deterministic Expert QA: `14/14 PASS`;
- full E2E: PASS;
- complete 78 000 ₽ semi-dry screed offer is comparable and selected over advertising `от 470 ₽/м²`;
- incomplete advertising offer remains `NEEDS_CLARIFICATION`;
- old screed without demolition remains incomplete;
- missing thickness, strength / grade and edge tape trigger contractor follow-up;
- heated-floor scenario surfaces additional system / thickness / technology requirements.

Manual user-facing review 2026-09-27:
- Intake — PASS: screed type / propose option, area, old screed and heated-floor state are requested without forcing the user to design the floor system;
- measurement boundary — PASS: base level differences and final average / maximum thickness remain site-inspection facts;
- heated-floor framing — PASS: screed above heated floor is not treated as ordinary screed with the same technology assumptions;
- old-screed framing — PASS: demolition must be explicit when an existing screed is present;
- Contractor Brief — PASS: area, screed type, average/max thickness, strength grade, base preparation, reinforcement/edge tape, materials/logistics, exclusions, extras, technological readiness timing and warranty are required;
- normalization — PASS: per-m² / `от` pricing without confirmed thickness and scope is not treated as a confirmed comparable total;
- follow-up — PASS: missing thickness, strength and edge tape are asked from the contractor rather than inferred;
- recommendation/comparison — PASS: complete comparable scope outranks a cheaper incomplete headline price.

No critical UX/safety finding.

Before `READY`: canonical production publication must succeed and the executable lifecycle gate requires `releaseGate.productionDeploy = PASS`. While production is locked/unpublished the category remains `TESTING`. `READY → ACTIVE` remains separate and requires representative/live verification.

