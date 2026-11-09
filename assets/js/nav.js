// ===== 공통 상단 내비게이션 (모든 관리 화면 공용) =====
// 각 페이지는 <nav class="main-nav" id="mainNav"></nav>만 두고,
// <body data-nav-active="..."> 로 현재 위치를 표시한다.
// 값: "index" | "properties" | "worklog" | "tools"
const NAV_ITEMS = [
  { key: "index",      label: "통합관리", href: "index.html" },
  { key: "home",       label: "매물관리", cls: "ico-home", href: "property-main.html?category=all&ui=20261006-brand2" },
  { key: "properties", label: "매물관리", cls: "ico-list", href: "properties.html" },
  { key: "worklog",    label: "업무센터", href: "https://hitoputube-creator.github.io/hitop-ai-workcenter/index.html", external: true },
  { key: "diary",      label: "업무일지", href: "https://haitop-realestate-diary.vercel.app/", external: true },
  { key: "homepage",   label: "홈페이지", href: "https://hitoputube-creator.github.io/hitop-property-platform/listings.html", external: true }
];
// action 항목(전체 백업/계약문자)은 해당 함수가 현재 페이지에 없으면
// properties.html로 이동해 자동 실행되도록 폴백한다(모든 화면에서 동일하게 동작 보장).
const NAV_TOOLS = [
  { label: "자료관리",  href: "resources.html" },
  { label: "특별 홍보물", href: "special-promos.html" },
  { label: "건물별 추천매물", href: "recommended-units.html" },
  { label: "전체 백업", action: "exportAll" },
  { label: "견적서",    href: "https://hitoputube-creator.github.io/Commercial-Property-Quote/", external: true },
  { label: "계약문자",  action: "openContractModal" },
  { label: "업무일지",  href: "https://haitop-realestate-diary.vercel.app/", external: true }
];

function hitopLogout() {
  if (typeof hitopAdminLogout === "function") {
    hitopAdminLogout();
  } else {
    location.replace(OfficeConfig.urlFor("login.html"));
  }
}

function renderMainNav() {
  const mount = document.getElementById("mainNav");
  if (!mount) return;
  const active = document.body.dataset.navActive || "";

  const linksHtml = NAV_ITEMS.filter(item => OfficeConfig.id !== "ktop" || (item.key !== "homepage" && item.key !== "diary")).map(original => {
    const item = OfficeConfig.id === 'ktop' && original.key === 'worklog' ? {...original,label:'업무일지',href:OFFICE_DIARY_URL,external:false} : original;
    const cls = "nav-link" + (item.cls ? " " + item.cls : "") + (item.key === active ? " active" : "");
    const attrs = item.external ? ' target="_blank" rel="noopener noreferrer"' : "";
    return `<a class="${cls}" href="${item.href}"${attrs}>${item.label}</a>`;
  }).join("");

  const toolsHtml = NAV_TOOLS.filter(item => OfficeConfig.id === "ktop" || item.label !== "업무일지").map(original => {
    const t = OfficeConfig.id === 'ktop' && original.label === '업무일지' ? {...original,href:OFFICE_DIARY_URL,external:false} : original;
    if (t.action) {
      if (typeof window[t.action] === "function") {
        return `<button type="button" onclick="${t.action}()">${t.label}</button>`;
      }
      return `<a href="properties.html?navAction=${encodeURIComponent(t.action)}">${t.label}</a>`;
    }
    const attrs = t.external ? ' target="_blank" rel="noopener noreferrer"' : "";
    return `<a href="${t.href}"${attrs}>${t.label}</a>`;
  }).join("");

  const toolsActiveCls = "nav-link" + (active === "tools" ? " active" : "");

  mount.innerHTML = `
    ${linksHtml}
    <div class="nav-dropdown" id="toolsDropdown">
      <button type="button" class="${toolsActiveCls}" id="toolsDropdownBtn">업무도구 <span class="nav-caret">▾</span></button>
      <div class="nav-dropdown-menu" id="toolsDropdownMenu">${toolsHtml}</div>
    </div>
    <a class="nav-link" href="${OfficeConfig.urlFor('login.html')}">부동산 선택</a>
    <button type="button" class="nav-logout-btn" onclick="hitopLogout()">로그아웃</button>
  `;

  const dropdown = document.getElementById("toolsDropdown");
  const toggleBtn = document.getElementById("toolsDropdownBtn");
  toggleBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    dropdown.classList.toggle("open");
  });
  document.addEventListener("click", (e) => {
    if (!dropdown.contains(e.target)) dropdown.classList.remove("open");
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") dropdown.classList.remove("open");
  });
}

document.addEventListener("DOMContentLoaded", renderMainNav);

// 매물관리 홈(집 모양)과 매물관리 리스트(가로 세 줄)를 아이콘으로 구분한다. 클래스 ico-home / ico-list
(function () {
  if (document.getElementById("mgmt-ico-style")) return;
  const st = document.createElement("style");
  st.id = "mgmt-ico-style";
  st.textContent = ".ico-home::before,.ico-list::before{content:\"\";display:inline-block;width:1.05em;height:1.05em;margin-right:.4em;vertical-align:-.13em;background:currentColor;-webkit-mask:var(--ico) center/contain no-repeat;mask:var(--ico) center/contain no-repeat}.ico-home{--ico:url(\"data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22black%22%20stroke-width%3D%222.4%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22M3%2011.5%2012%204l9%207.5%22%2F%3E%3Cpath%20d%3D%22M5.5%2010v9.5h13V10%22%2F%3E%3Cpath%20d%3D%22M10%2019.5v-5h4v5%22%2F%3E%3C%2Fsvg%3E\")}.ico-list{--ico:url(\"data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22black%22%20stroke-width%3D%222.6%22%20stroke-linecap%3D%22round%22%3E%3Cpath%20d%3D%22M4%206.5h16M4%2012h16M4%2017.5h16%22%2F%3E%3C%2Fsvg%3E\")}";
  (document.head || document.documentElement).appendChild(st);
})();
