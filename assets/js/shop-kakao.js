/* 상가 카카오맵 화면
 * - 상가 자료관리에 등록한 건물(카테고리 '상가')의 주소(예: 와동동 1436외1필지)를 카카오 지오코딩으로 위경도로 바꿔 지도에 표시합니다.
 * - 호실 현황(공실 여부)은 기존 상가 위치도와 같은 buildings.units 자료를 읽기만 합니다. DB는 수정하지 않습니다.
 * - 변환한 위치는 이 브라우저(localStorage)에 저장해 다음 방문부터 바로 표시합니다. (택지 지도와 같은 저장소를 공유)
 */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var CACHE_KEY = 'hitop-kakao-geo-v1';
  var ADDRESS_PATTERN = /[가-힣]+(?:동|리)\s*(?:산\s*)?\d+(?:-\d+)?/;
  var DEFAULT_CENTER = [37.7226, 126.7500], DEFAULT_LEVEL = 5;

  var statusEl = $('kakaoStatus');
  var map = null, geocoder = null, infoWindow = null;
  var items = [];                 // {id,name,address,query,total,vacant,state,floors,lat,lng,overlay,el}
  var geoCache = loadCache();
  var activeOverlays = new Set();
  var selectedId = '';
  var saved = {};                 // 직접 옮겨 저장한 위치: 건물 id -> [lat, lng]
  var geoAvailable = true;        // 위치 저장용 표(shop_building_geo)를 쓸 수 있는지
  var editing = false;            // 핀 위치 수정 모드

  function setStatus(text) { statusEl.textContent = text; }
  function loadCache() { try { return JSON.parse(localStorage.getItem(CACHE_KEY) || '{}') || {}; } catch (e) { return {}; } }
  function saveCache() { try { localStorage.setItem(CACHE_KEY, JSON.stringify(geoCache)); } catch (e) { /* 저장 공간이 없어도 화면은 동작 */ } }
  function normalizeAddress(text) {
    var value = String(text || '').replace(/\s+/g, ' ').trim();
    return /파주/.test(value) ? value : '파주시 ' + value;
  }

  // ---------- 데이터 불러오기 (기존 상가 위치도와 같은 출처) ----------
  async function loadBuildings() {
    var session = await hitopAuthClient.auth.getSession();
    if (session.error || !session.data.session) { hitopRedirectToLogin(); return null; }
    hitopApplyAuthHeader(session.data.session);
    var results = await Promise.all([
      getDriveResources(),
      getAllBuildingFloors(),
      fetchWithTimeout(SUPABASE_URL + '/rest/v1/buildings?select=local_id,name,units', { headers: headers })
    ]);
    var resources = results[0], floors = results[1], recordsRes = results[2];
    if (!recordsRes.ok) throw new Error('건물 호실 자료를 불러오지 못했습니다.');
    var records = await recordsRes.json();
    // 카테고리 이름은 '운정역 상가', '운정3지구 상가(NT)'처럼 다양하므로 이름에 '상가'가 들어간 것을 모두 포함합니다.
    return resources.filter(function (r) { return /상가/.test(String(r.category || '')); }).map(function (r) {
      var rec = records.find(function (x) { return x.local_id === r.id; }) || records.find(function (x) { return x.name === r.name; }) || null;
      var line = String(r.memo || '').split('\n').find(function (l) { return /^주소\s*:/.test(l); });
      var address = line ? line.replace(/^주소\s*:/, '').trim() : '';
      var match = address.match(ADDRESS_PATTERN);
      var units = rec && Array.isArray(rec.units) ? rec.units : [];
      var vacant = units.filter(function (u) { return (u.공실여부 || '공실') === '공실'; }).length;
      return {
        id: r.id, name: r.name, address: address, query: match ? match[0] : '',
        total: units.length, vacant: vacant,
        state: !units.length ? 'none' : vacant ? 'vacant' : 'full',
        floors: floors.filter(function (f) { return f.building_id === r.id; }),
        lat: null, lng: null, overlay: null, el: null
      };
    });
  }

  // ---------- 지오코딩 ----------
  function geocode(query) {
    return new Promise(function (resolve) {
      geocoder.addressSearch(normalizeAddress(query), function (result, status) {
        if (status === kakao.maps.services.Status.OK && result[0]) resolve({ lat: Number(result[0].y), lng: Number(result[0].x) });
        else if (status === kakao.maps.services.Status.ZERO_RESULT) resolve(null);
        else resolve(undefined); // 일시 오류: 저장하지 않고 다음에 다시 시도
      });
    });
  }

  async function resolveAll(retryFailed) {
    var wanted = items.filter(function (it) { return it.query; });
    var unique = Array.from(new Set(wanted.map(function (it) { return normalizeAddress(it.query); })));
    var queue = unique.filter(function (key) { return geoCache[key] === undefined || (retryFailed && geoCache[key] === 0); });
    var done = 0;
    var workers = Array.from({ length: 4 }, async function () {
      while (queue.length) {
        var key = queue.shift();
        var result = await geocode(key);
        if (result) geoCache[key] = [result.lat, result.lng];
        else if (result === null) geoCache[key] = 0;
        done++;
        if (done % 5 === 0) setStatus('건물 위치를 찾는 중입니다. (' + done + '/' + (done + queue.length) + ')');
      }
    });
    await Promise.all(workers);
    saveCache();
    // 같은 지번에 건물이 둘 이상이면 겹치지 않게 살짝 옆으로 벌려 표시합니다. 직접 옮겨 저장한 위치는 그대로 씁니다.
    var used = {};
    items.forEach(function (it) {
      it.lat = null; it.lng = null; it.overlay = null; it.el = null; it.manual = false;
      if (saved[it.id]) { it.lat = saved[it.id][0]; it.lng = saved[it.id][1]; it.manual = true; return; }
      if (!it.query) return;
      var hit = geoCache[normalizeAddress(it.query)];
      if (!Array.isArray(hit)) return;
      var n = used[hit[0] + ',' + hit[1]] = (used[hit[0] + ',' + hit[1]] || 0) + 1;
      it.lat = hit[0];
      it.lng = hit[1] + (n - 1) * 0.00018;
    });
  }

  // ---------- 핀 위치 직접 수정 (shop_building_geo) ----------
  async function loadSaved() {
    try {
      var res = await fetchWithTimeout(SUPABASE_URL + '/rest/v1/shop_building_geo?select=building_id,lat,lng', { headers: headers });
      if (!res.ok) { geoAvailable = false; return; }
      (await res.json()).forEach(function (row) {
        if (Number.isFinite(Number(row.lat)) && Number.isFinite(Number(row.lng))) saved[row.building_id] = [Number(row.lat), Number(row.lng)];
      });
    } catch (e) { geoAvailable = false; }
  }

  async function savePosition(it, lat, lng) {
    var res = await fetchWithTimeout(SUPABASE_URL + '/rest/v1/shop_building_geo?on_conflict=building_id', {
      method: 'POST',
      headers: Object.assign({}, headers, { Prefer: 'resolution=merge-duplicates,return=minimal' }),
      body: JSON.stringify({ building_id: it.id, lat: lat, lng: lng, updated_at: new Date().toISOString() })
    });
    if (!res.ok) throw new Error('위치를 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.');
    saved[it.id] = [lat, lng];
  }

  async function deletePosition(it) {
    var res = await fetchWithTimeout(SUPABASE_URL + '/rest/v1/shop_building_geo?building_id=eq.' + encodeURIComponent(it.id), {
      method: 'DELETE', headers: headers
    });
    if (!res.ok) throw new Error('자동 위치로 되돌리지 못했습니다. 잠시 후 다시 시도해 주세요.');
    delete saved[it.id];
  }

  function selectedItem() { return items.find(function (x) { return x.id === selectedId; }) || null; }

  function updateEditUi() {
    var it = selectedItem();
    $('shopEditToggle').setAttribute('aria-pressed', String(editing));
    $('shopEditToggle').textContent = editing ? '핀 위치 수정 끝내기' : '핀 위치 수정';
    $('shopEditHelp').hidden = !editing;
    $('shopEditReset').hidden = !(editing && it && it.manual);
    $('kakaoMap').classList.toggle('shop-editing', editing);
  }

  function selectForEdit(it) {
    var previous = selectedItem();
    if (previous && previous.el) previous.el.classList.remove('selected');
    selectedId = it.id;
    if (it.el) it.el.classList.add('selected');
    infoWindow.close();
    updateEditUi();
    setStatus('수정할 건물: ' + it.name + ' — 지도에서 건물이 있는 정확한 자리를 눌러 주세요. (핀의 뾰족한 끝이 그 자리에 놓입니다)');
  }

  async function placeSelected(latLng) {
    var it = selectedItem();
    if (!editing || !it) return;
    try {
      await savePosition(it, latLng.getLat(), latLng.getLng());
      it.lat = latLng.getLat(); it.lng = latLng.getLng(); it.manual = true;
      it.overlay = null; it.el = null;
      render(false);
      var again = selectedItem();
      if (again && again.el) again.el.classList.add('selected');
      updateEditUi();
      setStatus(it.name + ' 위치를 저장했습니다. 다른 건물을 고르거나 [핀 위치 수정 끝내기]를 눌러 주세요.');
    } catch (error) {
      setStatus(error && error.message ? error.message : '위치를 저장하지 못했습니다.');
    }
  }

  async function resetSelected() {
    var it = selectedItem();
    if (!it || !it.manual) return;
    $('shopEditReset').disabled = true;
    try {
      await deletePosition(it);
      await resolveAll(false);
      render(false);
      var again = selectedItem();
      if (again && again.el) again.el.classList.add('selected');
      updateEditUi();
      setStatus(it.name + ' 위치를 주소 기준 자동 위치로 되돌렸습니다.');
    } catch (error) {
      setStatus(error && error.message ? error.message : '되돌리지 못했습니다.');
    } finally {
      $('shopEditReset').disabled = false;
    }
  }

  function toggleEditing() {
    if (!geoAvailable) { setStatus('위치 저장용 표를 사용할 수 없어 핀을 옮길 수 없습니다.'); return; }
    editing = !editing;
    infoWindow.close();
    updateEditUi();
    if (editing) setStatus('핀 위치 수정 모드입니다. 지도의 핀이나 아래 목록에서 건물을 고른 뒤, 지도에서 정확한 자리를 눌러 주세요.');
    else render(false);
  }

  // ---------- 지도 표시 ----------
  function stateText(it) { return !it.total ? '호실 미등록' : '공실 ' + it.vacant + '/' + it.total; }

  function pinContent(it) {
    var el = document.createElement('div');
    el.className = 'shop-pin ' + it.state + (selectedId === it.id ? ' selected' : '');
    var body = document.createElement('div');
    body.className = 'shop-pin-body';
    var name = document.createElement('strong'); name.textContent = it.name;
    var sub = document.createElement('span'); sub.textContent = stateText(it);
    body.append(name, sub);
    el.appendChild(body);
    el.title = it.name + ' · ' + it.address;
    el.addEventListener('click', function () { if (editing) selectForEdit(it); else openInfo(it); });
    it.el = el;
    return el;
  }

  function matches(it) {
    var filter = $('shopVacancyFilter').value;
    if (filter !== 'all' && it.state !== filter) return false;
    var q = $('shopSearch').value.trim().toLowerCase();
    if (q && (it.name + ' ' + it.address).toLowerCase().indexOf(q) < 0) return false;
    return true;
  }

  function render(fit) {
    activeOverlays.forEach(function (o) { o.setMap(null); });
    activeOverlays.clear();
    var shown = 0, listed = items.filter(matches), bounds = new kakao.maps.LatLngBounds();
    listed.forEach(function (it) {
      if (it.lat === null) return;
      if (!it.overlay) {
        it.overlay = new kakao.maps.CustomOverlay({
          position: new kakao.maps.LatLng(it.lat, it.lng), content: pinContent(it),
          xAnchor: 0, yAnchor: 0, clickable: true, zIndex: it.state === 'vacant' ? 3 : 2
        });
      }
      it.overlay.setMap(map);
      activeOverlays.add(it.overlay);
      bounds.extend(new kakao.maps.LatLng(it.lat, it.lng));
      shown++;
    });
    if (fit && shown) map.setBounds(bounds, 60, 60, 60, 60);
    var noAddress = items.filter(function (it) { return !it.query; }).length;
    var missing = items.filter(function (it) { return it.query && it.lat === null; }).length;
    var text = '상가 건물 ' + items.length + '개 중 ' + shown + '개 표시';
    if (noAddress) text += ' · 주소 없음 ' + noAddress + '개';
    if (missing) text += ' · 지도에서 위치를 못 찾음 ' + missing + '개';
    setStatus(text);
    $('shopRetry').hidden = !missing;
    renderList(listed);
  }

  function renderList(listed) {
    var box = $('shopList');
    box.replaceChildren();
    listed.forEach(function (it) {
      var button = document.createElement('button');
      button.type = 'button';
      button.className = it.state + (it.lat === null ? ' unplaced' : '');
      button.append(it.name);
      var small = document.createElement('small');
      small.textContent = stateText(it) + (it.lat === null ? ' · 지도 위치 없음' : it.manual ? ' · 위치 직접 지정' : '');
      button.appendChild(small);
      button.addEventListener('click', function () {
        if (editing) {
          if (it.lat !== null) { map.setLevel(3); map.setCenter(new kakao.maps.LatLng(it.lat, it.lng)); }
          selectForEdit(it);
          $('kakaoMap').scrollIntoView({ behavior: 'smooth', block: 'center' });
          return;
        }
        if (it.lat === null) { openInfo(it, true); return; }
        map.setLevel(3);
        map.setCenter(new kakao.maps.LatLng(it.lat, it.lng));
        openInfo(it);
        $('kakaoMap').scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
      box.appendChild(button);
    });
    $('shopListCount').textContent = '(' + listed.length + '개)';
    $('shopListSection').hidden = false;
    $('shopLegend').hidden = false;
  }

  function openInfo(it, noMap) {
    var previous = items.find(function (x) { return x.id === selectedId; });
    if (previous && previous.el) previous.el.classList.remove('selected');
    selectedId = it.id;
    if (it.el) it.el.classList.add('selected');

    var root = document.createElement('div');
    root.className = 'kk-info';
    var title = document.createElement('b'); title.textContent = it.name; root.appendChild(title);
    function line(text) { var s = document.createElement('span'); s.className = 'row'; s.textContent = text; root.appendChild(s); }
    line(it.address || '주소 없음');
    line(it.total ? '호실 ' + it.total + '개 · 공실 ' + it.vacant + '개' : '호실이 아직 등록되지 않았습니다.');
    var links = document.createElement('div'); links.className = 'links';
    function link(label, href) {
      var a = document.createElement('a'); a.href = href; a.textContent = label; links.appendChild(a);
    }
    var id = encodeURIComponent(it.id);
    link('건물 상세', 'building-detail.html?id=' + id);
    link('개요', 'building-overview.html?id=' + id);
    var first = it.floors[0];
    link('층별 현황', 'floor-status.html?' + new URLSearchParams(first ? { id: it.id, floorId: first.id, floor: String(first.floor_number || '') } : { id: it.id }).toString());
    if (it.lat !== null) {
      var a = document.createElement('a');
      a.href = 'https://map.kakao.com/link/map/' + encodeURIComponent(it.name) + ',' + it.lat + ',' + it.lng;
      a.target = '_blank'; a.rel = 'noopener'; a.textContent = '카카오맵';
      links.appendChild(a);
    }
    window.HitopNaverLinks.append(links, it.query || it.address, '', {lat:it.lat,lng:it.lng});
    root.appendChild(links);
    if (noMap || it.lat === null) {
      line('지도에서 위치를 찾지 못했습니다. 자료관리에서 주소를 "와동동 1460"처럼 지번으로 확인해 주세요.');
      infoWindow.close();
      setStatus(it.name + ' · ' + (it.address || '주소 없음') + ' — 지도 위치 없음');
      return;
    }
    infoWindow.setContent(root);
    infoWindow.setPosition(new kakao.maps.LatLng(it.lat, it.lng));
    infoWindow.open(map);
  }

  function bindControls() {
    document.querySelectorAll('[data-maptype]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        map.setMapTypeId(btn.dataset.maptype === 'sky' ? kakao.maps.MapTypeId.HYBRID : kakao.maps.MapTypeId.ROADMAP);
        document.querySelectorAll('[data-maptype]').forEach(function (b) { b.setAttribute('aria-pressed', String(b === btn)); });
      });
    });
    document.querySelectorAll('[data-overlay="district"]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var on = btn.getAttribute('aria-pressed') !== 'true';
        if (on) map.addOverlayMapTypeId(kakao.maps.MapTypeId.USE_DISTRICT); else map.removeOverlayMapTypeId(kakao.maps.MapTypeId.USE_DISTRICT);
        btn.setAttribute('aria-pressed', String(on));
      });
    });
    $('shopVacancyFilter').addEventListener('change', function () { infoWindow.close(); render(true); });
    var timer = null;
    $('shopSearch').addEventListener('input', function () { clearTimeout(timer); timer = setTimeout(function () { render(true); }, 300); });
    $('shopFit').addEventListener('click', function () { render(true); });
    $('shopEditToggle').addEventListener('click', toggleEditing);
    $('shopEditReset').addEventListener('click', resetSelected);
    kakao.maps.event.addListener(map, 'click', function (mouseEvent) { placeSelected(mouseEvent.latLng); });
    $('shopRetry').addEventListener('click', async function () {
      $('shopRetry').disabled = true;
      await resolveAll(true);
      render(false);
      $('shopRetry').disabled = false;
    });
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
    if (!key) { $('kakaoSetupNotice').hidden = false; setStatus('카카오맵 키가 설정되면 지도가 표시됩니다.'); return; }
    try {
      await loadSdk(key);
      $('kakaoMap').hidden = false;
      $('kakaoControls').hidden = false;
      map = new kakao.maps.Map($('kakaoMap'), { center: new kakao.maps.LatLng(DEFAULT_CENTER[0], DEFAULT_CENTER[1]), level: DEFAULT_LEVEL });
      geocoder = new kakao.maps.services.Geocoder();
      infoWindow = new kakao.maps.InfoWindow({ removable: true, zIndex: 10 });
      map.addControl(new kakao.maps.ZoomControl(), kakao.maps.ControlPosition.RIGHT);
      setStatus('상가 건물 자료를 불러오는 중입니다.');
      var loaded = await loadBuildings();
      if (!loaded) return;
      items = loaded;
      bindControls();
      if (!items.length) { setStatus('등록된 상가 건물이 없습니다. 상가 자료관리에서 건물을 먼저 등록해 주세요.'); return; }
      setStatus('건물 위치를 찾는 중입니다.');
      await loadSaved();
      await resolveAll(false);
      render(true);
    } catch (error) {
      setStatus(error && error.message ? error.message : '지도를 표시하지 못했습니다.');
    }
  })();
})();
