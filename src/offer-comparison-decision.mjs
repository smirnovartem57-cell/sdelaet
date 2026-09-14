export function captureLegacyComparison(normalized = {}) {
  return {
    comparable: Boolean(normalized.comparable),
    comparableTotalPrice:
      normalized.comparableTotalPrice ?? null,
    gaps: Array.isArray(normalized.gaps)
      ? [...normalized.gaps]
      : [],
    missingCriticalWorks:
      Array.isArray(normalized.missingCriticalWorks)
        ? [...normalized.missingCriticalWorks]
        : [],
    flags: Array.isArray(normalized.flags)
      ? [...normalized.flags]
      : []
  };
}

export function resolveOfferComparisonDecision(
  contractEvaluation,
  legacyComparison
) {
  const comparable =
    Boolean(contractEvaluation?.comparisonReady);

  return {
    source: 'contract_v2',
    comparable,
    comparisonStatus:
      comparable ? 'comparable' : 'needs_data',
    comparableTotalPrice:
      contractEvaluation?.comparableTotalPrice ?? null,
    legacy: legacyComparison,
    legacyMismatch:
      Boolean(legacyComparison?.comparable) !== comparable
  };
}

export function applyOfferComparisonDecision(
  normalized,
  contractEvaluation,
  legacyComparison
) {
  const decision =
    resolveOfferComparisonDecision(
      contractEvaluation,
      legacyComparison
    );

  normalized.contractEvaluation =
    contractEvaluation;
  normalized.comparisonDecision = decision;

  // Temporary backward-compatible audit aliases.
  // They are never authoritative for persistence.
  normalized.legacyComparable =
    Boolean(legacyComparison?.comparable);
  normalized.legacyComparableTotalPrice =
    legacyComparison?.comparableTotalPrice ?? null;

  normalized.comparable = decision.comparable;
  normalized.comparableTotalPrice =
    decision.comparableTotalPrice;

  return decision;
}
