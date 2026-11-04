// 건물 상세(호실 현황): 손님에게 드릴 "호실 안내서"를 A4 한 장에 인쇄한다.
// 호실 금액 자료와 그 층의 평면도(호실 위치 표시 포함)를 한 장에 담는다.
// 읽기 전용이다. 소유주·연락처는 인쇄하지 않고, 자료를 저장·수정하지 않는다.
(function () {
'use strict';
const $ = id => document.getElementById(id);
const BTN = 'unitGuidePrint';
const ktop = typeof OfficeConfig !== 'undefined' && OfficeConfig.id === 'ktop';
const BRAND = ktop
  ? { name: 'KTOP부동산', foot: 'KTOP부동산' }
  : { name: '하이탑부동산', foot: '하이탑부동산공인중개사사무소     |     T. 031-949-8969' };
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ---------- 금액 글자 (호실 표와 같은 방식, 단위는 만원) ----------
function won(val) {
  if (val === null || val === undefined || String(val).trim() === '') return null;
  let n = Number(String(val).replace(/,/g, ''));
  if (!isFinite(n) || n < 0) return null;
  if (n >= 1000000) n = n / 10000; // 원 단위로 적힌 값 보정
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
const pyText = v => { const p = Number(v); return isFinite(p) && p > 0 ? p.toFixed(2) + '평 (' + (p * 3.30579).toFixed(2) + '㎡)' : ''; };

// ---------- 화면: 버튼 ----------
const style = document.createElement('style');
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
  .ug-pin-label{position:absolute;left:50%;top:-6.5mm;transform:translateX(-50%);font-size:13px;font-weight:800;color:#d62828;white-space:nowrap;line-height:1;text-shadow:0 0 3px #fff,0 0 3px #fff,0 0 3px #fff}
  .ug-noplan{display:flex;align-items:center;justify-content:center;color:#888;font-size:13px;height:100%}
  .ug-note{font-size:10px;color:#666;margin:6px 0 0;line-height:1.4}
}`;
document.head.appendChild(style);

function residentialMode() { const t = ($('unitStatusTitle') || {}).textContent || ''; return /세대/.test(t); }
function selectedHos() {
  return [...document.querySelectorAll('#unitsTbody .unit-select-row:checked')].map(cb => {
    const cell = cb.closest('td') && cb.closest('td').nextElementSibling;
    const strong = cell && cell.querySelector('strong');
    return ((strong ? strong.textContent : (cell ? cell.textContent : '')).trim()) || '';
  }).filter(Boolean);
}
function sync() {
  const b = $(BTN); if (!b) return;
  const n = selectedHos().length;
  b.hidden = residentialMode();
  b.disabled = n === 0;
  const t = n ? '손님용 1장 인쇄 (' + n + ')' : '손님용 1장 인쇄';
  if (b.textContent !== t) b.textContent = t;
}
function mount() {
  const anchor = $('unitSelectPrint');
  if (!anchor || $(BTN)) return !!$(BTN);
  const b = document.createElement('button');
  b.type = 'button'; b.className = 'btn-unit-ghost'; b.id = BTN; b.disabled = true;
  b.title = '선택한 호실마다 금액 자료와 평면도를 A4 한 장에 인쇄합니다';
  b.textContent = '손님용 1장 인쇄';
  anchor.after(b);
  b.addEventListener('click', run);
  sync();
  return true;
}

// ---------- 안내서 만들기 ----------
function buildingAddress() {
  const cell = [...document.querySelectorAll('.info-cell')].find(c => /주소/.test((c.querySelector('.info-cell-label') || {}).textContent || ''));
  return cell ? ((cell.querySelector('.info-cell-value') || {}).textContent || '').trim() : '';
}
function sheetFor(u, name, addr, floors) {
  const eco = typeof CommercialPriceCore !== 'undefined' ? CommercialPriceCore.economics(u, true) : {};
  const fk = floorKeyOf(u.호수);
  const plan = floors.find(f => planKey(f.floor_number) === fk);
  const rows = [];
  if (eco.amount !== null && eco.amount !== undefined) {
    const vat = u.분양_VAT && u.분양_VAT !== '미표기' ? '<span class="vat">' + esc(u.분양_VAT) + '</span>' : '';
    rows.push('<div class="row"><span class="lb">' + (eco.status === '분양중' ? '분양가' : '매매가') + '</span><span class="big">' + esc(plainWon(eco.amount)) + vat + '</span></div>');
  }
  const dep = korAmt(eco.deposit), rent = korAmt(eco.rent);
  if (dep || rent) rows.push('<div class="row"><span class="lb">보증금 / 월세</span><span class="mid">' + esc(dep || '-') + ' / ' + esc(rent || '-') + '</span></div>');
  const cells = [];
  const add = (k, v) => { if (v) cells.push('<div class="ug-cell"><span class="k">' + k + '</span><span class="v">' + esc(v) + '</span></div>'); };
  add('층', fk ? (fk[0] === 'B' ? '지하 ' + fk.slice(1) + '층' : fk + '층') : '');
  add('전용면적', pyText(u.전용_평));
  add('분양면적', pyText(u.분양_평));
  add('현재 업종', u.현업종 && u.현업종 !== '공실' ? u.현업종 : '');
  add('임대 현황', u.공실여부);
  add('분양 상태', u.분양상태);
  add('관리비', u.관리비 ? korAmt(u.관리비) : '');
  add('용도지역', u.용도지역);
  add('옵션', u.옵션내역);
  let planHtml = '<div class="ug-noplan">이 층의 평면도 자료가 없습니다.</div>', cap = (fk ? (fk[0] === 'B' ? '지하 ' + fk.slice(1) : fk) + '층 ' : '') + '평면도';
  if (plan && plan.cloudinary_url) {
    const pp = u.plan_positions && u.plan_positions[plan.id];
    const pos = pp && (pp[fk] || Object.values(pp)[0]);
    const pin = pos && isFinite(Number(pos.x)) && isFinite(Number(pos.y))
      ? '<span class="ug-pin" style="left:' + Number(pos.x) + '%;top:' + Number(pos.y) + '%"></span>' : '';
    planHtml = '<div class="ug-plan-inner"><img src="' + esc(plan.cloudinary_url) + '" alt="' + esc(cap) + '">' + pin + '</div>';
    if (pin) cap += '<span>빨간 원이 ' + esc(u.호수) + '호 위치입니다</span>';
  }
  return '<section class="ug-page"><div class="ug-top"><span class="ug-brand">' + esc(BRAND.name) + '</span><span class="ug-doc">호실 안내서</span></div>'
    + '<h1 class="ug-title">' + esc(name) + '<small>' + esc(u.호수) + '호</small></h1><div class="ug-addr">' + esc(addr) + '</div>'
    + (rows.length ? '<div class="ug-price">' + rows.join('') + '</div>' : '')
    + (cells.length ? '<div class="ug-grid">' + cells.join('') + '</div>' : '')
    + '<div class="ug-plan"><div class="ug-plan-cap">' + cap + '</div><div class="ug-plan-box">' + planHtml + '</div></div>'
    + '<p class="ug-note">※ 이 자료는 참고용입니다. 금액과 면적은 등록된 자료 기준이며 실제와 다를 수 있으니 계약 전에 꼭 확인해 주세요.</p></section>';
}
async function run() {
  const hos = selectedHos(); if (!hos.length) return;
  const b = $(BTN); b.disabled = true;
  const old = b.textContent; b.textContent = '준비 중…';
  try {
    const name = (($('buildingName') || {}).textContent || '').trim();
    const token = (await hitopAuthClient.auth.getSession()).data.session.access_token;
    const res = await fetch(SUPABASE_URL + '/rest/v1/buildings?select=units&name=eq.' + encodeURIComponent(name), { headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + token } });
    const rows = await res.json();
    const units = (rows[0] && rows[0].units) || [];
    let floors = []; try { floors = await getBuildingFloors(buildingId); } catch (_) { /* 평면도 없이 인쇄 */ }
    const picked = hos.map(h => units.find(u => String(u.호수) === String(h))).filter(Boolean);
    if (!picked.length) throw new Error('호실 자료를 찾지 못했습니다.');
    const addr = buildingAddress();
    const sheet = document.createElement('div');
    sheet.id = 'unitGuideSheet';
    sheet.innerHTML = picked.map(u => sheetFor(u, name, addr, floors)).join('');
    document.body.appendChild(sheet);
    const q = s => '"' + String(s).replace(/"/g, '') + '"';
    const pb = document.createElement('style');
    pb.id = 'unitGuideBoxes';
    pb.textContent = '@page{@bottom-center{content:' + q(BRAND.foot) + ';font:800 14px Pretendard,"Malgun Gothic",sans-serif;letter-spacing:.02em;color:#17473f;background:linear-gradient(90deg,#e6f2f0,#f6fbfa);border:1px solid #9fc4be;border-left:5px solid #25675f;border-radius:4px;margin:3mm 0 5mm;padding:0 10mm;text-align:center;vertical-align:middle;white-space:nowrap;-webkit-print-color-adjust:exact;print-color-adjust:exact}}';
    document.head.appendChild(pb);
    // 평면도 그림이 다 불러와진 뒤에 인쇄창을 연다
    await Promise.all([...sheet.querySelectorAll('img')].map(img => img.complete ? null : new Promise(r => { img.onload = img.onerror = r; })));
    const cleanup = () => { sheet.remove(); pb.remove(); };
    window.addEventListener('afterprint', cleanup, { once: true });
    window.print();
  } catch (e) {
    alert('손님용 안내서를 만들지 못했습니다: ' + e.message);
  } finally {
    b.disabled = false; b.textContent = old; sync();
  }
}

// 호실 표가 늦게 그려져도 버튼을 붙이고, 체크가 바뀔 때마다 버튼 상태를 맞춘다
document.addEventListener('change', e => { if (e.target && (e.target.classList.contains('unit-select-row') || e.target.id === 'unitSelectAll')) setTimeout(sync, 0); });
const mo = new MutationObserver(() => { mount(); sync(); });
mo.observe(document.body, { childList: true, subtree: true });
mount();
})();
