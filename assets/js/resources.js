// ===== 자료관리 페이지 상태 =====
let allDriveResources = [];
let allListings = [];
let activeDriveCat = null;   // 현재 열린 카테고리 (단일)

// ===== 공통 유틸 =====
function showToast(msg, duration = 2000) {
  const t = document.getElementById("toast");
  t.textContent = msg; t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), duration);
}

// 매물연결 모달에 표시할 매물 유형/가격 표기 (register.html 저장 구조 기준)
function getTypeLabel(type) {
  const map = { shop:"상가", office:"사무실", officetel:"오피스텔", hilsstate:"힐스테이트더운정", factory:"공장/창고", bizcenter:"지식산업센터", etc:"기타" };
  if (map[type]) return map[type];
  if (type && type.startsWith("land")) return "토지";
  return "기타";
}

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

// ===== 자료 등록 / 조회 =====
async function loadDriveResources() {
  const container = document.getElementById("driveContent");
  container.innerHTML = `<div class="loading"><span class="spinner"></span>불러오는 중...</div>`;
  try {
    allDriveResources = await getDriveResources();
    renderDriveTab();
    updateDriveCategorySelect();
  } catch(e) {
    container.innerHTML = `<div class="loading">❌ 불러오기 실패: ${e.message}</div>`;
  }
}

function updateDriveCategorySelect() {
  const select = document.getElementById("drive_cat_select");
  const categories = [...new Set(allDriveResources.map(r => r.category).filter(Boolean))];
  select.innerHTML = `<option value="">-- 직접 입력 --</option>` +
    categories.map(c => `<option value="${c}">${c}</option>`).join("");
}

document.getElementById("drive_cat_select").addEventListener("change", (e) => {
  if (e.target.value) document.getElementById("drive_category").value = e.target.value;
  else document.getElementById("drive_category").value = "";
});

document.getElementById("driveSaveBtn").addEventListener("click", async () => {
  const btn = document.getElementById("driveSaveBtn");
  const category = document.getElementById("drive_category").value.trim();
  const name = document.getElementById("drive_name").value.trim();
  const url = document.getElementById("drive_url").value.trim();
  if (!category) { showToast("카테고리를 입력해주세요"); return; }
  if (!name) { showToast("건물명을 입력해주세요"); return; }
  btn.disabled = true; btn.textContent = "저장 중...";
  try {
    const memo = joinMemo(
      document.getElementById("drive_memo_basic_reg").value,
      document.getElementById("drive_memo_extra_reg").value
    );
    await addDriveResource({ category, name, url, memo });
    document.getElementById("drive_category").value = "";
    document.getElementById("drive_name").value = "";
    document.getElementById("drive_url").value = "";
    document.getElementById("drive_memo_basic_reg").value = MEMO_TEMPLATE;
    document.getElementById("drive_memo_extra_reg").value = "";
    document.getElementById("drive_cat_select").value = "";
    showToast("✅ 저장되었습니다!");
    await loadDriveResources();
  } catch(e) {
    showToast("❌ 저장 실패: " + e.message);
  } finally {
    btn.disabled = false; btn.textContent = "💾 저장";
  }
});

// ── 자료보기 순서 localStorage 헬퍼 ──────────────────────────
function getDriveOrder() {
  try { return JSON.parse(localStorage.getItem('drive_order') || '{}'); } catch { return {}; }
}
function saveDriveOrder(obj) {
  localStorage.setItem('drive_order', JSON.stringify(obj));
}
// 카테고리별 items 배열을 localStorage 순서에 맞게 정렬
function sortedByCatOrder(cat, items) {
  const order = getDriveOrder()[cat];
  if (!order) return items;
  return [...items].sort((a, b) => {
    const oa = order.indexOf(a.id);
    const ob = order.indexOf(b.id);
    return (oa === -1 ? 99999 : oa) - (ob === -1 ? 99999 : ob);
  });
}
// 순서 변경 함수
function moveDriveOrder(id, direction, category) {
  const order = getDriveOrder();
  const catItems = sortedByCatOrder(category, allDriveResources.filter(r => r.category === category));
  const ids = catItems.map(r => r.id);
  const idx = ids.indexOf(id);
  if (idx < 0) return;
  const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= ids.length) return;
  [ids[idx], ids[swapIdx]] = [ids[swapIdx], ids[idx]];
  order[category] = ids;
  saveDriveOrder(order);
  renderDriveTab();
}

