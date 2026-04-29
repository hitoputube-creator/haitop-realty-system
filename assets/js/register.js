// assets/js/register.js
(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);

  const elTypeSelect = $("typeSelect");
  const elBuildingSelect = $("buildingSelect");
  const elBuildingInfo = $("buildingInfo");
  const elBuildingWrap = $("buildingFieldWrap");
  const elDynamic = $("dynamicFields");
  const elDealType = $("dealType");
  const elStatus = $("status");
  const elIsListed = $("isListed");
  const elSave = $("btnSave");

  const elLinkedCustomer = $("linkedCustomer");
  const elMemoList = $("memoList");
  const elAddMemo = $("btnAddMemo");

  let currentType = elTypeSelect.value || "shop";

  const BUILDING_TYPES = new Set(["shop", "officetel", "apartment", "bizcenter"]);
  const SHOP_FLOORS = DataUtil.SHOP_FLOORS;
  const DIRECTIONS = DataUtil.DIRECTIONS;

  const FLOOR_GROUPS = ["1층", "2층", "상층부"]; // 요청사항 기준

  const qs = new URLSearchParams(location.search);
  const editId = qs.get("id");
  let editingListing = null;

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

    // 메모(추가형)
    if (elAddMemo) {
      elAddMemo.addEventListener("click", () => addMemoRow("", ""));
      // 기본 1줄
      addMemoRow(todayStr(), "");
    }

    loadCustomerOptions();
    syncBuildingUI();
    renderDynamicFields(currentType);

    // 수정 모드
    if (editId) {
      editingListing = DataUtil.getListings().find(x => x.id === editId) || null;
      if (editingListing) loadListingToForm(editingListing);
      else alert("수정할 매물을 찾을 수 없습니다.");
    }
  }

  function loadCustomerOptions() {
    if (!elLinkedCustomer) return;
    const customers = StorageUtil.getArray("customers");
    elLinkedCustomer.innerHTML = `<option value="">-- 고객 연결 안 함 --</option>`;
    customers.forEach(c => {
      const o = document.createElement("option");
      o.value = c.id;
      o.textContent = `${c.name}${c.phone ? " (" + c.phone + ")" : ""}${c.role ? " [" + c.role + "]" : ""}`;
      elLinkedCustomer.appendChild(o);
    });
  }

  function syncBuildingUI() {
    const needsBuilding = BUILDING_TYPES.has(currentType);
    if (elBuildingWrap) elBuildingWrap.style.display = needsBuilding ? "block" : "none";
    elBuildingSelect.disabled = !needsBuilding;

    if (!needsBuilding) {
      elBuildingSelect.innerHTML = `<option value="">(건물 선택 없음)</option>`;
      elBuildingInfo.innerHTML = "";
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

    const scaleTxt = b.scale || makeScaleText(b.scaleB, b.scaleG);

    elBuildingInfo.innerHTML = `
      <div class="readonly-box">
        <b>${esc(b.name)}</b><br/>
        ${esc(b.address || "")}<br/>
        사용승인: ${esc(b.approved || "-")}<br/>
        규모: ${esc(scaleTxt || "-")}<br/>
        주차: ${esc(b.parking || "-")}
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
        <div class="field"><label>층수(필터용)</label><select id="floorGroup"></select></div>
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

    const fg = $("floorGroup");
    FLOOR_GROUPS.forEach(v => { const o = document.createElement("option"); o.value = v; o.textContent = v; fg.appendChild(o); });
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
        <div class="field"><label>타입</label><input id="otType" placeholder="예: A타입 / 84A"/></div>
        <div class="field"><label>방수</label><input id="rooms" type="number" min="0" step="1" placeholder="예: 1"/></div>
      </div>
      <div class="row">
        <div class="field"><label>층수(필터용)</label><select id="floorGroup"></select></div>
        <div class="field"><label>관리비 (만원)</label><input id="maintenance" type="number"/></div>
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
        <div class="field"></div>
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
    const fg = $("floorGroup");
    FLOOR_GROUPS.forEach(v => { const o = document.createElement("option"); o.value = v; o.textContent = v; fg.appendChild(o); });
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
        <div class="field"><label>층수(필터용)</label><select id="floorGroup"></select></div>
        <div class="field"></div>
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
    const fg = $("floorGroup");
    FLOOR_GROUPS.forEach(v => { const o = document.createElement("option"); o.value = v; o.textContent = v; fg.appendChild(o); });
    bindM2ToPy("exM2", "exPy");
    bindM2ToPy("suM2", "suPy");
  }

  function renderBizcenter() {
    elDynamic.innerHTML = `
      <div class="row">
        <div class="field"><label>호실</label><input id="unit" placeholder="예: A-1203"/></div>
        <div class="field"><label>층수(필터용)</label><select id="floorGroup"></select></div>
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

    const fg = $("floorGroup");
    FLOOR_GROUPS.forEach(v => { const o = document.createElement("option"); o.value = v; o.textContent = v; fg.appendChild(o); });
    bindM2ToPy("exM2", "exPy");
    bindM2ToPy("suM2", "suPy");
  }

  function renderLand(type) {
    elDynamic.innerHTML = `
      <div class="field"><label>소재지(주소)</label><input id="locAddress" placeholder="예: 파주시 ○○읍 ○○리"/></div>
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
      <div class="field"><label>소재지(주소)</label><input id="locAddress" placeholder="예: 파주시 ○○읍 ○○리"/></div>
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
    const isEdit = !!editingListing;
    const record = {
      id: isEdit ? editingListing.id : DataUtil.newListingId(),
      type: currentType,
      dealType: elDealType.value,
      status: elStatus.value,
      isListed: elIsListed.checked,
      memoEntries: collectMemos(),
      memo: memoSummary(collectMemos()),
      createdAt: isEdit ? (editingListing.createdAt || DataUtil.nowISO()) : DataUtil.nowISO(),
      updatedAt: DataUtil.nowISO(),
    };

    if (record.status === "완료") record.isListed = false;

    if (BUILDING_TYPES.has(currentType)) {
      record.buildingId = elBuildingSelect.value || "";
      record.buildingName = elBuildingSelect.selectedOptions[0]?.textContent || "";

      // ✅ 주소는 건물마스터 주소로 자동 세팅
      const b = record.buildingId ? DataUtil.findBuildingById(record.buildingId) : null;
      record.address = b?.address || "";
    } else {
      record.buildingId = "";
      record.buildingName = "";
      record.address = DataUtil.cleanText($("locAddress")?.value);
    }

    if (currentType === "shop") fillShop(record);
    else if (currentType === "officetel") fillOfficetel(record);
    else if (currentType === "apartment") fillApartment(record);
    else if (currentType === "bizcenter") fillBizcenter(record);
    else if (currentType === "factory") fillFactory(record);
    else if (currentType.startsWith("land")) fillLand(record);

    // 제목 입력칸은 없지만, 내부 표시/검색 호환을 위해 자동 생성
    record.title = makeAutoTitle(record);
    record.descChecks = collectDescChecks();
    record.customerId = elLinkedCustomer ? (elLinkedCustomer.value || "") : "";

    // 거래완료 시 연결된 고객에 자동 메모 추가
    if (record.status === "완료" && record.customerId) {
      const customers = StorageUtil.getArray("customers");
      const idx = customers.findIndex(c => c.id === record.customerId);
      if (idx >= 0) {
        const prevStatus = editingListing ? editingListing.status : "";
        // 이미 완료였던 매물을 재저장하는 경우엔 중복 메모 방지
        if (prevStatus !== "완료") {
          customers[idx].notes = Array.isArray(customers[idx].notes) ? customers[idx].notes : [];
          customers[idx].notes.unshift({
            id: StorageUtil.uid("n"),
            date: todayStr(),
            text: `거래완료 - ${record.title || record.buildingName || "매물"} (${record.dealType || ""})`,
          });
          customers[idx].updatedAt = new Date().toISOString();
          StorageUtil.setArray("customers", customers);
        }
      }
    }

    DataUtil.upsertListing(record);
    alert("저장 완료");
    location.href = "index.html";
  }

  function fillShop(r) {
    r.unit = DataUtil.cleanText($("unit").value);
    r.floorGroup = $("floorGroup").value;
    // 건물 평면도 자동 연결을 위해 최소한의 층 키를 저장(1F/2F/3F)
    r.floor = floorKeyFromGroup(r.floorGroup);
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
    r.otType = DataUtil.cleanText($("otType").value);
    r.rooms = num($("rooms").value);
    r.floorGroup = $("floorGroup").value;
    r.floor = r.floorGroup; // 호환용
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
    r.floorGroup = $("floorGroup").value;
    r.floor = r.floorGroup; // 호환용
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
    r.floorGroup = $("floorGroup").value;
    r.floor = r.floorGroup; // 호환용
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
    r.address = DataUtil.cleanText($("locAddress")?.value);
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
    r.address = DataUtil.cleanText($("locAddress")?.value);
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

  function collectDescChecks() {
    const dc = {};
    ["location","demand","strength","notes"].forEach(function(k){
      const cb = $("desc_"+k);
      const ta = $("desc_"+k+"_text");
      dc[k] = cb ? cb.checked : false;
      dc[k+"Text"] = ta ? (ta.value || "").trim() : "";
    });
    return dc;
  }

  function toggleDescArea(k) {
    const cb = $("desc_"+k);
    const ta = $("desc_"+k+"_text");
    if (ta) ta.style.display = (cb && cb.checked) ? "block" : "none";
  }

  function addMemoRow(date, text) {
    if (!elMemoList) return;
    const row = document.createElement("div");
    row.className = "attach-item";
    row.innerHTML = `
      <input class="memo-date" type="date" value="${escAttr(date)}"/>
      <input class="memo-text" placeholder="메모" value="${escAttr(text)}"/>
      <button class="btn danger" type="button">삭제</button>
    `;
    row.querySelector("button").onclick = () => row.remove();
    elMemoList.appendChild(row);
  }

  function collectMemos() {
    const arr = [];
    if (!elMemoList) return arr;
    elMemoList.querySelectorAll(".attach-item").forEach((row) => {
      const d = row.querySelector(".memo-date")?.value || "";
      const t = (row.querySelector(".memo-text")?.value || "").trim();
      if (t) arr.push({ date: d || todayStr(), text: t });
    });
    // 최신순
    arr.sort((a,b) => String(b.date).localeCompare(String(a.date)));
    return arr;
  }

  function memoSummary(entries) {
    const e = Array.isArray(entries) ? entries[0] : null;
    return e?.text ? e.text : "";
  }

  function todayStr() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth()+1).padStart(2,"0");
    const da = String(d.getDate()).padStart(2,"0");
    return `${y}-${m}-${da}`;
  }

  function makeScaleText(b, g) {
    const bb = Number(b) ? `지하${b}층` : "지하0층";
    const gg = Number(g) ? `지상${g}층` : "지상0층";
    return `${bb} / ${gg}`;
  }

  function makeAutoTitle(r) {
    // 입력칸은 없지만 내부 호환을 위한 자동 제목
    const parts = [];
    if (r.buildingName) parts.push(r.buildingName);
    if (r.unit) parts.push(r.unit);
    if (r.ho) parts.push(r.ho);
    if (r.currentBiz) parts.push(r.currentBiz);
    if (!parts.length && r.address) parts.push(r.address);
    return parts.join(" ").trim();
  }

  function loadListingToForm(x) {
    // 유형
    elTypeSelect.value = x.type;
    currentType = x.type;
    syncBuildingUI();
    renderDynamicFields(currentType);

    // 공통
    elDealType.value = x.dealType || "매매";
    elStatus.value = x.status || "거래가능";
    elIsListed.checked = !!x.isListed;

    // 건물
    if (BUILDING_TYPES.has(currentType)) {
      elBuildingSelect.value = x.buildingId || "";
      renderBuildingInfo();
    }

    // 메모
    if (elMemoList) {
      elMemoList.innerHTML = "";
      const entries = Array.isArray(x.memoEntries) && x.memoEntries.length
        ? x.memoEntries
        : (x.memo ? [{ date: todayStr(), text: x.memo }] : []);
      if (entries.length) entries.slice().reverse().forEach(e => addMemoRow(e.date || todayStr(), e.text || ""));
      else addMemoRow(todayStr(), "");
    }

    // 유형별
    if (currentType === "shop") {
      if ($("unit")) $("unit").value = x.unit || "";
      if ($("floorGroup")) $("floorGroup").value = x.floorGroup || guessFloorGroup(x.floor);
      if ($("direction")) $("direction").value = x.direction || "확인중";
      if ($("currentBiz")) $("currentBiz").value = x.currentBiz || "";
      setNum("exM2", x.areaExclusiveM2);
      setNum("suM2", x.areaSupplyM2);
      setNum("deposit", x.depositManwon);
      setNum("rent", x.rentManwon);
      setNum("salePrice", x.salePriceManwon);
      setNum("maintenance", x.maintenanceFeeManwon);
      setVal("ownerName", x.ownerName);
      setVal("ownerPhone", x.ownerPhone);
      setVal("tenantName", x.tenantName);
      setVal("tenantPhone", x.tenantPhone);
      setVal("leaseEnd", x.leaseEnd);
      setVal("vatMode", x.vatMode);
      setNum("vatRate", x.vatRate);
    }

    if (currentType === "officetel") {
      setVal("dong", x.dong);
      setVal("ho", x.ho);
      setVal("otType", x.otType);
      setNum("rooms", x.rooms);
      if ($("floorGroup")) $("floorGroup").value = x.floorGroup || guessFloorGroup(x.floor);
      if ($("direction")) $("direction").value = x.direction || "확인중";
      setNum("exM2", x.areaExclusiveM2);
      setNum("suM2", x.areaSupplyM2);
      setNum("maintenance", x.maintenanceFeeManwon);
      setNum("salePrice", x.salePriceManwon);
      setNum("jeonsePrice", x.jeonsePriceManwon);
      setNum("deposit", x.depositManwon);
      setNum("rent", x.rentManwon);
      setVal("ownerName", x.ownerName);
      setVal("ownerPhone", x.ownerPhone);
      setVal("tenantName", x.tenantName);
      setVal("tenantPhone", x.tenantPhone);
      setVal("vatMode", x.vatMode);
      setNum("vatRate", x.vatRate);
    }

    if (currentType === "apartment") {
      setVal("dong", x.dong);
      setVal("ho", x.ho);
      if ($("floorGroup")) $("floorGroup").value = x.floorGroup || guessFloorGroup(x.floor);
      setVal("aptType", x.aptType);
      if ($("direction")) $("direction").value = x.direction || "확인중";
      setNum("exM2", x.areaExclusiveM2);
      setNum("suM2", x.areaSupplyM2);
      setNum("salePrice", x.salePriceManwon);
      setNum("jeonsePrice", x.jeonsePriceManwon);
      setNum("deposit", x.depositManwon);
      setNum("rent", x.rentManwon);
      setVal("ownerName", x.ownerName);
      setVal("ownerPhone", x.ownerPhone);
      setVal("tenantName", x.tenantName);
      setVal("tenantPhone", x.tenantPhone);
    }

    if (currentType === "bizcenter") {
      setVal("unit", x.unit);
      if ($("floorGroup")) $("floorGroup").value = x.floorGroup || guessFloorGroup(x.floor);
      setNum("exM2", x.areaExclusiveM2);
      setNum("suM2", x.areaSupplyM2);
      setNum("deposit", x.depositManwon);
      setNum("rent", x.rentManwon);
      setNum("salePrice", x.salePriceManwon);
      setNum("maintenance", x.maintenanceFeeManwon);
      setVal("ownerName", x.ownerName);
      setVal("ownerPhone", x.ownerPhone);
    }

    if (currentType.startsWith("land")) {
      setVal("locAddress", x.address);
      setVal("blockAddress", x.blockAddress);
      setVal("houseType", x.houseType);
      setVal("devUsage", x.devUsage);
      setNum("landM2", x.landAreaM2);
      setVal("landJimo", x.landJimo);
      setVal("landUseZone", x.landUseZone);
      setNum("coverage", x.coverageRatio);
      setNum("far", x.farRatio);
      setVal("roadAccess", x.roadAccess);
      setVal("shape", x.shape);
      setNum("salePrice", x.salePriceManwon);
      setVal("ownerName", x.ownerName);
      setVal("ownerPhone", x.ownerPhone);
      // attachments
      if (Array.isArray(x.attachments) && x.attachments.length) {
        const wrap = $("attachments");
        if (wrap) {
          wrap.innerHTML = "";
          x.attachments.forEach(a => {
            const row = document.createElement("div");
            row.className = "attach-item";
            row.innerHTML = `
              <input placeholder="라벨(예: 지적도)" value="${escAttr(a.label||"")}"/>
              <input placeholder="URL" value="${escAttr(a.url||"")}"/>
              <button class="btn danger" type="button">삭제</button>`;
            row.querySelector("button").onclick = () => row.remove();
            wrap.appendChild(row);
          });
        }
      }
    }

    if (currentType === "factory") {
      setVal("locAddress", x.address);
      setVal("complexName", x.complexName);
      setVal("accessRoad", x.accessRoad);
      setNum("landM2", x.landAreaM2);
      setNum("bldM2", x.buildingAreaM2);
      setNum("clearHeight", x.clearHeightM);
      setNum("powerKw", x.powerKw);
      setNum("deposit", x.depositManwon);
      setNum("rent", x.rentManwon);
      setNum("salePrice", x.salePriceManwon);
      setVal("ownerName", x.ownerName);
      setVal("ownerPhone", x.ownerPhone);
      if (Array.isArray(x.attachments) && x.attachments.length) {
        const wrap = $("attachments");
        if (wrap) {
          wrap.innerHTML = "";
          x.attachments.forEach(a => {
            const row = document.createElement("div");
            row.className = "attach-item";
            row.innerHTML = `
              <input placeholder="라벨(예: 지적도)" value="${escAttr(a.label||"")}"/>
              <input placeholder="URL" value="${escAttr(a.url||"")}"/>
              <button class="btn danger" type="button">삭제</button>`;
            row.querySelector("button").onclick = () => row.remove();
            wrap.appendChild(row);
          });
        }
      }
    }

    // 매물 설명 체크 복원
    if (x.descChecks) {
      const dc = x.descChecks;
      ["location","demand","strength","notes"].forEach(function(k){
        const cb = $("desc_"+k);
        const ta = $("desc_"+k+"_text");
        if (cb) cb.checked = !!dc[k];
        if (ta) ta.value = dc[k+"Text"] || "";
        if (ta) ta.style.display = dc[k] ? "block" : "none";
      });
    }

    // 연결 고객 복원
    if (elLinkedCustomer && x.customerId) {
      elLinkedCustomer.value = x.customerId;
    }

    // 화면상 평수 자동 갱신
    ["exM2","suM2","landM2","bldM2"].forEach(id => $(id)?.dispatchEvent(new Event("input")));
  }

  function setVal(id, v) {
    const el = $(id);
    if (el) el.value = v ?? "";
  }

  function setNum(id, v) {
    const el = $(id);
    if (!el) return;
    const n = Number(v);
    el.value = Number.isFinite(n) && n !== 0 ? String(n) : "";
  }

  function guessFloorGroup(floor) {
    const f = String(floor || "").toUpperCase();
    if (f === "1F" || f.includes("1")) return "1층";
    if (f === "2F" || f.includes("2")) return "2층";
    return "상층부";
  }

  function floorKeyFromGroup(g) {
    if (g === "1층") return "1F";
    if (g === "2층") return "2F";
    return "3F";
  }

  function escAttr(s) {
    return String(s ?? "").replaceAll("&","&amp;").replaceAll('"',"&quot;").replaceAll("<","&lt;").replaceAll(">","&gt;");
  }

})();
