(function () {
  'use strict';

  const $ = id => document.getElementById(id);
  const CAND_MIN = 3, CAND_MAX = 20, CAND_LIMIT = 50;   // 후보 보기: 수익률 3~20%, 상위 50개 (입력 오류로 튀는 값 제외)

  let buildings = [];   // { id, name, record, units: [{u, room}], commercial, resource, scope, recs: [추천매물장 자료] }
  let unmatchedRecs = [];   // 건물을 찾지 못한 추천매물장 자료
  let shopFloors = {};      // 건물(local_id) → 상가가 있는 마지막 층 (오피스텔 등 주거 건물용, 기본 1층)
  let shopFloorsOk = true;  // 설정 표를 불러왔는지
  let mode = 'rec';     // 'rec' | 'cand' | 'closed'
  const busy = new Set();
  const selected = new Set();        // 인쇄용으로 체크한 호실 (건물id|호수)
  let shown = [];                    // 지금 화면에 보이는 항목
  const selKey = e => e.b.id + '|' + e.item.room;

  // ----- 값 변환 -----
  function num(v) { if (v === null || v === undefined || v === '') return null; const n = Number(v); return Number.isFinite(n) ? n : null; }
  function isFlagOn(v) {
    if (v === true) return true;
    const s = String(v ?? '').trim();
    return s !== '' && !['false', '0', 'n', 'no', 'x', '아니오', '없음'].includes(s.toLowerCase());
  }
  function eok(v) {                      // 만원 → "3억 5,000만"
    const n = num(v);
    if (n === null) return '—';
    const e = Math.floor(n / 10000), r = Math.round(n % 10000);
    if (!e) return n.toLocaleString('ko-KR') + '만';
    return e + '억' + (r ? ' ' + r.toLocaleString('ko-KR') + '만' : '');
  }
  // 금액은 만원 기준. 분양금액 등은 원 단위로 저장된 호실이 많아서, 만원으로 보기엔 비정상적으로 크면 원 단위로 보고 환산한다.
  function manwon(v, limit) { const n = num(v); return n === null ? null : (n >= limit ? n / 10000 : n); }
  function price(u) { return manwon(u.현_매매가격 ?? u.분양금액, 1000000); }      // 100억(만원 기준) 이상이면 원 단위
  function deposit(u) { return manwon(u.현_보증금 ?? u.보증금, 1000000); }
  function rent(u) { return manwon(u.현_월세 ?? u.월차임, 100000); }               // 월 10억(만원 기준) 이상이면 원 단위
  function roomLabel(r) { r = String(r || ''); return r.endsWith('호') ? r : r + '호'; }
  function yieldOf(u) {                  // 저장된 수익률이 있으면 그 값, 없으면 단순수익률 자동 계산
    const raw = String(u.수익률 ?? '').trim();                      // 전화번호 같은 숫자가 아닌 값은 무시하고 계산한다
    if (/^\d{1,2}(\.\d+)?\s*%?$/.test(raw)) { const saved = parseFloat(raw); if (saved > 0 && saved <= 30) return { v: saved, calc: false }; }
    const p = price(u), m = rent(u), d = deposit(u) || 0;
    if (!p || !m) return null;
    const base = p - d;
    if (base <= 0) return null;
    return { v: m * 12 / base * 100, calc: true };
  }
  const floorNo = room => { const m = String(room || '').trim().match(/^(\d)\d{2}호?$/); return m ? Number(m[1]) : null; };   // 101~199호 = 1층
  const shopMaxFloor = b => (b.record && shopFloors[b.record.local_id]) || 1;
  function roomSortKey(room) {
    const s = String(room || ''), b = s.match(/^[Bb](\d+)/);
    const n = parseInt((s.match(/\d+/) || ['0'])[0], 10);
    return (b ? -1 : 1) * 1e6 + (b ? -n : n);
  }

  function toast(text) {
    const el = $('toast');
    el.textContent = text;
    el.classList.add('show');
    clearTimeout(toast.t);
    toast.t = setTimeout(() => el.classList.remove('show'), 2600);
  }
  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  // ----- 추천매물장 자료 -----
  function recLinks(p) {                 // drive_url은 주소 하나이거나 [{date,url}] 목록이다
    const raw = String(p.drive_url || '').trim();
    if (!raw) return [];
    let list = [];
    if (raw.startsWith('[')) { try { list = JSON.parse(raw); } catch (e) { list = []; } }
    else list = [{ url: raw }];
    return (Array.isArray(list) ? list : []).filter(x => x && /^https?:\/\//i.test(String(x.url || '')))
      .map(x => ({ url: String(x.url), date: x.date || '' }));
  }
  const normName = t => String(t || '').replace(/[\s·\-_()\[\]]/g, '');
  // 추천매물장 이름("송림로데오 잔여분")에 들어 있는 건물명으로 건물을 찾는다. 애매하면 찾지 못한 것으로 둔다.
  function matchBuilding(recName) {
    const rn = normName(recName);
    let best = null, top = 0, tie = false;
    buildings.forEach(b => {
      const bn = normName(b.name);
      let score = 0;
      if (bn.length >= 3 && rn.includes(bn)) score = 100 + bn.length;
      else {
        const m = bn.match(/^(.+?)(\d+차)$/);                      // "유은 9차" ↔ "유은타워 9차 잔여분"
        if (m && m[1].length >= 2 && rn.includes(m[1]) && rn.includes(m[2])) score = 90;
        else {
          const hit = String(b.name || '').split(/\s+/).map(normName).filter(t => t.length >= 4 && rn.includes(t))
            .sort((a, c) => c.length - a.length)[0];                // "초롱꽃마을4단지 신영지웰" ↔ "신영지웰 …"
          if (hit) score = 50 + hit.length;
        }
      }
      if (score > top) { best = b; top = score; tie = false; } else if (score && score === top) tie = true;
    });
    return tie ? null : best;
  }

  // ----- 데이터 -----
  async function load() {
    const { data, error } = await hitopAuthClient.auth.getSession();
    if (error || !data.session) { hitopRedirectToLogin(); return false; }
    hitopApplyAuthHeader(data.session);
    const [resources, recordsRes, recProps] = await Promise.all([
      getDriveResources(),
      fetchWithTimeout(SUPABASE_URL + '/rest/v1/buildings?select=local_id,name,units', { headers }),
      getRecommendedProperties(),
      getDriveCategories()
    ]);
    if (!recordsRes.ok) throw new Error('건물 호실 조회 실패');
    const records = await recordsRes.json();
    const used = new Set();
    const toUnits = rec => (rec && Array.isArray(rec.units) ? rec.units : [])
      .filter(u => String(u.호수 || '').trim()).map(u => ({ u, room: String(u.호수).trim() }));
    // 자료관리의 모든 건물 (호실 기록이 없어도 추천매물장 자료를 붙일 수 있게 남겨둔다)
    buildings = resources.map(r => {
      const rec = records.find(x => x.local_id === r.id) || records.find(x => x.name === r.name) || null;
      if (rec) used.add(rec.local_id);
      const scope = HitopResourceRooms.resourceRoom(r);
      return { id: r.id, name: r.name, record: rec, units: toUnits(rec), commercial: scope === 'commercial', resource: true, scope, recs: [], memo: r.memo || '' };
    });
    // 자료관리에 같은 이름이 없는 호실 기록(예: 남광, 월드플러스)도 빠지지 않게 포함한다
    records.filter(x => !used.has(x.local_id)).forEach(rec => {
      buildings.push({ id: 'orphan:' + rec.local_id, name: rec.name || rec.local_id, record: rec, units: toUnits(rec), commercial: true, resource: false, scope: 'commercial', recs: [] });
    });
    // 오피스텔 건물별 상가층 설정 (표를 못 불러오면 모두 1층으로 보고 저장은 막는다)
    try {
      const fr = await fetchWithTimeout(SUPABASE_URL + '/rest/v1/building_shop_floors?select=local_id,max_floor', { headers });
      if (!fr.ok) throw new Error('floors');
      shopFloors = {}; (await fr.json()).forEach(x => { shopFloors[x.local_id] = Number(x.max_floor) || 1; });
      shopFloorsOk = true;
    } catch (e) { shopFloors = {}; shopFloorsOk = false; }
    // 추천매물장 자료를 건물에 붙인다
    unmatchedRecs = [];
    (recProps || []).forEach(p => {
      const rp = { id: p.id, name: p.name || '', date: p.received_date || '', memo: p.memo || '', links: recLinks(p), closedAt: p.closed_at || null };
      const b = matchBuilding(rp.name);
      if (b) b.recs.push(rp); else unmatchedRecs.push(rp);
    });
    return true;
  }

  // 체크 저장: 저장 직전에 최신 호실 목록을 다시 읽어서, 해당 호실의 표시값 하나만 바꾼다.
  async function setFlag(b, item, key, on) {
    const fresh = await getBuildingRecord(b.record.local_id);
    if (!fresh || !Array.isArray(fresh.units)) throw new Error('건물 정보를 다시 불러오지 못했습니다.');
    const matches = fresh.units.map((x, i) => [x, i]).filter(([x]) => String(x.호수 || '').trim() === item.room);
    if (matches.length !== 1) throw new Error(matches.length ? '같은 호수가 여러 개라 여기서는 바꿀 수 없습니다. 건물 상세에서 수정해주세요.' : '호실을 찾지 못했습니다.');
    const next = fresh.units.slice();
    next[matches[0][1]] = { ...next[matches[0][1]], [key]: on ? true : null };
    await saveBuildingUnits(fresh.local_id, fresh.name, next);
    item.u = next[matches[0][1]];
    b.record.units = next;
  }

  async function toggle(b, item, key, btn) {
    const id = b.id + '|' + item.room + '|' + key;
    if (busy.has(id)) return;
    busy.add(id);
    btn.disabled = true;
    const turnOn = !isFlagOn(item.u[key]);
    try {
      await setFlag(b, item, key, turnOn);
      toast(turnOn ? '표시했습니다.' : '해제했습니다.');
    } catch (e) {
      toast('저장 실패: ' + e.message);
    } finally {
      busy.delete(id);
      render();
    }
  }

  async function saveShopFloor(b, floor, select) {
    select.disabled = true;
    try {
      const res = await fetchWithTimeout(SUPABASE_URL + '/rest/v1/building_shop_floors?on_conflict=local_id', {
        method: 'POST',
        headers: Object.assign({}, headers, { Prefer: 'resolution=merge-duplicates,return=minimal' }),
        body: JSON.stringify({ local_id: b.record.local_id, max_floor: floor, updated_at: new Date().toISOString() })
      });
      if (!res.ok) throw new Error(await res.text());
      shopFloors[b.record.local_id] = floor;
      toast(`${b.name}: 상가 ${floor === 1 ? '1층만' : floor + '층까지'}로 저장했습니다.`);
    } catch (e) {
      toast('저장 실패: ' + e.message);
    } finally {
      render();
    }
  }

  // 후보 보기 위쪽: 오피스텔 등 주거 건물별 "상가가 몇 층까지인지" 선택
  function renderFloorPanel() {
    const panel = $('floorPanel');
    panel.replaceChildren();
    const list = buildings.filter(b => !b.commercial && b.record && b.units.length).sort((a, c) => a.name.localeCompare(c.name, 'ko'));
    if (mode !== 'cand' || !list.length) { panel.style.display = 'none'; return; }
    panel.style.display = '';
    panel.append(el('div', 'fp-title', '🏢 오피스텔 건물의 상가 층 (후보에 넣을 층)'));
    const row = el('div', 'fp-row');
    list.forEach(b => {
      const lab = el('label', 'fp-item'), sel = document.createElement('select');
      for (let f = 1; f <= 5; f++) { const o = document.createElement('option'); o.value = String(f); o.textContent = f === 1 ? '1층만' : f + '층까지'; sel.append(o); }
      sel.value = String(Math.min(shopMaxFloor(b), 5));
      sel.disabled = !shopFloorsOk;
      sel.setAttribute('aria-label', b.name + ' 상가 층');
      sel.addEventListener('change', () => saveShopFloor(b, Number(sel.value), sel));
      lab.append(el('span', '', b.name), sel);
      row.append(lab);
    });
    panel.append(row);
    if (!shopFloorsOk) panel.append(el('div', 'fp-note', '상가 층 설정을 불러오지 못해 모두 1층으로 보여줍니다.'));
  }

  // ----- 화면 -----
  function collect() {
    const q = $('q').value.trim().toLowerCase();
    const out = [];
    buildings.forEach(b => {
      b.units.forEach(item => {
        // 후보 보기: 상가 건물은 전체, 오피스텔 등 주거 건물은 설정한 상가층(기본 1층)까지만
        if (mode === 'cand' && !b.commercial) { const f = floorNo(item.room); if (f === null || f > shopMaxFloor(b)) return; }
        const u = item.u;
        const rec = isFlagOn(u.추천매물), profit = isFlagOn(u.수익성매물);
        if (mode === 'rec' && !rec) return;
        if (mode === 'cand' && rec) return;
        if (q && !(b.name.toLowerCase().includes(q) || String(u.현업종 || '').toLowerCase().includes(q))) return;
        const y = yieldOf(u);
        if (mode === 'cand' && !(y && y.v >= CAND_MIN && y.v <= CAND_MAX)) return;
        out.push({ b, item, y });
      });
    });
    return out;
  }
  function sorter() {
    const by = $('sort').value;
    if (mode === 'cand') return (a, c) => c.y.v - a.y.v;
    if (by === 'price') return (a, c) => (price(a.item.u) ?? 1e12) - (price(c.item.u) ?? 1e12);
    if (by === 'room') return (a, c) => roomSortKey(a.item.room) - roomSortKey(c.item.room);
    if (by === 'building') return (a, c) => a.b.name.localeCompare(c.b.name, 'ko') || roomSortKey(a.item.room) - roomSortKey(c.item.room);
    return (a, c) => ((c.y && c.y.v) || -1) - ((a.y && a.y.v) || -1);
  }

  function rowFor(entry) {
    const { b, item, y } = entry, u = item.u;
    const tr = document.createElement('tr');
    tr.className = 'clickrow'; tr.title = '눌러서 상세보기';
    tr.addEventListener('click', ev => { if (ev.target.closest('button, a, input, select, label')) return; openDetail(b, item.room); });
    if (mode === 'rec') {
      const sc = el('td', 'sel'), cb = document.createElement('input');
      cb.type = 'checkbox'; cb.checked = selected.has(selKey(entry)); cb.setAttribute('aria-label', roomLabel(item.room) + ' 인쇄 선택');
      cb.addEventListener('change', () => { if (cb.checked) selected.add(selKey(entry)); else selected.delete(selKey(entry)); updatePrintBtn(); syncHeadChecks(); });
      sc.append(cb); tr.append(sc);
    }
    tr.append(el('td', 'bname', b.name));
    const room = el('td'); room.append(el('strong', '', roomLabel(item.room)));
    if (isFlagOn(u.추천매물)) room.append(el('span', 'flag rec', '⭐추천'));
    if (isFlagOn(u.수익성매물)) room.append(el('span', 'flag profit', '💰수익성'));
    tr.append(room, el('td', '', u.현업종 || '—'));
    tr.append(el('td', 'num', eok(price(u))));
    tr.append(el('td', 'num', eok(deposit(u)) + ' / ' + (rent(u) === null ? '—' : rent(u).toLocaleString('ko-KR') + '만')));
    const yd = el('td', 'num');
    if (y) { const s = el('span', 'yield', y.v.toFixed(1) + '%'); if (y.calc) s.append(el('small', '', '계산')); yd.append(s); } else yd.textContent = '—';
    tr.append(yd);
    const st = u.공실여부 || '공실';
    const std = el('td'); std.append(el('span', 'sbadge ' + st, st)); tr.append(std);

    const act = el('div', 'act');
    const recBtn = el('button', 'mini' + (isFlagOn(u.추천매물) ? ' on' : ''), isFlagOn(u.추천매물) ? '⭐ 해제' : '⭐ 추천');
    recBtn.type = 'button';
    recBtn.addEventListener('click', () => toggle(b, item, '추천매물', recBtn));
    const pBtn = el('button', 'mini' + (isFlagOn(u.수익성매물) ? ' pon' : ''), isFlagOn(u.수익성매물) ? '💰 해제' : '💰 수익성');
    pBtn.type = 'button';
    pBtn.addEventListener('click', () => toggle(b, item, '수익성매물', pBtn));
    const oneBtn = el('button', 'mini', '📄 한 장');
    oneBtn.type = 'button'; oneBtn.title = '이 호실만 A4 한 장으로 인쇄';
    oneBtn.addEventListener('click', () => printOnePages([entry]));
    act.append(recBtn, pBtn, oneBtn);
    if (b.resource) {
      const link = el('a', 'mini', '호실보기');
      link.href = HitopResourceRooms.detailUrl('building-detail.html', b.id, b.scope) + '#unitStatus';
      act.append(link);
    }
    const atd = el('td'); atd.append(act); tr.append(atd);
    return tr;
  }

  function table(entries) {
    const wrap = el('div', 'twrap');
    const t = document.createElement('table');
    const head = document.createElement('tr');
    if (mode === 'rec') {
      const th = el('th', 'sel'), all = document.createElement('input');
      all.type = 'checkbox'; all.className = 'headcheck'; all.setAttribute('aria-label', '이 건물 전체 선택');
      all.addEventListener('change', () => {
        entries.forEach(e => { if (all.checked) selected.add(selKey(e)); else selected.delete(selKey(e)); });
        wrap.querySelectorAll('tbody .sel input').forEach(c => { c.checked = all.checked; });
        updatePrintBtn();
      });
      th.append(all); head.append(th); wrap._head = all; wrap._entries = entries;
    }
    [['건물'], ['호실'], ['업종'], ['가격', 1], ['보증금 / 월세', 1], ['수익률', 1], ['상태'], ['']].forEach(([label, right]) => head.append(el('th', right ? 'num' : '', label)));
    const thead = document.createElement('thead'); thead.append(head);
    const tbody = document.createElement('tbody');
    entries.forEach(e => tbody.append(rowFor(e)));
    t.append(thead, tbody); wrap.append(t);
    return wrap;
  }

  function render() {
    const list = $('list');
    list.replaceChildren();
    $('sort').disabled = mode !== 'rec';
    renderFloorPanel();
    const closedCount = buildings.reduce((n, b) => n + b.recs.filter(r => r.closedAt).length, 0) + unmatchedRecs.filter(r => r.closedAt).length;
    $('tabClosed').textContent = '📁 종료된 자료' + (closedCount ? ` (${closedCount})` : '');
    if (mode === 'closed') { shown = []; updatePrintBtn(); renderClosed(list); return; }
    const entries = collect().sort(sorter());
    shown = mode === 'rec' ? entries : [];
    updatePrintBtn();

    if (mode === 'cand') {
      const shown = entries.slice(0, CAND_LIMIT);
      $('summary').textContent = `수익률 ${CAND_MIN}~${CAND_MAX}% 후보 ${entries.length}개 중 상위 ${shown.length}개 · 마음에 드는 호실은 ⭐ 추천을 눌러 추천매물로 옮기세요 (월세·가격이 입력된 호실 기준 · 오피스텔 건물은 아래에서 정한 상가층까지 · 수익률 계산은 월세×12 ÷ (가격−보증금))`;
      if (!shown.length) { list.append(emptyBox('조건에 맞는 후보가 없습니다.')); return; }
      const card = el('section', 'bcard');
      const head = el('div', 'bhead'); head.append(el('h2', '', '수익률 높은 후보'), el('span', '', shown.length + '개'));
      card.append(head, table(shown));
      list.append(card);
      return;
    }

    const q = $('q').value.trim().toLowerCase();
    const recOk = (r, b) => (!q || r.name.toLowerCase().includes(q) || r.memo.toLowerCase().includes(q) || (b && b.name.toLowerCase().includes(q)));
    const recItems = [];
    buildings.forEach(b => b.recs.forEach(r => { if (!r.closedAt && recOk(r, b)) recItems.push({ label: b.name, r }); }));
    recItems.sort((a, c) => (isOld(a.r) - isOld(c.r)) || a.label.localeCompare(c.label, 'ko') || a.r.name.localeCompare(c.r.name, 'ko'));
    const unmatchedItems = unmatchedRecs.filter(r => !r.closedAt && recOk(r, null)).map(r => ({ label: '건물 미지정', r }));
    unmatchedItems.sort((a, c) => isOld(a.r) - isOld(c.r));
    unmatchedItems.forEach(it => recItems.push(it));
    const profitCount = entries.filter(e => isFlagOn(e.item.u.수익성매물)).length;
    const parts = [];
    if (entries.length) parts.push(`추천매물 ${entries.length}개`, `💰수익성 ${profitCount}개`);
    if (recItems.length) parts.push(`추천매물장 자료 ${recItems.length}건`);
    $('summary').textContent = parts.length ? parts.join(' · ') : '표시할 추천매물이 없습니다.';
    if (!entries.length && !recItems.length) {
      const any = buildings.some(b => b.units.some(i => isFlagOn(i.u.추천매물))) || buildings.some(b => b.recs.some(r => !r.closedAt)) || unmatchedRecs.some(r => !r.closedAt);
      list.append(emptyBox(any ? '조건에 맞는 추천매물이 없습니다.' : null));
      return;
    }
    if (entries.length) {
      const card = el('section', 'bcard');
      const head = el('div', 'bhead'); head.append(el('h2', '', '추천매물 리스트'), el('span', '', entries.length + '개'));
      card.append(head, table(entries));
      list.append(card);
    } else {
      list.append(el('div', 'empty', '⭐ 표시한 호실이 아직 없습니다. 후보 보기에서 ⭐ 추천을 눌러 추가하세요.'));
    }
    if (recItems.length) list.append(recSection(recItems));
    syncHeadChecks();
  }

  // 추천매물장 자료는 받은 지 OLD_DAYS일이 지나면 "오래됨"으로 표시한다
  const OLD_DAYS = 90;
  function ageDays(r) {
    const t = Date.parse(r.date);
    return Number.isNaN(t) ? null : Math.floor((Date.now() - t) / 86400000);
  }
  function isOld(r) { const d = ageDays(r); return d !== null && d >= OLD_DAYS ? 1 : 0; }

  async function setClosed(r, closed, btn) {
    btn.disabled = true;
    try {
      await updateRecommendedProperty(r.id, { closed_at: closed ? new Date().toISOString() : null });
      r.closedAt = closed ? new Date().toISOString() : null;
      toast(closed ? `"${r.name}" 자료를 종료 폴더로 옮겼습니다.` : `"${r.name}" 자료를 다시 추천매물장으로 되돌렸습니다.`);
      render();
    } catch (e) {
      btn.disabled = false;
      toast('저장하지 못했습니다: ' + e.message);
    }
  }

  // 추천매물장(받은 분양 잔여분·임대 자료) 목록: 건물, 자료 이름, 받은 날짜, 메모(내부용), 드라이브 자료 링크
  function recSection(items, closedView) {
    const card = el('section', 'bcard');
    const head = el('div', 'bhead');
    head.append(el('h2', '', closedView ? '📁 종료된 추천매물장 자료 (보관 중 · 삭제되지 않습니다)' : '📎 추천매물장 자료 (내부용 · 인쇄에는 포함되지 않습니다)'), el('span', '', items.length + '건'));
    card.append(head);
    const box = el('div', 'recblock');
    items.forEach(({ label, r }) => {
      const row = el('div', 'recrow');
      const info = el('div', 'recinfo');
      info.append(el('span', 'bname', label + ' '), el('strong', '', r.name));
      if (r.date) info.append(el('span', 'recdate', String(r.date).slice(0, 10)));
      if (closedView && r.closedAt) info.append(el('span', 'recdate', '· 종료 ' + String(r.closedAt).slice(0, 10)));
      if (!closedView) {
        const d = ageDays(r);
        if (d !== null && d >= OLD_DAYS) info.append(el('span', 'flag old', '⏰ 오래됨 ' + Math.floor(d / 30) + '개월'));
      }
      if (r.memo) info.append(el('div', 'recmemo', '💬 ' + r.memo));
      const links = el('div', 'act');
      if (r.links.length) r.links.forEach((l, i) => {
        const a = el('a', 'mini', r.links.length > 1 ? `자료 ${i + 1} 열기` : '자료 열기');
        a.href = l.url; a.target = '_blank'; a.rel = 'noopener noreferrer';
        links.append(a);
      }); else links.append(el('span', 'recdate', '열 수 있는 자료 링크 없음'));
      const cb = el('button', 'mini', closedView ? '↩ 되살리기' : '📦 종료');
      cb.type = 'button'; cb.title = closedView ? '추천매물장으로 되돌립니다' : '삭제하지 않고 종료 폴더로 옮깁니다';
      cb.addEventListener('click', () => setClosed(r, !closedView, cb));
      links.append(cb);
      row.append(info, links);
      box.append(row);
    });
    card.append(box);
    return card;
  }

  // "종료된 자료" 폴더: 종료 처리한 추천매물장 자료 (최근 종료 순)
  function renderClosed(list) {
    const q = $('q').value.trim().toLowerCase();
    const items = [];
    buildings.forEach(b => b.recs.forEach(r => { if (r.closedAt) items.push({ label: b.name, r }); }));
    unmatchedRecs.forEach(r => { if (r.closedAt) items.push({ label: '건물 미지정', r }); });
    const shownItems = items.filter(({ label, r }) => !q || r.name.toLowerCase().includes(q) || r.memo.toLowerCase().includes(q) || label.toLowerCase().includes(q))
      .sort((a, c) => String(c.r.closedAt).localeCompare(String(a.r.closedAt)));
    $('summary').textContent = items.length ? `종료된 자료 ${shownItems.length}건 · 삭제하지 않고 보관합니다. 필요하면 "되살리기"로 되돌릴 수 있습니다.` : '아직 종료한 자료가 없습니다.';
    if (!shownItems.length) {
      list.append(el('div', 'empty', items.length ? '검색 조건에 맞는 종료 자료가 없습니다.' : '추천매물 탭의 추천매물장 자료에서 "📦 종료"를 누르면 이곳 폴더로 옮겨집니다.'));
      return;
    }
    list.append(recSection(shownItems, true));
  }

  // 건물별 전체선택 칸을 실제 선택 상태에 맞춘다
  function syncHeadChecks() {
    document.querySelectorAll('.twrap').forEach(w => {
      if (!w._head) return;
      w._head.checked = w._entries.length > 0 && w._entries.every(e => selected.has(selKey(e)));
    });
  }

  // ----- 손님용 A4 인쇄 -----
  function updatePrintBtn() {
    const btn = $('printBtn');
    btn.style.display = mode === 'rec' ? '' : 'none';
    $('sheetBtn').style.display = mode === 'rec' ? '' : 'none';
    const chosen = shown.filter(e => selected.has(selKey(e))).length;
    btn.textContent = chosen ? `🖨 손님용 인쇄 (선택 ${chosen}개)` : `🖨 손님용 인쇄 (전체 ${shown.length}개)`;
    btn.disabled = !shown.length;
  }

  // 인쇄물에는 소유주·연락처·비고·메모를 넣지 않는다 (가격, 임대 조건, 업종, 상태만)
  function buildPrint(entries) {
    const area = $('printArea');
    area.replaceChildren();
    const now = new Date();
    const dateStr = now.getFullYear() + '.' + String(now.getMonth() + 1).padStart(2, '0') + '.' + String(now.getDate()).padStart(2, '0');
    const phone = OfficeConfig.id === 'ktop' ? '' : ' ☎ 031.949.8969';

    const head = el('div', 'p-head');
    head.append(el('h1', '', '추천 매물 안내'), el('div', 'p-co', officeCompanyName + phone));
    area.append(head, el('p', 'p-date', '작성일 ' + dateStr + ' 기준 · 총 ' + entries.length + '개 호실'));

    const sec = el('section', 'p-bld');
    const t = document.createElement('table'), hr = document.createElement('tr');
    ['건물', '호실', '업종', '가격', '보증금 / 월세', '수익률', '상태'].forEach(h => hr.append(el('th', '', h)));
    const thead = document.createElement('thead'); thead.append(hr);
    const tb = document.createElement('tbody');
    entries.forEach(({ b, item, y }) => {
      const u = item.u, tr = document.createElement('tr');
      tr.append(el('td', '', b.name), el('td', 'ctr', roomLabel(item.room)), el('td', '', u.현업종 || '—'), el('td', 'num', eok(price(u))),
        el('td', 'num', eok(deposit(u)) + ' / ' + (rent(u) === null ? '—' : rent(u).toLocaleString('ko-KR') + '만')),
        el('td', 'num y', y ? y.v.toFixed(1) + '%' : '—'), el('td', 'ctr', u.공실여부 || '—'));
      tb.append(tr);
    });
    t.append(thead, tb); sec.append(t); area.append(sec);

    area.append(el('div', 'p-note', '※ 금액은 만원 단위 입력값 기준이며, 수익률은 월 임대료×12 ÷ (가격 − 보증금)으로 계산한 단순수익률(대출·세금·부가세 제외)로 참고용입니다. 가격·임대 조건·공실 여부는 변동될 수 있으니 계약 전 반드시 현장과 서류로 확인하시기 바랍니다.'));
    area.append(el('div', 'p-foot', officeCompanyName + phone));
  }

  function printSheet() {
    const chosen = shown.filter(e => selected.has(selKey(e)));
    const target = chosen.length ? chosen : shown;
    if (!target.length) { toast('인쇄할 추천매물이 없습니다.'); return; }
    buildPrint(target);
    window.print();
  }

  // ===== 호실 상세 패널 (줄을 누르면 오른쪽에 열린다) =====
  let detailRef = null;
  function closeDetail() {
    detailRef = null;
    $('detail').classList.remove('open'); $('detailBack').classList.remove('open');
    $('detail').setAttribute('aria-hidden', 'true');
  }

  function openDetail(b, room) {
    const item = b.units.find(i => i.room === room);
    if (!item) { closeDetail(); return; }
    detailRef = { b, room };
    const u = item.u, y = yieldOf(u), ov = memoFields(b.memo);
    const entry = { b, item, y };
    const box = $('detail');
    box.replaceChildren();

    const top = el('div', 'dt-top');
    const ttl = el('div', 'dt-title');
    ttl.append(el('div', 'dt-b', b.name), el('div', 'dt-r', roomLabel(item.room)));
    if (isFlagOn(u.추천매물)) ttl.append(el('span', 'flag rec', '⭐추천'));
    if (isFlagOn(u.수익성매물)) ttl.append(el('span', 'flag profit', '💰수익성'));
    const x = el('button', 'mini', '✕ 닫기'); x.type = 'button'; x.addEventListener('click', closeDetail);
    top.append(ttl, x);
    box.append(top);

    const kv = (k, v) => { const r = el('div', 'dt-kv'); r.append(el('span', 'dt-k', k), el('span', 'dt-v', v)); return r; };
    const p0 = price(u), d0 = deposit(u), r0 = rent(u);
    const kpi = el('div', 'dt-kpi');
    [['매매가', eok(p0)], ['보증금', eok(d0)], ['월세', r0 === null ? '—' : r0.toLocaleString('ko-KR') + '만'], ['수익률', y ? y.v.toFixed(1) + '%' + (y.calc ? ' (계산)' : '') : '—']].forEach(([k, v]) => {
      const c = el('div', 'dt-kc'); c.append(el('div', 'dt-kl', k), el('div', 'dt-kn', v)); kpi.append(c);
    });
    box.append(kpi);

    const basic = el('div', 'dt-sec');
    basic.append(el('h3', '', '호실 정보'), kv('업종', u.현업종 || '—'), kv('상태', u.공실여부 || '공실'));
    const sale = areaText(u, '분양'), excl = areaText(u, '전용');
    if (sale) basic.append(kv('분양면적', sale));
    if (excl) basic.append(kv('전용면적', excl));
    if (u.평당가 && Number(u.평당가)) basic.append(kv('평당가', eok(manwon(u.평당가, 1000000))));
    box.append(basic);

    // 대출 시뮬레이션 (대출 O / X)
    const sim = el('div', 'dt-sec');
    sim.append(el('h3', '', '대출 시뮬레이션'));
    if (!p0 || r0 === null) {
      sim.append(el('div', 'recmemo', '매매가와 월세가 입력되어야 계산할 수 있습니다.'));
    } else {
      const pref = readLoanPref();
      const inRow = el('div', 'dt-inrow');
      const ri = document.createElement('input'), ei = document.createElement('input');
      [ri, ei].forEach(i => { i.type = 'number'; i.step = 'any'; });
      ri.value = pref.ratio; ei.value = pref.rate;
      const l1 = el('label', '', '대출비율 '); l1.append(ri, ' %');
      const l2 = el('label', '', '이율 '); l2.append(ei, ' %');
      inRow.append(l1, l2); sim.append(inRow);
      const tbl = document.createElement('table'); tbl.className = 'dt-sim';
      sim.append(tbl);
      const calc = () => {
        const ratio = Math.min(Math.max(parseFloat(ri.value) || 0, 0), 100), rate = Math.min(Math.max(parseFloat(ei.value) || 0, 0), 30);
        const loanAmt = Math.round(p0 * ratio / 100), yearInt = loanAmt * rate / 100;
        const eqO = Math.round(p0 - loanAmt - (d0 || 0)), eqX = p0 - (d0 || 0);
        const man = n => Math.round(n).toLocaleString('ko-KR') + '만';
        const yo = eqO > 0 ? ((r0 * 12 - yearInt) / eqO * 100).toFixed(2) + '%' : '—';
        const yx = eqX > 0 ? (r0 * 12 / eqX * 100).toFixed(2) + '%' : '—';
        const rows = [['', '대출 O', '대출 X'], ['대출금', eok(loanAmt), '-'], ['연 이자', man(yearInt), '-'],
          ['실투자금', eqO > 0 ? eok(eqO) : '—', eqX > 0 ? eok(eqX) : '—'], ['월 수익', man(r0 - yearInt / 12), man(r0)],
          ['연 수익', man(r0 * 12 - yearInt), man(r0 * 12)], ['수익률', yo, yx]];
        tbl.replaceChildren();
        rows.forEach((r, i) => {
          const tr = document.createElement('tr');
          r.forEach((c, j) => tr.append(el(i === 0 || j === 0 ? 'th' : 'td', i === rows.length - 1 && j ? 'strong' : '', c)));
          tbl.append(tr);
        });
      };
      ri.addEventListener('input', calc); ei.addEventListener('input', calc); calc();
    }
    box.append(sim);

    const ovRows = ['주소', '사용승인일', '구조', '주차대수', '연면적'].filter(k => ov[k] && (k === '주소' || k === '구조' || /\d/.test(ov[k])));
    if (ovRows.length) {
      const o = el('div', 'dt-sec'); o.append(el('h3', '', '건물 개요'));
      ovRows.forEach(k => o.append(kv(k, ov[k])));
      box.append(o);
    }

    // 내부용 정보: 눌러야 펼쳐진다 (손님이 화면을 같이 볼 때 노출되지 않도록)
    const inner = el('div', 'dt-sec');
    const tg = el('button', 'mini', '🔒 내부용 보기 (소유주·연락처·비고)'); tg.type = 'button';
    const innerBody = el('div', 'dt-inner'); innerBody.style.display = 'none';
    [['소유주', u.소유주], ['연락처', u.연락처], ['비고', u.비고], ['추가메모', u.추가메모]].forEach(([k, v]) => innerBody.append(kv(k, v ? String(v) : '—')));
    tg.addEventListener('click', () => {
      const open = innerBody.style.display === 'none';
      innerBody.style.display = open ? '' : 'none';
      tg.textContent = open ? '🔓 내부용 숨기기' : '🔒 내부용 보기 (소유주·연락처·비고)';
    });
    inner.append(tg, innerBody); box.append(inner);

    const act = el('div', 'dt-act');
    const rb = el('button', 'mini' + (isFlagOn(u.추천매물) ? ' on' : ''), isFlagOn(u.추천매물) ? '⭐ 해제' : '⭐ 추천'); rb.type = 'button';
    rb.addEventListener('click', async () => { await toggle(b, item, '추천매물', rb); if (detailRef) openDetail(b, room); });
    const pb = el('button', 'mini' + (isFlagOn(u.수익성매물) ? ' pon' : ''), isFlagOn(u.수익성매물) ? '💰 해제' : '💰 수익성'); pb.type = 'button';
    pb.addEventListener('click', async () => { await toggle(b, item, '수익성매물', pb); if (detailRef) openDetail(b, room); });
    const ob = el('button', 'mini', '📄 안내서 인쇄'); ob.type = 'button';
    ob.addEventListener('click', () => printOnePages([entry]));
    act.append(rb, pb, ob);
    if (b.resource) {
      const link = el('a', 'mini', '건물 상세에서 수정');
      link.href = HitopResourceRooms.detailUrl('building-detail.html', b.id, b.scope) + '#unitStatus';
      act.append(link);
    }
    box.append(act);

    box.classList.add('open'); $('detailBack').classList.add('open');
    box.setAttribute('aria-hidden', 'false'); box.scrollTop = 0;
  }

  // ===== 호실별 A4 한 장 안내서 (소유주·연락처·비고·메모는 넣지 않는다) =====
  function memoFields(raw) {
    const base = String(raw || ''), cut = base.indexOf('---추가메모---');
    const out = {};
    (cut === -1 ? base : base.slice(0, cut)).split('\n').forEach(line => {
      const c = line.indexOf(':');
      if (c > 0) out[line.slice(0, c).trim()] = line.slice(c + 1).trim();
    });
    return out;
  }

  function areaText(u, kind) {
    const pyeong = u[kind + '_평'], m2 = u[kind + '_m2'];
    const parts = [];
    if (pyeong !== undefined && pyeong !== null && String(pyeong).trim() !== '') parts.push(pyeong + '평');
    if (m2 !== undefined && m2 !== null && String(m2).trim() !== '') parts.push(m2 + '㎡');
    return parts.join(' / ');
  }

  function logoSvg(gold, navy, size) {
    return `<svg width="${size}" height="${size}" viewBox="0 0 64 64" fill="none"><circle cx="32" cy="32" r="29" stroke="${gold}" stroke-width="1.6"/><path d="M13 24 L32 11 L51 24" stroke="${gold}" stroke-width="3.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M21 46 V25 M43 46 V25 M21 35.5 H43" stroke="${navy}" stroke-width="4.2" stroke-linecap="round"/></svg>`;
  }

  // 하이탑 견적서와 같은 디자인(네이비 배너 + 골드 포인트 + 사무소 정보 바닥글)의 호실별 A4 안내서
  function buildOnePages(entries, loan) {
    const area = $('printArea');
    area.replaceChildren();
    const now = new Date();
    const dateStr = now.getFullYear() + '. ' + String(now.getMonth() + 1).padStart(2, '0') + '. ' + String(now.getDate()).padStart(2, '0') + '.';
    const ktop = OfficeConfig.id === 'ktop';
    entries.forEach(({ b, item, y }) => {
      const u = item.u, ov = memoFields(b.memo);
      const p0 = price(u), d0 = deposit(u), r0 = rent(u);
      const fl = floorNo(item.room);
      const sale = areaText(u, '분양'), excl = areaText(u, '전용');
      const esc = t => String(t == null ? '' : t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
      const row = (k, v, cls) => `<tr class="${cls || ''}"><td class="lbl">${esc(k)}</td><td class="val" colspan="${loan ? 2 : 1}">${esc(v)}</td></tr>`;
      const row2 = (k, vo, vx, cls) => `<tr class="${cls || ''}"><td class="lbl">${esc(k)}</td><td class="val">${esc(vo)}</td><td class="val">${esc(vx)}</td></tr>`;
      const sec = t => `<tr class="sec"><td colspan="${loan ? 3 : 2}">${t}</td></tr>`;
      const man = n => Math.round(n).toLocaleString('ko-KR') + '만원';
      const rows = [];
      rows.push(sec('▪ &nbsp; 매 &nbsp; 매 &nbsp; 조 &nbsp; 건'));
      rows.push(row('매매가', eok(p0), 'emph'));
      const canCalc = p0 && r0 !== null;
      let loanAmt = 0, yearInt = 0, equityO = 0, equityX = 0;
      if (loan && canCalc) {
        loanAmt = Math.round(p0 * loan.ratio / 100); yearInt = loanAmt * loan.rate / 100;
        equityO = Math.round(p0 - loanAmt - (d0 || 0)); equityX = p0 - (d0 || 0);
        rows.push(row2('대출금액', eok(loanAmt), '-'));
        rows.push(row2('대출비율', loan.ratio + ' %', '-'));
        rows.push(row2('이율', loan.rate + ' %', '-'));
        rows.push(row2('이자 (연)', man(yearInt), '-'));
        rows.push(row2('월이자', man(yearInt / 12), '-'));
      }
      rows.push(row('보증금', eok(d0)));
      rows.push(row('월 임대료', r0 === null ? '—' : r0.toLocaleString('ko-KR') + '만원'));
      if (u.평당가 && Number(u.평당가)) rows.push(row('평당가', eok(manwon(u.평당가, 1000000))));
      if (canCalc) {
        rows.push(sec('▪ &nbsp; 수 &nbsp; 익 &nbsp; 분 &nbsp; 석'));
        if (loan) {
          const yo = equityO > 0 ? ((r0 * 12 - yearInt) / equityO * 100).toFixed(2) + '%' : '—';
          const yx = equityX > 0 ? (r0 * 12 / equityX * 100).toFixed(2) + '%' : '—';
          rows.push(row2('실투자금', equityO > 0 ? eok(equityO) : '—', equityX > 0 ? eok(equityX) : '—'));
          rows.push(row2('월수익금', man(r0 - yearInt / 12), man(r0)));
          rows.push(row2('연수익금', man(r0 * 12 - yearInt), man(r0 * 12)));
          rows.push(`<tr class="yld"><td class="lbl">수 익 률</td><td class="val">${yo}</td><td class="val">${yx}</td></tr>`);
        } else {
          rows.push(row('실투자금 (매매가 − 보증금)', eok(Math.max(p0 - (d0 || 0), 0))));
          rows.push(row('월 임대수익', r0.toLocaleString('ko-KR') + '만원'));
          rows.push(row('연 임대수익 (월세×12)', eok(r0 * 12)));
          rows.push(`<tr class="yld"><td class="lbl">수 익 률</td><td class="val">${y ? y.v.toFixed(2) + '%' : '—'}</td></tr>`);
        }
      }
      const info = [];
      ['주소', '사용승인일', '구조', '주차대수', '연면적'].forEach(k => {
        const v = ov[k];
        if (v && (k === '주소' || k === '구조' || /\d/.test(v))) info.push([k, v]);
      });
      if (info.length) {
        rows.push(sec('▪ &nbsp; 건 &nbsp; 물 &nbsp; 개 &nbsp; 요'));
        info.forEach(([k, v]) => rows.push(row(k, v)));
      }
      const phone = ktop ? '' : '031-949-8969';
      const page = el('section', 'p-page');
      page.innerHTML = `
        <div class="est-banner">
          <div class="est-banner-top">
            <div class="est-brand">${logoSvg('#e6cd8e', '#c9a24a', 30)}<div><span class="kr">${esc(officeCompanyName)}</span><span class="en">Haitop Realty</span></div></div>
            <div class="est-date">작성일자 <b>${dateStr}</b></div>
          </div>
          <h2>매 &nbsp; 물 &nbsp; 안 &nbsp; 내 &nbsp; 서</h2>
          <div class="sub">P R O P E R T Y &nbsp; G U I D E</div>
        </div>
        <div class="info-card">
          <div class="info-loc"><div class="i-label">위치 (빌딩명)</div><div class="i-value">${esc(b.name)}</div></div>
          <div class="info-grid">
            <div><div class="i-label">호&nbsp;&nbsp;실</div><div class="i-value">${esc(roomLabel(item.room))}</div></div>
            <div><div class="i-label">업&nbsp;&nbsp;종</div><div class="i-value">${esc(u.현업종 || '-')}</div></div>
            <div><div class="i-label">층&nbsp;&nbsp;수</div><div class="i-value">${fl ? fl + ' 층' : '-'}</div></div>
            <div><div class="i-label">분양면적</div><div class="i-value">${esc(sale || '-')}</div></div>
            <div><div class="i-label">전용면적</div><div class="i-value">${esc(excl || '-')}</div></div>
          </div>
        </div>
        <table class="est-tbl"><thead><tr>${loan ? '<th>항목</th><th>대출 (O)</th><th>대출 (X)</th>' : '<th>항목</th><th>내용</th>'}</tr></thead><tbody>${rows.join('')}</tbody></table>
        <div class="est-note">${loan && canCalc ? '※ <strong>취득세 (4.6%)</strong> : ' + eok(Math.round(p0 * 0.046)) + ' — 부가세 발생 여부 및 건물/토지 비율에 따라 변동될 수 있습니다.<br>' : ''}※ 금액은 만원 단위 입력값 기준이며, 수익률은 연수익금 ÷ 실투자금으로 계산한 단순수익률(취득세·세금·부가세 제외)로 참고용입니다. 가격·임대 조건·공실 여부(${esc(u.공실여부 || '-')})는 변동될 수 있으니 계약 전 반드시 현장과 서류로 확인하시기 바랍니다.</div>
        <div class="est-foot">
          <div class="ef-left">${logoSvg('#c9a24a', '#12244a', 26)}<div>
            <div class="fc">${ktop ? esc(officeCompanyName) : '하이탑부동산공인중개사사무소'}</div>
            ${ktop ? '' : '<div class="fp">대표: 주현희 &nbsp;|&nbsp; 경기도 파주시 책향기로 830, 1층<br>사업자등록번호 305-48-62183 &nbsp;|&nbsp; 중개사무소 등록번호 41480-2016-00026<br>newpajucity@naver.com</div>'}
          </div></div>
          ${ktop ? '' : '<div class="ef-right"><div class="ef-tel"><span>TEL</span>031-949-8969</div><div class="ef-fax">FAX 031-944-1108</div></div>'}
        </div>
        <div class="est-base"></div>`;
      area.append(page);
    });
  }

  const LOAN_KEY = 'hitop_ru_loan';
  function readLoanPref() {
    try { const v = JSON.parse(localStorage.getItem(LOAN_KEY) || 'null'); if (v) return v; } catch (e) { /* 저장값 없음 */ }
    return { on: true, ratio: 50, rate: 4.5 };
  }
  function printOnePages(entries) {
    if (!entries.length) { toast('인쇄할 호실을 체크해 주세요.'); return; }
    const pref = readLoanPref();
    $('loanOn').checked = !!pref.on; $('loanRatio').value = pref.ratio; $('loanRate').value = pref.rate;
    $('loanFields').style.opacity = pref.on ? '1' : '.4';
    $('loanTitle').textContent = entries.length === 1 ? `${entries[0].b.name} ${roomLabel(entries[0].item.room)} 안내서 인쇄` : `선택한 ${entries.length}개 호실 안내서 인쇄`;
    $('loanModal').style.display = 'flex';
    pendingSheet = entries;
  }
  let pendingSheet = null;
  function confirmSheet() {
    const on = $('loanOn').checked;
    const ratio = Math.min(Math.max(parseFloat($('loanRatio').value) || 0, 0), 100);
    const rate = Math.min(Math.max(parseFloat($('loanRate').value) || 0, 0), 30);
    try { localStorage.setItem(LOAN_KEY, JSON.stringify({ on, ratio, rate })); } catch (e) { /* 저장 불가 */ }
    $('loanModal').style.display = 'none';
    if (!pendingSheet) return;
    buildOnePages(pendingSheet, on ? { ratio, rate } : null);
    pendingSheet = null;
    window.print();
  }

  function printChosenOnePages() {
    printOnePages(shown.filter(e => selected.has(selKey(e))));
  }

  function emptyBox(text) {
    const box = el('div', 'empty');
    if (text) { box.textContent = text; return box; }
    const a = el('div'); a.append('아직 ⭐ 추천으로 표시한 호실이 없습니다.');
    const b = el('div'); b.append('위의 ', el('b', '', '후보 보기'), '에서 수익률 높은 호실을 골라 ⭐ 추천을 누르거나,');
    const c = el('div'); c.append('건물 상세의 호실 수정창에서 ', el('b', '', '⭐ 추천매물'), '을 체크하세요.');
    box.append(a, b, c);
    return box;
  }

  function setMode(next) {
    mode = next;
    $('tabRec').classList.toggle('active', next === 'rec');
    $('tabCand').classList.toggle('active', next === 'cand');
    $('tabClosed').classList.toggle('active', next === 'closed');
    render();
  }

  async function init() {
    $('tabRec').addEventListener('click', () => setMode('rec'));
    $('tabCand').addEventListener('click', () => setMode('cand'));
    $('tabClosed').addEventListener('click', () => setMode('closed'));
    $('printBtn').addEventListener('click', printSheet);
    $('sheetBtn').addEventListener('click', printChosenOnePages);
    $('detailBack').addEventListener('click', closeDetail);
    document.addEventListener('keydown', ev => { if (ev.key === 'Escape' && detailRef) closeDetail(); });
    $('loanGo').addEventListener('click', confirmSheet);
    $('loanCancel').addEventListener('click', () => { $('loanModal').style.display = 'none'; pendingSheet = null; });
    $('loanOn').addEventListener('change', () => { $('loanFields').style.opacity = $('loanOn').checked ? '1' : '.4'; });
    ['q', 'sort'].forEach(id => $(id).addEventListener(id === 'q' ? 'input' : 'change', render));
    try {
      if (!await load()) return;
      if (location.hash === '#closed') { setMode('closed'); return; }
      render();
    } catch (e) {
      $('summary').textContent = '불러오지 못했습니다: ' + e.message;
    }
  }
  init();
})();
