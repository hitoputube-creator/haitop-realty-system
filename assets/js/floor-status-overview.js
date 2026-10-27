(function () {
  'use strict';
  const message = document.getElementById('message');
  const grid = document.getElementById('buildingGrid');
  const choice = document.getElementById('overviewFloor');
  const params = new URLSearchParams(location.search);
  const requestedFloor = params.get('floor') || '1';
  const requestedCategory = params.get('category') || '';
  const categoryChoice = document.getElementById('overviewCategory');
  const searchBox = document.getElementById('overviewSearch');
  const normalize = text => String(text || '').replace(/\s+/g, '').toLowerCase();
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
        const q = normalize(searchBox.value);
        let count = 0;
        function addCard(building, floor, floorKey, showCategory) {
          count++;
          const article = document.createElement('article');
          article.className = 'card';
          const link = document.createElement('a');
          const query = new URLSearchParams({ id: building.id, floorId: floor.id, floor: floorKey, category: building.category || currentCategory });
          link.href = 'floor-status.html?' + query.toString();
          link.setAttribute('aria-label', `${building.name} ${floorKey}층 현황보기`);
          const image = document.createElement('img');
          image.src = floor.cloudinary_url;
          image.alt = `${building.name} ${floorKey}층 평면도 미리보기`;
          image.loading = 'lazy';
          const body = document.createElement('div');
          body.className = 'body';
          const name = document.createElement('h2');
          name.textContent = building.name;
          const address = document.createElement('p');
          const line = String(building.memo || '').split('\n').find(value => /^주소\s*:/.test(value));
          const addr = line ? line.replace(/^주소\s*:/, '').trim() : `${floorKey}층 현황보기 →`;
          address.textContent = showCategory ? `${building.category || '기타'} · ${floorKey}층 · ${addr}` : addr;
          body.append(name, address);
          link.append(image, body);
          article.appendChild(link);
          grid.appendChild(article);
        }
        if (q) {
          // 검색 중에는 분류와 상관없이 모든 건물에서 찾는다. 고른 층이 없으면 가장 낮은 층 평면도를 보여 준다.
          const firstFloor = new Map();
          const order = k => (k.startsWith('B') ? -Number(k.slice(1)) : Number(k));
          usable.forEach(floor => {
            const ks = floorKeys(floor.floor_number);
            if (!ks.length) return;
            const low = ks.slice().sort((x, y) => order(x) - order(y))[0];
            const prev = firstFloor.get(floor.building_id);
            if (!prev || order(low) < order(prev.key)) firstFloor.set(floor.building_id, { floor, key: low });
          });
          buildings.forEach(building => {
            const addressLine = String(building.memo || '').split('\n').find(value => /^주소\s*:/.test(value)) || '';
            if (!normalize(building.name + ' ' + addressLine).includes(q)) return;
            const picked = matching.get(building.id);
            if (picked) { addCard(building, picked, key, true); return; }
            const fallback = firstFloor.get(building.id);
            if (fallback) addCard(building, fallback.floor, fallback.key, true);
          });
          message.textContent = count ? `"${searchBox.value.trim()}" 검색 결과 ${count}건 (모든 분류)` : `"${searchBox.value.trim()}" 검색 결과가 없습니다.`;
          return;
        }
        categoryBuildings().forEach(building => {
          const floor = matching.get(building.id);
          if (floor) addCard(building, floor, key, false);
        });        message.textContent = count ? `[${currentCategory}] ${count}개 건물의 ${key}층 평면도` : `[${currentCategory}] ${key}층 평면도가 등록된 건물이 없습니다.`;
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
      let searchTimer = null;
      searchBox.addEventListener('input', () => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => render(choice.value), 150);
      });
      render(fillFloors(requestedFloor));
    } catch (error) { message.textContent = '목록을 불러오지 못했습니다: ' + error.message; }
  }
  init();
})();
