(function(root){
 'use strict';
 function formatPhone(value){const n=String(value||'').replace(/\D/g,'').slice(0,11);if(n.startsWith('02')){if(n.length<=2)return n;if(n.length<=5)return n.slice(0,2)+'-'+n.slice(2);const split=n.length===10?6:5;return n.slice(0,2)+'-'+n.slice(2,split)+'-'+n.slice(split);}if(/^(15|16|18)\d{2}/.test(n)&&n.length<=8)return n.length===4?n:n.slice(0,4)+'-'+n.slice(4);if(n.length<=3)return n;if(n.length<=6)return n.slice(0,3)+'-'+n.slice(3);if(/^(15|16|18)\d{2}/.test(n)&&n.length<=8)return n.slice(0,4)+'-'+n.slice(4);const split=n.length===11?7:6;return n.slice(0,3)+'-'+n.slice(3,split)+'-'+n.slice(split);}
 root.BuildingSalesContactCore={formatPhone};
 if(typeof document==='undefined')return;
 const IS_HITOP=OfficeConfig.id==='hitop',OWN=IS_HITOP?'하이탑':'케이탑',OTHER=IS_HITOP?'케이탑':'하이탑';
 const ownerPhone=document.getElementById('u_연락처');if(IS_HITOP&&ownerPhone){ownerPhone.type='tel';ownerPhone.addEventListener('input',()=>{ownerPhone.value=formatPhone(ownerPhone.value);});}
 const grid=document.getElementById('infoGrid'),table=document.getElementById('infoTable');if(!grid&&!table)return;
 const formGrid=/building-overview/.test(location.pathname)&&document.querySelector('#editFormCard .form-grid');
 let expected={name:'',phone:''},resource,isK=false,other={state:'loading',name:'',phone:''};
 const inputs={},rows={};
 function makeFields(prefix,label){
  for(const [part,type,max] of [['name','text',100],['phone','tel',50]]){
   const id=prefix+part,field=document.createElement('div'),lab=document.createElement('label'),input=document.createElement('input');
   field.className='field';lab.textContent=label+' 분양담당자 '+(part==='name'?'이름':'연락처');lab.htmlFor=id;
   input.id=id;input.type=type;input.maxLength=max;input.autocomplete='off';input.placeholder=type==='tel'?'010-0000-0000':'분양담당자 이름';
   const entry=inputs[id]={input,field,lab,baseline:'',dirty:false};
   input.addEventListener('input',()=>{entry.dirty=true;});
   if(type==='tel'){input.inputMode='tel';input.addEventListener('input',()=>{const caret=input.selectionStart,old=input.value,digits=old.slice(0,caret??old.length).replace(/\D/g,'').length;input.value=formatPhone(old);let pos=0,count=0;while(pos<input.value.length&&count<digits){if(/\d/.test(input.value[pos]))count++;pos++;}try{input.setSelectionRange(pos,pos);}catch{}});}
   field.append(lab,input);formGrid.appendChild(field);
  }
 }
 if(formGrid){makeFields('ov_sales_agent_',OWN);if(IS_HITOP)makeFields('ov_shared_sales_agent_',OTHER);}
 // Hydrate late responses only into untouched fields. Keep the actual input nodes in place.
 function fill(prefix,contact,reset){for(const part of ['name','phone']){const entry=inputs[prefix+part];if(!entry)continue;const value=part==='phone'?formatPhone(contact[part]):String(contact[part]||'');if(reset||(!entry.dirty&&entry.input.value===entry.baseline)){entry.input.value=value;entry.dirty=false;}entry.baseline=value;}}
 function populateContacts(){fill('ov_sales_agent_',expected,true);if(IS_HITOP&&!isK)fill('ov_shared_sales_agent_',other,true);}
 function editorIds(label){
  if(!formGrid)return null;
  if(label===(isK?'케이탑':OWN)+' 분양담당자')return ['ov_sales_agent_name','ov_sales_agent_phone'];
  if(IS_HITOP&&!isK&&label===OTHER+' 분양담당자 (공유)')return ['ov_shared_sales_agent_name','ov_shared_sales_agent_phone'];
  return null;
 }
 function draw(){
  if(!resource)return;
  const line=(n,p)=>n||p?[n,formatPhone(p)].filter(Boolean).join(' · '):'';
  const mine={key:'own',label:(isK?'케이탑':OWN)+' 분양담당자',value:line(expected.name,expected.phone)};
  const theirs={key:'shared',label:OTHER+' 분양담당자 (공유)',value:other.state==='ok'?line(other.name,other.phone):other.state==='loading'?'불러오는 중…':'불러오지 못함'};
  for(const item of (isK?[mine]:(IS_HITOP?[mine,theirs]:[theirs,mine]))){
   let row=rows[item.key];
   if(!row||row.container.parentNode!==(grid||table)){
    const lab=document.createElement('div'),val=document.createElement('div');
    lab.className=grid?'info-cell-label':'info-table-label';val.className=grid?'info-cell-value':'info-table-value';
    if(grid){const cell=document.createElement('div');cell.className='info-cell';cell.dataset.salesContact='';cell.append(lab,val);grid.appendChild(cell);row={lab,val,container:cell};}
    else{lab.dataset.salesContact='';val.dataset.salesContact='';table.append(lab,val);row={lab,val,container:lab};}
    rows[item.key]=row;
   }
   row.lab.textContent=item.label;
   // Never replace a cell containing a moved editor, including its listeners and selection.
   if(!row.val.querySelector('input,select,textarea')){row.val.textContent=item.value||'—';row.val.classList.toggle('empty',!item.value);}
  }
  if(root.OverviewInlineEdit)root.OverviewInlineEdit.refresh();
 }
 if(typeof renderInfoGrid==='function'){const original=renderInfoGrid;renderInfoGrid=function(...args){original(...args);draw();};}
 if(typeof renderReadOnlyViews==='function'){const original=renderReadOnlyViews;renderReadOnlyViews=function(...args){original(...args);draw();};}
 if(formGrid&&typeof populateForm==='function'){const original=populateForm;populateForm=function(...args){original(...args);populateContacts();};}
 function read(prefix){return {name:inputs[prefix+'name'].input.value.trim(),phone:formatPhone(inputs[prefix+'phone'].input.value)};}
 const same=(a,b)=>a.name===b.name&&formatPhone(a.phone)===formatPhone(b.phone);
 async function saveKtop(contact){if(!IS_HITOP||!root.KtopShared||typeof root.KtopShared.saveContact!=='function')throw new Error('케이탑 담당자 저장 기능을 불러오지 못했습니다. 새로고침해주세요.');await root.KtopShared.saveContact(resource.name,contact);}
 const api=root.BuildingSalesContact={ready:null,editorIds,async save(){
  // Detail pages have no contact form and must never try to save.
  if(!formGrid)return;
  await api.ready;if(!resource)throw new Error('담당자 정보를 불러오지 못했습니다. 새로고침해주세요.');
  const contact=read('ov_sales_agent_');
  if(!same(contact,expected)){
   if(isK){if(other.state!=='ok')throw new Error('케이탑 담당자를 불러오지 못했습니다. 새로고침해주세요.');await saveKtop(contact);expected={...contact};}
   else{const {data,error}=await hitopAuthClient.rpc('save_building_sales_contact',{p_resource_id:resource.id,p_name:resource.name,p_contact:contact,p_expected:expected});if(error)throw error;expected=data;}
   fill('ov_sales_agent_',expected,false);draw();
  }
  if(IS_HITOP&&!isK){
   const shared=read('ov_shared_sales_agent_');
   if(other.state!=='ok'){if(shared.name||shared.phone)throw new Error('케이탑 담당자를 불러오지 못했습니다. 새로고침해주세요.');return;}
   if(!same(shared,other)){await saveKtop(shared);other={state:'ok',...shared};fill('ov_shared_sales_agent_',other,false);draw();}
  }
 }};
 const HITOP_FN='https://xaxbkdnrzsghsabkdvzj.supabase.co/functions/v1/shared-reference-data?table=building_sales_contacts',KTOP_FN='https://enefadyhmhfphtochlku.supabase.co/functions/v1/shared-office-contacts';
 const HITOP_KEY='sb_publishable_gqNFRMHb6yYKvqFnQurPKQ_7gGhURVd',KTOP_KEY='sb_publishable__8Ru0l0wfQo8e5Ljq1ZQ7Q_LYtCAP-p';
 async function loadOther(name){
  try{const {data}=await hitopAuthClient.auth.getSession();const token=data&&data.session&&data.session.access_token;if(!token)throw new Error('no session');const res=await fetch(IS_HITOP?KTOP_FN:HITOP_FN,{headers:{apikey:IS_HITOP?KTOP_KEY:HITOP_KEY,Authorization:'Bearer '+token},signal:AbortSignal.timeout(15000)});if(!res.ok)throw new Error('http '+res.status);const values=await res.json();if(!Array.isArray(values))throw new Error('bad response');const r=values.find(x=>x.local_id===name||x.name===name);other={state:'ok',name:r&&r.sales_agent_name||'',phone:formatPhone(r&&r.sales_agent_phone||'')};}
  catch(e){console.warn('[분양담당자] '+OTHER+' 담당자 조회 실패',e);other={state:'error',name:'',phone:''};}
  if(isK){if(other.state==='ok'){expected={name:other.name,phone:other.phone};fill('ov_sales_agent_',expected,false);}}
  else if(IS_HITOP&&other.state==='ok')fill('ov_shared_sales_agent_',other,false);
  draw();
 }
 api.ready=(async()=>{
  if(!await root.hitopAuthReady)return;
  resource=(await getDriveResources()).find(r=>r.id===new URLSearchParams(location.search).get('id'));if(!resource)throw new Error('건물 자료를 찾을 수 없습니다.');
  isK=IS_HITOP&&resource._office==='ktop';
  if(formGrid&&isK){for(const part of ['name','phone']){inputs['ov_sales_agent_'+part].lab.textContent='케이탑 분양담당자 '+(part==='name'?'이름':'연락처');inputs['ov_shared_sales_agent_'+part].field.style.display='none';}}
  if(!isK){const rec=await getBuildingRecord(resource.name);expected={name:rec?.sales_agent_name||'',phone:rec?.sales_agent_phone||''};fill('ov_sales_agent_',expected,false);}
  draw();await loadOther(resource.name);
 })();
 api.ready.catch(e=>{resource=null;if(typeof showToast==='function')showToast('분양담당자 조회 실패: '+e.message,7000);});
})(typeof window==='undefined'?globalThis:window);
