(function () {
  'use strict';

  const $ = id => document.getElementById(id);
  const residential = document.body.dataset.resourceScope === 'residential';
  const scope = residential ? 'residential' : 'commercial';
  const label = residential ? '주거' : '상가';
  const prefix = residential ? 'residential' : 'shop';
  const requestedId = new URLSearchParams(location.search).get('id');
  const PY = 3.30579;
  const DEFAULT_BIZ = ['카페', '일반음식점', '주점', '병원·의원', '약국', '학원', '편의점·마트', '미용·뷰티', '부동산', '사무실', '기타'];
  const STATUS_CLASS = { '공실':'vacant', '임차중':'rent', '매매가능':'sale', '계약진행':'contract' };
  const FILTER_KEY = prefix + 'Location.savedFilters.v1';

  let buildings = [];   // { id, name, address, record, floors }
  let rows = [];        // flattened units
  let pins = {};        // building id -> {x, y}
  let pinsAvailable = true;
  let pinEditing = false;
  let pinTarget = '';
  let selectedBuilding = '';
  let zoom = 1;
  let current = null;   // row being edited
  let autoPins = {};    // building id -> {x, y} 주소(위경도)로 자동 계산한 위치

  // ----- 주소(위경도) → 위치도 좌표 자동 변환 -----
  // 위치도(LH 리플렛)에서 단지 이름·블럭번호가 보이는 곳 69곳의 좌표와 카카오 주소 검색 결과를 맞춰 만든 기준점.
  // [위도, 경도, 지도 가로 %, 지도 세로 %]
  const GEO_ADDRESS_PATTERN = /[가-힣]+(?:동|리)\s*(?:산\s*)?\d+(?:-\d+)?/;
  const GEO_CACHE_KEY = 'hitop-kakao-geo-v1'; // 카카오맵 화면과 같은 저장소를 같이 쓴다
  const GEO_CTRL = [[37.731632,126.75301,59.1,38.4],[37.73295,126.757576,63.2,37.6],[37.735355,126.760396,65.9,33.1],[37.734763,126.763458,67.5,31.4],[37.732902,126.753352,58.8,35.1],[37.733321,126.764807,68.6,36.2],[37.734655,126.758389,62.7,33.6],[37.715772,126.719451,23.7,67.5],[37.70899,126.719663,24.6,78.7],[37.735662,126.729888,36.4,29.8],[37.71541,126.714176,20.6,67.9],[37.736242,126.728279,33.5,29.4],[37.707812,126.722669,29.3,78.7],[37.735283,126.733918,39.9,28.2],[37.710973,126.719553,25.8,73.8],[37.741985,126.761639,66.4,19.75],[37.711282,126.717561,22.1,74.1],[37.733897,126.728549,33.6,32.5],[37.714441,126.707782,14,68.2],[37.738747,126.760076,64.4,26.5],[37.71535,126.709781,17,67.4],[37.737064,126.764225,69,28.8],[37.741605,126.729288,34.1,19.2],[37.717011,126.709879,16.4,64.2],[37.741272,126.726697,32.1,20.9],[37.712181,126.712117,18.3,71.5],[37.743524,126.756874,63.9,15],[37.73725,126.729715,35.9,27.1],[37.711487,126.713196,19.4,74.6],[37.715746,126.720991,27.4,67.1],[37.744535,126.731819,37.8,14.5],[37.742477,126.731368,37.8,17.8],[37.712107,126.723677,29.2,72.7],[37.74097,126.758129,61,19.6],[37.735839,126.725303,30.7,33.5],[37.739567,126.730373,35,23.4],[37.716966,126.706406,13.3,64.2],[37.738744,126.731737,38.1,24.5],[37.743148,126.729103,35.7,16.2],[37.712134,126.727068,32.7,74.1],[37.713289,126.725481,31.1,69.9],[37.708441,126.721874,26.5,79.3],[37.715864,126.747489,53.6,66.6],[37.725167,126.743639,49.1,47.1],[37.730633,126.739124,44,37.6],[37.724496,126.739262,44.6,48.9],[37.713408,126.74862,55.7,72.1],[37.716357,126.753429,57.4,66.6],[37.72573,126.750625,54.3,48.8],[37.728375,126.757649,61,43.3],[37.710928,126.758076,62.6,72.9],[37.732074,126.749511,55.1,39.6],[37.708772,126.749528,54.1,77.5],[37.730713,126.736036,40.1,38.6],[37.709512,126.757923,62,79.3],[37.727627,126.751044,55.1,43.8],[37.728978,126.752698,58.2,43.2],[37.728939,126.745353,49.9,43.1],[37.721205,126.750203,56.4,55.8],[37.724105,126.744152,49.5,53.5],[37.716589,126.756958,61.9,66.6],[37.726766,126.755449,58.2,47.4],[37.708814,126.753704,56.7,79.4],[37.723007,126.748577,52.3,54.1],[37.72552,126.754162,59.7,49.8],[37.710491,126.755524,60.8,72.9],[37.723977,126.735175,39.1,51.5],[37.712611,126.761454,66.7,72],[37.725602,126.767163,72.2,49.3]];
  const GEO_LAT0 = 37.725, GEO_LNG0 = 126.735;
  const geoFit = (function () {
    const solve = (rows, values) => {
      const M = [[0,0,0],[0,0,0],[0,0,0]], v = [0,0,0];
      rows.forEach((row, i) => { for (let j = 0; j < 3; j++) { v[j] += row[j] * values[i]; for (let k = 0; k < 3; k++) M[j][k] += row[j] * row[k]; } });
      for (let i = 0; i < 3; i++) {
        for (let r = 0; r < 3; r++) {
          if (r === i) continue;
          const f = M[r][i] / M[i][i];
          for (let k = i; k < 3; k++) M[r][k] -= f * M[i][k];
          v[r] -= f * v[i];
        }
      }
      return v.map((x, i) => x / M[i][i]);
    };
    const rows = GEO_CTRL.map(p => [(p[1] - GEO_LNG0) * 1000, (p[0] - GEO_LAT0) * 1000, 1]);
    const ax = solve(rows, GEO_CTRL.map(p => p[2])), ay = solve(rows, GEO_CTRL.map(p => p[3]));
    const affine = (lat, lng) => { const a = (lng - GEO_LNG0) * 1000, b = (lat - GEO_LAT0) * 1000; return [ax[0]*a + ax[1]*b + ax[2], ay[0]*a + ay[1]*b + ay[2]]; };
    const resid = GEO_CTRL.map(p => { const q = affine(p[0], p[1]); return [p[2] - q[0], p[3] - q[1]]; });
    return { affine, resid };
  })();
  function geoToPct(lat, lng) {
    const base = geoFit.affine(lat, lng);
    let wx = 0, wy = 0, ws = 0;
    GEO_CTRL.forEach((p, i) => {
      const q = geoFit.affine(p[0], p[1]);
      const d2 = (q[0] - base[0]) ** 2 + (q[1] - base[1]) ** 2;
      const w = 1 / (d2 + 4);
      wx += w * geoFit.resid[i][0]; wy += w * geoFit.resid[i][1]; ws += w;
    });
    // 기준점과 멀리 떨어진 곳은 보정량이 0에 가깝도록 줄인다.
    const near = Math.min(1, ws / 0.25);
    return [base[0] + near * wx / ws, base[1] + near * wy / ws];
  }
  function geoNormalize(text) { const v = String(text || '').replace(/\s+/g, ' ').trim(); return /파주/.test(v) ? v : '파주시 ' + v; }
  function loadScript(src) {
    return new Promise((resolve, reject) => { const s = document.createElement('script'); s.src = src; s.onload = resolve; s.onerror = () => reject(new Error(src)); document.head.appendChild(s); });
  }
  async function ensureKakaoGeocoder() {
    if (window.kakao && kakao.maps && kakao.maps.services) return new kakao.maps.services.Geocoder();
    if (!window.HITOP_KAKAO_JS_KEY) await loadScript('assets/js/kakao-config.js');
    if (!window.HITOP_KAKAO_JS_KEY) return null;
    if (!(window.kakao && kakao.maps)) await loadScript('https://dapi.kakao.com/v2/maps/sdk.js?appkey=' + encodeURIComponent(window.HITOP_KAKAO_JS_KEY) + '&libraries=services&autoload=false');
    await new Promise(resolve => kakao.maps.load(resolve));
    return new kakao.maps.services.Geocoder();
  }
  async function resolveAutoPins() {
    let cache = {};
    try { cache = JSON.parse(OfficeStorage.local.getItem(GEO_CACHE_KEY) || '{}') || {}; } catch (e) { cache = {}; }
    let savedGeo = {};
    try {
      const res = await fetchWithTimeout(SUPABASE_URL + '/rest/v1/shop_building_geo?select=building_id,lat,lng', { headers });
      if (res.ok) (await res.json()).forEach(row => { if (Number.isFinite(Number(row.lat)) && Number.isFinite(Number(row.lng))) savedGeo[row.building_id] = [Number(row.lat), Number(row.lng)]; });
    } catch (e) { /* 직접 옮긴 위치가 없어도 주소로 계산한다 */ }
    const missing = Array.from(new Set(buildings.filter(b => !savedGeo[b.id] && !b.regCoords && b.query).map(b => geoNormalize(b.query)).filter(k => cache[k] === undefined)));
    if (missing.length) {
      try {
        const geocoder = await ensureKakaoGeocoder();
        if (geocoder) {
          const one = q => new Promise(resolve => geocoder.addressSearch(q, (r, s) => resolve(s === kakao.maps.services.Status.OK && r[0] ? [Number(r[0].y), Number(r[0].x)] : s === kakao.maps.services.Status.ZERO_RESULT ? 0 : undefined)));
          const queue = missing.slice();
          await Promise.all(Array.from({ length: 4 }, async () => { while (queue.length) { const k = queue.shift(); const hit = await one(k); if (hit !== undefined) cache[k] = hit; } }));
          try { OfficeStorage.local.setItem(GEO_CACHE_KEY, JSON.stringify(cache)); } catch (e) { /* 저장 공간 없음 */ }
        }
      } catch (e) { console.warn('[위치도] 주소 위치 찾기 실패:', e.message || e); }
    }
    const used = {};
    autoPins = {};
    buildings.forEach(b => {
      const ll = savedGeo[b.id] || b.regCoords || (b.query && Array.isArray(cache[geoNormalize(b.query)]) ? cache[geoNormalize(b.query)] : null);
      if (!ll) return;
      const xy = geoToPct(ll[0], ll[1]);
      if (!(xy[0] > 1 && xy[0] < 99 && xy[1] > 1 && xy[1] < 99)) return; // 위치도 밖(다른 동네)은 표시하지 않음
      const key = xy[0].toFixed(1) + ',' + xy[1].toFixed(1);
      const n = used[key] = (used[key] || 0) + 1;
      autoPins[b.id] = { x: Math.round((xy[0] + (n - 1) * 0.35) * 100) / 100, y: Math.round(xy[1] * 100) / 100 };
    });
  }
  // 주소로 자동 계산한 위치는 작은 점으로, 고른 건물만 이름표로 크게 보여 준다.
  (function addAutoPinStyle() {
    const style = document.createElement('style');
    style.textContent = '.bpin.auto:not(.selected){width:14px;height:14px;padding:0;border-radius:50%;border:2px solid #fff;background:currentColor;box-shadow:0 0 0 1px rgba(0,0,0,.35);transform:translate(-50%,-50%);max-width:none}' +
      '.bpin.auto:not(.selected) strong,.bpin.auto:not(.selected) span{display:none}' +
      '.bpin.auto:not(.selected):hover{z-index:5;outline:2px solid #234c49}' +
      '.bpin.selected{z-index:6;box-shadow:0 0 0 4px rgba(230,57,70,.35),0 6px 16px rgba(0,0,0,.25);animation:bpinPulse 1.4s ease-in-out 3}' +
      '@keyframes bpinPulse{50%{box-shadow:0 0 0 10px rgba(230,57,70,.15),0 6px 16px rgba(0,0,0,.25)}}';
    document.head.appendChild(style);
  })();
  // 주소로 찾은 건물(카카오맵 링크로 들어온 건물)을 지도에서 크게 보여 주고 그 자리로 이동한다.
  function focusBuildingOnMap(id) {
    const p = pins[id] || autoPins[id];
    if (!p) return false;
    setZoom(Math.max(zoom, 2.2));
    requestAnimationFrame(() => {
      const scroller = $('mapScroll'), stage = $('mapStage');
      scroller.scrollLeft = p.x / 100 * stage.offsetWidth - scroller.clientWidth / 2;
      scroller.scrollTop = p.y / 100 * stage.offsetHeight - scroller.clientHeight / 2;
      $('mapTitle').scrollIntoView({ behavior:'smooth', block:'start' });
    });
    return true;
  }

  function say(text) { $('shopMessage').textContent = text; }
  function floorOfRoom(room) {
    const s = String(room || '').trim();
    const b = s.match(/^[Bb](\d+)/);
    if (b) return 'B' + (Math.floor(Number(b[1]) / 100) || Number(b[1]));
    const n = s.match(/^(\d+)/);
    if (!n) return '';
    const v = Number(n[1]);
    return String(v >= 100 ? Math.floor(v / 100) : v);
  }
  function floorSort(k) { const m = String(k).match(/^B(\d+)$/i); return m ? -Number(m[1]) : Number(k) || 0; }
  function num(v) { if (v === null || v === undefined || v === '') return null; const n = Number(v); return Number.isFinite(n) ? n : null; }
  function won(v) { const n = num(v); return n === null ? '—' : n.toLocaleString('ko-KR') + '만'; }
  function area(py) {
    const n = num(py);
    if (n === null) return '—';
    return `${(n * PY).toFixed(2)}㎡ (${n.toFixed(2)}평)`;
  }

  function hasOwnerContact(unit) {
    return Boolean(String(unit.소유주 || '').trim() && String(unit.연락처 || '').trim());
  }
  function hasListing(unit) { return Boolean(String(unit.listing_id || '').trim()); }

  function status(u) { return u.공실여부 || '공실'; }
  function deposit(u) { return num(u.현_보증금 ?? u.보증금); }
  function rent(u) { return num(u.현_월세 ?? u.월차임); }
  function roomLabel(r) { return r.endsWith('호') ? r : r + '호'; }
  function daysSince(iso) {
    if (!iso) return null;
    const t = Date.parse(iso);
    return Number.isFinite(t) ? Math.floor((Date.now() - t) / 86400000) : null;
  }
  function dateText(iso) { return iso ? String(iso).slice(0, 10) : ''; }

  // ----- 데이터 불러오기 -----
  async function loadAll() {
    const { data, error } = await hitopAuthClient.auth.getSession();
    if (error || !data.session) { hitopRedirectToLogin(); return false; }
    hitopApplyAuthHeader(data.session);
    const [resources, floors, recordsRes] = await Promise.all([
      getDriveResources(), getAllBuildingFloors(),
      fetchWithTimeout(SUPABASE_URL + '/rest/v1/buildings?select=local_id,name,units', { headers }), getDriveCategories()
    ]);
    if (!recordsRes.ok) throw new Error('건물 호실 조회 실패');
    const records = await recordsRes.json();
    const shops = HitopResourceRooms.visible(resources, scope).filter(r => residential || /상가/.test(String(r.category || '')));
    buildings = shops.map(r => {
      const rec = records.find(x => x.local_id === r.id) || records.find(x => x.name === r.name) || null;
      const line = String(r.memo || '').split('\n').find(l => /^주소\s*:/.test(l));
      const address = line ? line.replace(/^주소\s*:/, '').trim() : '';
      const fields = {};
      String(r.memo || '').split('---추가메모---')[0].split('\n').forEach(l => { const c = l.indexOf(':'); if (c >= 0) fields[l.slice(0, c).trim()] = l.slice(c + 1).trim(); });
      const lot = address.match(GEO_ADDRESS_PATTERN);
      const regLat = Number(fields['지도위도']), regLng = Number(fields['지도경도']);
      return { id: r.id, name: r.name, address, record: rec,
        query: lot ? lot[0] : /[가-힣]+(?:로|길)\s*\d+/.test(address) ? address : '',
        regCoords: regLat >= 33 && regLat <= 39 && regLng >= 124 && regLng <= 132 ? [regLat, regLng] : null,
        floors: floors.filter(f => f.building_id === r.id) };
    });
    rows = [];
    buildings.forEach(b => {
      const units = b.record && Array.isArray(b.record.units) ? b.record.units : [];
      units.forEach(u => {
        const room = String(u.호수 || '').trim();
        if (room) rows.push({ b, u, room, floor: floorOfRoom(room) });
      });
    });
    await loadPins();
    return true;
  }

  async function loadPins() {
    try {
      const res = await fetchWithTimeout(SUPABASE_URL + '/rest/v1/shop_building_pins?select=building_id,x,y', { headers });
      if (!res.ok) { pinsAvailable = false; return; }
      pins = {};
      (await res.json()).forEach(p => { pins[p.building_id] = { x:Number(p.x), y:Number(p.y) }; });
      pinsAvailable = true;
    } catch (e) { pinsAvailable = false; }
  }

  async function savePin(buildingId, x, y) {
    const res = await fetchWithTimeout(SUPABASE_URL + '/rest/v1/shop_building_pins?on_conflict=building_id', {
      method:'POST',
      headers: Object.assign({}, headers, { Prefer:'resolution=merge-duplicates,return=minimal' }),
      body: JSON.stringify({ building_id:buildingId, x, y })
    });
    if (!res.ok) throw new Error('위치 저장 실패: ' + await res.text());
  }

  // ----- 지도 -----
  function renderPins() {
    const layer = $('mapPins');
    layer.replaceChildren();
    buildings.forEach(b => {
      const p = pins[b.id] || autoPins[b.id];
      if (!p) return;
      const isAuto = !pins[b.id];
      const mine = rows.filter(r => r.b.id === b.id);
      const vacant = mine.filter(r => r.u.공실여부 === '공실').length;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'bpin ' + (!mine.length ? 'none' : vacant ? 'vacant' : '') + (selectedBuilding === b.id ? ' selected' : '') + (isAuto ? ' auto' : '');
      btn.title = b.name + (isAuto ? ' (주소로 자동 표시 · 대략 위치)' : '');
      btn.style.left = p.x + '%';
      btn.style.top = p.y + '%';
      const name = document.createElement('strong');
      name.textContent = b.name;
      const sub = document.createElement('span');
      sub.textContent = mine.length ? `공실 ${vacant}/${mine.length} · 연락처 ${mine.filter(r => hasOwnerContact(r.u)).length} · 매물 ${mine.filter(r => hasListing(r.u)).length}` : '호실 미등록';
      btn.append(name, sub);
      btn.addEventListener('click', e => { e.stopPropagation(); chooseBuilding(b.id); });
      layer.appendChild(btn);
    });
  }


  function renderBuildingLinks() {
    const box = $('mapBuildingList'); if (!box) return;
    box.replaceChildren();
    buildings.forEach(b => {
      const card = document.createElement('div'); card.className = 'shop-card';
      const name = document.createElement('button'); name.type = 'button'; name.className = 'shop-btn'; name.textContent = b.name;
      name.addEventListener('click', () => chooseBuilding(b.id)); card.appendChild(name);
      const address = document.createElement('p'); address.className = 'shop-help'; address.textContent = b.address || '주소 미등록'; card.appendChild(address);
      const links = document.createElement('div'); links.className = 'shop-tools';
      [['건물 상세', HitopResourceRooms.detailUrl('building-detail.html', b.id, scope)], ['카카오맵', prefix + '-kakao.html?id=' + encodeURIComponent(b.id)]].forEach(([text, href]) => {
        const a = document.createElement('a'); a.className = 'shop-btn'; a.textContent = text; a.href = href; links.appendChild(a);
      });
      HitopNaverLinks.append(links, b.address, 'shop-btn'); card.appendChild(links); box.appendChild(card);
    });
    if (!buildings.length) box.textContent = '등록된 건물이 없습니다.';
  }

  function chooseBuilding(id) {
    if (pinEditing) { pinTarget = id; setPinHelp(); return; }
    selectedBuilding = selectedBuilding === id ? '' : id;
    $('filterForm').building.value = selectedBuilding;
    applyFilters();
    renderPins();
    $('filterTitle').scrollIntoView({ behavior:'smooth', block:'start' });
  }

  function setPinHelp() {
    const help = $('pinHelp');
    help.hidden = !pinEditing && pinsAvailable;
    if (!pinsAvailable) {
      help.hidden = false;
      help.textContent = '건물 위치 저장용 테이블이 아직 없어 지도에 건물이 표시되지 않습니다. 호실 검색은 그대로 사용할 수 있습니다.';
      return;
    }
    if (pinEditing) {
      const b = buildings.find(x => x.id === pinTarget);
      help.textContent = b ? `"${b.name}" 위치를 지도에서 눌러 지정하세요.` : '위치를 지정할 건물을 아래 목록에서 고른 뒤 지도를 누르세요.';
    }
  }

  function renderPinPicker() {
    let box = $('pinPicker');
    if (!box) {
      box = document.createElement('div');
      box.id = 'pinPicker';
      box.className = 'shop-tools';
      $('pinHelp').after(box);
    }
    box.replaceChildren();
    box.hidden = !pinEditing;
    if (!pinEditing) return;
    buildings.forEach(b => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'shop-btn' + (pinTarget === b.id ? ' active' : '') + (pins[b.id] ? '' : '');
      btn.textContent = b.name + (pins[b.id] ? ' ✓' : '');
      btn.addEventListener('click', () => { pinTarget = b.id; renderPinPicker(); setPinHelp(); });
      box.appendChild(btn);
    });
  }

  $('mapStage').addEventListener('click', async e => {
    if (!pinEditing || e.target.closest('.bpin')) return;
    if (Date.now() < suppressClickUntil) return;
    if (!pinTarget) { say('위치를 지정할 건물을 먼저 고르세요.'); return; }
    const r = $('mapStage').getBoundingClientRect();
    const x = Math.round((e.clientX - r.left) / r.width * 10000) / 100;
    const y = Math.round((e.clientY - r.top) / r.height * 10000) / 100;
    try {
      await savePin(pinTarget, x, y);
      pins[pinTarget] = { x, y };
      renderPins(); renderPinPicker();
      say('건물 위치를 저장했습니다.');
    } catch (err) { say(err.message); }
  });

  $('pinEditToggle').addEventListener('click', () => {
    if (!pinsAvailable) { setPinHelp(); return; }
    pinEditing = !pinEditing;
    pinTarget = '';
    $('pinEditToggle').textContent = pinEditing ? '위치 설정 끝내기' : '건물 위치 설정';
    $('mapStage').classList.toggle('editing', pinEditing);
    renderPinPicker(); setPinHelp();
  });

  function setZoom(v) {
    zoom = Math.max(.3, Math.min(12, v));
    $('mapStage').style.width = Math.round(zoom * 100) + '%';
    $('zoomLabel').textContent = Math.round(zoom * 100) + '%';
  }
  // 마우스 위치(또는 두 손가락 중심)를 기준으로 확대·축소한다.
  function zoomAt(next, clientX, clientY) {
    const scroller = $('mapScroll'), stage = $('mapStage');
    const rect = stage.getBoundingClientRect(), box = scroller.getBoundingClientRect();
    const fx = rect.width ? (clientX - rect.left) / rect.width : 0;
    const fy = rect.height ? (clientY - rect.top) / rect.height : 0;
    setZoom(next);
    scroller.scrollLeft = fx * stage.offsetWidth - (clientX - box.left);
    scroller.scrollTop = fy * stage.offsetHeight - (clientY - box.top);
  }
  function zoomCenter(factor) {
    const box = $('mapScroll').getBoundingClientRect();
    zoomAt(zoom * factor, box.left + box.width / 2, box.top + box.height / 2);
  }
  $('zoomIn').addEventListener('click', () => zoomCenter(1.25));
  $('zoomOut').addEventListener('click', () => zoomCenter(1 / 1.25));

  const scroller = $('mapScroll');
  let suppressClickUntil = 0;
  scroller.addEventListener('wheel', e => {
    e.preventDefault();
    zoomAt(zoom * (e.deltaY < 0 ? 1.15 : 1 / 1.15), e.clientX, e.clientY);
  }, { passive:false });

  // 마우스 드래그로 지도 이동
  let drag = null;
  scroller.addEventListener('mousedown', e => {
    if (e.button !== 0 || e.target.closest('.bpin')) return;
    drag = { x:e.clientX, y:e.clientY, left:scroller.scrollLeft, top:scroller.scrollTop, moved:false };
  });
  window.addEventListener('mousemove', e => {
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) < 5) return;
    drag.moved = true;
    scroller.scrollLeft = drag.left - dx;
    scroller.scrollTop = drag.top - dy;
  });
  window.addEventListener('mouseup', () => {
    if (drag && drag.moved) suppressClickUntil = Date.now() + 250;
    drag = null;
  });

  // 모바일 두 손가락 확대·축소
  let pinch = null;
  const dist = (a, b) => Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
  scroller.addEventListener('touchstart', e => {
    if (e.touches.length !== 2) return;
    pinch = { d:dist(e.touches[0], e.touches[1]), zoom };
    suppressClickUntil = Date.now() + 500;
  }, { passive:true });
  scroller.addEventListener('touchmove', e => {
    if (!pinch || e.touches.length !== 2) return;
    e.preventDefault();
    const [a, b] = e.touches;
    zoomAt(pinch.zoom * dist(a, b) / pinch.d, (a.clientX + b.clientX) / 2, (a.clientY + b.clientY) / 2);
    suppressClickUntil = Date.now() + 500;
  }, { passive:false });
  scroller.addEventListener('touchend', e => { if (e.touches.length < 2) pinch = null; });

  // ----- 검색 -----
  function fillSelect(sel, values) {
    const first = sel.options[0];
    sel.replaceChildren(first);
    values.forEach(v => { const o = document.createElement('option'); o.value = v.value ?? v; o.textContent = v.label ?? v; sel.appendChild(o); });
  }

  function setupFilters() {
    const f = $('filterForm');
    fillSelect(f.building, buildings.map(b => ({ value:b.id, label:b.name })));
    const floors = [...new Set(rows.map(r => r.floor).filter(Boolean))].sort((a, b) => floorSort(a) - floorSort(b));
    fillSelect(f.floor, floors.map(k => ({ value:k, label:k + '층' })));
    const biz = [...new Set([...DEFAULT_BIZ, ...rows.map(r => r.u.현업종).filter(Boolean)])];
    fillSelect(f.biz, biz);
    const list = $('bizList');
    list.replaceChildren();
    biz.forEach(v => { const o = document.createElement('option'); o.value = v; list.appendChild(o); });
    renderSavedFilters();
  }

  function readFilters() {
    const f = $('filterForm');
    const v = {};
    new FormData(f).forEach((val, key) => { v[key] = String(val).trim(); });
    return v;
  }

  function inRange(value, min, max) {
    if (min === '' && max === '') return true;
    if (value === null) return false;
    if (min !== '' && value < Number(min)) return false;
    if (max !== '' && value > Number(max)) return false;
    return true;
  }

  function applyFilters() {
    const v = readFilters();
    selectedBuilding = v.building || '';
    const q = (v.q || '').toLowerCase();
    const toPy = x => (v.areaUnit === 'm2' ? x / PY : x);
    const result = rows.filter(r => {
      const u = r.u;
      if (v.building && r.b.id !== v.building) return false;
      if (v.floor && r.floor !== v.floor) return false;
      if (v.status && status(u) !== v.status) return false;
      if (v.biz && !String(u.현업종 || '').includes(v.biz)) return false;
      if (q && !`${r.b.name} ${r.room} ${u.소유주 || ''} ${u.현업종 || ''} ${u.메모 || ''}`.toLowerCase().includes(q)) return false;
      if (!inRange(deposit(u), v.depMin, v.depMax)) return false;
      if (!inRange(rent(u), v.rentMin, v.rentMax)) return false;
      if (!inRange(num(u.분양가), v.priceMin, v.priceMax)) return false;
      const aMin = v.areaMin === '' ? '' : toPy(Number(v.areaMin));
      const aMax = v.areaMax === '' ? '' : toPy(Number(v.areaMax));
      return inRange(num(u.전용_평), aMin, aMax);
    });
    result.sort((a, b) => a.b.name.localeCompare(b.b.name, 'ko') || floorSort(a.floor) - floorSort(b.floor) || a.room.localeCompare(b.room, 'ko', { numeric:true }));
    renderResults(result);
    renderPins();
  }

  function cell(tr, text, sub) {
    const td = document.createElement('td');
    td.textContent = text;
    if (sub) { const s = document.createElement('small'); s.className = 'sub'; s.textContent = sub; td.appendChild(s); }
    tr.appendChild(td);
    return td;
  }

  function renderResults(list) {
    const body = $('resultBody');
    body.replaceChildren();
    $('resultCount').textContent = `조건에 맞는 호실 ${list.length}개 (전체 ${rows.length}개) · 공실등록 ${list.filter(r => r.u.공실여부 === "공실").length} · 연락처 확보 ${list.filter(r => hasOwnerContact(r.u)).length} · 매물등록 ${list.filter(r => hasListing(r.u)).length}`;
    list.slice(0, 500).forEach(r => {
      const u = r.u;
      const tr = document.createElement('tr');
      cell(tr, r.b.name);
      cell(tr, roomLabel(r.room));
      const st = cell(tr, '');
      const tag = document.createElement('span');
      tag.className = 'tag ' + (STATUS_CLASS[status(u)] || '');
      tag.textContent = status(u);
      st.appendChild(tag);
      cell(tr, hasOwnerContact(u) ? '확보' : '미등록');
      const listingCell = cell(tr, hasListing(u) ? '' : '미등록');
      if (hasListing(u)) { const link = document.createElement('a'); link.textContent = '매물보기'; link.href = 'detail.html?id=' + encodeURIComponent(u.listing_id); link.addEventListener('click', event => event.stopPropagation()); listingCell.appendChild(link); }
      cell(tr, u.현업종 || (status(u) === '공실' ? '공실' : '미입력'));
      cell(tr, area(u.전용_평));
      cell(tr, won(u.분양가));
      cell(tr, `${won(deposit(u))} / ${won(rent(u))}`);
      const days = daysSince(u.확인일);
      const td = cell(tr, days === null ? '미확인' : dateText(u.확인일), days === null ? '' : `${days}일 전`);
      if (days === null || days > 90) td.classList.add('old'); else if (days > 30) td.classList.add('stale');
      tr.addEventListener('click', () => openUnit(r));
      body.appendChild(tr);
    });
    if (!list.length) {
      const tr = document.createElement('tr');
      const td = cell(tr, '조건에 맞는 호실이 없습니다.');
      td.colSpan = 10;
      body.appendChild(tr);
    }
  }

  $('filterForm').addEventListener('input', applyFilters);
  $('filterForm').addEventListener('submit', e => e.preventDefault());
  $('resetFilter').addEventListener('click', () => { $('filterForm').reset(); applyFilters(); });

  // ----- 저장한 조건 (이 기기에만 저장) -----
  function readSaved() { try { return JSON.parse(OfficeStorage.local.getItem(FILTER_KEY) || '{}'); } catch (e) { return {}; } }
  function writeSaved(obj) { try { OfficeStorage.local.setItem(FILTER_KEY, JSON.stringify(obj)); } catch (e) { say('이 브라우저에서는 조건을 저장할 수 없습니다.'); } }
  function renderSavedFilters() {
    const sel = $('savedFilters');
    const first = sel.options[0];
    sel.replaceChildren(first);
    Object.keys(readSaved()).forEach(name => { const o = document.createElement('option'); o.value = name; o.textContent = name; sel.appendChild(o); });
  }
  $('saveFilter').addEventListener('click', () => {
    const name = (prompt('저장할 조건 이름을 입력하세요. 예: 운정3 1층 공실 카페') || '').trim();
    if (!name) return;
    const all = readSaved();
    all[name] = readFilters();
    writeSaved(all); renderSavedFilters(); $('savedFilters').value = name;
    say(`"${name}" 조건을 저장했습니다.`);
  });
  $('savedFilters').addEventListener('change', e => {
    const saved = readSaved()[e.target.value];
    if (!saved) return;
    const f = $('filterForm');
    f.reset();
    Object.entries(saved).forEach(([k, val]) => { if (f.elements[k]) f.elements[k].value = val; });
    applyFilters();
  });
  $('deleteFilter').addEventListener('click', () => {
    const name = $('savedFilters').value;
    if (!name || !confirm(`"${name}" 조건을 삭제할까요?`)) return;
    const all = readSaved(); delete all[name]; writeSaved(all); renderSavedFilters();
  });

  // ----- 호실 카드 -----
  function bindArea(form, base) {
    const m = form.elements[base + '_m2'], p = form.elements[base + '_평'];
    m.addEventListener('input', () => { p.value = m.value === '' ? '' : (Number(m.value) / PY).toFixed(2); });
    p.addEventListener('input', () => { m.value = p.value === '' ? '' : (Number(p.value) * PY).toFixed(2); });
  }
  bindArea($('unitForm'), '전용');
  bindArea($('unitForm'), '분양');

  function openUnit(r) {
    current = r;
    const f = $('unitForm'), u = r.u;
    $('unitTitle').textContent = `${r.b.name} ${roomLabel(r.room)}`;
    $('unitMessage').textContent = '';
    f.elements['공실여부'].value = status(u);
    f.elements['현업종'].value = u.현업종 || '';
    f.elements['소유주'].value = u.소유주 || '';
    f.elements['연락처'].value = u.연락처 || '';
    f.elements['현_보증금'].value = deposit(u) ?? '';
    f.elements['현_월세'].value = rent(u) ?? '';
    f.elements['분양가'].value = num(u.분양가) ?? '';
    ['전용', '분양'].forEach(base => {
      const py = num(u[base + '_평']);
      f.elements[base + '_평'].value = py === null ? '' : py.toFixed(2);
      f.elements[base + '_m2'].value = py === null ? '' : (py * PY).toFixed(2);
    });
    f.elements['도면링크'].value = u.도면링크 || '';
    f.elements['메모'].value = u.메모 || '';
    const days = daysSince(u.확인일);
    $('unitChecked').textContent = days === null ? '마지막 확인일: 아직 없음 (저장하면 오늘로 기록됩니다)' : `마지막 확인일: ${dateText(u.확인일)} (${days}일 전)`;
    const plan = $('unitPlanLink');
    plan.hidden = !u.도면링크;
    if (u.도면링크) plan.href = u.도면링크;
    const floorLink = $('unitFloorLink');
    const fl = r.b.floors.find(x => /\.(png|jpe?g|webp|gif)(\?|$)/i.test(x.cloudinary_url || x.file_name || '') && String(x.floor_number || '').includes(r.floor));
    floorLink.hidden = !fl;
    if (fl) floorLink.href = 'floor-status.html?' + new URLSearchParams({ id:r.b.id, floorId:fl.id, floor:r.floor });
    $('unitDialog').showModal();
  }
  $('unitClose').addEventListener('click', () => $('unitDialog').close());

  $('unitForm').addEventListener('submit', async e => {
    e.preventDefault();
    if (!current) return;
    const f = e.target, btn = $('unitSave'), msg = $('unitMessage');
    const val = n => f.elements[n].value.trim();
    const numOrNull = n => { const s = val(n); if (s === '') return null; const x = Number(s); if (!Number.isFinite(x) || x < 0) throw new Error('금액과 면적은 0 이상의 숫자로 입력해 주세요.'); return x; };
    let values;
    try {
      const link = val('도면링크');
      if (link && !/^https?:\/\//i.test(link)) throw new Error('도면 링크는 http:// 또는 https:// 로 시작해야 합니다.');
      values = {
        공실여부: val('공실여부'), 현업종: val('현업종') || null, 소유주: val('소유주') || null, 연락처: val('연락처') || null,
        현_보증금: numOrNull('현_보증금'), 현_월세: numOrNull('현_월세'), 분양가: numOrNull('분양가'),
        전용_평: numOrNull('전용_평') === null ? null : Math.round(numOrNull('전용_평') * 100) / 100,
        분양_평: numOrNull('분양_평') === null ? null : Math.round(numOrNull('분양_평') * 100) / 100,
        도면링크: link || null, 메모: val('메모') || null, 확인일: new Date().toISOString()
      };
    } catch (err) { msg.textContent = err.message; return; }
    btn.disabled = true;
    msg.textContent = '저장하는 중...';
    try {
      const record = await getBuildingRecord(current.b.record ? current.b.record.local_id : current.b.id);
      if (!record || !Array.isArray(record.units)) throw new Error('건물 호실 데이터를 찾을 수 없습니다.');
      const latest = record.units.find(x => String(x.호수 || '').trim() === current.room);
      if (!latest) throw new Error('호실을 다시 찾을 수 없습니다. 새로고침해 주세요.');
      const watched = ['공실여부', '현업종', '소유주', '연락처', '현_보증금', '현_월세', '분양가', '전용_평', '분양_평', '도면링크', '메모'];
      if (watched.some(k => (latest[k] ?? null) !== (current.u[k] ?? null)))
        throw new Error('다른 화면에서 이 호실이 수정됐습니다. 창을 닫고 새로고침한 뒤 다시 수정해 주세요.');
      const updated = record.units.map(x => String(x.호수 || '').trim() === current.room ? { ...x, ...values, updated_at:new Date().toISOString() } : x);
      await saveBuildingUnits(record.local_id, record.name || current.b.name, updated);
      const check = await getBuildingRecord(record.local_id);
      const saved = check && check.units.find(x => String(x.호수 || '').trim() === current.room);
      if (!saved || watched.some(k => (saved[k] ?? null) !== (values[k] ?? null))) throw new Error('저장한 내용을 다시 확인하지 못했습니다. 새로고침 후 확인해 주세요.');
      current.b.record = check;
      current.u = saved;
      const idx = rows.findIndex(x => x.b.id === current.b.id && x.room === current.room);
      if (idx >= 0) rows[idx] = current;
      msg.textContent = '저장했습니다.';
      applyFilters();
      setTimeout(() => $('unitDialog').close(), 600);
    } catch (err) { msg.textContent = '저장 실패: ' + err.message; }
    finally { btn.disabled = false; }
  });

  async function init() {
    try {
      if (!(await loadAll())) return;
      setupFilters();
      if (requestedId && buildings.some(b => b.id === requestedId)) { $('filterForm').building.value = requestedId; selectedBuilding = requestedId; }
      renderBuildingLinks();
      setZoom(1);
      setPinHelp(); renderPinPicker();
      applyFilters();
      say(buildings.length ? `${label} 건물 ${buildings.length}개 · 호실 ${rows.length}개` : `등록된 ${label} 건물이 없습니다. ${label} 자료관리에서 건물을 먼저 등록해 주세요.`);
      renderPins();
      resolveAutoPins().then(() => {
        renderPins();
        const shown = buildings.filter(b => pins[b.id] || autoPins[b.id]).length;
        say(`${label} 건물 ${buildings.length}개 · 호실 ${rows.length}개 · 위치도 표시 ${shown}개 (주소로 자동 표시한 점은 대략 위치입니다)`);
        if (requestedId && !focusBuildingOnMap(requestedId)) {
          const b = buildings.find(x => x.id === requestedId);
          if (b) say(`"${b.name}"은 주소로 위치를 찾지 못했거나 위치도 범위 밖이라 지도에 표시하지 못했습니다. '건물 위치 설정'으로 직접 지정할 수 있어요.`);
        }
      });
    } catch (err) { say('불러오기 실패: ' + err.message); }
  }
  init();
})();
