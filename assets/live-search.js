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
    const facts = (candidate.facts || []).map(fact => {
      const source = sourceById(candidate, fact.sourceId);
      const sourceHtml = source
        ? `<a href="${esc(platform(source.url) ? source.url : outbound(source.url, candidate.id, 'fact'))}" target="_blank" rel="noopener">Источник: ${esc(source.label || kindLabel(source.kind))} · ${esc(source.host || hostOf(source.url))} ↗</a>`
        : '';
      return `<div class="fact-row ${factClass(fact.status)}"><div class="fact-icon">${factIcon(fact.status)}</div><div><div>${esc(fact.label)}</div>${sourceHtml}</div></div>`;
    }).join('');

    const sources = (candidate.sources || []).map(source =>
      `<a class="source-pill" href="${esc(platform(source.url) ? source.url : outbound(source.url, candidate.id, 'source'))}" target="_blank" rel="noopener"><b>${esc(source.label || kindLabel(source.kind))}</b><span>${esc(source.host || hostOf(source.url))}</span></a>`
    ).join('');

    const why = (candidate.rankReasons || []).map(x => `<li>${esc(x)}</li>`).join('');
    const action = externalAction(candidate);
    const actionHtml = action
      ? `<a class="btn secondary" href="${esc(action.url)}" target="_blank" rel="noopener">${esc(action.label)}</a>`
      : '';
    const initials = candidate.name.split(/\s+/).map(x => x[0]).join('').slice(0, 2).toUpperCase();

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
      <div class="candidate-grid">
        <section><h3>Почему выше в списке</h3><ul>${why || '<li>Найден по профильному поисковому запросу.</li>'}</ul></section>
        <section><h3>Факты и происхождение</h3><div class="facts">${facts}</div></section>
      </div>
      <div class="source-caption">Все использованные источники</div>
      <div class="source-list">${sources}</div>
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
    document.getElementById('countTitle').textContent = 'Ищем исполнителей';
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

    status.className = 'search-status loading';
    status.innerHTML = '<div class="spinner"></div><div><b>Ищем исполнителей</b><span>Проверяем веб-поиск, профили исполнителей и доступные публичные источники, объединяем дубли…</span></div>';
    list.innerHTML = '';
    filters.classList.add('hidden');

    const preference = task.executorPreference || 'any';
    const payload = {
      categoryId: task.categoryId || 'balcony-insulation',
      category: task.category || '',
      city: task.city || '',
      description: task.description || '',
      scope: task.scope || '',
      goal: task.goal || '',
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
      status.innerHTML = `<div class="status-dot">✓</div><div><b>Живой поиск завершён</b><span>${esc(String(data.count ?? state.all.length))} кандидатов · ${esc(sourceSummary(state.all))}</span></div>`;
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

  document.addEventListener('DOMContentLoaded', () => {
    if (!task || !task.city) {
      location.href = 'create-task.html';
      return;
    }
    setupPreference();
  });
})();
