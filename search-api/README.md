# Сделает — Search API

Stateless API for live contractor discovery. No user accounts or database required.

## Providers

- Yandex Search API v2: company websites and Yandex Executors/Services profiles.
- 2GIS Places API: company discovery and independent source confirmation.

## Required secrets

At minimum for a useful live search:

- `YANDEX_SEARCH_API_KEY`
- `YANDEX_FOLDER_ID`

Recommended additional provider:

- `DGIS_API_KEY`

The Yandex service account needs the `search-api.webSearch.user` role and API-key scope `yc.search-api.execute`.

## Endpoints

- `GET /health`
- `POST /v1/candidates/search`

Example request:

```json
{
  "categoryId": "balcony-insulation",
  "category": "Утепление / отделка балкона",
  "city": "Мытищи",
  "description": "Нужно утеплить одну стену балкона вокруг окна",
  "scope": "Одна стена балкона",
  "executorPreference": "any",
  "limit": 10
}
```

## Node on the existing server

```bash
cd /srv/sdelaet/app/search-api
export YANDEX_SEARCH_API_KEY=...
export YANDEX_FOLDER_ID=...
export DGIS_API_KEY=...
PORT=8788 node server.mjs
```

Nginx can proxy `https://api.onsdelaet.ru/v1/` to `http://127.0.0.1:8788/v1/`.

## Cloudflare Worker alternative

```bash
wrangler secret put YANDEX_SEARCH_API_KEY
wrangler secret put YANDEX_FOLDER_ID
wrangler secret put DGIS_API_KEY
wrangler deploy
```
