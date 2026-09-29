(function () {
  'use strict';
  const message = document.getElementById('message');
  const grid = document.getElementById('buildingGrid');
  function isFirstFloor(label) {
    return /^\s*(?:1\s*층|1\s*F|1)\s*$/i.test(String(label || ''));
  }
  function isImage(floor) {
    return Boolean(floor.cloudinary_url) && !/\.pdf(?:\?|$)/i.test(floor.cloudinary_url || floor.file_name || '');
  }
  async function init() {
    try {
      const { data, error } = await hitopAuthClient.auth.getSession();
      if (error || !data.session) { hitopRedirectToLogin(); return; }
      hitopApplyAuthHeader(data.session);
      const [buildings, floors] = await Promise.all([getDriveResources(), getAllBuildingFloors()]);
      const firstFloors = new Map();
      floors.forEach(floor => {
        if (isFirstFloor(floor.floor_number) && isImage(floor) && !firstFloors.has(floor.building_id))
          firstFloors.set(floor.building_id, floor);
      });
      let count = 0;
      buildings.forEach(building => {
        const floor = firstFloors.get(building.id);
        if (!floor) return;
        count++;
        const article = document.createElement('article');
        article.className = 'card';
        const link = document.createElement('a');
        link.href = 'floor-status.html?id=' + encodeURIComponent(building.id) + '&floorId=' + encodeURIComponent(floor.id);
        link.setAttribute('aria-label', building.name + ' 1층 현황보기');
        const image = document.createElement('img');
        image.src = floor.cloudinary_url;
        image.alt = building.name + ' 1층 평면도 미리보기';
        image.loading = 'lazy';
        const body = document.createElement('div');
        body.className = 'body';
        const name = document.createElement('h2');
        name.textContent = building.name;
        const address = document.createElement('p');
        const line = String(building.memo || '').split('\n').find(value => /^주소\s*:/.test(value));
        address.textContent = line ? line.replace(/^주소\s*:/, '').trim() : '1층 현황보기 →';
        body.append(name, address);
        link.append(image, body);
        article.appendChild(link);
        grid.appendChild(article);
      });
      message.textContent = count ? `${count}개 건물의 1층 평면도` : '1층 평면도가 등록된 건물이 없습니다. 자료관리에서 먼저 평면도를 등록해 주세요.';
    } catch (error) { message.textContent = '목록을 불러오지 못했습니다: ' + error.message; }
  }
  init();
})();
