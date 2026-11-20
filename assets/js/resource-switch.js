// ===== 자료실 이동 선택창 (상가 · 주거 · 택지 · 공장창고 자료관리 공용) =====
// 상단 메뉴 아래에 선택창을 달아, 고르면 해당 자료관리 페이지로 이동한다. 하이탑/케이탑 공용.
(function () {
  var PAGES = [
    { file: "resources.html", label: "상가·건물 자료" },
    { file: "residential-resources.html", label: "주거용 자료" },
    { file: "land-resources.html", label: "택지용 자료" },
    { file: "factory-resources.html", label: "공장·창고 자료" }
  ];
  var EXTRA = { "other-resources.html": "기타 자료" };

  function init() {
    var nav = document.querySelector("header .main-nav");
    if (!nav || document.getElementById("resourceSwitchRow")) return;
    var cur = (location.pathname.split("/").pop() || "").toLowerCase();
    var items = PAGES.slice();
    if (EXTRA[cur]) items.push({ file: cur, label: EXTRA[cur] });
    if (!items.some(function (p) { return p.file === cur; })) return;

    var row = document.createElement("div");
    row.id = "resourceSwitchRow";
    row.className = "resource-switch-row no-print";
    var sel = document.createElement("select");
    sel.id = "resourceSwitch";
    sel.className = "resource-switch";
    sel.setAttribute("aria-label", "자료관리 페이지 이동");
    items.forEach(function (p) {
      var o = document.createElement("option");
      o.value = p.file;
      o.textContent = p.label;
      if (p.file === cur) o.selected = true;
      sel.appendChild(o);
    });
    sel.addEventListener("change", function () {
      var file = sel.value;
      if (!file || file === cur) return;
      var url = (window.OfficeConfig && OfficeConfig.urlFor) ? OfficeConfig.urlFor(file) : file;
      location.href = url;
    });
    row.appendChild(sel);
    nav.insertAdjacentElement("afterend", row);

    // 상단 메뉴 버튼과 같은 색·모양으로 맞춘다(하이탑 청록 / 케이탑 네이비 자동)
    var ref = nav.querySelector(".nav-link:not(.active)") || nav.querySelector(".nav-link");
    var st = document.createElement("style");
    var c = ref ? getComputedStyle(ref) : null;
    st.textContent =
      ".resource-switch-row{flex:0 0 100%;display:flex;justify-content:flex-end;margin-top:-4px}" +
      ".resource-switch{width:170px !important;max-width:170px;flex:0 0 auto;height:30px;padding:0 10px;cursor:pointer;font-size:12.4px;font-weight:600;" +
      "font-family:" + (c ? c.fontFamily : "inherit") + ";" +
      "color:" + (c ? c.color : "#075b60") + ";" +
      "background:" + (c ? c.backgroundColor : "rgba(255,255,255,.86)") + ";" +
      "border:" + (c ? c.border : "1px solid rgba(255,255,255,.72)") + ";" +
      "border-radius:" + (c ? c.borderRadius : "8px") + "}";
    document.head.appendChild(st);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { setTimeout(init, 0); });
  else setTimeout(init, 0);
})();
