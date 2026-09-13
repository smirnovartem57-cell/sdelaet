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

Agent автоматически нормализует запросы, определяет intent/topic, группирует кластеры, формирует AI-answer targets и ищет возможную каннибализацию с соседними category pages. Статусы research: `EVIDENCE_REQUIRED` → `REVIEW_REQUIRED` → `READY_FOR_REVIEW`.

Даже `READY_FOR_REVIEW` не публикует страницу: `publicationStatus` остаётся ручным gate, а индексирование требует одновременно `APPROVED`, `needsQueryResearch=false` и `research.status=READY_FOR_REVIEW`.
