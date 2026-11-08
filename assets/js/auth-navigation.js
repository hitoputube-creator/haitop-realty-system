/* 상단 계정 메뉴는 로그아웃 하나만 표시합니다. 기존 인증 함수가 로그인 화면으로 이동합니다. */
(function () {
  'use strict';
  function setupAuthNavigation() {
    const logout = document.querySelector('[data-auth-logout]');
    if (!logout) return;
    logout.addEventListener('click', async function () {
      if (logout.disabled || typeof hitopAdminLogout !== 'function') return;
      logout.disabled = true;
      logout.textContent = '로그아웃 중…';
      try { await hitopAdminLogout(); }
      catch (_) { logout.disabled = false; logout.textContent = '로그아웃'; }
    });
    Promise.resolve(window.hitopAuthReady).then(function (authenticated) {
      logout.hidden = authenticated !== true || typeof hitopAdminLogout !== 'function';
    }).catch(function () { logout.hidden = true; });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setupAuthNavigation, { once: true });
  else setupAuthNavigation();
})();
