/* 도로명(새)주소 도우미
 * - 지번주소(예: 와동동 1698-3)를 카카오 주소검색에 물어 도로명주소(예: 가람로51번길 27-7)를 받아옵니다.
 * - 결과는 이 브라우저(localStorage)에 저장해 다음부터 바로 보여줍니다. DB는 수정하지 않습니다.
 * - 새주소가 아직 부여되지 않은 필지는 빈 값('')을 돌려주므로, 화면에는 지번만 보이게 하면 됩니다.
 */
(function () {
  'use strict';
  var CACHE_KEY = 'hitop-road-addr-v1';
  var ADDRESS_PATTERN = /[가-힣]+(?:동|리)\s+(?:산\s*)?\d+/;
  var MAX_PARALLEL = 3;
  var cache = loadCache();
  var inflight = {};
  var waiting = [];
  var running = 0;
  var servicesPromise = null;

  function loadCache() {
    try { return JSON.parse(OfficeStorage.local.getItem(CACHE_KEY) || '{}') || {}; } catch (e) { return {}; }
  }
  function saveCache() {
    try { OfficeStorage.local.setItem(CACHE_KEY, JSON.stringify(cache)); } catch (e) { /* 저장 공간이 없어도 화면은 동작 */ }
  }

  // "동패동 2132-0"처럼 끝이 -0인 지번은 본번만 남겨 검색합니다.
  function clean(address) {
    return String(address || '').replace(/\s+/g, ' ').trim().replace(/-0$/, '');
  }
  function queryOf(address) {
    var value = clean(address);
    return /파주/.test(value) ? value : '파주시 ' + value;
  }
  function usable(address) { return ADDRESS_PATTERN.test(clean(address)); }

  function loadServices() {
    if (window.kakao && window.kakao.maps && window.kakao.maps.services) return Promise.resolve();
    if (servicesPromise) return servicesPromise;
    var key = String(window.HITOP_KAKAO_JS_KEY || '').trim();
    if (!key) return Promise.reject(new Error('카카오맵 키가 설정되지 않았습니다.'));
    servicesPromise = new Promise(function (resolve, reject) {
      var script = document.createElement('script');
      script.src = 'https://dapi.kakao.com/v2/maps/sdk.js?appkey=' + encodeURIComponent(key) + '&libraries=services&autoload=false';
      script.onload = function () { window.kakao.maps.load(resolve); };
      script.onerror = function () { servicesPromise = null; reject(new Error('카카오 지도를 불러오지 못했습니다.')); };
      document.head.appendChild(script);
    });
    return servicesPromise;
  }

  // 카카오 결과의 도로명주소를 "가람로51번길 27-7" 모양으로 줄입니다.
  function shortRoad(road) {
    if (!road) return '';
    var name = String(road.road_name || '').trim();
    var main = String(road.main_building_no || '').trim();
    var sub = String(road.sub_building_no || '').trim();
    if (name && main && main !== '0') return name + ' ' + main + (sub && sub !== '0' ? '-' + sub : '');
    return String(road.address_name || '').replace(/^경기(?:도)?\s*파주시\s*/, '').trim();
  }

  function search(address) {
    return loadServices().then(function () {
      return new Promise(function (resolve) {
        var done = false;
        var timer = setTimeout(function () { if (!done) { done = true; resolve(undefined); } }, 10000);
        new window.kakao.maps.services.Geocoder().addressSearch(queryOf(address), function (result, status) {
          if (done) return;
          done = true; clearTimeout(timer);
          if (status === window.kakao.maps.services.Status.OK && result[0]) resolve(shortRoad(result[0].road_address));
          else if (status === window.kakao.maps.services.Status.ZERO_RESULT) resolve('');
          else resolve(undefined); // 일시 오류: 저장하지 않고 다음에 다시 시도
        });
      });
    }).catch(function () { return undefined; });
  }

  function pump() {
    while (running < MAX_PARALLEL && waiting.length) {
      (function (job) {
        running++;
        search(job.address).then(function (road) {
          if (road !== undefined) { cache[job.key] = road || 0; saveCache(); }
          running--;
          delete inflight[job.key];
          job.resolve(road || '');
          pump();
        });
      })(waiting.shift());
    }
  }

  // 저장된 값만 즉시 확인: 새주소 문자열, 새주소 없음이면 '', 아직 모르면 undefined
  function peek(address) {
    if (!usable(address)) return '';
    var hit = cache[queryOf(address)];
    if (hit === undefined) return undefined;
    return hit || '';
  }

  // 새주소를 찾아 돌려줍니다. 없거나 못 찾으면 ''.
  function lookup(address) {
    if (!usable(address)) return Promise.resolve('');
    var key = queryOf(address);
    var hit = cache[key];
    if (hit !== undefined) return Promise.resolve(hit || '');
    if (inflight[key]) return inflight[key];
    inflight[key] = new Promise(function (resolve) { waiting.push({ key: key, address: address, resolve: resolve }); });
    pump();
    return inflight[key];
  }

  // "와동동 1698-3 [가람로51번길 27-7]" 형태로 합칩니다. 새주소가 없으면 지번만.
  function format(address, road) {
    var base = String(address || '').trim();
    return road ? base + ' [' + road + ']' : base;
  }

  window.HitopRoadAddress = { lookup: lookup, peek: peek, format: format, loadServices: loadServices };
})();
