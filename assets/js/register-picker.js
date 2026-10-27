/* 매물 등록·수정 화면 공통 도우미
 * 1) 아파트: 마을 → 아파트 선택, 선택하면 새주소·구주소 자동 표시
 * 2) 아파트: 동·호수를 입력하면 타입·분양평형·면적 자동 입력 (data/apartment-units.json + 기존 단지 자료)
 * 3) 홈페이지용 입력(홍보스티커·공개 매물설명·공개 여부) 접기/펼치기 — 모든 매물 유형 공통
 * 등록과 수정 모두 같은 아파트 선택 UI를 사용하며 저장 로직은 기존 입력칸을 읽는다.
 */
(function () {
  const SCRIPT_SRC = document.currentScript && document.currentScript.src;
  const COMPLEX_URL = SCRIPT_SRC
    ? new URL('../../data/unjeong-apartments-20260806.json', SCRIPT_SRC).href
    : 'data/unjeong-apartments-20260806.json';
  const CUSTOM = '__custom__';
  const OTHER_VILLAGE = '기타 단지';
  const prefix = document.getElementById('edit_apartmentListingForm') ? 'edit_' : '';
  const $ = id => document.getElementById(prefix + id);
  const norm = v => String(v || '').replace(/\s+/g, '');

  let complexes = [];
  let built = false;
  let currentResourceId = '';
  let autoFilled = {};
  let seq = 0, timer = null;
  let villageSel, aptSel, nameInput, roadInput, jibunInput;

  // ── 단지 목록 ─────────────────────────────────────────
  async function loadComplexes() {
    try {
      const res = await fetch(COMPLEX_URL);
      if (!res.ok) return;
      const data = await res.json();
      complexes = (data.records || []).map(r => {
        const m = String(r.name || '').match(/^(.*?마을)\s*(\d+단지)\s*(.*)$/);
        const addr = typeof apartmentResourceAddresses === 'function' ? apartmentResourceAddresses(r) : {};
        return {
          id: r.id, name: r.name,
          village: m ? m[1] : OTHER_VILLAGE,
          apt: m ? (m[2] + (m[3] ? ' ' + m[3] : '')) : r.name,
          road: addr.roadAddress || '', jibun: addr.jibunAddress || ''
        };
      });
    } catch (_) { complexes = []; }
  }
  function villages() {
    const set = [...new Set(complexes.map(c => c.village))];
    return set.sort((a, b) => (a === OTHER_VILLAGE) - (b === OTHER_VILLAGE) || a.localeCompare(b, 'ko', { numeric: true }));
  }
  function option(value, text) {
    const o = document.createElement('option'); o.value = value; o.textContent = text; return o;
  }
  function fillVillages() {
    const keep = villageSel.value;
    villageSel.replaceChildren(option('', '마을 선택'), ...villages().map(v => option(v, v)), option(CUSTOM, '✏️ 목록에 없음 (직접 입력)'));
    villageSel.value = keep;
  }
  function fillApts(village) {
    const list = complexes.filter(c => c.village === village)
      .sort((a, b) => a.apt.localeCompare(b.apt, 'ko', { numeric: true }));
    aptSel.replaceChildren(option('', village ? '아파트 선택' : '마을을 먼저 선택'), ...list.map(c => option(c.id, c.apt)));
    aptSel.disabled = !village;
    return list;
  }
  function showCustom(on) {
    nameInput.hidden = !on;
    aptSel.hidden = on;
  }

  // ── 주소 ─────────────────────────────────────────────
  function setAddresses(road, jibun) {
    $('publicAddress').value = road || '';
    $('mapAddress').value = jibun || '';
    roadInput.value = road || '';
    jibunInput.value = jibun || '';
  }
  function linkResource(id) {
    currentResourceId = id || '';
    const sel = $('resource_id');
    if (sel && id && Array.from(sel.options).some(o => o.value === id)) sel.value = id;
  }

  // ── 아파트 선택 ───────────────────────────────────────
  function pickComplex(c) {
    nameInput.value = c.name;
    const complexEl = $('complexName'); if (complexEl) complexEl.value = c.name;
    setAddresses(c.road, c.jibun);
    linkResource(c.id);
    clearAutoFilled();
    scheduleAutoFill(0);
  }
  function onVillageChange() {
    if (villageSel.value === CUSTOM) {
      showCustom(true);
      nameInput.value = ''; currentResourceId = '';
      setAddresses('', '');
      clearAutoFilled();
      nameInput.focus();
      return;
    }
    showCustom(false);
    const list = fillApts(villageSel.value);
    aptSel.value = '';
    nameInput.value = '';
    setAddresses('', '');
    currentResourceId = '';
    clearAutoFilled();
    if (list.length === 1) { aptSel.value = list[0].id; pickComplex(list[0]); }
  }
  function onAptChange() {
    const c = complexes.find(x => x.id === aptSel.value);
    if (c) pickComplex(c);
  }
  // 다른 코드가 입력칸 값을 직접 채운 경우(지도·건물 자료에서 넘어온 경우 등) 선택 칸에 반영한다.
  function syncFromFields() {
    if (!built) return;
    const name = nameInput.value.trim();
    const c = name ? complexes.find(x => norm(x.name) === norm(name)) : null;
    fillVillages();
    if (c) {
      villageSel.value = c.village; fillApts(c.village); aptSel.value = c.id; showCustom(false);
      currentResourceId = currentResourceId || c.id;
    } else if (name) {
      villageSel.value = CUSTOM; fillApts(''); showCustom(true);
    } else {
      villageSel.value = ''; fillApts(''); showCustom(false);
    }
    roadInput.value = $('publicAddress').value;
    jibunInput.value = $('mapAddress').value;
  }

  // ── 동·호수 → 타입·면적 자동 입력 ─────────────────────
  const AUTO_IDS = ['apt_타입', 'apt_평형', 'apt_분양_m2', 'apt_분양_평', 'apt_전용_m2', 'apt_전용_평'];
  function setStatus(text) {
    const host = $('apartmentListingForm');
    if (host && host._autoStatus) host._autoStatus.textContent = text || '';
  }
  function clearAutoFilled() {
    Object.keys(autoFilled).forEach(id => { if (autoFilled[id] && $(id)) $(id).value = ''; });
    autoFilled = {};
  }
  function putAuto(id, value) {
    const el = $(id);
    if (!el || value == null || value === '' || el.value) return;
    el.value = value; autoFilled[id] = true;
  }
  function scheduleAutoFill(delay) {
    clearTimeout(timer);
    timer = setTimeout(autoFillUnit, delay == null ? 600 : delay);
  }
  async function autoFillUnit() {
    const my = ++seq;
    const name = nameInput.value.trim();
    const dong = $('apt_동').value.trim(), ho = $('apt_호수').value.trim();
    if (!name || !dong || !ho) { clearAutoFilled(); setStatus(''); return; }
    if ($('apt_권리구분').value === '분양권') return;
    setStatus('타입·면적 확인 중…');
    let ref = null;
    try {
      ref = await lookupApartmentUnitReference({ complexName: name, dong, ho, resource_id: currentResourceId });
    } catch (_) { ref = null; }
    let unitMissing = false;
    if (!ref || !ref.matched) {
      await ensureApartmentUnitTable();
      const s = apartmentStaticUnit(currentResourceId || name, dong, ho);
      if (s.found && s.type) {
        ref = { matched: true, type: s.type, supply: s.supply, exclusive: s.exclusive };
      } else if (s.found) {
        unitMissing = true;
      }
    }
    if (my !== seq) return;
    clearAutoFilled();
    if (ref && ref.matched) {
      putAuto('apt_타입', ref.type);
      const py = m2 => (m2 / (400 / 121)).toFixed(2);
      if (ref.supply != null) {
        putAuto('apt_분양_m2', +Number(ref.supply).toFixed(4));
        putAuto('apt_분양_평', py(ref.supply));
        putAuto('apt_평형', py(ref.supply) + '평');
      } else if (ref.size) {
        putAuto('apt_평형', ref.size);
      }
      if (ref.exclusive != null) {
        putAuto('apt_전용_m2', +Number(ref.exclusive).toFixed(4));
        putAuto('apt_전용_평', py(ref.exclusive));
      }
      const parts = ['타입 ' + ref.type + ' 자동 입력'];
      if (ref.supply != null) parts.push('공급면적');
      if (ref.exclusive != null) parts.push('전용면적');
      let msg = parts.join(' · ') + '.';
      if (ref.supply == null || ref.exclusive == null) msg += " 비어 있는 면적은 '건축물대장 조회'로 채우거나 직접 입력하세요.";
      setStatus(msg);
    } else if (unitMissing) {
      setStatus('이 단지 자료에 없는 동·호수입니다. 동·호수를 다시 확인해 주세요.');
    } else {
      setStatus("이 단지의 타입 자료가 아직 없습니다. 타입·면적을 직접 입력하거나 '건축물대장 조회'를 눌러 주세요.");
    }
  }

  // ── 새주소 ⇄ 구주소 변환 (카카오 주소검색) ─────────────
  let kakaoPromise = null;
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src; s.onload = resolve; s.onerror = () => reject(new Error('스크립트를 불러오지 못했습니다.'));
      document.head.appendChild(s);
    });
  }
  function loadKakao() {
    if (window.kakao && window.kakao.maps && window.kakao.maps.services) return Promise.resolve();
    if (kakaoPromise) return kakaoPromise;
    kakaoPromise = (async () => {
      if (!window.HITOP_KAKAO_JS_KEY && SCRIPT_SRC) await loadScript(new URL('kakao-config.js', SCRIPT_SRC).href);
      const key = String(window.HITOP_KAKAO_JS_KEY || '').trim();
      if (!key) throw new Error('카카오맵 키가 설정되지 않았습니다.');
      await loadScript('https://dapi.kakao.com/v2/maps/sdk.js?appkey=' + encodeURIComponent(key) + '&libraries=services&autoload=false');
      await new Promise(resolve => window.kakao.maps.load(resolve));
    })().catch(e => { kakaoPromise = null; throw e; });
    return kakaoPromise;
  }
  function geocode(query) {
    return loadKakao().then(() => new Promise((resolve, reject) => {
      new window.kakao.maps.services.Geocoder().addressSearch(query, (result, status) => {
        if (status === window.kakao.maps.services.Status.OK) resolve(result || []);
        else if (status === window.kakao.maps.services.Status.ZERO_RESULT) resolve([]);
        else reject(new Error('주소 검색 중 오류가 났어요. 잠시 후 다시 눌러 주세요.'));
      });
    }));
  }
  const fullAddr = v => String(v || '').trim().replace(/^경기\s/, '경기도 ');
  let lastAddrEdited = '';
  async function convertAddress(btn, statusEl) {
    const road = roadInput.value.trim(), jibun = jibunInput.value.trim();
    if (!road && !jibun) { statusEl.textContent = '새주소나 구주소 중 한쪽을 먼저 입력해 주세요.'; return; }
    const from = road && jibun ? (lastAddrEdited || 'road') : (road ? 'road' : 'jibun');
    const query = from === 'road' ? road : jibun;
    btn.disabled = true; statusEl.textContent = '주소 찾는 중…';
    try {
      let list = await geocode(query);
      if (!list.length) { statusEl.textContent = (from === 'road' ? '새주소' : '구주소') + '로 검색되는 주소가 없어요. 시·동까지 포함해 정확히 적어 주세요.'; return; }
      let hit = list[0];
      if (list.length > 1 && !/[가-힣]+(시|군|구)(\s|$)/.test(query)) hit = list.find(r => /파주/.test(r.address_name)) || list[0];
      const target = from === 'road' ? (hit.address && hit.address.address_name) : (hit.road_address && hit.road_address.address_name);
      if (!target) { statusEl.textContent = from === 'road' ? '이 새주소에 해당하는 구주소를 찾지 못했어요.' : '이 번지에는 아직 새주소(도로명)가 없어요.'; return; }
      const value = fullAddr(target);
      if (from === 'road') { jibunInput.value = value; $('mapAddress').value = value; }
      else { roadInput.value = value; $('publicAddress').value = value; }
      statusEl.textContent = (from === 'road' ? '구주소' : '새주소') + '를 채웠어요.' + (list.length > 1 ? ' (검색 결과 ' + list.length + '건 중 첫 번째예요. 맞는지 확인해 주세요)' : '');
    } catch (e) {
      statusEl.textContent = e.message || '주소 변환에 실패했어요.';
    } finally { btn.disabled = false; }
  }

  // ── 아파트 폼 화면 정리 ───────────────────────────────
  function buildApartmentUi() {
    const host = $('apartmentListingForm');
    nameInput = $('apt_아파트명');
    if (!host || !nameInput || built) return;
    const nameField = nameInput.closest('.umfield');
    nameField.querySelector('label').textContent = '아파트 선택 (마을 → 아파트)';

    const row = document.createElement('div');
    row.className = 'apt-picker-row';
    villageSel = document.createElement('select'); villageSel.id = prefix + 'aptPickVillage'; villageSel.setAttribute('aria-label', '마을 선택');
    aptSel = document.createElement('select'); aptSel.id = prefix + 'aptPickName'; aptSel.setAttribute('aria-label', '아파트 선택');
    nameInput.placeholder = '아파트명을 직접 입력하세요';
    nameInput.hidden = true;
    row.append(villageSel, aptSel);
    nameField.insertBefore(row, nameInput);
    row.appendChild(nameInput);

    const dateField = $('apt_접수일자').closest('.umfield');
    const makeAddr = (id, label, placeholder) => {
      const f = document.createElement('div'); f.className = 'umfield span-2';
      const l = document.createElement('label'); l.innerHTML = label + ' <span class="apt-auto-note">아파트를 선택하면 자동 입력</span>';
      const i = document.createElement('input'); i.id = prefix + id; i.type = 'text'; i.placeholder = placeholder;
      f.append(l, i); return { field: f, input: i };
    };
    const road = makeAddr('aptAddrRoad', '새주소 (도로명)', '예) 경기도 파주시 ○○로 123');
    const jibun = makeAddr('aptAddrJibun', '구주소 (지번)', '예) 경기도 파주시 동패동 1234');
    roadInput = road.input; jibunInput = jibun.input;
    dateField.after(road.field, jibun.field);
    const conv = document.createElement('div'); conv.className = 'umfield span-2 apt-addr-convert';
    conv.innerHTML = '<label>주소 변환 <span class="apt-auto-note">한쪽만 적고 누르세요</span></label>';
    const convBtn = document.createElement('button'); convBtn.type = 'button'; convBtn.textContent = '새주소 ⇄ 구주소 변환';
    convBtn.style.cssText = 'width:100%;padding:9px 12px;border-radius:8px;border:1px solid rgba(212,175,55,.55);background:rgba(212,175,55,.14);color:#e0b84c;font-weight:700;cursor:pointer;box-sizing:border-box;';
    const convStatus = document.createElement('div'); convStatus.style.cssText = 'font-size:.74rem;margin-top:4px;opacity:.85;';
    conv.append(convBtn, convStatus);
    jibun.field.after(conv);
    convBtn.addEventListener('click', () => convertAddress(convBtn, convStatus));
    roadInput.addEventListener('input', () => { lastAddrEdited = 'road'; });
    jibunInput.addEventListener('input', () => { lastAddrEdited = 'jibun'; });
    roadInput.addEventListener('input', () => { $('publicAddress').value = roadInput.value; });
    jibunInput.addEventListener('input', () => { $('mapAddress').value = jibunInput.value; });

    villageSel.addEventListener('change', onVillageChange);
    aptSel.addEventListener('change', onAptChange);
    nameInput.addEventListener('input', () => { const c = $('complexName'); if (c) c.value = nameInput.value; });
    ['apt_동', 'apt_호수'].forEach(id => $(id).addEventListener('input', () => scheduleAutoFill()));
    AUTO_IDS.forEach(id => { const el = $(id); if (el) el.addEventListener('input', () => { delete autoFilled[id]; }); });
    document.getElementById(prefix ? 'editSaveBtn' : 'saveBtn').addEventListener('click', () => linkResource(currentResourceId), true);

    // 세입자·옵션·추가메모는 필요할 때만 펼치도록 한 묶음으로 접는다.
    const extras = Array.from(host.children).filter(el => el.classList.contains('um-section') &&
      /세입자|옵션|추가메모/.test((el.querySelector('.um-section-title') || {}).textContent || ''));
    if (extras.length) {
      const details = document.createElement('details');
      details.className = 'um-section current apt-more';
      details.innerHTML = '<summary>추가 정보 — 세입자·옵션·메모 (필요할 때만 펼치기)</summary>';
      extras[0].before(details);
      extras.forEach(el => details.appendChild(el));
    }
    built = true;
    fillVillages(); fillApts('');
    loadComplexes().then(() => { fillVillages(); syncFromFields(); });
  }
  function openExtrasIfFilled() {
    const d = document.querySelector('#' + prefix + 'apartmentListingForm .apt-more');
    if (!d) return;
    const ids = ['apt_세입자이름', 'apt_세입자연락처', 'apt_세입자비고', 'apt_옵션', 'apt_비고', 'apt_계약시작'];
    const tenant = $('apt_세입자현황');
    if (ids.some(id => $(id) && $(id).value.trim()) || (tenant && tenant.value && tenant.value !== '미확인')) d.open = true;
  }

  // ── 카테고리에 따라 화면 정리 ─────────────────────────
  function sync() {
    const apt = $(prefix ? 'category2' : 'category2Select').value === '아파트';
    ['publicAddress', 'mapAddress'].forEach(id => {
      const f = $(id) && $(id).closest('.field');
      if (f) f.style.display = apt ? 'none' : '';
    });
    if (apt) { syncFromFields(); openExtrasIfFilled(); }
  }

  // ── 홈페이지용 입력 접기/펼치기 (모든 매물 유형 공통) ──
  function setupHomepagePanel() {
    const btn = $('homepageToggleBtn'), panel = $('homepagePanel'), hint = $('homepageToggleHint');
    if (!btn || !panel) return;
    const filled = () =>
      !!document.querySelector('input[name="stickers"]:checked') ||
      !!($('detailDescription') && $('detailDescription').value.trim()) ||
      !!($('is_public') && $('is_public').checked);
    function update() {
      const open = !panel.hidden;
      btn.setAttribute('aria-expanded', String(open));
      btn.checked = open;
      hint.textContent = open ? '설명·홍보스티커 입력 후 저장하세요' : '선택할 때만 설명·홍보스티커 입력';
    }
    btn.addEventListener('change', () => {
      panel.hidden = !btn.checked;
      if ($('is_public')) $('is_public').checked = btn.checked;
      update();
    });
    panel.addEventListener('input', update);
    panel.addEventListener('change', update);
    window.refreshHomepagePanel = () => { update(); };
    update();
  }

  window.RegisterUi = {
    init() { setupHomepagePanel(); buildApartmentUi(); sync(); },
    sync
  };
  window.EditUi = {
    init() { buildApartmentUi(); sync(); },
    sync
  };
})();
