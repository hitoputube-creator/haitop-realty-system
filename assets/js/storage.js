// 부동산 선택은 탭별로 유지한다. 프로젝트와 입력 임시저장은 서로 분리한다.
const OfficeConfig = (() => {
  const offices = {
    hitop: { label: '하이탑부동산', brand: 'HITOP', url: 'https://xaxbkdnrzsghsabkdvzj.supabase.co', key: 'sb_publishable_gqNFRMHb6yYKvqFnQurPKQ_7gGhURVd' },
    ktop: { label: '케이탑부동산', brand: 'KTOP', url: 'https://enefadyhmhfphtochlku.supabase.co', key: 'sb_publishable__8Ru0l0wfQo8e5Ljq1ZQ7Q_LYtCAP-p' }
  };
  const requested = new URLSearchParams(location.search).get('office');
  let saved;
  try { saved = sessionStorage.getItem('realty_selected_office'); } catch (_) {}
  const id = Object.hasOwn(offices, requested) ? requested : Object.hasOwn(offices, saved) ? saved : 'hitop';
  try { sessionStorage.setItem('realty_selected_office', id); } catch (_) {}
  const root = new URL('./', location.href);
  function url(path) {
    const target = new URL(path, root);
    if (target.origin !== root.origin || !target.pathname.startsWith(root.pathname)) throw new Error('잘못된 이동 주소입니다.');
    target.searchParams.set('office', id);
    return target.href;
  }
  const current = new URL(location.href);
  current.searchParams.set('office', id);
  history.replaceState(null, '', current.href);
  return Object.freeze({ id, ...offices[id], urlFor: url });
})();

if (OfficeConfig.id === 'ktop') {
  const style=document.createElement('style');
  style.textContent='[data-homepage-only],.image-public-check{display:none!important}';
  document.head.appendChild(style);
}

const OFFICE_DIARY_URL = OfficeConfig.id === 'ktop' ? new URL('ktop-diary/', location.href).href : 'https://haitop-realestate-diary.vercel.app/';

const OfficeStorage = {
  key(key) { return OfficeConfig.id === 'hitop' ? key : 'ktop:' + key; },
  local: {
    getItem(key) { return localStorage.getItem(OfficeStorage.key(key)); },
    setItem(key, value) { localStorage.setItem(OfficeStorage.key(key), value); },
    removeItem(key) { localStorage.removeItem(OfficeStorage.key(key)); }
  },
  session: {
    getItem(key) { return sessionStorage.getItem(OfficeStorage.key(key)); },
    setItem(key, value) { sessionStorage.setItem(OfficeStorage.key(key), value); },
    removeItem(key) { sessionStorage.removeItem(OfficeStorage.key(key)); }
  }
};

// ===== localStorage 유틸 (buildings.js 호환) =====
const StorageUtil = {
  getArray(key) {
    try { return JSON.parse(OfficeStorage.local.getItem(key) || '[]') || []; } catch(e) { return []; }
  },
  setArray(key, arr) {
    try { OfficeStorage.local.setItem(key, JSON.stringify(arr)); } catch(e) {}
  },
  uid(prefix) {
    return (prefix ? prefix + '_' : '') + Date.now().toString(36) + Math.random().toString(36).slice(2);
  }
};

const SUPABASE_URL = OfficeConfig.url;
const SUPABASE_KEY = OfficeConfig.key;
const LISTING_IMAGES_BUCKET = "listing-images";
const MAX_LISTING_IMAGES = 5;

// 매물 이미지 첨부 영역은 사진 외에 PDF 문서(등기부등본·건축물대장 등)도 받는다.
// 공개 홈페이지 이미지 갤러리는 실제 이미지 파일만 노출해야 하므로, 이 판별은
// 업로드 허용 여부뿐 아니라 공개용 image_urls를 걸러내는 데도 재사용한다.
function isListingImageFile(nameOrUrl) {
  return /\.(jpe?g|png|gif|webp|bmp|svg)(\?|$)/i.test(nameOrUrl || "");
}

// ===== 자주쓰는 운정역 상가·오피스텔 (등록/수정 화면 주소 빠른선택용) =====
// 출처: 운정역 상가 주소.pdf. 전부 와동동 소재.
const UNJEONG_QUICK_BUILDINGS = [
  { name: "덕진빌딩", category: "상가", addr: "와동동 1426-1" },
  { name: "명품3차", category: "상가", addr: "와동동 1466-1" },
  { name: "법조타운", category: "상가", addr: "와동동 1384" },
  { name: "브릭스(BRICKS)", category: "상가", addr: "와동동 1464" },
  { name: "세안파크", category: "상가", addr: "와동동 1452" },
  { name: "송림로데오", category: "상가", addr: "와동동 1434-1" },
  { name: "송림메디컬", category: "상가", addr: "와동동 1450-1" },
  { name: "아름터타워", category: "상가", addr: "와동동 1458-1" },
  { name: "아주빌딩", category: "상가", addr: "와동동 1429" },
  { name: "월드9차", category: "상가", addr: "와동동 1426" },
  { name: "월드10차", category: "상가", addr: "와동동 1423-2" },
  { name: "월드11차", category: "상가", addr: "와동동 1423-1" },
  { name: "월드12차", category: "상가", addr: "와동동 1431-1" },
  { name: "월드15차", category: "상가", addr: "와동동 1462" },
  { name: "월드로데오", category: "상가", addr: "와동동 1438" },
  { name: "월드스퀘어", category: "상가", addr: "와동동 1456-3" },
  { name: "유은8차", category: "상가", addr: "와동동 1454-1" },
  { name: "유은9차", category: "상가", addr: "와동동 1460" },
  { name: "트윈타워1차", category: "상가", addr: "와동동 1442" },
  { name: "트윈타워2차", category: "상가", addr: "와동동 1443" },
  { name: "더운정퍼스트", category: "상가", addr: "와동동 1436" },
  { name: "프라임타워", category: "상가", addr: "와동동 1469-1" },
  { name: "한미프라자", category: "상가", addr: "와동동 1469-1" },
  { name: "현해", category: "상가", addr: "와동동 1464-1" },
  { name: "홍원프라자", category: "상가", addr: "와동동 1437" },
  { name: "한강듀클래스", category: "상가", addr: "와동동 1484, 1484-2" },
  { name: "힐데스하임", category: "오피스텔", addr: "와동동 1498" },
  { name: "엠버418", category: "오피스텔", addr: "와동동 1454" },
  { name: "브릿지(Bridge)10", category: "오피스텔", addr: "와동동 1444, 1444-1" },
  { name: "디에이블", category: "오피스텔", addr: "와동동 1456-1" },
  { name: "레이크필드위버젠", category: "오피스텔", addr: "와동동 1433-1" },
  { name: "남광하우스토리", category: "오피스텔", addr: "와동동 1431" },
  { name: "클래스원", category: "오피스텔", addr: "와동동 1454-2" },
  { name: "센트럴하이뷰", category: "오피스텔", addr: "와동동 1433" },
  { name: "아르젠", category: "오피스텔", addr: "와동동 1484-1" },
  { name: "힐스테이트더운정1단지", category: "오피스텔", addr: "와동동 1471-2" },
  { name: "힐스테이트더운정2단지", category: "오피스텔", addr: "와동동 1471-3" },
  { name: "푸르지오파크라인1단지", category: "오피스텔", addr: "와동동 1500" },
  { name: "푸르지오파크라인2단지", category: "오피스텔", addr: "와동동 1498-2" },
];

// register.html / detail.html(수정 모달) 공용: 빠른선택 <select>를 채우고,
// 선택 시 공개주소·지도검색주소·단지명을 자동입력한다. 공장창고·토지는
// 운정역 상가/오피스텔 빠른선택과 단지명 입력을 숨기고, 2차구분이 "오피스텔"이면 오피스텔만 보여준다.
function setupQuickBuildingSelect(selectId, publicId, mapId, complexId, category1Id, category2Id) {
  const sel = document.getElementById(selectId);
  if (!sel) return;
  const field = sel.closest(".field");
  const complexEl = document.getElementById(complexId);
  const complexField = complexEl ? complexEl.closest(".field") : null;

  function render() {
    const cat1 = category1Id ? (document.getElementById(category1Id)?.value || "") : "";
    const cat2 = category2Id ? (document.getElementById(category2Id)?.value || "") : "";
    const hiddenForCategory = cat1 === "공장창고" || cat1 === "토지";
    const isApartment = cat2 === "아파트";
    const onlyOfficetel = cat2 === "오피스텔";
    const prevValue = sel.value;

    if (field) field.style.display = hiddenForCategory || isApartment ? "none" : "";
    if (complexField) complexField.style.display = hiddenForCategory ? "none" : "";
    if (hiddenForCategory) {
      sel.value = "";
      if (complexEl) complexEl.value = "";
      return;
    }

    if (isApartment) {
      sel.innerHTML = '<option value="">아파트 단지명 직접 입력</option>';
      return;
    }

    const byCategory = {};
    UNJEONG_QUICK_BUILDINGS.forEach((b, i) => {
      if (onlyOfficetel && b.category !== "오피스텔") return;
      (byCategory[b.category] = byCategory[b.category] || []).push(i);
    });
    let html = '<option value="">직접 입력 (목록에 없는 건물)</option>';
    Object.keys(byCategory).forEach((cat) => {
      html += `<optgroup label="${cat}">`;
      byCategory[cat].forEach((i) => {
        html += `<option value="${i}">${UNJEONG_QUICK_BUILDINGS[i].name}</option>`;
      });
      html += "</optgroup>";
    });
    sel.innerHTML = html;
    if (prevValue && sel.querySelector(`option[value="${prevValue}"]`)) {
      sel.value = prevValue;
    }
  }

  render();

  sel.addEventListener("change", () => {
    if (!sel.value) return;
    const b = UNJEONG_QUICK_BUILDINGS[Number(sel.value)];
    if (!b) return;
    const publicEl = document.getElementById(publicId);
    const mapEl = document.getElementById(mapId);
    if (publicEl) publicEl.value = "파주시 와동동";
    if (mapEl) mapEl.value = "파주시 " + b.addr;
    if (complexEl) complexEl.value = b.name;
  });

  if (category2Id) {
    const cat2El = document.getElementById(category2Id);
    if (cat2El) cat2El.addEventListener("change", render);
  }
  if (category1Id) {
    const cat1El = document.getElementById(category1Id);
    if (cat1El) cat1El.addEventListener("change", render);
  }

  return render;
}


function normalizeApartmentUnit(value, suffix) {
  return String(value || "").trim().replace(new RegExp(suffix + "$"), "").trim();
}
function fillApartmentUnitFields(prefix, item = {}) {
  const detail = item.privateDetailAddress || item.detailAddress || "";
  const dongMatch = detail.match(/(?:^|\s)([^\s]+)동(?:\s|$)/);
  const hoMatch = detail.match(/(?:^|\s)([^\s]+)호(?:\s|$)/);
  document.getElementById(prefix + "apartmentDong").value = normalizeApartmentUnit(item.dong || dongMatch?.[1], "동");
  document.getElementById(prefix + "apartmentHo").value = normalizeApartmentUnit(item.ho || item.roomNo || hoMatch?.[1], "호");
}
function readApartmentUnitFields(prefix) {
  const dong = normalizeApartmentUnit(document.getElementById(prefix + "apartmentDong").value, "동");
  const ho = normalizeApartmentUnit(document.getElementById(prefix + "apartmentHo").value, "호");
  const privateDetailAddress = [dong ? dong + "동" : "", ho ? ho + "호" : ""].filter(Boolean).join(" ");
  return { dong, ho, privateDetailAddress };
}

function readApartmentAddresses(prefix) {
  const roadAddress = document.getElementById(prefix + "publicAddress").value.trim();
  const jibunAddress = document.getElementById(prefix + "mapAddress").value.trim();
  return {
    roadAddress, jibunAddress, apartmentAddressMode: true,
    publicAddress: [roadAddress ? "새주소: " + roadAddress : "", jibunAddress ? "구주소: " + jibunAddress : ""].filter(Boolean).join(" / "),
    mapAddress: roadAddress || jibunAddress
  };
}

function setupApartmentUnitFields(prefix, category2Id) {
  const categoryEl = document.getElementById(category2Id);
  const detailEl = document.getElementById(prefix + "privateDetailAddress");
  const dongEl = document.getElementById(prefix + "apartmentDong");
  const hoEl = document.getElementById(prefix + "apartmentHo");
  const publicEl = document.getElementById(prefix + "publicAddress");
  const mapEl = document.getElementById(prefix + "mapAddress");
  const publicLabel = publicEl.closest(".field").querySelector("label");
  const mapLabel = mapEl.closest(".field").querySelector("label");
  const originalPublicLabel = publicLabel.innerHTML;
  const originalMapLabel = mapLabel.innerHTML;
  const originalPublicPlaceholder = publicEl.placeholder;
  const originalMapPlaceholder = mapEl.placeholder;
  function render() {
    const isApartment = categoryEl.value === "아파트";
    publicLabel.innerHTML = isApartment ? "공개주소 · 새주소(도로명주소)" : originalPublicLabel;
    mapLabel.innerHTML = isApartment ? "공개주소 · 구주소(지번주소)" : originalMapLabel;
    publicEl.placeholder = isApartment ? "예) 경기도 파주시 ○○로 123" : originalPublicPlaceholder;
    mapEl.placeholder = isApartment ? "예) 경기도 파주시 동패동 1234" : originalMapPlaceholder;
    const lookupBtn = document.getElementById(prefix ? "editLookupBuildingBtn" : "lookupBuildingBtn");
    if (lookupBtn) lookupBtn.style.display = isApartment ? "none" : "";
    ["managementFee", "premium"].forEach(id => {
      const el = document.getElementById(prefix + id);
      if (el) el.closest(".field").style.display = isApartment ? "none" : "";
    });
    dongEl.closest(".field").style.display = isApartment ? "" : "none";
    hoEl.closest(".field").style.display = isApartment ? "" : "none";
    detailEl.closest(".field").style.display = isApartment ? "none" : "";
    if (isApartment && !dongEl.value && !hoEl.value && detailEl.value) {
      fillApartmentUnitFields(prefix, { privateDetailAddress: detailEl.value });
    }
  }
  [dongEl, hoEl].forEach(el => el.addEventListener("input", () => {
    if (categoryEl.value === "아파트") detailEl.value = readApartmentUnitFields(prefix).privateDetailAddress;
  }));
  categoryEl.addEventListener("change", render);
  render();
  return render;
}


