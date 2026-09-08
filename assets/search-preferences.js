(function () {
  const STORAGE_KEY = 'sdelaet.task.v2';
  const DEFAULTS = {
    sources: { sites: true, yandexServices: true, avito: true },
    types: { company: true, private: true }
  };

  function readTask() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') || {}; }
    catch { return {}; }
  }

  function saveTask(task) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(task));
  }

  function normalize(prefs) {
    return {
      sources: {
        sites: prefs?.sources?.sites !== false,
        yandexServices: prefs?.sources?.yandexServices !== false,
        avito: prefs?.sources?.avito !== false
      },
      types: {
        company: prefs?.types?.company !== false,
        private: prefs?.types?.private !== false
      }
    };
  }

  function getPrefs() {
    return normalize(readTask().searchPreferencesV2 || DEFAULTS);
  }

  function legacyPreference(prefs) {
    if (prefs.types.company && prefs.types.private) return 'any';
    if (prefs.types.company) return 'company';
    if (prefs.types.private) return 'private';
    return '';
  }

  function selectedSources(prefs) {
    const out = [];
    if (prefs.sources.sites) out.push('web');
    if (prefs.sources.yandexServices) out.push('yandex_services');
    if (prefs.sources.avito) out.push('avito');
    return out;
  }

  function selectedTypes(prefs) {
    const out = [];
    if (prefs.types.company) out.push('company');
    if (prefs.types.private) out.push('private');
    return out;
  }

  function filterCandidate(candidate, prefs) {
    const kinds = new Set((candidate.sources || []).map(s => s.kind));
    if (candidate.type === 'company') {
      if (!prefs.types.company) return false;
      if (!prefs.sources.sites && (kinds.has('web_search') || kinds.has('official_site'))) return false;
    }
    if (candidate.type === 'private') {
      if (!prefs.types.private) return false;
      if (!prefs.sources.yandexServices && kinds.has('yandex_services')) return false;
    }
    if (candidate.type === 'unverified') {
      if (!prefs.sources.avito || !kinds.has('avito')) return false;
      if (!(prefs.types.company && prefs.types.private)) return false;
    }
    return true;
  }

  // Migration: old one-dimensional choice must not skip the new two-dimensional selector.
  const initialTask = readTask();
  if (!initialTask.searchPreferencesV2 && initialTask.executorPreference) {
    delete initialTask.executorPreference;
    saveTask(initialTask);
  }

  // Add new dimensions to API requests. Response filtering keeps the UI correct
  // even during a rolling backend deployment; backend also enforces these fields.
  const nativeFetch = window.fetch.bind(window);
  window.fetch = async function (input, init) {
    const url = typeof input === 'string' ? input : input?.url || '';
    if (!url.includes('/v1/candidates/search') || !init || String(init.method || 'GET').toUpperCase() !== 'POST') {
      return nativeFetch(input, init);
    }

    const prefs = getPrefs();
    let body = {};
    try { body = JSON.parse(init.body || '{}'); } catch {}
    body.sources = selectedSources(prefs);
    body.executorTypes = selectedTypes(prefs);
    body.executorPreference = legacyPreference(prefs) || 'any';

    const response = await nativeFetch(input, { ...init, body: JSON.stringify(body) });
    const clone = response.clone();
    let data;
    try { data = await clone.json(); } catch { return response; }
    if (!data || !Array.isArray(data.candidates)) return response;

    data.candidates = data.candidates.filter(c => filterCandidate(c, prefs));
    data.count = data.candidates.length;
    return new Response(JSON.stringify(data), {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers
    });
  };

  document.addEventListener('DOMContentLoaded', function () {
    const form = document.getElementById('searchPreferencesForm');
    if (!form) return;

    const task = readTask();
    const prefs = normalize(task.searchPreferencesV2 || DEFAULTS);
    const map = {
      sourceSites: prefs.sources.sites,
      sourceYandexServices: prefs.sources.yandexServices,
      sourceAvito: prefs.sources.avito,
      typeCompany: prefs.types.company,
      typePrivate: prefs.types.private
    };
    for (const [id, checked] of Object.entries(map)) {
      const el = document.getElementById(id);
      if (el) el.checked = checked;
    }

    const error = document.getElementById('searchPreferencesError');
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      const next = {
        sources: {
          sites: !!document.getElementById('sourceSites')?.checked,
          yandexServices: !!document.getElementById('sourceYandexServices')?.checked,
          avito: !!document.getElementById('sourceAvito')?.checked
        },
        types: {
          company: !!document.getElementById('typeCompany')?.checked,
          private: !!document.getElementById('typePrivate')?.checked
        }
      };
      const sources = selectedSources(next);
      const types = selectedTypes(next);
      if (!sources.length || !types.length) {
        if (error) {
          error.textContent = !sources.length
            ? 'Выберите хотя бы один источник поиска.'
            : 'Выберите хотя бы один тип исполнителя.';
          error.classList.remove('hidden');
        }
        return;
      }
      if (error) error.classList.add('hidden');

      const current = readTask();
      current.searchPreferencesV2 = next;
      const legacy = legacyPreference(next);
      delete current.executorPreference;
      saveTask(current);

      const legacyButton = document.querySelector(`[data-choice="${legacy}"]`);
      if (legacyButton) legacyButton.click();
    });
  });
})();
