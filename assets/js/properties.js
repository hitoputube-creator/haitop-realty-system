// ===== 상세등록 시작 =====
// 신규 상세등록은 항상 register.html의 빈 폼에서 시작한다 (sessionStorage 프리필을 남기지 않음).
function startDetailRegister() {
  location.href = "register.html";
}
document.getElementById("detailRegisterBtn").addEventListener("click", startDetailRegister);
// 상단 메뉴 "업무도구" 드롭다운은 assets/js/nav.js에서 모든 화면 공통으로 렌더링·제어한다.

// ===== 상세저장으로 전환 (기존 빠른저장 매물 → 상세등록) =====
function convertToDetail(id) {
  const item = allListings.find(x => x.id === id);
  if (!item) return;
  const prefill = {
    type:           item.type || "",
    quick_price:    item.quick_price || "",
    quick_contact:  item.quick_contact || item.owner_phone1 || item.owner_contact || "",
    quick_memo:     item.quick_memo || item.description || "",
    drive_links:    item.drive_links || [],
    quick_location: item.quick_location || item.address || "",
    source_id:      item.id
  };
  OfficeStorage.session.setItem("hitop_detail_prefill", JSON.stringify(prefill));
  location.href = "register.html";
}

// ===== 매물관리 =====
const listingContainer = document.getElementById("listingContainer");
const emptyMessage = document.getElementById("emptyMessage");
const filterRow = document.getElementById("filterRow");
const subFilterRow = document.getElementById("subFilterRow");
const complexFilterWrap = document.getElementById("complexFilterWrap");
const complexFilterSelect = document.getElementById("complexFilterSelect");
const dealFilterRow = document.getElementById("dealFilterRow");
const countBadge = document.getElementById("countBadge");
const paginationEl = document.getElementById("pagination");

let currentMajor = "";   // "" = 전체, 그 외 PROPERTY_CATEGORY_STANDARD의 키
let currentSub = "";     // "" = 대분류 전체, 그 외 표준 세부구분값
let currentTag = "";     // "" = 없음, 그 외 COMPLEX_TAG_MATCHERS의 키(예: "힐스테이트더운정") — 대분류·세부와 별개로 AND 결합
let currentDealFilter = ""; // "" = 없음, 그 외 "매매"/"임대"/"전세"/"월세" — 유형별 필터와는 독립적 OR로 결합
let searchKeyword = "";
let currentSort = "newest";
let currentPage = 1;
let includeCompleted = false;
let currentStatusFilter = "진행중";
let currentKindTab = "매물"; // "매물" | "명단" | "전체" — 등록구분 탭
let viewMode = "card"; // "card" | "list"
let selectedIds = new Set(); // 선택된 매물 ID 집합
let deletingSelected = false;
const ITEMS_PER_PAGE = 10;

function pruneSelectedIds() {
  if (!Array.isArray(allListings) || !selectedIds.size) return false;
  const existingIds = new Set(allListings.map(item => item && item.id).filter(Boolean));
  let changed = false;
  selectedIds.forEach(id => {
    if (!existingIds.has(id)) {
      selectedIds.delete(id);
      changed = true;
    }
  });
  return changed;
}

function updateVisibleSelectAllState() {
  const selectAll = viewMode === "list"
    ? document.getElementById("listSelectAll")
    : document.getElementById("cardSelectAll");
  const items = viewMode === "list" ? _currentListItems : _currentCardItems;
  if (!selectAll || !Array.isArray(items)) return;
  const validItems = items.filter(item => item && item.id);
  const selectedCount = validItems.filter(item => selectedIds.has(item.id)).length;
  selectAll.checked = validItems.length > 0 && selectedCount === validItems.length;
  selectAll.indeterminate = selectedCount > 0 && selectedCount < validItems.length;
}

function updatePrintBtn() {
  const btn = document.getElementById("printBtn");
  const n = selectedIds.size;
  if (btn) {
    btn.textContent = n > 0 ? `🖨️ 선택인쇄 (${n}건)` : "📋 선택매물보기";
    btn.disabled = n === 0;
    btn.style.opacity = n === 0 ? "0.4" : "1";
    btn.style.cursor = n === 0 ? "not-allowed" : "pointer";
  }

  const deleteBtn = document.getElementById("deleteSelectedBtn");
  if (deleteBtn) {
    deleteBtn.textContent = deletingSelected ? "삭제 중..." : `선택삭제 (${n}건)`;
    deleteBtn.disabled = deletingSelected || n === 0;
    deleteBtn.style.opacity = n === 0 || deletingSelected ? "0.45" : "1";
    deleteBtn.style.cursor = n === 0 || deletingSelected ? "not-allowed" : "pointer";
  }
  updateVisibleSelectAllState();
}

function toggleSelect(id, checked) {
  if (checked) selectedIds.add(id); else selectedIds.delete(id);
  updatePrintBtn();
}

function toggleSelectAll(items, checked) {
  (items || []).forEach(item => { if (item && item.id) { if (checked) selectedIds.add(item.id); else selectedIds.delete(item.id); } });
  updatePrintBtn();
  renderList(); // 체크박스 상태 갱신
}

// ── 선택매물보기 섹션 표시 요소 ──
const _listingSections = () => [
  document.querySelector("#tabProperty .quick-card"),
  ...document.querySelectorAll("#tabProperty > section.card:not(#selectedPreviewSection)")
];

function getSelectedListings() {
  pruneSelectedIds();
  return allListings.filter(item => selectedIds.has(item.id));
}

function getBulkDeleteLabel(item) {
  const number = typeof getListingNumber === "function" ? getListingNumber(item) : "";
  const name = typeof getListingName === "function" ? getListingName(item) : "";
  const address = item.address || "";
  const primary = name && name !== "-" ? name : address;
  return [number ? `No.${number}` : "", primary].filter(Boolean).join(" / ") || item.id;
}

function notifyBulkDelete(message, duration = 3500) {
  if (typeof showToast === "function") showToast(message, duration);
  else alert(message);
}

function refreshSelectionDisplay() {
  const filtered = getFilteredListings();
  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  if (currentPage > totalPages) currentPage = totalPages;

  const previewSection = document.getElementById("selectedPreviewSection");
  const previewOpen = previewSection && previewSection.style.display !== "none";
  if (previewOpen) {
    if (selectedIds.size) {
      renderPreview();
      updatePrintBtn();
    } else {
      goBackToList();
    }
    return;
  }
  renderList();
  updatePrintBtn();
}

async function deleteSelectedListings() {
  if (deletingSelected || !selectedIds.size) return;
  const selectedListings = getSelectedListings();
  if (!selectedListings.length) {
    updatePrintBtn();
    return;
  }

  const count = selectedListings.length;
  const sample = selectedListings.slice(0, 6).map((item, index) => `${index + 1}. ${getBulkDeleteLabel(item)}`).join("\n");
  const more = count > 6 ? `\n외 ${count - 6}건` : "";
  const publicWarning = selectedListings.some(item => item.is_public === true)
    ? "\n\n홈페이지 공개 중인 매물이 포함되어 있습니다."
    : "";
  const message = `선택한 매물 ${count}건을 삭제하시겠습니까? 삭제한 매물은 복구하기 어렵습니다.\n\n${sample}${more}${publicWarning}`;
  if (!confirm(message)) return;

  deletingSelected = true;
  updatePrintBtn();

  const succeeded = [];
  const failed = [];
  for (const item of selectedListings) {
    try {
      await deleteListing(item.id);
      succeeded.push(item.id);
    } catch (error) {
      failed.push({ id: item.id, error });
    }
  }

  if (succeeded.length) {
    const deletedIds = new Set(succeeded);
    allListings = allListings.filter(item => !deletedIds.has(item.id));
    succeeded.forEach(id => selectedIds.delete(id));
  }

  deletingSelected = false;
  refreshSelectionDisplay();

  if (failed.length) {
    notifyBulkDelete(`선택한 매물 ${count}건 중 ${succeeded.length}건을 삭제했고 ${failed.length}건은 삭제하지 못했습니다.`, 4500);
  } else {
    notifyBulkDelete(`선택한 매물 ${count}건을 삭제했습니다.`);
  }
}

async function handleDeleteListingFromCard(id) {
  const item = allListings.find(listing => listing.id === id);
  const label = item ? getBulkDeleteLabel(item) : id;
  const publicWarning = item && item.is_public === true
    ? "\n\n홈페이지 공개 중인 매물입니다."
    : "";
  if (!confirm(`${label} 매물을 삭제하시겠습니까? 삭제하면 복구가 어렵습니다.${publicWarning}`)) return;

  try {
    await deleteListing(id);
    selectedIds.delete(id);
    allListings = allListings.filter(listing => listing.id !== id);
    refreshSelectionDisplay();
    notifyBulkDelete("매물을 삭제했습니다.");
  } catch (error) {
    notifyBulkDelete("삭제 실패: " + error.message, 4500);
  }
}

function printSelected() {
  if (!selectedIds.size) return;
  _listingSections().forEach(el => { if (el) el.style.display = "none"; });
  document.getElementById("selectedPreviewSection").style.display = "";
  renderPreview();
}

