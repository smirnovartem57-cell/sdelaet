export const PLANS=Object.freeze({
  find:{id:'find',baseId:'find',name:'Подбор',amount:990,regularAmount:990,priceType:'regular',candidateLimit:5,additionalSearchLimit:1},
  choice:{id:'choice',baseId:'choice',name:'До выбора',amount:2590,regularAmount:2590,priceType:'regular',candidateLimit:15,additionalSearchLimit:null},
  find_repeat:{id:'find_repeat',baseId:'find',name:'Подбор',amount:690,regularAmount:990,priceType:'repeat',repeatDiscountPercent:30,candidateLimit:5,additionalSearchLimit:1},
  choice_repeat:{id:'choice_repeat',baseId:'choice',name:'До выбора',amount:1790,regularAmount:2590,priceType:'repeat',repeatDiscountPercent:30,candidateLimit:15,additionalSearchLimit:null},
});

export function getPlan(id){
  const plan=PLANS[String(id||'').trim()];
  if(!plan) throw Object.assign(new Error('UNKNOWN_PLAN'),{status:400});
  return plan;
}
