/* 택지지구별 카카오맵 화면 (?view=third 운정3지구 / ?view=second 운정1·2지구)
 * - 처음에는 해당 택지지구 전체가 한눈에 보이는 위치로 열립니다. 필지 핀은 [필지 핀 켜기]를 눌렀을 때만 표시합니다.
 * - land_parcels(Supabase)의 지번주소를 카카오 지오코딩으로 위경도로 바꿔 실제 지도 위에 표시합니다.
 * - 변환 결과는 이 브라우저(localStorage)에 저장해 다음 방문부터 바로 표시합니다. DB는 수정하지 않습니다.
 * - 건물 상태는 기존 택지 위치도에서 저장한 값(건물 있음/없음 확인/미확인)과 건축물대장 확인 기록을 그대로 읽습니다.
 */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var CACHE_KEY = 'hitop-kakao-geo-v1';
  var ADDRESS_PATTERN = /[가-힣]+(?:동|리)\s+(?:산\s*)?\d+/;
  var BLOCK_PREFIX = /^(third|second-shop|second-multi)-/;
  // 지구별 첫 화면. bounds는 LH 택지 경계 자료(lh-unjeong-detached.json)의 실제 좌표 범위에 여백을 더한 값입니다.
  // bounds가 없는 지구는 anchors(대표 주소)를 카카오로 찾아 그 범위에 맞춥니다. 모두 실패하면 center/level로 엽니다.
  var DISTRICTS = {
    third: { label: '운정3지구', prefix: 'third-', bounds: [[37.7035, 126.6970], [37.7415, 126.7600]], center: [37.7226, 126.7281], level: 7 },
    second: { label: '운정1·2지구', prefix: 'second-', bounds: null, center: [37.7230, 126.7500], level: 6,
      anchors: ['와동동 1426-1', '와동동 1498', '야당동', '목동동'] }
  };
  var district = new URLSearchParams(location.search).get('view') === 'second' ? 'second' : 'third';
  var cfg = DISTRICTS[district];
  var pinsOn = false, pinsLoaded = false, pinsLoading = false;
  var statusEl = $('kakaoStatus');
  var map = null, geocoder = null, infoWindow = null;
  var items = [];          // {row, address, lat, lng, state, type, registered, overlay}
  var geoCache = loadCache();
  var activeOverlays = new Set();
  var roadview = null, roadviewClient = null, roadviewTarget = null, roadviewRun = 0;
  var sourceNoAddress = 0;
  var roadviewClickOn = false, walker = null, walkerArrow = null;

  function setStatus(text) { statusEl.textContent = text; }
  function blockName(blockId) { return String(blockId).replace(BLOCK_PREFIX, ''); }

  function loadCache() {
    try { return JSON.parse(localStorage.getItem(CACHE_KEY) || '{}') || {}; } catch (e) { return {}; }
  }
  function saveCache() {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(geoCache)); } catch (e) { /* 저장 공간이 없어도 화면은 동작 */ }
  }

  function normalizeAddress(text) {
    var value = String(text || '').replace(/\s+/g, ' ').trim();
    return /파주/.test(value) ? value : '파주시 ' + value;
  }

  // ---------- 데이터 불러오기 ----------
  async function loadParcels() {
    var session = await hitopAuthClient.auth.getSession();
    if (session.error || !session.data.session) throw new Error('로그인 상태를 확인해주세요.');
    var token = session.data.session.access_token;
    var rows = [], offset = 0, page = 1000;
    for (;;) {
      var url = SUPABASE_URL + '/rest/v1/land_parcels?select=id,block_id,subblock,parcel,data&block_id=like.' + cfg.prefix + '*&order=block_id,subblock,parcel&limit=' + page + '&offset=' + offset;
      var res = await fetchWithTimeout(url, { headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + token } }, 30000);
      if (!res.ok) throw new Error('필지 자료를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.');
      var part = await res.json();
      rows = rows.concat(part);
      if (part.length < page) break;
      offset += page;
    }
    return rows;
  }

  // 원본 자료(공급금액·면적·지번주소): 편집창이 채워 주는 값과 같은 출처입니다. 읽기만 합니다.
  async function loadSourceParcels() {
    try {
      var session = await hitopAuthClient.auth.getSession();
      var token = session.data && session.data.session && session.data.session.access_token;
      if (!token) return [];
      var res = await fetchWithTimeout(SUPABASE_URL + '/rest/v1/land_block_sources?select=block_id,parcels:source_data->parcels&block_id=like.' + cfg.prefix + '*', { headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + token } }, 40000);
      if (!res.ok) return [];
      return await res.json();
    } catch (e) { return []; }
  }

  // 저장된 필지에 없는 원본 필지 중 지번주소(예: 와동동 1698-3)가 있는 것만 지도용 행으로 만듭니다.
  function sourceRows(blocks, savedRows) {
    var saved = new Set(savedRows.map(function (r) { return r.block_id + '|' + r.subblock + '|' + r.parcel; }));
    var out = [], noAddress = 0;
    blocks.forEach(function (b) {
      (b.parcels || []).forEach(function (p) {
        if (saved.has(b.block_id + '|' + p.subblock + '|' + p.parcel)) return;
        var data = Object.assign({}, p.data || {});
        data.address = String(data.address || '').replace(/-0$/, '').trim();
        if (!ADDRESS_PATTERN.test(data.address)) { noAddress++; return; }
        out.push({ id: null, block_id: b.block_id, subblock: String(p.subblock), parcel: String(p.parcel), data: data, fromSource: true, source: p.source || {} });
      });
    });
    out.noAddress = noAddress;
    return out;
  }

  function buildItems(rows) {
    return rows.map(function (row) {
      var data = row.data || {};
      var address = String(data.address || '').trim();
      var state = data.building === 'building' ? 'building' : data.building === 'vacant' ? 'vacant' : 'unknown';
      return {
        row: row, data: data, address: address,
        hasAddress: ADDRESS_PATTERN.test(address),
        state: state,
        type: data.landType === 'shop' ? 'shop' : 'single',
        registered: !!(data.buildingCheck && data.buildingCheck.status === 'found'),
        lat: null, lng: null, overlay: null
      };
    });
  }

  // ---------- 지오코딩 ----------
  function geocode(address) {
    return new Promise(function (resolve) {
      geocoder.addressSearch(normalizeAddress(address), function (result, status) {
        if (status === kakao.maps.services.Status.OK && result[0]) resolve({ lat: Number(result[0].y), lng: Number(result[0].x) });
        else if (status === kakao.maps.services.Status.ZERO_RESULT) resolve(null);
        else resolve(undefined); // 일시 오류: 저장하지 않고 다음에 다시 시도
      });
    });
  }

  async function resolveAll(retryFailed) {
    var wanted = items.filter(function (it) { return it.hasAddress; });
    var unique = Array.from(new Set(wanted.map(function (it) { return normalizeAddress(it.address); })));
    var queue = unique.filter(function (key) {
      var hit = geoCache[key];
      if (hit === undefined) return true;
      return retryFailed && hit === 0;
    });
    var done = 0, total = queue.length;
    if (total) setStatus('주소를 지도 위치로 변환하는 중입니다. 0 / ' + total);
    var workers = Array.from({ length: 4 }, async function () {
      while (queue.length) {
        var key = queue.shift();
        var result = await geocode(key);
        if (result) geoCache[key] = [result.lat, result.lng];
        else if (result === null) geoCache[key] = 0; // 주소를 찾지 못함
        done++;
        if (done % 20 === 0 || done === total) { setStatus('주소를 지도 위치로 변환하는 중입니다. ' + done + ' / ' + total); saveCache(); }
      }
    });
    await Promise.all(workers);
    saveCache();
    items.forEach(function (it) {
      var hit = it.hasAddress ? geoCache[normalizeAddress(it.address)] : undefined;
      if (Array.isArray(hit)) { it.lat = hit[0]; it.lng = hit[1]; } else { it.lat = null; it.lng = null; }
    });
  }

  // ---------- 지도 표시 ----------
  function stateLabel(state) { return state === 'building' ? '건물 있음' : state === 'vacant' ? '건물 없음 확인' : '확인 전'; }

  function pinContent(it) {
    var el = document.createElement('div');
    el.className = 'kk-pin ' + it.state + (it.type === 'shop' ? ' shop' : '') + (it.registered ? ' registered' : '') + (it.row.fromSource ? ' source' : '');
    el.title = it.address;
    el.addEventListener('click', function () { openInfo(it); });
    return el;
  }

  function line(parent, text, cls) {
    var span = document.createElement('span');
    span.className = 'row' + (cls ? ' ' + cls : '');
    span.textContent = text;
    parent.appendChild(span);
    return span;
  }

  function openInfo(it) {
    var data = it.data, root = document.createElement('div');
    root.className = 'kk-info';
    var title = document.createElement('b');
    title.textContent = blockName(it.row.block_id) + '-' + it.row.subblock + '-' + it.row.parcel;
    root.appendChild(title);
    var addressLine = line(root, it.address);
    if (window.HitopRoadAddress) {
      var cachedRoad = window.HitopRoadAddress.peek(it.address);
      if (cachedRoad) addressLine.textContent = window.HitopRoadAddress.format(it.address, cachedRoad);
      else if (cachedRoad === undefined) {
        window.HitopRoadAddress.lookup(it.address).then(function (road) {
          if (road) addressLine.textContent = window.HitopRoadAddress.format(it.address, road);
        });
      }
    }
    line(root, (it.type === 'shop' ? '상가점포' : '주거전용') + ' · ' + stateLabel(it.state));
    var area = Number(data.area), won = it.row.source && it.row.source.supplyPriceWon;
    if (area > 0 || won) {
      var facts = [];
      if (area > 0) facts.push(area.toLocaleString('ko-KR') + '㎡ (' + (area / 3.305785).toFixed(1) + '평)');
      if (won) facts.push('공급 ' + Math.round(won / 10000).toLocaleString('ko-KR') + '만원');
      line(root, facts.join(' · '));
    }
    if (it.row.fromSource) line(root, '원본 자료만 있음 · 아직 저장 안 함');
    if (it.registered) {
      var info = ['대장상 건물 있음'];
      if (data.buildingPurpose) info.push('주용도 ' + data.buildingPurpose);
      if (data.buildingApproval) info.push('사용승인 ' + data.buildingApproval);
      line(root, info.join(' · '));
      if (it.state === 'vacant') line(root, '주의: "건물 없음 확인"과 대장 기록이 다릅니다.', 'warn');
    } else if (it.state === 'unknown') {
      line(root, '건축물대장 확인 기록 없음');
    }
    var links = document.createElement('div');
    links.className = 'links';
    var rvButton = document.createElement('button');
    rvButton.type = 'button'; rvButton.className = 'kk-link'; rvButton.textContent = '로드뷰 보기';
    rvButton.addEventListener('click', function () { openRoadview(it); });
    links.appendChild(rvButton);
    var detailUrl = 'land-location.html?view=all&block=' + encodeURIComponent(it.row.block_id) +
      '&subblock=' + encodeURIComponent(it.row.subblock) + '&parcel=' + encodeURIComponent(it.row.parcel);
    [['카카오맵', 'https://map.kakao.com/link/map/' + encodeURIComponent(it.address) + ',' + it.lat + ',' + it.lng],
     ['상세 입력', detailUrl]
    ].forEach(function (pair) {
      var a = document.createElement('a');
      a.href = pair[1]; a.target = '_blank'; a.rel = 'noopener'; a.textContent = pair[0];
      links.appendChild(a);
    });
    window.HitopNaverLinks.append(links, it.address, '', {lat:it.lat,lng:it.lng});
    root.appendChild(links);
    infoWindow.setContent(root);
    infoWindow.setPosition(new kakao.maps.LatLng(it.lat, it.lng));
    infoWindow.open(map);
  }

  // ---------- 화면 안 로드뷰 ----------
  function openRoadview(it) {
    openRoadviewAt(new kakao.maps.LatLng(it.lat, it.lng), {
      title: blockName(it.row.block_id) + '-' + it.row.subblock + '-' + it.row.parcel + ' · ' + it.address,
      faceTarget: true
    });
  }

  // 위치(position) 근처의 로드뷰를 아래 패널에 엽니다.
  // faceTarget이 true면 그 위치(필지)를 바라보게 맞추고, false면 로드뷰가 시작되는 방향 그대로 둡니다.
  function openRoadviewAt(position, opts) {
    var panel = $('kakaoRoadviewPanel'), view = $('kakaoRoadview'), note = $('kakaoRoadviewNote');
    var run = ++roadviewRun;
    panel.hidden = false;
    $('kakaoRoadviewTitle').textContent = '로드뷰 · ' + opts.title;
    $('kakaoRoadviewExternal').href = 'https://map.kakao.com/link/roadview/' + position.getLat() + ',' + position.getLng();
    note.textContent = '로드뷰를 찾는 중입니다.';
    view.classList.remove('is-empty');
    panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    roadviewTarget = opts.faceTarget ? position : null;
    if (!roadview) {
      roadview = new kakao.maps.Roadview(view);
      roadviewClient = new kakao.maps.RoadviewClient();
      kakao.maps.event.addListener(roadview, 'init', function () { applyFacing(); updateWalker(); });
      // 'init'은 처음 한 번만 오므로, 이후 필지를 열 때는 로드뷰 장면이 바뀌는 시점에도 방향을 맞춥니다.
      kakao.maps.event.addListener(roadview, 'panoid_changed', function () { applyFacing(); });
      kakao.maps.event.addListener(roadview, 'position_changed', updateWalker);
      kakao.maps.event.addListener(roadview, 'viewpoint_changed', updateWalkerDirection);
    }
    roadviewClient.getNearestPanoId(position, 50, function (panoId) {
      if (run !== roadviewRun) return; // 그 사이 다른 곳을 눌렀거나 닫은 경우
      if (panoId === null || panoId === undefined) {
        view.classList.add('is-empty');
        hideWalker();
        note.textContent = '이 위치 50m 안에는 로드뷰 사진이 없습니다. 신규 개발지역은 아직 촬영 전이거나 오래된 사진일 수 있어요. 위성지도와 건축물대장으로 확인해주세요.';
        return;
      }
      var samePano = roadview.getPanoId && roadview.getPanoId() === panoId;
      roadview.setPanoId(panoId, position);
      if (samePano) applyFacing(); // 같은 장면이면 장면 변경 이벤트가 오지 않으므로 바로 맞춤
      note.textContent = '로드뷰는 카카오가 촬영한 시점의 사진입니다. 촬영 이후 새로 지어진 건물은 보이지 않을 수 있어요.';
    });
  }

  // 필지에서 연 로드뷰만, 그 필지 쪽을 한 번 바라보게 맞춥니다. (이후 길을 따라 이동할 때는 건드리지 않음)
  function applyFacing() {
    if (!roadviewTarget || !roadview) return;
    try {
      var projection = roadview.getProjection();
      if (!projection) return; // 아직 준비 전이면 다음 이벤트에서 다시 시도
      roadview.setViewpoint(projection.viewpointFromCoords(roadviewTarget, 2));
    } catch (e) { /* 방향 맞춤에 실패해도 로드뷰는 그대로 사용 가능 */ }
    roadviewTarget = null;
  }

  // ---------- 지도 위 로드뷰 현재 위치 표시 ----------
  function ensureWalker() {
    if (walker) return;
    var el = document.createElement('div');
    el.className = 'kk-walker';
    walkerArrow = document.createElement('i');
    el.appendChild(walkerArrow);
    walker = new kakao.maps.CustomOverlay({ content: el, xAnchor: 0.5, yAnchor: 0.5, zIndex: 20 });
  }
  function updateWalker() {
    if (!roadview) return;
    var pos = roadview.getPosition && roadview.getPosition();
    if (!pos) return;
    ensureWalker();
    walker.setPosition(pos);
    walker.setMap(map);
    updateWalkerDirection();
    try { if (map.getBounds && !map.getBounds().contain(pos)) map.setCenter(pos); } catch (e) { /* 지도 이동 실패는 무시 */ }
  }
  function updateWalkerDirection() {
    if (!walkerArrow || !roadview || !roadview.getViewpoint) return;
    var vp = roadview.getViewpoint();
    if (vp && typeof vp.pan === 'number') walkerArrow.style.transform = 'rotate(' + vp.pan + 'deg)';
  }
  function hideWalker() { if (walker) walker.setMap(null); }

  function closeRoadview() {
    roadviewRun++;
    $('kakaoRoadviewPanel').hidden = true;
    $('kakaoRoadviewNote').textContent = '';
    hideWalker();
  }

  function passes(it) {
    var type = $('kakaoTypeFilter').value, state = $('kakaoBuildingFilter').value, block = $('kakaoBlockFilter').value;
    var q = $('kakaoSearch').value.trim();
    if (type !== 'all' && it.type !== type) return false;
    if (state !== 'all' && it.state !== state) return false;
    if (block !== 'all' && it.row.block_id !== block) return false;
    if (q && it.address.indexOf(q) === -1) return false;
    return true;
  }

  function render(fit) {
    activeOverlays.forEach(function (o) { o.setMap(null); });
    activeOverlays.clear();
    var shown = 0, bounds = new kakao.maps.LatLngBounds();
    items.forEach(function (it) {
      if (it.lat === null || !passes(it)) return;
      if (!it.overlay) {
        it.overlay = new kakao.maps.CustomOverlay({ position: new kakao.maps.LatLng(it.lat, it.lng), content: pinContent(it), yAnchor: 0.5, xAnchor: 0.5, clickable: true, zIndex: it.state === 'building' ? 3 : 2 });
      }
      it.overlay.setMap(map);
      activeOverlays.add(it.overlay);
      bounds.extend(new kakao.maps.LatLng(it.lat, it.lng));
      shown++;
    });
    if (fit && shown) map.setBounds(bounds);
    var withAddress = items.filter(function (it) { return it.hasAddress; }).length;
    var placed = items.filter(function (it) { return it.lat !== null; }).length;
    var missing = withAddress - placed, noAddress = items.length - withAddress;
    var savedCount = items.filter(function (it) { return !it.row.fromSource; }).length;
    var text = '필지 ' + items.length + '건 중 ' + shown + '건 표시 (저장된 자료 ' + savedCount + ' + 원본 자료만 있는 필지 ' + (items.length - savedCount) + ')';
    if (sourceNoAddress) text += ' · 원본 자료 중 지번주소가 없는 ' + sourceNoAddress + '건은 표시 불가';
    if (noAddress) text += ' · 지번주소 없음 ' + noAddress + '건';
    if (missing) text += ' · 지도에서 위치를 못 찾음 ' + missing + '건';
    setStatus(text);
    $('kakaoRetry').hidden = !missing;
  }

  function fillBlockFilter() {
    var select = $('kakaoBlockFilter');
    select.options[0].textContent = cfg.label + ' 전체';
    var ids = Array.from(new Set(items.map(function (it) { return it.row.block_id; })));
    ids.sort(function (a, b) { return a.localeCompare(b, 'en', { numeric: true }); });
    ids.forEach(function (id) {
      var option = document.createElement('option');
      option.value = id; option.textContent = blockName(id) + ' 블럭';
      select.appendChild(option);
    });
  }

  function bindControls() {
    document.querySelectorAll('[data-maptype]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var sky = btn.dataset.maptype === 'sky';
        map.setMapTypeId(sky ? kakao.maps.MapTypeId.HYBRID : kakao.maps.MapTypeId.ROADMAP);
        document.querySelectorAll('[data-maptype]').forEach(function (b) { b.setAttribute('aria-pressed', String(b === btn)); });
      });
    });
    var overlayTypes = { district: kakao.maps.MapTypeId.USE_DISTRICT, roadview: kakao.maps.MapTypeId.ROADVIEW };
    document.querySelectorAll('[data-overlay]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var on = btn.getAttribute('aria-pressed') !== 'true', id = overlayTypes[btn.dataset.overlay];
        if (on) map.addOverlayMapTypeId(id); else map.removeOverlayMapTypeId(id);
        btn.setAttribute('aria-pressed', String(on));
        if (btn.dataset.overlay === 'roadview') { roadviewClickOn = on; $('kakaoHint').hidden = !on; }
      });
    });
    $('kakaoRoadviewClose').addEventListener('click', closeRoadview);
    kakao.maps.event.addListener(map, 'click', function (mouseEvent) {
      if (!roadviewClickOn) return;
      infoWindow.close();
      openRoadviewAt(mouseEvent.latLng, { title: '선택한 위치', faceTarget: false });
    });
    ['kakaoTypeFilter', 'kakaoBuildingFilter', 'kakaoBlockFilter'].forEach(function (id) {
      $(id).addEventListener('change', function () { infoWindow.close(); render(true); });
    });
    var timer = null;
    $('kakaoSearch').addEventListener('input', function () { clearTimeout(timer); timer = setTimeout(function () { render(true); }, 300); });
    $('kakaoFit').addEventListener('click', function () { render(true); });
    $('kakaoDistrictFit').addEventListener('click', function () { infoWindow.close(); applyDistrictView(); });
    $('kakaoPinToggle').addEventListener('click', function () { setPins(!pinsOn); });
    $('kakaoRetry').addEventListener('click', async function () {
      $('kakaoRetry').disabled = true;
      await resolveAll(true);
      items.forEach(function (it) { it.overlay = null; });
      render(false);
      $('kakaoRetry').disabled = false;
    });
  }

  // ---------- 택지지구 전체 보기 ----------
  function boundsFromPoints(points) {
    var b = new kakao.maps.LatLngBounds();
    points.forEach(function (p) { b.extend(new kakao.maps.LatLng(p[0], p[1])); });
    return b;
  }

  async function applyDistrictView() {
    var points = null;
    if (cfg.bounds) {
      points = cfg.bounds;
    } else if (cfg.anchors) {
      var found = [];
      for (var i = 0; i < cfg.anchors.length; i++) {
        var key = normalizeAddress(cfg.anchors[i]), hit = geoCache[key];
        if (hit === undefined) {
          var result = await geocode(cfg.anchors[i]);
          if (result) { hit = [result.lat, result.lng]; geoCache[key] = hit; }
          else if (result === null) { geoCache[key] = 0; }
        }
        if (Array.isArray(hit)) found.push(hit);
      }
      saveCache();
      if (found.length) points = found;
    }
    if (!points) {
      map.setCenter(new kakao.maps.LatLng(cfg.center[0], cfg.center[1]));
      map.setLevel(cfg.level);
      return;
    }
    map.setBounds(boundsFromPoints(points), 40, 40, 40, 40);
    if (map.getLevel() < cfg.level) map.setLevel(cfg.level); // 대표 주소가 한 곳뿐이어도 지구 주변이 보이게 너무 확대되지 않도록
  }

  // ---------- 필지 핀 켜기/끄기 ----------
  async function loadPins() {
    pinsLoading = true;
    setStatus('택지 필지 자료를 불러오는 중입니다.');
    try {
      var rows = await loadParcels();
      var extra = sourceRows(await loadSourceParcels(), rows);
      sourceNoAddress = extra.noAddress || 0;
      items = buildItems(rows.concat(extra));
      fillBlockFilter();
      await resolveAll(false);
      pinsLoaded = true;
    } finally {
      pinsLoading = false;
    }
  }

  async function setPins(on) {
    if (pinsLoading) return;
    var button = $('kakaoPinToggle');
    pinsOn = on;
    button.setAttribute('aria-pressed', String(on));
    button.textContent = on ? '필지 핀 끄기' : '필지 핀 켜기';
    $('kakaoPinFilters').hidden = !on;
    $('kakaoLegend').hidden = !on;
    infoWindow.close();
    if (!on) {
      activeOverlays.forEach(function (o) { o.setMap(null); });
      activeOverlays.clear();
      setStatus(cfg.label + ' 전체를 보고 있습니다. [필지 핀 켜기]를 누르면 등록된 필지가 표시됩니다.');
      return;
    }
    button.disabled = true;
    try {
      if (!pinsLoaded) await loadPins();
      if (pinsOn) render(false);
    } catch (error) {
      pinsOn = false;
      button.setAttribute('aria-pressed', 'false');
      button.textContent = '필지 핀 켜기';
      $('kakaoPinFilters').hidden = true;
      $('kakaoLegend').hidden = true;
      setStatus(error && error.message ? error.message : '필지 핀을 불러오지 못했습니다.');
    } finally {
      button.disabled = false;
    }
  }

  // ---------- 시작 ----------
  function applyDistrictTexts() {
    document.title = '하이탑부동산 | 실제 지도 보기 (' + cfg.label + ')';
    var sub = document.querySelector('.logo-sub');
    if (sub) sub.textContent = cfg.label + ' · 카카오맵';
    var back = $('kakaoBackLink');
    if (back) back.href = 'land-location.html?view=' + district;
  }

  async function start() {
    applyDistrictTexts();
    $('kakaoMap').hidden = false;
    $('kakaoControls').hidden = false;
    map = new kakao.maps.Map($('kakaoMap'), { center: new kakao.maps.LatLng(cfg.center[0], cfg.center[1]), level: cfg.level });
    window.HitopNaverLinks.bindMapView($('kakaoNaverListings'), map, 'land');
    geocoder = new kakao.maps.services.Geocoder();
    infoWindow = new kakao.maps.InfoWindow({ removable: true, zIndex: 10 });
    map.addControl(new kakao.maps.ZoomControl(), kakao.maps.ControlPosition.RIGHT);
    bindControls();
    await applyDistrictView();
    setStatus(cfg.label + ' 전체를 보고 있습니다. [필지 핀 켜기]를 누르면 등록된 필지가 표시됩니다.');
  }

  function loadSdk(key) {
    return new Promise(function (resolve, reject) {
      var script = document.createElement('script');
      script.src = 'https://dapi.kakao.com/v2/maps/sdk.js?appkey=' + encodeURIComponent(key) + '&libraries=services&autoload=false';
      script.onload = function () { kakao.maps.load(resolve); };
      script.onerror = function () { reject(new Error('카카오맵을 불러오지 못했습니다. 키와 등록한 사이트 주소(도메인)를 확인해주세요.')); };
      document.head.appendChild(script);
    });
  }

  (async function init() {
    var key = String(window.HITOP_KAKAO_JS_KEY || '').trim();
    if (!key) {
      $('kakaoSetupNotice').hidden = false;
      setStatus('카카오맵 키가 설정되면 지도가 표시됩니다.');
      return;
    }
    try {
      await loadSdk(key);
      await start();
    } catch (error) {
      setStatus(error && error.message ? error.message : '지도를 표시하지 못했습니다.');
    }
  })();
})();
