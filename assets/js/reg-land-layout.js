// 매물 등록(토지): 토지면적을 새주소 옆으로, 평당가격(자동계산)을 매매가 옆으로 배치한다. (매물 상세 수정창과 같은 배치)
// 입력칸(areaM2, areaPy)은 id와 이벤트를 그대로 둔 채 위치만 옮기므로 저장 로직은 변하지 않는다.
(function () {
  "use strict";
  var grid = document.getElementById("mapAddress") && document.getElementById("mapAddress").closest(".form-grid-3");
  var road = document.getElementById("roadField");
  var m2 = document.getElementById("areaM2");
  var py = document.getElementById("areaPy");
  var sale = document.getElementById("salePrice");
  var cat1 = document.getElementById("category1Select");
  if (!grid || !road || !m2 || !py || !sale || !cat1) return;
  if (document.getElementById("landAreaField")) return;

  var af = document.createElement("div");
  af.className = "field";
  af.id = "landAreaField";
  var al = document.createElement("label");
  al.textContent = "토지면적";
  var inline = document.createElement("div");
  inline.className = "land-area-inline";
  var units = m2.parentElement.querySelectorAll(".area-unit");
  inline.appendChild(m2);
  if (units[0]) inline.appendChild(units[0]);
  inline.appendChild(py);
  if (units[1]) inline.appendChild(units[1]);
  af.appendChild(al);
  af.appendChild(inline);
  road.parentNode.insertBefore(af, road.nextSibling);

  var saleField = sale.closest(".field");
  var pf = document.createElement("div");
  pf.className = "field";
  pf.id = "landPriceField";
  var pl = document.createElement("label");
  pl.setAttribute("for", "landUnitPrice");
  pl.textContent = "평당가격 (원/평)";
  var unit = document.createElement("input");
  unit.id = "landUnitPrice";
  unit.type = "text";
  unit.readOnly = true;
  unit.placeholder = "자동계산";
  unit.setAttribute("aria-label", "토지 매매가 기준 평당가격");
  pf.appendChild(pl);
  pf.appendChild(unit);
  saleField.parentNode.insertBefore(pf, saleField.nextSibling);

  function digits(v) { return String(v || "").replace(/[^\d]/g, ""); }
  function calc() {
    var s = Number(digits(sale.value));
    var p = Number(py.value) || Number(m2.value) / 3.305785;
    unit.value = s > 0 && p > 0 && isFinite(s / p) ? Math.round(s / p).toLocaleString("ko-KR") : "";
  }
  ["input", "change", "blur"].forEach(function (ev) {
    sale.addEventListener(ev, calc); m2.addEventListener(ev, calc); py.addEventListener(ev, calc);
  });

  function sync() { document.body.classList.toggle("land-reg", cat1.value === "토지"); calc(); }
  cat1.addEventListener("change", sync);
  setInterval(sync, 500);
  sync();
})();
