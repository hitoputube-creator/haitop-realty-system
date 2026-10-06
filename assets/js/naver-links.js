/* 주소 기반 외부 보기 링크. 저장된 고객·소유주 자료는 전달하지 않습니다. */
(function () {
  'use strict';
  function addressQuery(address) {
    var value = String(address || '').replace(/\s+/g, ' ').trim();
    if (!value || !/[가-힣]+(?:동|리|로|길|읍|면)\s*(?:산\s*)?\d+/.test(value)) return '';
    // 두 필지 이상의 주소는 대표 지번으로 검색합니다.
    value = value.replace(/\s*외\s*\d+\s*필지.*$/, '').trim();
    return /파주|(?:서울|부산|대구|인천|광주|대전|울산|세종)|[가-힣]+(?:시|군)\s/.test(value) ? value : '파주시 ' + value;
  }
  function urls(address, position) {
    var query = addressQuery(address);
    if (!query) return null;
    var realEstate = 'https://new.land.naver.com/search?keyword=' + encodeURIComponent(query);
    if (position && Number.isFinite(position.lat) && Number.isFinite(position.lng) && position.lat >= 33 && position.lat <= 39 && position.lng >= 124 && position.lng <= 132) {
      realEstate = 'https://new.land.naver.com/?ms=' + position.lat + ',' + position.lng + ',17';
    }
    return { realEstate: realEstate, map: 'https://map.naver.com/p/search/' + encodeURIComponent(query) };
  }
  function updateLink(link, url) {
    if (!link) return;
    if (url) link.href = url;
    else link.removeAttribute('href');
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.setAttribute('aria-disabled', String(!url));
    link.classList.toggle('is-disabled', !url);
    link.title = url ? '새 창에서 보기' : '주소를 먼저 입력해 주세요.';
    if (!url) link.setAttribute('tabindex', '-1');
    else link.removeAttribute('tabindex');
  }
  function append(container, address, className, position) {
    var destinations = urls(address, position);
    [['네이버부동산', destinations && destinations.realEstate], ['네이버지도', destinations && destinations.map]].forEach(function (item) {
      var link = document.createElement('a');
      link.textContent = item[0];
      if (className) link.className = className;
      updateLink(link, item[1]);
      container.appendChild(link);
    });
  }
  function bindMapView(link, map, type) {
    if (!link || !map) return;
    function update() {
      var center = map.getCenter(), lat = center.getLat(), lng = center.getLng();
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) { updateLink(link, null); return; }
      var zoom = Math.max(7, Math.min(20, 21 - map.getLevel()));
      var filter = type === 'home' ? '' : type === 'land' ? 'DDD' : 'SG:SMS';
      updateLink(link, 'https://new.land.naver.com/?ms=' + lat + ',' + lng + ',' + zoom + (filter ? '&a=' + filter : ''));
    }
    update();
    window.kakao.maps.event.addListener(map, 'idle', update);
    link.addEventListener('click', update);
  }
  window.HitopNaverLinks = { urls: urls, updateLink: updateLink, append: append, bindMapView: bindMapView };
})();
