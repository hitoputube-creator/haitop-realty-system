// 매물 상세: 건축물대장·등기부등본 등 서류 보관(비공개 저장소, 로그인한 직원만 열람)
(function () {
  "use strict";
  var BUCKET = "listing-documents";
  var MAX_BYTES = 30 * 1024 * 1024;
  var TYPES = ["건축물대장", "등기부등본", "기타"];
  var ALLOWED = /^(application\/pdf|image\/(jpeg|png|webp|heic|heif))$/i;
  var ALLOWED_EXT = /\.(pdf|jpe?g|png|webp|heic|heif)$/i;

  function esc(v) {
    return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function toast(msg) {
    if (typeof showToast === "function") showToast(msg, 3500); else alert(msg);
  }
  function fmtSize(n) {
    if (!n) return "";
    if (n < 1024 * 1024) return Math.max(1, Math.round(n / 1024)) + "KB";
    return (n / 1024 / 1024).toFixed(1) + "MB";
  }
  function fmtDate(iso) {
    var d = new Date(iso);
    if (isNaN(d)) return "";
    return d.getFullYear() + "." + String(d.getMonth() + 1).padStart(2, "0") + "." + String(d.getDate()).padStart(2, "0");
  }

  var listingId = new URLSearchParams(location.search).get("id");
  var root = document.getElementById("listingDocsArea");
  if (!root || !listingId) return;
  if (typeof OfficeConfig !== "undefined" && OfficeConfig.id === "ktop") return;

  function client() { return typeof hitopAuthClient !== "undefined" ? hitopAuthClient : null; }

  async function loadDocs() {
    var c = client();
    var res = await c.from("listing_documents").select("*").eq("listing_id", listingId).order("created_at", { ascending: true });
    if (res.error) throw res.error;
    return res.data || [];
  }

  function render(docs, busy) {
    var rows = docs.length ? docs.map(function (d) {
      return '<div class="ld-row" data-id="' + esc(d.id) + '">' +
        '<span class="ld-type ld-type-' + esc(d.doc_type) + '">' + esc(d.doc_type) + '</span>' +
        '<span class="ld-name" title="' + esc(d.original_name) + '">' + esc(d.original_name || "파일") + '</span>' +
        '<span class="ld-meta">' + esc(fmtSize(d.size_bytes)) + (d.created_at ? " · " + esc(fmtDate(d.created_at)) : "") + '</span>' +
        '<span class="ld-actions"><button type="button" class="btn btn-ghost ld-open">열기</button>' +
        '<button type="button" class="btn btn-ghost ld-del">삭제</button></span></div>';
    }).join("") : '<div class="ld-empty">등록된 서류가 없습니다.</div>';
    root.innerHTML =
      '<section class="detail-section ld-section">' +
      '<div class="detail-section-title">📄 건축물대장 · 등기부 서류</div>' +
      '<div class="ld-note">홈페이지에는 공개되지 않고, 로그인한 직원만 열람할 수 있습니다. (PDF·사진, 파일당 30MB 이하)</div>' +
      '<div class="ld-list">' + rows + '</div>' +
      '<div class="ld-upload">' +
      '<select class="ld-select" id="ldType">' + TYPES.map(function (t) { return "<option>" + t + "</option>"; }).join("") + '</select>' +
      '<input type="file" id="ldFile" accept=".pdf,image/*" multiple />' +
      '<button type="button" class="btn btn-primary" id="ldUpload"' + (busy ? " disabled" : "") + '>' + (busy ? "올리는 중…" : "서류 올리기") + '</button>' +
      '</div></section>';
    bind(docs);
  }

  async function refresh(busy) {
    try { render(await loadDocs(), busy); }
    catch (e) {
      root.innerHTML = '<section class="detail-section ld-section"><div class="detail-section-title">📄 건축물대장 · 등기부 서류</div><div class="ld-empty">서류 목록을 불러오지 못했습니다. 로그인과 권한을 확인해 주세요.</div></section>';
      console.warn("[서류] 목록 실패", e && e.message || e);
    }
  }

  function bind(docs) {
    var byId = {}; docs.forEach(function (d) { byId[d.id] = d; });
    root.querySelectorAll(".ld-open").forEach(function (btn) {
      btn.addEventListener("click", async function () {
        var d = byId[btn.closest(".ld-row").dataset.id];
        var win = window.open("", "_blank");
        try {
          var r = await client().storage.from(BUCKET).createSignedUrl(d.storage_path, 300);
          if (r.error || !r.data || !r.data.signedUrl) throw r.error || new Error("no url");
          if (win) win.location.href = r.data.signedUrl; else window.open(r.data.signedUrl, "_blank");
        } catch (e) { if (win) win.close(); toast("서류를 열지 못했습니다. 다시 로그인한 뒤 시도해 주세요."); }
      });
    });
    root.querySelectorAll(".ld-del").forEach(function (btn) {
      btn.addEventListener("click", async function () {
        var d = byId[btn.closest(".ld-row").dataset.id];
        if (!confirm("'" + (d.original_name || "서류") + "' 파일을 삭제할까요? 삭제하면 복구할 수 없습니다.")) return;
        try {
          var r1 = await client().storage.from(BUCKET).remove([d.storage_path]);
          if (r1.error) throw r1.error;
          var r2 = await client().from("listing_documents").delete().eq("id", d.id);
          if (r2.error) throw r2.error;
          toast("삭제했습니다.");
        } catch (e) { toast("삭제하지 못했습니다: " + (e.message || e)); }
        refresh(false);
      });
    });
    var up = root.querySelector("#ldUpload");
    if (up) up.addEventListener("click", upload);
  }

  async function upload() {
    var input = root.querySelector("#ldFile");
    var type = root.querySelector("#ldType").value;
    var files = Array.from(input.files || []);
    if (!files.length) { toast("올릴 파일을 먼저 선택하세요."); return; }
    for (var i = 0; i < files.length; i++) {
      var f = files[i];
      if (!(ALLOWED.test(f.type || "") || ALLOWED_EXT.test(f.name || ""))) { toast("PDF 또는 사진 파일만 올릴 수 있습니다: " + f.name); return; }
      if (f.size > MAX_BYTES) { toast("파일이 너무 큽니다(30MB 이하): " + f.name); return; }
    }
    root.querySelector("#ldUpload").disabled = true;
    root.querySelector("#ldUpload").textContent = "올리는 중…";
    var c = client(), ok = 0, who = "";
    try { var u = await c.auth.getUser(); who = (u.data && u.data.user && u.data.user.email) || ""; } catch (_) {}
    var safeId = String(listingId).replace(/[^a-zA-Z0-9_-]/g, "-");
    for (var j = 0; j < files.length; j++) {
      var file = files[j];
      var ext = ((file.name || "").split(".").pop() || "pdf").replace(/[^a-zA-Z0-9]/g, "").toLowerCase() || "pdf";
      var path = safeId + "/" + Date.now() + "-" + Math.random().toString(36).slice(2) + "." + ext;
      var contentType = file.type || (ext === "pdf" ? "application/pdf" : "application/octet-stream");
      try {
        var up1 = await c.storage.from(BUCKET).upload(path, file, { contentType: contentType, upsert: false });
        if (up1.error) throw up1.error;
        var ins = await c.from("listing_documents").insert({
          listing_id: listingId, doc_type: type, storage_path: path,
          original_name: file.name, mime_type: contentType, size_bytes: file.size, uploaded_by: who
        });
        if (ins.error) { await c.storage.from(BUCKET).remove([path]); throw ins.error; }
        ok++;
      } catch (e) { toast("올리지 못했습니다(" + file.name + "): " + (e.message || e)); }
    }
    if (ok) toast(ok + "개 서류를 저장했습니다.");
    refresh(false);
  }

  async function start() {
    try { if (window.hitopAuthReady) await window.hitopAuthReady; } catch (_) {}
    for (var t = 0; t < 60; t++) {
      if (client() && typeof _currentItem !== "undefined" && _currentItem) break;
      await new Promise(function (r) { setTimeout(r, 250); });
    }
    if (!client() || typeof _currentItem === "undefined" || !_currentItem) return;
    refresh(false);
  }
  start();
})();
