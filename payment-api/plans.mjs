export const PLANS=Object.freeze({
  find:{id:'find',name:'Найти',amount:990},
  compare:{id:'compare',name:'Сравнить',amount:1990},
  decision:{id:'decision',name:'До решения',amount:2990},
});

export function getPlan(id){
  const plan=PLANS[String(id||'').trim()];
  if(!plan) throw Object.assign(new Error('UNKNOWN_PLAN'),{status:400});
  return plan;
}
