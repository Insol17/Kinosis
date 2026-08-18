(function () {
  'use strict';

  function create({ fetchDirector, fallbackDirector, normalizeRows }) {
    const rowsBySlug = new Map();
    const loads = new Map();

    function peek(slug) {
      return rowsBySlug.get(String(slug || '')) || null;
    }

    async function ensure(item) {
      if (!item?.source || item.source.type !== 'director') return { changed: false, rows: null };
      const slug = String(item.slug || '');
      if (!slug) return { changed: false, rows: null };
      if (rowsBySlug.has(slug)) return { changed: false, rows: rowsBySlug.get(slug) };
      if (loads.has(slug)) return loads.get(slug);

      const task = (async () => {
        let rows = [];
        try {
          rows = await fetchDirector(item);
        } catch {
          rows = await fallbackDirector(item);
        }
        rows = normalizeRows ? normalizeRows(rows || []) : (rows || []);
        rowsBySlug.set(slug, rows);
        return { changed: true, rows };
      })().finally(() => loads.delete(slug));

      loads.set(slug, task);
      return task;
    }

    return Object.freeze({ ensure, peek, isLoading: (slug) => loads.has(String(slug || '')) });
  }

  window.KINOSIS_CURATION_LOADER = Object.freeze({ create });
})();