const APARTMENT_LISTING_FORM_HTML = "\n        <div class=\"um-section sale\"><div class=\"um-section-title\">🏠 기본정보</div><div class=\"umgrid\">\n          <div class=\"umfield span-3\"><label>아파트명</label><input id=\"apt_아파트명\" /></div><div class=\"umfield\"><label>접수일자</label><input id=\"apt_접수일자\" type=\"date\" /></div>\n          \n          <div class=\"umfield\"><label>동 *</label><input id=\"apt_동\" placeholder=\"예: 1101\" /></div>\n          <div class=\"umfield\"><label>호수 *</label><input id=\"apt_호수\" placeholder=\"예: 101\" /></div>\n          <div class=\"umfield\"><label>분양평형</label><input id=\"apt_평형\" placeholder=\"예: 24평\" /></div>\n          <div class=\"umfield\"><label>타입</label><input id=\"apt_타입\" list=\"aptUnitTypes\" placeholder=\"예: 55A/AS\" /><datalist id=\"aptUnitTypes\"></datalist></div>\n          <div class=\"umfield area-dual full\"><label>분양면적(공급면적)</label><div class=\"area-row\"><input id=\"apt_분양_평\" type=\"number\" min=\"0\" step=\"0.01\" placeholder=\"평\" aria-label=\"분양면적 평\" /><span class=\"area-unit\">평</span><span class=\"area-arrow\">↔</span><input id=\"apt_분양_m2\" type=\"number\" min=\"0\" step=\"0.0001\" placeholder=\"㎡\" aria-label=\"분양면적 제곱미터\" /><span class=\"area-unit\">㎡</span></div></div>\n          <div class=\"umfield area-dual full\"><label>전용면적</label><div class=\"area-row\"><input id=\"apt_전용_평\" type=\"number\" min=\"0\" step=\"0.01\" placeholder=\"평\" aria-label=\"전용면적 평\" /><span class=\"area-unit\">평</span><span class=\"area-arrow\">↔</span><input id=\"apt_전용_m2\" type=\"number\" min=\"0\" step=\"0.0001\" placeholder=\"㎡\" aria-label=\"전용면적 제곱미터\" /><span class=\"area-unit\">㎡</span></div></div>\n        </div></div>\n        <div class=\"um-section current\"><div class=\"um-section-title\">💰 거래·가격</div><div class=\"umgrid\">\n          <div class=\"umfield\"><label>매매·임대 구분</label><select id=\"apt_거래구분\"><option value=\"\">미정</option><option>매매</option><option>전세</option><option>월세</option><option>임대</option><option>매매·임대</option></select></div>\n          <div class=\"umfield\"><label>매매 유형</label><select id=\"apt_매매유형\"><option value=\"일반매매\">일반매매</option><option value=\"세안고매매\">세안고매매</option></select></div><div class=\"umfield\"><label>승계 보증금 (만원)</label><input id=\"apt_승계보증금\" type=\"number\" min=\"0\" placeholder=\"세안고 매매 시 입력\" /></div><div class=\"umfield\"><label>매매가 (만원)</label><input id=\"apt_매매가\" type=\"number\" min=\"0\" placeholder=\"예: 50000\" /><span class=\"amt-hint\" id=\"aptHint_매매가\"></span></div>\n          <div class=\"umfield\"><label>임대 보증금·전세가 (만원)</label><input id=\"apt_보증금\" type=\"number\" min=\"0\" placeholder=\"예: 30000\" /><span class=\"amt-hint\" id=\"aptHint_보증금\"></span></div>\n          <div class=\"umfield\"><label>월세 (만원)</label><input id=\"apt_월세\" type=\"number\" min=\"0\" placeholder=\"예: 100\" /><span class=\"amt-hint\" id=\"aptHint_월세\"></span></div>\n        </div></div>\n        <details class=\"um-section current\" data-apartment-rights style=\"padding:10px 14px\"><summary style=\"cursor:pointer;color:#d4af37;font-size:.85rem\">분양권 입력 항목 (해당할 때만 펼치기)</summary><div class=\"umgrid\" style=\"margin-top:10px\"><div class=\"umfield span-2\"><label>매물 구분</label><select id=\"apt_권리구분\"><option>일반 아파트</option><option>분양권</option></select></div><div class=\"umfield span-2\"><label>입주예정월</label><input id=\"apt_입주예정월\" type=\"month\" /></div></div></details><div class=\"um-section current\" data-presale-fields hidden><div class=\"um-section-title\">🏗 분양권 정보</div><div class=\"umgrid\"><div class=\"umfield\"><label>분양가 (만원)</label><input id=\"apt_분양가\" type=\"number\" step=\"0.01\" min=\"0\" /></div><div class=\"umfield\"><label>프리미엄 (만원)</label><input id=\"apt_프리미엄\" type=\"number\" step=\"0.01\"  /></div><div class=\"umfield\"><label>납부금 (만원)</label><input id=\"apt_납부금\" type=\"number\" step=\"0.01\" min=\"0\" /></div><div class=\"umfield\"><label>잔금 (만원)</label><input id=\"apt_잔금\" type=\"number\" step=\"0.01\" min=\"0\" /></div><p class=\"umfield full\">준공 전에는 건축물대장이 없을 수 있습니다. 분양자료의 타입·공급면적·전용면적을 직접 입력해 저장하세요. 매매가는 실제 희망 거래금액을 입력하세요.</p></div></div><div class=\"um-section current\"><div class=\"um-section-title\">👤 소유자 정보</div><div class=\"umgrid\">\n          <div class=\"umfield\"><label>소유자 이름</label><input id=\"apt_소유자\" /></div>\n          <div class=\"umfield span-3\"><label>소유자 연락처</label><div class=\"owner-phone-row\"><select id=\"apt_통신사\" aria-label=\"소유자 통신사\"><option value=\"\">통신사</option><option>SKT</option><option>KT</option><option>LG U+</option><option>알뜰폰</option><option>미확인</option></select><input id=\"apt_연락처\" type=\"tel\" placeholder=\"010-0000-0000\" aria-label=\"소유자 전화번호\" /></div></div>\n        </div></div>\n        <div class=\"um-section sale\"><div class=\"um-section-title\">📅 세입자·계약</div><div class=\"umgrid\">\n          <div class=\"umfield\"><label>세입자 현황</label><select id=\"apt_세입자현황\"><option>미확인</option><option>자가거주</option><option value=\"임차중\">세입자 거주</option><option>공실</option></select></div>\n          <div class=\"umfield\"><label>세입자 이름</label><input id=\"apt_세입자이름\" /></div>\n          <div class=\"umfield span-2\"><label>세입자 연락처</label><input id=\"apt_세입자연락처\" type=\"tel\" placeholder=\"010-0000-0000\" /></div>\n          \n          <div class=\"umfield full\"><div class=\"apt-contract-dates\" style=\"display:grid;grid-template-columns:minmax(0,1fr) 105px minmax(0,1fr);gap:8px;align-items:end\"><div class=\"umfield\"><label>세입자 계약 시작일</label><input id=\"apt_계약시작\" type=\"date\" /></div><div class=\"umfield\"><label>계약기간</label><select id=\"apt_계약기간\"><option value=\"\">선택</option><option value=\"1\">1년</option><option value=\"2\">2년</option></select></div><div class=\"umfield\"><label>세입자 계약 종료일</label><input id=\"apt_계약종료\" type=\"date\" /></div></div></div><div class=\"umfield full\"><label>세입자 비고</label><textarea style=\"min-height: 120px; resize: vertical;\" rows=\"5\" id=\"apt_세입자비고\" placeholder=\"세입자 관련 사항\"></textarea></div>\n        </div></div>\n        <div class=\"um-section current\"><div class=\"um-section-title\">📝 옵션·비고</div><div class=\"umgrid\">\n          <div class=\"umfield span-2\"><label>옵션내역</label><textarea style=\"min-height: 120px; resize: vertical;\" rows=\"5\" id=\"apt_옵션\" placeholder=\"시스템에어컨, 붙박이장 등\"></textarea></div>\n          <div class=\"umfield span-2\"><label>비고</label><textarea style=\"min-height: 120px; resize: vertical;\" rows=\"5\" id=\"apt_비고\" placeholder=\"매물 특이사항\"></textarea></div>\n        </div></div><div class=\"um-section current\"><div class=\"um-section-title\">💬 추가메모</div><div class=\"umgrid\"><div class=\"umfield full\"><label>새 메모</label><textarea style=\"min-height: 180px; resize: vertical;\" rows=\"7\" id=\"apt_추가메모\" placeholder=\"상담 내용이나 변경사항을 추가하세요. 저장 시 기존 메모에 날짜별로 누적됩니다.\"></textarea><div data-apt-memos style=\"margin-top:10px\"></div></div></div></div>";
function apartmentSource(item = {}) {
  const u = item.apartmentUnitData || item.import_unit_snapshot || {};
  const wonToMan = value => value === "" || value == null ? null : Number(String(value).replaceAll(",", "")) / 10000;
  return { ...u,
    아파트명: item.complexName ?? u.아파트명 ?? "", 동: item.dong ?? u.동 ?? "", 호: item.ho ?? u.호 ?? "",
    접수일자: item.received_date ?? u.접수일자 ?? "",
    평형: item.apartmentSize ?? u.평형 ?? "", 타입: item.apartmentType ?? u.타입 ?? "",
    거래구분: item.dealType ?? u.거래구분 ?? "", 매매유형:u.매매유형 ?? "일반매매", 승계보증금:u.승계보증금 ?? null,
    현_매매가격: item.salePrice !== undefined ? wonToMan(item.salePrice) : u.현_매매가격,
    현_보증금: item.deposit !== undefined ? wonToMan(item.deposit) : u.현_보증금 ?? u.보증금,
    현_월세: item.monthlyRent !== undefined ? wonToMan(item.monthlyRent) : u.현_월세 ?? u.월차임,
    소유주: item.owner_name ?? u.소유주 ?? "", 연락처: item.owner_phone1 ?? u.연락처 ?? "",
    소유자통신사: item.ownerCarrier ?? u.소유자통신사 ?? "",
    분양_m2: item.supplyAreaM2 ?? u.분양_m2, 전용_m2: item.exclusiveAreaM2 ?? u.전용_m2,
    비고: item.description ?? u.비고 ?? ""
  };
}

// ── 단지별 동·호수 → 타입·면적 자료 (data/apartment-units.json) ──
// 단지를 추가하려면 그 파일에 단지 자료만 더하면 된다. 자료가 없는 단지는 기존 방식(단지 자료·건축물대장)으로 처리한다.
const APARTMENT_UNIT_TABLE_URL = typeof document !== "undefined" && document.currentScript && document.currentScript.src
  ? new URL("../../data/apartment-units.json", document.currentScript.src).href
  : "data/apartment-units.json";
let APARTMENT_UNIT_TABLE = null, apartmentUnitTablePromise = null;
function ensureApartmentUnitTable() {
  if (!apartmentUnitTablePromise) {
    apartmentUnitTablePromise = fetch(APARTMENT_UNIT_TABLE_URL)
      .then(res => res.ok ? res.json() : null)
      .then(data => { APARTMENT_UNIT_TABLE = data && Array.isArray(data.complexes) ? data : null; return APARTMENT_UNIT_TABLE; })
      .catch(() => null);
  }
  return apartmentUnitTablePromise;
}
// key는 단지 id 또는 이름. found=false면 자료에 없는 단지, type=null이면 자료에 있지만 없는 동·호수.
function apartmentStaticUnit(key, dong, ho) {
  const none = { found: false, type: null, supply: null, exclusive: null };
  if (!APARTMENT_UNIT_TABLE) return none;
  const norm = v => String(v || "").replace(/\s+/g, "");
  const complex = APARTMENT_UNIT_TABLE.complexes.find(c => (c.id && c.id === key) || norm(c.name) === norm(key));
  if (!complex) return none;
  const miss = { found: true, type: null, supply: null, exclusive: null };
  const rule = complex.dongs && complex.dongs[normalizeApartmentUnit(dong, "동")];
  const number = Number(normalizeApartmentUnit(ho, "호"));
  if (!rule || !Number.isInteger(number)) return miss;
  const floor = Math.floor(number / 100), line = number % 100;
  if (floor < 1 || floor > rule.maxFloor || (rule.exclude || []).includes(number)) return miss;
  if (rule.lineMaxFloor && rule.lineMaxFloor[line] && floor > rule.lineMaxFloor[line]) return miss;
  const type = rule.lines && rule.lines[String(line)];
  if (!type) return miss;
  const info = (complex.types && complex.types[type]) || {};
  const positive = v => v != null && Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : null;
  return { found: true, type, supply: positive(info.supply_m2), exclusive: positive(info.exclusive_m2) };
}

const CHORONG11_RESOURCE_ID = "5d1bbb0d-627f-5634-98c9-38c019e5771b";
// 사용자 등록 2021.06 LH 팜플렛의 1101~1111동 층·호수 배치표.
function chorong11UnitType(dong, ho) {
  const rules = {
    "1101":{max:20,lines:4,blue:2,missing:[102,103,202,203]},
    "1102":{max:20,lines:5,blue:2,missing:[103,104,203,204]},
    "1103":{max:20,lines:5,blue:4,missing:[102,103,202,203]},
    "1104":{max:19,lines:4,blue:3,missing:[]},
    "1105":{max:20,lines:4,blue:2,missing:[]},
    "1106":{max:15,lines:3,blue:2,missing:[]},
    "1107":{max:15,lines:3,blue:2,missing:[]},
    "1108":{max:15,lines:3,blue:2,missing:[]},
    "1109":{max:18,lines:3,blue:2,missing:[]},
    "1110":{max:20,lines:4,blue:2,missing:[102,103,202,203]},
    "1111":{max:19,lines:3,blue:2,missing:[]}
  };
  const rule = rules[normalizeApartmentUnit(dong,"동")], number=Number(normalizeApartmentUnit(ho,"호"));
  if (!rule || !Number.isInteger(number)) return null;
  const floor=Math.floor(number/100), line=number%100;
  if (floor<1 || floor>rule.max || line<1 || line>rule.lines || rule.missing.includes(number)) return null;
  if (normalizeApartmentUnit(dong,"동")==="1103" && floor>14 && line>2) return null;
  return line===rule.blue ? "55B" : "55A";
}
function apartmentReferenceResource(item, resources) {
  const name = String(item.complexName || item.buildingName || apartmentSource(item).아파트명 || "").replace(/\s+/g,"");
  return resources.find(r=>r.id===item.resource_id) ||
    resources.find(r=>String(r.name||"").replace(/\s+/g,"")===name) || null;
}
function apartmentResourceAddresses(resource) {
  const fields={};
  String(resource && resource.memo || "").split("---추가메모---")[0].split(/\r?\n/).forEach(line=>{
    const i=line.indexOf(":");if(i>=0)fields[line.slice(0,i).trim()]=line.slice(i+1).trim();
  });
  return {roadAddress:fields["주소"]||"",jibunAddress:fields["지번주소"]||""};
}
function apartmentUnitReference(resource, plans, record, dong, ho) {
  const normalizeType = value => String(value||"").replace(/\s+/g,"").toUpperCase();
  const known = resource.id===CHORONG11_RESOURCE_ID;
  const units = record && Array.isArray(record.units) ? record.units : [];
  const matches=units.filter(u=>{
    const combined=String(u.호수||"").match(/^(.+?)동\s*(.+?)(?:호)?$/);
    return normalizeApartmentUnit(u.동 || (combined && combined[1]),"동")===normalizeApartmentUnit(dong,"동") &&
      normalizeApartmentUnit(u.호 || (combined && combined[2]),"호")===normalizeApartmentUnit(ho,"호");
  });
  const unit=matches.length===1 ? matches[0] : {};
  const staticUnit=apartmentStaticUnit(resource.id || resource.name,dong,ho);
  const type=staticUnit.found ? staticUnit.type : (known ? chorong11UnitType(dong,ho) : unit.타입);
  if (!type) return {...apartmentResourceAddresses(resource),resource_id:resource.id,matched:false};
  const matchingPlans=plans.filter(plan=>normalizeType(plan.floor_number).split("/").includes(normalizeType(type)));
  const plan=matchingPlans.length===1 ? matchingPlans[0] : {};
  const positive=value=>value!=="" && value!=null && Number.isFinite(Number(value)) && Number(value)>0 ? Number(value) : null;
  const supply=positive(plan.supply_area_m2) ?? staticUnit.supply ?? positive(unit.분양_m2) ?? (positive(unit.분양_평) ? Number(unit.분양_평)*(400/121) : null);
  const exclusive=positive(plan.exclusive_area_m2) ?? staticUnit.exclusive ?? positive(unit.전용_m2) ?? (positive(unit.전용_평) ? Number(unit.전용_평)*(400/121) : null);
  return {...apartmentResourceAddresses(resource),resource_id:resource.id,matched:true,type,
    size:supply ? (supply/(400/121)).toFixed(2)+"평" : unit.평형 || "",
    supply,exclusive};
}
async function lookupApartmentUnitReference(item) {
  await ensureApartmentUnitTable();
  const resource=apartmentReferenceResource(item,await getDriveResources());
  if(!resource)throw new Error("연결된 단지 자료를 찾지 못했습니다. 아파트명이나 자료 연결을 확인해주세요.");
  const [plans,record]=await Promise.all([getBuildingFloors(resource.id),getBuildingRecord(resource.name)]);
  const u=apartmentSource(item);
  return apartmentUnitReference(resource,plans,record,u.동,u.호);
}


function openApartmentRegistrySearch(item,onMessage,source="registry") {
  const unit=apartmentSource(item);
  const address=item.jibunAddress || item.roadAddress || item.mapAddress || "";
  const query=[address,unit.아파트명,unit.동 ? normalizeApartmentUnit(unit.동,"동")+"동" : "",unit.호 ? normalizeApartmentUnit(unit.호,"호")+"호" : ""].filter(Boolean).join(" ");
  const service=source==="building" ? "정부24 건축물대장" : "인터넷등기소";
  window.open(source==="building" ? "https://www.gov.kr/mw/AA020InfoCappView.do?CappBizCD=15000000098" : "https://www.iros.go.kr/","_blank","noopener,noreferrer");
  if(navigator.clipboard && window.isSecureContext){
    navigator.clipboard.writeText(query).then(()=>onMessage("주소·동·호수를 복사했습니다. "+service+"에서 검색한 뒤 소유자 표시를 확인해주세요.")).catch(()=>onMessage(service+"에서 검색해주세요: "+query));
  }else onMessage(service+"에서 검색해주세요: "+query);
}

