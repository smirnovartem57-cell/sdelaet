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
- complete 78 000 ₽ semi-dry offer is comparable and selected over advertising `от 470 ₽/м²`;
- advertising per-m² offer without confirmed thickness/scope remains `NEEDS_CLARIFICATION`;
- old screed without explicit demolition remains incomplete;
- missing thickness, strength and edge tape trigger contractor follow-up;
- heated-floor scenario surfaces category-specific technical risk.

Manual user-facing review 2026-09-28:
- Intake — PASS: screed type may be proposed, while area, old screed, heated floor, geography/photos and other scope-changing facts are requested without forcing professional measurements from the user;
- measurement boundary — PASS: floor deviations, average/max layer thickness, substrate capacity and hidden communications remain site-measurement / inspection facts;
- technology boundary — PASS: screed type, strength and reinforcement are explicit comparison facts rather than inferred from price;
- old-layer framing — PASS: existing screed demolition must be explicit when applicable;
- Contractor Brief — PASS: type, area, thickness, strength, substrate preparation, reinforcement, edge tape, materials, delivery/lift, exclusions/extras, readiness timing and warranty are requested explicitly;
- normalization — PASS: price per m² without confirmed layer thickness and scope is not treated as a comparable total;
- follow-up — PASS: missing thickness, strength and edge tape are requested from the contractor instead of guessed;
- recommendation/comparison — PASS: complete comparable scope outranks a cheaper incomplete headline price.

No critical UX/safety finding.

Before `READY`: canonical production publication must succeed and the executable lifecycle gate requires `releaseGate.productionDeploy = PASS`. While production is locked/unpublished the category remains `TESTING`. `READY → ACTIVE` remains separate and requires representative/live verification.
