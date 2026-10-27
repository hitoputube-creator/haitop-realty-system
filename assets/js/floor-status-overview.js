(function () {
  'use strict';
  const message = document.getElementById('message');
  const grid = document.getElementById('buildingGrid');
  const choice = document.getElementById('overviewFloor');
  const params = new URLSearchParams(location.search);
  const requestedFloor = params.get('floor') || '1';
  const requestedCategory = params.get('category') || '';
  const categoryChoice = document.getElementById('overviewCategory');
  function floorKeys(label) {
    const text = String(label || '').trim();
    const basement = text.match(/(?:지하|[Bb])\s*(\d+)/);
    if (basement) return ['B' + basement[1]];
    const range = text.match(/(\d+)\s*[~～\-]\s*(\d+)/);
    if (range) {
      const first = Number(range[1]), last = Number(range[2]);
      if (last >= first && last - first <= 30)
        return Array.from({ length:last - first + 1 }, (_, index) => String(first + index));
    }
    const one = text.match(/(\d+)/);
    return one ? [one[1]] : [];
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
      const usable = floors.filter(isImage);
      const withFloors = new Set(usable.filter(floor => floorKeys(floor.floor_number).length).map(floor => floor.building_id));
      const categoryNames = [];
      buildings.forEach(building => {
        const name = building.category || '기타';
        if (withFloors.has(building.id) && !categoryNames.includes(name)) categoryNames.push(name);
      });
      const preferred = categoryNames.indexOf('운정역 상가');
      if (preferred > 0) categoryNames.unshift(categoryNames.splice(preferred, 1)[0]);
      categoryNames.forEach(name => {
        const option = document.createElement('option');
        option.value = name;
        option.textContent = name;
        categoryChoice.appendChild(option);
      });
      let currentCategory = categoryNames.includes(requestedCategory) ? requestedCategory : (categoryNames[0] || '');
      const sortKeys = list => list.sort((a, b) => (a.startsWith('B') ? -Number(a.slice(1)) : Number(a)) -
        (b.startsWith('B') ? -Number(b.slice(1)) : Number(b)));
      function categoryBuildings() {
        return buildings.filter(building => (building.category || '기타') === currentCategory);
      }
      function fillFloors(wanted) {
        const ids = new Set(categoryBuildings().map(building => building.id));
        const keys = sortKeys([...new Set(usable.filter(floor => ids.has(floor.building_id)).flatMap(floor => floorKeys(floor.floor_number)))]);
        choice.replaceChildren();
        keys.forEach(key => {
          const option = document.createElement('option');
          option.value = key;
          option.textContent = key + '층';
          choice.appendChild(option);
        });
        if (!keys.length) return wanted;
        return keys.includes(wanted) ? wanted : (keys.includes('1') ? '1' : keys[0]);
      }
      function render(key) {
        grid.replaceChildren();
        categoryChoice.value = currentCategory;
        choice.value = key;
        document.getElementById('pageTitle').textContent = `건물별 ${key}층 현황`;
        document.title = `하이탑부동산 | 건물별 ${key}층 현황`;
        const matching = new Map();
        usable.forEach(floor => {
          if (floorKeys(floor.floor_number).includes(key) && !matching.has(floor.building_id))
            matching.set(floor.building_id, floor);
        });
        let count = 0;
        categoryBuildings().forEach(building => {
          const floor = matching.get(building.id);
          if (!floor) return;
          count++;
          const article = document.createElement('article');
          article.className = 'card';
          const link = document.createElement('a');
          const query = new URLSearchParams({ id: building.id, floorId: floor.id, floor: key, category: currentCategory });
          link.href = 'floor-status.html?' + query.toString();
          link.setAttribute('aria-label', `${building.name} ${key}층 현황보기`);
          const image = document.createElement('img');
          image.src = floor.cloudinary_url;
          image.alt = `${building.name} ${key}층 평면도 미리보기`;
          image.loading = 'lazy';
          const body = document.createElement('div');
          body.className = 'body';
          const name = document.createElement('h2');
          name.textContent = building.name;
          const address = document.createElement('p');
          const line = String(building.memo || '').split('\n').find(value => /^주소\s*:/.test(value));
          address.textContent = line ? line.replace(/^주소\s*:/, '').trim() : `${key}층 현황보기 →`;
          body.append(name, address);
          link.append(image, body);
          article.appendChild(link);
          grid.appendChild(article);
        });
        message.textContent = count ? `[${currentCategory}] ${count}개 건물의 ${key}층 평면도` : `[${currentCategory}] ${key}층 평면도가 등록된 건물이 없습니다.`;
      }
      function saveState(key) {
        history.replaceState(null, '', 'floor-status-overview.html?category=' + encodeURIComponent(currentCategory) + '&floor=' + encodeURIComponent(key));
      }
      choice.addEventListener('change', () => {
        const key = choice.value;
        saveState(key);
        render(key);
      });
      categoryChoice.addEventListener('change', () => {
        currentCategory = categoryChoice.value;
        const key = fillFloors(choice.value);
        saveState(key);
        render(key);
      });
      render(fillFloors(requestedFloor));
    } catch (error) { message.textContent = '목록을 불러오지 못했습니다: ' + error.message; }
  }
  init();
})();
