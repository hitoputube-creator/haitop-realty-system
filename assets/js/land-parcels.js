/* Parcel records are private shared office data, protected by the existing admin RLS predicate. */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const ns = 'http://www.w3.org/2000/svg';
  let current = null, rows = [], cells = [], selected = null, stage = null, overlay = null, generation = 0, placing = false, busy = false;
  let sourceMeta = null;
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
    return (!sourceMeta || $('parcelSubblockFilter').value === 'all' || row.subblock === $('parcelSubblockFilter').value) && ($('parcelBuildingFilter').value === 'all' || row.data.building === $('parcelBuildingFilter').value) &&
      ($('parcelTypeFilter').value === 'all' || row.data.landType === $('parcelTypeFilter').value);
  }
  function show(row) {
    if (busy) return;
    placing = false; $('parcelAdd').setAttribute('aria-pressed','false');
    selected = {...row, data: {...row.data}};
    $('parcelForm').reset();
    $('parcelSubblock').value = row.subblock || ''; $('parcelNumber').value = row.parcel || '';
    $('parcelSubblock').readOnly = !!(row.points || row.sourceCell); $('parcelNumber').readOnly = !!(row.points || row.sourceCell);
    const values = {...{landType: current.types?.[0] || 'unknown',building:'unknown'},...row.data};
    const detail=$('parcelSourceDetail'); detail.hidden=!row.source;
    if(row.source) detail.textContent='2021년 9월 원본 · '+row.source.status+'\n건폐율 '+row.source.coverage+'% 이하 · 용적률 '+row.source.floorRatio+'% 이하 · '+row.source.floors+'층 이하'+(row.source.unitPriceWon?' · 단가 '+row.source.unitPriceWon.toLocaleString('ko-KR')+'원/㎡':'')+'\n원본 PDF '+row.sourcePage+'페이지';
    fields.forEach(name => { $('parcel-' + name).value = values[name] ?? ''; });
    updateArea();
    $('parcelFormTitle').textContent = current.name + ' · ' + (row.subblock ? row.subblock + '소블럭 ' + row.parcel + '필지' : '새 필지 등록');
    $('parcelEditor').hidden = false; $('parcelDelete').hidden = !row.id;
    $('parcelEditor').scrollIntoView({behavior:'smooth',block:'start'});
    draw();
    status(row.id ? '등록된 자료입니다. 수정 후 저장할 수 있습니다.' : '등록된 세부자료가 없습니다. 내용을 입력하고 저장해주세요.');
  }
  function draw() {
    overlay.replaceChildren(); $('parcelList').replaceChildren();
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
      shape.classList.add('parcel-shape');if(selected&&key(selected)===key(row))shape.classList.add('selected'); if (row.id) shape.classList.add('registered');
      shape.setAttribute('role','button');shape.setAttribute('tabindex','0');shape.setAttribute('aria-label',row.subblock + '소블럭 ' + row.parcel + '필지 자료');
      const title=document.createElementNS(ns,'title');title.textContent=row.subblock + '-' + row.parcel + (row.id?' 등록됨':' 미등록');shape.append(title);
      shape.addEventListener('click',event=>{event.stopPropagation();show(row);});
      shape.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();show(row);}});overlay.append(shape);
      if(sourceMeta){appendSourceRow(row);return;}
      const button=document.createElement('button');button.type='button';button.className='block-button';
      button.textContent=row.subblock + '-' + row.parcel;
      const note=document.createElement('small');note.textContent=row.id?'자료 보기':'미등록';button.append(note);button.addEventListener('click',()=>show(row));$('parcelList').append(button);
    });
    if(sourceMeta)$('parcelSourceSummary').textContent='원본 토지목록 '+cells.length+'개 · 현재 표시 '+count+'개';
    $('parcelCount').textContent = '자료 등록 ' + rows.length + '개 · 현재 표시 ' + count + '개';
    $('parcelListEmpty').hidden = !!count;
  }
  function updateArea() {
    const value = $('parcel-area').value;
    $('parcelAreaPyeong').textContent = value && Number.isFinite(Number(value)) ? (Number(value) / 3.305785).toFixed(2) + '평' : '';
  }
  function appendSourceRow(row){
    const tr=document.createElement('tr');
    const area=row.data.area;const price=row.source?.supplyPriceWon;
    const values=[current.name+'-'+row.subblock+'-'+row.parcel,row.data.address||'원본 미기재',area==null?'미기재':Number(area).toLocaleString('ko-KR')+'㎡ / '+(Number(area)/3.305785).toFixed(2)+'평',price==null?'추후공급 예정':(price/10000).toLocaleString('ko-KR')+'만원'];
    values.forEach(value=>{const td=document.createElement('td');td.textContent=value;tr.append(td);});
    const td=document.createElement('td');const btn=document.createElement('button');btn.type='button';btn.className='btn';btn.textContent=row.id?'자료 수정':'자료 보기·등록';btn.addEventListener('click',()=>show(row));td.append(btn);tr.append(td);$('parcelSourceBody').append(tr);
  }
  async function open(block, image) {
    const run = ++generation; current=block; rows=[]; cells=[]; sourceMeta=null; selected=null; placing=false;
    $('parcelSourceSection').hidden=true;$('parcelSourceDetail').hidden=true;$('parcelList').hidden=false;
    $('parcelManager').hidden=!image; $('parcelEditor').hidden=true;
    if (!image) return;
    stage=document.createElement('div');stage.className='parcel-stage';stage.style.width='100%';
    image.replaceWith(stage);image.style.width='100%';stage.append(image);
    overlay=document.createElementNS(ns,'svg');overlay.setAttribute('viewBox','0 0 1 1');overlay.setAttribute('preserveAspectRatio','none');overlay.classList.add('parcel-overlay');stage.append(overlay);
    $('parcelBuildingFilter').value='all';$('parcelTypeFilter').value='all';$('parcelAdd').setAttribute('aria-pressed','false');
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
        block.id==='third-C1' ? window.HitopLandBlockSource.load(block.id).then(row=>row.source_data) :
        block.id==='third-C18' ? fetch('assets/images/land/blocks/third-C18-parcels.json').then(r=>{if(!r.ok)throw Error('필지 위치를 불러오지 못했습니다.');return r.json();}) : Promise.resolve([])
      ]);
      if(run!==generation)return;
      rows=results[0].status==='fulfilled'?results[0].value:[];
      if(results[1].status==='fulfilled'){
        if(block.id==='third-C1'){
          sourceMeta=results[1].value;cells=sourceMeta.parcels;$('parcelSourceSection').hidden=false;
          $('parcelSubblockFilter').replaceChildren(new Option('C1 전체','all'),...sourceMeta.subblocks.map(g=>new Option('C1-'+g.number,String(g.number))));
        }else cells=results[1].value;
      }
      draw();status(results[0].status==='rejected'?'원본 도면·목록은 확인할 수 있습니다. '+(results[0].reason.message||'저장 자료를 불러오지 못했습니다.'):results[1].status==='rejected'?results[1].reason.message:'필지를 선택해 세부자료를 확인하세요.');
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
  $('parcelSubblockFilter').addEventListener('change',draw);
  $('parcel-area').addEventListener('input',updateArea);
  ['parcelBuildingFilter','parcelTypeFilter'].forEach(id=>$(id).addEventListener('change',draw));
  window.HitopLandParcels={open,close(){generation++;current=null;rows=[];cells=[];sourceMeta=null;selected=null;$('parcelSourceBody').replaceChildren();$('parcelList').replaceChildren();$('parcelForm').reset();$('parcelSourceDetail').textContent='';$('parcelManager').hidden=true;$('parcelEditor').hidden=true;}};
})();

