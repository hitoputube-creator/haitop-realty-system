(function (root) {
  'use strict';
  const statuses = ['확인 필요', '입주완료', '공사중', '입주예정'];
  function validate(rows) {
    if (!Array.isArray(rows) || rows.length > 500) throw new Error('단지 목록을 확인해주세요.');
    const ids = new Set();
    rows.forEach(r => {
      if (!r.id || ids.has(r.id)) throw new Error('중복된 단지가 있습니다.');
      ids.add(r.id);
      if (!String(r.name || '').trim() || r.name.length > 150) throw new Error('아파트명을 입력해주세요.');
      if (!Number.isInteger(r.households) || r.households < 1 || r.households > 100000) throw new Error(r.name + ': 총 세대수를 확인해주세요.');
      if (!statuses.includes(r.status)) throw new Error('상태를 확인해주세요.');
      if (!(Number.isFinite(r.x) && Number.isFinite(r.y) && r.x >= 0 && r.x <= 1 && r.y >= 0 && r.y <= 1)) throw new Error(r.name + ': 지도 위치를 지정해주세요.');
      if (!/^https?:\/\//i.test(r.source_url || '') || !/^\d{4}-\d{2}-\d{2}$/.test(r.checked_on || '')) throw new Error(r.name + ': 출처와 확인일을 입력해주세요.');
    });
    return rows;
  }
  function merge(saved, incoming) {
    const lookup = new Map(incoming.map(r => [r.id, r]));
    return saved.map(old => {
      const next = lookup.get(old.id);
      // Keep the established location and manually verified occupancy status.
      return next ? {...old, name:next.name, households:next.households, address:next.address,
        approval_date:next.approval_date, source_url:next.source_url, checked_on:next.checked_on} : {...old};
    });
  }
  function changes(before, after) {
    const old = new Map(before.map(r => [r.id, r]));
    return after.filter(r => !old.has(r.id) || JSON.stringify(old.get(r.id)) !== JSON.stringify(r));
  }
  root.HitopApartmentCore = {validate, merge, changes, statuses};
})(typeof window === 'undefined' ? globalThis : window);
