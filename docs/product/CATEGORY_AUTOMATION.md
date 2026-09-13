# Category Automation

## Goal
Scale `Сделает` from 15 categories to dozens/hundreds without manually registering every category in many files.

## Source of truth
`config/service-categories.json` is the category registry.

Each entry defines:
- `categoryId`, `serviceCode`, title;
- lifecycle status, priority, seasonality;
- profile and Expert Model paths;
- QA and E2E test paths;
- routing test phrase;
- contractor qualification phrase;
- search queries / keywords.

Generated registries must not be edited manually.
## Create a category

Use:

`node tools/category-agents/create-category.mjs --id <id> --code <CODE> --title "<Name>" ...`

Recommended inputs also include:
- `--test-phrase`;
- `--qualification-phrase`;
- `--company-queries`;
- `--private-queries`;
- `--keywords`;
- `--qualify-keywords`;
- `--priority` and `--seasonality`.

Use `--dry-run` first when needed. It prints the complete registration plan without writing files.
## What is automated

The command creates/registers:
- manifest entry;
- category profile in `RESEARCH`;
- Expert Model scaffold;
- QA/E2E test scaffolds;
- generated browser category registry;
- generated Search API category config;
- `SERVICE_TAXONOMY` category table;
- `PROJECT_STATE` category-state section.

CI reads the manifest dynamically. A category in `RESEARCH` may remain incomplete without failing global CI. Once status becomes `TESTING`, runtime wiring, search configuration, QA/E2E and system audit become mandatory.
