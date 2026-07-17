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

function renderPublicBadge(item) {
  const isPublic = item && item.is_public === true;
  return `<span class="badge" style="background:${isPublic ? 'rgba(80,180,100,0.18)' : 'rgba(255,255,255,0.06)'};color:${isPublic ? '#5cb85c' : 'var(--text-muted)'};border:1px solid ${isPublic ? 'rgba(80,180,100,0.35)' : 'rgba(255,255,255,0.12)'};">${isPublic ? '&#54856;&#54168;&#51060;&#51648; &#44277;&#44060;' : '&#48708;&#44277;&#44060;'}</span>`;
}

function matchesKeyword(item, kw) {
  return [
    item.id, item.title, item.address,
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
  const type = getTypeLabel(_calItem.type);
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
  const typeLabel = getTypeLabel(_calItem.type);

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
  card.className = "listing-card";
  card.onclick = () => location.href = `detail.html?id=${item.id}`;
  const isQuick = item.quick_price && !item.shop_deposit && !item.land_price && !item.officetel_price;
  const isDone = item.status === "거래완료";
  card.innerHTML = `
    <div class="badge-row" style="margin-bottom:6px;">
      <span class="badge">${getTypeLabel(item.type)}</span>
      ${isQuick && !isDone ? '<span class="badge badge-blue">⚡빠른등록</span>' : ""}
      ${isDone ? '<span class="badge badge-red">거래완료</span>' : ""}
      ${renderPublicBadge(item)}
      ${!isDone && showActiveBadge ? '<span class="badge" style="background:rgba(80,180,100,0.18);color:#5cb85c;border:1px solid rgba(80,180,100,0.35);">매물중</span>' : ""}
    </div>
    <div class="listing-title">${item.address || item.title || "(주소 미입력)"}</div>
    <div class="listing-price">${formatPrice(item)}</div>
    <div class="card-expand-wrap" data-expanded="false">
      ${(item.owner_phone1||item.quick_contact||item.owner_contact) ? `<div style="margin-top:4px;font-size:0.78rem;color:var(--text-muted);">📞 ${item.owner_phone1||item.quick_contact||item.owner_contact}</div>` : ""}
      ${(item.quick_memo||item.description) ? `<div style="margin-top:4px;font-size:0.76rem;color:var(--text-muted);">📝 ${item.quick_memo||item.description}</div>` : ""}
      ${item.completed_at ? `<div style="margin-top:6px;font-size:0.78rem;color:#e88;">✅ 거래완료일: ${formatDate(item.completed_at)}</div>` : ""}
      <div class="card-expand-fade"></div>
    </div>
    <button class="card-expand-btn" onclick="event.stopPropagation();toggleCardExpand(this)">▼ 더보기</button>
    <div style="margin-top:10px;display:flex;gap:6px;justify-content:flex-end;align-items:center;flex-wrap:wrap;">
      ${revert ? `<button class="btn btn-ghost" style="font-size:0.78rem;padding:4px 10px;" onclick="event.stopPropagation();handleRevertListing('${item.id}')">↩ 매물로 되돌리기</button>` : ""}
      <button class="btn btn-primary" style="font-size:0.75rem;padding:4px 10px;" onclick="event.stopPropagation();handlePublicToggle('${item.id}')">${item.is_public === true ? '&#44277;&#44060; &#52712;&#49548;' : '&#54856;&#54168;&#51060;&#51648; &#44277;&#44060;'}</button>
      ${!isDone && !revert ? `<button class="btn btn-success" style="font-size:0.75rem;padding:4px 10px;" onclick="event.stopPropagation();handleDealDone('${item.id}')">&#9989; &#44144;&#47000;&#50756;&#47308;</button>` : ""}
      <button class="btn btn-ghost" style="font-size:0.75rem;padding:4px 10px;" onclick="event.stopPropagation();location.href='property-print.html?id=${item.id}'">🖨 설명서 출력</button>
      <button class="btn-cal" onclick="event.stopPropagation();openCalModal(${JSON.stringify(item).replace(/"/g,'&quot;')})">📅 일정 추가</button>
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