function _buildDriveItemsHtml(items, cat) {
  return items.map(item => {
    const memoPreview = item.memo ? item.memo.split('\n')[0].substring(0, 60) + (item.memo.split('\n')[0].length > 60 ? '…' : '') : '';
    const linkedCount = allListings.filter(l => l.resource_id === item.id).length;
    return `
    <div class="listing-card" style="cursor:default;">
      <div style="margin-bottom:10px;">
        <span style="font-size:0.92rem;font-weight:600;color:var(--gold-soft);">${item.name}</span>
        ${memoPreview ? `<div style="font-size:0.75rem;color:var(--text-muted);margin-top:3px;line-height:1.4;">📝 ${memoPreview}</div>` : ''}
        ${linkedCount ? `<div style="font-size:0.72rem;color:var(--gold);margin-top:2px;opacity:0.8;">🔗 연결된 매물 ${linkedCount}건</div>` : ''}
      </div>
      <div style="display:flex;gap:6px;justify-content:flex-end;flex-wrap:wrap;">
        <button class="btn btn-primary" style="font-size:0.75rem;padding:4px 12px;" onclick="location.href='building-detail.html?id=${item.id}'">📁 열기</button>
        <button class="btn btn-ghost" style="font-size:0.75rem;padding:4px 10px;" onclick="location.href='building-overview.html?id=${item.id}'">📝 개요</button>
        ${item.url ? `<button class="btn btn-ghost" style="font-size:0.75rem;padding:4px 10px;" onclick="window.open('${item.url.replace(/'/g,"%27")}','_blank')">🔗 드라이브</button>` : ''}
        <button class="btn btn-ghost" style="font-size:0.75rem;padding:4px 10px;" onclick="openDriveLinkModal('${item.id}')">🔗 매물연결</button>
        <button class="btn btn-ghost" style="font-size:0.75rem;padding:4px 10px;" onclick="openDriveEdit('${item.id}')">✏️ 수정</button>
        <button class="btn" style="font-size:0.75rem;padding:4px 10px;background:rgba(224,82,82,0.15);color:var(--red);border:1px solid rgba(224,82,82,0.3);" onclick="deleteDriveItem('${item.id}')">🗑 삭제</button>
      </div>
    </div>`;
  }).join("");
}

function renderDriveTab() {
  const container = document.getElementById("driveContent");
  if (!allDriveResources.length) {
    container.innerHTML = `<div class="loading" style="color:var(--text-muted);">등록된 자료가 없습니다. 위 폼에서 추가해주세요.</div>`;
    return;
  }

  const grouped = {};
  allDriveResources.forEach(r => {
    if (!grouped[r.category]) grouped[r.category] = [];
    grouped[r.category].push(r);
  });
  const categories = Object.keys(grouped);

  // 기본: 첫 번째 카테고리 선택
  if (!activeDriveCat || !grouped[activeDriveCat]) activeDriveCat = categories[0];

  // 카테고리 버튼 (index로 식별 — 한글 따옴표 문제 완전 회피)
  const catGridHtml = categories.map((c, i) => {
    const isActive = c === activeDriveCat;
    return `<div style="display:flex;gap:4px;">
      <button data-cidx="${i}" style="
        flex:1;min-width:0;padding:10px 14px;font-size:0.85rem;font-weight:${isActive?'700':'500'};
        text-align:left;border-radius:8px;cursor:pointer;border:1px solid;
        background:${isActive?'rgba(212,175,55,0.18)':'rgba(255,255,255,0.04)'};
        color:${isActive?'var(--gold)':'var(--text-muted)'};
        border-color:${isActive?'rgba(212,175,55,0.5)':'rgba(255,255,255,0.1)'};
        transition:all 0.15s;overflow:hidden;text-overflow:ellipsis;">
        ${isActive?'▲':'▼'} 📂 ${c}
        <span style="font-size:0.72rem;opacity:0.7;">(${grouped[c].length})</span>
      </button>
      <button data-cat-edit-idx="${i}" title="폴더명 수정" style="
        flex:0 0 auto;padding:0 10px;border-radius:8px;cursor:pointer;
        border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.04);
        color:var(--text-muted);font-size:0.85rem;">✏️</button>
    </div>`;
  }).join("");

  // 선택된 카테고리 목록 (전체 표시 — 페이지네이션 없음)
  const cat = activeDriveCat;
  const items = sortedByCatOrder(cat, grouped[cat]);
  const sectionHtml = `
    <div style="border-top:1px solid rgba(212,175,55,0.2);padding-top:12px;margin-top:10px;">
      <div class="listing-grid">${_buildDriveItemsHtml(items, cat)}</div>
    </div>`;

  container.innerHTML = `<div class="quick-card" style="margin-bottom:16px;">
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:4px;">
      ${catGridHtml}
    </div>
    ${sectionHtml}
  </div>`;

  // innerHTML 완료 후 버튼 이벤트 바인딩
  container.querySelectorAll("[data-cidx]").forEach(btn => {
    btn.addEventListener("click", () => {
      activeDriveCat = categories[+btn.dataset.cidx];
      renderDriveTab();
    });
  });
  container.querySelectorAll("[data-cat-edit-idx]").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      openDriveCategoryEditModal(categories[+btn.dataset.catEditIdx]);
    });
  });
}