function formatSelectedPrintAddress(item) {
  const address = String(item.address || item.title || "");
  const escapeHtml = (value) => String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  // Separate apartment building/unit only at print time; other property addresses stay unchanged.
  const match = address.match(/^(.*?)(\s+)(\d{1,5}\s*동\s*\d{1,5}\s*호)\s*$/);
  if (!match || !match[1].trim()) return escapeHtml(address);
  return `<span>${escapeHtml(match[1].trim())}</span><span class="selected-print-unit">${escapeHtml(match[3].replace(/\s+/g, " ").trim())}</span>`;
}

function renderPreview() {
  const list = getSelectedListings();
  document.getElementById("previewCount").textContent = `(${list.length}건)`;
  const rows = list.map((item, i) => {
    const isDone = item.status === "거래완료";
    const memo = (item.quick_memo || item.description || "");
    const memoShort = memo.length > 30 ? memo.substring(0, 30) + "…" : memo;
    const owner = item.owner_name || item.quick_owner || "";
    const contact = item.owner_phone1 || item.owner_contact || item.quick_contact || "";
    const chk = selectedIds.has(item.id) ? "checked" : "";
    return `<tr class="${isDone ? "done-row" : ""}">
      <td style="text-align:center;width:36px;" onclick="event.stopPropagation()">
        <input type="checkbox" ${chk} style="width:auto;accent-color:var(--gold);cursor:pointer;" onchange="togglePreviewCheck('${item.id}',this.checked)" />
      </td>
      <td style="text-align:center;color:var(--text-muted);font-size:0.76rem;width:28px;">${i + 1}</td>
      <td><span style="font-size:0.75rem;padding:2px 7px;border-radius:4px;background:rgba(212,175,55,0.1);color:var(--gold);">${getListingCategoryLabel(item)}</span></td>
      <td style="font-weight:500;">${formatSelectedPrintAddress(item)}</td>
      <td style="font-size:0.82rem;">${formatPrice(item)}</td>
      <td style="font-size:0.8rem;color:var(--text-muted);">${owner}</td>
      <td style="font-size:0.8rem;color:var(--text-muted);">${contact}</td>
      <td><span style="font-size:0.75rem;padding:2px 6px;border-radius:4px;background:${isDone?'rgba(238,136,136,0.15)':'rgba(82,197,100,0.12)'};color:${isDone?'#e88':'#52c564'};">${isDone?"완료":getStatusLabel(item)}</span></td>
      <td style="font-size:0.78rem;color:var(--text-muted);">${memoShort}</td>
    </tr>`;
  }).join("");
  document.getElementById("selectedViewTableWrap").innerHTML = `
    <table id="selectedViewTable">
      <thead><tr>
        <th style="width:36px;"></th>
        <th style="width:28px;text-align:center;">No</th>
        <th style="width:72px;">유형</th>
        <th>주소</th>
        <th style="width:140px;">가격</th>
        <th style="width:76px;">소유주</th>
        <th style="width:110px;">연락처</th>
        <th style="width:60px;">상태</th>
        <th style="width:160px;">메모</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}

function togglePreviewCheck(id, checked) {
  toggleSelect(id, checked);
  if (!selectedIds.size) { goBackToList(); return; }
  renderPreview();
}

function goBackToList() {
  document.getElementById("selectedPreviewSection").style.display = "none";
  _listingSections().forEach(el => { if (el) el.style.display = ""; });
  renderList(); // 체크박스 상태 반영
}

function doPrint() {
  const kw = searchKeyword.trim();
  const list = allListings.filter(l => selectedIds.has(l.id));
  document.getElementById("selectedPrintKeyword").textContent = kw ? `검색어: ${kw}` : "";
  document.getElementById("selectedPrintDate").textContent =
    `출력일: ${new Date().toLocaleDateString("ko-KR")}  총 ${list.length}건`;
  window.print();
}

window.addEventListener("afterprint", () => {
  selectedIds.clear();
  updatePrintBtn();
  goBackToList();
});

function setViewMode(mode, opts = {}) {
  viewMode = mode;
  const cardBtn = document.getElementById("viewToggleCard");
  const listBtn = document.getElementById("viewToggleList");
  const gold = "rgba(212,175,55,0.2)", goldTxt = "var(--gold)";
  const none = "transparent", noneTxt = "var(--text-muted)";
  const cardSelectBar = document.getElementById("cardSelectBar");
  if (mode === "card") {
    cardBtn.style.background = gold; cardBtn.style.color = goldTxt;
    listBtn.style.background = none; listBtn.style.color = noneTxt;
    listingContainer.className = "listing-grid";
  } else {
    listBtn.style.background = gold; listBtn.style.color = goldTxt;
    cardBtn.style.background = none; cardBtn.style.color = noneTxt;
    listingContainer.className = "";
    cardSelectBar.style.display = "none";
  }
  if (opts.skipRender) return; // 상태 복원 시 데이터 로딩 전 중복 렌더 방지용
  currentPage = 1;
  renderList();
  updatePrintBtn();
  saveFilterState();
}

function renderListView(items) {
  if (!items.length) {
    listingContainer.innerHTML = `<div style="font-size:0.82rem;color:var(--text-muted);padding:20px 0;text-align:center;">등록된 매물이 없습니다.</div>`;
    return;
  }
  const allChecked = items.length > 0 && items.every(i => selectedIds.has(i.id));
  const rows = items.map(item => {
    const chk = selectedIds.has(item.id) ? "checked" : "";
    const idArg = idForCall(item.id);
    const statusClass = getStatusClass(item);
    const name = getListingName(item) + (isRosterListing(item) ? " [명단]" : "");
    return `<tr class="${statusClass}" onclick="location.href='detail.html?id=${encodeURIComponent(item.id)}'">
      <td class="col-select" onclick="event.stopPropagation()">
        <input type="checkbox" data-sel="${escapeHtml(item.id)}" ${chk} onchange="toggleSelect('${idArg}',this.checked)" />
      </td>
      <td class="col-status"><span class="status-pill ${statusClass}">${escapeHtml(getStatusLabel(item))}</span></td>
      <td class="col-number">${escapeHtml(getListingNumber(item))}</td>
      <td class="col-category">${escapeHtml(getListingCategoryLabel(item))}</td>
      <td class="col-address">
        <span class="table-address">${escapeHtml(item.address || "(주소 미입력)")}</span>
        <span class="table-subtitle">${escapeHtml(name && name !== "-" ? name : "")}</span>
      </td>
      <td class="col-deal">${escapeHtml(getDealTypeLabel(item))}</td>
      <td class="col-price">${escapeHtml(formatPrice(item) || "-")}</td>
      <td class="col-area">${escapeHtml(getAreaText(item))}</td>
      <td class="col-building">${escapeHtml(getBuildingName(item))}</td>
      <td class="col-updated">${escapeHtml(getUpdatedDateText(item))}</td>
    </tr>`;
  }).join("");
  listingContainer.innerHTML = `<div class="list-table-wrap"><table id="listViewTable">
    <colgroup>
      <col class="col-select" />
      <col class="col-status" />
      <col class="col-number" />
      <col class="col-category" />
      <col class="col-address" />
      <col class="col-deal" />
      <col class="col-price" />
      <col class="col-area" />
      <col class="col-building" />
      <col class="col-updated" />
    </colgroup>
    <thead><tr>
      <th class="col-select">
        <input type="checkbox" id="listSelectAll" ${allChecked ? "checked" : ""} onchange="toggleSelectAll(_currentListItems,this.checked)" />
      </th>
      <th class="col-status">상태</th>
      <th class="col-number">매물번호</th>
      <th class="col-category">분류</th>
      <th class="col-address">주소</th>
      <th class="col-deal">거래유형</th>
      <th class="col-price">가격</th>
      <th class="col-area">면적</th>
      <th class="col-building">단지명</th>
      <th class="col-updated">수정일</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table></div>`;
  _currentListItems = items; // 전체선택용 참조 저장
}
let _currentListItems = [];
let _currentCardItems = [];

// 동·호수만 겹쳐서 정렬한다: 동 → 호수 순으로 누르면 동 먼저, 호수 → 동 순으로 누르면 호수 먼저.
// 다른 열은 한 열씩만 정렬하고, 같은 열을 다시 누르면 오름차순/내림차순이 바뀐다.
let listingColumnSort = [];   // [{key, direction}]
function listingColumnValue(item,key) {
  const u=item.apartmentUnitData || {};
  const name=u.아파트명 || item.complexName || item.buildingName || "";
  const village=(name.match(/^(.*?마을\s*\d+단지)/)||[])[1]||"";
  const map={type:()=>getListingCategoryLabel(item),deal:()=>getTransactionType(item),village:()=>village,apartment:()=>name.slice(village.length).trim()||item.address||"",dong:()=>u.동||item.apartmentDong||item.dong||"",room:()=>u.호||item.apartmentHo||item.ho||"",price:()=>Number(item.salePrice||item.deposit||item.monthlyRent||0),owner:()=>getListingOwnerName(item),phone:()=>getListingPhone1(item)};
  return map[key]?.() ?? "";
}
function sortListingColumn(key) {
  const pair=["dong","room"];
  const last=listingColumnSort[listingColumnSort.length-1];
  if (!pair.includes(key)) {
    listingColumnSort=[{key,direction:last && listingColumnSort.length===1 && last.key===key ? -last.direction : 1}];
  } else if (listingColumnSort.length && listingColumnSort.every(s=>pair.includes(s.key))) {
    const i=listingColumnSort.findIndex(s=>s.key===key);
    if (i<0) listingColumnSort=[...listingColumnSort,{key,direction:1}];
    else if (i===listingColumnSort.length-1) listingColumnSort=listingColumnSort.map((s,j)=>j===i ? {key,direction:-s.direction} : s);
    else listingColumnSort=[...listingColumnSort.filter((_,j)=>j!==i),listingColumnSort[i]];   // 먼저 눌렀던 열을 다시 누르면 맨 뒤(2순위)로
  } else {
    listingColumnSort=[{key,direction:1}];
  }
  currentPage=1; renderList();
}
function listingSortMark(key) {
  const s=listingColumnSort.find(x=>x.key===key);
  return s ? (s.direction===1 ? '↑' : '↓') : '↕';
}

/* ══════════════════════════════════════════
   컬럼 필터 (엑셀식) — 목록 머리글의 ▾ 버튼
   - 값 선택형: 매물종류·구분·마을단지·아파트명·동·호수·소유주
   - 범위형: 가격(만원 단위 최소~최대)
   - 글자 포함형: 연락처
   카드 보기에서만 적용되며, 정렬·검색·유형 필터와 함께(AND) 작동한다.
══════════════════════════════════════════ */
const LISTING_FILTER_COLUMNS = {
  type:{label:"매물종류",mode:"values"}, deal:{label:"구분",mode:"values"},
  village:{label:"마을단지",mode:"values"}, apartment:{label:"아파트명",mode:"values"},
  dong:{label:"동",mode:"values"}, room:{label:"호수",mode:"values"},
  price:{label:"가격",mode:"range"},
  owner:{label:"소유주",mode:"values"}, phone:{label:"연락처",mode:"text"}
};
const COL_FILTER_BLANK = "(빈 값)";
let listingColumnFilters = {}; // key → {values:[...]} | {min,max} | {text}
let _colFilterPop = null;
let _colFilterPopKey = "";

function _colFilterValue(item, key) {
  let v = String(listingColumnValue(item, key) ?? "").trim();
  if (v === "-") v = "";
  return v;
}
function matchesColumnFilters(item, skipKey) {
  for (const key in listingColumnFilters) {
    if (key === skipKey) continue;
    const f = listingColumnFilters[key];
    if (!f) continue;
    if (f.values) {
      const v = _colFilterValue(item, key) || COL_FILTER_BLANK;
      if (!f.values.includes(v)) return false;
    } else if (key === "price") {
      const man = Number(listingColumnValue(item, "price")) / 10000;
      if (!(man > 0)) return false;
      if (f.min != null && man < f.min) return false;
      if (f.max != null && man > f.max) return false;
    } else if (f.text) {
      const q = f.text.toLowerCase();
      const hay = [getListingPhone1(item), getListingPhone2(item)].join(" ").toLowerCase();
      const qd = q.replace(/\D/g, "");
      if (!(hay.includes(q) || (qd && hay.replace(/\D/g, "").includes(qd)))) return false;
    }
  }
  return true;
}
function columnFilterCount() { return Object.keys(listingColumnFilters).length; }

function closeColumnFilterPopover() {
  if (_colFilterPop) { _colFilterPop.remove(); _colFilterPop = null; _colFilterPopKey = ""; }
}
function clearColumnFilters() {
  listingColumnFilters = {};
  closeColumnFilterPopover();
  currentPage = 1; renderList(); saveFilterState();
}
function _applyColumnFilter(key, filter) {
  if (filter) listingColumnFilters[key] = filter; else delete listingColumnFilters[key];
  closeColumnFilterPopover();
  currentPage = 1; renderList(); saveFilterState();
}

function openColumnFilter(key, btn, ev) {
  if (ev) ev.stopPropagation();
  const reopen = _colFilterPopKey === key;
  closeColumnFilterPopover();
  if (reopen) return;
  const cfg = LISTING_FILTER_COLUMNS[key];
  if (!cfg) return;
  const cur = listingColumnFilters[key] || null;
  const pop = document.createElement("div");
  pop.className = "col-filter-pop";
  pop.addEventListener("click", e => e.stopPropagation());
  const title = `<div class="cfp-title">${escapeHtml(cfg.label)} 필터</div>`;

  if (cfg.mode === "values") {
    const base = getBaseFilteredListings().filter(i => matchesColumnFilters(i, key));
    const counts = new Map();
    base.forEach(i => { const v = _colFilterValue(i, key) || COL_FILTER_BLANK; counts.set(v, (counts.get(v) || 0) + 1); });
    cur && cur.values.forEach(v => { if (!counts.has(v)) counts.set(v, 0); });
    const options = [...counts.keys()].sort((a, b) =>
      a === COL_FILTER_BLANK ? 1 : b === COL_FILTER_BLANK ? -1 : a.localeCompare(b, "ko", { numeric: true }));
    const selected = new Set(cur ? cur.values : options);
    pop.innerHTML = title +
      `<input type="search" class="cfp-search" placeholder="검색" aria-label="${escapeHtml(cfg.label)} 값 검색" />
       <div class="cfp-quick"><button type="button" data-q="all">보이는 항목 모두 선택</button><button type="button" data-q="none">모두 해제</button></div>
       <div class="cfp-list"></div>
       <div class="cfp-msg" role="alert"></div>
       <div class="cfp-actions"><button type="button" class="cfp-reset">이 열 필터 해제</button><button type="button" class="cfp-apply">적용</button></div>`;
    const listEl = pop.querySelector(".cfp-list");
    const searchEl = pop.querySelector(".cfp-search");
    const msgEl = pop.querySelector(".cfp-msg");
    const visible = () => options.filter(v => v.toLowerCase().includes(searchEl.value.trim().toLowerCase()));
    const paint = () => {
      listEl.innerHTML = visible().map(v =>
        `<label class="cfp-row"><input type="checkbox" value="${escapeHtml(v)}" ${selected.has(v) ? "checked" : ""}/><span class="cfp-val">${escapeHtml(v)}</span><span class="cfp-n">${counts.get(v)}</span></label>`).join("") ||
        `<div class="cfp-empty">일치하는 항목이 없습니다.</div>`;
    };
    listEl.addEventListener("change", e => {
      const cb = e.target;
      if (cb && cb.type === "checkbox") { cb.checked ? selected.add(cb.value) : selected.delete(cb.value); msgEl.textContent = ""; }
    });
    searchEl.addEventListener("input", paint);
    pop.querySelector(".cfp-quick").addEventListener("click", e => {
      const q = e.target.dataset && e.target.dataset.q;
      if (q === "all") visible().forEach(v => selected.add(v));
      if (q === "none") visible().forEach(v => selected.delete(v));
      if (q) { msgEl.textContent = ""; paint(); }
    });
    pop.querySelector(".cfp-apply").addEventListener("click", () => {
      if (!selected.size) { msgEl.textContent = "하나 이상 선택해 주세요."; return; }
      _applyColumnFilter(key, options.every(v => selected.has(v)) ? null : { values: options.filter(v => selected.has(v)) });
    });
    pop.querySelector(".cfp-reset").addEventListener("click", () => _applyColumnFilter(key, null));
    paint();
  } else if (cfg.mode === "range") {
    pop.innerHTML = title +
      `<div class="cfp-range"><input type="number" class="cfp-min" min="0" inputmode="numeric" placeholder="최소" value="${cur && cur.min != null ? cur.min : ""}" />
       <span>~</span><input type="number" class="cfp-max" min="0" inputmode="numeric" placeholder="최대" value="${cur && cur.max != null ? cur.max : ""}" /><span class="cfp-unit">만원</span></div>
       <div class="cfp-hint">예) 3억~5억 → 30000 ~ 50000<br>가격이 비어 있는 매물은 범위를 걸면 제외됩니다.</div>
       <div class="cfp-msg" role="alert"></div>
       <div class="cfp-actions"><button type="button" class="cfp-reset">이 열 필터 해제</button><button type="button" class="cfp-apply">적용</button></div>`;
    pop.querySelector(".cfp-apply").addEventListener("click", () => {
      const rawMin = pop.querySelector(".cfp-min").value.trim(), rawMax = pop.querySelector(".cfp-max").value.trim();
      const min = rawMin === "" ? null : Number(rawMin), max = rawMax === "" ? null : Number(rawMax);
      if ((min != null && !isFinite(min)) || (max != null && !isFinite(max))) { pop.querySelector(".cfp-msg").textContent = "숫자만 입력해 주세요."; return; }
      if (min != null && max != null && min > max) { pop.querySelector(".cfp-msg").textContent = "최소가 최대보다 클 수 없습니다."; return; }
      _applyColumnFilter(key, min == null && max == null ? null : { min, max });
    });
    pop.querySelector(".cfp-reset").addEventListener("click", () => _applyColumnFilter(key, null));
  } else {
    pop.innerHTML = title +
      `<input type="search" class="cfp-text" placeholder="번호 일부 (예: 7941, 010-5103)" value="${cur ? escapeHtml(cur.text) : ""}" />
       <div class="cfp-msg" role="alert"></div>
       <div class="cfp-actions"><button type="button" class="cfp-reset">이 열 필터 해제</button><button type="button" class="cfp-apply">적용</button></div>`;
    const apply = () => { const t = pop.querySelector(".cfp-text").value.trim(); _applyColumnFilter(key, t ? { text: t } : null); };
    pop.querySelector(".cfp-apply").addEventListener("click", apply);
    pop.querySelector(".cfp-text").addEventListener("keydown", e => { if (e.key === "Enter") apply(); });
    pop.querySelector(".cfp-reset").addEventListener("click", () => _applyColumnFilter(key, null));
  }

  document.body.appendChild(pop);
  const r = btn.getBoundingClientRect();
  const w = pop.offsetWidth || 260;
  pop.style.left = Math.max(8, Math.min(r.left + window.scrollX, window.scrollX + document.documentElement.clientWidth - w - 8)) + "px";
  pop.style.top = (r.bottom + window.scrollY + 4) + "px";
  _colFilterPop = pop;
  _colFilterPopKey = key;
  const first = pop.querySelector("input[type=search], input[type=number]");
  if (first) first.focus();
}
document.addEventListener("click", closeColumnFilterPopover);
document.addEventListener("keydown", e => { if (e.key === "Escape") closeColumnFilterPopover(); });

function makeListingColumnHeader() {
  const header = document.createElement("div");
  header.className = "listing-column-header";
  const sortBtn=(key,label)=>'<button type="button" class="listing-sort-btn" onclick="sortListingColumn(\''+key+'\')" aria-label="'+label+' 정렬">'+label+' <span aria-hidden="true">'+listingSortMark(key)+'</span></button>';
  const filterBtn=(key,label)=>{ const on=!!listingColumnFilters[key]; return '<button type="button" class="listing-filter-btn'+(on?' active':'')+'" onclick="openColumnFilter(\''+key+'\',this,event)" aria-label="'+label+' 필터'+(on?' (적용 중)':'')+'" title="'+label+' 필터'+(on?' (적용 중)':'')+'">'+(on?'●':'▾')+'</button>'; };
  const n = columnFilterCount();
  header.innerHTML = '<div class="listing-cell-select">선택</div>'+[['type','매물종류'],['deal','구분'],['village','마을단지'],['apartment','아파트명'],['dong','동'],['room','호수'],['price','가격'],['owner','소유주'],['phone','연락처']].map(([key,label])=>'<div class="listing-cell-'+key+'">'+sortBtn(key,label)+filterBtn(key,label)+'</div>').join('')+'<div class="listing-cell-actions">'+(n?'<button type="button" class="listing-filter-reset" onclick="clearColumnFilters()" title="적용 중인 열 필터를 모두 해제">✕ 필터 해제 '+n+'</button>':'관리')+'</div>';
  return header;
}

const HOMEPAGE_LISTINGS_URL = "https://hitoputube-creator.github.io/hitop-property-platform/listings.html";
function createHomepageTab() {
  const tab = window.open("about:blank", "_blank");
  if (tab) tab.opener = null;
  return tab;
}
function openHomepageListings(tab) {
  if (tab) tab.location.href = HOMEPAGE_LISTINGS_URL;
  else window.open(HOMEPAGE_LISTINGS_URL, "_blank", "noopener,noreferrer");
}
function closeHomepageTab(tab) {
  try { if (tab) tab.close(); } catch (_) {}
}

function matchesCategoryFilter(item) {
  if (currentTag && !matchesSelectedComplex(item, currentTag)) return false;
  if (!currentMajor) return true;
  const cat = normalizeListingCategory(item);
  if (cat.majorKey !== currentMajor) return false;
  if (currentSub) return cat.subCategory === currentSub;
  return true;
}

// "임대"는 전세·월세를 모두 포함하는 상위 개념(구조화 데이터에 "임대"라는 값 자체는 존재하지 않음)
function matchesDealFilter(item) {
  if (!currentDealFilter) return false;
  if(currentDealFilter==="자가")return isOwnerOccupiedListing(item);
  const unit=item.apartmentUnitData || {};
  const deals=String(unit.거래구분 || item.dealType || item.shop_dealType || item.officetel_dealType || getTransactionType(item));
  if(["매매","전세","월세"].includes(currentDealFilter))return deals.includes(currentDealFilter);
  const t = getTransactionType(item);
  if (currentDealFilter === "임대") return t === "월세" || t === "전세";
  return t === currentDealFilter;
}

// 유형별 필터와 거래유형 필터는 AND(교집합)로 결합한다: 둘 다 선택 시 (유형 일치) AND (거래유형 일치).
// 하나만 선택된 경우 그 조건만 적용, 둘 다 미선택이면 전체 노출.
function matchesAllFilters(item) {
  if (currentMajor && !matchesCategoryFilter(item)) return false;
  if (currentDealFilter && !matchesDealFilter(item)) return false;
  return true;
}

// 유형·거래유형·검색 조건만 적용한 목록 (컬럼 필터·정렬 전) — 컬럼 필터의 값 목록 계산에도 쓴다.
function matchesKindTab(item) {
  if (currentKindTab === "전체") return true;
  return currentKindTab === "명단" ? isRosterListing(item) : !isRosterListing(item);
}

function updateKindTabCounts() {
  const live = allListings.filter(x => currentStatusFilter==="전체" || listingProgressStatus(x)===currentStatusFilter);
  const roster = live.filter(isRosterListing).length;
  const set = (id, n) => { const el = document.getElementById(id); if (el) el.textContent = `(${n})`; };
  set("kindCountListing", live.length - roster);
  set("kindCountRoster", roster);
  set("kindCountAll", live.length);
  document.querySelectorAll("#kindTabRow .kind-tab").forEach(b => b.classList.toggle("active", b.dataset.kind === currentKindTab));
}

function getBaseFilteredListings() {
  let filtered = allListings.filter(item => {
    if (!matchesKindTab(item)) return false;
    if(currentStatusFilter!=="전체" && listingProgressStatus(item)!==currentStatusFilter)return false;
    return matchesAllFilters(item);
  });
  if (searchKeyword) {
    const kw = searchKeyword.toLowerCase();
    filtered = filtered.filter(item => matchesKeyword(item, kw));
  }
  return filtered;
}

function getFilteredListings() {
  let filtered = getBaseFilteredListings();
  if (viewMode === "card" && columnFilterCount()) filtered = filtered.filter(item => matchesColumnFilters(item));
  filtered.sort((a, b) => {
    const da = new Date(a.created_at || 0);
    const db = new Date(b.created_at || 0);
    return currentSort === "newest" ? db - da : da - db;
  });
  if (listingColumnSort.length) filtered.sort((a,b)=>{
    for (const {key,direction} of listingColumnSort) {
      const av=listingColumnValue(a,key), bv=listingColumnValue(b,key);
      const comparison=typeof av==="number" && typeof bv==="number" ? av-bv : String(av).localeCompare(String(bv),"ko",{numeric:true});
      if (comparison) return comparison*direction;
    }
    return 0;
  });
  return filtered;
}

function renderPagination(total) {
  const totalPages = Math.ceil(total / ITEMS_PER_PAGE);
  paginationEl.innerHTML = "";
  if (totalPages <= 1) return;

  const prev = document.createElement("button");
  prev.className = "page-btn" + (currentPage === 1 ? " disabled" : "");
  prev.textContent = "‹ 이전";
  prev.onclick = () => { if (currentPage > 1) { currentPage--; renderList(); } };
  paginationEl.appendChild(prev);

  const info = document.createElement("span");
  info.className = "page-info";
  info.textContent = `${currentPage} / ${totalPages}`;
  paginationEl.appendChild(info);

  const next = document.createElement("button");
  next.className = "page-btn" + (currentPage === totalPages ? " disabled" : "");
  next.textContent = "다음 ›";
  next.onclick = () => { if (currentPage < totalPages) { currentPage++; renderList(); } };
  paginationEl.appendChild(next);
}


/* ══════════════════════════════════════════
   단지 드롭다운 — 등록된 매물의 아파트(단지)명 명단을 자동으로 채운다.
   값: "" = 전체, 기존 키(예: 힐스테이트더운정), "apt:<전체 단지명>" = 명단에서 고른 단지
══════════════════════════════════════════ */
const COMPLEX_APT_PREFIX = "apt:";
function getListingComplexFullName(item) {
  const u = (item && item.apartmentUnitData) || {};
  return String(u.아파트명 || (item && (item.complexName || item.buildingName)) || "").trim();
}
function matchesSelectedComplex(item, tag) {
  if (String(tag).startsWith(COMPLEX_APT_PREFIX)) return getListingComplexFullName(item) === tag.slice(COMPLEX_APT_PREFIX.length);
  return matchesComplexTag(item, tag);
}
let _complexOptionsSig = "";
function refreshComplexFilterOptions() {
  // 현재 선택한 단지는 빼고(유형·거래유형·검색 조건만 반영) 명단을 만든다.
  const keep = currentTag;
  currentTag = "";
  let items;
  try { items = getBaseFilteredListings(); } finally { currentTag = keep; }
  const counts = new Map();
  items.forEach(i => {
    const name = getListingComplexFullName(i);
    if (!name || COMPLEX_TAG_MATCHERS[name]) return; // 힐스테이트더운정은 기존 항목이 담당
    counts.set(name, (counts.get(name) || 0) + 1);
  });
  if (keep.startsWith(COMPLEX_APT_PREFIX) && !counts.has(keep.slice(COMPLEX_APT_PREFIX.length))) counts.set(keep.slice(COMPLEX_APT_PREFIX.length), 0);
  const names = [...counts.keys()].sort((a, b) => a.localeCompare(b, "ko", { numeric: true }));
  const sig = keep + "|" + names.map(n => n + ":" + counts.get(n)).join("|");
  if (sig === _complexOptionsSig) return;
  _complexOptionsSig = sig;
  const opt = (value, label) => `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`;
  complexFilterSelect.innerHTML =
    opt("", "전체 단지") +
    Object.keys(COMPLEX_TAG_MATCHERS).map(k => opt(k, k)).join("") +
    (names.length ? `<optgroup label="등록된 단지 명단 (${names.length}곳)">` +
      names.map(n => opt(COMPLEX_APT_PREFIX + n, `${n} (${counts.get(n)})`)).join("") + `</optgroup>` : "");
  complexFilterSelect.value = keep;
  if (complexFilterSelect.value !== keep) { currentTag = ""; complexFilterSelect.value = ""; }
}

function isOwnerOccupiedListing(item){
  const unit=item.apartmentUnitData || {};
  return (unit.세입자현황 || unit.공실여부 || item.세입자현황 || item.tenantStatus || item.occupancyStatus || "")==="자가거주";
}
function renderApartmentDealSummary(){
  const host=document.getElementById("apartmentDealSummary");
  const isApartment=item=>item.type==="apartment" || normalizeListingCategory(item).subCategory==="아파트";
  const visible=currentMajor==="주거용" && (currentSub==="" || currentSub==="아파트") &&
    (currentSub==="아파트" || (currentTag && allListings.some(item=>isApartment(item)&&matchesSelectedComplex(item,currentTag))));
  host.hidden=!visible;if(!visible)return;
  const selected=currentDealFilter;let items;
  currentDealFilter="";
  try{items=getBaseFilteredListings().filter(isApartment);if(viewMode==="card" && columnFilterCount())items=items.filter(item=>matchesColumnFilters(item));}
  finally{currentDealFilter=selected;}
  const counts={};
  for(const deal of ["매매","전세","월세","자가"]){
    currentDealFilter=deal;
    try{counts[deal]=items.filter(matchesDealFilter).length;}finally{currentDealFilter=selected;}
  }
  host.innerHTML=["매매","전세","월세","자가"].map((deal,index)=>'<button type="button" class="apartment-deal-total apartment-deal-'+index+(selected===deal?' active':'')+'" data-apartment-deal="'+deal+'" aria-pressed="'+(selected===deal)+'"><strong>'+counts[deal]+'</strong><span>'+deal+'</span></button>').join("");
  host.querySelectorAll('[data-apartment-deal]').forEach(btn=>btn.onclick=()=>{
    currentDealFilter=currentDealFilter===btn.dataset.apartmentDeal?"":btn.dataset.apartmentDeal;
    currentPage=1;renderDealFilterRow();renderList();saveFilterState();
  });
}

function renderList() {
  pruneSelectedIds();
  refreshComplexFilterOptions();
  updateKindTabCounts();
  renderApartmentDealSummary();
  listingContainer.innerHTML = "";
  const unifiedPropertyLabel = document.getElementById("unifiedPropertyLabel");
  const unifiedDoneSection   = document.getElementById("unifiedDoneSection");
  unifiedPropertyLabel.style.display = "none";
  unifiedDoneSection.style.display   = "none";

  const filtered = getFilteredListings();
  countBadge.textContent = filtered.length ? `(${filtered.length}건)` : "";

  if (!filtered.length) {
    const cardSelectBar = document.getElementById("cardSelectBar");
    if (cardSelectBar) cardSelectBar.style.display = "none";
    emptyMessage.style.display = "block";
    paginationEl.innerHTML = "";
    // 열 필터 때문에 0건이 된 경우에도 머리글(필터 해제 버튼)을 남겨, 스스로 풀 수 있게 한다.
    if (viewMode === "card" && columnFilterCount()) listingContainer.appendChild(makeListingColumnHeader());
    updatePrintBtn();
    return;
  }
  emptyMessage.style.display = "none";

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  if (currentPage > totalPages) currentPage = totalPages;
  const start = (currentPage - 1) * ITEMS_PER_PAGE;
  const pageItems = filtered.slice(start, start + ITEMS_PER_PAGE);

  const cardSelectBar = document.getElementById("cardSelectBar");
  const cardSelectAll = document.getElementById("cardSelectAll");

  if (viewMode === "list") {
    cardSelectBar.style.display = "none";
    _currentListItems = pageItems;
    renderListView(pageItems);
    renderPagination(filtered.length);
    updatePrintBtn();
    return;
  }

  const allChk = pageItems.length > 0 && pageItems.every(i => selectedIds.has(i.id));
  cardSelectBar.style.display = "flex";
  cardSelectAll.checked = allChk;
  _currentCardItems = pageItems;

  listingContainer.appendChild(makeListingColumnHeader());
  pageItems.forEach(item => listingContainer.appendChild(makeCard(item)));

  renderPagination(filtered.length);
  updatePrintBtn();
}

// 인쇄
document.getElementById("printBtn").addEventListener("click", printSelected);
document.getElementById("deleteSelectedBtn")?.addEventListener("click", deleteSelectedListings);

function doSearch() {
  searchKeyword = document.getElementById("searchInput").value.trim();
  currentPage = 1;
  renderList();
  saveFilterState();
}
document.getElementById("searchInput").addEventListener("keydown", (e) => {
  if (e.key === "Enter") doSearch();
});
document.getElementById("searchBtn")?.addEventListener("click", doSearch);

document.querySelectorAll("#kindTabRow .kind-tab").forEach(btn => {
  btn.addEventListener("click", () => {
    currentKindTab = btn.dataset.kind;
    currentPage = 1;
    renderList();
  });
});
document.getElementById("listingStatusFilter").addEventListener("change",e=>{
  currentStatusFilter=e.target.value;includeCompleted=currentStatusFilter==="전체"||currentStatusFilter==="거래완료";
  document.getElementById("includeCompletedChk").checked=includeCompleted;currentPage=1;renderList();saveFilterState();
});
document.getElementById("includeCompletedChk").addEventListener("change", (e) => {
  includeCompleted = e.target.checked;
  currentPage = 1;
  renderList();
  saveFilterState();
});

document.getElementById("sortSelect").addEventListener("change", (e) => {
  currentSort = e.target.value;
  currentPage = 1;
  renderList();
  saveFilterState();
});

function renderSubFilterRow() {
  const standard = PROPERTY_CATEGORY_STANDARD[currentMajor];
  if (!standard) {
    subFilterRow.style.display = "none";
    subFilterRow.innerHTML = "";
    return;
  }
  subFilterRow.style.display = "flex";
  subFilterRow.innerHTML = [`<button class="filter-btn sub active" data-sub="">전체</button>`]
    .concat(standard.children.map(c => `<button class="filter-btn sub" data-sub="${c}">${c}</button>`))
    .join("");
  subFilterRow.querySelectorAll(".filter-btn.sub").forEach(btn => {
    btn.addEventListener("click", () => {
      subFilterRow.querySelectorAll(".filter-btn.sub").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      currentSub = btn.dataset.sub;
      updateComplexFilterVisibility();
      currentPage = 1;
      renderList();
      saveFilterState();
    });
  });
}

// 거래유형 필터 — 기본은 [매매][임대], "주거용" 선택 시에는 [매매][전세][월세]로 교체된다.
// 유형별 필터와 별개로 클릭 시 즉시 재조회되며, 이미 활성화된 버튼을 다시 누르면 선택 해제된다.
function renderDealFilterRow() {
  const options = currentMajor === "주거용" ? ["매매", "전세", "월세", "자가"] : ["매매", "임대"];
  if (currentDealFilter && !options.includes(currentDealFilter)) currentDealFilter = "";
  dealFilterRow.innerHTML = options.map(v =>
    `<button class="filter-btn deal${v === currentDealFilter ? " active" : ""}" data-deal="${v}">${v}</button>`
  ).join("");
  dealFilterRow.querySelectorAll(".filter-btn.deal").forEach(btn => {
    btn.addEventListener("click", () => {
      currentDealFilter = currentDealFilter === btn.dataset.deal ? "" : btn.dataset.deal;
      dealFilterRow.querySelectorAll(".filter-btn.deal").forEach(b =>
        b.classList.toggle("active", b.dataset.deal === currentDealFilter)
      );
      currentPage = 1;
      renderList();
      saveFilterState();
    });
  });
}

// 단지(예: 힐스테이트더운정) 드롭다운은 "주거용" 전체/아파트/오피스텔에서만 노출한다.
// 단독주택·전원주택·상가주택·다가구주택 및 다른 대분류에서는 숨기고, 숨겨질 때는 선택값도 초기화한다.
function updateComplexFilterVisibility() {
  const visible = currentMajor === "주거용" && (currentSub === "" || currentSub === "아파트" || currentSub === "오피스텔");
  complexFilterWrap.style.display = visible ? "" : "none";
  if (!visible && currentTag) {
    currentTag = "";
    complexFilterSelect.value = "";
  }
}

filterRow.querySelectorAll(".filter-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    filterRow.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    currentMajor = btn.dataset.major;
    currentSub = "";
    renderSubFilterRow();
    renderDealFilterRow();
    updateComplexFilterVisibility();
    currentPage = 1;
    renderList();
    saveFilterState();
  });
});

// 단지 필터 — 매물유형(대분류/세부) 필터와 별개로 AND 결합되는 드롭다운.
complexFilterSelect.addEventListener("change", () => {
  currentTag = complexFilterSelect.value;
  currentPage = 1;
  renderList();
  saveFilterState();
});

/* ══════════════════════════════════════════
   엑셀 다운로드 = 전체 백업
   - 화면 필터·검색·"거래완료 포함" 체크와 무관하게 DB에 저장된 모든 매물(거래완료 포함)을 받는다.
   - 엑셀(사람이 보는 용) + JSON(복원용 원본)을 함께 내려받는다.
   - 엑셀은 2개 시트: ① 매물목록(읽기 좋게 정리) ② 매물_전체필드(저장된 모든 필드를 원본 값 그대로)
══════════════════════════════════════════ */
function _xlsxDate() {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,"0")}${String(d.getDate()).padStart(2,"0")}`;
}
function _makeSheet(rows) {
  return XLSX.utils.json_to_sheet(rows.length ? rows : [{}]);
}

