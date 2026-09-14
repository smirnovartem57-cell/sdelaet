# Stage 2I — Trade contract rules

Goal: extend contract-driven offer comparison to the next two mature service categories without broad enabling of common-only categories.

Categories:
- `electrical-installation`
- `plumbing-works`

Design:
- category rules are declarative;
- scenario-dependent requirements use generic `requiredWhen` conditions in the resolver;
- full representative offers from existing QA/E2E must be comparison-ready;
- incomplete offers must be blocked by the exact missing expert fields;
- existing legacy normalizer/browser compatibility remains unchanged.

Release gate:
- `trade-contract-rules-regression.mjs` PASS;
- full Platform readiness PASS;
- coverage audit explicit rules count increases from 3 to 5.
