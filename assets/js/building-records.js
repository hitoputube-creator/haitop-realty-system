/* 건물 기록(특별 조건·홍보물·메모) 공용 모듈
 * 저장: building_files 테이블에 file_name = "[기록] " + JSON (기타 자료 목록에서는 숨김)
 * 사용: 건물 화면(building-detail.html), 특별 홍보물 페이지(special-promos.html), 매물 상세(detail.html)
 */
(function () {
  var PREFIX = "[기록] ";
  var KINDS = ["할인분양", "수수료", "임대특가", "홍보물", "메모", "조건"];
  var DAY = 86400000;

  function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function today() { return new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10); }
  function md(d) { return String(d || "").slice(5).replace("-", "."); }
  function isImageFile(f) { return /\.(png|jpe?g|gif|webp|bmp|heic)(\?|$)/i.test(f.name || "") || /\/image\/upload\//.test(f.url || ""); }
  function isPdfFile(f) { return /\.pdf(\?|$)/i.test(f.name || "") || /\.pdf(\?|$)/i.test(f.url || ""); }

  function parseRow(row) {
    try {
      var d = JSON.parse(String(row.file_name).slice(PREFIX.length));
      d._rowId = row.id; d._buildingId = row.building_id; d._created = row.created_at || "";
      d.files = Array.isArray(d.files) ? d.files : [];
      return d;
    } catch (e) { return null; }
  }

  /* 상태: active(진행중) / soon(기한 임박) / ended(종료) */
  function status(r) {
    if (r.ended) return { key: "ended", label: "종료" + (r.endedAt ? " " + md(r.endedAt) : "") };
    if (r.due) {
      var days = Math.round((Date.parse(r.due + "T00:00:00+09:00") - Date.parse(today() + "T00:00:00+09:00")) / DAY);
      if (days < 0) return { key: "ended", label: "기한 종료 " + md(r.due), auto: true };
      if (days <= 7) return { key: "soon", label: days === 0 ? "오늘 마감" : "D-" + days };
      return { key: "active", label: "~" + md(r.due) };
    }
    return { key: "active", label: "진행중" };
  }
  function isActive(r) { return status(r).key !== "ended"; }

  /* "601~603", "601,602", "202·203호" -> ["601","602","603"] */
  function expandRooms(text) {
    var out = [];
    String(text || "").replace(/호/g, " ").split(/[,·\/\s]+/).forEach(function (tok) {
      tok = tok.trim(); if (!tok) return;
      var m = tok.match(/^(\d+)\s*[~\-]\s*(\d+)$/);
      if (m) { var a = +m[1], b = +m[2]; if (a <= b && b - a <= 300) { for (var i = a; i <= b; i++) out.push(String(i)); return; } }
      out.push(tok);
    });
    return out;
  }
  function roomsInclude(r, ho) {
    if (!r.rooms) return false;
    var h = String(ho == null ? "" : ho).replace(/호/g, "").trim();
    return expandRooms(r.rooms).indexOf(h) >= 0;
  }
  function sortRecords(list, mode) {
    var arr = list.slice();
    var rank = { soon: 0, active: 1, ended: 2 };
    arr.sort(function (a, b) {
      if (mode === "due") {
        var ka = a.due && isActive(a) ? a.due : "9999", kb = b.due && isActive(b) ? b.due : "9999";
        if (ka !== kb) return ka < kb ? -1 : 1;
      } else if (mode === "fee") {
        var fa = parseFloat(a.fee) || 0, fb = parseFloat(b.fee) || 0;
        if (fa !== fb) return fb - fa;
      } else {
        var ra = rank[status(a).key], rb = rank[status(b).key];
        if (ra !== rb) return ra - rb;
      }
      return String(b.date || "").localeCompare(String(a.date || "")) || String(b._created).localeCompare(String(a._created)) * -1;
    });
    return arr;
  }

  /* 다른 사무소 기록 (읽기 전용 공유): 하이탑 <-> 케이탑 */
  var OTHER_HITOP_FN = "https://xaxbkdnrzsghsabkdvzj.supabase.co/functions/v1/shared-reference-data?table=building_records";
  var OTHER_KTOP_FN = "https://enefadyhmhfphtochlku.supabase.co/functions/v1/shared-office-contacts?table=records";
  var OTHER_HITOP_KEY = "sb_publishable_gqNFRMHb6yYKvqFnQurPKQ_7gGhURVd", OTHER_KTOP_KEY = "sb_publishable__8Ru0l0wfQo8e5Ljq1ZQ7Q_LYtCAP-p";
  var otherCache = null;
  function otherRows() {
    if (otherCache && Date.now() - otherCache.t < 30000) return otherCache.p;
    var p = (async function () {
      var isH = OfficeConfig.id === "hitop";
      var s = await hitopAuthClient.auth.getSession();
      var tok = s && s.data && s.data.session && s.data.session.access_token;
      if (!tok) return [];
      var res = await fetch(isH ? OTHER_KTOP_FN : OTHER_HITOP_FN, { headers: { apikey: isH ? OTHER_KTOP_KEY : OTHER_HITOP_KEY, Authorization: "Bearer " + tok }, signal: AbortSignal.timeout(15000) });
      if (!res.ok) throw new Error("http " + res.status);
      var rows = await res.json();
      return Array.isArray(rows) ? rows : [];
    })().catch(function (e) { otherCache = null; console.warn("[기록] 다른 사무소 기록 조회 실패", e); return []; });
    otherCache = { t: Date.now(), p: p };
    return p;
  }
  async function fetchOtherRecords(buildingId) {
    var other = OfficeConfig.id === "hitop" ? "ktop" : "hitop", label = other === "hitop" ? "하이탑" : "케이탑";
    var rows = await otherRows();
    var known = null;
    if (!buildingId) { try { known = {}; (await getDriveResources()).forEach(function (b) { known[b.id] = 1; }); } catch (e) { known = null; } }
    return rows.filter(function (row) { return String(row.file_name || "").indexOf(PREFIX) === 0 && (buildingId ? row.building_id === buildingId : (!known || known[row.building_id])); })
      .map(function (row) {
        var r = parseRow(row); if (!r) return null;
        r._rowId = "shared-" + other + "-" + row.id; r._shared = other; r._sharedLabel = label;
        if (r.files.length) { r.text = String(r.text || "") + "\n📎 첨부파일 " + r.files.length + "개는 " + label + "에서 볼 수 있어요"; r.files = []; }
        return r;
      }).filter(Boolean);
  }

  async function fetchRecords(buildingId) {
    var isK = OfficeConfig.id === "ktop";
    var url = SUPABASE_URL + "/rest/v1/building_files?select=*" + (isK ? "" : "&file_name=like." + encodeURIComponent(PREFIX + "*"))
      + (buildingId ? "&building_id=eq." + encodeURIComponent(buildingId) : "") + "&order=created_at.desc";
    var res = await fetchWithTimeout(url, { headers: headers });
    if (!res.ok) throw new Error("기록 조회 실패");
    var rowsOwn = await res.json();
    if (isK) rowsOwn = rowsOwn.filter(function (row) { return String(row.file_name || "").indexOf(PREFIX) === 0 && !row._shared_reference; });
    var records = rowsOwn.map(parseRow).filter(Boolean);
    var urls = []; records.forEach(function (r) { r.files.forEach(function (f) { if (f.url && urls.indexOf(f.url) < 0) urls.push(f.url); }); });
    var urlMap = {};
    if (urls.length) {
      try {
        var resolved = await resolveBuildingMaterialUrls(urls.map(function (u) { return { cloudinary_url: u }; }));
        resolved.forEach(function (row, i) { urlMap[urls[i]] = row.cloudinary_url; });
      } catch (e) { console.warn("[기록] 파일 주소 확인 실패", e); }
    }
    var shared = await fetchOtherRecords(buildingId);
    return { records: records.concat(shared), urlMap: urlMap };
  }
  function serialize(data) {
    var d = { date: data.date, kind: data.kind, floor: data.floor || "", fu: data.fu || "", rooms: data.rooms || "", text: data.text || "", fee: data.fee || "", price: data.price || "", orig: data.orig || "", deposit: data.deposit || "", rent: data.rent || "", due: data.due || "", ended: !!data.ended, endedAt: data.endedAt || "", files: data.files || [] };
    return PREFIX + JSON.stringify(d);
  }
  async function addRecord(buildingId, data) {
    var res = await fetchWithTimeout(SUPABASE_URL + "/rest/v1/building_files", { method: "POST", headers: Object.assign({}, headers, { "Prefer": "return=minimal" }), body: JSON.stringify({ building_id: buildingId, file_name: serialize(data), cloudinary_url: "", drive_link: null }) });
    if (!res.ok) throw new Error("기록 저장 실패: " + await res.text());
  }
  async function updateRecord(rowId, data) {
    var res = await fetchWithTimeout(SUPABASE_URL + "/rest/v1/building_files?id=eq." + encodeURIComponent(rowId), { method: "PATCH", headers: Object.assign({}, headers, { "Prefer": "return=minimal" }), body: JSON.stringify({ file_name: serialize(data) }) });
    if (!res.ok) throw new Error("기록 수정 실패: " + await res.text());
  }
  async function deleteRecord(rowId) {
    var res = await fetchWithTimeout(SUPABASE_URL + "/rest/v1/building_files?id=eq." + encodeURIComponent(rowId), { method: "DELETE", headers: headers });
    if (!res.ok) throw new Error("기록 삭제 실패");
  }

  /* 파일 올리기: PDF는 비공개 보관소, 그 밖은 기존 자료와 같은 방식 */
  async function uploadFile(file, buildingId) {
    var pdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
    if (typeof OfficeConfig !== "undefined" && OfficeConfig.id === "ktop") {
      if (file.size > 20 * 1024 * 1024) throw new Error("파일은 20MB 이하로 올려주세요.");
      var body = new FormData(); body.append("file", file); body.append("buildingId", buildingId); body.append("kind", "files");
      var r = await hitopAuthClient.functions.invoke("upload-building-material", { body: body });
      if (r.error || !r.data || !r.data.url) throw new Error((r.error && r.error.message) || "업로드 실패");
      return r.data.url;
    }
    if (pdf) {
      if (file.size > 30 * 1024 * 1024) throw new Error("PDF는 30MB 이하로 올려주세요.");
      var path = "files/" + buildingId + "/" + crypto.randomUUID() + ".pdf";
      var up = await hitopAuthClient.storage.from("building-materials").upload(path, file, { contentType: "application/pdf", upsert: false });
      if (up.error) throw new Error("PDF 업로드 실패: " + up.error.message);
      return SUPABASE_URL + "/storage/v1/object/authenticated/building-materials/" + path;
    }
    var sig = await hitopAuthClient.functions.invoke("cloudinary-sign-upload", { body: { folder: "haitop/files" } });
    if (sig.error) throw new Error(sig.error.message || "업로드 서명 실패");
    var s = sig.data, fd = new FormData();
    fd.append("file", file); fd.append("api_key", s.apiKey); fd.append("timestamp", s.timestamp); fd.append("folder", "haitop/files"); fd.append("signature", s.signature);
    var resp = await fetch("https://api.cloudinary.com/v1_1/" + s.cloudName + "/auto/upload", { method: "POST", body: fd });
    var data = await resp.json();
    if (data.error) throw new Error(data.error.message);
    return data.secure_url;
  }

  /* ===== 스타일 ===== */
  function ensureStyle() {
    if (document.getElementById("hrStyle")) return;
    var st = document.createElement("style"); st.id = "hrStyle";
    st.textContent = [
      ".hr-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:12px}",
      ".hr-card{border:1px solid #d6e6e3;border-radius:12px;background:#fff;overflow:hidden;color:#1d2b2a;display:flex;flex-direction:column}",
      ".hr-card.ended{opacity:.62;background:#f7f9f9}",
      ".hr-thumbs{display:flex;gap:2px;background:#eef4f3}",
      ".hr-thumbs img{flex:1;min-width:0;height:130px;object-fit:cover;cursor:zoom-in;display:block}",
      ".hr-body{padding:10px 12px;font-size:13px;line-height:1.65;flex:1}",
      ".hr-meta{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin-bottom:4px;font-size:12px;color:#6b7b79}",
      ".hr-tag{font-size:11px;padding:1px 8px;border-radius:999px;border:1px solid #0b7a6b;color:#0b7a6b;white-space:nowrap}",
      ".hr-tag.memo{border-color:#c5d3d1;color:#6b7b79}",
      ".hr-st{font-size:11px;padding:1px 8px;border-radius:999px;white-space:nowrap}",
      ".hr-st.active{background:#e6f4f1;color:#0b7a6b}.hr-st.soon{background:#fdecea;color:#b3261e;font-weight:700}.hr-st.ended{background:#e9eded;color:#6b7b79}",
      ".hr-fee{font-size:11px;padding:1px 8px;border-radius:999px;background:#fff4d6;color:#8a5a00;font-weight:700;white-space:nowrap}",
      ".hr-where{font-weight:600;margin-bottom:2px}",
      ".hr-where a{color:inherit;text-decoration:none}.hr-where a:hover{text-decoration:underline}",
      ".hr-text{white-space:pre-wrap;overflow-wrap:anywhere}",
      ".hr-files{margin-top:4px}",
      ".hr-file{display:inline-flex;align-items:center;gap:4px;font-size:12px;color:#0b7a6b;border:1px solid #cfe5e1;border-radius:6px;padding:1px 8px;margin:2px 6px 0 0;background:#fff;cursor:pointer}",
      ".hr-actions{display:flex;gap:6px;flex-wrap:wrap;padding:8px 12px;border-top:1px solid #e3eeec;background:#fafcfc}",
      ".hr-btn{font:inherit;font-size:12px;border:1px solid #cfdcda;background:#fff;color:#1d2b2a;border-radius:999px;padding:2px 12px;cursor:pointer}",
      ".hr-btn.main{background:#0b7a6b!important;border-color:#0b7a6b!important;color:#fff!important}.hr-btn.del{border-color:#e8c9c6!important;color:#b3261e!important}.hr-btn.on{background:#0b7a6b!important;border-color:#0b7a6b!important;color:#fff!important}.hr-btn{background-clip:padding-box}.hr-modal input[type=file]{width:auto;max-width:60%;border:0;padding:0;background:none}",
      ".hr-overlay{position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,.5);display:flex;align-items:flex-start;justify-content:center;padding:4vh 12px;overflow:auto}",
      ".hr-modal{background:#fff;color:#1d2b2a;width:min(760px,96vw);border-radius:14px;padding:18px 20px 22px;box-shadow:0 10px 40px rgba(0,0,0,.25)}",
      ".hr-in{width:100%;box-sizing:border-box;padding:7px 9px;border:1px solid #cfdcda;border-radius:8px;font:inherit;font-size:13px;background:#fff;color:inherit}",
      ".hr-lab{font-size:11px;color:#6b7b79;margin:0 0 2px}",
      ".hr-viewer{background:#fff;border-radius:12px;width:min(980px,96vw);height:min(86vh,900px);display:flex;flex-direction:column;overflow:hidden}",
      ".hr-viewer-head{display:flex;justify-content:space-between;align-items:center;padding:8px 14px;border-bottom:1px solid #e3eeec;font-size:13px}",
      ".hr-viewer-body{flex:1;min-height:0;background:#222;display:flex;align-items:center;justify-content:center}",
      ".hr-viewer-body img{max-width:100%;max-height:100%;object-fit:contain}",
      ".hr-viewer-body iframe{width:100%;height:100%;border:0;background:#fff}",
      ".hr-mark{border:0;background:none;cursor:pointer;font-size:13px;padding:0 2px;margin-left:4px;vertical-align:middle}",
      ".hr-mark.ended{opacity:.35;filter:grayscale(1)}",
      ".hr-tblwrap{overflow-x:auto;border:1px solid #d6e6e3;border-radius:10px;background:#fff}",
      ".hr-tbl{width:100%;border-collapse:collapse;font-size:13px;min-width:640px;color:#1d2b2a}",
      ".hr-tbl th{background:#e9f6f3;color:#2d6a62;font-size:12px;text-align:left;padding:8px 10px;border-bottom:1px solid #d6e6e3;white-space:nowrap}",
      ".hr-tbl td{padding:10px;border-bottom:1px solid #e6f0ee;vertical-align:top}",
      ".hr-tbl tbody tr:last-child td{border-bottom:0}.hr-tbl tbody tr:nth-child(even) td{background:#f8fcfb}.hr-tbl tr.ended td{opacity:.55}",
      ".hr-d{white-space:nowrap;font-weight:700;color:#0b7a6b}.hr-d small{display:block;font-weight:400;color:#8a9a98;font-size:11px}",
      ".hr-tbl td:nth-child(2){min-width:140px}.hr-tbl td:first-child{min-width:58px}.hr-b{font-weight:700}.hr-b a{color:inherit;text-decoration:none}.hr-b a:hover{text-decoration:underline}.hr-b small{display:block;font-weight:400;color:#6b7b79;font-size:12px}",
      ".hr-c{line-height:1.6;white-space:pre-wrap;overflow-wrap:anywhere;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}.hr-c.open{display:block}",
      ".hr-price{font-size:13px;margin:2px 0 4px;color:#0b5f53}.hr-more{border:0;background:none;color:#0b7a6b;font-size:12px;cursor:pointer;padding:2px 0}",
      ".hr-imgs{display:flex;gap:4px;flex-wrap:wrap}.hr-imgs img{width:64px;height:64px;object-fit:cover;border-radius:6px;cursor:zoom-in;display:block}",
      ".hr-tbl .hr-act{white-space:nowrap}.hr-tbl .hr-act .hr-btn{display:block;margin-bottom:4px;padding:1px 10px}",
      "@media(max-width:640px){.hr-grid{grid-template-columns:1fr}}"
    ].join("\n");
    document.head.appendChild(st);
  }

  /* ===== 카드 ===== */
  function filesHtml(r, urlMap) {
    var imgs = r.files.filter(isImageFile), others = r.files.filter(function (f) { return !isImageFile(f); });
    var h = "";
    if (imgs.length) h += '<div class="hr-thumbs">' + imgs.slice(0, 3).map(function (f) { var u = urlMap[f.url] || f.url; return '<img loading="lazy" src="' + esc(u) + '" alt="' + esc(f.name) + '" data-hr-view="' + esc(u) + '" data-hr-name="' + esc(f.name) + '">'; }).join("") + "</div>";
    return { top: h, bottom: (others.length || imgs.length > 3) ? '<div class="hr-files">' + others.map(function (f) { var u = urlMap[f.url] || f.url; return '<span class="hr-file" data-hr-view="' + esc(u) + '" data-hr-name="' + esc(f.name) + '">' + (isPdfFile(f) ? "📄 " : "📎 ") + esc(f.name) + "</span>"; }).join("") + imgs.slice(3).map(function (f) { var u = urlMap[f.url] || f.url; return '<span class="hr-file" data-hr-view="' + esc(u) + '" data-hr-name="' + esc(f.name) + '">🖼 ' + esc(f.name) + "</span>"; }).join("") + "</div>" : "" };
  }
  function cardHtml(r, urlMap, o) {
    o = o || {};
    var st = status(r), fh = filesHtml(r, urlMap || {});
    var where = (o.buildingName ? (o.link ? '<a href="' + esc(o.link) + '">' + esc(o.buildingName) + "</a>" : esc(o.buildingName)) : "") + (r.floor ? (o.buildingName ? " · " : "") + esc(r.floor) + esc(r.fu || "층") : "") + (r.rooms ? " " + esc(r.rooms) + (/호/.test(r.rooms) ? "" : "호") : "");
    if (!where) where = "건물 전체";
    var acts = r._shared ? '<div class="hr-actions"><span class="hr-tag memo">🔗 ' + esc(r._sharedLabel) + ' 공유 · 읽기만</span></div>' : o.readonly ? "" : '<div class="hr-actions">'
      + (r.ended ? '<button type="button" class="hr-btn" data-hr-act="resume" data-id="' + esc(r._rowId) + '">다시 진행</button>' : '<button type="button" class="hr-btn main" data-hr-act="end" data-id="' + esc(r._rowId) + '">종료 처리</button>')
      + '<button type="button" class="hr-btn" data-hr-act="edit" data-id="' + esc(r._rowId) + '">수정</button><button type="button" class="hr-btn del" data-hr-act="del" data-id="' + esc(r._rowId) + '">삭제</button></div>';
    return '<div class="hr-card' + (st.key === "ended" ? " ended" : "") + '" data-rec="' + esc(r._rowId) + '">' + fh.top
      + '<div class="hr-body"><div class="hr-meta"><span class="hr-tag' + (r.kind === "메모" ? " memo" : "") + '">' + esc(r.kind) + '</span><span class="hr-st ' + st.key + '">' + esc(st.label) + "</span>"
      + (r.fee ? '<span class="hr-fee">수수료 ' + esc(r.fee) + "</span>" : "") + "<span>" + esc(r.date || "") + "</span></div>"
      + '<div class="hr-where">' + where + '</div>' + priceHtml(r) + '<div class="hr-text">' + esc(r.text) + "</div>" + fh.bottom + "</div>" + acts + "</div>";
  }

  /* ===== 표 목록: 날짜 | 건물 | 내용 | 이미지·파일 | 버튼 ===== */
  function priceHtml(r) {
    var parts = [];
    if (r.price) parts.push("<b>분양가 " + esc(r.price) + "</b>" + (r.orig ? ' <span style="color:#8a9a98;text-decoration:line-through">' + esc(r.orig) + "</span>" : ""));
    else if (r.orig) parts.push("원분양가 " + esc(r.orig));
    if (r.deposit) parts.push("보증금 " + esc(r.deposit));
    if (r.rent) parts.push("월세 " + esc(r.rent));
    return parts.length ? '<div class="hr-price">' + parts.join(" · ") + "</div>" : "";
  }
  function tableHtml(list, urlMap, o) {
    o = o || {}; urlMap = urlMap || {};
    var showB = !!o.showBuilding;
    var head = "<tr><th>날짜</th>" + (showB ? "<th>건물</th>" : "<th>대상</th>") + "<th>내용</th><th>이미지 · 파일</th>" + (o.readonly ? "" : "<th></th>") + "</tr>";
    var rows = list.map(function (r) {
      var st = status(r), d = String(r.date || ""), info = o.info ? o.info(r) : {};
      var sub = (r.floor ? r.floor + (r.fu || "층") : "") + (r.rooms ? (r.floor ? " " : "") + r.rooms + (/호/.test(r.rooms) ? "" : "호") : "");
      var bcell = showB
        ? '<div class="hr-b">' + (info.link ? '<a href="' + esc(info.link) + '">' + esc(info.name || "") + "</a>" : esc(info.name || "")) + "<small>" + esc(sub || "건물 전체") + "</small></div>"
        : '<div class="hr-b">' + esc(sub || "건물 전체") + "</div>";
      var imgs = r.files.filter(isImageFile), others = r.files.filter(function (f) { return !isImageFile(f); });
      var fh = '<div class="hr-imgs">' + imgs.map(function (f) { var u = urlMap[f.url] || f.url; return '<img loading="lazy" src="' + esc(u) + '" alt="' + esc(f.name) + '" data-hr-view="' + esc(u) + '" data-hr-name="' + esc(f.name) + '">'; }).join("") + "</div>"
        + others.map(function (f) { var u = urlMap[f.url] || f.url; return '<div><span class="hr-file" data-hr-view="' + esc(u) + '" data-hr-name="' + esc(f.name) + '">' + (isPdfFile(f) ? "📄 " : "📎 ") + esc(f.name) + "</span></div>"; }).join("");
      var acts = r._shared ? '<td class="hr-act"><span class="hr-tag memo">🔗 ' + esc(r._sharedLabel) + ' 공유</span></td>' : o.readonly ? "" : '<td class="hr-act">'
        + (r.ended ? '<button type="button" class="hr-btn" data-hr-act="resume" data-id="' + esc(r._rowId) + '">다시 진행</button>' : '<button type="button" class="hr-btn main" data-hr-act="end" data-id="' + esc(r._rowId) + '">종료 처리</button>')
        + '<button type="button" class="hr-btn" data-hr-act="edit" data-id="' + esc(r._rowId) + '">수정</button><button type="button" class="hr-btn del" data-hr-act="del" data-id="' + esc(r._rowId) + '">삭제</button></td>';
      return '<tr class="' + (st.key === "ended" ? "ended" : "") + '" data-rec="' + esc(r._rowId) + '"><td class="hr-d">' + esc(md(d)) + "<small>" + esc(d.slice(0, 4)) + "</small></td><td>" + bcell + "</td>"
        + '<td><div class="hr-meta" style="margin-bottom:3px"><span class="hr-tag' + (r.kind === "메모" ? " memo" : "") + '">' + esc(r.kind) + '</span><span class="hr-st ' + st.key + '">' + esc(st.label) + "</span>" + (r.fee ? '<span class="hr-fee">수수료 ' + esc(r.fee) + "</span>" : "") + '</div>' + priceHtml(r) + '<div class="hr-c">' + esc(r.text) + '</div><button type="button" class="hr-more" data-hr-more="1">더 보기</button></td>'
        + "<td>" + fh + "</td>" + acts + "</tr>";
    }).join("");
    return '<div class="hr-tblwrap"><table class="hr-tbl"><thead>' + head + "</thead><tbody>" + rows + "</tbody></table></div>";
  }
  document.addEventListener("click", function (e) {
    var b = e.target && e.target.closest ? e.target.closest("[data-hr-more]") : null;
    if (!b) return;
    var c = b.previousElementSibling; c.classList.toggle("open"); b.textContent = c.classList.contains("open") ? "접기" : "더 보기";
  });

  /* ===== 파일 보기 ===== */
  function openViewer(url, name) {
    ensureStyle();
    var isImg = /\.(png|jpe?g|gif|webp|bmp|heic)(\?|$)/i.test(name || "") || /\/image\/upload\//.test(url);
    var isPdf = /\.pdf(\?|$)/i.test(name || "") || /\.pdf(\?|$)/i.test(url);
    if (!isImg && !isPdf) { window.open(url, "_blank", "noopener"); return; }
    var ov = document.createElement("div"); ov.className = "hr-overlay"; ov.style.alignItems = "center";
    ov.innerHTML = '<div class="hr-viewer"><div class="hr-viewer-head"><span>' + esc(name || "") + '</span><span><a class="hr-btn" href="' + esc(url) + '" target="_blank" rel="noopener" style="text-decoration:none">새 탭</a> <button type="button" class="hr-btn" id="hrViewerClose">닫기</button></span></div><div class="hr-viewer-body">' + (isImg ? '<img src="' + esc(url) + '">' : '<iframe src="' + esc(url) + '"></iframe>') + "</div></div>";
    ov.addEventListener("click", function (e) { if (e.target === ov) ov.remove(); });
    document.body.appendChild(ov);
    ov.querySelector("#hrViewerClose").addEventListener("click", function () { ov.remove(); });
  }
  document.addEventListener("click", function (e) {
    var t = e.target && e.target.closest ? e.target.closest("[data-hr-view]") : null;
    if (t) { e.preventDefault(); openViewer(t.getAttribute("data-hr-view"), t.getAttribute("data-hr-name")); }
  });

  /* ===== 입력 창 ===== */
  /* opts: {record, buildings:[{id,name}], buildingId, floors:[{v,label}], defaults:{...}, onSaved} */
  function openForm(opts) {
    ensureStyle();
    var rec = opts.record, cur = rec || Object.assign({ date: today(), kind: "조건", floor: "", rooms: "", text: "", fee: "", due: "", files: [] }, opts.defaults || {});
    var files = (cur.files || []).slice();
    var ov = document.createElement("div"); ov.className = "hr-overlay";
    var bsel = "";
    var labelOf = {}, idOf = {};
    if (!opts.buildingId && opts.buildings) {
      var nameCount = {}; opts.buildings.forEach(function (b) { nameCount[b.name] = (nameCount[b.name] || 0) + 1; });
      opts.buildings.forEach(function (b) { var lab = nameCount[b.name] > 1 && b.cat ? b.name + " (" + b.cat + ")" : b.name; labelOf[b.id] = lab; idOf[lab] = b.id; });
      var curLabel = labelOf[cur._buildingId] || "";
      bsel = '<div><div class="hr-lab">건물 (이름 일부만 쳐도 찾아져요)</div><input id="hrBuilding" class="hr-in" list="hrBuildingList" autocomplete="off" placeholder="건물 이름을 입력하세요" value="' + esc(curLabel) + '"' + (rec ? " disabled" : "") + '><datalist id="hrBuildingList">' + opts.buildings.map(function (b) { return '<option value="' + esc(labelOf[b.id]) + '"></option>'; }).join("") + "</datalist></div>";
    }
    var isApt = function () { return !!(opts.apartment || (opts.buildings && curBuilding() && curBuilding().apt)); };
    function curBuilding() { var inp = ov && ov.querySelector("#hrBuilding"); var id = inp ? resolveBuilding(inp.value) : (opts.buildingId || (rec && rec._buildingId)); return opts.buildings ? opts.buildings.filter(function (b) { return b.id === id; })[0] : null; }
    function resolveBuilding(text) {
      text = String(text || "").trim(); if (!text) return "";
      if (idOf[text]) return idOf[text];
      var n = normName(text), hits = Object.keys(idOf).filter(function (l) { return normName(l).indexOf(n) >= 0; });
      return hits.length === 1 ? idOf[hits[0]] : "";
    }
    var floorField = opts.floors
      ? '<select id="hrFloor" class="hr-in"><option value="">건물 전체</option>' + opts.floors.map(function (f) { return '<option value="' + esc(f.v) + '"' + (String(f.v) === String(cur.floor) ? " selected" : "") + ">" + esc(f.label) + "</option>"; }).join("") + "</select>"
      : '<input id="hrFloor" class="hr-in" placeholder="예: 6 (비우면 건물 전체)" value="' + esc(cur.floor) + '">';
    var unitName = function () { return opts.floors ? (opts.floorUnit || "층") : (isApt() ? "동" : "층"); };
    function filesChips() { return files.map(function (f, i) { return '<span class="hr-file">📎 ' + esc(f.name) + ' <b data-rm="' + i + '" style="color:#b3261e;cursor:pointer">✕</b></span>'; }).join(""); }
    ov.innerHTML = '<div class="hr-modal"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px"><b style="font-size:16px">📌 ' + (rec ? "기록 수정" : "기록 추가") + '</b><button type="button" class="hr-btn" id="hrCancel">닫기</button></div>'
      + (bsel ? '<div style="margin-bottom:8px">' + bsel + "</div>" : "")
      + '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:8px;margin-bottom:8px">'
      + '<div><div class="hr-lab">날짜</div><input id="hrDate" type="date" class="hr-in" value="' + esc(cur.date) + '"></div>'
      + '<div><div class="hr-lab">종류</div><select id="hrKind" class="hr-in">' + KINDS.map(function (k) { return "<option" + (k === cur.kind ? " selected" : "") + ">" + k + "</option>"; }).join("") + "</select></div>"
      + '<div><div class="hr-lab" id="hrFloorLab">' + (opts.floors ? (opts.floorUnit || "층") : "층/동") + "</div>" + floorField + "</div>"
      + '<div><div class="hr-lab">대상 호실</div><input id="hrRooms" class="hr-in" placeholder="예: 601~603" value="' + esc(cur.rooms) + '"></div>'
      + '<div><div class="hr-lab">수수료</div><input id="hrFee" class="hr-in" placeholder="예: 5%" value="' + esc(cur.fee) + '"></div>'
      + '<div><div class="hr-lab">기한(종료일)</div><input id="hrDue" type="date" class="hr-in" value="' + esc(cur.due) + '"></div></div>'
      + '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:8px;margin-bottom:8px">'
      + '<div><div class="hr-lab">특가 분양가</div><input id="hrPrice" class="hr-in" placeholder="예: 38억" value="' + esc(cur.price) + '"></div>'
      + '<div><div class="hr-lab">원분양가</div><input id="hrOrig" class="hr-in" placeholder="예: 52억" value="' + esc(cur.orig) + '"></div>'
      + '<div><div class="hr-lab">보증금</div><input id="hrDeposit" class="hr-in" placeholder="예: 3억 9,000만" value="' + esc(cur.deposit) + '"></div>'
      + '<div><div class="hr-lab">월세</div><input id="hrRent" class="hr-in" placeholder="예: 1,970만" value="' + esc(cur.rent) + '"></div></div>'
      + '<div class="hr-lab">내용</div><textarea id="hrText" rows="5" class="hr-in" style="resize:vertical" placeholder="특별 조건, 할인, 수수료, 홍보 내용 등">' + esc(cur.text) + "</textarea>"
      + '<div id="hrFiles" style="margin:6px 0">' + filesChips() + "</div>"
      + '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap"><input id="hrFile" type="file" multiple accept="image/*,.pdf,.ppt,.pptx,.doc,.docx,.xls,.xlsx" style="font-size:12px;max-width:60%"><span><button type="button" class="hr-btn main" id="hrSave">저장</button></span></div>'
      + '<div id="hrProg" style="font-size:12px;color:#6b7b79;margin-top:4px"></div></div>';
    document.body.appendChild(ov);
    var bInput = ov.querySelector("#hrBuilding");
    function refreshUnit() { var lab = ov.querySelector("#hrFloorLab"); if (!lab || opts.floors) return; var u = isApt() ? "동" : "층"; lab.textContent = u; var f = ov.querySelector("#hrFloor"); if (f) f.placeholder = isApt() ? "예: 101 (비우면 단지 전체)" : "예: 6 (비우면 건물 전체)"; }
    if (bInput) { bInput.addEventListener("input", refreshUnit); bInput.addEventListener("change", refreshUnit); refreshUnit(); }
    ov.addEventListener("click", function (e) { if (e.target === ov) ov.remove(); });
    ov.querySelector("#hrCancel").addEventListener("click", function () { ov.remove(); });
    ov.querySelector("#hrFiles").addEventListener("click", function (e) { var i = e.target && e.target.getAttribute && e.target.getAttribute("data-rm"); if (i != null) { files.splice(+i, 1); ov.querySelector("#hrFiles").innerHTML = filesChips(); } });
    ov.querySelector("#hrSave").addEventListener("click", async function () {
      var q = function (id) { return ov.querySelector(id); };
      var bid = opts.buildingId || (rec && rec._buildingId) || (q("#hrBuilding") && resolveBuilding(q("#hrBuilding").value));
      if (!bid) { alert("건물을 목록에서 골라 주세요. 이름 일부를 치면 후보가 나와요."); return; }
      var apt = opts.floors ? (opts.floorUnit === "동") : isApt();
      var text = q("#hrText").value.trim();
      if (!text && !files.length && !q("#hrFile").files.length) { alert("내용을 적거나 파일을 올려 주세요."); return; }
      var btn = q("#hrSave"); btn.disabled = true;
      try {
        var picked = Array.prototype.slice.call(q("#hrFile").files || []);
        for (var i = 0; i < picked.length; i++) { q("#hrProg").textContent = "파일 올리는 중 (" + (i + 1) + "/" + picked.length + ") " + picked[i].name; files.push({ name: picked[i].name, url: await uploadFile(picked[i], bid) }); }
        var data = { date: q("#hrDate").value || today(), kind: q("#hrKind").value, floor: String(q("#hrFloor").value || "").replace(/[층동]$/, "").trim(), fu: apt ? "동" : "", rooms: q("#hrRooms").value.trim(), text: text, fee: q("#hrFee").value.trim(), price: q("#hrPrice").value.trim(), orig: q("#hrOrig").value.trim(), deposit: q("#hrDeposit").value.trim(), rent: q("#hrRent").value.trim(), due: q("#hrDue").value, ended: rec ? !!rec.ended : false, endedAt: rec ? rec.endedAt : "", files: files };
        if (rec) await updateRecord(rec._rowId, data); else await addRecord(bid, data);
        ov.remove();
        if (opts.onSaved) await opts.onSaved();
      } catch (err) { alert("저장 실패: " + err.message); btn.disabled = false; }
    });
  }

  /* 종료 처리 / 다시 진행 */
  async function setEnded(rec, ended) {
    var d = Object.assign({}, rec, { ended: ended, endedAt: ended ? today() : "" });
    await updateRecord(rec._rowId, d);
  }

  /* 카톡 글 읽기: 건물, 수수료, 기한 짐작 */
  function normName(s) { return String(s || "").replace(/[\s·\-_()]/g, "").toLowerCase(); }
  function isSubseq(small, big) { var i = 0; for (var k = 0; k < big.length && i < small.length; k++) { if (big[k] === small[i]) i++; } return i === small.length; }
  function parseMessage(text, buildings) {
    var raw = String(text || "").trim(), body = raw, guess = null;
    var m = raw.match(/^\s*[(\[（]\s*([^)\]）]{2,30})\s*[)\]）]\s*/);
    if (m) {
      body = raw.slice(m[0].length).trim();
      var tok = normName(m[1]), exact = buildings.filter(function (b) { return normName(b.name) === tok; });
      if (exact.length === 1) guess = exact[0];
      else { var subs = buildings.filter(function (b) { return isSubseq(tok, normName(b.name)); }); subs.sort(function (a, b) { return a.name.length - b.name.length; }); if (subs.length) guess = subs[0]; }
    }
    var fee = ""; var fm = raw.match(/수수료[^0-9\n]{0,12}(\d+(?:\.\d+)?)\s*(%|퍼센트|프로)/); if (fm) fee = fm[1] + "%";
    var due = ""; var dm = raw.match(/(\d{1,2})월\s*(\d{1,2})일?\s*까지/);
    if (dm) { var y = new Date(Date.now() + 9 * 3600000).getUTCFullYear(), mm = String(+dm[1]).padStart(2, "0"), dd = String(+dm[2]).padStart(2, "0"); due = y + "-" + mm + "-" + dd; if (due < today()) due = (y + 1) + "-" + mm + "-" + dd; }
    var kind = /수수료|할인|특가|분양가|조건/.test(raw) ? "조건" : "메모";
    return { building: guess, text: body, fee: fee, due: due, kind: kind };
  }

  window.HitopRecords = { PREFIX: PREFIX, KINDS: KINDS, esc: esc, today: today, status: status, isActive: isActive, expandRooms: expandRooms, roomsInclude: roomsInclude, sortRecords: sortRecords, fetchRecords: fetchRecords, addRecord: addRecord, updateRecord: updateRecord, deleteRecord: deleteRecord, setEnded: setEnded, uploadFile: uploadFile, cardHtml: cardHtml, tableHtml: tableHtml, ensureStyle: ensureStyle, openViewer: openViewer, openForm: openForm, parseMessage: parseMessage };
})();
