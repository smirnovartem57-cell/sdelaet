import {
  captureLegacyComparison,
  resolveOfferComparisonDecision,
  applyOfferComparisonDecision
} from '../src/offer-comparison-decision.mjs';

function ok(name, value) {
  if (!value) throw new Error('FAIL ' + name);
  console.log('PASS', name);
}

const legacyTrue = captureLegacyComparison({
  comparable: true,
  comparableTotalPrice: 37000,
  gaps: ['legacy gap'],
  missingCriticalWorks: ['legacy work'],
  flags: ['legacy flag']
});

const stricter = resolveOfferComparisonDecision(
  {
    comparisonReady: false,
    comparableTotalPrice: null
  },
  legacyTrue
);
ok('contract false overrides legacy true', stricter.comparable === false);
ok('contract false status', stricter.comparisonStatus === 'needs_data');
ok('legacy snapshot retained', stricter.legacy.comparable === true);
ok('legacy mismatch recorded', stricter.legacyMismatch === true);
ok('legacy arrays retained', stricter.legacy.gaps[0] === 'legacy gap');

const legacyFalse = captureLegacyComparison({
  comparable: false,
  comparableTotalPrice: null
});
const permissive = resolveOfferComparisonDecision(
  {
    comparisonReady: true,
    comparableTotalPrice: 49000
  },
  legacyFalse
);
ok('contract true overrides legacy false', permissive.comparable === true);
ok('contract price authoritative', permissive.comparableTotalPrice === 49000);
ok('opposite mismatch recorded', permissive.legacyMismatch === true);

const normalized = { comparable: false, comparableTotalPrice: null };
const applied = applyOfferComparisonDecision(
  normalized,
  { comparisonReady: true, comparableTotalPrice: 51000 },
  legacyFalse
);
ok('apply returns contract decision', applied.comparable === true);
ok('normalized contract comparable', normalized.comparable === true);
ok('normalized contract price', normalized.comparableTotalPrice === 51000);
ok('backward legacy alias retained', normalized.legacyComparable === false);
ok('structured legacy audit retained', normalized.comparisonDecision.legacy.comparable === false);

console.log('OFFER COMPARISON DECISION REGRESSION: PASS');
