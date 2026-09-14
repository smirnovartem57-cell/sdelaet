import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const COMMON_PATH = path.join(ROOT, 'assets', 'offer-contract-common.json');
const PROFILE_DIR = path.join(ROOT, 'assets', 'category-profiles');
const RULES_DIR = path.join(ROOT, 'assets', 'category-offer-rules');

let commonCache = null;
const profileCache = new Map();
const rulesCache = new Map();

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function clone(value) {
  return structuredClone(value);
}

export function loadCommonOfferContract() {
  if (!commonCache) commonCache = readJson(COMMON_PATH);
  return clone(commonCache);
}

export function loadCategoryProfile(categoryId) {
  const id = String(categoryId || '').trim();
  if (!id) throw Object.assign(new Error('CATEGORY_ID_REQUIRED'), { code: 'CATEGORY_ID_REQUIRED' });
  if (!profileCache.has(id)) {
    const file = path.join(PROFILE_DIR, `${id}.json`);
    if (!fs.existsSync(file)) throw Object.assign(new Error('CATEGORY_PROFILE_NOT_FOUND'), { code: 'CATEGORY_PROFILE_NOT_FOUND' });
    profileCache.set(id, readJson(file));
  }
  return clone(profileCache.get(id));
}

export function loadCategoryOfferRules(categoryId) {
  const id = String(categoryId || '').trim();
  if (!rulesCache.has(id)) {
    const file = path.join(RULES_DIR, `${id}.json`);
    rulesCache.set(id, fs.existsSync(file) ? readJson(file) : {});
  }
  return clone(rulesCache.get(id));
}

function text(value) {
  return String(value || '').toLowerCase().replace(/ё/g, 'е');
}

function taskCategoryId(task) {
  return task?.categoryId || task?.service_id || task?.serviceId || '';
}

function requested(task, pattern) {
  return pattern.test(text([
    task?.description,
    task?.scope,
    task?.finish,
    task?.finishScope,
    ...(task?.extraWorks || [])
  ].join(' ')));
}

function scenarioContext(task) {
  const all = text([task?.goal, task?.scope, task?.description].join(' '));
  return {
    winter: /кабинет|зим|круглогод/.test(all) || ['winter_workspace', 'year_round_use'].includes(task?.goal),
    partial: /одн[ауо]\s+(?:стен|зон|поверх)|только\s+(?:пол|потол|стен|парапет)|частич/.test(all),
    finishRequested: requested(task, /отделк|под\s+ключ/),
    demolitionExpected: requested(task, /демонтаж|передел|стар.*(?:утеп|отдел)/),
    electricsRequested: requested(task, /электрик|розет|освещ/),
    warmFloorRequested: requested(task, /(?:т[её]пл(?:ый|ого|ому|ым)?\s+пол|электрическ[^\s]*\s+т[её]пл[^\s]*\s+пол|подогрев\s+пола)/)
  };
}

function resolveRequirement(rule, context) {
  if (rule === true || rule === false) return rule;
  switch (rule) {
    case 'winter_or_year_round': return context.winter;
    case 'when_finish_requested': return context.finishRequested;
    case 'when_demolition_expected': return context.demolitionExpected;
    case 'when_electrics_requested': return context.electricsRequested;
    case 'when_warm_floor_requested': return context.warmFloorRequested;
    case 'when_applicable': return context.winter;
    case 'when_materials_separate': return false;
    default: return false;
  }
}

function resolveCriticalWorks(rules, task, context) {
  const scenarios = rules?.scenarioRules || {};
  if (context.partial && scenarios.partial_scope?.criticalWorksFromTaskOnly) {
    const value = text([task?.scope, task?.description].join(' '));
    const out = [];
    if (/пол/.test(value)) out.push('floorInsulation');
    if (/потол/.test(value)) out.push('ceilingInsulation');
    if (/стен|парапет/.test(value)) out.push('wallsParapetInsulation');
    if (/примыкан|гермет/.test(value)) out.push('junctionSealing');
    return out;
  }
  if (context.winter) return [...(scenarios.winter_workspace?.criticalWorks || [])];
  return [];
}

function categoryFields(profile, rules, commonIds, context) {
  const policies = rules?.fieldPolicies || {};
  return (profile.comparisonSchema || [])
    .filter(field => !commonIds.has(field.id))
    .map(field => {
      const policy = policies[field.id] || {};
      return {
        ...field,
        ...policy,
        source: 'category',
        applicable: true,
        requirementRule: policy.requiredRule ?? false,
        requirementLevel: policy.requirementLevel || 'optional',
        required: resolveRequirement(policy.requiredRule ?? false, context)
      };
    });
}

export function resolveOfferContract(task) {
  const categoryId = taskCategoryId(task);
  const common = loadCommonOfferContract();
  const profile = loadCategoryProfile(categoryId);
  const rules = loadCategoryOfferRules(categoryId);
  const context = scenarioContext(task || {});

  const commonFields = common.responseFields.map(field => ({
    ...field,
    source: 'common',
    applicable: true,
    requirementRule: field.requiredRule ?? false,
    required: resolveRequirement(field.requiredRule ?? false, context)
  }));
  const commonIds = new Set(commonFields.map(field => field.id));
  const fields = [...commonFields, ...categoryFields(profile, rules, commonIds, context)];

  const criticalWorks = resolveCriticalWorks(rules, task || {}, context);
  const definitions = rules.workDefinitions || [];
  const criticalWorkDefinitions = criticalWorks
    .map(id => definitions.find(item => item.id === id))
    .filter(Boolean);

  return {
    schemaVersion: '2.0',
    categoryId,
    profileVersion: profile.profileVersion,
    commonContractId: common.contractId,
    context,
    fields,
    criticalWorks,
    criticalWorkDefinitions,
    clarificationPolicy: profile.clarificationPolicy || { maxQuestionsPerRound: 5 },
    outreachContract: profile.outreachContract || null,
    comparisonRules: common.comparisonRules || {}
  };
}

export function clearOfferContractCache() {
  commonCache = null;
  profileCache.clear();
  rulesCache.clear();
}
