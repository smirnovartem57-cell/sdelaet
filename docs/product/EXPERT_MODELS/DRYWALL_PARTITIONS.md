# Expert Model — DRYWALL_PARTITIONS

Status: TESTING
Profile: `drywall-partitions` v0.2

## JTBD
Получить перегородку нужной прочности, влажностной стойкости и звукоизоляции с прозрачной комплектацией каркаса и листов.

## Минимальный Intake
- помещение / влажная зона;
- площадь и высота;
- требование к звукоизоляции;
- география / фото.

## Нормализация предложения
Обязательны: профиль и шаг стоек, тип и количество слоёв листов, наполнение, дверные проёмы, закладные/усиления, заделка стыков, материалы, срок и гарантия.

Однослойная и двухслойная перегородки, а также варианты с/без наполнения напрямую не сравниваются.

## Site inspection / red flags
Нужно проверить основания крепления, высоту, проёмы, коммуникации и места тяжёлых навесных предметов. Во влажных помещениях требуется корректный тип листа и защита поверхности.

## Current lifecycle gate
Category is in `TESTING`.

Confirmed automated evidence:
- category routing: PASS;
- deterministic Expert QA: `14/14 PASS`;
- full E2E: PASS;
- complete 52 000 ₽ offer is comparable and selected over advertising `от 500 ₽/м²`;
- incomplete advertising offer remains `NEEDS_CLARIFICATION`;
- profile/frame, stud spacing and board-layer omissions trigger contractor follow-up;
- wet-room scenario surfaces a moisture/material technical risk;
- site-inspection requirements remain explicit for fixing bases, geometry, openings, communications and heavy mounted loads.

Manual user-facing review 2026-09-28:
- Intake — PASS: room/wet-zone context, approximate area/height, sound requirement, geography and photos are sufficient without forcing structural guesses from the user;
- site-inspection boundary — PASS: fixing bases, exact geometry, openings, communications and reinforcement for heavy items remain inspection/design facts;
- moisture boundary — PASS: wet rooms require appropriate board type and surface protection rather than being treated like ordinary dry-room partitions;
- Contractor Brief — PASS: frame system/profile, stud spacing, board type/layers, infill, door openings, reinforcements, joint finishing, materials, timing and warranty are requested explicitly;
- normalization — PASS: single-/double-layer systems and variants with/without infill are not treated as directly comparable; headline per-m² pricing without configuration stays incomplete;
- follow-up — PASS: missing frame/profile, spacing and layer count are requested from the contractor instead of inferred;
- recommendation/comparison — PASS: complete configured scope outranks a cheaper incomplete advertising price.

No critical UX/safety finding.

Before `READY`: canonical production publication must succeed and the executable lifecycle gate requires `releaseGate.productionDeploy = PASS`. While production is locked/unpublished the category remains `TESTING`. `READY → ACTIVE` remains separate and requires representative/live verification.
