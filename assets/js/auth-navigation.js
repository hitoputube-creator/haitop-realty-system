/* 상단 계정 버튼: 기존 인증 처리만 연결하며 별도 세션을 만들지 않습니다. */
(function () {
  'use strict';
  function setupAuthNavigation() {
    const login = document.querySelector('[data-auth-login]');
    const logout = document.querySelector('[data-auth-logout]');
    if (login) {
      const next = location.pathname.split('/').pop() + location.search;
      const destination = 'login.html?redirect=' + encodeURIComponent(next);
      login.href = typeof OfficeConfig !== 'undefined' ? OfficeConfig.urlFor(destination) : destination;
    }
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
