// ===== 매물 데이터 공유 상태 (매물관리 · 거래완료관리 등 여러 탭/페이지에서 공용) =====
let allListings = [];
let allDriveResources = [];

async function loadListings() {
  if (typeof listingContainer !== "undefined" && listingContainer) {
    listingContainer.innerHTML = `<div class="loading"><span class="spinner"></span>불러오는 중...</div>`;
  }
  try {
    [allListings, allDriveResources] = await Promise.all([getListings(), getDriveResources()]);
    if (typeof renderList === "function") renderList();
  } catch(e) {
    if (typeof listingContainer !== "undefined" && listingContainer) listingContainer.innerHTML = "";
    showAppError(e.message || "데이터를 불러오지 못했습니다. 새로고침 해주세요.");
  }
}

// ===== 공통 표시 헬퍼 =====
function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,"0")}.${String(d.getDate()).padStart(2,"0")}`;
}

function getTypeLabel(type) {
  const map = { shop:"상가", office:"사무실", officetel:"오피스텔", hilsstate:"힐스테이트더운정", factory:"공장/창고", bizcenter:"지식산업센터", etc:"기타" };
  if (map[type]) return map[type];
  if (type && type.startsWith("land")) return "토지";
  return "기타";
}

// 원(₩) 단위 숫자를 억/만원 한국어 표기로 변환
function _fmtWon(v) {
  const n = Number(String(v).replace(/,/g, ""));
  if (!n || !isFinite(n)) return "";
  const uk  = Math.floor(n / 100000000);
  const man = Math.floor((n % 100000000) / 10000);
  let s = "";
  if (uk  > 0) s += uk.toLocaleString("ko-KR") + "억";
  if (man > 0) s += (s ? " " : "") + man.toLocaleString("ko-KR") + "만";
  return s ? s + "원" : "";
}

// 상세등록(register.html) 필드에서 가격 문자열 생성
function _detailPrice(item) {
  const deal = item.dealType || "";
  const sale  = item.salePrice   && Number(item.salePrice)   ? (deal || "매매") + " " + _fmtWon(item.salePrice)   : "";
  const dep   = item.deposit     && Number(item.deposit)     ? "보증금 " + _fmtWon(item.deposit)                  : "";
  const rent  = item.monthlyRent && Number(item.monthlyRent) ? "월세 "   + _fmtWon(item.monthlyRent)              : "";
  if (dep && rent) return `${dep} / ${rent}`;
  if (sale) return sale;
  if (dep)  return dep;
  if (rent) return rent;
  return "";
}

function formatPrice(item) {
  const detailPx = _detailPrice(item);
  if (item.type === "shop") {
    const d = item.shop_deposit ? Number(item.shop_deposit).toLocaleString("ko-KR")+"만원" : "";
    const r = item.shop_monthlyRent ? Number(item.shop_monthlyRent).toLocaleString("ko-KR")+"만원" : "";
    if (d && r) return `보증금 ${d} / 월세 ${r}`;
    return detailPx || item.quick_price || "";
  }
  if (item.type === "officetel") return item.officetel_price ? `${item.officetel_dealType||""} ${Number(item.officetel_price).toLocaleString("ko-KR")}만원` : (detailPx || item.quick_price || "");
  if (item.type && item.type.startsWith("land")) return item.land_price ? `매매 ${Number(item.land_price).toLocaleString("ko-KR")}만원` : (detailPx || item.quick_price || "");
  if (item.type === "factory") return item.factory_price ? `${item.factory_dealType||""} ${Number(item.factory_price).toLocaleString("ko-KR")}만원` : (detailPx || item.quick_price || "");
  if (item.type === "bizcenter") return item.biz_price ? `${item.biz_dealType||""} ${Number(item.biz_price).toLocaleString("ko-KR")}만원` : (detailPx || item.quick_price || "");
  return detailPx || item.quick_price || "";
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, ch => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[ch]));
}

function idForCall(value) {
  return String(value ?? "").replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/\r?\n/g, " ");
}

function getListingNumber(item) {
  return item.listingNo || item.listing_no || item.propertyNo || item.property_no ||
    item.no || (item.id ? String(item.id).replace(/^HITOP-/, "").slice(-8) : "-");
}

function getDealTypeLabel(item) {
  return item.dealType || item.shop_dealType || item.officetel_dealType ||
    item.factory_dealType || item.biz_dealType || (item.type?.startsWith("land") ? "매매" : "-");
}

function formatPyValue(value) {
  const n = Number(value);
  if (!isFinite(n) || n <= 0) return "";
  return `${Number.isInteger(n) ? n : n.toFixed(1)}평`;
}

function getAreaText(item) {
  const exclusive = formatPyValue(item.areaExclusivePy || item.exclusiveAreaPy);
  const supply = formatPyValue(item.areaSupplyPy || item.supplyAreaPy);
  const land = formatPyValue(item.landAreaPy || item.land_area_py || item.land_py);
  const generic = formatPyValue(item.areaPy || item.shop_area_py || item.officetel_area_py || item.factory_area_py || item.biz_area_py);
  if (exclusive && supply) return `전용 ${exclusive} / 분양 ${supply}`;
  if (exclusive) return `전용 ${exclusive}`;
  if (supply) return `분양 ${supply}`;
  if (land) return `대지 ${land}`;
  return generic || "-";
}

function getBuildingName(item) {
  return item.buildingName || item.building_name || item.complexName || item.complex_name || item.shop_building || "-";
}

function getUpdatedDateText(item) {
  return formatDate(item.updated_at || item.updatedAt || item.updated_at_local || item.created_at);
}

function isNeedsCheck(item) {
  const status = String(item.status || "");
  return status.includes("확인") || item.quick_save === true;
}

function getStatusLabel(item) {
  if (item.status === "거래완료") return "거래완료";
  if (isNeedsCheck(item)) return "확인 필요";
  return item.status || "광고중";
}

function getStatusClass(item) {
  if (item.status === "거래완료") return "status-done";
  if (isNeedsCheck(item)) return "status-needs";
  return "status-active";
}

function getListingName(item) {
  return item.title && item.title !== item.address ? item.title : getBuildingName(item);
}

function renderPublicBadge(item) {
  const isPublic = item && item.is_public === true;
  return `<span class="badge" style="background:${isPublic ? 'rgba(80,180,100,0.18)' : 'rgba(255,255,255,0.06)'};color:${isPublic ? '#5cb85c' : 'var(--text-muted)'};border:1px solid ${isPublic ? 'rgba(80,180,100,0.35)' : 'rgba(255,255,255,0.12)'};">${isPublic ? '&#54856;&#54168;&#51060;&#51648; &#44277;&#44060;' : '&#48708;&#44277;&#44060;'}</span>`;
}

function matchesKeyword(item, kw) {
  return [
    item.id, getListingNumber(item), getStatusLabel(item), getListingCategoryLabel(item),
    item.title, item.address, getDealTypeLabel(item), formatPrice(item), getAreaText(item), getBuildingName(item),
    item.quick_price, item.salePrice, item.deposit, item.monthlyRent,
    item.quick_memo, item.description, item.detailDescription,
    item.quick_contact, item.owner_contact, item.owner_phone1, item.owner_phone2,
    item.owner_name, item.owner_memo, item.zoning, item.floorInfo
  ].join(" ").toLowerCase().includes(kw);
}

// ===== 카드 더보기/접기 공통 (매물·거래완료·고객·완료고객·참고매물 카드에서 공용) =====
function _initExpandCards(container) {
  container.querySelectorAll(".card-expand-wrap").forEach(wrap => {
    const btn = wrap.nextElementSibling;
    const fade = wrap.querySelector(".card-expand-fade");
    if (!btn || !btn.classList.contains("card-expand-btn")) return;
    if (wrap.scrollHeight <= wrap.clientHeight + 2) {
      btn.style.display = "none";
      if (fade) fade.style.display = "none";
    } else {
      btn.style.display = "block";
    }
  });
}

function toggleCardExpand(btn) {
  const wrap = btn.previousElementSibling;
  if (!wrap) return;
  const fade = wrap.querySelector(".card-expand-fade");
  const isExpanded = wrap.dataset.expanded === "true";
  if (isExpanded) {
    wrap.style.maxHeight = "100px";
    wrap.dataset.expanded = "false";
    btn.textContent = "▼ 더보기";
    if (fade) fade.style.display = "block";
  } else {
    wrap.style.maxHeight = wrap.scrollHeight + "px";
    wrap.dataset.expanded = "true";
    btn.textContent = "▲ 접기";
    if (fade) fade.style.display = "none";
  }
}

// ===== 구글 캘린더 (매물·거래완료 카드의 "일정 추가" 버튼에서 공용) =====
let _calItem = null;
let _calType = "잔금일정";

function openCalModal(item) {
  _calItem = item;
  _calType = "잔금일정";
  const today = new Date();
  document.getElementById("cal_date").value = today.toISOString().slice(0,10);
  document.getElementById("cal_time").value = "10:00";
  document.querySelectorAll(".cal-type-btn").forEach(b => {
    b.classList.toggle("active", b.dataset.type === "잔금일정");
  });
  updateCalPreview();
  document.getElementById("calModal").style.display = "flex";
}

function updateCalPreview() {
  if (!_calItem) return;
  const loc = _calItem.address || _calItem.title || "매물";
  const price = formatPrice(_calItem) || "-";
  const contact = _calItem.quick_contact || _calItem.owner_phone1 || _calItem.owner_contact || "-";
  const type = getListingCategoryLabel(_calItem);
  document.getElementById("cal_preview").innerHTML =
    `<b>제목:</b> ${loc} ${_calType}<br><b>유형:</b> ${type}<br><b>가격:</b> ${price}<br><b>집주인:</b> ${contact}`;
}

document.querySelectorAll(".cal-type-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".cal-type-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    _calType = btn.dataset.type;
    updateCalPreview();
  });
});

["cal_date","cal_time"].forEach(id => {
  document.getElementById(id).addEventListener("change", updateCalPreview);
});

document.getElementById("calConfirmBtn").addEventListener("click", () => {
  if (!_calItem) return;
  const date = document.getElementById("cal_date").value;
  const time = document.getElementById("cal_time").value;
  if (!date || !time) { showToast("날짜와 시간을 입력해주세요"); return; }

  const loc = _calItem.address || _calItem.title || "매물";
  const price = formatPrice(_calItem) || "";
  const contact = _calItem.quick_contact || _calItem.owner_phone1 || _calItem.owner_contact || "";
  const typeLabel = getListingCategoryLabel(_calItem);

  const title = encodeURIComponent(`${loc} ${_calType}`);
  const details = encodeURIComponent(`매물유형: ${typeLabel}\n가격: ${price}\n집주인 연락처: ${contact}`);

  // 날짜 형식 변환 YYYYMMDDTHHMMSS
  const dtStr = date.replace(/-/g,"") + "T" + time.replace(":","") + "00";
  const endDt = (() => {
    const d = new Date(`${date}T${time}:00`);
    d.setHours(d.getHours() + 1);
    return d.getFullYear().toString() +
      String(d.getMonth()+1).padStart(2,"0") +
      String(d.getDate()).padStart(2,"0") + "T" +
      String(d.getHours()).padStart(2,"0") +
      String(d.getMinutes()).padStart(2,"0") + "00";
  })();

  const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${dtStr}/${endDt}&details=${details}`;
  window.open(url, "_blank");
  document.getElementById("calModal").style.display = "none";
});

