# Category Production Agent Pipeline

Назначение: ускорять разработку новых категорий «Сделает» без потери технической дисциплины и без обязательной зависимости от внешнего LLM.

## 8 ролей
1. `CATEGORY_RESEARCH_AGENT` — проверяет полноту research-пакета и наличие Expert Model.
2. `DOMAIN_EXPERT_AGENT` — проверяет site-inspection границы и runtime expert brief.
3. `CLIENT_INTAKE_DESIGNER` — контролирует короткий intake: максимум 5 основных действий и 3 trigger-вопроса.
4. `CONTRACTOR_BRIEF_AGENT` — проверяет, что исполнитель получает краткое сопоставимое ТЗ.
5. `OFFER_COMPARISON_ARCHITECT` — контролирует normalizer, follow-up и search wiring.
6. `TECHNICAL_QA_REVIEWER` — проверяет truth states и QA-контракт.
7. `REGRESSION_SCENARIO_AGENT` — запускает category QA + E2E regression.
8. `CATEGORY_RELEASE_CONTROLLER` — принимает только результаты остальных ролей и контролирует lifecycle.

## Принцип независимости
Один агент не может одновременно разработать категорию и признать её готовой. Release Controller не меняет выводы предыдущих ролей.

## External AI
Внешний LLM не является production-зависимостью pipeline. Research может быть собран через веб/ручное исследование, но агенты проверяют только зафиксированные evidence и код проекта.

## Команды
Проверить одну категорию:
`node tools/category-agents/run.mjs --category tile-installation`

Проверить все категории:
`node tools/category-agents/run.mjs --all --ci`

Получить JSON-отчёт:
`node tools/category-agents/run.mjs --all --json`

Создать безопасный RESEARCH-каркас новой категории:
`node tools/category-agents/scaffold.mjs --id wall-finishing --code WALL_FINISHING --name "Отделка стен"`

Scaffold никогда не перезаписывает существующую категорию.

## Release policy
`TESTING → READY` не автоматизируется полностью. Обязательны manual user-facing review и production smoke. Для legacy READY допускается WARN до миграции явного `manualReview=PASS`.
