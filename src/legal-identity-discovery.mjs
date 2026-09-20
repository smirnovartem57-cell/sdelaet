const stringValue = value => String(value ?? '').trim();
const digits = value => stringValue(value).replace(/\D/g, '');
const normalizedText = value => stringValue(value).toLowerCase().replace(/ё/g, 'е').replace(/[^a-zа-я0-9]+/giu, ' ').replace(/\s+/g, ' ').trim();

function hostname(value) {
  try {
    const url = /^https?:\/\//i.test(stringValue(value)) ? stringValue(value) : `https://${stringValue(value)}`;
    return new URL(url).hostname.toLowerCase().replace(/^www\./, '');
  } catch { return ''; }
}
function rootDomain(value) {
  const host = hostname(value);
  const parts = host.split('.').filter(Boolean);
  return parts.length >= 2 ? parts.slice(-2).join('.') : host;
}
function transliteratedCompact(value) {
  const map = {а:'a',б:'b',в:'v',г:'g',д:'d',е:'e',ё:'e',ж:'zh',з:'z',и:'i',й:'j',к:'k',л:'l',м:'m',н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ф:'f',х:'h',ц:'c',ч:'ch',ш:'sh',щ:'sch',ъ:'',ы:'y',ь:'',э:'e',ю:'yu',я:'ya'};
  return stringValue(value).toLowerCase().split('').map(char => map[char] ?? char).join('').replace(/[^a-z0-9]+/g, '');
}
function decoded(value) { try { return decodeURIComponent(stringValue(value)); } catch { return stringValue(value); } }

export function isValidRussianInn(value) {
  const inn = digits(value);
  if (!/^\d{10}$|^\d{12}$/.test(inn)) return false;
  const checksum = weights => weights.reduce((sum, weight, index) => sum + weight * Number(inn[index]), 0) % 11 % 10;
  if (inn.length === 10) return checksum([2, 4, 10, 3, 5, 9, 4, 6, 8]) === Number(inn[9]);
  return checksum([7, 2, 4, 10, 3, 5, 9, 4, 6, 8]) === Number(inn[10]) && checksum([3, 7, 2, 4, 10, 3, 5, 9, 4, 6, 8]) === Number(inn[11]);
}

export function buildLegalIdentityDiscoveryQueries(candidate = {}, city = '') {
  const result = [];
  const domain = rootDomain(candidate.website);
  const phone = digits(candidate.phone || candidate.phones?.[0]);
  const brand = stringValue(candidate.name);
  const address = stringValue(candidate.address || candidate.geo);
  if (domain) {
    result.push(`"${domain}" ИНН ОГРН`);
    result.push(`"${domain}" "taxpayer-id"`);
  }
  if (phone) result.push(`"${phone}" ИНН ОГРН`);
  if (brand) result.push([`"${brand}"`, city && `"${city}"`, 'ИНН ОГРН'].filter(Boolean).join(' '));
  if (address) result.push(`"${address}" ИНН ОГРН`);
  return [...new Set(result)].slice(0, 4);
}

