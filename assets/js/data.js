// assets/js/data.js
(function () {
  "use strict";

  const Data = {};

  // localStorage keys
  Data.KEY_BUILDINGS = "buildings";
  Data.KEY_LISTINGS  = "listings";

  // ---------- Buildings ----------
  Data.getBuildings = function () {
    return StorageUtil.getArray(Data.KEY_BUILDINGS);
  };

  Data.findBuildingById = function (id) {
    return Data.getBuildings().find(b => b.id === id) || null;
  };

  // ---------- Listings ----------
  Data.getListings = function () {
    const arr = StorageUtil.getArray(Data.KEY_LISTINGS);
    // null/undefined 아이템 필터링
    return arr.filter(function(x){ return x && typeof x === "object"; });
  };

  Data.setListings = function (arr) {
    StorageUtil.setArray(Data.KEY_LISTINGS, arr);
  };

  Data.upsertListing = function (record) {
    const arr = Data.getListings();
    const idx = arr.findIndex(x => x.id === record.id);
    let next;
    if (idx >= 0) {
      next = arr.slice();
      next[idx] = record;
    } else {
      next = [record, ...arr];
    }
    Data.setListings(next);
    return next;
  };

  // ---------- Utils ----------
  Data.M2_PER_PY = 3.305785;

  Data.toPy = function (m2) {
    const n = Number(m2);
    if (!isFinite(n)) return "";
    return +(n / Data.M2_PER_PY).toFixed(2);
  };

  Data.toM2 = function (py) {
    const n = Number(py);
    if (!isFinite(n)) return "";
    return +(n * Data.M2_PER_PY).toFixed(2);
  };

  // "만원" 입력칸용: 빈값이면 0 반환
  Data.toNumberOrZero = function (v) {
    const n = Number(String(v ?? "").trim());
    return isFinite(n) ? n : 0;
  };

  // 문자열 정리
  Data.cleanText = function (v) {
    return String(v ?? "").trim().replace(/\s+/g, " ");
  };

  // ISO now
  Data.nowISO = function () {
    return new Date().toISOString();
  };

  // id
  Data.newListingId = function () {
    return StorageUtil.uid("l");
  };

  // 방향(향) 옵션
  Data.DIRECTIONS = [
    "남향","남동향","남서향","동향","서향","북동향","북서향","북향","확인중"
  ];

  // 층 키(상가 평면도/매물층 통일)
  Data.SHOP_FLOORS = ["B2","B1","1F","2F","3F","4F","5F","6F","7F","8F","9F","10F"];

  // 상태/거래유형
  Data.STATUS = ["거래가능","계약진행","보류","완료"];
  Data.DEALTYPE_COMMON = ["매매","전세","월세","임대","분양"];

  window.DataUtil = Data;
})();
