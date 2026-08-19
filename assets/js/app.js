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
  const IMPORTERS = window.KINOSIS_IMPORTERS || null;
  const CURATIONS = window.KINOSIS_CURATIONS_API || { all: () => [], forSurface: () => [], get: () => null };
  const PROVIDER_API = window.KINOSIS_PROVIDERS || null;
  const CURATION_LOADER_FACTORY = window.KINOSIS_CURATION_LOADER || null;
  const HERO_CAROUSEL_FACTORY = window.KINOSIS_HERO_CAROUSEL || null;
  const STATE_INTEGRITY = window.KINOSIS_STATE_INTEGRITY || null;

  const STORAGE_KEY = 'kinosis.mvp.v2.state';
  const LEGACY_STORAGE_KEY = 'film.mvp.v2.state';
  const MIGRATION_PREFIX = 'kinosis.legacy.migrated.';
  const LIVE_SEARCH_MIN_CHARS = 2;
  const LIVE_SEARCH_DEBOUNCE = 300;
  const AVAILABILITY_CHECK_MS = 6 * 60 * 60 * 1000;
  const AVAILABILITY_NEW_MS = 14 * 24 * 60 * 60 * 1000;

  const PROVIDERS = PROVIDER_API?.all?.() || [];

  const movieMap = new Map((CATALOG.movies || []).map((m) => [String(m.id), normalizeMovieRecord(m)]));
  const theatreIds = new Set((CATALOG.sections?.theatres || []).map((m) => String(m.id)));

  let activeView = 'discover';
  let previousView = 'discover';
  let detailMovieId = null;
  let curationSlug = null;
  let curationPreviousView = 'arthouse';
  let currentUser = null;
  let authReady = false;
  let hydratedUserId = null;
  let suppressCloudSync = true;
  let syncTimer = null;
  let syncState = { status: 'guest', lastSyncedAt: null, message: '' };
  let lastCloudPullAt = 0;
  let curationLoader = null;
  let heroController = null;
  const artClassCache = new Map();
  let boxOfficeState = { status: 'idle', results: [] };
  let myStreamingState = { status: 'idle', key: '', results: [], message: '' };
  let upcomingState = { status: 'idle', results: [], updatedAt: null };

  let libraryMode = 'all';
  let libraryView = 'grid';
  let myMode = 'overview';
  let calendarCursor = new Date();
  let libraryQueryTimer = null;
  let libraryFilter = { q: '', sort: 'recent' };

  let searchTimer = null;
  let searchAbort = null;
  let searchSerial = 0;
  let searchComposing = false;
  let liveSearchState = { query: '', status: 'idle', results: [], people: [], message: '' };
  let personSearchState = { status: 'idle', person: null, results: [] };

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
    return PROVIDER_API?.normalize?.(value) || String(value || '').toLowerCase().replace(/[^a-z0-9가-힣]+/g, '');
  }

  function providerConfigForName(name) {
    return PROVIDER_API?.configFor?.(name) || null;
  }

  function providerMarkHtml(provider, className = 'provider-icon') {
    const mark = PROVIDER_API?.logo?.(provider) || { url: provider?.logoUrl || null, kind: 'tile' };
    const label = PROVIDER_API?.label?.(provider) || provider?.name || 'OTT';
    if (!mark.url) return `<span class="${className} provider-mark is-fallback" title="${escapeHtml(label)}"><span>${escapeHtml(String(label).slice(0, 2))}</span></span>`;
    return `<span class="${className} provider-mark ${mark.kind === 'wordmark' ? 'is-wordmark' : ''}" title="${escapeHtml(label)}"><img src="${escapeHtml(mark.url)}" alt="${escapeHtml(label)}" loading="lazy"></span>`;
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
    const ids = new Set();
    const identities = new Set();
    const out = [];
    for (const item of list || []) {
      if (!item?.id) continue;
      const id = String(item.id);
      const titleKey = normalizeText(item.originalTitle || item.title || '');
      const yearKey = String(item.year || item.releaseDate || '').slice(0, 4);
      const identity = titleKey && yearKey ? `${titleKey}|${yearKey}` : '';
      if (ids.has(id) || (identity && identities.has(identity))) continue;
      ids.add(id);
      if (identity) identities.add(identity);
      out.push(item);
    }
    return out;
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
    if (!record) return { isArt: false, score: 0, reasons: [] };
    const key = String(record.id || '');
    const threshold = window.KINOSIS_CONFIG?.arthouse?.threshold || 36;
    const cached = artClassCache.get(key);
    if (cached?.threshold === threshold) return cached.value;
    const value = ART.classify(record, { threshold });
    artClassCache.set(key, { threshold, value });
    return value;
  }

  function isArthouse(record) {
    return !!artInfo(record).isArt;
  }

  function artPool() {
    return uniqueById([...(CATALOG.sections?.art || []), ...(CATALOG.movies || [])])
      .filter(isArthouse)
      .sort((a, b) => artInfo(b).score - artInfo(a).score || Number(b.voteAverage || 0) - Number(a.voteAverage || 0));
  }

  function isInTheatres(record) {
    if (!record) return false;
    return theatreIds.has(String(record.id))
      || Number(record.boxOfficeRank || 0) > 0
      || record.theatricalStatus === 'now';
  }

  function providerTypeLabel(type) {
    return ({ subscription: '구독', free: '무료', ads: '광고 포함', rent: '대여', buy: '구매' })[type] || type;
  }

  function initialState() {
    return {
      profile: { name: '', handle: '', bio: '내 영화생활을 기록합니다.', updatedAt: null },
      subscriptions: [],
      settings: { lastExportAt: null },
      meta: { modifiedAt: null, lastSyncedAt: null, cloudRevision: 0, localRevision: 0, dirtySince: null, syncVersion: 5, deletedLogs: {}, deletedCollections: {}, deletedLibrary: {}, subscriptionsUpdatedAt: null },
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
      meta: Object.assign(base.meta, source.meta || {}, { deletedLogs: Object.assign({}, source.meta?.deletedLogs || {}), deletedCollections: Object.assign({}, source.meta?.deletedCollections || {}), deletedLibrary: Object.assign({}, source.meta?.deletedLibrary || {}) }),
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

    normalized.meta.localRevision = Number(normalized.meta.localRevision || 0);

    normalized.logs = normalized.logs.map((log, index) => ({
      id: String(log.id || `legacy-log-${index}-${log.movieId || 'x'}-${log.watchedAt || 'date'}`),
      movieId: String(log.movieId),
      watchedAt: log.watchedAt || isoDate(new Date()),
      rating: log.rating == null || log.rating === '' ? null : Number(log.rating),
      review: log.review || '',
      rewatch: !!log.rewatch,
      createdAt: log.createdAt || log.updatedAt || (log.watchedAt ? `${log.watchedAt}T12:00:00.000Z` : '1970-01-01T00:00:00.000Z'),
      updatedAt: log.updatedAt || log.createdAt || (log.watchedAt ? `${log.watchedAt}T12:00:00.000Z` : '1970-01-01T00:00:00.000Z'),
    }));

    normalized.collections = normalized.collections.map((collection, index) => ({
      id: String(collection.id || `legacy-collection-${index}`),
      name: collection.name || 'Untitled Collection',
      description: collection.description || '',
      coverMovieId: collection.coverMovieId || collection.movieIds?.[0] || null,
      type: collection.type || 'manual',
      movieIds: Array.isArray(collection.movieIds) ? collection.movieIds.map(String) : [],
      createdAt: collection.createdAt || '1970-01-01T00:00:00.000Z',
      updatedAt: collection.updatedAt || collection.createdAt || '1970-01-01T00:00:00.000Z',
    }));

    for (const item of Object.values(normalized.library)) {
      if (item.rating === '') item.rating = null;
      item.updatedAt = item.updatedAt || item.savedAt || '1970-01-01T00:00:00.000Z';
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
      value?.profile?.name || value?.meta?.dirtySince
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

  function newerBy(a, b, field = 'updatedAt') {
    const at = Date.parse(a?.[field] || a?.createdAt || 0) || 0;
    const bt = Date.parse(b?.[field] || b?.createdAt || 0) || 0;
    return bt >= at ? b : a;
  }

  function mergeTombstones(...sources) {
    if (STATE_INTEGRITY?.mergeTombstones) return STATE_INTEGRITY.mergeTombstones(...sources);
    const out = {};
    for (const source of sources) {
      for (const [id, stamp] of Object.entries(source || {})) {
        if ((Date.parse(stamp || 0) || 0) >= (Date.parse(out[id] || 0) || 0)) out[id] = stamp;
      }
    }
    return out;
  }

  function cloudPayload(sourceState) {
    const payload = normalizeState(JSON.parse(JSON.stringify(sourceState)));
    // TMDB metadata and availability snapshots are replaceable caches, not user-authored data.
    payload.movieCache = {};
    payload.availability = { snapshot: {}, newlyAvailable: {}, lastCheckedAt: null };
    payload.meta.localRevision = 0;
    payload.meta.dirtySince = null;
    payload.meta.syncVersion = 5;
    return payload;
  }

  function applyRemoteState(remotePayload, previousState = state) {
    const remote = normalizeState(remotePayload);
    remote.movieCache = Object.assign({}, previousState?.movieCache || {});
    remote.availability = {
      snapshot: Object.assign({}, previousState?.availability?.snapshot || {}),
      newlyAvailable: Object.assign({}, previousState?.availability?.newlyAvailable || {}),
      lastCheckedAt: previousState?.availability?.lastCheckedAt || null,
    };
    remote.meta.localRevision = Number(previousState?.meta?.localRevision || 0);
    return remote;
  }

  function mergeCloudStates(localState, remoteState) {
    const local = normalizeState(localState);
    const remote = normalizeState(remoteState);
    const out = normalizeState(remote);
    out.movieCache = Object.assign({}, local.movieCache || {});
    const deletedLibrary = mergeTombstones(remote.meta?.deletedLibrary, local.meta?.deletedLibrary);
    out.meta.deletedLibrary = deletedLibrary;
    const libraryKeys = new Set([...Object.keys(remote.library || {}), ...Object.keys(local.library || {})]);
    out.library = {};
    for (const id of libraryKeys) {
      const chosen = newerBy(remote.library?.[id], local.library?.[id]);
      const deletedAt = Date.parse(deletedLibrary[id] || 0) || 0;
      const updatedAt = Date.parse(chosen?.updatedAt || chosen?.savedAt || 0) || 0;
      if (chosen && deletedAt < updatedAt) out.library[id] = normalizeState({ library: { [id]: chosen } }).library[id];
    }
    const deletedLogs = mergeTombstones(remote.meta?.deletedLogs, local.meta?.deletedLogs);
    out.meta.deletedLogs = deletedLogs;
    const logMap = new Map();
    for (const log of [...(remote.logs || []), ...(local.logs || [])]) {
      const id = String(log.id); const existing = logMap.get(id);
      if (!existing || newerBy(existing, log) === log) logMap.set(id, log);
    }
    out.logs = [...logMap.values()].filter((log) => {
      const deletedAt = Date.parse(deletedLogs[String(log.id)] || 0) || 0;
      const updatedAt = Date.parse(log.updatedAt || log.createdAt || 0) || 0;
      return deletedAt < updatedAt;
    });
    const deletedCollections = mergeTombstones(remote.meta?.deletedCollections, local.meta?.deletedCollections);
    out.meta.deletedCollections = deletedCollections;
    const collectionMap = new Map();
    for (const item of [...(remote.collections || []), ...(local.collections || [])]) {
      const id = String(item.id); const existing = collectionMap.get(id);
      if (!existing || newerBy(existing, item) === item) collectionMap.set(id, item);
    }
    out.collections = [...collectionMap.values()].filter((item) => {
      const deletedAt = Date.parse(deletedCollections[String(item.id)] || 0) || 0;
      const updatedAt = Date.parse(item.updatedAt || item.createdAt || 0) || 0;
      return deletedAt < updatedAt;
    });
    const localSubTime = Date.parse(local.meta?.subscriptionsUpdatedAt || 0) || 0;
    const remoteSubTime = Date.parse(remote.meta?.subscriptionsUpdatedAt || 0) || 0;
    out.subscriptions = localSubTime >= remoteSubTime ? [...local.subscriptions] : [...remote.subscriptions];
    out.meta.subscriptionsUpdatedAt = localSubTime >= remoteSubTime ? local.meta?.subscriptionsUpdatedAt : remote.meta?.subscriptionsUpdatedAt;
    const localMod = Date.parse(local.meta?.modifiedAt || 0) || 0;
    const remoteMod = Date.parse(remote.meta?.modifiedAt || 0) || 0;
    const localProfileTime = Date.parse(local.profile?.updatedAt || local.meta?.modifiedAt || 0) || 0;
    const remoteProfileTime = Date.parse(remote.profile?.updatedAt || remote.meta?.modifiedAt || 0) || 0;
    out.profile = localProfileTime >= remoteProfileTime ? Object.assign({}, remote.profile, local.profile) : Object.assign({}, local.profile, remote.profile);
    out.availability = {
      snapshot: Object.assign({}, local.availability?.snapshot || {}),
      newlyAvailable: Object.assign({}, local.availability?.newlyAvailable || {}),
      lastCheckedAt: local.availability?.lastCheckedAt || null,
    };
    out.meta.modifiedAt = new Date(Math.max(localMod, remoteMod, Date.now())).toISOString();
    out.meta.lastSyncedAt = local.meta?.lastSyncedAt || remote.meta?.lastSyncedAt || null;
    out.meta.dirtySince = local.meta?.dirtySince || null;
    out.meta.localRevision = Number(local.meta?.localRevision || 0);
    out.meta.syncVersion = 5;
    return normalizeState(out);
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
      state.meta.localRevision = Number(state.meta.localRevision || 0) + 1;
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
    syncState.status = navigator.onLine ? 'syncing' : 'error';
    renderAccountChrome();
    if (!navigator.onLine) return;

    try {
      let attempts = 0;
      while (attempts < 4) {
        attempts += 1;
        const remote = await CLOUD.readUserState();
        const remoteTime = Date.parse(remote?.updated_at || 0) || 0;
        const knownTime = Date.parse(state.meta?.lastSyncedAt || 0) || 0;
        if (remote?.payload && (remoteTime > knownTime || Number(remote.revision || 0) > Number(state.meta?.cloudRevision || 0))) {
          state = mergeCloudStates(state, remote.payload);
        }

        const snapshotRevision = Number(state.meta?.localRevision || 0);
        const payload = cloudPayload(state);
        const expectedRevision = Number(remote?.revision || 0);
        const result = await CLOUD.writeUserState(payload, expectedRevision);
        if (result?.conflict) {
          const latest = await CLOUD.readUserState();
          if (latest?.payload) state = mergeCloudStates(state, latest.payload);
          continue;
        }

        const stamp = result?.updated_at || new Date().toISOString();
        state.meta.lastSyncedAt = stamp;
        state.meta.cloudRevision = Number(result?.revision || expectedRevision + 1);
        const changedDuringPush = STATE_INTEGRITY?.changedSince ? STATE_INTEGRITY.changedSince(snapshotRevision, state.meta?.localRevision) : Number(state.meta?.localRevision || 0) !== snapshotRevision;
        if (!changedDuringPush) state.meta.dirtySince = null;
        persistLocalCache();
        syncState = { status: changedDuringPush ? 'pending' : 'online', lastSyncedAt: stamp, message: '' };
        renderAccountChrome();
        if (activeView === 'my' && myMode === 'settings') renderMy();
        if (changedDuringPush) scheduleCloudSync(80);
        return;
      }
      throw new Error('Cloud changed repeatedly while syncing. Please retry.');
    } catch (error) {
      syncState = { status: 'error', lastSyncedAt: state.meta?.lastSyncedAt || null, message: error.message || 'Sync failed' };
      renderAccountChrome();
      if (activeView === 'my' && myMode === 'settings') renderMy();
    }
  }

  async function pullCloudState({ force = false } = {}) {
    if (!isSignedIn() || !CLOUD || !navigator.onLine) return;
    if (!force && Date.now() - lastCloudPullAt < 15000) return;
    lastCloudPullAt = Date.now();
    try {
      const remote = await CLOUD.readUserState();
      if (!remote?.payload) { if (hasPersonalData(state)) await pushCloudState(); return; }
      const remoteTime = Date.parse(remote.updated_at || 0) || 0;
      const knownTime = Date.parse(state.meta?.lastSyncedAt || 0) || 0;
      if (remoteTime <= knownTime && !state.meta?.dirtySince) {
        state.meta.cloudRevision = Number(remote.revision || state.meta.cloudRevision || 0);
        syncState = { status: 'online', lastSyncedAt: state.meta?.lastSyncedAt || remote.updated_at, message: '' };
        renderAccountChrome(); return;
      }
      if (remoteTime > knownTime) {
        state = state.meta?.dirtySince ? mergeCloudStates(state, remote.payload) : applyRemoteState(remote.payload, state);
        state.meta.lastSyncedAt = remote.updated_at;
        state.meta.cloudRevision = Number(remote.revision || state.meta.cloudRevision || 0);
        rememberCachedMovies();
        persistLocalCache();
        if (state.meta?.dirtySince) await pushCloudState();
        else { syncState = { status: 'online', lastSyncedAt: remote.updated_at, message: '' }; renderAll(); }
      }
    } catch (error) {
      syncState = { status: 'error', lastSyncedAt: state.meta?.lastSyncedAt || null, message: error.message || 'Cloud pull failed' };
      renderAccountChrome();
    }
  }

  async function syncNow() {
    await pullCloudState({ force: true });
    if (state.meta?.dirtySince) await pushCloudState();
    else { syncState.status = 'online'; renderAccountChrome(); if (activeView === 'my' && myMode === 'settings') renderMy(); }
  }

  async function deleteAccount() {
    if (!requireAuth()) return;
    const email = currentUser?.email || '';
    const answer = await UI.ask({
      eyebrow: 'ACCOUNT',
      title: 'KINOSIS 계정을 완전히 삭제할까요?',
      message: 'Cloud Sync 데이터와 로그인 계정이 함께 삭제됩니다. 이 작업은 되돌릴 수 없습니다.',
      input: { label: `확인을 위해 ${email || '계정 이메일'} 입력`, value: '' },
      confirmText: '계정 삭제',
      danger: true,
    });
    if (!answer.confirmed) return;
    if (email && normalizeText(answer.input) !== normalizeText(email)) {
      UI.toast('이메일이 일치하지 않습니다.');
      return;
    }
    const token = CLOUD?.accessToken?.();
    if (!token) { UI.toast('로그인 세션을 다시 확인해주세요.'); return; }
    try {
      const response = await fetch('/api/delete-account', { method: 'POST', headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `Account delete ${response.status}`);
      const cacheKey = userCacheKey();
      if (cacheKey) localStorage.removeItem(cacheKey);
      await CLOUD?.signOut?.().catch(() => {});
      currentUser = null;
      hydratedUserId = null;
      state = initialState();
      syncState = { status: 'guest', lastSyncedAt: null, message: '' };
      setView('discover', { skipGate: true, route: 'replace' });
      renderAll();
      UI.toast('KINOSIS 계정을 삭제했습니다.');
    } catch (error) {
      UI.toast(error.message || '계정 삭제에 실패했습니다.');
    }
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
      if (hasPersonalData(cached) && cacheTime > cloudTime) next = mergeCloudStates(cached, next);
      const old = legacyState();
      const migrationKey = MIGRATION_PREFIX + currentUser.id;
      if (hasPersonalData(old) && !localStorage.getItem(migrationKey)) {
        const count = Object.keys(old.library || {}).length;
        const answer = await UI.ask({ eyebrow: 'LOCAL DATA', title: '이전 기록을 가져올까요?', message: `이 브라우저에서 이전 KINOSIS 기록 ${count}편을 찾았습니다. 현재 계정에 병합할 수 있습니다.`, confirmText: '가져오기' });
        if (answer.confirmed) next = mergeCloudStates(next, mergeImport(initialState(), old));
        localStorage.setItem(migrationKey, new Date().toISOString());
      }
      state = normalizeState(next);
      rememberCachedMovies();
      state.meta.lastSyncedAt = cloud?.updated_at || state.meta.lastSyncedAt || null;
      state.meta.cloudRevision = Number(cloud?.revision || state.meta.cloudRevision || 0);
      persistLocalCache();
      suppressCloudSync = false;
      if (!cloud || state.meta.dirtySince) await pushCloudState();
      else syncState = { status: 'online', lastSyncedAt: state.meta.lastSyncedAt, message: '' };
    } catch (error) {
      const cached = readJson(userCacheKey());
      state = normalizeState(cached || initialState());
      rememberCachedMovies();
      suppressCloudSync = false;
      syncState = { status: 'error', lastSyncedAt: state.meta?.lastSyncedAt || null, message: error.message || 'Cloud unavailable' };
    }
    await Promise.allSettled([refreshWatchlistAvailability()]);
    renderAll();
  }

  function lib(id) {
    return state.library[String(id)] || null;
  }

  function ensureLib(id) {
    const key = String(id);
    if (state.meta?.deletedLibrary?.[key]) delete state.meta.deletedLibrary[key];
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
    const key = String(movieId);
    const now = new Date().toISOString();
    const chronological = state.logs
      .filter((log) => String(log.movieId) === key)
      .sort((a, b) => String(a.watchedAt).localeCompare(String(b.watchedAt)) || String(a.createdAt).localeCompare(String(b.createdAt)));

    chronological.forEach((log, index) => {
      const next = index > 0;
      if (log.rewatch !== next) {
        log.rewatch = next;
        log.updatedAt = now;
      }
    });

    const entry = state.library[key] || (chronological.length ? ensureLib(key) : null);
    if (!entry) return;
    const newest = [...chronological].reverse();
    entry.watched = chronological.length > 0;
    if (chronological.length) entry.watchlist = false;
    entry.rating = newest.find((log) => log.rating != null)?.rating ?? null;
    entry.review = newest.find((log) => String(log.review || '').trim())?.review ?? '';
    entry.updatedAt = now;
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
    if (myStreamingState.status === 'ready' && myStreamingState.key === streamingSubscriptionKey()) return myStreamingState.results;
    return (CATALOG.movies || []).filter(availableOnMine);
  }

  function streamingSubscriptionKey() {
    return [...(state.subscriptions || [])].map((value) => String(value)).sort().join('|');
  }

  async function loadMyStreaming(force = false) {
    if (!isSignedIn() || !canUseLiveApi()) return false;
    const key = streamingSubscriptionKey();
    if (!key) { myStreamingState = { status: 'ready', key: '', results: [], message: '' }; return false; }
    if (!force && myStreamingState.status === 'ready' && myStreamingState.key === key) return false;
    if (!force && myStreamingState.status === 'loading' && myStreamingState.key === key) return false;
    myStreamingState = { status: 'loading', key, results: myStreamingState.key === key ? myStreamingState.results : [], message: '' };
    try {
      const data = await apiJson(`/api/my-streaming?providers=${encodeURIComponent((state.subscriptions || []).join(','))}`);
      const results = (data.results || []).map((record) => rememberMovie({ ...record, detailLoaded: false }, { persist: false })).filter(Boolean);
      myStreamingState = { status: 'ready', key, results, message: '' };
    } catch (error) {
      myStreamingState = { status: 'error', key, results: [], message: error.message || 'Streaming discovery failed' };
    }
    if (activeView === 'discover') renderDiscover({ hero: false, streaming: false });
    return true;
  }

  function providerBadges(record, max = 2) {
    const providers = (PROVIDER_API?.consolidate?.(subscriptionProviders(record)) || subscriptionProviders(record))
      .sort((a, b) => (isSubscribedProvider(b.name) ? 1 : 0) - (isSubscribedProvider(a.name) ? 1 : 0));
    return providers.slice(0, max).map((provider) => providerMarkHtml(provider, 'provider-icon')).join('');
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
    if (!response.ok) {
      const error = new Error(data?.error || `API ${response.status}`);
      error.status = response.status;
      throw error;
    }
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
    if (persist) persistLocalCache();
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
      persistLocalCache();
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
    const providers = PROVIDER_API?.consolidate?.(record?.providers || []) || [...(record?.providers || [])];
    return providers.sort((a, b) => (rank[a.types?.[0] || a.type] ?? 9) - (rank[b.types?.[0] || b.type] ?? 9)).slice(0, 4);
  }

  function heroTitleClass(title) {
    const count = [...String(title || '').replace(/\s/g, '')].length;
    return count > 24 ? 'hero-title is-xlong' : count > 15 ? 'hero-title is-long' : 'hero-title';
  }

  function heroKeyForElement(id) { return id === 'arthouseHero' ? 'arthouse' : 'discover'; }
  function heroSlidePool(key) {
    if (key === 'arthouse') return artPool().filter((record) => backdrop(record)).slice(0, 5);
    const preferred = CATALOG.featuredSlides || [];
    const upcoming = upcomingState.status === 'ready' ? upcomingState.results : (CATALOG.sections?.upcoming || []);
    return uniqueById([CATALOG.featured, ...preferred, ...(CATALOG.sections?.boxOffice || []), ...(CATALOG.sections?.theatres || []), ...upcoming, ...(CATALOG.sections?.rated || [])]).filter((record) => backdrop(record)).slice(0, 5);
  }

  function heroSlideMarkup(record, key, index) {
    const providers = heroProviders(record);
    const title = record.logoUrl
      ? `<div class="hero-title-wrap"><img class="hero-title-logo" src="${escapeHtml(record.logoUrl)}" alt="${escapeHtml(record.title)}" onerror="this.style.display='none';this.nextElementSibling.hidden=false"><h2 class="${heroTitleClass(record.title)}" hidden>${escapeHtml(record.title)}</h2></div>`
      : `<h2 class="${heroTitleClass(record.title)}">${escapeHtml(record.title)}</h2>`;
    return `<article class="hero-slide ${index === 0 ? 'is-active' : ''}" data-hero-slide="${index}" aria-hidden="${index === 0 ? 'false' : 'true'}">
      <img class="hero-bg" src="${escapeHtml(backdrop(record))}" alt="" ${index ? 'loading="lazy"' : ''}>
      <button class="hero-slide-open" data-hero-open="${escapeHtml(record.id)}" tabindex="${index === 0 ? '0' : '-1'}" aria-label="${escapeHtml(record.title)} 상세 보기"></button>
      <div class="hero-content" aria-hidden="true">
        <div class="hero-badges"><span class="mini-badge accent">${key === 'arthouse' ? 'ARTHOUSE' : 'FEATURED'}</span>${isInTheatres(record) ? '<span class="mini-badge">극장 상영 중</span>' : ''}</div>
        ${title}
        <div class="hero-meta"><span>${escapeHtml(record.director || '감독 정보 없음')}</span><span>·</span><span>${record.year || '—'}</span>${record.runtime ? `<span>·</span><span>${fmtRuntime(record.runtime)}</span>` : ''}</div>
        <div class="hero-watch"><div class="hero-provider-list">${providers.map((provider) => providerMarkHtml(provider, 'hero-provider')).join('')}</div>${isInTheatres(record) ? `<span class="hero-cinema">${icon('cinema')} 극장 상영</span>` : ''}</div>
        <span class="hero-open-hint">영화 상세 보기 →</span>
      </div>
    </article>`;
  }

  function getHeroController() {
    if (heroController) return heroController;
    heroController = HERO_CAROUSEL_FACTORY?.create?.({
      icon,
      openMovie,
      renderSlide: heroSlideMarkup,
      getActiveView: () => activeView,
      interval: 7200,
    }) || { render: () => {}, stop: () => {} };
    return heroController;
  }

  function stopHeroTimer(key) { getHeroController().stop(key); }

  function renderHeroCarousel(elementId, records = null, requestedIndex = null) {
    const element = document.getElementById(elementId);
    if (!element) return;
    const key = heroKeyForElement(elementId);
    const slides = uniqueById(records || heroSlidePool(key)).slice(0, 5);
    if (!slides.length) { element.innerHTML = '<div class="empty-state">카탈로그를 불러오지 못했습니다.</div>'; return; }
    getHeroController().render(element, key, slides, requestedIndex);
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
        <div class="card-overlay">${isSignedIn() ? `<div class="quick-actions"><button class="tiny-button ${entry?.watchlist ? 'is-active' : 'accent'}" data-action="watchlist" data-id="${record.id}" aria-label="${entry?.watchlist ? '보고싶어요 해제' : '보고싶어요 추가'}">${entry?.watchlist ? '✓' : '＋'}</button><button class="tiny-button" data-action="log" data-id="${record.id}">감상 기록</button></div>` : ''}</div>
      </div>
      <div class="card-info"><p class="card-title">${escapeHtml(record.title)}</p><div class="card-meta"><span>${record.year || '—'}</span>${availableOnMine(record) ? '<span class="mine-dot"></span><span>내 구독</span>' : ''}</div></div>
    </article>`;
  }

  function rowSection(title, subtitle, movies, limit = 12, variant = 'discover') {
    const list = uniqueById(movies || []).slice(0, limit);
    const rowClass = variant === 'arthouse' ? 'poster-row arthouse-poster-row' : 'poster-row';
    return `<section class="content-section"><div class="section-head"><div><h2>${escapeHtml(title)}</h2>${subtitle ? `<p>${escapeHtml(subtitle)}</p>` : ''}</div></div>${list.length ? `<div class="${rowClass}">${list.map((record) => card(record, variant)).join('')}</div>` : `<div class="empty-state"><b>아직 표시할 영화가 없습니다.</b><span>데이터가 갱신되면 이 섹션도 자동으로 채워집니다.</span></div>`}</section>`;
  }

  function getCurationLoader() {
    if (curationLoader) return curationLoader;
    curationLoader = CURATION_LOADER_FACTORY?.create?.({
      fetchDirector: async (item) => {
        const source = item.source || {};
        const params = new URLSearchParams();
        if (source.personId) params.set('id', source.personId);
        else params.set('name', source.name || '');
        params.set('sort', source.sort || 'release_asc');
        params.set('mode', source.mode || 'all-directed');
        if (source.include?.length) params.set('include', source.include.join(','));
        if (source.exclude?.length) params.set('exclude', source.exclude.join(','));
        const data = await apiJson(`/api/director-filmography?${params.toString()}`);
        return data.results || [];
      },
      fallbackDirector: async (item) => (CATALOG.movies || []).filter((record) => normalizeText(record.director) === normalizeText(item.source.name)),
      normalizeRows: (rows) => uniqueById((rows || []).map((record) => rememberMovie(record, { persist: false })).filter(Boolean)),
    }) || { ensure: async () => ({ changed: false, rows: null }), peek: () => null };
    return curationLoader;
  }

  function curationMovieIds(item) {
    const dynamic = getCurationLoader().peek(item?.slug);
    return dynamic?.length ? dynamic.map((record) => String(record.id)) : (item?.movies || []).map((entry) => String(entry.id));
  }
  function curationMovies(item) { return curationMovieIds(item).map((id) => movie(id)).filter(Boolean); }
  function curationHeroMovie(item) { return movie(item?.heroMovieId) || curationMovies(item)[0] || null; }
  async function hydrateCurationIds(ids, concurrency = 5) { let cursor = 0; const workers = Array.from({ length: Math.min(concurrency, ids.length) }, async () => { while (cursor < ids.length) { const id = ids[cursor++]; await ensureMovieDetail(id,{persist:false}).catch(()=>null); } }); await Promise.all(workers); }

  async function ensureCurationMovies(item) {
    if (!item || !canUseLiveApi()) return false;
    if (item.source?.type === 'director') {
      const result = await getCurationLoader().ensure(item);
      return !!result?.changed;
    }
    const missing = (item.movies || []).map((entry) => String(entry.id)).filter((id) => !movie(id));
    if (!missing.length) return false;
    await hydrateCurationIds(missing, 5);
    return true;
  }

  function curationFeature(item, { compact = false } = {}) {
    if (!item) return '';
    // Arthouse landing must stay editorial and instant. Director filmographies
    // are resolved only after the user opens a curation.
    const heroMovie = curationHeroMovie(item);
    const image = heroMovie ? backdrop(heroMovie) : '';
    const filmCount = curationMovieIds(item).length;
    const countLabel = filmCount ? `${filmCount}편` : item.source?.type === 'director' ? '감독 필모그래피' : 'Curation';
    return `<section class="curation-feature ${compact ? 'is-compact' : ''}" data-curation="${escapeHtml(item.slug)}" tabindex="0" role="link" aria-label="${escapeHtml(item.title)} 기획전 열기">
      ${image ? `<img class="curation-feature-bg" src="${escapeHtml(image)}" alt="">` : '<div class="curation-feature-placeholder"></div>'}
      <div class="curation-feature-copy">
        <p class="editorial-kicker">${escapeHtml(item.eyebrow || 'KINOSIS CURATION')}</p>
        <h2>${escapeHtml(item.title)}</h2>
        ${item.subtitle ? `<h3>${escapeHtml(item.subtitle)}</h3>` : ''}
        ${item.description ? `<p>${escapeHtml(item.description)}</p>` : ''}
        <span>${countLabel}${item.credit ? ` · ${escapeHtml(item.credit)}` : ''}</span>
      </div>
    </section>`;
  }

  function myStreamingSection(title = '내 구독 서비스에서', source = null, variant = 'discover') {
    if (!isSignedIn()) return '';
    if (!(state.subscriptions || []).length) return `<section class="content-section"><div class="section-head"><div><h2>${escapeHtml(title)}</h2><p>MY → 설정에서 이용 중인 OTT를 먼저 선택하세요.</p></div></div></section>`;
    const list = (source || myStreamingMovies()).filter(availableOnMine);
    if (list.length) return rowSection(title, myStreamingState.status === 'ready' ? '선택한 OTT의 대한민국 구독 제공작을 실시간으로 탐색합니다.' : '구독 서비스에서 확인된 영화.', list, 14, variant);
    if (myStreamingState.status === 'loading') return `<section class="content-section"><div class="section-head"><div><h2>${escapeHtml(title)}</h2><p>구독 서비스의 최신 제공작을 불러오는 중입니다.</p></div></div><div class="rail-loading"></div></section>`;
    return `<section class="content-section"><div class="section-head"><div><h2>${escapeHtml(title)}</h2><p>현재 확인된 구독 제공작이 없습니다.</p></div></div></section>`;
  }

  function guestStreamingPrompt() {
    return `<section class="content-section"><div class="section-head"><div><h2>내 구독 서비스에서</h2></div></div><button class="streaming-signin" data-open-auth>${icon('cloud')}<span>로그인하면 이용 중인 OTT에서 바로 볼 수 있는 영화만 모아봅니다.</span><b>로그인</b></button></section>`;
  }
  async function loadLiveUpcoming(force = false) {
    const cached = CATALOG.sections?.upcoming || [];
    if (!canUseLiveApi() || (!force && cached.length >= 7) || upcomingState.status === 'loading' || (!force && upcomingState.status === 'ready')) return false;
    upcomingState = { ...upcomingState, status: 'loading' };
    try {
      const data = await apiJson('/api/upcoming');
      const results = uniqueById((data.results || []).map((record) => rememberMovie({ ...record, detailLoaded: false }, { persist: false })).filter(Boolean));
      upcomingState = { status: results.length ? 'ready' : 'unavailable', results, updatedAt: data.updatedAt || null };
    } catch {
      upcomingState = { status: 'unavailable', results: [], updatedAt: null };
    }
    if (activeView === 'discover') {
      renderDiscover({ hero: true, streaming: false, upcoming: false });
    }
    return upcomingState.status === 'ready';
  }

  async function loadLiveBoxOffice() {
    if (!canUseLiveApi() || boxOfficeState.status === 'loading' || boxOfficeState.status === 'ready' || boxOfficeState.status === 'unavailable') return;
    boxOfficeState = { status: 'loading', results: [] };
    try {
      const data = await apiJson('/api/box-office');
      const results = (data.results || []).map((record) => rememberMovie({ ...record, detailLoaded: false }, { persist: false })).filter(Boolean);
      boxOfficeState = results.length ? { status: 'ready', results } : { status: 'unavailable', results: [] };
    } catch {
      boxOfficeState = { status: 'unavailable', results: [] };
    }
    if (activeView === 'discover') renderDiscover({ hero: false });
  }

  function rankedSection(list, { exact = false } = {}) {
    const rows=uniqueById(list||[]).slice(0,14); if(!rows.length)return'';
    if (!exact) {
      return `<section class="content-section"><div class="section-head"><div><h2>현재 상영작</h2><p>정확한 박스오피스 순위는 KOBIS 연결 시 표시됩니다.</p></div></div><div class="poster-row">${rows.map((record)=>card(record)).join('')}</div></section>`;
    }
    return `<section class="content-section"><div class="section-head"><div><h2>박스오피스</h2><p>KOBIS 일별 박스오피스 기준</p></div></div><div class="poster-row ranked-row">${rows.map((record,index)=>`<div class="ranked-card"><span class="rank-number">${String(record.boxOfficeRank||index+1).padStart(2,'0')}</span>${card(record)}</div>`).join('')}</div></section>`;
  }
  function upcomingSection(list) {
    const rows=uniqueById(list||[]).slice(0,14); if(!rows.length)return'';
    return `<section class="content-section"><div class="section-head"><div><h2>공개 예정작</h2></div></div><div class="poster-row">${rows.map((record)=>`<div class="upcoming-card">${card(record)}<time>${record.releaseDate?formatDate(record.releaseDate):''}</time></div>`).join('')}</div></section>`;
  }
  function renderDiscover({ hero = true, streaming = true, upcoming = true } = {}) {
    if (hero) renderHeroCarousel('hero', heroSlidePool('discover'));
    if (boxOfficeState.status === 'idle') loadLiveBoxOffice().catch(() => {});
    if (upcoming && (CATALOG.sections?.upcoming || []).length < 7 && upcomingState.status === 'idle') loadLiveUpcoming().catch(() => {});
    if (streaming && isSignedIn() && (state.subscriptions || []).length) loadMyStreaming().catch(() => {});
    let html='';
    const exactBoxOffice = boxOfficeState.status === 'ready'
      ? boxOfficeState.results
      : (CATALOG.sources?.boxOffice?.mode === 'kobis' ? CATALOG.sections?.boxOffice || [] : []);
    html+=exactBoxOffice.length
      ? rankedSection(exactBoxOffice, { exact: true })
      : rankedSection(CATALOG.sections?.theatres || [], { exact: false });
    const upcomingRows = upcomingState.status === 'ready' && upcomingState.results.length
      ? upcomingState.results
      : (CATALOG.sections?.upcoming?.length ? CATALOG.sections.upcoming : (CATALOG.movies || []).filter((record) => record.releaseDate && Date.parse(record.releaseDate) > Date.now()).sort((a, b) => String(a.releaseDate).localeCompare(String(b.releaseDate))));
    html += upcomingSection(upcomingRows);
    html+=isSignedIn()?myStreamingSection('내 구독 서비스에서',null,'discover'):guestStreamingPrompt();
    html+=rowSection('높은 평가를 받은 영화','',CATALOG.sections?.rated||[],14,'discover');
    document.getElementById('discoverContent').innerHTML=html;
  }
  function renderArthouse() {
    const art=artPool(); renderHeroCarousel('arthouseHero',heroSlidePool('arthouse'));
    const latest=[...art].filter(r=>r.releaseDate||r.year).sort((a,b)=>String(b.releaseDate||b.year||'').localeCompare(String(a.releaseDate||a.year||''))).slice(0,18);
    const rated=[...art].filter(r=>Number(r.voteCount||0)>=50).sort((a,b)=>Number(b.voteAverage||0)-Number(a.voteAverage||0)||Number(b.voteCount||0)-Number(a.voteCount||0)).slice(0,18);
    let html=rowSection('최신 공개작','',latest,14,'discover')+rowSection('높은 평가를 받은 영화','',rated,14,'discover');
    const curated=CURATIONS.forSurface('arthouse').slice(0,4);
    html+=curated.map(item=>`<section class="content-section arthouse-curation-slot">${curationFeature(item)}</section>`).join('');
    document.getElementById('arthouseContent').innerHTML=html;
  }

  function renderCollectionsSide() {
    const element = document.getElementById('collectionSideLinks');
    if (!element) return;
    element.innerHTML = state.collections.map((collection) => `<button class="side-link" data-collection="${escapeHtml(collection.id)}">${icon('folder')}${escapeHtml(collection.name)}</button>`).join('');
  }

  function libraryHeader(title, summary = '', extras = '') { return `<header class="library-header simple-library-head"><div><h1>${escapeHtml(title)}</h1>${summary?`<span>${escapeHtml(summary)}</span>`:''}</div><div class="library-header-actions">${extras}</div></header>`; }

  function filterLibrary(list) {
    let out = [...list];
    const query = libraryFilter.q.trim().toLocaleLowerCase('ko-KR');
    if (query) out = out.filter((record) => [record.title, record.originalTitle, record.director, ...genreNames(record)]
      .filter(Boolean).join(' ').toLocaleLowerCase('ko-KR').includes(query));
    if (libraryFilter.sort === 'title') out.sort((a, b) => a.title.localeCompare(b.title, 'ko'));
    else if (libraryFilter.sort === 'rating') out.sort((a, b) => (lib(b.id)?.rating || 0) - (lib(a.id)?.rating || 0));
    else if (libraryFilter.sort === 'year') out.sort((a, b) => (b.year || 0) - (a.year || 0));
    else if (libraryFilter.sort === 'watched') out.sort((a, b) => String(logsForMovie(b.id)[0]?.watchedAt || '').localeCompare(String(logsForMovie(a.id)[0]?.watchedAt || '')));
    else out.sort((a, b) => String(lib(b.id)?.savedAt || '').localeCompare(String(lib(a.id)?.savedAt || '')));
    return out;
  }

  function libraryToolbar(list) {
    return `<div class="library-toolbar simple-library-toolbar"><label class="library-search">${icon('search')}<input id="libraryQuery" value="${escapeHtml(libraryFilter.q)}" placeholder="Library 검색"></label><select id="librarySort" aria-label="정렬"><option value="recent" ${libraryFilter.sort==='recent'?'selected':''}>최근 추가</option><option value="watched" ${libraryFilter.sort==='watched'?'selected':''}>최근 감상</option><option value="title" ${libraryFilter.sort==='title'?'selected':''}>제목</option><option value="rating" ${libraryFilter.sort==='rating'?'selected':''}>내 평점</option><option value="year" ${libraryFilter.sort==='year'?'selected':''}>개봉연도</option></select><div class="view-toggle"><button class="${libraryView==='grid'?'is-active':''}" data-library-view="grid" aria-label="그리드 보기">${icon('grid')}</button><button class="${libraryView==='list'?'is-active':''}" data-library-view="list" aria-label="목록 보기">${icon('list')}</button></div></div>`;
  }

  function libraryListRows(list) {
    return `<div class="library-list">${list.map((record) => {
      const entry = lib(record.id);
      const last = logsForMovie(record.id)[0];
      return `<div class="library-row" data-movie="${record.id}" tabindex="0"><img src="${escapeHtml(poster(record))}" alt=""><div><div class="library-row-title">${escapeHtml(record.title)}</div><div class="library-row-sub">${escapeHtml(record.director || '')} · ${genreNames(record).slice(0, 2).map(escapeHtml).join(' · ')}</div></div><div class="library-row-cell">${record.year || '—'}</div><div class="library-row-cell rating">${entry?.rating ? `★ ${entry.rating}` : '—'}</div><div class="library-row-cell">${last ? formatDate(last.watchedAt) : '—'}</div><div class="library-row-cell">${availableOnMine(record) ? '내 구독에서 가능' : isInTheatres(record) ? '극장 상영' : '—'}</div></div>`;
    }).join('')}</div>`;
  }

  function listPage(title, summary, list) {
    const filtered=filterLibrary(list);
    return `${libraryHeader(title, `${filtered.length}편`)}${libraryToolbar(list)}${filtered.length?(libraryView==='grid'?`<div class="library-grid">${filtered.map(record=>card(record,'library')).join('')}</div>`:libraryListRows(filtered)):`<div class="empty-state"><b>영화가 없습니다.</b></div>`}`;
  }

  function renderCollectionDetail(collection) {
    const movies = collection.movieIds.map(movie).filter(Boolean);
    const cover = collectionCover(collection);
    return `${libraryHeader(collection.name, collection.description || '직접 만든 컬렉션', `<div class="collection-head-actions"><button class="secondary-button" data-edit-collection="${escapeHtml(collection.id)}">${icon('edit')} 편집</button><button class="danger-text-button" data-delete-collection="${escapeHtml(collection.id)}">삭제</button></div>`)}
      <section class="collection-detail-hero ${cover ? 'has-cover' : ''}">${cover ? `<img src="${escapeHtml(cover)}" alt="">` : ''}<div><p class="eyebrow">PERSONAL COLLECTION</p><h2>${escapeHtml(collection.name)}</h2><p>${escapeHtml(collection.description || `${movies.length}편의 영화`)}</p></div></section>
      ${movies.length ? `<div class="collection-order-list">${movies.map((record, index) => `<div class="collection-order-row"><button class="collection-film-main" data-movie="${record.id}"><img src="${escapeHtml(poster(record))}" alt=""><span><b>${escapeHtml(record.title)}</b><small>${record.year || '—'} · ${escapeHtml(record.director || '')}</small></span></button><div class="collection-order-actions"><button data-collection-move="up" data-collection-id="${escapeHtml(collection.id)}" data-index="${index}" ${index === 0 ? 'disabled' : ''}>↑</button><button data-collection-move="down" data-collection-id="${escapeHtml(collection.id)}" data-index="${index}" ${index === movies.length - 1 ? 'disabled' : ''}>↓</button><button data-collection-remove="${record.id}" data-collection-id="${escapeHtml(collection.id)}">×</button></div></div>`).join('')}</div>` : '<div class="empty-state"><b>아직 영화가 없습니다.</b><span>영화 상세에서 Collection에 추가해보세요.</span></div>'}`;
  }

  function renderLibrary() {
    const content=document.getElementById('libraryContent'); if(!content)return;
    if(!isSignedIn()){content.innerHTML=gateHtml('Library');document.getElementById('libraryCount').textContent='0';return;}
    document.getElementById('libraryCount').textContent=allSavedMovies().length; renderCollectionsSide();
    document.querySelectorAll('[data-library]').forEach(button=>button.classList.toggle('is-active',button.dataset.library===libraryMode));
    if(libraryMode==='all')content.innerHTML=listPage('전체 영화','',allSavedMovies());
    else if(libraryMode==='watchlist')content.innerHTML=listPage('보고싶어요','',allSavedMovies().filter(record=>lib(record.id)?.watchlist));
    else if(libraryMode==='favorites')content.innerHTML=listPage('좋아요','',allSavedMovies().filter(record=>lib(record.id)?.favorite));
    else if(libraryMode==='collections')content.innerHTML=`${libraryHeader('컬렉션',`${state.collections.length}개 컬렉션`,'<button class="primary-button" id="newCollectionButton">＋ 새 컬렉션</button>')}<div class="collection-grid">${state.collections.map(collection=>{const cover=collectionCover(collection);return `<article class="collection-card rich-collection" data-collection-card="${escapeHtml(collection.id)}">${cover?`<img src="${escapeHtml(cover)}" alt="">`:''}<div class="collection-card-shade"></div><div class="collection-card-copy"><h3>${escapeHtml(collection.name)}</h3><p>${collection.movieIds.length}편</p></div></article>`}).join('')}</div>`;
    else if(libraryMode.startsWith('collection:')){const collection=state.collections.find(item=>item.id===libraryMode.split(':')[1]);content.innerHTML=collection?renderCollectionDetail(collection):listPage('전체 영화','',allSavedMovies());}
    else {libraryMode='all';content.innerHTML=listPage('전체 영화','',allSavedMovies());}
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
    const syncClass = syncState.status === 'online' ? 'online' : syncState.status === 'error' ? 'error' : 'pending';
    const syncLabel = syncState.status === 'error' ? '동기화 문제' : syncState.status === 'syncing' || syncState.status === 'pending' ? '동기화 중' : '동기화됨';
    const subscriptions = PROVIDERS.map((provider) => {
      const mark = PROVIDER_API?.catalogLogo?.(provider.key, CATALOG.movies || []) || { url: provider.logoOverride || null, kind: provider.logoKind || 'tile' };
      const logo = mark.url ? `<span class="subscription-mark ${mark.kind === 'wordmark' ? 'is-wordmark' : ''}"><img src="${escapeHtml(mark.url)}" alt="${escapeHtml(provider.label)}"></span>` : `<span class="subscription-mark is-fallback">${escapeHtml(provider.label.slice(0,2))}</span>`;
      return `<div class="subscription">${logo}<span>${escapeHtml(provider.label)}</span><button data-subscription="${escapeHtml(provider.key)}">${isSubscriptionEnabled(provider.key) ? '구독 중' : '등록'}</button></div>`;
    }).join('');
    return `<div class="settings-grid">
      <section class="settings-card"><h3>구독 서비스</h3><p>이용 중인 OTT를 선택하면 Discover에서 지금 볼 수 있는 영화를 우선 보여줍니다.</p><div class="subscription-grid">${subscriptions}</div></section>
      <section class="settings-card account-settings"><h3>계정</h3><div class="account-sync-summary"><span class="sync-dot ${syncClass}"></span><div><b>${escapeHtml(currentUser?.email || '')}</b><small>${escapeHtml(syncLabel)}</small></div></div>${syncState.message ? `<p class="sync-error">${escapeHtml(syncState.message)}</p><button class="secondary-button" id="syncNowButton">다시 시도</button>` : ''}<div class="settings-actions"><button class="secondary-button" id="accountExportButton">내 데이터 내보내기</button><button class="secondary-button" id="signOutButton">로그아웃</button></div><details class="settings-advanced"><summary>고급 동기화 정보</summary><p>최근 동기화 · ${formatDateTime(state.meta?.lastSyncedAt)}<br>Cloud revision · ${Number(state.meta?.cloudRevision || 0)}</p>${!syncState.message ? '<button class="secondary-button" id="syncNowButton">지금 동기화</button>' : ''}</details></section>
      <section class="settings-card"><h3>가져오기</h3><p>기존 영화 기록을 KINOSIS로 옮길 수 있습니다.</p><button class="secondary-button" id="openLetterboxdImport">Letterboxd CSV 가져오기</button><button class="secondary-button" id="openAboutFromSettings">KINOSIS JSON · 데이터 출처</button></section>
      <section class="settings-card danger-zone"><h3>계정 삭제</h3><p>인증 계정과 Cloud Sync 데이터를 모두 삭제합니다. 이 작업은 되돌릴 수 없습니다.</p><button class="danger-button" id="deleteAccountButton">계정 완전히 삭제</button></section>
    </div>`;
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
      content.innerHTML = `${recent.length ? rowSection('최근 본 영화', '내 최근 감상 기록.', recent, 8, 'library') : ''}${reviews.length ? `<section class="my-section"><div class="section-head"><div><h2>최근 기록</h2><p>평점, 리뷰, 재관람을 한 흐름에서 확인합니다.</p></div><button class="section-action" data-my="reviews">전체 보기</button></div>${viewingTimeline(reviews.slice(0, 4))}</section>` : ''}<section class="my-section">${calendarHtml()}</section>`;
    } else if (myMode === 'reviews') {
      content.innerHTML = `<section class="my-section"><div class="section-head"><div><h2>기록</h2><p>평점, 리뷰, 재관람을 시간순으로 한곳에서 관리합니다.</p></div></div>${state.logs.length ? viewingTimeline() : '<div class="empty-state"><b>아직 감상 기록이 없습니다.</b><span>영화를 본 뒤 감상 기록을 남겨보세요.</span></div>'}</section>`;
    } else if (myMode === 'stats') {
      content.innerHTML = `<section class="my-section">${statsHtml()}</section>`;
    } else {
      content.innerHTML = `<section class="my-section">${settingsHtml()}</section>`;
    }
  }

  function consolidatedProviders(record) {
    const rows = PROVIDER_API?.consolidate?.(record?.providers || []) || (record?.providers || []);
    return rows.map((provider) => ({
      ...provider,
      label: PROVIDER_API?.label?.(provider) || provider.label || provider.name,
      isMine: (provider.types || [provider.type]).includes('subscription') && isSubscribedProvider(provider.name || provider.key),
    }));
  }

  function freshnessLabel(value) {
    const time = Date.parse(value || 0);
    if (!time) return '';
    const minutes = Math.max(0, Math.round((Date.now() - time) / 60000));
    if (minutes < 5) return '방금 업데이트';
    if (minutes < 60) return `${minutes}분 전 업데이트`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `${hours}시간 전 업데이트`;
    return `${formatDate(value)} 업데이트`;
  }

  function watchAvailabilityHtml(record) {
    const providers = consolidatedProviders(record);
    const inTheatres = isInTheatres(record);
    const recentTheatrical = !inTheatres && record?.theatricalStatus === 'recent';
    const rows = [];
    if (inTheatres || recentTheatrical) {
      const date = record.theatricalReleaseDate || record.releaseDate;
      rows.push(`<div class="watch-row cinema-option ${inTheatres ? 'is-current' : 'is-recent'}"><span class="watch-row-mark">${icon('cinema')}</span><span class="watch-row-copy"><strong>극장</strong><small>${inTheatres ? '현재 상영 확인' : '최근 극장 개봉'}${date ? ` · ${formatDate(date)}` : ''}</small></span><span class="watch-row-type">${inTheatres ? '상영 중' : '개봉'}</span></div>`);
    }
    for (const provider of providers) {
      const mark = providerMarkHtml(provider, 'watch-provider-mark');
      const types = (provider.types || [provider.type]).filter(Boolean).map(providerTypeLabel).join(' · ');
      rows.push(`<div class="watch-row ${provider.isMine ? 'is-mine' : ''}">${mark}<span class="watch-row-copy"><strong>${escapeHtml(provider.label || provider.name)}</strong><small>${escapeHtml(types || '제공')}</small></span><span class="watch-row-type">${provider.isMine ? '내 구독' : escapeHtml((provider.types || [provider.type]).includes('subscription') ? '구독' : types)}</span></div>`);
    }
    const fresh = freshnessLabel(record.availabilityUpdatedAt);
    if (!rows.length) {
      return `<section class="detail-side-card watch-card is-empty"><div class="detail-side-title"><p>감상처</p><h2>현재 확인된 감상처가 없습니다.</h2></div><p class="watch-empty-copy">극장 또는 OTT 제공 정보가 확인되면 이곳에 표시됩니다.</p></section>`;
    }
    return `<section class="detail-side-card watch-card"><div class="detail-side-title"><p>WHERE TO WATCH</p><h2>어디서 볼 수 있나요</h2></div><div class="watch-rows">${rows.join('')}</div>${record.watchLink ? `<a class="watch-all-link" href="${escapeHtml(record.watchLink)}" target="_blank" rel="noopener noreferrer">전체 감상처 확인 <span>↗</span></a>` : ''}<p class="watch-source">${fresh ? `${escapeHtml(fresh)} · ` : ''}JustWatch via TMDB 기준${inTheatres ? ' · 극장 상영 정보 포함' : ''}</p></section>`;
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
    const country = (record.productionCountries || []).slice(0, 2).join(' · ');
    const genres = genreNames(record).slice(0, 4);
    const releaseLabel = isInTheatres(record) ? '극장 상영 중' : record.theatricalStatus === 'upcoming' ? '개봉 예정' : record.theatricalStatus === 'recent' ? '최근 극장 개봉' : '';
    const titleMeta = [record.year || '', genres.slice(0,2).join('/'), country, record.runtime ? fmtRuntime(record.runtime) : ''].filter(Boolean).join(' · ');
    const cast = uniqueById(record.cast || []).slice(0, 8);
    const writers = uniqueById((record.writers || []).map((person) => ({ ...person, id: person.id || `writer-${person.name}`, title: person.name }))).slice(0, 4);
    const cinematographers = uniqueById((record.cinematographers || []).map((person) => ({ ...person, id: person.id || `dp-${person.name}`, title: person.name }))).slice(0, 2);
    document.title = `${record.title} — KINOSIS`;
    document.getElementById('moviePage').innerHTML = `
      <div class="detail-topnav">
        <button data-movie-back>${icon('back')}<span>${previousView === 'curation' ? '기획전' : previousView === 'arthouse' ? 'ARTHOUSE' : previousView === 'library' ? 'LIBRARY' : previousView === 'my' ? 'MY' : 'DISCOVER'}</span></button>
        <button class="detail-share" data-share-movie="${record.id}">${icon('share')}<span>공유</span></button>
      </div>

      <section class="detail-hero">
        <img class="detail-backdrop" src="${escapeHtml(backdrop(record))}" alt="">
        <div class="detail-backdrop-shade"></div>
        <div class="detail-hero-inner">
          <img class="detail-poster" src="${escapeHtml(poster(record))}" alt="${escapeHtml(record.title)} 포스터">
          <div class="detail-intro">
            <div class="detail-badges">${Number(record.boxOfficeRank || 0) > 0 ? `<span class="detail-badge is-boxoffice">박스오피스 ${Number(record.boxOfficeRank)}위</span>` : ''}${releaseLabel ? `<span class="detail-badge is-cinema">${icon('cinema')}${escapeHtml(releaseLabel)}</span>` : ''}${art.isArt ? '<span class="detail-badge">KINOSIS ARTHOUSE</span>' : ''}</div>
            <h1>${escapeHtml(record.title)}</h1>
            ${record.originalTitle && record.originalTitle !== record.title ? `<p class="detail-original">${escapeHtml(record.originalTitle)}</p>` : ''}
            <p class="detail-meta">${escapeHtml(titleMeta || '영화 정보')}</p>
            <p class="detail-director">감독 ${record.directorId ? `<button data-person-id="${escapeHtml(record.directorId)}" data-person-name="${escapeHtml(record.director || '')}">${escapeHtml(record.director || '—')}</button>` : `<b>${escapeHtml(record.director || '—')}</b>`}</p>
            ${record.tagline ? `<p class="detail-tagline">${escapeHtml(record.tagline)}</p>` : ''}
            <div class="detail-actions">
              <button class="primary-button detail-action" data-action="log" data-id="${record.id}">${logs.length ? '감상 기록 추가' : '감상 기록'}</button>
              <button class="detail-watchlist ${entry?.watchlist ? 'is-active' : ''}" data-action="watchlist" data-id="${record.id}">${entry?.watchlist ? '✓ 보고싶어요' : '＋ 보고싶어요'}</button>
              <details class="film-more">
                <summary class="detail-more" aria-label="더 보기">${icon('more')}</summary>
                <div class="film-more-menu">
                  <button class="${entry?.favorite ? 'is-active' : ''}" data-action="favorite" data-id="${record.id}">${entry?.favorite ? '♥ 좋아요 해제' : '♡ 좋아요'}</button>
                  <button data-action="collection-add" data-id="${record.id}">＋ 컬렉션에 추가</button>
                </div>
              </details>
            </div>
          </div>
          <div class="detail-rating-box">
            ${entry?.rating ? `<div class="detail-user-rating"><span>내 평점</span><strong>★ ${entry.rating}</strong><small>${logs.length ? `${logs.length}회 감상` : ''}</small></div>` : `<button class="detail-rate-cta" data-action="log" data-id="${record.id}"><span>내 평점</span><strong>평가하기</strong></button>`}
            <div class="detail-external-rating"><span>TMDB</span><b>${record.voteAverage ? Number(record.voteAverage).toFixed(1) : '—'}</b>${record.voteCount ? `<small>${Number(record.voteCount).toLocaleString()}명</small>` : ''}</div>
          </div>
        </div>
      </section>

      <div class="detail-layout">
        <main class="detail-main">
          <section class="detail-section detail-synopsis">
            <h2>줄거리</h2>
            <p>${escapeHtml(record.overview || '줄거리 정보가 없습니다.')}</p>
          </section>

          ${cast.length ? `<section class="detail-section"><div class="detail-section-head"><h2>출연</h2><span>${record.cast.length > cast.length ? `${record.cast.length}명 중 주요 출연진` : '주요 출연진'}</span></div><div class="detail-cast-grid">${cast.map((person) => `<button class="detail-cast-person" data-person-id="${escapeHtml(person.id || '')}" data-person-name="${escapeHtml(person.name || person)}">${person.profileUrl ? `<img src="${escapeHtml(person.profileUrl)}" alt="${escapeHtml(person.name || person)}">` : `<span class="cast-avatar-fallback">${escapeHtml(String(person.name || person).slice(0,1))}</span>`}<span><b>${escapeHtml(person.name || person)}</b><small>${escapeHtml(person.character || '')}</small></span></button>`).join('')}</div></section>` : ''}

          <section class="detail-section">
            <h2>작품 정보</h2>
            <dl class="detail-facts">
              <div><dt>감독</dt><dd>${record.directorId ? `<button data-person-id="${escapeHtml(record.directorId)}" data-person-name="${escapeHtml(record.director || '')}">${escapeHtml(record.director || '—')}</button>` : escapeHtml(record.director || '—')}</dd></div>
              ${writers.length ? `<div><dt>각본</dt><dd>${writers.map((person) => escapeHtml(person.name)).join(' · ')}</dd></div>` : ''}
              ${cinematographers.length ? `<div><dt>촬영</dt><dd>${cinematographers.map((person) => escapeHtml(person.name)).join(' · ')}</dd></div>` : ''}
              <div><dt>장르</dt><dd>${genres.map((genre)=>`<button data-search-query="${escapeHtml(genre)}">${escapeHtml(genre)}</button>`).join(' · ') || '—'}</dd></div>
              ${country ? `<div><dt>국가</dt><dd>${escapeHtml(country)}</dd></div>` : ''}
              ${record.originalLanguage ? `<div><dt>언어</dt><dd>${escapeHtml(String(record.originalLanguage).toUpperCase())}</dd></div>` : ''}
              ${record.releaseDate ? `<div><dt>공개일</dt><dd>${escapeHtml(formatDate(record.releaseDate))}</dd></div>` : ''}
              ${record.runtime ? `<div><dt>러닝타임</dt><dd>${escapeHtml(fmtRuntime(record.runtime))}</dd></div>` : ''}
            </dl>
          </section>

          ${related.length ? `<section class="detail-section detail-related"><div class="detail-section-head"><h2>비슷한 영화</h2></div><div class="poster-row">${uniqueById(related).slice(0,7).map((item)=>card(item)).join('')}</div></section>` : ''}
        </main>

        <aside class="detail-side">
          ${watchAvailabilityHtml(record)}
          <section class="detail-side-card my-detail-card">
            <div class="detail-side-title"><p>MY</p><h2>내 기록</h2></div>
            ${isSignedIn() ? (entry ? `<div class="my-activity">${entry.rating ? `<div class="activity-rating">★ ${entry.rating}</div>` : ''}${entry.review ? `<div class="activity-review">${escapeHtml(entry.review)}</div>` : ''}<div class="activity-empty">${logs.length ? `${logs.length}회 감상 · 최근 ${formatDate(last.watchedAt)}` : entry.watchlist ? '보고싶어요에 저장됨' : '영화와의 기록이 저장됨'}</div>${viewingHistoryHtml(record)}<button class="danger-text-button" data-remove-library="${record.id}">이 영화의 모든 기록 삭제</button></div>` : '<div class="activity-empty">아직 이 영화에 대한 기록이 없습니다.</div>') : '<button class="streaming-signin compact" data-open-auth>로그인하고 감상 기록 남기기</button>'}
          </section>
        </aside>
      </div>
    `;
  }


  function renderCurationPage(item) {
    if (!item) return;
    ensureCurationMovies(item).then((changed) => {
      if (changed && activeView === 'curation' && curationSlug === item.slug) renderCurationPage(item);
    }).catch(() => {});
    const films = curationMovies(item);
    const heroMovie = curationHeroMovie(item);
    const heroImage = heroMovie ? backdrop(heroMovie) : '';
    const sourceLabel = item.surface === 'discover' ? 'Discover' : item.surface === 'both' ? 'Discover / Arthouse' : 'Arthouse';
    document.title = `${item.title} — KINOSIS`;
    document.getElementById('curationPage').innerHTML = `<div class="movie-page-back"><button data-curation-back>${icon('back')} ${curationPreviousView === 'discover' ? 'Discover' : 'Arthouse'}로 돌아가기</button><button class="share-link" data-share-curation="${escapeHtml(item.slug)}">링크 복사</button></div>
      <section class="curation-page-hero">${heroImage ? `<img class="curation-page-bg" src="${escapeHtml(heroImage)}" alt="">` : ''}<div class="curation-page-copy"><p class="editorial-kicker">${escapeHtml(item.eyebrow || 'KINOSIS CURATION')}</p><h1>${escapeHtml(item.title)}</h1>${item.subtitle ? `<h2>${escapeHtml(item.subtitle)}</h2>` : ''}${item.description ? `<p>${escapeHtml(item.description)}</p>` : ''}<div class="curation-page-meta"><span>${curationMovieIds(item).length ? `${curationMovieIds(item).length}편` : '감독 필모그래피'}</span><span>${escapeHtml(sourceLabel)}</span>${item.credit ? `<span>${escapeHtml(item.credit)}</span>` : ''}</div></div></section>
      <section class="content-section curation-film-section"><div class="section-head"><div><h2>작품</h2><p>기획전의 순서 자체가 편집 의도입니다.</p></div></div>${films.length ? `<div class="curation-film-grid">${films.map((record) => card(record, item.surface === 'arthouse' ? 'arthouse' : 'discover')).join('')}</div>` : `<div class="empty-state"><b>영화 정보를 불러오는 중입니다.</b><span>TMDB 상세정보가 준비되면 자동으로 채워집니다.</span></div>`}</section>`;
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
    setView('curation', { skipGate: true, keepScroll: false, route: 'none', deferRender: true });
    if (canUseLiveApi()) {
      const historyValue = { kinRoute: true, view: 'curation', curationSlug: item.slug, from: curationPreviousView };
      if (route === 'replace') history.replaceState(historyValue, '', routeUrlForCuration(item.slug, curationPreviousView));
      else if (route === 'push') history.pushState(historyValue, '', routeUrlForCuration(item.slug, curationPreviousView));
    }
    renderCurationPage(item);
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

  function setView(view, { skipGate = false, keepScroll = false, route = 'push', deferRender = false } = {}) {
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
    stopHeroTimer(view === 'discover' ? 'arthouse' : 'discover');
    if (!deferRender) renderActiveView();
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
    setView('movie', { skipGate: true, keepScroll: false, route: 'none', deferRender: true });
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
    return uniqueById([...map.values()]).sort((a, b) => relevance(b, query) - relevance(a, query));
  }

  function searchRow(record) {
    const action = isSignedIn() ? `<button class="secondary-button" data-action="watchlist" data-id="${record.id}">${lib(record.id)?.watchlist ? '✓ 보고싶어요' : '＋ 보고싶어요'}</button><button class="secondary-button" data-action="log" data-id="${record.id}">감상 기록</button>` : '';
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

  async function openLog(id, logId = null) {
    if (!requireAuth()) return;
    let record = movie(id);
    if (!record) return;
    record = await ensureMovieDetail(id, { persist: true }) || record;
    rememberMovie(record, { persist: true });
    persistLocalCache();
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
    state.meta.deletedLogs = state.meta.deletedLogs || {};
    state.meta.deletedLogs[String(logId)] = new Date().toISOString();
    recomputeLibraryFromLogs(log.movieId);
    saveState();
    UI.closeDialog('logDialog');
    UI.closeDialog('dayDialog');
    renderAll();
    if (activeView === 'movie') renderMoviePage(movie(log.movieId));
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

  async function removeMovieFromLibrary(id) {
    if (!requireAuth()) return;
    const record = movie(id);
    const logs = logsForMovie(id);
    const answer = await UI.ask({
      eyebrow: 'LIBRARY',
      title: '이 영화의 모든 개인 기록을 삭제할까요?',
      message: logs.length
        ? `${record?.title || '영화'}의 감상 기록 ${logs.length}개, 현재 평점, 보고싶어요, 좋아요, 컬렉션 포함 정보가 모두 삭제됩니다. 이 작업은 다른 기기에도 동기화됩니다.`
        : `${record?.title || '영화'}의 평점, 보고싶어요, 좋아요, 컬렉션 포함 정보가 모두 삭제됩니다. 이 작업은 다른 기기에도 동기화됩니다.`,
      confirmText: '모든 기록 삭제',
      danger: true,
    });
    if (!answer.confirmed) return;
    const now = new Date().toISOString();
    for (const log of logs) {
      state.meta.deletedLogs[String(log.id)] = now;
    }
    state.logs = state.logs.filter((log) => String(log.movieId) !== String(id));
    for (const collection of state.collections) {
      if (collection.movieIds.includes(String(id))) {
        collection.movieIds = collection.movieIds.filter((movieId) => String(movieId) !== String(id));
        collection.coverMovieId = collection.movieIds[0] || null;
        collection.updatedAt = now;
      }
    }
    delete state.library[String(id)];
    delete state.movieCache[String(id)];
    state.meta.deletedLibrary[String(id)] = now;
    saveState();
    if (activeView === 'movie') {
      UI.toast('이 영화의 개인 기록을 삭제했습니다.');
      setView(previousView === 'movie' ? 'library' : previousView || 'library', { skipGate: true, route: 'replace' });
    } else renderAll();
  }

  async function deleteCollection(collectionId) {
    if (!requireAuth()) return;
    const collection = state.collections.find((item) => String(item.id) === String(collectionId));
    if (!collection) return;
    const answer = await UI.ask({
      eyebrow: 'COLLECTION',
      title: '이 컬렉션을 삭제할까요?',
      message: `${collection.name} · ${collection.movieIds.length}편. 영화와 감상 기록 자체는 삭제되지 않습니다.`,
      confirmText: '컬렉션 삭제',
      danger: true,
    });
    if (!answer.confirmed) return;
    state.collections = state.collections.filter((item) => String(item.id) !== String(collectionId));
    state.meta.deletedCollections[String(collectionId)] = new Date().toISOString();
    libraryMode = 'collections';
    saveState();
    renderLibrary();
    UI.toast('컬렉션을 삭제했습니다.');
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
    const statusText = document.getElementById('dataStatusText');
    if (statusText) statusText.textContent = live ? 'SYNCED' : 'LOCAL';
    document.getElementById('sourceStatus').innerHTML = `Catalog: <b>${live ? 'LIVE API SYNC' : 'LOCAL DEMO'}</b><br>Updated: ${escapeHtml(CATALOG.updatedAt || 'unknown')}<br>Region: ${escapeHtml(CATALOG.region || 'KR')}<br>Auth: ${isSignedIn() ? `SIGNED IN · ${escapeHtml(syncState.status.toUpperCase())}` : 'SIGNED OUT'}`;
  }

  function renderActiveView() {
    if (activeView === 'discover') renderDiscover();
    else if (activeView === 'arthouse') renderArthouse();
    else if (activeView === 'library') renderLibrary();
    else if (activeView === 'my') renderMy();
    else if (activeView === 'movie' && detailMovieId) renderMoviePage(movie(detailMovieId));
    else if (activeView === 'curation' && curationSlug) renderCurationPage(CURATIONS.get(curationSlug));
  }

  function renderAll() {
    renderActiveView();
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
        renderAll();
      UI.closeDialog('aboutDialog');
      UI.toast('데이터를 가져왔습니다.');
    } catch {
      UI.toast('KINOSIS 데이터 파일을 읽지 못했습니다.');
    }
    event.target.value = '';
  }

  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  async function matchLetterboxdMovie(entry) {
    let data = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        data = await apiJson(`/api/movie-search?q=${encodeURIComponent(entry.name)}`);
        break;
      } catch (error) {
        if (error.status !== 429 || attempt === 2) throw error;
        await wait(1400 * (attempt + 1));
      }
    }
    const candidates = data?.results || [];
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
        // movie-search is intentionally rate limited. Keep bulk imports below the
        // public endpoint budget and back off again if Netlify returns 429.
        if (i > 0) await wait(850);
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
        renderAll();
      progress.textContent = `완료 · ${imported}편 가져옴${unmatched ? ` · ${unmatched}편 매칭 실패` : ''}`;
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
      if (action.dataset.action === 'log') await openLog(id);
      else if (action.dataset.action === 'watchlist') toggleWatchlist(id);
      else if (action.dataset.action === 'favorite') toggleFavorite(id);
      else if (action.dataset.action === 'collection-add') await addToCollection(id);
      action.closest('details')?.removeAttribute('open');
      return;
    }

    const removeLibrary = event.target.closest('[data-remove-library]');
    if (removeLibrary) { await removeMovieFromLibrary(removeLibrary.dataset.removeLibrary); return; }

    const deleteCollectionButton = event.target.closest('[data-delete-collection]');
    if (deleteCollectionButton) { await deleteCollection(deleteCollectionButton.dataset.deleteCollection); return; }

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
      state.meta.subscriptionsUpdatedAt = new Date().toISOString();
      myStreamingState = { status: 'idle', key: '', results: [], message: '' };
      saveState();
      renderAll();
      loadMyStreaming(true).catch(() => {});
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
    if (event.target.closest('#syncNowButton')) { await syncNow(); return; }
    if (event.target.closest('#signOutButton')) { await CLOUD?.signOut(); return; }
    if (event.target.closest('#deleteAccountButton')) { await deleteAccount(); return; }
    if (event.target.closest('#accountExportButton') || event.target.closest('#exportButton')) { exportData(); return; }
    if (event.target.closest('#aboutButton') || event.target.closest('#openAboutFromSettings')) { UI.showDialog('aboutDialog'); return; }
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

    const searchQuery = event.target.closest('[data-search-query]');
    if (searchQuery) {
      openSearch();
      const input = document.getElementById('searchInput');
      input.value = searchQuery.dataset.searchQuery || '';
      queueSearch(input.value);
      return;
    }

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
    if (event.target.id === 'librarySort') {
      libraryFilter.sort = event.target.value;
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
      rewatch: false,
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
    UI.closeDialog('logDialog');
    renderAll();
    if (activeView === 'movie') renderMoviePage(movie(movieId));
    UI.toast(logId ? '감상 기록을 수정했습니다.' : (prior.length ? '재관람을 기록했습니다.' : '감상 기록을 저장했습니다.'));
  });

  document.getElementById('profileForm').addEventListener('submit', (event) => {
    event.preventDefault();
    state.profile.name = document.getElementById('profileName').value.trim();
    state.profile.bio = document.getElementById('profileBio').value.trim();
    state.profile.updatedAt = new Date().toISOString();
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

  window.addEventListener('error', (event) => {
    console.error('KINOSIS runtime error:', event.error || event.message);
    UI?.toast?.('문제가 발생했습니다. 잠시 후 다시 시도해주세요.');
  });
  window.addEventListener('unhandledrejection', (event) => {
    console.error('KINOSIS unhandled promise:', event.reason);
  });

  window.addEventListener('popstate', () => { applyLocationRoute().catch(() => {}); });
  window.addEventListener('online', () => {
    if (isSignedIn()) pullCloudState({ force: true }).catch(() => {});
    if (isSignedIn() && state.meta?.dirtySince) pushCloudState();
    if (isSignedIn()) refreshWatchlistAvailability(true).catch(() => {});
  });
  window.addEventListener('offline', () => { if (isSignedIn()) { syncState.status = 'offline'; renderAccountChrome(); } });
  window.addEventListener('focus', () => { if (isSignedIn()) pullCloudState().catch(() => {}); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden && isSignedIn()) pullCloudState().catch(() => {}); });
  setInterval(() => { if (isSignedIn() && !document.hidden) pullCloudState().catch(() => {}); }, 60000);

  if (CLOUD) {
    CLOUD.onChange(async ({ user, error, event }) => {
      authReady = true;
      currentUser = user || null;
      if (error) syncState = { status: 'error', lastSyncedAt: null, message: error.message || 'Auth unavailable' };
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
        renderAll();
        const params = new URLSearchParams(location.search);
        if (!params.get('movie') && !params.get('curation')) setView('discover', { skipGate: true, route: 'replace' });
      }
    });
    CLOUD.init().then(() => { authReady = true; }).catch(() => {});
  } else authReady = true;

  renderAll();
  applyLocationRoute({ replace: true }).catch(() => setView('discover', { skipGate: true, route: 'replace' }));
})();
