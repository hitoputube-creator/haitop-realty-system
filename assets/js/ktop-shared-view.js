/* 하이탑 화면: 케이탑에만 있는 분양자료(건물·호실·평면도)를 함께 보여주고, 하이탑 관리자가 수정할 수 있게 한다.
 * 읽기·쓰기 모두 케이탑 공유 함수(shared-office-contacts)를 통하며, 하이탑 관리자 로그인을 서버가 확인한다.
 * 하이탑 자료는 항상 우선이며 바꾸지 않는다. 호실 소유주·연락처 등 안 보이는 항목은 서버가 그대로 보존한다.
 */
(function () {
  if (typeof OfficeConfig === "undefined" || OfficeConfig.id !== "hitop" || typeof SharedReference === "undefined" || window.__ktopSharedView) return;
  window.__ktopSharedView = true;
  var KTOP_BASE = "https://enefadyhmhfphtochlku.supabase.co/functions/v1/shared-office-contacts";
  var KTOP_FN = KTOP_BASE + "?table=";
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


  async function hitopToken() {
    var s = await hitopAuthClient.auth.getSession();
    var tok = s && s.data && s.data.session && s.data.session.access_token;
    if (!tok) throw new Error("로그인이 필요합니다. 다시 로그인해주세요.");
    return tok;
  }
  function headerOf(options, name) {
    var h = options && options.headers; if (!h) return "";
    if (typeof h.get === "function") return h.get(name) || "";
    var k = Object.keys(h).filter(function (x) { return x.toLowerCase() === name.toLowerCase(); })[0];
    return k ? h[k] : "";
  }
  function bodyJson(options) { try { return typeof options.body === "string" ? JSON.parse(options.body) : null; } catch (e) { return null; } }
  function eqVal(params, k) { var v = params.get(k); return v && v.indexOf("eq.") === 0 ? v.slice(3) : ""; }
  async function idSets() {
    var all = await Promise.all(["drive_resources", "buildings", "building_floors", "building_files"].map(ktopRows));
    var s = { res: {}, bld: {}, floor: {}, file: {} };
    all[0].forEach(function (r) { s.res[r.id] = 1; });
    all[1].forEach(function (r) { s.bld[r.id] = 1; });
    all[2].forEach(function (r) { s.floor[r.id] = 1; });
    all[3].forEach(function (r) { s.file[r.id] = 1; });
    return s;
  }
  // 이 쓰기가 케이탑 자료에 대한 것인지 판단 (id는 사무소가 달라도 겹치지 않는다)
  async function isKtopWrite(table, method, params, body, network, headers) {
    var sets = await idSets(), id = eqVal(params, "id");
    if (table === "rpc/reorder_building_floors") return !!(body && sets.res[body.p_building_id]);
    if (table === "drive_resources") return !!(id && sets.res[id]);
    if (table === "building_floors") return !!((id && sets.floor[id]) || (body && sets.res[body.building_id]));
    if (table === "building_files") return !!((id && sets.file[id]) || (body && sets.res[body.building_id]));
    if (table === "buildings") {
      if (id && sets.bld[id]) return true;
      var lid = (body && (body.local_id || body.name)) || eqVal(params, "local_id");
      if (!lid) return false;
      var only = await ktopOnly(network, headers);
      return !!(only && only.names[String(lid).trim()]);
    }
    return false;
  }
  async function proxyWrite(method, table, target, options) {
    var tok = await hitopToken();
    var res = await fetch(KTOP_BASE + "?action=write", {
      method: "POST",
      headers: { apikey: KTOP_KEY, Authorization: "Bearer " + tok, "Content-Type": "application/json" },
      body: JSON.stringify({ method: method, table: table, query: target.search.replace(/^\?/, ""), body: bodyJson(options), prefer: headerOf(options, "Prefer") }),
      signal: AbortSignal.timeout(40000)
    });
    var j = null; try { j = await res.json(); } catch (e) {}
    if (!res.ok || !j || j.error) throw new Error((j && j.error) || "케이탑 자료 저장에 실패했습니다. (" + res.status + ")");
    cache = {};
    var st = Number(j.status) || 200, txt = j.body || "";
    return new Response(st === 204 || st === 205 || !txt ? null : txt, { status: st, headers: { "Content-Type": "application/json" } });
  }
  // 케이탑 건물의 평면도·자료 파일은 케이탑 저장소에 올린다 (하이탑 저장소에 올리면 케이탑에서 못 연다)
  async function uploadToKtop(file, folder, bid) {
    var tok = await hitopToken();
    var kind = folder === "haitop/floors" ? "floors" : folder === "haitop/files" ? "files" : "";
    if (!kind) throw new Error("지원하지 않는 자료 구분입니다.");
    if (file.size > 20 * 1024 * 1024) throw new Error("파일은 20MB 이하로 올려주세요.");
    var fd = new FormData(); fd.append("file", file); fd.append("buildingId", bid); fd.append("kind", kind);
    var res = await fetch(KTOP_BASE + "?action=upload", { method: "POST", headers: { apikey: KTOP_KEY, Authorization: "Bearer " + tok }, body: fd, signal: AbortSignal.timeout(90000) });
    var j = null; try { j = await res.json(); } catch (e) {}
    if (!res.ok || !j || !j.url) throw new Error((j && j.error) || "파일 올리기에 실패했습니다. (" + res.status + ")");
    return j.url;
  }
  function wrapUpload() {
    if (typeof window.cloudinaryUpload !== "function" || window.cloudinaryUpload.__ktopWrapped) return;
    var base = window.cloudinaryUpload;
    var wrapped = async function (file, folder) {
      var bid = typeof buildingId !== "undefined" ? buildingId : new URLSearchParams(location.search).get("id");
      var rows = bid ? await ktopRows("drive_resources") : [];
      if (!rows.some(function (r) { return r.id === bid; })) return base.apply(this, arguments);
      return uploadToKtop(file, folder, bid);
    };
    wrapped.__ktopWrapped = true;
    window.cloudinaryUpload = wrapped;
  }
  if (document.readyState === "complete") wrapUpload(); else window.addEventListener("load", wrapUpload);

  var orig = SharedReference.request;
  SharedReference.request = async function (url, options, network) {
    try {
      var target = new URL(url, location.href);
      var table = target.origin === SUPABASE_URL && target.pathname.indexOf("/rest/v1/") === 0 ? target.pathname.slice(9) : "";
      options = options || {};
      var method = (options.method || "GET").toUpperCase();
      if (table === "rpc/reorder_building_floors" && method === "POST") {
        var rb = bodyJson(options);
        if (rb && await isKtopWrite("rpc/reorder_building_floors", method, target.searchParams, rb, network, options.headers)) return proxyWrite(method, "rpc/reorder_building_floors", target, options);
        return orig.call(SharedReference, url, options, network);
      }
      if (!TABLES[table]) return orig.call(SharedReference, url, options, network);
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
      // 쓰기: 케이탑 자료는 케이탑 공유 함수로 보낸다 (하이탑 로그인 확인 + 안 보이는 항목 보존)
      var wbody = bodyJson(options);
      if (await isKtopWrite(table, method, target.searchParams, wbody, network, options.headers)) return proxyWrite(method, table, target, options);
      var only2 = await ktopOnly(network, options.headers);
      if (only2 && only2.res.length) {
        var text = target.search + (typeof options.body === "string" ? options.body : "");
        var hit = only2.res.some(function (r) { return text.indexOf(r.id) >= 0; });
        if (hit) { var he = new Error("케이탑 자료의 이 항목은 하이탑 화면에서 저장할 수 없습니다."); he.__ktopWrite = true; throw he; }
      }
    } catch (e) { if (e && e.__ktopWrite) throw e; console.warn("[케이탑 공유자료] 건너뜀", e); }
    return orig.call(SharedReference, url, options, network);
  };
})();
