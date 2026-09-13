(()=>{
  const plans={find:{name:'Найти',amount:990},compare:{name:'Сравнить',amount:1990},decision:{name:'До решения',amount:2990}};
  const q=new URLSearchParams(location.search),planId=q.get('plan'),plan=plans[planId];
  const title=document.getElementById('payTitle'),text=document.getElementById('payText'),btn=document.getElementById('payButton'),err=document.getElementById('payError');
  if(!plan){title.textContent='Тариф не найден';text.textContent='Вернитесь к тарифам и выберите вариант оплаты.';btn.style.display='none';return;}
  title.textContent=`Тариф «${plan.name}» — ${plan.amount.toLocaleString('ru-RU')} ₽`;
  text.textContent='После нажатия откроется защищённая платёжная страница Точки.';
  btn.addEventListener('click',async()=>{
    btn.disabled=true;btn.textContent='Создаём оплату…';err.style.display='none';
    try{const r=await fetch('/api/payments/v1/payments',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({plan:planId})});const j=await r.json();if(!r.ok||!j.paymentUrl)throw new Error(j.error||'Не удалось создать оплату');location.href=j.paymentUrl;}
    catch(e){err.textContent=e.message;err.style.display='block';btn.disabled=false;btn.textContent='Попробовать снова';}
  });
})();
