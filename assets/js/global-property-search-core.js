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
function uniqueContacts(rows){const seen=new Set();return rows.filter(c=>{const k=compact(c.name)+'|'+phone(c.phone);if(seen.has(k))return false;seen.add(k);return true;});}
function listingKind(l){
 const typeLabels={apartment:'아파트',officetel:'오피스텔',hilsstate:'주거',shop:'상가',office:'사무실',land_single:'토지',land:'토지',factory:'공장',warehouse:'창고',bizcenter:'지식산업센터'};
 const label=text(l.category2)||typeLabels[l.type]||'기타';
 const major=text(l.category1);
 const group=/토지|택지/.test(major+label)||/^land/.test(l.type||'')?'토지':/주거|아파트|오피스텔|주택/.test(major+label)||['apartment','officetel','hilsstate'].includes(l.type)?'주거':/공장|창고/.test(major+label)?'공장·창고':/상가|사무실|지식산업/.test(major+label)?'상가·사무실':'기타';
 return {label,group};
}
function merge(a,b){a.contacts=uniqueContacts([...a.contacts,...b.contacts]);a.links.push(...b.links);a.source='매물·'+b.source;if(!a.address)a.address=b.address;if(!a.name)a.name=b.name;}
function build(data){
 const customers=data.customers||[],customerMap=new Map(customers.map(c=>[String(c.id),c]));
 const attachCustomer=(o,c)=>{const id=o.customer_id||o.customerId;const customer=customerMap.get(String(id));return customer?uniqueContacts([...c,{name:text(customer.name),phone:text(customer.phone||customer.phone_normalized),role:'연결 고객'}]):c;};
 const entries=[],byListing=new Map(),resources=data.resources||[],rooms=new Map((data.categories||[]).map(c=>[c.name,c.room]));
 for(const raw of data.listings||[]){
  const l={...raw,...(raw.data&&typeof raw.data==='object'?raw.data:{}),id:raw.id},kind=listingKind(l);
  const e={key:'listing:'+l.id,...kind,name:text(l.title)||'등록 매물',address:text(l.address||l.publicAddress||l.mapAddress),contacts:attachCustomer(l,contactsOf(l)),listingId:l.id,source:'등록 매물',status:text(l.status)||'등록',links:[{label:'매물보기',href:'detail.html?id='+encodeURIComponent(l.id)}]};
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
   const e={key:'unit:'+b.id+':'+i,label:residential?(/오피스텔/.test(category)?'오피스텔':'아파트'):'상가·점포',group:residential?'주거':'상가·사무실',name:[text(r?.name||b.name||b.local_id),text(u.호수)].filter(Boolean).join(' '),address,contacts:attachCustomer(u,contactsOf(u)),listingId:null,source:residential?'세대자료':'점포자료',status:text(u.세입자현황||u.공실여부)||'자료등록',links:[{label:'자료보기',href:r?'building-detail.html?id='+encodeURIComponent(r.id)+'&resourceScope='+scope+'#unitStatus':'building-overview.html'}]};
   const linked=byListing.get(String(u.listing_id||''));if(linked)merge(linked,e);else entries.push(e);
  });
 }
 for(const p of data.parcels||[]){
  const d=p.data&&typeof p.data==='object'?p.data:{},id=text(p.block_id),block=id.split('-').pop();
  const district=id.startsWith('third-')?'운정3지구':id.startsWith('second-')?'운정1·2지구':'';
  const params=new URLSearchParams({block:id,subblock:text(p.subblock),parcel:text(p.parcel)});
  const e={key:'parcel:'+p.id,label:'토지·택지',group:'토지',name:[district,[block,text(p.subblock),text(p.parcel)].filter(Boolean).join('-')].filter(Boolean).join(' '),address:text(d.address),contacts:attachCustomer(d,contactsOf(d)),listingId:null,source:'필지자료',status:'자료등록',links:[{label:'필지보기',href:'land-location.html?'+params}]};
  const linked=byListing.get(String(d.listing_id||''));if(linked)merge(linked,e);else entries.push(e);
 }
 return entries;
}
function search(entries,customers,query){
 const raw=text(query),tokens=(/^[+\d().\s-]+$/.test(raw)?[raw]:raw.split(/\s+/)).filter(Boolean).map(t=>({name:compact(t),digits:/^[+\d().\s-]+$/.test(t)?phone(t):''}));
 if(!tokens.length)return [];
 const matchContact=(c,t)=>t.digits?phone(c.phone).includes(t.digits):compact(c.name).includes(t.name);
 const matchedCustomers=(customers||[]).filter(c=>tokens.every(t=>matchContact({name:c.name,phone:c.phone||c.phone_normalized},t)));
 const aliasPhones=new Set(matchedCustomers.map(c=>phone(c.phone||c.phone_normalized)).filter(p=>p.length>=7));
 return entries.filter(e=>tokens.every(t=>e.contacts.some(c=>matchContact(c,t)))||e.contacts.some(c=>aliasPhones.has(phone(c.phone)))).sort((a,b)=>a.group.localeCompare(b.group,'ko')||a.name.localeCompare(b.name,'ko',{numeric:true}));
}
root.HitopGlobalSearchCore={phone,contactsOf,build,search};
})(typeof window==='undefined'?globalThis:window);
