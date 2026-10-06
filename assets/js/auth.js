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
