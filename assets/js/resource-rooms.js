(function () {
  'use strict';
  const residentialCategories = new Set(['오피스텔', '힐스테이트더운정']);
  let categoryRooms = new Map();
  function setCategories(categories) { categoryRooms = new Map(categories.map(c => [c.name, c.room])); }
  function resourceRoom(resource) {
    const name = String(resource && resource.category || '');
    if (categoryRooms.has(name)) return categoryRooms.get(name);
    return residentialCategories.has(name.replace(/\s+/g, '')) ? 'residential' : 'commercial';
  }
  function isResidential(resource) { return resourceRoom(resource) === 'residential'; }
  function pageScope(body, search) {
    if (['residential', 'land'].includes(body.dataset.resourceScope)) return body.dataset.resourceScope;
    return new URLSearchParams(search).get('scope') === 'all' ? 'all' : 'commercial';
  }
  function visible(resources, scope) {
    if (scope === 'all') return resources;
    return resources.filter(resource => resourceRoom(resource) === scope);
  }
  function readDetailScope(search) {
    const value = new URLSearchParams(search).get('resourceScope');
    return ['residential', 'commercial', 'land', 'all'].includes(value) ? value : null;
  }
  function roomUrl(scope) {
    return scope === 'land' ? 'land-resources.html' : scope === 'residential' ? 'residential-resources.html' : scope === 'all' ? 'resources.html?scope=all' : 'resources.html';
  }
  function detailUrl(page, id, scope) {
    const params = new URLSearchParams({id: String(id)});
    if (scope) params.set('resourceScope', scope);
    return page + '?' + params.toString();
  }
  window.HitopResourceRooms = {setCategories, resourceRoom, isResidential, pageScope, visible, readDetailScope, roomUrl, detailUrl};
})();
async function resourceCategoryRequest(query, method = 'GET', body) {
  const {data, error} = await hitopAuthClient.auth.getSession();
  if (error || !data.session) throw new Error('로그인 후 이용해주세요');
  hitopApplyAuthHeader(data.session);
  const response = await fetchWithTimeout(SUPABASE_URL + '/rest/v1/drive_resource_categories' + query, {
    method, headers: Object.assign({}, headers, {Prefer: 'return=representation'}),
    ...(body === undefined ? {} : {body: JSON.stringify(body)})
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.code === '23505' ? '이미 존재하는 카테고리명입니다' : '카테고리 저장 또는 조회에 실패했습니다');
  }
  return response.json();
}
async function getDriveCategories() {
  const categories = await resourceCategoryRequest('?order=created_at.asc,name.asc');
  HitopResourceRooms.setCategories(categories);
  return categories;
}
async function createDriveCategory(name, room) {
  return resourceCategoryRequest('', 'POST', {name, room});
}
async function renameDriveCategory(category, name) {
  const rows = await resourceCategoryRequest('?id=eq.' + encodeURIComponent(category.id) + '&name=eq.' + encodeURIComponent(category.name), 'PATCH', {name});
  if (!rows.length) throw new Error('다른 화면에서 카테고리가 변경되었습니다. 새로고침 후 다시 시도해주세요');
  return rows[0];
}
