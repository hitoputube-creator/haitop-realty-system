(function () {
  'use strict';

  const $ = id => document.getElementById(id);
  const params = new URLSearchParams(location.search);
  const buildingId = params.get('id');
  const floorId = params.get('floorId');
  let building;
  let floor;
  let address = '';
  let buildingName = '';
  let units = [];
  let floorKey = '';
  let selectedRoom = '';
  let detailEditing = false;
  let editing = false;
  let zoom = 1;
  const changes = new Map();

  function message(text) { $('statusMessage').textContent = text; }
  function roomId(unit) { return String(unit.호수 || '').trim(); }

  function floorOfRoom(room) {
    const s = String(room || '').trim();
    const basement = s.match(/^[Bb](\d+)/);
    if (basement) return 'B' + Math.floor(Number(basement[1]) / 100 || Number(basement[1]));
    const number = s.match(/^(\d+)/);
    if (!number) return '';
    const n = Number(number[1]);
    return String(n >= 100 ? Math.floor(n / 100) : n);
  }

  function floorKeys(label) {
    const s = String(label || '').trim();
    const basement = s.match(/(?:지하|[Bb])\s*(\d+)/);
    if (basement) return ['B' + basement[1]];
    const range = s.match(/(\d+)\s*[~～\-]\s*(\d+)/);
    if (range) {
      const first = Number(range[1]), last = Number(range[2]);
      if (last >= first && last - first <= 30) {
        return Array.from({ length:last - first + 1 }, (_, i) => String(first + i));
      }
    }
    const one = s.match(/(\d+)/);
    return one ? [one[1]] : [];
  }

  function sameFloorUnits() {
    return units.filter(u => floorOfRoom(u.호수) === floorKey);
  }

  function existingPosition(unit) {
    return unit.plan_positions && unit.plan_positions[floor.id] && unit.plan_positions[floor.id][floorKey];
  }

  function positionOf(unit) {
    const key = roomId(unit);
    return changes.has(key) ? changes.get(key) : existingPosition(unit);
  }

  function validPosition(position) {
    return position && Number.isFinite(Number(position.x)) && Number.isFinite(Number(position.y)) &&
      Number(position.x) >= 0 && Number(position.x) <= 100 && Number(position.y) >= 0 && Number(position.y) <= 100;
  }

  function statusOf(unit) { return unit.공실여부 || '공실'; }
  function businessOf(unit) {
    return unit.현업종 || (statusOf(unit) === '공실' ? '공실' : '업종 미입력');
  }
  function displayPrice(current, original) {
    const amount = current !== null && current !== undefined && current !== '' ? current : original;
    if (amount === null || amount === undefined || amount === '') return '—';
    const n = Number(amount);
    return Number.isFinite(n) ? n.toLocaleString('ko-KR') + '만 원' : '—';
  }

  function renderPins() {
    const layer = $('planPins');
    layer.replaceChildren();
    sameFloorUnits().forEach(unit => {
      const position = positionOf(unit);
      if (!validPosition(position)) return;
      const room = roomId(unit);
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'unit-pin' + (statusOf(unit) === '공실' ? ' vacant' :
        statusOf(unit) === '매매가능' ? ' sale' : '') + (room === selectedRoom ? ' selected' : '');
      button.style.left = Number(position.x) + '%';
      button.style.top = Number(position.y) + '%';
      button.title = `${room}호 · ${businessOf(unit)} · ${statusOf(unit)}`;
      const number = document.createElement('strong');
      number.textContent = room.endsWith('호') ? room : room + '호';
      const business = document.createElement('span');
      business.textContent = businessOf(unit);
      button.append(number, business);
      button.addEventListener('click', event => { event.stopPropagation(); selectRoom(room); });
      layer.appendChild(button);
    });
  }

  function renderRooms() {
    const list = $('roomList');
    list.replaceChildren();
    const floorUnits = sameFloorUnits();
    if (!floorUnits.length) {
      list.textContent = '이 층의 호실이 아직 등록되지 않았습니다.';
      return;
    }
    floorUnits.forEach(unit => {
      const room = roomId(unit);
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'status-room' + (selectedRoom === room ? ' selected' : '');
      const label = document.createElement('strong');
      label.textContent = room.endsWith('호') ? room : room + '호';
      const hint = document.createElement('small');
      hint.textContent = businessOf(unit);
      button.append(label, hint);
      if (!validPosition(positionOf(unit))) {
        const locationHint = document.createElement('small');
        locationHint.textContent = '위치 미설정';
        button.appendChild(locationHint);
      }
      button.addEventListener('click', () => selectRoom(room));
      list.appendChild(button);
    });
  }

  function appendDetail(label, value) {
    const line = document.createElement('div');
    line.className = 'line';
    line.textContent = `${label}: ${value}`;
    $('roomDetail').appendChild(line);
  }

  const editableFields = ['현업종', '공실여부', '소유주', '연락처', '현_보증금', '현_월세'];
  function editableSnapshot(unit) {
    return editableFields.map(key => unit[key] ?? null);
  }
  function editField(form, label, name, value, options) {
    const wrapper = document.createElement('label');
    wrapper.textContent = label;
    const input = document.createElement(options ? 'select' : 'input');
    input.name = name;
    if (options) {
      options.forEach(item => {
        const option = document.createElement('option');
        option.value = item;
        option.textContent = item;
        input.appendChild(option);
      });
    } else if (name === '현_보증금' || name === '현_월세') {
      input.type = 'number';
      input.min = '0';
      input.step = '1';
      input.placeholder = '비우면 기존 가격 표시';
    } else input.type = name === '연락처' ? 'tel' : 'text';
    input.value = value == null ? '' : String(value);
    wrapper.appendChild(input);
    form.appendChild(wrapper);
  }

  function renderEditForm(unit) {
    const box = $('roomDetail');
    const form = document.createElement('form');
    form.className = 'status-edit-form';
    editField(form, '업종', '현업종', unit.현업종);
    editField(form, '상태', '공실여부', statusOf(unit), ['임차중', '공실', '매매가능']);
    editField(form, '소유주', '소유주', unit.소유주);
    editField(form, '연락처', '연락처', unit.연락처);
    editField(form, '현재 보증금 (만원)', '현_보증금', unit.현_보증금);
    editField(form, '현재 월세 (만원)', '현_월세', unit.현_월세);
    const actions = document.createElement('div');
    actions.className = 'status-edit-actions';
    const save = document.createElement('button');
    save.type = 'submit';
    save.className = 'status-button';
    save.textContent = '저장';
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'status-button';
    cancel.textContent = '취소';
    cancel.addEventListener('click', () => { detailEditing = false; renderDetail(); });
    actions.append(save, cancel);
    form.appendChild(actions);
    form.addEventListener('submit', event => { event.preventDefault(); saveUnitDetails(unit, form, save); });
    box.appendChild(form);
  }

  async function saveUnitDetails(original, form, saveButton) {
    const room = roomId(original);
    const data = Object.fromEntries(new FormData(form).entries());
    const amount = key => {
      const value = String(data[key] || '').trim();
      if (!value) return null;
      const number = Number(value);
      if (!Number.isFinite(number) || number < 0) throw new Error('보증금과 월세는 0 이상의 숫자로 입력해 주세요.');
      return number;
    };
    let values;
    try {
      values = {
        현업종: data.현업종.trim() || null,
        공실여부: data.공실여부,
        소유주: data.소유주.trim() || null,
        연락처: data.연락처.trim() || null,
        현_보증금: amount('현_보증금'),
        현_월세: amount('현_월세')
      };
    } catch (error) { message(error.message); return; }
    saveButton.disabled = true;
    message(`${room}호 내용을 저장하는 중...`);
    try {
      const record = await getBuildingRecord(buildingName);
      if (!record || !Array.isArray(record.units)) throw new Error('건물 호실 데이터를 찾을 수 없습니다.');
      const current = record.units.find(unit => roomId(unit) === room);
      if (!current) throw new Error(`${room}호를 다시 찾을 수 없습니다. 새로고침해 주세요.`);
      if (JSON.stringify(editableSnapshot(current)) !== JSON.stringify(editableSnapshot(original))) {
        units = record.units;
        detailEditing = false;
        render();
        throw new Error('다른 화면에서 이 호실이 수정됐습니다. 새 내용을 확인한 뒤 다시 수정해 주세요.');
      }
      const updated = record.units.map(unit => roomId(unit) === room
        ? { ...unit, ...values, updated_at: new Date().toISOString() } : unit);
      await saveBuildingUnits(record.local_id, record.name || buildingName, updated);
      const saved = await getBuildingRecord(buildingName);
      const savedUnit = saved && Array.isArray(saved.units) && saved.units.find(unit => roomId(unit) === room);
      if (!savedUnit || editableFields.some(key => (savedUnit[key] ?? null) !== (values[key] ?? null)))
        throw new Error('저장한 내용을 다시 확인하지 못했습니다. 새로고침 후 확인해 주세요.');
      units = saved.units;
      detailEditing = false;
      render();
      message(`${room}호 현황을 저장했습니다.`);
    } catch (error) { message('저장 실패: ' + error.message); }
    finally { saveButton.disabled = false; }
  }

  function renderDetail() {
    const box = $('roomDetail');
    box.replaceChildren();
    const unit = sameFloorUnits().find(u => roomId(u) === selectedRoom);
    $('removePosition').disabled = !unit || !validPosition(positionOf(unit));
    if (!unit) { box.textContent = '호실을 선택해 주세요.'; return; }
    const title = document.createElement('h3');
    title.textContent = roomId(unit) + (roomId(unit).endsWith('호') ? '' : '호');
    box.appendChild(title);
    if (detailEditing) { renderEditForm(unit); return; }
    appendDetail('업종', businessOf(unit));
    appendDetail('상태', statusOf(unit));
    appendDetail('소유주', unit.소유주 || '—');
    appendDetail('연락처', unit.연락처 || '—');
    appendDetail('보증금', displayPrice(unit.현_보증금, unit.보증금));
    appendDetail('월세', displayPrice(unit.현_월세, unit.월차임));
    const actions = document.createElement('div');
    actions.className = 'status-detail-actions';
    const editButton = document.createElement('button');
    editButton.type = 'button';
    editButton.className = 'status-button';
    editButton.textContent = '호실 현황 수정';
    editButton.addEventListener('click', () => { detailEditing = true; renderDetail(); });
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'status-button registry';
    button.textContent = '건축물대장정보 확인';
    button.addEventListener('click', () => openBuildingRegisterInfo(address, roomId(unit)));
    actions.append(editButton, button);
    box.appendChild(actions);
  }

  function render() { renderPins(); renderRooms(); renderDetail(); }
  function selectRoom(room) {
    if (room === selectedRoom && detailEditing) return;
    if (room !== selectedRoom && detailEditing && !confirm('저장하지 않은 호실 현황 수정을 취소할까요?')) return;
    if (room !== selectedRoom) detailEditing = false;
    selectedRoom = room;
    render();
  }

  function setEditing(on) {
    editing = on;
    $('editPositions').textContent = on ? '위치 설정 끝내기' : '위치 설정';
    $('removePosition').hidden = !on;
    $('savePositions').hidden = !on;
    $('planStage').classList.toggle('editing', on);
    $('positionHelp').textContent = on
      ? '호실을 선택하고 도면의 해당 위치를 클릭하세요. 다시 클릭하면 위치를 옮길 수 있습니다. 마지막에 위치 저장을 누르세요.'
      : '호실을 선택하면 업종과 상태를 볼 수 있습니다.';
  }

  function setFloor(key) {
    floorKey = key;
    selectedRoom = '';
    detailEditing = false;
    $('floorChoice').value = key;
    $('planCaption').textContent = `${floor.floor_number} 평면도 · ${key}층 호실 현황. 위치를 지정하지 않은 호실은 오른쪽 목록에 표시됩니다.`;
    render();
    message(sameFloorUnits().length ? `${key}층 호실 ${sameFloorUnits().length}개` : '이 층에 등록된 호실이 없습니다.');
  }

  function changeZoom(delta) {
    zoom = Math.max(.5, Math.min(2.5, zoom + delta));
    $('planStage').style.width = Math.round(zoom * 100) + '%';
    $('planStage').style.minWidth = '0';
    $('zoomLabel').textContent = Math.round(zoom * 100) + '%';
  }

  async function savePositions() {
    if (!changes.size) { message('저장할 위치 변경이 없습니다.'); return; }
    const btn = $('savePositions');
    btn.disabled = true;
    message('호실 위치를 저장하는 중...');
    try {
      // 저장 직전에 최신 호실을 읽어 업종·가격 등 다른 수정사항을 유지한다.
      const record = await getBuildingRecord(buildingName);
      if (!record || !Array.isArray(record.units)) throw new Error('건물 호실 데이터를 찾을 수 없습니다.');
      const latest = record.units;
      for (const room of changes.keys()) {
        if (!latest.some(unit => roomId(unit) === room)) throw new Error(`${room}호를 다시 찾을 수 없습니다. 화면을 새로고침해 주세요.`);
      }
      const updated = latest.map(unit => {
        const room = roomId(unit);
        if (!changes.has(room)) return unit;
        const plans = { ...(unit.plan_positions || {}) };
        const floorPositions = { ...(plans[floor.id] || {}) };
        const position = changes.get(room);
        if (position) floorPositions[floorKey] = position;
        else delete floorPositions[floorKey];
        if (Object.keys(floorPositions).length) plans[floor.id] = floorPositions;
        else delete plans[floor.id];
        return { ...unit, plan_positions: plans };
      });
      await saveBuildingUnits(record.local_id, record.name || buildingName, updated);
      const saved = await getBuildingRecord(buildingName);
      if (!saved || !Array.isArray(saved.units)) throw new Error('저장한 위치를 다시 읽지 못했습니다.');
      for (const [room, position] of changes) {
        const savedUnit = saved.units.find(unit => roomId(unit) === room);
        const savedPosition = savedUnit && savedUnit.plan_positions &&
          savedUnit.plan_positions[floor.id] && savedUnit.plan_positions[floor.id][floorKey];
        if (JSON.stringify(savedPosition || null) !== JSON.stringify(position))
          throw new Error(`${room}호 위치가 저장되지 않았습니다. 다시 시도해 주세요.`);
      }
      units = saved.units;
      changes.clear();
      setEditing(false);
      render();
      message('호실 위치를 저장했습니다. 업종과 상태는 호실 수정 내용에 따라 자동으로 바뀝니다.');
    } catch (error) { message('저장 실패: ' + error.message); }
    finally { btn.disabled = false; }
  }

  async function init() {
    $('backLink').href = 'building-detail.html?id=' + encodeURIComponent(buildingId || '');
    if (!buildingId || !floorId) { message('건물 또는 평면도 주소가 없습니다.'); return; }
    try {
      const { data, error } = await hitopAuthClient.auth.getSession();
      if (error || !data.session) { hitopRedirectToLogin(); return; }
      hitopApplyAuthHeader(data.session);
      const [resources, floors] = await Promise.all([getDriveResources(), getBuildingFloors(buildingId)]);
      building = resources.find(item => item.id === buildingId);
      floor = floors.find(item => item.id === floorId);
      if (!building || !floor) throw new Error('건물 또는 평면도 자료를 찾을 수 없습니다.');
      if (/\.pdf(?:\?|$)/i.test(floor.cloudinary_url || floor.file_name || ''))
        throw new Error('PDF 평면도는 이미지로 등록한 후 현황보기를 사용할 수 있습니다.');
      buildingName = building.name;
      const addressLine = String(building.memo || '').split('\n').find(line => /^주소\s*:/.test(line));
      address = addressLine ? addressLine.replace(/^주소\s*:/, '').trim() : '';
      const record = await getBuildingRecord(buildingName);
      units = Array.isArray(record && record.units) ? record.units : [];
      $('statusTitle').textContent = `${buildingName} · ${floor.floor_number} 현황`;
      $('statusAddress').textContent = address;
      document.title = `하이탑부동산 | ${buildingName} ${floor.floor_number} 현황`;
      const keys = floorKeys(floor.floor_number);
      if (!keys.length) throw new Error('평면도에 층 번호가 없습니다. 층 이름을 확인해 주세요.');
      keys.forEach(key => {
        const option = document.createElement('option');
        option.value = key;
        option.textContent = key + '층';
        $('floorChoice').appendChild(option);
      });
      const image = $('planImage');
      image.alt = `${buildingName} ${floor.floor_number} 평면도`;
      image.onerror = () => message('평면도 이미지를 열지 못했습니다. 이미지 링크를 확인해 주세요.');
      image.src = floor.cloudinary_url;
      changeZoom(-.25);
      setFloor(keys[0]);
    } catch (error) { message('불러오기 실패: ' + error.message); }
  }

  $('planStage').addEventListener('click', event => {
    if (!editing || event.target.closest('.unit-pin')) return;
    if (detailEditing) { message('호실 현황 수정을 저장하거나 취소한 후 위치를 지정해 주세요.'); return; }
    if (!selectedRoom) { message('오른쪽 목록에서 호실을 먼저 선택해 주세요.'); return; }
    const bounds = $('planStage').getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    const x = (event.clientX - bounds.left) / bounds.width * 100;
    const y = (event.clientY - bounds.top) / bounds.height * 100;
    if (x < 0 || x > 100 || y < 0 || y > 100) return;
    changes.set(selectedRoom, { x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100 });
    render();
    message(`${selectedRoom}호 위치를 지정했습니다. 위치 저장을 누르면 반영됩니다.`);
  });
  $('floorChoice').addEventListener('change', event => {
    const key = event.target.value;
    if (detailEditing && !confirm('저장하지 않은 호실 현황 수정을 취소하고 층을 바꿀까요?')) {
      event.target.value = floorKey;
      return;
    }
    if (changes.size && !confirm('저장하지 않은 위치 변경을 버리고 층을 바꿀까요?')) {
      event.target.value = floorKey;
      return;
    }
    changes.clear();
    setFloor(key);
  });
  $('editPositions').addEventListener('click', () => {
    if (detailEditing) { message('호실 현황 수정을 저장하거나 취소한 후 위치를 설정해 주세요.'); return; }
    if (editing && changes.size && !confirm('저장하지 않은 위치 변경을 버릴까요?')) return;
    if (editing) changes.clear();
    setEditing(!editing);
    render();
  });
  $('removePosition').addEventListener('click', () => {
    if (detailEditing) { message('호실 현황 수정을 저장하거나 취소한 후 위치를 삭제해 주세요.'); return; }
    if (!selectedRoom) return;
    changes.set(selectedRoom, null);
    render();
    message(`${selectedRoom}호 위치를 삭제 대상으로 표시했습니다. 위치 저장을 누르면 반영됩니다.`);
  });
  $('savePositions').addEventListener('click', savePositions);
  $('zoomOut').addEventListener('click', () => changeZoom(-.25));
  $('zoomIn').addEventListener('click', () => changeZoom(.25));
  window.addEventListener('beforeunload', event => {
    if (!changes.size) return;
    event.preventDefault();
    event.returnValue = '';
  });
  init();
})();
