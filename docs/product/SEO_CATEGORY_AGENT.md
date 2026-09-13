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
