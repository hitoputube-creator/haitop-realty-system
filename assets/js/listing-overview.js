// 매물 상세: "서류 한눈에 보기" (건축물대장·토지대장·토지이용계획·지적도·등기부 링크) + 지도검색주소 옆 등기부 발급 버튼
// 데이터는 Supabase 함수 listing-overview(로그인 필요)가 브이월드·건축HUB에서 가져온다. 하이탑·케이탑 공용(케이탑은 케이탑 로그인 토큰으로 하이탑 함수를 호출).
(function () {
  "use strict";
  var HITOP_URL = "https://xaxbkdnrzsghsabkdvzj.supabase.co";
  var HITOP_KEY = "sb_publishable_gqNFRMHb6yYKvqFnQurPKQ_7gGhURVd"; // 공개(publishable) 키
  var IS_KTOP = typeof OfficeConfig !== "undefined" && OfficeConfig.id === "ktop";
  var BUCKET = "listing-documents";
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
    var hoText = valueOf("호수"), dongText = valueOf("동");
    var mh = hoText.match(/(\d+)\s*호/) || hoText.match(/(\d+)\s*$/);
    var md = (dongText + " " + hoText).match(/(\d+)\s*동/);
    return { address: address === "—" || address === "-" ? "" : address, buildingName: valueOf("건물명"), hoNm: mh ? mh[1] + "호" : "", dongNm: md ? md[1] + "동" : "" };
  }

  // ---- 스타일 ----
  { var oldSt = document.getElementById("loStyle"); if (oldSt) oldSt.remove(); }
  {
    var st = document.createElement("style");
    st.id = "loStyle";
    st.textContent = [
      ".rl-btn{margin-left:8px;padding:3px 10px;font-size:.76rem;font-weight:700;color:#0f4d4d;background:#fff;border:1px solid #0f4d4d;border-radius:6px;cursor:pointer;vertical-align:middle;font-family:inherit}.rl-btn:hover{background:#0f4d4d;color:#fff}",
      ".rl-copy{margin-left:4px;padding:2px 8px;font-size:.7rem;font-weight:600;color:#355;background:#fff;border:1px solid #9bb5b5;border-radius:6px;cursor:pointer;vertical-align:middle;font-family:inherit}.rl-copy:hover{background:#eef5f5}",
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
      ".lo-loading{padding:14px;color:#5b6c6c;font-size:.9rem}",
      ".lo-card.lo-wide{grid-column:1/-1}",
      ".lo-danger{background:#fdecec;border-left:4px solid #d33;color:#a02020;border-radius:8px;padding:10px 12px;font-size:.86rem;font-weight:700;margin-bottom:8px}.lo-danger ul{margin:6px 0 0;padding-left:18px;font-weight:600;color:#7a1f1f}",
      ".lo-safe{background:#e9f6f1;border-left:4px solid #1b8a63;color:#0f5a40;border-radius:8px;padding:10px 12px;font-size:.86rem;font-weight:700;margin-bottom:8px}",
      ".lo-list{margin:0 0 6px;padding-left:18px;font-size:.84rem;line-height:1.7}.lo-list b{color:#1f2a2a}",
      ".lo-det{margin-top:8px;font-size:.76rem;color:#5b6c6c}.lo-det pre{max-height:220px;overflow:auto;background:#f6f8f8;border-radius:6px;padding:8px;white-space:pre-wrap;word-break:break-all;font-size:.72rem}"
    ].join("");
    st.textContent += "#loDocsSlot{margin-top:14px;padding-top:12px;border-top:2px dashed #b9cadd}#loDocsSlot .detail-section{background:none!important;border:none!important;padding:0!important;margin:0!important}#loDocsSlot .detail-section>.detail-section-title{background:none!important;border:none!important;border-left:3px solid #1f5fa8!important;border-radius:0!important;padding:0 0 0 8px!important;margin:0 0 6px!important;font-size:13px!important}";
    st.textContent += ".lo-price tr.lo-more{display:none}.lo-price.open tr.lo-more{display:table-row}.lo-morebtn{font-size:.74rem!important;padding:3px 10px!important}";
    st.textContent += "#loMapModal{position:fixed;inset:0;z-index:100000;background:rgba(10,24,40,.6);display:flex;align-items:center;justify-content:center;padding:20px}#loMapModal .lm-box{width:min(1200px,96vw);height:min(820px,92vh);background:#fff;border-radius:12px;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,.4)}#loMapModal .lm-head{display:flex;align-items:center;gap:12px;padding:8px 14px;background:#dce8f6;border-bottom:1px solid #b9cadd;color:#16487f;font-size:13.5px}#loMapModal .lm-tools{display:flex;gap:4px;margin-left:8px}#loMapModal .lm-tools button{padding:3px 12px;font-size:12px;font-weight:700;border:1px solid #8fa8c2;background:#fff;color:#16487f;border-radius:6px;cursor:pointer;font-family:inherit}#loMapModal .lm-tools button.on{background:#1f5fa8;color:#fff;border-color:#1f5fa8}#loMapModal .lm-hint{margin-left:auto;font-size:11.5px;color:#4a627c}#loMapModal .lm-close{border:none;background:none;font-size:18px;cursor:pointer;color:#16487f}#loMapModal .lm-map{flex:1;position:relative;background:#eef3f9}#loMapModal .lm-wait{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#4a627c;font-size:14px}.lo-map[data-act]{cursor:zoom-in}";
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
      var cb = document.createElement("button");
      cb.type = "button"; cb.className = "rl-copy"; cb.title = "주소만 복사합니다 (등기소 검색칸에 붙여넣기)";
      cb.textContent = "📋 주소복사";
      cb.addEventListener("click", function () {
        var a = valueOf("지도검색주소");
        copy(a).then(function () {
          cb.textContent = "✔ 복사됨";
          setTimeout(function () { cb.textContent = "📋 주소복사"; }, 1500);
          toast("주소를 복사했어요: " + a);
        }, function () { toast("주소 복사가 안 됐어요. 직접 복사해 주세요: " + a); });
      });
      // 주소복사 버튼을 먼저, 등기부 발급 버튼을 그 다음에 둔다.
      val.appendChild(document.createTextNode(" ")); val.appendChild(cb);
      val.appendChild(document.createTextNode(" ")); val.appendChild(b);
      return true;
    }
    return false;
  }


  // ===== 등기부(등기사항전부증명서) PDF 텍스트 요약 =====
  var REG = {};
  REG.PURPOSE_KEYS = ["소유권", "가압류", "압류", "가처분", "가등기", "임의경매", "강제경매", "경매", "근저당", "저당권", "전세권", "지상권", "지역권", "임차권", "질권", "근질권", "환매", "신탁", "예고", "공유", "화해", "주택임차권", "상가임차권", "채권담보권"];
  REG.stripSp = function (s) { return String(s || "").replace(/\s+/g, ""); };
  REG.won = function (s) { var m = String(s || "").match(/금\s*([\d,]{3,})\s*원/); return m ? Number(m[1].replace(/,/g, "")) : null; };
  REG.moneyAfter = function (text, label) {
    var re = new RegExp(label + "[^\\d]{0,12}?([\\d,]{4,})\\s*원");
    var m = String(text || "").match(re);
    return m ? Number(m[1].replace(/,/g, "")) : null;
  };
  REG.dateOf = function (text) {
    var m = String(text || "").match(/(\d{4})\s*년\s*(\d{1,2})\s*월\s*(?:(\d{1,2})(?!\d)\s*일?)?/);
    return m ? m[1] + "-" + String(m[2]).padStart(2, "0") + (m[3] ? "-" + String(m[3]).padStart(2, "0") : "") : null;
  };
  REG.isEntryStart = function (line) {
    var m = String(line).match(/^\s*(\d{1,3}(?:-\d{1,3})?)\s+(\S.*)$/);
    if (!m) return null;
    var rest = REG.stripSp(m[2]);
    if (/^\d+(?:-\d+)?번/.test(rest)) return { rank: m[1], rest: m[2] };
    for (var i = 0; i < REG.PURPOSE_KEYS.length; i++) if (rest.indexOf(REG.PURPOSE_KEYS[i]) === 0) return { rank: m[1], rest: m[2] };
    return null;
  };
  REG.splitEntries = function (lines) {
    var entries = [], cur = null;
    lines.forEach(function (ln) {
      var st = REG.isEntryStart(ln);
      if (st) { cur = { rank: st.rank, lines: [st.rest] }; entries.push(cur); }
      else if (cur) cur.lines.push(ln);
    });
    entries.forEach(function (e) {
      e.text = e.lines.join(" ").replace(/(^|\s)일(?=\s|$)/g, " ").replace(/\s+/g, " ").trim();
      e.compact = REG.stripSp(e.text);
      var dm = e.text.search(/\d{4}\s*년/);
      e.purpose = (dm > 0 ? e.text.slice(0, dm) : e.text.slice(0, 30)).trim();
      e.pc = REG.stripSp(e.purpose);
      e.date = REG.dateOf(e.text);
    });
    return entries;
  };
  REG.deletedSet = function (entries) {
    var del = {};
    entries.forEach(function (e) {
      var m = e.compact.match(/^(\d+(?:-\d+)?)번[가-힣]{2,16}[\d년월일제호]{0,40}말소/);
      if (m) del[m[1]] = true;
    });
    return del;
  };
  REG.grab = function (text, label, stop) {
    var re = new RegExp(label + "\\s+(.+?)(?=\\s+(?:" + stop + "|제\\d+호|설정계약|\\d{4}년|거래가액)|$)");
    var m = String(text || "").match(re);
    return m ? m[1].trim() : null;
  };
  REG.parse = function (allLines) {
    var sec = null, title = [], gap = [], eul = [], meta = {};
    var full = allLines.join("\n");
    var mu = full.match(/고유번호\s*([\d-]{8,})/); if (mu) meta.uniqueNo = mu[1];
    var mt = full.match(/열람\s*일시\s*:?\s*([^\n]{6,40})/); if (mt) meta.viewedAt = mt[1].trim();
    var mi = full.match(/발행\s*일\s*:?\s*([^\n]{6,30})/); if (!mt && mi) meta.viewedAt = mi[1].trim();
    var head = allLines.find(function (l) { return /\[(집합건물|건물|토지)\]/.test(l); });
    if (head) meta.target = head.replace(/\s+/g, " ").trim();
    var closed = false;
    allLines.forEach(function (ln) {
      var s = REG.stripSp(ln);
      if (/【표제부】|【전유부분의건물의표시】|【대지권의목적인토지의표시】/.test(s) || /^【?표제부/.test(s)) { sec = "title"; return; }
      if (/【갑구】/.test(s)) { sec = "gap"; return; }
      if (/【을구】/.test(s)) { sec = "eul"; return; }
      if (/^순위번호/.test(s) || /이하여백/.test(s) || /^주\)?요등기사항요약/.test(s)) return;
      if (/^(열람일시|발행번호|발행일|\d+\/\d+|-?\d+-?)$/.test(s) || /^\*?실선으로그어진부분/.test(s)) return;
      if (sec === "gap") gap.push(ln); else if (sec === "eul") eul.push(ln); else if (sec === "title") title.push(ln);
    });
    var G = REG.splitEntries(gap), E = REG.splitEntries(eul);
    var delG = REG.deletedSet(G), delE = REG.deletedSet(E);
    var out = { meta: meta, owners: [], acquired: null, cautions: [], mortgages: [], leases: [], other: [], counts: { gap: G.length, eul: E.length }, hasSections: !!(G.length || E.length || gap.length || eul.length || title.length) };

    // 소유자: 말소되지 않은 마지막 소유권 보존/이전
    var ownerEntries = G.filter(function (e) { return /^소유권(보존|이전)/.test(e.pc) && !/청구권|가등기|말소|일부/.test(e.pc) && !delG[e.rank]; });
    var last = ownerEntries[ownerEntries.length - 1];
    if (last) {
      var re = /(소유자|공유자)\s+(.+?)\s+(\d{6}-[\d*]{1,7}|\d{6}-?)(?:\s+(.+?))?(?=\s+(?:소유자|공유자|지분|거래가액|\d+번|부동산)|$)/g, m, shares = [];
      var sh = /지분\s*(\d+\s*분의\s*\d+)/g, sm;
      while ((sm = sh.exec(last.text)) !== null) shares.push(sm[1].replace(/\s+/g, ""));
      var i = 0;
      while ((m = re.exec(last.text)) !== null) { out.owners.push({ kind: m[1], name: m[2].trim(), idFront: (m[3] || "").slice(0, 6), share: shares[i] || null }); i++; }
      if (!out.owners.length) { var m2 = last.text.match(/(소유자|공유자)\s+(\S+(?:\s\S+)?)/); if (m2) out.owners.push({ kind: m2[1], name: m2[2], idFront: "", share: null }); }
      var cause = (last.text.replace(last.purpose, "").match(/(매매|증여|상속|판결|임의경매|강제경매|경매|신탁|협의분할|분할|교환|현물출자|합병|회사분할|공매|수용|환지)/) || [])[1] || (/소유권보존/.test(last.pc) ? "보존" : null);
      out.acquired = { rank: last.rank, date: last.date, kind: last.pc.replace(/\d.*$/, ""), cause: cause, price: REG.won(last.text.slice(last.text.indexOf("거래가액") >= 0 ? last.text.indexOf("거래가액") : 0)) };
      if (last.text.indexOf("거래가액") < 0) out.acquired.price = null;
    }

    // 갑구 주의 등기(말소 안 된 것)
    var CAUTION = [["가압류", "가압류"], ["압류", "압류"], ["가처분", "가처분"], ["임의경매", "경매"], ["강제경매", "경매"], ["경매개시", "경매"], ["가등기", "가등기"], ["신탁", "신탁"], ["환매", "환매특약"], ["예고", "예고등기"]];
    G.forEach(function (e) {
      if (delG[e.rank] || /^\d+(?:-\d+)?번/.test(e.pc) || /^소유권(보존|이전)(?!청구)/.test(e.pc)) return;
      var hit = CAUTION.find(function (c) { return e.pc.indexOf(c[0]) >= 0; });
      if (!hit) return;
      var who = REG.grab(e.text, "(?:채권자|권리자|신탁원부|수탁자)", "\\d{6}|\\d{3}-\\d{2}|서울|경기|인천|부산|대구|광주|대전|울산|세종|강원|충청|전라|경상|제주|청구금액|채무자|소유자|사건번호|\\(");
      out.cautions.push({ rank: e.rank, type: hit[1], purpose: e.purpose, date: e.date, amount: REG.moneyAfter(e.text, "청구금액"), who: who ? who.slice(0, 30) : null });
    });

    // 을구
    var changes = {};
    E.forEach(function (e) {
      var m = e.pc.match(/^(\d+(?:-\d+)?)번(근저당권|저당권|전세권|임차권)(변경|이전)/);
      if (m) changes[m[1]] = (changes[m[1]] || []).concat([e]);
    });
    E.forEach(function (e) {
      if (delE[e.rank] || /^\d+(?:-\d+)?번/.test(e.pc)) return;
      if (/^(근저당권|저당권)설정/.test(e.pc)) {
        var amount = REG.moneyAfter(e.text, "채권최고액");
        var holder = REG.grab(e.text, "(?:근저당권자|저당권자)", "\\d{6}|\\d{3}-\\d{2}|서울|경기|인천|부산|대구|광주|대전|울산|세종|강원|충청|전라|경상|제주|공동담보|\\(");
        (changes[e.rank] || []).forEach(function (c) { var a2 = REG.moneyAfter(c.text, "채권최고액"); if (a2) amount = a2; var h2 = REG.grab(c.text, "(?:근저당권자|저당권자)", "\\d{6}|\\d{3}-\\d{2}|서울|경기|인천|부산|대구|광주|대전|울산|세종|강원|충청|전라|경상|제주|공동담보|\\("); if (h2) holder = h2; });
        out.mortgages.push({ rank: e.rank, date: e.date, amount: amount, holder: holder ? holder.slice(0, 30) : null, debtor: (REG.grab(e.text, "채무자", "\\d{6}|서울|경기|인천|부산|대구|광주|대전|울산|세종|강원|충청|전라|경상|제주|근저당권자|저당권자") || "").slice(0, 20) || null });
      } else if (/^(전세권|임차권|주택임차권|상가임차권)/.test(e.pc)) {
        var kind = /임차권/.test(e.pc) ? "임차권" : "전세권";
        out.leases.push({ rank: e.rank, kind: kind, date: e.date, amount: REG.moneyAfter(e.text, kind === "전세권" ? "전세금" : "임차보증금"), who: (REG.grab(e.text, "(?:전세권자|임차권자)", "\\d{6}|\\d{3}-\\d{2}|서울|경기|인천|부산|대구|광주|대전|울산|세종|강원|충청|전라|경상|제주|존속기간|범위|\\(") || "").slice(0, 25) || null, period: ((e.text.match(/존속기간\s*(\d{4}\s*년\s*\d{1,2}\s*월\s*\d{1,2}\s*일\s*부터\s*\d{4}\s*년\s*\d{1,2}\s*월\s*\d{1,2}\s*일\s*까지)/) || [])[1] || "").replace(/\s+/g, "") || null });
      } else if (/^(지상권|지역권|질권|근질권|채권담보권|가압류|압류|가처분|가등기)/.test(e.pc)) {
        out.other.push({ rank: e.rank, purpose: e.purpose, date: e.date });
      }
    });
    out.mortgageTotal = out.mortgages.reduce(function (s, x) { return s + (x.amount || 0); }, 0);
    out.leaseTotal = out.leases.reduce(function (s, x) { return s + (x.amount || 0); }, 0);
    return out;
  };

  var pdfJsPromise = null;
  function loadPdfJs() {
    if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
    if (pdfJsPromise) return pdfJsPromise;
    pdfJsPromise = new Promise(function (res, rej) {
      var s = document.createElement("script");
      s.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
      s.onload = function () { try { window.pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js"; res(window.pdfjsLib); } catch (e) { rej(e); } };
      s.onerror = function () { rej(new Error("PDF 읽기 도구를 불러오지 못했어요.")); };
      document.head.appendChild(s);
    });
    return pdfJsPromise;
  }
  async function pdfToLines(buf) {
    var lib = await loadPdfJs();
    var pdf = await lib.getDocument({ data: buf }).promise;
    var lines = [], pages = Math.min(pdf.numPages, 40);
    for (var p = 1; p <= pages; p++) {
      var page = await pdf.getPage(p);
      var tc = await page.getTextContent();
      var items = tc.items.filter(function (i) { return i.str && i.str.trim(); }).map(function (i) { return { s: i.str, x: i.transform[4], y: i.transform[5] }; });
      items.sort(function (a, b) { return b.y - a.y || a.x - b.x; });
      var rows = [];
      items.forEach(function (it) {
        var row = rows.find(function (r) { return Math.abs(r.y - it.y) <= 3; });
        if (!row) { row = { y: it.y, items: [] }; rows.push(row); }
        row.items.push(it);
      });
      rows.sort(function (a, b) { return b.y - a.y; });
      rows.forEach(function (r) { r.items.sort(function (a, b) { return a.x - b.x; }); lines.push(r.items.map(function (i) { return i.s.trim(); }).join(" ")); });
    }
    return lines;
  }

  // ---- 본문 ----
  var root = document.createElement("div");
  root.id = "listingOverviewArea";
  docsRoot.parentNode.insertBefore(root, docsRoot);
  var state = { info: null, data: null, error: null, loading: true, regDocs: null, regSum: null };

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
      var hdr = IS_KTOP
        ? { apikey: HITOP_KEY, Authorization: "Bearer " + HITOP_KEY, "x-ktop-token": t, "Content-Type": "application/json" }
        : { apikey: OfficeConfig.key, Authorization: "Bearer " + t, "Content-Type": "application/json" };
      var res = await fetch((IS_KTOP ? HITOP_URL : OfficeConfig.url) + "/functions/v1/listing-overview", {
        method: "POST", signal: ctl.signal, headers: hdr, body: JSON.stringify(info)
      });
      var d = null; try { d = await res.json(); } catch (e) {}
      if (!res.ok || !d || d.error) throw new Error((d && d.error) || ("조회 실패 (" + res.status + ")"));
      return d;
    } finally { clearTimeout(timer); }
  }
  async function loadRegDocs() {
    try {
      var c = client(); if (!c) return [];
      var r = await c.from("listing_documents").select("id,original_name,created_at,storage_path,mime_type").eq("listing_id", listingId).eq("doc_type", "등기부등본").order("created_at", { ascending: false });
      return r.error ? [] : (r.data || []);
    } catch (e) { return []; }
  }

  function won(n) { if (n == null) return "—"; var eok = Math.floor(n / 1e8), man = Math.round((n % 1e8) / 1e4); var s = ""; if (eok) s += eok.toLocaleString("ko-KR") + "억"; if (man) s += (s ? " " : "") + man.toLocaleString("ko-KR") + "만"; return (s || "0") + "원"; }
  function sp(s) { return String(s == null ? "" : s).replace(/\s+/g, ""); }
  function regSummaryHtml(s) {
    if (!s) return "";
    if (s.loading) return '<div class="lo-loading">등기부 PDF를 읽는 중…</div>';
    if (s.error) return '<div class="lo-warn">' + esc(s.error) + '</div>';
    var p = s.parsed, h = "";
    var cn = p.cautions.length;
    if (cn) {
      h += '<div class="lo-danger">⚠ 말소 안 된 주의 등기 ' + cn + '건<ul>' + p.cautions.map(function (c) { return '<li>' + esc(c.type) + ' · ' + esc(c.date || "") + (c.amount ? ' · ' + won(c.amount) : '') + (c.who ? ' · ' + esc(c.who) : '') + '</li>'; }).join("") + '</ul></div>';
    } else {
      h += '<div class="lo-safe">✔ 말소 안 된 압류·가압류·가처분·경매 기록은 이 PDF에 없어요</div>';
    }
    h += '<div class="lo-sub">소유자 (갑구)</div>';
    if (p.owners.length) {
      h += '<ul class="lo-list">' + p.owners.map(function (o) { return '<li><b>' + esc(o.name) + '</b>' + (o.share ? ' · 지분 ' + esc(o.share) : '') + '</li>'; }).join("") + '</ul>';
      if (p.acquired) h += '<div class="lo-note">취득: ' + esc(p.acquired.date || "") + ' ' + esc(sp(p.acquired.kind || "")) + (p.acquired.cause ? ' (' + esc(p.acquired.cause) + ')' : '') + (p.acquired.price ? ' · 거래가액 ' + won(p.acquired.price) : '') + '</div>';
    } else {
      h += '<div class="lo-empty">소유자를 읽지 못했어요. 원문을 확인해 주세요.</div>';
    }
    h += '<div class="lo-sub">근저당·저당 (을구)</div>';
    if (p.mortgages.length) {
      h += '<ul class="lo-list">' + p.mortgages.map(function (m) { return '<li><b>' + won(m.amount) + '</b> · ' + esc(m.holder || "근저당권자 미확인") + (m.debtor ? ' (채무자 ' + esc(m.debtor) + ')' : '') + (m.date ? ' · ' + esc(m.date) : '') + '</li>'; }).join("") + '</ul><div class="lo-note">채권최고액 합계 <b>' + won(p.mortgageTotal) + '</b></div>';
    } else h += '<div class="lo-ok">말소 안 된 근저당이 없어요</div>';
    if (p.leases.length) {
      h += '<div class="lo-sub">전세권·임차권</div><ul class="lo-list">' + p.leases.map(function (l) { return '<li>' + esc(l.kind) + ' <b>' + won(l.amount) + '</b>' + (l.who ? ' · ' + esc(l.who) : '') + (l.period ? ' · ' + esc(String(l.period).replace(/(\d{4})년(\d{1,2})월(\d{1,2})일부터(\d{4})년(\d{1,2})월(\d{1,2})일까지/, "$1.$2.$3 ~ $4.$5.$6")) : '') + '</li>'; }).join("") + '</ul>';
    }
    if (p.other.length) h += '<div class="lo-note">그 밖의 권리: ' + p.other.map(function (o) { return esc(sp(o.purpose)); }).join(", ") + '</div>';
    if (p.meta && (p.meta.viewedAt || p.meta.target)) h += '<div class="lo-note">' + (p.meta.target ? esc(p.meta.target) + '<br>' : '') + (p.meta.viewedAt ? '열람 ' + esc(p.meta.viewedAt) : '') + '</div>';
    h += '<div class="lo-note">※ PDF 글자를 자동으로 읽은 요약이에요. 계약 등 중요한 판단은 원문 PDF로 꼭 확인하세요.</div>';
    h += '<details class="lo-det"><summary>읽어 온 글자 보기 (요약이 이상할 때)</summary><pre>' + esc((s.lines || []).slice(0, 220).join("\n")) + '</pre></details>';
    return h;
  }
  function cardRegistry() {
    var docs = state.regDocs || [];
    var body, wide = "";
    if (docs.length) {
      wide = " lo-wide";
      body = '<div class="lo-note">올린 등기부 ' + docs.length + '건 · 최근 파일: ' + esc(docs[0].original_name || "파일") + '</div>' + regSummaryHtml(state.regSum) +
        '<div class="lo-row"><button type="button" class="pri" data-act="open-reg">원문 PDF 열기</button><button type="button" data-act="goto-docs">올린 파일 보기 ↓</button><button type="button" data-act="iros">새로 발급 ↗ (주소 복사)</button></div>';
    } else {
      body = '<div class="lo-empty">등기부 파일이 아직 없어요. 유료(열람 700원·발급 1,000원)라서 직접 발급해서 올려 주세요.</div>' +
        '<div class="lo-row"><button type="button" class="pri" data-act="iros">📑 등기소 열기 ↗ (주소 복사)</button><button type="button" data-act="goto-docs">PDF 올리기 ↓</button></div>';
    }
    return '<div class="lo-card' + wide + '" data-card="registry"><h4>📑 등기부등본 <small>인터넷등기소 · 유료</small></h4>' + body + '</div>';
  }
  async function signedUrl(doc) {
    var r = await client().storage.from(BUCKET).createSignedUrl(doc.storage_path, 300);
    if (r.error || !r.data || !r.data.signedUrl) throw (r.error || new Error("no url"));
    return r.data.signedUrl;
  }
  async function loadRegSummary() {
    var docs = state.regDocs || [];
    var pdf = docs.find(function (d) { return /pdf/i.test(d.mime_type || "") || /\.pdf$/i.test(d.original_name || ""); });
    if (!pdf) { state.regSum = docs.length ? { error: "올린 파일이 사진이라 자동 요약은 안 돼요. PDF로 올리면 요약해 드려요." } : null; refreshRegCard(); return; }
    if (state.regSum && state.regSum.docId === pdf.id && state.regSum.parsed) return;
    state.regSum = { docId: pdf.id, loading: true }; refreshRegCard();
    try {
      var url = await signedUrl(pdf);
      var buf = await (await fetch(url)).arrayBuffer();
      var lines = await pdfToLines(buf);
      var chars = lines.join("").replace(/\s/g, "").length;
      if (chars < 80) { state.regSum = { docId: pdf.id, error: "이미지로 된 PDF라 글자를 읽지 못했어요. 인터넷등기소에서 받은 PDF 원본을 올려 주세요." }; }
      else {
        var parsed = REG.parse(lines);
        if (!parsed.hasSections || (!parsed.counts.gap && !parsed.counts.eul && !parsed.owners.length)) state.regSum = { docId: pdf.id, error: "등기부 형식을 읽지 못했어요. 원문 PDF를 직접 확인해 주세요.", lines: lines };
        else state.regSum = { docId: pdf.id, parsed: parsed, lines: lines };
      }
    } catch (e) { state.regSum = { docId: pdf.id, error: "등기부 PDF를 읽지 못했어요: " + ((e && e.message) || e) }; }
    refreshRegCard();
  }
  function refreshRegCard() {
    var card = root.querySelector('[data-card="registry"]');
    if (!card) return;
    var tmp = document.createElement("div"); tmp.innerHTML = cardRegistry(); card.replaceWith(tmp.firstChild);
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
      // 가장 최근 연도 1건만 보이고, 나머지는 "더보기"를 눌러야 보인다.
      var sortedPrices = prices.slice().sort(function (a, b) { return Number(b.year) - Number(a.year); });
      body += '<div class="lo-sub">개별공시지가 (㎡당)</div><table class="lo-price"><tr><th>연도</th><th>원/㎡</th></tr>' +
        sortedPrices.map(function (p, i) { return '<tr' + (i ? ' class="lo-more"' : '') + '><td>' + esc(p.year) + '</td><td>' + fmt(p.price, 0) + '</td></tr>'; }).join("") + '</table>' +
        (sortedPrices.length > 1 ? '<div class="lo-row"><button type="button" class="lo-morebtn" data-act="price-more" data-more="' + (sortedPrices.length - 1) + '">더보기 (이전 ' + (sortedPrices.length - 1) + '건) ▾</button></div>' : '');
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

  // ---- 지적도 크게 보기: 카카오맵 지적편집도 위에서 확대·축소·이동 ----
  var KAKAO_KEY = "234a59219ce322ed6a684e8ef41bf11f";
  function ensureKakaoMaps() {
    return new Promise(function (resolve, reject) {
      function ready() { try { window.kakao.maps.load(function () { resolve(); }); } catch (e) { reject(e); } }
      if (window.kakao && window.kakao.maps) { ready(); return; }
      var key = String(window.HITOP_KAKAO_JS_KEY || KAKAO_KEY).trim();
      var s = document.createElement("script");
      s.src = "https://dapi.kakao.com/v2/maps/sdk.js?appkey=" + encodeURIComponent(key) + "&libraries=services&autoload=false";
      s.onload = ready;
      s.onerror = function () { reject(new Error("카카오 지도를 불러오지 못했어요.")); };
      document.head.appendChild(s);
    });
  }
  function openCadastral(d, addr) {
    if (!d || !d.point) { toast("이 지번의 좌표를 찾지 못해 크게 볼 수 없어요."); return; }
    var old = document.getElementById("loMapModal"); if (old) old.remove();
    var wrap = document.createElement("div");
    wrap.id = "loMapModal";
    wrap.innerHTML = '<div class="lm-box"><div class="lm-head"><b>📐 지적도 · ' + esc(d.address || addr || "") + '</b>' +
      '<span class="lm-tools"><button type="button" data-m="road" class="on">지적도</button><button type="button" data-m="sky">위성+지적도</button></span>' +
      '<span class="lm-hint">휠·+/- 버튼으로 확대·축소, 드래그로 이동</span><button type="button" class="lm-close" aria-label="닫기">✕</button></div>' +
      '<div class="lm-map" id="loMapCanvas"><div class="lm-wait">지도를 불러오는 중…</div></div></div>';
    document.body.appendChild(wrap);
    function close() { wrap.remove(); document.removeEventListener("keydown", onKey); }
    function onKey(e) { if (e.key === "Escape") close(); }
    document.addEventListener("keydown", onKey);
    wrap.querySelector(".lm-close").addEventListener("click", close);
    wrap.addEventListener("click", function (e) { if (e.target === wrap) close(); });
    ensureKakaoMaps().then(function () {
      var kk = window.kakao.maps, el = document.getElementById("loMapCanvas");
      if (!el) return;
      el.innerHTML = "";
      var center = new kk.LatLng(d.point.y, d.point.x);
      var map = new kk.Map(el, { center: center, level: 2 });
      map.addOverlayMapTypeId(kk.MapTypeId.USE_DISTRICT);
      map.addControl(new kk.ZoomControl(), kk.ControlPosition.RIGHT);
      new kk.Marker({ position: center, map: map });
      wrap.querySelectorAll(".lm-tools button").forEach(function (b) {
        b.addEventListener("click", function () {
          map.setMapTypeId(b.getAttribute("data-m") === "sky" ? kk.MapTypeId.HYBRID : kk.MapTypeId.ROADMAP);
          wrap.querySelectorAll(".lm-tools button").forEach(function (x) { x.classList.toggle("on", x === b); });
        });
      });
    }).catch(function (e) {
      var el = document.getElementById("loMapCanvas");
      if (el) el.innerHTML = '<div class="lm-wait">' + esc((e && e.message) || "지도를 불러오지 못했어요.") + '</div>';
    });
  }

  function cardMap(d) {
    var body = d.mapImage ? '<div class="lo-map"' + (d.point ? ' data-act="map-zoom" title="클릭하면 크게 보고 확대·이동할 수 있어요"' : '') + '><img alt="지적도" src="' + d.mapImage + '"><span class="lo-pin">📍</span></div><div class="lo-note">지도 가운데 📍이 해당 필지예요. 숫자는 지번입니다.</div>' + (d.point ? '<div class="lo-row"><button type="button" class="pri" data-act="map-zoom">🔍 크게 보기 · 확대/이동</button></div>' : '') : '<div class="lo-empty">지적도 이미지를 불러오지 못했어요.</div>';
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
    // 서류 보관(건축물대장·등기부 파일) 영역을 같은 박스 안 아래쪽으로 합친다.
    root.innerHTML = '<section class="detail-section">' + head + body + '<div id="loDocsSlot"></div></section>';
    var docsSlot = root.querySelector("#loDocsSlot");
    if (docsSlot && docsRoot) docsSlot.appendChild(docsRoot);
  }

  root.addEventListener("click", function (e) {
    var t = e.target.closest("[data-act]"); if (!t) return;
    var act = t.getAttribute("data-act"); var addr = (state.info && state.info.address) || valueOf("지도검색주소");
    if (act === "iros") openWithAddress(IROS, addr, "인터넷등기소");
    else if (act === "gov24") openWithAddress(GOV24, addr, "정부24");
    else if (act === "eum") openWithAddress(EUM, addr, "토지이음");
    else if (act === "goto-docs") { docsRoot.scrollIntoView({ behavior: "smooth", block: "start" }); }
    else if (act === "open-reg") { var d0 = (state.regDocs || [])[0]; if (d0) { var win = window.open("", "_blank"); signedUrl(d0).then(function (u) { if (win) win.location.href = u; else window.open(u, "_blank"); }, function () { if (win) win.close(); toast("파일을 열지 못했어요. 다시 로그인한 뒤 시도해 주세요."); }); } }
    else if (act === "price-more") { var tb = t.closest(".lo-card").querySelector(".lo-price"); var op = tb.classList.toggle("open"); t.textContent = op ? "접기 ▴" : "더보기 (이전 " + t.getAttribute("data-more") + "건) ▾"; }
    else if (act === "map-zoom") openCadastral(state.data, addr);
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
        if (cached) { var cd = JSON.parse(cached); if (Date.now() - cd.t < 600000) { state.data = cd.d; state.loading = false; render(); loadRegSummary(); return; } }
      } catch (e) {}
      try {
        state.data = await fetchOverview(state.info);
        try { sessionStorage.setItem(key, JSON.stringify({ t: Date.now(), d: state.data })); } catch (e) {}
      } catch (e) { state.error = e && e.name === "AbortError" ? "응답이 너무 오래 걸려요. 잠시 뒤 새로고침해 주세요." : (e && e.message) || "알 수 없는 오류"; }
    }
    state.loading = false; render();
    loadRegSummary();
  }

  // 등기부 파일이 새로 올라오면 등기부 칸만 갱신
  var obsTimer = null;
  new MutationObserver(function () {
    clearTimeout(obsTimer);
    obsTimer = setTimeout(async function () {
      var next = await loadRegDocs();
      if (JSON.stringify(next.map(function (x) { return x.id; })) === JSON.stringify((state.regDocs || []).map(function (x) { return x.id; }))) return;
      state.regDocs = next; state.regSum = null;
      refreshRegCard();
      loadRegSummary();
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