// ===== 매물 카드 렌더러 (매물관리 · 거래완료관리 통합검색에서 공용) =====
function makeCard(item, { revert = false, showActiveBadge = false } = {}) {
  const card = document.createElement("div");
  const statusClass = getStatusClass(item);
  card.className = `listing-card listing-card-modern ${statusClass}`;
  card.onclick = () => location.href = `detail.html?id=${encodeURIComponent(item.id)}`;
  const isQuick = item.quick_save === true;
  const isDone = item.status === "거래완료";
  const chk = typeof selectedIds !== "undefined" && selectedIds.has(item.id) ? "checked" : "";
  const idArg = idForCall(item.id);
  const detailUrl = `detail.html?id=${encodeURIComponent(item.id)}`;
  const editAction = isQuick && typeof convertToDetail === "function"
    ? `convertToDetail('${idArg}')`
    : `location.href='detail.html?id=${encodeURIComponent(item.id)}&edit=1'`;
  const statusAction = isDone || revert ? `handleRevertListing('${idArg}')` : `handleDealDone('${idArg}')`;
  const statusText = isDone || revert ? "진행중으로" : "거래완료";
  const description = item.description || item.detailDescription || "";
  const memo = item.quick_memo || item.owner_memo || "";
  const buildingName = getBuildingName(item);
  card.innerHTML = `
    <div class="listing-select" onclick="event.stopPropagation()">
      ${typeof toggleSelect === "function" ? `<input type="checkbox" data-sel="${escapeHtml(item.id)}" ${chk} onchange="toggleSelect('${idArg}',this.checked)" />` : ""}
    </div>
    <div class="listing-card-head">
      <span class="listing-no-pill">No. ${escapeHtml(getListingNumber(item))}</span>
      <span class="status-pill ${statusClass}">${escapeHtml(getStatusLabel(item))}</span>
      <span class="category-pill">${escapeHtml(getListingCategoryLabel(item))}</span>
    </div>
    <div class="listing-address">${escapeHtml(item.address || "(주소 미입력)")}</div>
    <div class="listing-name">${escapeHtml(getListingName(item) || "-")}</div>
    <div class="listing-facts">
      <div class="listing-fact">
        <span>가격</span>
        <strong>${escapeHtml(formatPrice(item) || "-")}</strong>
      </div>
      <div class="listing-fact">
        <span>면적</span>
        <strong>${escapeHtml(getAreaText(item))}</strong>
      </div>
      <div class="listing-fact">
        <span>거래</span>
        <strong>${escapeHtml(getDealTypeLabel(item))}</strong>
      </div>
      <div class="listing-fact">
        <span>단지</span>
        <strong>${escapeHtml(buildingName)}</strong>
      </div>
    </div>
    <div class="listing-notes">
      ${description ? `<p><span>설명</span>${escapeHtml(description)}</p>` : ""}
      ${memo ? `<p><span>메모</span>${escapeHtml(memo)}</p>` : ""}
      ${item.completed_at ? `<p class="done-date"><span>완료일</span>${escapeHtml(formatDate(item.completed_at))}</p>` : ""}
      ${!description && !memo && !item.completed_at ? `<p><span>메모</span>등록된 설명이나 메모가 없습니다.</p>` : ""}
    </div>
    <div class="listing-actions">
      <button class="btn btn-ghost" onclick="event.stopPropagation();location.href='${detailUrl}'">상세</button>
      <button class="btn btn-ghost" onclick="event.stopPropagation();${editAction}">수정</button>
      <button class="btn btn-status" onclick="event.stopPropagation();${statusAction}">${statusText}</button>
      <button class="btn btn-primary" onclick="event.stopPropagation();handlePublicToggle('${idArg}')">${item.is_public === true ? "홈페이지 해제" : "홈페이지 공개"}</button>
    </div>
  `;
  return card;
}

