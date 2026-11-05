/* 호실 수정창: 📌 특별분양 체크 (건물의 특별 조건·홍보물 기록을 보고 켜지고 꺼진다)
 * 체크 자체는 값을 따로 저장하지 않는다. 켜기 = 기록 추가 입력창, 끄기 = 해당 기록 종료 처리(확인창 있음).
 */
(function () {
  var HR = null, recs = [], urlMap = {}, loadedFor = "", seq = 0, timer = null;
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function toMan(str) {
    var s = String(str || "").replace(/\[[^\]]*\]|\([^)]*\)/g, "").replace(/,/g, ""), t = 0, hit = false, m;
    if ((m = s.match(/(\d+(?:\.\d+)?)\s*억/))) { t += parseFloat(m[1]) * 10000; hit = true; }
    if ((m = s.match(/(\d+)\s*천\s*만?/))) { t += parseInt(m[1], 10) * 1000; hit = true; }
    if ((m = s.replace(/\d+\s*천\s*만?/g, "").match(/(\d+)\s*만/))) { t += parseInt(m[1], 10); hit = true; }
    return hit && t > 0 ? t : null;
  }
  var AMT = "((?:\\d[\\d,\\.]*\\s*[억천만]+\\s*)+원?)";
  function pick(text, label) { var m = String(text || "").match(new RegExp(label + "\\s*:?\\s*" + AMT)); return m ? m[1].trim() : ""; }
  function priceInfo(r) {
    var p = r.price || pick(r.text, "특가\\s*분양가"), o = r.orig || pick(r.text, "원분양가"), a = toMan(p), b = toMan(o);
    return { price: p, disc: a && b && b > a ? Math.round((1 - a / b) * 1000) / 10 : null };
  }
  function hoText() { var i = $("u_호수"); return i ? i.value.trim() : ""; }
  function isResi() { var m = $("unitModal"); return !m || m.classList.contains("residential-modal"); }
  function hitsFor() {
    var h = hoText(); if (!h || !HR) return [];
    var rooms = HR.expandRooms(h);
    return recs.filter(function (r) { return HR.status(r).key !== "ended" && rooms.some(function (x) { return HR.roomsInclude(r, x); }); });
  }
  async function load(force) {
    if (!window.HitopRecords || typeof buildingId === "undefined") return false;
    HR = window.HitopRecords;
    if (!force && loadedFor === buildingId) return true;
    var r = await HR.fetchRecords(buildingId); recs = r.records; urlMap = r.urlMap; loadedFor = buildingId; return true;
  }
  function style() {
    if ($("upStyle")) return;
    var st = document.createElement("style"); st.id = "upStyle";
    st.textContent = "#upPromo{grid-column:1/-1;background:#fffbe8;border:1px solid #e8a317;border-radius:10px;padding:8px 12px;font-size:.8rem}#upPromo .up-rec{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-top:6px}#upPromo .up-sp{flex:1}#upPromo .up-ok{color:#d14a00;font-weight:700}#upPromo button{font:inherit;font-size:12px;border:1px solid #1b8a8a;color:#1b8a8a;border-radius:20px;padding:2px 10px;background:#fff;cursor:pointer}#upPromo button.red{border-color:#c0504d;color:#c0504d}#upPromo button.main{background:#1b8a8a;color:#fff}#upPromo .up-note{color:#7a8b89;margin-top:4px}";
    document.head.appendChild(st);
  }
  function ensureUi() {
    if ($("u_특별분양")) return true;
    var anchor = $("u_수익성매물"); if (!anchor) return false;
    var field = anchor.closest(".umfield"); if (!field) return false;
    style();
    var f = document.createElement("div"); f.className = "umfield umcheck g3";
    f.innerHTML = '<label for="u_특별분양"><input id="u_특별분양" type="checkbox"> 📌 특별분양</label>';
    field.parentNode.insertBefore(f, field.nextSibling);
    var p = document.createElement("div"); p.id = "upPromo"; p.hidden = true; f.parentNode.insertBefore(p, f.nextSibling);
    $("u_특별분양").addEventListener("click", function (e) {
      e.preventDefault();
      var h = hitsFor();
      if (!h.length) openAdd(); else if (h.length === 1) endRec(h[0]); else alert("이 호실에 진행 중인 기록이 " + h.length + "개예요. 아래에서 하나씩 종료 처리해 주세요.");
    });
    return true;
  }
  function openAdd() {
    var h = hoText(); if (!h) { alert("호수를 먼저 입력해 주세요."); return; }
    var defaults = { rooms: h };
    if (/^\d{3,4}$/.test(h)) defaults.floor = h.slice(0, -2);
    HR.openForm({ buildingId: buildingId, defaults: defaults, onSaved: async function () { await load(true); await refresh(); } });
  }
  async function endRec(r) {
    var n = HR.expandRooms(r.rooms).length;
    var msg = (n > 1 ? "이 기록은 " + n + "개 호실(" + r.rooms + ")에 함께 적용돼요. 종료하면 모든 호실에서 끝나요.\n" : "") + "특별 조건을 종료 처리할까요? (기록은 남아요)";
    if (!confirm(msg)) return;
    try { await HR.setEnded(r, true); await load(true); await refresh(); } catch (e) { alert("종료 처리 실패: " + e.message); }
  }
  function detail(r) {
    HR.ensureStyle();
    var ov = document.createElement("div"); ov.className = "hr-overlay"; ov.style.zIndex = 99999;
    ov.innerHTML = '<div class="hr-modal"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px"><b style="font-size:16px">📌 특별 조건 · 홍보</b><button type="button" class="hr-btn" id="upClose">닫기</button></div><div class="hr-grid" style="grid-template-columns:1fr">' + HR.cardHtml(r, urlMap, { readonly: true }) + "</div></div>";
    document.body.appendChild(ov);
    ov.addEventListener("click", function (e) { if (e.target === ov || e.target.id === "upClose") ov.remove(); });
  }
  async function refresh() {
    if (isResi()) return;
    var my = ++seq;
    try { if (!(await load(false))) return; } catch (e) { return; }
    if (my !== seq || !ensureUi()) return;
    var cb = $("u_특별분양"), p = $("upPromo"), h = hoText();
    if (!h) { cb.checked = false; cb.disabled = true; p.hidden = true; return; }
    cb.disabled = false;
    var hits = hitsFor(); cb.checked = hits.length > 0;
    if (!hits.length) { p.hidden = true; p.innerHTML = ""; return; }
    p.hidden = false;
    var multi = false;
    p.innerHTML = '<b>📌 이 호실에 적용되는 특별 조건</b>' + hits.map(function (r, i) {
      var st = HR.status(r), pi = priceInfo(r), n = HR.expandRooms(r.rooms).length; if (n > 1) multi = true;
      return '<div class="up-rec"><b>' + esc(r.rooms || "건물 전체") + '</b><span class="up-ok">' + esc(st.label) + "</span>"
        + (r.fee ? "<span>수수료 " + esc(r.fee) + "</span>" : "") + (pi.price ? "<span>특가 " + esc(pi.price) + (pi.disc != null ? " (-" + pi.disc + "%)" : "") + "</span>" : "")
        + '<span class="up-sp"></span><button type="button" data-up-view="' + i + '">자세히</button><button type="button" class="red" data-up-end="' + i + '">종료 처리</button></div>';
    }).join("") + (multi ? '<div class="up-note">※ 여러 호실에 함께 적용되는 기록이에요. 종료하면 같은 기록의 다른 호실에서도 끝나요.</div>' : "")
      + '<div class="up-rec"><button type="button" class="main" data-up-add="1">+ 특별 조건 추가</button></div>';
    p.querySelectorAll("[data-up-view]").forEach(function (b) { b.onclick = function () { detail(hits[+b.dataset.upView]); }; });
    p.querySelectorAll("[data-up-end]").forEach(function (b) { b.onclick = function () { endRec(hits[+b.dataset.upEnd]); }; });
    p.querySelector("[data-up-add]").onclick = openAdd;
  }
  /* 층 버튼 숫자: 기록의 층 칸이 비어 있어도 대상 호실 번호로 층을 알아내 표시 (월드타워처럼) */
  function floorOfHo(h) { return /^\d{3,4}$/.test(h) ? h.slice(0, -2) : ""; }
  var regHo = null;
  function readRegistered() {
    var act = document.querySelector("#unitFloorTabs .ftab.active"), rows = document.querySelectorAll(".units-tbl tbody tr");
    if (act && act.dataset.floor === "전체" && rows.length) {
      var s = {}; rows.forEach(function (r) { var st = r.querySelector("td:nth-child(2) strong"); if (st) s[st.textContent.trim()] = 1; }); regHo = s;
    }
  }
  /* 층 버튼 숫자 = 그 층에서 특별 조건이 걸린 호실 수 (층 칸이 비어 있어도 호실 번호로 층을 알아낸다) */
  function badges() {
    var box = $("unitFloorTabs"); if (!box || !HR) return;
    var first = box.querySelector(".ftab[data-floor]:not([data-floor='전체'])"); if (!first || first.textContent.indexOf("동") >= 0) return;
    readRegistered();
    var per = {};
    function add(f, h) { if (!f) return; if (regHo && !regHo[h]) return; (per[f] = per[f] || {})[h] = 1; }
    recs.forEach(function (r) {
      if (HR.status(r).key === "ended") return;
      var rooms = HR.expandRooms(r.rooms || "").filter(Boolean);
      if (rooms.length) rooms.forEach(function (h) { add(r.floor ? String(r.floor) : floorOfHo(h), h); });
      else if (r.floor && regHo) Object.keys(regHo).forEach(function (h) { if (floorOfHo(h) === String(r.floor)) add(String(r.floor), h); });
    });
    box.querySelectorAll(".ftab[data-floor]").forEach(function (b) {
      var f = b.dataset.floor; if (!f || f === "전체") return;
      var n = per[f] ? Object.keys(per[f]).length : 0, i = b.querySelector(".rec-n");
      if (!n) { if (i) i.remove(); return; }
      if (!i) { i = document.createElement("i"); i.className = "rec-n"; b.appendChild(i); }
      i.textContent = String(n);
    });
  }
  function floorBadges() { load(false).then(badges).catch(function () {}); }
  function watchFloors() {
    var tries = 0, iv = setInterval(function () {
      var box = $("unitFloorTabs");
      if (box) { clearInterval(iv); new MutationObserver(floorBadges).observe(box, { childList: true }); floorBadges(); }
      else if (++tries > 40) clearInterval(iv);
    }, 500);
  }
  function schedule() { clearTimeout(timer); timer = setTimeout(refresh, 250); }
  function init() {
    var m = $("unitModal"); if (!m) return;
    new MutationObserver(function () { if (m.classList.contains("open")) schedule(); }).observe(m, { attributes: true, attributeFilter: ["class"] });
    document.addEventListener("input", function (e) { if (e.target && e.target.id === "u_호수") schedule(); });
    if (m.classList.contains("open")) schedule();
    watchFloors();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
  window.__upDebug = { refresh: refresh };
})();
