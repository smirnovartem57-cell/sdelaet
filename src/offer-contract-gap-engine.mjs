function text(value) {
  return String(value || '').toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();
}

function isMissing(value) {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return !value.trim();
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

function offerValue(offer, field) {
  for (const key of [field.id, ...(field.aliases || [])]) {
    if (Object.prototype.hasOwnProperty.call(offer, key) && !isMissing(offer[key])) return offer[key];
  }
  return undefined;
}

function fieldRequired(field, offer) {
  if (field.required === true) return true;
  if (field.requirementRule === 'when_materials_separate') return offer.materialsIncluded === false;
  return false;
}

function workMatched(offer, definition) {
  const haystack = (offer.worksIncluded || []).map(text);
  return (definition.match || []).some(candidate => {
    const needle = text(candidate);
    return haystack.some(value => value.includes(needle) || needle.includes(value));
  });
}

function uniq(values) {
  return [...new Set(values.filter(Boolean))];
}

function numeric(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function deriveComparableTotalPrice(offer, comparisonReady) {
  if (!comparisonReady) return null;
  const total = numeric(offer.totalPrice);
  if (total === null) return null;
  if (offer.materialsIncluded === false) {
    const materials = numeric(offer.materialsPrice);
    return materials === null ? null : total + materials;
  }
  return total;
}

function ruleViolations(contract, offer) {
  const rules = contract.comparisonRules || {};
  const out = [];
  if (rules.fromPriceIsDirectlyComparable === false && (offer.priceType === 'from' || offer.isFromPrice === true)) {
    out.push({ id: 'from_price', field: 'priceType', clarification: 'подтверждённую итоговую стоимость без цены «от»' });
  }
  if (rules.unknownMaterialsInclusionIsDirectlyComparable === false && offer.materialsIncluded == null) {
    out.push({ id: 'materials_unknown', field: 'materialsIncluded', clarification: 'входят ли материалы в указанную стоимость' });
  }
  if (rules.materialsSeparateWithoutPriceIsDirectlyComparable === false && offer.materialsIncluded === false && numeric(offer.materialsPrice) === null) {
    out.push({ id: 'materials_price_missing', field: 'materialsPrice', clarification: 'стоимость материалов отдельной суммой' });
  }
  return out;
}

export function evaluateOfferContract(contract, offer = {}) {
  const matchedWorkIds = new Set();
  const missingCriticalWorks = [];
  for (const definition of contract.criticalWorkDefinitions || []) {
    if (workMatched(offer, definition)) matchedWorkIds.add(definition.id);
    else missingCriticalWorks.push({ id: definition.id, clarification: definition.clarification || definition.id });
  }

  const missingFields = [];
  for (const field of contract.fields || []) {
    if (field.applicable === false || !fieldRequired(field, offer)) continue;
    if ((field.satisfiedByWorks || []).some(id => matchedWorkIds.has(id))) continue;
    if (isMissing(offerValue(offer, field))) {
      missingFields.push({ id: field.id, source: field.source, group: field.group, clarification: field.clarification || field.label || field.id });
    }
  }

  const comparisonBlockingFields = missingFields.filter(item => {
    const definition = (contract.fields || []).find(field => field.id === item.id);
    return definition?.requirementLevel === 'comparison';
  });
  const comparisonBlockingWorks = missingCriticalWorks.filter(item => {
    const definition = (contract.criticalWorkDefinitions || []).find(work => work.id === item.id);
    return !definition || definition.requirementLevel === 'comparison';
  });
  const comparisonRuleViolations = ruleViolations(contract, offer);
  const comparisonReady = comparisonBlockingFields.length === 0 && comparisonBlockingWorks.length === 0 && comparisonRuleViolations.length === 0;
  const comparableTotalPrice = deriveComparableTotalPrice(offer, comparisonReady);

  const priceItems = missingFields.filter(x => x.group === 'price').map(x => x.clarification);
  const criticalItems = missingCriticalWorks.map(x => x.clarification);
  const categoryItems = missingFields.filter(x => x.source === 'category' && x.group !== 'price').map(x => x.clarification);
  const commonItems = missingFields.filter(x => x.source === 'common' && x.group !== 'price').map(x => x.clarification);
  const ruleItems = comparisonRuleViolations.map(x => x.clarification);
  const allClarificationItems = uniq([...ruleItems, ...priceItems, ...criticalItems, ...categoryItems, ...commonItems]);
  const maxQuestions = Number(contract.clarificationPolicy?.maxQuestionsPerRound || 5);
  const clarificationItems = allClarificationItems.slice(0, maxQuestions);

  return {
    comparisonReady,
    comparableTotalPrice,
    comparisonBlockingFields,
    comparisonBlockingWorks,
    comparisonRuleViolations,
    contractComplete: missingFields.length === 0 && missingCriticalWorks.length === 0 && comparisonRuleViolations.length === 0,
    missingFields,
    missingCriticalWorks,
    clarificationItems,
    hasMoreClarifications: allClarificationItems.length > clarificationItems.length,
    counts: {
      missingFields: missingFields.length,
      missingCriticalWorks: missingCriticalWorks.length,
      ruleViolations: comparisonRuleViolations.length,
      clarificationItems: clarificationItems.length,
      totalClarificationItems: allClarificationItems.length
    }
  };
}
