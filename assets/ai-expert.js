(function(){
  function apiBase(){return window.SDELAET_API_BASE||'https://api.onsdelaet.ru'}
  function local(task){
    if(!window.sdExpertAgent)throw new Error('LOCAL_EXPERT_UNAVAILABLE');
    var r=window.sdExpertAgent.run(task);
    r.source='local';
    return Promise.resolve(r);
  }
  async function remote(task){
    var res=await fetch(apiBase()+'/v1/expert/construction/analyze',{
      method:'POST',headers:{'content-type':'application/json'},
      body:JSON.stringify({task:task})
    });
    var data=await res.json().catch(function(){return{}});
    if(!res.ok||!data.ok||!data.expert)throw new Error(data.error||'AI_EXPERT_FAILED');
    var qa=window.sdExpertAgent&&window.sdExpertAgent.reviewer?window.sdExpertAgent.reviewer(task,data.expert):null;
    return {expert:data.expert,qa:qa,agentVersion:data.agentVersion||'construction-domain-expert-llm-v1',reviewerVersion:'technical-expert-reviewer-v1',model:data.model||'',responseId:data.responseId||'',source:'llm'};
  }
  window.sdAiExpert={
    run:async function(task){
      try{return await remote(task)}catch(e){
        console.warn('LLM expert fallback:',e&&e.message||e);
        var result=await local(task);result.fallbackReason=String(e&&e.message||e);return result;
      }
    }
  };
})();