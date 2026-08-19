(function () {
  'use strict';

  function uniqueIds(ids) {
    return [...new Set((ids || []).map((id) => String(id || '').trim()).filter((id) => /^\d+$/.test(id)))];
  }

  function create(deps) {
    const { apiJson, rememberMovie, getMovie, persistLocalCache } = deps;
    const detailInflight = new Map();
    const availabilityInflight = new Map();
    let summariesInflight = null;

    async function loadDetail(id, { persist = false, force = false } = {}) {
      const key = String(id);
      const current = getMovie(key);
      if (!force && current?.detailLoaded === true) return current;
      if (detailInflight.has(key)) return detailInflight.get(key);

      const request = (async () => {
        const data = await apiJson(`/api/movie-detail?id=${encodeURIComponent(key)}`, { timeoutMs: 10000 });
        const record = rememberMovie({ ...data, source: 'tmdb-live', detailLoaded: true, metadataLoading: false }, { persist });
        if (persist) persistLocalCache?.();
        return record;
      })().finally(() => detailInflight.delete(key));

      detailInflight.set(key, request);
      return request;
    }

    async function loadAvailability(id, { persist = false, force = false } = {}) {
      const key = String(id);
      const current = getMovie(key);
      const availabilityAge = Date.now() - (Date.parse(current?.availabilityUpdatedAt || 0) || 0);
      if (!force && current?.availabilityUpdatedAt && availabilityAge < 4 * 60 * 60 * 1000) return current;
      if (availabilityInflight.has(key)) return availabilityInflight.get(key);

      const request = (async () => {
        const data = await apiJson(`/api/movie-availability?id=${encodeURIComponent(key)}`, { timeoutMs: 10000 });
        const record = rememberMovie({ ...current, ...data, metadataLoading: false, availabilityLoading: false }, { persist });
        if (persist) persistLocalCache?.();
        return record;
      })().finally(() => availabilityInflight.delete(key));

      availabilityInflight.set(key, request);
      return request;
    }

    async function loadSummaries(ids, { persist = true } = {}) {
      const requested = uniqueIds(ids).filter((id) => !getMovie(id) || getMovie(id)?.metadataLoading);
      if (!requested.length) return [];
      if (summariesInflight) {
        await summariesInflight.catch(() => {});
        const remaining = requested.filter((id) => !getMovie(id) || getMovie(id)?.metadataLoading);
        if (!remaining.length) return requested.map(getMovie).filter(Boolean);
        return loadSummaries(remaining, { persist });
      }

      summariesInflight = (async () => {
        const loaded = [];
        for (let index = 0; index < requested.length; index += 20) {
          const chunk = requested.slice(index, index + 20);
          const data = await apiJson(`/api/movie-summaries?ids=${encodeURIComponent(chunk.join(','))}`, { timeoutMs: 12000 });
          for (const row of data.results || []) {
            const record = rememberMovie({ ...row, source: 'tmdb-summary', detailLoaded: false, metadataLoading: false }, { persist });
            if (record) loaded.push(record);
          }
        }
        if (persist && loaded.length) persistLocalCache?.();
        return loaded;
      })().finally(() => { summariesInflight = null; });

      return summariesInflight;
    }

    function isDetailLoading(id) {
      return detailInflight.has(String(id));
    }

    return Object.freeze({ loadDetail, loadAvailability, loadSummaries, isDetailLoading });
  }

  window.KINOSIS_MOVIE_LOADER = Object.freeze({ create });
})();
