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
      ' body.drawing-printing main.land-location-page{padding:0!important;margin:0!important;max-width:none!important;width:auto!important;background:#fff!important;box-shadow:none!important}',
      ' body.drawing-printing main.land-location-page>*:not(#' + SHEET_ID + '){display:none!important}',
      ' body.drawing-printing #' + SHEET_ID + '{display:block!important;color:#111;font-family:inherit;-webkit-print-color-adjust:exact;print-color-adjust:exact}',
      ' #' + SHEET_ID + ' *{-webkit-print-color-adjust:exact;print-color-adjust:exact}',
      ' #' + SHEET_ID + ' .dp-head{display:flex;justify-content:space-between;align-items:flex-end;gap:12px;border-bottom:2px solid #1f5f5b;padding:0 0 2.5mm;margin:0 0 3mm}',
      ' #' + SHEET_ID + ' .dp-title{font-size:16pt;font-weight:800;color:#163c3a;line-height:1.2;margin:0}',
      ' #' + SHEET_ID + ' .dp-sub{font-size:9pt;color:#475569;margin:1mm 0 0;line-height:1.35}',
      ' #' + SHEET_ID + ' .dp-meta{font-size:8.5pt;color:#475569;text-align:right;line-height:1.4;white-space:nowrap}',
      ' #' + SHEET_ID + ' .dp-legend{font-size:9pt;color:#1e293b;margin:0 0 3mm;line-height:1.45}',
      ' #' + SHEET_ID + ' .dp-legend b{color:#163c3a}',
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

  function officeName() {
    try { if (window.OfficeConfig && OfficeConfig.name) return OfficeConfig.name; } catch (e) {}
    return document.documentElement.dataset.officeTheme === 'ktop' ? '케이탑부동산' : '하이탑부동산';
  }

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
    var maxH = landscape ? 162 : 250;
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

    var sheet = document.createElement('section');
    sheet.id = SHEET_ID;
    sheet.setAttribute('aria-hidden', 'true');
    sheet.innerHTML =
      '<div class="dp-head"><div><p class="dp-title">' + esc(title) + ' 상세 도면</p>' +
      '<p class="dp-sub">' + esc([group, type].filter(Boolean).join(' · ')) + '</p></div>' +
      '<div class="dp-meta">' + esc(officeName()) + '<br>출력 ' + esc(today()) + '</div></div>' +
      '<p class="dp-legend"><b>표시 항목:</b> ' + esc(views.length ? views.join(', ') : '원본 도면') +
      (legend ? '<br><b>범례:</b> ' + esc(legend) : '') + '</p>' +
      '<div class="dp-frame" style="width:' + widthMm.toFixed(1) + 'mm"></div>';

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
