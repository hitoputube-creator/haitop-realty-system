/* Original drawings and parcel source lists are read through server-enforced admin RLS. */
(function () {
  'use strict';
  const sourceBlocks = new Set([1,3,4,5,6,7,8,9,11,12,13,18].map(n => 'third-C' + n));
  const pending = new Map();
  let sessionToken = null, epoch = 0;
  function has(blockId) { return sourceBlocks.has(blockId); }
  function clear() { pending.clear(); sessionToken = null; epoch++; }
  async function load(blockId) {
    const {data, error} = await hitopAuthClient.auth.getSession();
    const token = data.session?.access_token;
    if (error || !token) { clear(); throw new Error('로그인 후 원본 자료를 확인해주세요.'); }
    if (sessionToken !== token) { clear(); sessionToken = token; }
    if (!pending.has(blockId)) {
      const run = epoch;
      const promise = fetchWithTimeout(SUPABASE_URL + '/rest/v1/land_block_sources?block_id=eq.' + encodeURIComponent(blockId) + '&select=diagram_svg,source_data', {
        headers: {apikey:SUPABASE_KEY, Authorization:'Bearer ' + token}, cache:'no-store'
      }, 30000).then(async response => {
        if (!response.ok) throw new Error('원본 자료 접근 권한을 확인해주세요.');
        const rows = await response.json();
        if (run !== epoch || sessionToken !== token) throw new Error('로그인 상태가 변경되었습니다. 다시 선택해주세요.');
        if (!rows[0]?.diagram_svg || !Array.isArray(rows[0]?.source_data?.parcels)) throw new Error('이 블럭의 원본 자료가 준비되지 않았습니다.');
        return rows[0];
      }).catch(error => { if (run === epoch && pending.get(blockId) === promise) pending.delete(blockId); throw error; });
      pending.set(blockId, promise);
    }
    return pending.get(blockId);
  }
  hitopAuthClient.auth.onAuthStateChange(event => { if (event === 'SIGNED_OUT') clear(); });
  window.HitopLandBlockSource = {load,clear,has};
})();
