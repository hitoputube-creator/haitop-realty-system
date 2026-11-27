// ===== 하이탑 6자리 간편로그인 (login.html 전용) =====
// 기기 등록 정보(localStorage)와 확인 표시(세션 쿠키)는 같은 주소의 업무센터(pin-gate.js)와 공유한다.
// 서버 확인은 Supabase Edge Function "pin-login"이 한다.
(function () {
  var DEVICE_KEY = "hitopPinDevice";
  var COOKIE = "hitopPinUnlocked";
  var MAX_AGE_MS = 12 * 60 * 60 * 1000;
  function writeCookie(value, extra) {
    document.cookie = COOKIE + "=" + value + "; path=/; SameSite=Lax" +
      (location.protocol === "https:" ? "; Secure" : "") + (extra || "");
  }
  function getDevice() {
    try {
      var d = JSON.parse(localStorage.getItem(DEVICE_KEY));
      return d && d.id && d.secret ? d : null;
    } catch (e) { return null; }
  }
  function unlocked() {
    var m = document.cookie.match(new RegExp("(?:^|; )" + COOKIE + "=(\\d+)"));
    var age = m ? Date.now() - Number(m[1]) : -1;
    return age >= 0 && age < MAX_AGE_MS;
  }

  // options: client(supabase), card(로그인 카드), emailView(기존 입력 영역), enter(), onEmail(message)
  function create(options) {
    var client = options.client;
    var view = document.createElement("div");
    view.id = "pinView";
    view.hidden = true;
    var keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "clear", "0", "back"];
    view.innerHTML =
      // 모양은 로그인 페이지의 login-warm.css가 정한다.
      '<style>#pinView[hidden]{display:none}</style>' +
      '<p id="pinTitle"></p><div id="pinDots" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i></div>' +
      '<div id="pinMessage" role="status" aria-live="polite"></div><div id="pinPad">' +
      keys.map(function (k) {
        var label = k === "clear" ? "전체삭제" : k === "back" ? "⌫" : k;
        return '<button type="button" data-key="' + k + '"' + (k.length > 1 ? ' class="sub"' : "") +
          (k === "back" ? ' aria-label="한 글자 지우기"' : "") + ">" + label + "</button>";
      }).join("") +
      '</div><button id="pinAltBtn" type="button"></button>';
    options.card.appendChild(view);

    var title = view.querySelector("#pinTitle");
    var message = view.querySelector("#pinMessage");
    var alt = view.querySelector("#pinAltBtn");
    var dots = view.querySelectorAll("#pinDots i");
    var buttons = view.querySelectorAll("#pinPad button");
    var mode = "login", pin = "", firstPin = "", busy = false;

    function say(text, isError) { message.textContent = text || ""; message.className = isError ? "error" : ""; }
    function draw() { dots.forEach(function (d, i) { d.classList.toggle("on", i < pin.length); }); }
    function setBusy(value) {
      busy = value;
      buttons.forEach(function (b) { b.disabled = value; });
      alt.disabled = value;
    }
    function showEmail(text) {
      view.hidden = true;
      options.emailView.hidden = false;
      options.onEmail(text || "");
    }
    function show(nextMode, heading, text) {
      mode = nextMode; pin = ""; draw();
      title.textContent = heading; say(text);
      alt.textContent = nextMode === "login" ? "이메일로 로그인" : "나중에 등록하기";
      options.emailView.hidden = true; view.hidden = false;
      if (document.activeElement) document.activeElement.blur();
    }
    function enter() { writeCookie(Date.now()); options.enter(); }
    function startSetup() { firstPin = ""; show("setup", "새 간편비밀번호 6자리", "다음부터 이 숫자로 로그인합니다."); }
    // 해제된 기기는 남아 있는 로그인 상태까지 지워야 잠금을 우회할 수 없다.
    async function dropDevice(text) {
      try { localStorage.removeItem(DEVICE_KEY); } catch (e) {}
      writeCookie("", "; Max-Age=0");
      try { await client.auth.signOut({ scope: "local" }); } catch (e) {}
      showEmail(text);
    }
    async function call(body) {
      var res = await client.functions.invoke("pin-login", { body: body });
      if (res.error || !res.data) throw res.error || new Error("empty");
      return res.data;
    }
    async function submitLogin(value) {
      var device = getDevice();
      if (!device) { showEmail(); return false; }
      say("확인 중...");
      var result = await call({ action: "login", deviceId: device.id, secret: device.secret, pin: value });
      if (result.status === "ok") {
        var verified = await client.auth.verifyOtp({ token_hash: result.tokenHash, type: "email" });
        if (verified.error) throw verified.error;
        enter();
        return true;
      }
      if (result.status === "wrong") say("비밀번호가 맞지 않습니다. 남은 횟수 " + result.remaining + "번", true);
      else if (result.status === "locked") await dropDevice("5번 틀려 간편비밀번호가 해제되었습니다. 이메일로 로그인하세요.");
      else if (result.status === "revoked" || result.status === "unknown") await dropDevice("간편비밀번호를 다시 등록해야 합니다. 이메일로 로그인하세요.");
      else throw new Error(result.status);
      return false;
    }
    async function submitSetup(value) {
      var secret = Array.from(crypto.getRandomValues(new Uint8Array(32)), function (b) {
        return b.toString(16).padStart(2, "0");
      }).join("");
      say("등록 중...");
      var result = await call({ action: "register", secret: secret, pin: value });
      if (result.status === "ok") {
        localStorage.setItem(DEVICE_KEY, JSON.stringify({ id: result.deviceId, secret: secret }));
        enter();
        return true;
      }
      if (result.status === "weak") { startSetup(); say("123456, 111111처럼 쉬운 숫자는 쓸 수 없습니다.", true); }
      else if (result.status === "reauth" || result.status === "unauthorized") showEmail("이메일로 다시 로그인한 뒤 등록하세요.");
      else throw new Error(result.status);
      return false;
    }
    async function complete() {
      var value = pin;
      if (mode === "setup") { firstPin = value; show("confirm", "한 번 더 입력하세요", "같은 숫자 6자리를 입력하세요."); return; }
      if (mode === "confirm" && value !== firstPin) { startSetup(); say("두 번호가 다릅니다. 처음부터 다시 입력하세요.", true); return; }
      setBusy(true);
      var leaving = false;
      try { leaving = mode === "login" ? await submitLogin(value) : await submitSetup(value); }
      catch (e) { say("연결에 실패했습니다. 잠시 후 다시 입력하거나 아래 버튼을 누르세요.", true); }
      finally { if (!leaving) { pin = ""; draw(); setBusy(false); } }
    }
    function press(key) {
      if (busy || view.hidden) return;
      if (key === "clear") pin = "";
      else if (key === "back") pin = pin.slice(0, -1);
      else if (pin.length < 6) { if (!pin) say(""); pin += key; }
      draw();
      if (pin.length === 6) complete();
    }
    buttons.forEach(function (b) { b.addEventListener("click", function () { press(b.dataset.key); }); });
    document.addEventListener("keydown", function (e) {
      if (view.hidden || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      if (/^[0-9]$/.test(e.key)) { e.preventDefault(); press(e.key); }
      else if (e.key === "Backspace") { e.preventDefault(); press("back"); }
      else if (e.key === "Escape") press("clear");
    });
    alt.addEventListener("click", function () {
      if (busy) return;
      if (mode === "login") showEmail();
      else enter();
    });

    return {
      // 이메일 로그인 성공 직후: 미등록 기기는 등록 화면, 등록 기기는 바로 입장
      afterPasswordLogin: function () { if (getDevice()) enter(); else startSetup(); },
      // 화면을 열 때: 등록 기기면 6자리를 묻고, 이미 확인했고 로그인 상태면 바로 입장
      start: async function () {
        if (!getDevice()) return;
        var res = await client.auth.getSession();
        if (res.data.session && unlocked()) options.enter();
        else show("login", "간편비밀번호 6자리", "");
      }
    };
  }
  window.HitopPinLogin = { create: create };
})();
