/* 택지 위치도: 블럭을 누르면 [블록 도면] / [카카오맵 위치] 두 가지로 볼 수 있게 한다. */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var bar = $('blockViewBar');
  if (!bar) return;
  var cur = null, tab = 'drawing';
  var style = document.createElement('style');
  style.textContent = '#blockViewBar{display:flex;gap:6px;margin:8px 0}#blockKakaoWrap{margin:6px 0 10px}#blockKakaoFrame{width:100%;height:560px;border:1px solid rgba(148,163,184,.55);border-radius:8px;background:#f4f7fa}#blockViewBar .btn[aria-pressed="true"]{background:#12395f!important;color:#fff!important;border-color:#12395f!important}';
  document.head.appendChild(style);
  function officeId() {
    return (typeof OfficeConfig !== 'undefined' && OfficeConfig.id) || new URLSearchParams(location.search).get('office') || 'hitop';
  }
  function apply() {
    if (!cur) return;
    var kakao = tab === 'kakao';
    bar.hidden = false;
    bar.querySelector('[data-bv="drawing"]').textContent = cur.drawing ? '블록 도면' : '블록 도면 (등록 예정)';
    Array.prototype.forEach.call(bar.querySelectorAll('[data-bv]'), function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-bv') === tab)); });
    $('blockKakaoWrap').hidden = !kakao;
    $('detailDrawing').hidden = kakao || !cur.drawing;
    $('drawingControls').hidden = kakao || !cur.drawing;
    if ($('drawingEmpty')) $('drawingEmpty').hidden = kakao || !!cur.drawing;
    if (kakao) {
      var f = $('blockKakaoFrame');
      var src = 'land-kakao.html?office=' + encodeURIComponent(officeId()) + '&view=' + encodeURIComponent(cur.view) + '&block=' + encodeURIComponent(cur.id) + '&embed=1';
      if (f.getAttribute('data-src') !== src) { f.setAttribute('data-src', src); f.src = src; }
    }
  }
  document.addEventListener('landblockshow', function (e) {
    cur = e.detail;
    tab = cur.drawing ? 'drawing' : 'kakao';
    setTimeout(apply, 0);
  });
  bar.addEventListener('click', function (e) {
    var b = e.target.closest('[data-bv]');
    if (!b) return;
    tab = b.getAttribute('data-bv');
    apply();
  });
})();