// ===== 매물 상태 변경 액션 (공개 전환 · 거래완료 처리 · 되돌리기) =====
// 페이지 분리로 인해, 처리 후 "탭 전환" 대신 현재 페이지에 존재하는 목록만 새로고침한다.
async function handlePublicToggle(id) {
  const item = allListings.find(x => x.id === id);
  if (!item) return;
  // 빠른저장 매물은 홈페이지 공개 차단
  if (item.quick_save === true) {
    showToast("빠른등록 매물은 상세저장을 완료한 뒤 홈페이지로 보낼 수 있습니다.", 3500);
    return;
  }
  const nextPublic = item.is_public !== true;
  try {
    await updateListingPublic(id, nextPublic);
    item.is_public = nextPublic;
    showToast(nextPublic ? "Homepage listing is now public." : "Homepage listing is now private.");
    if (typeof renderList === "function") renderList();
    if (typeof renderDoneList === "function") renderDoneList();
  } catch(e) {
    closeHomepageTab(homepageTab);
    showToast("Public status update failed: " + e.message);
  }
}

async function handleDealDone(id) {
  if (!confirm("거래완료로 처리하시겠습니까?\n완료일자가 자동 저장됩니다.")) return;
  try {
    await markListingDone(id);
    showToast("✅ 거래완료 처리됨");
    await loadListings();
    if (typeof renderDoneList === "function") renderDoneList();
    if (typeof renderList === "function") renderList();
  } catch(e) { showToast("❌ 오류: " + e.message); }
}

async function handleRevertListing(id) {
  if (!confirm("거래완료를 취소하고 매물관리로 되돌리시겠습니까?")) return;
  try {
    await updateListingStatus(id, "광고중");
    showToast("↩ 매물관리로 되돌렸습니다");
    await loadListings();
    if (typeof renderDoneList === "function") renderDoneList();
    if (typeof renderList === "function") renderList();
  } catch(e) { showToast("❌ 오류: " + e.message); }
}
