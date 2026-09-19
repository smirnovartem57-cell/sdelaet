import fs from 'node:fs';
const html=fs.readFileSync('task-tz.html','utf8');
function ok(v,m){if(!v)throw new Error(m)}
ok(html.includes('id="marketSearchModal"'),'market loading modal must exist');
ok(html.includes('Обычно это занимает от нескольких секунд до 1–2 минут'),'loading modal must explain expected wait');
ok(html.includes('function runMarketSearchFlow()'),'market search flow must manage loading state');
ok(html.includes('marketSearchLongWaitTimer=setTimeout'),'long wait feedback must exist');
ok(html.includes("card.classList.toggle('selected',selected)"),'tariff selection must receive visible selected state');
ok(html.includes("grid-template-columns:repeat(2,minmax(0,1fr))"),'two tariffs must use two-column layout');
ok(html.includes('#paywall .modal-card{width:min(1080px,calc(100vw - 20px));max-width:1080px;max-height:none;overflow:visible'),'desktop tariff modal must not use internal scroll');
ok(html.includes("content:'✓ Выбрано'"),'selected tariff must show explicit badge');
console.log('TASK TZ MARKET UX REGRESSION: PASS');
