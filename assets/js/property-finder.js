// 매물찾기: 손님 조건(종류·층·평수·위치·거래)으로 등록 매물과 자료실 호실을 한 번에 찾는다.
// 읽기 전용 화면이다. 저장·수정·삭제 기능은 없다.
(function () {
'use strict';
const $ = id => document.getElementById(id);
const text = v => v == null ? '' : String(v).trim();
const compact = v => text(v).normalize('NFKC').toLocaleLowerCase('ko-KR').replace(/\s+/g, '');
const num = v => { if (v == null || v === '') return null; const s = String(v).replace(/,/g, ''); if (!/\d/.test(s)) return null; const n = Number(s.replace(/[^\d.\-]/g, '')); return isFinite(n) ? n : null; };
const PY = 3.305785;
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
  if (/지하/.test(s)) { const m = s.match(/(\d+)/); return [-(m ? Number(m[1]) : 1)]; }
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
  const out = [], byListing = new Map();
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
    const building = text(l.buildingName || l.building_name || l.complexName) || findBuilding(l.title, l.address);
    const e = {
      key: 'L' + l.id, src: '매물', group, building, ho,
      title: text(l.title), addr: text(l.address || l.publicAddress || l.mapAddress),
      floors, floorDerived: derived, ex, sup, areaEstimated: estimated,
      deals, sale, dep, rent, jeonse: pt.jeonse,
      occ: text(l.shop_status || l.occupancy), tenant: '', progress: progressOf(raw),
      created: text(raw.created_at), memo: memoText, href: 'detail.html?id=' + encodeURIComponent(l.id), linkLabel: '매물보기'
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
        linkLabel: '자료보기'
      };
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
      } else out.push(e);
    });
  }
  return out;
}

// ---------- 조건 ----------
const F = { group: '', floors: new Set(), min: null, max: null, basis: 'ex', cats: new Set(), building: '', kw: '', deals: new Set(), depMin: null, depMax: null, rentMin: null, rentMax: null, saleMin: null, saleMax: null, status: 'open', unknown: false, sort: 'floor' };
let ALL = [], shown = 0, matched = [];

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
  const r = el('article', 'pf-row');
  const kind = el('div', 'pf-kind');
  kind.append(el('span', 'pf-badge ' + (e.src === '매물' ? 'is-listing' : 'is-data'), e.src));
  // 건물 / 호수를 따로 보여 준다
  const hoText = e.ho ? e.ho + (/호$/.test(e.ho) ? '' : '호') : '';
  const bname = e.building || (e.src === '매물' ? (e.title || '등록 매물') : e.title);
  const place = el('div', 'pf-place');
  place.append(el('strong', '', bname));
  const sub = e.src === '매물' ? [e.title, e.addr].find(s => s && s !== bname) : e.addr;
  if (sub) place.append(el('span', 'pf-muted', sub));
  place.append(el('span', 'pf-muted', [e.cat, e.group].filter(Boolean)[0]));
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
  r.append(kind, place, ho, fl, ar, pr, st, go);
  return r;
}
function linkUrl(h) { try { return typeof OfficeConfig !== 'undefined' ? OfficeConfig.urlFor(h.split('#')[0]) + (h.includes('#') ? '#' + h.split('#')[1] : '') : h; } catch (_) { return h; } }

