export const PLANS=Object.freeze({
  find:{id:'find',name:'Подбор',amount:990},
  choice:{id:'choice',name:'До выбора',amount:2590},
});

export function getPlan(id){
  const plan=PLANS[String(id||'').trim()];
  if(!plan) throw Object.assign(new Error('UNKNOWN_PLAN'),{status:400});
  return plan;
}
