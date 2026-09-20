(function () {
  const API_URL = window.SDELAET_SEARCH_API || 'https://api.onsdelaet.ru/v1/candidates/search';
  const task = readTask();
  const state = { all: [], filter: 'all', live: false, runId: '', generatedAt: '' };

  function readTask() {
    try {
      return JSON.parse(localStorage.getItem('sdelaet.task.v2') || 'null') || {};
    } catch {
      return {};
    }
  }

  function saveTask(value) {
    localStorage.setItem('sdelaet.task.v2', JSON.stringify(value));
  }

  function track(name, extra) {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(Object.assign({ event: name }, extra || {}));
  }

  function hostOf(url) {
    try {
      return new URL(url).hostname.replace(/^www\./, '');
    } catch {
      return '';
    }
  }

  function platform(url) {
    const h = hostOf(url);
    return [
      'yandex.ru', 'yandex.com', 'uslugi.yandex.ru', '2gis.ru', 'avito.ru',
      'otzovik.com', 'rmnt.ru'
    ].some(x => h === x || h.endsWith('.' + x));
  }

  function outbound(url, id, placement) {
    try {
      const u = new URL(url);
      if (platform(url)) return u.href;
      u.searchParams.set('utm_source', 'onsdelaet.ru');
      u.searchParams.set('utm_medium', 'referral');
      u.searchParams.set('utm_campaign', 'candidate_outbound');
      u.searchParams.set('utm_content', (id || 'candidate') + '_' + (placement || 'website'));
      return u.href;
    } catch {
      return url;
    }
  }

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, m => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[m]));
  }

  function formatMoney(value) {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? n.toLocaleString('ru-RU') + ' ₽' : '';
  }

  function toast(message, ok) {
    let wrap = document.getElementById('toastWrap');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.id = 'toastWrap';
      wrap.className = 'toast-wrap';
      document.body.appendChild(wrap);
    }
    const el = document.createElement('div');
    el.className = 'toast ' + (ok ? 'ok' : 'warn');
    el.innerHTML = '<b>' + (ok ? 'Готово' : 'Не удалось выполнить поиск') + '</b><span>' + esc(message) + '</span>';
    wrap.appendChild(el);
    setTimeout(() => el.remove(), 4500);
  }

  function sourceById(candidate, id) {
    return (candidate.sources || []).find(s => s.id === id);
  }

  function factIcon(status) {
    return status === 'confirmed' ? '✓' : status === 'claimed' ? '◐' : status === 'risk' ? '⚠' : '?';
  }

  function factClass(status) {
    return status === 'confirmed' ? 'ok' : status === 'claimed' ? 'claim' : status === 'risk' ? 'risk' : 'unknown';
  }

  function kindLabel(kind) {
    return ({
      official_site: 'Официальный сайт',
      web_search: 'Поиск Яндекса',
      yandex_services: 'Яндекс Исполнители',
      avito: 'Avito',
      '2gis': '2ГИС',
      yandex_maps: 'Яндекс Карты'
    }[kind] || 'Источник');
  }

  function canonicalSourceUrl(url) {
    try {
      const u = new URL(url);
      [...u.searchParams.keys()].forEach(k => {
        if (/^(utm_|yclid$|ysclid$|gclid$|fbclid$)/i.test(k)) u.searchParams.delete(k);
      });
      u.hash = '';
      u.pathname = u.pathname.replace(/\/+$/, '') || '/';
      return u.toString();
    } catch { return String(url || ''); }
  }

  function uniqueSourceGroups(candidate) {
    const groups = new Map();
    for (const source of candidate.sources || []) {
      const host = source.host || hostOf(source.url) || 'Источник';
      const key = host.toLowerCase();
      let group = groups.get(key);
      if (!group) {
        group = { host, urls: new Map(), kinds: new Set(), preferred: source };
        groups.set(key, group);
      }
      group.kinds.add(source.kind || '');
      const canonical = canonicalSourceUrl(source.url);
      if (canonical && !group.urls.has(canonical)) group.urls.set(canonical, source);
      const priority = source.kind === 'official_site' ? 4 : source.kind === 'yandex_maps' ? 3 : source.kind === 'yandex_services' ? 3 : source.kind === '2gis' ? 3 : source.kind === 'avito' ? 3 : 1;
      const current = group.preferred;
      const currentPriority = current?.kind === 'official_site' ? 4 : ['yandex_maps','yandex_services','2gis','avito'].includes(current?.kind) ? 3 : 1;
      if (priority > currentPriority) group.preferred = source;
    }
    return [...groups.values()].map(group => {
      const preferred = group.preferred || [...group.urls.values()][0] || {};
      return {
        host: group.host,
        label: group.kinds.has('official_site') ? 'Официальный сайт' : (preferred.label || kindLabel(preferred.kind)),
        url: preferred.url || ([...group.urls.values()][0] || {}).url || '',
        pages: group.urls.size || 1
      };
    });
  }

  function reviewModel(candidate) {
    const mapsRaw = candidate.yandexMapsReviews?.reviews || candidate.trustProfile?.reputation?.sources?.find(s => s.platform === 'yandex_maps')?.reviews;
    const mapsMeta = candidate.trustProfile?.reputation?.yandexMaps || {};
    if (mapsRaw?.available) {
      return {
        platform: 'Яндекс Карты',
        profileUrl: candidate.yandexMapsReviews?.profileUrl || mapsMeta.mapsUrl || '',
        rating: mapsMeta.rating ?? null,
        totalCount: mapsMeta.reviewsCount ?? null,
        year: mapsRaw.year || new Date().getFullYear(),
        yearCount: Number(mapsRaw.totalFound || 0),
        counts: mapsRaw.counts || {},
        topics: mapsRaw.topics || {},
        positive: Array.isArray(mapsRaw.positive) ? mapsRaw.positive : [],
        neutral: Array.isArray(mapsRaw.neutral) ? mapsRaw.neutral : [],
        negative: Array.isArray(mapsRaw.negative) ? mapsRaw.negative : []
      };
    }
    const ys = candidate.yandexServicesReputation || candidate.trustProfile?.reputation?.sources?.find(s => s.platform === 'yandex_services');
    if (ys?.matched) {
      return {
        platform: 'Яндекс Исполнители', profileUrl: ys.profileUrl || '', rating: ys.rating ?? null,
        totalCount: ys.reviewsCount ?? null, year: null, yearCount: 0, counts: {}, topics: {},
        positive: [], neutral: [], negative: [], ratingStats: ys.ratingStats || null
      };
    }
    return null;
  }

  function allCandidateFacts(candidate) {
    const out = [], seen = new Set(), rep = reviewModel(candidate);
    const add = fact => {
      if (!fact?.label) return;
      const raw = String(fact.label).trim();
      if (/^(Телефон|Электронная почта):/i.test(raw)) return;
      if (/^Страница найдена через поиск Яндекса/i.test(raw)) return;
      if (rep && (/Организация подтверждена в Яндекс Картах/i.test(raw) || /^Яндекс Карты:/i.test(raw))) return;
      const key = raw.toLowerCase().replace(/\s+/g,' ').trim();
      if (seen.has(key)) return;
      seen.add(key); out.push(fact);
    };
    (candidate.facts || []).forEach(add);
    (candidate.trustProfile?.signals || []).forEach(add);
    (candidate.trustProfile?.history?.signals || []).forEach(add);
    return out;
  }

  function factBucket(fact) {
    const l = String(fact?.label || '').toLowerCase();
    if (fact?.status === 'unknown' || /требу(ет|ют).*уточ|минимальн.*объ|окончательн.*цена/.test(l)) return 'unknown';
    if (/цена|стоимост|гарант|срок|замер|материал|доплат|скидк/.test(l)) return 'terms';
    if (/отзыв|рейтинг|яндекс карт|2гис|репутац/.test(l)) return 'reputation';
    return 'verification';
  }

  function splitFactLabel(label) {
    const text = String(label || '').trim();
    const idx = text.indexOf(':');
    if (idx > 0 && idx < 28) return { title: text.slice(0, idx).trim(), text: text.slice(idx + 1).trim() };
    return { title: '', text };
  }

  function compactText(value) {
    return String(value || '').replace(/\s+/g, ' ').replace(/\s+([,.;:])/g, '$1').trim();
  }

  function moneyText(value) {
    const n = Number(value);
    return Number.isFinite(n) ? Math.round(n).toLocaleString('ru-RU') : '';
  }

  function priceEntriesFromFact(fact) {
    const raw = compactText(fact?.label || '').replace(/^Цена:\s*/i, '');
    const entries = [];
    const rx = /(\d[\d\s]*(?:[.,]\d+)?)\s*(?:руб\.?|р\.?|₽)(?:\s*\/\s*(?:м²|м2|мкв))?/gi;
    let m;
    while ((m = rx.exec(raw))) {
      const amount = Number(String(m[1]).replace(/\s/g,'').replace(',','.'));
      if (!Number.isFinite(amount)) continue;
      const tail = raw.slice(m.index, Math.min(raw.length, m.index + m[0].length + 10));
      const before = raw.slice(Math.max(0,m.index - 45), m.index).toLowerCase();
      const after = raw.slice(m.index + m[0].length, Math.min(raw.length, m.index + m[0].length + 45)).toLowerCase();
      const perM2 = /\/\s*(?:м²|м2|мкв)|мкв/i.test(before + ' ' + m[0] + ' ' + tail);
      const around = before + ' ' + after;
      const context = /потол/.test(around) ? 'потолок' : /однослойн/.test(after) ? '1 слой' : /двухслойн/.test(after) ? '2 слоя' : /тр[её]хслойн/.test(after) ? '3 слоя' : '';
      entries.push({ amount, perM2, context });
    }
    return entries;
  }

  function isCasePriceFact(fact) {
    const l = String(fact?.label || '');
    return /серия дома|тип балкона|площадь\s+\d|перечень работ|\bсмотреть\b|облицовка стен|\b\d{1,2}\s+(?:январ|феврал|март|апрел|ма[йя]|июн|июл|август|сентябр|октябр|ноябр|декабр)/i.test(l);
  }

  function isOffTaskPriceFact(fact) {
    const l = String(fact?.label || '').toLowerCase();
    if (task?.categoryId === 'balcony-insulation' && /остеклен/.test(l) && !/утеплен/.test(l)) return true;
    return false;
  }

  function priceSummary(priceFacts) {
    const evidence = [], relevant = [];
    priceFacts.forEach(f => {
      if (isCasePriceFact(f) || isOffTaskPriceFact(f)) evidence.push(f);
      else relevant.push(f);
    });
    const entries = relevant.flatMap(f => priceEntriesFromFact(f).map(x => ({ ...x, fact:f })));
    if (!entries.length) return { fact:null, evidence:[...evidence,...relevant] };
    const sqm = entries.filter(x => x.perM2).sort((a,b) => a.amount - b.amount);
    const unitless = entries.filter(x => !x.perM2).sort((a,b) => a.amount - b.amount);
    const basis = sqm[0] || unitless[0];
    const distinct = [];
    for (const entry of entries) {
      if (!distinct.some(x => x.amount === entry.amount && x.perM2 === entry.perM2)) distinct.push(entry);
    }
    let text = `от ${moneyText(basis.amount)} ₽${basis.perM2 ? '/м²' : ''}`;
    if (!basis.perM2) text += ' · единица на сайте не указана';
    const alternatives = distinct.filter(x => x !== basis && x.amount !== basis.amount).slice(0,3);
    if (alternatives.length) {
      const altText = alternatives.map(x => `${x.context ? x.context + ' ' : ''}${moneyText(x.amount)} ₽${x.perM2 ? '/м²' : ''}`).join(' · ');
      text += ` · ${alternatives.some(x=>x.context) ? '' : 'варианты: '}${altText}`;
    }
    const fact = { label:`Цена: ${text}`, status:'claimed', sourceId:basis.fact?.sourceId, compact:true };
    const used = new Set(entries.map(x => x.fact));
    return { fact, evidence:[...evidence,...relevant.filter(f => !used.has(f))] };
  }

  function shortestUseful(facts, title) {
    if (!facts.length) return null;
    const cleaned = facts.map(f => {
      let text = compactText(f.label).replace(new RegExp(`^${title}:\\s*`,'i'),'');
      text = text.replace(/^Качество\s+/i,'').replace(/^При[её]мка и гарантия\s+/i,'').replace(/^Процесс выглядит так:\s*/i,'');
      return { fact:f, text };
    }).filter(x => x.text);
    cleaned.sort((a,b) => a.text.length - b.text.length);
    const pick = cleaned[0];
    return pick ? { label:`${title}: ${pick.text}`, status:pick.fact.status, sourceId:pick.fact.sourceId, compact:true } : null;
  }

  function compactGuarantee(facts) {
    const pick = shortestUseful(facts,'Гарантия');
    if (!pick) return null;
    let text = splitFactLabel(pick.label).text;
    if (/договор.*гарант/i.test(text)) text = 'Работа по договору, гарантия заявлена на сайте.';
    else if (/гарант.*работ.*материал/i.test(text)) text = 'Гарантия на выполненные работы и материалы.';
    else if (text.length > 95) text = text.slice(0,92).replace(/[,:;\s]+$/,'') + '…';
    return { ...pick, label:`Гарантия: ${text}` };
  }

  function compactTerm(facts) {
    if (!facts.length) return null;
    for (const f of facts) {
      const text = compactText(f.label).replace(/^Срок:\s*/i,'');
      const insulation = text.match(/(\d+(?:[.,]\d+)?)\s*д(?:ень|ня|ней)\s*[-–—]?\s*(?:отделк\w*\s+и\s+)?утеплен/i);
      if (insulation) return { label:`Срок: утепление${/отделк/i.test(insulation[0]) ? ' и отделка' : ''} — около ${String(insulation[1]).replace('.',',')} дней`, status:f.status, sourceId:f.sourceId, compact:true };
      const direct = text.match(/(?:за|срок\s*[-–—:]?)\s*(\d+(?:[.,]\d+)?)\s*д(?:ень|ня|ней)/i);
      if (direct && !/наш балкон превратился|отзыв/i.test(text)) return { label:`Срок: от ${String(direct[1]).replace('.',',')} дней`, status:f.status, sourceId:f.sourceId, compact:true };
    }
    return null;
  }

  function compactMeasurement(facts) {
    if (!facts.length) return null;
    const free = facts.find(f => /бесплатн.*замер|бесплатн.*замер.*расч[её]т/i.test(f.label));
    const pick = free || facts[0];
    return { label:free ? 'Замер: бесплатно, с расчётом стоимости' : 'Замер: перед окончательным расчётом', status:pick.status, sourceId:pick.sourceId, compact:true };
  }

  function expandUnknownFacts(facts) {
    if (!facts.length) return [];
    const text = facts.map(f=>String(f.label||'')).join(' ').toLowerCase();
    const base = facts[0];
    const out = [];
    if (/минимальн.*объ[её]м/.test(text)) out.push({label:'Минимальный заказ: уточнить',status:'unknown',sourceId:base.sourceId,compact:true});
    if (/срок старта/.test(text)) out.push({label:'Дата старта работ: уточнить',status:'unknown',sourceId:base.sourceId,compact:true});
    if (/окончательн.*цена/.test(text)) out.push({label:'Итоговая цена: после запроса по вашему ТЗ',status:'unknown',sourceId:base.sourceId,compact:true});
    return out.length ? out.slice(0,3) : facts.slice(0,3);
  }

  function normalizeFactBuckets(candidate, facts) {
    const raw = { price:[], guarantee:[], term:[], measurement:[], verification:[], reputation:[], unknown:[], other:[] };
    for (const fact of facts) {
      const l = String(fact?.label || '').toLowerCase();
      if (fact?.status === 'unknown') raw.unknown.push(fact);
      else if (/^цена:/.test(l)) raw.price.push(fact);
      else if (/^гарантия:/.test(l)) raw.guarantee.push(fact);
      else if (/^срок:/.test(l)) raw.term.push(fact);
      else if (/^замер:/.test(l)) raw.measurement.push(fact);
      else if (/отзыв|рейтинг|яндекс карт|2гис|репутац/.test(l)) raw.reputation.push(fact);
      else raw.verification.push(fact);
    }
    const price = priceSummary(raw.price);
    const terms = [price.fact, compactGuarantee(raw.guarantee), compactTerm(raw.term), compactMeasurement(raw.measurement)].filter(Boolean);
    const evidence = [...price.evidence];
    raw.guarantee.forEach(f => { if (!terms.some(t => t.sourceId === f.sourceId && /^Гарантия:/.test(t.label))) evidence.push(f); });
    raw.term.forEach(f => { if (!terms.some(t => t.sourceId === f.sourceId && /^Срок:/.test(t.label))) evidence.push(f); });
    raw.measurement.forEach(f => { if (!terms.some(t => t.sourceId === f.sourceId && /^Замер:/.test(t.label))) evidence.push(f); });
    return { terms:terms.slice(0,4), verification:raw.verification, reputation:raw.reputation, unknown:expandUnknownFacts(raw.unknown), evidence };
  }

  function verificationItems(candidate) {
    const items = [];
    const groups = uniqueSourceGroups(candidate);
    const official = groups.find(g => g.label === 'Официальный сайт') || groups.find(g => candidate.website && g.host === hostOf(candidate.website));
    const rep = reviewModel(candidate);
    if (official) items.push({label:'Официальный сайт',value:'найден',status:'ok'});
    if (official?.pages) items.push({label:'Страниц проверено',value:String(official.pages),status:'ok'});
    if (rep?.platform === 'Яндекс Карты') items.push({label:'Яндекс Карты',value:'профиль подтверждён',status:'ok'});
    const domain = candidate.trustProfile?.history?.domain;
    if (domain?.ageYears != null) items.push({label:'Возраст домена',value:`${domain.ageYears} лет`,status:'ok'});
    return items.slice(0,4);
  }

  function renderVerificationSummary(candidate) {
    const items = verificationItems(candidate);
    if (!items.length) return '';
    return `<section class="fact-panel verification verification-summary"><h3>Проверка компании<span>${items.length}</span></h3><div class="verification-statuses">${items.map(x => `<div><span class="verify-check">✓</span><p><b>${esc(x.label)}</b><small>${esc(x.value)}</small></p></div>`).join('')}</div></section>`;
  }

  function renderWhyPanel(candidate) {
    const reasons = [...new Set((candidate.rankReasons || []).map(x => compactText(x)).filter(Boolean))];
    const first = reasons.slice(0,3);
    const rest = reasons.slice(3);
    return `<section class="why-panel"><h3>Почему подходит</h3><ul>${(first.length ? first : ['Найден по профильному поисковому запросу.']).map(x=>`<li>${esc(x)}</li>`).join('')}</ul>${rest.length ? `<details class="why-more"><summary>Ещё ${rest.length}</summary><ul>${rest.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></details>` : ''}</section>`;
  }

  function renderEvidenceDetails(candidate, items) {
    if (!items?.length) return '';
    const unique = [];
    const seen = new Set();
    for (const fact of items) {
      const key = compactText(fact?.label).toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key); unique.push(fact);
    }
    if (!unique.length) return '';
    return `<details class="evidence-details"><summary>Примеры и доказательства · ${unique.length}</summary><div class="evidence-list">${unique.slice(0,6).map(f => renderFactItem(candidate,f)).join('')}</div></details>`;
  }

  function renderFactItem(candidate, fact) {
    const source = sourceById(candidate, fact.sourceId);
    const split = splitFactLabel(fact.label);
    const sourceHtml = source && !fact.compact ? `<a class="fact-source" href="${esc(platform(source.url) ? source.url : outbound(source.url, candidate.id, 'fact'))}" target="_blank" rel="noopener">Источник ↗</a>` : '';
    return `<div class="fact-compact ${factClass(fact.status)}"><span class="fact-dot">${factIcon(fact.status)}</span><div>${split.title ? `<b>${esc(split.title)}</b>` : ''}<p>${esc(split.text)}</p>${sourceHtml}</div></div>`;
  }

  function renderFactPanel(candidate, title, items, cls='') {
    if (!items.length) return '';
    const first = items.slice(0,4).map(f => renderFactItem(candidate,f)).join('');
    const rest = items.slice(4).map(f => renderFactItem(candidate,f)).join('');
    return `<section class="fact-panel ${cls}"><h3>${esc(title)}<span>${items.length}</span></h3><div class="fact-panel-list">${first}</div>${rest ? `<details class="fact-more"><summary>Ещё ${items.length - 4}</summary><div class="fact-panel-list">${rest}</div></details>` : ''}</section>`;
  }

  function renderKeySignals(candidate) {
    const items = [];
    const domain = candidate.trustProfile?.history?.domain;
    const exp = candidate.trustProfile?.history?.claimedExperience;
    if (domain?.ageYears != null) items.push(`<div class="key-signal"><span>Домен</span><b>${esc(domain.ageYears)} лет</b><small>${esc(domain.domain || '')}</small></div>`);
    if (exp?.claimedYears) items.push(`<div class="key-signal"><span>Опыт</span><b>${esc(exp.claimedYears)} лет</b><small>заявлено компанией</small></div>`);
    return items.length ? `<div class="key-signals compact">${items.join('')}</div>` : '';
  }

  function renderReputation(candidate) {
    const rep = reviewModel(candidate);
    if (!rep) return '';
    const parts = [];
    if (rep.rating != null) parts.push(`★ ${Number(rep.rating).toFixed(1).replace('.',',')}`);
    if (rep.totalCount != null) parts.push(`${rep.totalCount} оценок`);
    if (rep.yearCount) parts.push(`${rep.yearCount} отзывов за ${rep.year}`);
    const topics = [...(rep.topics?.positive || [])].slice(0,2).map(t => `${t.label} · ${t.mentions}`).join(' · ');
    const stats = rep.ratingStats || null;
    const statsText = stats && candidate.type === 'private'
      ? `5★ ${Number(stats[5] || 0)} из ${Number(rep.totalCount || 0)} · 1–2★ ${Number(stats[1] || 0) + Number(stats[2] || 0)}`
      : '';
    const hasTexts = rep.positive.length || rep.neutral.length || rep.negative.length;
    const action = hasTexts
      ? `<button type="button" class="reviews-open" data-candidate="${esc(candidate.id)}">Посмотреть отзывы</button>`
      : rep.profileUrl ? `<a class="reviews-link" href="${esc(rep.profileUrl)}" target="_blank" rel="noopener">Профиль и оценки ↗</a>` : '';
    const subline = topics ? `Чаще отмечают: ${topics}` : statsText;
    return `<div class="reputation-strip"><div><span>${esc(rep.platform)}</span><b>${esc(parts.join(' · ') || 'Профиль найден')}</b>${subline ? `<small>${esc(subline)}</small>` : ''}</div>${action}</div>`;
  }

  function reviewDate(value) {
    const d = value ? new Date(value) : null;
    return d && !Number.isNaN(d.getTime()) ? d.toLocaleDateString('ru-RU',{day:'2-digit',month:'2-digit',year:'numeric'}) : '';
  }

  function ensureReviewsModal() {
    let modal = document.getElementById('reviewsModal');
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = 'reviewsModal';
    modal.className = 'reviews-modal';
    modal.innerHTML = `<div class="reviews-backdrop" data-reviews-close></div><div class="reviews-dialog" role="dialog" aria-modal="true" aria-labelledby="reviewsTitle"><button type="button" class="reviews-close" data-reviews-close aria-label="Закрыть">×</button><div id="reviewsContent"></div></div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if (e.target.closest('[data-reviews-close]')) closeReviewsModal(); });
    return modal;
  }

  function reviewItemHtml(review, tone) {
    const rating = Number(review?.rating);
    const stars = Number.isFinite(rating) ? `★ ${rating}` : '';
    const date = reviewDate(review?.updatedTime);
    const sourceUrl = review?.sourceUrl || '';
    return `<article class="review-item ${tone}"><div class="review-head"><div><b>${esc(review?.author || 'Пользователь')}</b>${date ? `<span>${esc(date)}</span>` : ''}</div>${stars ? `<strong>${esc(stars)}</strong>` : ''}</div><p>${esc(review?.text || '')}</p>${review?.businessComment ? `<details class="business-reply"><summary>Ответ компании</summary><div>${esc(review.businessComment)}</div></details>` : ''}${sourceUrl ? `<a class="review-source" href="${esc(sourceUrl)}" target="_blank" rel="noopener">Открыть оригинал ↗</a>` : ''}</article>`;
  }

  function reviewSection(title, items, tone) {
    if (!items?.length) return '';
    return `<section class="reviews-section"><h3>${esc(title)}<span>${items.length}</span></h3><div class="review-list">${items.slice(0,3).map(r => reviewItemHtml(r,tone)).join('')}</div></section>`;
  }

  function openReviewsModal(candidateId) {
    const candidate = state.all.find(c => c.id === candidateId);
    const rep = candidate && reviewModel(candidate);
    if (!candidate || !rep) return;
    const modal = ensureReviewsModal();
    const counts = rep.counts || {};
    const positiveTopics = (rep.topics?.positive || []).slice(0,4).map(t => `<span>${esc(t.label)} · ${esc(t.mentions)}</span>`).join('');
    const negativeTopics = (rep.topics?.negative || []).slice(0,4).map(t => `<span>${esc(t.label)} · ${esc(t.mentions)}</span>`).join('');
    const meta = [rep.platform, rep.year ? `${rep.year} год` : '', rep.totalCount != null ? `всего ${rep.totalCount} оценок` : ''].filter(Boolean).join(' · ');
    document.getElementById('reviewsContent').innerHTML = `<div class="eyebrow">Отзывы и репутация</div><h2 id="reviewsTitle">${esc(candidate.name)}</h2><p class="reviews-meta">${esc(meta)}</p><div class="review-summary"><div class="positive"><b>${esc(counts.positive ?? rep.positive.length)}</b><span>положительных</span></div><div class="neutral"><b>${esc(counts.neutral ?? rep.neutral.length)}</b><span>нейтральных</span></div><div class="negative"><b>${esc(counts.negative ?? rep.negative.length)}</b><span>критических</span></div></div>${positiveTopics || negativeTopics ? `<div class="review-topics">${positiveTopics ? `<div><b>Чаще хвалят</b>${positiveTopics}</div>` : ''}${negativeTopics ? `<div class="negative"><b>Что критикуют</b>${negativeTopics}</div>` : ''}</div>` : ''}${reviewSection('Положительные отзывы',rep.positive,'positive')}${reviewSection('Критические отзывы',rep.negative,'negative')}${reviewSection('Нейтральные отзывы',rep.neutral,'neutral')}${rep.profileUrl ? `<div class="reviews-footer"><a class="btn secondary" href="${esc(rep.profileUrl)}" target="_blank" rel="noopener">Все отзывы в ${esc(rep.platform)} ↗</a></div>` : ''}`;
    modal.classList.add('open');
    document.body.classList.add('reviews-opened');
    track('candidate_reviews_open',{candidate_id:candidate.id,platform:rep.platform,year_count:rep.yearCount||0});
  }

  function closeReviewsModal() {
    document.getElementById('reviewsModal')?.classList.remove('open');
    document.body.classList.remove('reviews-opened');
  }

  function typeMeta(type) {
    if (type === 'private') return { label: 'Частный мастер', cls: 'private' };
    if (type === 'unverified') return { label: 'Тип не подтверждён', cls: 'unverified' };
    return { label: 'Компания', cls: 'company' };
  }

  function sourceSummary(candidates) {
    const kinds = new Set(candidates.flatMap(c => (c.sources || []).map(s => s.kind)));
    const labels = [];
    if (kinds.has('web_search')) labels.push('веб-поиск Яндекса');
    if (kinds.has('yandex_services')) labels.push('Яндекс Исполнители');
    if (kinds.has('avito')) labels.push('Avito');
    if (kinds.has('2gis')) labels.push('2ГИС');
    return labels.join(' · ') || 'открытые источники';
  }

  function externalAction(candidate) {
    if (candidate.website) {
      return {
        label: 'Сайт исполнителя ↗',
        url: outbound(candidate.website, candidate.id, 'website')
      };
    }
    const avito = (candidate.sources || []).find(s => s.kind === 'avito');
    if (avito) return { label: 'Объявление Avito ↗', url: avito.url };
    const profile = (candidate.sources || []).find(s => s.kind === 'yandex_services');
    if (profile) return { label: 'Профиль исполнителя ↗', url: profile.url };
    return null;
  }

  function renderContacts(candidate) {
    const items = [];
    if (candidate.phone) {
      const tel = String(candidate.phone).replace(/[^+\d]/g, '');
      items.push(`<a class="contact-pill" href="tel:${esc(tel)}"><b>Телефон</b><span>${esc(candidate.phone)}</span></a>`);
    }
    if (candidate.email) {
      items.push(`<a class="contact-pill" href="mailto:${esc(candidate.email)}"><b>Почта</b><span>${esc(candidate.email)}</span></a>`);
    }
    return items.length
      ? `<div class="source-caption">Контакты с сайта</div><div class="contact-list">${items.join('')}</div>`
      : '';
  }

  function renderAvitoNote(candidate) {
    if (!candidate.avito) return '';
    const price = formatMoney(candidate.avito.publishedPriceFrom);
    const text = price
      ? `В объявлении опубликована цена от ${price}. Это ориентир из Avito, а не расчёт по вашему ТЗ; автоматически в сравнение предложений она не включается.`
      : 'Объявление найдено на Avito. Тип исполнителя и стоимость именно по вашему ТЗ пока не подтверждены.';
    return `<div class="avito-note"><b>Данные Avito</b><span>${esc(text)}</span></div>`;
  }

  function privateMeasureLabel(measure) {
    return ({ square_meter:'₽/м²', m:'₽/м', running_meter:'₽/м', piece:'₽/шт.', hour:'₽/час', service:'₽/услуга' }[String(measure || '')] || '₽');
  }

  function privateRelevantService(candidate) {
    const services = candidate.yandexServicesProfile?.services || [];
    if (!services.length) return null;
    if (task?.categoryId === 'balcony-insulation') {
      return services.find(s => /утепление балконов и лоджий/i.test(s.name))
        || services.find(s => /отделка балконов и лоджий/i.test(s.name) && /утеплен/i.test(s.description || ''))
        || null;
    }
    const hay = compactText([task?.category, task?.scope, task?.description].filter(Boolean).join(' ')).toLowerCase();
    const tokens = [...new Set((hay.match(/[а-яё]{5,}/gi) || []).map(x => x.slice(0,6)))];
    let best = null, score = 0;
    for (const service of services) {
      const value = (String(service.name || '') + ' ' + String(service.description || '')).toLowerCase();
      const current = tokens.reduce((sum,t) => sum + (value.includes(t) ? 1 : 0), 0);
      if (current > score) { score = current; best = service; }
    }
    return score ? best : null;
  }

  function privateAreaMatch(candidate) {
    const areas = candidate.yandexServicesProfile?.areaServed || [];
    const city = String(task?.city || '').trim().toLowerCase();
    const region = String(task?.region || '').trim().toLowerCase();
    if (city) {
      const direct = areas.find(x => String(x || '').toLowerCase().includes(city));
      if (direct) return direct;
    }
    if (region) {
      const regional = areas.find(x => String(x || '').toLowerCase().includes(region) || region.includes(String(x || '').toLowerCase()));
      if (regional) return regional;
    }
    return null;
  }

  function privateSpecialization(candidate) {
    const specs = candidate.yandexServicesProfile?.specializations || [];
    if (task?.categoryId?.startsWith('balcony-')) return specs.find(s => /окон|балкон/i.test(String(s.name || '') + ' ' + String(s.specialistName || ''))) || specs[0] || null;
    return specs[0] || null;
  }

  function privatePortfolioScore(item) {
    const title = String(item?.title || '').toLowerCase();
    const description = String(item?.description || '').toLowerCase();
    const value = title + ' ' + description;
    let score = 0;
    if (task?.categoryId === 'balcony-insulation') {
      if (/утеплен/.test(title)) score += 12;
      if (/балкон|лоджи/.test(title)) score += 9;
      if (/утеплен/.test(description)) score += 6;
      if (/балкон|лоджи/.test(description)) score += 4;
      if (/гидроизоляц|обшив|отделк/.test(value)) score += 2;
      if (!/утеплен|балкон|лоджи/.test(value)) return 0;
    }
    if (/okna-i-balkony/.test(String(item?.specialization || ''))) score += 2;
    return score;
  }

  function privatePortfolio(candidate) {
    const items = candidate.yandexServicesProfile?.portfolio || [];
    return items.map((item,index) => ({item,index,score:privatePortfolioScore(item)})).filter(x => x.score > 0).sort((a,b) => b.score - a.score || a.index - b.index).map(x => x.item);
  }

  function shortProfileDescription(value) {
    const valueText = compactText(value);
    if (!valueText) return '';
    return valueText.length > 180 ? valueText.slice(0,177).replace(/[,:;\s]+$/,'') + '…' : valueText;
  }
  function privateImageUrl(url) {
    const value = String(url || '').trim();
    if (!value) return '';
    if (/avatars\.mds\.yandex\.net(?::443)?\/get-ydo\//i.test(value) && !/\/orig(?:\?|$)/i.test(value)) return value.replace(/\/+$/,'') + '/orig';
    return value;
  }

  function renderPrivateSummary(candidate) {
    const profile = candidate.yandexServicesProfile;
    if (!profile) return '';
    const area = privateAreaMatch(candidate);
    const items = [];
    if (profile.experience?.label) items.push({ label:'Опыт', value:profile.experience.label, icon:'◷' });
    if (profile.passportVerified) items.push({ label:'Паспорт', value:'проверен', icon:'✓' });
    if (area) items.push({ label:'Выезд', value:area, icon:'⌖' });
    if (profile.guaranteeClaimed) items.push({ label:'Гарантия', value:'заявлена', icon:'✓' });
    else if (profile.freeMeasurement) items.push({ label:'Замер', value:'бесплатно', icon:'✓' });
    if (!items.length) return '';
    return '<div class="private-summary">' + items.slice(0,4).map(x => '<div><span class="private-summary-icon">'+esc(x.icon)+'</span><p><small>'+esc(x.label)+'</small><b>'+esc(x.value)+'</b></p></div>').join('') + '</div>';
  }

  function renderPrivateTaskService(candidate) {
    const profile = candidate.yandexServicesProfile;
    if (!profile) return '';
    const service = privateRelevantService(candidate);
    const taskLabel = task?.category || task?.scope || 'Ваша задача';
    const price = service?.price != null ? moneyText(service.price) + ' ' + privateMeasureLabel(service.priceMeasure) : '';
    const extras = [];
    if (profile.freeMeasurement) extras.push('бесплатный замер');
    if (profile.openingHours) extras.push('график ' + profile.openingHours);
    if (service?.photoCount) extras.push(service.photoCount + ' фото в услуге');
    const description = shortProfileDescription(service?.description || '');
    return `<section class="private-main-card private-service-card"><div class="private-card-kicker">Услуга по вашей задаче</div><h3>${esc(service?.name || taskLabel)}</h3>${price ? `<div class="private-service-price">${esc(price)}</div>` : '<div class="private-service-price muted">Цена в профиле не указана</div>'}${description ? `<p>${esc(description)}</p>` : ''}${extras.length ? `<div class="private-inline-tags">${extras.map(x=>`<span>${esc(x)}</span>`).join('')}</div>` : ''}</section>`;
  }

  function renderPrivatePortfolio(candidate) {
    const profile = candidate.yandexServicesProfile;
    if (!profile) return '';
    const all = privatePortfolio(candidate);
    if (!all.length) return '';
    const cards = all.slice(0,2).map(item => {
      const imageUrl = privateImageUrl(item.coverUrl);
      const image = imageUrl ? `<img src="${esc(imageUrl)}" alt="${esc(item.title || 'Пример работы')}" decoding="async" referrerpolicy="no-referrer">` : '';
      const price = item.price != null ? `<b>${esc(moneyText(item.price))} ₽</b>` : '';
      const desc = shortProfileDescription(item.description || '');
      return `<article class="portfolio-mini">${image}<div><span>Пример работы</span><strong>${esc(item.title)}</strong>${desc ? `<small>${esc(desc)}</small>` : ''}${price}</div></article>`;
    }).join('');
    return `<section class="private-main-card private-portfolio"><div class="private-card-head"><div><div class="private-card-kicker">Портфолио</div><h3>Примеры работ</h3></div><span class="private-count">${all.length}</span></div><div class="portfolio-mini-list">${cards}</div><small class="portfolio-note">Цены — примеры прошлых работ, не расчёт по вашему ТЗ.</small></section>`;
  }

  function renderPrivateMore(candidate) {
    const profile = candidate.yandexServicesProfile;
    if (!profile) return '';
    const spec = privateSpecialization(candidate);
    const about = shortProfileDescription(profile.description);
    const reasons = [...new Set((candidate.rankReasons || []).map(x => compactText(x)).filter(Boolean))].slice(0,5);
    if (!about && !spec && !reasons.length) return '';
    return `<details class="private-more"><summary>Подробнее о мастере</summary><div class="private-more-body">${spec ? `<div class="private-specialization"><b>${esc(spec.specialistName || spec.name)}</b><span>${esc(spec.name || '')}</span></div>` : ''}${about ? `<p>${esc(about)}</p>` : ''}${reasons.length ? `<div class="private-why"><b>Почему подходит</b><ul>${reasons.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div>` : ''}</div></details>`;
  }

  function renderPrivateProfile(candidate) {
    const profile = candidate.yandexServicesProfile;
    if (!profile) return '';
    return `${renderPrivateSummary(candidate)}<div class="private-main-grid">${renderPrivateTaskService(candidate)}${renderPrivatePortfolio(candidate)}</div>${renderPrivateMore(candidate)}`;
  }
  function renderCard(candidate, index) {
    const type = typeMeta(candidate.type);
    const allFacts = allCandidateFacts(candidate);
    const normalized = normalizeFactBuckets(candidate, allFacts);
    const sources = uniqueSourceGroups(candidate).map(source => {
      const pageText = source.pages > 1 ? ` · ${source.pages} страницы проверено` : '';
      return `<a class="source-pill" href="${esc(platform(source.url) ? source.url : outbound(source.url, candidate.id, 'source'))}" target="_blank" rel="noopener"><b>${esc(source.label)}</b><span>${esc(source.host)}${esc(pageText)}</span></a>`;
    }).join('');
    const action = externalAction(candidate);
    const actionHtml = action
      ? `<a class="btn secondary" href="${esc(action.url)}" target="_blank" rel="noopener">${esc(action.label)}</a>`
      : '';
    const initials = candidate.name.split(/\s+/).map(x => x[0]).join('').slice(0, 2).toUpperCase();
    const hasPrivateProfile = candidate.type === 'private' && !!candidate.yandexServicesProfile;
    const structuredFacts = hasPrivateProfile
      ? [renderFactPanel(candidate, 'Что уточнить у мастера', normalized.unknown, 'unknown')].filter(Boolean).join('')
      : [
          renderFactPanel(candidate, 'Условия и цены', normalized.terms, 'terms'),
          renderVerificationSummary(candidate),
          renderFactPanel(candidate, 'Что уточнить у исполнителя', normalized.unknown, 'unknown')
        ].filter(Boolean).join('');
    const privateProfile = hasPrivateProfile ? renderPrivateProfile(candidate) : '';
    const evidence = renderEvidenceDetails(candidate, normalized.evidence);

    return `<article class="candidate" data-type="${esc(candidate.type)}">
      <div class="candidate-head">
        <div class="avatar">${esc(initials)}</div>
        <div class="candidate-title">
          <div class="rank-line"><span class="rank-no">#${index + 1}</span><span class="type-badge ${type.cls}">${type.label}</span></div>
          <h2>${esc(candidate.name)}</h2>
          <div class="candidate-meta">${esc(candidate.geo || task.city || '')}</div>
        </div>
        <div class="match-badge"><small>Соответствие задаче</small><b>${esc(candidate.matchLevel || 'Среднее')}</b></div>
      </div>
      ${renderAvitoNote(candidate)}
      ${renderContacts(candidate)}
      ${renderKeySignals(candidate)}
      ${renderReputation(candidate)}
      ${privateProfile}
      ${hasPrivateProfile
        ? (structuredFacts ? `<div class="private-clarify">${structuredFacts}</div>` : '')
        : `<div class="candidate-grid structured">${renderWhyPanel(candidate)}<div class="fact-panels">${structuredFacts || '<section class="fact-panel"><h3>Проверка</h3><p class="muted">Дополнительных публичных фактов пока не найдено.</p></section>'}</div></div>`}
      ${evidence}
      ${sources ? `<details class="sources-details"><summary>Источники проверки · ${uniqueSourceGroups(candidate).length}</summary><div class="source-list">${sources}</div></details>` : ''}
      <div class="actions">
        <a class="btn primary prepare-request" data-candidate="${esc(candidate.id)}" href="requests.html?candidate=${encodeURIComponent(candidate.id)}">Подготовить запрос</a>
        ${actionHtml}
      </div>
    </article>`;
  }

  function visibleCandidates() {
    return state.all.filter(c => state.filter === 'all' || c.type === state.filter);
  }

  function countLabel(count, filter) {
    if (filter === 'company') return `Найдено ${count} компаний`;
    if (filter === 'private') return `Найдено ${count} частных мастеров`;
    if (filter === 'unverified') return `Найдено ${count} кандидатов с неподтверждённым типом`;
    return `Найдено ${count} кандидатов`;
  }

  function updateFilterLabels() {
    const counts = { all: state.all.length, company: 0, private: 0, unverified: 0 };
    for (const c of state.all) counts[c.type] = (counts[c.type] || 0) + 1;
    document.querySelectorAll('[data-filter]').forEach(button => {
      const key = button.dataset.filter;
      const base = key === 'all' ? 'Все' : key === 'company' ? 'Компании' : key === 'private' ? 'Частные мастера' : 'Тип не подтверждён';
      button.textContent = `${base} · ${counts[key] || 0}`;
    });
  }

  function saveSearchResults() {
    try {
      localStorage.setItem('sdelaet.search.results.v1', JSON.stringify({
        taskId: task.id || '',
        runId: state.runId,
        generatedAt: state.generatedAt,
        candidates: state.all
      }));
    } catch {}
  }

  function render() {
    const list = document.getElementById('candidateList');
    const visible = visibleCandidates();
    list.innerHTML = visible.map(renderCard).join('') || '<div class="empty">По выбранному фильтру кандидатов пока нет.</div>';
    document.getElementById('countTitle').textContent = countLabel(visible.length, state.filter);
    document.querySelectorAll('[data-filter]').forEach(b => b.classList.toggle('active', b.dataset.filter === state.filter));
    updateFilterLabels();

    list.querySelectorAll('a[target="_blank"]').forEach(a => a.addEventListener('click', () => {
      track('candidate_source_click', { url: a.href });
    }));

    list.querySelectorAll('.reviews-open').forEach(button => button.addEventListener('click', () => openReviewsModal(button.dataset.candidate)));

    list.querySelectorAll('.portfolio-mini img').forEach(img => img.addEventListener('error', () => {
      img.closest('.portfolio-mini')?.classList.add('no-image');
      img.remove();
    }, { once:true }));

    list.querySelectorAll('.prepare-request').forEach(a => a.addEventListener('click', () => {
      const candidate = state.all.find(c => c.id === a.dataset.candidate);
      if (!candidate) return;
      try {
        localStorage.setItem('sdelaet.candidate.selected.v1', JSON.stringify(candidate));
      } catch {}
      track('candidate_request_prepare', { candidate_id: candidate.id, candidate_type: candidate.type });
    }));
  }

  function setupFilters() {
    document.querySelectorAll('[data-filter]').forEach(button => {
      button.onclick = () => {
        state.filter = button.dataset.filter;
        render();
        track('candidate_type_filter', { contractor_type: state.filter });
      };
    });
  }

  function showPreference() {
    const box = document.getElementById('preference');
    box.classList.remove('hidden');
    document.getElementById('filters').classList.add('hidden');
    document.getElementById('searchStatus').classList.add('hidden');
    document.getElementById('candidateList').innerHTML = '';
    document.getElementById('countTitle').textContent = 'Настройте поиск';
  }

  function setupPreference() {
    const box = document.getElementById('preference');
    const current = task.executorPreference;

    if (current) {
      box.classList.add('hidden');
      state.filter = current === 'company' ? 'company' : current === 'private' ? 'private' : 'all';
      runSearch();
    }

    box.querySelectorAll('[data-choice]').forEach(button => {
      button.onclick = () => {
        task.executorPreference = button.dataset.choice;
        saveTask(task);
        state.filter = button.dataset.choice === 'company' ? 'company' : button.dataset.choice === 'private' ? 'private' : 'all';
        box.classList.add('hidden');
        track('contractor_type_selected', { contractor_type: button.dataset.choice });
        runSearch();
      };
    });

    const change = document.getElementById('changePreference');
    if (change) {
      change.onclick = () => {
        delete task.executorPreference;
        saveTask(task);
        state.all = [];
        state.filter = 'all';
        showPreference();
        track('contractor_type_change');
      };
    }
  }

  function renderSearchError(message) {
    const status = document.getElementById('searchStatus');
    const list = document.getElementById('candidateList');
    const filters = document.getElementById('filters');
    state.all = [];
    state.live = false;
    filters.classList.add('hidden');
    status.className = 'search-status warn';
    status.innerHTML = `<div class="status-dot">!</div><div><b>Не удалось получить живую подборку</b><span>${esc(message)}. Демо-кандидаты не подставляются.</span></div>`;
    list.innerHTML = '<div class="empty"><b>Поиск временно недоступен.</b><br><span>Попробуйте ещё раз — уже созданное ТЗ сохранено.</span><div class="empty-actions"><button class="btn primary" id="retrySearch">Повторить поиск</button></div></div>';
    document.getElementById('retrySearch')?.addEventListener('click', runSearch);
  }

  async function runSearch() {
    const status = document.getElementById('searchStatus');
    const list = document.getElementById('candidateList');
    const filters = document.getElementById('filters');

    document.getElementById('countTitle').textContent = 'Уточняем исполнителей';
    const introLead = document.querySelector('.search-intro .lead');
    if (introLead) introLead.textContent = 'Поиск оплачен и запущен. Уточняем найденных исполнителей: проверяем контакты, отзывы, источники и убираем дубли.';
    status.className = 'search-status loading';
    status.innerHTML = '<div class="spinner"></div><div><b>Уточняем исполнителей</b><span>Проверяем найденных кандидатов: сайты, контакты, отзывы и происхождение данных, убираем дубли…</span></div>';
    list.innerHTML = '';
    filters.classList.add('hidden');

    const preference = task.executorPreference || 'any';
    const payload = {
      categoryId: task.categoryId || 'universal-home-repair',
      category: task.category || '',
      city: task.city || '',
      region: task.region || task.geo?.canonicalRegion || '',
      regionId: task.regionId || task.geo?.regionId || '',
      description: task.description || '',
      scope: task.scope || '',
      goal: task.goal || '',
      categoryStatus: task.category_status || 'matched',
      rawService: task.raw_service || task.description || '',
      domain: task.domain || 'construction',
      suggestedCategory: task.suggested_category || null,
      executorPreference: preference,
      limit: preference === 'any' ? 12 : 10
    };

    track('live_search_started', {
      category: payload.category,
      city: payload.city,
      contractor_type: payload.executorPreference
    });

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) throw new Error(data.message || 'Сервер поиска недоступен');

      state.all = Array.isArray(data.candidates) ? data.candidates : [];
      state.live = true;
      state.runId = data.runId || '';
      state.generatedAt = data.generatedAt || '';
      saveSearchResults();

      status.className = 'search-status ok';
      status.innerHTML = `<div class="status-dot">✓</div><div><b>Проверка исполнителей завершена</b><span>${esc(String(data.count ?? state.all.length))} кандидатов · ${esc(sourceSummary(state.all))}</span></div>`;
      if (introLead) introLead.textContent = 'Подбор готов: кандидаты проверены по доступным публичным источникам. Ниже — главное по каждому исполнителю.';
      filters.classList.remove('hidden');
      setupFilters();
      render();

      track('live_search_completed', {
        count: state.all.length,
        company: state.all.filter(c => c.type === 'company').length,
        private: state.all.filter(c => c.type === 'private').length,
        unverified: state.all.filter(c => c.type === 'unverified').length
      });
    } catch (error) {
      const message = String(error && error.message || error || 'Неизвестная ошибка');
      renderSearchError(message);
      track('live_search_failed', { reason: message });
      toast(message, false);
    }
  }

  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeReviewsModal(); });

  document.addEventListener('DOMContentLoaded', () => {
    if (!task || !task.city) {
      location.href = 'create-task.html';
      return;
    }
    setupPreference();
  });
})();
