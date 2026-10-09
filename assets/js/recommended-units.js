(function () {
  'use strict';

  const $ = id => document.getElementById(id);
  const CAND_MIN = 3, CAND_MAX = 20, CAND_LIMIT = 50;   // 후보 보기: 수익률 3~20%, 상위 50개 (입력 오류로 튀는 값 제외)

  let buildings = [];   // { id, name, record, units: [{u, room}] }
  let mode = 'rec';     // 'rec' | 'cand'
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
  function price(u) { return num(u.현_매매가격 ?? u.분양금액); }
  function deposit(u) { return num(u.현_보증금 ?? u.보증금); }
  function rent(u) { return num(u.현_월세 ?? u.월차임); }
  function roomLabel(r) { r = String(r || ''); return r.endsWith('호') ? r : r + '호'; }
  function yieldOf(u) {                  // 저장된 수익률이 있으면 그 값, 없으면 단순수익률 자동 계산
    const saved = parseFloat(String(u.수익률 ?? '').replace('%', ''));
    if (Number.isFinite(saved) && saved > 0) return { v: saved, calc: false };
    const p = price(u), m = rent(u), d = deposit(u) || 0;
    if (!p || !m) return null;
    const base = p - d;
    if (base <= 0) return null;
    return { v: m * 12 / base * 100, calc: true };
  }
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

  // ----- 데이터 -----
  async function load() {
    const { data, error } = await hitopAuthClient.auth.getSession();
    if (error || !data.session) { hitopRedirectToLogin(); return false; }
    hitopApplyAuthHeader(data.session);
    const [resources, recordsRes] = await Promise.all([
      getDriveResources(),
      fetchWithTimeout(SUPABASE_URL + '/rest/v1/buildings?select=local_id,name,units', { headers }),
      getDriveCategories()
    ]);
    if (!recordsRes.ok) throw new Error('건물 호실 조회 실패');
    const records = await recordsRes.json();
    const shops = HitopResourceRooms.visible(resources, 'commercial');
    buildings = shops.map(r => {
      const rec = records.find(x => x.local_id === r.id) || records.find(x => x.name === r.name) || null;
      const units = rec && Array.isArray(rec.units) ? rec.units : [];
      return { id: r.id, name: r.name, record: rec,
        units: units.filter(u => String(u.호수 || '').trim()).map(u => ({ u, room: String(u.호수).trim() })) };
    }).filter(b => b.record);
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

  // ----- 화면 -----
  function collect() {
    const q = $('q').value.trim().toLowerCase();
    const onlyProfit = $('onlyProfit').checked;
    const out = [];
    buildings.forEach(b => {
      b.units.forEach(item => {
        const u = item.u;
        const rec = isFlagOn(u.추천매물), profit = isFlagOn(u.수익성매물);
        if (mode === 'rec' && !rec) return;
        if (mode === 'cand' && rec) return;
        if (mode === 'rec' && onlyProfit && !profit) return;
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
    return (a, c) => ((c.y && c.y.v) || -1) - ((a.y && a.y.v) || -1);
  }

  function rowFor(entry) {
    const { b, item, y } = entry, u = item.u;
    const tr = document.createElement('tr');
    if (mode === 'rec') {
      const sc = el('td', 'sel'), cb = document.createElement('input');
      cb.type = 'checkbox'; cb.checked = selected.has(selKey(entry)); cb.setAttribute('aria-label', roomLabel(item.room) + ' 인쇄 선택');
      cb.addEventListener('change', () => { if (cb.checked) selected.add(selKey(entry)); else selected.delete(selKey(entry)); updatePrintBtn(); syncHeadChecks(); });
      sc.append(cb); tr.append(sc);
    }
    const room = el('td'); room.append(el('strong', '', roomLabel(item.room)));
    if (mode === 'cand') room.append(el('span', '', ' · ' + b.name));
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
    const link = el('a', 'mini', '호실보기');
    link.href = HitopResourceRooms.detailUrl('building-detail.html', b.id, 'commercial') + '#unitStatus';
    act.append(recBtn, pBtn, link);
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
    [['호실'], ['업종'], ['가격', 1], ['보증금 / 월세', 1], ['수익률', 1], ['상태'], ['']].forEach(([label, right]) => head.append(el('th', right ? 'num' : '', label)));
    const thead = document.createElement('thead'); thead.append(head);
    const tbody = document.createElement('tbody');
    entries.forEach(e => tbody.append(rowFor(e)));
    t.append(thead, tbody); wrap.append(t);
    return wrap;
  }

  function render() {
    const list = $('list');
    list.replaceChildren();
    $('sort').disabled = mode === 'cand';
    $('profitLabel').style.display = mode === 'rec' ? '' : 'none';
    const entries = collect().sort(sorter());
    shown = mode === 'rec' ? entries : [];
    updatePrintBtn();

    if (mode === 'cand') {
      const shown = entries.slice(0, CAND_LIMIT);
      $('summary').textContent = `수익률 ${CAND_MIN}~${CAND_MAX}% 후보 ${entries.length}개 중 상위 ${shown.length}개 · 마음에 드는 호실은 ⭐ 추천을 눌러 추천매물로 옮기세요 (월세·가격이 입력된 호실 기준, 수익률 계산은 월세×12 ÷ (가격−보증금))`;
      if (!shown.length) { list.append(emptyBox('조건에 맞는 후보가 없습니다.')); return; }
      const card = el('section', 'bcard');
      const head = el('div', 'bhead'); head.append(el('h2', '', '수익률 높은 후보'), el('span', '', shown.length + '개'));
      card.append(head, table(shown));
      list.append(card);
      return;
    }

    const groups = new Map();
    entries.forEach(e => { if (!groups.has(e.b.id)) groups.set(e.b.id, { b: e.b, items: [] }); groups.get(e.b.id).items.push(e); });
    const profitCount = entries.filter(e => isFlagOn(e.item.u.수익성매물)).length;
    $('summary').textContent = entries.length
      ? `추천매물 ${entries.length}개 · 건물 ${groups.size}곳 · 💰수익성 ${profitCount}개`
      : '표시할 추천매물이 없습니다.';
    if (!entries.length) {
      const any = buildings.some(b => b.units.some(i => isFlagOn(i.u.추천매물)));
      list.append(emptyBox(any ? '조건에 맞는 추천매물이 없습니다.' : null));
      return;
    }
    [...groups.values()].forEach(g => {
      const card = el('section', 'bcard');
      const head = el('div', 'bhead'); head.append(el('h2', '', g.b.name), el('span', '', g.items.length + '개'));
      card.append(head, table(g.items));
      list.append(card);
    });
    syncHeadChecks();
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

    const groups = new Map();
    entries.forEach(e => { if (!groups.has(e.b.id)) groups.set(e.b.id, { b: e.b, items: [] }); groups.get(e.b.id).items.push(e); });
    groups.forEach(g => {
      const sec = el('section', 'p-bld');
      sec.append(el('h2', '', g.b.name));
      const t = document.createElement('table'), hr = document.createElement('tr');
      ['호실', '업종', '가격', '보증금 / 월세', '수익률', '상태'].forEach(h => hr.append(el('th', '', h)));
      const thead = document.createElement('thead'); thead.append(hr);
      const tb = document.createElement('tbody');
      g.items.forEach(({ item, y }) => {
        const u = item.u, tr = document.createElement('tr');
        tr.append(el('td', 'ctr', roomLabel(item.room)), el('td', '', u.현업종 || '—'), el('td', 'num', eok(price(u))),
          el('td', 'num', eok(deposit(u)) + ' / ' + (rent(u) === null ? '—' : rent(u).toLocaleString('ko-KR') + '만')),
          el('td', 'num y', y ? y.v.toFixed(1) + '%' : '—'), el('td', 'ctr', u.공실여부 || '—'));
        tb.append(tr);
      });
      t.append(thead, tb); sec.append(t); area.append(sec);
    });

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
    render();
  }

  async function init() {
    $('tabRec').addEventListener('click', () => setMode('rec'));
    $('tabCand').addEventListener('click', () => setMode('cand'));
    $('printBtn').addEventListener('click', printSheet);
    ['q', 'onlyProfit', 'sort'].forEach(id => $(id).addEventListener(id === 'q' ? 'input' : 'change', render));
    try {
      if (!await load()) return;
      render();
    } catch (e) {
      $('summary').textContent = '불러오지 못했습니다: ' + e.message;
    }
  }
  init();
})();
