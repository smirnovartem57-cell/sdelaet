import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PROFILE_DIR = path.join(ROOT, 'assets', 'category-profiles');
const RULES_DIR = path.join(ROOT, 'assets', 'category-offer-rules');

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

export function analyzeOfferContractCoverage() {
  const profileFiles = fs.readdirSync(PROFILE_DIR)
    .filter(name => name.endsWith('.json'))
    .sort();
  const ruleFiles = fs.existsSync(RULES_DIR)
    ? fs.readdirSync(RULES_DIR).filter(name => name.endsWith('.json')).sort()
    : [];
  const ruleIds = new Set(ruleFiles.map(name => name.replace(/\.json$/, '')));

  const categories = profileFiles.map(file => {
    const profile = readJson(path.join(PROFILE_DIR, file));
    const id = profile.categoryId || file.replace(/\.json$/, '');
    const schema = Array.isArray(profile.comparisonSchema)
      ? profile.comparisonSchema
      : [];
    const fieldIds = schema.map(field => field.id).filter(Boolean);
    const duplicateFields = fieldIds.filter((id, i) => fieldIds.indexOf(id) !== i);
    const critical = schema.filter(field => field.importance === 'critical').length;
    const important = schema.filter(field => field.importance === 'important').length;
    const explicitRules = ruleIds.has(id);
    const tier = explicitRules
      ? 'EXPLICIT_RULES'
      : schema.length && critical
        ? 'SCHEMA_CANDIDATE'
        : schema.length
          ? 'SCHEMA_WEAK'
          : 'COMMON_ONLY';

    return {
      categoryId: id,
      profileVersion: profile.profileVersion || null,
      comparisonFields: schema.length,
      criticalFields: critical,
      importantFields: important,
      explicitRules,
      outreachContract: Boolean(profile.outreachContract),
      clarificationPolicy: Boolean(profile.clarificationPolicy),
      duplicateFields: [...new Set(duplicateFields)],
      tier
    };
  });

  const counts = Object.fromEntries(
    ['EXPLICIT_RULES', 'SCHEMA_CANDIDATE', 'SCHEMA_WEAK', 'COMMON_ONLY']
      .map(tier => [tier, categories.filter(item => item.tier === tier).length])
  );

  return {
    profileCount: categories.length,
    explicitRulesCount: ruleIds.size,
    counts,
    categories,
    invalidRuleTargets: [...ruleIds].filter(id => !categories.some(item => item.categoryId === id)),
    duplicateCategoryIds: categories
      .map(item => item.categoryId)
      .filter((id, i, all) => all.indexOf(id) !== i)
  };
}
