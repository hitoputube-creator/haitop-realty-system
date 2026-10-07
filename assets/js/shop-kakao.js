/* 상가·주거 카카오맵 화면
 * - 상가 자료관리에 등록한 건물(카테고리 '상가')의 주소(예: 와동동 1436외1필지)를 카카오 지오코딩으로 위경도로 바꿔 지도에 표시합니다.
 * - 호실 현황(공실 여부)은 기존 상가 위치도와 같은 buildings.units 자료를 읽기만 합니다. DB는 수정하지 않습니다.
 * - 변환한 위치는 이 브라우저(localStorage)에 저장해 다음 방문부터 바로 표시합니다. (택지 지도와 같은 저장소를 공유)
 */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var residential = document.body.dataset.resourceScope === 'residential';
  var scope = residential ? 'residential' : 'commercial';
  var label = residential ? '주거' : '상가';
  var prefix = residential ? 'residential' : 'shop';
  var requestedId = new URLSearchParams(location.search).get('id');
  var CACHE_KEY = 'hitop-kakao-geo-v1';
  var ADDRESS_PATTERN = /[가-힣]+(?:동|리)\s*(?:산\s*)?\d+(?:-\d+)?/;
  var DEFAULT_CENTER = [37.7226, 126.7500], DEFAULT_LEVEL = 5;

  var statusEl = $('kakaoStatus');
  var map = null, geocoder = null, infoWindow = null;
  var items = [];                 // {id,name,address,query,total,vacant,state,floors,lat,lng,overlay,el}
  var geoCache = loadCache();
  var activeOverlays = new Set();
  var selectedId = '';
  var saved = {};                 // 직접 옮겨 저장한 위치: 건물 id -> [lat, lng]
  var geoAvailable = true;        // 위치 저장용 표(shop_building_geo)를 쓸 수 있는지
  var editing = false;            // 핀 위치 수정 모드

  function setStatus(text) { statusEl.textContent = text; }
  function loadCache() { try { return JSON.parse(OfficeStorage.local.getItem(CACHE_KEY) || '{}') || {}; } catch (e) { return {}; } }
  function saveCache() { try { OfficeStorage.local.setItem(CACHE_KEY, JSON.stringify(geoCache)); } catch (e) { /* 저장 공간이 없어도 화면은 동작 */ } }
  function normalizeAddress(text) {
    var value = String(text || '').replace(/\s+/g, ' ').trim();
    return /파주/.test(value) ? value : '파주시 ' + value;
  }


  function hasOwnerContact(unit) {
    return Boolean(String(unit.소유주 || '').trim() && String(unit.연락처 || '').trim());
  }
  function hasListing(unit) { return Boolean(String(unit.listing_id || '').trim()); }


  function apartmentNameKey(value) {
    return String(value || '').replace(/\([^)]*\)/g,'').replace(/아파트/g,'').replace(/\s+/g,'').trim();
  }
  function listingNames(listing) {
    var unit=listing.apartmentUnitData || listing.import_unit_snapshot || {};
    return [listing.complexName,listing.buildingName,unit.아파트명].filter(Boolean).map(apartmentNameKey);
  }
  function listingCoordinates(listing) {
    var p=listing.mapCoordinates;
    return p && Number.isFinite(p.lat) && Number.isFinite(p.lng) && p.lat>=33 && p.lat<=39 && p.lng>=124 && p.lng<=132 ? [p.lat,p.lng] : null;
  }
  function mergeResidentialListings(mapped, listings) {
    mapped.forEach(function(it){it.listings=[];});
    (listings || []).forEach(function(listing){
      if (listing.status === '거래완료') return;
      var names=listingNames(listing);
      var it=mapped.find(function(row){return listing.resource_id && row.id === listing.resource_id;});
      if (!it) it=mapped.find(function(row){return row.unitListingIds.includes(String(listing.id));});
      var isApartment=listing.type === 'apartment' || listing.category2 === '아파트';
      if (!it && isApartment) {
        var named=mapped.filter(function(row){return row.apartment && names.includes(apartmentNameKey(row.name));});
        if(named.length===1)it=named[0];
      }
      if (!it && isApartment) {
        var addresses=[listing.roadAddress,listing.jibunAddress,listing.mapAddress,listing.address].filter(Boolean).map(addressKey);
        var addressed=mapped.filter(function(row){return row.apartment && [row.roadAddress,row.lotAddress].filter(Boolean).some(function(address){return addresses.includes(addressKey(address));});});
        if(addressed.length===1)it=addressed[0];
      }
      if (!it && isApartment) {
        var road=listing.roadAddress || '',lot=listing.jibunAddress || '';
        var address=road || lot || listing.mapAddress || listing.address || '';
        if (!address && !listingCoordinates(listing)) return;
        var name=listing.complexName || listing.buildingName || (listing.apartmentUnitData || {}).아파트명 || listing.title || address;
        it=mapped.find(function(row){return row.listingOnly && apartmentNameKey(row.name)===apartmentNameKey(name) && addressKey(row.address)===addressKey(address);});
        if(!it){
          var match=address.match(ADDRESS_PATTERN);
          it={id:'listing:'+listing.id,name:name,address:address,apartment:true,listingOnly:true,
            roadAddress:road,lotAddress:lot,query:match ? match[0] : address,
            total:0,vacant:0,contacts:0,listed:0,unitListingIds:[],listings:[],state:'none',floors:[],
            lat:null,lng:null,overlay:null,el:null};
          mapped.push(it);
        }
      }
      if(it && !it.registrationCoordinates)it.registrationCoordinates=listingCoordinates(listing);
      if(it && !it.listings.some(function(row){return String(row.id)===String(listing.id);}))it.listings.push(listing);
    });
    mapped.forEach(function(it){it.listed=it.listings.length;});
    return mapped;
  }

  // ---------- 데이터 불러오기 (기존 상가 위치도와 같은 출처) ----------
  async function loadBuildings() {
    var session = await hitopAuthClient.auth.getSession();
    if (session.error || !session.data.session) { hitopRedirectToLogin(); return null; }
    hitopApplyAuthHeader(session.data.session);
    var results = await Promise.all([
      getDriveResources(),
      getAllBuildingFloors(),
      fetchWithTimeout(SUPABASE_URL + '/rest/v1/buildings?select=local_id,name,units', { headers: headers }),
      getDriveCategories(),
      residential ? getListings() : Promise.resolve([])
    ]);
    var resources = results[0], floors = results[1], recordsRes = results[2];
    if (!recordsRes.ok) throw new Error('건물 호실 자료를 불러오지 못했습니다.');
    var records = await recordsRes.json();
    // 자료실 카테고리를 기준으로 상가·주거를 구분하며, 새 주거 카테고리도 포함합니다.
    var mapped = HitopResourceRooms.visible(resources, scope).filter(function (r) { return residential || /상가/.test(String(r.category || '')); }).map(function (r) {
      var rec = records.find(function (x) { return x.local_id === r.id; }) || records.find(function (x) { return x.name === r.name; }) || null;
      var line = String(r.memo || '').split('\n').find(function (l) { return /^주소\s*:/.test(l); });
      var address = line ? line.replace(/^주소\s*:/, '').trim() : '';
      var fields = {};
      String(r.memo || '').split('---추가메모---')[0].split('\n').forEach(function (line) {
        var colon=line.indexOf(':');if(colon>=0) fields[line.slice(0,colon).trim()]=line.slice(colon+1).trim();
      });
      var category=String(r.category || '').replace(/\s+/g,'');
      var housingType=String(fields['주택종류'] || '').replace(/\s+/g,'');
      var apartment=!/오피스텔|상가/.test(category) && !/상가/.test(r.name) && (housingType ? housingType === '아파트' : category === '아파트');
      var match = address.match(ADDRESS_PATTERN);
      var units = rec && Array.isArray(rec.units) ? rec.units : [];
      var vacant = units.filter(function (u) { return u.공실여부 === '공실'; }).length;
      return {
        id: r.id, name: r.name, address: address, apartment: apartment, roadAddress: fields['주소'] || '', lotAddress: fields['지번주소'] || '', completion:fields['단지상태'] || '', moveInMonth:fields['입주예정월'] || '', query: match ? match[0] : /[가-힣]+(?:로|길)\s*\d+/.test(address) ? address : '',
        unitListingIds: units.filter(hasListing).map(function(u){return String(u.listing_id);}),
        total: units.length, vacant: vacant, contacts: units.filter(hasOwnerContact).length, listed: units.filter(hasListing).length,
        state: !units.length ? 'none' : vacant ? 'vacant' : 'full',
        floors: floors.filter(function (f) { return f.building_id === r.id; }),
        lat: null, lng: null, overlay: null, el: null
      };
    });
    return residential ? mergeResidentialListings(mapped, results[4]) : mapped;
  }

  // ---------- 지오코딩 ----------
  function geocode(query) {
    return new Promise(function (resolve) {
      geocoder.addressSearch(normalizeAddress(query), function (result, status) {
        if (status === kakao.maps.services.Status.OK && result[0]) resolve({ lat: Number(result[0].y), lng: Number(result[0].x) });
        else if (status === kakao.maps.services.Status.ZERO_RESULT) resolve(null);
        else resolve(undefined); // 일시 오류: 저장하지 않고 다음에 다시 시도
      });
    });
  }

  async function resolveAll(retryFailed) {
    var wanted = items.filter(function (it) { return it.query; });
    var unique = Array.from(new Set(wanted.map(function (it) { return normalizeAddress(it.query); })));
    var queue = unique.filter(function (key) { return geoCache[key] === undefined || (retryFailed && geoCache[key] === 0); });
    var done = 0;
    var workers = Array.from({ length: 4 }, async function () {
      while (queue.length) {
        var key = queue.shift();
        var result = await geocode(key);
        if (result) geoCache[key] = [result.lat, result.lng];
        else if (result === null) geoCache[key] = 0;
        done++;
        if (done % 5 === 0) setStatus('건물 위치를 찾는 중입니다. (' + done + '/' + (done + queue.length) + ')');
      }
    });
    await Promise.all(workers);
    saveCache();
    // 같은 지번에 건물이 둘 이상이면 겹치지 않게 살짝 옆으로 벌려 표시합니다. 직접 옮겨 저장한 위치는 그대로 씁니다.
    var used = {};
    items.forEach(function (it) {
      it.lat = null; it.lng = null; it.overlay = null; it.el = null; it.manual = false;
      if (saved[it.id]) { it.lat = saved[it.id][0]; it.lng = saved[it.id][1]; it.manual = true; return; }
      if (it.registrationCoordinates) {it.lat=it.registrationCoordinates[0];it.lng=it.registrationCoordinates[1];return;}
      if (!it.query) return;
      var hit = geoCache[normalizeAddress(it.query)];
      if (!Array.isArray(hit)) return;
      var n = used[hit[0] + ',' + hit[1]] = (used[hit[0] + ',' + hit[1]] || 0) + 1;
      it.lat = hit[0];
      it.lng = hit[1] + (n - 1) * 0.00018;
    });
  }

  // ---------- 핀 위치 직접 수정 (shop_building_geo) ----------
  async function loadSaved() {
    try {
      var res = await fetchWithTimeout(SUPABASE_URL + '/rest/v1/shop_building_geo?select=building_id,lat,lng', { headers: headers });
      if (!res.ok) { geoAvailable = false; return; }
      (await res.json()).forEach(function (row) {
        if (Number.isFinite(Number(row.lat)) && Number.isFinite(Number(row.lng))) saved[row.building_id] = [Number(row.lat), Number(row.lng)];
      });
    } catch (e) { geoAvailable = false; }
  }

  async function savePosition(it, lat, lng) {
    var res = await fetchWithTimeout(SUPABASE_URL + '/rest/v1/shop_building_geo?on_conflict=building_id', {
      method: 'POST',
      headers: Object.assign({}, headers, { Prefer: 'resolution=merge-duplicates,return=minimal' }),
      body: JSON.stringify({ building_id: it.id, lat: lat, lng: lng, updated_at: new Date().toISOString() })
    });
    if (!res.ok) throw new Error('위치를 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.');
    saved[it.id] = [lat, lng];
  }

  async function deletePosition(it) {
    var res = await fetchWithTimeout(SUPABASE_URL + '/rest/v1/shop_building_geo?building_id=eq.' + encodeURIComponent(it.id), {
      method: 'DELETE', headers: headers
    });
    if (!res.ok) throw new Error('자동 위치로 되돌리지 못했습니다. 잠시 후 다시 시도해 주세요.');
    delete saved[it.id];
  }

  function selectedItem() { return items.find(function (x) { return x.id === selectedId; }) || null; }

  function updateEditUi() {
    var it = selectedItem();
    $('shopEditToggle').setAttribute('aria-pressed', String(editing));
    $('shopEditToggle').textContent = editing ? '핀 위치 수정 끝내기' : '핀 위치 수정';
    $('shopEditHelp').hidden = !editing;
    $('shopEditReset').hidden = !(editing && it && it.manual);
    $('kakaoMap').classList.toggle('shop-editing', editing);
  }

  function selectForEdit(it) {
    var previous = selectedItem();
    if (previous && previous.el) previous.el.classList.remove('selected');
    selectedId = it.id;
    if (it.el) it.el.classList.add('selected');
    infoWindow.close();
    updateEditUi();
    setStatus('수정할 건물: ' + it.name + ' — 지도에서 건물이 있는 정확한 자리를 눌러 주세요. (핀의 뾰족한 끝이 그 자리에 놓입니다)');
  }

  async function placeSelected(latLng) {
    var it = selectedItem();
    if (!editing || !it) return;
    try {
      await savePosition(it, latLng.getLat(), latLng.getLng());
      it.lat = latLng.getLat(); it.lng = latLng.getLng(); it.manual = true;
      it.overlay = null; it.el = null;
      render(false);
      var again = selectedItem();
      if (again && again.el) again.el.classList.add('selected');
      updateEditUi();
      setStatus(it.name + ' 위치를 저장했습니다. 다른 건물을 고르거나 [핀 위치 수정 끝내기]를 눌러 주세요.');
    } catch (error) {
      setStatus(error && error.message ? error.message : '위치를 저장하지 못했습니다.');
    }
  }

  async function resetSelected() {
    var it = selectedItem();
    if (!it || !it.manual) return;
    $('shopEditReset').disabled = true;
    try {
      await deletePosition(it);
      await resolveAll(false);
      render(false);
      var again = selectedItem();
      if (again && again.el) again.el.classList.add('selected');
      updateEditUi();
      setStatus(it.name + ' 위치를 주소 기준 자동 위치로 되돌렸습니다.');
    } catch (error) {
      setStatus(error && error.message ? error.message : '되돌리지 못했습니다.');
    } finally {
      $('shopEditReset').disabled = false;
    }
  }

  function toggleEditing() {
    if (!geoAvailable) { setStatus('위치 저장용 표를 사용할 수 없어 핀을 옮길 수 없습니다.'); return; }
    closeListingMenu();
    editing = !editing;
    infoWindow.close();
    updateEditUi();
    if (editing) setStatus('핀 위치 수정 모드입니다. 지도의 핀이나 아래 목록에서 건물을 고른 뒤, 지도에서 정확한 자리를 눌러 주세요.');
    else render(false);
  }

  // ---------- 지도 표시 ----------
  function stateText(it) { return !it.total ? '호실 미등록' : '공실 ' + it.vacant + '/' + it.total; }

  function countsText(it) { return residential ? '연락처 ' + it.contacts + ' · 매물 ' + it.listed : '공실등록 ' + it.vacant + ' · 연락처 확보 ' + it.contacts + ' · 매물등록 ' + it.listed; }

  function unitListUrl(it) {
    if (it.listingOnly && it.listings[0]) return OfficeConfig.urlFor('detail.html?id=' + encodeURIComponent(it.listings[0].id));
    return HitopResourceRooms.detailUrl('building-detail.html', it.id, scope) + '#unitStatus';
  }


  // ---------- 지도 오른쪽 클릭 → 아파트 매물추가 ----------
  var listingMenu = null, listingMenuVersion = 0;
  function closeListingMenu() {
    listingMenuVersion++;
    if (listingMenu) listingMenu.setMap(null);
    listingMenu = null;
  }
  function distanceMeters(it, position) {
    if (it.lat === null || it.lng === null) return Infinity;
    var dy = (it.lat - position.getLat()) * 111320;
    var dx = (it.lng - position.getLng()) * 111320 * Math.cos(position.getLat() * Math.PI / 180);
    return Math.sqrt(dx * dx + dy * dy);
  }
  function addressKey(value) {
    return String(value || '').replace(/^(경기도|경기)\s*/, '').replace(/\s+/g, '').replace(/\(.*?\)/g, '').replace(/외.*$/, '');
  }
  function apartmentListingUrl(selection, name, road, lot, position) {
    var params = new URLSearchParams({
      mapApartment: '1', apartmentName: name, roadAddress: road || '',
      jibunAddress: lot || '', resourceScope: 'residential'
    });
    if(selection && selection.lat!=null && selection.lng!=null){params.set('mapLat',selection.lat);params.set('mapLng',selection.lng);}
    else if(position){params.set('mapLat',position.getLat());params.set('mapLng',position.getLng());}
    if(selection && selection.completion==='입주예정')params.set('presale','1');
    if(selection && /^20\d{2}-\d{2}$/.test(selection.moveInMonth || ''))params.set('moveInMonth',selection.moveInMonth);
    if (selection && selection.id && !selection.listingOnly) params.set('buildingId', selection.id);
    return OfficeConfig.urlFor('register.html?' + params.toString());
  }
  async function openListingMenu(position, knownItem) {
    if (!residential || editing) return;
    closeListingMenu();
    infoWindow.close();
    var version = listingMenuVersion;
    var root = document.createElement('div');
    root.className = 'apartment-map-menu';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-label', '아파트 매물추가');
    var header = document.createElement('div'); header.className = 'apartment-map-menu-head';
    var title = document.createElement('strong'); title.textContent = '아파트 매물추가';
    var close = document.createElement('button'); close.type = 'button'; close.textContent = '×';
    close.setAttribute('aria-label', '닫기'); close.addEventListener('click', closeListingMenu);
    header.append(title, close); root.appendChild(header);
    var status = document.createElement('p'); status.textContent = '위치 정보를 확인하는 중…'; root.appendChild(status);
    ['mousedown', 'touchstart', 'click', 'contextmenu'].forEach(function (eventName) {
      root.addEventListener(eventName, function (event) {
        event.stopPropagation(); kakao.maps.event.preventMap();
        if (eventName === 'contextmenu') event.preventDefault();
      });
    });
    listingMenu = new kakao.maps.CustomOverlay({position:position,content:root,xAnchor:0.5,yAnchor:1.05,zIndex:30,clickable:true});
    listingMenu.setMap(map);
    var addressPromise = knownItem ? Promise.resolve(null) : new Promise(function (resolve) {
      var timeout = setTimeout(function () { resolve(null); }, 8000);
      try {
        geocoder.coord2Address(position.getLng(), position.getLat(), function (result, code) {
          clearTimeout(timeout);
          resolve(code === kakao.maps.services.Status.OK && result[0] ? result[0] : null);
        });
      } catch (_) { clearTimeout(timeout); resolve(null); }
    });
    var address = null;
    var road = address && address.road_address || {};
    var lot = address && address.address || {};
    var candidates = items.filter(function (it) {
      return it.apartment && (it === knownItem || distanceMeters(it, position) <= 800);
    }).sort(function (a,b) { return distanceMeters(a,position) - distanceMeters(b,position); }).slice(0,10);
    var exact = knownItem && knownItem.apartment ? knownItem : items.find(function (it) {
      return it.apartment && (
        (lot.address_name && addressKey(it.lotAddress) === addressKey(lot.address_name)) ||
        (road.address_name && addressKey(it.roadAddress) === addressKey(road.address_name))
      );
    });
    if (exact && !candidates.includes(exact)) candidates.unshift(exact);
    var selection = exact || null;
    status.textContent = selection ? selection.name : road.address_name || lot.address_name || '아파트를 선택하거나 이름을 입력하세요.';
    var select = document.createElement('select'); select.setAttribute('aria-label','아파트 선택');
    var empty = document.createElement('option'); empty.value = ''; empty.textContent = '직접 입력 / 다른 아파트'; select.appendChild(empty);
    candidates.forEach(function (it) { var option=document.createElement('option'); option.value=it.id; option.textContent=it.name;select.appendChild(option); });
    select.value = selection ? selection.id : '';
    select.hidden=!candidates.length;root.appendChild(select);
    var name = document.createElement('input'); name.type='text';name.placeholder='아파트명';name.setAttribute('aria-label','아파트명');
    name.value = selection ? selection.name : road.building_name || '';
    root.appendChild(name);
    var chosenRoad = selection ? selection.roadAddress : road.address_name || '';
    var chosenLot = selection ? selection.lotAddress : lot.address_name || '';
    var addressLine=document.createElement('p'); addressLine.textContent=chosenRoad || chosenLot || '등록창에서 주소를 입력해 주세요.';root.appendChild(addressLine);
    select.addEventListener('change',function () {
      selection = candidates.find(function (it) { return it.id === select.value; }) || null;
      name.value = selection ? selection.name : road.building_name || '';
      chosenRoad = selection ? selection.roadAddress : road.address_name || '';
      chosenLot = selection ? selection.lotAddress : lot.address_name || '';
      addressLine.textContent=chosenRoad || chosenLot || '등록창에서 주소를 입력해 주세요.';
    });
    name.addEventListener('input',function () {
      if (selection && name.value.trim() !== selection.name) { selection=null;select.value=''; }
    });
    var add=document.createElement('button');add.type='button';add.className='apartment-map-menu-add';add.textContent='+ 아파트 매물추가';
    add.addEventListener('click',function () {
      location.href=apartmentListingUrl(selection,name.value.trim(),chosenRoad,chosenLot,position);
    });
    root.appendChild(add);
    addressPromise.then(function(found){
      if(version!==listingMenuVersion || selection)return;
      road=found && found.road_address || {};lot=found && found.address || {};
      chosenRoad=road.address_name || '';chosenLot=lot.address_name || '';
      if(!name.value.trim())name.value=road.building_name || '';
      addressLine.textContent=chosenRoad || chosenLot || '위치는 저장됩니다. 등록창에서 아파트명과 주소를 입력하세요.';
      status.textContent='선택한 위치에 매물을 등록합니다.';
    });
    if(!knownItem){
      try{
        new kakao.maps.services.Places().keywordSearch('아파트',function(results,code){
          if(version!==listingMenuVersion || code!==kakao.maps.services.Status.OK)return;
          results.filter(function(place){return /아파트/.test(place.place_name || '');}).forEach(function(place){
            if(candidates.some(function(it){return apartmentNameKey(it.name)===apartmentNameKey(place.place_name);}))return;
            var candidate={id:'place:'+place.id,listingOnly:true,apartment:true,name:place.place_name,roadAddress:place.road_address_name || '',lotAddress:place.address_name || '',lat:Number(place.y),lng:Number(place.x)};
            candidates.push(candidate);var option=document.createElement('option');option.value=candidate.id;option.textContent=candidate.name;select.appendChild(option);select.hidden=false;
          });
        },{location:position,radius:300,sort:kakao.maps.services.SortBy.DISTANCE});
      }catch(_){}
    }
  }

  function pinContent(it) {
    var el = document.createElement('div');
    el.className = 'shop-pin ' + (residential ? 'residential-pin full' : it.state) + (selectedId === it.id ? ' selected' : '');
    var body = document.createElement('div');
    body.className = 'shop-pin-body';
    var name = document.createElement('strong'); name.textContent = it.name;
    var sub = document.createElement('a'); sub.textContent = stateText(it);
    sub.className = 'shop-pin-units';
    sub.href = unitListUrl(it);
    sub.title = it.name + ' 층별 호실 리스트 보기';
    sub.setAttribute('aria-label', it.name + ' ' + stateText(it) + ' · 층별 리스트 보기');
    sub.addEventListener('click', function (event) {
      event.stopPropagation();
      if (editing) { event.preventDefault(); selectForEdit(it); }
    });
    var counts = document.createElement('a'); counts.className = 'shop-pin-counts';
    counts.textContent = '연락처 ' + it.contacts + ' · 매물 ' + it.listed;
    counts.href = unitListUrl(it); counts.title = '소유주·연락처 모두 입력된 호실 / 매물 연결된 호실';
    counts.addEventListener('click', function (event) { event.stopPropagation(); if (editing) { event.preventDefault(); selectForEdit(it); } });
    if (residential) {
      counts.textContent = '연락처 ' + it.contacts + ' · 매물 ' + it.listed;
      counts.title = it.name + ' · 세대 목록 보기';
      counts.setAttribute('aria-label', it.name + ' · ' + counts.textContent + ' · 세대 목록 보기');
      body.append(counts);
    } else body.append(name, sub, counts);
    el.appendChild(body);
    el.title = it.name + ' · ' + it.address;
    el.addEventListener('click', function () { if (editing) selectForEdit(it); else openInfo(it); });
    if (residential && it.apartment) el.addEventListener('contextmenu', function (event) {
      event.preventDefault();event.stopPropagation();kakao.maps.event.preventMap();
      openListingMenu(new kakao.maps.LatLng(it.lat,it.lng),it);
    });
    it.el = el;
    return el;
  }

  function matches(it) {
    var filter = $('shopVacancyFilter').value;
    if (residential) {
      if (!it.contacts && !it.listed) return false;
      if (filter === 'contacts' && !it.contacts) return false;
      if (filter === 'listed' && !it.listed) return false;
    } else if (filter !== 'all' && it.state !== filter) return false;
    var q = $('shopSearch').value.trim().toLowerCase();
    if (q && (it.name + ' ' + it.address).toLowerCase().indexOf(q) < 0) return false;
    return true;
  }

  function render(fit) {
    activeOverlays.forEach(function (o) { o.setMap(null); });
    activeOverlays.clear();
    var shown = 0, listed = items.filter(matches), bounds = new kakao.maps.LatLngBounds();
    listed.forEach(function (it) {
      if (it.lat === null) return;
      if (!it.overlay) {
        it.overlay = new kakao.maps.CustomOverlay({
          position: new kakao.maps.LatLng(it.lat, it.lng), content: pinContent(it),
          xAnchor: 0, yAnchor: 0, clickable: true, zIndex: residential ? 2 : it.state === 'vacant' ? 3 : 2
        });
      }
      it.overlay.setMap(map);
      activeOverlays.add(it.overlay);
      bounds.extend(new kakao.maps.LatLng(it.lat, it.lng));
      shown++;
    });
    if (fit && shown) map.setBounds(bounds, 60, 60, 60, 60);
    var relevant = residential ? listed : items;
    var noAddress = relevant.filter(function (it) { return !it.query; }).length;
    var missing = relevant.filter(function (it) { return it.query && it.lat === null; }).length;
    var text = residential ? '연락처·매물 등록 아파트 ' + listed.length + '개 중 ' + shown + '개 표시' : label + ' 건물 ' + items.length + '개 중 ' + shown + '개 표시';
    if (noAddress) text += ' · 주소 없음 ' + noAddress + '개';
    if (missing) text += ' · 지도에서 위치를 못 찾음 ' + missing + '개';
    setStatus(text);
    $('shopRetry').hidden = !missing;
    renderList(listed);
  }

  function renderList(listed) {
    var box = $('shopList');
    box.replaceChildren();
    listed.forEach(function (it) {
      var button = document.createElement('button');
      button.type = 'button';
      button.className = (residential ? 'full' : it.state) + (it.lat === null ? ' unplaced' : '');
      button.append(it.name);
      var small = document.createElement('small');
      small.textContent = countsText(it) + (it.lat === null ? ' · 지도 위치 없음' : it.manual ? ' · 위치 직접 지정' : '');
      button.appendChild(small);
      if (!residential) { var total = document.createElement('small'); total.textContent = '등록 호실 ' + it.total + '개'; button.appendChild(total); }
      button.addEventListener('click', function () {
        if (editing) {
          if (it.lat !== null) { map.setLevel(3); map.setCenter(new kakao.maps.LatLng(it.lat, it.lng)); }
          selectForEdit(it);
          $('kakaoMap').scrollIntoView({ behavior: 'smooth', block: 'center' });
          return;
        }
        if (it.lat === null) { openInfo(it, true); return; }
        map.setLevel(3);
        map.setCenter(new kakao.maps.LatLng(it.lat, it.lng));
        openInfo(it);
        $('kakaoMap').scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
      box.appendChild(button);
    });
    $('shopListCount').textContent = '(' + listed.length + '개)';
    $('shopListSection').hidden = false;
    $('shopLegend').hidden = residential;
  }

  function openInfo(it, noMap) {
    var previous = items.find(function (x) { return x.id === selectedId; });
    if (previous && previous.el) previous.el.classList.remove('selected');
    selectedId = it.id;
    if (it.el) it.el.classList.add('selected');

    var root = document.createElement('div');
    root.className = 'kk-info';
    var title = document.createElement('b'); title.textContent = it.name; root.appendChild(title);
    function line(text) { var s = document.createElement('span'); s.className = 'row'; s.textContent = text; root.appendChild(s); }
    line(it.address || '주소 없음');
    if (!residential) line(it.total ? '호실 ' + it.total + '개 · 공실 ' + it.vacant + '개' : '호실이 아직 등록되지 않았습니다.');
    line(countsText(it));
    var links = document.createElement('div'); links.className = 'links';
    function link(label, href) {
      var a = document.createElement('a'); a.href = href; a.textContent = label; links.appendChild(a);
    }
    var id = encodeURIComponent(it.id);
    if (!it.listingOnly) {
    link('건물 상세', HitopResourceRooms.detailUrl('building-detail.html', it.id, scope));
    link('위치도', prefix + '-location.html?id=' + id);
    link('개요', HitopResourceRooms.detailUrl('building-overview.html', it.id, scope));
    link(residential ? '세대 목록' : '층별 리스트', unitListUrl(it));
    }
    var first = it.floors[0];
    if (!residential) link('층별 현황', 'floor-status.html?' + new URLSearchParams(first ? { id: it.id, floorId: first.id, floor: String(first.floor_number || '') } : { id: it.id }).toString());
    if (it.lat !== null) {
      var a = document.createElement('a');
      a.href = 'https://map.kakao.com/link/map/' + encodeURIComponent(it.name) + ',' + it.lat + ',' + it.lng;
      a.target = '_blank'; a.rel = 'noopener'; a.textContent = '카카오맵';
      links.appendChild(a);
    }
    window.HitopNaverLinks.append(links, it.query || it.address, '', {lat:it.lat,lng:it.lng});
    root.appendChild(links);
    if (residential && it.listings && it.listings.length) {
      var listingBox=document.createElement('div'); listingBox.className='kk-registered-listings';
      listingBox.style.cssText='margin-top:8px;max-height:180px;overflow-y:auto;white-space:normal';
      it.listings.forEach(function(listing){
        var unit=listing.apartmentUnitData || listing.import_unit_snapshot || {};
        var dong=listing.dong || unit.동 || '', room=listing.ho || unit.호 || '';
        var unitName=(dong ? dong+'동 ' : '')+(room ? room+'호' : '');
        var a=document.createElement('a');
        a.href=OfficeConfig.urlFor('detail.html?id='+encodeURIComponent(listing.id));
        a.textContent=[unitName || listing.title || '매물',unit.권리구분 === '분양권' ? '분양권' : '',listing.dealType || unit.거래구분 || ''].filter(Boolean).join(' · ')+' 보기';
        a.style.cssText='display:block;padding:6px 0;color:#244e91;text-decoration:underline';
        listingBox.appendChild(a);
      });
      root.appendChild(listingBox);
    }
    if (noMap || it.lat === null) {
      line('지도에서 위치를 찾지 못했습니다. 자료관리에서 주소를 "와동동 1460"처럼 지번으로 확인해 주세요.');
      infoWindow.close();
      setStatus(it.name + ' · ' + (it.address || '주소 없음') + ' — 지도 위치 없음');
      return;
    }
    infoWindow.setContent(root);
    infoWindow.setPosition(new kakao.maps.LatLng(it.lat, it.lng));
    infoWindow.open(map);
  }

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
    $('shopVacancyFilter').addEventListener('change', function () { infoWindow.close(); render(true); });
    var timer = null;
    $('shopSearch').addEventListener('input', function () { clearTimeout(timer); timer = setTimeout(function () { render(true); }, 300); });
    $('shopFit').addEventListener('click', function () { render(true); });
    $('shopEditToggle').addEventListener('click', toggleEditing);
    $('shopEditReset').addEventListener('click', resetSelected);
    kakao.maps.event.addListener(map, 'click', function (mouseEvent) { closeListingMenu();placeSelected(mouseEvent.latLng);if(residential && !editing)$('apartmentMapRegister').href=apartmentListingUrl(null,'','','',mouseEvent.latLng); });
    if (residential) {
      $('apartmentMapRegister').href = apartmentListingUrl(null, '', '', '');
      $('kakaoMap').addEventListener('contextmenu',function(event){
        if(event.target.closest && event.target.closest('.apartment-map-menu'))return;
        event.preventDefault();event.stopPropagation();
        var rect=$('kakaoMap').getBoundingClientRect();
        var position=map.getProjection().coordsFromContainerPoint(new kakao.maps.Point(event.clientX-rect.left,event.clientY-rect.top));
        $('apartmentMapRegister').href=apartmentListingUrl(null,'','','',position);
        openListingMenu(position);
      },true);
      ['dragstart','zoom_changed'].forEach(function(event){kakao.maps.event.addListener(map,event,closeListingMenu);});
      document.addEventListener('keydown',function(event){if(event.key==='Escape')closeListingMenu();});
    }
    $('shopRetry').addEventListener('click', async function () {
      $('shopRetry').disabled = true;
      await resolveAll(true);
      render(false);
      $('shopRetry').disabled = false;
    });
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
    var key = String(window.HITOP_KAKAO_JS_KEY || '').trim();
    if (!key) { $('kakaoSetupNotice').hidden = false; setStatus('카카오맵 키가 설정되면 지도가 표시됩니다.'); return; }
    try {
      await loadSdk(key);
      $('kakaoMap').hidden = false;
      $('kakaoControls').hidden = false;
      map = new kakao.maps.Map($('kakaoMap'), { center: new kakao.maps.LatLng(DEFAULT_CENTER[0], DEFAULT_CENTER[1]), level: DEFAULT_LEVEL });
    window.HitopNaverLinks.bindMapView($('kakaoNaverListings'), map, residential ? 'home' : 'shop');
      geocoder = new kakao.maps.services.Geocoder();
      infoWindow = new kakao.maps.InfoWindow({ removable: true, zIndex: 10 });
      map.addControl(new kakao.maps.ZoomControl(), kakao.maps.ControlPosition.RIGHT);
      setStatus(label + ' 건물 자료를 불러오는 중입니다.');
      bindControls();
      var loaded = await loadBuildings();
      if (!loaded) return;
      items = loaded;
      if (!items.length) { setStatus('등록된 ' + label + ' 건물이 없습니다. ' + label + ' 자료관리에서 건물을 먼저 등록해 주세요.'); return; }
      setStatus('건물 위치를 찾는 중입니다.');
      await loadSaved();
      await resolveAll(false);
      render(true);
      var requested = items.find(function (it) { return it.id === requestedId; });
      if (requested) { if (requested.lat !== null) { map.setLevel(3); map.setCenter(new kakao.maps.LatLng(requested.lat, requested.lng)); } openInfo(requested); }
    } catch (error) {
      setStatus(error && error.message ? error.message : '지도를 표시하지 못했습니다.');
    }
  })();
})();

