(() => {
  'use strict';

  const METRIKA_ID = 112503660;

  /*
   * Canonical tariff registry.
   * Prices used for analytics must come
   * from here until billing backend becomes
   * the source of truth.
   */
  const TARIFFS = Object.freeze({
    tz:Object.freeze({id:'tz',name:'Р—Р°РґР°РЅРёРµ',price:0}),
    find:Object.freeze({id:'find',name:'РџРѕРґР±РѕСЂ',price:990,canRefineSearch:false,canCompareOffers:false,canFollowUpOffers:false}),
    choice:Object.freeze({id:'choice',name:'Р”Рѕ РІС‹Р±РѕСЂР°',price:2590,canRefineSearch:true,canCompareOffers:true,canFollowUpOffers:true})
  });

  window.SDELAET_TARIFFS =
    TARIFFS;


  window.sdTariff = function sdTariff(
    tariffId
  ) {
    return (
      TARIFFS[
        String(tariffId || '')
      ] || null
    );
  };


  window.sdCommercialContext =
    function sdCommercialContext(
      tariffId,
      extra = {}
    ) {
      const tariff =
        window.sdTariff(tariffId);

      let task = {};

      try {
        task =
          JSON.parse(
            localStorage.getItem(
              'sdelaet.task.v2'
            ) || 'null'
          ) || {};
      } catch {}

      const price =
        tariff
          ? Number(tariff.price || 0)
          : 0;

      return Object.assign(
        {
          service_id:
            task.categoryId || '',

          service_name:
            task.category || '',

          city:
            task.city || '',

          task_id:
            task.id || '',

          tariff_id:
            tariff?.id || tariffId || '',

          tariff_name:
            tariff?.name || '',

          price,

          expected_revenue:
            price,

          currency:
            'RUB'
        },
        extra || {}
      );
    };




  window.sdSetCommercialContext =
    function sdSetCommercialContext(
      tariffId,
      extra = {}
    ) {
      const context =
        window.sdCommercialContext(
          tariffId,
          extra
        );

      const payload =
        Object.assign(
          {
            saved_at:
              new Date().toISOString()
          },
          context
        );

      try {
        sessionStorage.setItem(
          'sdelaet.commercial.v1',
          JSON.stringify(payload)
        );
      } catch {}

      /*
       * localStorage fallback allows the
       * commercial context to survive a new tab.
       * task_id validation below prevents using
       * another task's tariff.
       */
      try {
        localStorage.setItem(
          'sdelaet.commercial.v1',
          JSON.stringify(payload)
        );
      } catch {}

      return payload;
    };


  window.sdGetCommercialContext =
    function sdGetCommercialContext() {
      let context = {};

      try {
        context =
          JSON.parse(
            sessionStorage.getItem(
              'sdelaet.commercial.v1'
            ) || 'null'
          ) || {};
      } catch {}

      if (!context.task_id) {
        try {
          context =
            JSON.parse(
              localStorage.getItem(
                'sdelaet.commercial.v1'
              ) || 'null'
            ) || {};
        } catch {}
      }

      let task = {};

      try {
        task =
          JSON.parse(
            localStorage.getItem(
              'sdelaet.task.v2'
            ) || 'null'
          ) || {};
      } catch {}

      /*
       * Never attribute a tariff from an old task
       * to a newly created task.
       */
      if (
        context.task_id &&
        task.id &&
        String(context.task_id) !==
        String(task.id)
      ) {
        return {};
      }

      return context;
    };


  /*
   * Public analytics helper for the whole service.
   *
   * Usage:
   *   window.sdTrack('search_start', {...});
   */
  window.sdTrack = function sdTrack(
    goal,
    params = {}
  ) {
    if (!goal) {
      return;
    }

    /*
     * Persistent debug log for the current tab.
     * Keeps analytics events visible across
     * candidates.html -> request.html navigation.
     */
    try {
      const key =
        'sdelaet.analytics.debug.v1';

      const current =
        JSON.parse(
          sessionStorage.getItem(key) ||
          '[]'
        );

      current.push({
        ts:
          new Date().toISOString(),

        page:
          location.pathname,

        event:
          goal,

        ...params
      });

      sessionStorage.setItem(
        key,
        JSON.stringify(
          current.slice(-50)
        )
      );
    } catch {}


    try {
      if (
        typeof window.ym !==
        'function'
      ) {
        return;
      }

      window.ym(
        METRIKA_ID,
        'reachGoal',
        goal,
        params
      );
    } catch (error) {
      console.warn(
        '[analytics] goal failed:',
        goal,
        error
      );
    }
  };



  /*
   * Load Yandex.Metrika once.
   */
  (function(m,e,t,r,i,k,a){
    m[i]=m[i]||function(){
      (m[i].a=m[i].a||[]).push(arguments)
    };

    m[i].l=1*new Date();

    for (
      let j = 0;
      j < document.scripts.length;
      j++
    ) {
      if (
        document.scripts[j].src === r
      ) {
        return;
      }
    }

    k=e.createElement(t);
    a=e.getElementsByTagName(t)[0];
    k.async=1;
    k.src=r;
    a.parentNode.insertBefore(k,a);

  })(
    window,
    document,
    'script',
    'https://mc.yandex.ru/metrika/tag.js?id=112503660',
    'ym'
  );


  window.ym(
    METRIKA_ID,
    'init',
    {
      ssr: true,
      webvisor: true,
      clickmap: true,
      ecommerce: 'dataLayer',
      referrer: document.referrer,
      url: location.href,
      accurateTrackBounce: true,
      trackLinks: true
    }
  );
})();
