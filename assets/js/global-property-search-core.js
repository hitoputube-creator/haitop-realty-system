(function(root) {
'use strict';
const text=v=>v==null?'':String(v).trim();
const compact=v=>text(v).normalize('NFKC').toLocaleLowerCase('ko-KR').replace(/\s+/g,'');
function phone(v){let d=text(v).replace(/\D/g,'');if(d.startsWith('0082'))d='0'+d.slice(4);else if(d.startsWith('82')&&d.length>=10)d='0'+d.slice(2);return d;}
function contactsOf(o){
 const out=[],add=(name,num,role)=>{name=text(name);num=text(num);if(name||num)out.push({name,phone:num,role:role||'소유주'});};
 const name=o.owner_name||o.quick_owner||o.소유주||o.owner||o.customerName||'';
 [o.owner_phone1,o.owner_phone2,o.연락처,o.owner_contact,o.quick_contact,o.contact,o.customerPhone].filter(Boolean).forEach(num=>add(name,num));
 if(name&&!out.length)add(name,'');
 if(Array.isArray(o.additional_contacts))o.additional_contacts.forEach(c=>add(c.name,c.phone,'추가 연락처'));
 return out;
}
function customerContacts(c) {
 const rows=[{name:text(c.name),phone:text(c.phone||c.phone_normalized),role:'고객'}];
 (c.contact_phones||[]).forEach(p=>rows.push({name:text(c.name),phone:text(p),role:'고객'}));
 (c.additional_contacts||[]).forEach(p=>rows.push({name:text(p.name||c.name),phone:text(p.phone),role:text(p.relation)||'추가 연락처'}));
 return uniqueContacts(rows);
}
function customerIds(o){return [...new Set([o.customer_id,o.customerId,...(o.owner_customer_ids||[]),...(o.apartmentUnitData?.owner_customer_ids||[])].filter(Boolean).map(String))];}
function progressStatus(o){return o.status==='거래완료'?'거래완료':o.status==='보류'?'보류':'진행중';}
function uniqueContacts(rows){const seen=new Set();return rows.filter(c=>{const k=compact(c.name)+'|'+phone(c.phone);if(seen.has(k))return false;seen.add(k);return true;});}
function listingKind(l){
 const typeLabels={apartment:'아파트',officetel:'오피스텔',hilsstate:'주거',shop:'상가',office:'사무실',land_single:'토지',land:'토지',factory:'공장',warehouse:'창고',bizcenter:'지식산업센터'};
 const label=text(l.category2)||typeLabels[l.type]||'기타';
 const major=text(l.category1);
 const group=/토지|택지/.test(major+label)||/^land/.test(l.type||'')?'토지':/주거|아파트|오피스텔|주택/.test(major+label)||['apartment','officetel','hilsstate'].includes(l.type)?'주거':/공장|창고/.test(major+label)?'공장·창고':/상가|사무실|지식산업/.test(major+label)?'상가·사무실':'기타';
 return {label,group};
}
function merge(a,b){a.contacts=uniqueContacts([...a.contacts,...b.contacts]);a.links.push(...b.links);a.customerIds=[...new Set([...(a.customerIds||[]),...(b.customerIds||[])])];a.source='매물·'+b.source;if(!a.address)a.address=b.address;if(!a.name)a.name=b.name;}
function build(data){
 const customers=data.customers||[],customerMap=new Map(customers.map(c=>[String(c.id),c]));
 const attachCustomer=(o,c)=>uniqueContacts([...c,...customerIds(o).flatMap(id=>{const customer=customerMap.get(id);return customer?customerContacts(customer):[];})]);
 const entries=[],byListing=new Map(),resources=data.resources||[],rooms=new Map((data.categories||[]).map(c=>[c.name,c.room]));
 for(const raw of data.listings||[]){
  const l={...raw,...(raw.data&&typeof raw.data==='object'?raw.data:{}),id:raw.id},kind=listingKind(l);
  const e={key:'listing:'+l.id,...kind,name:text(l.title)||'등록 매물',address:text(l.address||l.publicAddress||l.mapAddress),customerIds:customerIds(l),contacts:attachCustomer(l,uniqueContacts([...contactsOf(l),...contactsOf(l.apartmentUnitData||{})])),listingId:l.id,source:'등록 매물',status:progressStatus(raw),links:[{label:'매물보기',href:'detail.html?id='+encodeURIComponent(l.id)}]};
  entries.push(e);byListing.set(String(l.id),e);
 }
 for(const b of data.buildings||[]){
  const named=resources.filter(r=>r.name===b.name||r.name===b.local_id);
  const r=resources.find(r=>r.id===b.local_id)||(named.length===1?named[0]:null);
  const category=text(r?.category),room=rooms.get(category)||(/아파트|오피스텔|주거|힐스테이트/.test(category)?'residential':'commercial');
  const addressLine=text(r?.memo).split('\n').find(line=>/^주소\s*:/.test(line));
  const address=addressLine?addressLine.replace(/^주소\s*:/,'').trim():'';
  (Array.isArray(b.units)?b.units:[]).forEach((u,i)=>{
   const residential=room==='residential'||Boolean(u.아파트명),scope=residential?'residential':'commercial';
   const e={key:'unit:'+b.id+':'+i,label:residential?(/오피스텔/.test(category)?'오피스텔':'아파트'):'상가·점포',group:residential?'주거':'상가·사무실',name:[text(r?.name||b.name||b.local_id),text(u.호수)].filter(Boolean).join(' '),address,customerIds:customerIds(u),contacts:attachCustomer(u,contactsOf(u)),listingId:null,source:residential?'세대자료':'점포자료',status:text(u.세입자현황||u.공실여부)||'자료등록',links:[{label:'자료보기',href:r?'building-detail.html?id='+encodeURIComponent(r.id)+'&resourceScope='+scope+'#unitStatus':'building-overview.html'}]};
   const linked=byListing.get(String(u.listing_id||''));if(linked)merge(linked,e);else entries.push(e);
  });
 }
 for(const p of data.parcels||[]){
  const d=p.data&&typeof p.data==='object'?p.data:{},id=text(p.block_id),block=id.split('-').pop();
  const district=id.startsWith('third-')?'운정3지구':id.startsWith('second-')?'운정1·2지구':'';
  const params=new URLSearchParams({block:id,subblock:text(p.subblock),parcel:text(p.parcel)});
  const e={key:'parcel:'+p.id,label:'토지·택지',group:'토지',name:[district,[block,text(p.subblock),text(p.parcel)].filter(Boolean).join('-')].filter(Boolean).join(' '),address:text(d.address),customerIds:customerIds(d),contacts:attachCustomer(d,contactsOf(d)),listingId:null,source:'필지자료',status:'자료등록',links:[{label:'필지보기',href:'land-location.html?'+params}]};
  const linked=byListing.get(String(d.listing_id||''));if(linked)merge(linked,e);else entries.push(e);
 }
 for(const customer of customers.filter(c=>!String(c.status||'').startsWith('종료')))entries.push({key:'customer:'+customer.id,label:'고객',group:'고객',name:text(customer.name)||'이름 미등록',address:text(customer.desired_region),customerIds:[String(customer.id)],customerId:customer.id,contacts:customerContacts(customer),listingId:null,source:'고객관리',status:(customer.customer_types||[]).join(' · ')||'미분류',links:[{label:'고객·매물·상담보기',href:'customers.html?customerId='+encodeURIComponent(customer.id)}]});
 for(const diary of data.diary||[]){
  if(diary.link_key==='__daily_schedule__')continue;
  const linked=byListing.get(String(diary.listing_id||''));
  const ids=[...new Set([...customerIds(diary),...(linked?.customerIds||[])])];
  const contacts=uniqueContacts([...attachCustomer(diary,[{name:text(diary.customer_name||diary.customerName),phone:text(diary.customer_phone||diary.customerPhone),role:'상담 고객'}]),...(linked?.contacts||[])]);
  const links=ids.map(id=>({label:'고객 상담목록',href:'customers.html?customerId='+encodeURIComponent(id)}));
  if(diary.listing_id)links.push({label:'상담 매물보기',href:'detail.html?id='+encodeURIComponent(diary.listing_id)});
  const diaryBase=typeof OFFICE_DIARY_URL==='string'?OFFICE_DIARY_URL:'https://haitop-realestate-diary.vercel.app/';
  links.push({label:'업무일지 보기',href:diaryBase+(diaryBase.includes('?')?'&':'?')+'diaryId='+encodeURIComponent(diary.id)});
  entries.push({key:'diary:'+diary.id,label:'상담·메모',group:'상담·메모',name:text(diary.title)||'상담·메모',address:linked?.name||'',customerIds:ids,customerId:diary.customer_id,contacts,listingId:diary.listing_id||null,source:'업무일지',status:text(diary.date),content:text(diary.content),date:diary.date,diary,links});
 }
 return entries;
}
function search(entries,customers,query){
 const raw=text(query),tokens=(/^[+\d().\s-]+$/.test(raw)?[raw]:raw.split(/\s+/)).filter(Boolean).map(t=>({name:compact(t),digits:/^[+\d().\s-]+$/.test(t)?phone(t):''}));
 if(!tokens.length)return [];
 const matchContact=(c,t)=>t.digits?phone(c.phone).includes(t.digits):compact(c.name).includes(t.name);
 const matchedCustomers=(customers||[]).filter(c=>tokens.every(t=>customerContacts(c).some(contact=>matchContact(contact,t))));
 const aliasPhones=new Set(matchedCustomers.flatMap(c=>customerContacts(c).map(contact=>phone(contact.phone))).filter(p=>p.length>=7));
 const matchedIds=new Set(matchedCustomers.map(c=>String(c.id)));
 return entries.filter(e=>(e.customerIds||[]).some(id=>matchedIds.has(String(id)))||tokens.every(t=>e.contacts.some(c=>matchContact(c,t)))||e.contacts.some(c=>aliasPhones.has(phone(c.phone)))).sort((a,b)=>a.group.localeCompare(b.group,'ko')||a.name.localeCompare(b.name,'ko',{numeric:true}));
}
root.HitopGlobalSearchCore={phone,contactsOf,customerContacts,customerIds,build,search,progressStatus};
})(typeof window==='undefined'?globalThis:window);
