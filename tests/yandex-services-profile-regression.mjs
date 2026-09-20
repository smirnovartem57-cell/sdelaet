import {extractYandexServicesProfile} from '../src/yandex-services-profile.mjs';
function ok(v,m){if(!v)throw new Error(m)}
const html=`<script type="application/ld+json">{"@type":"LocalBusiness","name":"Мастер","description":"Опыт работы более 7 лет. На все работы даю гарантию. Замеры делаю бесплатно.","openingHours":"с 9 до 21","areaServed":["Москва","Мытищи"],"aggregateRating":{"ratingValue":4.9,"reviewCount":51}}</script>
<div class="Achievement-Text">Паспорт проверен</div><div class="Achievement-Text">Даёт гарантию</div>
<script>window.__STATE__={"ratingStats":{"1":1,"2":0,"3":0,"4":3,"5":47},"profile":{"specializations":[{"name":"Ремонт и установка окон и балконов","numberId":1708,"seoId":"/remont/okna","specialistName":"Монтажник окон","isPhotoSpecialization":true,"services":[{"rubricId":"/okna/uteplenie","attrs":{"name":"Утепление балконов и лоджий","price":2500,"priceMeasure":"square_meter","photoUrls":["a","b"]}}]}],"portfolio":{"p1":{"title":"Утепление лоджии","description":"Утепление пола и потолка","price":50000,"coverUrl":"https://img.test/a.jpg","rubricsNames":{"occupation":"/remont","specialization":"/okna-i-balkony"}}}}};</script>`;
const x=extractYandexServicesProfile(html,'https://uslugi.yandex.ru/profile/Test-1');
ok(x.reputation.rating===4.9&&x.reputation.reviewsCount===51,'rating must parse');
ok(x.reputation.ratingStats[5]===47,'rating distribution must parse');
ok(x.profile.experience?.minYears===7&&/более/.test(x.profile.experience.label),'experience must preserve qualifier');
ok(x.profile.passportVerified===true,'passport badge must parse');
ok(x.profile.guaranteeClaimed===true,'guarantee must parse');
ok(x.profile.freeMeasurement===true,'free measurement must parse');
ok(x.profile.areaServed.includes('Мытищи'),'service area must parse');
ok(x.profile.openingHours==='с 9 до 21','hours must parse');
ok(x.profile.specializations.some(s=>s.specialistName==='Монтажник окон'),'specialization must parse');
ok(x.profile.services.some(s=>s.name==='Утепление балконов и лоджий'&&s.price===2500&&s.photoCount===2),'service price must parse');
ok(x.profile.portfolio.some(p=>p.title==='Утепление лоджии'&&p.price===50000),'portfolio must parse');
console.log('YANDEX SERVICES PROFILE REGRESSION: PASS');