// ===== 공통 상단 내비게이션 (모든 관리 화면 공용) =====
// 각 페이지는 <nav class="main-nav" id="mainNav"></nav>만 두고,
// <body data-nav-active="..."> 로 현재 위치를 표시한다.
// 값: "index" | "properties" | "worklog" | "tools"
const NAV_ITEMS = [
  { key: "index",      label: "통합관리", href: "index.html" },
  { key: "properties", label: "매물관리", href: "properties.html" },
  { key: "worklog",    label: "업무센터", href: "https://hitoputube-creator.github.io/hitop-ai-workcenter/index.html", external: true },
  { key: "homepage",   label: "홈페이지", href: "https://hitoputube-creator.github.io/hitop-property-platform/listings.html", external: true }
];
// action 항목(전체 백업/계약문자)은 해당 함수가 현재 페이지에 없으면
// properties.html로 이동해 자동 실행되도록 폴백한다(모든 화면에서 동일하게 동작 보장).
const NAV_TOOLS = [
  { label: "자료관리",  href: "resources.html" },
  { label: "전체 백업", action: "exportAll" },
  { label: "견적서",    href: "https://hitoputube-creator.github.io/Commercial-Property-Quote/", external: true },
  { label: "계약문자",  action: "openContractModal" },
  { label: "캘린더",    href: "https://calendar.google.com", external: true }
];

function hitopLogout() {
  sessionStorage.removeItem("hitop_auth");
  location.reload();
}

function renderMainNav() {
  const mount = document.getElementById("mainNav");
  if (!mount) return;
  const active = document.body.dataset.navActive || "";

  const linksHtml = NAV_ITEMS.map(item => {
    const cls = "nav-link" + (item.key === active ? " active" : "");
    const attrs = item.external ? ' target="_blank" rel="noopener noreferrer"' : "";
    return `<a class="${cls}" href="${item.href}"${attrs}>${item.label}</a>`;
  }).join("");

  const toolsHtml = NAV_TOOLS.map(t => {
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