function run() {
  // 정보 없음 때문에 빠진 건수를 알려 주려고 두 번 센다
  const strict = ALL.filter(e => groupOK(e) && statusOK(e) && kwOK(e) && dealOK(e));
  const saved = F.unknown;
  F.unknown = false; const tight = strict.filter(e => floorOK(e) && areaOK(e) && priceOK(e) && catOK(e));
  F.unknown = true; const loose = strict.filter(e => floorOK(e) && areaOK(e) && priceOK(e) && catOK(e));
  F.unknown = saved;
  matched = (saved ? loose : tight).slice().sort(SORTS[F.sort] || SORTS.floor);
  const hidden = loose.length - tight.length;
  $('pfCount').textContent = matched.length + '건';
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
  mark('pfGroup', v => v === F.group);
  mark('pfCat', v => v === '__all' ? F.cats.size === 0 : F.cats.has(v));
  mark('pfFloor', v => v === '__all' ? F.floors.size === 0 : F.floors.has(Number(v)));
  mark('pfDeal', v => v === '__all' ? F.deals.size === 0 : F.deals.has(v));
  mark('pfAreaQuick', v => v === areaKey());
}
function numInput(id, key, scale) {
  $(id).addEventListener('input', () => { const n = num($(id).value); F[key] = n == null ? null : n * (scale || 1); markDirty(); syncPicks(); });
}
function refreshBuildings() {
  const sel = $('pfBuilding'), keep = F.building;
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
function doSearch() {
  searched = true;
  $('pfGo').classList.remove('is-dirty'); $('pfDirty').hidden = true;
  $('pfIdle').hidden = true; $('pfResults').hidden = false;
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
function printList() {
  if (!matched.length) return;
  const cap = Math.min(matched.length, 500), list = $('pfList');
  list.replaceChildren(); matched.slice(0, cap).forEach(e => list.append(row(e)));
  const d = new Date();
  $('pfPrintCond').textContent = condText();
  $('pfPrintMeta').textContent = '총 ' + matched.length + '건' + (matched.length > cap ? ' 중 ' + cap + '건 인쇄' : '') + ' · ' + d.getFullYear() + '.' + String(d.getMonth() + 1).padStart(2, '0') + '.' + String(d.getDate()).padStart(2, '0') + ' 출력';
  const restore = () => { list.replaceChildren(); shown = 0; showMore(); };
  window.addEventListener('afterprint', restore, { once: true });
  window.print();
}
function reset() {
  Object.assign(F, { group: '', floors: new Set(), min: null, max: null, basis: 'ex', cats: new Set(), building: '', kw: '', deals: new Set(), depMin: null, depMax: null, rentMin: null, rentMax: null, saleMin: null, saleMax: null, status: 'open', unknown: false });
  $('pfQuick').value = ''; $('pfBasis').value = 'ex'; $('pfStatus').value = 'open';
  syncUI(); markDirty();
}
function init() {
  pick('pfGroup', v => { F.group = v; });
  pick('pfFloor', v => { if (v === '__all') F.floors.clear(); else toggleSet(F.floors, Number(v)); });
  pick('pfDeal', v => toggleSet(F.deals, v));
  pick('pfCat', v => { toggleSet(F.cats, v); refreshBuildings(); });
  pick('pfAreaQuick', v => { const [a, b] = v.split('-'); F.min = a === '' ? null : Number(a); F.max = b === '' ? null : Number(b); $('pfMin').value = F.min ?? ''; $('pfMax').value = F.max ?? ''; });
  numInput('pfMin', 'min'); numInput('pfMax', 'max'); numInput('pfDepMin', 'depMin'); numInput('pfDepMax', 'depMax'); numInput('pfRentMin', 'rentMin'); numInput('pfRentMax', 'rentMax'); numInput('pfSaleMin', 'saleMin', 10000); numInput('pfSaleMax', 'saleMax', 10000);
  $('pfKw').addEventListener('input', () => { F.kw = $('pfKw').value; markDirty(); });
  $('pfBuilding').addEventListener('change', () => { F.building = $('pfBuilding').value; markDirty(); });
  $('pfBasis').addEventListener('change', () => { F.basis = $('pfBasis').value; markDirty(); });
  $('pfStatus').addEventListener('change', () => { F.status = $('pfStatus').value; markDirty(); });
  $('pfUnknown').addEventListener('change', () => { F.unknown = $('pfUnknown').checked; markDirty(); });
  $('pfSort').addEventListener('change', () => { F.sort = $('pfSort').value; matched.sort(SORTS[F.sort] || SORTS.floor); $('pfList').replaceChildren(); shown = 0; showMore(); });
  $('pfMore').addEventListener('click', showMore);
  $('pfReset').addEventListener('click', reset);
  $('pfGo').addEventListener('click', doSearch);
  $('pfQuickForm').addEventListener('submit', ev => {
    ev.preventDefault();
    const q = parseQuick($('pfQuick').value);
    Object.assign(F, { group: q.group, floors: new Set([...q.floors].map(Number)), min: q.min, max: q.max, cats: q.cats, deals: q.deals, kw: q.kw, building: '' });
    syncUI(); doSearch();
  });
  $('pfPrint').addEventListener('click', printList);
  $('pfCopy').addEventListener('click', async () => {
    const lines = matched.slice(0, 60).map(e => [e.building || e.title, e.ho ? e.ho + '호' : '', fmtFloors(e), areaText(e).join('/'), priceLines(e).join(', ')].filter(Boolean).join(' | '));
    const t = '[하이탑 매물 ' + matched.length + '건' + (matched.length > 60 ? ' 중 60건' : '') + ']\n' + lines.join('\n');
    try { await navigator.clipboard.writeText(t); $('pfCopy').textContent = '복사했습니다'; } catch (_) { $('pfCopy').textContent = '복사 실패'; }
    setTimeout(() => { $('pfCopy').textContent = '결과 복사'; }, 1800);
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
async function start() {
  init();
  const status = $('pfStatusMsg');
  try {
    status.textContent = '매물과 자료를 불러오는 중입니다…';
    const data = await loadData();
    initKnown(data.resources, data.categories);
    ALL = buildEntries(data);
    buildCatChips();
    status.textContent = data.failed && data.failed.length ? '일부 자료를 읽지 못했습니다(' + data.failed.join(', ') + '). 결과가 부족할 수 있어요. 새로고침해 주세요.' : '';
    $('pfLoaded').textContent = '전체 ' + ALL.length + '건 중에서 찾습니다';
    const initial = new URLSearchParams(location.search).get('q');
    if (initial) { $('pfQuick').value = initial; $('pfQuickForm').requestSubmit(); } else { syncUI(); }
  } catch (e) {
    status.textContent = e.message === 'SESSION' ? '로그인 상태를 확인할 수 없습니다. 다시 로그인해 주세요.' : '자료를 불러오지 못했습니다. 새로고침해 주세요.';
  }
}
window.PropertyFinder = { parseQuick, parsePriceText, koMoney, parseFloors, floorFromHo, buildEntries, initKnown };
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
