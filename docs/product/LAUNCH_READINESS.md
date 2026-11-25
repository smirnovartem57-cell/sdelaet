# LAUNCH_READINESS

## Scope
Платёжный контур и текущая публикация юридических страниц ведутся отдельно. Здесь зафиксированы остальные launch-gates: recovery/admin, lifecycle, hardening, analytics и production acceptance. SEO-страницы остаются `noindex,follow` до отдельного approval.

## 1. Recovery/admin
Проверено 2026-09-13:
- `https://onsdelaet.ru/admin/` → 401 без авторизации — PASS;
- `https://onsdelaet.ru/admin-api/recovery` → 401 без авторизации — PASS;
- `https://api.onsdelaet.ru/v1/admin/recovery` → 404 — PASS.

Осталось проверить на production:
- PII не попадает в публичный HTML/API;
- статусы `new/contact_requested → in_progress → resolved/closed`;
- `assigned_to`, `solution_notes`, `contacted_at`, `resolved_at`, `closed_at`;
- contractor problem создаёт high-priority recovery case и Telegram alert.

Команда:
```bash
node tools/launch/security-smoke.mjs
```

## 2. Client lifecycle
Положительный review-flow уже пройден:
`completed → rating → price match → recommendation → comment → photo → public consent`.

Остались сценарии:
- price increased significantly;
- do not recommend contractor;
- work partially completed;
- work not completed;
- contractor problem → recovery;
- user requests help;
- duplicate Telegram callback remains idempotent.

## 3. Hardening
Публичная проверка 2026-09-13:
- site → 200 — PASS;
- API health → 200 — PASS;
- Telegram gateway health → 200 — PASS;
- отсутствует `Strict-Transport-Security` — GAP;
- отсутствует `X-Content-Type-Options` — GAP;
- отсутствует `Referrer-Policy` — GAP;
- отсутствует `Permissions-Policy` — GAP;
- отсутствует `X-Frame-Options` — GAP.

Команда:
```bash
node tools/launch/hardening-public-audit.mjs
```

До launch на сервере:
- DB backup + реальный restore-test;
- backup публичного сайта;
- права `/etc/sdelaet/*.env`;
- отсутствие secrets/PII в логах;
- restart policy сервисов;
- `nginx -t`;
- rate/size limits публичных write endpoints;
- 4xx/5xx logging без PII;
- добавить security headers и повторить audit.

## 4. Analytics
Счётчик Метрики: `112503660`.

Целевая воронка:
`landing → task_created → tariff_selected → payment_started → paid → candidates_ready → contractor_selected → completed → review_completed`.

Публичная проверка 2026-09-13:
- `/create-task.html` подключает `/assets/analytics.js` — PASS;
- `/` не подключает `/assets/analytics.js` — GAP;
- `/payment.html` не подключает `/assets/analytics.js` — GAP.

До платного трафика подключение analytics.js должно быть единообразным по всей воронке.

Команда:
```bash
node tools/launch/analytics-audit.mjs
```

## 5. Public smoke
Проверено 2026-09-13: `/`, `/create-task.html`, `/payment.html`, `/offer.html`, `/privacy.html`, `/requisites.html` возвращают HTTP 200.

Команда:
```bash
node tools/launch/public-smoke.mjs
```

## 6. Production acceptance
Использовать нового тестового клиента и новую задачу.
Проверить на мобильном:
1. landing;
2. create task;
3. Telegram;
4. paid entitlement — отдельный payment workstream;
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
- SEO pages остаются noindex до отдельного approval.
