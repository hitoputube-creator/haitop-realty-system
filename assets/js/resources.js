// ===== 자료관리 페이지 상태 =====
let allDriveResources = [];
let allListings = [];
let allDriveCategories = [];
function escapeCategory(value) { return String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function visibleDriveCategories() { return allDriveCategories.filter(c => driveResourceScope === 'all' || c.room === driveResourceScope); }
async function ensureCategoryInRoom(name, room = driveResourceScope === 'all' ? 'commercial' : driveResourceScope) {
  if (!allDriveCategories.some(c => c.name === name)) {
    await createDriveCategory(name, room);
    allDriveCategories = await getDriveCategories();
  }
}
const driveResourceScope = HitopResourceRooms.pageScope(document.body, location.search);
function visibleDriveResources() { return HitopResourceRooms.visible(allDriveResources, driveResourceScope); }
function openDriveBuilding(page, id) {
  const resource = allDriveResources.find(r => r.id === id);
  if (HitopResourceRooms.resourceRoom(resource) === 'land') page = 'land-resource.html';
  location.href = HitopResourceRooms.detailUrl(page, id, driveResourceScope);
}
let activeDriveCat = null;   // 현재 열린 카테고리 (단일)
let residentialSearch = '';
let residentialVillage = '';

// ===== 공통 유틸 =====
function showToast(msg, duration = 2000) {
  const t = document.getElementById("toast");
  t.textContent = msg; t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), duration);
}

// 매물연결 모달에 표시할 매물 유형 표기 — storage.js의 표준 카테고리 정규화(getListingCategoryLabel) 사용.

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
    allDriveCategories = await getDriveCategories();
    allDriveResources = await getDriveResources();
    renderDriveTab();
    updateDriveCategorySelect();
  } catch(e) {
    container.innerHTML = `<div class="loading">❌ 불러오기 실패: ${e.message}</div>`;
  }
}

