(function(root){
 'use strict';
 const base=root.setupQuickBuildingSelect;
 if(typeof base!=='function')return;
 const style=document.createElement('style');
 style.textContent='.commercial-address-parts[hidden]{display:none!important}.commercial-address-field{grid-column:1 / -1!important}.commercial-address-parts{display:grid;grid-template-columns:minmax(0,2fr) minmax(100px,1fr);gap:12px;margin-top:10px}.commercial-address-parts>.field{grid-column:auto!important;margin:0!important;min-width:0}.commercial-address-parts input{width:100%;box-sizing:border-box}.commercial-old-building-picker{display:none!important}';
 style.textContent += ".commercial-address-field{display:grid!important;grid-template-columns:minmax(0,2.4fr) minmax(0,1.2fr) minmax(80px,.7fr);column-gap:12px;row-gap:6px;align-items:start}.commercial-address-field>label{grid-column:1;grid-row:1}.commercial-address-field>div:not(.commercial-address-parts){grid-column:1;grid-row:2;min-width:0}.commercial-address-field>span{grid-column:1 / -1;grid-row:3}.commercial-address-field .commercial-address-parts{display:contents!important}.commercial-address-field .commercial-address-parts>.field{grid-column:auto!important;grid-row:1 / span 2;min-width:0}.commercial-address-field .commercial-address-parts>.field:first-child{grid-column:2!important}.commercial-address-field .commercial-address-parts>.field:last-child{grid-column:3!important}.commercial-address-field input{min-width:0;width:100%;box-sizing:border-box}.commercial-address-field .commercial-address-parts[hidden]{display:none!important}@media(max-width:520px){.commercial-address-field{grid-template-columns:minmax(0,1.5fr) minmax(0,1fr) minmax(56px,.6fr);column-gap:6px}.commercial-address-field input{font-size:12px;padding-left:6px;padding-right:6px}.commercial-address-field button{font-size:0!important;padding:6px!important}.commercial-address-field button::after{content:'조회';font-size:12px}}";
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
  let sources=typeof UNJEONG_QUICK_BUILDINGS!=='undefined'?UNJEONG_QUICK_BUILDINGS.map(b=>({...b,addr:'파주시 '+b.addr})):[];
  const normalize=value=>String(value||'').replace(/경기도|파주시|\s/g,'').toLowerCase();
  const isOfficetel=()=>byId(cat2Id)?.value==='오피스텔';
  function choices(){return sources.filter(b=>!isOfficetel()||b.category==='오피스텔').slice().sort((a,b)=>a.name.localeCompare(b.name,'ko',{numeric:true}));}
  function options(){list.replaceChildren();choices().forEach(b=>{const option=document.createElement('option');option.value=b.addr+' · '+b.name;option.label=b.name;list.appendChild(option);});}
  function match(value){const rows=choices();const exact=rows.find(b=>value===b.addr+' · '+b.name);if(exact)return exact;const matches=rows.filter(b=>normalize(value)===normalize(b.addr)||normalize(value)===normalize(b.name));return matches.length===1?matches[0]:null;}
  function resolve(){
   if(!enabled)return;
   const building=match(map.value);
   if(building){map.value=building.addr;name.value=building.name;const pub=byId(publicId);if(pub){const dong=building.addr.match(/([가-힣]+(?:동|읍|면|리))/);pub.value=dong?'파주시 '+dong[1]:pub.value;}name.dispatchEvent(new Event('change',{bubbles:true}));return true;}
   return false;
  }
  function render(){
   if(typeof original==='function')original();
   enabled=byId(cat1Id)?.value==='상가사무실'||isOfficetel();
   pickerField.classList.toggle('commercial-old-building-picker',enabled);
   addressField.classList.toggle('commercial-address-field',enabled);
   parts.hidden=!enabled;
   if(enabled){
    parts.appendChild(nameField);parts.appendChild(roomField);
    nameField.style.display='';roomField.style.display='';
    addressField.querySelector('label').textContent='상세주소';
    nameField.querySelector('label').textContent='건물명';
    roomField.querySelector('label').textContent='호수';
    map.placeholder='주소 또는 건물명을 입력하거나 목록에서 선택';
    room.placeholder='예) 101호';
    map.setAttribute('list',list.id);options();
   }else{
    nameAnchor.after(nameField);roomAnchor.after(roomField);
    addressField.querySelector('label').innerHTML=defaults.mapLabel;
    nameField.querySelector('label').innerHTML=defaults.nameLabel;
    roomField.querySelector('label').innerHTML=defaults.roomLabel;
    map.placeholder=defaults.mapPlaceholder;room.placeholder=defaults.roomPlaceholder;
    if(defaults.list)map.setAttribute('list',defaults.list);else map.removeAttribute('list');
   }
  }
  map.addEventListener('input',resolve);
  map.addEventListener('change',()=>{if(resolve())room.focus();});
  map.addEventListener('focus',()=>{if(enabled)options();});
  [cat1Id,cat2Id].forEach(id=>byId(id)?.addEventListener('change',render));
  render();
  if(typeof getDriveResources==='function')getDriveResources().then(rows=>{
   rows.filter(r=>/상가|오피스텔|힐스테이트더운정/.test(r.category||'')).forEach(r=>{
    const line=String(r.memo||'').split(/\r?\n/).find(line=>/^(?:주소|지번주소|소재지)\s*[:：]/.test(line.trim()));
    const addr=line?line.replace(/^[^:：]+[:：]\s*/,'').trim():'';
    if(addr&&r.name&&!sources.some(b=>normalize(b.name)===normalize(r.name)))sources.push({name:r.name,addr,category:/오피스텔|힐스테이트/.test(r.category)?'오피스텔':'상가'});
   });if(enabled)options();
  }).catch(()=>{});
  return render;
 };
})(window);