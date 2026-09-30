/* Parcel records are private shared office data, protected by the existing admin RLS predicate. */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const ns = 'http://www.w3.org/2000/svg';
  let current = null, rows = [], cells = [], selected = null, stage = null, overlay = null, generation = 0, placing = false, busy = false;
  const fields = ['address','landType','building','area','supplyPrice','auctionPrice','salePrice','owner','contact','note'];
  function status(message) { $('parcelStatus').textContent = message; }
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
  function matches(row) {
    return ($('parcelBuildingFilter').value === 'all' || row.data.building === $('parcelBuildingFilter').value) &&
      ($('parcelTypeFilter').value === 'all' || row.data.landType === $('parcelTypeFilter').value);
  }
  function show(row) {
    if (busy) return;
    placing = false; $('parcelAdd').setAttribute('aria-pressed','false');
    selected = {...row, data: {...row.data}};
    $('parcelForm').reset();
    $('parcelSubblock').value = row.subblock || ''; $('parcelNumber').value = row.parcel || '';
    $('parcelSubblock').readOnly = !!row.points; $('parcelNumber').readOnly = !!row.points;
    const values = {...{landType: current.types?.[0] || 'unknown',building:'unknown'},...row.data};
    fields.forEach(name => { $('parcel-' + name).value = values[name] ?? ''; });
    updateArea();
    $('parcelFormTitle').textContent = current.name + ' · ' + (row.subblock ? row.subblock + '소블럭 ' + row.parcel + '필지' : '새 필지 등록');
    $('parcelEditor').hidden = false; $('parcelDelete').hidden = !row.id;
    $('parcelEditor').scrollIntoView({behavior:'smooth',block:'start'});
    status(row.id ? '등록된 자료입니다. 수정 후 저장할 수 있습니다.' : '등록된 세부자료가 없습니다. 내용을 입력하고 저장해주세요.');
  }
  function draw() {
    overlay.replaceChildren(); $('parcelList').replaceChildren();
    const combined = new Map(cells.map(cell => [key(cell),{...cell,data:{}}]));
    rows.forEach(row => combined.set(key(row), {...combined.get(key(row)),...row}));
    const ordered = [...combined.values()].sort((a,b) => a.subblock.localeCompare(b.subblock,'ko',{numeric:true}) || a.parcel.localeCompare(b.parcel,'ko',{numeric:true}));
    let count = 0;
    ordered.forEach(row => {
      if (!matches(row)) return; count++;
      const shape = document.createElementNS(ns,row.points ? 'polygon' : 'circle');
      if (row.points) shape.setAttribute('points',row.points.map(p => p[0]/318 + ',' + p[1]/385).join(' '));
      else {shape.setAttribute('cx',row.x/100);shape.setAttribute('cy',row.y/100);shape.setAttribute('r','.015');}
      shape.classList.add('parcel-shape'); if (row.id) shape.classList.add('registered');
      shape.setAttribute('role','button');shape.setAttribute('tabindex','0');shape.setAttribute('aria-label',row.subblock + '소블럭 ' + row.parcel + '필지 자료');
      const title=document.createElementNS(ns,'title');title.textContent=row.subblock + '-' + row.parcel + (row.id?' 등록됨':' 미등록');shape.append(title);
      shape.addEventListener('click',event=>{event.stopPropagation();show(row);});
      shape.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();show(row);}});overlay.append(shape);
      const button=document.createElement('button');button.type='button';button.className='block-button';
      button.textContent=row.subblock + '-' + row.parcel;
      const note=document.createElement('small');note.textContent=row.id?'자료 보기':'미등록';button.append(note);button.addEventListener('click',()=>show(row));$('parcelList').append(button);
    });
    $('parcelCount').textContent = '자료 등록 ' + rows.length + '개 · 현재 표시 ' + count + '개';
    $('parcelListEmpty').hidden = !!count;
  }
  function updateArea() {
    const value = $('parcel-area').value;
    $('parcelAreaPyeong').textContent = value && Number.isFinite(Number(value)) ? (Number(value) / 3.305785).toFixed(2) + '평' : '';
  }
  async function open(block, image) {
    const run = ++generation; current=block; rows=[]; cells=[]; selected=null; placing=false;
    $('parcelManager').hidden=!image; $('parcelEditor').hidden=true;
    if (!image) return;
    stage=document.createElement('div');stage.className='parcel-stage';stage.style.width='100%';
    image.replaceWith(stage);image.style.width='100%';stage.append(image);
    overlay=document.createElementNS(ns,'svg');overlay.setAttribute('viewBox','0 0 1 1');overlay.setAttribute('preserveAspectRatio','none');overlay.classList.add('parcel-overlay');stage.append(overlay);
    $('parcelBuildingFilter').value='all';$('parcelTypeFilter').value='all';$('parcelAdd').setAttribute('aria-pressed','false');
    $('parcelHelp').textContent=block.id==='third-C18'?'원본 도면의 해상도를 높인 이미지입니다. 필지를 누르면 세부자료가 열립니다. 번호는 소블럭-필지번호 순서입니다.':'필지 등록을 누른 뒤 도면의 해당 필지 위치를 눌러 자료를 입력하세요.';
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
      const results = await Promise.all([
        request('?block_id=eq.'+encodeURIComponent(block.id)+'&order=subblock.asc,parcel.asc'),
        block.id==='third-C18' ? fetch('assets/images/land/blocks/third-C18-parcels.json').then(r=>{if(!r.ok)throw Error();return r.json();}) : Promise.resolve([])
      ]);
      if(run!==generation)return;
      [rows,cells]=results;draw();status('필지를 선택해 세부자료를 확인하세요.');
    } catch(error) { if(run===generation)status(error.message || '도면의 필지 위치를 불러오지 못했습니다.'); }
  }
  $('parcelForm').addEventListener('submit',async event=>{
    event.preventDefault(); if(busy || !selected)return;
    const run=generation,blockId=current.id;
    const subblock=$('parcelSubblock').value.trim(),parcel=$('parcelNumber').value.trim();
    if(!subblock||!parcel){status('소블럭과 필지번호를 입력해주세요.');return;}
    const data={};fields.forEach(name=>{const value=$('parcel-'+name).value.trim();data[name]=['area','supplyPrice','auctionPrice','salePrice'].includes(name)?(value===''?null:Number(value)):value;});
    const body={block_id:blockId,subblock,parcel,x:selected.x,y:selected.y,data,updated_at:new Date().toISOString()};
    busy=true;$('parcelSave').disabled=true;status('저장 중입니다.');
    try{
      const result=await request(selected.id?'?id=eq.'+encodeURIComponent(selected.id):'',{method:selected.id?'PATCH':'POST',body:JSON.stringify(body)});
      if(!result[0])throw Error('저장 결과를 확인하지 못했습니다.');
      if(run!==generation)return;
      const index=rows.findIndex(row=>row.id===result[0].id);if(index<0)rows.push(result[0]);else rows[index]=result[0];
      selected={...selected,...result[0]};$('parcelDelete').hidden=false;draw();status('저장되었습니다. 다른 기기에서도 같은 자료를 확인할 수 있습니다.');
    }catch(error){if(run===generation)status(error.message);}finally{busy=false;$('parcelSave').disabled=false;}
  });
  $('parcelDelete').addEventListener('click',async()=>{
    if(busy||!selected?.id||!confirm('이 필지의 등록 자료를 삭제할까요? 도면의 필지는 남습니다.'))return;
    const run=generation,id=selected.id;busy=true;
    try{await request('?id=eq.'+encodeURIComponent(id),{method:'DELETE'});if(run!==generation)return;rows=rows.filter(row=>row.id!==id);$('parcelEditor').hidden=true;draw();status('등록 자료를 삭제했습니다.');}catch(error){status(error.message);}finally{busy=false;}
  });
  $('parcelClose').addEventListener('click',()=>{$('parcelEditor').hidden=true;});
  $('parcelAdd').addEventListener('click',()=>{if(busy)return;placing=!placing;$('parcelAdd').setAttribute('aria-pressed',String(placing));status(placing?'도면에서 등록할 필지 위치를 눌러주세요.':'위치 지정을 취소했습니다.');});
  $('parcel-area').addEventListener('input',updateArea);
  ['parcelBuildingFilter','parcelTypeFilter'].forEach(id=>$(id).addEventListener('change',draw));
  window.HitopLandParcels={open,close(){generation++;current=null;$('parcelManager').hidden=true;$('parcelEditor').hidden=true;}};
})();

