/* 상단 계정 메뉴: 로그아웃 + (관리자) 하이탑/케이탑 전환. 기존 인증 함수가 로그인 화면으로 이동합니다. */
(function () {
  'use strict';
  // 하이탑 계정은 관리자: 하이탑으로 로그인하면 케이탑 매물관리도 전환해서 볼 수 있다.
  // 두 부동산은 Supabase 프로젝트가 달라 세션도 따로 저장된다(sb-<ref>-auth-token).
  var OFFICE_REFS = { hitop: 'xaxbkdnrzsghsabkdvzj', ktop: 'enefadyhmhfphtochlku' };
  function hasOfficeSession(id) {
    try { return !!localStorage.getItem('sb-' + OFFICE_REFS[id] + '-auth-token'); } catch (_) { return false; }
  }
  function switchTarget(id) {
    var url = new URL('property-main.html', location.href);
    url.searchParams.set('category', 'all');
    url.searchParams.set('office', id);
    if (!hasOfficeSession(id)) {
      url = new URL('login.html', location.href);
      url.searchParams.set('office', id);
      url.searchParams.set('from', 'admin-switch');
    }
    return url.href;
  }
  function setupOfficeSwitch(logout, authenticated) {
    if (typeof OfficeConfig === 'undefined' || authenticated !== true) return;
    var current = OfficeConfig.id;
    // 하이탑 화면이면 항상(관리자), 케이탑 화면이면 하이탑 관리자 세션이 있을 때만 보인다.
    if (current === 'ktop' && !hasOfficeSession('hitop')) return;
    if (document.querySelector('[data-office-switch]')) return;
    var other = current === 'ktop' ? 'hitop' : 'ktop';
    var btn = document.createElement('a');
    btn.className = 'office-switch';
    btn.setAttribute('data-office-switch', other);
    btn.href = switchTarget(other);
    btn.textContent = other === 'ktop' ? '케이탑 보기' : '하이탑 보기';
    btn.title = (other === 'ktop' ? '케이탑' : '하이탑') + ' 매물관리로 전환 (관리자)';
    btn.setAttribute('aria-label', btn.title);
    btn.addEventListener('click', function () { btn.href = switchTarget(other); });
    logout.parentNode.insertBefore(btn, logout);
    if (!document.getElementById('office-switch-style')) {
      var st = document.createElement('style');
      st.id = 'office-switch-style';
      st.textContent = 'html:root body .top-actions a.office-switch{background:' + (other === 'ktop' ? '#1767d2' : '#0f766e') + '!important;color:#fff!important;border-color:transparent!important;font-weight:700!important}'
        + 'html:root body .top-actions a.office-switch:hover{filter:brightness(1.08)}';
      document.head.appendChild(st);
    }
  }
  function setupAuthNavigation() {
    const logout = document.querySelector('[data-auth-logout]');
    if (!logout) return;
    logout.addEventListener('click', async function () {
      if (logout.disabled || typeof hitopAdminLogout !== 'function') return;
      logout.disabled = true;
      logout.textContent = '로그아웃 중…';
      // 하이탑(관리자) 로그아웃 시 함께 열어 둔 케이탑 세션도 이 브라우저에서 정리한다.
      if (typeof OfficeConfig !== 'undefined' && OfficeConfig.id === 'hitop') {
        try { localStorage.removeItem('sb-' + OFFICE_REFS.ktop + '-auth-token'); } catch (_) {}
      }
      try { await hitopAdminLogout(); }
      catch (_) { logout.disabled = false; logout.textContent = '로그아웃'; }
    });
    Promise.resolve(window.hitopAuthReady).then(function (authenticated) {
      logout.hidden = authenticated !== true || typeof hitopAdminLogout !== 'function';
      setupOfficeSwitch(logout, authenticated);
    }).catch(function () { logout.hidden = true; });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setupAuthNavigation, { once: true });
  else setupAuthNavigation();
})();
