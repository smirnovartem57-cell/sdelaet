import { spawnSync } from 'node:child_process';

const commands = [
  ['syntax: category engine', ['--check', 'assets/category-engine.js']],
  ['syntax: expert agent', ['--check', 'assets/expert-agent.js']],
  ['syntax: expert runtime', ['--check', 'assets/expert-runtime.js']],
  ['syntax: geo classifier', ['--check', 'assets/geo-classifier.js']],
  ['syntax: offer parser', ['--check', 'assets/offer-parser.js']],
  ['syntax: offer follow-up', ['--check', 'assets/offer-followup.js']],
  ['syntax: offer merge', ['--check', 'assets/offer-merge.js']],
  ['syntax: offer normalizer', ['--check', 'assets/offer-normalizer.js']],
  ['syntax: live search', ['--check', 'assets/live-search.js']],
  ['syntax: launch UI', ['--check', 'assets/launch-v2.js']],
  ['category lifecycle', ['tests/category-lifecycle-regression.mjs']],
  ['generated registries', ['tests/category-generated-registry-regression.mjs']],
  ['category manifest', ['tests/category-regression-manifest.mjs']],
  ['category system audit', ['tests/category-system-audit-regression.mjs']],
  ['production wiring', ['tests/production-category-wiring-regression.mjs']],
  ['geo classifier', ['tests/geo-classifier-regression.mjs']],
  ['offer commercial schema', ['tests/shared-offer-schema-regression.mjs']],
  ['category qualification', ['tests/category-aware-qualification-regression.mjs']],
  ['search qualification', ['tests/search-qualification-regression.mjs']],
  ['expert runtime fallback', ['tests/expert-runtime-fallback-regression.mjs']],
  ['agent pipeline', ['tests/category-agent-pipeline-regression.mjs']],
  ['category creation', ['tests/category-create-command-regression.mjs']],
  ['seasonal routing', ['tests/seasonal-category-routing-regression.mjs']],
  ['seasonal expert', ['tests/seasonal-expert-regression.mjs']],
  ['offer parser', ['tests/offer-parser-regression.mjs']],
  ['offer follow-up', ['tests/offer-followup-regression.mjs']],
  ['offer merge', ['tests/offer-merge-regression.mjs']],
  ['offer normalizer', ['tests/balcony-offer-normalizer-regression.mjs']],
  ['recommendation status', ['tests/recommendation-status-regression.mjs']],
  ['recommendation actions', ['tests/recommendation-actions-regression.mjs']],
  ['comparison explainer', ['tests/comparison-explainer-regression.mjs']],
  ['category QA and E2E', ['tools/category-agents/run.mjs', '--all', '--ci']],
];

let passed = 0;
for (const [name, args] of commands) {
  const result = spawnSync(process.execPath, args, { encoding: 'utf8' });
  if (result.status !== 0) {
    console.error('FAIL ' + name);
    if (result.stdout) console.error(result.stdout.trim());
    if (result.stderr) console.error(result.stderr.trim());
    process.exit(result.status || 1);
  }
  const summary = (result.stdout || '').trim().split(/\r?\n/).filter(Boolean).at(-1);
  console.log('PASS ' + name + (summary ? ' — ' + summary : ''));
  passed += 1;
}
console.log('Platform readiness: ' + passed + '/' + commands.length + ' automated gates PASS');
console.log('External gates: manual user-facing review DEFERRED; VDS deployment INFRA_BLOCKED until SSH secrets are restored.');
