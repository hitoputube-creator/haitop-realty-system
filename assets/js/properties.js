// ===== 등록 방식 선택 =====
function selectRegMode(mode) {
  const quickForm = document.getElementById("quickRegisterForm");
  const quickBtn  = document.getElementById("modeQuickBtn");
  const detailBtn = document.getElementById("modeDetailBtn");
  if (mode === "quick") {
    quickForm.style.display = "";
    quickBtn.classList.add("active");
    detailBtn.classList.remove("active");
    quickForm.scrollIntoView({ behavior: "smooth", block: "nearest" });
  } else {
    location.href = "register.html";
  }
}

// ===== 상세저장으로 전환 (빠른저장 → 상세저장) =====
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
  sessionStorage.setItem("hitop_detail_prefill", JSON.stringify(prefill));
  location.href = "register.html";
}

// ===== 드라이브 링크 헬퍼 (빠른 등록 폼) =====
function addQuickLinkRow(name, url) {
  const c = document.getElementById("q_links_container");
  const row = document.createElement("div");
  row.className = "ql-row";
  row.style.cssText = "display:flex;gap:5px;align-items:center;margin-bottom:5px;";
  row.innerHTML = `
    <input type="text" value="${name||""}" placeholder="이름 (예: 토지대장)"
      style="width:110px;flex-shrink:0;" />
    <input type="text" value="${url||""}" placeholder="https://drive.google.com/..."
      style="flex:1;" />
    <button onclick="this.closest('.ql-row').remove()"
      style="background:none;border:none;color:var(--red,#e05252);cursor:pointer;font-size:1.1rem;padding:0 4px;flex-shrink:0;">✕</button>
  `;
  c.appendChild(row);
}
function getQuickLinks() {
  return [...document.querySelectorAll("#q_links_container .ql-row")].map(row => {
    const ins = row.querySelectorAll("input");
    return { name: ins[0].value.trim(), url: ins[1].value.trim() };
  }).filter(l => l.url);
}

// ===== 매물관리 =====
const listingContainer = document.getElementById("listingContainer");
const emptyMessage = document.getElementById("emptyMessage");
const filterRow = document.getElementById("filterRow");
const countBadge = document.getElementById("countBadge");
const paginationEl = document.getElementById("pagination");

let currentFilter = "all";
let searchKeyword = "";
let currentSort = "newest";
let currentPage = 1;
let includeCompleted = false;
let viewMode = "card"; // "card" | "list"
let selectedIds = new Set(); // 선택된 매물 ID 집합
const ITEMS_PER_PAGE = 10;

function updatePrintBtn() {
  const btn = document.getElementById("printBtn");
  const n = selectedIds.size;
  btn.textContent = n > 0 ? `🖨️ 선택인쇄 (${n}건)` : "🖨️ 선택인쇄";
  btn.disabled = n === 0;
  btn.style.opacity = n === 0 ? "0.4" : "1";
  btn.style.cursor = n === 0 ? "not-allowed" : "pointer";
}

function toggleSelect(id, checked) {
  if (checked) selectedIds.add(id); else selectedIds.delete(id);
  updatePrintBtn();
}

function toggleSelectAll(items, checked) {
  items.forEach(item => { if (checked) selectedIds.add(item.id); else selectedIds.delete(item.id); });
  updatePrintBtn();
  renderList(); // 체크박스 상태 갱신
}

// ── 선택매물보기 섹션 표시 요소 ──
const _listingSections = () => [
  document.querySelector("#tabProperty .quick-card"),
  ...document.querySelectorAll("#tabProperty > section.card:not(#selectedPreviewSection)")
];

function printSelected() {
  if (!selectedIds.size) return;
  _listingSections().forEach(el => { if (el) el.style.display = "none"; });
  document.getElementById("selectedPreviewSection").style.display = "";
  renderPreview();
}

