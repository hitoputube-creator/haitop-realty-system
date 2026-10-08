/* 카카오맵 매물지도 화면
 * - 거래상태가 "진행중"인 매물(보관용 명단 제외)을 카카오 지도 위에 종류별 색 핀으로 보여줍니다.
 * - 위치는 매물에 저장된 좌표(mapCoordinates)를 먼저 쓰고, 없으면 주소를 카카오 지오코딩으로 바꿉니다.
 *   바꾼 위치는 이 브라우저(localStorage)에 저장해 다음부터 바로 표시합니다. (택지·상가 지도와 같은 저장소 공유)
 * - 매물 DB는 읽기만 하며 수정하지 않습니다. 계산 부분은 listings-kakao-core.js 에 있습니다. */
(function () {
  'use strict';
  var Core = window.HitopListingsMapCore;
  var $ = function (id) { return document.getElementById(id); };
  var CACHE_KEY = 'hitop-kakao-geo-v1';
  var DEFAULT_CENTER = [37.7226, 126.7500], DEFAULT_LEVEL = 5;
  var params = new URLSearchParams(location.search);

  var statusEl = $('kakaoStatus');
  var map = null, geocoder = null, infoWindow = null;
  var points = [];                       // {item, key, queries, coords:[lat,lng]|null, lat, lng, overlay}
  var geoCache = loadCache();
  var overlays = [];
  var selectedKey = '';
  var activeCat = ['shop', 'land', 'home', 'factory', 'other'].indexOf(params.get('category')) >= 0 ? params.get('category') : 'all';
  var activeDeal = 'all', searchText = '';

  function setStatus(text) { statusEl.textContent = text; }
  function loadCache() { try { return JSON.parse(OfficeStorage.local.getItem(CACHE_KEY) || '{}') || {}; } catch (e) { return {}; } }
  function saveCache() { try { OfficeStorage.local.setItem(CACHE_KEY, JSON.stringify(geoCache)); } catch (e) { /* 저장 공간이 없어도 화면은 동작 */ } }
  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null && text !== '') node.textContent = text;
    return node;
  }
  function detailUrl(item) { return OfficeConfig.urlFor('detail.html?id=' + encodeURIComponent(item.id)); }

  // ---------- 데이터 ----------
  async function loadListings() {
    var session = await hitopAuthClient.auth.getSession();
    if (session.error || !session.data.session) { hitopRedirectToLogin(); return null; }
    hitopApplyAuthHeader(session.data.session);
    var rows = await getListings();
    return rows.filter(Core.isOnMap).map(function (item) {
      return {
        item: item, key: Core.categoryKey(item), queries: Core.addressCandidates(item),
        coords: Core.listingCoordinates(item), lat: null, lng: null, overlay: null
      };
    });
  }

  // ---------- 지오코딩 ----------
  function geocode(query) {
    return new Promise(function (resolve) {
      geocoder.addressSearch(query, function (result, status) {
        if (status === kakao.maps.services.Status.OK && result[0]) resolve({ lat: Number(result[0].y), lng: Number(result[0].x) });
        else if (status === kakao.maps.services.Status.ZERO_RESULT) resolve(null);
        else resolve(undefined);          // 일시 오류: 저장하지 않고 다음에 다시 시도
      });
    });
  }

  async function resolveAll(retryFailed) {
    var wanted = {};
    points.forEach(function (p) { if (!p.coords) p.queries.forEach(function (q) { wanted[q] = true; }); });
    var queue = Object.keys(wanted).filter(function (q) { return geoCache[q] === undefined || (retryFailed && geoCache[q] === 0); });
    var total = queue.length, done = 0;
    var workers = Array.from({ length: 4 }, async function () {
      while (queue.length) {
        var q = queue.shift();
        var result = await geocode(q);
        if (result) geoCache[q] = [result.lat, result.lng];
        else if (result === null) geoCache[q] = 0;
        done++;
        if (done % 5 === 0) setStatus('매물 위치를 찾는 중입니다. (' + done + '/' + total + ')');
      }
    });
    await Promise.all(workers);
    if (total) saveCache();
    points.forEach(function (p) {
      p.lat = null; p.lng = null;
      if (p.coords) { p.lat = p.coords[0]; p.lng = p.coords[1]; return; }
      for (var i = 0; i < p.queries.length; i++) {
        var hit = geoCache[p.queries[i]];
        if (Array.isArray(hit)) { p.lat = hit[0]; p.lng = hit[1]; return; }
      }
    });
  }

  // ---------- 필터 ----------
  function passesNonCat(p) {
    if (activeDeal !== 'all' && Core.dealGroup(p.item) !== activeDeal) return false;
    if (searchText && Core.searchText(p.item).indexOf(searchText) < 0) return false;
    return true;
  }
  function passes(p) { return (activeCat === 'all' || p.key === activeCat) && passesNonCat(p); }

  function renderCatButtons() {
    var box = $('lkCats');
    box.textContent = '';
    var counts = { all: 0 };
    points.forEach(function (p) {
      if (!passesNonCat(p)) return;
      counts.all++;
      counts[p.key] = (counts[p.key] || 0) + 1;
    });
    var list = [{ key: 'all', label: '전체', color: '#e5bf35' }].concat(Core.CATEGORIES);
    list.forEach(function (c) {
      var btn = el('button', 'btn');
      btn.type = 'button';
      btn.setAttribute('aria-pressed', String(activeCat === c.key));
      var dot = el('i', 'lk-dot'); dot.style.background = c.color;
      btn.appendChild(dot);
      btn.appendChild(document.createTextNode(c.label));
      btn.appendChild(el('span', 'lk-count', String(counts[c.key] || 0)));
      btn.addEventListener('click', function () { activeCat = c.key; infoWindow.close(); render(true); });
      box.appendChild(btn);
    });
  }

  // ---------- 핀 ----------
  function groupColor(group) {
    var keys = {};
    group.points.forEach(function (p) { keys[p.key] = true; });
    var ids = Object.keys(keys);
    return ids.length === 1 ? Core.categoryInfo(ids[0]).color : '#374151';
  }
  function pinContent(group) {
    var first = group.points[0], item = first.item, n = group.points.length;
    var root = el('div', 'lk-pin');
    root.style.setProperty('--lk-color', groupColor(group));
    if (group.points.some(function (p) { return p.item.id === selectedKey; })) root.classList.add('selected');
    var body = el('div', 'lk-pin-body');
    var label = n > 1 ? (Core.buildingNameOf(item) || Core.titleOf(item)) : Core.titleOf(item);
    body.appendChild(el('strong', '', label));
    var sub = n > 1 ? n + '건' : Core.priceInfo(item).short;
    if (sub) body.appendChild(el('span', '', sub));
    root.appendChild(body);
    if (n > 1) root.appendChild(el('div', 'lk-pin-badge', String(n)));
    root.addEventListener('click', function (event) { event.stopPropagation(); openInfo(group); });
    return root;
  }

  function clearOverlays() {
    overlays.forEach(function (o) { o.setMap(null); });
    overlays = [];
  }

  function render(fit) {
    if (!map) return;
    clearOverlays();
    renderCatButtons();
    var filtered = points.filter(passes);
    var placed = filtered.filter(function (p) { return p.lat !== null; });
    var groups = Core.groupByPosition(placed);
    var bounds = new kakao.maps.LatLngBounds();
    groups.forEach(function (group) {
      var overlay = new kakao.maps.CustomOverlay({
        position: new kakao.maps.LatLng(group.lat, group.lng), content: pinContent(group),
        yAnchor: 1, xAnchor: 0.5, clickable: true, zIndex: 2
      });
      overlay.setMap(map);
      group.overlay = overlay;
      overlays.push(overlay);
      bounds.extend(new kakao.maps.LatLng(group.lat, group.lng));
    });
    renderUnplaced(filtered.filter(function (p) { return p.lat === null; }));
    var failed = points.filter(function (p) { return p.lat === null && p.queries.length; }).length;
    $('lkRetry').hidden = !failed;
    setStatus('진행중 매물 ' + filtered.length + '건 중 지도에 ' + placed.length + '건(' + groups.length + '곳) 표시' +
      (filtered.length > placed.length ? ' · 위치를 못 찾은 ' + (filtered.length - placed.length) + '건은 아래 목록' : '') + '.');
    if (fit && groups.length) {
      if (groups.length === 1) { map.setLevel(3); map.setCenter(new kakao.maps.LatLng(groups[0].lat, groups[0].lng)); }
      else map.setBounds(bounds, 60, 60, 60, 60);
    }
    currentGroups = groups;
  }
  var currentGroups = [];

  function renderUnplaced(list) {
    var box = $('lkUnplaced'), ul = $('lkUnplacedList');
    ul.textContent = '';
    box.hidden = !list.length;
    if (!list.length) return;
    $('lkUnplacedNote').textContent = '주소가 비어 있거나 지도에서 찾지 못한 매물입니다. 매물 상세에서 공개·비공개 주소를 "동패동 2079-4"처럼 지번으로 확인해 주세요.';
    list.forEach(function (p) {
      var li = el('li');
      var a = el('a', '', Core.titleOf(p.item));
      a.href = detailUrl(p.item);
      li.appendChild(a);
      li.appendChild(document.createTextNode(' '));
      li.appendChild(el('span', 'lk-why', '· ' + Core.categoryInfo(p.key).label + (p.queries.length ? ' · 위치 못 찾음' : ' · 주소 없음')));
      ul.appendChild(li);
    });
  }

  // ---------- 말풍선 ----------
  function metaLine(p) {
    var item = p.item;
    return [Core.categoryInfo(p.key).label, Core.dealLabel(item), Core.areaText(item, p.key)].filter(Boolean).join(' · ');
  }
  function appendOwner(root, item) {
    var owner = Core.ownerOf(item);
    if (!owner.name && !owner.phone) return;
    var line = el('div', 'lk-owner');
    line.appendChild(document.createTextNode('소유주 ' + (owner.name || '')));
    if (owner.phone) {
      line.appendChild(document.createTextNode(' '));
      var tel = el('a', '', owner.phone);
      tel.href = 'tel:' + owner.phone.replace(/[^\d+]/g, '');
      line.appendChild(tel);
    }
    root.appendChild(line);
  }
  function appendMapLinks(root, group, item) {
    var links = el('div', 'lk-links');
    var name = Core.titleOf(item);
    var main = el('a', 'lk-main', '매물 상세보기');
    main.href = detailUrl(item); main.target = '_blank'; main.rel = 'noopener';
    links.appendChild(main);
    var k = el('a', '', '카카오맵');
    k.href = 'https://map.kakao.com/link/map/' + encodeURIComponent(name) + ',' + group.lat + ',' + group.lng;
    k.target = '_blank'; k.rel = 'noopener'; links.appendChild(k);
    var r = el('a', '', '로드뷰');
    r.href = 'https://map.kakao.com/link/roadview/' + group.lat + ',' + group.lng;
    r.target = '_blank'; r.rel = 'noopener'; links.appendChild(r);
    if (window.HitopNaverLinks) window.HitopNaverLinks.append(links, Core.displayAddress(item), '', { lat: group.lat, lng: group.lng });
    root.appendChild(links);
  }

  function openInfo(group) {
    var root = el('div', 'lk-info');
    var firstItem = group.points[0].item;
    selectedKey = group.points.length === 1 ? firstItem.id : '';
    if (group.points.length === 1) {
      var p = group.points[0], item = p.item, price = Core.priceInfo(item);
      root.appendChild(el('h3', '', Core.titleOf(item)));
      root.appendChild(el('div', 'lk-meta', metaLine(p)));
      if (price.long) root.appendChild(el('div', 'lk-price', price.long));
      var addr = Core.displayAddress(item);
      if (addr) root.appendChild(el('div', 'lk-meta', addr));
      appendOwner(root, item);
      appendMapLinks(root, group, item);
    } else {
      var building = Core.buildingNameOf(firstItem);
      root.appendChild(el('h3', '', (building || Core.displayAddress(firstItem) || '같은 위치') + ' · ' + group.points.length + '건'));
      var addr2 = Core.displayAddress(firstItem);
      if (addr2) root.appendChild(el('div', 'lk-meta', addr2));
      var ul = el('ul', 'lk-group');
      group.points.forEach(function (p) {
        var item = p.item, price = Core.priceInfo(item);
        var li = el('li');
        var a = el('a', 'lk-row');
        a.href = detailUrl(item); a.target = '_blank'; a.rel = 'noopener';
        var tag = el('span', 'lk-tag', Core.categoryInfo(p.key).label);
        tag.style.setProperty('--lk-color', Core.categoryInfo(p.key).color);
        a.appendChild(tag);
        a.appendChild(el('strong', '', Core.titleOf(item)));
        a.appendChild(el('div', 'lk-meta', [Core.dealLabel(item), price.short, Core.areaText(item, p.key)].filter(Boolean).join(' · ')));
        li.appendChild(a);
        var owner = Core.ownerOf(item);
        if (owner.name || owner.phone) li.appendChild(el('div', 'lk-meta', ['소유주', owner.name, owner.phone].filter(Boolean).join(' ')));
        ul.appendChild(li);
      });
      root.appendChild(ul);
      appendMapLinks(root, group, firstItem);
    }
    infoWindow.setContent(root);
    infoWindow.setPosition(new kakao.maps.LatLng(group.lat, group.lng));
    infoWindow.open(map);
  }

  // ---------- 컨트롤 ----------
  function bindControls() {
    document.querySelectorAll('[data-maptype]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        map.setMapTypeId(btn.dataset.maptype === 'sky' ? kakao.maps.MapTypeId.HYBRID : kakao.maps.MapTypeId.ROADMAP);
        document.querySelectorAll('[data-maptype]').forEach(function (b) { b.setAttribute('aria-pressed', String(b === btn)); });
      });
    });
    document.querySelectorAll('[data-overlay="district"]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var on = btn.getAttribute('aria-pressed') !== 'true';
        if (on) map.addOverlayMapTypeId(kakao.maps.MapTypeId.USE_DISTRICT); else map.removeOverlayMapTypeId(kakao.maps.MapTypeId.USE_DISTRICT);
        btn.setAttribute('aria-pressed', String(on));
      });
    });
    $('lkDeal').addEventListener('change', function () { activeDeal = this.value; infoWindow.close(); render(true); });
    var timer = null;
    $('lkSearch').addEventListener('input', function () {
      var value = this.value;
      clearTimeout(timer);
      timer = setTimeout(function () { searchText = value.trim().toLowerCase(); infoWindow.close(); render(true); }, 300);
    });
    $('lkFit').addEventListener('click', function () { render(true); });
    $('lkRetry').addEventListener('click', async function () {
      var btn = $('lkRetry');
      btn.disabled = true;
      setStatus('위치를 못 찾은 매물을 다시 찾는 중입니다.');
      await resolveAll(true);
      render(false);
      btn.disabled = false;
    });
    kakao.maps.event.addListener(map, 'click', function () { infoWindow.close(); });
  }

  function loadSdk(key) {
    return new Promise(function (resolve, reject) {
      var script = document.createElement('script');
      script.src = 'https://dapi.kakao.com/v2/maps/sdk.js?appkey=' + encodeURIComponent(key) + '&libraries=services&autoload=false';
      script.onload = function () { kakao.maps.load(resolve); };
      script.onerror = function () { reject(new Error('카카오맵을 불러오지 못했습니다. 키와 등록한 사이트 주소(도메인)를 확인해주세요.')); };
      document.head.appendChild(script);
    });
  }

  (async function init() {
    var back = $('lkBackLink');
    if (back && window.OfficeConfig) {
      back.href = OfficeConfig.urlFor('property-main.html' + (activeCat !== 'all' ? '?category=' + activeCat : ''));
      $('lkListLink').href = OfficeConfig.urlFor('properties.html');
    }
    var key = String(window.HITOP_KAKAO_JS_KEY || '').trim();
    if (!key) { $('kakaoSetupNotice').hidden = false; setStatus('카카오맵 키가 설정되면 지도가 표시됩니다.'); return; }
    try {
      await loadSdk(key);
      $('kakaoMap').hidden = false;
      $('kakaoControls').hidden = false;
      map = new kakao.maps.Map($('kakaoMap'), { center: new kakao.maps.LatLng(DEFAULT_CENTER[0], DEFAULT_CENTER[1]), level: DEFAULT_LEVEL });
      window.HitopNaverLinks.bindMapView($('kakaoNaverListings'), map, 'shop');
      geocoder = new kakao.maps.services.Geocoder();
      infoWindow = new kakao.maps.InfoWindow({ removable: true, zIndex: 10 });
      map.addControl(new kakao.maps.ZoomControl(), kakao.maps.ControlPosition.RIGHT);
      bindControls();
      setStatus('진행중 매물을 불러오는 중입니다.');
      var loaded = await loadListings();
      if (!loaded) return;
      points = loaded;
      if (!points.length) { setStatus('진행중인 매물이 없습니다.'); renderCatButtons(); return; }
      setStatus('매물 위치를 찾는 중입니다.');
      await resolveAll(false);
      render(true);
      var wantedId = params.get('id');
      var target = wantedId && currentGroups.filter(function (g) { return g.points.some(function (p) { return String(p.item.id) === wantedId; }); })[0];
      if (target) { map.setLevel(3); map.setCenter(new kakao.maps.LatLng(target.lat, target.lng)); openInfo(target); }
    } catch (error) {
      setStatus(error && error.message ? error.message : '지도를 표시하지 못했습니다.');
    }
  })();
})();
