// 하이탑 기본 디자인은 공통 CSS 원본에서 화이트로 관리합니다. 별도 테마 주입 없음.
// 화면·인쇄물의 상호만 변경한다. 고객/매물 데이터의 이름은 변경하지 않는다.
const officeCompanyName = OfficeConfig.id === 'ktop' ? 'KTOP부동산' : '하이탑부동산';
const officeManagementTitle = officeCompanyName + ' 매물관리';

function officeBrandText(text) {
  return String(text).replace(/하이탑부동산공인중개사사무소|하이탑부동산|케이탑부동산|HITOP\s*부동산|KTOP\s*부동산/g, officeCompanyName);
}
function officeUpdateDocumentTitle() {
  if (document.title.startsWith(officeManagementTitle)) return;
  const detail = officeBrandText(document.title).replaceAll(officeCompanyName, '')
    .replace(/^[\s|·—-]+|[\s|·—-]+$/g, '');
  const plain = ['매물관리', '매물관리 메인', '매물 목록', '매물관리 로그인'].includes(detail);
  const next = detail === '매물관리 목록' ? officeManagementTitle + ' 목록' : officeManagementTitle + (detail && !plain ? ' | ' + detail : '');
  if (document.title !== next) document.title = next;
}
function officeUpdateBranding(root) {
  const selectors = '.logo-main, .brand-name, #officeBrand, .ph-name, .contact-company, .ctrl-title, [data-office-brand]';
  const nodes = [...root.querySelectorAll(selectors)];
  if (root.matches && root.matches(selectors)) nodes.unshift(root);
  nodes.forEach(node => {
    const original = node.textContent;
    let next = officeBrandText(original);
    if (node.matches('.logo-main, .brand-name, #officeBrand')) {
      const detail = next.replace(officeCompanyName, '').trim();
      next = officeManagementTitle + (detail === '매물관리 목록' ? ' 목록' : detail && detail !== '매물관리' ? ' · ' + detail : '');
      if (original.startsWith(officeManagementTitle)) next = original;
    }
    if (node.matches('[data-office-company-footer]')) next = officeCompanyName;
    if (next !== original) node.textContent = next;
  });
  root.querySelectorAll('.brand-mark, .ph-logo').forEach(node => {
    const next = OfficeConfig.id === 'ktop' ? (node.matches('.ph-logo') ? 'KT' : 'K') : (node.matches('.ph-logo') ? 'HT' : 'H');
    if (node.textContent !== next) node.textContent = next;
  });
  if (OfficeConfig.id === 'ktop') root.querySelectorAll('[data-hitop-company-details]').forEach(node => { node.hidden = true; });
}
officeUpdateDocumentTitle();
const officeTitleNode = document.querySelector('title');
if (officeTitleNode) new MutationObserver(officeUpdateDocumentTitle)
  .observe(officeTitleNode, { childList: true, characterData: true, subtree: true });
document.addEventListener('DOMContentLoaded', () => {
  officeUpdateBranding(document);
  new MutationObserver(records => {
    for (const record of records) {
      // 제목을 동적으로 바꾸는 자료실·상세화면도 반영한다.
      if (record.target.nodeType === 1) officeUpdateBranding(record.target);
    }
  }).observe(document.body, { childList: true, subtree: true });
});

// 매물관리 홈(집 모양)과 매물관리 리스트(가로 세 줄)를 아이콘으로 구분한다. 클래스 ico-home / ico-list
(function () {
  if (document.getElementById("mgmt-ico-style")) return;
  const st = document.createElement("style");
  st.id = "mgmt-ico-style";
  st.textContent = ".ico-home::before,.ico-list::before{content:\"\";display:inline-block;width:1.05em;height:1.05em;margin-right:.4em;vertical-align:-.13em;background:currentColor;-webkit-mask:var(--ico) center/contain no-repeat;mask:var(--ico) center/contain no-repeat}.ico-home{--ico:url(\"data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22black%22%20stroke-width%3D%222.4%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22M3%2011.5%2012%204l9%207.5%22%2F%3E%3Cpath%20d%3D%22M5.5%2010v9.5h13V10%22%2F%3E%3Cpath%20d%3D%22M10%2019.5v-5h4v5%22%2F%3E%3C%2Fsvg%3E\")}.ico-list{--ico:url(\"data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22black%22%20stroke-width%3D%222.6%22%20stroke-linecap%3D%22round%22%3E%3Cpath%20d%3D%22M4%206.5h16M4%2012h16M4%2017.5h16%22%2F%3E%3C%2Fsvg%3E\")}";
  (document.head || document.documentElement).appendChild(st);
})();

// 모든 상단 네이비바의 로고를 같은 모양(둥근 네모 + 하이탑 H / 케이탑 K)으로 통일한다
(function () {
  if (document.getElementById("office-logo-style")) return;
  const letter = OfficeConfig.id === "ktop" ? "K" : "H";
  const P0 = "html:root body ";
  const sels = suffix => [".header .logo-icon", ".topbar .logo-icon", ".topbar .logo"].map(s => P0 + s + suffix).join(",");
  const css = sels("") + "{display:grid!important;place-items:center!important;width:40px!important;height:40px!important;min-width:40px!important;flex:0 0 40px!important;border:1px solid rgba(255,255,255,.35)!important;border-radius:11px!important;background:rgba(255,255,255,.13)!important;box-shadow:none!important;position:relative!important;overflow:hidden!important}"
    + sels("::before") + "{content:\"" + letter + "\"!important;position:static!important;display:block!important;width:auto!important;height:auto!important;background:none!important;border-radius:0!important;color:#fff!important;font-size:22px!important;font-weight:750!important;line-height:1!important}"
    + sels("::after") + "{display:none!important}"
    + P0 + ".topbar .brand-mark{width:40px!important;height:40px!important;min-width:40px!important;border-radius:11px!important;font-size:22px!important;font-weight:750!important}";
  const st = document.createElement("style");
  st.id = "office-logo-style";
  st.textContent = css;
  (document.head || document.documentElement).appendChild(st);
})();
