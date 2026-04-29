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
  const btnInfoPrint = $("btnInfoPrint");

  const elInfoPrint = document.getElementById("infoPrint");

  const qs = new URLSearchParams(location.search);
  const id = qs.get("id");
  const printMode = qs.get("print");

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
    location.href = `register.html?id=${listing.id}`;
  });
  if (btnInfoPrint) {
    btnInfoPrint.addEventListener("click", () => {
      renderInfoPrint(listing);
      window.print();
    });
  }

  renderDetail(listing);

  // 리스트에서 단건 출력 요청
  if (printMode === "info") {
    renderInfoPrint(listing);
    setTimeout(() => window.print(), 50);
  }

  function renderDetail(x) {
    elTitle.textContent = x.title || x.buildingName || "(제목 없음)";

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
    if (x.floorGroup) addInfo("층수", x.floorGroup);
    else if (x.floor) addInfo("층", x.floor);
    if (x.areaExclusiveM2 || x.areaExclusivePy) addInfo("전용면적", fmtArea(x.areaExclusiveM2, x.areaExclusivePy));
    if (x.areaSupplyM2 || x.areaSupplyPy) addInfo("분양면적", fmtArea(x.areaSupplyM2, x.areaSupplyPy));
    if (x.landAreaM2 || x.landAreaPy) addInfo("토지면적", fmtArea(x.landAreaM2, x.landAreaPy));
    if (x.buildingAreaM2 || x.buildingAreaPy) addInfo("건축면적", fmtArea(x.buildingAreaM2, x.buildingAreaPy));

    const p = priceText(x);
    if (p) addInfo("가격", p);

    if (x.ownerName) addInfo("소유주", `${x.ownerName}${x.ownerPhone ? " ("+x.ownerPhone+")" : ""}`);
    if (x.tenantName) addInfo("임차인", `${x.tenantName}${x.tenantPhone ? " ("+x.tenantPhone+")" : ""}`);
    if (x.leaseEnd) addInfo("계약만료", x.leaseEnd);
    if (Array.isArray(x.memoEntries) && x.memoEntries.length) {
      const t = x.memoEntries
        .slice()
        .sort((a,b)=>String(b.date).localeCompare(String(a.date)))
        .map(m => `${m.date || ""}  ${m.text || ""}`.trim())
        .join("\n");
      if (t) addInfo("메모", t);
    } else if (x.memo) {
      addInfo("메모", x.memo);
    }

    renderPlan(x);
  }

  function renderPlan(x) {
    elPlanBox.innerHTML = "";
    const b = x.buildingId ? DataUtil.findBuildingById(x.buildingId) : null;

    if (x.type === "shop" && b?.floorplans) {
      const key = x.floor || (x.floorGroup === "1층" ? "1F" : x.floorGroup === "2층" ? "2F" : "3F");
      const url = b.floorplans[key];
      if (url) {
        elPlanBox.innerHTML = `
          <div class="image-box">
            <img src="${escapeAttr(url)}" alt="평면도">
            <div class="small" style="margin-top:8px;">${esc(key)} 평면도</div>
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

  // ── 매물 설명서 출력 렌더링 (A4 전문 양식) ──
  function renderInfoPrint(x) {
    if (!elInfoPrint) return;

    const title = x.title || [x.buildingName, x.unit || x.ho].filter(Boolean).join(" ") || "매물 설명";

    // 주소 + 호실 조합
    const addrParts = [x.address || ""];
    if (x.unit) addrParts.push(x.unit + "호");
    else if (x.ho) addrParts.push(x.ho);
    const fullAddr = addrParts.filter(Boolean).join(" ") || "-";

    const price = priceText(x) || "-";
    const exArea = fmtArea(x.areaExclusiveM2, x.areaExclusivePy);
    const supArea = fmtArea(x.areaSupplyM2, x.areaSupplyPy);
    const landArea = fmtArea(x.landAreaM2, x.landAreaPy);
    const bldArea = fmtArea(x.buildingAreaM2, x.buildingAreaPy);
    const floorTxt = x.floorGroup || guessFloorGroup(x.floor) || "-";

    // 출력일
    const today = new Date();
    const dateStr = today.getFullYear() + "." +
      String(today.getMonth()+1).padStart(2,"0") + "." +
      String(today.getDate()).padStart(2,"0");

    // 메모
    const memoText = Array.isArray(x.memoEntries) && x.memoEntries.length
      ? x.memoEntries.slice()
          .sort((a,b)=>String(b.date).localeCompare(String(a.date)))
          .map(m => (m.date ? "["+m.date+"] " : "") + (m.text || "")).filter(Boolean).join("\n")
      : (x.memo || "");

    // 건물 마스터
    const bObj = x.buildingId ? (DataUtil.findBuildingById(x.buildingId) || null) : null;
    const approved = bObj ? (bObj.approved || "-") : "-";
    const mainFee = x.maintenanceFeeManwon ? Number(x.maintenanceFeeManwon).toLocaleString("ko-KR") + "만원" : "-";

    // 핵심 요약 그리드
    const summaryGrid = `
      <div class="ip-summary-grid">
        <div class="ip-summary-item wide">
          <div class="sl">건물명</div>
          <div class="sv">${esc(x.buildingName || title)}</div>
        </div>
        <div class="ip-summary-item">
          <div class="sl">거래형태</div>
          <div class="sv">${esc(x.dealType || "-")}</div>
        </div>
        <div class="ip-summary-item">
          <div class="sl">현황/상태</div>
          <div class="sv">${esc(x.status || "-")}</div>
        </div>
        <div class="ip-summary-item">
          <div class="sl">층구분</div>
          <div class="sv">${esc(floorTxt)}</div>
        </div>
        <div class="ip-summary-item wide">
          <div class="sl">금액</div>
          <div class="sv">${esc(price)}</div>
        </div>
        <div class="ip-summary-item wide">
          <div class="sl">면적 (전용)</div>
          <div class="sv">${esc(exArea !== "—" ? exArea : (landArea !== "—" ? landArea : "-"))}</div>
        </div>
      </div>`;

    // 상세 정보 표
    const tr = (k, v, isNum) =>
      `<tr><th>${esc(k)}</th><td${isNum ? " class=\"num\"" : ""}>${esc(String(v ?? ""))}</td></tr>`;
    const trows = [];
    trows.push(tr("위치(주소)", fullAddr));
    if (x.buildingName) trows.push(tr("건물명", x.buildingName));
    if (exArea !== "—") trows.push(tr("전용면적", exArea, true));
    if (supArea !== "—") trows.push(tr("분양(계약)면적", supArea, true));
    if (landArea !== "—") trows.push(tr("토지면적", landArea, true));
    if (bldArea !== "—") trows.push(tr("건축면적", bldArea, true));
    if (x.direction) trows.push(tr("향", x.direction));
    if (mainFee !== "-") trows.push(tr("관리비", mainFee, true));
    if (approved !== "-") trows.push(tr("사용승인일", approved));
    if (x.otType) trows.push(tr("타입", x.otType));
    if (x.rooms) trows.push(tr("방수", x.rooms + "R"));
    if (x.currentBiz) trows.push(tr("현업종", x.currentBiz));
    if (x.leaseEnd) trows.push(tr("계약만료일", x.leaseEnd));
    if (x.vatMode && x.vatMode !== "해당없음") trows.push(tr("부가세", x.vatMode + " " + (x.vatRate||10) + "%"));
    if (x.landJimo) trows.push(tr("지목", x.landJimo));
    if (x.landUseZone) trows.push(tr("용도지역", x.landUseZone));
    if (x.coverageRatio) trows.push(tr("건폐율", x.coverageRatio + "%"));
    if (x.farRatio) trows.push(tr("용적률", x.farRatio + "%"));
    if (x.roadAccess) trows.push(tr("도로접합", x.roadAccess));
    if (x.clearHeightM) trows.push(tr("층고", x.clearHeightM + "m"));
    if (x.powerKw) trows.push(tr("전력", x.powerKw + "kW"));

    // 매물 설명 섹션 (체크 항목만)
    const dc = x.descChecks || {};
    const descDefs = [
      { key:"location",  title:"① 입지 분석",             txtKey:"locationText"  },
      { key:"demand",    title:"② 수요 및 업종 적합성",   txtKey:"demandText"    },
      { key:"strength",  title:"③ 매물 강점",             txtKey:"strengthText"  },
      { key:"notes",     title:"④ 계약 조건 및 유의사항", txtKey:"notesText"     },
    ];
    const descHtml = descDefs
      .filter(b => dc[b.key] && (dc[b.txtKey]||"").trim())
      .map(b => `<div class="ip-desc-block">
          <div class="db-title">${b.title}</div>
          <div class="db-content">${esc((dc[b.txtKey]||"").trim())}</div>
        </div>`).join("");

    elInfoPrint.innerHTML = `
      <div class="ip-header">
        <div>
          <div class="ip-brand">하이탑부동산</div>
          <div class="ip-tel">☎ 031-949-8969</div>
        </div>
        <div class="ip-print-date">출력일: ${dateStr}</div>
      </div>

      <div class="ip-doc-title">부동산 매물 설명서</div>

      <div class="ip-summary">
        <div class="ip-summary-title">핵심 요약</div>
        ${summaryGrid}
      </div>

      <div class="ip-detail-title">상세 정보</div>
      <table class="ip-table"><tbody>${trows.join("")}</tbody></table>

      ${descHtml ? `<div class="ip-desc-section"><div class="ip-detail-title">매물 설명</div>${descHtml}</div>` : ""}

      ${memoText ? `<div class="ip-memo-block"><div class="db-title">메모 / 특이사항</div><div class="db-content">${esc(memoText)}</div></div>` : ""}

      <div class="ip-footer">
        <div class="ip-footer-main">하이탑부동산 &nbsp;|&nbsp; ☎ 031-949-8969</div>
        <div class="ip-footer-note">본 설명서는 내부 참고용이며 공식 계약서가 아닙니다.</div>
      </div>
    `;
  }

  function guessFloorGroup(floor) {
    const f = String(floor || "").toUpperCase();
    if (f === "1F" || f.includes("1F")) return "1층";
    if (f === "2F" || f.includes("2F")) return "2층";
    return "상층부";
  }

})();
