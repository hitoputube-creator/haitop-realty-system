// 화면·인쇄물의 상호만 변경한다. 고객/매물 데이터의 이름은 변경하지 않는다.
const officeCompanyName = OfficeConfig.id === 'ktop' ? 'KTOP부동산' : '하이탑부동산';
const officeManagementTitle = officeCompanyName + ' 매물관리';

function officeBrandText(text) {
  if (OfficeConfig.id !== 'ktop') return text;
  return String(text).replace(/하이탑부동산공인중개사사무소|하이탑부동산|케이탑부동산|HITOP\s*부동산|KTOP\s*부동산/g, officeCompanyName);
}
function officeUpdateDocumentTitle() {
  if (OfficeConfig.id !== 'ktop' || document.title.startsWith(officeManagementTitle)) return;
  const detail = officeBrandText(document.title).replaceAll(officeCompanyName, '')
    .replace(/^[\s|·—-]+|[\s|·—-]+$/g, '');
  const plain = ['매물관리', '매물관리 메인', '매물 목록', '매물관리 로그인'].includes(detail);
  const next = officeManagementTitle + (detail && !plain ? ' | ' + detail : '');
  if (document.title !== next) document.title = next;
}
function officeUpdateBranding(root) {
  if (OfficeConfig.id !== 'ktop') return;
  const selectors = '.logo-main, .brand-name, #officeBrand, .ph-name, .contact-company, .ctrl-title, [data-office-brand]';
  const nodes = [...root.querySelectorAll(selectors)];
  if (root.matches && root.matches(selectors)) nodes.unshift(root);
  nodes.forEach(node => {
    const original = node.textContent;
    let next = officeBrandText(original);
    if (node.matches('.logo-main, .brand-name, #officeBrand')) {
      const detail = next.replace(officeCompanyName, '').trim();
      next = officeManagementTitle + (detail && detail !== '매물관리' ? ' · ' + detail : '');
      if (original.startsWith(officeManagementTitle)) next = original;
    }
    if (node.matches('[data-office-company-footer]')) next = officeCompanyName;
    if (next !== original) node.textContent = next;
  });
  root.querySelectorAll('.brand-mark, .ph-logo').forEach(node => {
    const next = node.matches('.ph-logo') ? 'KT' : 'K';
    if (node.textContent !== next) node.textContent = next;
  });
  root.querySelectorAll('[data-hitop-company-details]').forEach(node => { node.hidden = true; });
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
