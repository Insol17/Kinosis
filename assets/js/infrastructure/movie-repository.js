export function createMovieRepository({ apiClient, rememberMovie }) {
  const apiJson = apiClient.json;

  /** @param {string} query @param {{signal?: AbortSignal}} [options] */
  async function search(query, options = {}) {
    const data = await apiJson(`/api/movie-search?q=${encodeURIComponent(query)}`, { signal: options.signal, timeoutMs: 7000, priority: 'high' });
    return {
      results: (data.results || []).map((row) => rememberMovie({ ...row, source: 'tmdb-live', detailLoaded: false })).filter(Boolean),
      people: data.people || [],
      genreMatched: data.genreMatched || null,
    };
  }

  async function detail(id, options = {}) {
    return apiJson(`/api/movie-detail?id=${encodeURIComponent(id)}`, { timeoutMs: 8000, priority: 'high', ...options });
  }
  async function availability(id, options = {}) {
    return apiJson(`/api/movie-availability?id=${encodeURIComponent(id)}`, { timeoutMs: 7500, priority: 'medium', ...options });
  }
  async function summaries(ids, options = {}) {
    return apiJson(`/api/movie-summaries?ids=${encodeURIComponent(ids.join(','))}`, { timeoutMs: 8000, priority: 'medium', ...options });
  }
  async function recommendations(id, options = {}) {
    return apiJson(`/api/movie-recommendations?id=${encodeURIComponent(id)}`, { timeoutMs: 7000, priority: 'low', ...options });
  }
  async function personFilms(id, options = {}) {
    return apiJson(`/api/person-films?id=${encodeURIComponent(id)}`, { timeoutMs: 8000, priority: 'medium', ...options });
  }

  function prefetchDetail(id) {
    return apiClient.prefetch(`/api/movie-detail?id=${encodeURIComponent(id)}`);
  }

  return Object.freeze({ search, detail, availability, summaries, recommendations, personFilms, prefetchDetail });
}
