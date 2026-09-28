# Expert Model — BATHROOM_WATERPROOFING

Status: TESTING
Profile: `bathroom-waterproofing` v0.2

## JTBD
Получить непрерывный гидроизоляционный контур ванной / санузла с прозрачной подготовкой основания, обработкой углов и проходок, достаточным числом слоёв, выдержанным временем высыхания и контрольной проверкой герметичности до закрытия плиткой.

## Минимальный Intake
- площадь мокрой зоны;
- тип / состояние основания;
- где нужна гидроизоляция — пол, стены или оба;
- какое покрытие будет сверху;
- есть ли трап, проходки труб и сложные примыкания.

## Нормализация предложения
Для сопоставимости обязательны: система гидроизоляции, число слоёв, подготовка основания, ленты углов/примыканий, герметизация проходок труб и трапа, высота захода на стены, материалы, межслойная/полная сушка и контрольное испытание герметичности до последующей отделки.

Цена за м² без состава системы, узлов примыканий, проходок и контрольной проверки не считается подтверждённым сопоставимым предложением.

## Site inspection / red flags
- состояние, прочность, влажность и трещины основания;
- фактическая площадь пола и мокрых стен;
- углы, примыкания, деформационные швы, проходки труб и трап;
- скрытые протечки и состояние старой гидроизоляции;
- совместимость с последующей плиточной системой.

В душевой с трапом отдельно проверяются уклоны, непрерывность контура, проходки и узел трапа. Герметичность нельзя считать подтверждённой без контрольного испытания после устройства системы и до её закрытия.

## Contractor response required
- `totalPrice`
- `area`
- `waterproofingSystem`
- `layers`
- `surfacePreparation`
- `cornerTape`
- `pipePenetrations`
- `wallHeight`
- `materials`
- `dryingTime`
- `controlTest`
- `exclusions`
- `extraCosts`
- `leadTime`
- `warranty`

## Current lifecycle gate
Category remains `TESTING`.

Confirmed automated evidence:
- category routing: PASS;
- deterministic Expert QA: `15/15 PASS`;
- full E2E: PASS;
- complete 54 000 ₽ offer is comparable and selected over advertising `от 500 ₽/м²`;
- system/layers, substrate preparation, corner tape, pipe penetrations/drain, wall upturn and drying are explicit comparison facts;
- control-test evidence is parsed, normalized and required for a complete comparable offer;
- missing control-test evidence is prioritized in contractor follow-up after the manual-review gap fix.

Manual user-facing review 2026-09-28:
- Intake — PASS: wet-zone area, substrate state, protected surfaces, covering above and drain/penetration context are requested without forcing technical guesses from the user;
- site-inspection boundary — PASS: substrate strength/moisture/cracks, hidden leaks, old waterproofing condition and final tile-system compatibility remain inspection facts;
- shower/drain boundary — PASS: slopes, continuous envelope, penetrations and drain-node treatment remain explicit technical risks;
- Contractor Brief — PASS: system, layers, preparation, tapes, penetrations/drain, wall upturn, materials, drying, control test, exclusions/extras, timing and warranty are requested explicitly;
- normalization — PASS: per-m² / `от` pricing without confirmed system composition and required nodes is not treated as comparable;
- follow-up — PASS: the six-question cap now prioritizes system, layers, preparation, tapes, penetrations/drain and control test, so the watertightness proof is never truncated behind secondary clarifications;
- recommendation/comparison — PASS: complete 54 000 ₽ scope outranks the cheaper incomplete headline price;
- promise boundary — PASS: watertightness is not presented as confirmed before the post-installation control test.

The manual review found one readiness gap — control-test proof could be truncated from follow-up by the six-question cap. PR #96 fixed the runtime ordering and exact-head Platform Readiness passed after the fix. No critical UX/safety finding remains.

Before `READY`: canonical production publication must succeed and the executable lifecycle gate requires `releaseGate.productionDeploy = PASS`. While production is locked/unpublished the category remains `TESTING`. `READY → ACTIVE` remains separate and requires representative/live verification.