// 엑셀 셀 하나에 들어갈 수 있는 글자 수(32,767)를 넘기지 않도록 하고, 객체·배열은 JSON 글자로 바꾼다.
function _backupCell(v) {
  if (v === null || v === undefined) return "";
  if (typeof v === "object") {
    try { v = JSON.stringify(v); } catch (e) { v = String(v); }
  }
  if (typeof v === "string" && v.length > 32000) return v.slice(0, 32000) + "…(이하 생략 — JSON 파일에 전체 보관)";
  return v;
}
function _backupNum(v) {
  if (v === null || v === undefined || v === "") return "";
  const n = Number(String(v).replace(/,/g, ""));
  return isFinite(n) ? n : String(v);
}
function _backupDateTime(v) {
  if (!v) return "";
  const d = new Date(v);
  if (isNaN(d.getTime())) return String(v);
  const p = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
function _backupBlankDash(v) {
  const s = String(v ?? "").trim();
  return s === "-" ? "" : s;
}

// 한글 등 전각 문자는 2칸으로 계산해 컬럼 폭을 맞춘다.
function _backupTextWidth(s) {
  let w = 0;
  for (const ch of String(s)) w += ch.charCodeAt(0) > 0x2e80 ? 2 : 1;
  return w;
}
function _backupSheet(rows, headers) {
  const ws = XLSX.utils.json_to_sheet(rows, { header: headers });
  ws["!cols"] = headers.map(h => {
    let w = _backupTextWidth(h);
    for (let i = 0; i < rows.length && i < 300; i++) {
      const cell = rows[i][h];
      if (cell === "" || cell === null || cell === undefined) continue;
      const line = String(cell).split(/\r?\n/)[0];
      w = Math.max(w, _backupTextWidth(line));
    }
    return { wch: Math.min(Math.max(w + 2, 8), 50) };
  });
  if (ws["!ref"]) ws["!autofilter"] = { ref: ws["!ref"] };
  return ws;
}

// ① 읽기 좋게 정리한 시트 — 화면에 보이는 항목 + 숫자 컬럼(정렬·합계용)
function _buildListingReadableRows(rawRows) {
  const headers = [
    "매물번호","등록구분","상태","매물종류","세부구분","거래유형","마을단지","아파트명(단지)","동","호수",
    "매물명","주소","공개주소","면적(표시)","전용면적(평)","공급·분양면적(평)","대지면적(평)","가격(표시)",
    "매매가(원)","분양가(원)","보증금(원)","월세(원)","전세가(만원)",
    "소유주","연락처1","연락처2","설명","빠른메모","소유주메모",
    "홈페이지공개","사진수","등록일","수정일","ID"
  ];
  const rows = rawRows.map(r => {
    const x = normalizeListingRow(r);
    const cat = (typeof normalizeListingCategory === "function" ? normalizeListingCategory(x) : null) || {};
    return {
      "매물번호": _backupBlankDash(getListingNumber(x)),
      "등록구분": isRosterListing(x) ? "명단" : "매물",
      "상태": getStatusLabel(x),
      "매물종류": getListingCategoryLabel(x),
      "세부구분": cat.subCategory || "",
      "거래유형": getTransactionType(x),
      "마을단지": listingColumnValue(x, "village"),
      "아파트명(단지)": listingColumnValue(x, "apartment"),
      "동": listingColumnValue(x, "dong"),
      "호수": listingColumnValue(x, "room"),
      "매물명": _backupBlankDash(getListingName(x)),
      "주소": x.address || "",
      "공개주소": x.publicAddress || "",
      "면적(표시)": _backupBlankDash(getAreaText(x)),
      "전용면적(평)": _backupNum(x.areaExclusivePy || x.exclusiveAreaPy),
      "공급·분양면적(평)": _backupNum(x.areaSupplyPy || x.supplyAreaPy),
      "대지면적(평)": _backupNum(x.landAreaPy || x.land_area_py || x.land_py),
      "가격(표시)": formatPrice(x) || "",
      "매매가(원)": _backupNum(x.salePrice),
      "분양가(원)": _backupNum(x.presalePrice),
      "보증금(원)": _backupNum(x.deposit),
      "월세(원)": _backupNum(x.monthlyRent),
      "전세가(만원)": _backupNum(x.jeonsePriceManwon),
      "소유주": _backupBlankDash(getListingOwnerName(x)),
      "연락처1": _backupBlankDash(getListingPhone1(x)),
      "연락처2": getListingPhone2(x),
      "설명": _backupCell(x.description || ""),
      "빠른메모": _backupCell(x.quick_memo || ""),
      "소유주메모": _backupCell(x.owner_memo || ""),
      "홈페이지공개": x.is_public === true ? "공개" : "비공개",
      "사진수": Array.isArray(x.allImageUrls) ? x.allImageUrls.length : 0,
      "등록일": _backupDateTime(x.created_at),
      "수정일": _backupDateTime(x.updated_at || x.updatedAt || x.updated_at_local),
      "ID": x.id || ""
    };
  });
  return { rows, headers };
}

// ② 저장된 모든 필드 시트 — DB 컬럼 + data(JSON) 안의 모든 키를 원본 이름·원본 값 그대로
function _buildListingAllFieldRows(rawRows) {
  const FIRST = ["id","created_at","type","title","address","status","description","category1","category2","is_public","resource_id","image_urls"];
  const topKeys = new Set();
  const dataKeys = new Set();
  const flat = rawRows.map(r => {
    const out = {};
    Object.keys(r).forEach(k => {
      if (k === "data") return;
      topKeys.add(k);
      out[k] = _backupCell(r[k]);
    });
    const data = r.data && typeof r.data === "object" ? r.data : {};
    Object.keys(data).forEach(k => {
      const key = topKeys.has(k) || Object.prototype.hasOwnProperty.call(r, k) ? "data." + k : k;
      dataKeys.add(key);
      out[key] = _backupCell(data[k]);
    });
    return out;
  });
  const ordered = [
    ...FIRST.filter(k => topKeys.has(k)),
    ...[...topKeys].filter(k => !FIRST.includes(k)).sort(),
    ...[...dataKeys].sort((a, b) => a.localeCompare(b, "ko"))
  ];
  return { rows: flat, headers: ordered };
}

function _appendListingBackupSheets(wb, rawRows) {
  const readable = _buildListingReadableRows(rawRows);
  XLSX.utils.book_append_sheet(wb, _backupSheet(readable.rows, readable.headers), "매물목록");
  const all = _buildListingAllFieldRows(rawRows);
  XLSX.utils.book_append_sheet(wb, _backupSheet(all.rows, all.headers), "매물_전체필드");
}

function _downloadJsonFile(obj, filename) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

let _excelBackupRunning = false;
async function downloadExcel() {
  if (_excelBackupRunning) return;
  _excelBackupRunning = true;
  showToast("⏳ 전체 매물을 불러오는 중...");
  try {
    const rawRows = await getListingsRaw();
    if (!rawRows.length) { showToast("⚠️ 다운로드할 매물이 없습니다."); return; }

    const stamp = _xlsxDate();
    const wb = XLSX.utils.book_new();
    _appendListingBackupSheets(wb, rawRows);
    XLSX.writeFile(wb, `${officeCompanyName}_매물백업_${stamp}.xlsx`);

    _downloadJsonFile({
      exportedAt: new Date().toISOString(),
      office: OfficeConfig.id,
      officeName: officeCompanyName,
      table: "listings",
      count: rawRows.length,
      rows: rawRows
    }, `${officeCompanyName}_매물백업_${stamp}.json`);

    const done = rawRows.filter(r => r.status === "거래완료").length;
    showToast(`✅ 전체 ${rawRows.length}건(거래완료 ${done}건 포함) 백업 완료 — 엑셀 + JSON`);
  } catch (e) {
    showToast("❌ 백업 실패: " + (e && e.message ? e.message : e));
  } finally {
    _excelBackupRunning = false;
  }
}

/* ══════════════════════════════════════════
   전체 백업 — 헤더 "📥 전체 백업" 버튼
══════════════════════════════════════════ */
function getCustomerTypeLabel(type) {
  const map = { shop:"상가/사무실", officetel:"오피스텔", land:"토지", factory:"공장/창고", bizcenter:"지식산업센터" };
  return map[type] || "미정";
}

async function exportAll() {
  showToast("⏳ 전체 데이터를 불러오는 중...");
  try {
    const [listings, requests, customers, doneCustomers, driveResources, recommended, referenceProps, memos] = await Promise.all([
      getListingsRaw(),
      getRequests(),
      getCustomers(),
      getDoneCustomers(),
      getDriveResources(),
      getRecommendedProperties(),
      getReferenceProperties(),
      getMemos()
    ]);

    const wb = XLSX.utils.book_new();

    _appendListingBackupSheets(wb, listings);

    XLSX.utils.book_append_sheet(wb, _makeSheet(requests.map(r => ({
      "고객명": r.name || "",
      "연락처": r.contact || "",
      "의뢰유형": r.reqtype || "",
      "매물유형": getTypeLabel(r.proptype),
      "희망지역": r.area || "",
      "희망가격": r.price || "",
      "메모": r.memo || "",
      "상태": r.status || "진행중"
    }))), "의뢰관리");

    const activeCustomers = customers.filter(c => c.status !== "계약완료");
    XLSX.utils.book_append_sheet(wb, _makeSheet(activeCustomers.map(c => ({
      "이름": c.name || "",
      "연락처": c.contact || "",
      "매물유형": getCustomerTypeLabel(c.type),
      "예산": c.budget || "",
      "메모": c.memo || "",
      "상태": c.status || ""
    }))), "고객관리");

    XLSX.utils.book_append_sheet(wb, _makeSheet(doneCustomers.map(c => ({
      "이름": c.name || "",
      "연락처": c.contact || "",
      "매물유형": getCustomerTypeLabel(c.type),
      "예산": c.budget || "",
      "메모": c.memo || "",
      "계약완료일": c.completed_at ? new Date(c.completed_at).toLocaleDateString("ko-KR") : ""
    }))), "완료고객");

    XLSX.utils.book_append_sheet(wb, _makeSheet(driveResources.map(r => ({
      "카테고리": r.category || "",
      "건물명": r.name || "",
      "드라이브링크": r.url || "",
      "메모": r.memo || ""
    }))), "자료보기");

    const recRows = recommended.map(p => ({
      "매물장이름": p.name || "",
      "날짜": p.received_date ? new Date(p.received_date + "T00:00:00").toLocaleDateString("ko-KR") : "",
      "메모": p.memo || ""
    }));
    XLSX.utils.book_append_sheet(wb, _makeSheet(recRows), "추천매물장");

    XLSX.utils.book_append_sheet(wb, _makeSheet(referenceProps.map(p => ({
      "유형": p.property_type || "",
      "위치": p.location || "",
      "가격": p.price || "",
      "연락처": p.contact || "",
      "메모": p.memo || "",
      "등록일": p.created_at ? new Date(p.created_at).toLocaleDateString("ko-KR") : ""
    }))), "참고매물");

    XLSX.utils.book_append_sheet(wb, _makeSheet(memos.map(m => ({
      "제목": m.title || "",
      "내용": m.content || "",
      "건물명": m.building_name || "",
      "등록일": m.created_at ? new Date(m.created_at).toLocaleDateString("ko-KR") : ""
    }))), "메모장");

    XLSX.writeFile(wb, `${officeCompanyName}_전체백업_${_xlsxDate()}.xlsx`);
    showToast("✅ 전체 백업 파일이 저장되었습니다");
  } catch (e) {
    showToast("❌ 백업 실패: " + e.message);
  }
}

// ===== 계약문자 모달 =====
function openContractModal() {
  document.getElementById('contractModal').style.display = 'flex';
  const today = new Date().toISOString().slice(0, 10);
  if (!document.getElementById('cm_send_date').value)
    document.getElementById('cm_send_date').value = today;
  if (!document.getElementById('cm_contract_date').value)
    document.getElementById('cm_contract_date').value = today;
}

function closeContractModal() {
  document.getElementById('contractModal').style.display = 'none';
}

document.getElementById('contractModal').addEventListener('click', function(e) {
  if (e.target === this) closeContractModal();
});

function cmToggle(btn) {
  const group = btn.dataset.group;
  document.querySelectorAll(`[data-group="${group}"]`).forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

function cmTogglePartial() {
  const isPartial = document.querySelector('[data-group="cm_pay_method"].active')?.dataset.val === '일부입금';
  document.getElementById('cm_partial_section').style.display = isPartial ? 'block' : 'none';
  cmCalc();
}

function cmToggleMortgage() {
  document.getElementById('cm_mortgage_section').style.display =
    document.getElementById('cm_mortgage_chk').checked ? 'block' : 'none';
}

function cmToggleCoop() {
  document.getElementById('cm_coop_section').style.display =
    document.getElementById('cm_coop_chk').checked ? 'block' : 'none';
}

function cmCalc() {
  const deposit = parseInt(document.getElementById('cm_deposit').value) || 0;
  const earnest = parseInt(document.getElementById('cm_earnest').value) || 0;
  const partial = parseInt(document.getElementById('cm_partial_amount').value) || 0;

  const balance = deposit - earnest;
  document.getElementById('cm_balance_display').textContent =
    (deposit || earnest) ? `${balance.toLocaleString()}만원` : '— 만원';

  const remaining = earnest - partial;
  document.getElementById('cm_remaining_display').textContent =
    earnest ? `잔여계약금: ${remaining.toLocaleString()}만원` : '잔여계약금: — 만원';
}

function cmCalcEndDate() {
  const balanceDate = document.getElementById('cm_balance_date').value;
  const period = parseInt(document.querySelector('[data-group="cm_period"].active')?.dataset.val || '12');
  if (!balanceDate) {
    document.getElementById('cm_period_display').textContent = '계약기간: —';
    return;
  }
  const start = new Date(balanceDate);
  const end = new Date(balanceDate);
  end.setMonth(end.getMonth() + period);
  const fmt = d =>
    `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}`;
  document.getElementById('cm_period_display').textContent =
    `계약기간: ${fmt(start)} ~ ${fmt(end)} (${period}개월)`;
}

function cmFmtDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}`;
}

function cmGenerate() {
  const complex     = document.getElementById('cm_complex').value.trim();
  const dong        = document.getElementById('cm_dong').value.trim();
  const ho          = document.getElementById('cm_ho').value.trim();
  const usage       = document.querySelector('[data-group="cm_usage"].active')?.dataset.val || '업무용';
  const isBiz       = usage === '업무용';

  const depositNum  = parseInt(document.getElementById('cm_deposit').value) || 0;
  const monthlyNum  = parseInt(document.getElementById('cm_monthly').value) || 0;
  const payTiming   = document.querySelector('[data-group="cm_pay_timing"].active')?.dataset.val || '선불';

  const earnest     = parseInt(document.getElementById('cm_earnest').value) || 0;
  const isPartial   = document.querySelector('[data-group="cm_pay_method"].active')?.dataset.val === '일부입금';
  const partialAmt  = parseInt(document.getElementById('cm_partial_amount').value) || 0;
  const remaining   = earnest - partialAmt;
  const balance     = depositNum - earnest;

  const balanceDate    = document.getElementById('cm_balance_date').value;
  const contractDate   = document.getElementById('cm_contract_date').value;
  const contractTime   = document.getElementById('cm_contract_time').value;
  const period         = parseInt(document.querySelector('[data-group="cm_period"].active')?.dataset.val || '12');
  const sendDate       = document.getElementById('cm_send_date').value;

  const mortgageChk    = document.getElementById('cm_mortgage_chk').checked;
  const mortgageAmt    = document.getElementById('cm_mortgage_amount').value.trim();
  const coopChk        = document.getElementById('cm_coop_chk').checked;
  const coopName       = document.getElementById('cm_coop_name').value.trim();

  const owner   = document.getElementById('cm_owner').value.trim();
  const bank    = document.getElementById('cm_bank').value.trim();
  const account = document.getElementById('cm_account').value.trim();
  const special = document.getElementById('cm_special').value.trim();

  let periodStr = '—';
  if (balanceDate) {
    const s = new Date(balanceDate);
    const e = new Date(balanceDate);
    e.setMonth(e.getMonth() + period);
    const fmt = d =>
      `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}`;
    periodStr = `${fmt(s)}~${fmt(e)}(${period}개월)`;
  }

  const greeting = (coopChk && coopName)
    ? `안녕하세요. ${officeCompanyName}${OfficeConfig.id === 'ktop' ? '' : '(031-949-8969)'}과\n${coopName}입니다.`
    : `안녕하세요. ${officeCompanyName}${OfficeConfig.id === 'ktop' ? '' : '(031-949-8969)'}입니다.`;

  const usageText = isBiz ? '업무용(전입신고안됨)' : '주거용(전입신고됨)';

  const monthlyLine = isBiz
    ? `월세: ${monthlyNum.toLocaleString()}만원 ${payTiming} (부가세 10% 별도)`
    : `월세: ${monthlyNum.toLocaleString()}만원 ${payTiming}`;

  let earnestBlock = `계약금: ${earnest.toLocaleString()}만원`;
  if (isPartial) {
    earnestBlock += `\n- 오늘입금: ${partialAmt.toLocaleString()}만원 (${cmFmtDate(sendDate)})`;
    earnestBlock += `\n- 잔여계약금: ${remaining.toLocaleString()}만원 (계약서 작성시 입금)`;
  }

  const specialLines = [];
  if (mortgageChk && mortgageAmt) {
    specialLines.push(
      `현재 등기상 근저당권(채권최고액 ${mortgageAmt}원)이 설정되어 있으며\n  임차인은 이를 확인하고 동의합니다.`
    );
  }
  if (isBiz) {
    specialLines.push(
      `임차인은 업무용으로 사용하며 전입신고불가하며,\n  임차인의 전입신고로 인한 임대인의 피해 발생시 임차인이 부담하여야 한다.`
    );
  }
  specialLines.push(`임차인이 사정상 중도해지시 중개수수료는 임차인이 부담한다.`);
  if (isBiz) {
    specialLines.push(`월차임에 부가세 10% 별도이며 세금계산서를 발행합니다.`);
  }
  if (special) {
    special.split('\n').filter(l => l.trim()).forEach(l => specialLines.push(l.trim()));
  }
  const specialBlock = specialLines.map(l => `- ${l}`).join('\n');

  const text =
`${greeting}

