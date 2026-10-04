/* Parcel records are private shared office data, protected by the existing admin RLS predicate. */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const ns = 'http://www.w3.org/2000/svg';
  let current = null, rows = [], cells = [], selected = null, stage = null, overlay = null, generation = 0, placing = false, busy = false;
  let sourceMeta = null, buildingVectorOverlay = null, buildingVectorCandidates = [], buildingVectorUrl = null, buildingVectorViewBox = null, recordsLoaded = false, sourcesLoaded = false;
  let parcelVectorRegions = new Map();
  let parcelSplitKeys = new Set();
  let areaLabelOverlay = null;
  let noteParcelKeys=new Set(),noteKnownKeys=new Set(),notesLoaded=false,noteSearchTexts=new Map(),pendingSearchParcel=null;
  const views = {area:false, building:false, contact:false, ownership:false, households:false, unsold:false, data:false, lh:false};
  function isUnsold(row){const d=row?.data||{};const f=d.unsold!=null?d.unsold:row?.source?.unsold;return f===true&&!(Number(d.area)>0&&Number(d.supplyPrice)>0);}
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
    if(views.unsold) parts.push('미분양: 빨간색 필지 · 아직 공급 전이라 면적·공급가 없음');
    if(views.lh)parts.push('LH 공고중: 주황색 필지 · 연락처/건물 표시를 함께 켜면 해당 표시색 우선');
    $('parcelViewLegend').textContent=parts.join(' / ');$('parcelViewLegend').hidden=!parts.length;
  }
  function addMapLabel(row) {
    const area=Number(row.data.area), parts=[];
    if(views.area && Number.isFinite(area) && area>0) parts.push(views.area==='sqm'?area.toLocaleString('ko-KR',{maximumFractionDigits:1})+'㎡':(area/3.305785).toFixed(1)+'평');
    if(views.ownership && window.HitopParcelOwnership.state(row)!=='unknown') parts.push(window.HitopParcelOwnership.label(row));
    const hhValue=views.households?householdsOf(row):null;
    if(hhValue) parts.push(hhValue+'가구');
    const unsoldRow=false;
    const missingData=views.data&&dataState(row)==='missing';
    if(row.data.mapPositionUnavailable || (!parts.length&&!missingData) || (!row.points?.length && (row.x==null || row.y==null)))return;
    let x=Number(row.x)/100,y=Number(row.y)/100;
    if(row.points?.length){x=row.points.reduce((n,p)=>n+p[0],0)/row.points.length/318;y=row.points.reduce((n,p)=>n+p[1],0)/row.points.length/385;}
    if(!Number.isFinite(x)||!Number.isFinite(y))return;
    if(parts.length){
      const label=document.createElement('span');
      label.className='parcel-area-label'+(views.ownership?' parcel-ownership-label parcel-ownership-'+window.HitopParcelOwnership.state(row):'')+(hhValue?' parcel-hh-label parcel-hh-text-'+hhValue:'')+(unsoldRow?' parcel-unsold-label':'');
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
    // 글자(<text>)로 만든 도면도 같은 이유로 경계 판정에서 뺍니다.
    copy.querySelectorAll('text').forEach(node=>node.remove());
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
    const w=canvas.width,h=canvas.height,labels=new Int32Array(w*h),regions=new Map();parcelSplitKeys=new Set();const splitKeys=parcelSplitKeys;
    const yellow=i=>i>=0&&i<w*h&&pixels[i*4]>=180&&pixels[i*4+1]>=165&&pixels[i*4+2]<=190&&pixels[i*4+1]>pixels[i*4+2]+20&&pixels[i*4]>=pixels[i*4+1]-12&&pixels[i*4+3]>200;
    let id=0;
    const components=new Map();
    // 1단계: 노란 영역을 선(경계)으로 막힌 덩어리 단위로 찾고, 덩어리마다 그 안에 번호가 있는 필지를 모읍니다.
    for(const row of parcels){
      if(row.data?.mapPositionUnavailable||row.x==null||row.y==null)continue;
      let seed=-1;const x=Math.round(Number(row.x)/100*w),y=Math.round(Number(row.y)/100*h);
      for(let r=0;r<4&&seed<0;r++)for(let dy=-r;dy<=r&&seed<0;dy++)for(let dx=-r;dx<=r;dx++){
        if(x+dx<0||x+dx>=w||y+dy<0||y+dy>=h)continue;
        const i=(y+dy)*w+x+dx;if(yellow(i)){seed=i;break;}
      }
      if(seed<0)continue;
      if(labels[seed]){components.get(labels[seed]).rows.push({row,x,y});continue;}
      id++;const stack=[seed],region=[];labels[seed]=id;
      while(stack.length){
        const i=stack.pop();region.push(i);
        for(const n of [i-1,i+1,i-w,i+w]){
          if(n<0||n>=labels.length||labels[n]||!yellow(n))continue;
          if(Math.abs(n-i)===1&&Math.floor(n/w)!==Math.floor(i/w))continue;
          labels[n]=id;stack.push(n);
        }
      }
      components.set(id,{region,rows:[{row,x,y}]});
    }
    // 픽셀 계단 모양 윤곽을 곧게 펴 줍니다(나눈 필지의 구분선이 톱니처럼 보이지 않게).
    const simplifyLoop=(pts,eps)=>{
      if(pts.length<8)return pts;
      const dist=(p,a,b)=>{const dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy);return len?Math.abs(dy*(p[0]-a[0])-dx*(p[1]-a[1]))/len:Math.hypot(p[0]-a[0],p[1]-a[1]);};
      const keep=new Set([0]);let far=0,farD=-1;
      pts.forEach((p,i)=>{const d=Math.hypot(p[0]-pts[0][0],p[1]-pts[0][1]);if(d>farD){farD=d;far=i;}});keep.add(far);
      const run=(from,to)=>{const chain=[];for(let i=from;i!==to;i=(i+1)%pts.length)chain.push(i);chain.push(to);const stack=[[0,chain.length-1]];
        while(stack.length){const [lo,hi]=stack.pop();let idx=-1,max=eps;for(let k=lo+1;k<hi;k++){const d=dist(pts[chain[k]],pts[chain[lo]],pts[chain[hi]]);if(d>max){max=d;idx=k;}}if(idx>0){keep.add(chain[idx]);stack.push([lo,idx],[idx,hi]);}}};
      run(0,far);run(far,0);
      return pts.filter((p,i)=>keep.has(i));
    };
    const traceOutline=(region,regionId,smooth)=>{
      if(region.length<20)return null;
      const edges=new Map(),stride=w+1;
      const addEdge=(a,b)=>{if(!edges.has(a))edges.set(a,[]);edges.get(a).push(b);};
      for(const i of region){
        const px=i%w,py=Math.floor(i/w),a=py*stride+px;
        if(py===0||labels[i-w]!==regionId)addEdge(a,a+1);
        if(px===w-1||labels[i+1]!==regionId)addEdge(a+1,a+1+stride);
        if(py===h-1||labels[i+w]!==regionId)addEdge(a+1+stride,a+stride);
        if(px===0||labels[i-1]!==regionId)addEdge(a+stride,a);
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
      if(!outer.length)return null;
      // Remove redundant points along pixel edges without moving the boundary.
      const points=outer.filter((p,i)=>{
        const a=outer[(i+outer.length-1)%outer.length],b=outer[(i+1)%outer.length];
        return (p[0]-a[0])*(b[1]-p[1])!==(p[1]-a[1])*(b[0]-p[0]);
      });
      const finalPoints=smooth?simplifyLoop(points,2.5):points;
      return 'M'+finalPoints.map(p=>(vb.x+p[0]/w*vb.width).toFixed(3)+','+(vb.y+p[1]/h*vb.height).toFixed(3)).join('L')+'Z';
    };
    // 2단계: 덩어리 안에 필지가 하나면 그대로, 선이 빠져 여러 필지가 한 덩어리가 된 곳은
    // 각 필지 번호 위치에서 가까운 쪽으로 나누어 필지별 영역을 만듭니다.
    for(const [componentId,component] of components){
      if(component.rows.length===1){
        const d=traceOutline(component.region,componentId);if(d)regions.set(key(component.rows[0].row),d);
        continue;
      }
      const seeds=[];const seen=new Set();
      component.rows.forEach(item=>{const k=key(item.row);if(!seen.has(k)){seen.add(k);seeds.push(item);}});
      const parts=seeds.map(()=>[]),ids=seeds.map(()=>++id);
      for(const i of component.region){
        const px=i%w,py=Math.floor(i/w);let best=0,bestDistance=Infinity;
        for(let s=0;s<seeds.length;s++){const dx=px-seeds[s].x,dy=py-seeds[s].y,distance=dx*dx+dy*dy;if(distance<bestDistance){bestDistance=distance;best=s;}}
        parts[best].push(i);
      }
      parts.forEach((part,s)=>{for(const i of part)labels[i]=ids[s];});
      seeds.forEach((item,s)=>{const d=traceOutline(parts[s],ids[s],true);if(d){regions.set(key(item.row),d);splitKeys.add(key(item.row));}});
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
        shape.setAttribute('d',d);shape.classList.add('parcel-vector-hit');if(parcelSplitKeys.has(key(row)))shape.classList.add('parcel-vector-split');
        if(views.contact&&recordsLoaded&&hasOwnerData(row))shape.classList.add('parcel-vector-contact-highlight');
        if(views.building&&buildingState(row)==='building')shape.classList.add('parcel-vector-building-highlight');
        if(views.lh&&hasLh(row))shape.classList.add('parcel-vector-lh-highlight');
        if(views.households&&householdsOf(row))shape.classList.add('parcel-vector-hh-'+householdsOf(row));
        if(views.unsold&&isUnsold(row))shape.classList.add('parcel-vector-unsold');
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
      if(views.unsold&&parcelRows.length===1&&isUnsold(row))clone.classList.add('parcel-vector-unsold');
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
    {const us=isUnsold(row);$('parcel-unsold').checked=us;['parcel-area','parcel-supplyPrice'].forEach(id=>{const el=$(id);if(el)el.placeholder=us?'미분양 (공급 전)':'';});}
    $('parcelLhDetail').hidden = true; $('parcelLhDetail').replaceChildren();
    $('parcelOwnershipDetail').textContent=window.HitopParcelOwnership.detail(row);
    updateArea();
    updateBuildingSection();
    updateParcelLabel();
    $('parcelRegisterResult').textContent=row.data?.buildingCheck?.status==='found'?'최근 대장 확인 '+new Date(row.data.buildingCheck.checkedAt).toLocaleDateString('ko-KR')+' · 대장상 건물 있음'+(row.data.buildingPurpose?' · 주용도 '+row.data.buildingPurpose:'')+(row.data.buildingApproval?' · 사용승인 '+row.data.buildingApproval:''):'';
    updateLiveLinks();
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
        if(views.unsold&&isUnsold(row)&&row.points)shape.classList.add('parcel-unsold');
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
  ['building','contact','ownership','households','unsold','data'].forEach(name=>{const id=name==='lh'?'parcelLhToggle':'parcel'+name[0].toUpperCase()+name.slice(1)+'Toggle';$(id).addEventListener('click',()=>{views[name]=!views[name];$(id).setAttribute('aria-pressed',String(views[name]));if(overlay&&current)draw();});});
  $('parcelForm').addEventListener('submit',async event=>{
    event.preventDefault(); if(busy || window.HitopParcelNotes?.busy || !selected)return;
    const run=generation,blockId=current.id;
    const subblock=$('parcelSubblock').value.trim(),parcel=$('parcelNumber').value.trim();
    if(!subblock||!parcel){status('소블럭과 필지번호를 입력해주세요.');return;}
    const data={...selected.data};fields.forEach(name=>{const value=name==='building'?($('parcel-building').checked?'building':'vacant'):$('parcel-'+name).value.trim();data[name]=priceFields.includes(name)?(value===''?null:readWon(value)/10000):numericFields.includes(name)?(value===''?null:Number(value)):value;});data.unsold=$('parcel-unsold').checked;
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
  let editorDownOnBackdrop = false;
  $('parcelEditor').addEventListener('pointerdown',event=>{ editorDownOnBackdrop = event.target === $('parcelEditor'); });
  $('parcelEditor').addEventListener('click',event=>{
    const downOnBackdrop = editorDownOnBackdrop; editorDownOnBackdrop = false;
    if (event.target !== $('parcelEditor') || !downOnBackdrop) return;
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
  function mapQuery(address){const text=String(address||'').trim();return /파주/.test(text)?text:'파주시 '+text;}
  function updateLiveLinks(){
    const address=$('parcel-address').value.trim(),has=/[가-힣]+(?:동|리)\s+(?:산\s*)?\d+/.test(address),query=encodeURIComponent(mapQuery(address));
    [['parcelKakaoLink','https://map.kakao.com/link/search/'+query],['parcelSatelliteLink','https://www.google.com/maps?q='+query+'&t=k']].forEach(([id,url])=>{
      const link=$(id);if(!link)return;
      link.href=has?url:'#';link.setAttribute('aria-disabled',String(!has));link.classList.toggle('is-disabled',!has);
    });
    const naver=window.HitopNaverLinks.urls(address);
    window.HitopNaverLinks.updateLink($('parcelNaverRealEstateLink'),naver&&naver.realEstate);
    window.HitopNaverLinks.updateLink($('parcelNaverMapLink'),naver&&naver.map);
    updateRoadAddress(address,has);
  }
  // 지번 아래에 도로명 새주소를 보여줍니다(화면 표시만, 저장하지 않음).
  let roadRun=0,roadTimer=null;
  function updateRoadAddress(address,has){
    const el=$('parcelRoadAddress');if(!el)return;
    const run=++roadRun;clearTimeout(roadTimer);el.hidden=true;el.textContent='';
    const helper=window.HitopRoadAddress;if(!helper||!has)return;
    const show=road=>{if(run!==roadRun)return;el.textContent='새주소 · '+(road||'아직 부여되지 않았거나 찾지 못했습니다.');el.hidden=false;};
    const cached=helper.peek(address);
    if(cached!==undefined){show(cached);return;}
    roadTimer=setTimeout(()=>helper.lookup(address).then(show),400);
  }
  function registerSummary(result,prior){
    const check=result.buildingCheck;let text='대장상 건물 있음';
    if(check.multiple)text+=' · 한 지번에 대장 여러 건';
    else{
      if(result.buildingPurpose)text+=' · 주용도 '+result.buildingPurpose;
      if(result.buildingApproval)text+=' · 사용승인 '+result.buildingApproval;
      if(result.buildingFloors)text+=' · '+result.buildingFloors;
    }
    if(prior==='vacant')text+=' · 주의: 저장된 "건물 없음 확인"과 다릅니다. 현장 확인 후 저장하세요.';
    return text;
  }
  async function runRegisterCheck(button){
    if(busy||!selected)return;
    const run=generation,target=selected,address=$('parcel-address').value.trim(),prior=target.data?.building,result=$('parcelRegisterResult');
    busy=true;button.disabled=true;$('parcelSave').disabled=true;status('건축물대장을 조회 중입니다.');result.textContent='건축물대장을 조회 중입니다.';
    try{
      const found=await lookupParcelBuilding(address);
      if(run!==generation||selected!==target||!$('parcelEditor').open)return;
      if($('parcel-address').value.trim()!==address){status('주소가 변경되었습니다. 다시 조회해주세요.');result.textContent='';return;}
      selected.data.buildingCheck=found.buildingCheck;
      Object.entries(found).forEach(([name,value])=>{if(buildingFields.includes(name))$('parcel-'+name).value=value;});
      $('parcel-building').checked=true;updateBuildingSection();
      result.textContent=registerSummary(found,prior);
      status(found.buildingCheck.multiple?'건물은 확인했습니다. 대장이 여러 건이므로 건물 세부내용은 원본과 대조해 입력해주세요. 저장 버튼을 눌러 반영하세요.':'건물 정보를 채웠습니다. 세부자료 저장을 눌러 반영하세요.');
    }catch(error){
      if(run===generation&&selected===target){
        status(error.message);
        let text=error.message;
        if(/미조회/.test(error.message)){
          text='대장에서 건물이 조회되지 않았습니다. 공터이거나, 신축·공사 중이라 대장에 아직 없을 수 있어 위성지도·로드뷰로 함께 확인하세요.';
          if(prior==='building')text+=' 주의: 현재 "건물 있음"으로 저장되어 있습니다.';
        }
        result.textContent=text;
      }
    }
    finally{busy=false;button.disabled=false;$('parcelSave').disabled=false;}
  }
  $('parcelBuildingLookup').addEventListener('click',()=>runRegisterCheck($('parcelBuildingLookup')));
  $('parcelRegisterCheck').addEventListener('click',()=>runRegisterCheck($('parcelRegisterCheck')));
  $('parcel-address').addEventListener('input',updateLiveLinks);
  ['parcelKakaoLink','parcelSatelliteLink'].forEach(id=>$(id).addEventListener('click',event=>{if($(id).getAttribute('aria-disabled')==='true'){event.preventDefault();status('실제 지번주소를 먼저 입력해주세요.');}}));
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

  // ---- 소재지 지번 업데이트 ----
  // 1) LH 공고에 지번이 있는 필지는 그대로 채웁니다.
  // 2) 나머지는 LH 필지의 (도면 위치 ↔ 실제 좌표)로 위치 변환식을 만들어 위치를 계산하고,
  //    카카오 지도(좌표→지번)로 지번을 가져옵니다. 겹치거나 검증이 안 되면 저장하지 않고 "확인 필요"로 알립니다.
  const REAL_ADDRESS=/^[가-힣]+(?:동|리)\s*\d+(?:-[1-9]\d*)?$/;
  function fitAffine(controls){
    // [x y 1] · M = [lng lat] 최소제곱 (정규방정식)
    const n=controls.length;if(n<3)return null;
    const A=[[0,0,0],[0,0,0],[0,0,0]],B=[[0,0],[0,0],[0,0]];
    controls.forEach(c=>{const v=[c.x,c.y,1];for(let i=0;i<3;i++){for(let j=0;j<3;j++)A[i][j]+=v[i]*v[j];B[i][0]+=v[i]*c.lng;B[i][1]+=v[i]*c.lat;}});
    const M=A.map((r,i)=>[...r,...B[i]]);
    for(let i=0;i<3;i++){
      let piv=i;for(let r=i+1;r<3;r++)if(Math.abs(M[r][i])>Math.abs(M[piv][i]))piv=r;
      if(Math.abs(M[piv][i])<1e-9)return null;[M[i],M[piv]]=[M[piv],M[i]];
      for(let r=0;r<3;r++){if(r===i)continue;const f=M[r][i]/M[i][i];for(let c=i;c<5;c++)M[r][c]-=f*M[i][c];}
    }
    const m=M.map((r,i)=>[r[3]/r[i],r[4]/r[i]]);
    return pt=>({lng:pt.x*m[0][0]+pt.y*m[1][0]+m[2][0],lat:pt.x*m[0][1]+pt.y*m[1][1]+m[2][1]});
  }
  let kakaoServices=null;
  function loadKakaoServices(){
    if(window.HitopRoadAddress?.loadServices)return window.HitopRoadAddress.loadServices();
    if(window.kakao?.maps?.services)return Promise.resolve();
    if(kakaoServices)return kakaoServices;
    const key=String(window.HITOP_KAKAO_JS_KEY||'').trim();
    if(!key)return Promise.reject(Error('카카오맵 키가 설정되지 않았습니다.'));
    kakaoServices=new Promise((resolve,reject)=>{
      const script=document.createElement('script');
      script.src='https://dapi.kakao.com/v2/maps/sdk.js?appkey='+encodeURIComponent(key)+'&libraries=services&autoload=false';
      script.onload=()=>window.kakao.maps.load(resolve);
      script.onerror=()=>{kakaoServices=null;reject(Error('카카오 지도를 불러오지 못했습니다.'));};
      document.head.appendChild(script);
    });
    return kakaoServices;
  }
  function lotAddressAt(geocoder,point){
    return new Promise(resolve=>{
      const timer=setTimeout(()=>resolve(null),8000);
      geocoder.coord2Address(point.lng,point.lat,(result,state)=>{
        clearTimeout(timer);
        const info=state===window.kakao.maps.services.Status.OK&&result[0]?.address;
        if(!info||!info.region_3depth_name||!info.main_address_no){resolve(null);return;}
        resolve(info.region_3depth_name+' '+info.main_address_no+(info.sub_address_no&&info.sub_address_no!=='0'?'-'+info.sub_address_no:''));
      });
    });
  }
  function pointOfAddress(geocoder,address){
    return new Promise(resolve=>{
      const timer=setTimeout(()=>resolve(null),8000);
      geocoder.addressSearch('파주시 '+address,(result,state)=>{
        clearTimeout(timer);
        if(state===window.kakao.maps.services.Status.OK&&result[0]){const lng=Number(result[0].x),lat=Number(result[0].y);resolve(Number.isFinite(lng)&&Number.isFinite(lat)?{lng,lat}:null);}
        else resolve(null);
      });
    });
  }
  async function mapLimit(items,limit,work){
    const out=new Array(items.length);let next=0;
    await Promise.all(Array.from({length:Math.min(limit,items.length)},async()=>{while(next<items.length){const i=next++;out[i]=await work(items[i],i);}}));
    return out;
  }

  $('parcelAddressUpdate').addEventListener('click',async()=>{
    if(busy||window.HitopParcelNotes?.busy||!current)return;
    if(!recordsLoaded){status('저장 자료를 불러온 뒤 다시 시도해주세요.');return;}
    const button=$('parcelAddressUpdate'),blockId=current.id,run=generation;
    busy=true;button.disabled=true;button.textContent='확인 중';
    let filled=0,estimated=0,same=0,different=0,noLh=0,errors=0,verify=null;const review=[];let notice='';
    // 최신 저장본과 합쳐 주소만 바꿔 저장합니다(메모·건물·소유주 등은 유지).
    async function saveAddress(row,address,extra){
      const latest=await request('?block_id=eq.'+encodeURIComponent(blockId)+'&subblock=eq.'+encodeURIComponent(row.subblock)+'&parcel=eq.'+encodeURIComponent(row.parcel));
      if(run!==generation)return false;
      const saved=latest[0],base={...row.data,...saved?.data};
      if(REAL_ADDRESS.test(String(base.address||'').trim()))return false;
      const body={block_id:blockId,subblock:row.subblock,parcel:row.parcel,x:saved?.x??row.x??0,y:saved?.y??row.y??0,data:{...base,address,...extra},updated_at:new Date().toISOString()};
      const result=await request(saved?'?id=eq.'+encodeURIComponent(saved.id):'',{method:saved?'PATCH':'POST',body:JSON.stringify(body)});
      if(!result[0])throw Error('저장 실패');
      const index=rows.findIndex(item=>key(item)===key(row));
      if(index<0)rows.push(result[0]);else rows[index]=result[0];
      return true;
    }
    try{
      const lhResponse=await fetch('assets/data/lh-unjeong-detached.json?v=20261001-1');
      if(!lhResponse.ok)throw Error('LH 공고 자료를 불러오지 못했습니다.');
      const lhRecords=new Map(((await lhResponse.json()).records||[]).filter(item=>item.blockId===blockId).map(item=>[String(item.subblock)+'-'+String(item.parcel),item]));
      closeEditor();selected=null;
      const unresolved=[],controls=[],manual=[];let manualUsed=0;
      for(const row of [...combinedParcels().values()]){
        if(run!==generation)break;
        const record=lhRecords.get(String(row.subblock)+'-'+String(row.parcel)),lno=String(record?.list?.lno||'').trim(),dong=String(record?.list?.lgdnDtlAdr||'').trim().split(/\s+/).pop();
        const shown=String(row.data.address||'').trim(),x=Number(row.x),y=Number(row.y);
        if(!record||!/^\d+(?:-\d+)?$/.test(lno)||!/(?:동|리)$/.test(dong)){
          noLh++;
          const hasPosition=Number.isFinite(x)&&Number.isFinite(y)&&row.x!=null&&row.y!=null;
          if(!REAL_ADDRESS.test(shown)&&hasPosition&&!row.data?.mapPositionUnavailable)unresolved.push({row,x,y});
          // 직접 입력한 지번(위치 추정으로 채운 것은 제외)은 위치 추정의 기준점으로 씁니다.
          else if(REAL_ADDRESS.test(shown)&&hasPosition&&row.data?.addressSource!=='위치 추정(카카오 지적)'){const m=shown.match(/^([가-힣]+(?:동|리))\s*(.+)$/);if(m)manual.push({x,y,dong:m[1],address:m[1]+' '+m[2]});}
          continue;
        }
        const address=dong+' '+lno,ring=record.geometry?.coordinates?.[0]?.[0];
        if(Array.isArray(ring)&&ring.length>3&&Number.isFinite(x)&&Number.isFinite(y)){const pts=ring.slice(0,-1);controls.push({x,y,lng:pts.reduce((t,c)=>t+c[0],0)/pts.length,lat:pts.reduce((t,c)=>t+c[1],0)/pts.length,address,dong});}
        if(shown===address){same++;continue;}
        if(REAL_ADDRESS.test(shown)){different++;continue;}
        status('소재지 지번 채우는 중 · '+key(row)+' → '+address);
        try{if(await saveAddress(row,address,{addressSource:'LH 공고'}))filled++;else same++;}catch(error){errors++;if(errors>=3)break;}
      }
      // ---- 2단계: LH 공고에 없는 필지의 지번을 위치로 추정 ----
      if(run===generation&&errors<3&&unresolved.length){
        if(manual.length){
          try{
            status('직접 입력한 지번 '+manual.length+'곳의 위치 확인 중');
            await loadKakaoServices();
            const geo=new kakao.maps.services.Geocoder();
            const points=await mapLimit(manual,4,item=>pointOfAddress(geo,item.address));
            points.forEach((point,i)=>{if(point){controls.push({...manual[i],lng:point.lng,lat:point.lat});manualUsed++;}});
          }catch(error){/* 기준점을 만들지 못하면 아래 안내로 이어집니다 */}
        }
        if(controls.length<5){notice='기준이 되는 지번이 '+controls.length+'곳뿐이라 위치 추정은 하지 않았습니다(LH 지번 또는 직접 입력한 지번이 5곳 이상 필요).';}
        else{
          try{
            status('지번 위치 추정 준비 중 · 카카오 지도 불러오는 중');
            await loadKakaoServices();
            const geocoder=new kakao.maps.services.Geocoder();
            const predictFor=target=>{const fit=fitAffine(controls.filter(c=>c!==target));return fit&&fit(target);};
            // 검증: LH 지번을 아는 필지를 하나씩 빼고 추정해 실제 LH 지번과 맞는지 확인
            status('지번 위치 추정 검증 중 · LH 지번 필지로 확인');
            const checks=await mapLimit(controls,4,async c=>{const point=controls.length>=5?predictFor(c):null;if(!point)return null;return (await lotAddressAt(geocoder,point))===c.address;});
            const usable=checks.filter(v=>v!==null);
            verify={ok:usable.filter(Boolean).length,total:usable.length};
            if(!usable.length||verify.ok/verify.total<0.75){notice='위치 추정 검증이 맞지 않아(LH 기준 '+verify.ok+'/'+verify.total+' 일치) 추정 지번은 저장하지 않았습니다.';}
            else{
              const fit=fitAffine(controls);
              status('지번 위치 추정 중 · 0 / '+unresolved.length);
              let done=0;
              const guesses=await mapLimit(unresolved,4,async item=>{const address=await lotAddressAt(geocoder,fit({x:item.x,y:item.y}));done++;if(done%10===0||done===unresolved.length)status('지번 위치 추정 중 · '+done+' / '+unresolved.length);return {...item,address};});
              const dongs=new Set(controls.map(c=>c.dong));
              const known=new Set(controls.map(c=>c.address));
              combinedParcels().forEach(row=>{const a=String(row.data.address||'').trim();if(REAL_ADDRESS.test(a))known.add(a);});
              const counts=new Map();guesses.forEach(g=>{if(g.address)counts.set(g.address,(counts.get(g.address)||0)+1);});
              for(const g of guesses){
                if(run!==generation||errors>=3)break;
                const label=key(g.row);
                if(!g.address||!REAL_ADDRESS.test(g.address)||!dongs.has(g.address.split(' ')[0])||counts.get(g.address)>1||known.has(g.address)){review.push(label);continue;}
                try{if(await saveAddress(g.row,g.address,{addressSource:'위치 추정(카카오 지적)'}))estimated++;}catch(error){errors++;}
              }
            }
          }catch(error){notice='위치 추정을 하지 못했습니다. '+(error&&error.message?error.message:'');}
        }
      }
      {
        if(run===generation)draw();
        const text='소재지 지번 업데이트 · LH 지번으로 채움 '+filled+'건'+(estimated||verify?' · 위치 추정으로 채움 '+estimated+'건':'')+(verify?' (기준 지번 검증 '+verify.ok+'/'+verify.total+' 일치)':'')+(manualUsed?' · 직접 입력 지번 '+manualUsed+'곳을 기준으로 사용':'')+' · 이미 같음 '+same+'건'+(different?' · 기존 주소가 달라 그대로 둠 '+different+'건':'')+(review.length?' · 확인 필요(저장 안 함) '+review.length+'건: '+review.slice(0,12).join(', ')+(review.length>12?' 외':''):'')+(!verify&&!notice?' · LH 지번 아직 없음 '+noLh+'건':'')+(errors?' · 저장 실패 '+errors+'건':'')+(notice?' · '+notice:'');
        $('parcelAddressSnapshot').textContent=text;if(run===generation)status(text);
      }
    }catch(error){status('소재지 지번 업데이트에 실패했습니다. '+(error&&error.message?error.message:''));}
    finally{
      window.dispatchEvent(new CustomEvent('parcel-search-invalidate',{detail:{block_id:blockId}}));
      busy=false;button.disabled=false;button.textContent='업데이트';
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
