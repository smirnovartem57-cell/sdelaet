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

  function renderFactItem(candidate, fact) {
    const source = sourceById(candidate, fact.sourceId);
    const split = splitFactLabel(fact.label);
    const sourceHtml = source ? `<a class="fact-source" href="${esc(platform(source.url) ? source.url : outbound(source.url, candidate.id, 'fact'))}" target="_blank" rel="noopener">Источник ↗</a>` : '';
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
    const rep = reviewModel(candidate);
    const domain = candidate.trustProfile?.history?.domain;
    const exp = candidate.trustProfile?.history?.claimedExperience;
    if (rep) {
      const main = rep.rating != null ? `★ ${Number(rep.rating).toFixed(1).replace('.',',')}` : (rep.yearCount ? `${rep.yearCount}` : `${rep.totalCount || '—'}`);
      const sub = rep.yearCount ? `отзывов за ${rep.year}` : `${rep.totalCount || 0} оценок`;
      items.push(`<div class="key-signal"><span>Репутация</span><b>${esc(main)}</b><small>${esc(sub)}</small></div>`);
    }
    if (domain?.ageYears != null) items.push(`<div class="key-signal"><span>Домен</span><b>${esc(domain.ageYears)} лет</b><small>${esc(domain.domain || '')}</small></div>`);
    if (exp?.claimedYears) items.push(`<div class="key-signal"><span>Опыт</span><b>${esc(exp.claimedYears)} лет</b><small>заявлено компанией</small></div>`);
    const channels = [candidate.phone ? 'телефон' : '', candidate.email ? 'email' : ''].filter(Boolean);
    if (channels.length) items.push(`<div class="key-signal"><span>Контакты</span><b>${channels.length}/2</b><small>${esc(channels.join(' + '))}</small></div>`);
    return items.length ? `<div class="key-signals">${items.slice(0,4).join('')}</div>` : '';
  }

  function renderReputation(candidate) {
    const rep = reviewModel(candidate);
    if (!rep) return '';
    const parts = [];
    if (rep.rating != null) parts.push(`★ ${Number(rep.rating).toFixed(1).replace('.',',')}`);
    if (rep.totalCount != null) parts.push(`${rep.totalCount} оценок`);
    if (rep.yearCount) parts.push(`${rep.yearCount} отзывов за ${rep.year}`);
    const topics = [...(rep.topics?.positive || [])].slice(0,2).map(t => `${t.label} · ${t.mentions}`).join(' · ');
    const hasTexts = rep.positive.length || rep.neutral.length || rep.negative.length;
    const action = hasTexts
      ? `<button type="button" class="reviews-open" data-candidate="${esc(candidate.id)}">Посмотреть отзывы</button>`
      : rep.profileUrl ? `<a class="reviews-link" href="${esc(rep.profileUrl)}" target="_blank" rel="noopener">Профиль и оценки ↗</a>` : '';
    return `<div class="reputation-strip"><div><span>${esc(rep.platform)}</span><b>${esc(parts.join(' · ') || 'Профиль найден')}</b>${topics ? `<small>Чаще отмечают: ${esc(topics)}</small>` : ''}</div>${action}</div>`;
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

  function renderCard(candidate, index) {
    const type = typeMeta(candidate.type);
    const allFacts = allCandidateFacts(candidate);
    const buckets = { terms: [], verification: [], reputation: [], unknown: [] };
    allFacts.forEach(f => buckets[factBucket(f)].push(f));
    const sources = uniqueSourceGroups(candidate).map(source => {
      const pageText = source.pages > 1 ? ` · ${source.pages} страницы проверено` : '';
      return `<a class="source-pill" href="${esc(platform(source.url) ? source.url : outbound(source.url, candidate.id, 'source'))}" target="_blank" rel="noopener"><b>${esc(source.label)}</b><span>${esc(source.host)}${esc(pageText)}</span></a>`;
    }).join('');
    const why = (candidate.rankReasons || []).map(x => `<li>${esc(x)}</li>`).join('');
    const action = externalAction(candidate);
    const actionHtml = action
      ? `<a class="btn secondary" href="${esc(action.url)}" target="_blank" rel="noopener">${esc(action.label)}</a>`
      : '';
    const initials = candidate.name.split(/\s+/).map(x => x[0]).join('').slice(0, 2).toUpperCase();
    const structuredFacts = [
      renderFactPanel(candidate, 'Условия и цены', buckets.terms, 'terms'),
      renderFactPanel(candidate, 'Проверка компании', buckets.verification, 'verification'),
      renderFactPanel(candidate, 'Репутация', buckets.reputation, 'reputation'),
      renderFactPanel(candidate, 'Что уточнить', buckets.unknown, 'unknown')
    ].filter(Boolean).join('');

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
      <div class="candidate-grid structured">
        <section class="why-panel"><h3>Почему подходит</h3><ul>${why || '<li>Найден по профильному поисковому запросу.</li>'}</ul></section>
        <div class="fact-panels">${structuredFacts || '<section class="fact-panel"><h3>Проверка</h3><p class="muted">Дополнительных публичных фактов пока не найдено.</p></section>'}</div>
      </div>
      ${sources ? `<div class="source-caption">Источники проверки</div><div class="source-list">${sources}</div>` : ''}
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