function updateDriveCategorySelect() {
  const select = document.getElementById("drive_cat_select");
  const categories = visibleDriveCategories().map(c => c.name);
  select.innerHTML = `<option value="">-- 직접 입력 --</option>` +
    categories.map(c => `<option value="${escapeCategory(c)}">${escapeCategory(c)}</option>`).join("");
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
  if (!name) { showToast(driveResourceScope === "land" ? "자료명을 입력해주세요" : "건물명을 입력해주세요"); return; }
  btn.disabled = true; btn.textContent = "저장 중...";
  try {
    const statusEl=document.getElementById("drive_completion_reg"),monthEl=document.getElementById("drive_movein_reg");
    let basic=document.getElementById("drive_memo_basic_reg").value;
    for(const [key,el] of [["단지상태",statusEl],["입주예정월",monthEl]]){
      if(el && el.value) basic=basic.split(/\r?\n/).filter(line=>!line.startsWith(key+":")).join("\n")+"\n"+key+": "+el.value;
    }
    const memo = joinMemo(
      basic,
      document.getElementById("drive_memo_extra_reg").value
    );
    await ensureCategoryInRoom(category);
    let createdId;
    const next=document.getElementById('drive_after_save')?.value || '';
    if(driveResourceScope==='residential' && next){
      const existing=(await getDriveResources()).filter(r=>HitopResourceRooms.isResidential(r) && r.category===category && r.name.replace(/\s+/g,'')===name.replace(/\s+/g,''));
      if(existing.length>1)throw new Error('같은 이름의 단지 자료가 여러 개입니다. 자료목록에서 사용할 단지를 선택해주세요.');
      if(existing.length===1){location.href=OfficeConfig.urlFor(HitopResourceRooms.detailUrl(next==='plans'?'building-detail.html':'building-overview.html',existing[0].id,'residential')+(next==='overview'?'&edit=1':''));return;}
      createdId=crypto.randomUUID();
    }
    await addDriveResource({ ...(createdId ? {id:createdId} : {}), category, name, url, memo });
    if(createdId){location.href=OfficeConfig.urlFor(HitopResourceRooms.detailUrl(next==='plans'?'building-detail.html':'building-overview.html',createdId,'residential')+(next==='overview'?'&edit=1':''));return;}
    document.getElementById("drive_category").value = "";
    document.getElementById("drive_name").value = "";
    document.getElementById("drive_url").value = "";
    if(statusEl)statusEl.value="";if(monthEl)monthEl.value="";
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
  try { return JSON.parse(OfficeStorage.local.getItem('drive_order') || '{}'); } catch { return {}; }
}
function saveDriveOrder(obj) {
  OfficeStorage.local.setItem('drive_order', JSON.stringify(obj));
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

function residentialMapLinks(item) {
  if (HitopResourceRooms.resourceRoom(item) !== 'residential') return '';
  const line = String(item.memo || '').split('\n').find(value => /^주소\s*:/.test(value));
  const address = line ? line.replace(/^주소\s*:/, '').trim() : '';
  const destinations = window.HitopNaverLinks && HitopNaverLinks.urls(address);
  const complex = window.HitopNaverLinks && HitopNaverLinks.complexDestination(item.name, item.memo);
  const id = encodeURIComponent(item.id);
  return `<a class="btn btn-ghost" href="residential-location.html?id=${id}">위치도</a><a class="btn btn-ghost" href="residential-kakao.html?id=${id}">카카오맵</a>` + (destinations ? `<a class="btn btn-ghost" href="${escapeCategory(destinations.map)}" target="_blank" rel="noopener noreferrer">네이버지도</a>` : '') + (complex ? `<a class="btn btn-ghost" href="${escapeCategory(complex.url)}" target="_blank" rel="noopener noreferrer">${complex.label}</a>` : '');
}
function _buildDriveItemsHtml(items, cat) {
  return items.map(item => {
    const memoPreview = item.memo ? item.memo.split('\n')[0].substring(0, 60) + (item.memo.split('\n')[0].length > 60 ? '…' : '') : '';
    const linkedCount = allListings.filter(l => l.resource_id === item.id).length;
    return `
    <div class="listing-card" style="cursor:default;">
      <div style="margin-bottom:10px;">
        <span style="font-size:0.92rem;font-weight:600;color:var(--gold-soft);">${item.name}</span>${item._shared_reference ? '<span style="font-size:0.72rem;color:var(--text-muted);">공유 기본자료</span>' : ''}
        ${memoPreview ? `<div style="font-size:0.75rem;color:var(--text-muted);margin-top:3px;line-height:1.4;">📝 ${memoPreview}</div>` : ''}
        ${residentialBasicSummary(item)}
        ${linkedCount ? `<div style="font-size:0.72rem;color:var(--gold);margin-top:2px;opacity:0.8;">🔗 연결된 매물 ${linkedCount}건</div>` : ''}
      </div>
      <div style="display:flex;gap:6px;justify-content:flex-end;flex-wrap:wrap;">
        ${residentialMapLinks(item)}
        <button class="btn btn-primary" style="font-size:0.75rem;padding:4px 12px;" onclick="openDriveBuilding('building-detail.html','${item.id}')">📁 열기</button>
        <button class="btn btn-ghost" style="font-size:0.75rem;padding:4px 10px;" onclick="openDriveBuilding('building-overview.html','${item.id}')">📝 개요</button>
        ${item.url ? `<button class="btn btn-ghost" style="font-size:0.75rem;padding:4px 10px;" onclick="window.open('${item.url.replace(/'/g,"%27")}','_blank')">🔗 드라이브</button>` : ''}
        <button class="btn btn-ghost" style="font-size:0.75rem;padding:4px 10px;" onclick="openDriveLinkModal('${item.id}')">🔗 매물연결</button>
        <button class="btn btn-ghost" style="font-size:0.75rem;padding:4px 10px;" onclick="openDriveEdit('${item.id}')">✏️ 수정</button>
        <button class="btn" style="font-size:0.75rem;padding:4px 10px;background:rgba(224,82,82,0.15);color:var(--red);border:1px solid rgba(224,82,82,0.3);" onclick="deleteDriveItem('${item.id}')">🗑 삭제</button>
      </div>
    </div>`;
  }).join("");
}

function residentialBasicSummary(item) {
  if (HitopResourceRooms.resourceRoom(item) !== 'residential') return '';
  const fields = {};
  String(item.memo || '').split(MEMO_SEP)[0].split('\n').forEach(line => {
    const colon = line.indexOf(':');
    if (colon >= 0) fields[line.slice(0, colon).trim()] = line.slice(colon + 1).trim();
  });
  const summary = ['행정구역','동수','세대수','단지상태','입주예정월','사용승인일'].filter(key => fields[key])
    .map(key => key === '사용승인일' ? '준공 ' + fields[key] : key === '입주예정월' ? fields[key]+' 입주예정' : fields[key]);
  return summary.length ? `<div style="font-size:.78rem;color:var(--gold-soft);margin-top:6px;">${escapeCategory(summary.join(' · '))}</div>` : '';
}

function searchResidentialItems(items) {
  const words = residentialSearch.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return items.filter(item => words.every(word => `${item.name} ${item.memo || ''}`.toLocaleLowerCase().includes(word)));
}


let categoryOrderSaving = false;
async function moveDriveCategory(fromId, toId) {
  if (categoryOrderSaving || fromId === toId) return;
  const categories = visibleDriveCategories();
  const from = categories.findIndex(c => c.id === fromId);
  const to = categories.findIndex(c => c.id === toId);
  if (from < 0 || to < 0) return;
  const reordered = categories.slice();
  reordered.splice(to, 0, reordered.splice(from, 1)[0]);
  const previous = allDriveCategories;
  const slots = categories.map(c => Number(c.sort_order));
  const positions = new Map(reordered.map((c, i) => [c.id, slots[i]]));
  allDriveCategories = allDriveCategories.map(c => positions.has(c.id) ? {...c, sort_order: positions.get(c.id)} : c)
    .sort((a, b) => Number(a.sort_order) - Number(b.sort_order));
  categoryOrderSaving = true;
  renderDriveTab(); updateDriveCategorySelect();
  try {
    await saveDriveCategoryOrder(reordered.map(c => c.id), driveResourceScope);
    showToast("✅ 카테고리 순서가 저장되었습니다");
  } catch (error) {
    allDriveCategories = previous;
    renderDriveTab(); updateDriveCategorySelect();
    showToast("❌ " + error.message, 4000);
  } finally { categoryOrderSaving = false; }
}
function bindDriveCategoryDrag(container) {
  const rows = [...container.querySelectorAll("[data-category-id]")];
  let sourceId = null, targetId = null;
  function clearDrag() {
    rows.forEach(row => row.classList.remove("drive-cat-dragging", "drive-cat-drop-target"));
  }
  function markTarget(row) {
    rows.forEach(r => r.classList.remove("drive-cat-drop-target"));
    targetId = row && row.dataset.categoryId !== sourceId ? row.dataset.categoryId : null;
    if (targetId) row.classList.add("drive-cat-drop-target");
  }
  rows.forEach(row => {
    const id = row.dataset.categoryId;
    row.addEventListener("dragstart", event => {
      if (categoryOrderSaving || event.target.closest("[data-cat-edit-idx]")) { event.preventDefault(); return; }
      sourceId = id; targetId = null;
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", id);
      row.classList.add("drive-cat-dragging");
    });
    row.addEventListener("dragover", event => {
      if (!sourceId) return;
      event.preventDefault(); event.dataTransfer.dropEffect = "move"; markTarget(row);
    });
    row.addEventListener("drop", event => {
      if (!sourceId) return;
      event.preventDefault();
      const from = sourceId; sourceId = null; targetId = null; clearDrag();
      moveDriveCategory(from, id);
    });
    row.addEventListener("dragend", () => { sourceId = null; targetId = null; clearDrag(); });
    const grip = row.querySelector("[data-category-grip]");
    grip.addEventListener("keydown", event => {
      const offset = {ArrowLeft:-1, ArrowRight:1, ArrowUp:-2, ArrowDown:2}[event.key];
      if (!offset) return;
      event.preventDefault();
      const index = rows.findIndex(r => r.dataset.categoryId === id);
      const target = rows[index + offset];
      if (target) moveDriveCategory(id, target.dataset.categoryId).then(() => {
        const moved = [...container.querySelectorAll("[data-category-id]")].find(r => r.dataset.categoryId === id);
        if (moved) moved.querySelector("[data-category-grip]").focus();
      });
    });
    grip.addEventListener("pointerdown", event => {
      if (event.pointerType === "mouse" || categoryOrderSaving) return;
      event.preventDefault(); sourceId = id; targetId = null;
      grip.setPointerCapture(event.pointerId); row.classList.add("drive-cat-dragging");
    });
    grip.addEventListener("pointermove", event => {
      if (sourceId !== id || event.pointerType === "mouse") return;
      const hit = document.elementFromPoint(event.clientX, event.clientY);
      const target = hit && hit.closest("[data-category-id]");
      markTarget(rows.includes(target) ? target : null);
    });
    grip.addEventListener("pointerup", event => {
      if (sourceId !== id || event.pointerType === "mouse") return;
      const from = sourceId, to = targetId;
      sourceId = null; targetId = null; clearDrag();
      if (grip.hasPointerCapture(event.pointerId)) grip.releasePointerCapture(event.pointerId);
      if (to) moveDriveCategory(from, to);
    });
    grip.addEventListener("pointercancel", () => { sourceId = null; targetId = null; clearDrag(); });
  });
}

function apartmentVillageName(item) {
  const name = String(item.name || '').normalize('NFC').replace(/\s+/g, '');
  const match = name.match(/([가-힣]+마을)/);
  if (match) return match[1];
  const memoMatch = String(item.memo || '').match(/(?:마을명|마을)\s*[:：]\s*([가-힣]+마을)/);
  return memoMatch ? memoMatch[1] : '기타 단지';
}
function buildDriveResourceResults(items, category) {
  return _buildDriveItemsHtml(items, category);
}
function selectedResidentialItems(items,category) {
  const matches=searchResidentialItems(items);
  return category==='아파트' && residentialVillage ? matches.filter(item=>apartmentVillageName(item)===residentialVillage) : matches;
}

function renderDriveTab() {
  const container = document.getElementById("driveContent");
  const visibleResources = visibleDriveResources();
  const categories = visibleDriveCategories().map(c => c.name);
  if (!categories.length) {
    container.innerHTML = `<div class="loading" style="color:var(--text-muted);">등록된 자료가 없습니다. 위 폼에서 추가해주세요.</div>`;
    return;
  }

  const grouped = Object.fromEntries(categories.map(c => [c, []]));
  visibleResources.forEach(r => {
    if (!grouped[r.category]) grouped[r.category] = [];
    grouped[r.category].push(r);
  });


  // 기본: 첫 번째 카테고리 선택
  if (!activeDriveCat || !grouped[activeDriveCat]) activeDriveCat = categories[0];

  // 카테고리 버튼 (index로 식별 — 한글 따옴표 문제 완전 회피)
  const catGridHtml = categories.map((c, i) => {
    const isActive = c === activeDriveCat;
    return `<div class="drive-category-row" data-category-id="${visibleDriveCategories()[i].id}" draggable="true" style="display:flex;gap:4px;">
      <button type="button" class="drive-category-grip" data-category-grip aria-label="${escapeCategory(c)} 순서 변경: 끌기 또는 방향키" title="끌어서 순서 변경 · 방향키로 이동">⠿</button>
      <button data-cidx="${i}" style="
        flex:1;min-width:0;padding:10px 14px;font-size:0.85rem;font-weight:${isActive?'700':'500'};
        text-align:left;border-radius:8px;cursor:pointer;border:1px solid;
        background:${isActive?'rgba(212,175,55,0.18)':'rgba(255,255,255,0.04)'};
        color:${isActive?'var(--gold)':'var(--text-muted)'};
        border-color:${isActive?'rgba(212,175,55,0.5)':'rgba(255,255,255,0.1)'};
        transition:all 0.15s;overflow:hidden;text-overflow:ellipsis;">
        ${isActive?'▲':'▼'} 📂 ${escapeCategory(c)}
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
  const isApartment=driveResourceScope==='residential' && cat==='아파트';
  const villageCounts=new Map();
  if(isApartment)items.forEach(item=>{const village=apartmentVillageName(item);villageCounts.set(village,(villageCounts.get(village)||0)+1);});
  if(isApartment && residentialVillage && !villageCounts.has(residentialVillage))residentialVillage='';
  const villages=[...villageCounts.keys()].sort((a,b)=>a==='기타 단지'?1:b==='기타 단지'?-1:a.localeCompare(b,'ko'));
  const villageHtml=isApartment ? '<div style="margin-bottom:12px;"><select id="residentialVillageSelect" aria-label="마을 선택" style="width:260px;max-width:100%;color-scheme:dark;"><option value="">전체 마을 ('+items.length+')</option>'+villages.map(v=>'<option value="'+escapeCategory(v)+'"'+(residentialVillage===v?' selected':'')+'>'+escapeCategory(v)+' ('+villageCounts.get(v)+')</option>').join('')+'</select></div>' : '';
  const shown = driveResourceScope === 'residential' ? selectedResidentialItems(items,cat) : items;
  const searchHtml = driveResourceScope === 'residential' ? `<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:12px;">
    <input id="residentialResourceSearch" type="search" aria-label="주거자료 검색" placeholder="단지명 · 마을명 · 주소 검색" value="${escapeCategory(residentialSearch)}" style="flex:1;min-width:180px;">
    <span id="residentialSearchCount" style="font-size:.8rem;color:var(--text-muted);">${shown.length} / ${items.length}개</span>
  </div>` : '';
  const sectionHtml = `
    <div style="border-top:1px solid rgba(212,175,55,0.2);padding-top:12px;margin-top:10px;">
      ${villageHtml}
      ${searchHtml}
      <div class="listing-grid" id="driveResourceResults">${shown.length ? buildDriveResourceResults(shown, cat) : '<div class="loading">표시할 자료가 없습니다.</div>'}</div>
    </div>`;

  container.innerHTML = `<div class="quick-card" style="margin-bottom:16px;">
    <div class="drive-category-order-hint">⠿ 손잡이를 끌어서 카테고리 순서를 바꿀 수 있습니다.</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:4px;">
      ${catGridHtml}
    </div>
    ${sectionHtml}
  </div>`;

  bindDriveCategoryDrag(container);
  const searchInput = document.getElementById('residentialResourceSearch');
  if (searchInput) searchInput.addEventListener('input', () => {
    residentialSearch = searchInput.value;
    const filtered = selectedResidentialItems(items,cat);
    document.getElementById('driveResourceResults').innerHTML = filtered.length ? buildDriveResourceResults(filtered, cat) : '<div class="loading">검색 결과가 없습니다.</div>';
    document.getElementById('residentialSearchCount').textContent = `${filtered.length} / ${items.length}개`;
  });
  const villageSelect=document.getElementById('residentialVillageSelect');
  if(villageSelect)villageSelect.addEventListener('change',()=>{
    residentialVillage=villageSelect.value;
    const filtered=selectedResidentialItems(items,cat);
    document.getElementById('driveResourceResults').innerHTML=filtered.length?buildDriveResourceResults(filtered,cat):'<div class="loading">검색 결과가 없습니다.</div>';
    document.getElementById('residentialSearchCount').textContent=filtered.length+' / '+items.length+'개';
  });
  // innerHTML 완료 후 버튼 이벤트 바인딩
  container.querySelectorAll("[data-cidx]").forEach(btn => {
    btn.addEventListener("click", () => {
      if(activeDriveCat!==categories[+btn.dataset.cidx])residentialVillage='';
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
const MEMO_TEMPLATE = driveResourceScope === "land" ? "블럭: \n필지·번지: \n건물 유무: \n면적(㎡/평): \n공급금액: \n낙찰가격: \n매매금액: \n소유주: \n연락처: " : "주소: \n주차대수: \n사용승인일: \n구조: 지하  층 ~ 지상  층\n토지면적:  평\n연면적:  평\n관리사무소: ";

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
        <div style="font-size:0.74rem;color:var(--text-muted);">${getListingCategoryLabel(l)} · ${formatPrice(l)}</div>
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
  if (!category || !name) { showToast("카테고리와 자료명을 입력해주세요"); return; }
  btn.disabled = true; btn.textContent = "저장 중...";
  try {
    await ensureCategoryInRoom(category);
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

// ===== 카테고리 추가 / 이름 수정 =====
let editingCategoryOld = null;
function openDriveCategoryEditModal(oldCategory = null) {
  editingCategoryOld = oldCategory;
  document.getElementById("driveCategoryModalTitle").textContent = oldCategory ? "📂 카테고리 이름 수정" : "📂 카테고리 추가";
  document.getElementById("drive_cat_edit_name").value = oldCategory || "";
  document.getElementById("drive_cat_add_room_field").style.display = !oldCategory && driveResourceScope === 'all' ? "" : "none";
  document.getElementById("drive_cat_add_room").value = driveResourceScope === 'all' ? 'commercial' : driveResourceScope;
  document.getElementById("driveCategoryEditModal").style.display = "flex";
  document.getElementById("drive_cat_edit_name").focus();
}
document.getElementById("driveCategoryAddBtn").addEventListener("click", () => openDriveCategoryEditModal());
document.getElementById("driveCategoryEditSaveBtn").addEventListener("click", async () => {
  const btn = document.getElementById("driveCategoryEditSaveBtn");
  const newCategory = document.getElementById("drive_cat_edit_name").value.trim();
  if (!newCategory) { showToast("카테고리명을 입력해주세요"); return; }
  if (newCategory === editingCategoryOld) {
    document.getElementById("driveCategoryEditModal").style.display = "none"; return;
  }
  if (allDriveCategories.some(c => c.name === newCategory)) { showToast("이미 존재하는 카테고리명입니다"); return; }
  const oldCategory = editingCategoryOld;
  btn.disabled = true; btn.textContent = "저장 중...";
  try {
    if (oldCategory) {
      const category = allDriveCategories.find(c => c.name === oldCategory);
      if (!category) throw new Error("카테고리를 찾을 수 없습니다. 새로고침해주세요");
      await renameDriveCategory(category, newCategory);
      const order = getDriveOrder();
      if (order[oldCategory]) { order[newCategory] = order[oldCategory]; delete order[oldCategory]; try { saveDriveOrder(order); } catch (_) {} }
    } else {
      await createDriveCategory(newCategory, document.getElementById("drive_cat_add_room").value);
    }
    document.getElementById("driveCategoryEditModal").style.display = "none";
    activeDriveCat = newCategory;
    showToast(oldCategory ? "✅ 카테고리명이 변경되었습니다" : "✅ 카테고리가 추가되었습니다");
    await loadDriveResources();
  } catch(e) { showToast("❌ 저장 실패: " + e.message); }
  finally { btn.disabled = false; btn.textContent = "저장"; }
});

// ===== 초기화 =====
async function initResourcesPage() {
  try {
    allDriveCategories = await getDriveCategories();
    const [listings, resources] = await Promise.all([getListings(), getDriveResources()]);
    allListings = listings;
    allDriveResources = resources;
    renderDriveTab();
    updateDriveCategorySelect();
  } catch(e) {
    document.getElementById("driveContent").innerHTML = `<div class="loading">❌ 불러오기 실패: ${e.message}</div>`;
  }
}
function prefillMapComplex() {
  const params=new URLSearchParams(location.search);
  if(driveResourceScope!=='residential' || params.get('fromMap')!=='1')return;
  document.getElementById('driveRegisterCard').style.display='';
  document.getElementById('driveRegisterToggleBtn').textContent='📁 자료 등록 접기';
  document.getElementById('drive_category').value='아파트';
  document.getElementById('drive_name').value=params.get('apartmentName') || '';
  let basic=MEMO_TEMPLATE;
  const set=(key,value)=>{if(value)basic=basic.split(/\r?\n/).filter(line=>!line.startsWith(key+':')).join('\n')+'\n'+key+': '+value;};
  set('주소',params.get('roadAddress') || params.get('jibunAddress'));set('지번주소',params.get('jibunAddress'));set('주택종류','아파트');
  const lat=Number(params.get('mapLat')),lng=Number(params.get('mapLng'));
  if(params.has('mapLat') && params.has('mapLng') && lat>=33 && lat<=39 && lng>=124 && lng<=132){set('지도위도',String(lat));set('지도경도',String(lng));}
  document.getElementById('drive_memo_basic_reg').value=basic;
  const name=params.get('apartmentName') || '',month=name.match(/(20\d{2})년\s*(\d{1,2})월/);
  if(/예정/.test(name))document.getElementById('drive_completion_reg').value='입주예정';
  if(month)document.getElementById('drive_movein_reg').value=month[1]+'-'+month[2].padStart(2,'0');
  document.getElementById('drive_after_save').value='overview';
}
prefillMapComplex();
initResourcesPage();

