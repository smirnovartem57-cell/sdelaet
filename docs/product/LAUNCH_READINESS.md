# LAUNCH_READINESS

## Scope
Платёжный контур и текущая публикация юридических страниц ведутся отдельно. Этот документ покрывает оставшиеся launch-gates: SEO factory, recovery/admin, lifecycle, hardening, analytics и production acceptance.

## 1. SEO factory
- Все category/service pages до отдельного approval остаются `noindex,follow`.
- Новые категории получают SEO AUTO_DRAFT автоматически.
- `tools/seo/run-pipeline.mjs --pending --region 213` подхватывает только категории с `needsQueryResearch=true`.
- Pipeline: Wordstat evidence → research → service pages → hub pages → SEO QA.
- Индексация не является частью автоматического pipeline.

## 2. Recovery/admin gate
Перед launch проверить на production:
- `/admin/` и `/admin-api/` требуют авторизацию;
- публичный `api.onsdelaet.ru/v1/admin/*` возвращает 404;
- PII клиента не попадает в публичный HTML/API;
- статусы recovery: `new/contact_requested → in_progress → resolved/closed`;
- доступны `assigned_to`, `solution_notes`, `contacted_at`, `resolved_at`, `closed_at`;
- проблема исполнителя создаёт high-priority recovery case и admin Telegram alert.

## 3. Client lifecycle gate
Прогнать отдельными тестами:
- positive: completed → rating → price match → recommendation → comment → photo → public consent;
- price increased significantly;
- do not recommend contractor;
- work partially completed;
- work not completed;
- contractor problem → recovery;
- user requests help;
- duplicate Telegram callback remains idempotent.

## 4. Hardening gate
Проверить:
- DB backup и фактический restore-test;
- backup публичного сайта;
- права `/etc/sdelaet/*.env` и отсутствие секретов в логах;
- `sdelaet-api`, Telegram gateway и followup worker restart policy;
- nginx config test;
- rate limits/size limits публичных write endpoints;
- admin API недоступен через публичный API hostname;
- health endpoints;
- журналирование 4xx/5xx без PII/secrets.

## 5. Analytics gate
Счётчик Яндекс Метрики: `112503660`.
До платного трафика должна восстанавливаться воронка:
`landing → task_created → tariff_selected → payment_started → paid → candidates_ready → contractor_selected → completed → review_completed`.

Минимум проверить события:
- tariff clicks;
- task submit/create;
- Telegram link/connected;
- payment start/success/failure;
- candidates/results opened;
- comparison opened;
- contractor selected;
- recovery/help requested;
- work completed/problem;
- review completed.

## 6. Public smoke
Команда:
```bash
node tools/launch/public-smoke.mjs
```
Проверяет основные публичные страницы на HTTP 200 и непустой HTML.

## 7. Production acceptance
Использовать нового тестового клиента и новую задачу. Не переиспользовать старый test task.
Проверить на мобильном:
1. landing;
2. create task;
3. Telegram;
4. paid entitlement (если уже включён платёжный контур);
5. candidates;
6. comparison;
7. contractor selection;
8. followups;
9. recovery path;
10. review path.

## 8. Soft launch gate
Можно запускать первые реальные источники трафика только если:
- payment gate отдельно пройден;
- production acceptance PASS;
- analytics funnel виден;
- recovery alerts работают;
- backup/restore PASS;
- critical 5xx отсутствуют;
- SEO pages остаются noindex до отдельного SEO approval.
