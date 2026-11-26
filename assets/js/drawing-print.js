/* 택지 상세 도면 인쇄: 지금 화면에 켜 둔 표시(건물 유무·소유 구분·면적 등) 그대로 도면만 인쇄 */
(function () {
  'use strict';
  var SHEET_ID = 'drawingPrintSheet';
  var BTN_ID = 'drawingPrintBtn';

  function $(id) { return document.getElementById(id); }
  function text(el) { return el ? String(el.textContent || '').replace(/\s+/g, ' ').trim() : ''; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  function injectStyle() {
    if ($('drawingPrintStyle')) return;
    var st = document.createElement('style');
    st.id = 'drawingPrintStyle';
    st.textContent = [
      '#' + SHEET_ID + '{display:none}',
      '@media print{',
      ' html,body{background:#fff!important}',
      ' body.drawing-printing>*:not(main){display:none!important}',
      ' html:has(body.drawing-printing),body.drawing-printing{margin:0!important;padding:0!important;min-height:0!important;height:auto!important}',
      ' body.drawing-printing main.land-location-page{padding:0!important;margin:0!important;max-width:none!important;width:auto!important;background:#fff!important;box-shadow:none!important}',
      ' body.drawing-printing main.land-location-page>*:not(#' + SHEET_ID + '){display:none!important}',
      ' body.drawing-printing #' + SHEET_ID + '{display:block!important;color:#111;font-family:inherit;-webkit-print-color-adjust:exact;print-color-adjust:exact}',
      ' #' + SHEET_ID + ' *{-webkit-print-color-adjust:exact;print-color-adjust:exact}',
      ' body.drawing-printing #' + SHEET_ID + '{display:flex!important;flex-direction:column;box-sizing:border-box;overflow:hidden}',
      ' #' + SHEET_ID + ' .dp-brand{display:flex;justify-content:space-between;align-items:center;gap:4mm;padding:2.2mm 4mm;border-radius:2mm;background:var(--dp-accent);color:#fff;margin:0 0 3mm}',
      ' #' + SHEET_ID + ' .dp-brand b{font-size:11.5pt;letter-spacing:-.02em}',
      ' #' + SHEET_ID + ' .dp-brand strong{font-size:12.5pt;font-weight:800;white-space:nowrap}',
      ' #' + SHEET_ID + ' .dp-head{display:flex;justify-content:space-between;align-items:flex-end;gap:12px;border-bottom:.5mm solid var(--dp-accent);padding:0 0 2mm;margin:0 0 2.5mm}',
      ' #' + SHEET_ID + ' .dp-title{font-size:17pt;font-weight:800;color:#163c3a;line-height:1.2;margin:0}',
      ' #' + SHEET_ID + ' .dp-sub{font-size:9pt;color:#475569;margin:1mm 0 0;line-height:1.35}',
      ' #' + SHEET_ID + ' .dp-meta{font-size:8.5pt;color:#475569;text-align:right;line-height:1.4;white-space:nowrap}',
      ' #' + SHEET_ID + ' .dp-legend{font-size:9pt;color:#1e293b;margin:0 0 2.5mm;line-height:1.45}',
      ' #' + SHEET_ID + ' .dp-legend b{color:var(--dp-accent)}',
      ' #' + SHEET_ID + ' .dp-spacer{flex:1 1 auto;min-height:2mm}',
      ' #' + SHEET_ID + ' .dp-foot{flex:0 0 auto;margin-top:3mm;border:1.5px solid var(--dp-accent);border-radius:3mm;overflow:hidden;break-inside:avoid;page-break-inside:avoid;line-height:1.3}',
      ' #' + SHEET_ID + ' .dp-foot-head{display:flex;justify-content:space-between;align-items:center;gap:3mm;padding:2.4mm 4.5mm;background:var(--dp-accent);color:#fff}',
      ' #' + SHEET_ID + ' .dp-foot-head b{font-size:12pt;letter-spacing:-.02em}',
      ' #' + SHEET_ID + ' .dp-foot-head strong{font-size:13pt;font-weight:800;white-space:nowrap}',
      ' #' + SHEET_ID + ' .dp-foot-grid{display:grid;grid-template-columns:1fr 1fr}',
      ' #' + SHEET_ID + ' .dp-foot-grid div{display:grid;grid-template-columns:17mm 1fr;align-items:center;padding:1.3mm 4.5mm;border-top:.2mm solid #dbe3e1;font-size:8.5pt}',
      ' #' + SHEET_ID + ' .dp-foot-grid div:nth-child(-n+2){border-top:0}',
      ' #' + SHEET_ID + ' .dp-foot-grid div:not(.full):nth-child(odd){border-right:.2mm solid #dbe3e1}',
      ' #' + SHEET_ID + ' .dp-foot-grid div.full{grid-column:1/-1;background:var(--dp-soft)}',
      ' #' + SHEET_ID + ' .dp-foot-grid span{color:var(--dp-accent);font-weight:800}',
      ' #' + SHEET_ID + ' .dp-foot-grid em{font-style:normal;font-weight:600;color:#23332f;overflow-wrap:anywhere}',
      ' #' + SHEET_ID + ' .dp-frame{border:1px solid #94a3b8;margin:0 auto;break-inside:avoid;page-break-inside:avoid;line-height:0}',
      ' #' + SHEET_ID + ' .parcel-stage{width:100%!important;margin:0!important}',
      ' #' + SHEET_ID + ' .parcel-stage img{width:100%!important;height:auto!important;display:block}',
      ' #' + SHEET_ID + ' .parcel-vector-hit:focus,#' + SHEET_ID + ' .parcel-vector-hit:hover{outline:none!important}',
      '}'
    ].join('\n');
    document.head.appendChild(st);
  }

  function activeViewNames() {
    return Array.prototype.slice.call(document.querySelectorAll('#parcelViewControls button[aria-pressed="true"]'))
      .map(function (b) { return text(b); }).filter(Boolean);
  }

  function today() {
    var d = new Date();
    function p(n) { return n < 10 ? '0' + n : '' + n; }
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }

  function officeId() {
    try { if (window.OfficeConfig && OfficeConfig.id) return OfficeConfig.id; } catch (e) {}
    return document.documentElement.dataset.officeTheme === 'ktop' ? 'ktop' : 'hitop';
  }
  /* 상세페이지·필지 인쇄물(parcel-print.js)과 같은 사무소 정보 */
  var COMPANY = {
    hitop: { name: '하이탑부동산공인중개사사무소', phone: '031-949-8969', rep: '주현희', fax: '031-944-1108', addr: '경기도 파주시 책향기로 830, 1층', reg: '41480-2016-00026', biz: '305-48-62183', email: 'newpajucity@naver.com', accent: '#25675f', soft: '#f4f9f8' },
    ktop: { name: '케이탑부동산', phone: '031-943-8000', rep: '주세진', fax: '031-943-8050', addr: '경기 파주시 양지로 112 단지내상가 108', reg: '41480-2024-00005', biz: '527-75-00406', email: 'k-top1@naver.com', accent: '#1767d2', soft: '#f5f8fe' }
  };
  function company() { return COMPANY[officeId()] || COMPANY.hitop; }

  function cleanup() {
    document.body.classList.remove('drawing-printing');
    var sheet = $(SHEET_ID); if (sheet) sheet.remove();
    var page = $('drawingPrintPage'); if (page) page.remove();
  }

  function buildSheet(stage) {
    var img = stage.querySelector('img');
    var ratio = img.naturalWidth / img.naturalHeight;
    var landscape = ratio > 1.1;
    /* A4, 여백 8mm, 머리글·범례 높이를 빼고 도면이 한 장에 들어가도록 크기 계산 */
    var maxW = landscape ? 281 : 194;
    var maxH = landscape ? 119 : 201;
    var pageH = landscape ? 190 : 277;
    var widthMm = Math.min(maxW, maxH * ratio);

    var pageStyle = document.createElement('style');
    pageStyle.id = 'drawingPrintPage';
    pageStyle.textContent = '@media print{@page{size:A4 ' + (landscape ? 'landscape' : 'portrait') + ';margin:8mm}}';
    document.head.appendChild(pageStyle);

    var group = text($('detailGroup'));
    var title = text($('detailTitle')) || '택지 상세 도면';
    var typeEl = $('detailType');
    var type = typeEl && !typeEl.hidden ? text(typeEl) : '';
    var views = activeViewNames();
    var legendEl = $('parcelViewLegend');
    var legend = legendEl && !legendEl.hidden ? text(legendEl) : '';

    var co = company();
    var footRows = [['대표', co.rep], ['팩스', co.fax], ['등록번호', co.reg], ['사업자번호', co.biz], ['주소', co.addr], ['이메일', co.email]]
      .filter(function (x) { return x[1]; })
      .map(function (x) { return '<div' + (x[2] ? ' class="full"' : '') + '><span>' + x[0] + '</span><em>' + esc(x[1]) + '</em></div>'; }).join('');

    var sheet = document.createElement('section');
    sheet.id = SHEET_ID;
    sheet.setAttribute('aria-hidden', 'true');
    sheet.style.setProperty('--dp-accent', co.accent);
    sheet.style.setProperty('--dp-soft', co.soft);
    sheet.style.height = pageH + 'mm';
    sheet.innerHTML =
      '<div class="dp-head"><div><p class="dp-title">' + esc(title) + ' 상세 도면</p>' +
      '<p class="dp-sub">' + esc([group, type].filter(Boolean).join(' · ')) + '</p></div>' +
      '<div class="dp-meta">출력 ' + esc(today()) + '</div></div>' +
      '<p class="dp-legend"><b>표시 항목:</b> ' + esc(views.length ? views.join(', ') : '원본 도면') +
      (legend ? '<br><b>범례:</b> ' + esc(legend) : '') + '</p>' +
      '<div class="dp-frame" style="width:' + widthMm.toFixed(1) + 'mm"></div>' +
      '<div class="dp-spacer"></div>' +
      '<footer class="dp-foot"><div class="dp-foot-head"><b>' + esc(co.name) + '</b><strong>T. ' + esc(co.phone) + '</strong></div>' +
      '<div class="dp-foot-grid">' + footRows + '</div></footer>';

    var clone = stage.cloneNode(true);
    clone.removeAttribute('style');
    Array.prototype.forEach.call(clone.querySelectorAll('object,iframe,button,input'), function (n) { n.remove(); });
    Array.prototype.forEach.call(clone.querySelectorAll('[id]'), function (n) { n.removeAttribute('id'); });
    Array.prototype.forEach.call(clone.querySelectorAll('[tabindex]'), function (n) { n.removeAttribute('tabindex'); });
    sheet.querySelector('.dp-frame').appendChild(clone);

    var main = document.querySelector('main.land-location-page') || document.body;
    main.appendChild(sheet);
    var cloneImg = clone.querySelector('img');
    return cloneImg && cloneImg.decode ? cloneImg.decode().catch(function () {}) : Promise.resolve();
  }

  function printDrawing() {
    var drawing = $('detailDrawing');
    if (drawing && drawing.hidden) {
      var drawingTab = document.querySelector('#blockViewBar [data-bv="drawing"]');
      if (drawingTab) drawingTab.click();
    }
    var stage = document.querySelector('#detailDrawing .parcel-stage');
    var img = stage && stage.querySelector('img');
    if (!stage || !img || !img.complete || !img.naturalWidth) {
      alert('상세 도면을 불러온 뒤 다시 눌러주세요.');
      return;
    }
    cleanup();
    injectStyle();
    buildSheet(stage).then(function () {
      document.body.classList.add('drawing-printing');
      var done = false;
      function after() { if (done) return; done = true; window.removeEventListener('afterprint', after); cleanup(); }
      window.addEventListener('afterprint', after);
      setTimeout(function () {
        window.print();
        setTimeout(after, 1500);
      }, 60);
    });
  }

  function init() {
    var controls = $('drawingControls');
    if (!controls || $(BTN_ID)) return;
    injectStyle();
    var btn = document.createElement('button');
    btn.className = 'btn';
    btn.id = BTN_ID;
    btn.type = 'button';
    btn.textContent = '도면 인쇄';
    btn.title = '지금 켜 둔 표시(건물 유무·소유 구분·면적 등) 그대로 도면을 인쇄합니다';
    btn.addEventListener('click', printDrawing);
    controls.appendChild(btn);
  }

  window.HitopDrawingPrint = { print: printDrawing };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
