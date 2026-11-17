// 매물 상세: "서류 한눈에 보기" (건축물대장·토지대장·토지이용계획·지적도·등기부 링크) + 지도검색주소 옆 등기부 발급 버튼
// 데이터는 Supabase 함수 listing-overview(로그인 필요)가 브이월드·건축HUB에서 가져온다. 하이탑 전용(케이탑은 별도 DB라 제외).
(function () {
  "use strict";
  if (typeof OfficeConfig !== "undefined" && OfficeConfig.id === "ktop") return;
  var listingId = new URLSearchParams(location.search).get("id");
  var docsRoot = document.getElementById("listingDocsArea");
  if (!listingId || !docsRoot) return;

  var IROS = "https://www.iros.go.kr/";
  var GOV24 = "https://www.gov.kr/";
  var EUM = "https://www.eum.go.kr/";

  function esc(v) { return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function toast(msg) { if (typeof showToast === "function") showToast(msg, 5000); else alert(msg); }
  function client() { return typeof hitopAuthClient !== "undefined" ? hitopAuthClient : null; }
  function fmt(n, d) { return n == null ? "—" : Number(n).toLocaleString("ko-KR", { maximumFractionDigits: d == null ? 2 : d }); }
  function pyeong(m2) { return m2 == null ? "" : " (" + fmt(m2 * 0.3025, 1) + "평)"; }
  function copy(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text);
    return new Promise(function (res, rej) {
      try { var ta = document.createElement("textarea"); ta.value = text; ta.style.cssText = "position:fixed;opacity:0"; document.body.appendChild(ta); ta.select(); var ok = document.execCommand("copy"); document.body.removeChild(ta); ok ? res() : rej(); } catch (e) { rej(e); }
    });
  }
  function openWithAddress(url, addr, site) {
    var w = window.open(url, "_blank", "noopener");
    copy(addr).then(function () { toast("주소를 복사했어요: " + addr + "  → " + site + " 검색칸에 붙여넣기(Ctrl+V) 하세요."); },
      function () { toast("주소 복사가 안 됐어요. 직접 복사해 주세요: " + addr); });
    if (!w) toast("새 창이 막혔어요. 주소창 오른쪽의 팝업 허용을 눌러 주세요.");
  }

  // ---- 화면에서 매물 정보 읽기 ----
  function valueOf(label) {
    var labels = document.querySelectorAll(".ipt-label");
    for (var i = 0; i < labels.length; i++) {
      if (labels[i].textContent.trim() === label) {
        var v = labels[i].nextElementSibling;
        if (!v) return "";
        var first = v.childNodes[0] && v.childNodes[0].nodeType === 3 ? v.childNodes[0].textContent : v.textContent;
        return String(first).trim();
      }
    }
    return "";
  }
  function readInfo() {
    var address = valueOf("지도검색주소");
    var ho = valueOf("호수"), mm = ho.match(/(\d+)\s*호?/);
    var dong = valueOf("동");
    var dm = dong.match(/(\d+)/);
    return { address: address === "—" || address === "-" ? "" : address, buildingName: valueOf("건물명"), hoNm: mm ? mm[1] + "호" : "", dongNm: dm ? dm[1] + "동" : "" };
  }

  // ---- 스타일 ----
  if (!document.getElementById("loStyle")) {
    var st = document.createElement("style");
    st.id = "loStyle";
    st.textContent = [
      ".rl-btn{margin-left:8px;padding:3px 10px;font-size:.76rem;font-weight:700;color:#0f4d4d;background:#fff;border:1px solid #0f4d4d;border-radius:6px;cursor:pointer;vertical-align:middle;font-family:inherit}.rl-btn:hover{background:#0f4d4d;color:#fff}",
      ".lo-head{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.lo-head .lo-time{font-size:.74rem;color:#7a8a8a}.lo-refresh{margin-left:auto}",
      ".lo-note{font-size:.78rem;color:#6a7b7b;margin:4px 0 10px}",
      ".lo-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:12px}",
      ".lo-card{border:1px solid #cfe0df;border-radius:12px;padding:12px 14px;background:#fff;min-width:0}",
      ".lo-card h4{margin:0 0 8px;font-size:.95rem;color:#0f4d4d;display:flex;justify-content:space-between;align-items:center;gap:8px}.lo-card h4 small{font-weight:600;color:#7a8a8a;font-size:.72rem}",
      ".lo-card dl{margin:0;display:grid;grid-template-columns:96px 1fr;gap:4px 10px;font-size:.84rem}.lo-card dt{color:#5b6c6c}.lo-card dd{margin:0;font-weight:600;color:#1f2a2a;word-break:break-all}",
      ".lo-row{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}.lo-row button,.lo-row a{padding:5px 11px;font-size:.78rem;font-weight:700;border-radius:6px;cursor:pointer;font-family:inherit;border:1px solid #0f4d4d;background:#fff;color:#0f4d4d;text-decoration:none}.lo-row .pri{background:#0f4d4d;color:#fff}",
      ".lo-chips{display:flex;flex-wrap:wrap;gap:5px;margin-bottom:8px}.lo-chip{font-size:.76rem;padding:2px 9px;border-radius:12px;background:#e9f3f1;color:#0f4d4d;font-weight:600}.lo-chip.w{background:#fff1dc;color:#8a5a00}.lo-chip.n{background:#eef1f5;color:#4a5a6a}",
      ".lo-sub{font-size:.76rem;color:#5b6c6c;margin:8px 0 4px;font-weight:700}",
      ".lo-warn{font-size:.8rem;color:#8a5a00;background:#fff7e6;border-radius:8px;padding:8px 10px;margin-top:8px}",
      ".lo-empty{font-size:.84rem;color:#6a7b7b;background:#f3f9f8;border-radius:8px;padding:10px 12px}",
      ".lo-ok{font-size:.84rem;color:#0f4d4d;background:#e9f6f1;border-radius:8px;padding:10px 12px}",
      ".lo-map{position:relative;border-radius:8px;overflow:hidden;border:1px solid #d9e6e5;margin-bottom:8px}.lo-map img{display:block;width:100%;height:auto}.lo-pin{position:absolute;left:50%;top:50%;transform:translate(-50%,-100%);font-size:26px;line-height:1;filter:drop-shadow(0 1px 1px rgba(0,0,0,.4))}",
      ".lo-price{width:100%;border-collapse:collapse;font-size:.8rem}.lo-price td,.lo-price th{border-bottom:1px solid #e6efee;padding:3px 6px;text-align:right}.lo-price th{color:#5b6c6c;font-weight:600}.lo-price td:first-child,.lo-price th:first-child{text-align:left}",
      ".lo-loading{padding:14px;color:#5b6c6c;font-size:.9rem}"
    ].join("");
    document.head.appendChild(st);
  }

  // ---- 지도검색주소 옆 버튼 ----
  function addAddressButton() {
    var labels = document.querySelectorAll(".ipt-label");
    for (var i = 0; i < labels.length; i++) {
      if (labels[i].textContent.trim() !== "지도검색주소") continue;
      var val = labels[i].nextElementSibling;
      if (!val || val.querySelector(".rl-btn")) return true;
      var addr = valueOf("지도검색주소");
      if (!addr || addr === "—" || addr === "-") return true;
      var b = document.createElement("button");
      b.type = "button"; b.className = "rl-btn"; b.title = "주소를 복사하고 대법원 인터넷등기소를 새 창으로 엽니다";
      b.textContent = "📑 등기부 발급 ↗";
      b.addEventListener("click", function () { openWithAddress(IROS, valueOf("지도검색주소"), "인터넷등기소"); });
      val.appendChild(document.createTextNode(" ")); val.appendChild(b);
      return true;
    }
    return false;
  }

  // ---- 본문 ----
  var root = document.createElement("div");
  root.id = "listingOverviewArea";
  docsRoot.parentNode.insertBefore(root, docsRoot);
  var state = { info: null, data: null, error: null, loading: true, regDocs: null };

  async function token() {
    var c = client(); if (!c) return null;
    var s = await c.auth.getSession();
    return s && s.data && s.data.session ? s.data.session.access_token : null;
  }
  async function fetchOverview(info) {
    var t = await token();
    if (!t) throw new Error("로그인이 필요해요.");
    var ctl = new AbortController(); var timer = setTimeout(function () { ctl.abort(); }, 60000);
    try {
      var res = await fetch(OfficeConfig.url + "/functions/v1/listing-overview", {
        method: "POST", signal: ctl.signal,
        headers: { apikey: OfficeConfig.key, Authorization: "Bearer " + t, "Content-Type": "application/json" },
        body: JSON.stringify(info)
      });
      var d = null; try { d = await res.json(); } catch (e) {}
      if (!res.ok || !d || d.error) throw new Error((d && d.error) || ("조회 실패 (" + res.status + ")"));
      return d;
    } finally { clearTimeout(timer); }
  }
  async function loadRegDocs() {
    try {
      var c = client(); if (!c) return [];
      var r = await c.from("listing_documents").select("id,original_name,created_at").eq("listing_id", listingId).eq("doc_type", "등기부등본").order("created_at", { ascending: false });
      return r.error ? [] : (r.data || []);
    } catch (e) { return []; }
  }

  function cardRegistry() {
    var docs = state.regDocs || [];
    var body;
    if (docs.length) {
      body = '<div class="lo-ok">📑 올려 둔 등기부 파일 ' + docs.length + '건 · 최근 ' + esc(docs[0].original_name || "파일") + '<br>등기부 내용 요약은 파일 형식을 확인한 뒤 이 칸에 붙일 예정입니다.</div>' +
        '<div class="lo-row"><button type="button" class="pri" data-act="goto-docs">올린 파일 보기 ↓</button><button type="button" data-act="iros">새로 발급 ↗ (주소 복사)</button></div>';
    } else {
      body = '<div class="lo-empty">등기부 파일이 아직 없어요. 유료(열람 700원·발급 1,000원)라서 직접 발급해서 올려 주세요.</div>' +
        '<div class="lo-row"><button type="button" class="pri" data-act="iros">📑 등기소 열기 ↗ (주소 복사)</button><button type="button" data-act="goto-docs">PDF 올리기 ↓</button></div>';
    }
    return '<div class="lo-card" data-card="registry"><h4>📑 등기부등본 <small>인터넷등기소 · 유료</small></h4>' + body + '</div>';
  }
  function cardBuilding(d) {
    var b = d.building || {}; var body;
    if (b.error) {
      body = '<div class="lo-warn">건축물대장을 불러오지 못했어요: ' + esc(b.error) + '</div>';
    } else if (b.matched) {
      var m = b.matched; var u = b.unit;
      body = '<dl><dt>건물명</dt><dd>' + esc(m.name || "—") + (m.dong && m.dong.trim() ? " " + esc(m.dong) : "") + '</dd>' +
        '<dt>주용도</dt><dd>' + esc(m.purpose || "—") + '</dd>' +
        '<dt>구조</dt><dd>' + esc(m.structure || "—") + '</dd>' +
        '<dt>규모</dt><dd>지상 ' + fmt(m.floorsAbove, 0) + '층 / 지하 ' + fmt(m.floorsBelow, 0) + '층</dd>' +
        '<dt>사용승인일</dt><dd>' + esc(m.approvedDate || "—") + '</dd>' +
        '<dt>연면적</dt><dd>' + fmt(m.totalArea) + '㎡' + pyeong(m.totalArea) + '</dd>' +
        '<dt>건축면적</dt><dd>' + fmt(m.buildingArea) + '㎡</dd>' +
        '<dt>건폐율·용적률</dt><dd>' + fmt(m.bcRatio) + '% · ' + fmt(m.farRatio) + '%</dd>' +
        (m.homes ? '<dt>호·세대</dt><dd>' + fmt(m.homes, 0) + '호 / ' + fmt(m.households, 0) + '세대</dd>' : '') +
        '<dt>도로명주소</dt><dd>' + esc(m.address || "—") + '</dd></dl>';
      if (u) {
        body += '<div class="lo-sub">전유부 · ' + esc(u.dong ? u.dong + "동 " : "") + esc(u.ho) + '호</div><dl>' +
          '<dt>전용면적</dt><dd>' + fmt(u.exclusiveArea) + '㎡' + pyeong(u.exclusiveArea) + '</dd>' +
          (u.commonArea != null ? '<dt>공용면적</dt><dd>' + fmt(u.commonArea) + '㎡ (공급 ' + fmt(u.exclusiveArea + u.commonArea) + '㎡)</dd>' : '') +
          '<dt>층·용도</dt><dd>' + esc((u.floor || "—") + " · " + (u.purpose || "—")) + '</dd></dl>';
      } else {
        body += '<div class="lo-warn">전유부(호실별 면적)는 찾지 못했어요. ' + (state.info && state.info.hoNm ? "일반건축물이라 대장에 전유부가 없거나 호수가 다를 수 있어요." : "호수가 입력되어 있지 않아요.") + '</div>';
      }
    } else if (b.count > 1) {
      body = '<div class="lo-warn">같은 지번에 건물이 ' + b.count + '개 있어 어느 건물인지 특정하지 못했어요. 건물명·동을 확인해 주세요.</div><div class="lo-sub">이 지번의 건물</div><dl>' +
        b.buildings.map(function (x) { return '<dt>' + esc((x.name || "건물") + (x.dong && x.dong.trim() ? " " + x.dong : "")) + '</dt><dd>' + esc((x.purpose || "—") + " · " + (x.approvedDate || "—") + " · 연면적 " + fmt(x.totalArea) + "㎡") + '</dd>'; }).join("") + '</dl>';
    } else {
      body = '<div class="lo-empty">이 지번에 건축물대장이 없어요. 나대지이거나 대장 등록 전일 수 있어요.</div>';
    }
    body += '<div class="lo-row"><button type="button" data-act="gov24">정부24 ↗ (주소 복사)</button></div>';
    return '<div class="lo-card" data-card="building"><h4>🏢 건축물대장 <small>표제부 · 전유부</small></h4>' + body + '</div>';
  }
  function cardLand(d) {
    var l = d.land, c = d.characteristics, body = "";
    if (l) {
      body += '<dl><dt>지번</dt><dd>' + esc(d.address) + '</dd><dt>지목</dt><dd>' + esc(l.jimok || "—") + '</dd>' +
        '<dt>면적</dt><dd>' + fmt(l.area) + '㎡' + pyeong(l.area) + '</dd>' +
        '<dt>소유구분</dt><dd>' + esc(l.ownerType || "—") + '</dd>' +
        '<dt>자료 기준일</dt><dd>' + esc(l.updated || "—") + '</dd>';
      if (c) body += '<dt>이용상황</dt><dd>' + esc(c.use || "—") + '</dd><dt>지형·도로</dt><dd>' + esc((c.terrainHeight || "—") + " · " + (c.terrainShape || "—") + " · " + (c.roadSide || "—")) + '</dd>';
      body += '</dl>';
    } else {
      body += '<div class="lo-empty">토지대장 정보를 찾지 못했어요.</div>';
    }
    var prices = d.prices || [];
    if (prices.length) {
      body += '<div class="lo-sub">개별공시지가 (㎡당)</div><table class="lo-price"><tr><th>연도</th><th>원/㎡</th></tr>' +
        prices.map(function (p) { return '<tr><td>' + esc(p.year) + '</td><td>' + fmt(p.price, 0) + '</td></tr>'; }).join("") + '</table>';
    }
    body += '<div class="lo-note">※ 소유자 이름·주소는 공개 자료에 없어요. 소유구분만 나옵니다. 정식 서류는 정부24에서 발급하세요.</div>' +
      '<div class="lo-row"><button type="button" data-act="gov24">정부24 ↗ (주소 복사)</button></div>';
    return '<div class="lo-card" data-card="land"><h4>🗺️ 토지대장 <small>브이월드 자료</small></h4>' + body + '</div>';
  }
  function cardLandUse(d) {
    var uses = d.landUse || [], c = d.characteristics, body = "";
    if (c && c.zone1) body += '<dl><dt>용도지역</dt><dd>' + esc(c.zone1) + (c.zone2 && c.zone2.indexOf("지정되지") < 0 ? " · " + esc(c.zone2) : "") + '</dd></dl>';
    if (!uses.length) body += '<div class="lo-empty">토지이용계획 정보를 찾지 못했어요.</div>';
    var groups = [["포함", "n", "지정(포함)"], ["저촉", "w", "저촉"], ["접함", "n", "접함"]];
    groups.forEach(function (g) {
      var list = uses.filter(function (u) { return u.relation === g[0]; });
      if (!list.length) return;
      body += '<div class="lo-sub">' + g[2] + '</div><div class="lo-chips">' + list.map(function (u) { return '<span class="lo-chip ' + g[1] + '">' + esc(u.name) + '</span>'; }).join("") + '</div>';
    });
    var other = uses.filter(function (u) { return u.relation !== "포함" && u.relation !== "저촉" && u.relation !== "접함"; });
    if (other.length) body += '<div class="lo-chips">' + other.map(function (u) { return '<span class="lo-chip n">' + esc(u.name) + '</span>'; }).join("") + '</div>';
    body += '<div class="lo-note">※ 참고용입니다. 정식 확인서는 토지이음에서 발급하세요.</div><div class="lo-row"><button type="button" data-act="eum">토지이음 ↗ (주소 복사)</button></div>';
    return '<div class="lo-card" data-card="landuse"><h4>📋 토지이용계획 <small>지역·지구</small></h4>' + body + '</div>';
  }
  function cardMap(d) {
    var body = d.mapImage ? '<div class="lo-map"><img alt="지적도" src="' + d.mapImage + '"><span class="lo-pin">📍</span></div><div class="lo-note">지도 가운데 📍이 해당 필지예요. 숫자는 지번입니다.</div>' : '<div class="lo-empty">지적도 이미지를 불러오지 못했어요.</div>';
    return '<div class="lo-card" data-card="map"><h4>📐 지적도 <small>브이월드</small></h4>' + body + '</div>';
  }

  function render() {
    var head = '<div class="detail-section-title lo-head">📋 서류 한눈에 보기' + (state.data ? '<span class="lo-time">조회 ' + esc(new Date(state.data.fetchedAt).toLocaleString("ko-KR")) + '</span>' : '') +
      '<button type="button" class="btn btn-ghost lo-refresh" data-act="refresh">새로고침</button></div>';
    var body;
    if (state.loading) body = '<div class="lo-loading">건축물대장·토지 자료를 불러오는 중…</div>';
    else if (!state.info || !state.info.address) body = '<div class="lo-empty">지도검색주소가 없어서 자료를 조회하지 못했어요. 주소를 입력하면 자동으로 보여 드려요.</div><div class="lo-grid" style="margin-top:10px">' + cardRegistry() + '</div>';
    else if (state.error) body = '<div class="lo-warn">자료를 불러오지 못했어요: ' + esc(state.error) + '</div><div class="lo-grid" style="margin-top:10px">' + cardRegistry() + '</div>';
    else body = '<div class="lo-note">등기부 파일이 있으면 같이 보여 주고, 없으면 발급 링크로 연결합니다. 나머지 서류는 자동으로 불러옵니다.</div><div class="lo-grid">' + cardRegistry() + cardBuilding(state.data) + cardLand(state.data) + cardLandUse(state.data) + cardMap(state.data) + '</div>';
    root.innerHTML = '<section class="detail-section">' + head + body + '</section>';
  }

  root.addEventListener("click", function (e) {
    var t = e.target.closest("[data-act]"); if (!t) return;
    var act = t.getAttribute("data-act"); var addr = (state.info && state.info.address) || valueOf("지도검색주소");
    if (act === "iros") openWithAddress(IROS, addr, "인터넷등기소");
    else if (act === "gov24") openWithAddress(GOV24, addr, "정부24");
    else if (act === "eum") openWithAddress(EUM, addr, "토지이음");
    else if (act === "goto-docs") { docsRoot.scrollIntoView({ behavior: "smooth", block: "start" }); }
    else if (act === "refresh") start(true);
  });

  async function start(force) {
    state.loading = true; state.error = null; render();
    state.info = readInfo();
    state.regDocs = await loadRegDocs();
    if (state.info.address) {
      var key = "lo:" + listingId + ":" + state.info.address + ":" + state.info.hoNm;
      try {
        var cached = !force && sessionStorage.getItem(key);
        if (cached) { var cd = JSON.parse(cached); if (Date.now() - cd.t < 600000) { state.data = cd.d; state.loading = false; render(); return; } }
      } catch (e) {}
      try {
        state.data = await fetchOverview(state.info);
        try { sessionStorage.setItem(key, JSON.stringify({ t: Date.now(), d: state.data })); } catch (e) {}
      } catch (e) { state.error = e && e.name === "AbortError" ? "응답이 너무 오래 걸려요. 잠시 뒤 새로고침해 주세요." : (e && e.message) || "알 수 없는 오류"; }
    }
    state.loading = false; render();
  }

  // 등기부 파일이 새로 올라오면 등기부 칸만 갱신
  var obsTimer = null;
  new MutationObserver(function () {
    clearTimeout(obsTimer);
    obsTimer = setTimeout(async function () {
      var next = await loadRegDocs();
      if (JSON.stringify(next.map(function (x) { return x.id; })) === JSON.stringify((state.regDocs || []).map(function (x) { return x.id; }))) return;
      state.regDocs = next;
      var card = root.querySelector('[data-card="registry"]');
      if (card) { var tmp = document.createElement("div"); tmp.innerHTML = cardRegistry(); card.replaceWith(tmp.firstChild); }
    }, 700);
  }).observe(docsRoot, { childList: true, subtree: true });

  // 상세 정보 표가 그려질 때까지 기다린 뒤 시작
  var tries = 0;
  var wait = setInterval(function () {
    tries++;
    var ready = document.querySelector(".ipt-label");
    if (ready || tries > 40) {
      clearInterval(wait);
      addAddressButton();
      start(false);
    }
  }, 500);
  var btnTries = 0, btnT = setInterval(function () { if (addAddressButton() || ++btnTries > 40) clearInterval(btnT); }, 500);
})();
