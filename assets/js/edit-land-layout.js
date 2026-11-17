// 매물 상세 수정창(토지): 토지면적을 새주소 옆으로, 평당가격을 매매가 옆으로 옮겨 배치한다.
// 입력칸(edit_areaM2, edit_areaPy, edit_landUnitPrice)은 id와 이벤트를 그대로 둔 채 위치만 옮기므로 저장·자동계산 로직은 변하지 않는다.
(function () {
  "use strict";
  var modal = document.getElementById("editModal");
  var grid = document.getElementById("edit_basicInfoGrid");
  var road = document.getElementById("edit_roadField");
  var m2 = document.getElementById("edit_areaM2");
  var py = document.getElementById("edit_areaPy");
  var unit = document.getElementById("edit_landUnitPrice");
  var sale = document.getElementById("edit_salePrice");
  var cat1 = document.getElementById("edit_category1");
  if (!modal || !grid || !road || !m2 || !py || !unit || !sale || !cat1) return;
  if (document.getElementById("edit_landAreaField")) return;

  // 토지면적 칸 (새주소 바로 옆)
  var af = document.createElement("div");
  af.className = "field";
  af.id = "edit_landAreaField";
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

  // 평당가격 칸 (매매가 바로 옆)
  var saleField = sale.closest(".field");
  var pf = document.createElement("div");
  pf.className = "field";
  pf.id = "edit_landPriceField";
  var pl = document.createElement("label");
  pl.setAttribute("for", "edit_landUnitPrice");
  pl.textContent = "평당가격 (원/평)";
  pf.appendChild(pl);
  pf.appendChild(unit);
  saleField.parentNode.insertBefore(pf, saleField.nextSibling);

  function sync() { modal.classList.toggle("land-edit", cat1.value === "토지"); }
  cat1.addEventListener("change", sync);
  setInterval(sync, 400);
  sync();
})();
