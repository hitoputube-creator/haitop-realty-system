// assets/js/buildings.js
(function () {
  "use strict";

  const LS_KEY = "buildings";
  const SHOP_FLOORS = ["B2", "B1", "1F", "2F", "3F", "4F", "5F"];

  let currentType = "shop";
  let currentFilter = "all";
  let editId = null;

  const $ = (id) => document.getElementById(id);

  const elTabs = $("typeTabs");
  const elTypeExtra = $("typeExtra");
  const elFormTitle = $("formTitle");

  const elName = $("b_name");
  const elAddr = $("b_address");
  const elApproved = $("b_approved");
  const elScale = $("b_scale");
  const elParking = $("b_parking");
  const elElevator = $("b_elevator");

  const elList = $("buildingList");
  const elEmpty = $("empty");
  const elSearch = $("searchInput");
  const elToast = $("toast");

  function toast(msg) {
    elToast.textContent = msg;
    elToast.classList.add("show");
    clearTimeout(window.__toastTimer);
    window.__toastTimer = setTimeout(() => {
      elToast.classList.remove("show");
    }, 1600);
  }

  function getBuildings() { return StorageUtil.getArray(LS_KEY); }
  function setBuildings(arr) { StorageUtil.setArray(LS_KEY, arr); }

  function typeLabel(t) {
    if (t === "shop") return "상가";
    if (t === "officetel") return "오피스텔";
    if (t === "apartment") return "아파트";
    if (t === "bizcenter") return "지산";
    return "기타";
  }

  function normalizeName(s) { return (s || "").trim().replace(/\s+/g, " "); }

  function renderTypeExtra(type, data = null) {
    elTypeExtra.innerHTML = "";

    if (type === "shop") {
      elFormTitle.textContent = editId ? "상가 건물 수정" : "상가 건물 등록";
      const wrap = document.createElement("div");
      wrap.innerHTML = `
        <div class="row">
          <div class="field"><label>상권요약(한 줄)</label><input id="shop_summary" placeholder="예: 운정역 역세권 / 학원가" /></div>
          <div class="field"><label>관리사무소 연락처</label><input id="shop_office" /></div>
        </div>
        <div class="field"><label>건물 특징(메모)</label><textarea id="shop_note"></textarea></div>
        <div class="field"><label>층별 평면도 URL</label><div class="floorgrid" id="floorGrid"></div></div>
      `;
      elTypeExtra.appendChild(wrap);
      const grid = document.getElementById("floorGrid");
      SHOP_FLOORS.forEach((f) => {
        const key = document.createElement("div");
        key.className = "fkey";
        key.textContent = f;
        const input = document.createElement("input");
        input.id = "fp_" + f;
        input.placeholder = `${f} 평면도 URL`;
        grid.appendChild(key);
        grid.appendChild(input);
      });
      if (data) {
        $("shop_summary").value = data.shop_summary || "";
        $("shop_office").value = data.shop_office || "";
        $("shop_note").value = data.shop_note || "";
        const fp = data.floorplans || {};
        SHOP_FLOORS.forEach((f) => { if ($("fp_" + f)) $("fp_" + f).value = fp[f] || ""; });
      }
    }

    if (type === "officetel") {
      elFormTitle.textContent = editId ? "오피스텔 건물 수정" : "오피스텔 건물 등록";
      const wrap = document.createElement("div");
      wrap.innerHTML = `
        <div class="field">
          <label>호수 배치도 URL (최대 3개)</label>
          <input id="lay1" placeholder="배치도 URL 1" />
          <input id="lay2" placeholder="배치도 URL 2" />
          <input id="lay3" placeholder="배치도 URL 3" />
        </div>
      `;
      elTypeExtra.appendChild(wrap);
      if (data) {
        const lays = data.layouts || [];
        $("lay1").value = lays[0] || "";
        $("lay2").value = lays[1] || "";
        $("lay3").value = lays[2] || "";
      }
    }
  }

  function saveBuilding() {
    const name = normalizeName(elName.value);
    if (!name) { toast("건물명은 필수입니다."); return; }

    const base = {
      id: editId || StorageUtil.uid("b"),
      type: currentType, name,
      address: elAddr.value.trim(),
      approved: elApproved.value,
      scale: elScale.value.trim(),
      parking: elParking.value.trim(),
      elevator: elElevator.value.trim(),
      updatedAt: new Date().toISOString(),
    };

    let extra = {};
    if (currentType === "shop") {
      const floorplans = {};
      SHOP_FLOORS.forEach((f) => { const v = ($("fp_" + f)?.value || "").trim(); if (v) floorplans[f] = v; });
      extra = { shop_summary: $("shop_summary").value.trim(), shop_office: $("shop_office").value.trim(), shop_note: $("shop_note").value.trim(), floorplans };
    }
    if (currentType === "officetel") {
      extra = { layouts: [$("lay1").value.trim(), $("lay2").value.trim(), $("lay3").value.trim()].filter(Boolean) };
    }

    const record = { ...base, ...extra };
    const arr = getBuildings();
    let next;
    if (editId) { next = arr.map((x) => (x.id === editId ? record : x)); toast("수정 완료"); }
    else { record.createdAt = new Date().toISOString(); next = [record, ...arr]; toast("등록 완료"); }

    setBuildings(next);
    renderList();
    clearForm();
  }

  function clearForm() {
    editId = null;
    elName.value = ""; elAddr.value = ""; elApproved.value = "";
    elScale.value = ""; elParking.value = ""; elElevator.value = "";
    renderTypeExtra(currentType, null);
  }

  function loadToForm(id) {
    const arr = getBuildings();
    const item = arr.find((x) => x.id === id);
    if (!item) return;
    editId = item.id;
    currentType = item.type;
    Array.from(elTabs.querySelectorAll(".tab")).forEach((b) => b.classList.toggle("active", b.dataset.type === currentType));
    elName.value = item.name || ""; elAddr.value = item.address || "";
    elApproved.value = item.approved || ""; elScale.value = item.scale || "";
    elParking.value = item.parking || ""; elElevator.value = item.elevator || "";
    renderTypeExtra(currentType, item);
  }

  function deleteBuilding(id) {
    const arr = getBuildings();
    setBuildings(arr.filter((x) => x.id !== id));
    renderList();
    toast("삭제 완료");
  }

function renderList() {
  let arr = getBuildings();

  // 🔥 실제 눌린 탭을 DOM에서 직접 읽음
  const activeTab = elTabs.querySelector(".tab.active");
  const activeType = activeTab ? activeTab.dataset.type : "shop";

  arr = arr.filter(x => x.type === activeType);

  arr.sort((a, b) =>
    (a.name || "").localeCompare((b.name || ""), "ko")
  );

  elList.innerHTML = "";
  elEmpty.style.display = arr.length ? "none" : "block";

  arr.forEach((item) => {
    const div = document.createElement("div");
    div.className = "item";

    const left = document.createElement("div");
    left.className = "meta";
    left.innerHTML =
      `<div class="name">${item.name}</div>
       <div class="sub">${item.address || "(주소 미입력)"}</div>`;

    const right = document.createElement("div");
    right.className = "item-actions";

    const editBtn = document.createElement("button");
    editBtn.className = "btn mini";
    editBtn.textContent = "수정";
    editBtn.onclick = () => loadToForm(item.id);

    const delBtn = document.createElement("button");
    delBtn.className = "btn mini danger";
    delBtn.textContent = "삭제";
    delBtn.onclick = () => deleteBuilding(item.id);

    right.appendChild(editBtn);
    right.appendChild(delBtn);

    div.appendChild(left);
    div.appendChild(right);
    elList.appendChild(div);
  });
}
