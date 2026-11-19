/* 상가 위치도: 지도의 상업지 블록을 누르면 그 블록 페이지로 이동 */
(function () {
  'use strict';
  var stage = document.getElementById('mapStage');
  if (!stage || document.body.dataset.resourceScope === 'residential') return;
  var office = (typeof OfficeConfig !== 'undefined' && OfficeConfig.id) || new URLSearchParams(location.search).get('office') || 'hitop';
  // x, y, w, h: 지도 그림 크기에 대한 % (확대해도 같은 자리)
  var BLOCKS = [
    { name: '운정역 F1 블록', href: 'shop-block-f1.html', x: 65.9, y: 41.5, w: 3.1, h: 9.6 },
    { name: '법조타운 블록', href: 'shop-block-beopjo.html', x: 63.3, y: 41.35, w: 2.2, h: 4.23, side: 'left' }
  ];
  var style = document.createElement('style');
  style.textContent = '.block-hotspot{position:absolute;z-index:3;display:block;border:2px dashed #d6247f;background:rgba(214,36,127,.12);border-radius:6px;line-height:1;text-decoration:none}' +
    '.block-hotspot:hover,.block-hotspot:focus-visible{background:rgba(255,153,0,.28);border-color:#ff8a00}' +
    '.block-hotspot span{position:absolute;left:100%;top:50%;transform:translateY(-50%);margin-left:8px;white-space:nowrap;background:#12395f;color:#fff;font-size:12px;font-weight:700;padding:4px 9px;border-radius:6px;pointer-events:none;box-shadow:0 2px 8px rgba(0,0,0,.25)}' +
    '.map-stage.editing .block-hotspot{pointer-events:none;opacity:.3}';
  document.head.appendChild(style);
  BLOCKS.forEach(function (b) {
    var a = document.createElement('a');
    a.className = 'block-hotspot';
    a.href = b.href + '?office=' + encodeURIComponent(office);
    a.title = b.name + ' 자료 보기';
    a.setAttribute('aria-label', b.name + ' 자료 보기');
    a.style.left = b.x + '%'; a.style.top = b.y + '%'; a.style.width = b.w + '%'; a.style.height = b.h + '%';
    var s = document.createElement('span'); s.textContent = b.name + ' ▸'; if (b.side === 'left') { s.style.left = 'auto'; s.style.right = '100%'; s.style.marginLeft = '0'; s.style.marginRight = '8px'; } a.appendChild(s);
    stage.appendChild(a);
  });
})();
