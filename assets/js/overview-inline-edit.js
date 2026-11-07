/* 건물 개요: "수정"을 누르면 아래에 수정창이 따로 열리지 않고, 위의 표 칸이 바로 입력칸으로 바뀐다.
 * 기존 수정창의 입력칸(ov_*)과 저장 기능(saveOverview)을 그대로 쓰고, 입력칸만 표 안으로 옮겨 놓는다. */
(function () {
  if (!/building-overview/.test(location.pathname) || window.__overviewInlineEdit) return;
  window.__overviewInlineEdit = true;
  var $ = function (id) { return document.getElementById(id); };
  var OWN = (typeof OfficeConfig !== 'undefined' && OfficeConfig.id === 'ktop') ? '케이탑' : '하이탑';
  var inline = false, moved = [];

  var st = document.createElement('style');
  st.textContent = '.info-table-value.inline-edit{padding:6px 10px;gap:6px;flex-wrap:wrap}'
    + '.info-table-value.inline-edit input,.info-table-value.inline-edit select{flex:1 1 140px;min-width:0;width:100%;box-sizing:border-box;padding:7px 10px;border:1px solid #8fbab4;border-radius:8px;background:#fff!important;color:#1e3a3b!important;font:inherit;font-weight:500}'
    + '.info-table-value.inline-edit input:focus,.info-table-value.inline-edit select:focus{outline:2px solid #25675f;outline-offset:0}';
  document.head.appendChild(st);

  function idsForLabel(text) {
    text = String(text || '').trim();
    if (text === '주소(새주소)') return ['ov_address'];
    if (text === '주소(구주소)') return ['ov_lot_address'];
    var f = (typeof editableOverviewFields === 'function' ? editableOverviewFields() : []).filter(function (x) { return x[0] === text; })[0];
    if (f) return [f[1]];
    if ((text === OWN + ' 분양담당자' || text === '케이탑 분양담당자') && $('ov_sales_agent_name')) return ['ov_sales_agent_name', 'ov_sales_agent_phone'];
    return null;
  }

  function enter() {
    populateForm(buildingData ? buildingData.memo || '' : '');
    moved = [];
    document.querySelectorAll('#infoTable .info-table-label').forEach(function (label) {
      var ids = idsForLabel(label.textContent); if (!ids) return;
      var cell = label.nextElementSibling; if (!cell) return;
      cell.innerHTML = ''; cell.classList.remove('empty'); cell.classList.add('inline-edit');
      ids.forEach(function (id) {
        var el = $(id); if (!el) return;
        moved.push({ el: el, parent: el.parentNode, next: el.nextSibling });
        el.addEventListener('keydown', onKey);
        cell.appendChild(el);
      });
    });
    setupAddressSync();
    $('editFormCard').style.display = 'none';
    $('editToggleBtn').textContent = '✕ 수정 취소';
    $('registerFillBtn').disabled = true;
    if (!$('inlineSaveBtn')) {
      var b = document.createElement('button'); b.className = 'btn primary'; b.id = 'inlineSaveBtn'; b.textContent = '💾 저장';
      b.onclick = function () { saveOverview(); };
      $('editToggleBtn').parentNode.insertBefore(b, $('editToggleBtn'));
    }
    inline = true;
    var first = document.querySelector('#infoTable .inline-edit input'); if (first) first.focus();
  }
  function onKey(e) {
    if (e.key === 'Enter') { e.preventDefault(); saveOverview(); }
    else if (e.key === 'Escape') { e.preventDefault(); window.toggleEditMode(); }
  }
  function leave() {
    teardownAddressSync();
    moved.slice().reverse().forEach(function (m) { m.el.removeEventListener('keydown', onKey); m.parent.insertBefore(m.el, m.next); });
    moved = [];
    var b = $('inlineSaveBtn'); if (b) b.remove();
    $('editFormCard').style.display = 'none';
    $('editToggleBtn').textContent = '✏️ 수정';
    $('registerFillBtn').disabled = false;
    inline = false;
    renderReadOnlyViews();
  }
  window.toggleEditMode = function () { if (inline) leave(); else enter(); };

  /* ===== 주소: 새주소·구주소를 한 줄(한 칸)에 보여주고, 한쪽만 넣으면 다른 쪽을 자동으로 맞춘다 ===== */
  var st2 = document.createElement('style');
  st2.textContent = '.addr-line{display:inline-block;margin-right:16px;white-space:nowrap}.addr-tag{display:inline-block;font-size:.72em;font-weight:700;padding:1px 7px;margin-right:6px;border-radius:6px;background:rgba(255,255,255,.18);vertical-align:1px}'
    + '.info-table-value .addr-line .addr-tag{background:#d8ece9;color:#25675f}'
    + '.addr-status{flex:1 1 100%;font-size:.78rem;color:#4d6f6b;min-height:1em}.addr-status.err{color:#b45309}';
  document.head.appendChild(st2);
  var lookLot = function (s) { return /(동|리|가)\s*(산\s*)?\d+(-\d+)?(\s|$|\()/.test(s) && !/(로|길)\s?\d+(-\d+)?(\s|$|\()/.test(s); };
  var fullAddr = function (v) { return String(v || '').trim().replace(/^경기\s/, '경기도 '); };
  function splitAddr(road, lot) {
    road = String(road || '').trim(); lot = String(lot || '').trim();
    if (road && !lot && lookLot(road)) { lot = road; road = ''; }
    return { road: road, lot: lot };
  }
  // 읽기 표: 주소를 '주소(구주소)' '주소(새주소)' 두 칸(네이비 구분칸 포함)으로 나란히 보여준다
  function mergeAddressRow() {
    var labels = Array.prototype.slice.call(document.querySelectorAll('#infoTable .info-table-label'));
    var a = labels.filter(function (l) { return /^(주소|새주소\(도로명주소\))$/.test(l.textContent.trim()); })[0];
    var j = labels.filter(function (l) { return l.textContent.trim() === '지번주소(구주소)'; })[0];
    if (!a || !a.nextElementSibling) return;
    var f = (typeof memoFields !== 'undefined' && memoFields) || {};
    var p = splitAddr(f['주소'], f['지번주소']);
    if (j) { var jv = j.nextElementSibling; j.remove(); if (jv) jv.remove(); }
    var lotVal = a.nextElementSibling;
    function fill(cell, text) { cell.textContent = text || '—'; cell.className = 'info-table-value' + (text ? '' : ' empty'); cell.style.gridColumn = ''; }
    a.textContent = '주소(구주소)'; fill(lotVal, p.lot);
    var l2 = document.createElement('div'), v2 = document.createElement('div');
    l2.className = 'info-table-label'; l2.textContent = '주소(새주소)'; fill(v2, p.road);
    lotVal.after(l2, v2);
  }
  var origRender = window.renderReadOnlyViews;
  window.renderReadOnlyViews = function () { origRender.apply(this, arguments); mergeAddressRow(); };
  // 수정 항목: 일반 건물에도 구주소 칸을 쓴다 (주거 단지는 원래 있음)
  var origFields = window.editableOverviewFields;
  window.editableOverviewFields = function () {
    var list = origFields.apply(this, arguments);
    if (!list.some(function (x) { return x[0] === '지번주소'; })) list = list.concat([['지번주소', 'ov_lot_address']]);
    return list;
  };

  var kakaoPromise = null;
  function loadScript(src) { return new Promise(function (res, rej) { var s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = function () { rej(new Error('주소 검색을 불러오지 못했어요.')); }; document.head.appendChild(s); }); }
  function loadKakao() {
    if (window.kakao && window.kakao.maps && window.kakao.maps.services) return Promise.resolve();
    if (kakaoPromise) return kakaoPromise;
    kakaoPromise = (async function () {
      if (!window.HITOP_KAKAO_JS_KEY) await loadScript(new URL('assets/js/kakao-config.js', location.href).href);
      var key = String(window.HITOP_KAKAO_JS_KEY || '').trim();
      if (!key) throw new Error('카카오맵 키가 설정되지 않았어요.');
      await loadScript('https://dapi.kakao.com/v2/maps/sdk.js?appkey=' + encodeURIComponent(key) + '&libraries=services&autoload=false');
      await new Promise(function (r) { window.kakao.maps.load(r); });
    })().catch(function (e) { kakaoPromise = null; throw e; });
    return kakaoPromise;
  }
  function geocode(q) {
    return loadKakao().then(function () { return new Promise(function (resolve, reject) {
      new window.kakao.maps.services.Geocoder().addressSearch(q, function (result, status) {
        if (status === window.kakao.maps.services.Status.OK) resolve(result || []);
        else if (status === window.kakao.maps.services.Status.ZERO_RESULT) resolve([]);
        else reject(new Error('주소 검색 중 오류가 났어요. 잠시 후 다시 해 주세요.'));
      });
    }); });
  }
  var sync = null;
  function setStatus(msg, err) { if (!sync) return; sync.status.textContent = msg || ''; sync.status.classList.toggle('err', !!err); }
  async function convertFrom(from) {
    if (!sync) return;
    var src = from === 'road' ? sync.road : sync.lot, dst = from === 'road' ? sync.lot : sync.road;
    var q = src.value.trim(); if (!q) return;
    var token = ++sync.seq; setStatus('다른 주소를 찾는 중…');
    try {
      var list = await geocode(q);
      if (!sync || token !== sync.seq) return;
      if (!list.length) { setStatus((from === 'road' ? '새주소' : '구주소') + '로 검색되는 주소가 없어요. 시·동까지 정확히 적어 주세요.', true); return; }
      var hit = list[0];
      if (list.length > 1 && !/[가-힣]+(시|군|구)(\s|$)/.test(q)) hit = list.filter(function (r) { return /파주/.test(r.address_name); })[0] || list[0];
      var target = from === 'road' ? (hit.address && hit.address.address_name) : (hit.road_address && hit.road_address.address_name);
      if (!target) { setStatus(from === 'road' ? '이 새주소에 해당하는 구주소를 찾지 못했어요.' : '이 번지에는 아직 새주소(도로명)가 없어요.', true); return; }
      dst.value = fullAddr(target); sync.pending[from] = false;
      setStatus(list.length > 1 ? '검색 결과 ' + list.length + '건 중 첫 번째 주소예요. 맞는지 확인해 주세요.' : '자동으로 맞췄어요.');
    } catch (e) { if (sync && token === sync.seq) setStatus(e.message || '주소 변환에 실패했어요.', true); }
  }
  function setupAddressSync() {
    var road = $('ov_address'), lot = $('ov_lot_address'); if (!road || !lot || !road.parentNode || !lot.parentNode) return;
    var cell = road.parentNode, status = document.createElement('div'); status.className = 'addr-status'; cell.appendChild(status);
    sync = { road: road, lot: lot, status: status, seq: 0, timer: null, pending: { road: false, lot: false }, ph: [road.placeholder, lot.placeholder], handlers: [] };
    road.placeholder = '새주소(도로명) 예) 경기도 파주시 ○○로 12'; lot.placeholder = '구주소(지번) 예) 경기도 파주시 ○○동 123-4';
    // 옛 자료: 주소 칸에 구주소만 들어 있으면 구주소 칸으로 옮긴다
    var p = splitAddr(road.value, lot.value); road.value = p.road; lot.value = p.lot;
    function bind(el, from) {
      var onIn = function () { sync.pending[from] = true; clearTimeout(sync.timer); sync.timer = setTimeout(function () { convertFrom(from); }, 900); };
      var onBlur = function () { if (sync && sync.pending[from]) { clearTimeout(sync.timer); convertFrom(from); } };
      el.addEventListener('input', onIn); el.addEventListener('blur', onBlur); sync.handlers.push([el, onIn, onBlur]);
    }
    bind(road, 'road'); bind(lot, 'lot');
    if (road.value && !lot.value) convertFrom('road'); else if (lot.value && !road.value) convertFrom('lot');
  }
  function teardownAddressSync() {
    if (!sync) return;
    clearTimeout(sync.timer); sync.seq++;
    sync.handlers.forEach(function (h) { h[0].removeEventListener('input', h[1]); h[0].removeEventListener('blur', h[2]); });
    sync.road.placeholder = sync.ph[0]; sync.lot.placeholder = sync.ph[1];
    if (sync.status.parentNode) sync.status.remove();
    sync = null;
  }
  // 저장 직전에 자동 맞춤이 끝나도록 기다린다
  var origSave = window.saveOverview;
  window.saveOverview = async function () {
    if (sync) {
      clearTimeout(sync.timer);
      var pend = sync.pending.road ? 'road' : sync.pending.lot ? 'lot' : '';
      if (pend) await convertFrom(pend);
    }
    return origSave.apply(this, arguments);
  };

  // 주소에 edit=1 이 붙어 열린 경우: 이미 열린 아래쪽 수정창을 표 안으로 옮긴다
  if ($('editFormCard') && $('editFormCard').style.display !== 'none' && document.querySelector('#infoTable .info-table-label')) { $('editFormCard').style.display = 'none'; enter(); }
})();
