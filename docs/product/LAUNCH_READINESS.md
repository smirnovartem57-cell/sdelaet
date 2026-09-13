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
Публичная защита проверена 2026-09-13:
- `https://onsdelaet.ru/admin/` → 401 без авторизации — PASS;
- `https://onsdelaet.ru/admin-api/recovery` → 401 без авторизации — PASS;
- `https://api.onsdelaet.ru/v1/admin/recovery` → 404 — PASS.

Перед launch на production ещё проверить:
- PII клиента не попадает в публичный HTML/API;
- статусы recovery: `new/contact_requested → in_progress → resolved/closed`;
- доступны `assigned_to`, `solution_notes`, `contacted_at`, `resolved_at`, `closed_at`;
- проблема исполнителя создаёт high-priority recovery case и admin Telegram alert.

Автоматическая публичная проверка:
```bash
node tools/launch/security-smoke.mjs
```

## 3. Client lifecycle gate
Положительный review-flow уже пройден: completed → rating → price match → recommendation → comment → photo → public consent.

Осталось прогнать отдельными тестами:
- price increased significantly;
- do not recommend contractor;
- work partially completed;
- work not completed;
- contractor problem → recovery;
- user requests help;
- duplicate Telegram callback remains idempotent.

## 4. Hardening gate
Публичная проверка 2026-09-13:
- `https://api.onsdelaet.ru/health` → 200 — PASS;
- `https://tg.onsdelaet.ru/health` → 200 — PASS;
- `https://onsdelaet.ru/` → 200 — PASS;
- на основном site response отсутствуют `Strict-Transport-Security`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `X-Frame-Options` — GAP.

Автоматическая публичная проверка:
```bash
node tools/launch/hardening-public-audit.mjs
```

До launch ещё проверить на сервере:
- DB backup и фактический restore-test;
- backup публичного сайта;
- права `/etc/sdelaet/*.env` и отсутствие секретов в логах;
- `sdelaet-api`, Telegram gateway и followup worker restart policy;
- nginx config test;
- rate limits/size limits публичных write endpoints;
- admin API недоступен через публичный API hostname;
- журналирование 4xx/5xx без PII/secrets;
- добавить security headers на HTTPS vhost сайта и повторить публичный audit.

## 5. Analytics gate
Счётчик Яндекс Метрики: `112503660`.
До платного трафика должна восстанавливаться воронка:
`landing → task_created → tariff_selected → payment_started → paid → candidates_ready → contractor_selected → completed → review_completed`.

Публичная проверка 2026-09-13 показала:
- `/create-task.html` подключает `/assets/analytics.js` и счётчик 112503660 — PASS;
- `/` не подключает `/assets/analytics.js` — GAP;
- `/payment.html` не подключает `/assets/analytics.js` — GAP.

Это означает, что `sdTrack(...)` на страницах без `analytics.js` не гарантирует отправку `reachGoal` в Метрику. До закупки трафика покрытие analytics.js нужно сделать единообразным на всей воронке.

Автоматическая проверка покрытия:
```bash
node tools/launch/analytics-audit.mjs
```

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
Проверено 2026-09-13: `/`, `/create-task.html`, `/payment.html`, `/offer.html`, `/privacy.html`, `/requisites.html` возвращают HTTP 200.

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