function renderPreview() {
  const list = allListings.filter(l => selectedIds.has(l.id));
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
      <td><span style="font-size:0.75rem;padding:2px 7px;border-radius:4px;background:rgba(212,175,55,0.1);color:var(--gold);">${getTypeLabel(item.type)}</span></td>
      <td style="font-weight:500;">${item.address || item.title || ""}</td>
      <td style="font-size:0.82rem;">${formatPrice(item)}</td>
      <td style="font-size:0.8rem;color:var(--text-muted);">${owner}</td>
      <td style="font-size:0.8rem;color:var(--text-muted);">${contact}</td>
      <td><span style="font-size:0.75rem;padding:2px 6px;border-radius:4px;background:${isDone?'rgba(238,136,136,0.15)':'rgba(82,197,100,0.12)'};color:${isDone?'#e88':'#52c564'};">${isDone?"완료":(item.status||"광고중")}</span></td>
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

function setViewMode(mode) {
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
  currentPage = 1;
  renderList();
  updatePrintBtn();
}

function renderListView(items) {
  if (!items.length) {
    listingContainer.innerHTML = `<div style="font-size:0.82rem;color:var(--text-muted);padding:20px 0;text-align:center;">등록된 매물이 없습니다.</div>`;
    return;
  }
  const allChecked = items.length > 0 && items.every(i => selectedIds.has(i.id));
  const rows = items.map(item => {
    const memo = (item.quick_memo || item.description || "");
    const memoShort = memo.length > 20 ? memo.substring(0, 20) + "…" : memo;
    const isDone = item.status === "거래완료";
    const owner = item.owner_name || item.quick_owner || "";
    const contact = item.owner_phone1 || item.owner_contact || item.quick_contact || "";
    const chk = selectedIds.has(item.id) ? "checked" : "";
    return `<tr class="${isDone ? "done-row" : ""}" style="cursor:pointer;">
      <td onclick="event.stopPropagation()" style="text-align:center;width:36px;">
        <input type="checkbox" data-sel="${item.id}" ${chk} style="width:auto;accent-color:var(--gold);cursor:pointer;" onchange="toggleSelect('${item.id}',this.checked)" />
      </td>
      <td onclick="location.href='detail.html?id=${item.id}'">${getTypeLabel(item.type)}</td>
      <td onclick="location.href='detail.html?id=${item.id}'">${item.address || item.title || ""}</td>
      <td onclick="location.href='detail.html?id=${item.id}'">${formatPrice(item)}</td>
      <td onclick="location.href='detail.html?id=${item.id}'">${owner}</td>
      <td onclick="location.href='detail.html?id=${item.id}'">${contact}</td>
      <td onclick="location.href='detail.html?id=${item.id}'"><span style="font-size:0.8rem;padding:2px 7px;border-radius:4px;background:${isDone ? 'rgba(238,136,136,0.15)' : 'rgba(82,197,100,0.12)'};color:${isDone ? '#e88' : '#52c564'};">${item.status || "광고중"}</span></td>
      <td onclick="event.stopPropagation();handlePublicToggle('${item.id}')" style="cursor:pointer;">${renderPublicBadge(item)}</td>
      <td onclick="location.href='detail.html?id=${item.id}'" style="color:var(--text-muted);font-size:0.78rem;">${memoShort}</td>
    </tr>`;
  }).join("");
  listingContainer.innerHTML = `<table id="listViewTable">
    <thead><tr>
      <th style="width:36px;text-align:center;">
        <input type="checkbox" id="listSelectAll" ${allChecked ? "checked" : ""} style="width:auto;accent-color:var(--gold);cursor:pointer;" onchange="toggleSelectAll(_currentListItems,this.checked)" />
      </th>
      <th style="width:80px;">유형</th>
      <th>주소</th>
      <th style="width:150px;">가격</th>
      <th style="width:80px;">소유주</th>
      <th style="width:110px;">연락처</th>
      <th style="width:72px;">상태</th>
      <th style="width:90px;">공개</th>
      <th style="width:140px;">메모</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
  _currentListItems = items; // 전체선택용 참조 저장
}
let _currentListItems = [];
let _currentCardItems = [];

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

function mapTypeToFilter(type) {
  if (type === "shop") return "shop";
  if (type === "office") return "office";
  if (type === "officetel") return "officetel";
  if (type === "hilsstate") return "hilsstate";
  if (type && type.startsWith("land")) return "land";
  if (type === "factory") return "factory";
  if (type === "bizcenter") return "bizcenter";
  if (type === "etc") return "etc";
  return "other";
}

function getFilteredListings() {
  let filtered = allListings.filter(item => {
    if (currentFilter === "done") return item.status === "거래완료";
    if (item.status === "거래완료") return false;
    if (currentFilter === "all") return true;
    return mapTypeToFilter(item.type) === currentFilter;
  });
  if (searchKeyword) {
    const kw = searchKeyword.toLowerCase();
    filtered = filtered.filter(item => {
      const fields = [item.title, item.address, item.quick_price, item.quick_memo, item.quick_contact, item.owner_phone1, item.owner_name, item.description].join(" ").toLowerCase();
      return fields.includes(kw);
    });
  }
  filtered.sort((a, b) => {
    const da = new Date(a.created_at || 0);
    const db = new Date(b.created_at || 0);
    return currentSort === "newest" ? db - da : da - db;
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

function renderList() {
  listingContainer.innerHTML = "";
  const unifiedPropertyLabel = document.getElementById("unifiedPropertyLabel");
  const unifiedPropertyCount = document.getElementById("unifiedPropertyCount");
  const unifiedDoneSection   = document.getElementById("unifiedDoneSection");
  const unifiedDoneCount     = document.getElementById("unifiedDoneCount");
  const unifiedDoneContainer = document.getElementById("unifiedDoneContainer");

  // ── 목록보기 모드 ──
  if (viewMode === "list") {
    unifiedPropertyLabel.style.display = "none";
    unifiedDoneSection.style.display = "none";
    paginationEl.innerHTML = "";
    emptyMessage.style.display = "none";
    const kw = searchKeyword.toLowerCase();
    let items = kw
      ? allListings.filter(item => matchesKeyword(item, kw))
      : getFilteredListings();
    if (kw) items.sort((a,b) => new Date(b.created_at||0)-new Date(a.created_at||0));
    countBadge.textContent = items.length ? `(${items.length}건)` : "";
    renderListView(items);
    return;
  }

  // 통합검색 모드
  if (searchKeyword) {
    const kw = searchKeyword.toLowerCase();
    const activeItems = allListings.filter(item => item.status !== "거래완료" && matchesKeyword(item, kw));
    const doneItems   = allListings.filter(item => item.status === "거래완료"  && matchesKeyword(item, kw));
    activeItems.sort((a, b) => new Date(b.created_at||0) - new Date(a.created_at||0));
    doneItems.sort((a, b) => new Date(b.completed_at||b.created_at||0) - new Date(a.completed_at||a.created_at||0));

    countBadge.textContent = "";
    paginationEl.innerHTML = "";

    if (activeItems.length) {
      unifiedPropertyLabel.style.display = "";
      unifiedPropertyCount.textContent = `(${activeItems.length}건)`;
      emptyMessage.style.display = "none";
      activeItems.forEach(item => listingContainer.appendChild(makeCard(item)));
      _initExpandCards(listingContainer);
    } else {
      unifiedPropertyLabel.style.display = "none";
      emptyMessage.style.display = "none";
    }

    if (includeCompleted && doneItems.length) {
      unifiedDoneSection.style.display = "";
      unifiedDoneCount.textContent = `(${doneItems.length}건)`;
      unifiedDoneContainer.innerHTML = "";
      doneItems.forEach(item => unifiedDoneContainer.appendChild(makeCard(item, { revert: true })));
      _initExpandCards(unifiedDoneContainer);
    } else {
      unifiedDoneSection.style.display = "none";
    }

    if (!activeItems.length && !(includeCompleted && doneItems.length)) {
      emptyMessage.style.display = "block";
    }
    return;
  }

  // 일반 모드
  unifiedPropertyLabel.style.display = "none";
  unifiedDoneSection.style.display   = "none";

  const filtered = getFilteredListings();
  countBadge.textContent = filtered.length ? `(${filtered.length}건)` : "";

  if (!filtered.length) {
    emptyMessage.style.display = "block";
    paginationEl.innerHTML = "";
    return;
  }
  emptyMessage.style.display = "none";

  const start = (currentPage - 1) * ITEMS_PER_PAGE;
  const pageItems = filtered.slice(start, start + ITEMS_PER_PAGE);

  const allChk = pageItems.length > 0 && pageItems.every(i => selectedIds.has(i.id));
  const cardSelectBar = document.getElementById("cardSelectBar");
  const cardSelectAll = document.getElementById("cardSelectAll");
  cardSelectBar.style.display = "flex";
  cardSelectAll.checked = allChk;
  _currentCardItems = pageItems;

  pageItems.forEach(item => {
    const card = document.createElement("div");
    card.className = "listing-card";
    card.style.position = "relative";
    card.onclick = () => location.href = `detail.html?id=${item.id}`;

    const isQuick = item.quick_save === true || (item.quick_price && !item.shop_deposit && !item.land_price && !item.officetel_price);
    const chk = selectedIds.has(item.id) ? "checked" : "";

    card.innerHTML = `
      <div onclick="event.stopPropagation()" style="position:absolute;top:12px;right:12px;z-index:2;">
        <input type="checkbox" data-sel="${item.id}" ${chk} style="width:16px;height:16px;accent-color:var(--gold);cursor:pointer;margin:0;" onchange="toggleSelect('${item.id}',this.checked)" />
      </div>
      <div class="badge-row" style="margin-bottom:6px;padding-right:28px;">
        <span class="badge">${getTypeLabel(item.type)}</span>
        ${isQuick ? '<span class="badge badge-blue">⚡빠른등록</span>' : ""}
        ${item.status === "거래완료" ? '<span class="badge badge-red">거래완료</span>' : ""}
        ${renderPublicBadge(item)}
      </div>
      <div class="listing-title">${item.address || item.title || "(주소 미입력)"}</div>
      <div class="listing-price">${formatPrice(item)}</div>
      <div class="card-expand-wrap" data-expanded="false">
        ${(item.owner_phone1||item.quick_contact||item.owner_contact) ? `<div style="margin-top:4px;font-size:0.78rem;color:var(--text-muted);">📞 ${item.owner_phone1||item.quick_contact||item.owner_contact}</div>` : ""}
        ${(item.quick_memo||item.description) ? `<div style="margin-top:4px;font-size:0.76rem;color:var(--text-muted);">📝 ${item.quick_memo||item.description}</div>` : ""}
        ${item.completed_at ? `<div style="margin-top:6px;font-size:0.78rem;color:#e88;">✅ 거래완료일: ${formatDate(item.completed_at)}</div>` : ""}
        ${(item.drive_links && item.drive_links.length) ? `<div style="margin-top:6px;display:flex;flex-wrap:wrap;gap:4px;">${item.drive_links.map(l=>`<a href="${l.url}" target="_blank" onclick="event.stopPropagation()" style="font-size:0.73rem;color:var(--gold);text-decoration:none;background:rgba(212,175,55,0.1);border:1px solid rgba(212,175,55,0.3);border-radius:4px;padding:2px 7px;">📁 ${l.name||"링크"}</a>`).join("")}</div>` : ""}
        <div class="card-expand-fade"></div>
      </div>
      <button class="card-expand-btn" onclick="event.stopPropagation();toggleCardExpand(this)">▼ 더보기</button>
      <div style="margin-top:10px;display:flex;gap:6px;justify-content:flex-end;align-items:center;flex-wrap:wrap;">
        ${item.resource_id ? (() => { const res = allDriveResources.find(r => r.id === item.resource_id); return res && res.url ? `<button class="btn btn-ghost" style="font-size:0.75rem;padding:4px 10px;" onclick="event.stopPropagation();window.open('${res.url.replace(/'/g,"%27")}','_blank')">📁 자료보기</button>` : ''; })() : ""}
        ${isQuick && item.status !== "거래완료" ? `<button class="btn btn-ghost" style="font-size:0.75rem;padding:4px 10px;border-color:rgba(212,175,55,0.45);color:var(--gold);" onclick="event.stopPropagation();convertToDetail('${item.id}')">📝 상세저장으로 전환</button>` : ""}
        <button class="btn btn-primary" style="font-size:0.75rem;padding:4px 10px;" onclick="event.stopPropagation();handlePublicToggle('${item.id}')">${item.is_public === true ? '&#44277;&#44060; &#52712;&#49548;' : '&#54856;&#54168;&#51060;&#51648; &#44277;&#44060;'}</button>
        ${item.status !== "거래완료" ? `<button class="btn btn-success" style="font-size:0.75rem;padding:4px 10px;" onclick="event.stopPropagation();handleDealDone('${item.id}')">✅ 거래완료</button>` : ""}
        <button class="btn btn-ghost" style="font-size:0.75rem;padding:4px 10px;" onclick="event.stopPropagation();location.href='property-print.html?id=${item.id}'">🖨 설명서 출력</button>
        <button class="btn-cal" onclick="event.stopPropagation();openCalModal(${JSON.stringify(item).replace(/"/g,'&quot;')})">📅 일정 추가</button>
      </div>
    `;

    listingContainer.appendChild(card);
  });
  _initExpandCards(listingContainer);
  _currentCardItems = pageItems;

  renderPagination(filtered.length);
}

// 빠른 저장
document.getElementById("quickSaveBtn").addEventListener("click", async () => {
  const type    = document.getElementById("q_type").value;
  const address = document.getElementById("q_address").value.trim();
  const price   = document.getElementById("q_price").value.trim();
  const contact = document.getElementById("q_contact").value.trim();
  const memo    = document.getElementById("q_memo").value.trim();

  if (!address && !price) {
    showToast("위치 또는 가격 중 하나는 입력해주세요");
    return;
  }

  const btn = document.getElementById("quickSaveBtn");
  btn.disabled = true; btn.textContent = "저장 중...";

  try {
    const isDone = document.getElementById("q_done").checked;
    const driveLinks = getQuickLinks();
    const item = {
      id: "HITOP-" + Date.now(),
      type,
      quick_location: address,   // 내부용 위치 — publicAddress로 사용 안함
      address: address,          // 카드/목록 표시용
      title: `${getTypeLabel(type)} · ${address || price}`,
      status: isDone ? "거래완료" : "광고중",
      description: memo,
      quick_price: price,
      quick_contact: contact,
      quick_memo: memo,
      quick_save: true,          // 빠른저장 플래그
      is_public: false,
      image_urls: []
    };
    if (driveLinks.length) item.drive_links = driveLinks;
    if (isDone) item.completed_at = new Date().toISOString();
    await addListing(item);
    ["q_address","q_price","q_contact","q_memo"].forEach(id => document.getElementById(id).value = "");
    document.getElementById("q_done").checked = false;
    document.getElementById("q_links_container").innerHTML = "";
    showToast("✅ 저장완료!");
    await loadListings();
  } catch(e) {
    showToast("❌ 저장 실패: " + e.message);
  } finally {
    btn.disabled = false; btn.textContent = "⚡ 빠른 저장";
  }
});

// 인쇄
document.getElementById("printBtn").addEventListener("click", printSelected);

function doSearch() {
  searchKeyword = document.getElementById("searchInput").value.trim();
  currentPage = 1;
  renderList();
}
document.getElementById("searchInput").addEventListener("keydown", (e) => {
  if (e.key === "Enter") doSearch();
});
document.getElementById("searchBtn").addEventListener("click", doSearch);

document.getElementById("includeCompletedChk").addEventListener("change", (e) => {
  includeCompleted = e.target.checked;
  currentPage = 1;
  renderList();
});

document.getElementById("sortSelect").addEventListener("change", (e) => {
  currentSort = e.target.value;
  currentPage = 1;
  renderList();
});

filterRow.querySelectorAll(".filter-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    filterRow.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    currentFilter = btn.dataset.filter;
    currentPage = 1;
    renderList();
  });
});

/* ══════════════════════════════════════════
   엑셀 다운로드 — 현재 필터 기준 (6컬럼 간결형)
══════════════════════════════════════════ */
function _xlsxDate() {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,"0")}${String(d.getDate()).padStart(2,"0")}`;
}
function _makeSheet(rows) {
  return XLSX.utils.json_to_sheet(rows.length ? rows : [{}]);
}

