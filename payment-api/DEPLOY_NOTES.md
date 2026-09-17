# Payment API deploy notes

Production parameters:
- customerCode: 301567811
- merchantId: 200000000044177
- terminalId: 20043177
- MCC: 7299
- payment modes: sbp, card

Secrets must not be committed. Runtime requires TOCHKA_JWT_TOKEN.
Callback URL: https://onsdelaet.ru/api/payments/v1/tochka/webhook
