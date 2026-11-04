// 자료관리 목록: 건물 카드를 체크해서 선택하고, 선택한 것만 또는 보이는 목록 전체를 인쇄한다.
// 읽기 전용이다. 자료를 저장·수정·삭제하지 않는다.
(function () {
'use strict';
const box = document.getElementById('driveContent');
if (!box) return;
const picked = new Set();
const ktop = typeof OfficeConfig !== 'undefined' && OfficeConfig.id === 'ktop';
const BRAND = ktop
  ? { title: 'KTOP부동산 자료 목록', foot: 'KTOP부동산' }
  : { title: '하이탑부동산 자료 목록', foot: '하이탑부동산공인중개사사무소     |     T. 031-949-8969' };
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ---------- 화면 모양 ----------
const style = document.createElement('style');
style.textContent = `
.res-tools{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:0 0 12px;padding:10px 12px;border:1px solid rgba(37,103,95,.25);border-radius:12px;background:rgba(37,103,95,.06)}
.res-tools label{display:inline-flex;align-items:center;gap:6px;font-size:14px;font-weight:700;cursor:pointer}
.res-tools .res-count{font-size:13px;opacity:.75}
.res-tools button{font:inherit;font-size:13px;font-weight:800;padding:7px 14px;border-radius:9px;border:1px solid rgba(37,103,95,.45);background:#fff;color:#1c4f4b;cursor:pointer}
.res-tools button.main{background:#25675f;color:#fff;border-color:#25675f}
.res-tools button:disabled{opacity:.45;cursor:default}
.res-tools .grow{flex:1}
.res-pick-wrap{display:inline-flex;align-items:center;margin-right:8px;vertical-align:middle;cursor:pointer}
.res-pick{width:18px;height:18px;accent-color:#25675f;cursor:pointer}
.listing-card.res-picked{outline:2px solid rgba(37,103,95,.55);outline-offset:-2px}
#resPrintSheet{display:none}
@media print{
  @page{size:A4 portrait;margin:17mm 11mm 21mm 11mm}
  @page :first{@top-left{content:none}@top-right{content:none}}
  body>*:not(#resPrintSheet){display:none!important}
  html,body{background:#fff!important;color:#000!important}
  #resPrintSheet{display:block!important;font-family:Pretendard,"Malgun Gothic",sans-serif;color:#000}
  #resPrintSheet .rp-head{margin:0 0 8px;padding-bottom:5px;border-bottom:2px solid #000}
  #resPrintSheet h2{margin:0 0 3px;font-size:19px}
  #resPrintSheet .rp-head p{margin:1px 0;font-size:11px}
  #resPrintSheet table{width:100%;border-collapse:collapse;font-size:12.5px}
  #resPrintSheet th{text-align:left;font-size:11px;color:#444;padding:4px 8px;border-bottom:1.5px solid #000}
  #resPrintSheet td{padding:7px 8px;border-bottom:1px solid #d9d9d9;vertical-align:top}
  #resPrintSheet tr{break-inside:avoid;page-break-inside:avoid}
  #resPrintSheet table,#resPrintSheet thead,#resPrintSheet tbody,#resPrintSheet tr,#resPrintSheet th,#resPrintSheet td{background:none!important;box-shadow:none!important}
  #resPrintSheet .no{color:#777;width:26px}
  #resPrintSheet .nm{font-weight:800;font-size:13px}
  #resPrintSheet .cat{color:#444}
}`;
document.head.appendChild(style);

// ---------- 카드에서 건물 찾기 ----------
function cardId(card) {
  const b = card.querySelector('[onclick*="openDriveBuilding"]');
  const m = b && (b.getAttribute('onclick') || '').match(/openDriveBuilding\('[^']+','([^']+)'\)/);
  return m ? m[1] : '';
}
function resourceOf(id) {
  return (typeof allDriveResources !== 'undefined' ? allDriveResources : []).find(r => String(r.id) === String(id));
}
function addressOf(r) {
  const line = String((r && r.memo) || '').split('\n').find(x => /^주소\s*:/.test(x));
  return line ? line.replace(/^주소\s*:/, '').trim() : '';
}
function linkedCount(id) {
  return (typeof allListings !== 'undefined' ? allListings : []).filter(l => String(l.resource_id) === String(id)).length;
}
function shownCards() { return [...box.querySelectorAll('.listing-card')].filter(c => cardId(c)); }

const setText = (el, t) => { if (el.textContent !== t) el.textContent = t; }; // 같은 글자면 건드리지 않는다(무한 갱신 방지)

// ---------- 체크 칸과 도구줄 ----------
function decorate() {
  const cards = shownCards();
  cards.forEach(card => {
    const id = cardId(card);
    if (!card.querySelector('.res-pick')) {
      const name = card.querySelector('span');
      const wrap = document.createElement('label');
      wrap.className = 'res-pick-wrap';
      wrap.title = '선택';
      const cb = document.createElement('input');
      cb.type = 'checkbox'; cb.className = 'res-pick'; cb.dataset.id = id; cb.setAttribute('aria-label', '건물 선택');
      cb.addEventListener('click', e => e.stopPropagation());
      wrap.append(cb);
      if (name && name.parentNode) name.parentNode.insertBefore(wrap, name);
    }
    const cb = card.querySelector('.res-pick');
    cb.checked = picked.has(id);
    card.classList.toggle('res-picked', cb.checked);
  });
  let tools = box.querySelector('.res-tools');
  if (!tools && cards.length) {
    tools = document.createElement('div');
    tools.className = 'res-tools';
    tools.innerHTML = '<label><input type="checkbox" id="resPickAll" class="res-pick"> 전체 선택</label><span class="res-count" id="resCount"></span><span class="grow"></span>'
      + '<button type="button" class="main" id="resPrintSel" disabled>선택 인쇄</button><button type="button" id="resPrintAll">보이는 목록 인쇄</button>';
    const sec = box.querySelector('.drive-section');
    if (sec && sec.parentNode) sec.parentNode.insertBefore(tools, sec);
    else { const host = box.querySelector('.quick-card') || box; host.insertBefore(tools, host.firstChild); }
    tools.querySelector('#resPickAll').addEventListener('change', e => {
      shownCards().forEach(c => { const id = cardId(c); e.target.checked ? picked.add(id) : picked.delete(id); });
      decorate();
    });
    tools.querySelector('#resPrintSel').addEventListener('click', () => printIds(shownCards().map(cardId).filter(id => picked.has(id)), '선택한 건물'));
    tools.querySelector('#resPrintAll').addEventListener('click', () => printIds(shownCards().map(cardId), currentTitle()));
  }
  if (tools) {
    const ids = cards.map(cardId), n = ids.filter(id => picked.has(id)).length;
    setText(tools.querySelector('#resCount'), n ? ('선택 ' + n + '건 / 보이는 목록 ' + ids.length + '건') : ('보이는 목록 ' + ids.length + '건'));
    tools.querySelector('#resPrintSel').disabled = n === 0;
    setText(tools.querySelector('#resPrintSel'), n ? '선택 인쇄 (' + n + ')' : '선택 인쇄');
    const all = tools.querySelector('#resPickAll');
    all.checked = ids.length > 0 && n === ids.length; all.indeterminate = n > 0 && n < ids.length;
  }
}
box.addEventListener('change', e => {
  const cb = e.target.closest && e.target.closest('.listing-card .res-pick');
  if (!cb) return;
  cb.checked ? picked.add(cb.dataset.id) : picked.delete(cb.dataset.id);
  decorate();
});
function currentTitle() {
  const active = box.querySelector('button[data-cidx][aria-pressed="true"]');
  const search = document.getElementById('driveGlobalSearch');
  if (search && search.value.trim()) return '검색어 ' + search.value.trim();
  return active ? active.textContent.replace(/[▲▼📂]/g, '').replace(/\(\d+\)/g, '').replace(/\s+/g, ' ').trim() : '전체';
}

// ---------- 인쇄 ----------
function printIds(ids, title) {
  const rows = ids.map(resourceOf).filter(Boolean);
  if (!rows.length) return;
  const d = new Date();
  const date = d.getFullYear() + '.' + String(d.getMonth() + 1).padStart(2, '0') + '.' + String(d.getDate()).padStart(2, '0');
  const sheet = document.createElement('div');
  sheet.id = 'resPrintSheet';
  sheet.innerHTML = '<div class="rp-head"><h2>' + esc(BRAND.title) + '</h2><p>' + esc(title) + '</p><p>총 ' + rows.length + '건 · ' + date + ' 출력</p></div>'
    + '<table><thead><tr><th>No</th><th>건물</th><th>주소</th><th>분류</th><th>연결 매물</th></tr></thead><tbody>'
    + rows.map((r, i) => '<tr><td class="no">' + (i + 1) + '</td><td class="nm">' + esc(r.name) + '</td><td>' + esc(addressOf(r) || '-') + '</td><td class="cat">' + esc(r.category || '-') + '</td><td>' + (linkedCount(r.id) ? linkedCount(r.id) + '건' : '-') + '</td></tr>').join('')
    + '</tbody></table>';
  document.body.appendChild(sheet);
  const q = s => '"' + String(s).replace(/"/g, '') + '"';
  const f = 'font:10px Pretendard,sans-serif;';
  const pb = document.createElement('style');
  pb.id = 'resPageBoxes';
  pb.textContent = '@page{@top-left{content:' + q(BRAND.title) + ';font:600 10px Pretendard,sans-serif;color:#555;vertical-align:bottom;padding-bottom:3mm}'
    + '@top-right{content:"브리핑 자료";' + f + 'color:#777;vertical-align:bottom;padding-bottom:3mm}'
    + '@bottom-center{content:' + q(BRAND.foot) + ';font:800 14px Pretendard,"Malgun Gothic",sans-serif;letter-spacing:.02em;color:#17473f;background:linear-gradient(90deg,#e6f2f0,#f6fbfa);border:1px solid #9fc4be;border-left:5px solid #25675f;border-radius:4px;margin:3mm 0 5mm;padding:0 10mm;text-align:center;vertical-align:middle;white-space:nowrap;-webkit-print-color-adjust:exact;print-color-adjust:exact}'
    + '@bottom-right{content:counter(page) " / " counter(pages);' + f + 'color:#555;vertical-align:middle;margin:3mm 0 5mm}}';
  document.head.appendChild(pb);
  const cleanup = () => { sheet.remove(); pb.remove(); };
  window.addEventListener('afterprint', cleanup, { once: true });
  window.print();
}

// 목록이 다시 그려질 때마다 체크 칸을 다시 붙인다
let busy = false;
const mo = new MutationObserver(() => {
  if (busy) return;
  busy = true;
  setTimeout(() => { try { decorate(); } finally { busy = false; } }, 30);
});
mo.observe(box, { childList: true, subtree: true });
decorate();
})();
