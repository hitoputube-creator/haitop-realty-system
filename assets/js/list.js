// assets/js/list.js
(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);

  const elType = $("fType");
  const elBuilding = $("fBuilding");
  const elDeal = $("fDeal");
  const elStatus = $("fStatus");
  const elListedOnly = $("fListedOnly");
  const elSearch = $("fSearch");
  const elFloorGroup = $("fFloorGroup");

  const elTableHead = $("tableHead");
  const elTableBody = $("tableBody");
  const elCount = $("resultCount");

  const elBtnPrint = $("btnPrint");
  const elBtnPrintSelected = $("btnPrintSelected");
  const elBtnPrintOne = $("btnPrintOne");
  const elBtnNew = $("btnNew");
  const elBtnBuildings = $("btnBuildings");
  const elBtnHome = $("btnHome");
  const elBtnCustomers = $("btnCustomers");

  const elPrintTitle = $("printTitle");
  const elPrintSub = $("printSub");

  const state = {
    type: "shop",
    buildingId: "",
    dealType: "",
    status: "",
    floorGroup: "",
    listedOnly: true,
    q: "",
    selected: new Set()
  };

  init();

  function init() {
    elType.value = state.type;
    elListedOnly.checked = state.listedOnly;

    elType.addEventListener("change", () => {
      state.type = elType.value;
      state.buildingId = "";
      renderBuildingOptions();
      render();
    });

    elBuilding.addEventListener("change", () => {
      state.buildingId = elBuilding.value;
      render();
    });

    elDeal.addEventListener("change", () => {
      state.dealType = elDeal.value;
      render();
    });

    elStatus.addEventListener("change", () => {
      state.status = elStatus.value;
      render();
    });

    if (elFloorGroup) {
      elFloorGroup.addEventListener("change", () => {
        state.floorGroup = elFloorGroup.value;
        render();
      });
    }

    elListedOnly.addEventListener("change", () => {
      state.listedOnly = elListedOnly.checked;
      render();
    });

    elSearch.addEventListener("input", () => {
      state.q = (elSearch.value || "").trim().toLowerCase();
      render();
    });

    elBtnPrint.addEventListener("click", () => {
      printWithRows(getFilteredRows());
    });

    if (elBtnPrintSelected) {
      elBtnPrintSelected.addEventListener("click", () => {
        const sel = Array.from(state.selected);
        if (!sel.length) return alert("선택된 매물이 없습니다.");
        const all = getFilteredRows();
        const rows = all.filter(x => state.selected.has(x.id));
        if (!rows.length) return alert("현재 조건에서 선택된 매물이 없습니다.");
        printWithRows(rows);
      });
    }

    if (elBtnPrintOne) {
      elBtnPrintOne.addEventListener("click", () => {
        const sel = Array.from(state.selected);
        if (sel.length !== 1) return alert("단건 출력은 1개만 선택해주세요.");
        location.href = `detail.html?id=${sel[0]}&print=info`;
      });
    }

    elBtnNew.addEventListener("click", () => location.href = "register.html");
    elBtnBuildings.addEventListener("click", () => location.href = "buildings.html");
    if (elBtnHome) elBtnHome.addEventListener("click", () => location.href = "home.html");
    if (elBtnCustomers) elBtnCustomers.addEventListener("click", () => location.href = "customers.html");

    renderBuildingOptions();
    render();
  }

  function renderBuildingOptions() {
    const buildings = DataUtil.getBuildings().filter(b => b.type === state.type);

    elBuilding.innerHTML = `<option value="">건물 전체</option>`;
    buildings.forEach(b => {
      const opt = document.createElement("option");
      opt.value = b.id;
      opt.textContent = b.name;
      elBuilding.appendChild(opt);
    });

    elBuilding.value = state.buildingId || "";
  }

  function render() {
    const filtered = getFilteredRows();

    renderColumns(state.type);
    renderRows(state.type, filtered);

    elCount.textContent = `${filtered.length}건`;
    updatePrintHeader();

    // 버튼 상태
    if (elBtnPrintOne) elBtnPrintOne.disabled = state.selected.size !== 1;
  }

  function getFilteredRows() {
    const listings = DataUtil.getListings();
    return listings.filter(matches);
  }

  function matches(x) {
    if (x.type !== state.type) return false;
    if (state.listedOnly && !x.isListed) return false;
    if (state.status && x.status !== state.status) return false;
    if (state.dealType && x.dealType !== state.dealType) return false;
    if (state.buildingId && x.buildingId !== state.buildingId) return false;
    if (state.floorGroup) {
      const fg = x.floorGroup || guessFloorGroup(x.floor);
      if (fg !== state.floorGroup) return false;
    }

    if (state.q) {
      const hay = [
        x.title, x.address, x.buildingName, x.unit, x.ho, x.dong, x.memo,
        x.currentBiz, x.landUseZone, x.landJimo
        ,x.ownerName, x.ownerPhone, x.tenantName, x.tenantPhone
      ].join(" ").toLowerCase();
      if (!hay.includes(state.q)) return false;
    }

    return true;
  }

  function renderColumns(type) {
    const cols = getColumns(type);
    elTableHead.innerHTML = "";
    const tr = document.createElement("tr");
    cols.forEach(c => {
      const th = document.createElement("th");
      th.textContent = c.label;
      if (c.className) th.className = c.className;
      tr.appendChild(th);
    });
    elTableHead.appendChild(tr);
  }

  function renderRows(type, rows) {
    const cols = getColumns(type);
    elTableBody.innerHTML = "";

    rows.forEach((x, idx) => {
      const tr = document.createElement("tr");
      tr.style.cursor = "pointer";
      tr.addEventListener("click", () => location.href = `detail.html?id=${x.id}`);
      cols.forEach(c => {
        const td = document.createElement("td");
        if (c.className) td.className = c.className;
        td.innerHTML = c.render ? c.render(x, idx) : "";
        tr.appendChild(td);
      });
      elTableBody.appendChild(tr);
    });

    if (rows.length === 0) {
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = cols.length;
      td.className = "muted";
      td.textContent = "조건에 맞는 매물이 없습니다.";
      tr.appendChild(td);
      elTableBody.appendChild(tr);
    }
  }

  function getColumns(type) {
    const m2py = (m2, py) => {
      const m2v = (m2 ?? "");
      const pyv = (py ?? "");
      if (!m2v && !pyv) return "-";
      const mm = m2v ? `${fmtNum(m2v)}㎡` : "";
      const pp = pyv ? `${fmtNum(pyv)}평` : "";
      return `${mm}${mm && pp ? " " : ""}(${pp})`;
    };

    const priceShop = (x) => {
      if (x.dealType === "임대" || x.dealType === "월세") return `${fmtMan(x.depositManwon)}/${fmtMan(x.rentManwon)}`;
      if (x.dealType === "매매" || x.dealType === "분양") return fmtMan(x.salePriceManwon);
      return "-";
    };

    const priceOffi = (x) => {
      if (x.dealType === "전세") return fmtMan(x.jeonsePriceManwon);
      if (x.dealType === "월세" || x.dealType === "임대") return `${fmtMan(x.depositManwon)}/${fmtMan(x.rentManwon)}`;
      if (x.dealType === "매매" || x.dealType === "분양") return fmtMan(x.salePriceManwon);
      return "-";
    };

    const colSelect = {
      label:"선택",
      className:"center",
      render: (x) => {
        const checked = state.selected.has(x.id) ? "checked" : "";
        return `<input type="checkbox" class="row-check" data-id="${escAttr(x.id)}" ${checked}/>`;
      }
    };

    if (type === "officetel") return [
      colSelect,
      { label:"번호", className:"center", render:(_, i) => String(i+1) },
      { label:"건물명", render: x => esc(x.buildingName || "-") },
      { label:"동/호수", render: x => esc(`${x.dong ? x.dong+" " : ""}${x.ho || "-"}`) },
      { label:"층수", className:"center", render: x => esc(x.floorGroup || guessFloorGroup(x.floor) || "-") },
      { label:"타입/방", className:"center", render: x => esc(`${x.otType || "-"}${x.rooms ? " / "+x.rooms+"R" : ""}`) },
      { label:"전용(㎡/평)", render: x => esc(m2py(x.areaExclusiveM2, x.areaExclusivePy)) },
      { label:"분양(㎡/평)", render: x => esc(m2py(x.areaSupplyM2, x.areaSupplyPy)) },
      { label:"향", className:"center", render: x => esc(x.direction || "-") },
      { label:"거래", className:"center", render: x => esc(x.dealType || "-") },
      { label:"가격", className:"right", render: x => esc(priceOffi(x)) },
      { label:"상태", className:"center", render: x => esc(x.status || "-") },
    ];

    if (type === "apartment") return [
      colSelect,
      { label:"번호", className:"center", render:(_, i) => String(i+1) },
      { label:"건물명", render: x => esc(x.buildingName || "-") },
      { label:"동/호수", render: x => esc(`${x.dong ? x.dong+" " : ""}${x.ho || "-"}`) },
      { label:"층수", className:"center", render: x => esc(x.floorGroup || guessFloorGroup(x.floor) || "-") },
      { label:"전용(㎡/평)", render: x => esc(m2py(x.areaExclusiveM2, x.areaExclusivePy)) },
      { label:"분양(㎡/평)", render: x => esc(m2py(x.areaSupplyM2, x.areaSupplyPy)) },
      { label:"타입", className:"center", render: x => esc(x.aptType || "-") },
      { label:"향", className:"center", render: x => esc(x.direction || "-") },
      { label:"거래", className:"center", render: x => esc(x.dealType || "-") },
      { label:"가격", className:"right", render: x => esc(priceOffi(x)) },
      { label:"상태", className:"center", render: x => esc(x.status || "-") },
    ];

    if (type === "bizcenter") return [
      colSelect,
      { label:"번호", className:"center", render:(_, i) => String(i+1) },
      { label:"건물명", render: x => esc(x.buildingName || "-") },
      { label:"호실", className:"center", render: x => esc(x.unit || "-") },
      { label:"층수", className:"center", render: x => esc(x.floorGroup || guessFloorGroup(x.floor) || "-") },
      { label:"전용(㎡/평)", render: x => esc(m2py(x.areaExclusiveM2, x.areaExclusivePy)) },
      { label:"거래", className:"center", render: x => esc(x.dealType || "-") },
      { label:"가격", className:"right", render: x => esc(priceShop(x)) },
      { label:"상태", className:"center", render: x => esc(x.status || "-") },
    ];

    if (type === "shop") return [
      colSelect,
      { label:"번호", className:"center", render:(_, i) => String(i+1) },
      { label:"건물명", render: x => esc(x.buildingName || "-") },
      { label:"호실", className:"center", render: x => esc(x.unit || "-") },
      { label:"층수", className:"center", render: x => esc(x.floorGroup || guessFloorGroup(x.floor) || "-") },
      { label:"전용(㎡/평)", render: x => esc(m2py(x.areaExclusiveM2, x.areaExclusivePy)) },
      { label:"분양(㎡/평)", render: x => esc(m2py(x.areaSupplyM2, x.areaSupplyPy)) },
      { label:"현업종", render: x => esc(x.currentBiz || "-") },
      { label:"거래", className:"center", render: x => esc(x.dealType || "-") },
      { label:"임대조건/가격", className:"right", render: x => esc(priceShop(x)) },
      { label:"상태", className:"center", render: x => esc(x.status || "-") },
    ];

    if (type === "land_dev" || type === "land_single" || type === "land_general") return [
      colSelect,
      { label:"번호", className:"center", render:(_, i) => String(i+1) },
      { label:"소재지", render: x => esc(x.address || "-") },
      { label:"면적(㎡/평)", render: x => esc(m2py(x.landAreaM2, x.landAreaPy)) },
      { label:"지목", className:"center", render: x => esc(x.landJimo || "-") },
      { label:"용도지역", render: x => esc(x.landUseZone || "-") },
      { label:"매매가", className:"right", render: x => esc(fmtMan(x.salePriceManwon)) },
      { label:"평당가", className:"right", render: x => esc(calcPyeongPrice(x.salePriceManwon, x.landAreaPy)) },
      { label:"상태", className:"center", render: x => esc(x.status || "-") },
    ];

    if (type === "factory") return [
      colSelect,
      { label:"번호", className:"center", render:(_, i) => String(i+1) },
      { label:"소재지", render: x => esc(x.address || "-") },
      { label:"대지(㎡/평)", render: x => esc(m2py(x.landAreaM2, x.landAreaPy)) },
      { label:"건축(㎡/평)", render: x => esc(m2py(x.buildingAreaM2, x.buildingAreaPy)) },
      { label:"층고", className:"center", render: x => esc(x.clearHeightM ? `${x.clearHeightM}m` : "-") },
      { label:"거래", className:"center", render: x => esc(x.dealType || "-") },
      { label:"가격", className:"right", render: x => esc(priceShop(x)) },
      { label:"상태", className:"center", render: x => esc(x.status || "-") },
    ];

    return [
      colSelect,
      { label:"번호", className:"center", render:(_, i) => String(i+1) },
      { label:"제목", render: x => esc(x.title || "-") },
      { label:"주소/건물", render: x => esc(x.address || x.buildingName || "-") },
      { label:"거래", className:"center", render: x => esc(x.dealType || "-") },
      { label:"상태", className:"center", render: x => esc(x.status || "-") },
    ];
  }

  // 체크박스 클릭 시 행 이동 막기 + 선택 상태 관리
  document.addEventListener("click", (e) => {
    const t = e.target;
    if (!(t instanceof HTMLElement)) return;
    if (t.classList.contains("row-check")) {
      e.stopPropagation();
      const id = t.getAttribute("data-id");
      if (!id) return;
      if (t.checked) state.selected.add(id);
      else state.selected.delete(id);
      if (elBtnPrintOne) elBtnPrintOne.disabled = state.selected.size !== 1;
    }
  }, true);

  function printWithRows(rows) {
    const original = getFilteredRows();
    renderColumns(state.type);
    renderRows(state.type, rows);
    updatePrintHeader();
    window.print();
    // 복원
    renderColumns(state.type);
    renderRows(state.type, original);
    updatePrintHeader();
  }

  function guessFloorGroup(floor) {
    const f = String(floor || "").toUpperCase();
    if (f === "1F" || f.includes("1F")) return "1층";
    if (f === "2F" || f.includes("2F")) return "2층";
    return "상층부";
  }

  function escAttr(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll('"', "&quot;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
  }

  function updatePrintHeader() {
    const typeLabel = labelByType(state.type);
    const bName = getSelectedBuildingName();
    const title = bName ? `${bName} ${typeLabel} 매물 리스트` : `${typeLabel} 매물 리스트`;
    elPrintTitle.textContent = title;

    const today = new Date();
    const dateStr = `${today.getFullYear()}.${pad2(today.getMonth()+1)}.${pad2(today.getDate())}`;
    const sub = `출력일: ${dateStr} · 조건: ${state.listedOnly ? "✅매물나옴" : "전체"}${state.dealType ? " · " + state.dealType : ""}${state.status ? " · " + state.status : ""}`;
    elPrintSub.textContent = sub;
  }

  function getSelectedBuildingName() {
    const id = state.buildingId || elBuilding.value;
    if (!id) return "";
    const b = DataUtil.findBuildingById(id);
    return b?.name || "";
  }

  function labelByType(t) {
    if (t === "shop") return "상가";
    if (t === "officetel") return "오피스텔";
    if (t === "apartment") return "아파트";
    if (t === "bizcenter") return "지식산업센터";
    if (t === "land_dev") return "토지(시행부지)";
    if (t === "land_single") return "토지(단독주택)";
    if (t === "land_general") return "토지(일반)";
    if (t === "factory") return "공장/창고";
    return "매물";
  }

  function fmtMan(v) {
    const n = Number(v);
    if (!isFinite(n) || n === 0) return "-";
    return n.toLocaleString("ko-KR") + "만원";
  }

  function fmtNum(v) {
    const n = Number(v);
    if (!isFinite(n)) return String(v ?? "");
    const hasDecimal = String(v).includes(".");
    return hasDecimal ? n.toFixed(2).replace(/\.00$/, "") : n.toLocaleString("ko-KR");
  }

  function calcPyeongPrice(priceMan, areaPy) {
    const p = Number(priceMan);
    const a = Number(areaPy);
    if (!isFinite(p) || !isFinite(a) || a <= 0) return "-";
    return (p / a).toFixed(0).toLocaleString("ko-KR") + "만원/평";
  }

  function esc(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
  }

  function pad2(n){ return String(n).padStart(2,"0"); }

})();
