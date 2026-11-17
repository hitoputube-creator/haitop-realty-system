// 매물 등록·수정: 1차구분이 "토지"이면 지도검색주소 옆 "자동조회" 버튼이 토지대장 조회로 바뀌어 토지면적(대지면적)을 채운다.
// 건물 유형은 기존 건축물대장 자동조회가 그대로 동작한다. 하이탑·케이탑 공용.
(function () {
  "use strict";
  // 등록 화면(register.html)은 접두사 없는 id, 매물 상세의 수정 창(detail.html)은 "edit_" 접두사 id를 쓴다.
  var P = document.getElementById("edit_mapAddress") ? "edit_" : "";
  var btn = document.getElementById(P ? "editLookupBuildingBtn" : "lookupBuildingBtn");
  var cat1 = document.getElementById(P ? "edit_category1" : "category1Select");
  var mapEl = document.getElementById(P + "mapAddress");
  if (!btn || !cat1 || !mapEl) return;
  var HITOP_URL = "https://xaxbkdnrzsghsabkdvzj.supabase.co";
  var HITOP_KEY = "sb_publishable_gqNFRMHb6yYKvqFnQurPKQ_7gGhURVd"; // 공개(publishable) 키
  var IS_KTOP = typeof OfficeConfig !== "undefined" && OfficeConfig.id === "ktop";
  var statusEl = document.getElementById(P ? "editLookupBuildingStatus" : "lookupBuildingStatus");
  var refBox = document.getElementById(P ? "editBuildingLookupRefBox" : "buildingLookupRefBox");
  var refText = document.getElementById(P ? "editBuildingLookupRefText" : "buildingLookupRefText");
  var normalLabel = btn.textContent;

  function isLand() { return cat1.value === "토지"; }
  function toast(msg, ms) { if (typeof showToast === "function") showToast(msg, ms || 4000); else alert(msg); }
  function fmt(n, d) { return Number(n).toLocaleString("ko-KR", { maximumFractionDigits: d == null ? 2 : d }); }
  function syncLabel() {
    if (isLand()) { if (btn.textContent !== "🔍 토지대장 조회") { btn.textContent = "🔍 토지대장 조회"; btn.title = "주소로 토지대장을 조회해 토지면적을 채웁니다"; } }
    else if (btn.textContent === "🔍 토지대장 조회") { btn.textContent = normalLabel; btn.title = ""; }
  }
  cat1.addEventListener("change", syncLabel);
  setInterval(syncLabel, 800);
  syncLabel();

  async function token() {
    var c = typeof hitopAuthClient !== "undefined" ? hitopAuthClient : null;
    if (!c) return null;
    var s = await c.auth.getSession();
    return s && s.data && s.data.session ? s.data.session.access_token : null;
  }
  async function fetchLand(address) {
    var t = await token();
    if (!t) throw new Error("로그인이 필요해요.");
    var hdr = IS_KTOP
      ? { apikey: HITOP_KEY, Authorization: "Bearer " + HITOP_KEY, "x-ktop-token": t, "Content-Type": "application/json" }
      : { apikey: OfficeConfig.key, Authorization: "Bearer " + t, "Content-Type": "application/json" };
    var ctl = new AbortController(); var timer = setTimeout(function () { ctl.abort(); }, 45000);
    try {
      var res = await fetch((IS_KTOP ? HITOP_URL : OfficeConfig.url) + "/functions/v1/listing-overview", { method: "POST", signal: ctl.signal, headers: hdr, body: JSON.stringify({ address: address }) });
      var d = null; try { d = await res.json(); } catch (e) {}
      if (!res.ok || !d || d.error) throw new Error((d && d.error) || ("조회 실패 (" + res.status + ")"));
      return d;
    } finally { clearTimeout(timer); }
  }
  function setValue(id, v) {
    var el = document.getElementById(id);
    if (!el) return false;
    el.value = v; el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }

  async function run() {
    var address = mapEl.value.trim();
    if (!address) { toast("❌ 지도검색주소를 먼저 입력해주세요."); return; }
    btn.disabled = true;
    if (statusEl) statusEl.textContent = "토지대장 조회 중...";
    if (refBox) refBox.style.display = "none";
    try {
      var d = await fetchLand(address);
      var l = d.land;
      if (!l || !l.area) throw new Error("이 지번의 토지대장 면적을 찾지 못했어요. 주소(동·리와 지번)를 확인해 주세요.");
      var filled = ["토지면적"];
      setValue(P + "areaM2", l.area);
      var py = document.getElementById(P + "areaPy");
      if (py && (!py.value || Number(py.value) === 0)) setValue(P + "areaPy", Math.round(l.area * 0.3025));
      var c = d.characteristics, zone = c && c.zone1 && c.zone1.indexOf("지정되지") < 0 ? c.zone1 : "";
      var z = document.getElementById(P + "zoning");
      if (z && zone && !String(z.value || "").trim()) { setValue(P + "zoning", zone); filled.push("용도지역"); }
      if (statusEl) statusEl.textContent = "✅ 토지대장 조회됨";
      if (refBox && refText) {
        var price = d.prices && d.prices[0];
        refText.textContent = d.address + " · 지목 " + (l.jimok || "—") + " · 면적 " + fmt(l.area) + "㎡(" + fmt(l.area * 0.3025, 1) + "평)" + (zone ? " · 용도지역 " + zone : "") + (price ? " · 개별공시지가 " + fmt(price.price, 0) + "원/㎡(" + price.year + ")" : "") + " — " + filled.join(", ") + " 항목을 채웠어요. 값을 확인 후 저장하세요.";
        refBox.style.display = "";
      }
    } catch (err) {
      if (statusEl) statusEl.textContent = "";
      toast("❌ " + ((err && err.name === "AbortError") ? "응답이 너무 오래 걸려요. 잠시 뒤 다시 눌러 주세요." : ((err && err.message) || String(err))), 5000);
    } finally { btn.disabled = false; }
  }

  // 토지일 때만 기존 건축물대장 조회보다 먼저 가로채서 토지대장 조회를 한다.
  document.addEventListener("click", function (e) {
    var t = e.target && e.target.closest ? e.target.closest("#" + btn.id) : null;
    if (!t || !isLand()) return;
    e.preventDefault(); e.stopImmediatePropagation();
    run();
  }, true);
})();
