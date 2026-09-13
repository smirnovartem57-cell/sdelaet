# LAUNCH_READINESS

## Scope
Платёжный контур и текущая публикация юридических страниц ведутся отдельно. Этот документ покрывает оставшиеся launch-gates: recovery/admin, lifecycle, hardening, analytics и production acceptance. SEO pages остаются `noindex,follow` до отдельного approval.

## 1. Recovery/admin gate
Публичная защита проверена 2026-09-13:
- `https://onsdelaet.ru/admin/` → 401 без авторизации — PASS;
- `https://onsdelaet.ru/admin-api/recovery` → 401 без авторизации — PASS;
- `https://api.onsdelaet.ru/v1/admin/recovery` → 404 — PASS.

Перед launch на production ещё проверить:
- PII клиента не попадает в публичный HTML/API;
- статусы recovery: `new/contact_requested → in_progress → resolved/closed`;
- доступны `assigned_to`, `solution_notes`, `contacted_at`, `resolved_at`, `closed_at`;
- проблема исполнителя создаёт high-priority recovery case и admin Telegram alert.

Автоматическая проверка:
```bash
node tools/launch/security-smoke.mjs
```

## 2. Client lifecycle gate
Положительный review-flow уже пройден:
`completed → rating → price match → recommendation → comment → photo → public consent`.

Осталось прогнать отдельными тестами:
- price increased significantly;
- do not recommend contractor;
- work partially completed;
- work not completed;
- contractor problem → recovery;
- user requests help;
- duplicate Telegram callback remains idempotent.

## 3. Hardening gate
Публичная проверка 2026-09-13:
- `https://onsdelaet.ru/` → 200 — PASS;
- `https://api.onsdelaet.ru/health` → 200 — PASS;
- `https://tg.onsdelaet.ru/health` → 200 — PASS;
- основной site response не содержит `Strict-Transport-Security` — GAP;
- не содержит `X-Content-Type-Options` — GAP;
- не содержит `Referrer-Policy` — GAP;
- не содержит `Permissions-Policy` — GAP;
- не содержит `X-Frame-Options` — GAP.

Автоматическая публичная проверка:
```bash
node tools/launch/hardening-public-audit.mjs
```

До launch ещё проверить на сервере:
- DB backup и фактический restore-test;
- backup публичного сайта;
- права `/etc/sdelaet/*.env` и отсутствие секретов в логах;
- restart policy `sdelaet-api`, Telegram gateway и followup worker;
- `nginx -t`;
- rate limits/size limits публичных write endpoints;
- 4xx/5xx logging без PII/secrets;
- добавить security headers на HTTPS vhost сайта и повторить audit.

## 4. Analytics gate
Счётчик Яндекс Метрики: `112503660`.
До платного трафика должна восстанавливаться воронка:
`landing → task_created → tariff_selected → payment_started → paid → candidates_ready → contractor_selected → completed → review_completed`.

Публичная проверка 2026-09-13:
- `/create-task.html` подключает `/assets/analytics.js` и счётчик 112503660 — PASS;
- `/` не подключает `/assets/analytics.js` — GAP;
- `/payment.html` не подключает `/assets/analytics.js` — GAP.

На страницах без `analytics.js` вызов `sdTrack(...)` не гарантирует отправку `reachGoal` в Метрику. До закупки трафика нужно единообразное подключение analytics.js на всей воронке.

Автоматическая проверка:
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

## 5. Public smoke
Проверено 2026-09-13: `/`, `/create-task.html`, `/payment.html`, `/offer.html`, `/privacy.html`, `/requisites.html` возвращают HTTP 200.

Команда:
```bash
node tools/launch/public-smoke.mjs
```

## 6. Production acceptance
Использовать нового тестового клиента и новую задачу. Не переиспользовать старый test task.
Проверить на мобильном:
1. landing;
2. create task;
3. Telegram;
4. paid entitlement — проверяется отдельным payment workstream;
5. candidates;
6. comparison;
7. contractor selection;
8. followups;
9. recovery path;
10. review path.

## 7. Soft launch gate
Можно запускать первые реальные источники трафика только если:
- payment gate отдельно пройден;
- production acceptance PASS;
- analytics funnel виден;
- recovery alerts работают;
- backup/restore PASS;
- critical 5xx отсутствуют;
- SEO pages остаются noindex до отдельного SEO approval.
