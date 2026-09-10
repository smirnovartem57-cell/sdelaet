const EXPERT_SCHEMA={
  type:'object',additionalProperties:false,
  required:['serviceCode','facts','observed','inferred','unknown','criticalMissing','requiresSiteInspection','technicalRisks','contractorBrief','confidence'],
  properties:{
    serviceCode:{type:'string'},
    facts:{type:'array',items:{type:'string'}},
    observed:{type:'array',items:{type:'string'}},
    inferred:{type:'array',items:{type:'string'}},
    unknown:{type:'array',items:{type:'string'}},
    criticalMissing:{type:'array',items:{type:'string'}},
    requiresSiteInspection:{type:'array',items:{type:'string'}},
    technicalRisks:{type:'array',items:{type:'string'}},
    contractorBrief:{type:'object',additionalProperties:false,required:['title','object','goal','currentState','scope','optionsSeparate','responseRequirements'],properties:{
      title:{type:'string'},object:{type:'string'},goal:{type:'string'},
      currentState:{type:'array',items:{type:'string'}},scope:{type:'array',items:{type:'string'}},
      optionsSeparate:{type:'array',items:{type:'string'}},responseRequirements:{type:'array',items:{type:'string'}}
    }},
    confidence:{type:'string',enum:['low','medium','high']}
  }
};

function systemPrompt(){return `Ты Construction Domain Expert сервиса «Сделает». Работай только с услугой утепления балкона/лоджии. Твоя задача — превратить простое описание клиента в точную, но короткую техническую модель для предварительного расчёта. Не заставляй клиента быть строителем. Не придумывай факты. Разделяй confirmed/observed/inferred/unknown по смыслу. Если параметр корректно определяется только на объекте, помещай его в requiresSiteInspection, а не criticalMissing. criticalMissing используй только если без данных нельзя сформировать сопоставимый запрос исполнителям. Для зимнего/круглогодичного использования обязательно учитывай пригодность остекления, монтажных примыканий, непрерывность тёплого контура и риск конденсата. При сырости, плесени, промерзании или конденсате не называй причину установленной без диагностики. Contractor Brief должен читаться менее минуты, быть без воды и просить одинаковую структуру ответа: итоговая цена, работы/материалы, состав работ, система утепления, исключения, доплаты, срок, замер, гарантия. Не назначай конкретный утеплитель или толщину без достаточных данных. Не утверждай юридическую допустимость объединения лоджии, переноса радиатора или изменения фасада без региональной проверки.`}

function inputPayload(body){
  const task=body?.task||body||{};
  const profile=body?.profile||{};
  return JSON.stringify({
    serviceCode:task.serviceCode||'BALCONY_INSULATION',description:task.description||'',city:task.city||'',goal:task.goal||'',window:task.window||'',currentState:task.currentState||'',scope:task.scope||'',finish:task.finish||'',wallSize:task.wallSize||'',openingSize:task.openingSize||'',attachmentsCount:Array.isArray(task.attachments)?task.attachments.length:0,
    profileRules:{truthStates:profile.truthStates||['confirmed','observed','inferred','unknown','requires_site_inspection'],siteInspectionOnly:profile.siteInspectionOnly||[],contractorResponseRequired:profile.contractorResponseRequired||[]}
  });
}

function outputText(data){
  if(typeof data?.output_text==='string'&&data.output_text)return data.output_text;
  for(const item of data?.output||[])for(const part of item?.content||[])if(part?.type==='output_text'&&part.text)return part.text;
  return '';
}

export async function analyzeConstructionTask(env,body){
  if(!env.OPENAI_API_KEY)return {ok:false,status:503,error:'AI_NOT_CONFIGURED',message:'OPENAI_API_KEY is not configured.'};
  const model=env.OPENAI_MODEL||'gpt-5.4-mini';
  const payload={model,store:false,instructions:systemPrompt(),input:inputPayload(body),text:{format:{type:'json_schema',name:'construction_domain_expert',strict:true,schema:EXPERT_SCHEMA}}};
  const res=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{'authorization':'Bearer '+env.OPENAI_API_KEY,'content-type':'application/json'},body:JSON.stringify(payload)});
  const data=await res.json().catch(()=>({}));
  if(!res.ok)return {ok:false,status:502,error:'OPENAI_ERROR',message:'AI expert request failed.',detail:env.DEBUG==='1'?data:undefined};
  const text=outputText(data);let expert;
  try{expert=JSON.parse(text)}catch{return {ok:false,status:502,error:'BAD_AI_OUTPUT',message:'AI expert returned invalid structured output.'}}
  return {ok:true,status:200,expert,model,agentVersion:'construction-domain-expert-llm-v1',responseId:data.id||''};
}
