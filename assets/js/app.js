(function () {
  'use strict';

  const CATALOG = window.KINOSIS_CATALOG || {
    mode: 'demo',
    updatedAt: 'missing',
    movies: [],
    sections: { trending: [], theatres: [], streaming: [], rated: [], art: [] },
    featured: null,
  };
  const CLOUD = window.KINOSIS_CLOUD || null;
  const ART = window.KINOSIS_ART || { classify: () => ({ isArt: false, score: 0, reasons: [] }) };
  const UI = window.KINOSIS_UI;
  const RECOMMENDER = window.KINOSIS_RECOMMENDER || { topSeeds: () => [], buildTasteProfile: () => ({}), explanation: () => '' };
  const IMPORTERS = window.KINOSIS_IMPORTERS || null;
  const CURATIONS = window.KINOSIS_CURATIONS_API || { all: () => [], forSurface: () => [], get: () => null };

  const STORAGE_KEY = 'kinosis.mvp.v2.state';
  const LEGACY_STORAGE_KEY = 'film.mvp.v2.state';
  const MIGRATION_PREFIX = 'kinosis.legacy.migrated.';
  const LIVE_SEARCH_MIN_CHARS = 2;
  const LIVE_SEARCH_DEBOUNCE = 300;
  const AVAILABILITY_CHECK_MS = 6 * 60 * 60 * 1000;
  const AVAILABILITY_NEW_MS = 14 * 24 * 60 * 60 * 1000;

  const PROVIDERS = [
    { key: 'Netflix', label: 'Netflix', aliases: ['Netflix', 'Netflix Standard with Ads'] },
    { key: 'TVING', label: 'TVING', aliases: ['TVING'] },
    { key: 'Coupang Play', label: 'Coupang Play', aliases: ['Coupang Play'] },
    { key: 'Disney+', label: 'Disney+', aliases: ['Disney Plus', 'Disney+'] },
    { key: 'WATCHA', label: 'WATCHA', aliases: ['Watcha', 'WATCHA'] },
    { key: 'Wavve', label: 'Wavve', aliases: ['wavve', 'Wavve'] },
    { key: 'Apple TV Plus', label: 'Apple TV+', aliases: ['Apple TV Plus', 'Apple TV+'] },
    { key: 'Collectio', label: '콜렉티오', aliases: ['Collectio', 'COLLECTIO', '콜렉티오'], manualOnly: true },
  ];

  const movieMap = new Map((CATALOG.movies || []).map((m) => [String(m.id), normalizeMovieRecord(m)]));
  const theatreIds = new Set((CATALOG.sections?.theatres || []).map((m) => String(m.id)));

  let activeView = 'discover';
  let previousView = 'discover';
  let detailMovieId = null;
  let curationSlug = null;
  let curationPreviousView = 'arthouse';
  const curationLoadAttempts = new Set();
  const curationHydrations = new Map();
  let currentUser = null;
  let authReady = false;
  let hydratedUserId = null;
  let suppressCloudSync = true;
  let syncTimer = null;
  let syncState = { status: 'guest', lastSyncedAt: null, message: '' };

  let libraryMode = 'home';
  let libraryView = 'grid';
  let myMode = 'overview';
  let calendarCursor = new Date();
  let libraryQueryTimer = null;
  let libraryFilter = {
    q: '', sort: 'recent', status: 'all', rating: 'all', availability: 'all', genre: 'all', decade: 'all', arthouse: 'all',
  };

  let searchTimer = null;
  let searchAbort = null;
  let searchSerial = 0;
  let searchComposing = false;
  let liveSearchState = { query: '', status: 'idle', results: [], people: [], message: '' };
  let personSearchState = { status: 'idle', person: null, results: [] };

  let forYouState = { status: 'idle', seeds: [], results: [], reason: '' };
  const relatedState = new Map();
  const scrollPositions = new Map();

  function icon(name) {
    return `<svg class="ui-icon" aria-hidden="true"><use href="#i-${name}"/></svg>`;
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>'"]/g, (char) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
    }[char]));
  }

  function isoDate(date) {
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  }

  function fmtRuntime(minutes) {
    if (!minutes) return '';
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return h ? `${h}h ${m}m` : `${m}m`;
  }

  function formatDate(value) {
    if (!value) return '—';
    try {
      return new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(value));
    } catch {
      return value;
    }
  }

  function formatDateTime(value) {
    if (!value) return '없음';
    try {
      return new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
    } catch {
      return value;
    }
  }

  function normalizeText(value) {
    return String(value || '').normalize('NFKC').toLocaleLowerCase('ko-KR').replace(/\s+/g, ' ').trim();
  }

  function normalizeProviderName(value) {
    return String(value || '').toLowerCase().replace(/[^a-z0-9가-힣]+/g, '');
  }

  function providerConfigForName(name) {
    const normalized = normalizeProviderName(name);
    return PROVIDERS.find((provider) => [provider.key, provider.label, ...(provider.aliases || [])]
      .some((value) => normalizeProviderName(value) === normalized)) || null;
  }

  function normalizeMovieRecord(movie) {
    if (!movie || movie.id == null) return null;
    return {
      ...movie,
      id: String(movie.id),
      title: movie.title || movie.originalTitle || 'Untitled',
      originalTitle: movie.originalTitle || '',
      year: movie.year || String(movie.releaseDate || '').slice(0, 4) || null,
      providers: Array.isArray(movie.providers) ? movie.providers : [],
      genres: Array.isArray(movie.genres) ? movie.genres : [],
      source: movie.source || 'catalog',
    };
  }

  function poster(movie) {
    return movie?.posterUrl || './icons/icon.svg';
  }

  function backdrop(movie) {
    return movie?.heroBackdropUrl || movie?.backdropUrl || movie?.posterUrl || './icons/icon.svg';
  }

  function uniqueById(list) {
    const seen = new Set();
    return (list || []).filter((item) => item && !seen.has(String(item.id)) && seen.add(String(item.id)));
  }

  function movie(id) {
    return movieMap.get(String(id)) || state.movieCache?.[String(id)] || null;
  }

  function rememberMovie(record, { persist = false } = {}) {
    const normalized = normalizeMovieRecord(record);
    if (!normalized) return null;
    const existing = movieMap.get(String(normalized.id)) || state.movieCache?.[String(normalized.id)] || {};
    const merged = normalizeMovieRecord({ ...existing, ...normalized });
    movieMap.set(String(merged.id), merged);
    if (persist) {
      state.movieCache = state.movieCache || {};
      state.movieCache[String(merged.id)] = merged;
    }
    return merged;
  }

  function genreNames(record) {
    return (record?.genres || []).map((genre) => typeof genre === 'string' ? genre : genre?.name).filter(Boolean);
  }

  function artInfo(record) {
    return ART.classify(record, { threshold: window.KINOSIS_CONFIG?.arthouse?.threshold || 36 });
  }

  function isArthouse(record) {
    return !!artInfo(record).isArt;
  }

  function artPool() {
    return uniqueById([...(CATALOG.sections?.art || []), ...(CATALOG.movies || [])])
      .filter((record) => artInfo(record).score > 0)
      .sort((a, b) => artInfo(b).score - artInfo(a).score || Number(b.voteAverage || 0) - Number(a.voteAverage || 0));
  }

  function artTheatrePool() {
    const theatres = uniqueById(CATALOG.sections?.theatres || []);
    const strong = theatres.filter(isArthouse).sort((a, b) => artInfo(b).score - artInfo(a).score);
    if (strong.length >= 8) return strong.slice(0, 12);
    const extras = theatres
      .filter((record) => !strong.some((item) => String(item.id) === String(record.id)))
      .sort((a, b) => artInfo(b).score - artInfo(a).score || Number(b.voteAverage || 0) - Number(a.voteAverage || 0));
    return uniqueById([...strong, ...extras]).slice(0, 10);
  }

  function isInTheatres(record) {
    return theatreIds.has(String(record?.id));
  }

  function providerTypeLabel(type) {
    return ({ subscription: '구독', free: '무료', ads: '광고 포함', rent: '대여', buy: '구매' })[type] || type;
  }

  function initialState() {
    return {
      profile: { name: '', handle: '', bio: '내 영화생활을 기록합니다.' },
      subscriptions: [],
      settings: { lastExportAt: null },
      meta: { modifiedAt: null, lastSyncedAt: null, dirtySince: null },
      movieCache: {},
      library: {},
      logs: [],
      collections: [],
      availability: { snapshot: {}, newlyAvailable: {}, lastCheckedAt: null },
    };
  }

  function readJson(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function normalizeState(parsed) {
    const base = initialState();
    const source = parsed || {};
    const normalized = Object.assign(base, source, {
      profile: Object.assign(base.profile, source.profile || {}),
      settings: Object.assign(base.settings, source.settings || {}),
      meta: Object.assign(base.meta, source.meta || {}),
      movieCache: Object.assign({}, source.movieCache || {}),
      library: Object.assign({}, source.library || {}),
      logs: Array.isArray(source.logs) ? source.logs : [],
      collections: Array.isArray(source.collections) ? source.collections : [],
      subscriptions: Array.isArray(source.subscriptions) ? source.subscriptions : [],
      availability: {
        snapshot: Object.assign({}, source.availability?.snapshot || {}),
        newlyAvailable: Object.assign({}, source.availability?.newlyAvailable || {}),
        lastCheckedAt: source.availability?.lastCheckedAt || null,
      },
    });

    normalized.logs = normalized.logs.map((log, index) => ({
      id: String(log.id || `legacy-log-${index}-${log.movieId || 'x'}-${log.watchedAt || 'date'}`),
      movieId: String(log.movieId),
      watchedAt: log.watchedAt || isoDate(new Date()),
      rating: log.rating == null || log.rating === '' ? null : Number(log.rating),
      review: log.review || '',
      rewatch: !!log.rewatch,
      createdAt: log.createdAt || log.updatedAt || new Date().toISOString(),
      updatedAt: log.updatedAt || log.createdAt || new Date().toISOString(),
    }));

    normalized.collections = normalized.collections.map((collection, index) => ({
      id: String(collection.id || `legacy-collection-${index}`),
      name: collection.name || 'Untitled Collection',
      description: collection.description || '',
      coverMovieId: collection.coverMovieId || collection.movieIds?.[0] || null,
      type: collection.type || 'manual',
      movieIds: Array.isArray(collection.movieIds) ? collection.movieIds.map(String) : [],
      createdAt: collection.createdAt || new Date().toISOString(),
      updatedAt: collection.updatedAt || new Date().toISOString(),
    }));

    for (const item of Object.values(normalized.library)) {
      if (item.rating === '') item.rating = null;
      item.updatedAt = item.updatedAt || item.savedAt || new Date().toISOString();
    }
    return normalized;
  }

  function legacyState() {
    return normalizeState(readJson(STORAGE_KEY) || readJson(LEGACY_STORAGE_KEY));
  }

  function userCacheKey() {
    return currentUser?.id ? `kinosis.user.${currentUser.id}.state.v1` : null;
  }

  function hasPersonalData(value) {
    return !!(
      Object.keys(value?.library || {}).length ||
      value?.logs?.length || value?.collections?.length || value?.subscriptions?.length ||
      Object.keys(value?.movieCache || {}).length
    );
  }

  function mergeImport(baseState, incomingState) {
    const out = normalizeState(baseState);
    const src = normalizeState(incomingState);
    out.profile = Object.assign({}, out.profile, src.profile);
    out.library = Object.assign({}, out.library, src.library);
    out.movieCache = Object.assign({}, out.movieCache, src.movieCache);
    out.logs = [...new Map([...(out.logs || []), ...(src.logs || [])].map((entry) => [String(entry.id), entry])).values()];
    out.collections = [...new Map([...(out.collections || []), ...(src.collections || [])].map((entry) => [String(entry.id), entry])).values()];
    out.subscriptions = [...new Set([...(out.subscriptions || []), ...(src.subscriptions || [])])];
    out.availability = {
      snapshot: Object.assign({}, out.availability?.snapshot || {}, src.availability?.snapshot || {}),
      newlyAvailable: Object.assign({}, out.availability?.newlyAvailable || {}, src.availability?.newlyAvailable || {}),
      lastCheckedAt: src.availability?.lastCheckedAt || out.availability?.lastCheckedAt || null,
    };
    out.meta.modifiedAt = new Date().toISOString();
    out.meta.dirtySince = out.meta.modifiedAt;
    return out;
  }

  let state = initialState();

  function isSignedIn() {
    return !!currentUser;
  }

  function persistLocalCache() {
    if (!isSignedIn()) return;
    const key = userCacheKey();
    if (key) localStorage.setItem(key, JSON.stringify(state));
  }

  function saveState({ sync = true, mark = true } = {}) {
    if (mark) {
      state.meta = state.meta || {};
      state.meta.modifiedAt = new Date().toISOString();
      state.meta.dirtySince = state.meta.dirtySince || state.meta.modifiedAt;
    }
    persistLocalCache();
    if (sync && isSignedIn() && !suppressCloudSync) scheduleCloudSync();
  }

  function rememberCachedMovies() {
    Object.values(state.movieCache || {}).forEach((record) => rememberMovie(record));
  }

  function scheduleCloudSync(delay = 500) {
    clearTimeout(syncTimer);
    syncState.status = 'pending';
    renderAccountChrome();
    syncTimer = setTimeout(pushCloudState, delay);
  }

  async function pushCloudState() {
    if (!isSignedIn() || !CLOUD) return;
    clearTimeout(syncTimer);
    syncState.status = navigator.onLine ? 'syncing' : 'offline';
    renderAccountChrome();
    if (!navigator.onLine) return;
    try {
      const row = await CLOUD.writeUserState(JSON.parse(JSON.stringify(state)));
      const stamp = row?.updated_at || new Date().toISOString();
      state.meta.lastSyncedAt = stamp;
      state.meta.dirtySince = null;
      persistLocalCache();
      syncState = { status: 'online', lastSyncedAt: stamp, message: '' };
    } catch (error) {
      syncState = { status: 'offline', lastSyncedAt: state.meta?.lastSyncedAt || null, message: error.message || 'Sync failed' };
    }
    renderAccountChrome();
    if (activeView === 'my' && myMode === 'settings') renderMy();
  }

  async function hydrateSignedInUser() {
    if (!isSignedIn() || !CLOUD) return;
    suppressCloudSync = true;
    syncState.status = 'syncing';
    try {
      const cloud = await CLOUD.readUserState();
      const cached = normalizeState(readJson(userCacheKey()));
      let next = cloud?.payload ? normalizeState(cloud.payload) : (hasPersonalData(cached) ? cached : initialState());
      const cloudTime = Date.parse(cloud?.updated_at || 0) || 0;
      const cacheTime = Date.parse(cached.meta?.modifiedAt || 0) || 0;
      if (hasPersonalData(cached) && cacheTime > cloudTime) next = mergeImport(next, cached);

      const old = legacyState();
      const migrationKey = MIGRATION_PREFIX + currentUser.id;
      if (hasPersonalData(old) && !localStorage.getItem(migrationKey)) {
        const count = Object.keys(old.library || {}).length;
        const answer = await UI.ask({
          eyebrow: 'LOCAL DATA',
          title: '이전 기록을 가져올까요?',
          message: `이 브라우저에서 이전 KINOSIS 기록 ${count}편을 찾았습니다. 현재 계정에 병합할 수 있습니다.`,
          confirmText: '가져오기',
        });
        if (answer.confirmed) next = mergeImport(next, old);
        localStorage.setItem(migrationKey, new Date().toISOString());
      }

      state = normalizeState(next);
      rememberCachedMovies();
      state.meta.lastSyncedAt = cloud?.updated_at || state.meta.lastSyncedAt || null;
      persistLocalCache();
      suppressCloudSync = false;
      if (!cloud || state.meta.dirtySince) await pushCloudState();
      else syncState = { status: 'online', lastSyncedAt: state.meta.lastSyncedAt, message: '' };
    } catch (error) {
      const cached = readJson(userCacheKey());
      state = normalizeState(cached || initialState());
      rememberCachedMovies();
      suppressCloudSync = false;
      syncState = { status: 'offline', lastSyncedAt: state.meta?.lastSyncedAt || null, message: error.message || 'Cloud unavailable' };
    }

    invalidateRecommendations();
    await Promise.allSettled([loadForYou(), refreshWatchlistAvailability()]);
    renderAll();
  }

  function lib(id) {
    return state.library[String(id)] || null;
  }

  function ensureLib(id) {
    const key = String(id);
    if (!state.library[key]) {
      state.library[key] = {
        savedAt: new Date().toISOString(), watched: false, watchlist: false, favorite: false,
        rating: null, review: '', updatedAt: new Date().toISOString(),
      };
    }
    return state.library[key];
  }

  function allSavedMovies() {
    return Object.keys(state.library).map(movie).filter(Boolean);
  }

  function logsForMovie(id) {
    return state.logs
      .filter((log) => String(log.movieId) === String(id))
      .sort((a, b) => String(b.watchedAt).localeCompare(String(a.watchedAt)) || String(b.createdAt).localeCompare(String(a.createdAt)));
  }

  function latestLogs() {
    return [...state.logs].sort((a, b) => String(b.watchedAt).localeCompare(String(a.watchedAt)) || String(b.createdAt).localeCompare(String(a.createdAt)));
  }

  function latestUniqueMovies() {
    const seen = new Set();
    return latestLogs().map((log) => movie(log.movieId)).filter((record) => record && !seen.has(String(record.id)) && seen.add(String(record.id)));
  }

  function recomputeLibraryFromLogs(movieId) {
    const entry = ensureLib(movieId);
    const logs = logsForMovie(movieId);
    entry.watched = logs.length > 0;
    if (logs.length) entry.watchlist = false;
    const ratingLog = logs.find((log) => log.rating != null);
    const reviewLog = logs.find((log) => String(log.review || '').trim());
    entry.rating = ratingLog?.rating ?? entry.rating ?? null;
    entry.review = reviewLog?.review ?? '';
    entry.updatedAt = new Date().toISOString();
  }

  function isSubscriptionEnabled(key) {
    if (!isSignedIn()) return false;
    const normalized = normalizeProviderName(key);
    return (state.subscriptions || []).some((value) => normalizeProviderName(value) === normalized);
  }

  function isSubscribedProvider(name) {
    const config = providerConfigForName(name);
    return config ? isSubscriptionEnabled(config.key) : isSubscriptionEnabled(name);
  }

  function subscriptionProviders(record) {
    return (record?.providers || []).filter((provider) => provider.type === 'subscription');
  }

  function availableOnMine(record) {
    return subscriptionProviders(record).some((provider) => isSubscribedProvider(provider.name));
  }

  function myStreamingMovies() {
    return (CATALOG.movies || []).filter(availableOnMine);
  }

  function watchlistAvailable() {
    return allSavedMovies().filter((record) => lib(record.id)?.watchlist && availableOnMine(record));
  }

  function recentNewAvailability() {
    const now = Date.now();
    return Object.entries(state.availability?.newlyAvailable || {})
      .filter(([id, info]) => lib(id)?.watchlist && now - Date.parse(info?.detectedAt || 0) <= AVAILABILITY_NEW_MS)
      .map(([id]) => movie(id))
      .filter(Boolean);
  }

  function providerBadges(record, max = 2) {
    const providers = [...subscriptionProviders(record)].sort((a, b) => (isSubscribedProvider(b.name) ? 1 : 0) - (isSubscribedProvider(a.name) ? 1 : 0));
    return providers.slice(0, max).map((provider) => `
      <span class="provider-icon" title="${escapeHtml(providerConfigForName(provider.name)?.label || provider.name)}">
        <img src="${escapeHtml(provider.logoUrl || './icons/icon.svg')}" alt="" />
      </span>`).join('');
  }

  function availabilityBadges(record) {
    const ott = providerBadges(record, 2);
    const cinema = isInTheatres(record) ? `<span class="cinema-icon-badge" title="현재 극장 상영 목록">${icon('cinema')}</span>` : '';
    return `<div class="availability-stack">${cinema}${ott}</div>`;
  }

  function canUseLiveApi() {
    return location.protocol === 'http:' || location.protocol === 'https:';
  }

  async function apiJson(path, { signal } = {}) {
    const response = await fetch(path, { headers: { Accept: 'application/json' }, signal, cache: 'no-store' });
    let data = null;
    try { data = await response.json(); } catch {}
    if (!response.ok) throw new Error(data?.error || `API ${response.status}`);
    return data;
  }

  async function fetchLiveSearch(query, { signal } = {}) {
    const data = await apiJson(`/api/movie-search?q=${encodeURIComponent(query)}`, { signal });
    return {
      results: (data.results || []).map((record) => rememberMovie({ ...record, source: 'tmdb-live', detailLoaded: false })).filter(Boolean),
      people: data.people || [],
      genreMatched: data.genreMatched || null,
    };
  }

  async function fetchMovieDetail(id, { persist = false } = {}) {
    const data = await apiJson(`/api/movie-detail?id=${encodeURIComponent(id)}`);
    const detailed = rememberMovie({ ...data, source: 'tmdb-live', detailLoaded: true }, { persist });
    if (persist) saveState();
    return detailed;
  }

  async function ensureMovieDetail(id, { persist = false } = {}) {
    let current = movie(id);
    if (!current && canUseLiveApi()) {
      try {
        current = await fetchMovieDetail(id, { persist });
      } catch (error) {
        console.warn('detail load failed', error);
        return null;
      }
    }
    if (!current) return null;
    const needs = current.source === 'tmdb-live' && !current.detailLoaded;
    if (needs && canUseLiveApi()) {
      try { current = await fetchMovieDetail(id, { persist }); }
      catch (error) { console.warn('detail fallback', error); }
    } else if (persist && !CATALOG.movies?.some((item) => String(item.id) === String(id))) {
      rememberMovie(current, { persist: true });
      saveState();
    }
    return current;
  }

  function gateHtml(area) {
    return `<div class="gate-card"><div class="gate-card-inner"><div class="gate-icon">${icon('lock')}</div><p class="eyebrow">ACCOUNT REQUIRED</p><h1>${escapeHtml(area)}</h1><p>개인 기록은 계정과 연결됩니다. 로그인하면 같은 Library와 MY를 PC·모바일에서 이어서 사용할 수 있습니다.</p><button class="primary-button" data-open-auth>로그인하고 시작하기</button></div></div>`;
  }

  function requireAuth(message = '로그인하면 이 기능을 사용할 수 있습니다.') {
    if (isSignedIn()) return true;
    UI.toast(message);
    UI.showDialog('authDialog');
    return false;
  }

  function renderAccountChrome() {
    const avatar = document.getElementById('topAvatar');
    if (!avatar) return;
    if (isSignedIn()) {
      const label = currentUser?.user_metadata?.full_name || currentUser?.user_metadata?.name || currentUser?.email || 'U';
      avatar.textContent = String(label).trim()[0]?.toUpperCase() || 'U';
    } else avatar.textContent = 'K';
    document.querySelectorAll('[data-nav="library"],[data-nav="my"]').forEach((element) => element.classList.toggle('nav-locked', !isSignedIn()));
  }

  async function refreshWatchlistAvailability(force = false) {
    if (!isSignedIn() || !canUseLiveApi()) return;
    const last = Date.parse(state.availability?.lastCheckedAt || 0) || 0;
    if (!force && Date.now() - last < AVAILABILITY_CHECK_MS) return;
    const ids = Object.keys(state.library).filter((id) => state.library[id]?.watchlist).slice(0, 80);
    if (!ids.length) {
      state.availability.lastCheckedAt = new Date().toISOString();
      saveState();
      return;
    }

    const chunks = [];
    for (let i = 0; i < ids.length; i += 20) chunks.push(ids.slice(i, i + 20));
    const responses = [];
    for (const chunk of chunks) {
      try {
        const data = await apiJson(`/api/watchlist-availability?ids=${encodeURIComponent(chunk.join(','))}`);
        responses.push(...(data.results || []));
      } catch (error) {
        console.warn('availability check', error);
      }
    }

    const hadSnapshot = Object.keys(state.availability.snapshot || {}).length > 0;
    for (const result of responses) {
      const id = String(result.id);
      const currentNames = (result.providers || []).filter((provider) => provider.type === 'subscription').map((provider) => provider.name);
      const previousNames = state.availability.snapshot[id] || [];
      if (hadSnapshot) {
        const newMine = currentNames.filter((name) => !previousNames.some((prev) => normalizeProviderName(prev) === normalizeProviderName(name)) && isSubscribedProvider(name));
        if (newMine.length) {
          state.availability.newlyAvailable[id] = { providers: newMine, detectedAt: new Date().toISOString() };
        }
      }
      state.availability.snapshot[id] = currentNames;
      const cached = movie(id);
      if (cached) rememberMovie({ ...cached, providers: result.providers || cached.providers, watchLink: result.watchLink || cached.watchLink }, { persist: !!state.movieCache[id] });
    }
    state.availability.lastCheckedAt = new Date().toISOString();
    saveState();
    if (activeView === 'library') renderLibrary();
  }

  function invalidateRecommendations() {
    forYouState = { status: 'idle', seeds: [], results: [], reason: '' };
  }

  async function loadForYou(force = false) {
    if (!isSignedIn() || !canUseLiveApi()) return;
    const seeds = RECOMMENDER.topSeeds(state, 3);
    if (seeds.length < 2) {
      forYouState = { status: 'insufficient', seeds, results: [], reason: '' };
      return;
    }
    if (!force && forYouState.status === 'ready' && forYouState.seeds.join(',') === seeds.join(',')) return;
    forYouState = { status: 'loading', seeds, results: [], reason: '' };
    if (activeView === 'discover') renderDiscover();
    try {
      const data = await apiJson(`/api/movie-recommendations?seeds=${encodeURIComponent(seeds.join(','))}`);
      const results = (data.results || [])
        .map((record) => rememberMovie({ ...record, source: 'tmdb-live', detailLoaded: false }))
        .filter((record) => record && !lib(record.id));
      const profile = RECOMMENDER.buildTasteProfile(state, movie);
      forYouState = { status: 'ready', seeds, results, reason: RECOMMENDER.explanation(profile) };
    } catch (error) {
      forYouState = { status: 'error', seeds, results: [], reason: error.message || '' };
    }
    if (activeView === 'discover') renderDiscover();
  }

  async function loadRelatedRecommendations(id, force = false) {
    if (!canUseLiveApi()) return;
    const current = relatedState.get(String(id));
    if (!force && current?.status === 'ready') return;
    relatedState.set(String(id), { status: 'loading', results: [] });
    try {
      const data = await apiJson(`/api/movie-recommendations?id=${encodeURIComponent(id)}`);
      const results = (data.results || []).map((record) => rememberMovie({ ...record, source: 'tmdb-live', detailLoaded: false })).filter(Boolean);
      relatedState.set(String(id), { status: 'ready', results });
    } catch (error) {
      relatedState.set(String(id), { status: 'error', results: [] });
    }
    if (activeView === 'movie' && String(detailMovieId) === String(id)) renderMoviePage(movie(id));
  }

  function heroProviders(record) {
    const rank = { subscription: 0, free: 1, ads: 2, rent: 3, buy: 4 };
    const seen = new Set();
    return [...(record?.providers || [])]
      .sort((a, b) => (rank[a.type] ?? 9) - (rank[b.type] ?? 9))
      .filter((provider) => {
        const key = normalizeProviderName(providerConfigForName(provider.name)?.key || provider.name || provider.id);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      }).slice(0, 4);
  }

  function heroTitleClass(title) {
    const count = [...String(title || '').replace(/\s/g, '')].length;
    return count > 24 ? 'hero-title is-xlong' : count > 15 ? 'hero-title is-long' : 'hero-title';
  }

  function renderHero(record) {
    const element = document.getElementById('hero');
    if (!record) {
      element.innerHTML = '<div class="empty-state">카탈로그를 불러오지 못했습니다.</div>';
      return;
    }
    const providers = heroProviders(record);
    const title = record.logoUrl
      ? `<div class="hero-title-wrap"><img class="hero-title-logo" src="${escapeHtml(record.logoUrl)}" alt="${escapeHtml(record.title)}" onerror="this.style.display='none';this.nextElementSibling.hidden=false"><h2 class="${heroTitleClass(record.title)}" hidden>${escapeHtml(record.title)}</h2></div>`
      : `<h2 class="${heroTitleClass(record.title)}">${escapeHtml(record.title)}</h2>`;
    element.innerHTML = `
      <img class="hero-bg" src="${escapeHtml(backdrop(record))}" alt="">
      <div class="hero-content">
        <div class="hero-badges"><span class="mini-badge accent">FEATURED</span>${isInTheatres(record) ? '<span class="mini-badge">IN THEATRES</span>' : ''}</div>
        ${title}
        <div class="hero-meta"><span>${escapeHtml(record.director || 'Director —')}</span><span>·</span><span>${record.year || '—'}</span>${record.runtime ? `<span>·</span><span>${fmtRuntime(record.runtime)}</span>` : ''}</div>
        <div class="hero-watch"><span class="hero-watch-label">WHERE TO WATCH</span><div class="hero-provider-list">${providers.map((provider) => `<span class="hero-provider ${provider.type === 'subscription' && isSubscribedProvider(provider.name) ? 'is-mine' : ''}" title="${escapeHtml((providerConfigForName(provider.name)?.label || provider.name) + ' · ' + providerTypeLabel(provider.type))}"><img src="${escapeHtml(provider.logoUrl || './icons/icon.svg')}" alt=""></span>`).join('')}</div>${isInTheatres(record) ? `<span class="hero-cinema">${icon('cinema')} 극장 상영</span>` : ''}</div>
      </div>`;
    element.onclick = () => openMovie(record.id);
  }

  function card(record, variant = 'discover') {
    if (!record) return '';
    const entry = lib(record.id);
    const libraryCard = variant === 'library';
    const arthouseCard = variant === 'arthouse';
    return `<article class="movie-card ${libraryCard ? 'library-movie-card' : ''} ${arthouseCard ? 'arthouse-movie-card' : ''}" data-movie="${escapeHtml(record.id)}" tabindex="0" aria-label="${escapeHtml(record.title)} 상세보기">
      <div class="poster-wrap">
        <img src="${escapeHtml(poster(record))}" alt="${escapeHtml(record.title)} 포스터" loading="lazy" onerror="this.style.display='none'">
        <div class="poster-fallback">${escapeHtml(record.title)}</div>
        ${availabilityBadges(record)}
        <div class="card-overlay">${isSignedIn() ? `<div class="quick-actions"><button class="tiny-button ${entry ? '' : 'accent'}" data-action="save" data-id="${record.id}">${entry ? '✓' : '＋'}</button><button class="tiny-button" data-action="log" data-id="${record.id}">LOG</button></div>` : ''}</div>
      </div>
      <div class="card-info"><p class="card-title">${escapeHtml(record.title)}</p><div class="card-meta"><span>${record.year || '—'}</span>${availableOnMine(record) ? '<span class="mine-dot"></span><span>내 구독</span>' : ''}</div></div>
    </article>`;
  }

  function rowSection(title, subtitle, movies, limit = 12, variant = 'discover') {
    const list = uniqueById(movies || []).slice(0, limit);
    const rowClass = variant === 'arthouse' ? 'poster-row arthouse-poster-row' : 'poster-row';
    return `<section class="content-section"><div class="section-head"><div><h2>${escapeHtml(title)}</h2>${subtitle ? `<p>${escapeHtml(subtitle)}</p>` : ''}</div></div>${list.length ? `<div class="${rowClass}">${list.map((record) => card(record, variant)).join('')}</div>` : `<div class="empty-state"><b>아직 표시할 영화가 없습니다.</b><span>데이터가 갱신되면 이 섹션도 자동으로 채워집니다.</span></div>`}</section>`;
  }

  function curationMovies(item) {
    return (item?.movies || []).map((entry) => movie(entry.id)).filter(Boolean);
  }

  function curationHeroMovie(item) {
    return movie(item?.heroMovieId) || curationMovies(item)[0] || null;
  }

  async function hydrateCurationIds(ids, concurrency = 5) {
    let cursor = 0;
    const workers = Array.from({ length: Math.min(concurrency, ids.length) }, async () => {
      while (cursor < ids.length) {
        const index = cursor++;
        const id = ids[index];
        const record = await ensureMovieDetail(id, { persist: false }).catch(() => null);
        if (!record) curationLoadAttempts.delete(id);
      }
    });
    await Promise.all(workers);
  }

  function ensureCurationHero(item) {
    if (!item || !canUseLiveApi()) return Promise.resolve();
    const id = String(item.heroMovieId || item.movies?.[0]?.id || '');
    if (!id || movie(id) || curationLoadAttempts.has(id)) return Promise.resolve();
    const key = `hero:${item.slug}`;
    if (curationHydrations.has(key)) return curationHydrations.get(key);
    curationLoadAttempts.add(id);
    const task = ensureMovieDetail(id, { persist: false }).catch(() => null).then((record) => { if (!record) curationLoadAttempts.delete(id); return record; }).finally(() => curationHydrations.delete(key));
    curationHydrations.set(key, task);
    task.then(() => {
      if (activeView === 'discover' && (item.surface === 'discover' || item.surface === 'both')) renderDiscover();
      if (activeView === 'arthouse' && (item.surface === 'arthouse' || item.surface === 'both')) renderArthouse();
      if (activeView === 'curation' && curationSlug === item.slug) renderCurationPage(item);
    });
    return task;
  }

  function ensureCurationMovies(item) {
    if (!item || !canUseLiveApi()) return Promise.resolve();
    const missing = (item.movies || []).map((entry) => String(entry.id)).filter((id) => !movie(id) && !curationLoadAttempts.has(id));
    if (!missing.length) return Promise.resolve();
    const key = `all:${item.slug}`;
    if (curationHydrations.has(key)) return curationHydrations.get(key);
    missing.forEach((id) => curationLoadAttempts.add(id));
    const task = hydrateCurationIds(missing, 5).finally(() => curationHydrations.delete(key));
    curationHydrations.set(key, task);
    task.then(() => {
      if (activeView === 'curation' && curationSlug === item.slug) renderCurationPage(item);
    });
    return task;
  }

  function curationFeature(item, { compact = false } = {}) {
    if (!item) return '';
    ensureCurationHero(item);
    const heroMovie = curationHeroMovie(item);
    const image = heroMovie ? backdrop(heroMovie) : '';
    const filmCount = item.movies?.length || 0;
    return `<section class="curation-feature ${compact ? 'is-compact' : ''}" data-curation="${escapeHtml(item.slug)}" tabindex="0" role="link" aria-label="${escapeHtml(item.title)} 기획전 열기">
      ${image ? `<img class="curation-feature-bg" src="${escapeHtml(image)}" alt="">` : '<div class="curation-feature-placeholder"></div>'}
      <div class="curation-feature-copy">
        <p class="editorial-kicker">${escapeHtml(item.eyebrow || 'KINOSIS CURATION')}</p>
        <h2>${escapeHtml(item.title)}</h2>
        ${item.subtitle ? `<h3>${escapeHtml(item.subtitle)}</h3>` : ''}
        ${item.description ? `<p>${escapeHtml(item.description)}</p>` : ''}
        <span>${filmCount} films${item.credit ? ` · ${escapeHtml(item.credit)}` : ''}</span>
      </div>
    </section>`;
  }

  function curationRail(surface, limit = 6) {
    const items = CURATIONS.forSurface(surface).slice(0, limit);
    if (!items.length) return '';
    items.forEach(ensureCurationHero);
    if (surface === 'discover') {
      return `<section class="content-section curation-section"><div class="section-head"><div><h2>KINOSIS Curation</h2><p>영화를 한 편씩이 아니라 맥락과 흐름으로 묶어 소개합니다.</p></div></div>${curationFeature(items[0])}</section>`;
    }
    return `<section class="content-section curation-section"><div class="section-head"><div><h2>Curations</h2><p>작가, 시대, 주제를 따라 이어지는 KINOSIS의 편집 기획전.</p></div></div><div class="curation-rail">${items.map((item) => curationFeature(item, { compact: true })).join('')}</div></section>`;
  }

  function myStreamingSection(title = '내 구독 서비스에서', source = null, variant = 'discover') {
    if (!isSignedIn()) return '';
    const list = (source || myStreamingMovies()).filter(availableOnMine);
    return list.length ? rowSection(title, '내가 이미 구독 중인 서비스에서 바로 볼 수 있는 영화.', list, 14, variant) : '';
  }

  function renderDiscover() {
    renderHero(CATALOG.featured || (CATALOG.sections?.trending || [])[0]);
    let html = '';
    if (isSignedIn()) {
      if (forYouState.status === 'ready' && forYouState.results.length) {
        html += rowSection('For You', forYouState.reason || '높게 평가한 영화를 바탕으로 고른 추천.', forYouState.results, 12);
      } else if (forYouState.status === 'loading') {
        html += `<section class="content-section"><div class="section-head"><div><h2>For You</h2><p>내 기록을 바탕으로 추천을 구성하고 있습니다.</p></div></div><div class="recommendation-loading">추천을 준비하는 중…</div></section>`;
      }
    }
    html += rowSection('지금 극장에서', '현재 한국 상영 목록. 포스터의 필름 아이콘으로도 표시합니다.', CATALOG.sections?.theatres || [], 14);
    if (isSignedIn()) html += myStreamingSection();
    else html += rowSection('스트리밍에서', '대한민국 지역 구독형 스트리밍 제공작.', CATALOG.sections?.streaming || [], 14);
    html += curationRail('discover', 1);
    html += rowSection('이번 주 주목할 영화', '최근 화제작과 신작을 가볍게 훑어봅니다.', CATALOG.sections?.trending || [], 14);
    html += rowSection('높은 평가를 받은 영화', 'TMDB 사용자 평가 기반.', CATALOG.sections?.rated || [], 14);
    document.getElementById('discoverContent').innerHTML = html;
  }

  function renderArthouse() {
    const art = artPool();
    const heroMovie = art.find((record) => Number(record.year || 0) >= new Date().getFullYear() - 2) || art[0] || CATALOG.featured;
    const hero = document.getElementById('arthouseHero');
    if (heroMovie) {
      const info = artInfo(heroMovie);
      hero.innerHTML = `<img class="arthouse-hero-bg" src="${escapeHtml(backdrop(heroMovie))}" alt=""><div class="arthouse-hero-content"><span class="editorial-kicker">ARTHOUSE FEATURED</span><h2>${escapeHtml(heroMovie.title)}</h2><p>${escapeHtml(heroMovie.tagline || heroMovie.overview || '작가와 영화사적 맥락을 중심으로 다시 보는 영화.')}</p><div class="art-hero-reasons">${(info.reasons || []).map((reason) => `<span>${escapeHtml(reason)}</span>`).join('')}</div></div>`;
      hero.onclick = () => openMovie(heroMovie.id);
    }

    const now = new Date().getFullYear();
    const artTheatres = artTheatrePool();
    const newNoteworthy = art.filter((record) => Number(record.year || 0) >= now - 3).sort((a, b) => Number(b.year || 0) - Number(a.year || 0) || artInfo(b).score - artInfo(a).score);
    const modern = art.filter((record) => Number(record.year || 0) >= 1990 && Number(record.year || 0) < now - 2);
    const archive = art.filter((record) => Number(record.year || 0) > 0 && Number(record.year || 0) < 1990);

    let html = '';
    html += curationRail('arthouse', 6);
    html += rowSection('지금 극장에서 만나는 Arthouse', '현재 상영작 중 Arthouse 성향이 높은 작품을 우선해 보여줍니다.', artTheatres, 12, 'arthouse');
    html += rowSection('New & Noteworthy', '최근 몇 년 사이의 작가주의·독립·영화제 계열 후보.', newNoteworthy, 16, 'arthouse');
    html += rowSection('Modern Masters', '1990년 이후의 작가 중심 영화.', modern, 16, 'arthouse');
    html += rowSection('From the Archive', '고전과 영화사적 캐논을 다시 꺼내봅니다.', archive, 16, 'arthouse');
    if (isSignedIn()) html += myStreamingSection('내 구독에서 볼 수 있는 Arthouse', art, 'arthouse');
    document.getElementById('arthouseContent').innerHTML = html;
  }

  function renderCollectionsSide() {
    const element = document.getElementById('collectionSideLinks');
    if (!element) return;
    element.innerHTML = state.collections.map((collection) => `<button class="side-link" data-collection="${escapeHtml(collection.id)}">${icon('folder')}${escapeHtml(collection.name)}</button>`).join('');
  }

  function libraryStats() {
    const films = allSavedMovies();
    return {
      films: films.length,
      watched: films.filter((record) => lib(record.id)?.watched).length,
      watchlist: films.filter((record) => lib(record.id)?.watchlist).length,
      favorites: films.filter((record) => lib(record.id)?.favorite).length,
    };
  }

  function collectionCover(collection) {
    const cover = movie(collection.coverMovieId) || movie(collection.movieIds?.[0]);
    return cover ? backdrop(cover) : null;
  }

  function collectionCards() {
    const dynamic = `<article class="collection-card dynamic-collection" data-dynamic="my-streaming"><p class="eyebrow">DYNAMIC</p><h3>Watchlist · 내 구독</h3><p>${watchlistAvailable().length} films · 자동 갱신</p></article>`;
    return dynamic + state.collections.map((collection) => {
      const cover = collectionCover(collection);
      return `<article class="collection-card rich-collection" data-collection-card="${escapeHtml(collection.id)}">${cover ? `<img src="${escapeHtml(cover)}" alt="">` : ''}<div class="collection-card-shade"></div><div class="collection-card-copy"><p class="eyebrow">COLLECTION</p><h3>${escapeHtml(collection.name)}</h3><p>${escapeHtml(collection.description || `${collection.movieIds.filter((id) => movie(id)).length} films`)}</p></div></article>`;
    }).join('');
  }

  function libraryHeader(title, summary, extras = '') {
    return `<header class="library-header"><div><p class="eyebrow">LIBRARY</p><h1>${escapeHtml(title)}</h1><p>${escapeHtml(summary)}</p></div><div class="library-header-actions">${extras}<button class="secondary-button" id="librarySearchButton">${icon('search')} 영화 찾기</button></div></header>`;
  }

  function renderLibraryHome() {
    const stats = libraryStats();
    const recent = latestUniqueMovies();
    const upNext = watchlistAvailable();
    const favorites = allSavedMovies().filter((record) => lib(record.id)?.favorite);
    const newly = recentNewAvailability();
    return `${libraryHeader('내 영화 서가', '저장한 영화를 다시 찾고, 관리하고, 다음 감상을 고르는 공간입니다.')}
      <div class="library-stats"><div class="library-stat"><strong>${stats.films}</strong><span>FILMS</span></div><div class="library-stat"><strong>${stats.watched}</strong><span>WATCHED</span></div><div class="library-stat"><strong>${stats.watchlist}</strong><span>WATCHLIST</span></div><div class="library-stat"><strong>${stats.favorites}</strong><span>FAVORITES</span></div></div>
      ${newly.length ? rowSection('새로 내 구독에서 볼 수 있어요', 'Watchlist에 있던 영화의 구독 제공처가 새로 확인됐습니다.', newly, 9, 'library') : ''}
      ${rowSection('최근 본 영화', '최근 감상 기록 순.', recent, 9, 'library')}
      ${rowSection('다음에 볼 영화', 'Watchlist 중 내 구독 서비스에서 바로 볼 수 있는 영화.', upNext, 9, 'library')}
      <section class="content-section"><div class="section-head"><div><h2>Collections</h2><p>직접 만든 묶음과 자동 컬렉션.</p></div><button class="section-action" id="newCollectionButton">＋ New</button></div><div class="collection-grid">${collectionCards()}</div></section>
      ${favorites.length ? rowSection('Favorites', '다시 꺼내보고 싶은 영화.', favorites, 9, 'library') : ''}`;
  }

  function filterLibrary(list) {
    let out = [...list];
    const query = libraryFilter.q.trim().toLocaleLowerCase('ko-KR');
    if (query) out = out.filter((record) => [record.title, record.originalTitle, record.director, ...genreNames(record)].filter(Boolean).join(' ').toLocaleLowerCase('ko-KR').includes(query));
    if (libraryFilter.status === 'watched') out = out.filter((record) => lib(record.id)?.watched);
    else if (libraryFilter.status === 'unwatched') out = out.filter((record) => !lib(record.id)?.watched);
    else if (libraryFilter.status === 'watchlist') out = out.filter((record) => lib(record.id)?.watchlist);
    else if (libraryFilter.status === 'favorite') out = out.filter((record) => lib(record.id)?.favorite);
    if (libraryFilter.rating !== 'all') out = out.filter((record) => (lib(record.id)?.rating || 0) >= Number(libraryFilter.rating));
    if (libraryFilter.availability === 'mine') out = out.filter(availableOnMine);
    if (libraryFilter.genre !== 'all') out = out.filter((record) => genreNames(record).includes(libraryFilter.genre));
    if (libraryFilter.arthouse === 'arthouse') out = out.filter(isArthouse);
    if (libraryFilter.decade !== 'all') {
      const decade = Number(libraryFilter.decade);
      out = out.filter((record) => Number(record.year) >= decade && Number(record.year) < decade + 10);
    }
    if (libraryFilter.sort === 'title') out.sort((a, b) => a.title.localeCompare(b.title, 'ko'));
    else if (libraryFilter.sort === 'rating') out.sort((a, b) => (lib(b.id)?.rating || 0) - (lib(a.id)?.rating || 0));
    else if (libraryFilter.sort === 'year') out.sort((a, b) => (b.year || 0) - (a.year || 0));
    else if (libraryFilter.sort === 'watched') out.sort((a, b) => String(logsForMovie(b.id)[0]?.watchedAt || '').localeCompare(String(logsForMovie(a.id)[0]?.watchedAt || '')));
    else out.sort((a, b) => String(lib(b.id)?.savedAt || '').localeCompare(String(lib(a.id)?.savedAt || '')));
    return out;
  }

  function libraryToolbar(list) {
    const genres = [...new Set(list.flatMap(genreNames))].sort((a, b) => a.localeCompare(b, 'ko'));
    const decades = [...new Set(list.map((record) => Math.floor(Number(record.year || 0) / 10) * 10).filter(Boolean))].sort((a, b) => b - a);
    return `<div class="library-toolbar"><input id="libraryQuery" value="${escapeHtml(libraryFilter.q)}" placeholder="제목 · 감독 · 장르"><select id="libraryStatus"><option value="all">상태 전체</option><option value="watched" ${libraryFilter.status === 'watched' ? 'selected' : ''}>본 영화</option><option value="unwatched" ${libraryFilter.status === 'unwatched' ? 'selected' : ''}>안 본 영화</option><option value="watchlist" ${libraryFilter.status === 'watchlist' ? 'selected' : ''}>Watchlist</option><option value="favorite" ${libraryFilter.status === 'favorite' ? 'selected' : ''}>Favorites</option></select><select id="libraryAvailability"><option value="all">감상처 전체</option><option value="mine" ${libraryFilter.availability === 'mine' ? 'selected' : ''}>내 구독에서 가능</option></select><select id="libraryGenre"><option value="all">장르 전체</option>${genres.map((genre) => `<option ${libraryFilter.genre === genre ? 'selected' : ''}>${escapeHtml(genre)}</option>`).join('')}</select><select id="libraryDecade"><option value="all">연대 전체</option>${decades.map((decade) => `<option value="${decade}" ${String(libraryFilter.decade) === String(decade) ? 'selected' : ''}>${decade}s</option>`).join('')}</select><select id="libraryArthouse"><option value="all">전체 영화</option><option value="arthouse" ${libraryFilter.arthouse === 'arthouse' ? 'selected' : ''}>Arthouse</option></select><select id="librarySort"><option value="recent" ${libraryFilter.sort === 'recent' ? 'selected' : ''}>최근 추가</option><option value="watched" ${libraryFilter.sort === 'watched' ? 'selected' : ''}>최근 감상</option><option value="title" ${libraryFilter.sort === 'title' ? 'selected' : ''}>제목</option><option value="rating" ${libraryFilter.sort === 'rating' ? 'selected' : ''}>내 평점</option><option value="year" ${libraryFilter.sort === 'year' ? 'selected' : ''}>개봉연도</option></select><div class="view-toggle"><button class="${libraryView === 'grid' ? 'is-active' : ''}" data-library-view="grid" aria-label="그리드 보기">${icon('grid')}</button><button class="${libraryView === 'list' ? 'is-active' : ''}" data-library-view="list" aria-label="목록 보기">${icon('list')}</button></div></div>`;
  }

  function libraryListRows(list) {
    return `<div class="library-list">${list.map((record) => {
      const entry = lib(record.id);
      const last = logsForMovie(record.id)[0];
      return `<div class="library-row" data-movie="${record.id}" tabindex="0"><img src="${escapeHtml(poster(record))}" alt=""><div><div class="library-row-title">${escapeHtml(record.title)}</div><div class="library-row-sub">${escapeHtml(record.director || '')} · ${genreNames(record).slice(0, 2).map(escapeHtml).join(' · ')}</div></div><div class="library-row-cell">${record.year || '—'}</div><div class="library-row-cell rating">${entry?.rating ? `★ ${entry.rating}` : '—'}</div><div class="library-row-cell">${last ? formatDate(last.watchedAt) : '—'}</div><div class="library-row-cell">${availableOnMine(record) ? '내 구독에서 가능' : isInTheatres(record) ? '극장 상영' : '—'}</div></div>`;
    }).join('')}</div>`;
  }

  function listPage(title, summary, list) {
    const filtered = filterLibrary(list);
    return `${libraryHeader(title, `${summary} · ${filtered.length}/${list.length}`)}${libraryToolbar(list)}${filtered.length ? (libraryView === 'grid' ? `<div class="library-grid">${filtered.map((record) => card(record, 'library')).join('')}</div>` : libraryListRows(filtered)) : `<div class="empty-state"><b>조건에 맞는 영화가 없습니다.</b><span>필터를 바꾸거나 영화를 더 저장해보세요.</span></div>`}`;
  }

  function renderCollectionDetail(collection) {
    const movies = collection.movieIds.map(movie).filter(Boolean);
    const cover = collectionCover(collection);
    return `${libraryHeader(collection.name, collection.description || '직접 만든 컬렉션', `<button class="secondary-button" data-edit-collection="${escapeHtml(collection.id)}">${icon('edit')} 편집</button>`)}
      <section class="collection-detail-hero ${cover ? 'has-cover' : ''}">${cover ? `<img src="${escapeHtml(cover)}" alt="">` : ''}<div><p class="eyebrow">PERSONAL COLLECTION</p><h2>${escapeHtml(collection.name)}</h2><p>${escapeHtml(collection.description || `${movies.length}편의 영화`)}</p></div></section>
      ${movies.length ? `<div class="collection-order-list">${movies.map((record, index) => `<div class="collection-order-row"><button class="collection-film-main" data-movie="${record.id}"><img src="${escapeHtml(poster(record))}" alt=""><span><b>${escapeHtml(record.title)}</b><small>${record.year || '—'} · ${escapeHtml(record.director || '')}</small></span></button><div class="collection-order-actions"><button data-collection-move="up" data-collection-id="${escapeHtml(collection.id)}" data-index="${index}" ${index === 0 ? 'disabled' : ''}>↑</button><button data-collection-move="down" data-collection-id="${escapeHtml(collection.id)}" data-index="${index}" ${index === movies.length - 1 ? 'disabled' : ''}>↓</button><button data-collection-remove="${record.id}" data-collection-id="${escapeHtml(collection.id)}">×</button></div></div>`).join('')}</div>` : '<div class="empty-state"><b>아직 영화가 없습니다.</b><span>영화 상세에서 Collection에 추가해보세요.</span></div>'}`;
  }

  function renderLibrary() {
    const content = document.getElementById('libraryContent');
    if (!content) return;
    if (!isSignedIn()) {
      content.innerHTML = gateHtml('Library');
      document.getElementById('libraryCount').textContent = '0';
      return;
    }
    document.getElementById('libraryCount').textContent = allSavedMovies().length;
    renderCollectionsSide();
    document.querySelectorAll('[data-library]').forEach((button) => button.classList.toggle('is-active', button.dataset.library === libraryMode));
    if (libraryMode === 'home') content.innerHTML = renderLibraryHome();
    else if (libraryMode === 'all') content.innerHTML = listPage('All Films', '저장한 전체 영화', allSavedMovies());
    else if (libraryMode === 'watchlist') content.innerHTML = listPage('Watchlist', '보고 싶은 영화', allSavedMovies().filter((record) => lib(record.id)?.watchlist));
    else if (libraryMode === 'favorites') content.innerHTML = listPage('Favorites', 'Favorite로 표시한 영화', allSavedMovies().filter((record) => lib(record.id)?.favorite));
    else if (libraryMode === 'collections') content.innerHTML = `${libraryHeader('Collections', '영화를 내 방식으로 묶어 관리합니다.', '<button class="primary-button" id="newCollectionButton">＋ New Collection</button>')}<div class="collection-grid">${collectionCards()}</div>`;
    else if (libraryMode === 'dynamic:my-streaming') content.innerHTML = listPage('Watchlist · 내 구독', '지금 내 구독 서비스에서 볼 수 있는 Watchlist', watchlistAvailable());
    else if (libraryMode.startsWith('collection:')) {
      const collection = state.collections.find((item) => item.id === libraryMode.split(':')[1]);
      content.innerHTML = collection ? renderCollectionDetail(collection) : renderLibraryHome();
    }
  }

  function profileCounts() {
    return {
      films: Object.keys(state.library).length,
      ratings: Object.values(state.library).filter((item) => item.rating).length,
      reviews: state.logs.filter((log) => String(log.review || '').trim()).length,
      collections: state.collections.length,
    };
  }

  function renderProfileCard() {
    const element = document.getElementById('profileCard');
    if (!element) return;
    if (!isSignedIn()) {
      element.innerHTML = '';
      return;
    }
    const counts = profileCounts();
    const recent = latestUniqueMovies()[0];
    const name = state.profile.name || currentUser?.user_metadata?.full_name || currentUser?.email?.split('@')[0] || 'KINOSIS User';
    const initial = name[0]?.toUpperCase() || 'K';
    element.innerHTML = `<section class="profile-hero"><div class="profile-cover">${recent ? `<img src="${escapeHtml(backdrop(recent))}" alt="">` : ''}</div><div class="profile-main"><div class="profile-identity"><div class="profile-left"><div class="profile-avatar">${escapeHtml(initial)}</div><div class="profile-copy"><h1>${escapeHtml(name)}</h1><p>${escapeHtml(state.profile.bio || '')}</p><p class="profile-email">${escapeHtml(currentUser?.email || '')}</p></div></div><button class="secondary-button" id="editProfile">${icon('edit')} 프로필 수정</button></div><div class="profile-counts"><div class="profile-count"><strong>${counts.films}</strong><span>영화</span></div><div class="profile-count"><strong>${counts.ratings}</strong><span>평가</span></div><div class="profile-count"><strong>${counts.reviews}</strong><span>리뷰</span></div><div class="profile-count"><strong>${counts.collections}</strong><span>컬렉션</span></div></div></div></section>`;
  }

  function viewingTimeline(logs = latestLogs()) {
    return `<div class="review-list viewing-timeline">${logs.map((log) => {
      const record = movie(log.movieId);
      if (!record) return '';
      const count = logsForMovie(record.id).length;
      return `<article class="review-row timeline-row"><button class="review-main" data-movie="${record.id}"><img src="${escapeHtml(poster(record))}" alt=""><div><div class="review-title">${escapeHtml(record.title)}</div><div class="review-meta">${formatDate(log.watchedAt)}${log.rewatch || count > 1 ? ' · ↻ REWATCH' : ''}${log.rating ? ` · ★ ${log.rating}` : ''}</div>${log.review ? `<div class="review-text">${escapeHtml(log.review)}</div>` : '<div class="review-text muted-review">감상 기록</div>'}</div></button><div class="review-actions"><button class="secondary-button mini" data-log-edit="${escapeHtml(log.id)}">수정</button><button class="ghost-icon danger" data-log-delete="${escapeHtml(log.id)}">×</button></div></article>`;
    }).join('')}</div>`;
  }

  function calendarHtml() {
    const year = calendarCursor.getFullYear();
    const month = calendarCursor.getMonth();
    const first = new Date(year, month, 1);
    const days = new Date(year, month + 1, 0).getDate();
    const offset = first.getDay();
    const logsByDate = {};
    for (const log of state.logs) {
      if (!String(log.watchedAt).startsWith(`${year}-${String(month + 1).padStart(2, '0')}`)) continue;
      (logsByDate[log.watchedAt] || (logsByDate[log.watchedAt] = [])).push(log);
    }
    let cells = '';
    for (let i = 0; i < offset; i++) cells += '<div class="calendar-cell is-empty"></div>';
    for (let day = 1; day <= days; day++) {
      const date = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const logs = logsByDate[date] || [];
      const firstLog = logs[0];
      const record = firstLog ? movie(firstLog.movieId) : null;
      cells += `<button class="calendar-cell ${date === isoDate(new Date()) ? 'today' : ''} ${logs.length ? 'has-logs' : ''}" ${logs.length ? `data-calendar-day="${date}"` : 'disabled'}><span class="day-number">${day}</span>${record ? `<img class="calendar-poster" src="${escapeHtml(poster(record))}" alt="${escapeHtml(record.title)}">` : ''}${logs.length > 1 ? `<span class="calendar-count">${logs.length}</span>` : ''}</button>`;
    }
    return `<div class="calendar-head"><div><p class="eyebrow">VIEWING CALENDAR</p><h2>${year}년 ${month + 1}월</h2></div><div class="calendar-controls"><button class="secondary-button" data-cal="prev">‹</button><button class="secondary-button" data-cal="next">›</button></div></div><div class="calendar-grid">${['일', '월', '화', '수', '목', '금', '토'].map((label) => `<div class="calendar-weekday">${label}</div>`).join('')}${cells}</div>`;
  }

  function statsHtml() {
    const films = allSavedMovies();
    const ratings = films.map((record) => lib(record.id)?.rating).filter(Boolean);
    const average = ratings.length ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(2) : '—';
    const hours = Math.round(state.logs.reduce((sum, log) => sum + (movie(log.movieId)?.runtime || 0), 0) / 60);
    const distribution = [5, 4.5, 4, 3.5, 3, 2.5, 2, 1.5, 1, 0.5].map((value) => ({ value, count: ratings.filter((rating) => rating === value).length }));
    const max = Math.max(1, ...distribution.map((row) => row.count));
    return `<div class="stat-grid"><div class="stat-card"><strong>${state.logs.length}</strong><span>감상 기록</span></div><div class="stat-card"><strong>${hours}h</strong><span>기록된 러닝타임</span></div><div class="stat-card"><strong>${average}</strong><span>현재 평균 평점</span></div></div><div class="my-section"><h2>평점 분포</h2><div class="rating-bars">${distribution.map((row) => `<div class="rating-bar"><span>★ ${row.value}</span><div class="rating-track"><div class="rating-fill" style="width:${row.count / max * 100}%"></div></div><b>${row.count}</b></div>`).join('')}</div></div>`;
  }

  function settingsHtml() {
    const syncClass = syncState.status === 'online' ? 'online' : syncState.status === 'offline' ? 'offline' : 'pending';
    return `<div class="settings-grid"><section class="settings-card"><h3>구독 중인 서비스</h3><p>Discover와 Library에서 내 구독으로 볼 수 있는 영화를 강조합니다.</p><div class="subscription-grid">${PROVIDERS.map((provider) => `<div class="subscription"><span>${escapeHtml(provider.label)}</span><button data-subscription="${escapeHtml(provider.key)}">${isSubscriptionEnabled(provider.key) ? '구독 중' : '등록'}</button></div>`).join('')}</div></section><section class="settings-card"><h3>Cloud Sync</h3><p><span class="sync-pill"><span class="sync-dot ${syncClass}"></span>${escapeHtml(syncState.status.toUpperCase())}</span><br>${escapeHtml(currentUser?.email || '')}<br>Last sync · ${formatDateTime(state.meta?.lastSyncedAt)}</p><button class="secondary-button" id="syncNowButton">지금 동기화</button><button class="secondary-button" id="accountExportButton">내 데이터 내보내기</button><button class="secondary-button" id="signOutButton">로그아웃</button></section><section class="settings-card"><h3>Import & Portability</h3><p>KINOSIS JSON 또는 Letterboxd CSV에서 기록을 가져올 수 있습니다.</p><button class="secondary-button" id="openLetterboxdImport">Letterboxd CSV 가져오기</button><button class="secondary-button" id="openAboutFromSettings">KINOSIS JSON / Data sources</button></section></div>`;
  }

  function renderMy() {
    const content = document.getElementById('myContent');
    if (!content) return;
    if (!isSignedIn()) {
      document.getElementById('profileCard').innerHTML = '';
      content.innerHTML = gateHtml('MY');
      return;
    }
    renderProfileCard();
    document.querySelectorAll('[data-my]').forEach((button) => button.classList.toggle('is-active', button.dataset.my === myMode));
    if (myMode === 'overview') {
      const recent = latestUniqueMovies();
      const reviews = latestLogs().filter((log) => String(log.review || '').trim());
      content.innerHTML = `${recent.length ? rowSection('최근 본 영화', '내 최근 감상 기록.', recent, 8, 'library') : ''}${reviews.length ? `<section class="my-section"><div class="section-head"><div><h2>최근 리뷰</h2><p>Diary와 Review를 하나의 감상 기록으로 관리합니다.</p></div><button class="section-action" data-my="reviews">전체 보기</button></div>${viewingTimeline(reviews.slice(0, 4))}</section>` : ''}<section class="my-section">${calendarHtml()}</section>`;
    } else if (myMode === 'reviews') {
      content.innerHTML = `<section class="my-section"><div class="section-head"><div><h2>Reviews</h2><p>평점, 리뷰, 재관람을 시간순으로 한곳에서 관리합니다.</p></div></div>${state.logs.length ? viewingTimeline() : '<div class="empty-state"><b>아직 감상 기록이 없습니다.</b><span>영화를 본 뒤 LOG로 기록해보세요.</span></div>'}</section>`;
    } else if (myMode === 'stats') {
      content.innerHTML = `<section class="my-section">${statsHtml()}</section>`;
    } else {
      content.innerHTML = `<section class="my-section">${settingsHtml()}</section>`;
    }
  }

  function detailProviderGroups(record) {
    const groups = { subscription: [], free: [], ads: [], rent: [], buy: [] };
    (record.providers || []).forEach((provider) => (groups[provider.type] || (groups[provider.type] = [])).push(provider));
    const group = (key, label) => groups[key]?.length ? `<div class="provider-group"><h4>${label}</h4><div class="providers">${groups[key].map((provider) => `<span class="provider-pill ${key === 'subscription' && isSubscribedProvider(provider.name) ? 'owned' : ''}">${provider.logoUrl ? `<img class="provider-inline-logo" src="${escapeHtml(provider.logoUrl)}" alt="">` : ''}${escapeHtml(providerConfigForName(provider.name)?.label || provider.name)} · ${escapeHtml(providerTypeLabel(key))}</span>`).join('')}</div></div>` : '';
    return group('subscription', 'SUBSCRIPTION') + group('free', 'FREE') + group('ads', 'WITH ADS') + group('rent', 'RENT') + group('buy', 'BUY');
  }

  function localRelatedMovies(record) {
    const genres = new Set(genreNames(record));
    return (CATALOG.movies || []).filter((item) => String(item.id) !== String(record.id) && genreNames(item).some((genre) => genres.has(genre))).slice(0, 10);
  }

  function relatedMovies(record) {
    const remote = relatedState.get(String(record.id));
    return remote?.status === 'ready' && remote.results.length ? remote.results : localRelatedMovies(record);
  }

  function viewingHistoryHtml(record) {
    const logs = logsForMovie(record.id);
    if (!logs.length) return '<div class="activity-empty">아직 감상 기록이 없습니다.</div>';
    return `<div class="detail-viewing-history">${logs.slice(0, 4).map((log, index) => `<button class="history-log" data-log-edit="${escapeHtml(log.id)}"><span>${formatDate(log.watchedAt)}${log.rewatch || index > 0 ? ' · ↻' : ''}</span><b>${log.rating ? `★ ${log.rating}` : '평점 없음'}</b>${log.review ? `<small>${escapeHtml(log.review)}</small>` : ''}</button>`).join('')}</div>`;
  }

  function renderMoviePage(record) {
    if (!record) return;
    const entry = lib(record.id);
    const art = artInfo(record);
    const logs = logsForMovie(record.id);
    const last = logs[0];
    const related = relatedMovies(record);
    const availabilityUpdated = record.source === 'tmdb-live' ? 'Live lookup' : formatDateTime(CATALOG.updatedAt);
    document.title = `${record.title} — KINOSIS`;
    document.getElementById('moviePage').innerHTML = `<div class="movie-page-back"><button data-movie-back>${icon('back')} ${previousView === 'curation' ? '기획전' : previousView === 'arthouse' ? 'Arthouse' : previousView === 'library' ? 'Library' : previousView === 'my' ? 'My' : 'Discover'}로 돌아가기</button><button class="share-link" data-share-movie="${record.id}">링크 복사</button></div><section class="detail-hero"><img class="detail-hero-bg" src="${escapeHtml(backdrop(record))}" alt=""><div class="detail-hero-inner"><img class="detail-poster" src="${escapeHtml(poster(record))}" alt="${escapeHtml(record.title)} 포스터"><div><p class="eyebrow">${isInTheatres(record) ? 'IN THEATRES' : isArthouse(record) ? 'ARTHOUSE' : 'FILM'}</p><h1 class="detail-title">${escapeHtml(record.title)}</h1>${record.originalTitle && record.originalTitle !== record.title ? `<div class="detail-original">${escapeHtml(record.originalTitle)}</div>` : ''}<div class="detail-meta"><span>${escapeHtml(record.director || 'Director —')}</span><span>·</span><span>${record.year || '—'}</span>${record.runtime ? `<span>·</span><span>${fmtRuntime(record.runtime)}</span>` : ''}<span>·</span><span>TMDB ★ ${record.voteAverage ? Number(record.voteAverage).toFixed(1) : '—'}</span></div><div class="detail-actions"><button class="primary-button detail-action" data-action="log" data-id="${record.id}">LOG</button><button class="secondary-button detail-action" data-action="watchlist" data-id="${record.id}">${entry?.watchlist ? '✓ Watchlist' : '＋ Watchlist'}</button><button class="secondary-button detail-action" data-action="favorite" data-id="${record.id}">${entry?.favorite ? '♥ Favorite' : '♡ Favorite'}</button><button class="secondary-button detail-action" data-action="collection-add" data-id="${record.id}">＋ Collection</button>${!entry ? `<button class="ghost-button detail-action" data-action="save" data-id="${record.id}">Library에만 저장</button>` : ''}</div></div></div></section><div class="detail-body"><div><section class="detail-block"><h2>About</h2><p class="detail-overview">${escapeHtml(record.overview || '줄거리 정보가 없습니다.')}</p><div class="detail-facts"><div class="detail-fact"><span>Director</span><b>${escapeHtml(record.director || '—')}</b></div><div class="detail-fact"><span>Genres</span><b>${genreNames(record).map(escapeHtml).join(' · ') || '—'}</b></div>${record.cast?.length ? `<div class="detail-fact"><span>Cast</span><b class="cast-links">${record.cast.slice(0, 10).map((person) => `<button data-person-id="${escapeHtml(person.id || '')}" data-person-name="${escapeHtml(person.name || person)}">${escapeHtml(person.name || person)}</button>`).join('<span> · </span>')}</b></div>` : ''}</div>${art.isArt ? `<div class="arthouse-note"><b>ARTHOUSE</b><div>${(art.reasons || []).map((reason) => `<span class="art-reason">${escapeHtml(reason)}</span>`).join('')}</div></div>` : ''}</section>${related.length ? `<section class="my-section">${rowSection('비슷한 영화', 'TMDB 추천·유사도 결과를 KINOSIS가 이어서 보여줍니다.', related, 10)}</section>` : ''}</div><aside><section class="detail-block"><h2>Where to Watch</h2><div class="provider-groups">${detailProviderGroups(record) || '<div class="activity-empty">현재 KR 제공처 정보가 없습니다.</div>'}</div><p class="activity-empty">Updated · ${escapeHtml(availabilityUpdated)}<br>JustWatch via TMDB · 실제 제공 여부와 요금은 각 서비스에서 최종 확인하세요.</p></section><section class="detail-block"><h2>My Activity</h2>${isSignedIn() ? (entry ? `<div class="my-activity"><div class="activity-rating">${entry.rating ? `★ ${entry.rating}` : '평점 없음'}</div>${entry.review ? `<div class="activity-review">${escapeHtml(entry.review)}</div>` : ''}<div class="activity-empty">${logs.length ? `${logs.length}회 감상 · 최근 ${formatDate(last.watchedAt)}` : 'Library에 저장됨'}</div>${viewingHistoryHtml(record)}</div>` : '<div class="activity-empty">아직 이 영화에 대한 기록이 없습니다.</div>') : '<div class="activity-empty">로그인하면 평점, Reviews, Watchlist와 컬렉션을 기록할 수 있습니다.</div>'}</section></aside></div>`;
  }

  function renderCurationPage(item) {
    if (!item) return;
    ensureCurationMovies(item);
    const films = curationMovies(item);
    const heroMovie = curationHeroMovie(item);
    const heroImage = heroMovie ? backdrop(heroMovie) : '';
    const sourceLabel = item.surface === 'discover' ? 'Discover' : item.surface === 'both' ? 'Discover / Arthouse' : 'Arthouse';
    document.title = `${item.title} — KINOSIS`;
    document.getElementById('curationPage').innerHTML = `<div class="movie-page-back"><button data-curation-back>${icon('back')} ${curationPreviousView === 'discover' ? 'Discover' : 'Arthouse'}로 돌아가기</button><button class="share-link" data-share-curation="${escapeHtml(item.slug)}">링크 복사</button></div>
      <section class="curation-page-hero">${heroImage ? `<img class="curation-page-bg" src="${escapeHtml(heroImage)}" alt="">` : ''}<div class="curation-page-copy"><p class="editorial-kicker">${escapeHtml(item.eyebrow || 'KINOSIS CURATION')}</p><h1>${escapeHtml(item.title)}</h1>${item.subtitle ? `<h2>${escapeHtml(item.subtitle)}</h2>` : ''}${item.description ? `<p>${escapeHtml(item.description)}</p>` : ''}<div class="curation-page-meta"><span>${item.movies?.length || 0} films</span><span>${escapeHtml(sourceLabel)}</span>${item.credit ? `<span>${escapeHtml(item.credit)}</span>` : ''}</div></div></section>
      <section class="content-section curation-film-section"><div class="section-head"><div><h2>Films</h2><p>기획전의 순서 자체가 편집 의도입니다.</p></div></div>${films.length ? `<div class="curation-film-grid">${films.map((record) => card(record, item.surface === 'arthouse' ? 'arthouse' : 'discover')).join('')}</div>` : `<div class="empty-state"><b>영화 정보를 불러오는 중입니다.</b><span>TMDB 상세정보가 준비되면 자동으로 채워집니다.</span></div>`}</section>`;
  }

  function routeUrlForCuration(slug, from) {
    const url = new URL(location.href);
    url.search = '';
    url.searchParams.set('curation', String(slug));
    if (from && from !== 'arthouse') url.searchParams.set('from', from);
    return `${url.pathname}${url.search}`;
  }

  async function openCuration(slug, { route = 'push', from = null } = {}) {
    const item = CURATIONS.get(slug);
    if (!item) {
      UI.toast('기획전을 찾지 못했습니다.');
      return;
    }
    const requestedOrigin = ['discover', 'arthouse'].includes(from) ? from : null;
    curationPreviousView = requestedOrigin || (activeView === 'discover' ? 'discover' : activeView === 'arthouse' ? 'arthouse' : item.surface === 'discover' ? 'discover' : 'arthouse');
    scrollPositions.set(curationPreviousView, window.scrollY);
    curationSlug = item.slug;
    setView('curation', { skipGate: true, keepScroll: false, route: 'none' });
    if (canUseLiveApi()) {
      const historyValue = { kinRoute: true, view: 'curation', curationSlug: item.slug, from: curationPreviousView };
      if (route === 'replace') history.replaceState(historyValue, '', routeUrlForCuration(item.slug, curationPreviousView));
      else if (route === 'push') history.pushState(historyValue, '', routeUrlForCuration(item.slug, curationPreviousView));
    }
    renderCurationPage(item);
    await ensureCurationMovies(item);
  }

  function backFromCuration() {
    if (canUseLiveApi() && history.state?.kinRoute && history.length > 1) history.back();
    else setView(curationPreviousView || 'arthouse', { skipGate: true, keepScroll: true, route: 'replace' });
  }

  function routeUrlForView(view) {
    const url = new URL(location.href);
    url.search = '';
    if (view !== 'discover') url.searchParams.set('view', view);
    return `${url.pathname}${url.search}${url.hash}`;
  }

  function routeUrlForMovie(id, from) {
    const url = new URL(location.href);
    url.search = '';
    url.searchParams.set('movie', String(id));
    if (from && from !== 'discover') url.searchParams.set('from', from);
    if (from === 'curation' && curationSlug) url.searchParams.set('fromCuration', curationSlug);
    return `${url.pathname}${url.search}`;
  }

  function updateHistoryForView(view, mode = 'push') {
    if (!canUseLiveApi() || mode === 'none') return;
    const stateValue = { kinRoute: true, view };
    if (mode === 'replace') history.replaceState(stateValue, '', routeUrlForView(view));
    else history.pushState(stateValue, '', routeUrlForView(view));
  }

  function setView(view, { skipGate = false, keepScroll = false, route = 'push' } = {}) {
    if (!skipGate && (view === 'library' || view === 'my') && !requireAuth(`${view === 'library' ? 'Library' : 'MY'}는 로그인 후 사용할 수 있습니다.`)) return false;
    if (activeView !== view) scrollPositions.set(activeView, window.scrollY);
    activeView = view;
    document.querySelectorAll('.view').forEach((element) => element.classList.toggle('is-active', element.dataset.view === view));
    const navView = view === 'curation' ? curationPreviousView : view === 'movie' ? (previousView === 'curation' ? curationPreviousView : previousView) : view;
    document.querySelectorAll('[data-nav]').forEach((button) => button.classList.toggle('is-active', button.dataset.nav === navView));
    document.querySelectorAll('.mobile-nav-item[data-nav]').forEach((button) => button.classList.toggle('is-active', button.dataset.nav === navView));
    if (view !== 'movie') document.title = `KINOSIS — ${view.charAt(0).toUpperCase() + view.slice(1)}`;
    if (route !== 'none' && view !== 'movie' && view !== 'curation') updateHistoryForView(view, route);
    requestAnimationFrame(() => {
      if (keepScroll) window.scrollTo({ top: scrollPositions.get(view) || 0, behavior: 'auto' });
      else window.scrollTo({ top: 0, behavior: 'auto' });
    });
    if (view === 'library') refreshWatchlistAvailability().catch(() => {});
    return true;
  }

  async function openMovie(id, { route = 'push', from = null } = {}) {
    let record = movie(id);
    if (!record && canUseLiveApi()) record = await ensureMovieDetail(id, { persist: false });
    if (!record) {
      UI.toast('영화 정보를 찾지 못했습니다.');
      return;
    }
    previousView = from || (activeView === 'movie' ? previousView : activeView);
    scrollPositions.set(previousView, window.scrollY);
    detailMovieId = String(id);
    setView('movie', { skipGate: true, keepScroll: false, route: 'none' });
    if (canUseLiveApi()) {
      const historyValue = { kinRoute: true, view: 'movie', movieId: String(id), from: previousView };
      if (route === 'replace') history.replaceState(historyValue, '', routeUrlForMovie(id, previousView));
      else if (route === 'push') history.pushState(historyValue, '', routeUrlForMovie(id, previousView));
    }
    document.getElementById('moviePage').innerHTML = `<div class="detail-loading"><div class="loading-ring"></div><b>${escapeHtml(record.title)}</b><span>상세정보를 불러오는 중…</span></div>`;
    record = await ensureMovieDetail(id, { persist: !!lib(id) }) || record;
    renderMoviePage(record);
    loadRelatedRecommendations(id).catch(() => {});
  }

  function backFromMovie() {
    if (canUseLiveApi() && history.state?.kinRoute && history.length > 1) history.back();
    else if (previousView === 'curation' && curationSlug) openCuration(curationSlug, { route: 'replace', from: curationPreviousView });
    else setView(previousView || 'discover', { skipGate: true, keepScroll: true, route: 'replace' });
  }

  async function applyLocationRoute({ replace = false } = {}) {
    const params = new URLSearchParams(location.search);
    const curation = params.get('curation');
    if (curation) {
      await openCuration(curation, { route: replace ? 'replace' : 'none', from: params.get('from') || 'arthouse' });
      return;
    }
    const movieId = params.get('movie');
    if (movieId) {
      const from = params.get('from') || 'discover';
      if (from === 'curation' && params.get('fromCuration')) curationSlug = params.get('fromCuration');
      await openMovie(movieId, { route: replace ? 'replace' : 'none', from });
      return;
    }
    const view = ['discover', 'arthouse', 'library', 'my'].includes(params.get('view')) ? params.get('view') : 'discover';
    setView(view, { skipGate: false, keepScroll: true, route: replace ? 'replace' : 'none' });
  }

  function localSearch(query) {
    const lower = query.toLocaleLowerCase('ko-KR');
    return (CATALOG.movies || []).filter((record) => [record.title, record.originalTitle, record.director, ...(record.cast || []).map((person) => person.name || person), ...genreNames(record)].filter(Boolean).join(' ').toLocaleLowerCase('ko-KR').includes(lower));
  }

  function relevance(record, query) {
    const needle = query.toLocaleLowerCase('ko-KR');
    const title = String(record.title || '').toLocaleLowerCase('ko-KR');
    const original = String(record.originalTitle || '').toLocaleLowerCase('ko-KR');
    const director = String(record.director || '').toLocaleLowerCase('ko-KR');
    let score = 0;
    if (title === needle || original === needle) score += 100;
    if (title.startsWith(needle) || original.startsWith(needle)) score += 55;
    if (title.includes(needle) || original.includes(needle)) score += 30;
    if (director.includes(needle)) score += 12;
    if (genreNames(record).some((genre) => normalizeText(genre) === normalizeText(query))) score += 22;
    if (CATALOG.movies?.some((catalogMovie) => String(catalogMovie.id) === String(record.id))) score += 5;
    score += Math.min(10, Number(record.voteCount || 0) / 10000);
    return score;
  }

  function combinedSearch(query) {
    const local = localSearch(query);
    const live = liveSearchState.query === query ? liveSearchState.results : [];
    const map = new Map();
    for (const record of [...live, ...local]) map.set(String(record.id), record);
    return [...map.values()].sort((a, b) => relevance(b, query) - relevance(a, query));
  }

  function searchRow(record) {
    const action = isSignedIn() ? `<button class="secondary-button" data-action="save" data-id="${record.id}">${lib(record.id) ? '✓ Saved' : '＋ Save'}</button><button class="secondary-button" data-action="log" data-id="${record.id}">LOG</button>` : '';
    return `<article class="search-result" data-movie="${record.id}" tabindex="0"><img src="${escapeHtml(poster(record))}" alt=""><div><h3>${escapeHtml(record.title)}</h3><p>${record.originalTitle && record.originalTitle !== record.title ? `${escapeHtml(record.originalTitle)} · ` : ''}${record.year || '—'}${record.director ? ` · ${escapeHtml(record.director)}` : ''}${record.personRole ? ` · ${escapeHtml(record.personRole)}` : ''}</p></div><div class="search-actions">${action}</div></article>`;
  }

  function personRow(person) {
    return `<button class="person-result" data-person-id="${escapeHtml(person.id)}" data-person-name="${escapeHtml(person.name)}">${person.profileUrl ? `<img src="${escapeHtml(person.profileUrl)}" alt="">` : '<span class="person-avatar-placeholder"></span>'}<span><b>${escapeHtml(person.name)}</b><small>${escapeHtml(person.knownForDepartment || 'Person')}</small></span><span class="person-arrow">›</span></button>`;
  }

  function renderSearch(query = '') {
    const element = document.getElementById('searchResults');
    if (!element) return;
    const trimmed = query.trim();
    if (personSearchState.status === 'ready' && personSearchState.person) {
      element.innerHTML = `<div class="person-filmography-head"><button class="secondary-button" data-search-back>← 검색 결과</button><div><p class="eyebrow">FILMOGRAPHY</p><h2>${escapeHtml(personSearchState.person.name)}</h2><p>${escapeHtml(personSearchState.person.knownForDepartment || '')}</p></div></div>${personSearchState.results.length ? personSearchState.results.map(searchRow).join('') : '<div class="empty-state"><b>표시할 영화가 없습니다.</b></div>'}`;
      return;
    }
    if (!trimmed) {
      const recent = uniqueById(CATALOG.sections?.trending || []).slice(0, 8);
      element.innerHTML = recent.map(searchRow).join('');
      return;
    }
    const results = combinedSearch(trimmed);
    const people = liveSearchState.query === trimmed ? liveSearchState.people || [] : [];
    const status = liveSearchState.status === 'loading' ? '<div class="search-status">TMDB 검색 중…</div>' : liveSearchState.status === 'error' ? '<div class="search-status">Live search unavailable · local results</div>' : '';
    const peopleHtml = people.length ? `<section class="search-people"><div class="search-section-label">PEOPLE</div>${people.slice(0, 6).map(personRow).join('')}</section>` : '';
    const moviesHtml = results.length ? `<section><div class="search-section-label">FILMS</div>${results.slice(0, 24).map(searchRow).join('')}</section>` : '<div class="empty-state"><b>검색 결과가 없습니다.</b></div>';
    element.innerHTML = status + peopleHtml + moviesHtml;
  }

  async function runLiveSearch(query, serial) {
    if (!canUseLiveApi() || query.length < LIVE_SEARCH_MIN_CHARS) return;
    if (searchAbort) searchAbort.abort();
    searchAbort = new AbortController();
    liveSearchState = { query, status: 'loading', results: [], people: [], message: '' };
    renderSearch(query);
    try {
      const data = await fetchLiveSearch(query, { signal: searchAbort.signal });
      if (serial !== searchSerial) return;
      liveSearchState = { query, status: 'done', results: data.results, people: data.people, message: '' };
    } catch (error) {
      if (error?.name === 'AbortError' || serial !== searchSerial) return;
      liveSearchState = { query, status: 'error', results: [], people: [], message: error.message || 'Live search failed' };
    }
    renderSearch(query);
  }

  function queueSearch(value) {
    const query = value.trim();
    clearTimeout(searchTimer);
    const serial = ++searchSerial;
    personSearchState = { status: 'idle', person: null, results: [] };
    liveSearchState = query === liveSearchState.query ? liveSearchState : { query, status: 'idle', results: [], people: [], message: '' };
    renderSearch(query);
    if (searchComposing || query.length < LIVE_SEARCH_MIN_CHARS || !canUseLiveApi()) return;
    searchTimer = setTimeout(() => runLiveSearch(query, serial), LIVE_SEARCH_DEBOUNCE);
  }

  function openSearch() {
    document.getElementById('searchContext').textContent = '영화·감독·배우·장르를 KINOSIS 카탈로그와 TMDB에서 함께 검색합니다.';
    UI.showDialog('searchDialog');
    const input = document.getElementById('searchInput');
    input.value = '';
    liveSearchState = { query: '', status: 'idle', results: [], people: [], message: '' };
    personSearchState = { status: 'idle', person: null, results: [] };
    renderSearch('');
    setTimeout(() => input.focus(), 50);
  }

  async function openPersonFilmography(id, name = '') {
    if (!canUseLiveApi()) return;
    personSearchState = { status: 'loading', person: { id, name }, results: [] };
    document.getElementById('searchResults').innerHTML = `<div class="detail-loading"><div class="loading-ring"></div><b>${escapeHtml(name || 'Filmography')}</b><span>필모그래피를 불러오는 중…</span></div>`;
    try {
      const data = await apiJson(`/api/person-films?id=${encodeURIComponent(id)}`);
      personSearchState = {
        status: 'ready',
        person: data.person,
        results: (data.results || []).map((record) => rememberMovie({ ...record, source: 'tmdb-live', detailLoaded: false })).filter(Boolean),
      };
    } catch (error) {
      personSearchState = { status: 'error', person: { id, name }, results: [] };
    }
    renderSearch(document.getElementById('searchInput').value);
  }

  async function saveMovie(id) {
    if (!requireAuth()) return;
    const existed = !!lib(id);
    let record = movie(id);
    if (!record) return;
    record = await ensureMovieDetail(id, { persist: true }) || record;
    rememberMovie(record, { persist: true });
    ensureLib(id).updatedAt = new Date().toISOString();
    saveState();
    renderAll();
    if (activeView === 'movie') renderMoviePage(record);
    UI.toast(existed ? '이미 Library에 있습니다.' : 'Library에 추가했습니다.');
  }

  async function openLog(id, logId = null) {
    if (!requireAuth()) return;
    let record = movie(id);
    if (!record) return;
    record = await ensureMovieDetail(id, { persist: true }) || record;
    rememberMovie(record, { persist: true });
    saveState();
    const existing = logId ? state.logs.find((log) => String(log.id) === String(logId)) : null;
    const priorCount = logsForMovie(id).filter((log) => !existing || String(log.id) !== String(existing.id)).length;
    document.getElementById('logMovieId').value = String(id);
    document.getElementById('logEntryId').value = existing?.id || '';
    document.getElementById('logMovieTitle').textContent = existing ? `${record.title} 기록 수정` : record.title;
    document.getElementById('logDate').value = existing?.watchedAt || isoDate(new Date());
    document.getElementById('logRating').value = existing?.rating ?? lib(id)?.rating ?? '';
    document.getElementById('logReview').value = existing?.review || '';
    document.getElementById('logFavorite').checked = !!lib(id)?.favorite;
    const hint = document.getElementById('logRewatchHint');
    hint.textContent = existing ? (existing.rewatch ? '재관람 기록입니다.' : '첫 관람 기록입니다.') : priorCount ? `↻ ${priorCount + 1}번째 감상으로 기록됩니다.` : '첫 감상으로 기록됩니다.';
    const deleteButton = document.getElementById('deleteLogButton');
    deleteButton.hidden = !existing;
    deleteButton.dataset.logId = existing?.id || '';
    UI.showDialog('logDialog');
  }

  async function deleteLog(logId) {
    const log = state.logs.find((entry) => String(entry.id) === String(logId));
    if (!log) return;
    const record = movie(log.movieId);
    const answer = await UI.ask({
      eyebrow: 'VIEWING LOG',
      title: '이 감상 기록을 삭제할까요?',
      message: `${record?.title || '영화'} · ${formatDate(log.watchedAt)} 기록이 삭제됩니다.`,
      confirmText: '삭제',
      danger: true,
    });
    if (!answer.confirmed) return;
    state.logs = state.logs.filter((entry) => String(entry.id) !== String(logId));
    recomputeLibraryFromLogs(log.movieId);
    saveState();
    invalidateRecommendations();
    UI.closeDialog('logDialog');
    UI.closeDialog('dayDialog');
    renderAll();
    if (activeView === 'movie') renderMoviePage(movie(log.movieId));
    loadForYou(true).catch(() => {});
    UI.toast('감상 기록을 삭제했습니다.');
  }

  function toggleWatchlist(id) {
    if (!requireAuth()) return;
    const record = movie(id);
    if (record) rememberMovie(record, { persist: true });
    const entry = ensureLib(id);
    entry.watchlist = !entry.watchlist;
    entry.updatedAt = new Date().toISOString();
    saveState();
    renderAll();
    if (activeView === 'movie') renderMoviePage(movie(id));
    refreshWatchlistAvailability(true).catch(() => {});
    UI.toast(entry.watchlist ? 'Watchlist에 추가했습니다.' : 'Watchlist에서 제거했습니다.');
  }

  function toggleFavorite(id) {
    if (!requireAuth()) return;
    const record = movie(id);
    if (record) rememberMovie(record, { persist: true });
    const entry = ensureLib(id);
    entry.favorite = !entry.favorite;
    entry.updatedAt = new Date().toISOString();
    saveState();
    renderAll();
    if (activeView === 'movie') renderMoviePage(movie(id));
    UI.toast(entry.favorite ? 'Favorite로 표시했습니다.' : 'Favorite를 해제했습니다.');
  }

  function openCollectionEditor(collection = null) {
    if (!requireAuth()) return;
    document.getElementById('collectionId').value = collection?.id || '';
    document.getElementById('collectionName').value = collection?.name || '';
    document.getElementById('collectionDescription').value = collection?.description || '';
    document.getElementById('collectionDialogTitle').textContent = collection ? '컬렉션 편집' : '컬렉션 만들기';
    UI.showDialog('collectionDialog');
    setTimeout(() => document.getElementById('collectionName').focus(), 40);
  }

  async function addToCollection(id) {
    if (!requireAuth()) return;
    if (!state.collections.length) {
      openCollectionEditor();
      UI.toast('먼저 컬렉션을 만들어주세요.');
      return;
    }
    const answer = await UI.ask({
      eyebrow: 'COLLECTION',
      title: '컬렉션에 추가',
      message: movie(id)?.title || '',
      select: { label: '컬렉션', options: state.collections.map((collection) => ({ value: collection.id, label: collection.name })) },
      confirmText: '추가',
    });
    if (!answer.confirmed) return;
    const collection = state.collections.find((item) => item.id === answer.select);
    if (!collection) return;
    if (!collection.movieIds.includes(String(id))) collection.movieIds.push(String(id));
    collection.coverMovieId = collection.coverMovieId || String(id);
    collection.updatedAt = new Date().toISOString();
    const record = movie(id);
    if (record) rememberMovie(record, { persist: true });
    ensureLib(id);
    saveState();
    renderAll();
    UI.toast(`${collection.name}에 추가했습니다.`);
  }

  function editProfile() {
    document.getElementById('profileName').value = state.profile.name || '';
    document.getElementById('profileBio').value = state.profile.bio || '';
    UI.showDialog('profileDialog');
  }

  function openCalendarDay(date) {
    const logs = state.logs.filter((log) => log.watchedAt === date).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    document.getElementById('dayDialogTitle').textContent = formatDate(date);
    document.getElementById('dayDialogSummary').textContent = `${logs.length}편 감상${logs.reduce((sum, log) => sum + (movie(log.movieId)?.runtime || 0), 0) ? ` · ${fmtRuntime(logs.reduce((sum, log) => sum + (movie(log.movieId)?.runtime || 0), 0))}` : ''}`;
    document.getElementById('dayDialogList').innerHTML = logs.map((log) => {
      const record = movie(log.movieId);
      if (!record) return '';
      return `<div class="day-log-row"><button class="day-log-main" data-movie="${record.id}"><img src="${escapeHtml(poster(record))}" alt=""><span><b>${escapeHtml(record.title)}</b><small>${log.rating ? `★ ${log.rating}` : '평점 없음'}${log.rewatch ? ' · ↻ 재관람' : ''}</small>${log.review ? `<em>${escapeHtml(log.review)}</em>` : ''}</span></button><button class="secondary-button mini" data-log-edit="${escapeHtml(log.id)}">수정</button></div>`;
    }).join('');
    UI.showDialog('dayDialog');
  }

  function renderStatus() {
    const live = CATALOG.mode === 'live';
    document.getElementById('dataStatusText').textContent = live ? 'SYNCED' : 'LOCAL';
    document.getElementById('sourceStatus').innerHTML = `Catalog: <b>${live ? 'LIVE API SYNC' : 'LOCAL DEMO'}</b><br>Updated: ${escapeHtml(CATALOG.updatedAt || 'unknown')}<br>Region: ${escapeHtml(CATALOG.region || 'KR')}<br>Auth: ${isSignedIn() ? `SIGNED IN · ${escapeHtml(syncState.status.toUpperCase())}` : 'SIGNED OUT'}`;
  }

  function renderAll() {
    renderDiscover();
    renderArthouse();
    renderLibrary();
    renderMy();
    if (activeView === 'movie' && detailMovieId) renderMoviePage(movie(detailMovieId));
    if (activeView === 'curation' && curationSlug) renderCurationPage(CURATIONS.get(curationSlug));
    renderStatus();
    renderAccountChrome();
  }

  function exportData() {
    if (!requireAuth()) return;
    state.settings.lastExportAt = new Date().toISOString();
    saveState();
    const blob = new Blob([JSON.stringify({ version: 4, exportedAt: new Date().toISOString(), state }, null, 2)], { type: 'application/json' });
    const anchor = document.createElement('a');
    anchor.href = URL.createObjectURL(blob);
    anchor.download = `kinosis-${isoDate(new Date())}.json`;
    anchor.click();
    URL.revokeObjectURL(anchor.href);
    UI.toast('내 데이터를 내보냈습니다.');
  }

  async function handleImport(event) {
    if (!requireAuth()) return;
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      if (!parsed.state?.library) throw new Error('invalid');
      state = mergeImport(state, parsed.state);
      Object.values(state.movieCache || {}).forEach((record) => rememberMovie(record));
      saveState();
      invalidateRecommendations();
      renderAll();
      UI.closeDialog('aboutDialog');
      loadForYou(true).catch(() => {});
      UI.toast('데이터를 가져왔습니다.');
    } catch {
      UI.toast('KINOSIS 데이터 파일을 읽지 못했습니다.');
    }
    event.target.value = '';
  }

  async function matchLetterboxdMovie(entry) {
    const data = await apiJson(`/api/movie-search?q=${encodeURIComponent(entry.name)}`);
    const candidates = data.results || [];
    const needle = normalizeText(entry.name);
    const scored = candidates.map((candidate) => {
      let score = 0;
      const titles = [normalizeText(candidate.title), normalizeText(candidate.originalTitle)];
      if (titles.includes(needle)) score += 100;
      else if (titles.some((title) => title.includes(needle) || needle.includes(title))) score += 45;
      if (entry.year && Number(candidate.year) === Number(entry.year)) score += 55;
      return { candidate, score };
    }).sort((a, b) => b.score - a.score);
    return scored[0]?.score >= 45 ? scored[0].candidate : null;
  }

  async function handleLetterboxdFiles(event) {
    if (!requireAuth() || !IMPORTERS) return;
    const files = [...(event.target.files || [])];
    if (!files.length) return;
    const progress = document.getElementById('letterboxdProgress');
    try {
      progress.textContent = 'CSV를 읽는 중…';
      const parsedFiles = [];
      for (const file of files) {
        parsedFiles.push({ name: file.name, type: IMPORTERS.classifyLetterboxdFile(file.name), rows: IMPORTERS.parseCsv(await file.text()) });
      }
      const entries = IMPORTERS.normalizeLetterboxdRows(parsedFiles);
      const groups = new Map();
      for (const entry of entries) {
        const key = `${normalizeText(entry.name)}|${entry.year || ''}`;
        const group = groups.get(key) || { name: entry.name, year: entry.year, entries: [] };
        group.entries.push(entry);
        groups.set(key, group);
      }
      const items = [...groups.values()].slice(0, 250);
      let imported = 0;
      let unmatched = 0;
      for (let i = 0; i < items.length; i++) {
        const group = items[i];
        progress.textContent = `${i + 1}/${items.length} · ${group.name} 매칭 중…`;
        let matched = null;
        try { matched = await matchLetterboxdMovie(group); } catch {}
        if (!matched) { unmatched++; continue; }
        rememberMovie({ ...matched, source: 'tmdb-live', detailLoaded: false }, { persist: true });
        const entry = ensureLib(matched.id);
        const watchlist = group.entries.some((row) => row.watchlist);
        const ratingRows = group.entries.filter((row) => row.rating != null);
        if (watchlist) entry.watchlist = true;
        if (ratingRows.length) entry.rating = ratingRows[ratingRows.length - 1].rating;
        if (group.entries.some((row) => row.watched)) entry.watched = true;

        for (const row of group.entries.filter((item) => ['diary', 'reviews'].includes(item.sourceType) && item.watchedAt)) {
          const duplicate = state.logs.some((log) => String(log.movieId) === String(matched.id) && log.watchedAt === row.watchedAt && normalizeText(log.review) === normalizeText(row.review));
          if (!duplicate) {
            state.logs.push({
              id: `lb-${matched.id}-${row.watchedAt}-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
              movieId: String(matched.id),
              watchedAt: row.watchedAt,
              rating: row.rating,
              review: row.review || '',
              rewatch: !!row.rewatch,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            });
          }
        }
        recomputeLibraryFromLogs(matched.id);
        imported++;
      }
      saveState();
      invalidateRecommendations();
      renderAll();
      progress.textContent = `완료 · ${imported}편 가져옴${unmatched ? ` · ${unmatched}편 매칭 실패` : ''}`;
      loadForYou(true).catch(() => {});
    } catch (error) {
      progress.textContent = `가져오기 실패 · ${error.message || 'CSV를 확인하세요.'}`;
    }
    event.target.value = '';
  }

  document.addEventListener('click', async (event) => {
    const close = event.target.closest('[data-close]');
    if (close) { UI.closeDialog(close.dataset.close); return; }

    const nav = event.target.closest('[data-nav]');
    if (nav) { setView(nav.dataset.nav); return; }

    const libraryTab = event.target.closest('[data-library]');
    if (libraryTab) { libraryMode = libraryTab.dataset.library; renderLibrary(); return; }

    const myTab = event.target.closest('[data-my]');
    if (myTab) { myMode = myTab.dataset.my; renderMy(); return; }

    const listView = event.target.closest('[data-library-view]');
    if (listView) { libraryView = listView.dataset.libraryView; renderLibrary(); return; }

    const action = event.target.closest('[data-action]');
    if (action) {
      event.stopPropagation();
      const id = action.dataset.id;
      if (action.dataset.action === 'save') await saveMovie(id);
      else if (action.dataset.action === 'log') await openLog(id);
      else if (action.dataset.action === 'watchlist') toggleWatchlist(id);
      else if (action.dataset.action === 'favorite') toggleFavorite(id);
      else if (action.dataset.action === 'collection-add') await addToCollection(id);
      return;
    }

    const curationElement = event.target.closest('[data-curation]');
    if (curationElement) { await openCuration(curationElement.dataset.curation); return; }
    if (event.target.closest('[data-curation-back]')) { backFromCuration(); return; }

    const movieElement = event.target.closest('[data-movie]');
    if (movieElement) { UI.closeDialog('dayDialog'); await openMovie(movieElement.dataset.movie); return; }
    if (event.target.closest('[data-movie-back]')) { backFromMovie(); return; }

    const curationShare = event.target.closest('[data-share-curation]');
    if (curationShare) {
      try { await navigator.clipboard.writeText(location.href); UI.toast('기획전 링크를 복사했습니다.'); }
      catch { UI.toast('주소창의 링크를 복사해주세요.'); }
      return;
    }

    const share = event.target.closest('[data-share-movie]');
    if (share) {
      try { await navigator.clipboard.writeText(location.href); UI.toast('영화 링크를 복사했습니다.'); }
      catch { UI.toast('주소창의 링크를 복사해주세요.'); }
      return;
    }

    const collection = event.target.closest('[data-collection],[data-collection-card]');
    if (collection) {
      libraryMode = `collection:${collection.dataset.collection || collection.dataset.collectionCard}`;
      setView('library');
      renderLibrary();
      return;
    }
    if (event.target.closest('[data-dynamic]')) { libraryMode = 'dynamic:my-streaming'; setView('library'); renderLibrary(); return; }

    if (event.target.closest('#searchTrigger') || event.target.closest('#mobileSearch') || event.target.closest('#librarySearchButton')) { openSearch(); return; }
    if (event.target.closest('[data-open-auth]')) { UI.showDialog('authDialog'); return; }

    const authProvider = event.target.closest('[data-auth-provider]');
    if (authProvider) {
      const message = document.getElementById('authMessage');
      message.textContent = '로그인 페이지로 이동합니다…';
      try { await CLOUD?.signInOAuth(authProvider.dataset.authProvider); }
      catch (error) { message.textContent = error.message || '로그인 설정을 확인하세요.'; message.classList.add('is-error'); }
      return;
    }

    if (event.target.closest('#topAccountButton')) {
      if (isSignedIn()) { myMode = 'settings'; setView('my'); renderMy(); }
      else UI.showDialog('authDialog');
      return;
    }

    const subscription = event.target.closest('[data-subscription]');
    if (subscription) {
      if (!requireAuth()) return;
      const provider = subscription.dataset.subscription;
      const enabled = isSubscriptionEnabled(provider);
      state.subscriptions = enabled ? state.subscriptions.filter((value) => normalizeProviderName(value) !== normalizeProviderName(provider)) : [...(state.subscriptions || []), provider];
      saveState();
      renderAll();
      refreshWatchlistAvailability(true).catch(() => {});
      return;
    }

    const calendarControl = event.target.closest('[data-cal]');
    if (calendarControl) {
      calendarCursor = new Date(calendarCursor.getFullYear(), calendarCursor.getMonth() + (calendarControl.dataset.cal === 'next' ? 1 : -1), 1);
      renderMy();
      return;
    }

    const calendarDay = event.target.closest('[data-calendar-day]');
    if (calendarDay) { openCalendarDay(calendarDay.dataset.calendarDay); return; }

    if (event.target.closest('#newCollectionButton')) { openCollectionEditor(); return; }
    const editCollectionButton = event.target.closest('[data-edit-collection]');
    if (editCollectionButton) {
      const collectionItem = state.collections.find((item) => item.id === editCollectionButton.dataset.editCollection);
      if (collectionItem) openCollectionEditor(collectionItem);
      return;
    }

    const moveCollection = event.target.closest('[data-collection-move]');
    if (moveCollection) {
      const collectionItem = state.collections.find((item) => item.id === moveCollection.dataset.collectionId);
      if (!collectionItem) return;
      const index = Number(moveCollection.dataset.index);
      const nextIndex = moveCollection.dataset.collectionMove === 'up' ? index - 1 : index + 1;
      if (nextIndex >= 0 && nextIndex < collectionItem.movieIds.length) {
        [collectionItem.movieIds[index], collectionItem.movieIds[nextIndex]] = [collectionItem.movieIds[nextIndex], collectionItem.movieIds[index]];
        collectionItem.coverMovieId = collectionItem.movieIds[0] || null;
        collectionItem.updatedAt = new Date().toISOString();
        saveState();
        renderLibrary();
      }
      return;
    }

    const removeCollectionFilm = event.target.closest('[data-collection-remove]');
    if (removeCollectionFilm) {
      const collectionItem = state.collections.find((item) => item.id === removeCollectionFilm.dataset.collectionId);
      if (!collectionItem) return;
      collectionItem.movieIds = collectionItem.movieIds.filter((id) => String(id) !== String(removeCollectionFilm.dataset.collectionRemove));
      collectionItem.coverMovieId = collectionItem.movieIds[0] || null;
      collectionItem.updatedAt = new Date().toISOString();
      saveState();
      renderLibrary();
      UI.toast('컬렉션에서 제거했습니다.');
      return;
    }

    if (event.target.closest('#editProfile')) { editProfile(); return; }
    if (event.target.closest('#syncNowButton')) { await pushCloudState(); return; }
    if (event.target.closest('#signOutButton')) { await CLOUD?.signOut(); return; }
    if (event.target.closest('#accountExportButton') || event.target.closest('#exportButton')) { exportData(); return; }
    if (event.target.closest('#aboutButton') || event.target.closest('#dataStatusButton') || event.target.closest('#openAboutFromSettings')) { UI.showDialog('aboutDialog'); return; }
    if (event.target.closest('#openLetterboxdImport')) { UI.closeDialog('aboutDialog'); UI.showDialog('letterboxdDialog'); return; }

    const logEdit = event.target.closest('[data-log-edit]');
    if (logEdit) {
      const log = state.logs.find((entry) => String(entry.id) === String(logEdit.dataset.logEdit));
      if (log) { UI.closeDialog('dayDialog'); await openLog(log.movieId, log.id); }
      return;
    }

    const logDelete = event.target.closest('[data-log-delete]');
    if (logDelete) { await deleteLog(logDelete.dataset.logDelete); return; }
    if (event.target.closest('#deleteLogButton')) { await deleteLog(document.getElementById('deleteLogButton').dataset.logId); return; }

    const person = event.target.closest('[data-person-id]');
    if (person) {
      UI.showDialog('searchDialog');
      await openPersonFilmography(person.dataset.personId, person.dataset.personName || '');
      return;
    }
    if (event.target.closest('[data-search-back]')) {
      personSearchState = { status: 'idle', person: null, results: [] };
      renderSearch(document.getElementById('searchInput').value);
    }
  });

  document.addEventListener('input', (event) => {
    if (event.target.id === 'libraryQuery') {
      libraryFilter.q = event.target.value;
      clearTimeout(libraryQueryTimer);
      const position = event.target.selectionStart || libraryFilter.q.length;
      libraryQueryTimer = setTimeout(() => {
        renderLibrary();
        const input = document.getElementById('libraryQuery');
        if (input) {
          input.focus();
          input.setSelectionRange(Math.min(position, input.value.length), Math.min(position, input.value.length));
        }
      }, 180);
    }
  });

  document.addEventListener('change', (event) => {
    const map = {
      libraryStatus: 'status', libraryAvailability: 'availability', libraryGenre: 'genre',
      libraryDecade: 'decade', libraryArthouse: 'arthouse', librarySort: 'sort',
    };
    if (map[event.target.id]) {
      libraryFilter[map[event.target.id]] = event.target.value;
      renderLibrary();
    }
  });

  document.getElementById('searchInput').addEventListener('compositionstart', () => { searchComposing = true; });
  document.getElementById('searchInput').addEventListener('compositionend', (event) => { searchComposing = false; queueSearch(event.target.value); });
  document.getElementById('searchInput').addEventListener('input', (event) => { if (!searchComposing) queueSearch(event.target.value); });

  document.getElementById('emailAuthForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const email = document.getElementById('authEmail').value.trim();
    const message = document.getElementById('authMessage');
    if (!email) return;
    message.textContent = '로그인 링크를 보내는 중…';
    message.classList.remove('is-error');
    try { await CLOUD.sendMagicLink(email); message.textContent = '이메일을 확인하세요.'; }
    catch (error) { message.textContent = error.message || '요청 실패'; message.classList.add('is-error'); }
  });

  document.getElementById('logForm').addEventListener('submit', (event) => {
    event.preventDefault();
    if (!requireAuth()) return;
    const movieId = document.getElementById('logMovieId').value;
    const logId = document.getElementById('logEntryId').value;
    const watchedAt = document.getElementById('logDate').value;
    const ratingValue = document.getElementById('logRating').value;
    const review = document.getElementById('logReview').value.trim();
    const favorite = document.getElementById('logFavorite').checked;
    if (!movieId || !watchedAt) return;
    const record = movie(movieId);
    if (record) rememberMovie(record, { persist: true });
    const prior = logsForMovie(movieId).filter((log) => String(log.id) !== String(logId));
    const payload = {
      movieId: String(movieId),
      watchedAt,
      rating: ratingValue ? Number(ratingValue) : null,
      review,
      rewatch: prior.length > 0,
      updatedAt: new Date().toISOString(),
    };
    if (logId) {
      const index = state.logs.findIndex((log) => String(log.id) === String(logId));
      if (index >= 0) state.logs[index] = { ...state.logs[index], ...payload };
    } else {
      state.logs.push({ id: `log-${Date.now()}-${Math.random().toString(16).slice(2, 7)}`, createdAt: new Date().toISOString(), ...payload });
    }
    const entry = ensureLib(movieId);
    entry.favorite = favorite;
    recomputeLibraryFromLogs(movieId);
    saveState();
    invalidateRecommendations();
    UI.closeDialog('logDialog');
    renderAll();
    if (activeView === 'movie') renderMoviePage(movie(movieId));
    loadForYou(true).catch(() => {});
    UI.toast(logId ? '감상 기록을 수정했습니다.' : (prior.length ? '재관람을 기록했습니다.' : '감상 기록을 저장했습니다.'));
  });

  document.getElementById('profileForm').addEventListener('submit', (event) => {
    event.preventDefault();
    state.profile.name = document.getElementById('profileName').value.trim();
    state.profile.bio = document.getElementById('profileBio').value.trim();
    saveState();
    UI.closeDialog('profileDialog');
    renderAll();
  });

  document.getElementById('collectionForm').addEventListener('submit', (event) => {
    event.preventDefault();
    if (!requireAuth()) return;
    const id = document.getElementById('collectionId').value;
    const name = document.getElementById('collectionName').value.trim();
    const description = document.getElementById('collectionDescription').value.trim();
    if (!name) return;
    if (id) {
      const collection = state.collections.find((item) => item.id === id);
      if (collection) {
        collection.name = name;
        collection.description = description;
        collection.updatedAt = new Date().toISOString();
      }
    } else {
      state.collections.push({
        id: `col-${Date.now()}`,
        name,
        description,
        coverMovieId: null,
        type: 'manual',
        movieIds: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      libraryMode = 'collections';
    }
    saveState();
    UI.closeDialog('collectionDialog');
    renderAll();
  });

  document.getElementById('importInput').addEventListener('change', handleImport);
  document.getElementById('letterboxdInput').addEventListener('change', handleLetterboxdFiles);

  document.addEventListener('keydown', (event) => {
    if (event.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) {
      event.preventDefault();
      openSearch();
    }
    if ((event.key === 'Enter' || event.key === ' ') && document.activeElement?.matches('.movie-card,.search-result')) {
      event.preventDefault();
      openMovie(document.activeElement.dataset.movie);
    }
    if ((event.key === 'Enter' || event.key === ' ') && document.activeElement?.matches('.curation-feature')) {
      event.preventDefault();
      openCuration(document.activeElement.dataset.curation);
    }
  });

  window.addEventListener('popstate', () => { applyLocationRoute().catch(() => {}); });
  window.addEventListener('online', () => {
    if (isSignedIn() && state.meta?.dirtySince) pushCloudState();
    if (isSignedIn()) refreshWatchlistAvailability(true).catch(() => {});
  });
  window.addEventListener('offline', () => {
    if (isSignedIn()) { syncState.status = 'offline'; renderAccountChrome(); }
  });

  if (CLOUD) {
    CLOUD.onChange(async ({ user, error, event }) => {
      authReady = true;
      currentUser = user || null;
      if (error) syncState = { status: 'offline', lastSyncedAt: null, message: error.message || 'Auth unavailable' };
      if (currentUser) {
        UI.closeDialog('authDialog');
        if (hydratedUserId !== currentUser.id || event === 'SIGNED_IN') {
          hydratedUserId = currentUser.id;
          await hydrateSignedInUser();
        } else renderAll();
      } else {
        hydratedUserId = null;
        suppressCloudSync = true;
        state = initialState();
        syncState = { status: 'guest', lastSyncedAt: null, message: '' };
        invalidateRecommendations();
        renderAll();
        const params = new URLSearchParams(location.search);
        if (!params.get('movie') && !params.get('curation')) setView('discover', { skipGate: true, route: 'replace' });
      }
    });
    CLOUD.init().then(() => { authReady = true; }).catch(() => {});
  } else authReady = true;

  renderAll();
  applyLocationRoute({ replace: true }).catch(() => setView('discover', { skipGate: true, route: 'replace' }));
  if ((location.protocol === 'http:' || location.protocol === 'https:') && 'serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' }).then((registration) => registration.update()).catch(() => {});
  }
})();
