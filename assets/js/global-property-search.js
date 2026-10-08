(function(){
'use strict';
const mount=document.getElementById('globalPropertySearch');
if(!mount)return;
const core=window.HitopGlobalSearchCore;
function el(tag,cls,value){const n=document.createElement(tag);if(cls)n.className=cls;if(value!=null)n.textContent=value;return n;}
const section=el('section','gps');section.hidden=true;section.setAttribute('aria-label','고객·소유주 검색 결과');
const toolbar=document.getElementById('globalPropertySearchToolbar')||mount;
const form=el('form','gps-form'),input=el('input'),submit=el('button','','검색'),clear=el('button','gps-clear','초기화');
input.type='search';input.maxLength=120;input.placeholder='이름·전화번호 전체검색';input.setAttribute('aria-label','고객 또는 소유주 이름·전화번호');input.autocomplete='off';
submit.type='submit';clear.type='button';form.append(input,submit,clear);
const status=el('p','gps-status');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
const summary=el('div','gps-summary'),results=el('div','gps-results'),more=el('button','gps-more','더 보기');more.type='button';more.hidden=true;
toolbar.append(form);section.append(status,summary,results,more);mount.append(section);
let generation=0,matched=[],visible=0,busy=false;
const sources=[['listings','등록 매물','*'],['buildings','세대·점포 자료','*'],['drive_resources','건물 정보','id,name,category,memo'],['land_parcels','필지 자료','*'],['customers','고객 연락처','*'],['drive_resource_categories','자료 분류','id,name,room'],['work_diary','상담·메모','*']];
async function readAll(table,select,token){
 const rows=[],seen=new Set();let offset=0;
 for(;;){
  const params=new URLSearchParams({select,order:'id.asc',limit:'500',offset:String(offset)});
  const response=await fetchWithTimeout(SUPABASE_URL+'/rest/v1/'+table+'?'+params,{headers:{apikey:SUPABASE_KEY,Authorization:'Bearer '+token}},15000);
  if(!response.ok)throw new Error(table+' 조회 실패');
  const batch=await response.json();if(!Array.isArray(batch))throw new Error(table+' 형식 오류');
  if(!batch.length)break;
  let added=0;for(const row of batch){const key=String(row.id);if(!seen.has(key)){seen.add(key);rows.push(row);added++;}}
  if(!added)throw new Error(table+' 페이지 조회 오류');
  offset+=batch.length;
 }
 return rows;
}
function renderRow(e){
 const row=el('article','gps-result'),kind=el('div','gps-kind',e.label),place=el('div','gps-place');
 place.append(el('strong','',e.name));if(e.address)place.append(el('span','gps-muted',e.address));
 const contacts=el('div','gps-contacts');
 e.contacts.forEach(c=>{const line=el('div');line.append(el('span','',c.name||'이름 미등록'));
  if(c.phone){const digits=core.phone(c.phone);if(digits.length>=7){const a=el('a','gps-phone',c.phone);a.href='tel:'+digits;line.append(a);}else line.append(el('span','gps-phone',c.phone));}
  if(c.role&&c.role!=='소유주')line.append(el('small','gps-muted',c.role));
  contacts.append(line);
 });
 const info=el('div','gps-info');info.append(el('span','',e.source),el('span',e.listingId?'gps-listed':'gps-muted',e.group==='고객'||e.group==='상담·메모'?e.status:e.listingId?'매물 등록 · '+e.status:'자료 · '+e.status));
 const actions=el('div','gps-actions'),seen=new Set();e.links.forEach(l=>{if(seen.has(l.href))return;seen.add(l.href);const a=el('a','',l.label);a.href=l.href;actions.append(a);});
 if(e.content){const content=el('p','gps-muted',e.content);content.style.whiteSpace='pre-wrap';content.style.gridColumn='1/-1';row.append(kind,place,contacts,info,content,actions);}else row.append(kind,place,contacts,info,actions);return row;
}
function showMore(){
 const end=Math.min(visible+50,matched.length);for(let i=visible;i<end;i++)results.append(renderRow(matched[i]));visible=end;
 more.hidden=visible>=matched.length;more.textContent='더 보기 ('+visible+' / '+matched.length+'건)';
}
function reset(){
 generation++;busy=false;submit.disabled=false;input.value='';status.textContent='';summary.replaceChildren();results.replaceChildren();matched=[];visible=0;more.hidden=true;section.hidden=true;input.focus();
}
clear.addEventListener('click',reset);more.addEventListener('click',showMore);
form.addEventListener('submit',async event=>{
 event.preventDefault();if(busy)return;section.hidden=false;
 const query=input.value.trim();if(!query){status.textContent='이름 또는 전화번호를 입력해 주세요.';input.focus();return;}
 if(/^[+\d().\s-]+$/.test(query)&&core.phone(query).length<4){status.textContent='전화번호는 4자리 이상 입력해 주세요.';return;}
 const mine=++generation;busy=true;submit.disabled=true;status.textContent='전체 자료를 검색하고 있습니다…';summary.replaceChildren();results.replaceChildren();more.hidden=true;
 try{
  const auth=await hitopAuthClient.auth.getSession();if(auth.error||!auth.data?.session?.access_token)throw new Error('SESSION');
  const settled=await Promise.allSettled(sources.map(s=>readAll(s[0],s[2],auth.data.session.access_token)));
  if(mine!==generation)return;
  const data={},failed=[],keys=['listings','buildings','resources','parcels','customers','categories','diary'];
  settled.forEach((r,i)=>{if(r.status==='fulfilled')data[keys[i]]=r.value;else{data[keys[i]]=[];failed.push(sources[i][1]);}});
  if(settled.every(r=>r.status==='rejected'))throw new Error('ALL_FAILED');
  matched=core.search(core.build(data),data.customers,query);visible=0;
  summary.append(el('strong','','검색 결과 '+matched.length+'건'));
  const counts=new Map();matched.forEach(e=>counts.set(e.group,(counts.get(e.group)||0)+1));
  counts.forEach((count,group)=>summary.append(el('span','',group+' '+count+'건')));
  status.textContent=(failed.length?'조회하지 못한 자료: '+failed.join(', ')+'. 결과가 일부일 수 있습니다. 다시 검색해 주세요.':matched.length?'':'검색 결과가 없습니다.');
  showMore();
 }catch(error){
  if(mine!==generation)return;
  status.textContent=error.message==='SESSION'?'로그인 상태를 확인할 수 없습니다. 다시 로그인한 뒤 검색해 주세요.':'자료를 조회하지 못했습니다. 잠시 후 다시 검색해 주세요.';
 }finally{if(mine===generation){busy=false;submit.disabled=false;}}
});
})();