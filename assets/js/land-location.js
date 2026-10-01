/* Block IDs include the district and original map category: C numbers are not globally unique.
 * Coordinates refer to the unchanged supplied images, and are converted to percentages below.
 * Later block drawings can be connected through drawing (a same-origin relative image path).
 */
(function () {
  'use strict';
  const groups = {
    'second-shop': { label: '운정2지구 상가점포택지', color: 'shop' },
    'second-multi': { label: '운정2지구 다가구택지', color: 'multi' },
    third: { label: '운정3지구 택지', color: 'third' }
  };
  const overall = {
    'second-shop': [[1,1406,420],[2,1315,545],[3,1114,1110],[5,1076,877],[6,1525,427],[9,1186,961],[14,1105,640],[17,1156,785],[18,1118,827],[19,1098,508]],
    'second-multi': [[4,1203,693],[7,1234,495],[8,1227,573],[10,1094,1012],[11,994,1118],[13,1155,566],[15,1082,692],[16,1118,718]],
    third: [[1,1450,390],[2,1070,107],[3,789,765],[4,923,1070],[5,785,1200],[6,593,1138],[7,528,1100],[8,531,1060],[9,606,886],[10,463,890],[11,359,830],[12,306,795],[13,388,704],[14,638,593],[15,658,427],[16,628,403],[17,599,486],[18,816,381],[19,790,821]]
  };
  // Exact label centers extracted from the latest LH vector PDF; unmatched old blocks stay in the list.
  const lhAnchors = {"C1":[61.1400281,30.2211997],"C2":[41.9662258,11.6226205],"C3":[28.535496,56.8720294],"C5":[28.2130782,86.6725061],"C8":[16.182851,78.3922173],"C7":[15.4876369,80.6582526],"C6":[18.8730273,82.5537349],"C9":[21.0997273,64.8102713],"C10":[13.4254071,65.4801067],"C11":[7.2893878,60.2354471],"C12":[4.4480779,58.7675154],"C13":[9.2138209,52.2116944],"C15":[22.0097898,33.2710792],"C16":[20.6697395,31.6178745],"C18":[29.7579005,29.9504124],"C4":[35.1249163,78.1926932]};
  const thirdByNumber = new Map(overall.third.map(row => [row[0], row]));
  // Fill only from verified block/parcel material. A mixed block can contain both types.
  const thirdTypes = {
    1: ['shop'], 2: ['shop'], 3: ['shop'], 4: ['shop'], 10: ['shop'], 19: ['shop'],
    5: ['single'], 6: ['single'], 7: ['single'], 8: ['single'], 9: ['single'],
    11: ['single'], 12: ['single','shop'], 13: ['single','shop'], 14: ['single'], 15: ['single'],
    16: ['single'], 17: ['single'], 18: ['single','shop']
  };
  const typeLabels = { single: '주거전용', shop: '상가점포', unknown: '미분류' };
  const blocks = Object.entries(overall).flatMap(([group, entries]) => entries.map(([number,x,y]) => ({
    id: group + '-C' + number, group, number, name: 'C' + number,
    overall: [x / 1920 * 100, y / 1293 * 100],
    third: group === 'third' ? thirdByNumber.get(number) : null,
    types: group === 'third' ? (thirdTypes[number] || []) : [],
    drawing: group === 'third' ? (number === 1 ? 'private:C1' : 'assets/images/land/blocks/third-C' + number + '-hires.webp') : null
  })));
  const byId = new Map(blocks.map(block => [block.id,block]));
  const $ = id => document.getElementById(id);
  const viewport = $('mapViewport');
  const stage = $('mapStage');
  const image = $('mapImage');
  let mapMode = null, lhVectorUrl = null, lhVectorPending = null;
  function loadLhVector() {
    if (!lhVectorPending) lhVectorPending = fetch('assets/images/land/lh-unjeong3-overview.svg.gz?v=20261001-vector-1')
      .then(async response => {
        if (!response.ok) throw Error('LH 원본을 불러오지 못했습니다.');
        const blob=await response.blob();
        const signature=new Uint8Array(await blob.slice(0,2).arrayBuffer());
        const compressed=signature[0]===31 && signature[1]===139;
        if (compressed && typeof DecompressionStream === 'undefined') throw Error('이 브라우저에서는 아래 LH 원본 PDF 버튼을 이용해주세요.');
        const source=compressed?await new Response(blob.stream().pipeThrough(new DecompressionStream('gzip'))).text():await blob.text();
        if (!source.trimStart().startsWith('<svg')) throw Error('LH 원본 도면 형식을 확인하지 못했습니다.');
        lhVectorUrl = URL.createObjectURL(new Blob([source], {type:'image/svg+xml'}));
        return lhVectorUrl;
      }).catch(error => {lhVectorPending=null;throw error;});
    return lhVectorPending;
  }
  function setOverviewMap(legacy) {
    const mode=legacy?'legacy':'lh';
    $('overviewMapSource').textContent=legacy?'기존 운정2 안내도 · 기존 자료 위치 표시':'LH 운정3 공고 첨부 원본 · 벡터 도면 · 확대해도 선과 글자 유지';
    $('overviewMapNotice').textContent=legacy?'운정2 자료는 기존 안내도에서 표시합니다.':'LH 원본에서 확인된 운정3 블럭만 지도에 표시합니다. 기존 운정2 자료와 C14·C17·C19는 아래 목록에서 열 수 있습니다.';
    if (mapMode===mode && (legacy || lhVectorUrl)) return;
    mapMode=mode;stage.classList.toggle('lh-vector-map',!legacy);mapFitted=true;$('mapError').hidden=true;
    image.width=legacy?2048:1191;image.height=legacy?1380:842;
    if (legacy) {image.hidden=false;$('hotspots').hidden=false;$('mapLoading').hidden=true;image.src='assets/images/land/unjeong-base-20260930.jpg';return;}
    image.hidden=true;$('hotspots').hidden=true;$('mapLoading').hidden=false;
    loadLhVector().then(url=>{if(mapMode!=='lh')return;image.src=url;image.hidden=false;$('mapLoading').hidden=true;})
      .catch(error=>{if(mapMode!=='lh')return;$('mapLoading').hidden=true;$('mapError').textContent=error.message;$('mapError').hidden=false;});
  }
  window.addEventListener('pagehide',event=>{if(!event.persisted&&lhVectorUrl)URL.revokeObjectURL(lhVectorUrl);});
  let view = 'all' , group = 'all', landType = 'all', zoom = 1, suppressClickUntil = 0;
  let drawingZoom = 1;
  let mapFitted = true, drawingFitted = true;
  const minZoom = .1;
  const maxZoom = 20;
  function nextZoomStep(current, direction) {
    const units = current * 10;
    const next = direction > 0 ? Math.floor(units + 1e-7) + 1 : Math.ceil(units - 1e-7) - 1;
    return Math.max(minZoom, Math.min(maxZoom, next / 10));
  }
  function fittedZoom(container, img) {
    // CSS owns a stable viewport height; fitting must not depend on page scroll.
    container.style.removeProperty('height');
    const width = img.naturalWidth || img.width;
    const height = img.naturalHeight || img.height;
    if (!width || !height || !container.clientWidth) return 1;
    return Math.min(1, container.clientHeight / (container.clientWidth * height / width));
  }
  function fitMap() {
    mapFitted = true;
    zoom = Math.max(minZoom, fittedZoom(viewport, image));
    applyZoom(); viewport.scrollTo(0,0);
  }
  function fitDrawing() {
    const container = $('detailDrawing');
    const drawing = container.querySelector('img');
    if (!drawing || !drawing.complete || !drawing.naturalWidth) return;
    setDrawingZoom(fittedZoom(container, drawing));
    drawingFitted = true;
    container.scrollTo(0,0);
  }
  function readState() {
    const p = new URLSearchParams(location.search);
    view = p.get('view') === 'third' ? 'third' : 'all';
    group = view === 'third' ? 'third' : (groups[p.get('group')] ? p.get('group') : 'all');
    landType = (view === 'third' || group === 'third') && typeLabels[p.get('landType')] ? p.get('landType') : 'all';
    return byId.get(p.get('block')) || null;
  }
  function navigate(block, replace) {
    const url = new URL(location.href);
    url.searchParams.set('view',view);
    if (group === 'all') url.searchParams.delete('group'); else url.searchParams.set('group',group);
    if (landType === 'all') url.searchParams.delete('landType'); else url.searchParams.set('landType',landType);
    if (block) url.searchParams.set('block',block.id); else url.searchParams.delete('block');
    history[replace ? 'replaceState' : 'pushState']({},'',url);
    render(block);
  }
  function hotspot(block, x, y, label) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'map-hotspot ' + groups[block.group].color + (view === 'third' ? (label ? ' label-hotspot' : ' site-hotspot') : '');
    if (block.group === 'third' && block.types.length === 1) button.classList.add('land-type-' + block.types[0]);
    button.style.left = x + '%'; button.style.top = y + '%';
    button.textContent = block.name;
    button.dataset.block = block.id;
    button.setAttribute('aria-label',groups[block.group].label + ' ' + block.name + ' 상세 보기');
    button.title = groups[block.group].label + ' ' + block.name;
    button.addEventListener('click',() => { if (Date.now() >= suppressClickUntil) navigate(block); });
    return button;
  }
  let privateDrawingUrl = null;
  function clearPrivateDrawing() {
    if (privateDrawingUrl) URL.revokeObjectURL(privateDrawingUrl);
    privateDrawingUrl = null;
  }
  hitopAuthClient.auth.onAuthStateChange(event => {
    if (event === 'SIGNED_OUT') { clearPrivateDrawing(); $('detailDrawing').replaceChildren(); $('sourceDrawingLink').removeAttribute('href'); window.HitopLandParcels?.close(); }
  });
  function render(block) {
    clearPrivateDrawing();
    $('overview').hidden = !!block;
    $('blockDetail').hidden = !block;
    document.querySelectorAll('[data-view]').forEach(button => button.setAttribute('aria-pressed',String(button.dataset.view === view)));
    document.querySelectorAll('[data-group]').forEach(button => button.setAttribute('aria-pressed',String(button.dataset.group === group)));
    $('groupFilters').hidden = view === 'third';
    const showTypeFilters = view === 'third' || group === 'third';
    $('thirdTypeFilters').hidden = !showTypeFilters;
    document.querySelectorAll('[data-land-type]').forEach(button => button.setAttribute('aria-pressed',String(button.dataset.landType === landType)));
    if (block) {
      $('detailGroup').textContent = groups[block.group].label;
      $('detailTitle').textContent = block.name + ' 블럭';
      $('detailType').hidden = block.group !== 'third';
      $('detailType').textContent = '택지 구분: ' + (block.types.length ? block.types.map(type => typeLabels[type]).join(' · ') + (block.types.length > 1 ? ' (혼합 블럭 · 필지별 확인)' : '') : '미분류 · 상세 자료로 확인 필요');
      $('detailNote').hidden = !(block.group === 'third' && !block.third);
      $('detailDrawing').replaceChildren();
      $('detailDrawing').hidden = !block.drawing;
      $('drawingControls').hidden = !block.drawing;
      $('sourceDrawingLink').hidden = block.group !== 'third' || block.id === 'third-C1';
      $('sourceDrawingLink').href = 'assets/images/land/unjeong-3-parcels-hires.webp';
      $('drawingEmpty').hidden = !!block.drawing;
      if (block.drawing) {
        const drawing = document.createElement('img');
        if (block.id !== 'third-C1') drawing.src = block.drawing; drawing.alt = groups[block.group].label + ' ' + block.name + ' 상세 도면';
        drawing.style.width = '100%'; drawingZoom = 1; drawingFitted = true;
        drawing.addEventListener('load',() => {
          if ($('detailDrawing').contains(drawing) && drawingFitted) fitDrawing();
        });
        drawing.addEventListener('error',() => {
          $('detailDrawingError').hidden = false;
        });
        $('detailDrawing').appendChild(drawing);
        window.HitopLandParcels?.open(block, drawing);
        if (block.id === 'third-C1') {
          window.HitopLandBlockSource.load(block.id).then(row => {
            if (!$('detailDrawing').contains(drawing)) return;
            privateDrawingUrl = URL.createObjectURL(new Blob([row.diagram_svg],{type:'image/svg+xml'}));
            drawing.src = privateDrawingUrl;
            $('sourceDrawingLink').href = privateDrawingUrl;
            $('sourceDrawingLink').hidden = false;
          }).catch(error => {
            if (!$('detailDrawing').contains(drawing)) return;
            $('detailDrawingError').textContent = error.message;
            $('detailDrawingError').hidden = false;
          });
        }
        if (drawing.complete && drawing.naturalWidth) fitDrawing();
      }
      if (!block.drawing) window.HitopLandParcels?.open(block, null);
      $('detailDrawingError').hidden = true;
      $('drawingZoomLabel').textContent = Math.round(drawingZoom * 100) + '%';
      document.title = '하이탑부동산 | ' + groups[block.group].label + ' ' + block.name;
      $('detailTitle').focus();
      return;
    }
    window.HitopLandParcels?.close();
    document.title = '하이탑부동산 | 택지 위치도';
    const legacy = view==='all' && (group==='second-shop' || group==='second-multi');
    setOverviewMap(legacy);
    image.alt = legacy?'기존 운정2 택지블럭 안내도':'LH 원본 파주운정3 전체 획지분할도';
    const groupBlocks = blocks.filter(b => group === 'all' || b.group === group);
    const visible = groupBlocks.filter(b => !showTypeFilters || landType === 'all' || (landType === 'unknown' ? !b.types.length : b.types.includes(landType)));
    const unknownCount = groupBlocks.filter(b => b.group === 'third' && !b.types.length).length;
    $('typeNotice').hidden = !showTypeFilters || !unknownCount;
    $('typeNotice').textContent = '유형 확인이 필요한 블럭 ' + unknownCount + '개가 있습니다. 상세 자료로 확인 후 분류합니다.';
    $('hotspots').replaceChildren();
    let mappedCount=0;
    visible.forEach(b => {
      const point=legacy?b.overall:(b.group==='third'?lhAnchors[b.name]:null);
      if(!point)return;
      $('hotspots').appendChild(hotspot(b,point[0],point[1],false));mappedCount++;
    });
    $('blockCount').textContent = '목록 '+visible.length+'개 · 지도 '+mappedCount+'개';
    $('thirdMapNote').hidden = view !== 'third';
    $('blockList').replaceChildren();
    Object.entries(groups).forEach(([key, meta]) => {
      const entries = visible.filter(b => b.group === key).sort((a,b) => a.number-b.number);
      if (!entries.length) return;
      const section = document.createElement('section'); section.className = 'block-group';
      const title = document.createElement('h3');
      const dot = document.createElement('span'); dot.className = 'legend-dot ' + meta.color;
      title.append(dot,meta.label); section.appendChild(title);
      const buttons = document.createElement('div'); buttons.className = 'block-buttons';
      entries.forEach(b => {
        const button = document.createElement('button'); button.type = 'button'; button.className = 'block-button';
        button.dataset.block = b.id;
        if (b.group === 'third' && b.types.length === 1) button.classList.add('land-type-' + b.types[0]);
        button.append(b.name);
        const status = document.createElement('small'); status.textContent = b.drawing ? '상세 도면 보기' : '도면 등록 예정';
        if (b.group === 'third') {
          const type = document.createElement('small');
          type.textContent = b.types.length ? b.types.map(t => typeLabels[t]).join(' · ') : '유형 미분류';
          button.appendChild(type);
        }
        button.appendChild(status);
        button.setAttribute('aria-label',meta.label + ' ' + b.name + ' 상세 보기');
        button.addEventListener('click',() => navigate(b)); buttons.appendChild(button);
      });
      section.appendChild(buttons); $('blockList').appendChild(section);
    });
    if (!visible.length) {
      const empty = document.createElement('p');
      empty.textContent = '이 유형에 해당하는 블럭이 없습니다. 전체를 선택해주세요.';
      $('blockList').appendChild(empty);
    }
    if (mapFitted && !image.hidden) fitMap();
  }
  function applyZoom() {
    stage.style.width = zoom * 100 + '%';
    $('zoomLabel').textContent = Math.round(zoom * 100) + '%';
    $('zoomOut').disabled = zoom <= minZoom;
    $('zoomIn').disabled = zoom >= maxZoom;
  }
  function setZoom(next,cx,cy) {
    const rect = viewport.getBoundingClientRect();
    const x = cx === undefined ? viewport.clientWidth / 2 : cx - rect.left;
    const y = cy === undefined ? viewport.clientHeight / 2 : cy - rect.top;
    const old = zoom;
    mapFitted = false;
    zoom = Math.max(minZoom,Math.min(maxZoom,next));
    const left = (viewport.scrollLeft + x) * zoom / old - x;
    const top = (viewport.scrollTop + y) * zoom / old - y;
    applyZoom(); viewport.scrollLeft = left; viewport.scrollTop = top;
  }
  document.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click',() => {
    view = button.dataset.view; group = view === 'third' ? 'third' : 'all'; landType = 'all'; navigate(null);
  }));
  document.querySelectorAll('[data-group]').forEach(button => button.addEventListener('click',() => {
    group = button.dataset.group; landType = 'all'; navigate(null);
  }));
  document.querySelectorAll('[data-land-type]').forEach(button => button.addEventListener('click',() => {
    landType = button.dataset.landType; navigate(null);
  }));
  $('backToMap').addEventListener('click',() => { navigate(null); viewport.focus({preventScroll:true}); });
  $('detailBack').addEventListener('click',() => { navigate(null); viewport.focus({preventScroll:true}); });
  $('zoomIn').addEventListener('click',() => setZoom(nextZoomStep(zoom, 1)));
  $('zoomOut').addEventListener('click',() => setZoom(nextZoomStep(zoom, -1)));
  $('zoomFit').addEventListener('click',fitMap);
  function setDrawingZoom(next,cx,cy) {
    const container = $('detailDrawing');
    const drawing = container.firstElementChild;
    if (!drawing) return;
    const rect = container.getBoundingClientRect();
    const x = cx === undefined ? container.clientWidth / 2 : cx - rect.left;
    const y = cy === undefined ? container.clientHeight / 2 : cy - rect.top;
    const old = drawingZoom;
    const left = container.scrollLeft, top = container.scrollTop;
    drawingFitted = false;
    drawingZoom = Math.max(minZoom,Math.min(maxZoom,next));
    const target = drawing.closest('.parcel-stage') || drawing;
    target.style.width = drawingZoom * 100 + '%';
    if(target !== drawing) drawing.style.width = '100%';
    container.scrollLeft = (left + x) * drawingZoom / old - x;
    container.scrollTop = (top + y) * drawingZoom / old - y;
    $('drawingZoomLabel').textContent = Math.round(drawingZoom * 100) + '%';
    $('drawingZoomOut').disabled = drawingZoom <= minZoom;
    $('drawingZoomIn').disabled = drawingZoom >= maxZoom;
  }
  $('drawingZoomIn').addEventListener('click',() => setDrawingZoom(nextZoomStep(drawingZoom, 1)));
  $('drawingZoomOut').addEventListener('click',() => setDrawingZoom(nextZoomStep(drawingZoom, -1)));
  $('drawingZoomFit').addEventListener('click',fitDrawing);
  image.addEventListener('error',() => { $('mapError').hidden = false; });
  image.addEventListener('load',() => { $('hotspots').hidden=false; $('mapError').hidden = true; if (mapFitted) fitMap(); });
  window.addEventListener('resize',() => {
    if (!$('overview').hidden && mapFitted) fitMap();
    if (!$('blockDetail').hidden && drawingFitted) fitDrawing();
  });
  function touchDistance(t) { return Math.hypot(t[0].clientX-t[1].clientX,t[0].clientY-t[1].clientY); }
  function bindTouchZoom(container,getZoom,setScale) {
    let pinch = null;
    function startPinch(e) {
      if (e.touches.length !== 2) return;
      e.preventDefault();
      const rect = container.getBoundingClientRect();
      pinch = {distance:touchDistance(e.touches),zoom:getZoom(),
        x:container.scrollLeft+(e.touches[0].clientX+e.touches[1].clientX)/2-rect.left,
        y:container.scrollTop+(e.touches[0].clientY+e.touches[1].clientY)/2-rect.top};
      suppressClickUntil = Date.now() + 600;
    }
    container.addEventListener('touchstart',startPinch,{passive:false});
    container.addEventListener('touchmove',e => {
      if (e.touches.length !== 2 || !pinch) return;
      e.preventDefault(); suppressClickUntil = Date.now() + 600;
      const rect = container.getBoundingClientRect();
      const cx = (e.touches[0].clientX+e.touches[1].clientX)/2;
      const cy = (e.touches[0].clientY+e.touches[1].clientY)/2;
      setScale(pinch.zoom*touchDistance(e.touches)/Math.max(1,pinch.distance),cx,cy);
      const ratio = getZoom()/pinch.zoom;
      container.scrollLeft = pinch.x*ratio-(cx-rect.left);
      container.scrollTop = pinch.y*ratio-(cy-rect.top);
    },{passive:false});
    function endPinch(e) {
      if (pinch) suppressClickUntil = Date.now() + 600;
      if (e.touches.length < 2) pinch = null;
    }
    container.addEventListener('touchend',endPinch);
    container.addEventListener('touchcancel',endPinch);
    container.addEventListener('click',e => {
      if (Date.now() < suppressClickUntil) { e.preventDefault(); e.stopPropagation(); }
    },true);
  }
  function bindMouseNavigation(container,getZoom,setScale) {
    let drag = null;
    function endDrag() {
      if (!drag) return;
      if (drag.moved) suppressClickUntil = Date.now() + 250;
      drag = null;
      container.classList.remove('mouse-panning');
    }
    container.addEventListener('mousedown',e => {
      if (e.button !== 0) return;
      drag = {
        x:e.clientX,
        y:e.clientY,
        left:container.scrollLeft,
        top:container.scrollTop,
        moved:false
      };
    });
    window.addEventListener('mousemove',e => {
      if (!drag) return;
      const dx=e.clientX-drag.x, dy=e.clientY-drag.y;
      if (!drag.moved && Math.hypot(dx,dy) < 4) return;
      drag.moved=true;
      container.classList.add('mouse-panning');
      e.preventDefault();
      container.scrollLeft=drag.left-dx;
      container.scrollTop=drag.top-dy;
    });
    window.addEventListener('mouseup',endDrag);
    window.addEventListener('blur',endDrag);
  }
  bindTouchZoom(viewport,()=>zoom,setZoom);
  bindTouchZoom($('detailDrawing'),()=>drawingZoom,setDrawingZoom);
  bindMouseNavigation(viewport,()=>zoom,setZoom);
  bindMouseNavigation($('detailDrawing'),()=>drawingZoom,setDrawingZoom);

  document.addEventListener('wheel',e => {
    const mapTarget = e.target.closest && e.target.closest('#mapViewport');
    const drawingTarget = e.target.closest && e.target.closest('#detailDrawing');
    if (!mapTarget && !drawingTarget) return;
    e.preventDefault();
    const direction = e.deltaY < 0 ? 1 : -1;
    if (mapTarget) setZoom(nextZoomStep(zoom,direction),e.clientX,e.clientY);
    else setDrawingZoom(nextZoomStep(drawingZoom,direction),e.clientX,e.clientY);
  },{passive:false,capture:true});

  window.addEventListener('popstate',() => render(readState()));
  render(readState()); applyZoom();
})();
