// assets/js/register.js
(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);

  const elTypeSelect = $("typeSelect");
  const elBuildingSelect = $("buildingSelect");
  const elBuildingInfo = $("buildingInfo");
  const elDynamic = $("dynamicFields");
  const elDealType = $("dealType");
  const elStatus = $("status");
  const elIsListed = $("isListed");
  const elSave = $("btnSave");

  let currentType = elTypeSelect.value || "shop";

  const BUILDING_TYPES = new Set(["shop", "officetel", "apartment", "bizcenter"]);
  const SHOP_FLOORS = DataUtil.SHOP_FLOORS;
  const DIRECTIONS = DataUtil.DIRECTIONS;

  init();

  function init() {
    elTypeSelect.addEventListener("change", () => {
      currentType = elTypeSelect.value;
      syncBuildingUI();
      renderDynamicFields(currentType);
    });

    elBuildingSelect.addEventListener("change", renderBuildingInfo);

    elStatus.addEventListener("change", () => {
      if (elStatus.value === "완료") elIsListed.checked = false;
    });

    elSave.addEventListener("click", saveListing);

    syncBuildingUI();
    renderDynamicFields(currentType);
  }

  function syncBuildingUI() {
    const needsBuilding = BUILDING_TYPES.has(currentType);
    elBuildingSelect.disabled = !needsBuilding;

    if (!needsBuilding) {
      elBuildingSelect.innerHTML = `<option value="">(건물 선택 없음)</option>`;
      elBuildingInfo.innerHTML = `<div class="small">* 토지/공장창고는 건물 선택이 필요 없습니다.</div>`;
      return;
    }

    const buildings = DataUtil.getBuildings().filter(b => b.type === currentType);
    elBuildingSelect.innerHTML = `<option value="">건물 선택</option>`;
    buildings.forEach(b => {
      const opt = document.createElement("option");
      opt.value = b.id;
      opt.textContent = b.name;
      elBuildingSelect.appendChild(opt);
    });

    renderBuildingInfo();
  }

  function renderBuildingInfo() {
    const id = elBuildingSelect.value;
    if (!id) { elBuildingInfo.innerHTML = ""; return; }
    const b = DataUtil.findBuildingById(id);
    if (!b) return;

    elBuildingInfo.innerHTML = `
      <div class="readonly-box">
        <b>${esc(b.name)}</b><br/>
        ${esc(b.address || "")}<br/>
        사용승인: ${esc(b.approved || "-")}<br/>
        규모: ${esc(b.scale || "-")}<br/>
        주차: ${esc(b.parking || "-")} · 엘리베이터: ${esc(b.elevator || "-")}
      </div>`;
  }

  function renderDynamicFields(type) {
    elDynamic.innerHTML = "";
    if (type === "shop") return renderShop();
    if (type === "officetel") return renderOfficetel();
    if (type === "apartment") return renderApartment();
    if (type === "bizcenter") return renderBizcenter();
    if (type === "factory") return renderFactory();
    if (type.startsWith("land")) return renderLand(type);
    elDynamic.innerHTML = `<div class="small">해당 유형 폼이 준비되지 않았습니다.</div>`;
  }

  function renderShop() {
    elDynamic.innerHTML = `
      <div class="row">
        <div class="field"><label>호실</label><input id="unit" placeholder="예: 201호"/></div>
        <div class="field"><label>층</label><select id="floor"></select></div>
      </div>
      <div class="row">
        <div class="field"><label>전용면적 (㎡)</label><input id="exM2" type="number" step="0.01"/></div>
        <div class="field"><label>전용면적 (평)</label><input id="exPy" readonly/></div>
      </div>
      <div class="row">
        <div class="field"><label>분양면적 (㎡)</label><input id="suM2" type="number" step="0.01"/></div>
        <div class="field"><label>분양면적 (평)</label><input id="suPy" readonly/></div>
      </div>
      <div class="row">
        <div class="field"><label>향</label><select id="direction"></select></div>
        <div class="field"><label>현업종</label><input id="currentBiz" placeholder="예: 필라테스"/></div>
      </div>
      <div class="row">
        <div class="field"><label>보증금 (만원)</label><input id="deposit" type="number"/></div>
        <div class="field"><label>월세 (만원)</label><input id="rent" type="number"/></div>
      </div>
      <div class="row">
        <div class="field"><label>매매가 (만원)</label><input id="salePrice" type="number"/></div>
        <div class="field"><label>관리비 (만원)</label><input id="maintenance" type="number"/></div>
      </div>
      <div class="row">
        <div class="field"><label>소유주</label><input id="ownerName"/></div>
        <div class="field"><label>소유주 연락처</label><input id="ownerPhone" placeholder="010-0000-0000"/></div>
      </div>
      <div class="row">
        <div class="field"><label>임차인</label><input id="tenantName"/></div>
        <div class="field"><label>임차인 연락처</label><input id="tenantPhone" placeholder="010-0000-0000"/></div>
      </div>
      <div class="field"><label>계약만료일</label><input id="leaseEnd" type="date"/></div>
      <div class="row">
        <div class="field"><label>부가세(VAT)</label>
          <select id="vatMode"><option>별도</option><option>포함</option><option>해당없음</option></select>
        </div>
        <div class="field"><label>VAT 세율(%)</label><input id="vatRate" type="number" value="10"/></div>
      </div>`;

    const floorSel = $("floor");
    SHOP_FLOORS.forEach(f => { const o = document.createElement("option"); o.value = f; o.textContent = f; floorSel.appendChild(o); });
    const dirSel = $("direction");
    DIRECTIONS.forEach(d => { const o = document.createElement("option"); o.value = d; o.textContent = d; dirSel.appendChild(o); });
    bindM2ToPy("exM2", "exPy");
    bindM2ToPy("suM2", "suPy");
  }

  function renderOfficetel() {
    elDynamic.innerHTML = `
      <div class="row">
        <div class="field"><label>동(선택)</label><input id="dong" placeholder="예: A동"/></div>
        <div class="field"><label>호수</label><input id="ho" placeholder="예: 1502호"/></div>
      </div>
      <div class="row">
        <div class="field"><label>층</label><input id="floorTxt" placeholder="예: 15"/></div>
        <div class="field"><label>전체층</label><input id="totalFloors" placeholder="예: 29"/></div>
      </div>
      <div class="row">
        <div class="field"><label>전용면적 (㎡)</label><input id="exM2" type="number" step="0.01"/></div>
        <div class="field"><label>전용면적 (평)</label><input id="exPy" readonly/></div>
      </div>
      <div class="row">
        <div class="field"><label>분양면적 (㎡)</label><input id="suM2" type="number" step="0.01"/></div>
        <div class="field"><label>분양면적 (평)</label><input id="suPy" readonly/></div>
      </div>
      <div class="row">
        <div class="field"><label>향</label><select id="direction"></select></div>
        <div class="field"><label>관리비 (만원)</label><input id="maintenance" type="number"/></div>
      </div>
      <div class="row">
        <div class="field"><label>매매가 (만원)</label><input id="salePrice" type="number"/></div>
        <div class="field"><label>전세가 (만원)</label><input id="jeonsePrice" type="number"/></div>
      </div>
      <div class="row">
        <div class="field"><label>보증금 (만원)</label><input id="deposit" type="number"/></div>
        <div class="field"><label>월세 (만원)</label><input id="rent" type="number"/></div>
      </div>
      <div class="row">
        <div class="field"><label>소유주</label><input id="ownerName"/></div>
        <div class="field"><label>소유주 연락처</label><input id="ownerPhone" placeholder="010-0000-0000"/></div>
      </div>
      <div class="row">
        <div class="field"><label>임차인</label><input id="tenantName"/></div>
        <div class="field"><label>임차인 연락처</label><input id="tenantPhone" placeholder="010-0000-0000"/></div>
      </div>
      <div class="row">
        <div class="field"><label>부가세(VAT)</label>
          <select id="vatMode"><option>해당없음</option><option>별도</option><option>포함</option></select>
        </div>
        <div class="field"><label>VAT 세율(%)</label><input id="vatRate" type="number" value="10"/></div>
      </div>`;

    const dirSel = $("direction");
    DIRECTIONS.forEach(d => { const o = document.createElement("option"); o.value = d; o.textContent = d; dirSel.appendChild(o); });
    bindM2ToPy("exM2", "exPy");
    bindM2ToPy("suM2", "suPy");
  }

  function renderApartment() {
    elDynamic.innerHTML = `
      <div class="row">
        <div class="field"><label>동</label><input id="dong" placeholder="예: 105동"/></div>
        <div class="field"><label>호수</label><input id="ho" placeholder="예: 902호"/></div>
      </div>
      <div class="row">
        <div class="field"><label>층</label><input id="floorTxt" placeholder="예: 9"/></div>
        <div class="field"><label>전체층</label><input id="totalFloors" placeholder="예: 29"/></div>
      </div>
      <div class="row">
        <div class="field"><label>전용면적 (㎡)</label><input id="exM2" type="number" step="0.01"/></div>
        <div class="field"><label>전용면적 (평)</label><input id="exPy" readonly/></div>
      </div>
      <div class="row">
        <div class="field"><label>분양면적 (㎡)</label><input id="suM2" type="number" step="0.01"/></div>
        <div class="field"><label>분양면적 (평)</label><input id="suPy" readonly/></div>
      </div>
      <div class="row">
        <div class="field"><label>타입</label><input id="aptType" placeholder="예: 84A"/></div>
        <div class="field"><label>향</label><select id="direction"></select></div>
      </div>
      <div class="row">
        <div class="field"><label>매매가 (만원)</label><input id="salePrice" type="number"/></div>
        <div class="field"><label>전세가 (만원)</label><input id="jeonsePrice" type="number"/></div>
      </div>
      <div class="row">
        <div class="field"><label>보증금 (만원)</label><input id="deposit" type="number"/></div>
        <div class="field"><label>월세 (만원)</label><input id="rent" type="number"/></div>
      </div>
      <div class="row">
        <div class="field"><label>소유주</label><input id="ownerName"/></div>
        <div class="field"><label>소유주 연락처</label><input id="ownerPhone" placeholder="010-0000-0000"/></div>
      </div>
      <div class="row">
        <div class="field"><label>임차인</label><input id="tenantName"/></div>
        <div class="field"><label>임차인 연락처</label><input id="tenantPhone" placeholder="010-0000-0000"/></div>
      </div>`;

    const dirSel = $("direction");
    DIRECTIONS.forEach(d => { const o = document.createElement("option"); o.value = d; o.textContent = d; dirSel.appendChild(o); });
    bindM2ToPy("exM2", "exPy");
    bindM2ToPy("suM2", "suPy");
  }

  function renderBizcenter() {
    elDynamic.innerHTML = `
      <div class="row">
        <div class="field"><label>호실</label><input id="unit" placeholder="예: A-1203"/></div>
        <div class="field"><label>층</label><input id="floorTxt" placeholder="예: 12F"/></div>
      </div>
      <div class="row">
        <div class="field"><label>전용면적 (㎡)</label><input id="exM2" type="number" step="0.01"/></div>
        <div class="field"><label>전용면적 (평)</label><input id="exPy" readonly/></div>
      </div>
      <div class="row">
        <div class="field"><label>분양면적 (㎡)</label><input id="suM2" type="number" step="0.01"/></div>
        <div class="field"><label>분양면적 (평)</label><input id="suPy" readonly/></div>
      </div>
      <div class="row">
        <div class="field"><label>보증금 (만원)</label><input id="deposit" type="number"/></div>
        <div class="field"><label>월세 (만원)</label><input id="rent" type="number"/></div>
      </div>
      <div class="row">
        <div class="field"><label>매매가 (만원)</label><input id="salePrice" type="number"/></div>
        <div class="field"><label>관리비 (만원)</label><input id="maintenance" type="number"/></div>
      </div>
      <div class="row">
        <div class="field"><label>소유주</label><input id="ownerName"/></div>
        <div class="field"><label>소유주 연락처</label><input id="ownerPhone" placeholder="010-0000-0000"/></div>
      </div>`;

    bindM2ToPy("exM2", "exPy");
    bindM2ToPy("suM2", "suPy");
  }

  function renderLand(type) {
    elDynamic.innerHTML = `
      ${type === "land_single" ? `
        <div class="row">
          <div class="field"><label>블럭주소</label><input id="blockAddress" placeholder="예: A-12블럭"/></div>
          <div class="field"><label>종류</label><input id="houseType" placeholder="예: 전용주거/점포주택"/></div>
        </div>` : ""}
      ${type === "land_dev" ? `
        <div class="field"><label>사용용도</label><input id="devUsage" placeholder="예: 상가/오피스텔/복합"/></div>` : ""}
      <div class="row">
        <div class="field"><label>토지면적 (㎡)</label><input id="landM2" type="number" step="0.01"/></div>
        <div class="field"><label>토지면적 (평)</label><input id="landPy" readonly/></div>
      </div>
      <div class="row">
        <div class="field"><label>지목</label><input id="landJimo" placeholder="예: 대/전/답"/></div>
        <div class="field"><label>용도지역</label><input id="landUseZone" placeholder="예: 2종일반주거"/></div>
      </div>
      <div class="row">
        <div class="field"><label>건폐율(%)</label><input id="coverage" type="number" step="0.1"/></div>
        <div class="field"><label>용적률(%)</label><input id="far" type="number" step="0.1"/></div>
      </div>
      <div class="row">
        <div class="field"><label>도로접합</label><input id="roadAccess" placeholder="예: 6m 도로"/></div>
        <div class="field"><label>형상</label><input id="shape" placeholder="예: 사각형"/></div>
      </div>
      <div class="field"><label>매매가 (만원)</label><input id="salePrice" type="number"/></div>
      <div class="row">
        <div class="field"><label>소유주</label><input id="ownerName"/></div>
        <div class="field"><label>연락처</label><input id="ownerPhone" placeholder="010-0000-0000"/></div>
      </div>
      <div class="field">
        <label>자료 URL</label>
        <div id="attachments" class="attach-list"></div>
        <button class="btn" type="button" id="addAttach">+ 추가</button>
      </div>`;

    bindM2ToPy("landM2", "landPy");
    bindAttachments();
  }

  function renderFactory() {
    elDynamic.innerHTML = `
      <div class="row">
        <div class="field"><label>단지명</label><input id="complexName" placeholder="예: 파주 ○○산단"/></div>
        <div class="field"><label>진입로</label><input id="accessRoad" placeholder="예: 대형차 진입"/></div>
      </div>
      <div class="row">
        <div class="field"><label>대지면적 (㎡)</label><input id="landM2" type="number" step="0.01"/></div>
        <div class="field"><label>대지면적 (평)</label><input id="landPy" readonly/></div>
      </div>
      <div class="row">
        <div class="field"><label>건축면적 (㎡)</label><input id="bldM2" type="number" step="0.01"/></div>
        <div class="field"><label>건축면적 (평)</label><input id="bldPy" readonly/></div>
      </div>
      <div class="row">
        <div class="field"><label>층고(m)</label><input id="clearHeight" type="number" step="0.1"/></div>
        <div class="field"><label>전력(kW)</label><input id="powerKw" type="number" step="1"/></div>
      </div>
      <div class="row">
        <div class="field"><label>보증금 (만원)</label><input id="deposit" type="number"/></div>
        <div class="field"><label>월세 (만원)</label><input id="rent" type="number"/></div>
      </div>
      <div class="field"><label>매매가 (만원)</label><input id="salePrice" type="number"/></div>
      <div class="row">
        <div class="field"><label>소유주</label><input id="ownerName"/></div>
        <div class="field"><label>연락처</label><input id="ownerPhone" placeholder="010-0000-0000"/></div>
      </div>
      <div class="field">
        <label>자료 URL</label>
        <div id="attachments" class="attach-list"></div>
        <button class="btn" type="button" id="addAttach">+ 추가</button>
      </div>`;

    bindM2ToPy("landM2", "landPy");
    bindM2ToPy("bldM2", "bldPy");
    bindAttachments();
  }

  function bindM2ToPy(m2Id, pyId) {
    const m2 = $(m2Id), py = $(pyId);
    if (!m2 || !py) return;
    const sync = () => { py.value = m2.value ? DataUtil.toPy(m2.value) : ""; };
    m2.addEventListener("input", sync);
    sync();
  }

  function bindAttachments() {
    const wrap = $("attachments"), btn = $("addAttach");
    if (!wrap || !btn) return;
    addAttachRow(wrap);
    btn.onclick = () => addAttachRow(wrap);
  }

  function addAttachRow(wrap) {
    const row = document.createElement("div");
    row.className = "attach-item";
    row.innerHTML = `
      <input placeholder="라벨(예: 지적도)"/>
      <input placeholder="URL"/>
      <button class="btn danger" type="button">삭제</button>`;
    row.querySelector("button").onclick = () => row.remove();
    wrap.appendChild(row);
  }

  function saveListing() {
    const record = {
      id: DataUtil.newListingId(),
      type: currentType,
      title: DataUtil.cleanText($("title").value),
      address: DataUtil.cleanText($("address").value),
      dealType: elDealType.value,
      status: elStatus.value,
      isListed: elIsListed.checked,
      memo: DataUtil.cleanText($("memo").value),
      createdAt: DataUtil.nowISO(),
      updatedAt: DataUtil.nowISO(),
    };

    if (record.status === "완료") record.isListed = false;

    if (BUILDING_TYPES.has(currentType)) {
      record.buildingId = elBuildingSelect.value || "";
      record.buildingName = elBuildingSelect.selectedOptions[0]?.textContent || "";

      // ✅ 주소 자동 주입: 주소칸을 안 적었으면 건물마스터 주소로 채움
  if (!record.address && record.buildingId) {
    const b = DataUtil.findBuildingById(record.buildingId);
    if (b?.address) record.address = b.address;
  }
    } else {
      record.buildingId = "";
      record.buildingName = "";
    }

    if (currentType === "shop") fillShop(record);
    else if (currentType === "officetel") fillOfficetel(record);
    else if (currentType === "apartment") fillApartment(record);
    else if (currentType === "bizcenter") fillBizcenter(record);
    else if (currentType === "factory") fillFactory(record);
    else if (currentType.startsWith("land")) fillLand(record);

    DataUtil.upsertListing(record);
    alert("저장 완료");
    location.href = "index.html";
  }

  function fillShop(r) {
    r.unit = DataUtil.cleanText($("unit").value);
    r.floor = $("floor").value;
    r.direction = $("direction").value;
    r.currentBiz = DataUtil.cleanText($("currentBiz").value);
    r.areaExclusiveM2 = num($("exM2").value);
    r.areaExclusivePy = num($("exPy").value);
    r.areaSupplyM2 = num($("suM2").value);
    r.areaSupplyPy = num($("suPy").value);
    r.depositManwon = num($("deposit").value);
    r.rentManwon = num($("rent").value);
    r.salePriceManwon = num($("salePrice").value);
    r.maintenanceFeeManwon = num($("maintenance").value);
    r.ownerName = DataUtil.cleanText($("ownerName").value);
    r.ownerPhone = DataUtil.cleanText($("ownerPhone").value);
    r.tenantName = DataUtil.cleanText($("tenantName").value);
    r.tenantPhone = DataUtil.cleanText($("tenantPhone").value);
    r.leaseEnd = $("leaseEnd").value || "";
    r.vatMode = $("vatMode").value;
    r.vatRate = num($("vatRate").value) || 10;
  }

  function fillOfficetel(r) {
    r.dong = DataUtil.cleanText($("dong").value);
    r.ho = DataUtil.cleanText($("ho").value);
    r.floor = DataUtil.cleanText($("floorTxt").value);
    r.totalFloors = DataUtil.cleanText($("totalFloors").value);
    r.direction = $("direction").value;
    r.areaExclusiveM2 = num($("exM2").value);
    r.areaExclusivePy = num($("exPy").value);
    r.areaSupplyM2 = num($("suM2").value);
    r.areaSupplyPy = num($("suPy").value);
    r.maintenanceFeeManwon = num($("maintenance").value);
    r.salePriceManwon = num($("salePrice").value);
    r.jeonsePriceManwon = num($("jeonsePrice").value);
    r.depositManwon = num($("deposit").value);
    r.rentManwon = num($("rent").value);
    r.ownerName = DataUtil.cleanText($("ownerName").value);
    r.ownerPhone = DataUtil.cleanText($("ownerPhone").value);
    r.tenantName = DataUtil.cleanText($("tenantName").value);
    r.tenantPhone = DataUtil.cleanText($("tenantPhone").value);
    r.vatMode = $("vatMode").value;
    r.vatRate = num($("vatRate").value) || 10;
  }

  function fillApartment(r) {
    r.dong = DataUtil.cleanText($("dong").value);
    r.ho = DataUtil.cleanText($("ho").value);
    r.floor = DataUtil.cleanText($("floorTxt").value);
    r.totalFloors = DataUtil.cleanText($("totalFloors").value);
    r.aptType = DataUtil.cleanText($("aptType").value);
    r.direction = $("direction").value;
    r.areaExclusiveM2 = num($("exM2").value);
    r.areaExclusivePy = num($("exPy").value);
    r.areaSupplyM2 = num($("suM2").value);
    r.areaSupplyPy = num($("suPy").value);
    r.salePriceManwon = num($("salePrice").value);
    r.jeonsePriceManwon = num($("jeonsePrice").value);
    r.depositManwon = num($("deposit").value);
    r.rentManwon = num($("rent").value);
    r.ownerName = DataUtil.cleanText($("ownerName").value);
    r.ownerPhone = DataUtil.cleanText($("ownerPhone").value);
    r.tenantName = DataUtil.cleanText($("tenantName").value);
    r.tenantPhone = DataUtil.cleanText($("tenantPhone").value);
  }

  function fillBizcenter(r) {
    r.unit = DataUtil.cleanText($("unit").value);
    r.floor = DataUtil.cleanText($("floorTxt").value);
    r.areaExclusiveM2 = num($("exM2").value);
    r.areaExclusivePy = num($("exPy").value);
    r.areaSupplyM2 = num($("suM2").value);
    r.areaSupplyPy = num($("suPy").value);
    r.depositManwon = num($("deposit").value);
    r.rentManwon = num($("rent").value);
    r.salePriceManwon = num($("salePrice").value);
    r.maintenanceFeeManwon = num($("maintenance").value);
    r.ownerName = DataUtil.cleanText($("ownerName").value);
    r.ownerPhone = DataUtil.cleanText($("ownerPhone").value);
  }

  function fillLand(r) {
    r.landAreaM2 = num($("landM2").value);
    r.landAreaPy = num($("landPy").value);
    r.landJimo = DataUtil.cleanText($("landJimo").value);
    r.landUseZone = DataUtil.cleanText($("landUseZone").value);
    r.coverageRatio = num($("coverage").value);
    r.farRatio = num($("far").value);
    r.roadAccess = DataUtil.cleanText($("roadAccess").value);
    r.shape = DataUtil.cleanText($("shape").value);
    r.salePriceManwon = num($("salePrice").value);
    r.ownerName = DataUtil.cleanText($("ownerName").value);
    r.ownerPhone = DataUtil.cleanText($("ownerPhone").value);
    if (r.type === "land_single") {
      r.blockAddress = DataUtil.cleanText($("blockAddress").value);
      r.houseType = DataUtil.cleanText($("houseType").value);
    }
    if (r.type === "land_dev") {
      r.devUsage = DataUtil.cleanText($("devUsage").value);
    }
    r.attachments = collectAttachments();
  }

  function fillFactory(r) {
    r.complexName = DataUtil.cleanText($("complexName").value);
    r.accessRoad = DataUtil.cleanText($("accessRoad").value);
    r.landAreaM2 = num($("landM2").value);
    r.landAreaPy = num($("landPy").value);
    r.buildingAreaM2 = num($("bldM2").value);
    r.buildingAreaPy = num($("bldPy").value);
    r.clearHeightM = num($("clearHeight").value);
    r.powerKw = num($("powerKw").value);
    r.depositManwon = num($("deposit").value);
    r.rentManwon = num($("rent").value);
    r.salePriceManwon = num($("salePrice").value);
    r.ownerName = DataUtil.cleanText($("ownerName").value);
    r.ownerPhone = DataUtil.cleanText($("ownerPhone").value);
    r.attachments = collectAttachments();
  }

  function collectAttachments() {
    const arr = [];
    document.querySelectorAll("#attachments .attach-item").forEach(row => {
      const label = row.children[0].value.trim();
      const url = row.children[1].value.trim();
      if (url) arr.push({ label, url });
    });
    return arr;
  }

  function num(v) {
    const n = Number(String(v ?? "").trim());
    return Number.isFinite(n) ? n : 0;
  }

  function esc(s) {
    return String(s ?? "").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;");
  }

})();
