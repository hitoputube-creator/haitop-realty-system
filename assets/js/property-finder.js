// 매물찾기: 손님 조건(종류·층·평수·위치·거래)으로 등록 매물과 자료실 호실을 한 번에 찾는다.
// 읽기 전용 화면이다. 저장·수정·삭제 기능은 없다.
(function () {
'use strict';
const $ = id => document.getElementById(id);
const text = v => v == null ? '' : String(v).trim();
const compact = v => text(v).normalize('NFKC').toLocaleLowerCase('ko-KR').replace(/\s+/g, '');
const num = v => { if (v == null || v === '') return null; const s = String(v).replace(/,/g, ''); if (!/\d/.test(s)) return null; const n = Number(s.replace(/[^\d.\-]/g, '')); return isFinite(n) ? n : null; };
const PY = 3.305785;
// 메인 화면에서는 검색 바만 보여 주고, 검색하면 결과 화면을 새 창으로 연다.
const BAR_ONLY = !!window.PF_BAR_ONLY;
const DEFAULT_CATS = ['운정역 상가', '운정3지구 상가(NT)', '초롱꽃마을 상가(F5,F6)', '해오름마을 근생상가(다율동)', '아파트 단지내상가', '별하람마을 근생상가', '오피스텔상가', '해오름마을 상가(F3, F7)'];
const on = (id, ev, fn) => { const n = document.getElementById(id); if (n) n.addEventListener(ev, fn); };
function barHtml() {
  return `<section class="pf-searchbar" aria-label="빠른 검색">
        <form class="pf-quick pf-quick-naver" id="pfQuickForm"><svg class="pf-mag" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M15.5 15.5 21 21" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg><input id="pfQuick" type="text" autocomplete="off" placeholder="말로 입력해서 검색  예) 상가 1층 20~40평 운정역 월세" aria-label="한 줄로 조건 입력"><button class="pf-btn main" type="submit">검색</button></form>
      </section>

      <section class="pf-filterbar" aria-label="조건 선택">
        <div class="pf-pills"><div class="pf-pillgroup">
          <div class="pf-pillwrap"><button class="pf-pill" type="button" id="pillSrc" data-label="검색 대상" aria-expanded="false" aria-controls="pnSrc"><span class="pt">검색 대상</span><span class="caret" aria-hidden="true">▾</span></button><div class="pf-panel" id="pnSrc" hidden><div class="pf-panel-tip">어디에서 찾을지 고르세요. 둘 다 고르거나 안 고르면 함께 찾아요</div><div class="pf-list" id="pfSrc" role="group" aria-label="검색 대상"><button type="button" data-v="__all" aria-pressed="false">매물리스트 + 자료실</button><button type="button" data-v="매물" aria-pressed="false">매물리스트만</button><button type="button" data-v="자료" aria-pressed="false">자료실만</button></div></div></div>
          <div class="pf-pillwrap"><button class="pf-pill" type="button" id="pillGroup" data-label="종류" aria-expanded="false" aria-controls="pnGroup"><span class="pt">종류</span><span class="caret" aria-hidden="true">▾</span></button><div class="pf-panel" id="pnGroup" hidden><div class="pf-list" id="pfGroup" role="group" aria-label="종류"><button type="button" data-v="" aria-pressed="false">전체</button><button type="button" data-v="상가·사무실" aria-pressed="false">상가·사무실</button><button type="button" data-v="주거" aria-pressed="false">주거</button><button type="button" data-v="토지" aria-pressed="false">토지</button><button type="button" data-v="공장·창고" aria-pressed="false">공장·창고</button><button type="button" data-v="기타" aria-pressed="false">기타</button></div></div></div>
          <div class="pf-pillwrap"><button class="pf-pill" type="button" id="pillCat" data-label="상가 구분" aria-expanded="false" aria-controls="pnCat"><span class="pt">상가 구분</span><span class="caret" aria-hidden="true">▾</span></button><div class="pf-panel" id="pnCat" hidden><div class="pf-panel-tip">여러 개 선택할 수 있어요</div><div class="pf-list" id="pfCat" role="group" aria-label="상가 구분"></div></div></div>
          <div class="pf-pillwrap"><button class="pf-pill" type="button" id="pillFloor" data-label="층" aria-expanded="false" aria-controls="pnFloor"><span class="pt">층</span><span class="caret" aria-hidden="true">▾</span></button><div class="pf-panel" id="pnFloor" hidden><div class="pf-panel-tip">여러 개 선택할 수 있어요</div><div class="pf-list" id="pfFloor" role="group" aria-label="층"><button type="button" data-v="__all" aria-pressed="false">전체</button><button type="button" data-v="-1" aria-pressed="false">지하</button><button type="button" data-v="1" aria-pressed="false">1층</button><button type="button" data-v="2" aria-pressed="false">2층</button><button type="button" data-v="3" aria-pressed="false">3층</button><button type="button" data-v="4" aria-pressed="false">4층</button><button type="button" data-v="5" aria-pressed="false">5층</button><button type="button" data-v="6" aria-pressed="false">6층 이상</button></div></div></div>
          <div class="pf-pillwrap"><button class="pf-pill" type="button" id="pillDeal" data-label="거래" aria-expanded="false" aria-controls="pnDeal"><span class="pt">거래</span><span class="caret" aria-hidden="true">▾</span></button><div class="pf-panel" id="pnDeal" hidden><div class="pf-panel-tip">여러 개 선택할 수 있어요</div><div class="pf-list" id="pfDeal" role="group" aria-label="거래"><button type="button" data-v="__all" aria-pressed="false">전체</button><button type="button" data-v="월세" aria-pressed="false">월세</button><button type="button" data-v="매매" aria-pressed="false">매매</button><button type="button" data-v="전세" aria-pressed="false">전세</button><button type="button" data-v="분양" aria-pressed="false">분양</button></div></div></div>
          <div class="pf-pillwrap"><button class="pf-pill" type="button" id="pillArea" data-label="평수" aria-expanded="false" aria-controls="pnArea"><span class="pt">평수</span><span class="caret" aria-hidden="true">▾</span></button><div class="pf-panel" id="pnArea" hidden><div class="pf-list" id="pfAreaQuick" role="group" aria-label="평수"><button type="button" data-v="-" aria-pressed="false">전체</button><button type="button" data-v="-10" aria-pressed="false">10평 이하</button><button type="button" data-v="10-20" aria-pressed="false">10~20평</button><button type="button" data-v="20-40" aria-pressed="false">20~40평</button><button type="button" data-v="40-60" aria-pressed="false">40~60평</button><button type="button" data-v="60-" aria-pressed="false">60평 이상</button></div>
   <div class="pf-range"><span>직접</span><input id="pfMin" type="number" min="0" step="0.1" placeholder="최소" aria-label="최소 평수"><i>~</i><input id="pfMax" type="number" min="0" step="0.1" placeholder="최대" aria-label="최대 평수"><em>평</em></div>
   <select id="pfBasis" aria-label="면적 기준"><option value="ex">전용 기준</option><option value="sup">분양(계약) 기준</option><option value="any">전용·분양 둘 다</option></select></div></div>
          <div class="pf-pillwrap"><button class="pf-pill" type="button" id="pillPrice" data-label="금액" aria-expanded="false" aria-controls="pnPrice"><span class="pt">금액</span><span class="caret" aria-hidden="true">▾</span></button><div class="pf-panel" id="pnPrice" hidden><div class="pf-panel-tip">비워 두면 제한 없음 (최저 ~ 최고)</div>
   <div class="pf-range"><span>보증금</span><input id="pfDepMin" type="number" min="0" placeholder="최저"><i>~</i><input id="pfDepMax" type="number" min="0" placeholder="최고"><em>만원</em></div>
   <div class="pf-range"><span>월세</span><input id="pfRentMin" type="number" min="0" placeholder="최저"><i>~</i><input id="pfRentMax" type="number" min="0" placeholder="최고"><em>만원</em></div>
   <div class="pf-range"><span>매매가</span><input id="pfSaleMin" type="number" min="0" step="0.1" placeholder="최저"><i>~</i><input id="pfSaleMax" type="number" min="0" step="0.1" placeholder="최고"><em>억</em></div></div></div>
          <div class="pf-pillwrap"><button class="pf-pill" type="button" id="pillMore" data-label="상세" aria-expanded="false" aria-controls="pnMore"><span class="pt">상세</span><span class="caret" aria-hidden="true">▾</span></button><div class="pf-panel" id="pnMore" hidden><input id="pfKw" type="text" placeholder="건물·호수·메모 검색" aria-label="건물 호수 메모 검색">
   <label class="pf-row-opt">보는 범위 <select id="pfStatus"><option value="open">지금 소개 가능 (공실·진행중)</option><option value="withRented">임차중·보류도 포함</option><option value="all">거래완료까지 전체</option></select></label>
   <label class="pf-row-opt"><input id="pfUnknown" type="checkbox"> 층·평수·가격이 비어 있는 것도 보기</label></div></div>
          </div>
          <div class="pf-actionbox"><button class="pf-pill reset" type="button" id="pfReset">↺ 초기화</button><button class="pf-btn main big" id="pfGo" type="button">조건으로 검색</button></div>
        </div>
        <p class="pf-dirty" id="pfDirty" hidden>조건이 바뀌었어요. <b>조건으로 검색</b>을 눌러 주세요.</p>
      </section>

      `;
}
const man = v => { const n = num(v); if (n == null || n <= 0) return null; return n >= 1e6 ? Math.round(n / 1e4) : n; }; // 원 단위면 만원으로 바꾼다
const round1 = n => Math.round(n * 10) / 10;

// ---------- 글자로 적힌 가격 읽기 ("월세_3천/250", "매매 4억 5,000만원") ----------
function koMoney(s) {
  s = text(s).replace(/[,\s원]/g, '').replace(/만원?$/, '만');
  if (!s) return null;
  let total = 0, found = false, m;
  if ((m = s.match(/([\d.]+)억/))) { total += parseFloat(m[1]) * 10000; found = true; s = s.replace(m[0], ''); }
  if ((m = s.match(/([\d.]+)천/))) { total += parseFloat(m[1]) * 1000; found = true; s = s.replace(m[0], ''); }
  if ((m = s.match(/([\d.]+)백/))) { total += parseFloat(m[1]) * 100; found = true; s = s.replace(m[0], ''); }
  if ((m = s.match(/([\d.]+)만/))) { total += parseFloat(m[1]); found = true; s = s.replace(m[0], ''); }
  if (/^[\d.]+$/.test(s)) { total += parseFloat(s); found = true; }
  return found ? total : null;
}
function parsePriceText(q) {
  const out = { sale: null, dep: null, rent: null, jeonse: null, deals: new Set() };
  q = text(q).replace(/(\d),(\d{3})/g, '$1$2');
  if (!q) return out;
  let m;
  if ((m = q.match(/월세[_\s:]*([^\/,_\s][^\/,_]*)\/\s*([\d.]+)/))) { out.deals.add('월세'); out.dep = koMoney(m[1]); out.rent = koMoney(m[2]); }
  else if (/월세/.test(q)) out.deals.add('월세');
  if ((m = q.match(/전세[_\s:]*([\d][^,_\/]*)/))) { out.deals.add('전세'); out.jeonse = koMoney(m[1]); }
  else if (/전세/.test(q)) out.deals.add('전세');
  if ((m = q.match(/매매[_\s:]*([\d][^,_\/]*)/))) { out.deals.add('매매'); out.sale = koMoney(m[1]); }
  else if (/매매/.test(q)) out.deals.add('매매');
  return out;
}

// ---------- 층 읽기 ----------
function parseFloors(s) {
  s = text(s);
  if (!s) return null;
  if (/^-?\d+$/.test(s)) return [Number(s)];
  // "지상 18층/지하 6층"처럼 건물 전체 층수를 적은 칸은 이 호실의 층이 아니므로 모른다고 본다
  if (/지하/.test(s)) { if (/지상/.test(s)) return null; const m = s.match(/지하\s*(\d+)/); return [-(m ? Number(m[1]) : 1)]; }
  let m = s.match(/(\d+)\s*[~\-]\s*(\d+)\s*층/);
  if (m) { const a = Number(m[1]), b = Number(m[2]), r = []; for (let i = Math.min(a, b); i <= Math.max(a, b) && r.length < 40; i++) r.push(i); return r; }
  m = s.match(/(\d+)\s*층/);
  return m ? [Number(m[1])] : null;
}
function floorFromHo(ho) {
  const d = text(ho).match(/^(\d{3,4})$/);
  if (!d) return null;
  const n = d[1];
  return [Number(n.length === 3 ? n[0] : n.slice(0, 2))];
}

// ---------- 분류·건물 ----------
function listingGroup(l) {
  const typeLabels = { apartment: '아파트', officetel: '오피스텔', hilsstate: '주거', shop: '상가', office: '사무실', land_single: '토지', land: '토지', factory: '공장', warehouse: '창고', bizcenter: '지식산업센터' };
  const label = text(l.category2) || typeLabels[l.type] || '기타';
  const major = text(l.category1);
  if (/토지|택지/.test(major + label) || /^land/.test(l.type || '')) return '토지';
  if (/주거|아파트|오피스텔|주택/.test(major + label) || ['apartment', 'officetel', 'hilsstate'].includes(l.type)) return '주거';
  if (/공장|창고/.test(major + label)) return '공장·창고';
  if (/상가|사무실|지식산업/.test(major + label)) return '상가·사무실';
  return '기타';
}
let KNOWN = []; // [{name, key}] 건물 이름 목록
let CATS = []; // 상가 카테고리 이름(자료관리 순서)
let RES_BY_ID = new Map(), RES_BY_NAME = new Map(), ROOM = new Map();
function initKnown(resources, categories) {
  ROOM = new Map((categories || []).map(c => [c.name, c.room]));
  CATS = (categories || []).filter(c => c.room === 'commercial').sort((a, b) => (a.sort_order ?? a.order ?? a.position ?? 999) - (b.sort_order ?? b.order ?? b.position ?? 999)).map(c => c.name);
  RES_BY_ID = new Map((resources || []).map(r => [String(r.id), r]));
  RES_BY_NAME = new Map();
  (resources || []).forEach(r => { const k = compact(r.name); if (!RES_BY_NAME.has(k)) RES_BY_NAME.set(k, []); RES_BY_NAME.get(k).push(r); });
  const names = new Map();
  const base = typeof UNJEONG_QUICK_BUILDINGS !== 'undefined' ? UNJEONG_QUICK_BUILDINGS : [];
  const jb = new Map();
  base.forEach(b => {
    names.set(compact(b.name), b.name);
    text(b.addr).replace(/와동동\s*/, '').split(/\s*,\s*/).forEach(j => { if (j) jb.set(j, jb.has(j) ? null : b.name); });
  });
  JIBUN = new Map([...jb].filter(([, v]) => v));
  (resources || []).forEach(r => { const n = text(r.name); if (n.length >= 2 && !names.has(compact(n))) names.set(compact(n), n); });
  KNOWN = [...names].map(([key, name]) => ({ key, name })).sort((a, b) => b.key.length - a.key.length);
}
let JIBUN = new Map(); // 와동동 지번 → 건물 (지번이 하나뿐인 건물만)
function findBuilding(...parts) {
  const h = compact(parts.join(' '));
  const hit = KNOWN.find(k => h.includes(k.key));
  if (hit) return hit.name;
  const m = text(parts.join(' ')).match(/와동동\s*(\d{3,4}(?:-\d+)?)(?![\d-])/);
  return m && JIBUN.has(m[1]) ? JIBUN.get(m[1]) : '';
}
function catOfListing(l, building, group) {
  const r = RES_BY_ID.get(String(l.resource_id || ''));
  if (r && r.category) return r.category;
  const list = RES_BY_NAME.get(compact(building)) || [];
  const pick = group === '상가·사무실' ? list.find(x => ROOM.get(x.category) === 'commercial') : list[0];
  return pick ? text(pick.category) : '';
}

// ---------- 화면용 항목 만들기 ----------
function progressOf(l) {
  const s = text(l.status);
  return s === '거래완료' || s === 'done' ? '거래완료' : s === '보류' ? '보류' : '진행중';
}
function buildEntries(data) {
  const out = [], byListing = new Map(), unitIndex = new Map();
  const scope = g => g === '주거' ? 'residential' : 'commercial';
  for (const raw of data.listings || []) {
    const l = { ...raw, ...(raw.data && typeof raw.data === 'object' ? raw.data : {}), id: raw.id };
    const pt = parsePriceText(l.quick_price);
    const dealText = text(l.dealType || l.deal_type);
    const deals = new Set(pt.deals);
    ['매매', '전세', '월세'].forEach(d => { if (dealText.includes(d)) deals.add(d); });
    if (dealText === '임대') deals.add('월세');
    if (/분양/.test(dealText) || text(l.presaleStatus) === '분양중') deals.add('분양');
    const sale = man(l.salePrice || l.sale_price) ?? pt.sale;
    const dep = man(l.deposit) ?? pt.dep;
    const rent = man(l.monthlyRent || l.monthly_rent) ?? pt.rent;
    if (sale && !deals.size) deals.add('매매');
    if (rent && !dealText) deals.add('월세');
    const group = listingGroup(l);
    const memoText = [l.title, l.quick_memo, l.quick_price, l.description].map(text).join(' ');
    const m2 = num(l.areaM2 ?? l.area_m2);
    let ex = num(l.exclusiveAreaPy) ?? num(l.areaPy ?? l.area_py) ?? (m2 ? round1(m2 / PY) : null);
    let estimated = false;
    if (ex == null) { const t = memoText.match(/전용\s*(\d+(?:\.\d+)?)\s*평/); if (t) { ex = Number(t[1]); estimated = true; } }
    let sup = num(l.supplyAreaPy);
    if (group === '토지' && ex == null) ex = num(l.landAreaPy);
    const ho = text(l.ho) || ((text(l.title + ' ' + l.address).match(/(\d{3,4})\s*호/) || [])[1] || '');
    let floors = parseFloors(l.floorInfo ?? l.floor_info), derived = false;
    if (!floors) { const t = text(l.title).match(/(\d+)\s*층/); if (t) floors = [Number(t[1])]; }
    if (!floors && ho && group !== '토지') { floors = floorFromHo(ho); derived = !!floors; }
    if (!floors && group !== '토지') {
      const seg = text(l.title).match(/\d{3,4}(?:\s*[~·,+]\s*\d{3,4})+\s*호/);
      if (seg) { const fs = new Set(); (seg[0].match(/\d{3,4}/g) || []).forEach(n => { const f = floorFromHo(n); if (f) fs.add(f[0]); }); if (fs.size) { floors = [...fs].sort((a, b) => a - b); derived = true; } }
    }
    const building = text(l.buildingName || l.building_name || l.complexName) || findBuilding(l.title, l.address);
    const e = {
      key: 'L' + l.id, src: '매물', group, building, ho,
      title: text(l.title), addr: text(l.address || l.publicAddress || l.mapAddress),
      floors, floorDerived: derived, ex, sup, areaEstimated: estimated,
      deals, sale, dep, rent, jeonse: pt.jeonse,
      occ: text(l.shop_status || l.occupancy), tenant: '', progress: progressOf(raw),
      created: text(raw.created_at), memo: memoText, resId: text(l.resource_id), href: 'detail.html?id=' + encodeURIComponent(l.id), linkLabel: '매물보기'
    };
    e.cat = catOfListing(raw, e.building, group);
    out.push(e); byListing.set(String(l.id), e);
  }
  const resources = data.resources || [];
  const rooms = new Map((data.categories || []).map(c => [c.name, c.room]));
  for (const b of data.buildings || []) {
    const named = resources.filter(r => r.name === b.name || r.name === b.local_id);
    // 같은 이름의 자료가 둘(예: 오피스텔·오피스텔상가)이면 상가 쪽 자료로 연결한다
    const r = resources.find(r => r.id === b.local_id) || (named.length === 1 ? named[0] : named.find(x => rooms.get(x.category) === 'commercial') || null);
    const category = text(r?.category);
    const room = rooms.get(category) || (/아파트|오피스텔|주거|힐스테이트/.test(category) ? 'residential' : 'commercial');
    const addrLine = text(r?.memo).split('\n').find(x => /^주소\s*:/.test(x));
    const addr = addrLine ? addrLine.replace(/^주소\s*:/, '').trim() : '';
    const bname = text(r?.name || b.name || b.local_id);
    (Array.isArray(b.units) ? b.units : []).forEach((u, i) => {
      const residential = room === 'residential' || Boolean(u.아파트명);
      const group = residential ? '주거' : '상가·사무실';
      const ho = text(u.호수);
      let floors = parseFloors(u.층) || parseFloors(u.층정보), derived = false;
      if (!floors) { floors = floorFromHo(ho); derived = !!floors; }
      const occ = text(u.공실여부);
      const kind = text(u.거래구분);
      const curDep = man(u.현_보증금), curRent = man(u.현_월세);
      const dep = curRent != null || curDep != null ? curDep : man(u.보증금);
      const rent = curRent != null || curDep != null ? curRent : man(u.월차임);
      const sale = man(u.현_매매가격);
      const deals = new Set();
      if (/월세|임대/.test(kind) || (rent != null && (occ === '공실' || occ === '' || occ === '임차중'))) deals.add('월세');
      if (/전세/.test(kind)) deals.add('전세');
      if (/매매/.test(kind) || sale != null) deals.add('매매');
      if (text(u.분양상태) === '분양중' || /분양/.test(kind) && !/완료/.test(text(u.분양상태))) deals.add('분양');
      const e = {
        key: 'U' + b.id + ':' + i, src: '자료', group, building: bname, ho,
        title: [bname, ho && ho + (/호$/.test(ho) ? '' : '호')].filter(Boolean).join(' '), addr,
        floors, floorDerived: derived, ex: num(u.전용_평), sup: num(u.분양_평), areaEstimated: false,
        deals, sale, dep, rent, jeonse: null, occ, tenant: text(u.현업종), progress: occ === '임차중' ? '임차중' : '진행중',
        created: text(u.updated_at), memo: [bname, ho, u.현업종, u.추가메모 && typeof u.추가메모 === 'string' ? u.추가메모 : ''].map(text).join(' '),
        href: r ? 'building-detail.html?id=' + encodeURIComponent(r.id) + '&resourceScope=' + scope(group) + '#unitStatus' : 'building-overview.html',
        linkLabel: '자료보기', resId: r ? String(r.id) : '', unit: u, presale: man(u.분양금액), unitStatus: text(u.분양상태)
      };
      if (r && ho) unitIndex.set(String(r.id) + '|' + ho.replace(/호$/, ''), u);
      e.cat = text(r?.category);
      const linked = byListing.get(String(u.listing_id || ''));
      if (linked) { // 같은 호실이 매물과 자료에 둘 다 있으면 매물 한 줄로 합친다
        if (!linked.floors && e.floors) { linked.floors = e.floors; linked.floorDerived = e.floorDerived; }
        if (linked.ex == null && e.ex != null) linked.ex = e.ex;
        if (linked.sup == null && e.sup != null) linked.sup = e.sup;
        if (!linked.building) linked.building = e.building;
        if (!linked.ho) linked.ho = e.ho;
        if (!linked.occ) linked.occ = e.occ;
        if (!linked.tenant) linked.tenant = e.tenant;
        if (linked.dep == null && linked.rent == null && linked.sale == null) { linked.dep = e.dep; linked.rent = e.rent; linked.sale = e.sale; e.deals.forEach(d => linked.deals.add(d)); }
        if (!linked.cat) linked.cat = e.cat;
        linked.linkLabel = '매물보기';
        linked.unitHref = e.href;
        if (!linked.unit) { linked.unit = u; linked.presale = e.presale; linked.unitStatus = e.unitStatus; }
        if (!linked.resId) linked.resId = e.resId;
      } else out.push(e);
    });
  }
  // 손님용 안내서용: 매물이 어느 건물·호실인지 자료실에서 찾아 둔다 (화면 표시는 그대로)
  for (const e of out) {
    if (e.src !== '매물' || e.unit) continue;
    let rid = e.resId && RES_BY_ID.has(String(e.resId)) ? String(e.resId) : '';
    if (!rid && e.building) { const list = RES_BY_NAME.get(compact(e.building)) || []; const p = list.find(x => ROOM.get(x.category) === 'commercial') || list[0]; rid = p ? String(p.id) : ''; }
    e.resId = rid;
    const hit = rid && e.ho ? unitIndex.get(rid + '|' + e.ho.replace(/호$/, '')) : null;
    if (hit) { e.unit = hit; e.presale = man(hit.분양금액); e.unitStatus = text(hit.분양상태); }
  }
  return out;
}

// ---------- 조건 ----------
const F = { srcs: new Set(), group: '', floors: new Set(), min: null, max: null, basis: 'ex', cats: new Set(), building: '', kw: '', deals: new Set(), depMin: null, depMax: null, rentMin: null, rentMax: null, saleMin: null, saleMax: null, status: 'open', unknown: false, sort: 'floor' };
let ALL = [], shown = 0, matched = [];
const picked = new Set(); // 선택 복사용: 고른 매물의 key

function floorOK(e) {
  if (!F.floors.size) return true;
  if (!e.floors) return F.unknown;
  return e.floors.some(f => F.floors.has(f >= 6 ? 6 : f < 0 ? -1 : f));
}
function areaOK(e) {
  if (F.min == null && F.max == null) return true;
  const vals = F.basis === 'ex' ? [e.ex] : F.basis === 'sup' ? [e.sup] : [e.ex, e.sup];
  const known = vals.filter(v => v != null);
  if (!known.length) return F.unknown;
  return known.some(v => (F.min == null || v >= F.min) && (F.max == null || v <= F.max));
}
function priceOK(e) {
  const chk = (min, max, val) => (min == null && max == null) || (val == null ? F.unknown : (min == null || val >= min) && (max == null || val <= max));
  return chk(F.depMin, F.depMax, e.deals.has('전세') && e.jeonse != null ? e.jeonse : e.dep) && chk(F.rentMin, F.rentMax, e.rent) && chk(F.saleMin, F.saleMax, e.sale);
}
function statusOK(e) {
  if (F.status === 'all') return true;
  if (e.src === '매물') return e.progress === '진행중' || (F.status === 'withRented' && e.progress === '보류');
  return e.occ !== '임차중' || F.status === 'withRented';
}
function catOK(e) {
  if (!F.cats.size) return true;
  if (!e.cat) return F.unknown;
  return F.cats.has(e.cat);
}
function kwOK(e) {
  if (F.building && compact(e.building) !== compact(F.building)) return false;
  if (!F.kw) return true;
  const h = compact([e.title, e.addr, e.building, e.ho, e.memo].join(' '));
  return F.kw.split(/\s+/).filter(Boolean).every(t => h.includes(compact(t)));
}
function srcOK(e) {
  if (!F.srcs.size) return true;
  // 매물과 자료실에 모두 있는 호실은 한 줄로 합쳐져 있으므로 양쪽 어디서 찾아도 나온다
  return (F.srcs.has('매물') && e.src === '매물') || (F.srcs.has('자료') && (e.src === '자료' || !!e.unitHref));
}
function dealOK(e) {
  return !F.deals.size || [...F.deals].some(d => e.deals.has(d));
}
function groupOK(e) { return !F.group || e.group === F.group; }

const SORTS = {
  floor: (a, b) => (a.floors ? Math.min(...a.floors) : 99) - (b.floors ? Math.min(...b.floors) : 99) || compact(a.building).localeCompare(compact(b.building), 'ko') || (num(a.ho) || 0) - (num(b.ho) || 0),
  area: (a, b) => (a.ex ?? a.sup ?? 9999) - (b.ex ?? b.sup ?? 9999),
  rent: (a, b) => (a.rent ?? 99999) - (b.rent ?? 99999),
  sale: (a, b) => (a.sale ?? 9e9) - (b.sale ?? 9e9),
  building: (a, b) => compact(a.building || a.title).localeCompare(compact(b.building || b.title), 'ko') || (num(a.ho) || 0) - (num(b.ho) || 0),
  newest: (a, b) => text(b.created).localeCompare(text(a.created))
};

// ---------- 표시 ----------
function fmtMan(v) {
  if (v == null) return '';
  if (v >= 10000) { const eok = Math.floor(v / 10000), rest = Math.round(v % 10000); return eok + '억' + (rest ? ' ' + rest.toLocaleString('ko-KR') + '만' : ''); }
  return v.toLocaleString('ko-KR') + '만';
}
function fmtFloors(e) {
  if (!e.floors) return '확인 필요';
  const f = [...e.floors].sort((a, b) => a - b).map(n => n < 0 ? '지하' + (-n) + '층' : n + '층');
  return f.length > 2 ? f[0] + '~' + f[f.length - 1] : f.join(', ');
}
function priceLines(e) {
  const l = [];
  if (e.deals.has('월세') && (e.dep != null || e.rent != null)) l.push('월세 ' + (e.dep != null ? fmtMan(e.dep) : '-') + ' / ' + (e.rent != null ? e.rent.toLocaleString('ko-KR') + '만' : '-'));
  else if (e.deals.has('월세')) l.push('월세');
  if (e.deals.has('전세')) l.push('전세 ' + (e.jeonse != null ? fmtMan(e.jeonse) : ''));
  if (e.deals.has('매매')) l.push('매매 ' + (e.sale != null ? fmtMan(e.sale) : '가격 확인'));
  if (e.deals.has('분양')) l.push('분양중');
  return l.length ? l : ['가격 확인 필요'];
}
function areaText(e) {
  const p = [];
  if (e.ex != null) p.push('전용 ' + round1(e.ex) + '평' + (e.areaEstimated ? '(메모)' : ''));
  if (e.sup != null) p.push('분양 ' + round1(e.sup) + '평');
  return p.length ? p : ['확인 필요'];
}
function el(tag, cls, t) { const n = document.createElement(tag); if (cls) n.className = cls; if (t != null) n.textContent = t; return n; }
function numSpan(parent, label, value, cls) {
  const line = el('div', 'pf-line');
  if (label) line.append(el('small', 'pf-tag', label));
  line.append(el('span', 'pf-num' + (cls ? ' ' + cls : ''), value));
  parent.append(line);
}
function row(e) {
  const r = el('article', 'pf-row' + (picked.has(e.key) ? ' is-picked' : ''));
  const kind = el('div', 'pf-kind');
  const chk = el('input', 'pf-chk'); chk.type = 'checkbox'; chk.checked = picked.has(e.key); chk.setAttribute('aria-label', '선택');
  chk.addEventListener('change', () => togglePick(e, r, chk.checked));
  kind.append(chk);
  kind.append(el('span', 'pf-badge ' + (e.src === '매물' ? 'is-listing' : 'is-data'), e.src));
  // 건물 / 호수를 따로 보여 준다
  const hoText = e.ho ? e.ho + (/호$/.test(e.ho) ? '' : '호') : '';
  const bname = e.building || (e.src === '매물' ? (e.title || '등록 매물') : e.title);
  const place = el('div', 'pf-place');
  place.append(el('strong', '', bname));
  const sub = e.src === '매물' ? [e.title, e.addr].find(s => s && s !== bname) : e.addr;
  if (sub) place.append(el('span', 'pf-muted', sub));
  place.append(el('span', 'pf-muted', [e.cat, e.group].filter(Boolean)[0]));
  place.title = [bname, sub].filter(Boolean).join(' · ');
  const ho = el('div', 'pf-ho'); ho.append(el('span', hoText ? 'pf-num' : 'pf-muted', hoText || '-'));
  const hlFloor = F.floors.size > 0, hlArea = F.min != null || F.max != null, hlPrice = F.deals.size > 0 || F.depMin != null || F.depMax != null || F.rentMin != null || F.rentMax != null || F.saleMin != null || F.saleMax != null;
  const fl = el('div', 'pf-col' + (hlFloor ? ' pf-hl' : ''));
  if (e.floors) { numSpan(fl, '', fmtFloors(e)); if (e.floorDerived) fl.append(el('small', 'pf-muted', '호수로 계산')); } else fl.append(el('span', 'pf-muted', '확인 필요'));
  const ar = el('div', 'pf-col' + (hlArea ? ' pf-hl' : ''));
  if (e.ex != null) numSpan(ar, '전용', round1(e.ex) + '평' + (e.areaEstimated ? '(메모)' : ''));
  if (e.sup != null) numSpan(ar, '분양', round1(e.sup) + '평', 'sub');
  if (e.ex == null && e.sup == null) ar.append(el('span', 'pf-muted', '확인 필요'));
  const pr = el('div', 'pf-col' + (hlPrice ? ' pf-hl' : ''));
  if (e.deals.has('월세')) numSpan(pr, '월세', e.dep != null || e.rent != null ? (e.dep != null ? fmtMan(e.dep) : '-') + ' / ' + (e.rent != null ? e.rent.toLocaleString('ko-KR') + '만' : '-') : '가격 확인');
  if (e.deals.has('전세')) numSpan(pr, '전세', e.jeonse != null ? fmtMan(e.jeonse) : '가격 확인');
  if (e.deals.has('매매')) numSpan(pr, '매매', e.sale != null ? fmtMan(e.sale) : '가격 확인');
  if (e.deals.has('분양')) numSpan(pr, '', '분양중', 'sub');
  if (!pr.children.length) pr.append(el('span', 'pf-muted', '가격 확인 필요'));
  const st = el('div', 'pf-col');
  if (e.src === '매물') st.append(el('span', e.progress === '진행중' ? 'pf-ok' : 'pf-muted', e.progress));
  if (e.occ) st.append(el('span', e.occ === '공실' ? 'pf-ok' : 'pf-warn', e.occ));
  if (e.tenant && e.tenant !== e.occ && e.tenant !== '공실') st.append(el('small', 'pf-muted', e.tenant));
  const go = el('div', 'pf-go');
  const link = el('a', '', e.linkLabel); link.href = linkUrl(e.href); go.append(link);
  if (e.unitHref) { const a2 = el('a', '', '자료보기'); a2.href = linkUrl(e.unitHref); go.append(a2); }
  const pa = el('a', 'pf-guide', '상세인쇄'); pa.href = '#'; pa.title = '평면도에 호실 위치를 표시한 손님용 안내서 인쇄';
  pa.addEventListener('click', ev => { ev.preventDefault(); ev.stopPropagation(); guidePrint([e], pa); }); go.append(pa);
  r.append(kind, place, ho, fl, ar, pr, st, go);
  r.addEventListener('click', ev => { if (ev.target.closest('a,button,input')) return; togglePick(e, r, !picked.has(e.key), chk); });
  return r;
}
function linkUrl(h) { try { return typeof OfficeConfig !== 'undefined' ? OfficeConfig.urlFor(h.split('#')[0]) + (h.includes('#') ? '#' + h.split('#')[1] : '') : h; } catch (_) { return h; } }

function togglePick(e, rowEl, on, chk) {
  on ? picked.add(e.key) : picked.delete(e.key);
  rowEl.classList.toggle('is-picked', on);
  const box = chk || rowEl.querySelector('.pf-chk'); if (box) box.checked = on;
  updateSel();
}
function updateSel() {
  const n = picked.size;
  if (!$('pfCopySel')) return;
  $('pfCopySel').textContent = '선택 복사' + (n ? ' (' + n + ')' : '');
  $('pfCopySel').disabled = n === 0;
  const gb = $('pfGuideSel'); if (gb) { gb.textContent = '선택 상세인쇄' + (n ? ' (' + n + ')' : ''); gb.disabled = n === 0; }
  const pb = $('pfPrint'); if (pb) pb.textContent = n ? '선택 인쇄 (' + n + ')' : '인쇄';
  const all = $('pfSelAll'); all.checked = n > 0 && n === matched.length; all.indeterminate = n > 0 && n < matched.length;
}
// ---------- 손님용 상세 안내서 (평면도 + 호실 위치) ----------
const floorCache = new Map();
async function guideFloors(rid) {
  if (!rid) return [];
  if (!floorCache.has(rid)) { let f = []; try { f = await getBuildingFloors(rid); } catch (_) { f = []; } floorCache.set(rid, f); }
  return floorCache.get(rid);
}
function guideData(e, floors) {
  const G = window.UnitGuide, u = e.unit || null;
  const f0 = e.floors && e.floors.length ? e.floors[0] : null;
  const fk = G.floorKeyOf(e.ho) || (f0 == null ? '' : f0 < 0 ? 'B' + (-f0) : String(f0));
  const plan = G.pickPlan(floors, fk, u);
  let amount = null, label = '매매가';
  if (e.sale != null) amount = e.sale;
  else if (e.deals.has('분양') && e.presale != null) { amount = e.presale; label = '분양가'; }
  else if (e.jeonse != null) { amount = e.jeonse; label = '전세'; }
  const fl = fmtFloors(e);
  return {
    name: e.building || text(e.title).replace(/__.*$/, '').replace(/^상가\s*[·\-]\s*/, '').replace(/\s*\d{3,4}\s*호?\s*$/, '').trim() || e.title, addr: text(e.addr).replace(/__.*$/, ''), ho: e.ho, fk, amount, amountLabel: label, vat: u && u.분양_VAT,
    deposit: e.dep, rent: e.rent,
    cells: [['층', fl === '확인 필요' ? '' : fl], ['전용면적', e.ex != null ? G.pyText(e.ex) : ''], ['분양면적', e.sup != null ? G.pyText(e.sup) : ''],
      ['현재 업종', e.tenant && e.tenant !== '공실' ? e.tenant : ''], ['임대 현황', e.occ], ['분양 상태', e.unitStatus || (u && u.분양상태) || '']],
    planUrl: plan.planUrl, pos: plan.pos
  };
}
async function guidePrint(list, btn) {
  if (!list.length) return;
  if (!window.UnitGuide) { alert('안내서 도구를 불러오지 못했습니다. 새로고침해 주세요.'); return; }
  if (list.length > 30) { alert('한 번에 30건까지 인쇄할 수 있어요. 나눠서 선택해 주세요.'); return; }
  const old = btn.textContent; btn.textContent = '준비 중…'; btn.style.pointerEvents = 'none';
  try {
    const pages = [];
    for (const e of list) pages.push(window.UnitGuide.guideHtml(guideData(e, await guideFloors(e.resId))));
    const pbx = $('pfPageBoxes'); if (pbx) pbx.remove();
    await window.UnitGuide.printHtml(pages.join(''));
  } catch (err) { alert('안내서를 만들지 못했습니다: ' + err.message); }
  finally { btn.textContent = old; btn.style.pointerEvents = ''; updateSel(); }
}
function copyText(list, title) {
  const lines = list.map(e => [e.building || e.title, e.ho ? e.ho + '호' : '', fmtFloors(e), areaText(e).join('/'), priceLines(e).join(', ')].filter(Boolean).join(' | '));
  return title + '\n' + lines.join('\n');
}
async function copyTo(btn, text, label) {
  try { await navigator.clipboard.writeText(text); btn.textContent = '복사했습니다'; } catch (_) { btn.textContent = '복사 실패'; }
  setTimeout(() => { btn.textContent = label(); updateSel(); }, 1800);
}
function run() {
  picked.clear();
  // 정보 없음 때문에 빠진 건수를 알려 주려고 두 번 센다
  const strict = ALL.filter(e => srcOK(e) && groupOK(e) && statusOK(e) && kwOK(e) && dealOK(e));
  const saved = F.unknown;
  F.unknown = false; const tight = strict.filter(e => floorOK(e) && areaOK(e) && priceOK(e) && catOK(e));
  F.unknown = true; const loose = strict.filter(e => floorOK(e) && areaOK(e) && priceOK(e) && catOK(e));
  F.unknown = saved;
  matched = (saved ? loose : tight).slice().sort(SORTS[F.sort] || SORTS.floor);
  const hidden = loose.length - tight.length;
  $('pfCount').textContent = matched.length + '건';
  if ($('pfCondLine')) $('pfCondLine').textContent = condText() || '조건 없음 (전체)';
  const c = {}; matched.forEach(e => c[e.src] = (c[e.src] || 0) + 1);
  $('pfSplit').textContent = '매물 ' + (c['매물'] || 0) + ' · 자료 ' + (c['자료'] || 0);
  const hint = $('pfHint');
  hint.textContent = '';
  if (!saved && hidden > 0) {
    hint.append('층·평수·가격·위치 정보가 비어 있어 빠진 항목이 ' + hidden + '건 있습니다. ');
    const b = el('button', 'pf-link', '포함해서 보기'); b.type = 'button'; b.onclick = () => { $('pfUnknown').checked = true; F.unknown = true; doSearch(); }; hint.append(b);
  }
  $('pfList').replaceChildren(); shown = 0; showMore();
  $('pfEmpty').hidden = matched.length > 0;
  updateSel();
}
function showMore() {
  const end = Math.min(shown + 50, matched.length), list = $('pfList');
  for (let i = shown; i < end; i++) list.append(row(matched[i]));
  shown = end;
  $('pfMore').hidden = shown >= matched.length;
  $('pfMore').textContent = '더 보기 (' + shown + ' / ' + matched.length + '건)';
}

// ---------- 화면 조작 ----------
// 조건을 고르는 동안에는 결과가 바뀌지 않고, [검색] 버튼을 눌러야 결과가 나온다.
let searched = false;
function markDirty() {
  updatePills();
  if (!searched) return;
  $('pfGo').classList.add('is-dirty'); $('pfDirty').hidden = false;
}
function pick(id, apply) {
  $(id).addEventListener('click', ev => {
    const b = ev.target.closest('button[data-v]'); if (!b) return;
    apply(b.dataset.v); markDirty(); syncPicks();
  });
}
const toggleSet = (set, v) => { if (v === '__all') set.clear(); else set.has(v) ? set.delete(v) : set.add(v); };
function areaKey() { return (F.min ?? '') + '-' + (F.max ?? ''); }
function syncPicks() {
  const mark = (id, test) => $(id).querySelectorAll('button[data-v]').forEach(b => b.setAttribute('aria-pressed', String(test(b.dataset.v))));
  mark('pfSrc', v => v === '__all' ? F.srcs.size === 0 : F.srcs.has(v));
  mark('pfGroup', v => v === F.group);
  mark('pfCat', v => v === '__all' ? F.cats.size === 0 : F.cats.has(v));
  mark('pfFloor', v => v === '__all' ? F.floors.size === 0 : F.floors.has(Number(v)));
  mark('pfDeal', v => v === '__all' ? F.deals.size === 0 : F.deals.has(v));
  mark('pfAreaQuick', v => v === areaKey());
  updatePills();
}
// ----- 상단 필터 바(네이버 부동산 스타일) -----
const PILL_PANELS = { pillSrc: 'pnSrc', pillGroup: 'pnGroup', pillCat: 'pnCat', pillFloor: 'pnFloor', pillDeal: 'pnDeal', pillArea: 'pnArea', pillPrice: 'pnPrice', pillMore: 'pnMore' };
function pillSummaries() {
  const fl = [...F.floors].sort((a, b) => a - b).map(n => n < 0 ? '지하' : n >= 6 ? '6층+' : n + '층');
  const rg = (a, b, k, u) => (a != null ? a / k : '') + '~' + (b != null ? b / k : '') + u;
  const price = [];
  if (F.depMin != null || F.depMax != null) price.push('보증금 ' + rg(F.depMin, F.depMax, 1, '만'));
  if (F.rentMin != null || F.rentMax != null) price.push('월세 ' + rg(F.rentMin, F.rentMax, 1, '만'));
  if (F.saleMin != null || F.saleMax != null) price.push('매매 ' + rg(F.saleMin, F.saleMax, 10000, '억'));
  const more = (F.building ? 1 : 0) + (F.kw ? 1 : 0) + (F.status !== 'open' ? 1 : 0) + (F.unknown ? 1 : 0);
  return {
    pillSrc: F.srcs.size === 1 ? ([...F.srcs][0] === '매물' ? '매물리스트만' : '자료실만') : '',
    pillGroup: F.group,
    pillCat: F.cats.size ? [...F.cats][0].replace(/\s*(상가|근생상가).*$/, '') + (F.cats.size > 1 ? ' 외 ' + (F.cats.size - 1) : '') : '',
    pillFloor: fl.length > 2 ? fl[0] + ' 외 ' + (fl.length - 1) : fl.join(', '),
    pillDeal: [...F.deals].join(', '),
    pillArea: F.min != null || F.max != null ? rg(F.min, F.max, 1, '평') : '',
    pillPrice: price.length > 1 ? price[0] + ' 외' : price.join(''),
    pillMore: more ? '상세 ' + more : ''
  };
}
function updatePills() {
  const s = pillSummaries();
  Object.keys(PILL_PANELS).forEach(id => {
    const b = $(id); if (!b) return;
    b.querySelector('.pt').textContent = s[id] || b.dataset.label;
    b.classList.toggle('on', !!s[id]);
  });
}
function closePanels(except) {
  Object.entries(PILL_PANELS).forEach(([pid, panel]) => {
    if (pid === except) return;
    $(panel).hidden = true; $(pid).setAttribute('aria-expanded', 'false');
  });
}
function initPills() {
  Object.entries(PILL_PANELS).forEach(([pid, panel]) => {
    $(pid).addEventListener('click', ev => {
      ev.stopPropagation();
      const open = $(panel).hidden;
      closePanels(pid); $(panel).hidden = !open; $(pid).setAttribute('aria-expanded', String(open));
    });
  });
  document.addEventListener('click', ev => { if (!ev.target.closest('.pf-pillwrap')) closePanels(); });
  document.addEventListener('keydown', ev => { if (ev.key === 'Escape') closePanels(); });
  // 한 가지만 고르는 칸(종류·평수 목록)은 고르면 창을 닫는다
  ['pfGroup', 'pfAreaQuick'].forEach(id => $(id).addEventListener('click', ev => { if (ev.target.closest('button[data-v]')) setTimeout(() => closePanels(), 120); }));
}
function numInput(id, key, scale) {
  $(id).addEventListener('input', () => { const n = num($(id).value); F[key] = n == null ? null : n * (scale || 1); markDirty(); syncPicks(); });
}
function refreshBuildings() {
  const sel = $('pfBuilding'); if (!sel) return;
  const keep = F.building;
  const names = [...new Set(ALL.filter(e => e.building && (!F.cats.size || F.cats.has(e.cat))).map(e => e.building))].sort((a, b) => a.localeCompare(b, 'ko'));
  sel.replaceChildren(); const all = el('option', '', '건물 전체'); all.value = ''; sel.append(all);
  names.forEach(n => { const o = el('option', '', n); o.value = n; sel.append(o); });
  if (!names.includes(keep)) F.building = '';
  sel.value = F.building;
}
function buildCatChips() {
  const box = $('pfCat'); box.replaceChildren();
  [['__all', '전체'], ...CATS.map(n => [n, n])].forEach(([v, t]) => { const b = el('button', '', t); b.type = 'button'; b.dataset.v = v; b.setAttribute('aria-pressed', 'false'); box.append(b); });
}
function syncUI() {
  syncPicks(); refreshBuildings();
  $('pfMin').value = F.min ?? ''; $('pfMax').value = F.max ?? '';
  $('pfKw').value = F.kw;
  $('pfDepMin').value = F.depMin ?? ''; $('pfDepMax').value = F.depMax ?? ''; $('pfRentMin').value = F.rentMin ?? ''; $('pfRentMax').value = F.rentMax ?? '';
  $('pfSaleMin').value = F.saleMin != null ? F.saleMin / 10000 : ''; $('pfSaleMax').value = F.saleMax != null ? F.saleMax / 10000 : '';
  $('pfUnknown').checked = F.unknown;
}
const PARAM_KEYS = ['q', 'src', 'g', 'c', 'fl', 'd', 'a1', 'a2', 'basis', 'b1', 'b2', 'r1', 'r2', 's1', 's2', 'kw', 'b', 'st', 'unk', 'all'];
function toParams() {
  const p = new URLSearchParams();
  if (F.srcs.size) p.set('src', [...F.srcs].join(','));
  if (F.group) p.set('g', F.group);
  if (F.cats.size) p.set('c', [...F.cats].join('|'));
  if (F.floors.size) p.set('fl', [...F.floors].join(','));
  if (F.deals.size) p.set('d', [...F.deals].join(','));
  if (F.min != null) p.set('a1', F.min);
  if (F.max != null) p.set('a2', F.max);
  if (F.basis !== 'ex') p.set('basis', F.basis);
  [['depMin', 'b1'], ['depMax', 'b2'], ['rentMin', 'r1'], ['rentMax', 'r2'], ['saleMin', 's1'], ['saleMax', 's2']].forEach(([k, n]) => { if (F[k] != null) p.set(n, F[k]); });
  if (F.kw) p.set('kw', F.kw);
  if (F.building) p.set('b', F.building);
  if (F.status !== 'open') p.set('st', F.status);
  if (F.unknown) p.set('unk', '1');
  return p;
}
function applyParams(sp) {
  const n = k => sp.has(k) && sp.get(k) !== '' && isFinite(Number(sp.get(k))) ? Number(sp.get(k)) : null;
  F.srcs = new Set((sp.get('src') || '').split(',').filter(x => x === '매물' || x === '자료'));
  if (F.srcs.size === 2) F.srcs.clear();
  F.group = sp.get('g') || '';
  F.cats = new Set((sp.get('c') || '').split('|').filter(Boolean));
  F.floors = new Set((sp.get('fl') || '').split(',').filter(x => x !== '').map(Number).filter(x => isFinite(x)));
  F.deals = new Set((sp.get('d') || '').split(',').filter(Boolean));
  F.min = n('a1'); F.max = n('a2');
  F.basis = ['ex', 'sup', 'any'].includes(sp.get('basis')) ? sp.get('basis') : 'ex';
  F.depMin = n('b1'); F.depMax = n('b2'); F.rentMin = n('r1'); F.rentMax = n('r2'); F.saleMin = n('s1'); F.saleMax = n('s2');
  F.kw = sp.get('kw') || ''; F.building = sp.get('b') || '';
  F.status = ['open', 'withRented', 'all'].includes(sp.get('st')) ? sp.get('st') : 'open';
  F.unknown = sp.get('unk') === '1';
  if ($('pfBasis')) $('pfBasis').value = F.basis;
  if ($('pfStatus')) $('pfStatus').value = F.status;
}
function openResults(q) {
  const p = q ? new URLSearchParams({ q }) : toParams();
  if (![...p.keys()].length) p.set('all', '1');
  window.open(OfficeConfig.urlFor('property-finder.html') + '&' + p.toString(), '_blank');
}
function doSearch() {
  if (BAR_ONLY) { openResults(); return; }
  searched = true;
  $('pfGo').classList.remove('is-dirty'); $('pfDirty').hidden = true;
  $('pfIdle').hidden = true; $('pfResults').hidden = false;
  if ($('pfChange') && !$('pfChange').hidden) $('pfBarMount').hidden = true;
  run();
  $('pfResults').scrollIntoView({ behavior: 'smooth', block: 'start' });
}
// "상가 1층 20~40평 운정역 월세" 같은 한 줄 입력을 조건으로 바꾼다
function parseQuick(q) {
  q = text(q).replace(/[,，]/g, ' ');
  const f = { group: '', floors: new Set(), min: null, max: null, cats: new Set(), deals: new Set(), kw: [] };
  const keyOf = n => /단지내/.test(n) ? '단지내' : n.split(/[\s(]/)[0].replace(/마을$/, '');
  CATS.forEach(n => {
    const key = keyOf(n), keys = [key]; if (key === '운정역') keys.push('운정');
    if (keys.some(k => k && q.includes(k))) f.cats.add(n);
  });
  CATS.forEach(n => { q = q.replace(new RegExp(keyOf(n) + '(\\s*상가)?', 'g'), ' '); });
  q = q.replace(/운정/g, ' ');
  if (/아파트|오피스텔|주거|원룸|투룸/.test(q)) f.group = '주거';
  else if (/공장|창고/.test(q)) f.group = '공장·창고';
  else if (/토지|택지|대지/.test(q)) f.group = '토지';
  else if (/상가|사무실|점포|가게/.test(q)) f.group = '상가·사무실';
  if (!f.group && f.cats.size) f.group = '상가·사무실';
  let rest = q;
  rest = rest.replace(/지하\s*\d*\s*층?/g, () => { f.floors.add('-1'); return ' '; });
  rest = rest.replace(/(\d+)\s*층\s*이상/g, (_, n) => { for (let i = Number(n); i <= 6; i++) f.floors.add(String(i)); return ' '; });
  rest = rest.replace(/(\d+)\s*[~\-]\s*(\d+)\s*층/g, (_, a, b) => { for (let i = Number(a); i <= Number(b); i++) f.floors.add(String(i >= 6 ? 6 : i)); return ' '; });
  rest = rest.replace(/(\d+)\s*층/g, (_, n) => { f.floors.add(String(Number(n) >= 6 ? 6 : Number(n))); return ' '; });
  rest = rest.replace(/(\d+(?:\.\d+)?)\s*[~\-]\s*(\d+(?:\.\d+)?)\s*평/g, (_, a, b) => { f.min = Number(a); f.max = Number(b); return ' '; });
  rest = rest.replace(/(\d+(?:\.\d+)?)\s*평\s*이상/g, (_, a) => { f.min = Number(a); return ' '; });
  rest = rest.replace(/(\d+(?:\.\d+)?)\s*평\s*(?:이하|미만)/g, (_, a) => { f.max = Number(a); return ' '; });
  rest = rest.replace(/(\d+(?:\.\d+)?)\s*평/g, (_, a) => { f.min = Number(a) - 3; f.max = Number(a) + 3; return ' '; });
  ['매매', '전세', '월세', '분양'].forEach(d => { if (rest.includes(d)) { f.deals.add(d); rest = rest.replace(d, ' '); } });
  rest = rest.replace(/임대/g, () => { f.deals.add('월세'); return ' '; });

  rest = rest.replace(/상가|사무실|점포|가게|아파트|오피스텔|주거|공장|창고|토지|택지|대지/g, ' ');
  f.kw = rest.split(/\s+/).filter(Boolean).join(' ');
  return f;
}
function condText() {
  const p = [];
  p.push('종류 ' + (F.group || '전체'));
  if (F.srcs.size === 1) p.push('대상 ' + ([...F.srcs][0] === '매물' ? '매물리스트만' : '자료실만'));
  if (F.cats.size) p.push('상가 구분 ' + [...F.cats].join(', '));
  if (F.building) p.push('건물 ' + F.building);
  if (F.kw) p.push('검색어 ' + F.kw);
  if (F.floors.size) p.push('층 ' + [...F.floors].sort((a, b) => a - b).map(n => n < 0 ? '지하' : n >= 6 ? '6층 이상' : n + '층').join(', '));
  if (F.min != null || F.max != null) p.push('평수 ' + (F.min ?? '') + '~' + (F.max ?? '') + '평(' + ({ ex: '전용', sup: '분양', any: '전용·분양' }[F.basis]) + ')');
  if (F.deals.size) p.push('거래 ' + [...F.deals].join(', '));
  const rg = (name, a, b, unit, k) => { if (a != null || b != null) p.push(name + ' ' + (a != null ? a / k : '') + '~' + (b != null ? b / k : '') + unit); };
  rg('보증금', F.depMin, F.depMax, '만원', 1); rg('월세', F.rentMin, F.rentMax, '만원', 1); rg('매매가', F.saleMin, F.saleMax, '억', 10000);
  return p.join(' / ');
}
// 인쇄할 때마다 맨 위(둘째 쪽부터)와 맨 아래에 상호·연락처를 넣는다
function printBrand() {
  const ktop = typeof OfficeConfig !== 'undefined' && OfficeConfig.id === 'ktop';
  return ktop
    ? { title: 'KTOP부동산 매물 목록', foot: 'KTOP부동산' }
    : { title: '하이탑부동산 매물 목록', foot: '하이탑부동산공인중개사사무소     |     T. 031-949-8969' };
}
function applyPrintPage() {
  const b = printBrand();
  const q = s => '"' + s.replace(/"/g, '') + '"';
  const f = 'font:10px Pretendard,sans-serif;';
  let st = document.getElementById('pfPageBoxes');
  if (!st) { st = document.createElement('style'); st.id = 'pfPageBoxes'; document.head.appendChild(st); }
  st.textContent = '@page{@top-left{content:' + q(b.title) + ';font:600 10px Pretendard,sans-serif;color:#555;vertical-align:bottom;padding-bottom:3mm}'
    + '@top-right{content:"브리핑 자료";' + f + 'color:#777;vertical-align:bottom;padding-bottom:3mm}'
    + '@bottom-center{content:' + q(b.foot) + ';font:800 14px Pretendard,"Malgun Gothic",sans-serif;letter-spacing:.02em;color:#17473f;background:linear-gradient(90deg,#e6f2f0,#f6fbfa);border:1px solid #9fc4be;border-left:5px solid #25675f;border-radius:4px;margin:3mm 0 5mm;padding:0 10mm;text-align:center;vertical-align:middle;white-space:nowrap;-webkit-print-color-adjust:exact;print-color-adjust:exact}'
    + '@bottom-right{content:counter(page) " / " counter(pages);' + f + 'color:#555;vertical-align:middle;margin:3mm 0 5mm}}'
    + '@page :first{@top-left{content:none}@top-right{content:none}}';
  if ($('pfPrintTitle')) $('pfPrintTitle').textContent = b.title;
}
function printList() {
  if (!matched.length) return;
  applyPrintPage();
  const src = picked.size ? matched.filter(e => picked.has(e.key)) : matched;
  const cap = Math.min(src.length, 500), list = $('pfList');
  list.replaceChildren(); src.slice(0, cap).forEach(e => list.append(row(e)));
  const d = new Date();
  $('pfPrintCond').textContent = condText();
  $('pfPrintMeta').textContent = (picked.size ? '선택 ' : '총 ') + src.length + '건' + (src.length > cap ? ' 중 ' + cap + '건 인쇄' : '') + ' · ' + d.getFullYear() + '.' + String(d.getMonth() + 1).padStart(2, '0') + '.' + String(d.getDate()).padStart(2, '0') + ' 출력';
  const restore = () => { list.replaceChildren(); shown = 0; showMore(); };
  window.addEventListener('afterprint', restore, { once: true });
  window.print();
}
function reset() {
  Object.assign(F, { srcs: new Set(), group: '', floors: new Set(), min: null, max: null, basis: 'ex', cats: new Set(), building: '', kw: '', deals: new Set(), depMin: null, depMax: null, rentMin: null, rentMax: null, saleMin: null, saleMax: null, status: 'open', unknown: false });
  $('pfQuick').value = ''; $('pfBasis').value = 'ex'; $('pfStatus').value = 'open';
  syncUI(); markDirty();
}
function init() {
  initPills();
  pick('pfSrc', v => { toggleSet(F.srcs, v); if (F.srcs.size === 2) F.srcs.clear(); });
  pick('pfGroup', v => { F.group = v; });
  pick('pfFloor', v => { if (v === '__all') F.floors.clear(); else toggleSet(F.floors, Number(v)); });
  pick('pfDeal', v => toggleSet(F.deals, v));
  pick('pfCat', v => { toggleSet(F.cats, v); refreshBuildings(); });
  pick('pfAreaQuick', v => { const [a, b] = v.split('-'); F.min = a === '' ? null : Number(a); F.max = b === '' ? null : Number(b); $('pfMin').value = F.min ?? ''; $('pfMax').value = F.max ?? ''; });
  numInput('pfMin', 'min'); numInput('pfMax', 'max'); numInput('pfDepMin', 'depMin'); numInput('pfDepMax', 'depMax'); numInput('pfRentMin', 'rentMin'); numInput('pfRentMax', 'rentMax'); numInput('pfSaleMin', 'saleMin', 10000); numInput('pfSaleMax', 'saleMax', 10000);
  $('pfKw').addEventListener('input', () => { F.kw = $('pfKw').value; markDirty(); });
  on('pfBuilding', 'change', () => { F.building = $('pfBuilding').value; markDirty(); });
  $('pfBasis').addEventListener('change', () => { F.basis = $('pfBasis').value; markDirty(); });
  $('pfStatus').addEventListener('change', () => { F.status = $('pfStatus').value; markDirty(); });
  $('pfUnknown').addEventListener('change', () => { F.unknown = $('pfUnknown').checked; markDirty(); });
  on('pfSort', 'change', () => { F.sort = $('pfSort').value; matched.sort(SORTS[F.sort] || SORTS.floor); $('pfList').replaceChildren(); shown = 0; showMore(); });
  on('pfMore', 'click', showMore);
  $('pfReset').addEventListener('click', reset);
  $('pfGo').addEventListener('click', () => { closePanels(); doSearch(); });
  $('pfQuickForm').addEventListener('submit', ev => {
    ev.preventDefault();
    if (BAR_ONLY) { openResults($('pfQuick').value.trim()); return; }
    const q = parseQuick($('pfQuick').value);
    Object.assign(F, { group: q.group, floors: new Set([...q.floors].map(Number)), min: q.min, max: q.max, cats: q.cats, deals: q.deals, kw: q.kw, building: '' });
    syncUI(); doSearch();
  });
  on('pfPrint', 'click', printList);
  if ($('pfCopySel') && !$('pfGuideSel')) { const gb = document.createElement('button'); gb.className = 'pf-btn'; gb.id = 'pfGuideSel'; gb.type = 'button'; gb.disabled = true; gb.textContent = '선택 상세인쇄'; gb.title = '선택한 매물마다 평면도에 호실 위치를 표시한 안내서를 한 장씩 인쇄'; $('pfCopySel').after(gb); gb.addEventListener('click', () => guidePrint(matched.filter(e => picked.has(e.key)), gb)); }
  on('pfCopy', 'click', () => {
    const list = matched.slice(0, 60);
    copyTo($('pfCopy'), copyText(list, '[하이탑 매물 ' + matched.length + '건' + (matched.length > 60 ? ' 중 60건' : '') + ']'), () => '결과 복사');
  });
  on('pfCopySel', 'click', () => {
    const list = matched.filter(e => picked.has(e.key));
    if (!list.length) return;
    copyTo($('pfCopySel'), copyText(list, '[하이탑 매물 선택 ' + list.length + '건]'), () => '선택 복사');
  });
  on('pfSelAll', 'change', () => {
    if ($('pfSelAll').checked) matched.forEach(e => picked.add(e.key)); else picked.clear();
    document.querySelectorAll('#pfList .pf-row').forEach((r, i) => { const on = picked.has(matched[i].key); r.classList.toggle('is-picked', on); r.querySelector('.pf-chk').checked = on; });
    updateSel();
  });
}

// ---------- 자료 읽기 ----------
async function fetchRows(table, select, token) {
  const rows = [], seen = new Set(); let offset = 0;
  for (;;) {
    const params = new URLSearchParams({ select, order: 'id.asc', limit: '500', offset: String(offset) });
    const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 20000);
    let res;
    try { res = await fetch(SUPABASE_URL + '/rest/v1/' + table + '?' + params, { headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + token }, signal: ctl.signal }); } finally { clearTimeout(timer); }
    if (!res.ok) throw new Error(table);
    const batch = await res.json();
    if (!Array.isArray(batch) || !batch.length) break;
    let added = 0; for (const r of batch) { const k = String(r.id); if (!seen.has(k)) { seen.add(k); rows.push(r); added++; } }
    if (!added) break;
    offset += batch.length;
  }
  return rows;
}
async function loadData() {
  if (window.__FINDER_MOCK) return window.__FINDER_MOCK;
  const auth = await hitopAuthClient.auth.getSession();
  const token = auth.data?.session?.access_token;
  if (auth.error || !token) throw new Error('SESSION');
  const srcs = [['listings', '*'], ['buildings', '*'], ['drive_resources', 'id,name,category,memo'], ['drive_resource_categories', '*']];
  const res = await Promise.allSettled(srcs.map(s => fetchRows(s[0], s[1], token)));
  const keys = ['listings', 'buildings', 'resources', 'categories'], data = {}, failed = [];
  res.forEach((r, i) => { if (r.status === 'fulfilled') data[keys[i]] = r.value; else { data[keys[i]] = []; failed.push(srcs[i][0]); } });
  if (!data.listings.length && !data.buildings.length) throw new Error('LOAD');
  data.failed = failed;
  return data;
}
async function initBarCats() {
  CATS = typeof OfficeConfig !== 'undefined' && OfficeConfig.id === 'hitop' ? DEFAULT_CATS.slice() : [];
  buildCatChips(); syncUI();
  try {
    const auth = await hitopAuthClient.auth.getSession();
    const token = auth.data?.session?.access_token; if (!token) return;
    const rows = await fetchRows('drive_resource_categories', '*', token);
    const names = rows.filter(c => c.room === 'commercial').sort((a, b) => (a.sort_order ?? a.order ?? a.position ?? 999) - (b.sort_order ?? b.order ?? b.position ?? 999)).map(c => c.name);
    if (names.length) { CATS = names; buildCatChips(); syncPicks(); }
  } catch (_) { /* 기본 목록을 그대로 쓴다 */ }
}
async function start() {
  const mount = $('pfBarMount');
  if (mount) mount.innerHTML = barHtml();
  if (mount && BAR_ONLY) {
    mount.classList.add('pf-card-mode');
    const title = document.createElement('div'); title.className = 'pf-bar-title';
    title.append('조건으로 매물 찾기 '); const sm = document.createElement('small'); sm.textContent = '손님 조건을 넣고 검색하세요 · 결과는 새 창으로 열립니다'; title.append(sm);
    mount.prepend(title);
  }
  init();
  if (BAR_ONLY) { await initBarCats(); return; }
  const sp = new URLSearchParams(location.search);
  const hasCond = PARAM_KEYS.some(k => sp.has(k));
  if (hasCond && mount) { mount.hidden = true; if ($('pfChange')) $('pfChange').hidden = false; }
  on('pfChange', 'click', () => { mount.hidden = !mount.hidden; });
  const status = $('pfStatusMsg');
  try {
    status.textContent = '매물과 자료를 불러오는 중입니다…';
    const data = await loadData();
    initKnown(data.resources, data.categories);
    ALL = buildEntries(data);
    buildCatChips();
    status.textContent = data.failed && data.failed.length ? '일부 자료를 읽지 못했습니다(' + data.failed.join(', ') + '). 결과가 부족할 수 있어요. 새로고침해 주세요.' : '';
    $('pfLoaded').textContent = '전체 ' + ALL.length + '건 중에서 찾습니다';
    if (sp.get('q')) { $('pfQuick').value = sp.get('q'); $('pfQuickForm').requestSubmit(); }
    else if (hasCond) { applyParams(sp); syncUI(); doSearch(); }
    else syncUI();
  } catch (e) {
    status.textContent = e.message === 'SESSION' ? '로그인 상태를 확인할 수 없습니다. 다시 로그인해 주세요.' : '자료를 불러오지 못했습니다. 새로고침해 주세요.';
  }
}
window.PropertyFinder = { parseQuick, parsePriceText, koMoney, parseFloors, floorFromHo, buildEntries, initKnown };
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
