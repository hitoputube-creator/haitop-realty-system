/* Parcel records are private shared office data, protected by the existing admin RLS predicate. */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const ns = 'http://www.w3.org/2000/svg';
  let current = null, rows = [], cells = [], selected = null, stage = null, overlay = null, generation = 0, placing = false, busy = false;
  let sourceMeta = null, buildingVectorOverlay = null, buildingVectorCandidates = [], buildingVectorUrl = null, buildingVectorViewBox = null, recordsLoaded = false, sourcesLoaded = false;
  let parcelVectorRegions = new Map();
  let areaLabelOverlay = null;
  let noteParcelKeys=new Set(),noteKnownKeys=new Set(),notesLoaded=false,noteSearchTexts=new Map(),pendingSearchParcel=null;
  const views = {area:false, building:false, contact:false, ownership:false, households:false, data:false, lh:false};
  function householdsOf(row){const n=Number(row?.data?.households??row?.source?.households);return Number.isInteger(n)&&n>0?n:null;}
  (function(){const t=document.getElementById('detailTitle')?.closest('.block-title-row');if(t&&!document.getElementById('detailRules')){const p=document.createElement('p');p.id='detailRules';p.className='source-note block-rules';p.hidden=true;t.append(p);}})();
  const contactStates = {
    contact: {label:'소유주·연락처 자료 있음', symbol:'O'},
    registered: {label:'소유주·연락처 자료 없음', symbol:'X'},
    missing: {label:'소유주·연락처 자료 없음', symbol:'X'},
    unknown: {label:'등록 상태 확인 불가', symbol:'?'}
  };
  function dataState(row){return window.HitopParcelDataStatus.state(row,{recordsLoaded,sourcesLoaded});}
  function dataLabel(row){return dataState(row)==='missing'?'X':'';}
  function buildingState(row) { return ['building','vacant'].includes(row.data.building) ? row.data.building : 'unknown'; }
  function hasLh(row) { return !!(current&&window.HitopLandLh?.find(current.id,row)); }
  function hasContact(row) { return /\d{7,}/.test(String(row.data.contact || '').replace(/\D/g,'')); }
  function hasOwnerData(row) { return Boolean(String(row.data.owner||'').trim()) || hasContact(row); }
  function contactState(row) { return hasOwnerData(row) ? 'contact' : !recordsLoaded ? 'unknown' : row.id ? 'registered' : 'missing'; }
  function viewLegend() {
    $('parcelBuildingSnapshot').textContent=recordsLoaded ? window.HitopParcelBuilding.savedSummary(rows) : '건물 업데이트 현황 · 저장 자료를 불러오지 못했습니다.';
    $('parcelOwnershipSnapshot').textContent=recordsLoaded ? window.HitopParcelOwnership.savedSummary(rows) : '소유 구분 현황 · 저장 자료를 불러오지 못했습니다.';
    const parts=[];
    if(views.building) parts.push('건물 있음: 파란색 강조 · 건물 없음/미입력: 원본 그대로');
    if(views.data) parts.push('공급금액·토지면적이 모두 없는 필지만 X · 지번 제외');
    if(views.ownership) parts.push('소유 구분: 개인 / 법인 / 기타 · 저장된 자료 기준');
    if(views.contact) parts.push(recordsLoaded ? '소유주 자료 있음: 초록색 필지 · 자료 없음: X · 건물 있음과 겹치면 보라색' : '연락처 확인 불가 · 저장 자료를 불러오지 못했습니다');
    if(views.households) parts.push('허용가구수: 필지 안 숫자와 색으로 구분(1·2·3·4·5가구 이하) · 값이 없는 필지는 표시 없음');
    if(views.lh)parts.push('LH 공고중: 주황색 필지 · 연락처/건물 표시를 함께 켜면 해당 표시색 우선');
    $('parcelViewLegend').textContent=parts.join(' / ');$('parcelViewLegend').hidden=!parts.length;
  }
  function addMapLabel(row) {
    const area=Number(row.data.area), parts=[];
    if(views.area && Number.isFinite(area) && area>0) parts.push(views.area==='sqm'?area.toLocaleString('ko-KR',{maximumFractionDigits:1})+'㎡':(area/3.305785).toFixed(1)+'평');
    if(views.ownership && window.HitopParcelOwnership.state(row)!=='unknown') parts.push(window.HitopParcelOwnership.label(row));
    const hhValue=views.households?householdsOf(row):null;
    if(hhValue) parts.push(hhValue+'가구');
    const missingData=views.data&&dataState(row)==='missing';
    if(row.data.mapPositionUnavailable || (!parts.length&&!missingData) || (!row.points?.length && (row.x==null || row.y==null)))return;
    let x=Number(row.x)/100,y=Number(row.y)/100;
    if(row.points?.length){x=row.points.reduce((n,p)=>n+p[0],0)/row.points.length/318;y=row.points.reduce((n,p)=>n+p[1],0)/row.points.length/385;}
    if(!Number.isFinite(x)||!Number.isFinite(y))return;
    if(parts.length){
      const label=document.createElement('span');
      label.className='parcel-area-label'+(views.ownership?' parcel-ownership-label parcel-ownership-'+window.HitopParcelOwnership.state(row):'')+(hhValue?' parcel-hh-label parcel-hh-text-'+hhValue:'');
      label.style.left=(x*100)+'%';label.style.top=(y*100)+'%';
      label.textContent=parts.join(' ');
      areaLabelOverlay?.append(label);
    }
    if(missingData){
      const cross=document.createElement('span');cross.className='parcel-data-cross'+(parts.length?' parcel-data-cross-offset':'');
      cross.style.left=(x*100)+'%';cross.style.top=(y*100)+'%';cross.textContent='X';
      areaLabelOverlay?.append(cross);
    }
  }

  function addMissingOwnerMarker(row) {
    if (!views.contact || !recordsLoaded || hasOwnerData(row) || row.data.mapPositionUnavailable) return;
    let x=Number(row.x)/100,y=Number(row.y)/100;
    if(row.points?.length){
      x=row.points.reduce((sum,point)=>sum+point[0],0)/row.points.length/318;
      y=row.points.reduce((sum,point)=>sum+point[1],0)/row.points.length/385;
    }else if(row.x==null||row.y==null||row.x===''||row.y==='')return;
    if(!Number.isFinite(x)||!Number.isFinite(y))return;
    const d='M'+(x-.0035)+','+(y-.0035)+'L'+(x+.0035)+','+(y+.0035)+'M'+(x+.0035)+','+(y-.0035)+'L'+(x-.0035)+','+(y+.0035);
    for(const className of ['parcel-contact-cross-outline','parcel-contact-cross']){
      const cross=document.createElementNS(ns,'path');
      cross.setAttribute('d',d);cross.classList.add(className);
      cross.setAttribute('aria-hidden','true');overlay.append(cross);
    }
  }
  function isParcelYellow(fill) {
    const nums=String(fill||'').match(/\d+(?:\.\d+)?/g);
    if(!nums||nums.length<3)return false;
    const r=Number(nums[0]),g=Number(nums[1]),b=Number(nums[2]);
    return r>=180 && g>=165 && b<=190 && r>g-25 && g>b+20;
  }
  function setupBuildingVectorOverlay(svgText) {
    if(buildingVectorUrl){URL.revokeObjectURL(buildingVectorUrl);buildingVectorUrl=null;}
    buildingVectorOverlay=null;buildingVectorCandidates=[];buildingVectorViewBox=null;parcelVectorRegions=new Map();
    if(!svgText||!stage||!overlay)return;
    const object=document.createElement('object');
    object.className='parcel-building-vector-overlay';
    object.type='image/svg+xml';
    object.setAttribute('aria-hidden','true');
    object.tabIndex=-1;
    buildingVectorUrl=URL.createObjectURL(new Blob([svgText],{type:'image/svg+xml'}));
    object.data=buildingVectorUrl;
    stage.insertBefore(object,overlay);
    buildingVectorOverlay=object;
    object.addEventListener('load',async()=>{
      if(buildingVectorOverlay!==object)return;
      try{
        const doc=object.contentDocument,root=doc?.documentElement;
        if(!doc||!root)return;
        const style=doc.createElementNS(ns,'style');
        style.textContent='svg *{opacity:0!important;pointer-events:none!important}.parcel-building-vector-highlight{opacity:1!important;fill:#2563eb99!important;stroke:#1d4ed8!important;stroke-width:1.8!important;vector-effect:non-scaling-stroke}';
        root.insertBefore(style,root.firstChild);
        const vb=root.viewBox?.baseVal;
        if(vb&&vb.width&&vb.height)buildingVectorViewBox={x:vb.x,y:vb.y,width:vb.width,height:vb.height};
        const win=doc.defaultView;
        buildingVectorCandidates=[...root.querySelectorAll('path,polygon,rect')].filter(shape=>isParcelYellow(win.getComputedStyle(shape).fill));
        draw();
        const regions=await traceParcelRegions(root,sourceMeta?.parcels||[]);
        if(buildingVectorOverlay!==object)return;
        parcelVectorRegions=regions;
        draw();
      }catch(_){buildingVectorCandidates=[];buildingVectorViewBox=null;}
    },{once:true});
  }
  // Keep parcel geometry in the original SVG viewBox, excluding its viewport scale.
  // getCTM() includes the object's rendered size, which changes with map zoom.
  function parcelShapeMatrix(shape) {
    const root=shape.ownerDocument.documentElement,rootMatrix=root?.getCTM(),shapeMatrix=shape.getCTM();
    return rootMatrix&&shapeMatrix ? rootMatrix.inverse().multiply(shapeMatrix) : null;
  }
  async function traceParcelRegions(root,parcels) {
    // The PDF fills whole subblocks, but its boundary strokes separate individual
    // parcels. Trace those enclosed regions; the displayed drawing stays vector.
    const copy=root.cloneNode(true);
    copy.querySelectorAll('style').forEach(node=>node.remove());
    // PDF glyphs are <use> elements. Exclude them from boundary detection so
    // parcel numbers cannot cut a slit or isolated pocket into the traced area.
    copy.querySelectorAll('use').forEach(node=>node.remove());
    copy.querySelectorAll('[stroke-width]').forEach(node=>{
      const width=Number(node.getAttribute('stroke-width'));
      if(width>.2)node.setAttribute('stroke-width',String(Math.max(.9,width)));
    });
    const vb=root.viewBox.baseVal,scale=Math.min(3,Math.sqrt(6000000/(vb.width*vb.height)));
    const canvas=document.createElement('canvas');
    canvas.width=Math.ceil(vb.width*scale);canvas.height=Math.ceil(vb.height*scale);
    const url=URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(copy)],{type:'image/svg+xml'}));
    const image=new Image();
    try{image.src=url;await image.decode();}finally{URL.revokeObjectURL(url);}
    const context=canvas.getContext('2d',{willReadFrequently:true});
    context.drawImage(image,0,0,canvas.width,canvas.height);
    const pixels=context.getImageData(0,0,canvas.width,canvas.height).data;
    const w=canvas.width,h=canvas.height,labels=new Int32Array(w*h),regions=new Map();
    const yellow=i=>i>=0&&i<w*h&&pixels[i*4]>=180&&pixels[i*4+1]>=165&&pixels[i*4+2]<=190&&pixels[i*4+1]>pixels[i*4+2]+20&&pixels[i*4+3]>200;
    let id=0;
    for(const row of parcels){
      if(row.data?.mapPositionUnavailable||row.x==null||row.y==null)continue;
      let seed=-1;const x=Math.round(Number(row.x)/100*w),y=Math.round(Number(row.y)/100*h);
      for(let r=0;r<4&&seed<0;r++)for(let dy=-r;dy<=r&&seed<0;dy++)for(let dx=-r;dx<=r;dx++){
        if(x+dx<0||x+dx>=w||y+dy<0||y+dy>=h)continue;
        const i=(y+dy)*w+x+dx;if(yellow(i)){seed=i;break;}
      }
      if(seed<0||labels[seed])continue;
      id++;const stack=[seed],region=[];labels[seed]=id;
      while(stack.length){
        const i=stack.pop();region.push(i);
        for(const n of [i-1,i+1,i-w,i+w]){
          if(n<0||n>=labels.length||labels[n]||!yellow(n))continue;
          if(Math.abs(n-i)===1&&Math.floor(n/w)!==Math.floor(i/w))continue;
          labels[n]=id;stack.push(n);
        }
      }
      if(region.length<20)continue;
      const edges=new Map(),stride=w+1;
      const addEdge=(a,b)=>{if(!edges.has(a))edges.set(a,[]);edges.get(a).push(b);};
      for(const i of region){
        const px=i%w,py=Math.floor(i/w),a=py*stride+px;
        if(py===0||labels[i-w]!==id)addEdge(a,a+1);
        if(px===w-1||labels[i+1]!==id)addEdge(a+1,a+1+stride);
        if(py===h-1||labels[i+w]!==id)addEdge(a+1+stride,a+stride);
        if(px===0||labels[i-1]!==id)addEdge(a+stride,a);
      }
      let outer=[],largest=0;
      while(edges.size){
        const start=edges.keys().next().value,loop=[];let vertex=start,direction=null;
        while(edges.has(vertex)){
          loop.push([vertex%stride,Math.floor(vertex/stride)]);
          const choices=edges.get(vertex),dir=next=>next-vertex===1?0:next-vertex===stride?1:next-vertex===-1?2:3;
          if(direction!==null)choices.sort((a,b)=>[1,0,3,2].indexOf((dir(a)-direction+4)%4)-[1,0,3,2].indexOf((dir(b)-direction+4)%4));
          const next=choices.shift();direction=dir(next);
          if(!choices.length)edges.delete(vertex);
          vertex=next;if(vertex===start)break;
        }
        if(vertex!==start||loop.length<3)continue;
        const area=Math.abs(loop.reduce((sum,p,i)=>{const q=loop[(i+1)%loop.length];return sum+p[0]*q[1]-q[0]*p[1];},0));
        if(area>largest){largest=area;outer=loop;}
      }
      if(!outer.length)continue;
      // Remove redundant points along pixel edges without moving the boundary.
      const points=outer.filter((p,i)=>{
        const a=outer[(i+outer.length-1)%outer.length],b=outer[(i+1)%outer.length];
        return (p[0]-a[0])*(b[1]-p[1])!==(p[1]-a[1])*(b[0]-p[0]);
      });
      regions.set(key(row),'M'+points.map(p=>(vb.x+p[0]/w*vb.width).toFixed(3)+','+(vb.y+p[1]/h*vb.height).toFixed(3)).join('L')+'Z');
    }
    canvas.width=0;canvas.height=0;
    return regions;
  }
  function shapeContainsParcelPoint(shape,pctX,pctY) {
    try{
      if(typeof shape.isPointInFill!=='function'||!buildingVectorViewBox)return false;
      const root=shape.ownerDocument.documentElement,matrix=parcelShapeMatrix(shape);
      if(!root||!matrix)return false;
      const point=root.createSVGPoint();
      point.x=buildingVectorViewBox.x+pctX/100*buildingVectorViewBox.width;
      point.y=buildingVectorViewBox.y+pctY/100*buildingVectorViewBox.height;
      return shape.isPointInFill(point.matrixTransform(matrix.inverse()));
    }catch(_){return false;}
  }
  function findVectorParcelShape(row) {
    const x=Number(row.x),y=Number(row.y);
    if(!Number.isFinite(x)||!Number.isFinite(y))return null;
    const hits=buildingVectorCandidates.filter(shape=>shapeContainsParcelPoint(shape,x,y));
    if(!hits.length)return null;
    let best=hits[0],bestArea=Infinity;
    hits.forEach(shape=>{
      try{
        const box=shape.getBBox(),area=box.width*box.height;
        if(area>0&&area<bestArea){best=shape;bestArea=area;}
      }catch(_){}
    });
    return best;
  }
  function appendVectorParcelHitAreas(ordered) {
    if(!buildingVectorOverlay||!buildingVectorCandidates.length||!buildingVectorViewBox)return;
    const layer=document.createElementNS(ns,'svg');
    layer.setAttribute('x','0');layer.setAttribute('y','0');layer.setAttribute('width','1');layer.setAttribute('height','1');
    layer.setAttribute('viewBox',[buildingVectorViewBox.x,buildingVectorViewBox.y,buildingVectorViewBox.width,buildingVectorViewBox.height].join(' '));
    layer.setAttribute('preserveAspectRatio','none');layer.classList.add('parcel-vector-hit-layer');
    if(parcelVectorRegions.size){
      ordered.forEach(row=>{
        if(!matches(row)||row.data.mapPositionUnavailable)return;
        const d=parcelVectorRegions.get(key(row));if(!d)return;
        const shape=document.createElementNS(ns,'path');
        shape.setAttribute('d',d);shape.classList.add('parcel-vector-hit');
        if(views.contact&&recordsLoaded&&hasOwnerData(row))shape.classList.add('parcel-vector-contact-highlight');
        if(views.building&&buildingState(row)==='building')shape.classList.add('parcel-vector-building-highlight');
        if(views.lh&&hasLh(row))shape.classList.add('parcel-vector-lh-highlight');
        if(views.households&&householdsOf(row))shape.classList.add('parcel-vector-hh-'+householdsOf(row));
        shape.setAttribute('role','button');shape.setAttribute('tabindex','0');
        shape.setAttribute('aria-label',parcelLabel(row)+' 필지 자료 · '+contactStates[contactState(row)].label);
        shape.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();show(row);});
        shape.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();show(row);}});
        layer.append(shape);
      });
      overlay.append(layer);return;
    }
    // The PDF often fills a whole subblock with one path. Do not stack an
    // identical click target for every parcel: the last one would win everywhere.
    const groups=new Map();
    ordered.forEach(row=>{
      if(!matches(row)||row.data.mapPositionUnavailable)return;
      const sourceShape=findVectorParcelShape(row);
      if(!sourceShape)return;
      if(!groups.has(sourceShape))groups.set(sourceShape,[]);
      groups.get(sourceShape).push(row);
    });
    groups.forEach((parcelRows,sourceShape)=>{
      const row=parcelRows[0];
      const clone=document.importNode(sourceShape,true);
      const matrix=parcelShapeMatrix(sourceShape);
      clone.removeAttribute('id');clone.removeAttribute('class');clone.removeAttribute('style');clone.removeAttribute('fill');clone.removeAttribute('stroke');
      clone.removeAttribute('clip-path');clone.removeAttribute('filter');clone.removeAttribute('mask');clone.removeAttribute('transform');
      if(matrix)clone.setAttribute('transform',`matrix(${matrix.a} ${matrix.b} ${matrix.c} ${matrix.d} ${matrix.e} ${matrix.f})`);
      clone.classList.add('parcel-vector-hit');
      if(views.contact&&recordsLoaded&&parcelRows.length===1&&hasOwnerData(row))clone.classList.add('parcel-vector-contact-highlight');
      if(views.building&&parcelRows.length===1&&buildingState(row)==='building')clone.classList.add('parcel-vector-building-highlight');
      if(views.lh&&parcelRows.length===1&&hasLh(row))clone.classList.add('parcel-vector-lh-highlight');
      if(views.households&&parcelRows.length===1&&householdsOf(row))clone.classList.add('parcel-vector-hh-'+householdsOf(row));
      const registration=contactStates[contactState(row)].label;
      clone.setAttribute('role','button');clone.setAttribute('tabindex','0');
      clone.setAttribute('aria-label',parcelLabel(row)+' 필지 자료 · '+registration);
      clone.addEventListener('click',event=>{
        event.preventDefault();event.stopPropagation();
        const rect=overlay.getBoundingClientRect();
        if(!rect.width||!rect.height)return;
        const x=(event.clientX-rect.left)/rect.width*100,y=(event.clientY-rect.top)/rect.height*100;
        // Compare in original drawing units, so a wide page does not distort distance.
        const nearest=parcelRows.reduce((best,item)=>{
          const distance=item=>Math.hypot((Number(item.x)-x)*buildingVectorViewBox.width,(Number(item.y)-y)*buildingVectorViewBox.height);
          return distance(item)<distance(best)?item:best;
        });
        show(nearest);
      });
      clone.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();show(row);}});
      layer.append(clone);
    });
    overlay.append(layer);
  }
  const buildingFields = ['buildingName','buildingPurpose','buildingFloors','buildingFootprint','buildingTotalArea','buildingApproval','buildingStructure','buildingDeposit','buildingRent'];
  const numericFields = ['area','households','buildingFootprint','buildingTotalArea'];
  const fields = [...buildingFields,'address','landType','households','building','area','supplyPrice','auctionPrice','salePrice','owner','contact','note'];
  const priceFields = ['supplyPrice','auctionPrice','salePrice','buildingDeposit','buildingRent'];
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
    window.HitopParcelNotes?.close();
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
      (!recordsLoaded || $('parcelContactFilter').value === 'all' || contactState(row) === $('parcelContactFilter').value) &&
      ($('parcelDataFilter').value==='all'||dataState(row)===$('parcelDataFilter').value) &&
      window.HitopParcelSearch.matches(row,current,$('parcelSearchInput').value,noteSearchTexts.get(key(row))||'');
  }
  function show(row) {
    if (busy || window.HitopParcelNotes?.busy) return;
    placing = false; $('parcelAdd').setAttribute('aria-pressed','false');
    selected = {...row, data: {...row.data}};
    $('parcelForm').reset();
    $('parcelSubblock').value = row.subblock || ''; $('parcelNumber').value = row.parcel || '';
    $('parcelSubblock').readOnly = !!(row.points || row.sourceCell || hasLh(row)); $('parcelNumber').readOnly = !!(row.points || row.sourceCell || hasLh(row));
    const official=window.HitopLandLh?.find(current.id,row);
    const values = {...{landType: current.types?.find(type=>type!=='unknown') || 'single',building:''},...row.data,...(!row.id&&official?{landType:official.landType}:{})};
    if(!['single','shop'].includes(values.landType)) values.landType = current.types?.find(type=>type!=='unknown') || 'single';
    if(values.households==null||values.households==='') values.households = row.source?.households ?? '';
    if (!['building','vacant'].includes(values.building)) values.building = '';
    const detail=$('parcelSourceDetail'); detail.hidden=!row.source;
    if(row.source) detail.textContent=(row.source.date||sourceMeta?.sourceDate||'기준일 미기재')+' 원본'+(row.source.kind?'('+row.source.kind+')':'')+' · '+row.source.status+'\n건폐율 '+row.source.coverage+'% 이하 · 용적률 '+row.source.floorRatio+'% 이하 · '+row.source.floors+'층 이하'+(row.source.households?' · '+row.source.households+'가구 이하':'')+(row.source.unitPriceWon?' · 단가 '+row.source.unitPriceWon.toLocaleString('ko-KR')+'원/㎡ · 평당가 '+Math.round(row.source.unitPriceWon*3.305785).toLocaleString('ko-KR')+'원/평':'')+(row.source.reviewNote?'\n확인사항: '+row.source.reviewNote:'');
    fields.forEach(name => {
      if (name === 'building') $('parcel-building').checked = values.building === 'building';
      else $('parcel-' + name).value = priceFields.includes(name) ? money(values[name] == null ? null : Number(values[name]) * 10000) : values[name] ?? '';
    });
    $('parcelLhDetail').hidden = true; $('parcelLhDetail').replaceChildren();
    $('parcelOwnershipDetail').textContent=window.HitopParcelOwnership.detail(row);
    updateArea();
    updateBuildingSection();
    updateParcelLabel();
    $('parcelEditor').hidden = false; $('parcelDelete').hidden = !row.id;
    if (!$('parcelEditor').open) $('parcelEditor').showModal();
    $('parcelEditor').scrollTop = 0;
    window.HitopParcelNotes?.open({block_id:current.id,subblock:row.subblock||'',parcel:row.parcel||''});
    draw();
    status('');
  }
  function combinedParcels() {
    const combined = new Map(cells.map(cell => [key(cell),{...cell,data:{...cell.data}}]));
    rows.forEach(row => {
      const base=combined.get(key(row));
      const merged={...base,...row,data:{...base?.data,...row.data}};
      if(base){
        if(base.sourceCell && base.x!=null && base.y!=null && !base.data?.mapPositionUnavailable){merged.x=base.x;merged.y=base.y;merged.points=base.points;delete merged.data.mapPositionUnavailable;}
        if(row.x==null||row.x===''||!Number.isFinite(Number(row.x)))merged.x=base.x;
        if(row.y==null||row.y===''||!Number.isFinite(Number(row.y)))merged.y=base.y;
        if(base.sourceCell || !Array.isArray(row.points)||!row.points.length)merged.points=base.points;
        if(row.sourceCell==null)merged.sourceCell=base.sourceCell;
        if(row.source==null)merged.source=base.source;
        if(row.sourcePage==null)merged.sourcePage=base.sourcePage;
      }
      combined.set(key(row),merged);
    });
    return combined;
  }
  function renderRules() {
    const el=$('detailRules'); if(!el||!current)return;
    const list=[...combinedParcels().values()].filter(row=>row.source&&row.source.coverage!=null&&row.source.floorRatio!=null);
    if(!list.length){el.hidden=true;el.textContent='';return;}
    const tally=new Map();
    list.forEach(row=>{const s=row.source,k=[s.coverage,s.floorRatio,s.floors,s.households??''].join('|');tally.set(k,(tally.get(k)||0)+1);});
    const text=k=>{const [c,f,fl,hh]=k.split('|');return '건폐율 '+c+'% 이하 · 용적률 '+f+'% 이하 · '+fl+'층 이하'+(hh?' · 허용 '+hh+'가구 이하':'');};
    const sorted=[...tally.entries()].sort((a,b)=>b[1]-a[1]);
    el.textContent=sorted.length===1?text(sorted[0][0]):'⚠ 필지별로 다른 값이 있습니다 · '+sorted.map(([k,n])=>text(k)+' ('+n+'필지)').join(' / ');
    el.hidden=false;
  }
  function draw() {
    overlay.replaceChildren(); areaLabelOverlay?.replaceChildren(); $('parcelList').replaceChildren(); viewLegend(); renderRules();
    window.HitopLandLh?.setMapViews(current.id,rows,views);
    const combined = combinedParcels();
    $('parcelSourceBody').replaceChildren();$('parcelList').hidden=!!sourceMeta;
    if(sourceMeta) sourceMeta.subblocks.forEach(group=>{
      const shape=document.createElementNS(ns,'circle');shape.setAttribute('cx',group.x/100);shape.setAttribute('cy',group.y/100);shape.setAttribute('r','.01');shape.classList.add('source-subblock');shape.setAttribute('role','button');shape.setAttribute('tabindex','0');shape.setAttribute('aria-label',current.name+'-'+group.number+' 토지목록 보기');
      const choose=()=>{$('parcelSubblockFilter').value=String(group.number);draw();$('parcelSourceSection').scrollIntoView({behavior:'smooth',block:'start'});};shape.addEventListener('click',choose);shape.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();choose();}});overlay.append(shape);
    });
    const ordered = [...combined.values()].sort((a,b) => a.subblock.localeCompare(b.subblock,'ko',{numeric:true}) || a.parcel.localeCompare(b.parcel,'ko',{numeric:true}));
    let count = 0;
    ordered.forEach(row => {
      if (!matches(row)) return; count++;
      const registration = contactStates[contactState(row)].label+(views.ownership?' · '+window.HitopParcelOwnership.label(row):'')+(views.data&&dataLabel(row)?' · '+dataLabel(row):'');
      const useVectorHit=!!(sourceMeta&&parcelVectorRegions.has(key(row)));
      const positioned=!row.data.mapPositionUnavailable&&Number.isFinite(Number(row.x))&&Number.isFinite(Number(row.y))&&row.x!=null&&row.y!=null;
      if(!useVectorHit&&positioned){
        const shape = document.createElementNS(ns,row.points ? 'polygon' : 'circle');
        if (row.points) shape.setAttribute('points',row.points.map(p => p[0]/318 + ',' + p[1]/385).join(' '));
        else {shape.setAttribute('cx',Number(row.x)/100);shape.setAttribute('cy',Number(row.y)/100);shape.setAttribute('r',row.sourceCell?'.006':'.015');}
        shape.classList.add('parcel-shape'); if(views.building && buildingState(row)==='building' && row.points) shape.classList.add('parcel-building-building');
        if(views.contact&&recordsLoaded&&hasOwnerData(row)&&row.points)shape.classList.add('parcel-contact-highlight');
        if(views.lh&&hasLh(row)&&row.points)shape.classList.add('parcel-lh-highlight');
        if(views.households&&householdsOf(row)&&row.points)shape.classList.add('parcel-hh-'+householdsOf(row));
        shape.setAttribute('role','button');shape.setAttribute('tabindex','0');shape.setAttribute('aria-label',parcelLabel(row) + ' 필지 자료 · ' + registration);
        const title=document.createElementNS(ns,'title');title.textContent=parcelLabel(row) + ' · ' + registration;shape.append(title);
        shape.addEventListener('click',event=>{event.stopPropagation();show(row);});
        shape.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();show(row);}});overlay.append(shape);
      }
      addMapLabel(row);
      if(sourceMeta){appendSourceRow(row);return;}
      const button=document.createElement('button');button.type='button';button.className='block-button';
      button.textContent=parcelLabel(row);
      const note=document.createElement('small');note.textContent=registration;button.append(note);button.addEventListener('click',()=>show(row));$('parcelList').append(button);
    });
    appendVectorParcelHitAreas(ordered);
    ordered.filter(matches).forEach(addMissingOwnerMarker);
    if(sourceMeta)$('parcelSourceSummary').textContent='원본 토지목록 '+cells.length+'개 · 현재 표시 '+count+'개';
    const dataCounts={present:0,missing:0,unknown:0};combined.forEach(row=>dataCounts[dataState(row)]++);
    $('parcelCount').textContent='자료 있음 '+dataCounts.present+'개 · 자료 없음 '+dataCounts.missing+'개'+(dataCounts.unknown?' · 확인 불가 '+dataCounts.unknown+'개':'')+' · 현재 표시 '+count+'개';
    $('parcelListEmpty').hidden = !!count;
  }
  function updateArea() {
    const area = Number($('parcel-area').value), pyeong = area / 3.305785;
    $('parcelAreaPyeong').value = area > 0 && Number.isFinite(area) ? pyeong.toLocaleString('ko-KR',{minimumFractionDigits:2,maximumFractionDigits:2}) : '';
    ['supplyPrice','auctionPrice','salePrice'].forEach(name => {
      const won = readWon($('parcel-' + name).value);
      $('parcel-' + name + 'PerPyeong').value = won != null && Number.isFinite(won) && area > 0 ? money(won / pyeong) : '';
    });
  }
  function appendSourceRow(row){
    const tr=document.createElement('tr');
    const area=row.data.area;const price=row.source?.supplyPriceWon;
    const values=[parcelLabel(row),row.data.address||'원본 미기재',area==null?'미기재':Number(area).toLocaleString('ko-KR')+'㎡ / '+(Number(area)/3.305785).toFixed(2)+'평',price==null?'원본 금액 미기재':money(price)+'원'];
    values.forEach(value=>{const td=document.createElement('td');td.textContent=value;tr.append(td);});
    const td=document.createElement('td'), state=contactState(row), badge=document.createElement('span');badge.className='parcel-contact-badge parcel-contact-'+state;badge.textContent=contactStates[state].symbol+' '+contactStates[state].label+(views.ownership?' · '+window.HitopParcelOwnership.label(row):'')+(views.data&&dataLabel(row)?' · '+dataLabel(row):'');
    const btn=document.createElement('button');btn.type='button';btn.className='btn';btn.textContent=row.id?'자료 수정':'자료 보기·등록';btn.addEventListener('click',()=>show(row));td.append(badge,btn);tr.append(td);$('parcelSourceBody').append(tr);
  }
  async function open(block, image) {
    noteParcelKeys=new Set();noteKnownKeys=new Set();notesLoaded=false;noteSearchTexts=new Map();pendingSearchParcel=null;$('parcelSearchInput').value='';
    $('parcelDataFilter').value='all';$('parcelDataFilter').disabled=true;
    $('parcelOwnershipSnapshot').textContent='소유 구분 현황 · 저장 자료를 불러오는 중입니다.';
    $('parcelBuildingSnapshot').textContent='건물 업데이트 현황 · 저장 자료를 불러오는 중입니다.';
    const run = ++generation; $('parcelBuildingUpdate').textContent='업데이트'; $('parcelBuildingUpdate').disabled=false; current=block; rows=[]; cells=[]; sourceMeta=null; $('lhParcelSection').hidden=true;{const r=$('detailRules');if(r){r.hidden=true;r.textContent='';}} parcelVectorRegions=new Map(); if(buildingVectorUrl){URL.revokeObjectURL(buildingVectorUrl);buildingVectorUrl=null;} buildingVectorOverlay=null; buildingVectorCandidates=[]; buildingVectorViewBox=null; selected=null; placing=false; recordsLoaded=false;sourcesLoaded=false;
    $('parcelSourceSection').hidden=true;$('parcelSourceDetail').hidden=true;$('parcelList').hidden=false;
    $('parcelViewControls').hidden=!image; $('parcelViewLegend').hidden=!image;
    closeEditor(); $('parcelManager').hidden=!image;
    if (!image) return;
    stage=document.createElement('div');stage.className='parcel-stage';stage.style.width='100%';
    image.replaceWith(stage);image.style.width='100%';stage.append(image);
    overlay=document.createElementNS(ns,'svg');overlay.setAttribute('viewBox','0 0 1 1');overlay.setAttribute('preserveAspectRatio','none');overlay.classList.add('parcel-overlay');stage.append(overlay);
    areaLabelOverlay=document.createElement('div');areaLabelOverlay.className='parcel-area-label-overlay';areaLabelOverlay.setAttribute('aria-hidden','true');stage.append(areaLabelOverlay);
    $('parcelBuildingFilter').value='all';$('parcelTypeFilter').value='all';$('parcelContactFilter').value='all';$('parcelContactFilter').disabled=true;$('parcelAdd').setAttribute('aria-pressed','false');
    $('parcelHelp').textContent=window.HitopLandBlockSource.has(block.id)?'PDF 원본 벡터 도면입니다. 파란 소블럭 번호를 누르면 해당 토지목록이 나오고, 개별 필지번호를 누르면 자료가 열립니다.':block.id==='third-C18'?'원본 도면의 해상도를 높인 이미지입니다. 필지를 누르면 세부자료가 열립니다. 번호는 소블럭-필지번호 순서입니다.':'필지 등록을 누른 뒤 도면의 해당 필지 위치를 눌러 자료를 입력하세요.';
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
        window.HitopLandBlockSource.has(block.id) ? window.HitopLandBlockSource.load(block.id) :
        Promise.resolve([]),
        window.HitopParcelNotes.listParcelsWithNotes(block.id,true)
      ]);
      if(run!==generation)return;
      rows=results[0].status==='fulfilled'?results[0].value:[];
      recordsLoaded=results[0].status==='fulfilled';sourcesLoaded=results[1].status==='fulfilled';$('parcelContactFilter').disabled=!recordsLoaded;
      notesLoaded=results[2].status==='fulfilled';noteParcelKeys=new Set(notesLoaded?results[2].value.map(r=>key(r)):[]);$('parcelDataFilter').disabled=!recordsLoaded||!sourcesLoaded;
      if(notesLoaded)results[2].value.forEach(r=>noteSearchTexts.set(key(r),(noteSearchTexts.get(key(r))||'')+' '+(r.body||'')));
      if(results[1].status==='fulfilled'){
        if(window.HitopLandBlockSource.has(block.id)){
          sourceMeta=results[1].value.source_data;cells=sourceMeta.parcels;setupBuildingVectorOverlay(results[1].value.diagram_svg);$('parcelSourceSection').hidden=false;
          $('parcelSubblockFilter').replaceChildren(new Option(block.name+' 전체','all'),...sourceMeta.subblocks.map(g=>new Option(block.name+'-'+g.number,String(g.number))));
        }else cells=results[1].value;
      }
      $('lhParcelSection').hidden = true; $('lhParcelSection').replaceChildren();
      draw();status(results[0].status==='rejected'?'원본 도면·목록은 확인할 수 있습니다. '+(results[0].reason.message||'저장 자료를 불러오지 못했습니다.'):results[1].status==='rejected'?results[1].reason.message:'필지를 선택해 세부자료를 확인하세요.');
      if(pendingSearchParcel?.blockId===block.id){const target=pendingSearchParcel;pendingSearchParcel=null;focusSearchParcel(target.blockId,target.subblock,target.parcel);}
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
  ['building','contact','ownership','households','data'].forEach(name=>{const id=name==='lh'?'parcelLhToggle':'parcel'+name[0].toUpperCase()+name.slice(1)+'Toggle';$(id).addEventListener('click',()=>{views[name]=!views[name];$(id).setAttribute('aria-pressed',String(views[name]));if(overlay&&current)draw();});});
  $('parcelForm').addEventListener('submit',async event=>{
    event.preventDefault(); if(busy || window.HitopParcelNotes?.busy || !selected)return;
    const run=generation,blockId=current.id;
    const subblock=$('parcelSubblock').value.trim(),parcel=$('parcelNumber').value.trim();
    if(!subblock||!parcel){status('소블럭과 필지번호를 입력해주세요.');return;}
    const data={...selected.data};fields.forEach(name=>{const value=name==='building'?($('parcel-building').checked?'building':'vacant'):$('parcel-'+name).value.trim();data[name]=priceFields.includes(name)?(value===''?null:readWon(value)/10000):numericFields.includes(name)?(value===''?null:Number(value)):value;});
    data.managementSavedAt=new Date().toISOString();
    const body={block_id:blockId,subblock,parcel,x:selected.x??0,y:selected.y??0,data,updated_at:new Date().toISOString()};
    busy=true;$('parcelSave').disabled=true;status('저장 중입니다.');
    try{
      const result=await request(selected.id?'?id=eq.'+encodeURIComponent(selected.id):'',{method:selected.id?'PATCH':'POST',body:JSON.stringify(body)});
      if(!result[0])throw Error('저장 결과를 확인하지 못했습니다.');
      if(run!==generation)return;
      const index=rows.findIndex(row=>row.id===result[0].id);if(index<0)rows.push(result[0]);else rows[index]=result[0];
      selected={...selected,...result[0]};window.HitopParcelNotes?.open({block_id:blockId,subblock,parcel});updateParcelLabel();$('parcelDelete').hidden=false;draw();status('저장되었습니다. 다른 기기에서도 같은 자료를 확인할 수 있습니다.');window.dispatchEvent(new CustomEvent('parcel-search-invalidate',{detail:{block_id:blockId}}));
    }catch(error){if(run===generation)status(error.message);}finally{busy=false;$('parcelSave').disabled=false;}
  });
  $('parcelDelete').addEventListener('click',async()=>{
    if(busy||window.HitopParcelNotes?.busy||!selected?.id||!confirm('이 필지의 등록 자료를 삭제할까요? 도면의 필지는 남습니다.'))return;
    const run=generation,id=selected.id;busy=true;
    try{await request('?id=eq.'+encodeURIComponent(id),{method:'DELETE'});if(run!==generation)return;rows=rows.filter(row=>row.id!==id);closeEditor();draw();status('등록 자료를 삭제했습니다.');window.dispatchEvent(new CustomEvent('parcel-search-invalidate',{detail:{block_id:current.id}}));}catch(error){status(error.message);}finally{busy=false;}
  });
  ['parcelClose','parcelModalClose'].forEach(id=>$(id).addEventListener('click',closeEditor));
  $('parcelEditor').addEventListener('close',()=>{if (!$('parcelEditor').open) { $('parcelEditor').hidden=true; window.HitopParcelNotes?.close(); }});
  $('parcelEditor').addEventListener('click',event=>{
    if (event.target !== $('parcelEditor')) return;
    const rect = $('parcelEditor').getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closeEditor();
  });
  $('parcelAdd').addEventListener('click',()=>{if(busy)return;placing=!placing;$('parcelAdd').setAttribute('aria-pressed',String(placing));status(placing?'도면에서 등록할 필지 위치를 눌러주세요.':'위치 지정을 취소했습니다.');});
  $('parcelSearchInput').addEventListener('input',()=>{if(overlay&&current)draw();});
  $('parcelSearchForm').addEventListener('submit',event=>{event.preventDefault();if(!overlay||!current)return;['parcelSubblockFilter','parcelBuildingFilter','parcelTypeFilter','parcelContactFilter','parcelDataFilter'].forEach(id=>$(id).value='all');draw();status('검색 결과 · '+$('parcelCount').textContent);});
  $('parcelSubblockFilter').addEventListener('change',draw);
  ['parcelSubblock','parcelNumber'].forEach(id=>$(id).addEventListener('input',updateParcelLabel));
  priceFields.forEach(name=>$('parcel-'+name).addEventListener('input',event=>formatPriceInput(event.target)));
  $('parcel-area').addEventListener('input',updateArea);
  ['parcelBuildingFilter','parcelTypeFilter','parcelContactFilter','parcelDataFilter'].forEach(id=>$(id).addEventListener('change',draw));

  function updateBuildingSection() {
    const checked=$('parcel-building').checked;
    $('parcelBuildingDetails').hidden=!checked;
    $('parcelSaleLabel').textContent=checked?'토지+건물 매매금액 (원)':'매매금액 (원)';
    ['buildingFootprint','buildingTotalArea'].forEach(name=>{
      const raw=$('parcel-'+name).value,n=Number(raw);
      $('parcel-'+name+'Pyeong').value=raw!==''&&Number.isFinite(n)?(n/3.305785).toLocaleString('ko-KR',{maximumFractionDigits:2}):'';
    });
    const check=selected?.data.buildingCheck;
    $('parcelBuildingChecked').textContent=check?'최근 확인: '+new Date(check.checkedAt).toLocaleString('ko-KR')+' · '+(check.status==='found'?'건축물대장 확인':'추가 확인 필요'):'';
  }
  async function lookupParcelBuilding(address) {
    if(!/[가-힣]+(?:동|리)\s+(?:산\s*)?\d+/.test(address||''))throw Error('실제 지번주소를 먼저 입력해주세요.');
    const {data,error}=await hitopAuthClient.auth.getSession();
    if(error||!data.session)throw Error('로그인 상태를 확인해주세요.');
    const res=await fetchWithTimeout(SUPABASE_URL+'/functions/v1/lookup-building-register',{
      method:'POST',headers:{apikey:SUPABASE_KEY,Authorization:'Bearer '+data.session.access_token,'Content-Type':'application/json'},
      body:JSON.stringify({address})
    },60000);
    const info=await res.json();
    if(!res.ok)throw Error(res.status===404?'건축물대장 미조회 · 건물 없음으로 확정하지 않았습니다.':'건축물대장 조회에 실패했습니다. 잠시 후 다시 시도해주세요.');
    return window.HitopParcelBuilding.fromRegister(info,address);
  }
  $('parcel-building').addEventListener('change',updateBuildingSection);
  ['buildingFootprint','buildingTotalArea'].forEach(name=>$('parcel-'+name).addEventListener('input',updateBuildingSection));
  $('parcelBuildingLookup').addEventListener('click',async()=>{
    if(busy||!selected)return;
    const run=generation,target=selected,address=$('parcel-address').value.trim(),button=$('parcelBuildingLookup');
    busy=true;button.disabled=true;$('parcelSave').disabled=true;status('건축물대장을 조회 중입니다.');
    try{
      const result=await lookupParcelBuilding(address);
      if(run!==generation||selected!==target||!$('parcelEditor').open)return;
      if($('parcel-address').value.trim()!==address){status('주소가 변경되었습니다. 다시 조회해주세요.');return;}
      selected.data.buildingCheck=result.buildingCheck;
      Object.entries(result).forEach(([name,value])=>{if(buildingFields.includes(name))$('parcel-'+name).value=value;});
      $('parcel-building').checked=true;updateBuildingSection();
      status(result.buildingCheck.multiple?'건물은 확인했습니다. 대장이 여러 건이므로 건물 세부내용은 원본과 대조해 입력해주세요. 저장 버튼을 눌러 반영하세요.':'건물 정보를 채웠습니다. 세부자료 저장을 눌러 반영하세요.');
    }catch(error){if(run===generation&&selected===target)status(error.message);}
    finally{busy=false;button.disabled=false;$('parcelSave').disabled=false;}
  });
  let buildingUpdateRun=null;
  $('parcelBuildingUpdate').addEventListener('click',async()=>{
    if(buildingUpdateRun){buildingUpdateRun.cancelled=true;return;}
    if(busy||window.HitopParcelNotes?.busy||!current)return;
    if(!recordsLoaded){status('저장 자료를 불러온 뒤 다시 시도해주세요.');return;}
    closeEditor();selected=null;placing=false;$('parcelAdd').setAttribute('aria-pressed','false');
    const task={generation,blockId:current.id,batchId:crypto.randomUUID(),cancelled:false};buildingUpdateRun=task;busy=true;
    const button=$('parcelBuildingUpdate');button.textContent='업데이트 중지';
    const targets=[...combinedParcels().values()];
    let found=0,review=0,skipped=0,completed=0,saveErrors=0,anchor=null;
    try{
      for(const row of targets){
        if(task.cancelled||task.generation!==generation)break;
        const address=String(row.data.address||'').trim();
        if(!/[가-힣]+(?:동|리)\s+(?:산\s*)?\d+/.test(address)){skipped++;completed++;continue;}
        status('건물 현황 확인 '+(completed+1)+' / '+targets.length+' · '+address);
        let changes;
        try{changes=await lookupParcelBuilding(address);changes.buildingCheck.batchId=task.batchId;changes.buildingCheckAttempt=null;found++;}
        catch(error){changes={buildingCheckAttempt:{status:'review',address,checkedAt:new Date().toISOString(),source:'건축물대장',batchId:task.batchId}};review++;}
        if(task.cancelled||task.generation!==generation)break;
        // Fetch the latest office record before merging to retain edits from other devices.
        try{
          const latest=await request('?block_id=eq.'+encodeURIComponent(task.blockId)+'&subblock=eq.'+encodeURIComponent(row.subblock)+'&parcel=eq.'+encodeURIComponent(row.parcel));
          if(task.cancelled||task.generation!==generation)break;
          const saved=latest[0],base={...row.data,...saved?.data};
          if(String(base.address||'').trim()!==address){skipped++;completed++;continue;}
          const data={...base,...changes};
          const body={block_id:task.blockId,subblock:row.subblock,parcel:row.parcel,x:saved?.x??row.x??0,y:saved?.y??row.y??0,data,updated_at:new Date().toISOString()};
          const result=await request(saved?'?id=eq.'+encodeURIComponent(saved.id):'',{method:saved?'PATCH':'POST',body:JSON.stringify(body)});
          if(!result[0])throw Error('저장 실패');
          anchor=result[0];
          if(task.generation!==generation)break;
          const index=rows.findIndex(item=>key(item)===key(row));
          if(index<0)rows.push(result[0]);else rows[index]=result[0];
          draw();
        }catch(error){saveErrors++;}
        completed++;
        if(saveErrors>=3){task.cancelled=true;break;}
      }
      // Record the block's completion date only after all target writes succeeded.
      // Keep it in the existing private JSONB record, so every device reads the same date.
      if(!task.cancelled&&task.generation===generation&&!saveErrors&&anchor){
        try{
          const latest=await request('?id=eq.'+encodeURIComponent(anchor.id));
          if(!latest[0])throw Error('업데이트 기록을 저장할 필지가 없습니다.');
          if(!task.cancelled&&task.generation===generation){
            const data={...latest[0].data,buildingSnapshot:{batchId:task.batchId,completedAt:new Date().toISOString(),found,review,skipped,total:targets.length}};
            const result=await request('?id=eq.'+encodeURIComponent(anchor.id),{method:'PATCH',body:JSON.stringify({data})});
            if(!result[0])throw Error('업데이트 날짜 저장 실패');
            if(task.generation===generation){const index=rows.findIndex(item=>item.id===anchor.id);if(index>=0)rows[index]=result[0];draw();}
          }
        }catch(error){saveErrors++;}
      }
      if(task.generation===generation)status((task.cancelled?'업데이트 중지 · 저장된 일부 결과 유지 · ':saveErrors?'일부 저장 · 업데이트 날짜 갱신 실패 · ':!anchor?'조회 가능한 지번주소가 없어 업데이트 날짜를 유지했습니다. · ':'업데이트 완료 · ')+'건물 확인 '+found+'건 · 추가 확인 '+review+'건 · 주소 미확인/변경 '+skipped+'건'+(saveErrors?' · 저장 실패 '+saveErrors+'건':''));
    }finally{
      window.dispatchEvent(new CustomEvent('parcel-search-invalidate',{detail:{block_id:task.blockId}}));
      buildingUpdateRun=null;busy=false;button.textContent='업데이트';button.disabled=false;
    }
  });

  let ownershipUpdateRun=null;
  async function lookupParcelOwnership(address,probe=false){
    const {data,error}=await hitopAuthClient.auth.getSession();
    if(error||!data.session)throw Error('로그인 상태를 확인해주세요.');
    const response=await fetchWithTimeout(SUPABASE_URL+'/functions/v1/lookup-land-ownership',{
      method:'POST',headers:{apikey:SUPABASE_KEY,Authorization:'Bearer '+data.session.access_token,'Content-Type':'application/json'},body:JSON.stringify(probe?{probe:true}:{address})
    },60000);
    let result={};try{result=await response.json();}catch(_){}
    if(!response.ok){const e=Error(result.error||'소유 구분을 조회하지 못했습니다.');e.fatal=[401,403,503].includes(response.status)||result.code==='UPSTREAM_AUTH';throw e;}
    if(probe){if(!result.configured)throw Error('소유 구분 조회 인증키 연결이 필요합니다. 기존 저장 자료는 유지됩니다.');return result;}
    if(!['person','corporation','other','unknown'].includes(result.category))throw Error('소유 구분 응답을 확인하지 못했습니다.');
    return {...result,address,checkedAt:new Date().toISOString()};
  }
  $('parcelOwnershipUpdate').addEventListener('click',async()=>{
    if(ownershipUpdateRun){ownershipUpdateRun.cancelled=true;return;}
    if(busy||window.HitopParcelNotes?.busy||!current)return;
    if(!recordsLoaded){status('저장 자료를 불러온 뒤 다시 시도해주세요.');return;}
    closeEditor();selected=null;placing=false;$('parcelAdd').setAttribute('aria-pressed','false');
    const task={generation,blockId:current.id,batchId:crypto.randomUUID(),cancelled:false};ownershipUpdateRun=task;busy=true;
    const button=$('parcelOwnershipUpdate');button.textContent='업데이트 중지';
    const targets=[...combinedParcels().values()];
    let found=0,review=0,skipped=0,completed=0,saveErrors=0,anchor=null,lastError='',dateSaved=false;
    try{
      await lookupParcelOwnership('',true);
      for(const row of targets){
        if(task.cancelled||task.generation!==generation)break;
        const address=String(row.data.address||'').trim();
        if(!/[가-힣]+(?:동|리)\s+(?:산\s*)?\d+/.test(address)){skipped++;completed++;continue;}
        status('소유 구분 조회 '+(completed+1)+' / '+targets.length+' · '+address);
        let changes;
        try{const check=await lookupParcelOwnership(address);check.batchId=task.batchId;changes={ownershipCheck:check,ownershipCheckAttempt:null};}
        catch(error){
          lastError=error.message;
          if(error.fatal){task.cancelled=true;break;}
          changes={ownershipCheckAttempt:{status:'review',address,checkedAt:new Date().toISOString(),batchId:task.batchId}};review++;
        }
        if(task.cancelled||task.generation!==generation)break;
        try{
          const latest=await request('?block_id=eq.'+encodeURIComponent(task.blockId)+'&subblock=eq.'+encodeURIComponent(row.subblock)+'&parcel=eq.'+encodeURIComponent(row.parcel));
          if(task.cancelled||task.generation!==generation)break;
          const saved=latest[0],base={...row.data,...saved?.data};
          if(String(base.address||'').trim()!==address){skipped++;completed++;continue;}
          const data={...base,...changes};
          if(row.x==null||row.y==null)data.mapPositionUnavailable=true;
          const body={block_id:task.blockId,subblock:row.subblock,parcel:row.parcel,x:saved?.x??row.x??0,y:saved?.y??row.y??0,data,updated_at:new Date().toISOString()};
          const result=await request(saved?'?id=eq.'+encodeURIComponent(saved.id):'',{method:saved?'PATCH':'POST',body:JSON.stringify(body)});
          if(!result[0])throw Error('저장 실패');
          anchor=result[0];if(changes.ownershipCheck)found++;
          if(task.generation!==generation)break;
          const index=rows.findIndex(item=>key(item)===key(row));if(index<0)rows.push(result[0]);else rows[index]=result[0];draw();
        }catch(error){saveErrors++;lastError=error.message;}
        completed++;
        if(saveErrors>=3){task.cancelled=true;break;}
      }
      if(!task.cancelled&&task.generation===generation&&!saveErrors&&!review&&anchor){
        const latest=await request('?id=eq.'+encodeURIComponent(anchor.id));
        if(!latest[0])throw Error('업데이트 기록을 저장할 필지가 없습니다.');
        if(!task.cancelled&&task.generation===generation){
          const data={...latest[0].data,ownershipSnapshot:{batchId:task.batchId,completedAt:new Date().toISOString(),found,skipped,total:targets.length}};
          const result=await request('?id=eq.'+encodeURIComponent(anchor.id),{method:'PATCH',body:JSON.stringify({data})});
          if(!result[0])throw Error('업데이트 날짜 저장 실패');
          dateSaved=true;
          if(task.generation===generation){const index=rows.findIndex(item=>item.id===anchor.id);if(index>=0)rows[index]=result[0];draw();}
        }
      }
      if(task.generation===generation)status((dateSaved?'소유 구분 업데이트 완료 · ':task.cancelled?'업데이트 중지 · 기존 완료 날짜 유지 · ':'일부 조회 또는 주소 미확인 · 기존 완료 날짜 유지 · ')+'조회 결과 '+found+'건 · 조회 실패 '+review+'건 · 주소 미확인/변경 '+skipped+'건'+(saveErrors?' · 저장 실패 '+saveErrors+'건':'')+(lastError?' · '+lastError:''));
    }catch(error){if(task.generation===generation)status(error.message);}
    finally{window.dispatchEvent(new CustomEvent('parcel-search-invalidate',{detail:{block_id:task.blockId}}));ownershipUpdateRun=null;busy=false;button.textContent='업데이트';button.disabled=false;}
  });

  $('parcelPrint').addEventListener('click',async()=>{
    if(busy||window.HitopParcelNotes?.busy||!selected||!current)return;
    if(!$('parcelSubblock').value.trim()||!$('parcelNumber').value.trim()){status('필지번호를 먼저 입력해주세요.');return;}
    const run=generation,target=selected,button=$('parcelPrint');
    const value=name=>$('parcel-'+name).value.trim();
    const model={
      mode:$('parcelPrintMode').value,
      includeLocation:$('parcelPrintLocation').checked,
      includeMemo:$('parcelPrintMemo').checked,
      includePhotos:$('parcelPrintPhotos').checked,
      title:$('parcelFullNumber').value,address:value('address'),
      landType:{single:'주거전용',shop:'상가점포'}[value('landType')]||'',
      area:value('area'),prices:{supplyPrice:readWon(value('supplyPrice')),auctionPrice:readWon(value('auctionPrice')),salePrice:readWon(value('salePrice'))},
      building:{exists:$('parcel-building').checked,confirmedVacant:selected.data.building==='vacant',name:value('buildingName'),purpose:value('buildingPurpose'),floors:value('buildingFloors'),structure:value('buildingStructure'),approval:value('buildingApproval'),footprint:value('buildingFootprint'),totalArea:value('buildingTotalArea'),deposit:readWon(value('buildingDeposit')),rent:readWon(value('buildingRent'))},
      owner:value('owner'),contact:value('contact'),note:value('note'),
      sourceText:!$('parcelSourceDetail').hidden?$('parcelSourceDetail').textContent:''
    };
    const image=stage?.querySelector('img');
    if(model.includeLocation&&image?.src){
      const positioned=!selected.data.mapPositionUnavailable&&selected.x!=null&&selected.y!=null&&selected.x!==''&&selected.y!=='';
      model.map={src:image.src,width:image.naturalWidth||image.width,height:image.naturalHeight||image.height,x:positioned?selected.x:null,y:positioned?selected.y:null};
      if(parcelVectorRegions.has(key(selected))&&buildingVectorViewBox){model.map.path=parcelVectorRegions.get(key(selected));model.map.viewBox=buildingVectorViewBox;}
      else if(selected.points?.length){model.map.path='M'+selected.points.map(point=>point[0]/318*100+','+point[1]/385*100).join('L')+'Z';}
    }
    const c={block_id:current.id,subblock:selected.subblock,parcel:selected.parcel};
    busy=true;button.disabled=true;status('선택한 인쇄 자료를 준비 중입니다.');
    try{
      if(model.includeMemo||model.includePhotos)model.notes=await window.HitopParcelNotes.listForPrint(c,model.includePhotos);
      if(run!==generation||selected!==target)return;
      await window.HitopParcelPrint.print(model);
      status('인쇄창에서 인쇄하거나 PDF로 저장할 수 있습니다.');
    }catch(error){if(run===generation)status('인쇄 자료를 준비하지 못했습니다. '+error.message);}
    finally{busy=false;button.disabled=false;}
  });

  window.addEventListener('parcel-notes-loaded',event=>{
    const c=event.detail;if(!current||c?.block_id!==current.id)return;
    const k=key(c);noteKnownKeys.add(k);if(c.hasNotes)noteParcelKeys.add(k);else noteParcelKeys.delete(k);
    if(overlay)draw();
  });
  function focusSearchParcel(blockId,subblock,parcel){
    if(!current||current.id!==blockId)return;
    if(!recordsLoaded){pendingSearchParcel={blockId,subblock,parcel};return;}
    const row=combinedParcels().get(String(subblock)+'-'+String(parcel));
    if(!row){status('선택한 필지를 현재 자료에서 찾지 못했습니다.');return;}
    $('parcelSearchInput').value='';
    ['parcelSubblockFilter','parcelBuildingFilter','parcelTypeFilter','parcelContactFilter','parcelDataFilter'].forEach(id=>$(id).value='all');
    show(row);
  }
  window.addEventListener('parcel-search-invalidate',async event=>{
    if(!current||event.detail?.block_id!==current.id)return;
    const run=generation,blockId=current.id;
    try{
      const list=await window.HitopParcelNotes.listParcelsWithNotes(blockId,true);
      if(run!==generation)return;
      notesLoaded=true;noteParcelKeys=new Set(list.map(key));noteSearchTexts=new Map();
      list.forEach(r=>noteSearchTexts.set(key(r),(noteSearchTexts.get(key(r))||'')+' '+(r.body||'')));
      $('parcelDataFilter').disabled=!recordsLoaded||!sourcesLoaded;if(overlay)draw();
    }catch{if(run===generation)status('메모 검색자료를 새로 불러오지 못했습니다. 다시 열어 확인해주세요.');}
  });
  window.HitopLandParcels={open,focusParcel:focusSearchParcel,close(){generation++;noteSearchTexts=new Map();pendingSearchParcel=null;noteParcelKeys=new Set();noteKnownKeys=new Set();notesLoaded=false;closeEditor();current=null;overlay=null;areaLabelOverlay=null;parcelVectorRegions=new Map();$('parcelViewControls').hidden=true;$('parcelViewLegend').hidden=true;rows=[];cells=[];sourceMeta=null;if(buildingVectorUrl){URL.revokeObjectURL(buildingVectorUrl);buildingVectorUrl=null;}buildingVectorOverlay=null;buildingVectorCandidates=[];buildingVectorViewBox=null;recordsLoaded=false;sourcesLoaded=false;selected=null;$('parcelSourceBody').replaceChildren();$('parcelList').replaceChildren();$('parcelForm').reset();$('parcelSourceDetail').textContent='';$('parcelModalStatus').textContent='';$('parcelManager').hidden=true;}};
})();
