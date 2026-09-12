# BALCONY_INSULATION — Expert Model

Lifecycle: `READY`
Profile: `assets/category-profiles/balcony-insulation.json`
Full specification: `docs/product/categories/balcony-insulation.md`

This is the reference category for the service taxonomy architecture.

Validated principles:
- user describes the desired result, not the insulation technology;
- winter/year-round use requires evaluation of glazing and junctions;
- moisture/condensation/freezing cause is not asserted without inspection;
- exact geometry, hidden substrates, existing build-up and structural capacity are site-inspection facts;
- contractor response must separate scope, materials, exclusions, extras, timing and warranty;
- incomplete low price is not automatically preferred to a complete comparable price;
- offer parser → follow-up → merge → normalizer → recommendation → explanation → action layer works without an external LLM.

Release evidence is stored in the category profile and regression suites. Any future change to critical scope, required estimate lines, risk rules or comparability must update tests before deployment.