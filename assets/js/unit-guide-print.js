// 손님용 호실 안내서(금액 자료 + 평면도 + 호실 위치 표시) 인쇄 도구.
// 1) 건물 상세(호실 현황): 줄마다 [인쇄] 버튼, 체크한 호실 [손님용 1장 인쇄] / [손님용 목록 인쇄]
// 2) 매물찾기 결과: window.UnitGuide 를 가져다 씀 (property-finder.js)
// 읽기 전용이다. 소유주·연락처는 인쇄하지 않고, 자료를 저장·수정하지 않는다.
(function () {
'use strict';
const $ = id => document.getElementById(id);
const ktop = typeof OfficeConfig !== 'undefined' && OfficeConfig.id === 'ktop';
const BRAND = ktop
  ? { name: 'KTOP부동산', foot: 'KTOP부동산' }
  : { name: '하이탑부동산', foot: '하이탑부동산공인중개사사무소     |     T. 031-949-8969' };
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ---------- 금액 글자 (단위는 만원) ----------
function won(val) {
  if (val === null || val === undefined || String(val).trim() === '') return null;
  let n = Number(String(val).replace(/,/g, ''));
  if (!isFinite(n) || n < 0) return null;
  if (n >= 1000000) n = n / 10000;
  return Math.round(n * 10000);
}
function korAmt(val) {
  const w = won(val); if (w === null) return '';
  if (w === 0) return '0원';
  const eok = Math.floor(w / 1e8), man = Math.floor((w % 1e8) / 1e4), rest = w % 1e4, p = [];
  if (eok) p.push(eok.toLocaleString('ko-KR') + (man || rest ? '억' : '억원'));
  if (man) p.push(man.toLocaleString('ko-KR') + (rest ? '만' : '만원'));
  if (rest) p.push(rest.toLocaleString('ko-KR') + '원');
  return p.join(' ');
}
function plainWon(val) { const w = won(val); return w === null ? '' : w.toLocaleString('ko-KR') + '원'; }
function floorKeyOf(room) {
  const s = String(room || '').trim();
  const bm = s.match(/^[Bb](\d)/); if (bm) return 'B' + bm[1];
  const nm = s.match(/^(\d+)/); if (nm) return String(Math.floor(parseInt(nm[1], 10) / 100) || parseInt(nm[1], 10));
  return '';
}
function planKey(label) {
  const s = String(label || '');
  const d = (s.match(/\d+/) || [''])[0];
  return /지하|^B/i.test(s) ? 'B' + d : d;
}
function floorText(fk) { return fk ? (fk[0] === 'B' ? '지하 ' + fk.slice(1) + '층' : fk + '층') : ''; }
const pyText = v => { const p = Number(v); return isFinite(p) && p > 0 ? p.toFixed(2) + '평 (' + (p * 3.30579).toFixed(2) + '㎡)' : ''; };

// ---------- 인쇄용 모양 ----------
function ensureStyle() {
  if ($('unitGuideStyle')) return;
  const style = document.createElement('style');
  style.id = 'unitGuideStyle';
  style.textContent = `
#unitGuideSheet{display:none}
@media print{
  @page{size:A4 portrait;margin:11mm 12mm 21mm 12mm}
  body>*:not(#unitGuideSheet){display:none!important}
  html,body{background:#fff!important;color:#000!important;margin:0!important;padding:0!important}
  #unitGuideSheet{display:block!important;font-family:Pretendard,"Malgun Gothic",sans-serif;color:#111}
  .ug-page{break-after:page;page-break-after:always;height:262mm;display:flex;flex-direction:column;overflow:hidden}
  .ug-page:last-child{break-after:auto;page-break-after:auto}
  .ug-top{display:flex;justify-content:space-between;align-items:baseline;border-bottom:2px solid #17473f;padding-bottom:5px;margin-bottom:10px}
  .ug-brand{font-size:15px;font-weight:800;color:#17473f}
  .ug-doc{font-size:12px;color:#555;letter-spacing:.08em}
  .ug-title{font-size:30px;font-weight:800;margin:0;letter-spacing:-.02em;line-height:1.2}
  .ug-title small{font-size:17px;font-weight:700;color:#17473f;margin-left:8px}
  .ug-addr{font-size:12.5px;color:#444;margin:3px 0 12px}
  .ug-price{border:2px solid #17473f;border-radius:6px;padding:9px 14px;margin-bottom:10px}
  .ug-price .row{display:flex;justify-content:space-between;align-items:baseline;gap:12px;padding:2px 0}
  .ug-price .lb{font-size:13px;font-weight:700;color:#17473f}
  .ug-price .big{font-size:24px;font-weight:800;letter-spacing:-.02em}
  .ug-price .mid{font-size:17px;font-weight:800}
  .ug-price .vat{font-size:11px;color:#555;font-weight:500;margin-left:6px}
  .ug-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:0;border:1px solid #bbb;border-radius:4px;margin-bottom:10px}
  .ug-cell{padding:6px 10px;border-right:1px solid #ddd;border-bottom:1px solid #ddd}
  .ug-cell:nth-child(3n){border-right:0}
  .ug-cell .k{display:block;font-size:10.5px;color:#666;margin-bottom:1px}
  .ug-cell .v{font-size:14px;font-weight:700}
  .ug-plan{flex:1;min-height:0;display:flex;flex-direction:column}
  .ug-plan-cap{font-size:12.5px;font-weight:800;color:#17473f;margin-bottom:5px}
  .ug-plan-cap span{font-weight:500;color:#666;margin-left:8px;font-size:11.5px}
  .ug-plan-box{position:relative;flex:1;min-height:0;display:flex;align-items:center;justify-content:center;border:1px solid #bbb;border-radius:4px;background:#fff}
  .ug-plan-inner{position:relative;display:inline-block;line-height:0;max-width:100%;max-height:100%}
  .ug-plan-inner img{display:block;max-width:100%;max-height:150mm;width:auto;height:auto}
  .ug-pin{position:absolute;width:11mm;height:11mm;margin:-5.5mm 0 0 -5.5mm;border:3.2px solid #d62828;border-radius:50%;box-sizing:border-box}
  .ug-pin::after{content:"";position:absolute;left:50%;top:50%;width:2.2mm;height:2.2mm;margin:-1.1mm 0 0 -1.1mm;border-radius:50%;border:2px solid #d62828;box-sizing:border-box}
  .ug-noplan{display:flex;align-items:center;justify-content:center;color:#888;font-size:13px;height:100%}
  .ug-note{font-size:10px;color:#666;margin:6px 0 0;line-height:1.4}
  .ul-page{font-family:Pretendard,"Malgun Gothic",sans-serif;color:#111}
  .ul-title{font-size:22px;font-weight:800;margin:0 0 2px}
  .ul-sub{font-size:12px;color:#555;margin:0 0 10px}
  .ul-table{width:100%;border-collapse:collapse;font-size:12.5px}
  .ul-table thead{display:table-header-group}
  .ul-table th{background:#e6f2f0;color:#17473f;font-weight:800;padding:6px;text-align:left;border-bottom:2px solid #17473f;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .ul-table td{padding:6px;border-bottom:1px solid #ddd;vertical-align:middle}
  .ul-table tr{break-inside:avoid;page-break-inside:avoid}
  .ul-table .num{text-align:right;white-space:nowrap}
  .ul-table .ho{font-weight:800;font-size:14px}
  .ul-table .pr{font-weight:800}
}`;
  document.head.appendChild(style);
}

// ---------- 안내서 한 장 (d: 보여 줄 값 묶음) ----------
// d = { name, addr, ho, fk, amount, amountLabel, vat, deposit, rent, cells:[[이름,값]], planUrl, pos:{x,y} }
function guideHtml(d) {
  const rows = [];
  if (d.amount !== null && d.amount !== undefined && won(d.amount) !== null) {
    const vat = d.vat && d.vat !== '미표기' ? '<span class="vat">' + esc(d.vat) + '</span>' : '';
    rows.push('<div class="row"><span class="lb">' + esc(d.amountLabel || '매매가') + '</span><span class="big">' + esc(plainWon(d.amount)) + vat + '</span></div>');
  }
  const dep = korAmt(d.deposit), rent = korAmt(d.rent);
  if (dep || rent) rows.push('<div class="row"><span class="lb">보증금 / 월세</span><span class="mid">' + esc(dep || '-') + ' / ' + esc(rent || '-') + '</span></div>');
  const cells = (d.cells || []).filter(c => c[1]).map(c => '<div class="ug-cell"><span class="k">' + esc(c[0]) + '</span><span class="v">' + esc(c[1]) + '</span></div>');
  const hoLabel = d.ho ? String(d.ho).replace(/호$/, '') + '호' : '';
  let planHtml = '<div class="ug-noplan">이 층의 평면도 자료가 없습니다.</div>';
  let cap = (d.fk ? floorText(d.fk) + ' ' : '') + '평면도';
  if (d.planUrl) {
    const pos = d.pos;
    const pin = pos && isFinite(Number(pos.x)) && isFinite(Number(pos.y))
      ? '<span class="ug-pin" style="left:' + Number(pos.x) + '%;top:' + Number(pos.y) + '%"></span>' : '';
    planHtml = '<div class="ug-plan-inner"><img src="' + esc(d.planUrl) + '" alt="' + esc(cap) + '">' + pin + '</div>';
    if (pin) cap += '<span>빨간 원이 ' + esc(hoLabel) + ' 위치입니다</span>';
  }
  return '<section class="ug-page"><div class="ug-top"><span class="ug-brand">' + esc(BRAND.name) + '</span><span class="ug-doc">호실 안내서</span></div>'
    + '<h1 class="ug-title">' + esc(d.name) + (hoLabel ? '<small>' + esc(hoLabel) + '</small>' : '') + '</h1><div class="ug-addr">' + esc(d.addr || '') + '</div>'
    + (rows.length ? '<div class="ug-price">' + rows.join('') + '</div>' : '')
    + (cells.length ? '<div class="ug-grid">' + cells.join('') + '</div>' : '')
    + '<div class="ug-plan"><div class="ug-plan-cap">' + cap + '</div><div class="ug-plan-box">' + planHtml + '</div></div>'
    + '<p class="ug-note">※ 이 자료는 참고용입니다. 금액과 면적은 등록된 자료 기준이며 실제와 다를 수 있으니 계약 전에 꼭 확인해 주세요.</p></section>';
}
// 층 평면도 목록에서 그 층 그림과 호실 위치를 찾는다
// 호실의 층: 등록된 층 숫자가 있으면 그것을 쓴다 (B동 B101처럼 B로 시작하는 호수를 지하로 오해하지 않도록)
function unitFloorKey(u) {
  const f = String((u && u.층) == null ? '' : u.층).trim();
  return /^\d+$/.test(f) ? f : floorKeyOf(u && u.호수);
}
// 도면 이름이 "1·2층", "1,2층", "1~2층"처럼 여러 층이면 각 층에서 모두 쓴다
function planHasFloor(label, fk) {
  const s = String(label || '');
  if (planKey(s) === fk) return true;
  if (/지하|^B/i.test(s)) return false;
  const nums = s.match(/\d+/g) || [];
  if (nums.length < 2) return false;
  if (/[~\-]/.test(s) && nums.length === 2) { const a = +nums[0], b = +nums[1]; if (a <= b && b - a <= 60) { for (let i = a; i <= b; i++) if (String(i) === fk) return true; } return false; }
  return nums.includes(fk);
}
function pickPlan(floors, fk, unit) {
  const plan = (floors || []).find(f => planHasFloor(f.floor_number, fk));
  if (!plan || !plan.cloudinary_url) return { planUrl: '', pos: null };
  const pp = unit && unit.plan_positions && unit.plan_positions[plan.id];
  const pos = pp && (pp[fk] || Object.values(pp)[0]);
  return { planUrl: plan.cloudinary_url, pos: pos || null };
}

// 건물 상세 화면의 호실(u) 하나를 d 로 바꾼다
function guideDataFromUnit(u, name, addr, floors) {
  const eco = typeof CommercialPriceCore !== 'undefined' ? CommercialPriceCore.economics(u, true) : {};
  const fk = unitFloorKey(u);
  const plan = pickPlan(floors, fk, u);
  return {
    name, addr, ho: u.호수, fk,
    amount: eco.amount, amountLabel: eco.status === '분양중' ? '분양가' : '매매가', vat: u.분양_VAT,
    deposit: eco.deposit, rent: eco.rent,
    cells: [
      ['층', floorText(fk)], ['전용면적', pyText(u.전용_평)], ['분양면적', pyText(u.분양_평)],
      ['현재 업종', u.현업종 && u.현업종 !== '공실' ? u.현업종 : ''], ['임대 현황', u.공실여부], ['분양 상태', u.분양상태],
      ['관리비', u.관리비 ? korAmt(u.관리비) : ''], ['용도지역', u.용도지역], ['옵션', u.옵션내역]
    ],
    planUrl: plan.planUrl, pos: plan.pos
  };
}

// ---------- 목록 한 장 ----------
// rows: [{ho, biz, ex, occ, amountLabel, amount, deposit, rent}]
function listHtml(rows, name, addr) {
  const today = new Date().toLocaleDateString('ko-KR');
  const body = rows.map(r => {
    const pr = r.amount !== null && r.amount !== undefined && won(r.amount) !== null ? plainWon(r.amount) : '';
    return '<tr><td class="ho">' + esc(r.ho) + '</td><td>' + esc(r.biz || '-') + '</td><td class="num">' + esc(r.ex || '-') + '</td><td>' + esc(r.occ || '-') + '</td><td class="num pr">'
      + (pr ? '<small style="font-weight:500;color:#666">' + esc(r.amountLabel || '매매') + '</small> ' + esc(pr) : '-') + '</td><td class="num">' + esc(korAmt(r.deposit) || '-') + '</td><td class="num">' + esc(korAmt(r.rent) || '-') + '</td></tr>';
  }).join('');
  return '<section class="ul-page"><div class="ug-top"><span class="ug-brand">' + esc(BRAND.name) + '</span><span class="ug-doc">호실 목록</span></div>'
    + '<h1 class="ul-title">' + esc(name) + ' <small style="font-size:14px;color:#17473f">' + rows.length + '개 호실</small></h1>'
    + '<p class="ul-sub">' + esc(addr || '') + ' · 출력일 ' + esc(today) + '</p>'
    + '<table class="ul-table"><thead><tr><th>호수</th><th>업종</th><th class="num">전용</th><th>임대 현황</th><th class="num">금액</th><th class="num">보증금</th><th class="num">월세</th></tr></thead><tbody>' + body + '</tbody></table>'
    + '<p class="ug-note">※ 이 자료는 참고용입니다. 금액과 면적은 등록된 자료 기준이며 실제와 다를 수 있으니 계약 전에 꼭 확인해 주세요.</p></section>';
}

// ---------- 인쇄창 열기 (그림이 다 불러와진 뒤) ----------
async function printHtml(html) {
  ensureStyle();
  document.getElementById('unitGuideSheet')?.remove();
  document.getElementById('unitGuideBoxes')?.remove();
  const sheet = document.createElement('div');
  sheet.id = 'unitGuideSheet';
  sheet.innerHTML = html;
  document.body.appendChild(sheet);
  const q = s => '"' + String(s).replace(/"/g, '') + '"';
  const pb = document.createElement('style');
  pb.id = 'unitGuideBoxes';
  pb.textContent = '@page{@bottom-center{content:' + q(BRAND.foot) + ';font:800 14px Pretendard,"Malgun Gothic",sans-serif;letter-spacing:.02em;color:#17473f;background:linear-gradient(90deg,#e6f2f0,#f6fbfa);border:1px solid #9fc4be;border-left:5px solid #25675f;border-radius:4px;margin:3mm 0 5mm;padding:0 10mm;text-align:center;vertical-align:middle;white-space:nowrap;-webkit-print-color-adjust:exact;print-color-adjust:exact}}';
  document.head.appendChild(pb);
  await Promise.all([...sheet.querySelectorAll('img')].map(img => img.complete ? null : new Promise(r => { img.onload = img.onerror = r; })));
  const cleanup = () => { sheet.remove(); pb.remove(); };
  window.addEventListener('afterprint', cleanup, { once: true });
  window.print();
}


// ---------- 도면에서 호실 위치 한 번 찍기 (인쇄할 때만 쓰고, 저장은 선택) ----------
function pickPosition(o) {
  return new Promise(resolve => {
    if (!document.getElementById('ugPickStyle')) {
      const st = document.createElement('style'); st.id = 'ugPickStyle';
      st.textContent = '#ugPick{position:fixed;inset:0;z-index:99999;background:rgba(15,30,28,.55);display:flex;align-items:center;justify-content:center;font-family:Pretendard,"Malgun Gothic",sans-serif}'
        + '#ugPick .ugp-card{background:#fff;border-radius:12px;width:min(1000px,94vw);max-height:94vh;display:flex;flex-direction:column;padding:14px 16px;box-shadow:0 12px 40px rgba(0,0,0,.3)}'
        + '#ugPick .ugp-head{display:flex;align-items:baseline;gap:10px}'
        + '#ugPick .ugp-head b{font-size:1.15rem;color:#17473f}#ugPick .ugp-head span{color:#667;font-size:.85rem}'
        + '#ugPick .ugp-x{margin-left:auto;border:0;background:none;font-size:1.2rem;cursor:pointer;color:#667}'
        + '#ugPick .ugp-tip{margin:6px 0;padding:6px 10px;background:#eef7f4;border-radius:6px;font-size:.88rem;color:#1f5b4d}'
        + '#ugPick .ugp-tools{display:flex;gap:6px;margin-bottom:6px;align-items:center;font-size:.8rem;color:#667}'
        + '#ugPick button{font:inherit;font-size:.85rem;padding:5px 12px;border:1px solid #c9d6d2;border-radius:7px;background:#fff;color:#334;cursor:pointer}'
        + '#ugPick button.on{background:#e3f4ed;border-color:#8fc9b6;font-weight:700}'
        + '#ugPick .ugp-scroll{flex:1;min-height:200px;overflow:auto;border:1px solid #ccd;border-radius:8px;background:#f6f8f7}'
        + '#ugPick .ugp-inner{position:relative;width:100%;line-height:0;cursor:crosshair}'
        + '#ugPick .ugp-inner img{width:100%;height:auto;display:block;user-select:none;-webkit-user-drag:none}'
        + '#ugPick .ugp-pin{position:absolute;width:30px;height:30px;margin:-15px 0 0 -15px;border:3px solid #d62828;border-radius:50%;box-sizing:border-box;background:rgba(214,40,40,.12);pointer-events:none}'
        + '#ugPick .ugp-foot{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-top:10px;font-size:.85rem;color:#445;flex-wrap:wrap}'
        + '#ugPick .ugp-foot span{display:flex;gap:6px}#ugPick .ugp-foot label{display:flex;align-items:center;gap:6px;margin:0;color:#445;font-size:.85rem;font-weight:500;opacity:1;cursor:pointer}#ugPick .ugp-foot input{margin:0;width:auto;height:auto}'
        + '#ugPick button.go{background:#1f6b57;border-color:#1f6b57;color:#fff;font-weight:700}#ugPick button.go:disabled{opacity:.4;cursor:default}';
      document.head.appendChild(st);
    }
    const ov = document.createElement('div'); ov.id = 'ugPick';
    ov.innerHTML = '<div class="ugp-card"><div class="ugp-head"><b>' + esc(o.ho) + ' 위치 찍기</b><span>' + esc(o.title) + '</span><button type="button" class="ugp-x" data-a="cancel" title="닫기">✕</button></div>'
      + '<div class="ugp-tip">도면에서 이 호실 자리를 한 번 누르세요. 다시 누르면 옮겨져요.</div>'
      + '<div class="ugp-tools">크기 <button type="button" data-z="1" class="on">보통</button><button type="button" data-z="2">크게</button><button type="button" data-z="3">더 크게</button></div>'
      + '<div class="ugp-scroll"><div class="ugp-inner"><img src="' + esc(o.planUrl) + '" alt="평면도" draggable="false"></div></div>'
      + '<div class="ugp-foot">' + (o.canSave ? '<label><input type="checkbox" id="ugpSave"> 이 위치를 저장해 두기 (다음부터 자동으로 나와요)</label>' : '<span></span>')
      + '<span><button type="button" data-a="nopos">위치 없이 인쇄</button><button type="button" data-a="cancel">취소</button><button type="button" class="go" data-a="go" disabled>이대로 인쇄</button></span></div></div>';
    document.body.appendChild(ov);
    const inner = ov.querySelector('.ugp-inner'), go = ov.querySelector('[data-a=go]');
    let pos = null, pin = null;
    const done = v => { document.removeEventListener('keydown', onKey, true); ov.remove(); resolve(v); };
    const onKey = e => { if (e.key === 'Escape') { e.stopPropagation(); done(null); } };
    document.addEventListener('keydown', onKey, true);
    inner.addEventListener('click', e => {
      const r = inner.getBoundingClientRect();
      pos = { x: Math.round((e.clientX - r.left) / r.width * 10000) / 100, y: Math.round((e.clientY - r.top) / r.height * 10000) / 100 };
      if (!pin) { pin = document.createElement('span'); pin.className = 'ugp-pin'; inner.appendChild(pin); }
      pin.style.left = pos.x + '%'; pin.style.top = pos.y + '%';
      go.disabled = false;
    });
    ov.addEventListener('click', e => {
      const z = e.target.closest && e.target.closest('[data-z]');
      if (z) { inner.style.width = (Number(z.dataset.z) * 100) + '%'; ov.querySelectorAll('[data-z]').forEach(b => b.classList.toggle('on', b === z)); return; }
      const a = e.target.closest && e.target.closest('[data-a]'); if (!a) { if (e.target === ov) done(null); return; }
      if (a.dataset.a === 'cancel') done(null);
      else if (a.dataset.a === 'nopos') done({ pos: null, save: false });
      else if (a.dataset.a === 'go' && pos) done({ pos, save: !!(ov.querySelector('#ugpSave') || {}).checked });
    });
  });
}
async function savePosition(name, ho, plan, fk, pos) {
  const rec = await getBuildingRecord(name);
  if (!rec || !Array.isArray(rec.units)) throw new Error('건물 호실 자료를 찾지 못했습니다.');
  if (!rec.units.some(u => String(u.호수) === String(ho))) throw new Error(ho + '호를 다시 찾지 못했습니다.');
  const updated = rec.units.map(u => {
    if (String(u.호수) !== String(ho)) return u;
    const plans = { ...(u.plan_positions || {}) };
    plans[plan.id] = { ...(plans[plan.id] || {}), [fk]: pos };
    return { ...u, plan_positions: plans };
  });
  await saveBuildingUnits(rec.local_id, rec.name || name, updated);
}

window.UnitGuide = { guideHtml, listHtml, printHtml, pickPosition, pickPlan, floorKeyOf, planKey, floorText, pyText, korAmt, plainWon, guideDataFromUnit };

// =====================================================================
// 건물 상세(호실 현황) 화면 전용
// =====================================================================
if (!/building-detail/.test(location.pathname)) return;
const BTN = 'unitGuidePrint', LBTN = 'unitListPrint';

function residentialMode() { const t = ($('unitStatusTitle') || {}).textContent || ''; return /세대/.test(t); }
function hoOfRow(cb) {
  const cell = cb.closest('td') && cb.closest('td').nextElementSibling;
  const strong = cell && cell.querySelector('strong');
  return ((strong ? strong.textContent : (cell ? cell.textContent : '')).trim()) || '';
}
function selectedHos() { return [...document.querySelectorAll('#unitsTbody .unit-select-row:checked')].map(hoOfRow).filter(Boolean); }
function sync() {
  const n = selectedHos().length, res = residentialMode();
  const b = $(BTN);
  if (b) { b.hidden = res; b.disabled = n === 0; const t = n ? '손님용 1장 인쇄 (' + n + ')' : '손님용 1장 인쇄'; if (b.textContent !== t) b.textContent = t; }
  const l = $(LBTN);
  if (l) { l.hidden = res; l.disabled = n === 0; const t = n ? '손님용 목록 인쇄 (' + n + ')' : '손님용 목록 인쇄'; if (l.textContent !== t) l.textContent = t; }
}
function addRowButtons() {
  if (!document.getElementById('ugRowStyle')) {
    const st = document.createElement('style'); st.id = 'ugRowStyle';
    st.textContent = '.unit-select-cell .ug-row-btn{display:block;margin:6px 0 0 -2px;padding:3px 7px;font-size:.72rem;font-weight:600;line-height:1.2;background:#f3faf7;color:#1f6b57;border:1px solid #b7dccf;border-radius:6px;cursor:pointer}'
      + '.unit-select-cell .ug-row-btn:hover{background:#e3f4ed}'
      + '#unitsTbody td.tbl-actions .btn-unit-edit{background:#e8f3ff;color:#1d5fa8;border:1px solid #b9d5f5}'
      + '#unitsTbody td.tbl-actions .btn-unit-edit:hover{background:#d8eaff}'
      + '#unitsTbody td.tbl-actions .btn-unit-del{background:#fdeeee;color:#c0392b;border:1px solid #f1c3bf}'
      + '#unitsTbody td.tbl-actions .btn-unit-del:hover{background:#fbdcdc}';
    document.head.appendChild(st);
  }
  if (residentialMode()) return;
  document.querySelectorAll('#unitsTbody tr').forEach(tr => {
    const old = tr.querySelector('.tbl-actions .ug-row-btn'); if (old) old.remove();
    const cell = tr.querySelector('.unit-select-cell');
    if (!cell || cell.querySelector('.ug-row-btn')) return;
    const strong = tr.children[1] && tr.children[1].querySelector('strong');
    if (!strong) return;
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'ug-row-btn'; b.textContent = '인쇄';
    b.title = strong.textContent.trim() + '호 손님용 1장 인쇄';
    b.addEventListener('click', e => { e.stopPropagation(); run([strong.textContent.trim()], 'guide', b); });
    cell.appendChild(b);
  });
}
function mount() {
  addRowButtons();
  const anchor = $('unitSelectPrint');
  if (!anchor || $(BTN)) return !!$(BTN);
  const b = document.createElement('button');
  b.type = 'button'; b.className = 'btn-unit-ghost'; b.id = BTN; b.disabled = true;
  b.title = '선택한 호실마다 금액 자료와 평면도를 A4 한 장에 인쇄합니다';
  b.textContent = '손님용 1장 인쇄';
  anchor.after(b);
  b.addEventListener('click', () => run(selectedHos(), 'guide'));
  const l = document.createElement('button');
  l.type = 'button'; l.className = 'btn-unit-ghost'; l.id = LBTN; l.disabled = true;
  l.title = '선택한 호실을 표 한 장으로 인쇄합니다(소유주·연락처는 빼고 인쇄)';
  l.textContent = '손님용 목록 인쇄';
  b.after(l);
  l.addEventListener('click', () => run(selectedHos(), 'list'));
  sync();
  return true;
}
function buildingAddress() {
  const cell = [...document.querySelectorAll('.info-cell')].find(c => /주소/.test((c.querySelector('.info-cell-label') || {}).textContent || ''));
  return cell ? ((cell.querySelector('.info-cell-value') || {}).textContent || '').trim() : '';
}
async function run(hos, mode, btn) {
  if (!hos || !hos.length) return;
  const b = btn || $(mode === 'list' ? LBTN : BTN); b.disabled = true;
  const old = b.textContent; if (!btn) b.textContent = '준비 중…';
  try {
    const name = (($('buildingName') || {}).textContent || '').trim();
    const token = (await hitopAuthClient.auth.getSession()).data.session.access_token;
    const rec = await getBuildingRecord(name);
    const units = (rec && rec.units) || [];
    const picked = hos.map(h => units.find(u => String(u.호수) === String(h))).filter(Boolean);
    if (!picked.length) throw new Error('호실 자료를 찾지 못했습니다.');
    const addr = buildingAddress();
    if (mode === 'list') {
      const list = picked.map(u => {
        const e = CommercialPriceCore.economics(u, true);
        return { ho: u.호수, biz: u.현업종 && u.현업종 !== '공실' ? u.현업종 : '', ex: pyText(u.전용_평).replace(/ \(.*$/, ''), occ: u.공실여부, amountLabel: e.status === '분양중' ? '분양' : '매매', amount: e.amount, deposit: e.deposit, rent: e.rent };
      });
      await printHtml(listHtml(list, name, addr));
    } else {
      let floors = []; try { floors = await getBuildingFloors(buildingId); } catch (_) { /* 평면도 없이 인쇄 */ }
      const datas = picked.map(u => guideDataFromUnit(u, name, addr, floors));
      if (btn && picked.length === 1) {
        const u = picked[0], d = datas[0];
        if (d.planUrl && !d.pos) {
          const plan = (floors || []).find(f => planHasFloor(f.floor_number, d.fk));
          const r = await pickPosition({ planUrl: d.planUrl, ho: String(u.호수).replace(/호$/, '') + '호', title: floorText(d.fk) + ' 평면도', canSave: !!plan && typeof getBuildingRecord === 'function' && typeof saveBuildingUnits === 'function' });
          if (!r) return;
          if (r.pos) {
            d.pos = r.pos;
            if (r.save && plan) { try { await savePosition(name, u.호수, plan, d.fk, r.pos); } catch (err) { alert('위치 저장은 못 했어요. 인쇄는 계속합니다: ' + err.message); } }
          }
        }
      }
      await printHtml(datas.map(guideHtml).join(''));
    }
  } catch (e) {
    alert('손님용 안내서를 만들지 못했습니다: ' + e.message);
  } finally {
    b.disabled = false; if (!btn) b.textContent = old; sync();
  }
}

document.addEventListener('change', e => { if (e.target && (e.target.classList.contains('unit-select-row') || e.target.id === 'unitSelectAll')) setTimeout(sync, 0); });
const mo = new MutationObserver(() => { mount(); sync(); });
mo.observe(document.body, { childList: true, subtree: true });
mount();
})();
