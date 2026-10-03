(function () {
  'use strict';

  const $ = id => document.getElementById(id);
  const PY = 3.30579;
  const DEFAULT_BIZ = ['카페', '일반음식점', '주점', '병원·의원', '약국', '학원', '편의점·마트', '미용·뷰티', '부동산', '사무실', '기타'];
  const STATUS_CLASS = { '공실':'vacant', '임차중':'rent', '매매가능':'sale', '계약진행':'contract' };
  const FILTER_KEY = 'shopLocation.savedFilters.v1';

  let buildings = [];   // { id, name, address, record, floors }
  let rows = [];        // flattened units
  let pins = {};        // building id -> {x, y}
  let pinsAvailable = true;
  let pinEditing = false;
  let pinTarget = '';
  let selectedBuilding = '';
  let zoom = 1;
  let current = null;   // row being edited

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
      fetchWithTimeout(SUPABASE_URL + '/rest/v1/buildings?select=local_id,name,units', { headers })
    ]);
    if (!recordsRes.ok) throw new Error('건물 호실 조회 실패');
    const records = await recordsRes.json();
    const shops = resources.filter(r => r.category === '상가');
    buildings = shops.map(r => {
      const rec = records.find(x => x.local_id === r.id) || records.find(x => x.name === r.name) || null;
      const line = String(r.memo || '').split('\n').find(l => /^주소\s*:/.test(l));
      return { id: r.id, name: r.name, address: line ? line.replace(/^주소\s*:/, '').trim() : '', record: rec,
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
      const p = pins[b.id];
      if (!p) return;
      const mine = rows.filter(r => r.b.id === b.id);
      const vacant = mine.filter(r => status(r.u) === '공실').length;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'bpin ' + (!mine.length ? 'none' : vacant ? 'vacant' : '') + (selectedBuilding === b.id ? ' selected' : '');
      btn.style.left = p.x + '%';
      btn.style.top = p.y + '%';
      const name = document.createElement('strong');
      name.textContent = b.name;
      const sub = document.createElement('span');
      sub.textContent = mine.length ? `공실 ${vacant}/${mine.length}` : '호실 미등록';
      btn.append(name, sub);
      btn.addEventListener('click', e => { e.stopPropagation(); chooseBuilding(b.id); });
      layer.appendChild(btn);
    });
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
    zoom = Math.max(.5, Math.min(3, v));
    $('mapStage').style.width = Math.round(zoom * 100) + '%';
    $('zoomLabel').textContent = Math.round(zoom * 100) + '%';
  }
  $('zoomIn').addEventListener('click', () => setZoom(zoom + .25));
  $('zoomOut').addEventListener('click', () => setZoom(zoom - .25));

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
    $('resultCount').textContent = `조건에 맞는 호실 ${list.length}개 (전체 ${rows.length}개)`;
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
      td.colSpan = 8;
      body.appendChild(tr);
    }
  }

  $('filterForm').addEventListener('input', applyFilters);
  $('filterForm').addEventListener('submit', e => e.preventDefault());
  $('resetFilter').addEventListener('click', () => { $('filterForm').reset(); applyFilters(); });

  // ----- 저장한 조건 (이 기기에만 저장) -----
  function readSaved() { try { return JSON.parse(localStorage.getItem(FILTER_KEY) || '{}'); } catch (e) { return {}; } }
  function writeSaved(obj) { try { localStorage.setItem(FILTER_KEY, JSON.stringify(obj)); } catch (e) { say('이 브라우저에서는 조건을 저장할 수 없습니다.'); } }
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
      setZoom(1);
      setPinHelp(); renderPinPicker();
      applyFilters();
      say(buildings.length ? `상가 건물 ${buildings.length}개 · 호실 ${rows.length}개` : '등록된 상가 건물이 없습니다. 상가 자료관리에서 건물을 먼저 등록해 주세요.');
    } catch (err) { say('불러오기 실패: ' + err.message); }
  }
  init();
})();
