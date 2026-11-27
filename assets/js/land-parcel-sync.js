/* 택지 위치도 필지 자료 공유 (케이탑 화면 전용)
   하이탑 기준으로 건물 유무·건물 정보·소유 구분·지번·면적·금액 자료를 양쪽이 같이 보게 한다.
   - 읽기: 하이탑 자료가 더 최근이면 하이탑 값을 보여 준다.
   - 쓰기: 하이탑 관리자가 케이탑 화면에서 저장한 자료만 하이탑에도 저장한다(케이탑 계정은 하이탑 자료를 고칠 수 없음).
   소유주·연락처·메모는 공유하지 않는다. 하이탑 화면은 하이탑 DB에 직접 저장하므로 아무 일도 하지 않는다. */
(function () {
  'use strict';
  if (typeof OfficeConfig === 'undefined' || OfficeConfig.id !== 'ktop' || typeof SharedReference === 'undefined') return;
  var URL_ = 'https://xaxbkdnrzsghsabkdvzj.supabase.co/functions/v1/shared-parcel-sync';
  var KEY = 'sb_publishable_gqNFRMHb6yYKvqFnQurPKQ_7gGhURVd';
  var FIELDS = ["address","addressSource","addressCheckedAt","area","landType","building","households","unsold","supplyPrice","auctionPrice","salePrice","buildingDeposit","buildingRent","buildingName","buildingPurpose","buildingFloors","buildingStructure","buildingApproval","buildingFootprint","buildingTotalArea","buildingCheck","buildingCheckAttempt","buildingSnapshot","ownershipCheck","ownershipCheckAttempt","ownershipSnapshot","mapPositionUnavailable"];
  var original = SharedReference.request;
  var cache = null, queue = new Map(), timer = null, flushing = Promise.resolve();

  function k(r) { return r.block_id + '|' + r.subblock + '|' + r.parcel; }
  function t(v) { var n = Date.parse(v || ''); return isFinite(n) ? n : 0; }
  function has(o, f) { return Object.prototype.hasOwnProperty.call(o || {}, f); }
  function isParcels(url) {
    try { var u = new URL(url, location.href); return u.origin === SUPABASE_URL && u.pathname === '/rest/v1/land_parcels'; } catch (e) { return false; }
  }
  async function call(body) {
    var s = await hitopAuthClient.auth.getSession();
    if (!s.data || !s.data.session) throw new Error('로그인이 필요합니다.');
    var res = await fetch(URL_, {
      method: 'POST', signal: AbortSignal.timeout(60000),
      headers: { apikey: KEY, Authorization: 'Bearer ' + KEY, 'x-ktop-token': s.data.session.access_token, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!res.ok) { var err = new Error('하이탑 공유 서버 응답 ' + res.status); err.status = res.status; throw err; }
    return res.json();
  }
  function shared() {
    if (cache && Date.now() - cache.time < 30000) return cache.promise;
    var promise = call({ action: 'read' }).then(function (rows) { return new Map(rows.map(function (r) { return [k(r), r]; })); })
      .catch(function (e) { cache = null; throw e; });
    cache = { time: Date.now(), promise: promise };
    return promise;
  }
  function notify(message) {
    try { if (typeof showToast === 'function') showToast(message, 7000); else console.warn(message); } catch (e) { console.warn(message); }
  }
  function flush() {
    timer = null;
    var items = Array.from(queue.values()); queue = new Map();
    if (!items.length) return;
    flushing = flushing.then(async function () {
      try {
        for (var i = 0; i < items.length; i += 300) await call({ action: 'write', parcels: items.slice(i, i + 300) });
        cache = null;
      } catch (e) {
        // 하이탑 자료는 하이탑 관리자만 고칠 수 있다. 케이탑 계정의 저장은 케이탑에만 남고 하이탑에는 반영하지 않는다.
        if (e && e.status === 403) { console.info('하이탑 자료는 하이탑 관리자만 수정할 수 있어 하이탑 공유를 건너뜁니다.'); return; }
        console.warn('하이탑 자료 공유 실패', e);
        notify('하이탑에 자료를 공유하지 못했어요. 잠시 후 같은 작업을 다시 해 주세요.');
      }
    });
  }
  function mirror(rows) {
    rows.forEach(function (r) {
      if (!r || r.block_id == null || r.subblock == null || r.parcel == null) return;
      var data = {};
      FIELDS.forEach(function (f) { if (has(r.data, f)) data[f] = r.data[f]; });
      queue.set(k(r), { block_id: r.block_id, subblock: r.subblock, parcel: r.parcel, x: r.x, y: r.y, data: data });
    });
    if (timer) clearTimeout(timer);
    timer = setTimeout(flush, 800);
  }

  SharedReference.request = async function (url, options, network) {
    var method = String((options && options.method) || 'GET').toUpperCase();
    var res = await original.call(SharedReference, url, options, network);
    if (!res.ok || !isParcels(url)) return res;
    if (method === 'GET') {
      try {
        var results = await Promise.all([res.clone().json(), shared()]);
        var rows = results[0], map = results[1];
        if (!Array.isArray(rows)) return res;
        var out = rows.map(function (row) {
          var src = map.get(k(row));
          if (!src) return row;
          var data = Object.assign({}, row.data || {});
          var sharedNewer = t(src.updated_at) >= t(row.updated_at);
          FIELDS.forEach(function (f) {
            if (!has(src.data, f)) return;
            if (sharedNewer || data[f] === undefined) data[f] = src.data[f];
          });
          return Object.assign({}, row, { data: data });
        });
        return new Response(JSON.stringify(out), { status: 200, headers: { 'Content-Type': 'application/json' } });
      } catch (e) { return res; }
    }
    if (method === 'POST' || method === 'PATCH') {
      try { var saved = await res.clone().json(); if (Array.isArray(saved) && saved.length) mirror(saved); } catch (e) { /* 저장 결과를 읽지 못하면 공유만 건너뜁니다 */ }
    }
    return res;
  };
})();
