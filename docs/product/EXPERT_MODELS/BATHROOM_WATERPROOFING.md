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

Automated QA/E2E exist, but manual readiness review is not closed yet. The control-test requirement discovered during manual review must pass exact-head regression before manualReview can be recorded as PASS. Canonical production publication and `releaseGate.productionDeploy = PASS` remain separate READY gates.