// ── 등록 폼 개요 메모 템플릿 ──
const MEMO_SEP = "---추가메모---";
const MEMO_TEMPLATE = "주소: \n주차대수: \n사용승인일: \n구조: 지하  층 ~ 지상  층\n토지면적:  평\n연면적:  평\n관리사무소: ";

function splitMemo(raw) {
  if (!raw) return { basic: "", extra: "" };
  const idx = raw.indexOf(MEMO_SEP);
  if (idx === -1) return { basic: raw, extra: "" };
  return { basic: raw.slice(0, idx).trimEnd(), extra: raw.slice(idx + MEMO_SEP.length).trimStart() };
}
function joinMemo(basic, extra) {
  const b = (basic || "").trim();
  const e = (extra || "").trim();
  if (!b && !e) return null;
  if (!e) return b;
  return b + "\n" + MEMO_SEP + "\n" + e;
}

// 등록 폼 기본정보 칸 초기 템플릿
document.getElementById("drive_memo_basic_reg").value = MEMO_TEMPLATE;

// ── 매물연결 모달 ──
let linkEditingDriveId = null;
function openDriveLinkModal(id) {
  linkEditingDriveId = id;
  document.getElementById("driveLinkModal").style.display = "flex";
  renderDriveLinkList();
}
function renderDriveLinkList() {
  const area = document.getElementById("driveLinkListArea");
  const activeListings = allListings.filter(l => l.status !== "거래완료");
  if (!activeListings.length) {
    area.innerHTML = `<div style="font-size:0.82rem;color:var(--text-muted);">등록된 매물이 없습니다</div>`;
    return;
  }
  area.innerHTML = activeListings.map(l => {
    const checked = l.resource_id === linkEditingDriveId;
    return `<label style="display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:6px;cursor:pointer;background:${checked?'rgba(212,175,55,0.1)':'rgba(255,255,255,0.03)'};border:1px solid ${checked?'rgba(212,175,55,0.35)':'rgba(255,255,255,0.07)'};margin-bottom:6px;">
      <input type="checkbox" data-lid="${l.id}" ${checked?'checked':''} style="width:auto;accent-color:var(--gold);" />
      <div style="flex:1;">
        <div style="font-size:0.85rem;font-weight:600;color:var(--text-main);">${l.address || l.title || "(주소 미입력)"}</div>
        <div style="font-size:0.74rem;color:var(--text-muted);">${getTypeLabel(l.type)} · ${formatPrice(l)}</div>
      </div>
    </label>`;
  }).join("");
}
document.getElementById("driveLinkSaveBtn").addEventListener("click", async () => {
  if (!linkEditingDriveId) return;
  const btn = document.getElementById("driveLinkSaveBtn");
  btn.disabled = true; btn.textContent = "저장 중...";
  const checked = [...document.querySelectorAll("#driveLinkListArea input[type=checkbox]:checked")].map(c => c.dataset.lid);
  const unchecked = [...document.querySelectorAll("#driveLinkListArea input[type=checkbox]:not(:checked)")].map(c => c.dataset.lid);
  try {
    await Promise.all([
      ...checked.map(lid => updateListingResourceId(lid, linkEditingDriveId)),
      ...unchecked.filter(lid => {
        const l = allListings.find(x => x.id === lid);
        return l && l.resource_id === linkEditingDriveId;
      }).map(lid => updateListingResourceId(lid, null))
    ]);
    document.getElementById("driveLinkModal").style.display = "none";
    showToast(`✅ 매물 연결 저장됨`);
    allListings = await getListings();
    renderDriveTab();
  } catch(e) { showToast("❌ 실패: " + e.message); }
  finally { btn.disabled = false; btn.textContent = "저장"; }
});

