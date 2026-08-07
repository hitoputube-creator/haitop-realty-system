// ===== Supabase Auth 기반 관리자 세션 관리 =====
// storage.js가 정의한 SUPABASE_URL / SUPABASE_KEY / headers를 그대로 사용한다.
// 각 관리자 페이지 <head>의 동기 가드(로컬 세션 표시 존재 여부)가 1차로 걸러내고,
// 여기서는 실제 세션 유효성(만료/위조 여부)까지 Supabase에 확인한 뒤
// 이후 모든 REST 요청(storage.js의 fetchWithTimeout 호출들)이 인증된 사용자의
// JWT를 Authorization 헤더로 사용하도록 headers.Authorization을 갱신한다.
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
  hitopApplyAuthHeader(session);
});
