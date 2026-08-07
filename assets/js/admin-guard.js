// ===== 관리자 페이지 공용 동기 가드 =====
// storage.js가 정의한 SUPABASE_URL을 사용한다. 다른 어떤 스크립트(auth.js, nav.js,
// 페이지 전용 스크립트)보다 먼저 실행되어야 하므로, 반드시 storage.js 바로 다음,
// supabase-js/auth.js보다 앞에 <script src="assets/js/admin-guard.js"> 로 로드한다.
//
// 1) URL(해시 또는 쿼리)에 비밀번호 재설정 관련 신호가 있으면 — 정상 로그인
//    세션이 이미 있더라도 무조건 즉시 reset-password.html로 보낸다.
//    - type=recovery            → 유효한 재설정 링크를 클릭해 들어온 경우
//    - error / error_code       → 만료·잘못된 링크(otp_expired 등)로 들어온 경우
//    (기존 세션이 있다는 이유로 관리자 화면이 그대로 열리며 재설정 플로우가
//     무시되던 문제를 막기 위한 것 — 세션 존재 여부 확인보다 먼저 검사한다.)
// 2) 그 외에는 기존과 동일하게 로컬 세션 존재 여부만으로 로그인 페이지 이동을 판단한다.
(function () {
  function paramsFrom(raw) {
    return new URLSearchParams(String(raw || "").replace(/^[?#]/, ""));
  }
  var hashParams = paramsFrom(location.hash);
  var searchParams = paramsFrom(location.search);
  var isRecoveryLink = hashParams.get("type") === "recovery" || searchParams.get("type") === "recovery";
  var hasAuthError = hashParams.has("error") || hashParams.has("error_code") ||
                      searchParams.has("error") || searchParams.has("error_code");

  if (isRecoveryLink || hasAuthError) {
    location.replace("reset-password.html" + location.search + location.hash);
    return;
  }

  var m = SUPABASE_URL.match(/^https:\/\/([^.]+)\./);
  var sessionKey = "sb-" + (m ? m[1] : "") + "-auth-token";
  var hasSession = false;
  try { hasSession = !!localStorage.getItem(sessionKey); } catch (e) {}
  if (!hasSession) {
    var next = encodeURIComponent(location.pathname.split("/").pop() + location.search);
    location.replace("login.html?redirect=" + next);
  }
})();
