/* Parcel records are private shared office data, protected by the existing admin RLS predicate. */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const ns = 'http://www.w3.org/2000/svg';
  let current = null, rows = [], cells = [], selected = null, stage = null, overlay = null, generation = 0, placing = false, busy = false;
  let sourceMeta = null, buildingVectorOverlay = null, buildingVectorCandidates = [], recordsLoaded = false;
  const views = {area:false, building:false, contact:false};
  const contactStates = {
    contact: {label:'연락처 있음', symbol:'●'},
    registered: {label:'자료 있음 · 연락처 없음', symbol:'○'},
    missing: {label:'자료 미등록', symbol:'×'},
    unknown: {label:'등록 상태 확인 불가', symbol:'?'}
  };
  function buildingState(row) { return ['building','vacant'].includes(row.data.building) ? row.data.building : 'unknown'; }
  function hasContact(row) { return /\d{7,}/.test(String(row.data.contact || '').replace(/\D/g,'')); }
  function hasOwnerContact(row) { return String(row.data.owner || '').trim() !== '' && hasContact(row); }
  function contactState(row) { return hasContact(row) ? 'contact' : !recordsLoaded ? 'unknown' : row.id ? 'registered' : 'missing'; }
  function viewLegend() {
    const parts=[];
    if(views.building) parts.push('건물 있음: 파란색 강조 · 건물 없음/미입력: 원본 그대로');
    if(views.contact) parts.push('● 소유주와 연락처가 모두 있는 필지' + (!recordsLoaded ? ' · 저장 자료를 불러오지 못했습니다' : ''));
    $('parcelViewLegend').textContent=parts.join(' / ');$('parcelViewLegend').hidden=!parts.length;
  }
  function addMapLabel(row) {
    const area=Number(row.data.area), parts=[];
    if(views.area && Number.isFinite(area) && area>0) parts.push(views.area==='sqm'?area.toLocaleString('ko-KR',{maximumFractionDigits:1})+'㎡':(area/3.305785).toFixed(1)+'평');
    if(!parts.length && !(views.contact && hasOwnerContact(row)))return;
    let x=Number(row.x)/100,y=Number(row.y)/100;
    if(row.points?.length){x=row.points.reduce((n,p)=>n+p[0],0)/row.points.length/318;y=row.points.reduce((n,p)=>n+p[1],0)/row.points.length/385;}
    if(!Number.isFinite(x)||!Number.isFinite(y))return;
    if(parts.length){
      const text=document.createElementNS(ns,'text');text.setAttribute('x',x);text.setAttribute('y',y);text.setAttribute('text-anchor','middle');text.setAttribute('dominant-baseline','middle');text.classList.add('parcel-map-label');text.textContent=parts.join(' ');overlay.append(text);
    }
    if(views.contact && hasOwnerContact(row)){
      const text=document.createElementNS(ns,'text');
      text.setAttribute('x',x);text.setAttribute('y',y + (parts.length ? .011 : 0));text.setAttribute('text-anchor','middle');text.setAttribute('dominant-baseline','middle');
      text.classList.add('parcel-map-label','parcel-contact-marker','parcel-contact-contact');text.textContent='●';overlay.append(text);
    }
  }
  function isParcelYellow(fill) {
    const nums=String(fill||'').match(/\d+(?:\.\d+)?/g);
    if(!nums||nums.length<3)return false;
    const r=Number(nums[0]),g=Number(nums[1]),b=Number(nums[2]);
    return r>=180 && g>=165 && b<=190 && r>g-25 && g>b+20;
  }
  function setupBuildingVectorOverlay(svgText) {
    buildingVectorOverlay=null;buildingVectorCandidates=[];
    if(!svgText||!stage||!overlay)return;
    try{
      const doc=new DOMParser().parseFromString(svgText,'image/svg+xml');
      const parsed=doc.documentElement;
      if(!parsed||parsed.nodeName.toLowerCase()!=='svg')return;
      const svg=document.importNode(parsed,true);
      svg.classList.add('parcel-building-vector-overlay');
      svg.setAttribute('aria-hidden','true');
      svg.setAttribute('preserveAspectRatio','none');
      svg.removeAttribute('width');svg.removeAttribute('height');
      svg.style.visibility='hidden';
      stage.insertBefore(svg,overlay);
      const shapes=[...svg.querySelectorAll('path,polygon,rect')];
      buildingVectorCandidates=shapes.filter(shape=>isParcelYellow(getComputedStyle(shape).fill));
      svg.style.visibility='';
      buildingVectorOverlay=svg;
    }catch(_){buildingVectorOverlay=null;buildingVectorCandidates=[];}
  }
  function shapeContainsClientPoint(shape,clientX,clientY) {
    try{
      if(typeof shape.isPointInFill!=='function')return false;
      const matrix=shape.getScreenCTM();
      if(!matrix)return false;
      const point=new DOMPoint(clientX,clientY).matrixTransform(matrix.inverse());
      return shape.isPointInFill(point);
    }catch(_){return false;}
  }
  function updateVectorBuildingHighlights(ordered) {
    if(!buildingVectorOverlay)return;
    buildingVectorCandidates.forEach(shape=>shape.classList.remove('parcel-building-vector-highlight'));
    if(!views.building)return;
    const rect=buildingVectorOverlay.getBoundingClientRect();
    if(!rect.width||!rect.height)return;
    ordered.filter(row=>buildingState(row)==='building').forEach(row=>{
      const x=Number(row.x),y=Number(row.y);
      if(!Number.isFinite(x)||!Number.isFinite(y))return;
      const clientX=rect.left+x/100*rect.width,clientY=rect.top+y/100*rect.height;
      const hits=buildingVectorCandidates.filter(shape=>shapeContainsClientPoint(shape,clientX,clientY));
      if(!hits.length)return;
      let best=hits[0],bestArea=Infinity;
      hits.forEach(shape=>{
        try{
          const box=shape.getBoundingClientRect(),area=box.width*box.height;
          if(area>0&&area<bestArea){best=shape;bestArea=area;}
        }catch(_){}
      });
      best.classList.add('parcel-building-vector-highlight');
    });
  }
  const fields = ['address','landType','building','area','supplyPrice','auctionPrice','salePrice','owner','contact','note'];
  const priceFields = ['supplyPrice','auctionPrice','salePrice'];
  function money(value) { return value == null || value === '' ? '' : Math.round(Number(value)).toLocaleString('ko-KR'); }
  function readWon(value) { const digits = value.replace(/,/g, '').trim(); return digits === '' ? null : Number(digits); }
  function formatPriceInput(input) {
    const before = input.value, cursor = input.selectionStart ?? before.length;
    const digitsBefore = before.slice(0, cursor).replace(/\D/g, '').length;
    const digits = before.replace(/\D/g, '');
    input.value = digits ? money(Number(digits)) : '';
    let position = 0, count = 0;
    while (position < input.value.length && count < digitsBefore) {
      if (/\d/.test(input.value[position])) count++;
      position++;
    }
    input.setSelectionRange(position, position);
    updateArea();
  }
  function status(message) { $('parcelStatus').textContent = message; $('parcelModalStatus').textContent = message; }
  function closeEditor() {
    const editor = $('parcelEditor');
    if (editor.open) editor.close();
    editor.hidden = true;
  }
  async function request(query, options) {
    const {data, error} = await hitopAuthClient.auth.getSession();
    if (error || !data.session) throw new Error('로그인 상태를 확인해주세요.');
    const response = await fetchWithTimeout(SUPABASE_URL + '/rest/v1/land_parcels' + query, {
      ...options, headers: {apikey: SUPABASE_KEY, Authorization: 'Bearer ' + data.session.access_token, 'Content-Type':'application/json', Prefer:'return=representation'}
    });
    if (!response.ok) {
      let info = {}; try { info = await response.json(); } catch (_) {}
      throw new Error(info.code === '23505' ? '같은 소블럭·필지번호가 이미 등록되어 있습니다.' : '자료를 저장하거나 불러오지 못했습니다. 다시 시도해주세요.');
    }
    return response.status === 204 ? [] : response.json();
  }
  function key(row) { return row.subblock + '-' + row.parcel; }
  function parcelLabel(row) { return [current.name, row.subblock, row.parcel].filter(Boolean).join('-'); }
  function updateParcelLabel() {
    if (!current) return;
    const subblock = $('parcelSubblock').value.trim(), parcel = $('parcelNumber').value.trim();
    const label = subblock && parcel ? parcelLabel({subblock, parcel}) : '';
    $('parcelFullNumber').value = label;
    $('parcelFormTitle').textContent = label || current.name + ' · 새 필지 등록';
    $('parcelFormSubtitle').textContent = label ? subblock + '소블럭 ' + parcel + '필지' : '소블럭 번호와 필지번호를 입력해주세요.';
  }
  function matches(row) {
    return (!sourceMeta || $('parcelSubblockFilter').value === 'all' || row.subblock === $('parcelSubblockFilter').value) && ($('parcelBuildingFilter').value === 'all' || buildingState(row) === $('parcelBuildingFilter').value) &&
      ($('parcelTypeFilter').value === 'all' || row.data.landType === $('parcelTypeFilter').value) &&
      (!recordsLoaded || $('parcelContactFilter').value === 'all' || contactState(row) === $('parcelContactFilter').value);
  }
  function show(row) {
    if (busy) return;
    placing = false; $('parcelAdd').setAttribute('aria-pressed','false');
    selected = {...row, data: {...row.data}};
    $('parcelForm').reset();
    $('parcelSubblock').value = row.subblock || ''; $('parcelNumber').value = row.parcel || '';
    $('parcelSubblock').readOnly = !!(row.points || row.sourceCell); $('parcelNumber').readOnly = !!(row.points || row.sourceCell);
    const values = {...{landType: current.types?.[0] || 'unknown',building:''},...row.data};
    if (!['building','vacant'].includes(values.building)) values.building = '';
    const detail=$('parcelSourceDetail'); detail.hidden=!row.source;
    if(row.source) detail.textContent='2021년 9월 원본 · '+row.source.status+'\n건폐율 '+row.source.coverage+'% 이하 · 용적률 '+row.source.floorRatio+'% 이하 · '+row.source.floors+'층 이하'+(row.source.unitPriceWon?' · 단가 '+row.source.unitPriceWon.toLocaleString('ko-KR')+'원/㎡ · 평당가 '+Math.round(row.source.unitPriceWon*3.305785).toLocaleString('ko-KR')+'원/평':'')+'\n원본 PDF '+row.sourcePage+'페이지';
    fields.forEach(name => {
      if (name === 'building') $('parcel-building').checked = values.building === 'building';
      else $('parcel-' + name).value = priceFields.includes(name) ? money(values[name] == null ? null : Number(values[name]) * 10000) : values[name] ?? '';
    });
    updateArea();
    updateParcelLabel();
    $('parcelEditor').hidden = false; $('parcelDelete').hidden = !row.id;
    if (!$('parcelEditor').open) $('parcelEditor').showModal();
    $('parcelEditor').scrollTop = 0;
    draw();
    status(row.id ? '등록된 자료입니다. 수정 후 저장할 수 있습니다.' : '등록된 세부자료가 없습니다. 내용을 입력하고 저장해주세요.');
  }
  function draw() {
    overlay.replaceChildren(); $('parcelList').replaceChildren(); viewLegend();
    const combined = new Map(cells.map(cell => [key(cell),{...cell,data:{...cell.data}}]));
    rows.forEach(row => {const base=combined.get(key(row));combined.set(key(row), {...base,...row,data:{...base?.data,...row.data}});});
    $('parcelSourceBody').replaceChildren();$('parcelList').hidden=!!sourceMeta;
    if(sourceMeta) sourceMeta.subblocks.forEach(group=>{
      const shape=document.createElementNS(ns,'circle');shape.setAttribute('cx',group.x/100);shape.setAttribute('cy',group.y/100);shape.setAttribute('r','.01');shape.classList.add('source-subblock');shape.setAttribute('role','button');shape.setAttribute('tabindex','0');shape.setAttribute('aria-label','C1-'+group.number+' 토지목록 보기');
      const choose=()=>{$('parcelSubblockFilter').value=String(group.number);draw();$('parcelSourceSection').scrollIntoView({behavior:'smooth',block:'start'});};shape.addEventListener('click',choose);shape.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();choose();}});overlay.append(shape);
    });
    const ordered = [...combined.values()].sort((a,b) => a.subblock.localeCompare(b.subblock,'ko',{numeric:true}) || a.parcel.localeCompare(b.parcel,'ko',{numeric:true}));
    let count = 0;
    ordered.forEach(row => {
      if (!matches(row)) return; count++;
      const shape = document.createElementNS(ns,row.points ? 'polygon' : 'circle');
      if (row.points) shape.setAttribute('points',row.points.map(p => p[0]/318 + ',' + p[1]/385).join(' '));
      else {shape.setAttribute('cx',row.x/100);shape.setAttribute('cy',row.y/100);shape.setAttribute('r',row.sourceCell?'.006':'.015');}
      shape.classList.add('parcel-shape'); if(views.building && buildingState(row)==='building' && row.points) shape.classList.add('parcel-building-building');
      const registration = contactStates[contactState(row)].label;
      shape.setAttribute('role','button');shape.setAttribute('tabindex','0');shape.setAttribute('aria-label',parcelLabel(row) + ' 필지 자료 · ' + registration);
      const title=document.createElementNS(ns,'title');title.textContent=parcelLabel(row) + ' · ' + registration;shape.append(title);
      shape.addEventListener('click',event=>{event.stopPropagation();show(row);});
      shape.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();show(row);}});overlay.append(shape); addMapLabel(row);
      if(sourceMeta){appendSourceRow(row);return;}
      const button=document.createElement('button');button.type='button';button.className='block-button';
      button.textContent=parcelLabel(row);
      const note=document.createElement('small');note.textContent=registration;button.append(note);button.addEventListener('click',()=>show(row));$('parcelList').append(button);
    });
    updateVectorBuildingHighlights(ordered);
    if(sourceMeta)$('parcelSourceSummary').textContent='원본 토지목록 '+cells.length+'개 · 현재 표시 '+count+'개';
    $('parcelCount').textContent = (recordsLoaded ? '자료 등록 ' + rows.length + '개' : '등록 상태 확인 불가') + ' · 현재 표시 ' + count + '개';
    $('parcelListEmpty').hidden = !!count;
  }
  function updateArea() {
    const area = Number($('parcel-area').value), pyeong = area / 3.305785;
    $('parcelAreaPyeong').value = area > 0 && Number.isFinite(area) ? pyeong.toLocaleString('ko-KR',{minimumFractionDigits:2,maximumFractionDigits:2}) : '';
    priceFields.forEach(name => {
      const won = readWon($('parcel-' + name).value);
      $('parcel-' + name + 'PerPyeong').value = won != null && Number.isFinite(won) && area > 0 ? money(won / pyeong) : '';
    });
  }
  function appendSourceRow(row){
    const tr=document.createElement('tr');
    const area=row.data.area;const price=row.source?.supplyPriceWon;
    const values=[parcelLabel(row),row.data.address||'원본 미기재',area==null?'미기재':Number(area).toLocaleString('ko-KR')+'㎡ / '+(Number(area)/3.305785).toFixed(2)+'평',price==null?'추후공급 예정':money(price)+'원'];
    values.forEach(value=>{const td=document.createElement('td');td.textContent=value;tr.append(td);});
    const td=document.createElement('td'), state=contactState(row), badge=document.createElement('span');badge.className='parcel-contact-badge parcel-contact-'+state;badge.textContent=contactStates[state].symbol+' '+contactStates[state].label;
    const btn=document.createElement('button');btn.type='button';btn.className='btn';btn.textContent=row.id?'자료 수정':'자료 보기·등록';btn.addEventListener('click',()=>show(row));td.append(badge,btn);tr.append(td);$('parcelSourceBody').append(tr);
  }
  async function open(block, image) {
    const run = ++generation; current=block; rows=[]; cells=[]; sourceMeta=null; buildingVectorOverlay=null; buildingVectorCandidates=[]; selected=null; placing=false; recordsLoaded=false;
    $('parcelSourceSection').hidden=true;$('parcelSourceDetail').hidden=true;$('parcelList').hidden=false;
    $('parcelViewControls').hidden=!image; $('parcelViewLegend').hidden=!image;
    closeEditor(); $('parcelManager').hidden=!image;
    if (!image) return;
    stage=document.createElement('div');stage.className='parcel-stage';stage.style.width='100%';
    image.replaceWith(stage);image.style.width='100%';stage.append(image);
    overlay=document.createElementNS(ns,'svg');overlay.setAttribute('viewBox','0 0 1 1');overlay.setAttribute('preserveAspectRatio','none');overlay.classList.add('parcel-overlay');stage.append(overlay);
    $('parcelBuildingFilter').value='all';$('parcelTypeFilter').value='all';$('parcelContactFilter').value='all';$('parcelContactFilter').disabled=true;$('parcelAdd').setAttribute('aria-pressed','false');
    $('parcelHelp').textContent=block.id==='third-C1'?'PDF 원본 벡터 도면입니다. 파란 소블럭 번호를 누르면 해당 토지목록이 나오고, 개별 필지번호를 누르면 자료가 열립니다.':block.id==='third-C18'?'원본 도면의 해상도를 높인 이미지입니다. 필지를 누르면 세부자료가 열립니다. 번호는 소블럭-필지번호 순서입니다.':'필지 등록을 누른 뒤 도면의 해당 필지 위치를 눌러 자료를 입력하세요.';
    stage.addEventListener('click',event=>{
      if(!placing || busy) return;
      const rect=image.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const x=(event.clientX-rect.left)/rect.width*100,y=(event.clientY-rect.top)/rect.height*100;
      if(x<0||x>100||y<0||y>100)return;
      show({subblock:'',parcel:'',x,y,data:{}});
    });
    status('자료를 불러오는 중입니다.');
    try {
      const results = await Promise.allSettled([
        request('?block_id=eq.'+encodeURIComponent(block.id)+'&order=subblock.asc,parcel.asc'),
        block.id==='third-C1' ? window.HitopLandBlockSource.load(block.id) :
        block.id==='third-C18' ? fetch('assets/images/land/blocks/third-C18-parcels.json').then(r=>{if(!r.ok)throw Error('필지 위치를 불러오지 못했습니다.');return r.json();}) : Promise.resolve([])
      ]);
      if(run!==generation)return;
      rows=results[0].status==='fulfilled'?results[0].value:[];
      recordsLoaded=results[0].status==='fulfilled';$('parcelContactFilter').disabled=!recordsLoaded;
      if(results[1].status==='fulfilled'){
        if(block.id==='third-C1'){
          sourceMeta=results[1].value.source_data;cells=sourceMeta.parcels;setupBuildingVectorOverlay(results[1].value.diagram_svg);$('parcelSourceSection').hidden=false;
          $('parcelSubblockFilter').replaceChildren(new Option('C1 전체','all'),...sourceMeta.subblocks.map(g=>new Option('C1-'+g.number,String(g.number))));
        }else cells=results[1].value;
      }
      draw();status(results[0].status==='rejected'?'원본 도면·목록은 확인할 수 있습니다. '+(results[0].reason.message||'저장 자료를 불러오지 못했습니다.'):results[1].status==='rejected'?results[1].reason.message:'필지를 선택해 세부자료를 확인하세요.');
    } catch(error) { if(run===generation)status(error.message || '도면의 필지 위치를 불러오지 못했습니다.'); }
  }
  function setAreaView(mode){
    views.area = views.area === mode ? false : mode;
    $('parcelAreaPyeongToggle').setAttribute('aria-pressed',String(views.area==='pyeong'));
    $('parcelAreaSqmToggle').setAttribute('aria-pressed',String(views.area==='sqm'));
    if(overlay&&current)draw();
  }
  $('parcelAreaPyeongToggle').addEventListener('click',()=>setAreaView('pyeong'));
  $('parcelAreaSqmToggle').addEventListener('click',()=>setAreaView('sqm'));
  ['building','contact'].forEach(name=>{const id='parcel'+name[0].toUpperCase()+name.slice(1)+'Toggle';$(id).addEventListener('click',()=>{views[name]=!views[name];$(id).setAttribute('aria-pressed',String(views[name]));if(overlay&&current)draw();});});
  $('parcelForm').addEventListener('submit',async event=>{
    event.preventDefault(); if(busy || !selected)return;
    const run=generation,blockId=current.id;
    const subblock=$('parcelSubblock').value.trim(),parcel=$('parcelNumber').value.trim();
    if(!subblock||!parcel){status('소블럭과 필지번호를 입력해주세요.');return;}
    const data={};fields.forEach(name=>{const value=name==='building'?($('parcel-building').checked?'building':'vacant'):$('parcel-'+name).value.trim();data[name]=priceFields.includes(name)?(value===''?null:readWon(value)/10000):name==='area'?(value===''?null:Number(value)):value;});
    const body={block_id:blockId,subblock,parcel,x:selected.x,y:selected.y,data,updated_at:new Date().toISOString()};
    busy=true;$('parcelSave').disabled=true;status('저장 중입니다.');
    try{
      const result=await request(selected.id?'?id=eq.'+encodeURIComponent(selected.id):'',{method:selected.id?'PATCH':'POST',body:JSON.stringify(body)});
      if(!result[0])throw Error('저장 결과를 확인하지 못했습니다.');
      if(run!==generation)return;
      const index=rows.findIndex(row=>row.id===result[0].id);if(index<0)rows.push(result[0]);else rows[index]=result[0];
      selected={...selected,...result[0]};updateParcelLabel();$('parcelDelete').hidden=false;draw();status('저장되었습니다. 다른 기기에서도 같은 자료를 확인할 수 있습니다.');
    }catch(error){if(run===generation)status(error.message);}finally{busy=false;$('parcelSave').disabled=false;}
  });
  $('parcelDelete').addEventListener('click',async()=>{
    if(busy||!selected?.id||!confirm('이 필지의 등록 자료를 삭제할까요? 도면의 필지는 남습니다.'))return;
    const run=generation,id=selected.id;busy=true;
    try{await request('?id=eq.'+encodeURIComponent(id),{method:'DELETE'});if(run!==generation)return;rows=rows.filter(row=>row.id!==id);closeEditor();draw();status('등록 자료를 삭제했습니다.');}catch(error){status(error.message);}finally{busy=false;}
  });
  ['parcelClose','parcelModalClose'].forEach(id=>$(id).addEventListener('click',closeEditor));
  $('parcelEditor').addEventListener('close',()=>{if (!$('parcelEditor').open) $('parcelEditor').hidden=true;});
  $('parcelEditor').addEventListener('click',event=>{
    if (event.target !== $('parcelEditor')) return;
    const rect = $('parcelEditor').getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closeEditor();
  });
  $('parcelAdd').addEventListener('click',()=>{if(busy)return;placing=!placing;$('parcelAdd').setAttribute('aria-pressed',String(placing));status(placing?'도면에서 등록할 필지 위치를 눌러주세요.':'위치 지정을 취소했습니다.');});
  $('parcelSubblockFilter').addEventListener('change',draw);
  ['parcelSubblock','parcelNumber'].forEach(id=>$(id).addEventListener('input',updateParcelLabel));
  priceFields.forEach(name=>$('parcel-'+name).addEventListener('input',event=>formatPriceInput(event.target)));
  $('parcel-area').addEventListener('input',updateArea);
  ['parcelBuildingFilter','parcelTypeFilter','parcelContactFilter'].forEach(id=>$(id).addEventListener('change',draw));
  window.HitopLandParcels={open,close(){generation++;closeEditor();current=null;overlay=null;$('parcelViewControls').hidden=true;$('parcelViewLegend').hidden=true;rows=[];cells=[];sourceMeta=null;buildingVectorOverlay=null;buildingVectorCandidates=[];recordsLoaded=false;selected=null;$('parcelSourceBody').replaceChildren();$('parcelList').replaceChildren();$('parcelForm').reset();$('parcelSourceDetail').textContent='';$('parcelModalStatus').textContent='';$('parcelManager').hidden=true;}};
})();