// ── 자료 수정 ──
let editingDriveId = null;
function openDriveEdit(id) {
  const item = allDriveResources.find(r => r.id === id);
  if (!item) return;
  editingDriveId = id;
  document.getElementById("drive_edit_category").value = item.category || "";
  document.getElementById("drive_edit_name").value = item.name || "";
  document.getElementById("drive_edit_url").value = item.url || "";
  document.getElementById("driveEditModal").style.display = "flex";
}

async function deleteDriveItem(id) {
  if (!confirm("이 항목을 삭제하시겠습니까?")) return;
  try {
    await deleteDriveResource(id);
    showToast("🗑 삭제되었습니다");
    await loadDriveResources();
  } catch(e) {
    showToast("❌ 삭제 실패: " + e.message);
  }
}

document.getElementById("driveEditSaveBtn").addEventListener("click", async () => {
  if (!editingDriveId) return;
  const btn = document.getElementById("driveEditSaveBtn");
  const category = document.getElementById("drive_edit_category").value.trim();
  const name = document.getElementById("drive_edit_name").value.trim();
  if (!category || !name) { showToast("카테고리와 건물명을 입력해주세요"); return; }
  btn.disabled = true; btn.textContent = "저장 중...";
  try {
    await updateDriveResource(editingDriveId, {
      category,
      name,
      url: document.getElementById("drive_edit_url").value.trim()
    });
    document.getElementById("driveEditModal").style.display = "none";
    showToast("✅ 수정되었습니다");
    await loadDriveResources();
  } catch(e) {
    showToast("❌ 수정 실패: " + e.message);
  } finally {
    btn.disabled = false; btn.textContent = "저장";
  }
});

// ── 카테고리 폴더명 일괄 변경 ──
let editingCategoryOld = null;
function openDriveCategoryEditModal(oldCategory) {
  editingCategoryOld = oldCategory;
  document.getElementById("drive_cat_edit_name").value = oldCategory;
  document.getElementById("driveCategoryEditModal").style.display = "flex";
}

document.getElementById("driveCategoryEditSaveBtn").addEventListener("click", async () => {
  if (!editingCategoryOld) return;
  const btn = document.getElementById("driveCategoryEditSaveBtn");
  const newCategory = document.getElementById("drive_cat_edit_name").value.trim();

  if (!newCategory) { showToast("카테고리명을 입력해주세요"); return; }
  if (newCategory === editingCategoryOld) {
    document.getElementById("driveCategoryEditModal").style.display = "none";
    return;
  }
  const existingCategories = [...new Set(allDriveResources.map(r => r.category).filter(Boolean))];
  if (existingCategories.includes(newCategory)) {
    showToast("❌ 이미 존재하는 카테고리명입니다");
    return;
  }
  if (!confirm("이 카테고리의 기존 자료들도 모두 새 폴더명으로 이동됩니다. 계속할까요?")) return;

  const targetItems = allDriveResources.filter(r => r.category === editingCategoryOld);
  btn.disabled = true; btn.textContent = "저장 중...";
  try {
    await Promise.all(targetItems.map(item => updateDriveResource(item.id, { category: newCategory })));
    document.getElementById("driveCategoryEditModal").style.display = "none";
    activeDriveCat = newCategory;
    showToast("✅ 카테고리명이 변경되었습니다");
    await loadDriveResources();
  } catch(e) {
    showToast("❌ 변경 실패: " + e.message);
  } finally {
    btn.disabled = false; btn.textContent = "저장";
  }
});

// ===== 초기화 =====
async function initResourcesPage() {
  try {
    const [listings, resources] = await Promise.all([getListings(), getDriveResources()]);
    allListings = listings;
    allDriveResources = resources;
    renderDriveTab();
    updateDriveCategorySelect();
  } catch(e) {
    document.getElementById("driveContent").innerHTML = `<div class="loading">❌ 불러오기 실패: ${e.message}</div>`;
  }
}
initResourcesPage();
