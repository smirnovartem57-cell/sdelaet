# Sdelaet payment API

Server-side payment layer for Tochka internet acquiring.

Endpoints:
- POST /v1/payments
- GET /v1/payments/:id
- POST /v1/tochka/webhook
- GET /health

Amounts are resolved server-side from plans.mjs. Browser-provided amounts are ignored.
