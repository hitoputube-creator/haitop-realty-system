// 선택한 프로젝트의 실제 사용자와 케이탑 사용 권한을 확인한 뒤 요청을 허용한다.
const hitopAuthClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
function hitopApplyAuthHeader(session) {
  headers.Authorization = 'Bearer ' + (session && session.access_token ? session.access_token : SUPABASE_KEY);
}
function hitopRedirectToLogin() {
  const next = encodeURIComponent(location.pathname.split('/').pop() + location.search);
  location.replace(OfficeConfig.urlFor('login.html?redirect=' + next));
}
async function hitopAdminLogout() {
  if (OfficeConfig.id === 'hitop' && typeof document !== 'undefined') document.cookie = 'hitopPinUnlocked=; path=/; Max-Age=0';
  try { await hitopAuthClient.auth.signOut(); }
  finally { hitopApplyAuthHeader(null); hitopRedirectToLogin(); }
}
window.hitopAuthReady = (async function () {
  try {
    const { data: sessionData, error: sessionError } = await hitopAuthClient.auth.getSession();
    if (sessionError || !sessionData.session) throw new Error('로그인이 필요합니다.');
    const { data: userData, error: userError } = await hitopAuthClient.auth.getUser();
    if (userError || !userData.user) throw new Error('로그인을 다시 해주세요.');
    if (OfficeConfig.id === 'ktop') {
      const { data, error } = await hitopAuthClient.from('office_members').select('email').eq('email', userData.user.email.toLowerCase());
      if (error || !data || !data.length) throw new Error('케이탑 사용 권한이 없습니다.');
    }
    hitopApplyAuthHeader(sessionData.session);
    return true;
  } catch (_) {
    hitopApplyAuthHeader(null);
    hitopRedirectToLogin();
    return false;
  }
})();
hitopAuthClient.auth.onAuthStateChange(function (event, session) {
  if (event === 'SIGNED_OUT') {
    window.hitopAuthReady = Promise.resolve(false);
    hitopApplyAuthHeader(null);
    hitopRedirectToLogin();
    return;
  }
  if (event === 'PASSWORD_RECOVERY') {
    location.replace(OfficeConfig.urlFor('reset-password.html' + location.search + location.hash));
    return;
  }
  // 콜백 내부에서는 추가 Supabase 호출을 하지 않는다.
  hitopApplyAuthHeader(session);
});

// ===== 하이탑 한 번 로그인(SSO) =====
// 하이탑 관리자로 로그인된 상태에서 업무일지(vercel)·홈페이지(hitoprealty.com) 링크를 누르면
// 서버(sso-handoff)에서 1회용 입장권을 받아 붙여 연다. 비밀번호를 다시 묻지 않는다.
// 케이탑은 업무일지·관리화면이 같은 주소에 있어 이미 한 번 로그인으로 함께 열린다.
const HITOP_SSO_TARGET = /^https:\/\/(haitop-realestate-diary\.vercel\.app|(www\.)?hitoprealty\.com)\/|^https:\/\/hitoputube-creator\.github\.io\/hitop-property-platform\//;
async function hitopSsoUrl(url) {
  try {
    const { data } = await hitopAuthClient.auth.getSession();
    if (!data.session) return url;
    const { data: res, error } = await hitopAuthClient.functions.invoke('sso-handoff', { body: {} });
    if (error || !res || res.status !== 'ok' || !res.tokenHash) return url;
    return url.split('#')[0] + '#sso=' + encodeURIComponent(res.tokenHash);
  } catch (_) { return url; }
}
window.hitopSsoUrl = hitopSsoUrl;
document.addEventListener('click', function (event) {
  if (OfficeConfig.id !== 'hitop' || event.defaultPrevented) return;
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const link = event.target.closest && event.target.closest('a[href]');
  if (!link || !HITOP_SSO_TARGET.test(link.href)) return;
  event.preventDefault();
  const newTab = link.target === '_blank';
  const w = newTab ? window.open('about:blank', '_blank') : null;
  if (w) { try { w.opener = null; } catch (_) {} }
  hitopSsoUrl(link.href).then(function (u) { if (w) w.location.href = u; else location.href = u; });
});
