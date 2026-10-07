const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.join(__dirname,'..');
const edgePath=path.join(root,'supabase/functions/lookup-building-register/index.ts');
const original=fs.readFileSync(edgePath,'utf8');
const {stripTypeScriptTypes}=require('node:module');
const source=stripTypeScriptTypes(original);
new vm.Script(source);
let serve,requests=[];
let titleRows=[],unitRows=[],recapRows=[],secondHoRows=[],forceApiError=false;
const context=vm.createContext({
 console,Response,Request,URL,AbortSignal,Set,Map,JSON,Number,String,Math,Error,
 setTimeout:fn=>{fn();return 0},Deno:{env:{get:()=> 'test-key'},serve:fn=>serve=fn},
 fetch:async url=>{
  const u=new URL(url);requests.push(u);
  if(u.pathname.includes('StanReginCd'))return Response.json({StanReginCd:[{}, {row:[{region_cd:'4148010800',locatadd_nm:'경기도 파주시 야당동'}]}]});
  if(forceApiError)return Response.json({response:{header:{resultCode:'99',resultMsg:'API 오류'}}});
  let rows=u.pathname.endsWith('getBrTitleInfo')?titleRows:u.pathname.endsWith('getBrRecapTitleInfo')?recapRows:u.searchParams.get('hoNm').endsWith('호')?secondHoRows:unitRows;
  const page=Number(u.searchParams.get('pageNo')),size=Number(u.searchParams.get('numOfRows'));
  return Response.json({response:{header:{resultCode:'00'},body:{totalCount:rows.length,items:{item:rows.slice((page-1)*size,page*size)}}}});
 }
});
vm.runInContext(source,context);
const title={mgmBldrgstPk:'title-717',dongNm:'717동',bldNm:'한빛마을7단지',mainPurpsCdNm:'아파트',strctCdNm:'철근콘크리트구조',totArea:16000,archArea:800,platArea:85000,grndFlrCnt:25,ugrndFlrCnt:2,useAprDay:'20120701',indrMechUtcnt:0,oudrMechUtcnt:0,indrAutoUtcnt:100,oudrAutoUtcnt:0};
const exclusive={mgmBldrgstPk:'unit-717-1302',dongNm:'한빛마을7단지 717동',hoNm:'1302호',exposPubuseGbCd:'1',area:84.95,strctCdNm:'철근콘크리트구조',mainPurpsCdNm:'아파트',flrNo:13,flrGbCdNm:'지상'};
const commonAreas=[44.5254,2.872,1.3411,0.6204];
const common=commonAreas.map((area,index)=>({...exclusive,exposPubuseGbCd:'2',area,mainPurpsCdNm:'공용'+index,flrNo:-1}));
const address='경기도 파주시 야당동 1026(야당동 파주운정택지개발지구 A19-1블록)';
const request=()=>serve(new Request('https://example.test/',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({address,dongNm:'717동',hoNm:'1302호',apartment:true})}));
async function tests(){
 // 타 건물·같은 호수 다른 동·중복 API 행을 섞고 표제부는 2페이지에 둔다.
 titleRows=Array.from({length:105},(_,i)=>({...title,mgmBldrgstPk:'other-'+i,dongNm:String(i+1)+'동',mainPurpsCdNm:'제1종근린생활시설',strctCdNm:'일반철골구조'}));
 titleRows.push(title);
 unitRows=[{...exclusive,dongNm:'718동',area:99},exclusive,...common,{...exclusive,rnum:999}];
 recapRows=[{bldNm:title.bldNm,indrMechUtcnt:0,oudrMechUtcnt:0,indrAutoUtcnt:1500,oudrAutoUtcnt:120}];
 const parsed=context.parseAddress(address);assert.equal(parsed.bun,'1026');assert.equal(parsed.dongName,'야당동');assert.equal(parsed.ji,'0');
 assert.equal(context.parseAddress('경기도 파주시 와동동 1471-2, 103동 4802호').bun,'1471');
 assert.equal(context.parseAddress('경기도 파주시 와석순환로 61 (야당동)'),null);
 let response=await request();assert.equal(response.status,200);let data=await response.json();
 assert.equal(data.queried_lot.bun,'1026');assert.equal(data.building_match_verified,true);assert.equal(data.unit_dong_name,'717동');assert.equal(data.unit_ho_name,'1302호');
 assert.equal(data.exclusive_area_m2,84.95);assert.equal(data.common_area_m2,49.3589);assert.equal(data.supply_area_m2,134.3089);assert.equal(data.unit_floor,'13층');
 assert.equal(data.structure,'철근콘크리트구조');assert.equal(data.main_purpose,'아파트');assert.equal(data.total_area_m2,16000);assert.equal(data.floor_info,'지상 25층/지하 2층');
 assert.equal(data.parking_count,1620);assert.equal(data.parking_scope,'단지 전체');assert(requests.some(u=>u.pathname.endsWith('getBrTitleInfo')&&u.searchParams.get('pageNo')==='2'));
 assert(requests.filter(u=>u.pathname.includes('BldRgstHub')).every(u=>u.searchParams.get('bun')==='1026'));
 const previousTitles=titleRows,previousRecaps=recapRows;
 titleRows=[{...title,dongNm:'1001동',mgmBldrgstPk:'1001',grndFlrCnt:9},{...title,dongNm:'1002동',mgmBldrgstPk:'1002',grndFlrCnt:20},{...title,dongNm:'상가',mgmBldrgstPk:'shop',mainPurpsCdNm:'근린생활시설',strctCdNm:'일반철골구조'}];
 recapRows=[{bldNm:'초롱꽃마을10단지',totArea:120000,archArea:9000,platArea:55000,totPkngCnt:1200}];
 const complexRequest=()=>serve(new Request('https://example.test/',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({address,scope:'complex',buildingName:'초롱꽃마을10단지',apartment:true})}));
 response=await complexRequest();assert.equal(response.status,200);data=await response.json();
 assert.equal(data.building_scope,'단지 전체');assert.equal(data.total_area_m2,120000);assert.equal(data.footprint_area_m2,9000);assert.equal(data.land_area_m2,55000);assert.equal(data.parking_count,1200);assert.equal(data.structure,'철근콘크리트구조');assert.equal(data.floor_info,'지상 9~20층/지하 2층');assert.equal(data.exclusive_area_m2,null);
 recapRows=[];response=await complexRequest();assert.equal(response.status,422);
 titleRows=previousTitles;recapRows=previousRecaps;
 // 1302호 서버 표기 차이, 단지 주차 누락과 동일 동의 모호한 전유부.
 secondHoRows=[exclusive,...common];unitRows=[];recapRows=[];response=await request();data=await response.json();assert.equal(data.exclusive_area_m2,84.95);assert.equal(data.parking_count,null);assert(data.parking_warning);
 unitRows=[exclusive,{...exclusive,mgmBldrgstPk:'ambiguous'}];secondHoRows=unitRows;
 response=await request();data=await response.json();assert(data.unit_area_warning);assert.equal(data.area_m2,null);assert.equal(data.exclusive_area_m2,null);
 // 동 미일치 및 API 오류는 엉뚱한 첫 번째 건물을 반환하지 않는다.
 titleRows=[{...title,dongNm:'718동'}];response=await request();assert.equal(response.status,422);assert((await response.json()).error.includes('717동'));
 forceApiError=true;response=await request();assert.equal(response.status,422);forceApiError=false;
 for(const file of ['detail.html','register.html','building-detail.html']){
  const html=fs.readFileSync(path.join(root,file),'utf8');
  for(const match of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g))if(match[1].trim())new vm.Script(match[1]);
 }
 const storage=fs.readFileSync(path.join(root,'assets/js/storage.js'),'utf8');new vm.Script(storage);
 const cleaner=storage.slice(storage.indexOf('function apartmentRemarksOnly('),storage.indexOf('\nfunction fillApartmentListingForm('));
 vm.runInContext(cleaner,context);
 const imported='[엑셀 원본 194행 · 한빛 휴플러스]\n번호: 한빛 휴플러스\n동: 717\n호: 1302\n타입: 84\n가격: 480000000\n소유주: 이름\n비고: 올수리, 확장.';
 assert.equal(context.apartmentRemarksOnly(imported),'올수리, 확장.');
 assert.equal(context.apartmentRemarksOnly('비고: 올수리\n확장'),'올수리\n확장');
 assert.equal(context.apartmentRemarksOnly('직접 쓴 상담내용\n다음 상담'),'직접 쓴 상담내용\n다음 상담');
 const memos=context.apartmentMemoEntries([{id:'a',text:imported,created_at:'2026-10-07'},{id:'b',text:'다음 상담'}],'올수리, 확장.');
 assert.equal(memos.length,1);assert.equal(memos[0].text,'다음 상담');
 const ui=fs.readFileSync(path.join(root,'assets/js/building-register-view.js'),'utf8');new vm.Script(ui);assert(!ui.includes("['호실 용도'"));assert(!ui.includes('info.exclusive_area_m2 ?? info.area_m2'));
 class El {
  constructor(){this.children=[];this.nodes=new Map();this.handlers={};this.style={};this.classList={add(){},remove(){},contains(){return true}};}
  querySelector(key){if(!this.nodes.has(key))this.nodes.set(key,new El());return this.nodes.get(key);}
  append(...values){this.children.push(...values)}appendChild(value){this.append(value)}
  replaceChildren(){this.children=[]}addEventListener(name,fn){this.handlers[name]=fn}focus(){}
 }
 const body=new El(),head=new El(),uiWindow={};
 let uiResult={building_match_verified:true,building_name:'한빛마을7단지',unit_dong_name:'717동',unit_floor:'13층',exclusive_area_m2:84.95,common_area_m2:77.6467,parking_count:1776,parking_scope:'단지 전체',structure:'철근콘크리트구조'};
 vm.runInContext(ui,vm.createContext({window:uiWindow,document:{body,head,createElement:()=>new El(),addEventListener(){}},lookupBuildingRegister:async()=>uiResult,Number,String}));
 uiWindow.openBuildingRegisterInfo(address,'1302','717',{buildingName:'한빛마을7단지',apartment:true});
 const box=body.children[0];await box.querySelector('.br-fetch').handlers.click();
 const cells=box.querySelector('#brDetails tbody').children.flatMap(row=>row.children.map(cell=>cell.textContent));
 assert(cells.includes('717동'));assert(cells.includes('13층'));assert(cells.includes('단지 전체 주차대수'));assert(cells.includes('1,776대'));assert(cells.includes('철근콘크리트구조'));assert(!cells.includes('호실 용도'));
 uiResult={area_m2:199.2};await box.querySelector('.br-fetch').handlers.click();
 assert.equal(box.querySelector('#brResult').hidden,true);assert(box.querySelector('#brError').textContent.includes('일치 여부'));
 const normalize=storage.slice(storage.indexOf('function normalizeApartmentUnit('),storage.indexOf('\nfunction ',storage.indexOf('function normalizeApartmentUnit(')+10));
 const linkage=storage.slice(storage.indexOf('function apartmentUnitLinkedListings('),storage.indexOf('\nfunction setupApartmentListingForm('));
 const linkContext=vm.createContext({Set,Number,String});
 const apartmentSourceCode=storage.slice(storage.indexOf('function apartmentSource('),storage.indexOf('\nconst CHORONG11_RESOURCE_ID'));
 vm.runInContext(normalize+'\n'+apartmentSourceCode+'\n'+linkage,linkContext);
 const unit={동:'717',호:'1302',현_매매가격:48000};
 const listing={id:'listing-one',resource_id:'complex-one',dong:'717동',ho:'1302호',dealType:'매매'};
 const links=linkContext.apartmentUnitLinkedListings(unit,[listing,{...listing,id:'wrong-complex',resource_id:'other'},{...listing,id:'wrong-dong',dong:'718'},listing],'complex-one','한빛마을7단지');
 assert.equal(links.length,1);assert.equal(links[0].id,'listing-one');
 assert.equal(linkContext.apartmentUnitDeal(unit,links),'매매');
 assert.equal(linkContext.apartmentUnitDeal(unit,[]),'매매');
 assert.equal(linkContext.apartmentUnitDeal({...unit,거래구분:'전세'},links),'전세');
 assert.equal(linkContext.apartmentUnitDeal({현_매매가격:0},[]),'');
 let applied=0;
 uiResult={building_match_verified:true,exclusive_area_m2:84.95,unit_dong_name:'717동',unit_ho_name:'1302호'};
 uiWindow.openBuildingRegisterInfo(address,'1302','717',{apartment:true,onApply:()=>{applied++}});
 assert.equal(box.querySelector('.br-apply').hidden,false);
 assert.equal(box.querySelector('.br-apply').disabled,true);
 await box.querySelector('.br-fetch').handlers.click();
 assert.equal(box.querySelector('.br-apply').disabled,false);
 box.querySelector('.br-close').handlers.click();assert.equal(applied,0);
 uiWindow.openBuildingRegisterInfo(address,'1302','717',{apartment:true,onApply:()=>{applied++}});
 await box.querySelector('.br-fetch').handlers.click();
 box.querySelector('#brRoom').value='1303';await box.querySelector('.br-apply').handlers.click();assert.equal(applied,0);
 uiWindow.openBuildingRegisterInfo(address,'1302','717',{apartment:true,onApply:()=>{applied++}});
 await box.querySelector('.br-fetch').handlers.click();await box.querySelector('.br-apply').handlers.click();assert.equal(applied,1);
 uiWindow.openBuildingRegisterInfo(address,'1302','717',{});assert.equal(box.querySelector('.br-apply').hidden,true);
 console.log('PASS: exact building/unit lookup, script syntax, notes, office-scoped listing linkage, sale inference, and explicit query apply/close behavior.');
}
async function live(){
 // 이미 운영 프록시에서 사용하는 공개 anon JWT로 기존 읽기 전용 조회를 검증한다.
 const proxy=fs.readFileSync(path.join(root,'supabase/functions/lookup-building-register/ktop-proxy.ts'),'utf8');
 const key=proxy.match(/const sourceKey = '([^']+)'/)[1];
 const endpoint=proxy.match(/const source = '([^']+)'/)[1]+'/functions/v1/lookup-building-register';
 const response=await fetch(endpoint,{method:'POST',headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify({address,dongNm:'717',hoNm:'1302',apartment:true}),signal:AbortSignal.timeout(100000)});
 const data=await response.json();
 console.log('Live Hanbit lookup:',JSON.stringify({status:response.status,error:data.error,version:data.lookup_version,lot:data.queried_lot,building:data.building_name,dong:data.unit_dong_name,floor:data.unit_floor,exclusive:data.exclusive_area_m2,common:data.common_area_m2,parking:data.parking_count,parking_scope:data.parking_scope,purpose:data.main_purpose,structure:data.structure,total:data.total_area_m2,footprint:data.footprint_area_m2,floors:data.floor_info}));
 assert.equal(response.status,200,data.error);assert.equal(data.lookup_version,'20261007-exact-building');assert.equal(data.queried_lot.bun,'1026');
 assert.equal(data.unit_dong_name,'717동');assert.equal(data.exclusive_area_m2,84.95);assert.equal(data.unit_floor,'13층');assert(data.structure.includes('철근콘크리트'));assert(/아파트|공동주택/.test(data.main_purpose));
 assert(data.common_area_m2>0);assert(data.total_area_m2>199.2);assert(data.footprint_area_m2>199.2);assert.equal(data.parking_scope,'단지 전체');assert(data.parking_count==null||data.parking_count>2);
 console.log('PASS: deployed live Hanbit 717동 1302호 matches the provided building-register document.');
 const complexResponse=await fetch(endpoint,{method:'POST',headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify({address:'경기도 파주시 동패동 2126',scope:'complex',buildingName:'초롱꽃마을10단지',apartment:true}),signal:AbortSignal.timeout(100000)});
 const complex=await complexResponse.json();
 console.log('Live Chorong 10 complex:',JSON.stringify({status:complexResponse.status,error:complex.error,scope:complex.building_scope,building:complex.building_name,lot:complex.queried_lot,total:complex.total_area_m2,footprint:complex.footprint_area_m2,land:complex.land_area_m2,parking:complex.parking_count,structure:complex.structure,floors:complex.floor_info}));
 assert.equal(complexResponse.status,200,complex.error);assert.equal(complex.building_scope,'단지 전체');assert.equal(complex.queried_lot.bun,'2126');assert(complex.total_area_m2>0);assert(complex.parking_count>0);assert.equal(complex.exclusive_area_m2,null);
 console.log('PASS: deployed complex lookup requires no dong/ho and reads recap values.');
}
(async()=>{await tests();if(process.argv.includes('--live'))await live();})().catch(error=>{console.error(error);process.exit(1)});
