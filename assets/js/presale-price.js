/* 분양권 가격 자동 입력 (분양 공급금액표 기준)
 * - 동·호수를 넣으면 타입·면적·기본 분양가·계약금(5%)·중도금(60%, 6회)을 자동으로 채운다.
 * - 발코니 확장을 고르면 타입별 확장 공사비를 넣고, 별도 추가 옵션비는 직접 입력하면 총 공급가액이 자동 계산된다.
 * - 등록·수정 화면 공통. 사용자가 직접 고친 칸은 다시 덮어쓰지 않는다. 금액 단위는 만원.
 * 자료: 운정 아이파크 포레스트 공급금액 및 납부일정표 / 발코니 확장 공사비표 (2026-11 안내 자료)
 */
(function () {
  if (window.PresalePrice) return;
  const G = (a, b, c, d, e, f) => [[1, 1, a], [2, 2, b], [3, 5, c], [6, 10, d], [11, 20, e], [21, 99, f]];
  const ALL = [1, 99];
  const COMPLEXES = [{
    key: '아이파크포레스트',
    label: '아이파크 포레스트',
    deposit: 0.05, mid: 0.6, midCount: 6, balconyDeposit: 0.1,
    blocks: [
      { t: '63', lines: [[204, [1, 2]], [205, [1, 2]], [211, [1, 2]], [220, [1, 2, 3, 4]]], p: G(42230, 43680, 45130, 46100, 47060, 48520) },
      { t: '74', lines: [[206, [3]], [207, [1, 2]], [208, [1, 2]], [217, [1, 2]], [218, [1, 2]], [219, [1, 2]]], p: G(50010, 51730, 53440, 54590, 55730, 57450) },
      { t: '84A', lines: [[202, [1, 2, 3]], [203, [1, 2, 3]], [204, [3]], [205, [3]], [207, [3, 5, 6]], [208, [3]], [209, [1, 2, 3]], [210, [1, 2, 3]], [211, [4, 5, 6]], [212, [1, 2, 3]], [214, [1, 2, 3]], [215, [1, 2, 3, 5]], [216, [1, 2, 3, 5]], [217, [3, 5]], [218, [4]], [219, [3, 5]], [222, [1, 3]], [223, [1, 3, 4, 5]], [224, [1, 3]], [225, [1, 3]]], p: G(56910, 58870, 60820, 62120, 63430, 65380) },
      { t: '84B', lines: [[202, [4]], [204, [4]], [205, [4]], [206, [4]], [210, [4]], [211, [3]], [212, [4]], [213, [3], 2, 10], [215, [4]], [216, [4]], [219, [4]], [224, [2]]], p: G(56490, 58430, 60370, 61660, 62950, 64890) },
      { t: '84B', lines: [[213, [3], 11, 99]], p: [[11, 20, 64890], [21, 99, 66890]] },
      { t: '84C', lines: [[203, [4]], [207, [4]], [208, [4]], [209, [4]], [214, [4]], [217, [4]], [218, [3]], [222, [2]], [223, [2]], [225, [2]]], p: G(57680, 59660, 61640, 62960, 64280, 66260) },
      { t: '99', lines: [[206, [1, 2]], [208, [5, 6]], [209, [5, 6]], [212, [5], 2, 10], [212, [6], 1, 10], [221, [1, 2, 3, 4]], [222, [4, 5]], [224, [4, 5]]], p: G(66510, 68790, 71080, 72600, 74120, 76410) },
      { t: '99', lines: [[212, [5, 6], 11, 99]], p: [[11, 20, 76410], [21, 99, 78760]] },
      { t: '113', lines: [[201, [1], 1, 10], [201, [2], 2, 10], [202, [5], 2, 10], [202, [6], 1, 10], [203, [5, 6]], [204, [5, 6]], [205, [5, 6]], [206, [5, 6]], [210, [5, 6]], [213, [1, 2]], [213, [4], 2, 10], [214, [5, 6]]], p: G(77410, 80070, 82730, 84500, 86270, 88930) },
      { t: '113', lines: [[201, [1, 2], 11, 99], [202, [5, 6], 11, 99], [213, [4], 11, 99]], p: [[11, 20, 88930], [21, 99, 91660]] },
      { t: '152-P', lines: [[211, [6], 29, 29]], p: [[21, 99, 139770]] },
      { t: '171-P', lines: [[212, [6], 29, 29], [221, [4], 28, 28], [224, [5], 29, 29]], p: [[21, 99, 156430]] },
      { t: '192-P', lines: [[214, [5], 29, 29]], p: [[21, 99, 179200]] },
      { t: '197-P', lines: [[210, [5], 26, 26], [213, [2], 29, 29]], p: [[21, 99, 182860]] }
    ],
    balcony: { '63': 1300, '74': 1500, '84A': 1700, '84B': 1700, '84C': 1700, '99': 2000, '113': 2300, '152-P': 3100, '171-P': 3400, '192-P': 3900, '197-P': 4000 },
    areas: {
      '84A': [109.7726, 84.5227], '84B': [111.1943, 84.8855], '84C': [112.3254, 84.989],
      '99': [128.3033, 99.3062], '113': [147.8026, 113.6508]
    }
  }];
  const digits = v => { const m = String(v == null ? '' : v).match(/\d+/); return m ? Number(m[0]) : NaN; };
  const norm = s => String(s || '').replace(/\s+/g, '');
  function findComplex(name) { const n = norm(name); return COMPLEXES.find(c => n.includes(c.key)) || null; }
  function lookup(complex, dong, ho) {
    const d = digits(dong), h = digits(ho);
    if (!Number.isFinite(d) || !Number.isFinite(h) || h < 100) return null;
    const floor = Math.floor(h / 100), line = h % 100;
    let best = null;
    for (const b of complex.blocks) {
      for (const ln of b.lines) {
        if (ln[0] !== d || ln[1].indexOf(line) < 0) continue;
        const f0 = ln[2] || ALL[0], f1 = ln[3] || ALL[1];
        if (floor < f0 || floor > f1) continue;
        const grp = b.p.find(g => floor >= g[0] && floor <= g[1]);
        if (!grp) continue;
        const span = f1 - f0;
        if (!best || span < best.span) best = { type: b.t, floor, line, price: grp[2], span };
      }
    }
    if (!best) return null;
    best.balcony = complex.balcony[best.type] || 0;
    best.area = complex.areas[best.type] || null;
    return best;
  }
  const fmt = n => Number(n).toLocaleString('ko-KR');
  const r2 = n => Math.round(n * 100) / 100;
  function attach(prefix) {
    const host = document.getElementById(prefix + 'apartmentListingForm');
    if (!host || host.dataset.ppReady) return;
    const $ = id => document.getElementById(prefix + 'apt_' + id);
    if (!$('발코니확장') || !$('발코니확장비') || !$('추가옵션비')) return;
    host.dataset.ppReady = '1';
    const auto = {};
    const ids = ['타입', '평형', '분양_m2', '분양_평', '전용_m2', '전용_평', '분양가', '발코니확장비', '계약금', '중도금총액'];
    ids.forEach(id => { const el = $(id); if (el) el.addEventListener('input', e => { if (e.isTrusted) delete auto[id]; }); });
    const status = text => { if (host._autoStatus) host._autoStatus.textContent = text || ''; };
    function put(id, val, force) {
      const el = $(id); if (!el) return;
      if (force || el.value === '' || auto[id]) { el.value = val; auto[id] = true; el.dispatchEvent(new Event('input', { bubbles: true })); }
    }
    function run() {
      if (!$('권리구분') || $('권리구분').value !== '분양권') return;
      const cx = findComplex($('아파트명').value);
      if (!cx) return;
      if (!$('동').value.trim() || !$('호수').value.trim()) return;
      const r = lookup(cx, $('동').value, $('호수').value);
      if (!r) { status('공급금액표에 없는 동·호수입니다. 동·호수를 다시 확인해 주세요.'); return; }
      const ext = $('발코니확장').value === '확장';
      put('타입', r.type);
      if (r.area) {
        const py = m2 => (m2 / (400 / 121)).toFixed(2);
        put('분양_m2', r.area[0]); put('분양_평', py(r.area[0])); put('평형', py(r.area[0]) + '평');
        put('전용_m2', r.area[1]); put('전용_평', py(r.area[1]));
      } else {
        // 면적 자료가 없는 타입이면 앞에서 자동으로 넣은 면적을 비운다.
        ['분양_m2', '분양_평', '평형', '전용_m2', '전용_평'].forEach(id => { const el = $(id); if (el && auto[id]) { el.value = ''; delete auto[id]; el.dispatchEvent(new Event('input', { bubbles: true })); } });
      }
      put('분양가', r.price);
      put('발코니확장비', ext ? r.balcony : '', true);
      put('계약금', r2(r.price * cx.deposit + (ext ? r.balcony * cx.balconyDeposit : 0)));
      put('중도금총액', r2(r.price * cx.mid));
      const cnt = $('중도금회차');
      if (cnt && !cnt.value) { cnt.value = String(cx.midCount); cnt.dispatchEvent(new Event('change', { bubbles: true })); }
      if (host._calcPresale) host._calcPresale();
      status('🏢 ' + cx.label + ' ' + r.type + '타입 · ' + r.floor + '층 · 공급금액 ' + fmt(r.price * 10000) + '원' + (ext ? ' · 발코니 확장 ' + fmt(r.balcony * 10000) + '원' : '') + ' (공급금액표 기준)');
    }
    let timer = null;
    const later = () => { clearTimeout(timer); timer = setTimeout(run, 350); };
    ['동', '호수'].forEach(id => $(id).addEventListener('input', later));
    $('발코니확장').addEventListener('change', run);
    $('권리구분').addEventListener('change', later);
    ['aptPickName', 'aptPickVillage'].forEach(id => { const el = document.getElementById(prefix + id); if (el) el.addEventListener('change', () => setTimeout(run, 600)); });
  }
  window.PresalePrice = { lookup, findComplex: n => findComplex(n), attach, complexes: COMPLEXES };
  function init() { attach(''); attach('edit_'); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
