import fs from 'node:fs';
import vm from 'node:vm';

const context={window:{},console};
vm.createContext(context);
for(const file of ['assets/attachment-analyzer.js','assets/category-engine.js']){
  vm.runInContext(fs.readFileSync(file,'utf8'),context,{filename:file});
}
const w=context.window;
function ok(v,m){if(!v)throw new Error(m)}
const W=1000,H=800;
const tokens=[
  {text:'314',x:500,y:90,confidence:98},
  {text:'287',x:75,y:400,confidence:96},
  {text:'58',x:205,y:420,confidence:97},
  {text:'76',x:825,y:420,confidence:97},
  {text:'180',x:515,y:625,confidence:99},
  {text:'220',x:705,y:410,confidence:96},
  {text:'26,5',x:515,y:205,confidence:95},
  {text:'40,5',x:515,y:690,confidence:95}
];
const attachment=w.sdAttachmentAnalyzer.analyzeTokens({
  width:W,height:H,
  text:'Сторона балкона с окном. Зона для утепления. Размеры в см. Окно.',
  tokens
});
ok(attachment.status==='recognized','dimensioned drawing must be recognized');
ok(attachment.confidence==='high','consistent dimensions must be high confidence');
const wall=attachment.geometry.surfaces.windowWall;
const opening=attachment.geometry.openings[0];
ok(wall.widthCm===314&&wall.heightCm===287,'wall dimensions must be 314x287');
ok(opening.widthCm===180&&opening.heightCm===220,'window dimensions must be 180x220');
ok(opening.offsetsCm.left===58&&opening.offsetsCm.right===76,'horizontal offsets must match');
ok(opening.offsetsCm.top===26.5&&opening.offsetsCm.bottom===40.5,'vertical offsets must match');
ok(attachment.geometryValidation.horizontal.status==='confirmed','horizontal equation must validate');
ok(attachment.geometryValidation.vertical.status==='confirmed','vertical equation must validate');
ok(Math.abs(attachment.calculated.windowWallNetAreaM2-5.05)<0.01,'net wall area must be 5.05 m2');
ok(attachment.geometry.workZones.includes('windowWall'),'insulation zone must map to window wall');

const analysis=w.sdCategoryEngine.analyze(
  'Хочу утеплить балкон, остекление уже есть и его нужно оставить.',
  {attachmentAnalysis:attachment}
);
ok(analysis.categoryId==='balcony-insulation','category must remain balcony insulation');
ok(analysis.params.wallSize.includes('314'),'wall size must enter canonical params');
ok(analysis.params.openingSize.includes('180'),'opening size must enter canonical params');
ok(!analysis.questions.some(q=>q.type==='sizes'),'high-confidence image dimensions must suppress repeated size question');
const medium=JSON.parse(JSON.stringify(attachment));
medium.confidence='medium';
medium.confidenceScore=.72;
const mediumAnalysis=w.sdCategoryEngine.analyze(
  'Хочу утеплить балкон, остекление уже есть и его нужно оставить.',
  {attachmentAnalysis:medium}
);
ok(!mediumAnalysis.params.wallSize,'medium confidence must not silently confirm dimensions');
ok(mediumAnalysis.params.detectedWallSize.includes('314'),'medium confidence must prefill detected wall size');
ok(mediumAnalysis.questions.some(q=>q.type==='sizes'),'medium confidence must ask for confirmation');


const realOcrLike=w.sdAttachmentAnalyzer.analyzeTokens({
  width:1448,height:1086,
  text:'Сторона балкона с окном. Зона для утепления. 314 см 26,5 см 220 см 76 см 180 см 40,5 см 287 см',
  tokens:[
    {text:'314',x:711,y:147,confidence:87},{text:'26,5',x:765,y:252,confidence:96},
    {text:'220',x:899,y:570,confidence:96},{text:'76',x:1120,y:571,confidence:92},
    {text:'180',x:700,y:788,confidence:97},{text:'40,5',x:765,y:905,confidence:97},
    {text:'287',x:123,y:598,confidence:96,pass:'cw'}
  ]
});
ok(realOcrLike.status==='recognized','real OCR-like partial token set must be recognized');
ok(realOcrLike.geometry.openings[0].offsetsCm.left===58,'missing left offset must derive as 314-180-76');
ok(realOcrLike.geometryValidation.horizontal.status==='confirmed','derived horizontal chain must validate');
console.log('ATTACHMENT GEOMETRY REGRESSION: PASS',{
  wall:wall.widthCm+'x'+wall.heightCm,
  opening:opening.widthCm+'x'+opening.heightCm,
  netArea:attachment.calculated.windowWallNetAreaM2,
  clarificationSkipped:true
});
