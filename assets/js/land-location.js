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
    third: [[1,1465,377],[2,1060,100],[3,818,766],[4,910,1089],[5,796,1210],[6,592,1148],[7,512,1120],[8,548,1076],[9,630,897],[10,484,897],[11,354,818],[12,294,785],[13,379,703],[14,655,566],[15,676,427],[16,616,384],[17,599,493],[18,829,386],[19,818,825]]
  };
  // number, actual block centre x/y, printed callout centre x/y on the 1893×1312 map
  const third = [
    [1,1222,378,1128,344],[2,869,110,946,124],[3,593,731,522,729],
    [4,658,1090,783,1065],[5,593,1162,674,1171],[6,402,1096,407,1156],
    [7,327,1079,266,1083],[8,357,1048,257,1019],[9,449,858,423,799],
    [10,287,862,277,803],[11,168,788,148,884],[12,120,776,53,768],
    [13,211,688,123,682],[14,465,530,545,541],[15,468,412,558,413],
    [16,443,377,375,364],[17,404,477,312,451],[18,619,377,544,353]
  ];
  const thirdByNumber = new Map(third.map(row => [row[0], row]));
  const blocks = Object.entries(overall).flatMap(([group, entries]) => entries.map(([number,x,y]) => ({
    id: group + '-C' + number, group, number, name: 'C' + number,
    overall: [x / 1920 * 100, y / 1293 * 100],
    third: group === 'third' ? thirdByNumber.get(number) : null,
    drawing: null
  })));
  const byId = new Map(blocks.map(block => [block.id,block]));
  const $ = id => document.getElementById(id);
  const viewport = $('mapViewport');
  const stage = $('mapStage');
  const image = $('mapImage');
  let view = 'all', group = 'all', zoom = 1, pinch = null, suppressClickUntil = 0;
  function readState() {
    const p = new URLSearchParams(location.search);
    view = p.get('view') === 'third' ? 'third' : 'all';
    group = view === 'third' ? 'third' : (groups[p.get('group')] ? p.get('group') : 'all');
    return byId.get(p.get('block')) || null;
  }
  function navigate(block, replace) {
    const url = new URL(location.href);
    url.searchParams.set('view',view);
    if (group === 'all') url.searchParams.delete('group'); else url.searchParams.set('group',group);
    if (block) url.searchParams.set('block',block.id); else url.searchParams.delete('block');
    history[replace ? 'replaceState' : 'pushState']({},'',url);
    render(block);
  }
  function hotspot(block, x, y, label) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'map-hotspot ' + groups[block.group].color + (view === 'third' ? (label ? ' label-hotspot' : ' site-hotspot') : '');
    button.style.left = x + '%'; button.style.top = y + '%';
    button.textContent = block.name;
    button.dataset.block = block.id;
    button.setAttribute('aria-label',groups[block.group].label + ' ' + block.name + ' 상세 보기');
    button.title = groups[block.group].label + ' ' + block.name;
    button.addEventListener('click',() => { if (Date.now() >= suppressClickUntil) navigate(block); });
    return button;
  }
  function render(block) {
    $('overview').hidden = !!block;
    $('blockDetail').hidden = !block;
    document.querySelectorAll('[data-view]').forEach(button => button.setAttribute('aria-pressed',String(button.dataset.view === view)));
    document.querySelectorAll('[data-group]').forEach(button => button.setAttribute('aria-pressed',String(button.dataset.group === group)));
    $('groupFilters').hidden = view === 'third';
    if (block) {
      $('detailGroup').textContent = groups[block.group].label;
      $('detailTitle').textContent = block.name + ' 블럭';
      $('detailNote').hidden = !(block.group === 'third' && !block.third);
      $('detailDrawing').replaceChildren();
      $('detailDrawing').hidden = !block.drawing;
      $('drawingEmpty').hidden = !!block.drawing;
      if (block.drawing) {
        const drawing = document.createElement('img');
        drawing.src = block.drawing; drawing.alt = groups[block.group].label + ' ' + block.name + ' 상세 도면';
        $('detailDrawing').appendChild(drawing);
      }
      document.title = '하이탑부동산 | ' + groups[block.group].label + ' ' + block.name;
      $('detailTitle').focus();
      return;
    }
    document.title = '하이탑부동산 | 택지 위치도';
    const nextImage = 'assets/images/land/' + (view === 'third' ? 'unjeong-3.jpg' : 'unjeong-all.jpg');
    if (image.getAttribute('src') !== nextImage) {
      $('mapError').hidden = true;
      image.src = nextImage;
      image.width = 2048;
      image.height = view === 'third' ? 1419 : 1380;
      image.alt = view === 'third' ? '운정3지구 C블럭 위치도' : '운정신도시 전체 택지블럭 위치도';
      zoom = 1; applyZoom(); viewport.scrollTo(0,0);
    }
    const visible = blocks.filter(b => group === 'all' || b.group === group);
    $('hotspots').replaceChildren();
    visible.forEach(b => {
      if (view === 'third') {
        if (!b.third) return;
        $('hotspots').appendChild(hotspot(b,b.third[1]/1893*100,b.third[2]/1312*100,false));
        $('hotspots').appendChild(hotspot(b,b.third[3]/1893*100,b.third[4]/1312*100,true));
      } else $('hotspots').appendChild(hotspot(b,b.overall[0],b.overall[1],false));
    });
    $('blockCount').textContent = visible.length + '개 블럭';
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
        button.append(b.name);
        const status = document.createElement('small'); status.textContent = b.drawing ? '상세 도면 보기' : '도면 등록 예정';
        button.appendChild(status);
        button.setAttribute('aria-label',meta.label + ' ' + b.name + ' 상세 보기');
        button.addEventListener('click',() => navigate(b)); buttons.appendChild(button);
      });
      section.appendChild(buttons); $('blockList').appendChild(section);
    });
  }
  function applyZoom() {
    stage.style.width = zoom * 100 + '%';
    $('zoomLabel').textContent = Math.round(zoom * 100) + '%';
    $('zoomOut').disabled = zoom <= 1;
    $('zoomIn').disabled = zoom >= 4;
  }
  function setZoom(next,cx,cy) {
    const rect = viewport.getBoundingClientRect();
    const x = cx === undefined ? viewport.clientWidth / 2 : cx - rect.left;
    const y = cy === undefined ? viewport.clientHeight / 2 : cy - rect.top;
    const old = zoom;
    zoom = Math.max(1,Math.min(4,next));
    const left = (viewport.scrollLeft + x) * zoom / old - x;
    const top = (viewport.scrollTop + y) * zoom / old - y;
    applyZoom(); viewport.scrollLeft = left; viewport.scrollTop = top;
  }
  document.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click',() => {
    view = button.dataset.view; group = view === 'third' ? 'third' : 'all'; navigate(null);
  }));
  document.querySelectorAll('[data-group]').forEach(button => button.addEventListener('click',() => {
    group = button.dataset.group; navigate(null);
  }));
  $('backToMap').addEventListener('click',() => { navigate(null); viewport.focus({preventScroll:true}); });
  $('detailBack').addEventListener('click',() => { navigate(null); viewport.focus({preventScroll:true}); });
  $('zoomIn').addEventListener('click',() => setZoom(zoom + .5));
  $('zoomOut').addEventListener('click',() => setZoom(zoom - .5));
  $('zoomFit').addEventListener('click',() => { setZoom(1); viewport.scrollTo(0,0); });
  image.addEventListener('error',() => { $('mapError').hidden = false; });
  image.addEventListener('load',() => { $('mapError').hidden = true; });
  function touchDistance(t) { return Math.hypot(t[0].clientX-t[1].clientX,t[0].clientY-t[1].clientY); }
  viewport.addEventListener('touchstart',e => {
    if(e.touches.length !== 2) return;
    e.preventDefault();
    pinch = { distance: touchDistance(e.touches), zoom };
    suppressClickUntil = Date.now() + 600;
  },{passive:false});
  viewport.addEventListener('touchmove',e => {
    if(e.touches.length !== 2 || !pinch) return;
    e.preventDefault(); suppressClickUntil = Date.now() + 600;
    setZoom(pinch.zoom * touchDistance(e.touches) / Math.max(1,pinch.distance),
      (e.touches[0].clientX+e.touches[1].clientX)/2,(e.touches[0].clientY+e.touches[1].clientY)/2);
  },{passive:false});
  function endPinch(e) { if(e.touches.length<2) pinch=null; }
  viewport.addEventListener('touchend',endPinch);
  viewport.addEventListener('touchcancel',endPinch);
  window.addEventListener('popstate',() => render(readState()));
  render(readState()); applyZoom();
})();
