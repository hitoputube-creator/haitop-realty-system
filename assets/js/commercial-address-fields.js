(function(root){
 'use strict';
 const base=root.setupQuickBuildingSelect;
 if(typeof base!=='function')return;
 const style=document.createElement('style');
 style.textContent='.commercial-address-parts[hidden]{display:none!important}.commercial-address-field{grid-column:1 / -1!important}.commercial-address-parts{display:grid;grid-template-columns:minmax(0,2fr) minmax(100px,1fr);gap:12px;margin-top:10px}.commercial-address-parts>.field{grid-column:auto!important;margin:0!important;min-width:0}.commercial-address-parts input{width:100%;box-sizing:border-box}.commercial-old-building-picker{display:none!important}';
 style.textContent += ".commercial-address-field{display:grid!important;grid-template-columns:minmax(0,1.1fr) minmax(0,2.6fr) minmax(80px,.7fr);column-gap:12px;row-gap:6px;align-items:start}.commercial-address-field>label{grid-column:2;grid-row:1}.commercial-address-field>div:not(.commercial-address-parts){grid-column:2;grid-row:2;min-width:0}.commercial-address-field>span{grid-column:1 / -1;grid-row:3}.commercial-address-field .commercial-address-parts{display:contents!important}.commercial-address-field .commercial-address-parts>.field{grid-column:auto!important;grid-row:1 / span 2;min-width:0}.commercial-address-field .commercial-address-parts>.field:first-child{grid-column:1!important}.commercial-address-field .commercial-address-parts>.field:last-child{grid-column:3!important}.commercial-address-field input{min-width:0;width:100%;box-sizing:border-box}.commercial-address-field .commercial-address-parts[hidden]{display:none!important}@media(max-width:520px){.commercial-address-field{grid-template-columns:minmax(0,1fr) minmax(0,1.5fr) minmax(56px,.6fr);column-gap:6px}.commercial-address-field input{font-size:12px;padding-left:6px;padding-right:6px}.commercial-address-field button{font-size:0!important;padding:6px!important}.commercial-address-field button::after{content:'조회';font-size:12px}}";
 document.head.appendChild(style);
 root.setupQuickBuildingSelect=function(selectId,publicId,mapId,complexId,cat1Id,cat2Id){
  const original=base.apply(this,arguments);
  const byId=id=>document.getElementById(id),map=byId(mapId),name=byId(complexId),sel=byId(selectId);
  const prefix=mapId.startsWith('edit_')?'edit_':'';
  const room=byId(prefix+'privateDetailAddress');
  if(!map||!name||!room||!sel)return original;
  const addressField=map.closest('.field'),nameField=name.closest('.field'),roomField=room.closest('.field'),pickerField=sel.closest('.field');
  const nameAnchor=document.createComment('building-name-position'),roomAnchor=document.createComment('room-position');
  nameField.before(nameAnchor);roomField.before(roomAnchor);
  const parts=document.createElement('div');parts.className='commercial-address-parts';parts.hidden=true;addressField.appendChild(parts);
  const list=document.createElement('datalist');list.id=mapId+'BuildingOptions';addressField.appendChild(list);
  const defaults={mapPlaceholder:map.placeholder,list:map.getAttribute('list'),mapLabel:addressField.querySelector('label').innerHTML,nameLabel:nameField.querySelector('label').innerHTML,roomLabel:roomField.querySelector('label').innerHTML,roomPlaceholder:room.placeholder};
  let enabled=false;
  // ── 구주소(지번) ⇄ 새주소(도로명): 자료실 건물 개요와 같은 방식(한쪽만 적으면 다른 쪽이 채워진다) ──
  const road=byId(prefix+'roadAddress'),roadField=road?road.closest('.field'):null;
  let convBtn=null,convStatus=null,autoRoad=false,autoMap=false,lastEdited='jibun';
  function loadKakaoServices(){
   if(root.kakao&&root.kakao.maps&&root.kakao.maps.services)return Promise.resolve();
   return new Promise((resolve,reject)=>{
    const key=String(root.HITOP_KAKAO_JS_KEY||'').trim();
    if(!key){reject(new Error('카카오맵 키가 설정되지 않았습니다.'));return;}
    const start=()=>root.kakao.maps.load(resolve);
    if(root.kakao&&root.kakao.maps){start();return;}
    const s=document.createElement('script');s.src='https://dapi.kakao.com/v2/maps/sdk.js?appkey='+encodeURIComponent(key)+'&libraries=services&autoload=false';
    s.onload=start;s.onerror=()=>reject(new Error('카카오맵을 불러오지 못했습니다.'));document.head.appendChild(s);
   });
  }
  function geocodeAddr(q){return loadKakaoServices().then(()=>new Promise((resolve,reject)=>{
   new root.kakao.maps.services.Geocoder().addressSearch(q,(result,status)=>{
    if(status===root.kakao.maps.services.Status.OK)resolve(result||[]);
    else if(status===root.kakao.maps.services.Status.ZERO_RESULT)resolve([]);
    else reject(new Error('주소 검색 중 오류가 났어요. 잠시 후 다시 눌러 주세요.'));
   });
  }));}
  const fullAddr=v=>String(v||'').trim().replace(/^경기\s/,'경기도 ');
  function cleanQuery(text){
   let q=String(text||'').split(/[,，]/)[0].replace(/\s+\d+\s*호.*$/,'').trim();
   if(q&&!/[가-힣]+(시|군|구)(\s|$)/.test(q))q='파주시 '+q;
   return q;
  }
  async function convert(from){
   if(!road||!convStatus)return;
   const query=from==='road'?String(road.value||'').trim():cleanQuery(map.value);
   if(!query){convStatus.textContent='구주소나 새주소 중 한쪽을 먼저 입력해 주세요.';return;}
   convBtn.disabled=true;convStatus.textContent='';
   try{
    const list=await geocodeAddr(query);
    if(!list.length){convStatus.textContent=(from==='road'?'새주소':'구주소')+'로 검색되는 주소가 없어요. 시·동까지 정확히 적어 주세요.';return;}
    let hit=list[0];
    if(list.length>1&&!/[가-힣]+(시|군|구)(\s|$)/.test(query))hit=list.find(r=>/파주/.test(r.address_name))||list[0];
    const target=from==='road'?(hit.address&&hit.address.address_name):(hit.road_address&&hit.road_address.address_name);
    if(!target){convStatus.textContent=from==='road'?'이 새주소에 해당하는 구주소를 찾지 못했어요.':'이 번지에는 아직 새주소(도로명)가 없어요.';return;}
    if(from==='road'){map.value=fullAddr(target);autoMap=true;}else{road.value=fullAddr(target);autoRoad=true;}
    convStatus.textContent=list.length>1?'검색 결과 '+list.length+'건 중 첫 번째 주소예요. 맞는지 확인해 주세요.':'';
   }catch(e){convStatus.textContent=e.message||'주소 변환에 실패했어요.';}
   finally{convBtn.disabled=false;}
  }
  function mountRoad(on){
   if(!road)return;
   if(on){
    if(!convBtn){
     convBtn=document.createElement('button');convBtn.type='button';convBtn.textContent='⇄';
     convBtn.title='구주소 ⇄ 새주소 변환 (한쪽만 적고 누르세요)';convBtn.className='btn btn-ghost';
     convBtn.style.cssText='flex:0 0 auto;padding:0 10px;font-size:.95rem;font-weight:700;white-space:nowrap;';
     convStatus=document.createElement('span');convStatus.className='caf-conv-status';
     convStatus.style.cssText='grid-column:1 / -1;grid-row:4;font-size:.74rem;color:#b45309;';
     convBtn.addEventListener('click',()=>{
      const hasMap=!!String(map.value||'').trim(),hasRoad=!!String(road.value||'').trim();
      convert(hasMap&&hasRoad?(lastEdited==='road'?'road':'jibun'):(hasRoad?'road':'jibun'));
     });
     map.addEventListener('input',()=>{lastEdited='jibun';autoMap=false;});
     road.addEventListener('input',()=>{lastEdited='road';autoRoad=false;});
     map.addEventListener('change',()=>{if(enabled&&String(map.value||'').trim()&&(!String(road.value||'').trim()||autoRoad))convert('jibun');});
     road.addEventListener('change',()=>{if(enabled&&String(road.value||'').trim()&&(!String(map.value||'').trim()||autoMap))convert('road');});
    }
    road.readOnly=false;road.placeholder='새주소 (도로명) 예) 경기도 파주시 ○○로 123';
    road.style.cssText='flex:1;min-width:0;';
    map.style.minWidth='0';
    map.after(convBtn,road);
    if(!convStatus.parentNode)addressField.appendChild(convStatus);
   }else if(convBtn){
    convBtn.remove();convStatus.remove();
    road.readOnly=true;road.style.cssText='';
    if(roadField)roadField.appendChild(road);
   }
  }
  let sources=typeof UNJEONG_QUICK_BUILDINGS!=='undefined'?UNJEONG_QUICK_BUILDINGS.map(b=>({...b,addr:'파주시 '+b.addr})):[];
  const normalize=value=>String(value||'').replace(/경기도|파주시|\s/g,'').toLowerCase();
  const isOfficetel=()=>byId(cat2Id)?.value==='오피스텔';
  function choices(){return sources.filter(b=>!isOfficetel()||b.category==='오피스텔').slice().sort((a,b)=>a.name.localeCompare(b.name,'ko',{numeric:true}));}
  function options(){list.replaceChildren();choices().forEach(b=>{const option=document.createElement('option');option.value=b.addr+' · '+b.name;option.label=b.name;list.appendChild(option);});}
  const keyOf=value=>normalize(value).replace(/\([^)]*\)/g,'').replace(/타워|빌딩|프라자|플라자|상가|오피스텔|단지/g,'');
  function match(value,loose){const rows=choices();const exact=rows.find(b=>value===b.addr+' · '+b.name);if(exact)return exact;const matches=rows.filter(b=>normalize(value)===normalize(b.addr)||normalize(value)===normalize(b.name));if(matches.length===1)return matches[0];
   const key=keyOf(value);if(!key||key.length<2)return null;
   const byKey=rows.filter(b=>keyOf(b.name)===key);if(byKey.length===1)return byKey[0];
   if(loose){const part=rows.filter(b=>{const kb=keyOf(b.name);return kb.length>=2&&(kb.includes(key)||key.includes(kb));});if(part.length===1)return part[0];}
   return null;}
  function resolve(loose){
   if(!enabled)return;
   const building=match(map.value,loose===true);
   if(building){applyBuilding(building,true);return true;}
   return false;
  }
  function applyBuilding(building,fire){map.value=building.addr;name.value=building.name;const pub=byId(publicId);if(pub){const dong=building.addr.match(/([가-힣]+(?:동|읍|면|리))/);pub.value=dong?'파주시 '+dong[1]:pub.value;}if(fire)name.dispatchEvent(new Event('change',{bubbles:true}));}
  function resolveByName(loose){if(!enabled)return false;const building=match(name.value,loose===true);if(building){applyBuilding(building,false);return true;}return false;}
  function render(){
   if(typeof original==='function')original();
   enabled=byId(cat1Id)?.value==='상가사무실'||isOfficetel();
   pickerField.classList.toggle('commercial-old-building-picker',enabled);
   addressField.classList.toggle('commercial-address-field',enabled);
   parts.hidden=!enabled;
   if(enabled){
    parts.appendChild(nameField);parts.appendChild(roomField);
    nameField.style.display='';roomField.style.display='';
    addressField.querySelector('label').textContent='상세주소 (구주소 · 새주소)';
    mountRoad(true);
    nameField.querySelector('label').textContent='건물명';
    roomField.querySelector('label').textContent='호수';
    map.placeholder='주소 또는 건물명을 입력하거나 목록에서 선택';
    room.placeholder='예) 101호';
    map.setAttribute('list',list.id);options();name.setAttribute('list',nameList.id);nameOptions();
   }else{
    nameAnchor.after(nameField);roomAnchor.after(roomField);
    mountRoad(false);
    addressField.querySelector('label').innerHTML=defaults.mapLabel;
    nameField.querySelector('label').innerHTML=defaults.nameLabel;
    roomField.querySelector('label').innerHTML=defaults.roomLabel;
    map.placeholder=defaults.mapPlaceholder;room.placeholder=defaults.roomPlaceholder;
    if(defaults.list)map.setAttribute('list',defaults.list);else map.removeAttribute('list');
    name.removeAttribute('list');
   }
  }
  const nameList=document.createElement('datalist');nameList.id=mapId+'NameOptions';addressField.appendChild(nameList);
  function nameOptions(){nameList.replaceChildren();choices().forEach(b=>{const option=document.createElement('option');option.value=b.name;option.label=b.addr;nameList.appendChild(option);});}
  name.addEventListener('input',()=>resolveByName(false));
  name.addEventListener('change',()=>{if(resolveByName(true))room.focus();});
  name.addEventListener('focus',()=>{if(enabled)nameOptions();});
  map.addEventListener('input',()=>resolve(false));
  map.addEventListener('change',()=>{if(resolve(true))room.focus();});
  map.addEventListener('focus',()=>{if(enabled)options();});
  [cat1Id,cat2Id].forEach(id=>byId(id)?.addEventListener('change',render));
  render();
  if(typeof getDriveResources==='function')getDriveResources().then(rows=>{
   rows.filter(r=>/상가|오피스텔|힐스테이트더운정/.test(r.category||'')).forEach(r=>{
    const line=String(r.memo||'').split(/\r?\n/).find(line=>/^(?:주소|지번주소|소재지)\s*[:：]/.test(line.trim()));
    const addr=line?line.replace(/^[^:：]+[:：]\s*/,'').trim():'';
    if(addr&&r.name&&!sources.some(b=>normalize(b.name)===normalize(r.name)))sources.push({name:r.name,addr,category:/오피스텔|힐스테이트/.test(r.category)?'오피스텔':'상가'});
   });if(enabled){options();nameOptions();}
  }).catch(()=>{});
  return render;
 };
})(window);
