(function () {
  'use strict';

  const DATA = window.KINOSIS_CURATIONS || { items: [] };
  const staticItems = Array.isArray(DATA.items) ? DATA.items.slice() : [];
  let dynamicItems = [];

  function mergedItems() {
    const map = new Map(staticItems.filter(Boolean).map((item) => [String(item.slug), item]));
    for (const item of dynamicItems) {
      if (!item?.slug) continue;
      if (item.status === 'archived') { map.delete(String(item.slug)); continue; }
      map.set(String(item.slug), item);
    }
    return [...map.values()].sort((a, b) => Number(a.priority || 100) - Number(b.priority || 100) || String(a.title || '').localeCompare(String(b.title || ''), 'ko'));
  }

  function all() { return mergedItems(); }
  function forSurface(surface) {
    return mergedItems().filter((item) => item && (item.surface === surface || item.surface === 'both'));
  }
  function get(slug) { return mergedItems().find((item) => item && item.slug === String(slug || '')) || null; }
  function replaceDynamic(items) {
    dynamicItems = Array.isArray(items) ? items.filter(Boolean).map((item) => ({ ...item, _dynamic: true })) : [];
    window.dispatchEvent(new CustomEvent('kinosis:curations-updated'));
  }
  function dynamic() { return dynamicItems.slice(); }

  window.KINOSIS_CURATIONS_API = Object.freeze({ all, forSurface, get, replaceDynamic, dynamic, version: DATA.version || 'unknown' });
})();