function downloadExcel() {
  const items = getFilteredListings();
  if (!items.length) { showToast("⚠️ 다운로드할 매물이 없습니다."); return; }

  function toMan(v) {
    const n = Number(String(v || "").replace(/,/g, ""));
    return (isFinite(n) && n > 0) ? Math.round(n / 10000) : 0;
  }

  function fmtMan(manwon) {
    if (!manwon) return "";
    const eok = Math.floor(manwon / 10000);
    const man = manwon % 10000;
    const parts = [];
    if (eok) parts.push(eok.toLocaleString("ko-KR") + "억");
    if (man)  parts.push(man.toLocaleString("ko-KR") + "만");
    return parts.join(" ");
  }

  function getDivision(x) {
    if (x.category2) return x.category2;
    if (x.category1) return x.category1;
    const typeMap = {
      shop:"상가", office:"사무실", officetel:"오피스텔",
      hilsstate:"힐스테이트더운정", factory:"공장/창고",
      bizcenter:"지식산업센터", land_single:"토지",
      land_dev:"토지", land_other:"토지", etc:"기타"
    };
    return typeMap[x.type] || x.type || "";
  }

  function getArea(x) {
    const t = x.type || "";
    const cat1 = (x.category1 || "").toLowerCase();
    if (t.startsWith("land") || cat1 === "토지") {
      const py = x.areaPy || x.landAreaPy;
      return py ? py + "평" : "";
    }
    if (t === "factory" || cat1 === "공장창고") {
      const py = x.landAreaPy || x.totalFloorAreaPy || x.buildingAreaPy || x.exclusiveAreaPy;
      return py ? py + "평" : "";
    }
    if (t === "officetel" || t === "hilsstate" || t === "apartment") {
      const py = x.exclusiveAreaPy || x.areaExclusivePy;
      return py ? py + "평" : "";
    }
    const py = x.exclusiveAreaPy || x.areaExclusivePy || x.supplyAreaPy || x.areaSupplyPy || x.areaPy;
    return py ? py + "평" : "";
  }

  function getPrice(x) {
    const deal = (x.dealType || "").trim();
    const sale   = toMan(x.salePrice);
    const pre    = toMan(x.presalePrice);
    const dep    = toMan(x.deposit);
    const rent   = toMan(x.monthlyRent);
    const jeonse = toMan(x.jeonsePriceManwon);

    if (deal === "매매" || deal === "분양") return fmtMan(sale || pre) || "";
    if (deal === "전세") return fmtMan(dep || jeonse) || "";
    if (deal === "월세" || deal === "임대") {
      const depStr  = dep  ? fmtMan(dep)  : "";
      const rentStr = rent ? fmtMan(rent) : "";
      if (depStr && rentStr) return depStr + "/" + rentStr;
      if (rentStr) return rentStr;
      return depStr;
    }
    if (sale) return fmtMan(sale);
    if (dep && rent) return fmtMan(dep) + "/" + fmtMan(rent);
    if (dep)  return fmtMan(dep);
    if (rent) return fmtMan(rent);
    return "";
  }

  const rows = items.map(x => ({
    "구분":   getDivision(x),
    "거래":   x.dealType || "",
    "매물명": x.title || "",
    "주소":   x.publicAddress || x.address || "",
    "면적":   getArea(x),
    "가격":   getPrice(x),
  }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, _makeSheet(rows), "매물목록");
  XLSX.writeFile(wb, `하이탑_매물목록_${_xlsxDate()}.xlsx`);
  showToast(`✅ ${items.length}건 다운로드 완료`);
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
      getListings(),
      getRequests(),
      getCustomers(),
      getDoneCustomers(),
      getDriveResources(),
      getRecommendedProperties(),
      getReferenceProperties(),
      getMemos()
    ]);

    const wb = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(wb, _makeSheet(listings.map(item => ({
      "유형": getTypeLabel(item.type),
      "주소": item.address || item.title || "",
      "가격": formatPrice(item),
      "연락처": item.owner_phone1 || item.quick_contact || item.owner_contact || "",
      "메모": item.quick_memo || item.description || "",
      "등록일": item.created_at ? new Date(item.created_at).toLocaleDateString("ko-KR") : "",
      "상태": item.status || "진행중"
    }))), "매물관리");

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

    XLSX.writeFile(wb, `하이탑부동산_전체백업_${_xlsxDate()}.xlsx`);
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
    ? `안녕하세요. 하이탑부동산(031-949-8969)과\n${coopName}입니다.`
    : `안녕하세요. 하이탑부동산(031-949-8969)입니다.`;

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

// ===== 업무일지 매물보내기 연동 (?memo= 파라미터로 진입 시 빠른저장 메모 자동입력) =====
(function () {
  function applyMemoParam() {
    const params = new URLSearchParams(window.location.search);
    const memo = params.get('memo');
    if (!memo) return;

    const ta = document.getElementById('q_memo');
    if (ta) {
      ta.value = memo;
      ta.focus();
      setTimeout(function () {
        ta.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 300);
    }

    const cleanUrl = new URL(window.location.href);
    cleanUrl.searchParams.delete('memo');
    history.replaceState({}, '', cleanUrl.toString());
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyMemoParam);
  } else {
    applyMemoParam();
  }
})();

// ===== 초기 로딩 =====
loadListings();