function apartmentAutofillMessage(reference) {
  const messages=[];
  if(reference.registryMatched)messages.push("건축물대장 전용면적을 채웠습니다.");
  else messages.push("건축물대장: "+(reference.registryWarning || "해당 세대를 확인하지 못했습니다."));
  if(reference.supply!=null)messages.push("공급면적 "+Number(reference.supply).toFixed(2)+"㎡ · 분양평형 "+(Number(reference.supply)/(400/121)).toFixed(2)+"평을 채웠습니다.");
  else messages.push("공급면적 미확인: 해당 타입의 공급면적 자료가 필요합니다. 기존 입력값은 유지했습니다.");
  return messages.join(" ");
}
function apartmentSupplyPlan(plans, exclusive, type) {
  const normalize=value=>String(value||'').replace(/\s/g,'').toUpperCase();
  const valid=plans.filter(p=>Number(p.supply_area_m2)>=exclusive && Number(p.exclusive_area_m2)>0 && Math.abs(Number(p.exclusive_area_m2)-exclusive)<0.01);
  const typed=type ? valid.filter(p=>normalize(p.floor_number).split('/').includes(normalize(type))) : [];
  const matches=typed.length ? typed : valid;
  if(!matches.length || new Set(matches.map(p=>Number(p.supply_area_m2).toFixed(4))).size!==1)return null;
  return {supply:Number(matches[0].supply_area_m2),type:matches.length===1 ? matches[0].floor_number : null};
}
async function lookupApartmentAutofill(item,onProgress) {
  const unit=apartmentSource(item);
  if(unit.권리구분 === "분양권")throw new Error("준공 전 분양권은 분양자료 기준으로 면적과 타입을 직접 입력해 저장하세요.");
  if(unit.권리구분 === "분양권")throw new Error("준공 전 분양권은 분양자료 기준으로 면적과 타입을 직접 입력해 저장하세요.");
  const dong=normalizeApartmentUnit(unit.동,"동"),ho=normalizeApartmentUnit(unit.호,"호");
  if(!dong||!ho)throw new Error("동과 호수를 먼저 입력해주세요.");
  let reference={matched:false};
  try{reference=await lookupApartmentUnitReference(item);}catch(error){reference.planWarning=error.message;}
  reference={...reference,planMatched:!!reference.matched,registryMatched:false};
  const address=(reference.jibunAddress || item.jibunAddress || reference.roadAddress || item.roadAddress || item.mapAddress || "").replace(/\([^)]*\)/g,"").trim();
  if(!address){reference.registryWarning="주소를 먼저 입력해주세요.";return reference;}
  if(onProgress)onProgress("건축물대장 동·호수 조회 중…");
  try{
    const data=await lookupBuildingRegister(address,{dongNm:dong,hoNm:ho,apartment:true});
    if (!data.building_match_verified) throw new Error("조회 서버에서 해당 건물의 일치 여부를 확인하지 못했습니다.");
    const returnedDong=normalizeApartmentUnit(data.unit_dong_name || "","동");
    const requestedDigits=String(dong).replace(/\D/g,"");
    const returnedDigits=String(returnedDong).replace(/\D/g,"");
    const area=Number(data.exclusive_area_m2);
    if(data.unit_area_warning || !returnedDong || (requestedDigits ? returnedDigits!==requestedDigits : returnedDong!==dong) || !Number.isFinite(area) || area<=0){
      reference.registryWarning="해당 동·호수의 전용면적을 확인하지 못했습니다.";
      return reference;
    }
    if(reference.supply!=null && reference.planMatched && Math.abs(Number(reference.exclusive)-Number(area))>=0.01){reference.supply=null;reference.size=null;}
    reference.exclusive=area;
    reference.matched=true;
    reference.registryMatched=true;
    if(reference.resource_id){
      try{
        const plan=apartmentSupplyPlan(await getBuildingFloors(reference.resource_id),area,unit.타입 || reference.type);
        if(plan){reference.supply=plan.supply;reference.size=(plan.supply/(400/121)).toFixed(2)+'평';reference.planMatched=true;if(plan.type)reference.type=plan.type;}
      }catch(error){reference.planWarning=error.message;}
    }
    reference.registry={source:"건축물대장",queried_at:new Date().toISOString(),address,dong,ho,exclusive_area_m2:area};
  }catch(error){reference.registryWarning=error.message || "조회에 실패했습니다.";}
  return reference;
}

function applyApartmentUnitReference(item, reference) {
  const u={...apartmentSource(item)};
  const updated={...item,resource_id:reference.resource_id || item.resource_id};
  if(reference.roadAddress)updated.roadAddress=reference.roadAddress;
  if(reference.jibunAddress)updated.jibunAddress=reference.jibunAddress;
  updated.publicAddress=[updated.roadAddress?"새주소: "+updated.roadAddress:"",updated.jibunAddress?"구주소: "+updated.jibunAddress:""].filter(Boolean).join(" / ") || item.publicAddress;
  updated.mapAddress=updated.roadAddress || updated.jibunAddress || item.mapAddress;
  if(reference.matched){
    if(reference.type){updated.apartmentType=u.타입=reference.type;}
    if(reference.size){updated.apartmentSize=u.평형=reference.size;}
    for(const [name,key,pykey,value] of [["분양","supplyAreaM2","supplyAreaPy",reference.supply],["전용","exclusiveAreaM2","exclusiveAreaPy",reference.exclusive]]){
      if(value!=null){updated[key]=u[name+"_m2"]=value;updated[pykey]=u[name+"_평"]=value/(400/121);}
    }
  }
  if(reference.registry)updated.apartmentRegistryReference=reference.registry;
  updated.apartmentUnitData=u;
  updated.title=(u.아파트명||updated.complexName||"아파트")+" · "+u.동+"동 "+u.호+"호";
  return updated;
}


function apartmentUnitLinkedListings(unit, listings, resourceId, buildingName) {
  const combined=String(unit.호수 || "").match(/^(.+?)동\s*(.+?)(?:호)?$/);
  const dong=normalizeApartmentUnit(unit.동 || (combined && combined[1]),"동");
  const ho=normalizeApartmentUnit(unit.호 || (combined && combined[2]) || unit.호수,"호");
  const nameKey=value=>String(value || "").replace(/\s+/g,"").replace(/아파트$/,"");
  const seen=new Set();
  return listings.filter(item=>{
    if(!item.id || seen.has(item.id))return false;
    const linked=item.id===unit.listing_id;
    const belongs=item.resource_id ? item.resource_id===resourceId :
      nameKey(item.complexName || item.buildingName || apartmentSource(item).아파트명)===nameKey(buildingName);
    const source=apartmentSource(item);
    const sameUnit=normalizeApartmentUnit(source.동,"동")===dong && normalizeApartmentUnit(source.호,"호")===ho;
    if(!(linked || (belongs && dong && ho && sameUnit)))return false;
    seen.add(item.id);return true;
  });
}
function apartmentUnitDeal(unit, linkedListings=[]) {
  if(String(unit.거래구분 || "").trim())return unit.거래구분;
  const active=linkedListings.filter(item=>item.status!=="거래완료");
  const deals=[...new Set(active.map(item=>item.dealType || apartmentSource(item).거래구분).filter(Boolean))];
  if(deals.length)return deals.join("·");
  const sale=Number(unit.현_매매가격);
  return Number.isFinite(sale) && sale>0 ? "매매" : "";
}

function setupApartmentListingForm(prefix, category2Id) {
  const host = document.getElementById(prefix + "apartmentListingForm");
  host.innerHTML = APARTMENT_LISTING_FORM_HTML.replace(/id="([^"]+)"/g, (_, id) => 'id="' + prefix + id + '"')
    .replace('list="aptUnitTypes"', 'list="' + prefix + 'aptUnitTypes"');
  const saleType=document.getElementById(prefix+"apt_매매유형");
  const saleDeposit=document.getElementById(prefix+"apt_승계보증금");
  const saleDeal=document.getElementById(prefix+"apt_거래구분");
  function toggleSaleType(){const isSale=saleDeal.value==="매매";saleType.disabled=!isSale;saleDeposit.disabled=!isSale||saleType.value!=="세안고매매";}
  saleDeal.addEventListener("change",toggleSaleType);saleType.addEventListener("change",toggleSaleType);
  host._toggleSaleType=toggleSaleType;
  const rights = document.getElementById(prefix + "apt_권리구분");
  host._renderPresale = () => {const presale=rights.value==='분양권';host.querySelector('[data-presale-fields]').hidden=!presale;if(presale)host.querySelector('[data-apartment-rights]').open=true;};
  rights.addEventListener('change',host._renderPresale);
  const period=document.getElementById(prefix+"apt_계약기간");
  const contractStart=document.getElementById(prefix+"apt_계약시작");
  const contractEnd=document.getElementById(prefix+"apt_계약종료");
  period.addEventListener("change",()=>{
    if(!contractStart.value||!period.value)return;
    const d=new Date(contractStart.value+"T00:00:00");d.setFullYear(d.getFullYear()+Number(period.value));d.setDate(d.getDate()-1);
    contractEnd.value=[d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-");
  });
    const hoInput = document.getElementById(prefix + "apt_호수");
  const actionRow = document.createElement("div");
  actionRow.style.cssText = "display:flex;align-items:center;gap:6px";
  hoInput.parentNode.insertBefore(actionRow,hoInput);actionRow.appendChild(hoInput);
  hoInput.style.cssText="flex:1;min-width:0";
  const autoButton=document.createElement("button");
  autoButton.type="button";autoButton.className="btn btn-ghost";autoButton.textContent="건축물대장 조회";
  autoButton.style.cssText="flex-shrink:0;padding:6px 8px;font-size:.76rem;white-space:nowrap";
  actionRow.style.flexWrap="wrap";
  actionRow.appendChild(autoButton);
  const registryButton=document.createElement("button");
  registryButton.type="button";registryButton.className="btn btn-ghost";registryButton.textContent="대법원 인터넷등기소 확인";
  registryButton.style.cssText=autoButton.style.cssText;
  const ownerActions=document.createElement("div");
  ownerActions.style.cssText="grid-column:1/-1;display:flex;gap:8px;flex-wrap:wrap";
  document.getElementById(prefix+"apt_소유자").closest(".umgrid").appendChild(ownerActions);
  ownerActions.hidden = true;
  document.getElementById(prefix+"apt_연락처").closest(".owner-phone-row").appendChild(registryButton);
  registryButton.addEventListener("click",()=>openApartmentRegistrySearch({complexName:document.getElementById(prefix+"apt_아파트명").value,dong:document.getElementById(prefix+"apt_동").value,ho:hoInput.value,roadAddress:document.getElementById(prefix+"publicAddress").value,jibunAddress:document.getElementById(prefix+"mapAddress").value},message=>autoStatus.textContent=message));
  const buildingOwnerButton=document.createElement("button");
  buildingOwnerButton.type="button";buildingOwnerButton.className="btn btn-ghost";buildingOwnerButton.textContent="건축물대장 확인";
  buildingOwnerButton.style.cssText=autoButton.style.cssText;document.getElementById(prefix+"apt_연락처").closest(".owner-phone-row").appendChild(buildingOwnerButton);
  buildingOwnerButton.addEventListener("click",()=>openApartmentRegistrySearch({complexName:document.getElementById(prefix+"apt_아파트명").value,dong:document.getElementById(prefix+"apt_동").value,ho:hoInput.value,roadAddress:document.getElementById(prefix+"publicAddress").value,jibunAddress:document.getElementById(prefix+"mapAddress").value},message=>autoStatus.textContent=message,"building"));
  const autoStatus=document.createElement("div");
  autoStatus.style.cssText="font-size:.78rem;padding:0 10px 8px;color:var(--gold)";
  autoStatus.setAttribute("role","status");host.firstElementChild.appendChild(autoStatus);
  host._autoStatus=autoStatus;
  autoButton.addEventListener("click",async()=>{
    const p=key=>document.getElementById(prefix+"apt_"+key);
    if(p("권리구분").value==='분양권'){autoStatus.textContent="준공 전 분양권은 분양자료 기준으로 면적과 타입을 직접 입력해 저장하세요.";return;}
    const dong=p("동").value.trim(),ho=p("호수").value.trim();
    if(!dong||!ho){autoStatus.textContent="동과 호수를 먼저 입력해주세요.";return;}
    autoButton.disabled=true;autoStatus.textContent="단지 자료 조회 중…";
    try{
      const original=host._apartmentItem || {};
      const item={...original,complexName:p("아파트명").value.trim(),dong,ho,
        apartmentType:p("타입").value.trim(),
        roadAddress:document.getElementById(prefix+"publicAddress").value.trim(),jibunAddress:document.getElementById(prefix+"mapAddress").value.trim()};
      if(item.complexName!==apartmentSource(original).아파트명)delete item.resource_id;
      const reference=await lookupApartmentAutofill(item,message=>autoStatus.textContent=message);
      if(reference.roadAddress)document.getElementById(prefix+"publicAddress").value=reference.roadAddress;
      if(reference.jibunAddress)document.getElementById(prefix+"mapAddress").value=reference.jibunAddress;
      if(reference.resource_id && document.getElementById(prefix+"resource_id"))document.getElementById(prefix+"resource_id").value=reference.resource_id;
      if(reference.matched){
        if(reference.type)p("타입").value=reference.type;
        if(reference.size)p("평형").value=reference.size;
        for(const [name,area] of [["분양",reference.supply],["전용",reference.exclusive]]){
          if(area!=null){p(name+"_m2").value=area;p(name+"_평").value=(area/(400/121)).toFixed(2);}
        }
      }
      autoStatus.textContent=apartmentAutofillMessage(reference)+" 저장을 눌러주세요.";
    }catch(error){autoStatus.textContent=error.message;}
    finally{autoButton.disabled=false;}
  });
  for (const name of ["분양", "전용"]) {
    const py = document.getElementById(prefix + "apt_" + name + "_평");
    const m2 = document.getElementById(prefix + "apt_" + name + "_m2");
    const updateSize=()=>{if(name==='분양')document.getElementById(prefix+'apt_평형').value=Number(py.value)>0 ? Number(py.value).toFixed(2)+'평' : '';};
    py.addEventListener("input", () => { m2.value = py.value === "" ? "" : +(Number(py.value) * (400/121)).toFixed(4);updateSize(); });
    m2.addEventListener("input", () => { py.value = m2.value === "" ? "" : +(Number(m2.value) / (400/121)).toFixed(2);updateSize(); });
  }
  for (const k of ["매매가", "보증금", "월세"]) {
    const el = document.getElementById(prefix + "apt_" + k);
    el.addEventListener("input", () => {
      const n = Number(el.value);
      document.getElementById(prefix + "aptHint_" + k).textContent = el.value ? n.toLocaleString("ko-KR") + "만원" : "";
    });
  }
  function render() {
    const apt = document.getElementById(category2Id).value === "아파트";
    host.hidden = !apt;
    document.getElementById(prefix + "nonApartmentFields").hidden = apt;
    for (const id of ["complexName", "apartmentDong", "apartmentHo", "dealType", "title"]) {
      const el = document.getElementById(prefix + id);
      if (el) el.closest(".field").style.display = apt ? "none" : (id.startsWith("apartment") ? "none" : "");
    }
    if (apt && !document.getElementById(prefix + "apt_아파트명").value) {
      document.getElementById(prefix + "apt_아파트명").value = document.getElementById(prefix + "complexName").value;
    }
  }
  document.getElementById(category2Id).addEventListener("change", render);
  fillApartmentListingForm(prefix, {}, true);
  render();
  return render;
}
function apartmentRemarksOnly(raw) {
  const text=String(raw || "").trim();
  const lines=text.split(/\r?\n/);
  const imported=/^\[엑셀 원본[^\]]*\]/.test(text);
  const structured=/^(?:번호|동|호|호수|타입|평형|가격|소유주|연락처|통신사|거래구분|마을단지|아파트명|접수일자)\s*[:：]/;
  if(!imported && !lines.some(line=>/^비고\s*[:：]/.test(line.trim())))return text;
  let reading=false;const remarks=[];
  for(const line of lines){
    const trimmed=line.trim(),match=trimmed.match(/^비고\s*[:：]\s*(.*)$/);
    if(match){reading=true;if(match[1])remarks.push(match[1]);continue;}
    if(/^\[엑셀 원본[^\]]*\]/.test(trimmed)||structured.test(trimmed)){reading=false;continue;}
    if(reading)remarks.push(line);
  }
  return remarks.join("\n").trim();
}
function apartmentMemoEntries(memos, remarks) {
  const seen=new Set([String(remarks || "").replace(/\s+/g," ").trim()].filter(Boolean));
  return (Array.isArray(memos) ? memos : []).flatMap(memo=>{
    const raw=String(memo.text || "").trim(),text=apartmentRemarksOnly(raw),key=text.replace(/\s+/g," ").trim();
    if(!key || (raw!==text && seen.has(key)))return [];
    seen.add(key);return [{...memo,text}];
  });
}

