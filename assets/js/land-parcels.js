/* Parcel records are private shared office data, protected by the existing admin RLS predicate. */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const ns = 'http://www.w3.org/2000/svg';
  let current = null, rows = [], cells = [], selected = null, stage = null, overlay = null, generation = 0, placing = false, busy = false;
  let sourceMeta = null, buildingVectorOverlay = null, buildingVectorCandidates = [], buildingVectorUrl = null, buildingVectorViewBox = null, recordsLoaded = false;
  let parcelVectorRegions = new Map();
  let areaLabelOverlay = null;
  const views = {area:false, building:false, contact:false, ownership:false, lh:false};
  const contactStates = {
    contact: {label:'연락처 있음', symbol:'●'},
    registered: {label:'자료 있음 · 연락처 없음', symbol:'×'},
    missing: {label:'자료 미등록', symbol:'×'},
    unknown: {label:'등록 상태 확인 불가', symbol:'?'}
  };
  function buildingState(row) { return ['building','vacant'].includes(row.data.building) ? row.data.building : 'unknown'; }
  function hasLh(row) { return !!(current&&window.HitopLandLh?.find(current.id,row)); }
  function hasContact(row) { return /\d{7,}/.test(String(row.data.contact || '').replace(/\D/g,'')); }
  function contactState(row) { return hasContact(row) ? 'contact' : !recordsLoaded ? 'unknown' : row.id ? 'registered' : 'missing'; }
  function viewLegend() {
    $('parcelBuildingSnapshot').textContent=recordsLoaded ? window.HitopParcelBuilding.savedSummary(rows) : '건물 업데이트 현황 · 저장 자료를 불러오지 못했습니다.';
    $('parcelOwnershipSnapshot').textContent=recordsLoaded ? window.HitopParcelOwnership.savedSummary(rows) : '소유 구분 현황 · 저장 자료를 불러오지 못했습니다.';
    const parts=[];
    if(views.building) parts.push('건물 있음: 파란색 강조 · 건물 없음/미입력: 원본 그대로');
    if(views.ownership) parts.push('소유 구분: 개인 / 법인 / 기타 / 미확인 · 저장된 자료 기준');
    if(views.contact) parts.push(recordsLoaded ? '연락처 있음: 빨간색 ● · 연락처 없음: ×' : '연락처 확인 불가 · 저장 자료를 불러오지 못했습니다');
    if(views.lh)parts.push('LH 공고중: 주황색 필지 · 연락처/건물 표시를 함께 켜면 해당 표시색 우선');
    $('parcelViewLegend').textContent=parts.join(' / ');$('parcelViewLegend').hidden=!parts.length;
  }
  function addMapLabel(row) {
    const area=Number(row.data.area), parts=[];
    if(views.area && Number.isFinite(area) && area>0) parts.push(views.area==='sqm'?area.toLocaleString('ko-KR',{maximumFractionDigits:1})+'㎡':(area/3.305785).toFixed(1)+'평');
    if(views.ownership) parts.push(window.HitopParcelOwnership.label(row));
    if(row.data.mapPositionUnavailable || !parts.length || (!row.points?.length && (row.x==null || row.y==null)))return;
    let x=Number(row.x)/100,y=Number(row.y)/100;
    if(row.points?.length){x=row.points.reduce((n,p)=>n+p[0],0)/row.points.length/318;y=row.points.reduce((n,p)=>n+p[1],0)/row.points.length/385;}
    if(!Number.isFinite(x)||!Number.isFinite(y))return;
    if(parts.length){
      const label=document.createElement('span');
      label.className='parcel-area-label'+(views.ownership?' parcel-ownership-label parcel-ownership-'+window.HitopParcelOwnership.state(row):'');
      label.style.left=(x*100)+'%';label.style.top=(y*100)+'%';
      label.textContent=parts.join(' ');
      areaLabelOverlay?.append(label);
    }
  }

  function addContactMarker(row) {
    if (!views.contact || !recordsLoaded || row.data.mapPositionUnavailable) return;
    let x = Number(row.x) / 100, y = Number(row.y) / 100;
    if (row.points?.length) {
      x = row.points.reduce((sum,point) => sum + point[0],0) / row.points.length / 318;
      y = row.points.reduce((sum,point) => sum + point[1],0) / row.points.length / 385;
    } else if (row.x == null || row.y == null || row.x === '' || row.y === '') return;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    if (hasContact(row)) {
      const dot = document.createElementNS(ns,'circle');
      dot.setAttribute('cx',x); dot.setAttribute('cy',y); dot.setAttribute('r','.0055');
      dot.classList.add('parcel-contact-dot'); dot.setAttribute('aria-hidden','true'); overlay.append(dot);
    } else {
      const d = 'M'+(x-.0035)+','+(y-.0035)+'L'+(x+.0035)+','+(y+.0035)+'M'+(x+.0035)+','+(y-.0035)+'L'+(x-.0035)+','+(y+.0035);
      for (const className of ['parcel-contact-cross-outline','parcel-contact-cross']) {
        const cross = document.createElementNS(ns,'path');
        cross.setAttribute('d',d); cross.classList.add(className);
        cross.setAttribute('aria-hidden','true'); overlay.append(cross);
      }
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
    const root=shape.ownerSVGElement,rootMatrix=root?.getCTM(),shapeMatrix=shape.getCTM();
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
    const vb=root.viewBox.baseVal,scale=3;
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
      let seed=-1;const x=Math.round(Number(row.x)/100*w),y=Math.round(Number(row.y)/100*h);
      for(let r=0;r<30&&seed<0;r++)for(let dy=-r;dy<=r&&seed<0;dy++)for(let dx=-r;dx<=r;dx++){
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
      const root=shape.ownerSVGElement,matrix=parcelShapeMatrix(shape);
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
        if(views.building&&buildingState(row)==='building')shape.classList.add('parcel-vector-building-highlight');
        if(views.lh&&hasLh(row))shape.classList.add('parcel-vector-lh-highlight');
        shape.setAttribute('role','button');shape.setAttribute('tabindex','0');
        shape.setAttribute('aria-label',parcelLabel(row)+' 필지 자료 · '+contactStates[contactState(row)].label);
        shape.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();show(row);});
        shape.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();show(row);}});
        layer.append(shape);
      });
      overlay.append(layer);return;
    }
    // The PDF often fills a whole subblock with one path. Do not stack an
    // identical click target for every parcel:…6706 tokens truncated…';
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
      buildingUpdateRun=null;busy=false;button.textContent='건물 현황 업데이트';button.disabled=false;
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
    finally{ownershipUpdateRun=null;busy=false;button.textContent='소유 구분 업데이트';button.disabled=false;}
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
      landType:{single:'주거전용',shop:'상가점포',unknown:'미확인'}[value('landType')],
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

  window.HitopLandParcels={open,close(){generation++;closeEditor();current=null;overlay=null;areaLabelOverlay=null;parcelVectorRegions=new Map();$('parcelViewControls').hidden=true;$('parcelViewLegend').hidden=true;rows=[];cells=[];sourceMeta=null;if(buildingVectorUrl){URL.revokeObjectURL(buildingVectorUrl);buildingVectorUrl=null;}buildingVectorOverlay=null;buildingVectorCandidates=[];buildingVectorViewBox=null;recordsLoaded=false;selected=null;$('parcelSourceBody').replaceChildren();$('parcelList').replaceChildren();$('parcelForm').reset();$('parcelSourceDetail').textContent='';$('parcelModalStatus').textContent='';$('parcelManager').hidden=true;}};
})();

