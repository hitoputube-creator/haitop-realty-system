// assets/js/detail.js
(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);

  const elTitle = $("dTitle");
  const elSub = $("dSub");
  const elMeta = $("dMeta");
  const elInfo = $("dInfo");
  const elPlanBox = $("dPlanBox");

  const btnBack = $("btnBack");
  const btnEstimate = $("btnEstimate");
  const btnEdit = $("btnEdit");

  const qs = new URLSearchParams(location.search);
  const id = qs.get("id");

  if (!id) {
    alert("잘못된 접근입니다. id가 없습니다.");
    location.href = "index.html";
    return;
  }

  const listing = DataUtil.getListings().find(x => x.id === id);
  if (!listing) {
    alert("매물을 찾을 수 없습니다.");
    location.href = "index.html";
    return;
  }

  btnBack.addEventListener("click", () => history.back());
  btnEstimate.addEventListener("click", () => {
    window.EstimateUtil.renderAndPrint(listing);
  });
  btnEdit.addEventListener("click", () => {
    alert("수정 기능은 다음 단계에서 연결합니다.");
  });

  renderDetail(listing);

  function renderDetail(x) {
    elTitle.textContent = x.title || "(제목 없음)";

    const head = [labelByType(x.type), x.buildingName || "", x.address || ""].filter(Boolean).join(" · ");
    elSub.textContent = head;

    elMeta.innerHTML = "";
    elMeta.appendChild(metaBox("거래유형", x.dealType || "-"));
    elMeta.appendChild(metaBox("상태", x.status || "-"));
    elMeta.appendChild(metaBox("매물나옴", x.isListed ? "✅" : "—"));
    elMeta.appendChild(metaBox("향", x.direction || "—"));

    elInfo.innerHTML = "";
    addInfo("주소", x.address || "—");
    if (x.buildingName) addInfo("건물명", x.buildingName);
    if (x.unit) addInfo("호실", x.unit);
    if (x.ho) addInfo("호수", x.ho);
    if (x.floor) addInfo("층", x.floor);
    if (x.areaExclusiveM2 || x.areaExclusivePy) addInfo("전용면적", fmtArea(x.areaExclusiveM2, x.areaExclusivePy));
    if (x.areaSupplyM2 || x.areaSupplyPy) addInfo("분양면적", fmtArea(x.areaSupplyM2, x.areaSupplyPy));
    if (x.landAreaM2 || x.landAreaPy) addInfo("토지면적", fmtArea(x.landAreaM2, x.landAreaPy));
    if (x.buildingAreaM2 || x.buildingAreaPy) addInfo("건축면적", fmtArea(x.buildingAreaM2, x.buildingAreaPy));

    const p = priceText(x);
    if (p) addInfo("가격", p);

    if (x.ownerName) addInfo("소유주", `${x.ownerName}${x.ownerPhone ? " ("+x.ownerPhone+")" : ""}`);
    if (x.tenantName) addInfo("임차인", `${x.tenantName}${x.tenantPhone ? " ("+x.tenantPhone+")" : ""}`);
    if (x.leaseEnd) addInfo("계약만료", x.leaseEnd);
    if (x.memo) addInfo("메모", x.memo);

    renderPlan(x);
  }

  function renderPlan(x) {
    elPlanBox.innerHTML = "";
    const b = x.buildingId ? DataUtil.findBuildingById(x.buildingId) : null;

    if (x.type === "shop" && b?.floorplans && x.floor) {
      const url = b.floorplans[x.floor];
      if (url) {
        elPlanBox.innerHTML = `
          <div class="image-box">
            <img src="${escapeAttr(url)}" alt="평면도">
            <div class="small" style="margin-top:8px;">${x.floor} 평면도</div>
          </div>`;
        return;
      }
    }

    if ((x.type === "officetel" || x.type === "apartment") && b?.layouts?.length) {
      elPlanBox.innerHTML = `
        <div class="image-box">
          <img src="${escapeAttr(b.layouts[0])}" alt="배치도">
          <div class="small" style="margin-top:8px;">호수 배치도</div>
        </div>`;
      return;
    }

    if ((x.type.startsWith("land") || x.type === "factory") && Array.isArray(x.attachments) && x.attachments.length) {
      const links = x.attachments.map(a =>
        `<div class="small">- <a href="${esc(a.url)}" target="_blank">${esc(a.label || "자료")}</a></div>`
      ).join("");
      elPlanBox.innerHTML = `<div class="readonly-box">${links}</div>`;
      return;
    }

    elPlanBox.innerHTML = `<div class="small">등록된 도면/자료가 없습니다.</div>`;
  }

  function metaBox(label, value) {
    const div = document.createElement("div");
    div.className = "box";
    div.innerHTML = `<div class="label">${esc(label)}</div><div class="value">${esc(value)}</div>`;
    return div;
  }

  function addInfo(k, v) {
    const row = document.createElement("div");
    row.className = "info-row";
    row.innerHTML = `<div class="k">${esc(k)}</div><div class="v">${esc(v)}</div>`;
    elInfo.appendChild(row);
  }

  function fmtArea(m2, py) {
    const mm = m2 ? `${fmtNum(m2)}㎡` : "";
    const pp = py ? `${fmtNum(py)}평` : "";
    return `${mm}${mm && pp ? " " : ""}(${pp})`.trim() || "—";
  }

  function priceText(x) {
    const man = (n) => (n && Number(n) ? Number(n).toLocaleString("ko-KR")+"만원" : "");
    if (x.type === "shop" || x.type === "bizcenter" || x.type === "factory") {
      if (x.dealType === "임대" || x.dealType === "월세") return `보증금 ${man(x.depositManwon)} / 월세 ${man(x.rentManwon)}`;
      if (x.dealType === "매매" || x.dealType === "분양") return x.salePriceManwon ? `매매 ${man(x.salePriceManwon)}` : "";
    }
    if (x.type === "officetel" || x.type === "apartment") {
      if (x.dealType === "전세") return x.jeonsePriceManwon ? `전세 ${man(x.jeonsePriceManwon)}` : "";
      if (x.dealType === "월세" || x.dealType === "임대") return `보증금 ${man(x.depositManwon)} / 월세 ${man(x.rentManwon)}`;
      if (x.dealType === "매매" || x.dealType === "분양") return x.salePriceManwon ? `매매 ${man(x.salePriceManwon)}` : "";
    }
    if (x.type.startsWith("land")) return x.salePriceManwon ? `매매 ${man(x.salePriceManwon)}` : "";
    return "";
  }

  function labelByType(t) {
    const map = { shop:"상가", officetel:"오피스텔", apartment:"아파트", bizcenter:"지식산업센터",
      factory:"공장/창고", land_dev:"토지(시행)", land_single:"토지(단독)", land_general:"토지(일반)" };
    return map[t] || "매물";
  }

  function fmtNum(v) {
    const n = Number(v);
    if (!isFinite(n)) return String(v ?? "");
    return String(v).includes(".") ? n.toFixed(2).replace(/\.00$/, "") : n.toLocaleString("ko-KR");
  }

  function esc(s) {
    return String(s ?? "").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;");
  }

  function escapeAttr(s) {
    return String(s ?? "").replaceAll("&","&amp;").replaceAll('"',"&quot;").replaceAll("<","&lt;").replaceAll(">","&gt;");
  }

})();
