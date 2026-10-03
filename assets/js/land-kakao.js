/* 운정3지구 카카오맵 시범 화면
 * - land_parcels(Supabase)의 지번주소를 카카오 지오코딩으로 위경도로 바꿔 실제 지도 위에 표시합니다.
 * - 변환 결과는 이 브라우저(localStorage)에 저장해 다음 방문부터 바로 표시합니다. DB는 수정하지 않습니다.
 * - 건물 상태는 기존 택지 위치도에서 저장한 값(건물 있음/없음 확인/미확인)과 건축물대장 확인 기록을 그대로 읽습니다.
 */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var CACHE_KEY = 'hitop-kakao-geo-v1';
  var ADDRESS_PATTERN = /[가-힣]+(?:동|리)\s+(?:산\s*)?\d+/;
  var statusEl = $('kakaoStatus');
  var map = null, geocoder = null, infoWindow = null;
  var items = [];          // {row, address, lat, lng, state, type, registered, overlay}
  var geoCache = loadCache();
  var activeOverlays = new Set();
  var roadview = null, roadviewClient = null, roadviewTarget = null, roadviewRun = 0;

  function setStatus(text) { statusEl.textContent = text; }

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
      var url = SUPABASE_URL + '/rest/v1/land_parcels?select=id,block_id,subblock,parcel,data&block_id=like.third-*&order=block_id,subblock,parcel&limit=' + page + '&offset=' + offset;
      var res = await fetchWithTimeout(url, { headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + token } }, 30000);
      if (!res.ok) throw new Error('필지 자료를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.');
      var part = await res.json();
      rows = rows.concat(part);
      if (part.length < page) break;
      offset += page;
    }
    return rows;
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
    el.className = 'kk-pin ' + it.state + (it.type === 'shop' ? ' shop' : '') + (it.registered ? ' registered' : '');
    el.title = it.address;
    el.addEventListener('click', function () { openInfo(it); });
    return el;
  }

  function line(parent, text, cls) {
    var span = document.createElement('span');
    span.className = 'row' + (cls ? ' ' + cls : '');
    span.textContent = text;
    parent.appendChild(span);
  }

  function openInfo(it) {
    var data = it.data, root = document.createElement('div');
    root.className = 'kk-info';
    var title = document.createElement('b');
    title.textContent = it.row.block_id.replace('third-', '') + '-' + it.row.subblock + '-' + it.row.parcel;
    root.appendChild(title);
    line(root, it.address);
    line(root, (it.type === 'shop' ? '상가점포' : '주거전용') + ' · ' + stateLabel(it.state));
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
    root.appendChild(links);
    infoWindow.setContent(root);
    infoWindow.setPosition(new kakao.maps.LatLng(it.lat, it.lng));
    infoWindow.open(map);
  }

  // ---------- 화면 안 로드뷰 ----------
  function openRoadview(it) {
    var panel = $('kakaoRoadviewPanel'), view = $('kakaoRoadview'), note = $('kakaoRoadviewNote');
    var run = ++roadviewRun;
    panel.hidden = false;
    $('kakaoRoadviewTitle').textContent = '로드뷰 · ' + it.row.block_id.replace('third-', '') + '-' + it.row.subblock + '-' + it.row.parcel + ' · ' + it.address;
    $('kakaoRoadviewExternal').href = 'https://map.kakao.com/link/roadview/' + it.lat + ',' + it.lng;
    note.textContent = '로드뷰를 찾는 중입니다.';
    view.classList.remove('is-empty');
    panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    var position = new kakao.maps.LatLng(it.lat, it.lng);
    roadviewTarget = position;
    if (!roadview) {
      roadview = new kakao.maps.Roadview(view);
      roadviewClient = new kakao.maps.RoadviewClient();
      kakao.maps.event.addListener(roadview, 'init', function () {
        // 로드뷰가 열리면 해당 필지 쪽을 바라보게 맞춥니다.
        try {
          var projection = roadview.getProjection();
          if (projection && roadviewTarget) roadview.setViewpoint(projection.viewpointFromCoords(roadviewTarget, 2));
        } catch (e) { /* 방향 맞춤에 실패해도 로드뷰는 그대로 사용 가능 */ }
      });
    }
    roadviewClient.getNearestPanoId(position, 50, function (panoId) {
      if (run !== roadviewRun) return; // 그 사이 다른 필지를 눌렀거나 닫은 경우
      if (panoId === null || panoId === undefined) {
        view.classList.add('is-empty');
        note.textContent = '이 필지 50m 안에는 로드뷰 사진이 없습니다. 신규 개발지역은 아직 촬영 전이거나 오래된 사진일 수 있어요. 위성지도와 건축물대장으로 확인해주세요.';
        return;
      }
      roadview.setPanoId(panoId, position);
      note.textContent = '로드뷰는 카카오가 촬영한 시점의 사진입니다. 촬영 이후 새로 지어진 건물은 보이지 않을 수 있어요.';
    });
  }

  function closeRoadview() {
    roadviewRun++;
    $('kakaoRoadviewPanel').hidden = true;
    $('kakaoRoadviewNote').textContent = '';
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
        it.overlay = new kakao.maps.CustomOverlay({ position: new kakao.maps.LatLng(it.lat, it.lng), content: pinContent(it), yAnchor: 0.5, xAnchor: 0.5, zIndex: it.state === 'building' ? 3 : 2 });
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
    var text = '필지 ' + items.length + '건 중 ' + shown + '건 표시';
    if (noAddress) text += ' · 지번주소 없음 ' + noAddress + '건';
    if (missing) text += ' · 지도에서 위치를 못 찾음 ' + missing + '건';
    setStatus(text);
    $('kakaoRetry').hidden = !missing;
  }

  function fillBlockFilter() {
    var select = $('kakaoBlockFilter');
    var ids = Array.from(new Set(items.map(function (it) { return it.row.block_id; })));
    ids.sort(function (a, b) { return a.localeCompare(b, 'en', { numeric: true }); });
    ids.forEach(function (id) {
      var option = document.createElement('option');
      option.value = id; option.textContent = id.replace('third-', '') + ' 블럭';
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
        if (btn.dataset.overlay === 'roadview') $('kakaoHint').hidden = !on;
      });
    });
    $('kakaoRoadviewClose').addEventListener('click', closeRoadview);
    ['kakaoTypeFilter', 'kakaoBuildingFilter', 'kakaoBlockFilter'].forEach(function (id) {
      $(id).addEventListener('change', function () { infoWindow.close(); render(true); });
    });
    var timer = null;
    $('kakaoSearch').addEventListener('input', function () { clearTimeout(timer); timer = setTimeout(function () { render(true); }, 300); });
    $('kakaoFit').addEventListener('click', function () { render(true); });
    $('kakaoRetry').addEventListener('click', async function () {
      $('kakaoRetry').disabled = true;
      await resolveAll(true);
      items.forEach(function (it) { it.overlay = null; });
      render(false);
      $('kakaoRetry').disabled = false;
    });
  }

  // ---------- 시작 ----------
  async function start() {
    $('kakaoMap').hidden = false;
    $('kakaoControls').hidden = false;
    $('kakaoLegend').hidden = false;
    map = new kakao.maps.Map($('kakaoMap'), { center: new kakao.maps.LatLng(37.7195, 126.7420), level: 6 });
    geocoder = new kakao.maps.services.Geocoder();
    infoWindow = new kakao.maps.InfoWindow({ removable: true, zIndex: 10 });
    map.addControl(new kakao.maps.ZoomControl(), kakao.maps.ControlPosition.RIGHT);
    setStatus('택지 필지 자료를 불러오는 중입니다.');
    var rows = await loadParcels();
    items = buildItems(rows);
    fillBlockFilter();
    bindControls();
    await resolveAll(false);
    render(true);
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
