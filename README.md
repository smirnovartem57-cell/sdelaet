# Сделает

Сервис поиска, проверки и сравнения исполнителей для задач по дому и ремонту.

Основной домен: `onsdelaet.ru`.

## Текущий пользовательский путь

1. Главная — `index.html`
2. Создание задачи — `create-task.html`
3. Техническое задание — `task-tz.html`
4. Исследование рынка и подборка — `candidates.html`
5. Запросы исполнителям — `requests.html`
6. Ответы — `replies.html`
7. Сравнение — `compare.html`

## Актуальная продуктовая модель

- канонический каталог: 71 услуга;
- известная категория использует экспертный сценарий;
- неизвестная задача внутри домена «Дом и ремонт» не блокируется: используется `universal-home-repair`, сохраняются описание и вложения, уточняются объект/место, желаемый результат и регион;
- неизвестную задачу запрещено подменять эталонной категорией;
- результат — компактный объяснимый shortlist, а не каталог ссылок;
- важные факты хранятся с provenance и статусами `confirmed / claimed / unknown / risk`;
- предложения сравниваются по сопоставимому составу, а не только по минимальной заявленной цене;
- деньги за работу исполнителя через сервис не проходят.

Публичная коммерческая модель и другие устойчивые продуктовые решения зафиксированы в `docs/product/PROJECT_MEMORY.md`.

## Технический и production-контур

- canonical repository: `smirnovartem57-cell/sdelaet`;
- production: FirstVDS;
- server deploy clone: `/home/sdelaet-runner/deploy-repo`;
- application tree: `/opt/sdelaet/current`;
- runtime/data contour: `/var/lib/sdelaet`;
- canonical publication: `sdelaet-main-deploy.service` / `sdelaet-main-deploy.timer`;
- production publication is fail-closed under `docs/product/PUBLISH_POLICY.md`.

Операционный snapshot на 2026-09-26: production заблокирован файлом `/var/lib/sdelaet/deploy/PRODUCTION_LOCKED`; GitHub `main` и recorded production baseline расходятся. Server checkout `local-v20-ui` сейчас указывает ровно на recorded baseline, то есть отдельного более нового локального commit поверх baseline не обнаружено. Это означает **не публиковать** до отдельной reconciliation/parity-проверки. Документационные и feature-ветки могут готовиться параллельно, но не должны снимать lock или запускать deploy как побочный эффект.

## Source of truth

- текущее состояние — `docs/product/PROJECT_STATE.md`;
- ближайшие задачи — `docs/product/BACKLOG.md`;
- устойчивые решения — `docs/product/PROJECT_MEMORY.md`;
- lifecycle категорий — `docs/product/CATEGORY_LIFECYCLE.md`;
- обязательная политика публикации — `docs/product/PUBLISH_POLICY.md`;
- canonical deploy — `docs/product/DEPLOYMENT.md`.

## Безопасность

В репозитории не должны храниться ключи доступа, пароли, персональные данные клиентов, фотографии объектов, переписка и сметы реальных пользователей.
