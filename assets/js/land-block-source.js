/* Original drawings and parcel source lists are read through server-enforced admin RLS. */
(function () {
  'use strict';
  let pending = null, sessionToken = null;
  async function load(blockId) {
    const {data, error} = await hitopAuthClient.auth.getSession();
    const token = data.session?.access_token;
    if (error || !token) { clear(); throw new Error('로그인 후 원본 자료를 확인해주세요.'); }
    if (sessionToken !== token) { clear(); sessionToken = token; }
    if (!pending) {
      pending = fetchWithTimeout(SUPABASE_URL + '/rest/v1/land_block_sources?block_id=eq.' + encodeURIComponent(blockId) + '&select=diagram_svg,source_data', {
        headers: {apikey:SUPABASE_KEY, Authorization:'Bearer ' + token}, cache:'no-store'
      }).then(async response => {
        if (!response.ok) throw new Error('원본 자료 접근 권한을 확인해주세요.');
        const rows = await response.json();
        if (!rows[0]?.diagram_svg || !rows[0]?.source_data) throw new Error('원본 자료 접근 권한이 없거나 자료가 준비되지 않았습니다.');
        return rows[0];
      }).catch(error => { pending = null; throw error; });
    }
    return pending;
  }
  function clear() { pending = null; sessionToken = null; }
  hitopAuthClient.auth.onAuthStateChange(event => { if (event === 'SIGNED_OUT') clear(); });
  window.HitopLandBlockSource = {load,clear};
})();
