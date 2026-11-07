/* 하이탑 화면: 케이탑에만 있는 분양자료(건물·호실·평면도)를 읽기 전용으로 함께 보여준다.
 * 케이탑 공유 함수(shared-office-contacts)에서 하이탑 관리자 로그인으로 읽어 온다. 하이탑 자료는 항상 우선이며 바꾸지 않는다.
 */
(function () {
  if (typeof OfficeConfig === "undefined" || OfficeConfig.id !== "hitop" || typeof SharedReference === "undefined" || window.__ktopSharedView) return;
  window.__ktopSharedView = true;
  var KTOP_FN = "https://enefadyhmhfphtochlku.supabase.co/functions/v1/shared-office-contacts?table=";
  var KTOP_KEY = "sb_publishable__8Ru0l0wfQo8e5Ljq1ZQ7Q_LYtCAP-p";
  var TABLES = { drive_resources: 1, buildings: 1, building_floors: 1, building_files: 1 };
  var SKIP = { select: 1, order: 1, limit: 1, offset: 1 };
  var cache = {}, hitopNames = null;

  function ktopRows(table) {
    var c = cache[table];
    if (c && Date.now() - c.t < 30000) return c.p;
    var p = (async function () {
      var s = await hitopAuthClient.auth.getSession();
      var tok = s && s.data && s.data.session && s.data.session.access_token;
      if (!tok) return [];
      var res = await fetch(KTOP_FN + table, { headers: { apikey: KTOP_KEY, Authorization: "Bearer " + tok }, signal: AbortSignal.timeout(25000) });
      if (!res.ok) throw new Error("http " + res.status);
      var rows = await res.json();
      return Array.isArray(rows) ? rows : [];
    })().catch(function (e) { delete cache[table]; console.warn("[케이탑 공유자료] 불러오기 실패", table, e); return []; });
    cache[table] = { t: Date.now(), p: p };
    return p;
  }
  async function loadHitopNames(network, headers) {
    if (hitopNames && Date.now() - hitopNames.t < 30000) return hitopNames.p;
    var p = (async function () {
      var res = await network(SUPABASE_URL + "/rest/v1/drive_resources?select=id,name&limit=5000", { headers: headers });
      if (!res.ok) return null;
      var set = {}; (await res.json()).forEach(function (r) { set[String(r.name || "").trim()] = 1; });
      return set;
    })().catch(function () { return null; });
    hitopNames = { t: Date.now(), p: p };
    return p;
  }
  // 케이탑에만 있는 자료관리 건물: 이름이 하이탑 자료관리에 없는 것
  async function ktopOnly(network, headers) {
    var names = await loadHitopNames(network, headers);
    if (!names) return null;
    var res = (await ktopRows("drive_resources")).filter(function (r) { return !names[String(r.name || "").trim()]; });
    var ids = {}, nm = {};
    res.forEach(function (r) { ids[r.id] = 1; nm[String(r.name || "").trim()] = 1; });
    return { res: res, ids: ids, names: nm };
  }
  function supported(params) {
    var ok = true;
    params.forEach(function (v, k) { if (SKIP[k]) return; if (!(v.indexOf("eq.") === 0 || v.indexOf("in.(") === 0 || v === "is.null")) ok = false; });
    return ok;
  }
  function matches(row, params) {
    var ok = true;
    params.forEach(function (v, k) {
      if (SKIP[k] || !ok) return;
      if (v.indexOf("eq.") === 0) { if (String(row[k]) !== v.slice(3)) ok = false; }
      else if (v.indexOf("in.(") === 0 && v.slice(-1) === ")") { if (v.slice(4, -1).split(",").indexOf(String(row[k])) < 0) ok = false; }
      else if (v === "is.null") { if (row[k] != null) ok = false; }
    });
    return ok;
  }
  function sortRows(list, order) {
    return list.sort(function (a, b) {
      var terms = order.split(",");
      for (var i = 0; i < terms.length; i++) {
        var pr = terms[i].split("."), f = pr[0], dir = pr[1], av = a[f], bv = b[f];
        if (av == null || bv == null) { if (av !== bv) return av == null ? 1 : -1; continue; }
        var d = typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv), "ko", { numeric: true });
        if (d) return dir === "desc" ? -d : d;
      }
      return 0;
    });
  }

  var orig = SharedReference.request;
  SharedReference.request = async function (url, options, network) {
    try {
      var target = new URL(url, location.href);
      var table = target.origin === SUPABASE_URL && target.pathname.indexOf("/rest/v1/") === 0 ? target.pathname.slice(9) : "";
      if (!TABLES[table]) return orig.call(SharedReference, url, options, network);
      options = options || {};
      var method = (options.method || "GET").toUpperCase();
      if (method === "GET") {
        var response = await orig.call(SharedReference, url, options, network);
        if (!response.ok || !supported(target.searchParams)) return response;
        var offset = Number(target.searchParams.get("offset") || 0);
        if (offset > 0) return response;
        var only = await ktopOnly(network, options.headers);
        if (!only || !only.res.length) return response;
        var extra;
        if (table === "drive_resources") extra = only.res;
        else {
          var rows = await ktopRows(table);
          extra = rows.filter(function (r) { return table === "buildings" ? (only.names[String(r.local_id || "").trim()] || only.names[String(r.name || "").trim()]) : only.ids[r.building_id]; });
        }
        extra = extra.filter(function (r) { return matches(r, target.searchParams); }).map(function (r) { var o = Object.assign({}, r); o._shared_reference = true; o._office = "ktop"; return o; });
        if (!extra.length) return response;
        var local = await response.json();
        var seen = {}; local.forEach(function (r) { seen[r.id] = 1; });
        var merged = local.concat(extra.filter(function (r) { return !seen[r.id]; }));
        var order = target.searchParams.get("order");
        if (order) sortRows(merged, order);
        return new Response(JSON.stringify(merged), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      // 쓰기: 케이탑 공유 자료는 읽기 전용
      var only2 = await ktopOnly(network, options.headers);
      if (only2 && only2.res.length) {
        var text = target.search + (typeof options.body === "string" ? options.body : "");
        var hit = only2.res.some(function (r) { return text.indexOf(r.id) >= 0 || text.indexOf(String(r.name || "").trim()) >= 0 || text.indexOf(encodeURIComponent(String(r.name || "").trim())) >= 0; });
        if (hit) throw new Error("케이탑 공유 자료는 읽기 전용입니다. 하이탑 자료는 따로 등록해주세요.");
      }
    } catch (e) { if (e && /읽기 전용/.test(e.message || "")) throw e; console.warn("[케이탑 공유자료] 건너뜀", e); }
    return orig.call(SharedReference, url, options, network);
  };
})();
