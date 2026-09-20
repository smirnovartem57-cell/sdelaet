# Sdelaet payment API

Server-side payment layer for Tochka internet acquiring.

Endpoints:
- POST /v1/payments
- GET /v1/payments/:id
- POST /v1/tochka/webhook
- GET /health

Amounts are resolved server-side from plans.mjs. Browser-provided amounts are ignored.

## Payment watchdog

`sdelaet-payment-watchdog.timer` runs every 2 minutes. It checks real orders that remain `pending`, asks Tochka for the current operation status, and self-heals local `pending` orders when Tochka already reports `APPROVED`.

If a real payment is still pending longer than `PAYMENT_PENDING_ALERT_MINUTES`, the watchdog sends an internal Telegram alert to `ADMIN_TELEGRAM_CHAT_ID` using the existing Telegram configuration. If a previously alerted payment later becomes paid, a recovery notification is sent once.

Smoke/test task IDs (`TEST-PROD-*`, `fiscal-receipt-smoke-*`) are excluded. Alert state is persisted in `PAYMENT_WATCHDOG_STATE_FILE` so the same stuck order does not spam repeated notifications.

Email is optional and disabled by default (`PAYMENT_ALERT_EMAIL_ENABLED=0`) until outbound SPF/DKIM is configured for the server.
