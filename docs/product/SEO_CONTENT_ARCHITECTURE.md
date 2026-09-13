# SEO_CONTENT_ARCHITECTURE.md

## Назначение
Этот документ — source of truth для SEO/GEO-архитектуры «Сделает».
SEO не является отдельным каталогом: публичная страница должна строиться из канонической категории, Expert Service Specification и одобренных SEO-данных.

## Главные правила
1. Один source of truth: `config/service-categories.json`.
2. Каждая service page закрывает коммерческий intent и минимум два информационных intent-кластера.
3. Контент отвечает на вопрос сразу, а затем раскрывает условия и детали.
4. Никаких массовых thin pages: scenario page создаётся только при отдельном intent и достаточном уникальном содержании.
5. Не публиковать выдуманные цены, статистику, нормы или гарантии.
6. До финального SEO-review новые страницы допускаются в production только с `noindex,follow`.

## URL-архитектура
`/uslugi/`
`/uslugi/{domain}/`
`/uslugi/{domain}/{group}/`
`/uslugi/{domain}/{group}/{service}/`

Эталон:
`/uslugi/remont/balkony/uteplenie-balkona/`

Scenario pages разрешены только после query/intention gate.
## Обязательная структура service page
1. Breadcrumbs.
2. Hero + H1 + основной CTA.
3. Что делает «Сделает».
4. Informational Block A — «Что важно знать перед заказом».
5. Что нужно для предварительного расчёта — из Client Intake / QUOTE_REQUIRED.
6. Informational Block B — «Как проверить/сравнить предложение».
7. От чего зависит стоимость — только факторы, без выдуманных цен.
8. Answer Layer / FAQ — 4–8 вопросов.
9. Проверенные отзывы — только собственные verified review data.
10. Собственные обезличенные данные — только с периодом, географией и N.
11. Related services.
12. Final CTA, связанный с `serviceCode`.

## AI/GEO answer pattern
Каждый самостоятельный вопрос оформляется как:
- H2/H3 с естественной формулировкой вопроса;
- прямой ответ первым абзацем (обычно 40–100 слов);
- условия, ограничения и исключения;
- при необходимости таблица/чек-лист;
- без маркетингового текста до ответа.

Специальная «AI-разметка» не является source of truth. Структурированные данные должны соответствовать реально видимому содержимому страницы.
## SEO data contract
Категория может содержать объект `seo`:
- `indexable`, `publicationStatus`;
- `slug`, `canonicalPath`, `title`, `description`, `h1`;
- `primaryIntent`, `primaryQueries`, `informationalQueries`;
- `breadcrumbs`;
- `infoBlocks[]` с `id`, `title`, `queryCluster`, `shortAnswer`, `sections`;
- `quoteChecklist[]`;
- `costFactors[]`;
- `faq[]` с `question`, `shortAnswer`, `details`;
- `relatedCategoryIds[]`;
- `reviewedAt`, `contentVersion`.

## Автоматизация
`tools/seo/generate-pages.mjs` обязан:
1. читать только `config/service-categories.json`;
2. валидировать SEO contract;
3. генерировать HTML, meta, canonical, breadcrumbs и JSON-LD;
4. генерировать страницы только для категорий с заполненным `seo`;
5. ставить `noindex,follow`, пока `seo.indexable !== true`;
6. не использовать HTML как source of truth;
7. завершаться ошибкой при дублирующемся canonicalPath;
8. формировать manifest результата для CI/QA.