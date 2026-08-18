(function () {
  'use strict';

  const DATA = window.KINOSIS_CURATIONS || { items: [] };
  const items = Array.isArray(DATA.items) ? DATA.items : [];

  function all() {
    return items.slice();
  }

  function forSurface(surface) {
    return items
      .filter((item) => item && (item.surface === surface || item.surface === 'both'))
      .sort((a, b) => Number(a.priority || 100) - Number(b.priority || 100));
  }

  function get(slug) {
    return items.find((item) => item && item.slug === String(slug || '')) || null;
  }

  window.KINOSIS_CURATIONS_API = Object.freeze({
    all,
    forSurface,
    get,
    version: DATA.version || 'unknown',
  });
})();
