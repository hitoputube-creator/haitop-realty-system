// assets/js/storage.js
// 공통 localStorage 유틸 (나중에 listings도 같이 사용)

(function () {
  const Storage = {};

  Storage.safeJsonParse = function (s, fallback) {
    try { return JSON.parse(s); } catch { return fallback; }
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
})();
