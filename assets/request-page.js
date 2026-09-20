(function () {
  'use strict';

  function readJson(key, fallback) {
    try {
      return JSON.parse(
        localStorage.getItem(key) || 'null'
      ) || fallback;
    } catch {
      return fallback;
    }
  }

  function track(name, extra) {
    const task =
      readJson(
        'sdelaet.task.v2',
        {}
      );

    const commercial =
      typeof window.sdGetCommercialContext ===
      'function'
        ? window.sdGetCommercialContext()
        : {};

    const params =
      Object.assign(
        {
          service_id:
            task?.categoryId || '',

          service_name:
            task?.category || '',

          city:
            task?.city || ''
        },

        commercial,

        extra || {}
      );

    window.dataLayer =
      window.dataLayer || [];

    window.dataLayer.push(
      Object.assign(
        { event: name },
        params
      )
    );

    const metrikaGoals =
      new Set([
        'request_prepare',
        'request_send'
      ]);

    if (
      metrikaGoals.has(name) &&
      typeof window.sdTrack === 'function'
    ) {
      window.sdTrack(
        name,
        params
      );
    }
  }


  function candidateUrl(candidate) {
    if (candidate.website) {
      return candidate.website;
    }

    const sources =
      Array.isArray(candidate.sources)
        ? candidate.sources
        : [];

    const preferred =
      sources.find(source =>
        [
          'official_site',
          'avito',
          'yandex_services',
          '2gis',
          'yandex_maps'
        ].includes(source.kind)
      );

    return (
      preferred?.url ||
      sources[0]?.url ||
      ''
    );
  }

  function buildMessage(task) {
    const rows = [
      'Здравствуйте!',
      '',
      'Прошу рассчитать стоимость и срок выполнения работ.',
      ''
    ];

    if (task.description) {
      rows.push(
        `Задача: ${task.description}`
      );
    }

    if (task.scope) {
      rows.push(
        `Объём работ: ${task.scope}`
      );
    }

    if (task.goal) {
      rows.push(
        `Цель: ${task.goal}`
      );
    }

    if (task.city) {
      rows.push(
        `Город: ${task.city}`
      );
    }

    rows.push(
      '',
      'Пожалуйста, укажите:',
      '— итоговую стоимость работ и материалов;',
      '— что входит в стоимость;',
      '— срок выполнения;',
      '— какие материалы предлагаете;',
      '— гарантию на работы.',
      '',
      'Спасибо.'
    );

    return rows.join('\n');
  }

  function toast(message) {
    let wrap =
      document.getElementById(
        'requestToastWrap'
      );

    if (!wrap) {
      wrap =
        document.createElement('div');

      wrap.id =
        'requestToastWrap';

      wrap.style.cssText =
        'position:fixed;' +
        'right:22px;' +
        'bottom:22px;' +
        'z-index:2000;' +
        'display:grid;' +
        'gap:8px';

      document.body.appendChild(
        wrap
      );
    }

    const item =
      document.createElement('div');

    item.textContent =
      message;

    item.style.cssText =
      'background:#12182f;' +
      'color:#fff;' +
      'padding:11px 14px;' +
      'border-radius:12px;' +
      'font:700 12px Roboto,sans-serif;' +
      'box-shadow:0 12px 35px rgba(15,25,55,.2)';

    wrap.appendChild(item);

    setTimeout(
      () => item.remove(),
      3000
    );
  }

  const params =
    new URLSearchParams(
      location.search
    );

  const candidateId =
    params.get('candidate') || '';

  const task =
    readJson(
      'sdelaet.task.v2',
      {}
    );

  const search =
    readJson(
      'sdelaet.search.results.v1',
      {}
    );

  const candidates =
    Array.isArray(search.candidates)
      ? search.candidates
      : [];

  const candidate =
    candidates.find(item =>
      String(item.id) ===
      String(candidateId)
    );

  if (!candidate) {
    location.href =
      'candidates.html';

    return;
  }

  const message =
    buildMessage(task);

  const subject =
    `Запрос на расчёт — ${
      task.category ||
      task.description ||
      'задача'
    }`;

  document.getElementById(
    'candidateTitle'
  ).textContent =
    `Запрос для «${candidate.name}»`;

  document.getElementById(
    'requestText'
  ).textContent =
    message;

  document.getElementById(
    'confirmCandidate'
  ).textContent =
    candidate.name || '';

  document.getElementById(
    'confirmEmail'
  ).textContent =
    candidate.email ||
    'Email не найден';

  document.getElementById(
    'confirmSubject'
  ).textContent =
    subject;

  document.getElementById(
    'confirmMessage'
  ).textContent =
    message;

  const emailRecipient =
    document.getElementById(
      'emailRecipient'
    );

  const emailSource =
    document.getElementById(
      'emailSource'
    );

  const emailSourceRow =
    document.getElementById(
      'emailSourceRow'
    );

  const chooseEmail =
    document.getElementById(
      'chooseEmail'
    );

  const sendPanel =
    document.getElementById(
      'sendPanel'
    );

  if (candidate.email) {
    emailRecipient.textContent =
      candidate.email;

    emailSource.textContent =
      candidate.emailSourceLabel ||
      'Официальный сайт';

    if (candidate.emailSourceUrl) {
      const sourceLink =
        document.createElement('a');

      sourceLink.href =
        candidate.emailSourceUrl;

      sourceLink.target = '_blank';
      sourceLink.rel = 'noopener';
      sourceLink.textContent =
        candidate.emailSourceLabel ||
        'Официальный сайт';

      emailSource.textContent = '';
      emailSource.appendChild(
        sourceLink
      );
    }

    chooseEmail.addEventListener(
      'click',
      () => {
        sendPanel.classList.add(
          'active'
        );

        chooseEmail.style.display =
          'none';

        track(
          'request_email_channel_selected',
          {
            candidate_id:
              candidate.id,
            candidate_type:
              candidate.type || ''
          }
        );
      }
    );

  } else {
    const emailMessages = {
      no_website:
        'Официальный сайт исполнителя не определён.',
      not_crawled:
        'Сайт найден, но ещё не был проверен на наличие email.',
      not_found:
        'Проверили сайт, но публичный email не нашли.',
      crawl_failed:
        'Не удалось проверить сайт исполнителя.',
      found:
        'Email найден.'
    };

    emailRecipient.textContent =
      'Публичный email не найден';

    emailSource.textContent =
      emailMessages[
        candidate.emailStatus
      ] ||
      'Источник email не определён.';

    chooseEmail.disabled =
      true;

    chooseEmail.textContent =
      'Почта недоступна';
  }

  const phone =
    String(
      candidate.phone || ''
    ).replace(
      /[^+\d]/g,
      ''
    );

  const callCandidate =
    document.getElementById(
      'callCandidate'
    );

  if (phone) {
    callCandidate.href =
      `tel:${phone}`;

    callCandidate.addEventListener(
      'click',
      () => {
        track(
          'request_phone_click',
          {
            candidate_id:
              candidate.id
          }
        );
      }
    );
  } else {
    callCandidate.style.display =
      'none';
  }

  const url =
    candidateUrl(candidate);

  const openCandidate =
    document.getElementById(
      'openCandidate'
    );

  if (url) {
    openCandidate.href =
      url;

    openCandidate.addEventListener(
      'click',
      () => {
        track(
          'request_external_open',
          {
            candidate_id:
              candidate.id,
            url
          }
        );
      }
    );
  } else {
    openCandidate.style.display =
      'none';
  }

  const copyRequest =
    document.getElementById(
      'copyRequest'
    );

  copyRequest.addEventListener(
    'click',
    async () => {
      try {
        await navigator.clipboard
          .writeText(message);

        const oldText =
          copyRequest.textContent;

        copyRequest.textContent =
          '✓ Запрос скопирован';

        toast(
          'Текст запроса скопирован'
        );

        setTimeout(
          () => {
            copyRequest.textContent =
              oldText;
          },
          2500
        );

        track(
          'request_copy',
          {
            candidate_id:
              candidate.id
          }
        );

      } catch {
        toast(
          'Не удалось скопировать текст'
        );
      }
    }
  );

  const confirmModal =
    document.getElementById(
      'confirmModal'
    );

  const reviewEmail =
    document.getElementById(
      'reviewEmail'
    );

  const cancelSend =
    document.getElementById(
      'cancelSend'
    );

  const confirmSend =
    document.getElementById(
      'confirmSend'
    );

  function openModal() {
    confirmModal.classList.add(
      'open'
    );

    document.body.style.overflow =
      'hidden';

    track(
      'request_email_review_open',
      {
        candidate_id:
          candidate.id
      }
    );
  }

  function closeModal() {
    confirmModal.classList.remove(
      'open'
    );

    document.body.style.overflow =
      '';
  }

  reviewEmail.addEventListener(
    'click',
    openModal
  );

  cancelSend.addEventListener(
    'click',
    closeModal
  );

  confirmModal.addEventListener(
    'click',
    event => {
      if (
        event.target ===
        confirmModal
      ) {
        closeModal();
      }
    }
  );

  document.addEventListener(
    'keydown',
    event => {
      if (
        event.key === 'Escape' &&
        confirmModal.classList
          .contains('open')
      ) {
        closeModal();
      }
    }
  );

  /*
   * SAFE MODE.
   *
   * Здесь НЕТ вызова /email/send.
   * Реальное письмо отправить
   * с этой страницы сейчас нельзя.
   */

  confirmSend.disabled =
    true;

  confirmSend.textContent =
    'Отправка временно отключена';

  track(
    'request_page_view',
    {
      candidate_id:
        candidate.id,

      candidate_name:
        candidate.name || '',

      candidate_type:
        candidate.type || '',

      has_email:
        !!candidate.email,

      has_phone:
        !!candidate.phone
    }
  );
})();
