# SEO Category Agent

## Назначение
SEO Category Agent автоматически создаёт безопасный SEO/GEO draft для каждой новой категории «Сделает» и контролирует, что категория не попадёт в индекс до отдельного SEO research и ручного approval.

## Source of truth
- `config/service-categories.json` — категория и SEO contract;
- `docs/product/EXPERT_MODELS/<SERVICE_CODE>.md` — экспертные знания;
- `assets/category-profiles/<category>.json` — продуктовый профиль;
- отдельный независимый SEO-каталог запрещён.

## Автоматический lifecycle
```text
create-category
→ SEO AUTO_DRAFT
→ Expert Model развивается
→ promote-category
→ SEO draft refresh из Expert Model
→ query research
→ human review
→ APPROVED
→ indexable=true
```

## Что создаётся автоматически
- slug и canonicalPath;
- title, description, H1;
- primary query seed из search registry;
- informational query seed;
- breadcrumbs;
- два informational blocks;
- quote checklist;
- cost-factor draft;
- минимум 6 FAQ/answer blocks;
- related categories;
- `noindex,follow`.

## Что нельзя автоматом утверждать
AUTO_DRAFT не означает готовность к индексации. Агент не имеет права автоматически подтверждать:
- реальный поисковый спрос;
- частотность запросов;
- цены;
- статистику;
- нормы и юридические утверждения;
- уникальность интента относительно соседних страниц.

## Query research gate
Перед `APPROVED` для категории нужно:
1. проверить коммерческий кластер;
2. проверить минимум два информационных кластера;
3. собрать long-tail вопросы;
4. проверить каннибализацию;
5. определить, нужен ли отдельный scenario page;
6. заменить слабые generic AUTO_DRAFT формулировки на category-specific ответы.

Пока `seo.automation.needsQueryResearch=true`, `seo.indexable=true` запрещён QA.

## Команды
Массово заполнить только отсутствующие SEO drafts:
```bash
node tools/seo/enrich-categories.mjs --write
```

Обновить AUTO_DRAFT одной категории после развития Expert Model:
```bash
node tools/seo/enrich-categories.mjs --category <categoryId> --write --refresh
```

Пересобрать страницы и проверить:
```bash
node tools/seo/generate-pages.mjs
node tools/seo/qa.mjs
```

## Definition of Done
Категория считается SEO-ready только после query research, category-specific content review, успешного SEO QA и явного ручного переключения `publicationStatus=APPROVED` и `indexable=true`.

## SEO Research Agent

Research Agent работает после AUTO_DRAFT и до ручного SEO approval. Он не придумывает частотность и не снимает research-gate без внешних evidence.

Команда для одной категории без evidence создаёт/обновляет research-state и показывает, чего не хватает:
```bash
node tools/seo/research-category.mjs --category balcony-insulation --write
```

С evidence-файлом:
```bash
node tools/seo/research-category.mjs --category balcony-insulation --evidence tmp/balcony-insulation-seo-evidence.json --write
```

Массово инициализировать research-state:
```bash
node tools/seo/research-category.mjs --all --write
```

Evidence JSON принимает `sources`, `queries`, `questions`, `collectedAt`. Для каждого query можно передать `intent`, `topic`, `demand`, `sourceRefs`. Допустимые внешние типы источников: `yandex_wordstat`, `yandex_suggest`, `yandex_serp`, `google_serp`, `search_console`, `manual_serp`.

Если Agent находит возможную каннибализацию, решение фиксируется в evidence через `cannibalizationReviews`: `query`, `otherCategoryId`, `disposition`, `ownerCategoryId`, `reason`. Пока хотя бы один конфликт не разобран, research остаётся `REVIEW_REQUIRED`. После явного разбора всех конфликтов он может перейти в `READY_FOR_REVIEW`; это не означает публикацию или индексацию.

Реальные research evidence храним в `docs/product/seo-research/`, чтобы частотности, регион, дата сбора и решения по конфликтам были воспроизводимыми и не зависели от временных файлов.

Agent автоматически нормализует запросы, определяет intent/topic, группирует кластеры, ранжирует подтверждённые запросы по спросу, формирует `informationalOpportunities` и AI-answer targets и ищет возможную каннибализацию с соседними category pages. Статусы research: `EVIDENCE_REQUIRED` → `REVIEW_REQUIRED` → `READY_FOR_REVIEW`.

Даже `READY_FOR_REVIEW` не публикует страницу: `publicationStatus` остаётся ручным gate, а индексирование требует одновременно `APPROVED`, `needsQueryResearch=false` и `research.status=READY_FOR_REVIEW`.

## Wordstat service integration (MVP)

Для быстрого запуска Research Agent использует существующий сервис `https://wordstat-excel.smirart.workers.dev` как frequency provider.

Подтверждённые endpoints:
- `GET /api/quota` — rolling 60-minute quota; на момент проверки limit=5000;
- `POST /api/frequency` — `{phrases:[...], regions:[...]}`;
- максимум 10 фраз за batch;
- ответ содержит `frequency`, `matchedPhrase`, `matchType`, `frequencySource`, diagnostic/status/error.

Важно: текущий сервис проверяет частотность уже известных фраз, но сам не выполняет полноценный keyword discovery. Поэтому в MVP он подтверждает спрос для seed/query candidates, сформированных SEO Research Agent.
### Отложенные улучшения Wordstat service

После MVP доработать сервис отдельно, не блокируя запуск «Сделает»:
1. добавить machine-to-machine авторизацию для `/api/*`, чтобы внешние пользователи не расходовали Wordstat quota;
2. добавить endpoint keyword discovery/related phrases, а не только frequency lookup;
3. добавить единый JSON endpoint для SEO research: seed → расширение → frequency → region metadata;
4. добавить cache/deduplication по phrase+region и TTL;
5. добавить явный region dictionary и поддержку нескольких регионов/сравнения Москва+МО/Россия;
6. возвращать quota cost и source metadata для каждого research run;
7. добавить rate limiting по consumer/project;
8. подключить сервис к ProjectOS как reusable data source.

До выполнения этих улучшений production-indexing остаётся gated ручным review; текущая интеграция используется только как источник подтверждённой частотности.