function fillApartmentListingForm(prefix, item, isNew = false) {
  const host=document.getElementById(prefix+"apartmentListingForm");
  host._apartmentItem=item;
  if(host._autoStatus)host._autoStatus.textContent="";
  const u = apartmentSource(item), p = key => document.getElementById(prefix + "apt_" + key);
  const fields = { 아파트명:u.아파트명, 접수일자:u.접수일자 || (isNew ? new Date().toLocaleDateString("sv-SE",{timeZone:"Asia/Seoul"}) : ""),
    권리구분:u.권리구분 || "일반 아파트", 입주예정월:u.입주예정월, 분양가:u.분양가, 프리미엄:u.프리미엄, 납부금:u.납부금, 잔금:u.잔금,
    동:u.동, 호수:u.호, 평형:u.평형, 타입:u.타입, 거래구분:u.거래구분, 매매유형:u.매매유형 || "일반매매", 승계보증금:u.승계보증금,
    매매가:u.현_매매가격, 보증금:u.현_보증금, 월세:u.현_월세, 소유자:u.소유주, 연락처:u.연락처,
    통신사:u.소유자통신사, 세입자현황:u.세입자현황 || u.공실여부 || "미확인",
    세입자이름:u.세입자이름, 세입자연락처:u.세입자연락처, 세입자비고:u.세입자비고, 계약시작:u.세입자계약시작일, 계약종료:u.세입자계약종료일,
    옵션:u.옵션내역, 비고:apartmentRemarksOnly(u.비고), 추가메모:"" };
  p("통신사").querySelectorAll("[data-custom-carrier]").forEach(el => el.remove());
  if (fields.통신사 && !Array.from(p("통신사").options).some(el => el.value === fields.통신사)) {
    const option = document.createElement("option"); option.value = option.textContent = fields.통신사;
    option.dataset.customCarrier = "true"; p("통신사").appendChild(option);
  }
  for (const [key,value] of Object.entries(fields)) p(key).value = value ?? "";
  host._renderPresale();
  host._toggleSaleType();
  if (!p("세입자현황").value) p("세입자현황").value = "미확인";
  for (const name of ["분양", "전용"]) {
    const m2 = u[name + "_m2"] ?? (u[name + "_평"] != null ? Number(u[name + "_평"]) * (400/121) : null);
    p(name + "_m2").value = m2 == null ? "" : +Number(m2).toFixed(4);
    p(name + "_평").value = m2 == null ? "" : +(Number(m2)/(400/121)).toFixed(2);
  }
  const memoHost = document.getElementById(prefix + "apartmentListingForm").querySelector("[data-apt-memos]");
  memoHost.replaceChildren();
  for (const memo of apartmentMemoEntries(u.추가메모,fields.비고)) {
    const row = document.createElement("div");
    row.style.cssText = "white-space:pre-wrap;font-size:.8rem;padding:6px 0;border-bottom:1px solid #ffffff18";
    row.textContent = (memo.created_at ? new Date(memo.created_at).toLocaleString("ko-KR",{timeZone:"Asia/Seoul"}) + "\n" : "") + memo.text;
    memoHost.appendChild(row);
  }
  for(const k of ["매매가","보증금","월세"]) document.getElementById(prefix + "aptHint_" + k).textContent = fields[k] == null ? "" : Number(fields[k]).toLocaleString("ko-KR")+"만원";
}
function collectApartmentListingFields(prefix, original = {}) {
  const value = key => document.getElementById(prefix + "apt_" + key).value.trim();
  const num = (key, allowNegative = false) => {
    if (!value(key)) return null;
    const n = Number(value(key));
    if (!Number.isFinite(n) || (!allowNegative && n < 0)) throw new Error("면적과 가격은 0 이상의 숫자로 입력하세요. 프리미엄은 음수도 가능합니다.");
    return n;
  };
  const name = value("아파트명"), dong = normalizeApartmentUnit(value("동"), "동"), ho = normalizeApartmentUnit(value("호수"), "호");
  if (!name || !dong || !ho) throw new Error("아파트명과 동·호수를 입력하세요.");
  if (value("계약시작") && value("계약종료") && value("계약시작") > value("계약종료")) throw new Error("계약 종료일은 시작일 이후여야 합니다.");
  const supply = num("분양_m2"), exclusive = num("전용_m2");
  if (supply != null && exclusive != null && supply < exclusive) throw new Error("분양면적은 전용면적 이상이어야 합니다.");
  const tenant = value("세입자현황"), source = apartmentSource(original);
  const notes = apartmentMemoEntries(source.추가메모,value("비고"));
  if (value("추가메모")) notes.push({id:crypto.randomUUID(),text:value("추가메모"),created_at:new Date().toISOString()});
  const u = {...source, 아파트명:name, 동:dong, 호:ho, 호수:dong+"동 "+ho+"호",
    층:/^\d+$/.test(ho) ? Math.floor(Number(ho)/100) : null, 접수일자:value("접수일자") || null,
    권리구분:value("권리구분") || "일반 아파트", 입주예정월:value("입주예정월") || null,
    분양가:num("분양가"), 프리미엄:num("프리미엄",true), 납부금:num("납부금"), 잔금:num("잔금"),
    평형:value("평형") || null, 타입:value("타입") || null, 분양_m2:supply, 전용_m2:exclusive,
    분양_평:supply == null ? null : supply/(400/121), 전용_평:exclusive == null ? null : exclusive/(400/121),
    거래구분:value("거래구분") || null, 매매유형:value("거래구분")==="매매" ? value("매매유형") || "일반매매" : "일반매매", 승계보증금:value("거래구분")==="매매" && value("매매유형")==="세안고매매" ? num("승계보증금") : null, 현_매매가격:num("매매가"), 현_보증금:num("보증금"), 현_월세:num("월세"),
    소유주:value("소유자") || null, 연락처:value("연락처") || null, 소유자통신사:value("통신사") || null,
    세입자현황:tenant, 공실여부:tenant, 세입자이름:value("세입자이름") || null, 세입자연락처:value("세입자연락처") || null, 세입자비고:value("세입자비고") || null,
    세입자계약시작일:value("계약시작") || null, 세입자계약종료일:value("계약종료") || null,
    옵션내역:value("옵션") || null, 비고:value("비고") || null, 추가메모:notes, updated_at:new Date().toISOString()};
  const won = n => n == null ? "" : String(n * 10000);
  return {apartmentUnitData:u, complexName:name, buildingName:name, dong, ho, privateDetailAddress:u.호수,
    title:name+(u.권리구분==="분양권" ? " · 분양권" : "")+" · "+u.호수, received_date:u.접수일자, apartmentSize:u.평형, apartmentType:u.타입,
    dealType:u.거래구분 || "", salePrice:won(u.현_매매가격), deposit:won(u.현_보증금), monthlyRent:won(u.현_월세),
    supplyAreaM2:supply, supplyAreaPy:u.분양_평, exclusiveAreaM2:exclusive, exclusiveAreaPy:u.전용_평,
    owner_name:u.소유주 || "", owner_phone1:u.연락처 || "", ownerCarrier:u.소유자통신사,
    description:u.비고 || "", floorInfo:u.층 == null ? "" : u.층+"층"};
}

