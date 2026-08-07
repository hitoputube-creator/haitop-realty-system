// ===== Supabase Auth 기반 관리자 세션 관리 =====
// storage.js가 정의한 SUPABASE_URL / SUPABASE_KEY / headers를 그대로 사용한다.
// 각 관리자 페이지 <head>의 동기 가드(admin-guard.js)가 1차로 걸러내고 — 특히
// 비밀번호 재설정 관련 URL(type=recovery, error/error_code)은 세션 유무와 무관하게
// admin-guard.js 단계에서 이미 reset-password.html로 보내진다 — 여기서는 실제 세션
// 유효성(만료/위조 여부)까지 Supabase에 확인한 뒤 이후 모든 REST 요청(storage.js의
// fetchWithTimeout 호출들)이 인증된 사용자의 JWT를 Authorization 헤더로 사용하도록
// headers.Authorization을 갱신한다.
const hitopAuthClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

function hitopApplyAuthHeader(session) {
  headers.Authorization = "Bearer " + (session && session.access_token ? session.access_token : SUPABASE_KEY);
}

function hitopRedirectToLogin() {
  const next = encodeURIComponent(location.pathname.split("/").pop() + location.search);
  location.replace("login.html?redirect=" + next);
}

async function hitopAdminLogout() {
  try {
    await hitopAuthClient.auth.signOut();
  } finally {
    hitopApplyAuthHeader(null);
    hitopRedirectToLogin();
  }
}

(async function hitopEnsureAdminSession() {
  const { data, error } = await hitopAuthClient.auth.getSession();
  if (error || !data.session) {
    hitopRedirectToLogin();
    return;
  }
  hitopApplyAuthHeader(data.session);
})();

hitopAuthClient.auth.onAuthStateChange(function (event, session) {
  if (event === "SIGNED_OUT") {
    hitopApplyAuthHeader(null);
    hitopRedirectToLogin();
    return;
  }
  if (event === "PASSWORD_RECOVERY") {
    // 관리자 화면에 정상 세션이 있는 상태에서 별도로 비밀번호 재설정 링크가
    // 처리되는 경우까지 대비한 방어 코드 — admin-guard.js가 URL을 먼저 검사해
    // 대부분의 경우 이 지점에 도달하기 전에 이미 reset-password.html로 이동한다.
    location.replace("reset-password.html" + location.search + location.hash);
    return;
  }
  hitopApplyAuthHeader(session);
});