[${complex || '단지명'} 오피스텔 월세계약 내용]

[계약 물건 정보]
소재지: 경기도 파주시 와동동 XXXX
${complex || '단지명'} 오피스텔 ${dong || '동'}동 ${ho || '호수'}호
용도: ${usageText}
계약기간: ${periodStr}

[계약 조건]
보증금: ${depositNum.toLocaleString()}만원
${monthlyLine}
${earnestBlock}
잔금: ${balance.toLocaleString()}만원 (${cmFmtDate(balanceDate)})
계약서작성일: ${cmFmtDate(contractDate)} ${contractTime}

[특약사항]
${specialBlock}

본 문자는 계약의 효력이 있습니다.
정식 계약 이전 해제시 임차인은 입금액의 계약금을 포기하고,
임대인은 받은 금액의 2배를 반환합니다.
이에 동의하시면 임대인은 입금계좌번호를 보내주시고,
임차인은 임대인 계좌로 입금하시면 계약이 성립됩니다.

[임대인 계좌]
${bank} ${account} (${owner})

${cmFmtDate(sendDate)}`;

  document.getElementById('cm_output').value = text;
}

function cmCopy() {
  const ta = document.getElementById('cm_output');
  if (!ta.value.trim()) { showToast('먼저 문자를 생성해주세요.'); return; }
  navigator.clipboard.writeText(ta.value).then(() => {
    showToast('📋 클립보드에 복사되었습니다!');
  }).catch(() => {
    ta.select();
    document.execCommand('copy');
    showToast('📋 복사되었습니다!');
  });
}

// ===== 업무일지 매물보내기 연동 =====
// 빠른저장 폼이 사라졌으므로, ?memo= 등으로 진입하면 register.html의 상세등록 폼으로
// 넘겨준다. register.html은 sessionStorage("hitop_detail_prefill")를 읽어
// quick_memo→내부 메모(비공개, description 필드), quick_contact→연락처1, quick_location→참고 위치,
// type→1차구분으로 자동입력하는 기존 로직(빠른저장→상세저장 전환과 동일 경로)을 그대로 재사용한다.
// 공개 매물설명(detailDescription)에는 자동입력하지 않는다 — 공개 여부는 등록자가 직접 판단해 입력한다.
(function () {
  const params = new URLSearchParams(window.location.search);
  const memo = params.get('memo');
  if (!memo) return;

  const prefill = {
    type:           params.get('type') || params.get('property_type') || '',
    quick_price:    '',
    quick_contact:  params.get('contact') || params.get('customerPhone') || '',
    quick_memo:     memo,
    drive_links:    [],
    quick_location: params.get('address') || '',
    source_id:      params.get('diaryId') || null,
    title:          params.get('title') || '',
    customerName:   params.get('customerName') || '',
    customerPhone:  params.get('customerPhone') || params.get('contact') || '',
    photos:         params.get('photos') || ''
  };
  OfficeStorage.session.setItem('hitop_detail_prefill', JSON.stringify(prefill));
  location.replace('register.html');
})();

// ===== 필터·보기 상태 저장/복원 (매물 상세·등록 화면을 왕복해도 유지) =====
const FILTER_STATE_KEY = "hitop_properties_filter_state";

function saveFilterState() {
  try {
    OfficeStorage.session.setItem(FILTER_STATE_KEY, JSON.stringify({
      searchKeyword, currentMajor, currentSub, currentTag, currentDealFilter,
      includeCompleted, currentStatusFilter, currentKindTab, currentSort, viewMode, columnFilters: listingColumnFilters,
      scrollY: window.scrollY
    }));
  } catch (e) { /* 세션스토리지 사용 불가 시 조용히 무시 */ }
}

let _restoredScrollY = null;

function restoreFilterState() {
  let saved = null;
  try { saved = JSON.parse(OfficeStorage.session.getItem(FILTER_STATE_KEY) || "null"); } catch (e) { saved = null; }
  if (saved) {
    searchKeyword = saved.searchKeyword || "";
    document.getElementById("searchInput").value = searchKeyword;

    currentSort = saved.currentSort === "oldest" ? "oldest" : "newest";
    document.getElementById("sortSelect").value = currentSort;

    listingColumnFilters = {};
    if (saved.columnFilters && typeof saved.columnFilters === "object") {
      Object.keys(saved.columnFilters).forEach(k => { if (LISTING_FILTER_COLUMNS[k] && saved.columnFilters[k]) listingColumnFilters[k] = saved.columnFilters[k]; });
    }

    currentStatusFilter=["진행중","보류","거래완료","전체"].includes(saved.currentStatusFilter)?saved.currentStatusFilter:"진행중";
    document.getElementById("listingStatusFilter").value=currentStatusFilter;
    includeCompleted=currentStatusFilter==="전체"||currentStatusFilter==="거래완료";
    if (["매물","명단","전체"].includes(saved.currentKindTab)) currentKindTab = saved.currentKindTab;
    document.getElementById("includeCompletedChk").checked = includeCompleted;

    currentMajor = saved.currentMajor && PROPERTY_CATEGORY_STANDARD[saved.currentMajor] ? saved.currentMajor : "";
    filterRow.querySelectorAll(".filter-btn").forEach(b => b.classList.toggle("active", b.dataset.major === currentMajor));
    renderSubFilterRow();
    currentDealFilter = saved.currentDealFilter || "";
    renderDealFilterRow();

    if (currentMajor && saved.currentSub) {
      const subBtn = subFilterRow.querySelector(`.filter-btn.sub[data-sub="${CSS.escape(saved.currentSub)}"]`);
      if (subBtn) {
        subFilterRow.querySelectorAll(".filter-btn.sub").forEach(b => b.classList.remove("active"));
        subBtn.classList.add("active");
        currentSub = saved.currentSub;
      }
    }

    updateComplexFilterVisibility();
    if (saved.currentTag && complexFilterWrap.style.display !== "none") {
      currentTag = saved.currentTag;
      complexFilterSelect.value = currentTag;
    }

    setViewMode(saved.viewMode === "list" ? "list" : "card", { skipRender: true });

    if (typeof saved.scrollY === "number") _restoredScrollY = saved.scrollY;
  } else {
    updateComplexFilterVisibility(); // 저장된 상태가 없는 첫 진입 — 기본값(전체 매물)에서는 숨김
    renderDealFilterRow();
  }
}

restoreFilterState();

// 다른 화면(register.html/detail.html)으로 이동하기 직전 스크롤 위치까지 최종 저장.
window.addEventListener("beforeunload", saveFilterState);

// 상단 메뉴 "업무도구"에서 전체 백업/계약문자를 누르고 다른 화면에서 넘어온 경우 자동 실행.
(function handleNavAction() {
  const action = new URLSearchParams(location.search).get("navAction");
  if (action === "exportAll" && typeof exportAll === "function") exportAll();
  if (action === "openContractModal" && typeof openContractModal === "function") openContractModal();
})();

// ===== 초기 로딩 =====
loadListings().then(() => {
  if (_restoredScrollY != null) {
    window.scrollTo(0, _restoredScrollY);
    _restoredScrollY = null;
  }
});
