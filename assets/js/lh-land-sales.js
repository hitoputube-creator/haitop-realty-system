/* LH 용지 분양 기록 화면. 자료는 lh-land-sales-data.js (정적), 건물 연결은 상가 자료관리(drive_resources)의 "주소:" 지번으로 맞춤. */
(function () {
  'use strict';
  var DATA = window.LH_LAND_SALES || { notices: {}, parcels: [] };
  var N = DATA.notices, P = DATA.parcels;
  var IMG_BASE = 'assets/images/land/';
  var GEO_KEY = 'lhs_geo_v1';
  var st = { d: '', u: '', sub: '', b: false, bid: false, q: '' }, open = null, curList = [];
  var bMap = {}, G = loadGeo(), map = null, overlays = [];
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function grp(u) { return /상업/.test(u) ? '상업' : /근린생활/.test(u) ? '근생' : '업무'; }
  function won(n) { if (!n) return ''; var e = Math.floor(n / 1e8), m = Math.round(n % 1e8 / 1e4); return (e ? e.toLocaleString('ko-KR') + '억 ' : '') + (m ? m.toLocaleString('ko-KR') + '만' : ''); }
  function loadGeo() { try { return JSON.parse(localStorage.getItem(GEO_KEY) || '{}') || {}; } catch (e) { return {}; } }
  function saveGeo() { try { localStorage.setItem(GEO_KEY, JSON.stringify(G)); } catch (e) {} }
  function jibunKey(addr) { var m = String(addr || '').match(/([가-힣]+동)\s*(\d+(?:-\d+)?)/); return m ? m[1] + ' ' + m[2].replace(/-0$/, '') : ''; }
  function memoField(memo, label) { var ls = String(memo || '').split('\n'); for (var i = 0; i < ls.length; i++) { var c = ls[i].indexOf(':'); if (c > 0 && ls[i].slice(0, c).trim() === label) return ls[i].slice(c + 1).trim(); } return ''; }
  function bldOf(p) { return bMap[p.k] || []; }
  function lastH(p) { return p.h[p.h.length - 1]; }

  function filtered() {
    var q = st.q.trim().replace(/\s+/g, ' ');
    return P.filter(function (p) {
      if (st.d && p.d !== st.d) return false;
      if (st.u && grp(p.u) !== st.u) return false;
      if (st.sub && p.u !== st.sub) return false;
      if (st.b && !bldOf(p).length) return false;
      if (st.bid && !p.bp) return false;
      if (q && (p.k + ' ' + p.u + ' ' + bldOf(p).map(function (b) { return b.name; }).join(' ')).indexOf(q) < 0) return false;
      return true;
    }).sort(function (a, b) { return a.h[0][0] < b.h[0][0] ? 1 : a.h[0][0] > b.h[0][0] ? -1 : 0; });
  }

  function noticeDistricts(t) { var s = String(t || ''), out = []; if (/운정3/.test(s)) out.push('운정3'); if (/운정(?!3)|운정신도시|운정지구/.test(s.replace(/운정3/g, ''))) out.push('운정'); return out; }
  function nearestImgNotice(p) {
    var base = Date.parse(lastH(p)[0].replace(/\./g, '-')), best = null, bestD = Infinity;
    var word = /중심상업/.test(p.u) ? '중심상업' : /일반상업/.test(p.u) ? '일반상업' : /근린상업/.test(p.u) ? '근린상업' : grp(p.u) === '근생' ? '근린생활' : '업무';
    Object.keys(N).forEach(function (id) {
      var n = N[id]; if (!n.imgs || !n.imgs.length || noticeDistricts(n.t).indexOf(p.d) < 0) return;
      var d = Math.abs(Date.parse(String(n.dt).replace(/\./g, '-')) - base) + (String(n.t).indexOf(word) >= 0 ? 0 : 1e13);
      if (d < bestD) { bestD = d; best = id; }
    });
    return best;
  }
  function locHtml(p) {
    var h = '<div class="lhs-loc">';
    var nid = null;
    for (var i = p.h.length - 1; i >= 0; i--) { var n = N[p.h[i][1]]; if (n && n.imgs && n.imgs.length) { nid = p.h[i][1]; break; } }
    if (nid) {
      h += '<div class="lbl">LH 위치도 (' + esc(N[nid].dt) + ' 공고 첨부)</div><div class="lhs-thumbs">';
      N[nid].imgs.forEach(function (f, i) { h += '<img loading="lazy" src="' + IMG_BASE + esc(f) + '" alt="LH 위치도 ' + (i + 1) + '" data-zoom="' + esc(nid) + '" data-idx="' + i + '">'; });
      h += '</div>';
    } else {
      var ref = nearestImgNotice(p);
      if (ref) {
        h += '<div class="lbl">이 필지 공고에는 위치도 그림이 없어서, 같은 지구의 가까운 공고(' + esc(N[ref].dt) + ') 위치도를 보여 드려요.</div><div class="lhs-thumbs">';
        N[ref].imgs.forEach(function (f, i) { h += '<img loading="lazy" src="' + IMG_BASE + esc(f) + '" alt="LH 위치도 ' + (i + 1) + '" data-zoom="' + esc(ref) + '" data-idx="' + i + '">'; });
        h += '</div>';
      } else h += '<div class="lhs-none">이 필지 공고에는 위치도 그림이 첨부되어 있지 않아요.</div>';
    }
    h += '<div class="lhs-files">';
    if (G[p.k]) h += '<button type="button" class="lhs-btn primary" data-focus="' + esc(p.k) + '">지도에서 위치 보기</button>';
    else if (G[p.k] === 0) h += '<span class="lhs-warn">아직 정식 지번이 아니라 카카오 지도에서 못 찾아요. LH 위치도로 확인하세요.</span>';
    h += '</div></div>';
    return h;
  }

  function draw() {
    var L = filtered(); curList = L;
    $('lhsSum').innerHTML = '필지 <b>' + L.length + '</b>개 · 낙찰가 확인 <b>' + L.filter(function (p) { return p.bp; }).length + '</b>개 · 건물 연결 <b>' + L.filter(function (p) { return bldOf(p).length; }).length + '</b>개';
    var html = '';
    L.forEach(function (p) {
      var last = lastH(p), py = p.a * 0.3025, g = grp(p.u), bl = bldOf(p);
      html += '<tr class="lhs-row' + (open === p.k ? ' open' : '') + '" data-k="' + esc(p.k) + '">' +
        '<td>' + (p.d === '운정3' ? '운정3' : '운정') + '</td>' +
        '<td><span class="lhs-tag ' + g + '">' + esc(p.u) + '</span></td>' +
        '<td><b>' + esc(p.k) + '</b></td>' +
        '<td class="num">' + p.a.toLocaleString('ko-KR') + '㎡<br><span class="lhs-none">' + Math.round(py).toLocaleString('ko-KR') + '평</span></td>' +
        '<td>' + esc(p.h[0][0]) + '</td>' +
        '<td class="num">' + won(last[2]) + '</td>' +
        '<td class="num">' + (last[2] && py ? Math.round(last[2] / py / 1e4).toLocaleString('ko-KR') + '만' : '') + '</td>' +
        '<td><span class="lhs-cnt' + (p.h.length > 2 ? ' many' : '') + '">' + p.h.length + '회</span></td>' +
        '<td class="num">' + (p.bp ? '<span class="lhs-bid">' + won(p.bp) + '</span>' : '<span class="lhs-none">미확인</span>') + '</td>' +
        '<td class="num">' + (p.bp && last[2] ? (p.bp / last[2] * 100).toFixed(1) + '%' : '') + '</td>' +
        '<td class="lhs-bld">' + (bl.length ? bl.map(function (b) { return '<a href="' + esc(b.url) + '" title="' + esc(b.cat) + ' 자료 열기">' + esc(b.name) + '</a>'; }).join(', ') : '<span class="lhs-none">-</span>') + '</td>' +
        '<td>' + (G[p.k] ? '<span class="lhs-tag">지도</span>' : (G[p.k] === 0 ? '<span class="lhs-none">예정지번</span>' : '')) + '</td></tr>';
      if (open === p.k) {
        var h = '<div class="lhs-hist"><div class="h">공고일</div><div class="h">공고</div><div class="h" style="text-align:right">예정가</div>';
        p.h.forEach(function (x) { var n = N[x[1]] || {}; h += '<div>' + esc(x[0]) + '</div><div><a href="' + esc(n.url) + '" target="_blank" rel="noopener noreferrer">' + esc(n.t || x[1]) + '</a></div><div style="text-align:right">' + won(x[2]) + '</div>'; });
        if (p.bp) h += '<div class="lhs-bid">낙찰</div><div>' + esc(p.bs || '') + (p.br ? ' · 경쟁률 ' + esc(p.br) : '') + '</div><div class="lhs-bid" style="text-align:right">' + won(p.bp) + '</div>';
        h += '</div>';
        var fl = (N[last[1]] || {}).files || [];
        if (fl.length) h += '<div class="lhs-files"><span class="lhs-none">도면 파일 (' + esc(last[0]) + ' 공고):</span>' + fl.map(function (f) { return '<a href="' + esc(f.u) + '" target="_blank" rel="noopener noreferrer">' + esc(f.n) + '</a>'; }).join('') + '</div>';
        h += locHtml(p);
        html += '<tr class="lhs-detail"><td colspan="12">' + h + '</td></tr>';
      }
    });
    $('lhsBody').innerHTML = html || '<tr><td colspan="12" class="lhs-none" style="padding:18px">조건에 맞는 필지가 없습니다.</td></tr>';
    drawPins();
  }

  function zoom(nid, idx) {
    var imgs = (N[nid] || {}).imgs || []; if (!imgs.length) return;
    var z = document.createElement('div'); z.className = 'lhs-zoom';
    function show() { z.innerHTML = '<img src="' + IMG_BASE + esc(imgs[idx]) + '" alt="LH 위치도">' + (imgs.length > 1 ? '<button class="nav prev" type="button" aria-label="이전">‹</button><button class="nav next" type="button" aria-label="다음">›</button>' : ''); }
    show();
    z.addEventListener('click', function (e) {
      if (e.target.classList.contains('prev')) { idx = (idx - 1 + imgs.length) % imgs.length; show(); return; }
      if (e.target.classList.contains('next')) { idx = (idx + 1) % imgs.length; show(); return; }
      z.remove(); document.removeEventListener('keydown', onKey);
    });
    function onKey(e) { if (e.key === 'Escape') { z.remove(); document.removeEventListener('keydown', onKey); } }
    document.addEventListener('keydown', onKey);
    document.body.appendChild(z);
  }

  function focusPin(k) {
    if (!map || !G[k]) return;
    map.setLevel(3); map.setCenter(new kakao.maps.LatLng(G[k][0], G[k][1]));
    $('lhsMap').scrollIntoView({ block: 'center', behavior: 'smooth' });
    drawPins();
  }

  function drawPins() {
    if (!map) return;
    overlays.forEach(function (o) { o.setMap(null); }); overlays = [];
    curList.forEach(function (p) {
      var g = G[p.k]; if (!g) return;
      var el = document.createElement('div'); el.className = 'lhs-pin ' + grp(p.u) + (open === p.k ? ' sel' : ''); el.title = p.k + ' · ' + p.u;
      el.addEventListener('click', function () {
        open = p.k; draw();
        setTimeout(function () { var r = document.querySelector('tr.lhs-row.open'); if (r) r.scrollIntoView({ block: 'center', behavior: 'smooth' }); }, 30);
      });
      var o = new kakao.maps.CustomOverlay({ position: new kakao.maps.LatLng(g[0], g[1]), content: el, zIndex: open === p.k ? 5 : 2 });
      o.setMap(map); overlays.push(o);
      if (open === p.k) {
        var lb = document.createElement('div'); lb.className = 'lhs-pinlabel';
        var bl = bldOf(p); lb.textContent = p.k + ' · ' + p.u + (bl.length ? ' · ' + bl[0].name : '');
        var o2 = new kakao.maps.CustomOverlay({ position: new kakao.maps.LatLng(g[0], g[1]), content: lb, zIndex: 6 });
        o2.setMap(map); overlays.push(o2);
      }
    });
  }

  function initMap() {
    var key = window.HITOP_KAKAO_JS_KEY;
    if (!key) { $('lhsGeo').textContent = '카카오 지도 키가 없습니다'; return; }
    var s = document.createElement('script');
    s.src = 'https://dapi.kakao.com/v2/maps/sdk.js?appkey=' + encodeURIComponent(key) + '&libraries=services&autoload=false';
    s.onload = function () {
      kakao.maps.load(async function () {
        map = new kakao.maps.Map($('lhsMap'), { center: new kakao.maps.LatLng(37.72, 126.75), level: 6 });
        map.addControl(new kakao.maps.ZoomControl(), kakao.maps.ControlPosition.RIGHT);
        var gc = new kakao.maps.services.Geocoder();
        var todo = P.filter(function (p) { return G[p.k] === undefined; });
        for (var i = 0; i < todo.length; i++) {
          var p = todo[i];
          await new Promise(function (resolve) {
            gc.addressSearch('경기 파주시 ' + p.k, function (res, status) {
              if (status === kakao.maps.services.Status.OK && res[0]) G[p.k] = [Number(res[0].y), Number(res[0].x)];
              else if (status === kakao.maps.services.Status.ZERO_RESULT) G[p.k] = 0;
              resolve();
            });
          });
        }
        saveGeo();
        var ok = P.filter(function (p) { return G[p.k]; }).length;
        $('lhsGeo').textContent = '지도 표시 ' + ok + '개 · 예정지번 ' + (P.length - ok) + '개';
        draw();
      });
    };
    document.head.appendChild(s);
  }

  async function loadBuildings() {
    try {
      var rows = await getDriveResources();
      var list = (window.HitopResourceRooms ? HitopResourceRooms.visible(rows, 'commercial') : rows) || [];
      list.forEach(function (r) {
        var k = jibunKey(memoField(r.memo, '주소')); if (!k) return;
        var url = window.HitopResourceRooms ? HitopResourceRooms.detailUrl('building-detail.html', r.id, 'commercial') : 'building-detail.html?id=' + encodeURIComponent(r.id);
        var arr = bMap[k] || (bMap[k] = []);
        if (!arr.some(function (b) { return b.name === r.name; })) arr.push({ id: r.id, name: r.name, cat: r.category || '', url: url });
      });
    } catch (e) { console.warn('건물 자료를 불러오지 못했습니다', e); }
  }

  function bind() {
    function updateSub() {
      var sel = $('pickSub');
      sel.replaceChildren(new Option(st.u ? '세부 전체' : '구분1 먼저 선택', ''));
      sel.disabled = !st.u;
      if (!st.u) return;
      var types = Array.from(new Set(P.filter(function(p) { return grp(p.u) === st.u; }).map(function(p) { return p.u; })));
      types.sort(function(a,b) { return a.localeCompare(b, 'ko'); }).forEach(function(type) { sel.add(new Option(type, type)); });
    }
    $('pickD').addEventListener('change', function() { st.d = this.value; draw(); });
    $('pickU').addEventListener('change', function() { st.u = this.value; st.sub = ''; updateSub(); draw(); });
    $('pickSub').addEventListener('change', function() { st.sub = this.value; draw(); });
    updateSub();
    $('onlyB').addEventListener('change', function (e) { st.b = e.target.checked; draw(); });
    $('onlyBid').addEventListener('change', function (e) { st.bid = e.target.checked; draw(); });
    $('lhsQ').addEventListener('input', function (e) { st.q = e.target.value; draw(); });
    $('lhsBody').addEventListener('click', function (e) {
      if (e.target.closest('a')) return;
      var z = e.target.closest('[data-zoom]'); if (z) { zoom(z.dataset.zoom, Number(z.dataset.idx) || 0); return; }
      var f = e.target.closest('[data-focus]'); if (f) { focusPin(f.dataset.focus); return; }
      var r = e.target.closest('tr.lhs-row'); if (!r) return;
      open = open === r.dataset.k ? null : r.dataset.k; draw();
    });
  }

  async function start() {
    bind();
    var s = await hitopAuthClient.auth.getSession();
    if (s.error || !s.data.session) { hitopRedirectToLogin(); return; }
    hitopApplyAuthHeader(s.data.session);
    draw();
    initMap();
    await loadBuildings();
    draw();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
