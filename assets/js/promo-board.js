/* 매물관리 화면용: 전체 건물 특별 조건·홍보물 비교 보드
 * 매물관리 메인(property-main.html)과 매물목록(properties.html)에 자동으로 붙는다.
 * 데이터는 건물 기록 모듈(building-records.js)과 같은 것을 읽기만 한다(저장·수정 없음).
 */
(function () {
  if (window.__promoBoardLoaded) return; window.__promoBoardLoaded = true;
  var LS_OPEN = "hitop_promo_board_open";
  var state = { recs: [], urlMap: {}, byId: {}, kind: "전체", bsel: "", sort: "due", q: "", limit: 8, tableOpen: false, bAll: false };
  var HR = null;

  function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }

  /* "6억 8,400만원", "9억 7천만원", "38억원" -> 만원 단위 숫자 */
  function toMan(str) {
    var s = String(str || "").replace(/\[[^\]]*\]|\([^)]*\)/g, "").replace(/,/g, "");
    if (!s.trim()) return null;
    var total = 0, hit = false, m;
    if ((m = s.match(/(\d+(?:\.\d+)?)\s*억/))) { total += parseFloat(m[1]) * 10000; hit = true; }
    if ((m = s.match(/(\d+)\s*천\s*만?/))) { total += parseInt(m[1], 10) * 1000; hit = true; }
    if ((m = s.match(/(\d+)\s*백\s*만?/))) { total += parseInt(m[1], 10) * 100; hit = true; }
    if ((m = s.replace(/\d+\s*[천백]\s*만?/g, "").match(/(\d+)\s*만/))) { total += parseInt(m[1], 10); hit = true; }
    if (!hit && (m = s.match(/^\s*(\d+)\s*$/))) { total = parseInt(m[1], 10); hit = true; }
    return hit && total > 0 ? total : null;
  }
  function discount(r) {
    var dv = derive(r), p = toMan(dv.price), o = toMan(dv.orig);
    if (p && o && o > p) return Math.round((1 - p / o) * 1000) / 10;
    return null;
  }
  var AMT = "((?:\\d[\\d,\\.]*\\s*[억천백만]+\\s*)+원?)";
  function pick(text, label) { var m = String(text || "").match(new RegExp(label + "\\s*:?\\s*" + AMT)); return m ? m[1].trim() : ""; }
  function derive(r) {
    if (r._d) return r._d;
    var t = r.text || "", y = t.match(/수익률\s*(\d+(?:\.\d+)?)\s*%/);
    r._d = { price: r.price || pick(t, "특가\\s*분양가") || pick(t, "분양가"), orig: r.orig || pick(t, "원분양가"), deposit: r.deposit || pick(t, "보증금"), rent: r.rent || pick(t, "월세"), yld: y ? y[1] + "%" : "" };
    return r._d;
  }
  function subOf(r) { return (r.floor ? r.floor + (r.fu || "층") : "") + (r.rooms ? (r.floor ? " " : "") + r.rooms + (/호/.test(r.rooms) ? "" : "호") : ""); }

  function style() {
    if (document.getElementById("pbStyle")) return;
    var st = document.createElement("style"); st.id = "pbStyle";
    st.textContent = [
      ".pb{background:#fff;border:1px solid #bfe6e3;border-left:6px solid #e8a317;border-radius:14px;padding:14px 16px;margin:14px 0;color:#17363a;font-size:13px}",
      ".pb-head{display:flex;flex-wrap:wrap;align-items:center;gap:10px}",
      ".pb-head b{font-size:16px}.pb-sub{color:#667b79}.pb-sp{flex:1}",
      ".pb-btn{border:1px solid #1b8a8a;color:#1b8a8a;border-radius:20px;padding:3px 12px;background:#fff;font:inherit;font-size:12px;cursor:pointer;text-decoration:none;display:inline-block;white-space:nowrap}",
      ".pb-btn.on{background:#1b8a8a;color:#fff}",
      ".pb-bar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:10px 0 8px}",
      ".pb-in{border:1px solid #cdddde;border-radius:8px;padding:6px 10px;width:260px;max-width:100%;font:inherit;font-size:13px;box-sizing:border-box}",
      ".pb-wrap{overflow-x:auto}.pb table{width:100%;border-collapse:collapse;min-width:760px}",
      ".pb th{background:#e8f6f5;text-align:left;padding:7px 8px;font-size:12px;white-space:nowrap}",
      ".pb td{padding:8px;border-top:1px solid #e3eeee;vertical-align:top}",
      ".pb tbody tr{cursor:pointer}.pb tbody tr:hover{background:#f4fbfa}",
      ".pb td small{display:block;color:#7a8b89;margin-top:2px;max-width:260px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
      ".pb td:first-child{word-break:keep-all;min-width:110px}.pb td:nth-child(3){white-space:nowrap;min-width:120px}.pb-regdate{display:block;margin-top:4px;font-size:11px;color:#617286;white-space:nowrap}",
      ".pb-tag{display:inline-block;border-radius:10px;padding:1px 8px;font-size:11px;background:#e3f4ef;color:#1a6b55;white-space:nowrap}",
      ".pb-fee{background:#fff1c2;color:#8a5a00;font-weight:700}.pb-soon{background:#ffe0e0;color:#b00020;font-weight:700}",
      ".pb-best{color:#d14a00;font-weight:700}.pb-orig{color:#8a9a98;text-decoration:line-through;font-size:12px}",
      ".pb-empty{padding:14px 6px;color:#667b79}",
      ".pb-bs{display:block;border:1px solid #dde;border-radius:12px;overflow:hidden;margin:8px 0 8px}",
      ".pb-b{display:flex;align-items:center;flex-wrap:wrap;gap:4px 12px;padding:9px 14px;background:#fafefe;cursor:pointer;border-top:1px solid #e6eeee}.pb-b:first-child{border-top:0}",
      ".pb-b:hover{background:#f1fbfa}.pb-b.sel{background:#e3f6f4;box-shadow:inset 4px 0 0 #1b8a8a}",
      ".pb-b .n{font-weight:700;font-size:14px;flex:1 1 260px;min-width:0}.pb-b .m{color:#7a8b89;font-size:12px;white-space:nowrap;min-width:132px;text-align:right}.pb-b .tg{display:flex;gap:6px;flex-wrap:wrap}",
      ".pb-new{background:#1b8a8a;color:#fff;border-radius:8px;font-size:10px;padding:0 5px;margin-left:4px;vertical-align:middle}",
      ".pb-disc{background:#ffe6d6;color:#d14a00;font-weight:700}",
      ".pb-sec{font-weight:700;margin:8px 0 2px}.pb-sec span{font-weight:400;color:#667b79}",
      ".pb-pin{display:inline-block;background:#fff1c2;color:#8a5a00;border:1px solid #e8a317;border-radius:10px;padding:0 8px;font-size:12px;font-weight:700;margin-left:6px;cursor:pointer;white-space:nowrap}",
      ".pb-pin.soon{background:#ffe0e0;color:#b00020;border-color:#e57373}",
      ".pb-file{color:#1b8a8a;text-decoration:none;display:block;white-space:nowrap}"
    ].join("");
    document.head.appendChild(st);
  }

  /* 보고 있는 카테고리 탭에 맞는 기록만 보여준다 (상가 홍보물은 상가 탭에서만 나온다) */
  var CAT_LABEL = { all: "전체 건물", shop: "상가", land: "택지", home: "주거" };
  function catKey() {
    if (/property-main/.test(location.pathname)) { var t = document.querySelector('[data-category][aria-selected="true"]'); if (t) return t.dataset.category; }
    var p = new URLSearchParams(location.search); return p.get("mainCategory") || p.get("category") || "all";
  }
  function roomOf(id) {
    var b = state.byId[id], R = window.HitopResourceRooms;
    if (!b) return "commercial";
    return R && R.resourceRoom ? R.resourceRoom(b) : "commercial";
  }
  function inScope(r) {
    var room = roomOf(r._buildingId), k = catKey();
    if (k === "shop") return room === "commercial";
    if (k === "land") return room === "land";
    if (k === "home") return room === "residential";
    if (k === "all") return room !== "commercial";
    return false;
  }
  function scopedRecs() { return state.recs.filter(inScope); }

  function visible() {
    var q = state.q.trim().toLowerCase();
    var list = scopedRecs().filter(function (r) {
      if (HR.status(r).key === "ended") return false;
      if (state.bsel && r._buildingId !== state.bsel) return false;
      if (state.kind !== "전체" && r.kind !== state.kind) return false;
      if (q) {
        var b = state.byId[r._buildingId];
        var hay = [b ? b.name + " " + dname(b) : "", subOf(r), r.kind, r.text, r.fee, derive(r).price].join(" ").toLowerCase();
        if (hay.indexOf(q) < 0) return false;
      }
      return true;
    });
    if (state.sort === "disc") {
      list.sort(function (a, b) { var da = discount(a), db = discount(b); return (db == null ? -1 : db) - (da == null ? -1 : da); });
    } else {
      list = HR.sortRecords(list, state.sort === "fee" ? "fee" : state.sort === "latest" ? "latest" : "due");
    }
    return list;
  }

  /* 아파트 단지내상가는 "아파트 단지내상가(운정6차 디에트르 에듀타운)"처럼 카테고리 뒤에 단지 이름을 붙여 보여준다 */
  function dname(b) {
    if (!b) return "(삭제된 건물)";
    var c = String(b.category || "").trim(), n = String(b.name || "").trim();
    if (c && /단지내상가/.test(c)) { var base = n.replace(/\s*단지내상가\s*$/, "").trim(); return c + "(" + (base || n) + ")"; }
    return n;
  }
  function dAgo(d) { return Math.round((Date.parse(HR.today()) - Date.parse(String(d).slice(0, 10))) / 86400000); }
  function mdOf(d) { return String(d).slice(5, 10).replace("-", "."); }
  function buildingCards() {
    var by = {};
    scopedRecs().forEach(function (r) {
      if (HR.status(r).key === "ended") return;
      var d = String(r.date || r._created || "").slice(0, 10); if (!d) return;
      if (dAgo(d) > 30) return;
      var o = by[r._buildingId] || (by[r._buildingId] = { id: r._buildingId, last: "", n: 0, fee: 0, disc: 0, due: "", soon: false });
      o.n++; if (d > o.last) o.last = d;
      var f = parseFloat(r.fee) || 0; if (f > o.fee) o.fee = f;
      var dc = discount(r) || 0; if (dc > o.disc) o.disc = dc;
      if (r.due && (!o.due || r.due < o.due)) o.due = r.due;
    });
    var list = Object.keys(by).map(function (k) { return by[k]; }).sort(function (a, b) { return a.last < b.last ? 1 : a.last > b.last ? -1 : 0; });
    return list;
  }
  function cardsHtml() {
    var list = buildingCards();
    var html = '<div class="pb-sec">🏢 최근 소식이 있는 건물 <span>· 최근 30일 안에 새 기록이 올라온 건물, 최근순 · 누르면 아래 표가 그 건물만 보여요</span></div>';
    if (!list.length) return html + '<div class="pb-empty">최근 30일 안에 올라온 기록이 없어요.</div>';
    var BMAX = 5, bshown = state.bAll || list.length <= BMAX ? list : list.filter(function (o, i) { return i < BMAX || o.id === state.bsel; });
    html += '<div class="pb-bs">' + bshown.map(function (o) {
      var b = state.byId[o.id], tags = "";
      if (o.fee) tags += '<span class="pb-tag pb-fee">수수료 ' + o.fee + "%</span> ";
      if (o.disc) tags += '<span class="pb-tag pb-disc">최대 -' + o.disc + "%</span> ";
      if (o.due) { var dd = Math.round((Date.parse(o.due) - Date.parse(HR.today())) / 86400000); tags += dd >= 0 && dd <= 7 ? '<span class="pb-tag pb-soon">D-' + dd + "</span>" : '<span class="pb-tag">~' + mdOf(o.due) + "</span>"; }
      return '<div class="pb-b' + (state.bsel === o.id ? " sel" : "") + '" data-bsel="' + esc(o.id) + '"><div class="n">' + esc(dname(b)) + (dAgo(o.last) <= 7 ? '<span class="pb-new">NEW</span>' : "") + '</div>' + (tags ? '<div class="tg">' + tags + "</div>" : "") + '<div class="m">최근 ' + mdOf(o.last) + " · 기록 " + o.n + "건</div></div>";
    }).join("") + "</div>";
    if (list.length > BMAX) html += '<div style="text-align:center;margin:0 0 6px"><button type="button" class="pb-btn" id="pbBAll">' + (state.bAll ? "접기 ▴" : "전체 보기 (" + list.length + "곳) ▾") + "</button></div>";
    var sb = state.bsel && state.byId[state.bsel];
    html += '<div class="pb-sec">📋 기록 비교 표' + (sb ? ' <span>· ' + esc(dname(sb)) + '만 보는 중 <button type="button" class="pb-btn" id="pbAllB">전체 건물 보기</button></span>' : "") + "</div>";
    return html;
  }
  function pbReg(r) { if (!r._created) return ""; var t = new Date(r._created); if (isNaN(t)) return ""; var p = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(t).reduce(function (o, x) { o[x.type] = x.value; return o; }, {}); return " " + p.year + "." + p.month + "." + p.day; }
  function rowHtml(r) {
    var b = state.byId[r._buildingId], st = HR.status(r), d = discount(r), dv = derive(r);
    var link = b ? OfficeConfig.urlFor("building-detail.html?id=" + encodeURIComponent(b.id)) : "";
    var firstLine = String(r.text || "").split(/\n/).map(function (x) { return x.trim(); }).filter(Boolean).join(" · ");
    var price = dv.price ? esc(dv.price) + (d != null ? ' <span class="pb-best">(-' + d + "%)</span>" : "") + (dv.orig ? '<br><span class="pb-orig">' + esc(dv.orig) + "</span>" : "") : (dv.orig ? "원분양가 " + esc(dv.orig) : "-");
    var dr = [dv.deposit, dv.rent].filter(Boolean).map(esc);
    var dueCell = st.key === "soon" ? '<span class="pb-tag pb-soon">' + esc(st.label) + "</span>" : esc(st.label);
    var files = r.files.map(function (f) {
      var u = state.urlMap[f.url] || f.url;
      return '<a class="pb-file" href="' + esc(u) + '" target="_blank" rel="noopener" data-pb-file="1">' + (HRisImg(f) ? "🖼 " : "📄 ") + esc(String(f.name || "파일").slice(0, 14)) + "</a>";
    }).join("");
    return '<tr data-link="' + esc(link) + '"><td><b>' + esc(dname(b)) + "</b></td>"
      + "<td>" + esc(subOf(r) || "건물 전체") + (firstLine ? "<small>" + esc(firstLine) + "</small>" : "") + "</td>"
      + '<td><span class="pb-tag">' + esc(r.kind || "") + "</span>" + ' <span class="pb-tag" style="font-weight:700;border-color:transparent;' + (r._origin === "ktop" ? "background:#fff1e0;color:#b45309" : "background:#e8f3ff;color:#1d5fa8") + '" title="' + (r._shared ? "공유 기록 (읽기만)" : "이 사무소에서 등록") + '">' + (r._origin === "ktop" ? "케이탑" : "하이탑") + "</span>" + (pbReg(r) ? '<div class="pb-regdate">' + pbReg(r).trim() + "</div>" : "") + "</td>"
      + "<td>" + (r.fee ? '<span class="pb-tag pb-fee">' + esc(r.fee) + "</span>" : "-") + "</td>"
      + "<td>" + price + "</td>"
      + "<td>" + (dr.length ? dr.join(" / ") : "-") + "</td><td>" + (dv.yld ? esc(dv.yld) : "-") + "</td>"
      + "<td>" + dueCell + "</td><td>" + (files || "-") + "</td></tr>";
  }
  function HRisImg(f) { return /\.(png|jpe?g|gif|webp|bmp|heic)(\?|$)/i.test(f.name || "") || /\/image\/upload\//.test(f.url || ""); }

  function render() {
    var root = document.getElementById("promoBoard"); if (!root) return;
    var open = true;
    var scoped = scopedRecs();
    root.style.display = scoped.length ? "" : "none";
    if (!scoped.length) return;
    var active = scoped.filter(function (r) { return HR.status(r).key !== "ended"; });
    var nSoon = active.filter(function (r) { return HR.status(r).key === "soon"; }).length;
    var head = '<div class="pb-head"><span style="font-size:20px">📌</span><b>' + (CAT_LABEL[catKey()] || "전체 건물") + ' 특별 조건 · 홍보물 비교</b>'
      + '<span class="pb-sub">진행 중 ' + active.length + "건 · 마감 임박 " + nSoon + "건</span><span class=\"pb-sp\"></span>"
      + '<a class="pb-btn" href="' + esc(OfficeConfig.urlFor("special-promos.html")) + '">전체 페이지 ›</a>'
      + "</div>";
    if (!open) { root.innerHTML = head; document.getElementById("pbToggle").onclick = function () { localStorage.setItem(LS_OPEN, "1"); render(); }; return; }
    var chip = function (label, on, attr, val) { return '<button type="button" class="pb-btn' + (on ? " on" : "") + '" data-' + attr + '="' + esc(val) + '">' + esc(label) + "</button>"; };
    var bar = '<div class="pb-bar"><input class="pb-in" id="pbQ" placeholder="🔍 건물명·호실·내용 검색 (예: 월드타워, 수수료, 미용실)" value="' + esc(state.q) + '">'
      + ["전체"].concat(HR.KINDS).map(function (k) { return chip(k, state.kind === k, "kind", k); }).join("")
      + '<span class="pb-sp"></span><span class="pb-sub">정렬:</span>'
      + [["due", "마감 임박순"], ["fee", "수수료 높은순"], ["disc", "할인율 큰순"], ["latest", "최신순"]].map(function (x) { return chip(x[1], state.sort === x[0], "sort", x[0]); }).join("") + "</div>";
    var list = visible(), shown = list.slice(0, state.limit);
    var body;
    if (!list.length) body = '<div class="pb-empty">' + (active.length ? "조건에 맞는 기록이 없어요." : "진행 중인 특별 조건이 아직 없어요.") + "</div>";
    else body = '<div class="pb-wrap"><table><thead><tr><th>건물</th><th>대상</th><th>종류</th><th>수수료</th><th>특가 분양가 / 할인</th><th>보증금 / 월세</th><th>수익률</th><th>마감</th><th>자료</th></tr></thead><tbody>'
      + shown.map(rowHtml).join("") + "</tbody></table></div>"
      + (list.length > shown.length ? '<div style="text-align:center;margin-top:8px"><button type="button" class="pb-btn" id="pbMore">더 보기 (' + (list.length - shown.length) + "건 더)</button></div>" : "");
    var tblBtn = '<div style="margin:12px 0 4px"><button type="button" class="pb-btn" id="pbTbl">' + (state.tableOpen ? "📋 전체 기록 리스트 접기 ▴" : "📋 전체 기록 리스트 펼치기 ▾ (" + active.length + "건)") + "</button></div>";
    root.innerHTML = head + cardsHtml() + tblBtn + (state.tableOpen ? bar + body : "");
    wire(root);
  }

  function wire(root) {
    var q = root.querySelector("#pbQ");
    if (q) q.addEventListener("input", function () { state.q = q.value; state.limit = 8; var pos = q.selectionStart; render(); var n = document.getElementById("pbQ"); n.focus(); try { n.setSelectionRange(pos, pos); } catch (e) {} });
    root.querySelectorAll("[data-kind]").forEach(function (b) { b.onclick = function () { state.kind = b.dataset.kind; state.limit = 8; render(); }; });
    root.querySelectorAll("[data-sort]").forEach(function (b) { b.onclick = function () { state.sort = b.dataset.sort; render(); }; });
    root.querySelectorAll("[data-bsel]").forEach(function (c) { c.onclick = function () { state.bsel = c.dataset.bsel; state.tableOpen = true; state.limit = 8; render(); }; });
    var bAll = root.querySelector("#pbBAll"); if (bAll) bAll.onclick = function () { state.bAll = !state.bAll; render(); };
    var allB = root.querySelector("#pbAllB"); if (allB) allB.onclick = function () { state.bsel = ""; render(); };
    var more = root.querySelector("#pbMore"); if (more) more.onclick = function () { state.limit += 20; render(); };
    var tb = root.querySelector("#pbTbl"); if (tb) tb.onclick = function () { state.tableOpen = !state.tableOpen; render(); };
    root.querySelectorAll("tbody tr").forEach(function (tr) {
      tr.addEventListener("click", function (e) { if (e.target.closest("[data-pb-file]")) return; if (tr.dataset.link) location.href = tr.dataset.link; });
    });
  }

  /* ===== 매물목록: 특별 조건 진행 중인 호실 매물에 📌 자동 표시 ===== */
  function listingHits(l) {
    if (!l || !l.resource_id) return [];
    var rooms = []; if (l.ho) rooms.push(String(l.ho));
    var bd = l.bundle_details || l.bundleDetails; if (bd && Array.isArray(bd.rooms)) bd.rooms.forEach(function (x) { rooms.push(String(x)); });
    if (!rooms.length) return [];
    var dongs = [l.apartmentDong, l.dong, l["동"]].filter(Boolean).map(String);
    return state.recs.filter(function (r) {
      return r._buildingId === l.resource_id && HR.status(r).key !== "ended" && rooms.some(function (h) { return HR.roomsInclude(r, h); })
        && (!(r.fu === "동") || !r.floor || dongs.indexOf(String(r.floor)) >= 0);
    });
  }
  function pinLabel(hits) {
    var soon = hits.filter(function (r) { return HR.status(r).key === "soon"; })[0];
    if (soon) return { t: "📌 " + HR.status(soon).label, soon: true };
    var d = 0, f = 0; hits.forEach(function (r) { d = Math.max(d, discount(r) || 0); f = Math.max(f, parseFloat(r.fee) || 0); });
    return { t: d ? "📌 특가 -" + d + "%" : f ? "📌 수수료 " + f + "%" : "📌 특별", soon: false };
  }
  function openPinModal(hits) {
    HR.ensureStyle();
    var ov = document.createElement("div"); ov.className = "hr-overlay";
    ov.innerHTML = '<div class="hr-modal"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px"><b style="font-size:16px">📌 특별 조건 · 홍보</b><button type="button" class="hr-btn" id="pbPinClose">닫기</button></div><div class="hr-grid" style="grid-template-columns:1fr">'
      + HR.sortRecords(hits).map(function (r) { return HR.cardHtml(r, state.urlMap, { readonly: true }); }).join("") + "</div></div>";
    document.body.appendChild(ov);
    ov.addEventListener("click", function (e) { if (e.target === ov || e.target.id === "pbPinClose") ov.remove(); });
  }
  function markListings() {
    if (typeof allListings === "undefined" || !state.recs.length) return;
    var map = {}; allListings.forEach(function (l) { map[l.id] = l; });
    document.querySelectorAll("#listingContainer input[data-sel]").forEach(function (inp) {
      var card = inp.closest(".listing-card"); if (!card) return;
      var cell = card.querySelector(".listing-cell-name"); if (!cell) return;
      var old = cell.querySelector(".pb-pin"), hits = listingHits(map[inp.getAttribute("data-sel")]);
      if (!hits.length) { if (old) old.remove(); return; }
      var lab = pinLabel(hits);
      if (old && old.textContent === lab.t) return;
      if (old) old.remove();
      var b = document.createElement("span"); b.className = "pb-pin" + (lab.soon ? " soon" : ""); b.textContent = lab.t; b.title = "누르면 특별 조건 보기";
      b.addEventListener("click", function (e) { e.stopPropagation(); e.preventDefault(); openPinModal(hits); });
      cell.appendChild(b);
    });
  }
  function watchListings() {
    var lc = document.getElementById("listingContainer"); if (!lc) return;
    var t = null; var run = function () { clearTimeout(t); t = setTimeout(function () { try { markListings(); } catch (e) { console.warn(e); } }, 150); };
    new MutationObserver(run).observe(lc, { childList: true, subtree: true }); run();
  }
  window.__pbDebug = { state: state, mark: function () { return markListings(); } };

  function loadScript(src) {
    return new Promise(function (ok, fail) { var s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = fail; document.head.appendChild(s); });
  }

  async function init() {
    var anchor = document.getElementById("globalPropertySearch");
    if (!anchor) return;
    try {
      if (!window.HitopRecords) await loadScript("assets/js/building-records.js?v=20261107-zoom3");
      HR = window.HitopRecords;
      if (!window.HitopResourceRooms) { try { await loadScript("assets/js/resource-rooms.js?v=20260930-category-drag"); } catch (e) { console.warn("[홍보 보드] 카테고리 분류 파일 없음", e); } }
      var res = await Promise.all([HR.fetchRecords(null), getDriveResources()]);
      try { if (typeof getDriveCategories === "function") await getDriveCategories(); } catch (e) { console.warn("[홍보 보드] 카테고리 불러오기 실패", e); }
      state.recs = res[0].records; state.urlMap = res[0].urlMap;
      (res[1] || []).forEach(function (b) { if (b && b.id && b.name) state.byId[b.id] = { id: b.id, name: b.name, category: b.category || "" }; });
    } catch (e) { console.warn("[홍보 보드] 불러오기 실패", e); return; }
    style();
    var root = document.createElement("section"); root.id = "promoBoard"; root.className = "pb no-print";
    var links = document.querySelector("nav.secondary-links"), tabP = document.getElementById("tabProperty");
    if (links) links.parentNode.insertBefore(root, links);
    else if (tabP) tabP.parentNode.insertBefore(root, tabP.nextSibling);
    else anchor.parentNode.insertBefore(root, anchor.nextSibling);
    render();
    // 카테고리 탭을 바꾸면 보드도 그 카테고리 기록으로 바뀐다
    var lastCat = catKey();
    var onTab = function () { var c = catKey(); if (c !== lastCat) { lastCat = c; state.bsel = ""; state.limit = 8; render(); } };
    document.querySelectorAll("[data-category]").forEach(function (t) { new MutationObserver(onTab).observe(t, { attributes: true, attributeFilter: ["aria-selected"] }); });
    watchListings();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
