(function(){
  function uniq(a){return Array.from(new Set((a||[]).filter(Boolean)))}
  function hasWork(offer,re){return (offer.worksIncluded||[]).some(function(x){return re.test(String(x).toLowerCase().replace(/ё/g,'е'))})}
  function build(task,offer){task=task||{};offer=offer||{};var items=[];var winter=/зим|круглогод/i.test(task.goal||'');
    if(offer.priceType==='from')items.push('какая фиксированная цена после замера и от чего она может измениться');
    else if(offer.totalPrice==null)items.push('итоговую стоимость');
    if(offer.materialsIncluded==null)items.push('входят ли материалы в цену');
    if(!offer.leadTime)items.push('срок выполнения');
    if(!offer.warranty)items.push('гарантию на работы');
    if(winter){
      if(!hasWork(offer,/утепл.{0,12}пол/))items.push('входит ли утепление пола');
      if(!hasWork(offer,/утепл.{0,12}потол/))items.push('входит ли утепление потолка');
      if(!hasWork(offer,/утепл.{0,15}(стен|парапет)/))items.push('входит ли утепление стен / парапета');
      if(!hasWork(offer,/(гермет|примыкан|монтажн.{0,8}шв)/))items.push('учтена ли герметизация примыканий');
      if(!hasWork(offer,/(провер|осмотр|диагност).{0,18}(остеклен|окон)/))items.push('будет ли проверено существующее остекление на пригодность для зимнего режима');
    }
    if((offer.exclusions||[]).length===0&&offer.materialsIncluded!==false)items.push('что не входит в указанную стоимость');
    items=uniq(items).slice(0,6);
    if(!items.length)return{needed:false,items:[],message:'Спасибо. Предложение достаточно полное для предварительного сравнения.'};
    var msg='Спасибо. Уточните, пожалуйста: '+items.join('; ')+'.';
    return{needed:true,items:items,message:msg};
  }
  window.sdOfferFollowup={build:build};
})();