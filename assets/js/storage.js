// assets/js/storage.js
// 공통 localStorage 유틸

(function () {
  const Storage = {};

  // ── Schema Migration ──────────────────────────────────────────────────
  const SCHEMA_VERSION = 2;

  Storage.migrateAll = function () {
    const ver = parseInt(localStorage.getItem("schemaVersion") || "1", 10);
    if (ver >= SCHEMA_VERSION) return;

    // v1 → v2: 기존 listings의 floor → floorGroup 변환
    try {
      const raw = localStorage.getItem("listings");
      if (raw) {
        const arr = Storage.safeJsonParse(raw, []);
        if (Array.isArray(arr)) {
          const migrated = arr.map(function (x) {
            const out = Object.assign({}, x);
            // null/undefined 안전처리
            ["title","address","buildingName","buildingId","status","dealType",
             "ownerName","ownerPhone","tenantName","tenantPhone","memo",
             "direction","unit","ho","dong","currentBiz","locAddress"].forEach(function(k){
              if (out[k] == null) out[k] = "";
            });
            // memoEntries 보장
            if (!Array.isArray(out.memoEntries)) {
              out.memoEntries = out.memo ? [{date:"", text: out.memo}] : [];
            }
            // floor → floorGroup 호환
            if (!out.floorGroup && out.floor) {
              const f = String(out.floor).toUpperCase();
              if (f === "1F") out.floorGroup = "1층";
              else if (f === "2F") out.floorGroup = "2층";
              else out.floorGroup = "상층부";
            }
            // attachments 보장
            if (!Array.isArray(out.attachments)) out.attachments = [];
            return out;
          });
          localStorage.setItem("listings", JSON.stringify(migrated));
        }
      }
    } catch(e) {
      console.warn("[migrate] listings 마이그레이션 오류:", e);
    }

    localStorage.setItem("schemaVersion", String(SCHEMA_VERSION));
    console.info("[Storage] 마이그레이션 완료 v" + ver + " → v" + SCHEMA_VERSION);
  };

  // ── Core Utils ───────────────────────────────────────────────────────
  Storage.safeJsonParse = function (s, fallback) {
    try { return JSON.parse(s); } catch (e) { return fallback; }
  };

  Storage.uid = function (prefix = "id") {
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  };

  Storage.getArray = function (key) {
    return Storage.safeJsonParse(localStorage.getItem(key), []) || [];
  };

  Storage.setArray = function (key, arr) {
    localStorage.setItem(key, JSON.stringify(arr));
  };

  Storage.downloadJson = function (filename, obj) {
    const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  window.StorageUtil = Storage;

  // 페이지 로드 시 자동 마이그레이션
  Storage.migrateAll();
})();
