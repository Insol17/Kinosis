function uniqueIds(ids) {
  return [...new Set((ids || []).map((id) => String(id || '').trim()).filter((id) => /^\d+$/.test(id)))];
}

export function createMovieLoader(deps) {
  const { repository, rememberMovie, getMovie, persistLocalCache } = deps;
  const detailInflight = new Map();
  const availabilityInflight = new Map();
  let summariesInflight = null;

  async function loadDetail(id, { persist = false, force = false } = {}) {
    const key = String(id);
    const current = getMovie(key);
    if (!force && current?.detailLoaded === true) return current;
    if (detailInflight.has(key)) return detailInflight.get(key);

    const request = (async () => {
      const data = await repository.detail(key);
      const fresh = getMovie(key) || current;
      const record = rememberMovie({ ...fresh, ...data, source: 'tmdb-live', detailLoaded: true, metadataLoading: false, detailError: null }, { persist });
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
      const data = await repository.availability(key);
      const fresh = getMovie(key) || current;
      const record = rememberMovie({ ...fresh, ...data, availabilityLoading: false }, { persist });
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
      const chunks = [];
      for (let index = 0; index < requested.length; index += 6) chunks.push(requested.slice(index, index + 6));
      let cursor = 0;
      const workers = Array.from({ length: Math.min(2, chunks.length) }, async () => {
        while (cursor < chunks.length) {
          const chunk = chunks[cursor++];
          try {
            const data = await repository.summaries(chunk);
            const received = new Set();
            for (const row of data.results || []) {
              received.add(String(row.id));
              const record = rememberMovie({ ...row, source: 'tmdb-summary', detailLoaded: false, metadataLoading: false, metadataError: null }, { persist });
              if (record) loaded.push(record);
            }
            for (const id of chunk) {
              if (received.has(String(id))) continue;
              const current = getMovie(id);
              if (current?.source === 'placeholder') rememberMovie({ ...current, metadataLoading: false, metadataError: '영화 정보를 불러오지 못했습니다.' }, { persist });
            }
          } catch (error) {
            for (const id of chunk) {
              const current = getMovie(id);
              if (current?.source === 'placeholder') rememberMovie({ ...current, metadataLoading: false, metadataError: error?.message || '영화 정보를 불러오지 못했습니다.' }, { persist });
            }
          }
        }
      });
      await Promise.all(workers);
      if (persist && loaded.length) persistLocalCache?.();
      return loaded;
    })().finally(() => { summariesInflight = null; });

    return summariesInflight;
  }

  function prefetchDetail(id) {
    const key = String(id);
    if (getMovie(key)?.detailLoaded || detailInflight.has(key)) return Promise.resolve(null);
    return repository.prefetchDetail(key);
  }

  function isDetailLoading(id) { return detailInflight.has(String(id)); }
  return Object.freeze({ loadDetail, loadAvailability, loadSummaries, prefetchDetail, isDetailLoading });
}
