(() => {
  'use strict';

  const METRIKA_ID = 112503660;

  const ATTR_FIRST_KEY='sdelaet.attribution.first.v1';
  const ATTR_LAST_KEY='sdelaet.attribution.last.v1';
  const ATTR_CLIENT_KEY='sdelaet.ym_client_id.v1';
  const INTENTS=new Set(['contractor_choose','contractor_check','contractor_compare','estimate_compare','contract_risk','repair_cost','repair_start']);
  function cleanMarketingValue(v,max=500){return String(v||'').trim().slice(0,max)}
  function intentFrom(params){const explicit=cleanMarketingValue(params.get('intent_cluster')||params.get('utm_content'),80);return INTENTS.has(explicit)?explicit:''}
  function classifyVisit(){
    const p=new URLSearchParams(location.search),utm={};
    ['utm_source','utm_medium','utm_campaign','utm_content','utm_term','yclid'].forEach(k=>utm[k]=cleanMarketingValue(p.get(k),300));
    const ref=cleanMarketingValue(document.referrer,1000),landing=cleanMarketingValue(location.pathname+location.search,1500);
    let source=utm.utm_source,medium=utm.utm_medium;
    if(!source&&ref){try{const h=new URL(ref).hostname.toLowerCase();if(/(^|\\.)t\\.me$|(^|\\.)telegram\\.me$/.test(h)){source='telegram';medium='referral'}else if(/yandex|google|bing|mail\\.ru/.test(h)){source=h;medium='organic'}else if(h&&h!==location.hostname){source=h;medium='referral'}}catch{}}
    const meaningful=Boolean(source||utm.yclid||medium&&medium!=='direct');
    return {source,medium,campaign:utm.utm_campaign,content:utm.utm_content,term:utm.utm_term,yclid:utm.yclid,intent_cluster:intentFrom(p),landing_page:landing,referrer:ref,timestamp:new Date().toISOString(),meaningful};
  }
  function readAttr(key){try{return JSON.parse(localStorage.getItem(key)||'null')}catch{return null}}
  function writeAttr(key,v){try{localStorage.setItem(key,JSON.stringify(v))}catch{}}
  const currentVisit=classifyVisit();
  let firstTouch=readAttr(ATTR_FIRST_KEY),lastTouch=readAttr(ATTR_LAST_KEY);
  if(currentVisit.meaningful){if(!firstTouch){firstTouch=currentVisit;writeAttr(ATTR_FIRST_KEY,firstTouch)}lastTouch=currentVisit;writeAttr(ATTR_LAST_KEY,lastTouch)}
  function clientId(){try{return localStorage.getItem(ATTR_CLIENT_KEY)||''}catch{return''}}
  function publishClientId(value){const id=cleanMarketingValue(value,100);if(!id)return;try{localStorage.setItem(ATTR_CLIENT_KEY,id)}catch{};window.dispatchEvent(new CustomEvent('sdelaet:ym-client-id',{detail:{clientId:id}}))}
  window.sdAttribution=function(){return {ym_client_id:clientId(),first_touch:firstTouch||null,last_touch:lastTouch||null,intent_cluster:(lastTouch&&lastTouch.intent_cluster)||(firstTouch&&firstTouch.intent_cluster)||'',current_visit:currentVisit}}
  window.sdAttributionForTask=function(){const a=window.sdAttribution();return {ym_client_id:a.ym_client_id,first_touch:a.first_touch,last_touch:a.last_touch,intent_cluster:a.intent_cluster,attribution_saved_at:new Date().toISOString()}}
  window.sdBindTaskClientId=async function(taskId){const id=clientId();if(!taskId||!id)return false;try{const r=await fetch('https://api.onsdelaet.ru/v1/account/tasks/'+encodeURIComponent(taskId)+'/client-id',{method:'POST',credentials:'include',headers:{'content-type':'application/json'},body:JSON.stringify({ym_client_id:id})});return r.ok}catch{return false}}


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

      const attribution=window.sdAttribution?window.sdAttribution():{};
      const safeParams=Object.assign({},params||{},attribution.intent_cluster?{intent_cluster:attribution.intent_cluster}:{},attribution.ym_client_id?{ym_client_id:attribution.ym_client_id}:{});
      window.ym(
        METRIKA_ID,
        'reachGoal',
        goal,
        safeParams
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

  function requestYmClientId(attempt=0){
    try{window.ym(METRIKA_ID,'getClientID',function(id){if(id){publishClientId(id);return}if(attempt<12)setTimeout(function(){requestYmClientId(attempt+1)},500)})}catch(e){if(attempt<12)setTimeout(function(){requestYmClientId(attempt+1)},500)}}
  requestYmClientId();
  window.addEventListener('sdelaet:ym-client-id',function(){try{const task=JSON.parse(localStorage.getItem('sdelaet.task.v2')||'null');if(task&&task.id)window.sdBindTaskClientId(task.id)}catch{}});
})();
