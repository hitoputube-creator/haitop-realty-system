/* Block IDs include the district and original map category: C numbers are not globally unique.
 * Coordinates refer to the unchanged supplied images, and are converted to percentages below.
 * Later block drawings can be connected through drawing (a same-origin relative image path).
 */
(function () {
  'use strict';
  const groups = {
    'second-shop': { label: '운정1·2지구 상가점포택지', color: 'shop' },
    'second-multi': { label: '운정1·2지구 주거전용택지', color: 'multi' },
    third: { label: '운정3지구 택지', color: 'third' }
  };
  const overall = {
    'second-shop': [[1,1406,420],[2,1315,545],[3,1114,1110],[5,1076,877],[6,1525,427],[9,1186,961],[14,1105,640],[17,1156,785],[18,1118,827],[19,1098,508]],
    'second-multi': [[4,1203,693],[7,1234,495],[8,1227,573],[10,1094,1012],[11,994,1118],[13,1155,566],[15,1082,692],[16,1118,718]],
    third: [[1,1450,390],[2,1070,107],[3,789,765],[4,923,1070],[5,785,1200],[6,593,1138],[7,528,1100],[8,531,1060],[9,606,886],[10,463,890],[11,359,830],[12,306,795],[13,388,704],[14,638,593],[15,658,427],[16,628,403],[17,599,486],[18,816,381],[19,790,821]]
  };
  // Coordinates use the leaflet proportions; the LH original image has 8882 x 6142 pixels.
  const leafletAnchors = {"second-shop-C1":[57.3730469,30.2966102],"second-shop-C2":[52.4902344,39.4067797],"second-shop-C3":[43.6264648,76.7803672],"second-shop-C5":[41.8852539,61.1165254],"second-shop-C6":[62.7475586,30.8403955],"second-shop-C9":[46.0449219,67.3728814],"second-shop-C14":[42.7246094,44.9858757],"second-shop-C17":[45.0683594,54.5903955],"second-shop-C18":[43.2617188,58.5451977],"second-shop-C19":[42.9111328,36.2966102],"second-multi-C4":[46.484375,48.7288136],"second-multi-C7":[50.0488281,37.7824859],"second-multi-C8":[48.7304688,39.4774011],"second-multi-C10":[41.6992188,69.5621469],"second-multi-C11":[38.1044922,77.299435],"second-multi-C13":[45.5527344,40.2295198],"second-multi-C15":[41.015625,48.8700565],"second-multi-C16":[43.359375,52.0480226],"third-C1":[59.4726562,27.259887],"third-C2":[41.8457031,9.8870056],"third-C3":[28.7597656,53.3898305],"third-C4":[35.3515625,73.7288136],"third-C5":[28.6621094,82.6271186],"third-C6":[19.0917969,78.5310734],"third-C7":[16.3574219,76.9067797],"third-C8":[17.2363281,74.2937853],"third-C9":[21.7285156,61.7231638],"third-C10":[14.0625,62.1468927],"third-C11":[8.8378906,56.8502825],"third-C12":[5.9570312,55.720339],"third-C13":[10.1074219,49.8587571],"third-C14":[22.6074219,38.7711864],"third-C15":[22.7050781,30.3672316],"third-C16":[21.3378906,28.8841808],"third-C17":[19.7753906,35.0282486],"third-C18":[29.7851562,27.4011299],"third-C19":[41.6503906,36.2288136]};
  const thirdByNumber = new Map(overall.third.map(row => [row[0], row]));
  // Fill only from verified block/parcel material. A mixed block can contain both types.
  const thirdTypes = {
    1: ['shop'], 2: ['shop'], 3: ['shop'], 4: ['shop'], 10: ['shop'], 19: ['shop'],
    5: ['single'], 6: ['single'], 7: ['single'], 8: ['single'], 9: ['single'],
    11: ['single'], 12: ['single','shop'], 13: ['single','shop'], 14: ['single'], 15: ['single'],
    16: ['single'], 17: ['single'], 18: ['single','shop']
  };
  const typeLabels = { single: '주거전용', shop: '상가점포', unknown: '미분류' };
  // Household counts must be supplied by verified block material; mixed blocks may list several.
  const verifiedHouseholds = {};
  const blocks = Object.entries(overall).flatMap(([group, entries]) => entries.map(([number,x,y]) => ({
    id: group + '-C' + number, group, number, name: 'C' + number,
    overall: [x / 1920 * 100, y / 1293 * 100],
    third: group === 'third' ? thirdByNumber.get(number) : null,
    types: group === 'third' ? (thirdTypes[number] || []) : [group === 'second-shop' ? 'shop' : 'single'],
    households: verifiedHouseholds[group + '-C' + number] || [],
    drawing: group === 'third' ? (window.HitopLandBlockSource.has('third-C' + number) ? 'private:C' + number : 'assets/images/land/blocks/third-C' + number + '-hires.webp') : null
  })));
  const byId = new Map(blocks.map(block => [block.id,block]));
  const $ = id => document.getElementById(id);
  const blockNavigation = document.createElement('div');
  blockNavigation.className = 'block-navigation';
  blockNavigation.setAttribute('role', 'group');
  blockNavigation.setAttribute('aria-label', '지구와 블럭 이동');
  blockNavigation.innerHTML = '<label for="detailDistrictSelect"><span>지구 선택</span><select id="detailDistrictSelect"><option value="third">운정3지구 택지</option><option value="second">운정1·2지구 택지</option></select></label><label for="detailBlockSelect"><span>블럭 선택</span><select id="detailBlockSelect"></select></label>';
  $('detailTitle').closest('.block-title-row').after(blockNavigation);
  blockNavigation.append($('backToMap'));
  const districtSelect = $('detailDistrictSelect');
  const blockSelect = $('detailBlockSelect');
  function districtOf(block) { return block.group === 'third' ? 'third' : 'second'; }
  function districtBlocks(district) {
    return blocks.filter(block => districtOf(block) === district).sort((a, b) => a.number - b.number);
  }
  function syncBlockNavigation(block) {
    const district = districtOf(block);
    districtSelect.value = district;
    blockSelect.replaceChildren();
    districtBlocks(district).forEach(candidate => {
      const option = document.createElement('option');
      option.value = candidate.id;
      option.textContent = candidate.name + ' 블럭';
      blockSelect.appendChild(option);
    });
    blockSelect.value = block.id;
  }
  function moveToBlock(block) {
    if (!block) return;
    view = districtOf(block);
    group = view === 'third' ? 'third' : 'all';
    landType = 'all'; households = 'all';
    navigate(block);
  }
  districtSelect.addEventListener('change', () => {
    const current = byId.get(blockSelect.value);
    const candidates = districtBlocks(districtSelect.value);
    moveToBlock(candidates.find(block => block.number === current?.number) || candidates[0]);
  });
  blockSelect.addEventListener('change', () => moveToBlock(byId.get(blockSelect.value)));
  const viewport = $('mapViewport');
  const stage = $('mapStage');
  const image = $('mapImage');
  function setOverviewMap() {
    const source=window.HitopUnjeongMap.source;
    $('overviewMapSource').textContent='LH 고해상도 리플렛 원본 · 운정 전체 위치도';
    $('overviewMapNotice').textContent='전체지도는 리플렛 원본이며, 필지별 LH 공급정보에는 별도의 자료 확인일을 표시합니다.';
    stage.classList.add('lh-leaflet-map');
    if (image.getAttribute('src')===source) return;
    mapFitted=true;$('mapError').hidden=true;$('mapLoading').hidden=true;
    image.width=window.HitopUnjeongMap.width;image.height=window.HitopUnjeongMap.height;image.hidden=false;image.src=source;
  }
  let view = 'all' , group = 'all', landType = 'all', households = 'all', zoom = 1, suppressClickUntil = 0;
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
    const legacyGroup = p.get('group');
    view = ['second','third'].includes(p.get('view')) ? p.get('view') : 'all';
    if (view === 'all' && legacyGroup === 'third') view = 'third';
    group = view === 'third' ? 'third' : 'all';
    landType = ['single','shop'].includes(p.get('landType')) ? p.get('landType') :
      legacyGroup === 'second-shop' ? 'shop' : legacyGroup === 'second-multi' ? 'single' : 'all';
    households = landType === 'single' && ['1','3','5'].includes(p.get('households')) ? p.get('households') : 'all';
    return byId.get(p.get('block')) || null;
  }
  function navigate(block, replace) {
    const url = new URL(location.href);
    url.searchParams.set('view',view);
    if (group === 'all') url.searchParams.delete('group'); else url.searchParams.set('group',group);
    if (landType === 'all') url.searchParams.delete('landType'); else url.searchParams.set('landType',landType);
    if (households === 'all') url.searchParams.delete('households'); else url.searchParams.set('households',households);
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
    if(!block)window.dispatchEvent(new Event('parcel-search-overview'));
    document.querySelectorAll('[data-view]').forEach(button => button.setAttribute('aria-pressed',String(button.dataset.view === view)));
    const showTypeFilters = true;
    $('thirdTypeFilters').hidden = false;
    $('householdFilters').hidden = landType !== 'single';
    $('viewFilterLabel').textContent = {all:'운정신도시 전체',second:'운정1·2지구',third:'운정3지구'}[view];
    $('typeFilterLabel').textContent = landType === 'all' ? '전체' : typeLabels[landType];
    $('householdFilterLabel').textContent = households === 'all' ? '전체' : households + '가구';
    document.querySelectorAll('[data-households]').forEach(button => button.setAttribute('aria-pressed',String(button.dataset.households === households)));
    document.querySelectorAll('.map-filter-dropdown').forEach(filter => { filter.open = false; });
    document.querySelectorAll('[data-land-type]').forEach(button => button.setAttribute('aria-pressed',String(button.dataset.landType === landType)));
    if (block) {
      $('detailGroup').textContent = groups[block.group].label;
      $('detailTitle').textContent = block.name + ' 블럭' + (block.group === 'third' && [3, 4].includes(block.number) ? ' (이주자택지)' : '');
      syncBlockNavigation(block);
      $('kakaoMapLink').href = 'land-kakao.html?view=' + districtOf(block);
      $('detailType').hidden = block.group !== 'third';
      $('detailType').textContent = '택지 구분: ' + (block.types.length ? block.types.map(type => typeLabels[type]).join(' · ') + (block.types.length > 1 ? ' (혼합 블럭 · 필지별 확인)' : '') : '미분류 · 상세 자료로 확인 필요');
      $('detailNote').hidden = !(block.group === 'third' && !block.third);
      $('detailDrawing').replaceChildren();
      $('detailDrawing').hidden = !block.drawing;
      $('drawingControls').hidden = !block.drawing;
      $('sourceDrawingLink').hidden = block.group !== 'third' || window.HitopLandBlockSource.has(block.id);
      $('sourceDrawingLink').href = 'assets/images/land/unjeong-3-parcels-hires.webp';
      $('drawingEmpty').hidden = !!block.drawing;
      if (block.drawing) {
        const drawing = document.createElement('img');
        if (!window.HitopLandBlockSource.has(block.id)) drawing.src = block.drawing; drawing.alt = groups[block.group].label + ' ' + block.name + ' 상세 도면';
        drawing.style.width = '100%'; drawingZoom = 1; drawingFitted = true;
        drawing.addEventListener('load',() => {
          if ($('detailDrawing').contains(drawing) && drawingFitted) fitDrawing();
        });
        drawing.addEventListener('error',() => {
          $('detailDrawingError').hidden = false;
        });
        $('detailDrawing').appendChild(drawing);
        window.HitopLandParcels?.open(block, drawing);
        if (window.HitopLandBlockSource.has(block.id)) {
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
    setOverviewMap();
    image.alt = view==='third'?'LH 리플렛 운정3지구 블럭 위치도':'LH 리플렛 운정 전체 블럭 위치도';
    const groupBlocks = blocks.filter(b => view === 'all' || (view === 'third' ? b.group === 'third' : b.group !== 'third'));
    const typeBlocks = groupBlocks.filter(b => landType === 'all' || b.types.includes(landType));
    const visible = typeBlocks.filter(b => households === 'all' || b.households.includes(Number(households)));
    const unverified = typeBlocks.filter(b => landType === 'single' && !b.households.length).length;
    $('typeNotice').hidden = households === 'all' || !unverified;
    $('typeNotice').textContent = '가구수 확인 자료가 없는 블럭 ' + unverified + '개는 가구수별 결과에서 제외됩니다. 가구수 자료 등록 후 조회할 수 있습니다.';
    $('hotspots').replaceChildren();
    let mappedCount=0;
    visible.forEach(b => {
      const point=leafletAnchors[b.id];
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
      empty.textContent = households === 'all' ? '선택한 조건에 해당하는 블럭이 없습니다. 전체를 선택해주세요.' : '선택한 가구수로 확인된 블럭이 없습니다. 가구수 전체를 선택해주세요.';
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
    view = button.dataset.view; group = view === 'third' ? 'third' : 'all'; navigate(null);
  }));

  document.querySelectorAll('[data-land-type]').forEach(button => button.addEventListener('click',() => {
    landType = button.dataset.landType; households = 'all'; navigate(null);
  }));
  document.querySelectorAll('[data-households]').forEach(button => button.addEventListener('click',() => {
    households = button.dataset.households; navigate(null);
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
  // 마우스 드래그·터치 한 손가락 이동·두 손가락 확대/축소를 포인터 이벤트 하나로 처리한다.
  // 브라우저 기본 동작(이미지 끌기, 글자 선택, 터치 스크롤)이 끼어들지 않도록 CSS에서 touch-action:none을 건다.
  function bindPanZoom(container,getZoom,setScale) {
    const pointers = new Map();
    let pan = null, pinch = null;
    const MOVE_THRESHOLD = 4;
    function pointerList() { return Array.from(pointers.values()); }
    function startPan(p) {
      pan = {x:p.x,y:p.y,left:container.scrollLeft,top:container.scrollTop,moved:false};
    }
    function startPinch() {
      const [a,b] = pointerList();
      const rect = container.getBoundingClientRect();
      pinch = {
        distance:Math.max(1,Math.hypot(a.x-b.x,a.y-b.y)),
        zoom:getZoom(),
        x:container.scrollLeft+(a.x+b.x)/2-rect.left,
        y:container.scrollTop+(a.y+b.y)/2-rect.top
      };
      pan = null;
      suppressClickUntil = Date.now() + 600;
    }
    function capture(id) {
      try { container.setPointerCapture(id); } catch (err) { /* 캡처 실패해도 이동은 계속된다 */ }
    }
    container.addEventListener('pointerdown',e => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
      if (pointers.size === 1) { pinch = null; startPan(pointers.get(e.pointerId)); }
      else if (pointers.size === 2) {
        Array.from(pointers.keys()).forEach(capture);
        startPinch();
      }
    });
    container.addEventListener('pointermove',e => {
      const p = pointers.get(e.pointerId);
      if (!p) return;
      p.x = e.clientX; p.y = e.clientY;
      if (pinch && pointers.size >= 2) {
        e.preventDefault();
        const [a,b] = pointerList();
        const rect = container.getBoundingClientRect();
        const cx = (a.x+b.x)/2, cy = (a.y+b.y)/2;
        setScale(pinch.zoom*Math.hypot(a.x-b.x,a.y-b.y)/pinch.distance,cx,cy);
        const ratio = getZoom()/pinch.zoom;
        container.scrollLeft = pinch.x*ratio-(cx-rect.left);
        container.scrollTop = pinch.y*ratio-(cy-rect.top);
        suppressClickUntil = Date.now() + 600;
        return;
      }
      if (!pan || pointers.size !== 1) return;
      const dx = e.clientX-pan.x, dy = e.clientY-pan.y;
      if (!pan.moved) {
        if (Math.hypot(dx,dy) < MOVE_THRESHOLD) return;
        pan.moved = true;
        capture(e.pointerId);
        container.classList.add('mouse-panning');
      }
      e.preventDefault();
      container.scrollLeft = pan.left-dx;
      container.scrollTop = pan.top-dy;
    });
    function release(e) {
      if (!pointers.has(e.pointerId)) return;
      pointers.delete(e.pointerId);
      try { container.releasePointerCapture(e.pointerId); } catch (err) { /* 이미 해제됨 */ }
      if (pinch) {
        suppressClickUntil = Date.now() + 600;
        if (pointers.size < 2) pinch = null;
        // 두 손가락 중 하나만 떼면 남은 손가락으로 바로 이어서 이동한다.
        if (pointers.size === 1) startPan(pointerList()[0]);
        if (pointers.size === 0) { pan = null; container.classList.remove('mouse-panning'); }
        return;
      }
      if (pan && pan.moved) suppressClickUntil = Date.now() + 250;
      if (pointers.size === 0) { pan = null; container.classList.remove('mouse-panning'); }
    }
    container.addEventListener('pointerup',release);
    container.addEventListener('pointercancel',release);
    container.addEventListener('lostpointercapture',release);
    // 이미지·글자가 브라우저 기본 끌기로 따라오지 않게 막는다.
    container.addEventListener('dragstart',e => e.preventDefault());
    // 끌었다가 놓은 직후의 클릭(블럭 선택)은 무시한다. 그냥 누른 클릭은 그대로 동작한다.
    container.addEventListener('click',e => {
      if (Date.now() < suppressClickUntil) { e.preventDefault(); e.stopPropagation(); }
    },true);
    window.addEventListener('blur',() => {
      pointers.clear(); pan = null; pinch = null; container.classList.remove('mouse-panning');
    });
  }
  bindPanZoom(viewport,()=>zoom,setZoom);
  bindPanZoom($('detailDrawing'),()=>drawingZoom,setDrawingZoom);

  document.addEventListener('wheel',e => {
    const mapTarget = e.target.closest && e.target.closest('#mapViewport');
    const drawingTarget = e.target.closest && e.target.closest('#detailDrawing');
    if (!mapTarget && !drawingTarget) return;
    e.preventDefault();
    const direction = e.deltaY < 0 ? 1 : -1;
    if (mapTarget) setZoom(nextZoomStep(zoom,direction),e.clientX,e.clientY);
    else setDrawingZoom(nextZoomStep(drawingZoom,direction),e.clientX,e.clientY);
  },{passive:false,capture:true});

  document.querySelectorAll('.map-filter-dropdown').forEach(filter => {
    filter.addEventListener('toggle',() => {
      if (!filter.open) return;
      document.querySelectorAll('.map-filter-dropdown').forEach(other => { if (other !== filter) other.open = false; });
    });
  });
  document.addEventListener('click',event => {
    document.querySelectorAll('.map-filter-dropdown[open]').forEach(filter => {
      if (!filter.contains(event.target)) filter.open = false;
    });
  });
  document.addEventListener('keydown',event => {
    if (event.key !== 'Escape') return;
    document.querySelectorAll('.map-filter-dropdown[open]').forEach(filter => {
      filter.open = false; filter.querySelector('summary').focus();
    });
  });
  window.addEventListener('popstate',() => render(readState()));
  window.HitopLandLocation={blocks:blocks.map(b=>({...b,district:groups[b.group].label})),openParcel(blockId,subblock,parcel){
    const block=byId.get(blockId);if(!block?.drawing)return false;
    navigate(block);window.HitopLandParcels.focusParcel(blockId,subblock,parcel);return true;
  }};
  render(readState()); applyZoom();
  // 실제 지도(land-kakao.html)에서 넘어온 경우: ?block=..&subblock=..&parcel=.. 이면 해당 필지 입력창을 연다.
  // 필지 자료가 다 불러와진 뒤 열리도록 land-parcels.js가 예약해 둔다.
  {
    const link = new URLSearchParams(location.search);
    const linkedBlock = link.get('block'), linkedSub = link.get('subblock'), linkedParcel = link.get('parcel');
    if (linkedBlock && linkedSub && linkedParcel && byId.get(linkedBlock)?.drawing) {
      window.HitopLandParcels?.focusParcel(linkedBlock, linkedSub, linkedParcel);
      const clean = new URL(location.href);
      clean.searchParams.delete('subblock'); clean.searchParams.delete('parcel');
      history.replaceState({}, '', clean);
    }
  }
})();

