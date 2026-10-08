/* 카카오맵 매물지도 — 화면과 상관없는 계산 부분(종류 분류, 가격·면적 글자, 주소 정리, 위치 묶기).
 * 화면 코드는 listings-kakao.js 에 있고, 여기 함수들은 DB를 읽거나 수정하지 않습니다.
 * storage.js 의 getCategoryFromListing·resolveDisplayCategory1·listingProgressStatus 를 사용합니다. */
(function (root) {
  'use strict';

  var CATEGORIES = [
    { key: 'shop',    label: '상가·사무실', color: '#2563eb' },
    { key: 'land',    label: '토지',       color: '#16a34a' },
    { key: 'home',    label: '주거',       color: '#d97706' },
    { key: 'factory', label: '공장·창고',   color: '#7c3aed' },
    { key: 'other',   label: '건물·빌딩',   color: '#6b7686' }
  ];
  var CAT1_ALIAS = { '공장/창고': '공장창고', '상가/사무실': '상가사무실' };
  var DISPLAY_TO_KEY = { '상가사무실': 'shop', '토지': 'land', '주거용': 'home', '공장창고': 'factory', '건물빌딩': 'other' };
  var ADDRESS_HINT = /[가-힣0-9]+(?:동|리|로|길|읍|면)\s*(?:산\s*)?\d+/;

  function has(value) { return value !== null && value !== undefined && String(value).trim() !== ''; }
  function first() {
    for (var i = 0; i < arguments.length; i++) if (has(arguments[i])) return arguments[i];
    return '';
  }

  // 화면 분류(상가·토지·주거·공장창고·건물) — 상세 화면·매물관리 메인과 같은 기준
  function categoryKey(item) {
    var c = root.getCategoryFromListing(item);
    var c1 = CAT1_ALIAS[c.category1] || c.category1;
    var display = root.resolveDisplayCategory1(c1, c.category2);
    return DISPLAY_TO_KEY[display] || 'other';
  }
  function categoryInfo(key) {
    return CATEGORIES.filter(function (c) { return c.key === key; })[0] || CATEGORIES[CATEGORIES.length - 1];
  }

  // 지도에 올릴 매물: 거래상태가 진행중이고 보관용 "명단"이 아닌 것
  function isOnMap(item) {
    return !!item && root.listingProgressStatus(item) === '진행중' && item.listingKind !== '명단';
  }

  // 거래유형 묶음: sale(매매) / rent(전세·월세·임대) / unknown
  function dealGroup(item) {
    var deal = String(first(item.dealType, item.shop_dealType, item.officetel_dealType, item.factory_dealType, item.biz_dealType,
      item.type && String(item.type).indexOf('land') === 0 ? '매매' : '')).trim();
    if (deal === '매매') return 'sale';
    if (deal === '전세' || deal === '월세' || deal === '임대') return 'rent';
    if (has(item.salePrice)) return 'sale';
    if (has(item.deposit) || has(item.monthlyRent)) return 'rent';
    return 'unknown';
  }
  function dealLabel(item) {
    return String(first(item.dealType, item.shop_dealType, item.officetel_dealType, item.factory_dealType, item.biz_dealType)).trim();
  }

  // ---------- 가격·면적 글자 ----------
  function formatWon(value) {
    var text = has(value) ? String(value).trim() : '';
    if (!text) return '';
    if (/[가-힣]/.test(text)) return text;               // "90억", "협의" 처럼 이미 글자면 그대로
    var digits = text.replace(/[^\d]/g, '');
    var n = Number(digits);
    if (!digits || !n) return '';
    var eok = Math.floor(n / 100000000), man = Math.floor((n % 100000000) / 10000);
    var parts = [];
    if (eok) parts.push(eok.toLocaleString('ko-KR') + '억');
    if (man) parts.push(man.toLocaleString('ko-KR') + '만');
    return parts.length ? parts.join(' ') : n.toLocaleString('ko-KR') + '원';
  }
  function manToWon(value) {                              // 예전 칸들은 만원 단위로 저장돼 있음
    if (!has(value)) return '';
    var text = String(value).trim();
    if (/[가-힣]/.test(text)) return text;
    var n = Number(text.replace(/[^\d.]/g, ''));
    return n ? formatWon(Math.round(n * 10000)) : '';
  }
  function priceInfo(item) {
    var sale = first(formatWon(item.salePrice), manToWon(item.land_price), manToWon(item.officetel_price), manToWon(item.factory_price), manToWon(item.biz_price));
    var deposit = first(formatWon(item.deposit), manToWon(item.shop_deposit));
    var rent = first(formatWon(item.monthlyRent), manToWon(item.shop_monthlyRent));
    var group = dealGroup(item), deal = dealLabel(item);
    if (group === 'sale') return sale ? { short: sale, long: '매매 ' + sale } : { short: '', long: '' };
    if (group === 'rent') {
      if (deal === '전세' && deposit) return { short: '전세 ' + deposit, long: '전세 ' + deposit };
      if (deposit && rent) return { short: deposit + '/' + rent, long: '보증금 ' + deposit + ' / 월세 ' + rent };
      if (deposit) return { short: deposit, long: '보증금 ' + deposit };
      if (rent) return { short: '월 ' + rent, long: '월세 ' + rent };
      return { short: '', long: '' };
    }
    if (sale) return { short: sale, long: sale };
    return { short: '', long: '' };
  }
  function areaPart(py, m2) {
    if (has(py)) return String(py).trim() + '평';
    if (has(m2)) return String(m2).trim() + '㎡';
    return '';
  }
  function areaText(item, key) {
    if (key === 'land') return areaPart(item.areaPy || item.land_area_py || item.land_py, item.areaM2 || item.land_area_sqm);
    if (key === 'shop' || key === 'home') {
      return areaPart(first(item.exclusiveAreaPy, item.shop_area_py, item.officetel_area_py, item.biz_privArea_py), first(item.exclusiveAreaM2, item.shop_area_sqm, item.officetel_area_sqm, item.biz_privArea_sqm));
    }
    return areaPart(first(item.totalFloorAreaPy, item.buildingAreaPy, item.factory_buildArea_py, item.factory_area_py, item.landAreaPy),
      first(item.totalFloorAreaM2, item.buildingAreaM2, item.factory_buildArea_sqm, item.landAreaM2));
  }

  // ---------- 주소·위치 ----------
  function normalizeAddress(text) {
    var value = String(text || '').replace(/\([^)]*\)/g, ' ').replace(/\s*외\s*\d+\s*필지.*$/, '').replace(/\s+/g, ' ').trim();
    value = value.replace(/\s+\d+\s*층.*$/, '').replace(/\s+[A-Za-z가-힣0-9-]*\s*\d+\s*호.*$/, '').trim();
    if (!value) return '';
    return /파주|(?:서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|전북|전남|경북|경남|제주)|[가-힣]+(?:시|군)\s/.test(value) ? value : '파주시 ' + value;
  }
  function addressCandidates(item) {
    var seen = {}, list = [];
    [item.mapAddress, item.roadAddress, item.jibunAddress, item.address, item.publicAddress, item.displayAddress, item.locationAddress, item.privateAddress, item.quick_location].forEach(function (raw) {
      if (!has(raw) || !ADDRESS_HINT.test(String(raw))) return;
      var q = normalizeAddress(raw);
      if (q && !seen[q]) { seen[q] = true; list.push(q); }
    });
    return list;
  }
  function listingCoordinates(item) {
    var p = item && item.mapCoordinates;
    var lat = p && Number(p.lat), lng = p && Number(p.lng);
    return p && Number.isFinite(lat) && Number.isFinite(lng) && lat >= 33 && lat <= 39 && lng >= 124 && lng <= 132 ? [lat, lng] : null;
  }
  function displayAddress(item) {
    return String(first(item.mapAddress, item.roadAddress, item.jibunAddress, item.publicAddress, item.displayAddress, item.address, item.quick_location)).trim();
  }
  function titleOf(item) {
    return String(first(item.title, item.complexName, item.buildingName, item.building_name, displayAddress(item), '매물')).trim();
  }
  function buildingNameOf(item) {
    return String(first(item.complexName, item.buildingName, item.building_name, item.complex_name, item.shop_building, item.officetel_complex)).trim();
  }
  function ownerOf(item) {
    return {
      name: String(first(item.owner_name, item.quick_owner)).trim(),
      phone: String(first(item.owner_phone1, item.owner_contact, item.quick_contact)).trim()
    };
  }

  // ---------- 검색·묶기 ----------
  function searchText(item) {
    return [item.title, buildingNameOf(item), item.publicAddress, item.mapAddress, item.roadAddress, item.jibunAddress, item.address,
      item.owner_name, item.quick_owner].filter(has).join(' ').toLowerCase();
  }
  // 같은 자리(약 1m 이내)에 있는 매물을 하나로 묶는다.
  function groupByPosition(points) {
    var map = {}, order = [];
    points.forEach(function (p) {
      var key = p.lat.toFixed(5) + ',' + p.lng.toFixed(5);
      if (!map[key]) { map[key] = { key: key, lat: p.lat, lng: p.lng, points: [] }; order.push(key); }
      map[key].points.push(p);
    });
    return order.map(function (k) { return map[k]; });
  }

  var api = {
    CATEGORIES: CATEGORIES, categoryKey: categoryKey, categoryInfo: categoryInfo, isOnMap: isOnMap,
    dealGroup: dealGroup, dealLabel: dealLabel, formatWon: formatWon, priceInfo: priceInfo, areaText: areaText,
    normalizeAddress: normalizeAddress, addressCandidates: addressCandidates, listingCoordinates: listingCoordinates,
    displayAddress: displayAddress, titleOf: titleOf, buildingNameOf: buildingNameOf, ownerOf: ownerOf,
    searchText: searchText, groupByPosition: groupByPosition
  };
  root.HitopListingsMapCore = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