export function extractLabeledLegalIdentifiers(document = {}) {
  const haystack = [document.title, document.text, document.snippet, decoded(document.url)].filter(Boolean).join(' ');
  const inns = [], ogrns = [];
  const collect = (pattern, target, validate) => {
    for (const match of haystack.matchAll(pattern)) {
      const value = digits(match[1]);
      if (validate(value) && !target.includes(value)) target.push(value);
    }
  };
  collect(/(?:^|[^a-zа-я0-9])(?:инн|inn|taxpayer-id)\s*(?:[:№#=\-]\s*)?((?:\d[\s-]*){10,12})(?!\d)/giu, inns, isValidRussianInn);
  collect(/(?:^|[^a-zа-я0-9])(?:огрн(?:ип)?|ogrn)\s*(?:[:№#=\-]\s*)?((?:\d[\s-]*){13}|(?:\d[\s-]*){15})(?!\d)/giu, ogrns, value => /^\d{13}$|^\d{15}$/.test(value));
  return { inns, ogrns };
}

function meaningfulTokens(value) {
  return normalizedText(value).split(' ').filter(token => token.length >= 3 && !/^(ооо|ип|ао|пао|зао|оао)$/.test(token));
}
function overlapsEnough(value, haystack, minimum = 1) {
  const tokens = [...new Set(meaningfulTokens(value))];
  if (!tokens.length) return false;
  const matched = tokens.filter(token => haystack.includes(token));
  return matched.length >= minimum && matched.length / tokens.length >= 0.5;
}

export function scoreLegalIdentityDocument(candidate = {}, city = '', document = {}) {
  const raw = [document.title, document.text, document.snippet, decoded(document.url)].filter(Boolean).join(' ');
  const haystack = normalizedText(raw);
  const sourceHost = hostname(document.url);
  const candidateDomain = rootDomain(candidate.website);
  const candidatePhone = digits(candidate.phone || candidate.phones?.[0]);
  const signals = [];
  if (candidateDomain && (sourceHost === candidateDomain || sourceHost.endsWith(`.${candidateDomain}`) || haystack.includes(normalizedText(candidateDomain)))) signals.push('domain');
  if (candidatePhone) {
    const publicNumbers = [...raw.matchAll(/\+?\d[\d\s()\-]{8,20}\d/g)].map(match => digits(match[0]));
    if (publicNumbers.some(number => number === candidatePhone || (number.length === 11 && candidatePhone.length === 11 && number.slice(1) === candidatePhone.slice(1)))) signals.push('phone');
  }
  const address = stringValue(candidate.address || candidate.geo);
  if (address && overlapsEnough(address, haystack, 2)) signals.push('address');
  if (candidate.name) {
    const compactBrand = transliteratedCompact(candidate.name);
    const compactDocument = transliteratedCompact(raw);
    if (
      overlapsEnough(candidate.name, haystack, 1) ||
      (compactBrand.length >= 5 && compactDocument.includes(compactBrand))
    ) signals.push('brand');
  }
  if (city && normalizedText(city) && haystack.includes(normalizedText(city))) signals.push('city');
  const weights = { domain: 6, phone: 6, address: 6, brand: 4, city: 1 };
  return { score: signals.reduce((total, signal) => total + weights[signal], 0), signals, url: stringValue(document.url), host: sourceHost };
}

export function selectLegalIdentityDiscovery(candidate = {}, city = '', documents = []) {
  const byInn = new Map();
  for (const document of documents) {
    const identifiers = extractLabeledLegalIdentifiers(document);
    if (!identifiers.inns.length) continue;
    const evidence = scoreLegalIdentityDocument(candidate, city, document);
    for (const inn of identifiers.inns) {
      const item = byInn.get(inn) || { inn, ogrn: '', signalSet: new Set(), sources: [] };
      for (const signal of evidence.signals) item.signalSet.add(signal);
      if (!item.ogrn && identifiers.ogrns.length) item.ogrn = identifiers.ogrns[0];
      if (evidence.url && !item.sources.some(source => source.url === evidence.url)) item.sources.push({ url: evidence.url, host: evidence.host, matchSignals: evidence.signals });
      byInn.set(inn, item);
    }
  }
  const weights = { domain: 6, phone: 6, address: 6, brand: 4, city: 1 };
  const eligible = [...byInn.values()].map(item => {
    const matchSignals = [...item.signalSet];
    return { inn: item.inn, ogrn: item.ogrn, matchSignals, matchScore: matchSignals.reduce((total, signal) => total + weights[signal], 0), matchedSources: item.sources };
  }).filter(item => item.matchScore >= 10 && item.matchSignals.length >= 2 && item.matchSignals.some(signal => ['domain', 'phone', 'address'].includes(signal)));
  const preferred = item => Number(item.matchSignals.includes('domain')) + Number(item.matchSignals.includes('phone'));
  eligible.sort((a, b) => b.matchScore - a.matchScore || preferred(b) - preferred(a) || a.inn.localeCompare(b.inn));
  return eligible[0] || null;
}
