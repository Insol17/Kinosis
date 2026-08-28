export function createMovieRepository({ apiClient, rememberMovie }) {
  const apiJson = apiClient.json;
  const SEARCH_CACHE_TTL = 5 * 60 * 1000;
  const SEARCH_CACHE_LIMIT = 60;
  const searchCache = new Map();

  function searchKey(query) { return String(query || '').normalize('NFKC').toLocaleLowerCase('ko-KR').replace(/\s+/g, ' ').trim(); }
  function cachedSearch(key) {
    const entry = searchCache.get(key);
    if (!entry || entry.expiresAt <= Date.now()) { if (entry) searchCache.delete(key); return null; }
    searchCache.delete(key); searchCache.set(key, entry);
    return entry.data;
  }
  function rememberSearch(key, data) {
    searchCache.delete(key);
    searchCache.set(key, { data, expiresAt: Date.now() + SEARCH_CACHE_TTL });
    while (searchCache.size > SEARCH_CACHE_LIMIT) searchCache.delete(searchCache.keys().next().value);
  }

  /** @param {string} query @param {{signal?: AbortSignal}} [options] */
  async function search(query, options = {}) {
    const key = searchKey(query);
    const cached = cachedSearch(key);
    const data = cached || await apiJson(`/api/movie-search?q=${encodeURIComponent(query)}`, { signal: options.signal, timeoutMs: 7000, priority: 'high' });
    if (!cached) rememberSearch(key, data);
    return {
      results: (data.results || []).map((row) => rememberMovie({ ...row, source: 'tmdb-live', detailLoaded: false })).filter(Boolean),
      people: data.people || [],
      genreMatched: data.genreMatched || null,
      cached: !!cached,
    };
  }

  async function detail(id, options = {}) {
    return apiJson(`/api/movie-detail?id=${encodeURIComponent(id)}`, { timeoutMs: 8000, priority: 'high', ...options });
  }
  async function availability(id, options = {}) {
    const { title = '', originalTitle = '', year = '', ...requestOptions } = options;
    const params = new URLSearchParams({ id: String(id) });
    if (title) params.set('title', title);
    if (originalTitle) params.set('originalTitle', originalTitle);
    if (year) params.set('year', String(year));
    return apiJson(`/api/movie-availability?${params.toString()}`, { timeoutMs: 7500, priority: 'medium', ...requestOptions });
  }
  async function summaries(ids, options = {}) {
    return apiJson(`/api/movie-summaries?ids=${encodeURIComponent(ids.join(','))}`, { timeoutMs: 8000, priority: 'medium', ...options });
  }
  async function media(id, options = {}) {
    return apiJson(`/api/movie-media?id=${encodeURIComponent(id)}`, { timeoutMs: 7500, priority: 'low', ...options });
  }
  async function recommendations(id, options = {}) {
    return apiJson(`/api/movie-recommendations?id=${encodeURIComponent(id)}`, { timeoutMs: 7000, priority: 'low', ...options });
  }
  async function personFilms(id, options = {}) {
    return apiJson(`/api/person-films?id=${encodeURIComponent(id)}`, { timeoutMs: 8000, priority: 'medium', ...options });
  }
  async function directorProfiles(names, options = {}) {
    return apiJson(`/api/director-profiles?names=${encodeURIComponent((names || []).join('|'))}`, { timeoutMs: 9000, priority: 'low', ...options });
  }
  async function directorFilmography({ id = '', name = '', mode = 'representative-features', limit = 10 } = {}, options = {}) {
    const params = new URLSearchParams({ mode, limit: String(limit) });
    if (id) params.set('id', String(id));
    else if (name) params.set('name', name);
    return apiJson(`/api/director-filmography?${params.toString()}`, { timeoutMs: 12000, priority: 'medium', ...options });
  }

  function prefetchDetail(id) {
    return apiClient.prefetch(`/api/movie-detail?id=${encodeURIComponent(id)}`);
  }

  return Object.freeze({ search, detail, availability, summaries, media, recommendations, personFilms, directorProfiles, directorFilmography, prefetchDetail });
}