function setupListingDescriptionEmojiToolbar(textareaId) {
  const textarea = document.getElementById(textareaId);
  const toolbar = document.querySelector(`[data-emoji-target="${textareaId}"]`);
  if (!textarea || !toolbar || toolbar.dataset.emojiReady === "true") return;
  toolbar.dataset.emojiReady = "true";

  toolbar.addEventListener("click", (event) => {
    const button = event.target.closest("[data-emoji]");
    if (!button || !toolbar.contains(button)) return;
    const emoji = button.dataset.emoji || "";
    const insertText = emoji + " ";
    const start = textarea.selectionStart ?? textarea.value.length;
    const end = textarea.selectionEnd ?? textarea.value.length;
    textarea.value = textarea.value.slice(0, start) + insertText + textarea.value.slice(end);
    const cursor = start + insertText.length;
    textarea.focus();
    textarea.setSelectionRange(cursor, cursor);
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

// ===== \ud45c\uc900 \ub9e4\ubb3c \uce74\ud14c\uace0\ub9ac (1\ub2e8\uacc4 \uac1c\ud3b8 \u2014 \ud648\ud398\uc774\uc9c0 \uce74\ud14c\uace0\ub9ac\uc640 \ud1b5\uc77c) =====
// \ud654\uba74(\ub4f1\ub85d\u00b7\uc218\uc815\u00b7\ud544\ud130)\uc5d0\ub294 \uc544\ub798 5\uac1c \ub300\ubd84\ub958\ub9cc \ub178\ucd9c\ud55c\ub2e4. DB \uc800\uc7a5 \uad6c\uc870\ub294 \ubc14\uafb8\uc9c0 \uc54a\uc73c\uba70,
// "\uc8fc\uac70\uc6a9" \uc544\ub798\uc5d0\uc11c \uace0\ub978 \uc0c1\uac00\uc8fc\ud0dd\u00b7\ub2e4\uac00\uad6c\uc8fc\ud0dd\u00b7\ub2e8\ub3c5\uc8fc\ud0dd\u00b7\uc804\uc6d0\uc8fc\ud0dd\uc740 \uc800\uc7a5 \uc2dc\uc810\uc5d0
// resolveStorageCategory1()\uc774 \uae30\uc874 \ub370\uc774\ud130\u00b7\ud648\ud398\uc774\uc9c0 \ud544\ud130\uc640 \ub3d9\uc77c\ud55c category1(\uac74\ubb3c\ube4c\ub529/\ub2e8\ub3c5\uc804\uc6d0\uc8fc\ud0dd)\ub85c \ubcc0\ud658\ud55c\ub2e4.
const PROPERTY_CATEGORY_STANDARD = {
  "\uacf5\uc7a5\ucc3d\uace0":   { label: "\uacf5\uc7a5\u00b7\ucc3d\uace0",  children: ["\uacf5\uc7a5", "\ucc3d\uace0"] },
  "\uc0c1\uac00\uc0ac\ubb34\uc2e4": { label: "\uc0c1\uac00\u00b7\uc0ac\ubb34\uc2e4", children: ["\uc0c1\uac00", "\uc0ac\ubb34\uc2e4"] },
  "\ud1a0\uc9c0":       { label: "\ud1a0\uc9c0",       children: ["\ud1a0\uc9c0", "\ub18d\uc9c0", "\ud0dd\uc9c0"] },
  "\uc8fc\uac70\uc6a9":     { label: "\uc8fc\uac70\uc6a9",     children: ["\uc544\ud30c\ud2b8", "\uc624\ud53c\uc2a4\ud154", "\ub2e8\ub3c5\uc8fc\ud0dd", "\uc804\uc6d0\uc8fc\ud0dd", "\uc0c1\uac00\uc8fc\ud0dd", "\ub2e4\uac00\uad6c\uc8fc\ud0dd"] },
  "\uac74\ubb3c\ube4c\ub529":   { label: "\uac74\ubb3c\u00b7\ube4c\ub529",  children: ["\uac74\ubb3c", "\ube4c\ub529"] }
};
const PROPERTY_CATEGORY_ORDER = ["\uacf5\uc7a5\ucc3d\uace0", "\uc0c1\uac00\uc0ac\ubb34\uc2e4", "\ud1a0\uc9c0", "\uc8fc\uac70\uc6a9", "\uac74\ubb3c\ube4c\ub529"];

// \ud654\uba74(\ub4f1\ub85d\u00b7\uc218\uc815 \ud3fc)\uc758 2\ucc28\uad6c\ubd84 \ub4dc\ub86d\ub2e4\uc6b4\uc6a9 \u2014 PROPERTY_CATEGORY_STANDARD\uacfc \ub3d9\uc77c \uc18c\uc2a4\uc5d0\uc11c \ud30c\uc0dd.
const CATEGORY_OPTIONS = {};
PROPERTY_CATEGORY_ORDER.forEach(k => { CATEGORY_OPTIONS[k] = PROPERTY_CATEGORY_STANDARD[k].children.slice(); });

// \uc0c1\uac00\uc8fc\ud0dd\u00b7\ub2e4\uac00\uad6c\uc8fc\ud0dd\u00b7\ub2e8\ub3c5\uc8fc\ud0dd\u00b7\uc804\uc6d0\uc8fc\ud0dd\uc740 \ud654\uba74(2\ucc28\uad6c\ubd84)\uc5d0\uc11c\ub294 "\uc8fc\uac70\uc6a9" \uc544\ub798\uc5d0 \ubcf4\uc774\uc9c0\ub9cc,
// \uc2e4\uc81c \uc800\uc7a5/\uc870\ud68c\ub294 \uae30\uc874 \ub370\uc774\ud130\u00b7\ud648\ud398\uc774\uc9c0 \ud544\ud130\uc640 \ub3d9\uc77c\ud558\uac8c category1="\uac74\ubb3c\ube4c\ub529"/"\ub2e8\ub3c5\uc804\uc6d0\uc8fc\ud0dd"\uc744 \uc0ac\uc6a9\ud55c\ub2e4.
function resolveStorageCategory1(category1, category2) {
  if (category1 === "\uc8fc\uac70\uc6a9" && (category2 === "\uc0c1\uac00\uc8fc\ud0dd" || category2 === "\ub2e4\uac00\uad6c\uc8fc\ud0dd")) return "\uac74\ubb3c\ube4c\ub529";
  if (category1 === "\uc8fc\uac70\uc6a9" && (category2 === "\ub2e8\ub3c5\uc8fc\ud0dd" || category2 === "\uc804\uc6d0\uc8fc\ud0dd")) return "\ub2e8\ub3c5\uc804\uc6d0\uc8fc\ud0dd";
  return category1;
}
// \uae30\uc874\uc5d0 \uc800\uc7a5\ub41c category1="\uac74\ubb3c\ube4c\ub529"+category2="\uc0c1\uac00\uc8fc\ud0dd"/"\ub2e4\uac00\uad6c\uc8fc\ud0dd", category1="\ub2e8\ub3c5\uc804\uc6d0\uc8fc\ud0dd" \ub9e4\ubb3c\uc744
// \ud654\uba74(2\ucc28\uad6c\ubd84: \uc8fc\uac70\uc6a9)\uc5d0 \ub9de\uac8c \ubcf4\uc5ec\uc8fc\uae30 \uc704\ud55c \ud45c\uc2dc\uc6a9 \uc5ed\ub9e4\ud551.
function resolveDisplayCategory1(category1, category2) {
  if (category1 === "\uac74\ubb3c\ube4c\ub529" && (category2 === "\uc0c1\uac00\uc8fc\ud0dd" || category2 === "\ub2e4\uac00\uad6c\uc8fc\ud0dd")) return "\uc8fc\uac70\uc6a9";
  if (category1 === "\ub2e8\ub3c5\uc804\uc6d0\uc8fc\ud0dd") return "\uc8fc\uac70\uc6a9";
  return category1;
}

// getCategoryFromListing()\uc758 'type'-only \ub808\uac70\uc2dc \ud589 \ud3f4\ubc31\uc6a9 \u2014 \uae30\uc874 \ub370\uc774\ud130 \ud574\uc11d \ubc29\uc2dd\uc744 \uadf8\ub300\ub85c \uc720\uc9c0\ud55c\ub2e4(\ubcc0\uacbd \uae08\uc9c0).
const LEGACY_TYPE_CATEGORY = {"shop": ["\uc0c1\uac00\uc0ac\ubb34\uc2e4", "\uc0c1\uac00"], "office": ["\uc0c1\uac00\uc0ac\ubb34\uc2e4", "\uc0ac\ubb34\uc2e4"], "officetel": ["\uc8fc\uac70\uc6a9", "\uc624\ud53c\uc2a4\ud154"], "hilsstate": ["\uc8fc\uac70\uc6a9", "\ud790\uc2a4\ud14c\uc774\ud2b8\ub354\uc6b4\uc815"], "factory": ["\uacf5\uc7a5\ucc3d\uace0", "\uacf5\uc7a5\ucc3d\uace0"], "bizcenter": ["\uc0c1\uac00\uc0ac\ubb34\uc2e4", "\uc9c0\uc2dd\uc0b0\uc5c5\uc13c\ud130"], "land_single": ["\ud1a0\uc9c0", "\ud1a0\uc9c0"], "land_dev": ["\ud1a0\uc9c0", "\ud1a0\uc9c0"], "land_other": ["\ud1a0\uc9c0", "\ud1a0\uc9c0"], "etc": ["\uac74\ubb3c\ube4c\ub529", "\uac74\ubb3c"]};
// \uc2e0\uaddc \uc800\uc7a5 \uc2dc category1/category2 \u2192 'type' \ub2e8\ucd95\ud0a4 \ud30c\uc0dd\uc6a9(\ud45c\uc900 5\ub300\ubd84\ub958 \uc870\ud569\ub9cc \ucee4\ubc84).
const CATEGORY_TO_TYPE = {
  "\uacf5\uc7a5\ucc3d\uace0|\uacf5\uc7a5": "factory", "\uacf5\uc7a5\ucc3d\uace0|\ucc3d\uace0": "warehouse",
  "\uc0c1\uac00\uc0ac\ubb34\uc2e4|\uc0c1\uac00": "shop", "\uc0c1\uac00\uc0ac\ubb34\uc2e4|\uc0ac\ubb34\uc2e4": "office",
  "\ud1a0\uc9c0|\ud1a0\uc9c0": "land_single", "\ud1a0\uc9c0|\ub18d\uc9c0": "land_other", "\ud1a0\uc9c0|\ud0dd\uc9c0": "land_dev",
  "\uc8fc\uac70\uc6a9|\uc544\ud30c\ud2b8": "apartment", "\uc8fc\uac70\uc6a9|\uc624\ud53c\uc2a4\ud154": "officetel",
  "\ub2e8\ub3c5\uc804\uc6d0\uc8fc\ud0dd|\ub2e8\ub3c5\uc8fc\ud0dd": "house", "\ub2e8\ub3c5\uc804\uc6d0\uc8fc\ud0dd|\uc804\uc6d0\uc8fc\ud0dd": "house",
  "\uac74\ubb3c\ube4c\ub529|\uac74\ubb3c": "building", "\uac74\ubb3c\ube4c\ub529|\ube4c\ub529": "building",
  "\uac74\ubb3c\ube4c\ub529|\uc0c1\uac00\uc8fc\ud0dd": "shophouse", "\uac74\ubb3c\ube4c\ub529|\ub2e4\uac00\uad6c\uc8fc\ud0dd": "multifamily"
};

function getCategoryFromListing(item = {}) {
  const legacy = LEGACY_TYPE_CATEGORY[item.type] || ['\uac74\ubb3c\ube4c\ub529', '\uac74\ubb3c'];
  let category1 = item.category1 || item.category_1 || legacy[0];
  let category2 = item.category2 || item.category_2 || legacy[1];
  if (category1 === '\uae30\ud0c0') {
    category1 = '\uac74\ubb3c\ube4c\ub529';
    category2 = '\uac74\ubb3c';
  }
  return { category1, category2 };
}

function getTypeFromCategory(category1, category2, fallback = 'etc') {
  return CATEGORY_TO_TYPE[`${category1}|${category2}`] || fallback || 'etc';
}

// ===== \uce74\ud14c\uace0\ub9ac \uc815\uaddc\ud654(\ud654\uba74 \ud45c\uc2dc\u00b7\ud544\ud130 \uc804\uc6a9, \uc77d\uae30 \uc804\uc6a9) =====
// DB\uc5d0 \uc2e4\uc81c \uc800\uc7a5\ub41c category1/category2(\uc5c6\uc73c\uba74 \ub808\uac70\uc2dc 'type')\ub97c \ud45c\uc900 5\ub300\ubd84\ub958 \uccb4\uacc4\ub85c \ubcc0\ud658\ud574
// \ud654\uba74\uc5d0 \ubcf4\uc5ec\uc8fc\uae30 \uc704\ud55c \ud568\uc218. \uc6d0\ubcf8 \ub370\uc774\ud130\ub294 \uc808\ub300 \ubcc0\uacbd\ud558\uc9c0 \uc54a\uc73c\uba70, \ud45c\uc900\uacfc \ub9de\uc9c0 \uc54a\ub294 \uac12\uc740
// \uc784\uc758\ub85c \ub2e4\ub978 \uce74\ud14c\uace0\ub9ac\uc5d0 \ub07c\uc6cc \ub9de\ucd94\uc9c0 \uc54a\uace0 "\ud655\uc778 \ud544\uc694"\ub85c \ud45c\uc2dc\ud55c\ub2e4.
// \ub300\ubd84\ub958 \ud45c\uae30\uac00 \ub2e4\ub978 \ub808\uac70\uc2dc \ubb38\uc790\uc5f4(\uc608: "\uacf5\uc7a5/\ucc3d\uace0") \u2192 \ud45c\uc900 \ub300\ubd84\ub958 key.
const LEGACY_CATEGORY1_ALIAS = {
  "\uacf5\uc7a5/\ucc3d\uace0": "\uacf5\uc7a5\ucc3d\uace0",
  "\uc0c1\uac00/\uc0ac\ubb34\uc2e4": "\uc0c1\uac00\uc0ac\ubb34\uc2e4",
  "\ub2e8\ub3c5\uc804\uc6d0\uc8fc\ud0dd": "\uc8fc\uac70\uc6a9"
};
// \ub300\ubd84\ub958\ub294 \ud655\uc815\ub410\uc9c0\ub9cc \uc138\ubd80\uad6c\ubd84 \ud45c\uae30\ub9cc \ub2e4\ub978 \ub808\uac70\uc2dc \uac12 \u2192 \ud45c\uc900 \uc138\ubd80\uad6c\ubd84.
const LEGACY_CATEGORY2_ALIAS = {
  "\ub2e8\ub3c5\ud0dd\uc9c0": "\ud0dd\uc9c0"
};
// category1/category2\uac00 \ubaa8\ub450 \ube44\uc5b4 \uc788\ub294 \uad6c\ud615 \ud589(\ub808\uac70\uc2dc 'type'\ub9cc \uc874\uc7ac)\uc744 \uc704\ud55c \ub300\ubd84\ub958/\uc138\ubd80\uad6c\ubd84 \ucd94\uc815.
// 'etc'\ub294 \ud3ec\ud568\ud558\uc9c0 \uc54a\ub294\ub2e4 \u2014 \ub300\ubd84\ub958\uc870\ucc28 \uc54c \uc218 \uc5c6\ub294 \uac12\uc744 \uc784\uc758\ub85c \ud2b9\uc815 \uce74\ud14c\uace0\ub9ac\uc5d0 \ub123\uc9c0 \uc54a\uae30 \uc704\ud568.
// \uc138\ubd80\uac12\uc774 null\uc778 \ud56d\ubaa9\uc740 \ub300\ubd84\ub958\ub294 \ud655\uc2e4\ud558\uc9c0\ub9cc \uc138\ubd80\uad6c\ubd84\uc740 \uc54c \uc218 \uc5c6\uc5b4 "\ud655\uc778 \ud544\uc694"\ub85c \ud45c\uc2dc\ub41c\ub2e4.
const LEGACY_TYPE_TO_STANDARD_CATEGORY = {
  "shop": ["\uc0c1\uac00\uc0ac\ubb34\uc2e4", "\uc0c1\uac00"], "office": ["\uc0c1\uac00\uc0ac\ubb34\uc2e4", "\uc0ac\ubb34\uc2e4"], "\uc0ac\ubb34\uc2e4": ["\uc0c1\uac00\uc0ac\ubb34\uc2e4", "\uc0ac\ubb34\uc2e4"],
  "officetel": ["\uc8fc\uac70\uc6a9", "\uc624\ud53c\uc2a4\ud154"], "\uc624\ud53c\uc2a4\ud154": ["\uc8fc\uac70\uc6a9", "\uc624\ud53c\uc2a4\ud154"],
  "land_single": ["\ud1a0\uc9c0", "\ud1a0\uc9c0"], "land_dev": ["\ud1a0\uc9c0", "\ud1a0\uc9c0"], "land_other": ["\ud1a0\uc9c0", "\ud1a0\uc9c0"],
  "hilsstate": ["\uc8fc\uac70\uc6a9", null], "factory": ["\uacf5\uc7a5\ucc3d\uace0", null], "bizcenter": ["\uc0c1\uac00\uc0ac\ubb34\uc2e4", null]
};

function normalizeListingCategory(item = {}) {
  const rawCategory1 = item.category1 || item.category_1 || "";
  const rawCategory2 = item.category2 || item.category_2 || "";
  let effCategory1 = rawCategory1;
  let effCategory2 = rawCategory2;

  if (!effCategory1 && !effCategory2) {
    const legacyPair = LEGACY_TYPE_TO_STANDARD_CATEGORY[item.type];
    if (legacyPair) { effCategory1 = legacyPair[0]; effCategory2 = legacyPair[1] || ""; }
  }

  let majorKey = resolveDisplayCategory1(effCategory1, effCategory2);
  if (LEGACY_CATEGORY1_ALIAS[majorKey]) majorKey = LEGACY_CATEGORY1_ALIAS[majorKey];

  const standard = PROPERTY_CATEGORY_STANDARD[majorKey];
  const rawLabel = rawCategory1 || rawCategory2 || item.type || "\uc5c6\uc74c";

  if (!standard) {
    return {
      majorKey: null, majorLabel: "\ubbf8\ubd84\ub958",
      subCategory: null, subLabel: null,
      rawCategory1, rawCategory2,
      normalized: false, needsReview: true,
      displayLabel: `\ud655\uc778 \ud544\uc694 \u00b7 \uae30\uc874\uac12: ${rawLabel}`
    };
  }

  const subCategory = LEGACY_CATEGORY2_ALIAS[effCategory2] || effCategory2;
  const subMatches = standard.children.includes(subCategory);

  if (!subMatches) {
    return {
      majorKey, majorLabel: standard.label,
      subCategory: null, subLabel: null,
      rawCategory1, rawCategory2,
      normalized: true, needsReview: true,
      displayLabel: `${standard.label} \u00b7 \ud655\uc778 \ud544\uc694 (\uae30\uc874\uac12: ${rawCategory2 || item.type || "\uc5c6\uc74c"})`
    };
  }

  return {
    majorKey, majorLabel: standard.label,
    subCategory, subLabel: subCategory,
    rawCategory1, rawCategory2,
    normalized: (rawCategory1 !== majorKey) || (rawCategory2 !== subCategory),
    needsReview: false,
    displayLabel: `${standard.label} / ${subCategory}`
  };
}

// \uce74\ub4dc\u00b7\ubaa9\ub85d\u00b7\uc0c1\uc138 \ub4f1 "\ub9e4\ubb3c\uc720\ud615" \ud45c\uc2dc\uac00 \ud544\uc694\ud55c \ubaa8\ub4e0 \uacf3\uc5d0\uc11c \uacf5\uc6a9\uc73c\ub85c \uc0ac\uc6a9\ud558\ub294 \ud45c\uc900 \ud45c\uc2dc \ub77c\ubca8.
function getListingCategoryLabel(item = {}) {
  return normalizeListingCategory(item).displayLabel;
}

// ===== \ub2e8\uc9c0\u00b7\ud0dc\uadf8 \ud544\ud130(\ub300\ubd84\ub958\uc640 \ubb34\uad00, DB \uc2a4\ud0a4\ub9c8 \ubcc0\uacbd \uc5c6\uc74c) =====
// \ub9e4\ubb3c \ub300\ubd84\ub958/\uc138\ubd80\uad6c\ubd84\uacfc \ubcc4\uac1c\ub85c, \ud2b9\uc815 \ub2e8\uc9c0(\uc608: \ud790\uc2a4\ud14c\uc774\ud2b8\ub354\uc6b4\uc815)\uc5d0 \uc18d\ud558\ub294 \ub9e4\ubb3c\uc744 \ucc3e\uae30 \uc704\ud55c \ub9e4\uce6d \ud568\uc218.
// \uc0c8 DB \uceec\ub7fc\uc744 \ucd94\uac00\ud558\uc9c0 \uc54a\uace0 \uae30\uc874 data JSON \uad6c\uc870 \uc548\uc758 \ud544\ub4dc\ub9cc \uc0ac\uc6a9\ud55c\ub2e4:
//  - \ub808\uac70\uc2dc type="hilsstate" (\uae30\uc874 26\uac74 \ub4f1 \u2014 \uc0ad\uc81c\u00b7\ubcc0\uacbd\ud558\uc9c0 \uc54a\uace0 \uadf8\ub300\ub85c \ub9e4\uce6d)
//  - complexName(\uc2e0\uaddc \ub4f1\ub85d/\uc218\uc815 \uc2dc \uc785\ub825\ud558\ub294 "\ub2e8\uc9c0\uba85" \ud544\ub4dc, data JSON\uc5d0 \uc800\uc7a5)
//  - stickers \ubc30\uc5f4\uc5d0 \ub2e8\uc9c0\uba85\uc774 \ud3ec\ud568\ub41c \uacbd\uc6b0
//  - category2\uc5d0 \ub2e8\uc9c0\uba85\uc774 \ub0a8\uc544\uc788\ub294 \uacbd\uc6b0(\ub808\uac70\uc2dc \ud638\ud658)
const COMPLEX_TAG_MATCHERS = {
  "\ud790\uc2a4\ud14c\uc774\ud2b8\ub354\uc6b4\uc815": (item) => {
    if (item.type === "hilsstate") return true;
    if (item.complexName === "\ud790\uc2a4\ud14c\uc774\ud2b8\ub354\uc6b4\uc815") return true;
    if (Array.isArray(item.stickers) && item.stickers.includes("\ud790\uc2a4\ud14c\uc774\ud2b8\ub354\uc6b4\uc815")) return true;
    if (item.category2 === "\ud790\uc2a4\ud14c\uc774\ud2b8\ub354\uc6b4\uc815") return true;
    return false;
  }
};
function matchesComplexTag(item, tag) {
  const matcher = COMPLEX_TAG_MATCHERS[tag];
  return matcher ? matcher(item) : false;
}

const headers = {
  "Content-Type": "application/json",
  "apikey": SUPABASE_KEY,
  "Authorization": "Bearer " + SUPABASE_KEY
};

// 공유 자료는 인증된 읽기 전용 서버에서 기본정보만 받는다.
// 모든 입력/수정 요청은 선택한 사무소의 Supabase로만 보낸다.
const SharedReference = (() => {
  const tables = new Set(['drive_resource_categories','drive_resources','buildings','building_floors','building_files','land_parcels','land_block_sources']);
  const cache = new Map();
  async function rows(table) {
    const entry = cache.get(table);
    if (entry && Date.now() - entry.time < 30000) return entry.promise;
    const promise = (async () => {
      const {data,error} = await hitopAuthClient.auth.getSession();
      if (error || !data.session) throw new Error('로그인 후 공유자료를 볼 수 있습니다.');
      const response = await fetch('https://xaxbkdnrzsghsabkdvzj.supabase.co/functions/v1/shared-reference-data?table=' + table, {
        headers:{apikey:'sb_publishable_gqNFRMHb6yYKvqFnQurPKQ_7gGhURVd',Authorization:'Bearer '+data.session.access_token},
        signal:AbortSignal.timeout(25000)
      });
      if (!response.ok) throw new Error('공유 기본자료를 불러오지 못했습니다. 잠시 후 새로고침해주세요.');
      const result = await response.json();
      if (!Array.isArray(result)) throw new Error('공유자료 응답 오류');
      return result;
    })().catch(error=>{cache.delete(table);throw error;});
    cache.set(table,{time:Date.now(),promise});return promise;
  }
  function key(table,row) {
    if(table==='buildings')return row.local_id || row.id;
    if(table==='drive_resource_categories')return row.name;
    if(table==='land_parcels')return [row.block_id,row.subblock,row.parcel].join('|');
    return row.id || row.block_id;
  }
  function matches(row,params) {
    for(const [field,expression] of params) {
      if(['select','order','limit','offset'].includes(field))continue;
      if(expression.startsWith('eq.')) {if(String(row[field])!==expression.slice(3))return false;}
      else if(expression.startsWith('in.(')&&expression.endsWith(')')){if(!expression.slice(4,-1).split(',').includes(String(row[field])))return false;}
      else if(expression==='is.null'){if(row[field]!=null)return false;}
      else return false;
    }
    return true;
  }
  async function request(url,options,network) {
    if(OfficeConfig.id!=='ktop')return network(url,options);
    const target=new URL(url,location.href);
    const table=target.origin===SUPABASE_URL && target.pathname.startsWith('/rest/v1/') ? target.pathname.slice(9) : '';
    if(!tables.has(table))return network(url,options);
    const method=(options.method||'GET').toUpperCase();
    if(method==='GET') {
      const [response,shared]=await Promise.all([network(url,options),rows(table)]);
      if(!response.ok)return response;
      const local=await response.json();
      const merged=new Map(shared.map(row=>[key(table,row),row]));
      for(const row of local)merged.set(key(table,row),row);
      let result=Array.from(merged.values()).filter(row=>matches(row,target.searchParams));
      const order=target.searchParams.get('order');
      if(order)result.sort((a,b)=>{for(const term of order.split(',')){const [field,dir]=term.split('.');const av=a[field],bv=b[field];if(av==null||bv==null){if(av!==bv)return av==null?1:-1;continue;}const diff=typeof av==='number'&&typeof bv==='number'?av-bv:String(av).localeCompare(String(bv),'ko',{numeric:true});if(diff)return dir==='desc'?-diff:diff;}return 0;});
      const offset=Number(target.searchParams.get('offset')||0),limit=Number(target.searchParams.get('limit')||result.length);
      return new Response(JSON.stringify(result.slice(offset,offset+limit)),{status:200,headers:{'Content-Type':'application/json'}});
    }
    if(method==='PATCH'||method==='DELETE') {
      const shared=(await rows(table)).filter(row=>matches(row,target.searchParams));
      if(shared.length) {
        const check=await network(url,{headers:options.headers});
        if(!check.ok)return check;
        const local=await check.json();
        const missing=shared.filter(row=>!local.some(r=>key(table,r)===key(table,row)));
        if(missing.length) {
          if(method==='DELETE'||!['drive_resources','land_parcels','buildings'].includes(table))throw new Error('공유 원본은 읽기 전용입니다. 케이탑 자료를 별도로 등록해주세요.');
          const copies=missing.map(({_shared_reference,...row})=>row);
          const copied=await network(SUPABASE_URL+'/rest/v1/'+table,{method:'POST',headers:{...options.headers,Prefer:'return=minimal'},body:JSON.stringify(copies)});
          if(!copied.ok)throw new Error('케이탑 자료 저장 준비에 실패했습니다.');
        }
      }
    }
    return network(url,options);
  }
  return {request,matches,key};
})();

async function fetchWithTimeout(url, options = {}, timeout = 30000) {
  if (String(url).startsWith(SUPABASE_URL + '/') && window.hitopAuthReady && !await window.hitopAuthReady) throw new Error('로그인이 필요합니다.');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await SharedReference.request(url, options, (target, init) => fetch(target, { ...init, signal: controller.signal }));
    return res;
  } catch(e) {
    if (e.name === "AbortError") throw new Error("Server response timed out. Please check your internet connection.");
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

// ===== 전화번호 자동 하이픈 포맷 (소유주 연락처1/2 등에서 공용 사용) =====
function phoneDigitsOnly(value) {
  return String(value || "").replace(/[^0-9]/g, "");
}
function formatKoreanPhoneInput(value) {
  const digits = phoneDigitsOnly(value);
  if (!digits) return "";
  if (digits.startsWith("02")) {
    const d = digits.slice(0, 10);
    if (d.length < 3) return d;
    if (d.length < 6) return d.slice(0, 2) + "-" + d.slice(2);
    if (d.length < 10) return d.slice(0, 2) + "-" + d.slice(2, d.length - 4) + "-" + d.slice(d.length - 4);
    return d.slice(0, 2) + "-" + d.slice(2, 6) + "-" + d.slice(6, 10);
  }
  const d = digits.slice(0, 11);
  if (d.length < 4) return d;
  if (d.length < 7) return d.slice(0, 3) + "-" + d.slice(3);
  if (d.length < 11) return d.slice(0, 3) + "-" + d.slice(3, d.length - 4) + "-" + d.slice(d.length - 4);
  return d.slice(0, 3) + "-" + d.slice(3, 7) + "-" + d.slice(7, 11);
}
function setupPhoneAutoFormat(inputEl) {
  if (!inputEl || inputEl.dataset.phoneFormatBound === "1") return;
  inputEl.dataset.phoneFormatBound = "1";
  const reformat = () => {
    const caretFromEnd = inputEl.value.length - (inputEl.selectionEnd ?? inputEl.value.length);
    const formatted = formatKoreanPhoneInput(inputEl.value);
    if (inputEl.value !== formatted) inputEl.value = formatted;
    const pos = Math.max(0, inputEl.value.length - caretFromEnd);
    try { inputEl.setSelectionRange(pos, pos); } catch (e) {}
  };
  inputEl.addEventListener("input", reformat);
  inputEl.addEventListener("blur", reformat);
}

function uniqueImageUrls(list) {
  const seen = new Set();
  return (Array.isArray(list) ? list : [])
    .map(v => String(v || "").trim())
    .filter(Boolean)
    .filter(url => {
      if (seen.has(url)) return false;
      seen.add(url);
      return true;
    });
}

function getAllListingImageUrls(item = {}) {
  const data = item.data && typeof item.data === "object" ? item.data : {};
  return uniqueImageUrls(
    Array.isArray(item.allImageUrls) ? item.allImageUrls :
    Array.isArray(item.all_image_urls) ? item.all_image_urls :
    Array.isArray(data.allImageUrls) ? data.allImageUrls :
    Array.isArray(data.all_image_urls) ? data.all_image_urls :
    Array.isArray(data.imageUrls) ? data.imageUrls :
    Array.isArray(data.image_urls) ? data.image_urls :
    Array.isArray(item.imageUrls) ? item.imageUrls :
    Array.isArray(item.image_urls) ? item.image_urls : []
  );
}

function getPublicListingImageUrls(item = {}) {
  const data = item.data && typeof item.data === "object" ? item.data : {};
  const hasExplicitPublic =
    Array.isArray(item.publicImageUrls) ||
    Array.isArray(item.public_image_urls) ||
    Array.isArray(data.publicImageUrls) ||
    Array.isArray(data.public_image_urls);
  const publicUrls = uniqueImageUrls(
    Array.isArray(item.publicImageUrls) ? item.publicImageUrls :
    Array.isArray(item.public_image_urls) ? item.public_image_urls :
    Array.isArray(data.publicImageUrls) ? data.publicImageUrls :
    Array.isArray(data.public_image_urls) ? data.public_image_urls :
    Array.isArray(item.image_urls) ? item.image_urls : []
  );
  if (hasExplicitPublic) return publicUrls;
  return item.is_public === true ? getAllListingImageUrls(item) : publicUrls;
}

function getListingImageUrls(item = {}) {
  return getAllListingImageUrls(item);
}

function normalizeListingRow(r) {
  const data = r.data && typeof r.data === "object" ? r.data : {};
  const isPublic = r.is_public === true || data.is_public === true;
  const allImageUrls = getAllListingImageUrls(Object.assign({}, data, {
    image_urls: r.image_urls,
    imageUrls: data.imageUrls,
    allImageUrls: data.allImageUrls,
    all_image_urls: data.all_image_urls
  }));
  const publicImageUrls = getPublicListingImageUrls(Object.assign({}, data, {
    image_urls: r.image_urls,
    is_public: isPublic
  }));
  return Object.assign({
    id: r.id,
    type: r.type,
    title: r.title,
    address: r.address,
    status: r.status,
    description: r.description,
    resource_id: r.resource_id || null,
    created_at: r.created_at,
    category1: r.category1 || r.category_1 || data.category1 || '',
    category2: r.category2 || r.category_2 || data.category2 || ''
  }, data, {
    is_public: isPublic,
    image_urls: allImageUrls,
    imageUrls: allImageUrls,
    allImageUrls,
    publicImageUrls
  });
}

function buildListingPayload(item) {
  const data = Object.assign({}, item);
  const id = data.id;
  const category = getCategoryFromListing(data);
  const category1 = category.category1;
  const category2 = category.category2;
  const type = data.type || getTypeFromCategory(category1, category2, 'etc');
  const title = data.title;
  const address = data.address;
  const status = data.status;
  const description = data.description;
  const resource_id = data.resource_id !== undefined ? (data.resource_id || null) : undefined;
  const is_public = data.is_public === true;
  const allImageUrls = getAllListingImageUrls(data).slice(0, MAX_LISTING_IMAGES);
  const hasExplicitPublic = Array.isArray(data.publicImageUrls) || Array.isArray(data.public_image_urls);
  const publicImageUrls = (hasExplicitPublic
    ? uniqueImageUrls(data.publicImageUrls || data.public_image_urls)
    : (is_public ? allImageUrls : [])
  ).filter(url => allImageUrls.includes(url) && isListingImageFile(url)).slice(0, MAX_LISTING_IMAGES);
  const image_urls = is_public ? publicImageUrls : [];

  delete data.id;
  delete data.created_at;
  delete data.type;
  delete data.title;
  delete data.address;
  delete data.status;
  delete data.description;
  delete data.resource_id;
  delete data.category1;
  delete data.category2;
  delete data.category_1;
  delete data.category_2;
  delete data.is_public;
  delete data.image_urls;
  delete data.imageUrls;
  delete data.allImageUrls;
  delete data.all_image_urls;
  delete data.publicImageUrls;
  delete data.public_image_urls;

  data.category1 = category1;
  data.category2 = category2;
  data.is_public = is_public;
  data.image_urls = image_urls;
  data.imageUrls = allImageUrls;
  data.allImageUrls = allImageUrls;
  data.publicImageUrls = publicImageUrls;

  const payload = { type, title, address, status, description, is_public, image_urls, category1, category2, data };
  if (id !== undefined) payload.id = id;
  if (resource_id !== undefined) payload.resource_id = resource_id;
  return payload;
}

// ===== 건축물대장 자동조회 (lookup-building-register Edge Function) =====
// hoNm(호수)을 넘기면 집합건물의 경우 표제부(건물 전체 연면적) 대신 전유부의
// 해당 호실 전유면적을 우선 반환한다. dongNm(동)은 대부분 상가/오피스텔이
// 단일동이라 생략 가능.
async function lookupBuildingRegister(address, opts) {
  opts = opts || {};
  // hoNm이 있으면 전유부를 여러 페이지 순회하며 찾을 수 있고, data.go.kr 게이트웨이가
  // 가끔 일시적으로 느리거나 500을 던져(연속 2회까지도 관측됨) 서버 쪽에서 재시도까지
  // 하는 경우가 있어 일반 조회보다 훨씬 오래 걸릴 수 있다 — 넉넉하게 50초로 설정.
  const timeout = opts.hoNm ? 110000 : 70000;
  const res = await fetchWithTimeout(SUPABASE_URL + "/functions/v1/lookup-building-register", {
    method: "POST",
    headers,
    body: JSON.stringify({ address: String(address || "").replace(/\([^)]*\)/g, "").replace(/（[^）]*）/g, "").trim(), hoNm: opts.hoNm || "", dongNm: opts.dongNm || "", apartment: opts.apartment === true, scope:opts.scope || "", buildingName:opts.buildingName || "" })
  }, timeout);
  let data = null;
  try { data = await res.json(); } catch (e) { /* 응답 본문이 JSON이 아닌 경우 무시 */ }
  if (!res.ok) {
    const err = new Error((data && data.error) || ("건축물대장 조회 실패 (" + res.status + ")"));
    err.status = res.status;
    throw err;
  }
  return data;
}

async function getListings() {
  const res = await fetchWithTimeout(SUPABASE_URL + "/rest/v1/listings?order=created_at.desc", { headers });
  if (!res.ok) throw new Error("Listing lookup failed");
  const rows = await res.json();
  return rows.map(normalizeListingRow);
}

// 백업용 — listings 테이블의 원본 행(컬럼 + data JSON)을 가공 없이 전부 가져온다.
// 한 번에 가져올 수 있는 행 수 제한이 있어도 빠지지 않도록 페이지 단위로 끝까지 읽는다.
async function getListingsRaw() {
  const PAGE = 500;
  const all = [];
  for (let offset = 0; ; offset += PAGE) {
    const res = await fetchWithTimeout(
      SUPABASE_URL + "/rest/v1/listings?select=*&order=created_at.desc,id.asc&limit=" + PAGE + "&offset=" + offset,
      { headers }
    );
    if (!res.ok) throw new Error("매물 원본 데이터를 불러오지 못했습니다. (" + res.status + ")");
    const rows = await res.json();
    all.push(...rows);
    if (rows.length < PAGE) break;
  }
  return all;
}

async function getListingById(id) {
  const res = await fetchWithTimeout(SUPABASE_URL + "/rest/v1/listings?id=eq." + encodeURIComponent(id), { headers });
  if (!res.ok) throw new Error("Lookup failed");
  const rows = await res.json();
  if (!rows.length) return null;
  return normalizeListingRow(rows[0]);
}

async function addListing(item) {
  const payload = buildListingPayload(item);
  const res = await fetchWithTimeout(SUPABASE_URL + "/rest/v1/listings", {
    method: "POST",
    headers: Object.assign({}, headers, { "Prefer": "return=minimal" }),
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error("Save failed: " + await res.text());
}

// 저장 후 생성된 Supabase UUID를 반환 (건물 호실 listing_id 연동용)
async function addListingReturnId(item) {
  const payload = buildListingPayload(item);
  const res = await fetchWithTimeout(SUPABASE_URL + "/rest/v1/listings", {
    method: "POST",
    headers: Object.assign({}, headers, { "Prefer": "return=representation" }),
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error("Save failed: " + await res.text());
  const rows = await res.json();
  return rows[0]?.id || null;
}

// 업무일지(haitop-realestate-diary)에서 "매물보내기"로 넘어온 매물을 저장한 뒤,
// 원래 업무일지 메모(work_diary)에 새로 생긴 매물 id를 역연결한다.
// work_diary는 같은 Supabase 프로젝트를 쓰는 다른 앱 소유 테이블이지만, RLS가
// authenticated 전체 CRUD를 허용하므로(로그인 세션 재사용) 직접 PATCH할 수 있다.
async function linkDiaryEntryToListing(diaryId, listingId) {
  if (!diaryId || !listingId) return;
  try {
    const res = await fetchWithTimeout(SUPABASE_URL + "/rest/v1/work_diary?id=eq." + encodeURIComponent(diaryId), {
      method: "PATCH",
      headers: Object.assign({}, headers, { "Prefer": "return=minimal" }),
      body: JSON.stringify({ listing_id: listingId })
    });
    if (!res.ok) console.warn("[업무일지 매물 연결 실패]", await res.text());
  } catch (e) {
    console.warn("[업무일지 매물 연결 실패]", e.message || e);
  }
}

async function uploadListingImage(file, listingId) {
  if (OfficeConfig.id === "ktop") throw new Error("케이탑 매물 첨부파일 저장은 아직 연결 준비 중입니다.");
  if (!file) throw new Error("No file selected.");
  const isImage = file.type ? file.type.startsWith("image/") : isListingImageFile(file.name);
  const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name || "");
  if (!isImage && !isPdf) throw new Error("이미지 또는 PDF 파일만 업로드할 수 있습니다.");

  const rawExt = (file.name || "").split(".").pop() || "jpg";
  const ext = rawExt.replace(/[^a-zA-Z0-9]/g, "").toLowerCase() || "jpg";
  const safeListingId = String(listingId || "listing").replace(/[^a-zA-Z0-9_-]/g, "-");
  const safeName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const objectPath = `${safeListingId}/${safeName}`;
  const objectUrl = `${SUPABASE_URL}/storage/v1/object/${LISTING_IMAGES_BUCKET}/${objectPath}`;

  const res = await fetchWithTimeout(objectUrl, {
    method: "POST",
    headers: {
      "apikey": SUPABASE_KEY,
      "Authorization": "Bearer " + SUPABASE_KEY,
      "Content-Type": file.type || "application/octet-stream",
      "Cache-Control": "3600",
      "x-upsert": "false"
    },
    body: file
  }, 30000);
  if (!res.ok) throw new Error("Image upload failed: " + await res.text());

  return `${SUPABASE_URL}/storage/v1/object/public/${LISTING_IMAGES_BUCKET}/${objectPath.split('/').map(encodeURIComponent).join('/')}`;
}

async function uploadListingImages(files, listingId, existingCount = 0) {
  const selected = Array.from(files || []).filter(Boolean);
  if (existingCount + selected.length > MAX_LISTING_IMAGES) {
    throw new Error(`Images can be uploaded up to ${MAX_LISTING_IMAGES} files.`);
  }
  const urls = [];
  for (const file of selected) {
    urls.push(await uploadListingImage(file, listingId));
  }
  return urls;
}

async function updateListingStatus(id, status) {
  const res = await fetchWithTimeout(SUPABASE_URL + "/rest/v1/listings?id=eq." + encodeURIComponent(id), {
    method: "PATCH",
    headers: Object.assign({}, headers, { "Prefer": "return=minimal" }),
    body: JSON.stringify({ status: status })
  });
  if (!res.ok) throw new Error("상태 변경 실패");
  invalidateCustomerLinkContext();
}
async function markListingDone(id) {
  const res1 = await fetchWithTimeout(SUPABASE_URL + "/rest/v1/listings?id=eq." + encodeURIComponent(id), { headers });
  if (!res1.ok) throw new Error("조회 실패");
  const rows = await res1.json();
  if (!rows.length) throw new Error("매물을 찾을 수 없습니다");
  const r = rows[0];
  const data = Object.assign({}, r.data, { completed_at: new Date().toISOString() });
  const res2 = await fetchWithTimeout(SUPABASE_URL + "/rest/v1/listings?id=eq." + encodeURIComponent(id), {
    method: "PATCH",
    headers: Object.assign({}, headers, { "Prefer": "return=minimal" }),
    body: JSON.stringify({ status: "거래완료", data })
  });
  if (!res2.ok) throw new Error("거래완료 처리 실패: " + await res2.text());
  invalidateCustomerLinkContext();
}
async function deleteListing(id) {
  const res = await fetchWithTimeout(SUPABASE_URL + "/rest/v1/listings?id=eq." + encodeURIComponent(id), {
    method: "DELETE",
    headers: headers
  });
  if (!res.ok) throw new Error("삭제 실패");
}
async function updateListing(id, item) {
  const payload = buildListingPayload(Object.assign({}, item, { id }));
  delete payload.id;
  const res = await fetchWithTimeout(SUPABASE_URL + "/rest/v1/listings?id=eq." + encodeURIComponent(id), {
    method: "PATCH",
    headers: Object.assign({}, headers, { "Prefer": "return=minimal" }),
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error("Update failed: " + await res.text());
}

async function updateListingPublic(id, isPublic) {
  const current = await getListingById(id);
  if (!current) throw new Error("Listing was not found.");
  await updateListing(id, Object.assign({}, current, { is_public: isPublic === true }));
}
async function updateListingResourceId(id, resource_id) {
  const res = await fetchWithTimeout(SUPABASE_URL + "/rest/v1/listings?id=eq." + encodeURIComponent(id), {
    method: "PATCH",
    headers: Object.assign({}, headers, { "Prefer": "return=minimal" }),
    body: JSON.stringify({ resource_id: resource_id || null })
  });
  if (!res.ok) throw new Error("자료연결 수정 실패: " + await res.text());
}

// ===== 추천매물장 관리 =====
async function getRecommendedProperties() {
  const res = await fetchWithTimeout(SUPABASE_URL + "/rest/v1/recommended_properties?order=received_date.desc,created_at.desc", { headers });
  if (!res.ok) throw new Error("추천매물장 목록 조회 실패");
  return await res.json();
}
async function addRecommendedProperty(item) {
  const res = await fetchWithTimeout(SUPABASE_URL + "/rest/v1/recommended_properties", {
    method: "POST",
    headers: Object.assign({}, headers, { "Prefer": "return=minimal" }),
    body: JSON.stringify(item)
  });
  if (!res.ok) throw new Error("추천매물장 저장 실패: " + await res.text());
}
async function updateRecommendedProperty(id, item) {
  const body = Object.assign({}, item);
  delete body.id; delete body.created_at;
  const res = await fetchWithTimeout(SUPABASE_URL + "/rest/v1/recommended_properties?id=eq." + encodeURIComponent(id), {
    method: "PATCH",
    headers: Object.assign({}, headers, { "Prefer": "return=minimal" }),
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error("추천매물장 수정 실패: " + await res.text());
}
async function deleteRecommendedProperty(id) {
  const res = await fetchWithTimeout(SUPABASE_URL + "/rest/v1/recommended_properties?id=eq." + encodeURIComponent(id), {
    method: "DELETE",
    headers: headers
  });
  if (!res.ok) throw new Error("추천매물장 삭제 실패");
}

// ===== 자료보기 관리 =====
async function getDriveResources() {
  const res = await fetchWithTimeout(SUPABASE_URL + "/rest/v1/drive_resources?order=created_at.asc", { headers });
  if (!res.ok) throw new Error("자료 목록 조회 실패");
  return await res.json();
}
async function addDriveResource(item) {
  const res = await fetchWithTimeout(SUPABASE_URL + "/rest/v1/drive_resources", {
    method: "POST",
    headers: Object.assign({}, headers, { "Prefer": "return=minimal" }),
    body: JSON.stringify(item)
  });
  if (!res.ok) throw new Error("자료 저장 실패: " + await res.text());
}
async function updateDriveResource(id, item) {
  const body = Object.assign({}, item);
  delete body.id; delete body.created_at;
  const res = await fetchWithTimeout(SUPABASE_URL + "/rest/v1/drive_resources?id=eq." + encodeURIComponent(id), {
    method: "PATCH",
    headers: Object.assign({}, headers, { "Prefer": "return=minimal" }),
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error("자료 수정 실패: " + await res.text());
}
async function deleteDriveResource(id) {
  const res = await fetchWithTimeout(SUPABASE_URL + "/rest/v1/drive_resources?id=eq." + encodeURIComponent(id), {
    method: "DELETE",
    headers: headers
  });
  if (!res.ok) throw new Error("자료 삭제 실패");
}

// ===== 추천매물 파일 관리 =====
async function getAllRecommendedFiles() {
  const res = await fetchWithTimeout(SUPABASE_URL + "/rest/v1/recommended_files?order=created_at.asc", { headers });
  if (!res.ok) throw new Error("추천매물 파일 목록 조회 실패");
  return await res.json();
}
async function getRecommendedFiles(recommendedId) {
  const res = await fetchWithTimeout(SUPABASE_URL + "/rest/v1/recommended_files?recommended_id=eq." + encodeURIComponent(recommendedId) + "&order=created_at.asc", { headers });
  if (!res.ok) throw new Error("추천매물 파일 조회 실패");
  return await res.json();
}
async function addRecommendedFile(item) {
  const res = await fetchWithTimeout(SUPABASE_URL + "/rest/v1/recommended_files", {
    method: "POST",
    headers: Object.assign({}, headers, { "Prefer": "return=minimal" }),
    body: JSON.stringify(item)
  });
  if (!res.ok) throw new Error("추천매물 파일 저장 실패: " + await res.text());
}
async function deleteRecommendedFile(id) {
  const res = await fetchWithTimeout(SUPABASE_URL + "/rest/v1/recommended_files?id=eq." + encodeURIComponent(id), {
    method: "DELETE", headers
  });
  if (!res.ok) throw new Error("추천매물 파일 삭제 실패");
}
async function deleteRecommendedFilesByRecId(recommendedId) {
  const res = await fetchWithTimeout(SUPABASE_URL + "/rest/v1/recommended_files?recommended_id=eq." + encodeURIComponent(recommendedId), {
    method: "DELETE", headers
  });
  if (!res.ok) throw new Error("추천매물 파일 일괄 삭제 실패");
}

// ===== 건물 층별 평면도 =====
async function getAllBuildingFloors() {
  const res = await fetchWithTimeout(SUPABASE_URL + "/rest/v1/building_floors?select=id,building_id,floor_number,cloudinary_url,file_name&order=created_at.asc", { headers });
  if (!res.ok) throw new Error("평면도 목록 조회 실패");
  return await res.json();
}
async function resolveBuildingMaterialUrls(rows) {
  if(OfficeConfig.id!=='ktop')return rows;
  const prefix=SUPABASE_URL+'/storage/v1/object/authenticated/building-materials/';
  const paths=[...new Set(rows.map(row=>row.cloudinary_url || '').filter(url=>url.startsWith(prefix)).map(url=>url.slice(prefix.length)))];
  if(!paths.length)return rows;
  const {data,error}=await hitopAuthClient.storage.from('building-materials').createSignedUrls(paths,3600);
  if(error)throw new Error('자료 열람 권한을 확인하지 못했습니다. 다시 로그인해주세요.');
  const urls=new Map((data || []).filter(row=>row.signedUrl && !row.error).map(row=>[row.path,row.signedUrl]));
  if(urls.size!==paths.length)throw new Error('저장된 파일을 열지 못했습니다. 새로고침 후 다시 확인해주세요.');
  return rows.map(row=>row.cloudinary_url?.startsWith(prefix) ? {...row,material_storage_url:row.cloudinary_url,cloudinary_url:urls.get(row.cloudinary_url.slice(prefix.length))} : row);
}
async function getBuildingFloors(buildingId) {
  const res = await fetchWithTimeout(SUPABASE_URL + "/rest/v1/building_floors?building_id=eq." + encodeURIComponent(buildingId) + "&order=sort_order.asc.nullslast,created_at.asc", { headers });
  if (!res.ok) throw new Error("평면도 목록 조회 실패");
  return await resolveBuildingMaterialUrls(await res.json());
}
async function saveBuildingFloorOrder(buildingId, floorIds) {
  const res = await fetchWithTimeout(SUPABASE_URL + "/rest/v1/rpc/reorder_building_floors", {
    method: "POST",
    headers,
    body: JSON.stringify({ p_building_id: buildingId, p_floor_ids: floorIds })
  });
  if (!res.ok) throw new Error("순서 저장 실패: " + await res.text());
}
async function addBuildingFloor(item) {
  const res = await fetchWithTimeout(SUPABASE_URL + "/rest/v1/building_floors", {
    method: "POST",
    headers: Object.assign({}, headers, { "Prefer": "return=minimal" }),
    body: JSON.stringify(item)
  });
  if (!res.ok) throw new Error("평면도 저장 실패: " + await res.text());
}
async function updateBuildingFloor(id, changes) {
  const url = SUPABASE_URL + '/rest/v1/building_floors?id=eq.' + encodeURIComponent(id);
  const res = await fetchWithTimeout(url, {
    method: 'PATCH',
    headers: Object.assign({}, headers, { 'Prefer': 'return=representation' }),
    body: JSON.stringify(changes)
  });
  if (!res.ok) throw new Error('평면도 수정 실패: ' + await res.text());
  const updated = await res.json();
  if (updated.length !== 1) throw new Error('수정할 평면도를 찾지 못했습니다.');
  return updated[0];
}
async function deleteBuildingFloor(id) {
  const res = await fetchWithTimeout(SUPABASE_URL + "/rest/v1/building_floors?id=eq." + encodeURIComponent(id), {
    method: "DELETE", headers
  });
  if (!res.ok) throw new Error("평면도 삭제 실패");
}

// ===== 건물 기타 자료 =====
async function getBuildingFiles(buildingId) {
  const res = await fetchWithTimeout(SUPABASE_URL + "/rest/v1/building_files?building_id=eq." + encodeURIComponent(buildingId) + "&order=created_at.asc", { headers });
  if (!res.ok) throw new Error("기타 자료 목록 조회 실패");
  return await resolveBuildingMaterialUrls(await res.json());
}
async function addBuildingFile(item) {
  const res = await fetchWithTimeout(SUPABASE_URL + "/rest/v1/building_files", {
    method: "POST",
    headers: Object.assign({}, headers, { "Prefer": "return=minimal" }),
    body: JSON.stringify(item)
  });
  if (!res.ok) throw new Error("기타 자료 저장 실패: " + await res.text());
}
async function deleteBuildingFile(id) {
  const res = await fetchWithTimeout(SUPABASE_URL + "/rest/v1/building_files?id=eq." + encodeURIComponent(id), {
    method: "DELETE", headers
  });
  if (!res.ok) throw new Error("기타 자료 삭제 실패");
}

// ===== 참고매물 관리 =====
async function getReferenceProperties() {
  const res = await fetchWithTimeout(SUPABASE_URL + "/rest/v1/reference_properties?order=created_at.desc", { headers });
  if (!res.ok) throw new Error("참고매물 목록 조회 실패");
  return await res.json();
}
async function addReferenceProperty(item) {
  const res = await fetchWithTimeout(SUPABASE_URL + "/rest/v1/reference_properties", {
    method: "POST",
    headers: Object.assign({}, headers, { "Prefer": "return=minimal" }),
    body: JSON.stringify(item)
  });
  if (!res.ok) throw new Error("참고매물 저장 실패: " + await res.text());
}
async function updateReferenceProperty(id, item) {
  const body = Object.assign({}, item);
  delete body.id; delete body.created_at;
  const res = await fetchWithTimeout(SUPABASE_URL + "/rest/v1/reference_properties?id=eq." + encodeURIComponent(id), {
    method: "PATCH",
    headers: Object.assign({}, headers, { "Prefer": "return=minimal" }),
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error("참고매물 수정 실패: " + await res.text());
}
async function deleteReferenceProperty(id) {
  const res = await fetchWithTimeout(SUPABASE_URL + "/rest/v1/reference_properties?id=eq." + encodeURIComponent(id), {
    method: "DELETE",
    headers: headers
  });
  if (!res.ok) throw new Error("참고매물 삭제 실패");
}

// ===== 의뢰 관리 =====
async function getRequests() {
  const res = await fetchWithTimeout(SUPABASE_URL + "/rest/v1/requests?order=created_at.desc", { headers });
  if (!res.ok) throw new Error("의뢰 목록 조회 실패");
  return await res.json();
}
async function addRequest(request) {
  const res = await fetchWithTimeout(SUPABASE_URL + "/rest/v1/requests", {
    method: "POST",
    headers: Object.assign({}, headers, { "Prefer": "return=minimal" }),
    body: JSON.stringify(request)
  });
  if (!res.ok) throw new Error("의뢰 저장 실패: " + await res.text());
}
async function deleteRequest(id) {
  const res = await fetchWithTimeout(SUPABASE_URL + "/rest/v1/requests?id=eq." + encodeURIComponent(id), {
    method: "DELETE",
    headers: headers
  });
  if (!res.ok) throw new Error("의뢰 삭제 실패");
}
async function updateRequestStatus(id, status) {
  const res = await fetchWithTimeout(SUPABASE_URL + "/rest/v1/requests?id=eq." + encodeURIComponent(id), {
    method: "PATCH",
    headers: Object.assign({}, headers, { "Prefer": "return=minimal" }),
    body: JSON.stringify({ status })
  });
  if (!res.ok) throw new Error("의뢰 상태 변경 실패");
}
async function updateRequest(id, data) {
  const body = Object.assign({}, data);
  delete body.id; delete body.created_at;
  const res = await fetchWithTimeout(SUPABASE_URL + "/rest/v1/requests?id=eq." + encodeURIComponent(id), {
    method: "PATCH",
    headers: Object.assign({}, headers, { "Prefer": "return=minimal" }),
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error("의뢰 수정 실패: " + await res.text());
}

// ===== 메모장 관리 =====
async function getMemos() {
  const res = await fetchWithTimeout(SUPABASE_URL + "/rest/v1/memos?order=created_at.desc", { headers });
  if (!res.ok) throw new Error("메모 목록 조회 실패");
  return await res.json();
}
async function addMemo(item) {
  const res = await fetchWithTimeout(SUPABASE_URL + "/rest/v1/memos", {
    method: "POST",
    headers: Object.assign({}, headers, { "Prefer": "return=minimal" }),
    body: JSON.stringify(item)
  });
  if (!res.ok) throw new Error("메모 저장 실패: " + await res.text());
}
async function updateMemo(id, item) {
  const body = Object.assign({}, item);
  delete body.id; delete body.created_at;
  const res = await fetchWithTimeout(SUPABASE_URL + "/rest/v1/memos?id=eq." + encodeURIComponent(id), {
    method: "PATCH",
    headers: Object.assign({}, headers, { "Prefer": "return=minimal" }),
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error("메모 수정 실패: " + await res.text());
}
async function deleteMemo(id) {
  const res = await fetchWithTimeout(SUPABASE_URL + "/rest/v1/memos?id=eq." + encodeURIComponent(id), {
    method: "DELETE",
    headers: headers
  });
  if (!res.ok) throw new Error("메모 삭제 실패");
}

// ===== 고객 관리 =====
async function getCustomers() {
  const result = [], pageSize=500;
  for(let offset=0;;offset+=pageSize) {
    const res = await fetchWithTimeout(SUPABASE_URL + "/rest/v1/customers?order=created_at.desc,id.asc&limit="+pageSize+"&offset="+offset, { headers });
    if (!res.ok) throw new Error("고객 목록 조회 실패");
    const rows=await res.json();
    result.push(...rows);
    if(rows.length<pageSize)return result;
  }
}
async function addCustomer(customer) {
  const res = await fetchWithTimeout(SUPABASE_URL + "/rest/v1/customers", {
    method: "POST",
    headers: Object.assign({}, headers, { "Prefer": "return=minimal" }),
    body: JSON.stringify(customer)
  });
  if (!res.ok) throw new Error("고객 저장 실패: " + await res.text());
}
async function deleteCustomer(id) {
  const res = await fetchWithTimeout(SUPABASE_URL + "/rest/v1/customers?id=eq." + encodeURIComponent(id), {
    method: "DELETE",
    headers: headers
  });
  if (!res.ok) throw new Error("고객 삭제 실패");
}
async function updateCustomerStatus(id, status) {
  const res = await fetchWithTimeout(SUPABASE_URL + "/rest/v1/customers?id=eq." + encodeURIComponent(id), {
    method: "PATCH",
    headers: Object.assign({}, headers, { "Prefer": "return=minimal" }),
    body: JSON.stringify({ status })
  });
  if (!res.ok) throw new Error("고객 상태 변경 실패");
}
async function updateCustomer(id, data) {
  const body = Object.assign({}, data);
  delete body.id; delete body.created_at;
  const res = await fetchWithTimeout(SUPABASE_URL + "/rest/v1/customers?id=eq." + encodeURIComponent(id), {
    method: "PATCH",
    headers: Object.assign({}, headers, { "Prefer": "return=minimal" }),
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error("고객 수정 실패: " + await res.text());
  invalidateCustomerLinkContext();
}
async function getDoneCustomers() {
  const res = await fetchWithTimeout(SUPABASE_URL + "/rest/v1/customers?status=eq.계약완료&order=completed_at.desc", { headers });
  if (!res.ok) throw new Error("완료고객 목록 조회 실패");
  return await res.json();
}
async function getCustomerById(id) {
  const res = await fetchWithTimeout(SUPABASE_URL + "/rest/v1/customers?id=eq." + encodeURIComponent(id), { headers });
  if (!res.ok) throw new Error("고객 조회 실패");
  const rows = await res.json();
  return rows[0] || null;
}
function generateCustomerCode() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const suffix = (window.crypto && crypto.randomUUID)
    ? crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase()
    : Math.random().toString(16).slice(2, 10).toUpperCase();
  return `C-${y}${m}${day}-${suffix}`;
}
function normalizeCustomerPhone(phone) {
  return (phone || "").replace(/[^0-9]/g, "");
}

// haitop-realestate-diary와 같은 Supabase 프로젝트를 공유하는 work_diary 테이블에서
// 업무일지 이력을 읽는다(고객페이지 "업무일지 이력"/최근업무·최근상담일용). 이 앱은
// 상담 수정은 동일한 work_diary 원본 행의 제목/본문만 갱신한다.
async function getCustomerDiaryHistory(customerId) {
  if(window.HitopGlobalSearchCore){
    const context=await getCustomerLinkContext(),customer=context.data.customers.find(c=>String(c.id)===String(customerId));
    if(context.failed.includes('상담·메모'))throw new Error('상담·메모를 조회하지 못했습니다. 다시 열어 주세요.');
    if(customer)return customerRelatedEntries(context,customer).history;
  }
  const result=[];
  for(let offset=0;;offset+=500){
    const res=await fetchWithTimeout(SUPABASE_URL + "/rest/v1/work_diary?customer_id=eq." + encodeURIComponent(customerId) +
      "&or=(link_key.is.null,link_key.neq.__daily_schedule__)&select=id,customer_id,listing_id,date,title,content,writer,created_at,updated_at&order=date.desc,created_at.desc,id.asc&limit=500&offset="+offset,{headers});
    if(!res.ok)throw new Error("업무일지 이력 조회 실패");
    const rows=await res.json();result.push(...rows);if(rows.length<500)return result;
  }
}

// 목록 화면의 "최근업무"/"최근상담일" 컬럼용 - 여러 고객의 최신 업무일지 1건씩을 한 번에 조회.
async function getLatestDiaryActivityForCustomers(customerIds) {
  const ids=[...new Set((customerIds||[]).filter(Boolean))], chunks=[], map={};
  for(let i=0;i<ids.length;i+=100)chunks.push(ids.slice(i,i+100));
  let next=0;
  async function worker(){
    while(next<chunks.length){
      const batch=chunks[next++], inList=batch.map(id=>encodeURIComponent(id)).join(",");
      for(let offset=0;;offset+=500){
        const res=await fetchWithTimeout(SUPABASE_URL+"/rest/v1/work_diary?customer_id=in.("+inList+")&or=(link_key.is.null,link_key.neq.__daily_schedule__)&select=customer_id,date,title,content,created_at&order=date.desc,created_at.desc&limit=500&offset="+offset,{headers});
        if(!res.ok)break;
        const rows=await res.json();
        rows.forEach(row=>{if(row.customer_id&&!map[row.customer_id])map[row.customer_id]=row;});
        if(rows.length<500)break;
      }
    }
  }
  await Promise.all(Array.from({length:Math.min(4,chunks.length)},worker));
  return map;
}

// ===== 건물 호실 현황 (Supabase buildings 테이블) =====
async function getBuildingRecord(localId) {
  // 1순위: local_id 정확 매칭
  const r1 = await fetchWithTimeout(
    SUPABASE_URL + "/rest/v1/buildings?local_id=eq." + encodeURIComponent(localId) + "&select=*",
    { headers }
  );
  if (!r1.ok) throw new Error("건물 조회 실패 (local_id)");
  const rows1 = await r1.json();
  if (rows1.length) {
    console.log("[getBuildingRecord] local_id 매칭:", localId, "→", rows1[0].name);
    return rows1[0];
  }

  // 2순위: name 필드 매칭 (drive_resources.name ≠ buildings.local_id 케이스 대응)
  console.warn("[getBuildingRecord] local_id 매칭 실패:", localId, "→ name 필드로 재시도");
  const r2 = await fetchWithTimeout(
    SUPABASE_URL + "/rest/v1/buildings?name=eq." + encodeURIComponent(localId) + "&select=*",
    { headers }
  );
  if (!r2.ok) throw new Error("건물 조회 실패 (name)");
  const rows2 = await r2.json();
  if (rows2.length) {
    console.log("[getBuildingRecord] name 매칭 성공:", localId, "→", rows2[0].name);
    return rows2[0];
  }

  console.warn("[getBuildingRecord] 최종 실패 - 일치하는 건물 없음:", localId);
  return null;
}

async function saveBuildingUnits(localId, name, units) {
  const body = JSON.stringify({
    local_id: localId,
    name: name || '',
    units: Array.isArray(units) ? units : []
  });
  const res = await fetchWithTimeout(SUPABASE_URL + "/rest/v1/buildings?on_conflict=local_id", {
    method: "POST",
    headers: Object.assign({}, headers, { "Prefer": "resolution=merge-duplicates,return=minimal" }),
    body
  });
  if (!res.ok) throw new Error("호실 저장 실패: " + await res.text());
}

// 고객 화면과 업무일지는 같은 원본을 사용한다. 다른 필드는 덮어쓰지 않는다.
async function updateCustomerDiaryEntry(customerId, original, changes) {
  const params = new URLSearchParams({
    id: 'eq.' + original.id, customer_id: Object.hasOwn(original,'customer_id') ? (original.customer_id ? 'eq.'+original.customer_id : 'is.null') : 'eq.' + customerId,
    updated_at: original.updated_at ? 'eq.' + original.updated_at : 'is.null',
    content: original.content == null ? 'is.null' : 'eq.' + original.content,
    title: original.title == null ? 'is.null' : 'eq.' + original.title,
    select: 'id,date,title,content,updated_at'
  });
  const res = await fetchWithTimeout(SUPABASE_URL + '/rest/v1/work_diary?' + params, {
    method: 'PATCH', headers: { ...headers, Prefer: 'return=representation' },
    body: JSON.stringify({ title: changes.title, content: changes.content, ...(changes.date ? {date:changes.date} : {}), updated_at: new Date().toISOString() })
  });
  if (!res.ok) throw new Error('상담 저장 실패. 로그인과 수정 권한을 확인해 주세요.');
  const rows = await res.json();
  if (rows.length !== 1) throw new Error('다른 화면에서 변경됐거나 수정할 수 없는 기록입니다. 입력 내용을 복사한 뒤 다시 열어 주세요.');
  invalidateCustomerLinkContext();
  return rows[0];
}
async function getCustomerDiaryAttachments(diaryIds) {
  if (!diaryIds.length) return [];
  const params = new URLSearchParams({
    work_diary_id: 'in.(' + diaryIds.join(',') + ')',
    select: 'id,work_diary_id,storage_bucket,storage_path,original_name,mime_type',
    order: 'created_at.asc'
  });
  const res = await fetchWithTimeout(SUPABASE_URL + '/rest/v1/crm_attachments?' + params, { headers });
  if (!res.ok) throw new Error('첨부자료를 불러오지 못했습니다.');
  return res.json();
}
async function getCustomerAttachmentUrl(row) {
  if (!row.storage_path) throw new Error('첨부파일 경로가 없습니다.');
  const { data, error } = await hitopAuthClient.storage
    .from(row.storage_bucket || 'crm-attachments').createSignedUrl(row.storage_path, 120);
  if (error || !data?.signedUrl) throw new Error('첨부파일을 열 수 없습니다. 로그인과 파일 권한을 확인해 주세요.');
  return data.signedUrl;
}

// 같은 관리앱의 새 탭·페이지 이동에도 선택한 부동산을 명시한다.
function officeDecorateLinks(root) {
  // 다운로드용 임시 링크처럼 곧바로 제거되는 노드는 parentNode가 null일 수 있다.
  if (!root || typeof root.querySelectorAll !== 'function') return;
  root.querySelectorAll('a[href]').forEach(link => {
    try {
      const target = new URL(link.getAttribute('href'), location.href);
      const appRoot = new URL('./', location.href);
      if (OfficeConfig.id === 'ktop' && target.hostname === 'hitoputube-creator.github.io' && /^\/hitop-property-platform\//.test(target.pathname)) { link.remove(); return; }
      if (target.origin === appRoot.origin && target.pathname.startsWith(appRoot.pathname) && target.pathname.endsWith('.html')) {
        link.href = OfficeConfig.urlFor(target.href);
      }
    } catch (_) {}
  });
}
document.addEventListener('DOMContentLoaded', () => {
  officeDecorateLinks(document);
  if (OfficeConfig.id === 'ktop' && /(?:resources|building-detail|building-overview|floor-status|land-resource)\.html$/.test(location.pathname)) {
    const notice = document.createElement('div');
    notice.textContent = '하이탑 기본자료 함께 보기 · 소유주·연락처·고객·업무일지는 사무소별로 관리합니다.';
    notice.style.cssText = 'padding:10px 16px;background:#183b36;color:#d0efe5;font-size:13px;text-align:center';
    document.body.prepend(notice);
  }
  new MutationObserver(records => {
    for (const record of records) for (const node of record.addedNodes) {
      if (node.nodeType === 1 && node.isConnected) {
        if (node.matches('a[href]')) officeDecorateLinks(node.parentNode);
        else officeDecorateLinks(node);
      }
    }
  }).observe(document.body, { childList: true, subtree: true });
});
// 별도 업무앱은 아직 케이탑 연결이 없으므로 하이탑 고객화면을 열지 않는다.
document.addEventListener('click', event => {
  if (OfficeConfig.id !== 'ktop') return;
  const link = event.target.closest('a[href]');
  if (!link) return;
  const target = new URL(link.href);
  if (target.hostname === 'haitop-realestate-diary.vercel.app' ||
      (target.hostname === 'hitoputube-creator.github.io' && /^\/(hitop-ai-workcenter|hitop-property-platform|Commercial-Property-Quote)\//.test(target.pathname))) {
    event.preventDefault();
    event.stopImmediatePropagation();
    alert('이 업무앱의 케이탑 연결은 아직 준비 중입니다.');
  }
}, true);




async function addCustomerDiaryMemo(customer, draft) {
  if (!customer.id || !draft.id || !/^\d{4}-\d{2}-\d{2}$/.test(draft.date) || !draft.content.trim()) throw new Error('고객·날짜·메모를 확인해 주세요.');
  const body={id:draft.id,customer_id:customer.id,customer_name:customer.name||'',customer_phone:customer.phone||'',date:draft.date,title:'고객 추가메모',content:draft.content.trim(),record_type:'일반메모',writer:OfficeConfig.label};
  const res=await fetchWithTimeout(SUPABASE_URL+'/rest/v1/work_diary?on_conflict=id', {
    method:'POST',headers:{...headers,Prefer:'resolution=ignore-duplicates,return=representation'},body:JSON.stringify(body)
  });
  if(!res.ok)throw new Error('메모 저장 실패. 로그인과 입력 내용을 확인해 주세요.');
  const saved=(await res.json())[0] || body;invalidateCustomerLinkContext();return saved;
}

function listingProgressStatus(item) { return item?.status === '거래완료' ? '거래완료' : item?.status === '보류' ? '보류' : '진행중'; }

let customerLinkContextCache=null;
function invalidateCustomerLinkContext(){customerLinkContextCache=null;}
async function getCustomerLinkContext(){
  if(customerLinkContextCache && Date.now()-customerLinkContextCache.time<15000)return customerLinkContextCache.promise;
  if(!window.HitopGlobalSearchCore)throw new Error('고객 연결 검색을 불러오지 못했습니다.');
  async function read(table){
    const rows=[];
    for(let offset=0;;offset+=500){
      const res=await fetchWithTimeout(SUPABASE_URL+'/rest/v1/'+table+'?select=*&order=id.asc&limit=500&offset='+offset,{headers});
      if(!res.ok)throw new Error(table+' 조회 실패');
      const batch=await res.json();rows.push(...batch);if(batch.length<500)return rows;
    }
  }
  const tables=[['listings','매물'],['buildings','세대·점포'],['drive_resources','기본자료'],['land_parcels','택지'],['customers','고객'],['drive_resource_categories','자료분류'],['work_diary','상담·메모']];
  const promise=(async()=>{
    const settled=await Promise.allSettled(tables.map(([table])=>read(table)));
    const keys=['listings','buildings','resources','parcels','customers','categories','diary'],data={},failed=[];
    settled.forEach((result,index)=>{data[keys[index]]=result.status==='fulfilled'?result.value:[];if(result.status==='rejected')failed.push(tables[index][1]);});
    if(settled.every(r=>r.status==='rejected'))throw new Error('고객 연결 자료를 불러오지 못했습니다.');
    return {data,entries:window.HitopGlobalSearchCore.build(data),failed};
  })();
  customerLinkContextCache={time:Date.now(),promise};
  try{return await promise;}catch(e){invalidateCustomerLinkContext();throw e;}
}
function customerRelatedEntries(context,customer){
  const core=window.HitopGlobalSearchCore;
  const phones=new Set(core.customerContacts(customer).map(c=>core.phone(c.phone)).filter(p=>p.length>=7));
  const ids=new Set([String(customer.id),...context.data.customers.filter(c=>core.customerContacts(c).some(contact=>phones.has(core.phone(contact.phone)))).map(c=>String(c.id))]);
  const properties=context.entries.filter(e=>e.group!=='고객' && e.group!=='상담·메모' && ((e.customerIds||[]).some(id=>ids.has(String(id)))||e.contacts.some(c=>phones.has(core.phone(c.phone)))));
  const listingIds=new Set(properties.map(p=>p.listingId).filter(Boolean).map(String));
  const history=context.entries.filter(e=>e.group==='상담·메모' && ((e.customerIds||[]).some(id=>ids.has(String(id)))||e.contacts.some(c=>phones.has(core.phone(c.phone)))||listingIds.has(String(e.listingId)))).map(e=>e.diary)
    .sort((a,b)=>String(b.date).localeCompare(String(a.date))||String(b.created_at).localeCompare(String(a.created_at)));
  return {properties,history,failed:context.failed};
}
