/* 매물 상세: 특별 조건·홍보 박스에 "이 호실 특별 조건 추가" 버튼
 * 기존 기록 입력창(HitopRecords.openForm)을 건물·호실을 미리 채워서 연다. 저장은 사용자가 입력창에서 직접 누른다.
 */
(function () {
  var cache = { key: "", hits: null }, timer = null, token = 0;

  function roomsOf(item) {
    var rooms = [];
    if (item.ho) rooms.push(String(item.ho));
    var bd = item.bundle_details || item.bundleDetails;
    if (bd && Array.isArray(bd.rooms)) bd.rooms.forEach(function (r) { rooms.push(String(r)); });
    return rooms;
  }
  function dongOf(item) { return [item.apartmentDong, item.dong, item["동"]].filter(Boolean).map(String); }

  function openAdd(item) {
    var HR = window.HitopRecords, rooms = roomsOf(item), dongs = dongOf(item);
    var defaults = { rooms: rooms.join(", ") };
    var opts = { buildingId: item.resource_id, defaults: defaults, onSaved: async function () {
      cache.key = "";
      if (typeof loadListingPromos === "function") { try { await loadListingPromos(); } catch (e) {} }
      sync();
    } };
    if (dongs.length) { opts.apartment = true; defaults.floor = dongs[0]; defaults.fu = "동"; }
    HR.openForm(opts);
  }

  async function hasHits(item) {
    var HR = window.HitopRecords, key = item.resource_id + "|" + roomsOf(item).join(",");
    if (cache.key === key && cache.hits !== null) return cache.hits;
    var data = await HR.fetchRecords(item.resource_id), rooms = roomsOf(item), dongs = dongOf(item);
    var hit = data.records.some(function (r) { return rooms.some(function (h) { return HR.roomsInclude(r, h); }) && (!(r.fu === "동") || !r.floor || dongs.indexOf(String(r.floor)) >= 0); });
    cache.key = key; cache.hits = hit; return hit;
  }

  function btn(item) {
    var b = document.createElement("button"); b.type = "button"; b.className = "pb-add hr-btn main"; b.textContent = "+ 이 호실 특별 조건 추가";
    b.style.marginLeft = "10px"; b.addEventListener("click", function () { openAdd(item); }); return b;
  }

  async function sync() {
    if (typeof _currentItem === "undefined" || !_currentItem || !_currentItem.resource_id || !window.HitopRecords) return;
    var box = document.getElementById("listingPromoBox"); if (!box) return;
    var item = _currentItem, my = ++token, hit;
    try { hit = await hasHits(item); } catch (e) { return; }
    if (my !== token) return;
    box = document.getElementById("listingPromoBox"); if (!box) return;
    window.HitopRecords.ensureStyle();
    var wrap = document.getElementById("pbAddWrap");
    if (hit) {
      if (wrap) wrap.remove();
      var title = box.querySelector(".detail-section-title");
      if (title && !title.querySelector(".pb-add")) title.appendChild(btn(item));
    } else if (!box.querySelector(".detail-section-title")) {
      if (!wrap) {
        wrap = document.createElement("div"); wrap.id = "pbAddWrap"; wrap.className = "detail-section"; wrap.style.marginTop = "14px";
        wrap.innerHTML = '<div class="detail-section-title">📌 특별 조건 · 홍보 <span style="font-size:12px;font-weight:400;color:var(--text-muted)">아직 없음</span></div>';
        wrap.querySelector(".detail-section-title").appendChild(btn(item));
        box.parentNode.insertBefore(wrap, box.nextSibling);
      }
    }
  }
  function schedule() { clearTimeout(timer); timer = setTimeout(sync, 400); }
  document.addEventListener("DOMContentLoaded", function () {
    var area = document.getElementById("detailArea") || document.body;
    new MutationObserver(schedule).observe(area, { childList: true, subtree: true });
    schedule(); setTimeout(sync, 2500);
  });
})();
