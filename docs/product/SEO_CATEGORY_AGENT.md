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
→ Wordstat research
→ intent clustering
→ cannibalization report
→ human review перед индексацией
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
- цены и статистику без источника;
- нормы и юридические утверждения;
- финальную уникальность интента относительно соседних страниц;
- публикацию и индексацию.

## Query research gate
Перед `APPROVED` для категории нужно:
1. проверить коммерческий кластер;
2. проверить минимум два информационных кластера;
3. собрать long-tail вопросы;
4. проверить каннибализацию;
5. определить, нужен ли отдельный scenario page;
6. заменить слабые generic AUTO_DRAFT формулировки на category-specific ответы.

Пока `seo.automation.needsQueryResearch=true`, `seo.indexable=true` запрещён QA.

## Главная автоматизация

Обычная работа с категориями не должна требовать ручного запуска research по каждой категории.

Обработать все категории, которым ещё нужен research:
```bash
node tools/seo/run-pipeline.mjs --pending --region 213
```

Команда автоматически:
1. выбирает только новые/неисследованные категории;
2. отправляет seed queries в Wordstat service;
3. сохраняет evidence в `docs/product/seo-research/<categoryId>.wordstat.json`;
4. обновляет `seo.research`;
5. строит intent clusters и AI answer targets;
6. формирует cannibalization report;
7. пересобирает service pages;
8. запускает SEO QA;
9. не меняет indexation.

Полностью пересобрать research всех категорий:
```bash
node tools/seo/run-pipeline.mjs --all --region 213
```

Одна категория:
```bash
node tools/seo/run-pipeline.mjs --category balcony-insulation --region 213
```

`--pending` является штатным режимом после добавления новых категорий. Уже исследованные категории повторно не расходуют Wordstat quota без необходимости.

## Низкоуровневые команды
Массово заполнить только отсутствующие SEO drafts:
```bash
node tools/seo/enrich-categories.mjs --write
```

Обновить AUTO_DRAFT одной категории после развития Expert Model:
```bash
node tools/seo/enrich-categories.mjs --category <categoryId> --write --refresh
```

Research одной категории:
```bash
node tools/seo/research-category.mjs --category balcony-insulation --source wordstat --region 213 --write --save-evidence
```

Research только pending-категорий:
```bash
node tools/seo/research-category.mjs --pending --source wordstat --region 213 --write --save-evidence
```

Пересобрать страницы и проверить:
```bash
node tools/seo/generate-pages.mjs
node tools/seo/qa.mjs
```

## SEO Research Agent
Research Agent работает после AUTO_DRAFT и до ручного SEO approval. Он не придумывает частотность и не снимает research-gate без внешних evidence.

Evidence JSON принимает `sources`, `queries`, `questions`, `collectedAt`. Для каждого query можно передать `intent`, `topic`, `demand`, `sourceRefs`. Допустимые внешние типы источников: `yandex_wordstat`, `yandex_suggest`, `yandex_serp`, `google_serp`, `search_console`, `manual_serp`.

Если Agent находит возможную каннибализацию, решение фиксируется в evidence через `cannibalizationReviews`: `query`, `otherCategoryId`, `disposition`, `ownerCategoryId`, `reason`. Пока хотя бы один конфликт не разобран, research остаётся `REVIEW_REQUIRED`. После явного разбора всех конфликтов он может перейти в `READY_FOR_REVIEW`; это не означает публикацию или индексацию.

Реальные research evidence храним в `docs/product/seo-research/`, чтобы частотности, регион, дата сбора и решения по конфликтам были воспроизводимыми.

Agent автоматически нормализует запросы, определяет intent/topic, группирует кластеры, ранжирует подтверждённые запросы по спросу, формирует `informationalOpportunities` и AI-answer targets и ищет возможную каннибализацию с соседними category pages. Статусы research: `EVIDENCE_REQUIRED` → `REVIEW_REQUIRED` → `READY_FOR_REVIEW`.

Даже `READY_FOR_REVIEW` не публикует страницу: `publicationStatus` остаётся ручным gate, а индексирование требует одновременно `APPROVED`, `needsQueryResearch=false` и `research.status=READY_FOR_REVIEW`.

## Wordstat service integration (MVP)
Для быстрого запуска Research Agent использует существующий сервис `https://wordstat-excel.smirart.workers.dev` как frequency provider.

Подтверждённые endpoints:
- `GET /api/quota` — rolling 60-minute quota;
- `POST /api/frequency` — `{phrases:[...], regions:[...]}`;
- максимум 10 фраз за batch.

Текущий сервис проверяет частотность уже известных фраз, но сам не выполняет полноценный keyword discovery. Поэтому в MVP он подтверждает спрос для seed/query candidates, сформированных SEO Research Agent.

### Отложенные улучшения Wordstat service
После MVP доработать сервис отдельно, не блокируя запуск «Сделает»:
1. machine-to-machine авторизация для `/api/*`;
2. keyword discovery/related phrases;
3. endpoint seed → расширение → frequency → region metadata;
4. cache/deduplication по phrase+region и TTL;
5. region dictionary и сравнение Москва+МО/Россия;
6. quota cost/source metadata;
7. rate limiting по consumer/project;
8. подключение к ProjectOS как reusable data source.

## Definition of Done
Категория считается SEO-ready только после query research, category-specific content review, успешного SEO QA и явного ручного переключения `publicationStatus=APPROVED` и `indexable=true`.
