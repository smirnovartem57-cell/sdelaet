# Expert Model — INTERIOR_DOORS

Status: TESTING  
Profile: `interior-doors` v1.0  
Domain: `CONSTRUCTION / HOME_REPAIR / DOORS`

## JTBD
Пользователь хочет установить или заменить межкомнатные двери и получить сопоставимую смету, где отдельно понятны дверной блок, наличники, доборы, фурнитура, демонтаж и возможная подготовка проёма.

## Сценарии
- установка обычных распашных дверей;
- замена существующих дверей с демонтажем;
- раздвижные / двери-купе;
- скрытые двери invisible;
- двустворчатые двери;
- изменение геометрии проёма — только через `EXPERT_REVIEW_REQUIRED`.

## Минимальный Intake
1. Тип дверей.
2. Количество дверей / проёмов.
3. Нужен ли демонтаж старых дверей.
4. Куплен ли дверной комплект / фурнитура.
5. Город / регион; фото проёмов и существующих дверей — предпочтительно.

## Что обязан раскрыть исполнитель
- итоговую стоимость;
- количество и тип дверей;
- дверную коробку / монтаж блока;
- наличники и доборы;
- петли;
- ручки / замки / защёлки;
- демонтаж старых дверей, если требуется;
- подготовку / корректировку проёма;
- доставку / подъём / вывоз, если применимо;
- исключения и доплаты;
- срок и гарантию.

## Что определяется только на замере / осмотре
- точные размеры и геометрия проёмов;
- толщина стен и необходимость доборов;
- состояние проёма после демонтажа;
- объём корректировки основания / проёма для нестандартной системы.

## Нормализация
Предложения сравнимы только при одинаковом количестве и типе дверей и при сопоставимом составе: коробка + наличники + доборы при необходимости + петли + ручки/замки + демонтаж при замене + обязательная подготовка проёма.

Цена `от` не считается подтверждённой итоговой стоимостью.

Скрытые, раздвижные и двустворчатые системы нельзя автоматически сравнивать с обычной распашной дверью как один и тот же объём.

## Red flags
- изменение / расширение / сужение проёма без отдельной проверки;
- вмешательство в несущую стену как часть «обычного монтажа двери»;
- скрытая или раздвижная система без подтверждённой подготовки проёма;
- смета только за навеску полотна без коробки / наличников / фурнитуры;
- цена `от`, где обязательные работы вынесены в неопределённые доплаты.

## Current lifecycle gate
Category is in `TESTING`.

Confirmed automated evidence:
- category routing: PASS;
- deterministic Expert QA: `15/15 PASS`;
- full E2E: PASS;
- complete 28 500 ₽ offer is comparable and selected over advertising `от 3 500 ₽ за дверь`;
- incomplete advertising offer remains `NEEDS_CLARIFICATION`;
- 34 000 ₽ complete offer remains a valid `GOOD_ALTERNATIVE`;
- hidden-door offer without opening preparation is treated as incomplete;
- structural opening change routes to `EXPERT_REVIEW_REQUIRED`;
- missing trims / hinges / handles / locks / demolition / opening preparation trigger contractor follow-up.

Manual user-facing review 2026-09-27:
- Intake — PASS: door type, quantity, demolition and kit availability are requested in household language;
- responsibility boundary — PASS: the user is not asked to determine wall thickness, opening geometry or structural admissibility;
- non-standard systems — PASS: sliding, hidden and double doors are not treated as equivalent to ordinary swing doors;
- structural framing — PASS: opening geometry changes, especially in a load-bearing wall, require separate expert review rather than ordinary quote comparison;
- Contractor Brief — PASS: box, trims, extensions, hinges, handles/locks, demolition, opening preparation, delivery/lift/removal, exclusions, extras, timing and warranty are requested explicitly;
- normalization — PASS: advertising `от` pricing and incomplete installation scope are not treated as confirmed comparable total offers;
- follow-up — PASS: missing mandatory scope is asked from the contractor rather than inferred;
- recommendation/comparison — PASS: complete comparable scope outranks the cheaper incomplete headline price;
- Action Layer — PASS by the shared recommendation pipeline after comparable winner selection.

No critical UX/safety finding.

Before `READY`: canonical production publication must succeed and the executable lifecycle gate requires `releaseGate.productionDeploy = PASS`. While production is locked/unpublished the category remains `TESTING`. `READY → ACTIVE` remains separate and requires representative/live verification.
