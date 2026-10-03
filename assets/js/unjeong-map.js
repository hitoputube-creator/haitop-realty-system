/* Both land and shop maps read this one manifest on each page visit.
 * Update assets/data/unjeong-map.json and its revision when changing map assets.
 * Keep the original map extent to preserve parcel and building pin coordinates.
 */
(function () {
  'use strict';
  const image = document.getElementById('mapImage');
  const layer = document.getElementById('unjeongMapOverlay');
  if (!image || !layer) return;
  const svgNS = 'http://www.w3.org/2000/svg';
  let config = null;
  const versioned = path => path + '?v=' + encodeURIComponent(config.revision);
  window.HitopUnjeongMap = {
    get source() { return config ? versioned(config.source) : image.getAttribute('src'); },
    get width() { return config ? config.width : image.width; },
    get height() { return config ? config.height : image.height; }
  };
  window.HitopUnjeongMap.ready = fetch('assets/data/unjeong-map.json', { cache:'no-store' })
    .then(response => {
      if (!response.ok) throw new Error('Unable to load shared map manifest');
      return response.json();
    })
    .then(next => {
      if (!next.source || !(next.width > 0) || !(next.height > 0)) throw new Error('Invalid shared map manifest');
      config = next;
      const layers = [];
      if (config.restoration) {
        const restoration = document.createElement('img');
        restoration.src = versioned(config.restoration);
        restoration.alt = '';
        restoration.draggable = false;
        restoration.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;';
        layers.push(restoration);
      }
      const mask = document.createElementNS(svgNS, 'svg');
      mask.setAttribute('viewBox', '0 0 ' + config.width + ' ' + config.height);
      mask.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;';
      (config.cleanupRects || []).forEach(values => {
        const rect = document.createElementNS(svgNS, 'rect');
        ['x', 'y', 'width', 'height', 'fill'].forEach(key => rect.setAttribute(key, values[key]));
        mask.appendChild(rect);
      });
      layers.push(mask);
      layer.replaceChildren(...layers);
      image.width = config.width;
      image.height = config.height;
      image.src = versioned(config.source);
      const largeMap = document.getElementById('unjeongLargeMapLink');
      if (largeMap && config.largeMap) largeMap.href = versioned(config.largeMap);
      return config;
    })
    .catch(error => {
      console.error('Shared map:', error);
      return null; // Keep the original raster map visible if the manifest cannot load.
    });
})();
