import * as MOVIE_ENTITIES from './core/movie-entities.js';
import { createMovieLoader } from './services/movie-loader.js';
import { createSearchController } from './features/search.js';
import { renderDetail, patchDetail } from './features/detail.js';
import { renderLibraryShelf, renderWatchlistShelf } from './features/library.js';
import { selectProgrammeHeroes } from './features/arthouse.js';
import { allocateSections, selectDiscoverHeroMovies } from './features/discovery.js';
import { renderMovieCard } from './ui/movie-card.js';
import { createStore } from './core/store.js';
import { createRouter } from './core/router.js';
import { createPerformanceMonitor } from './core/performance.js';
import { createRequestScheduler } from './core/request-scheduler.js';
import { createApiClient } from './infrastructure/api-client.js';
import { createMovieRepository } from './infrastructure/movie-repository.js';
import {
  PERSONAL_SCHEMA_VERSION, migratePersonalShape, normalizeRelationship, normalizeMembership,
  relationshipFor, membershipFor, ensureRelationship as ensureRelationshipState,
  ensureMembership as ensureMembershipState, hasRelationshipContent, promoteEngagedMemberships,
} from './domain/personal-state.js';
import { setRelationship, addLibraryMembership, removeLibraryMembership, deletePersonalFilmData } from './domain/personal-actions.js';
import { createDemoState } from './domain/demo-state.js';
import { isAdminUser } from './domain/auth-role.js';
import { emptyProgramme, orderedEditorialEntries, renderStudioHome, renderStudioEditor } from './features/studio.js';
import { selectCalendarLead, uniqueCalendarMovieCount } from './features/calendar.js';

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
  const LOCALE = window.KINOSIS_LOCALE || {};
  const THEATRICAL = window.KINOSIS_THEATRICAL || null;

  const STORAGE_KEY = 'kinosis.mvp.v2.state';
  const LEGACY_STORAGE_KEY = 'film.mvp.v2.state';
  const MIGRATION_PREFIX = 'kinosis.legacy.migrated.';
  const LIVE_SEARCH_MIN_CHARS = 2;
  const AVAILABILITY_CHECK_MS = 6 * 60 * 60 * 1000;
  const AVAILABILITY_NEW_MS = 14 * 24 * 60 * 60 * 1000;

  const PROVIDERS = PROVIDER_API?.all?.() || [];

  const movieMap = new Map((CATALOG.movies || []).map((m) => [String(m.id), normalizeMovieRecord(m)]));
  for (const row of [...(THEATRICAL?.boxOffice || []), ...(THEATRICAL?.upcoming || [])]) {
    const normalized = normalizeMovieRecord(row);
    if (normalized?.id) movieMap.set(String(normalized.id), MOVIE_ENTITIES.merge(movieMap.get(String(normalized.id)) || {}, normalized));
  }
  const theatreIds = new Set((CATALOG.sections?.theatres || []).map((m) => String(m.id)));

  let activeView = 'discover';
  let previousView = 'discover';
  let detailMovieId = null;
  let curationSlug = null;
  let curationPreviousView = 'arthouse';
  let currentUser = null;
  let demoMode = false;
  let authReady = false;
  let hydratedUserId = null;
  let suppressCloudSync = true;
  let syncTimer = null;
  let syncState = { status: 'guest', lastSyncedAt: null, message: '' };
  let lastCloudPullAt = 0;
  let heroController = null;
  const artClassCache = new Map();
  let boxOfficeState = Array.isArray(THEATRICAL?.boxOffice) && THEATRICAL.boxOffice.length ? { status: 'ready', results: THEATRICAL.boxOffice, source: 'snapshot', updatedAt: THEATRICAL.updatedAt || null } : { status: 'idle', results: [] };
  let myStreamingState = { status: 'idle', key: '', results: [], message: '' };
  let upcomingState = Array.isArray(THEATRICAL?.upcoming) && THEATRICAL.upcoming.length ? { status: 'ready', results: THEATRICAL.upcoming, updatedAt: THEATRICAL.updatedAt || null, source: 'snapshot' } : { status: 'idle', results: [], updatedAt: null };

  let libraryMode = 'all';
  let libraryView = 'grid';
  let myMode = 'overview';
  let mySubMode = 'timeline';
  let calendarCursor = new Date();
  let libraryQueryTimer = null;
  let libraryFilter = { q: '', sort: 'recent', relationship: 'all', status: 'all', minRating: 'all', genre: 'all', availability: 'all' };
  let libraryHydrationState = { status: 'idle', pending: 0, message: '' };
  let pendingCollectionMovieId = null;
  let studioMode = 'list';
  let studioProgrammes = [];
  let studioDraft = null;
  let studioSearchResults = [];
  let studioLoading = false;
  let studioError = '';
  let curationPreviewItem = null;


  const relatedState = new Map();
  const mediaState = new Map();
  const scrollPositions = new Map();
  const moviePrefetchTimers = new WeakMap();

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
      return new Intl.DateTimeFormat(LOCALE.language, { year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(value));
    } catch {
      return value;
    }
  }

  function formatDateTime(value) {
    if (!value) return '없음';
    try {
      return new Intl.DateTimeFormat(LOCALE.language, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
    } catch {
      return value;
    }
  }

  function normalizeText(value) {
    return String(value || '').normalize('NFKC').toLocaleLowerCase(LOCALE.language).replace(/\s+/g, ' ').trim();
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
    return MOVIE_ENTITIES?.normalize?.(movie) || null;
  }

  function poster(movie) {
    return movie?.posterUrl || '';
  }

  function backdrop(movie) {
    return movie?.heroBackdropUrl || movie?.backdropUrl || movie?.posterUrl || '';
  }

  function uniqueById(list) {
    const ids = new Set();
    const fallbackIdentities = new Set();
    const out = [];
    for (const item of list || []) {
      if (!item) continue;
      const hasCanonicalId = item.id !== undefined && item.id !== null && String(item.id).trim() !== '';
      if (hasCanonicalId) {
        const id = String(item.id);
        if (ids.has(id)) continue;
        ids.add(id);
        out.push(item);
        continue;
      }
      const titleKey = normalizeText(item.originalTitle || item.title || '');
      const yearKey = String(item.year || item.releaseDate || '').slice(0, 4);
      const identity = titleKey && yearKey ? `${titleKey}|${yearKey}` : '';
      if (!identity || fallbackIdentities.has(identity)) continue;
      fallbackIdentities.add(identity);
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
    const merged = MOVIE_ENTITIES?.merge?.(existing, record) || normalizeMovieRecord({ ...existing, ...normalized });
    movieMap.set(String(merged.id), merged);
    if (persist) {
      state.movieCache = state.movieCache || {};
      state.movieCache[String(merged.id)] = merged;
    }
    return merged;
  }

  function personalMovieIds(sourceState = state) {
    return MOVIE_ENTITIES?.personalIds?.(sourceState) || [];
  }

  function moviePlaceholder(id) {
    return MOVIE_ENTITIES?.placeholder?.(id) || null;
  }

  function personalMovie(id) {
    return movie(id) || moviePlaceholder(id);
  }

  function compactMovieSnapshot(record) {
    return MOVIE_ENTITIES?.compactSnapshot?.(record) || null;
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
      meta: {
        modifiedAt: null, lastSyncedAt: null, cloudRevision: 0, localRevision: 0,
        dirtySince: null, syncVersion: PERSONAL_SCHEMA_VERSION,
        deletedLogs: {}, deletedCollections: {}, deletedLibrary: {}, deletedRelationships: {},
        subscriptionsUpdatedAt: null,
      },
      movieCache: {},
      library: {},
      relationships: {},
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
    const sourceSchemaVersion = Number(source?.meta?.syncVersion || 0);
    const personal = migratePersonalShape(source, { today: isoDate(new Date()) });
    const normalized = Object.assign(base, source, {
      profile: Object.assign(base.profile, source.profile || {}),
      settings: Object.assign(base.settings, source.settings || {}),
      meta: Object.assign(base.meta, source.meta || {}, {
        syncVersion: PERSONAL_SCHEMA_VERSION,
        deletedLogs: Object.assign({}, source.meta?.deletedLogs || {}),
        deletedCollections: Object.assign({}, source.meta?.deletedCollections || {}),
        deletedLibrary: Object.assign({}, source.meta?.deletedLibrary || {}),
        deletedRelationships: Object.assign({}, source.meta?.deletedRelationships || {}),
      }),
      movieCache: Object.assign({}, source.movieCache || {}),
      library: personal.library,
      relationships: personal.relationships,
      logs: personal.logs,
      collections: Array.isArray(source.collections) ? source.collections : [],
      subscriptions: Array.isArray(source.subscriptions) ? source.subscriptions : [],
      availability: {
        snapshot: Object.assign({}, source.availability?.snapshot || {}),
        newlyAvailable: Object.assign({}, source.availability?.newlyAvailable || {}),
        lastCheckedAt: source.availability?.lastCheckedAt || null,
      },
    });

    normalized.meta.localRevision = Number(normalized.meta.localRevision || 0);
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
    // Schema v8 introduced automatic shelf promotion for authored engagement.
    // Run it once while migrating legacy state; a deliberate later 'remove from
    // shelf' must survive reload/cloud normalization until the user engages again.
    if (sourceSchemaVersion < PERSONAL_SCHEMA_VERSION) promoteEngagedMemberships(normalized, normalized.meta.modifiedAt || new Date().toISOString());
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
      Object.keys(value?.library || {}).length || Object.keys(value?.relationships || {}).length ||
      value?.logs?.length || value?.collections?.length || value?.subscriptions?.length ||
      value?.profile?.name || value?.meta?.dirtySince
    );
  }

  function mergeImport(baseState, incomingState) {
    const out = normalizeState(baseState);
    const src = normalizeState(incomingState);
    out.profile = Object.assign({}, out.profile, src.profile);
    out.library = Object.assign({}, out.library, src.library);
    out.relationships = Object.assign({}, out.relationships, src.relationships);
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
    // Personal records reference TMDB ids. Keep only compact snapshots for those ids so a
    // fresh device can render Library/MY immediately without first opening every film.
    const snapshots = {};
    for (const id of personalMovieIds(sourceState)) {
      const record = movie(id) || sourceState?.movieCache?.[id];
      const snapshot = compactMovieSnapshot(record);
      if (snapshot) snapshots[id] = snapshot;
    }
    payload.movieCache = snapshots;
    // Availability is volatile and remains device/API hydrated.
    payload.availability = { snapshot: {}, newlyAvailable: {}, lastCheckedAt: null };
    payload.meta.localRevision = 0;
    payload.meta.dirtySince = null;
    payload.meta.syncVersion = PERSONAL_SCHEMA_VERSION;
    return payload;
  }

  function applyRemoteState(remotePayload, previousState = state) {
    const remote = normalizeState(remotePayload);
    remote.movieCache = Object.assign({}, remote.movieCache || {}, previousState?.movieCache || {});
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
    out.movieCache = Object.assign({}, remote.movieCache || {}, local.movieCache || {});
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
    const deletedRelationships = mergeTombstones(remote.meta?.deletedRelationships, local.meta?.deletedRelationships);
    out.meta.deletedRelationships = deletedRelationships;
    const relationshipKeys = new Set([...Object.keys(remote.relationships || {}), ...Object.keys(local.relationships || {})]);
    out.relationships = {};
    for (const id of relationshipKeys) {
      const chosen = newerBy(remote.relationships?.[id], local.relationships?.[id]);
      const deletedAt = Date.parse(deletedRelationships[id] || 0) || 0;
      const updatedAt = Date.parse(chosen?.updatedAt || 0) || 0;
      if (chosen && deletedAt < updatedAt) out.relationships[id] = normalizeRelationship(chosen);
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
    out.meta.syncVersion = PERSONAL_SCHEMA_VERSION;
    return normalizeState(out);
  }

  const store = createStore(initialState());
  let state = store.getState();
  const PERFORMANCE = createPerformanceMonitor();
  const REQUEST_SCHEDULER = createRequestScheduler({ maxConcurrent: 5, maxMediumConcurrent: 3, maxLowConcurrent: 2 });
  window.__KINOSIS_PERF__ = Object.freeze({ snapshot: () => ({ ...PERFORMANCE.snapshot(), requests: REQUEST_SCHEDULER.snapshot() }) });
  const API_CLIENT = createApiClient({ performanceMonitor: PERFORMANCE, scheduler: REQUEST_SCHEDULER });
  const MOVIE_REPOSITORY = createMovieRepository({ apiClient: API_CLIENT, rememberMovie });
  const ROUTER = createRouter({ canUseHistory: canUseLiveApi });

  function replaceState(nextState, reason = 'replace') {
    state = store.replace(nextState, { reason });
    return state;
  }

  function isSignedIn() {
    return !!currentUser || demoMode;
  }

  function hasCloudAccount() {
    return !!currentUser && !demoMode;
  }

  function isAdmin() {
    return !demoMode && isAdminUser(currentUser);
  }

  function persistLocalCache() {
    if (!hasCloudAccount()) return;
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
    if (sync && hasCloudAccount() && !suppressCloudSync) scheduleCloudSync();
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
    if (!hasCloudAccount() || !CLOUD) return;
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
          replaceState(mergeCloudStates(state, remote.payload), 'cloud-merge-before-push');
        }

        const snapshotRevision = Number(state.meta?.localRevision || 0);
        const payload = cloudPayload(state);
        const expectedRevision = Number(remote?.revision || 0);
        const result = await CLOUD.writeUserState(payload, expectedRevision);
        if (result?.conflict) {
          const latest = await CLOUD.readUserState();
          if (latest?.payload) replaceState(mergeCloudStates(state, latest.payload), 'cloud-conflict-merge');
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
    if (!hasCloudAccount() || !CLOUD || !navigator.onLine) return;
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
        replaceState(state.meta?.dirtySince ? mergeCloudStates(state, remote.payload) : applyRemoteState(remote.payload, state), 'cloud-pull');
        state.meta.lastSyncedAt = remote.updated_at;
        state.meta.cloudRevision = Number(remote.revision || state.meta.cloudRevision || 0);
        rememberCachedMovies();
        persistLocalCache();
        if (state.meta?.dirtySince) await pushCloudState();
        else {
          syncState = { status: 'online', lastSyncedAt: remote.updated_at, message: '' };
          renderAll();
          hydrateReferencedMovies().catch(() => {});
        }
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
      replaceState(initialState(), 'account-delete');
      syncState = { status: 'guest', lastSyncedAt: null, message: '' };
      setView('discover', { skipGate: true, route: 'replace' });
      renderAll();
      UI.toast('KINOSIS 계정을 삭제했습니다.');
    } catch (error) {
      UI.toast(error.message || '계정 삭제에 실패했습니다.');
    }
  }

  async function hydrateSignedInUser() {
    if (!hasCloudAccount() || !CLOUD) return;
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
      replaceState(normalizeState(next), 'user-hydrate');
      rememberCachedMovies();
      state.meta.lastSyncedAt = cloud?.updated_at || state.meta.lastSyncedAt || null;
      state.meta.cloudRevision = Number(cloud?.revision || state.meta.cloudRevision || 0);
      persistLocalCache();
      suppressCloudSync = false;
      if (!cloud || state.meta.dirtySince) await pushCloudState();
      else syncState = { status: 'online', lastSyncedAt: state.meta.lastSyncedAt, message: '' };
    } catch (error) {
      const cached = readJson(userCacheKey());
      replaceState(normalizeState(cached || initialState()), 'user-cache-fallback');
      rememberCachedMovies();
      suppressCloudSync = false;
      syncState = { status: 'error', lastSyncedAt: state.meta?.lastSyncedAt || null, message: error.message || 'Cloud unavailable' };
    }
    renderAll();
    // Metadata hydration must never block the user's personal surfaces.
    // Render ids/snapshots first, then fill missing movie entities in the background.
    Promise.allSettled([hydrateReferencedMovies(), refreshWatchlistAvailability()]).catch(() => {});
  }

  function lib(id) {
    return relationshipFor(state, id);
  }

  function membership(id) {
    return membershipFor(state, id);
  }

  function ensureRelationship(id, { addToLibrary = false } = {}) {
    const now = new Date().toISOString();
    const relation = ensureRelationshipState(state, id, now);
    if (addToLibrary) ensureMembershipState(state, id, now);
    return relation;
  }

  function ensureMembership(id) {
    return ensureMembershipState(state, id, new Date().toISOString());
  }

  function ensureShelfForEngagement(id) {
    const row = ensureMembershipState(state, id, new Date().toISOString());
    row.updatedAt = new Date().toISOString();
    return row;
  }

  // Compatibility helper for relationship-only actions such as Watchlist.
  // Engagement call sites explicitly promote to the current shelf; watchlist-only does not.
  function ensureLib(id) {
    return ensureRelationship(id, { addToLibrary: false });
  }

  function allSavedMovies() {
    return Object.keys(state.library).map(personalMovie);
  }

  function allWatchlistMovies() {
    return Object.entries(state.relationships || {})
      .filter(([, relation]) => !!relation?.watchlist)
      .map(([id]) => personalMovie(id));
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
    return latestLogs().map((log) => personalMovie(log.movieId)).filter((record) => !seen.has(String(record.id)) && seen.add(String(record.id)));
  }

  function recomputeViewingSequence(movieId) {
    const key = String(movieId);
    const now = new Date().toISOString();
    const chronological = state.logs
      .filter((log) => String(log.movieId) === key)
      .sort((a, b) => String(a.watchedAt).localeCompare(String(b.watchedAt)) || String(a.createdAt).localeCompare(String(b.createdAt)));
    chronological.forEach((log, index) => {
      const rewatch = index > 0;
      if (log.rewatch !== rewatch) {
        log.rewatch = rewatch;
        log.updatedAt = now;
      }
    });
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


  function canUseLiveApi() {
    return location.protocol === 'http:' || location.protocol === 'https:';
  }

  async function apiJson(path, options = {}) {
    return API_CLIENT.json(path, options);
  }

  async function fetchLiveSearch(query, { signal } = {}) {
    return MOVIE_REPOSITORY.search(query, { signal });
  }

  let movieLoader = null;
  function getMovieLoader() {
    if (movieLoader) return movieLoader;
    movieLoader = createMovieLoader({
      repository: MOVIE_REPOSITORY,
      rememberMovie,
      getMovie: movie,
      persistLocalCache,
    });
    return movieLoader;
  }

  async function fetchMovieDetail(id, { persist = false, force = false } = {}) {
    const loader = getMovieLoader();
    if (loader) return loader.loadDetail(id, { persist, force });
    const data = await apiJson(`/api/movie-detail?id=${encodeURIComponent(id)}`, { timeoutMs: 10000 });
    const detailed = rememberMovie({ ...data, source: 'tmdb-live', detailLoaded: true, metadataLoading: false }, { persist });
    if (persist) persistLocalCache();
    return detailed;
  }

  async function fetchMovieAvailability(id, { persist = false, force = false } = {}) {
    const loader = getMovieLoader();
    if (loader?.loadAvailability) return loader.loadAvailability(id, { persist, force });
    const current = movie(id);
    const data = await apiJson(`/api/movie-availability?id=${encodeURIComponent(id)}`, { timeoutMs: 10000 });
    const updated = rememberMovie({ ...current, ...data, availabilityLoading: false }, { persist });
    if (persist) persistLocalCache();
    return updated;
  }

  async function ensureMovieDetail(id, { persist = false, throwOnFailure = false, force = false } = {}) {
    let current = movie(id);
    const needs = !current || current.detailLoaded !== true;
    if (needs && canUseLiveApi()) {
      try {
        current = await fetchMovieDetail(id, { persist, force });
      } catch (error) {
        console.warn('detail load failed', error);
        if (throwOnFailure) throw error;
      }
    } else if (persist && current && !CATALOG.movies?.some((item) => String(item.id) === String(id))) {
      rememberMovie(current, { persist: true });
      persistLocalCache();
    }
    return current || null;
  }

  async function hydrateReferencedMovies({ force = false } = {}) {
    if (!isSignedIn() || !canUseLiveApi()) return false;
    const ids = personalMovieIds();
    const missing = ids.filter((id) => {
      const record = movie(id);
      return !record || record.metadataLoading || (force && record.source === 'placeholder');
    });
    if (!missing.length) {
      libraryHydrationState = { status: 'ready', pending: 0, message: '' };
      return false;
    }

    libraryHydrationState = { status: 'loading', pending: missing.length, message: '' };
    if (activeView === 'library') renderLibrary();
    if (activeView === 'my') renderMy();

    try {
      const loader = getMovieLoader();
      if (loader) await loader.loadSummaries(missing, { persist: true });
      else {
        for (const id of missing.slice(0, 8)) await ensureMovieDetail(id, { persist: true }).catch(() => null);
      }
      const unresolved = missing.filter((id) => {
        const record = movie(id);
        return !record || record.source === 'placeholder' || !!record.metadataError;
      });
      libraryHydrationState = unresolved.length
        ? { status: 'error', pending: unresolved.length, message: `${unresolved.length}편의 영화 정보를 불러오지 못했습니다. 저장된 기록은 그대로 유지됩니다.` }
        : { status: 'ready', pending: 0, message: '' };
    } catch (error) {
      libraryHydrationState = { status: 'error', pending: missing.filter((id) => !movie(id)).length, message: error.message || '영화 정보를 불러오지 못했습니다.' };
    }

    if (activeView === 'library') renderLibrary();
    if (activeView === 'my') renderMy();
    return true;
  }

  function gateHtml(area) {
    return `<div class="gate-card"><div class="gate-card-inner"><div class="gate-icon">${icon('lock')}</div><p class="eyebrow">ACCOUNT REQUIRED</p><h1>${escapeHtml(area)}</h1><p>개인 기록은 계정과 연결됩니다. 로그인하면 같은 라이브러리와 프로필 기록을 PC·모바일에서 이어서 사용할 수 있습니다.</p><button class="primary-button" data-open-auth>로그인하고 시작하기</button></div></div>`;
  }

  function requireAuth(message = '로그인하면 이 기능을 사용할 수 있습니다.') {
    if (isSignedIn()) return true;
    UI.toast(message);
    UI.showDialog('authDialog');
    return false;
  }

  function enterDemoMode() {
    demoMode = true;
    currentUser = null;
    hydratedUserId = null;
    suppressCloudSync = true;
    replaceState(normalizeState(createDemoState(CATALOG.movies || [], initialState)), 'demo-enter');
    rememberCachedMovies();
    suppressCloudSync = false;
    syncState = { status: 'demo', lastSyncedAt: null, message: '' };
    UI.closeDialog('authDialog');
    setView('library', { skipGate: true, route: 'replace' });
    libraryMode = 'all';
    renderAll();
    hydrateReferencedMovies().catch(() => {});
    UI.toast('데모 모드입니다. 변경 내용은 이 세션에만 유지됩니다.');
  }

  function exitDemoMode() {
    if (!demoMode) return;
    demoMode = false;
    replaceState(initialState(), 'demo-exit');
    syncState = { status: 'guest', lastSyncedAt: null, message: '' };
    setView('discover', { skipGate: true, route: 'replace' });
    renderAll();
    UI.toast('데모 모드를 종료했습니다.');
  }

  function renderAccountChrome() {
    const avatar = document.getElementById('topAvatar');
    if (!avatar) return;
    if (isSignedIn()) {
      const label = demoMode ? 'D' : (currentUser?.user_metadata?.full_name || currentUser?.user_metadata?.name || currentUser?.email || 'U');
      avatar.textContent = String(label).trim()[0]?.toUpperCase() || 'U';
    } else avatar.textContent = 'K';
    document.querySelectorAll('[data-nav="library"],[data-nav="my"]').forEach((element) => element.classList.toggle('nav-locked', !isSignedIn()));
    const accountAction = document.querySelector('[data-account-action="signout"]');
    if (accountAction) accountAction.textContent = demoMode ? '데모 종료' : '로그아웃';
    const studioAction = document.querySelector('[data-account-nav="studio"]');
    if (studioAction) studioAction.hidden = !isAdmin();
  }

  async function refreshWatchlistAvailability(force = false) {
    if (!isSignedIn() || !canUseLiveApi()) return;
    const last = Date.parse(state.availability?.lastCheckedAt || 0) || 0;
    if (!force && Date.now() - last < AVAILABILITY_CHECK_MS) return;
    const ids = Object.keys(state.relationships || {}).filter((id) => state.relationships[id]?.watchlist).slice(0, 80);
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
      const data = await MOVIE_REPOSITORY.recommendations(id);
      const results = (data.results || []).map((record) => rememberMovie({ ...record, source: 'tmdb-live', detailLoaded: false })).filter(Boolean);
      relatedState.set(String(id), { status: 'ready', results });
    } catch (error) {
      relatedState.set(String(id), { status: 'error', results: [] });
    }
    if (activeView === 'movie' && String(detailMovieId) === String(id)) patchMoviePage(movie(id), ['related']);
  }


  async function loadMovieMedia(id, force = false) {
    const key = String(id);
    const existing = mediaState.get(key);
    if (!force && (existing?.status === 'loading' || existing?.status === 'ready')) return existing;
    mediaState.set(key, { status: 'loading', trailers: existing?.trailers || [], stills: existing?.stills || [] });
    if (activeView === 'movie' && String(detailMovieId) === key) patchMoviePage(movie(key), ['media']);
    try {
      const data = await MOVIE_REPOSITORY.media(key);
      const next = { status: 'ready', trailers: data.trailers || [], stills: data.stills || [] };
      mediaState.set(key, next);
      if (activeView === 'movie' && String(detailMovieId) === key) patchMoviePage(movie(key), ['media']);
      return next;
    } catch (error) {
      const next = { status: 'error', trailers: [], stills: [], error: error.message || '미디어를 불러오지 못했습니다.' };
      mediaState.set(key, next);
      if (activeView === 'movie' && String(detailMovieId) === key) patchMoviePage(movie(key), ['media']);
      return next;
    }
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
    if (key === 'arthouse') {
      const programmes = CURATIONS.forSurface('arthouse');
      return selectProgrammeHeroes(programmes, curationMovies, curationHeroMovie, 5).map(({ programme, movie: heroMovie }) => ({
        ...(heroMovie || {}), id: `curation:${programme.slug}`, heroKey: `curation:${programme.slug}:${heroMovie?.id || 'programme'}`, heroType: 'curation', curationSlug: programme.slug,
        title: programme.title, originalTitle: programme.subtitle || '', description: programme.description || '', programmeKind: programme.kind,
        programmeEyebrow: programme.kind === 'editorial' ? 'KINOSIS CURATION' : 'DIRECTOR ARCHIVE',
        director: programme.kind === 'director-archive' ? (programme.subtitle || programme.source?.name || '') : (heroMovie?.director || ''), sourceMovieId: heroMovie?.id ? String(heroMovie.id) : '',
        heroBackdropUrl: programme.heroImageUrl || heroMovie?.heroBackdropUrl || heroMovie?.backdropUrl || '',
      }));
    }
    const preferred = CATALOG.featuredSlides || [];
    const upcoming = upcomingState.status === 'ready' ? upcomingState.results : (CATALOG.sections?.upcoming || []);
    const withBackdrop = (rows) => uniqueById(rows || []).filter((record) => backdrop(record));
    return selectDiscoverHeroMovies({
      featured: withBackdrop([CATALOG.featured, ...preferred]),
      boxOffice: withBackdrop(boxOfficeState.status === 'ready' ? boxOfficeState.results : (CATALOG.sections?.boxOffice || CATALOG.sections?.theatres || [])),
      upcoming: withBackdrop(upcoming),
      rated: withBackdrop(CATALOG.sections?.rated || []),
    }, 5).map((record) => ({ ...record, heroType: 'movie', heroKey: `movie:${record.id}` }));
  }

  function heroSlideMarkup(record, key, index) {
    const isCuration = record.heroType === 'curation';
    const providers = isCuration ? [] : heroProviders(record);
    const title = !isCuration && record.logoUrl
      ? `<div class="hero-title-wrap"><img class="hero-title-logo" data-hero-title-logo src="${escapeHtml(record.logoUrl)}" alt="${escapeHtml(record.title)}"><h2 class="${heroTitleClass(record.title)}" hidden>${escapeHtml(record.title)}</h2></div>`
      : `<h2 class="${heroTitleClass(record.title)}">${escapeHtml(record.title)}</h2>`;
    const background = backdrop(record);
    const meta = isCuration
      ? `<div class="hero-meta"><span>${escapeHtml(record.programmeKind === 'director-archive' ? (record.originalTitle || record.director || '') : (record.originalTitle || 'KINOSIS Editorial'))}</span></div>`
      : `<div class="hero-meta">${record.director ? `<span>${escapeHtml(record.director)}</span><span>·</span>` : ''}<span>${record.year || '—'}</span>${record.runtime ? `<span>·</span><span>${fmtRuntime(record.runtime)}</span>` : ''}</div>`;
    return `<article class="hero-slide ${isCuration ? 'is-programme-slide' : ''} ${index === 0 ? 'is-active' : ''}" data-hero-slide="${index}" aria-hidden="${index === 0 ? 'false' : 'true'}">
      ${background ? `<img class="hero-bg" src="${escapeHtml(background)}" alt="" ${index ? 'loading="lazy"' : ''}>` : '<div class="hero-bg hero-programme-fallback" aria-hidden="true"></div>'}
      <button class="hero-slide-open" data-hero-open="${escapeHtml(isCuration ? record.curationSlug : record.id)}" data-hero-type="${isCuration ? 'curation' : 'movie'}" tabindex="${index === 0 ? '0' : '-1'}" aria-label="${escapeHtml(record.title)} ${isCuration ? '큐레이션 보기' : '상세 보기'}"></button>
      <div class="hero-content" aria-hidden="true"><div class="hero-badges"><span class="mini-badge accent">${escapeHtml(isCuration ? (record.programmeEyebrow || 'CURATION') : (key === 'arthouse' ? 'ARTHOUSE' : 'FEATURED'))}</span>${!isCuration && isInTheatres(record) ? '<span class="mini-badge">극장 상영 중</span>' : ''}</div>${title}${meta}
        ${isCuration ? `<p class="hero-programme-copy">${escapeHtml(record.description || '')}</p>` : `<div class="hero-watch"><div class="hero-provider-list">${providers.map((provider) => providerMarkHtml(provider, 'hero-provider')).join('')}</div>${isInTheatres(record) ? `<span class="hero-cinema">${icon('cinema')} 극장 상영</span>` : ''}</div>`}
        <span class="hero-open-hint">${isCuration ? '큐레이션 보기 →' : '영화 상세 보기 →'}</span></div>
    </article>`;
  }

  function getHeroController() {
    if (heroController) return heroController;
    heroController = HERO_CAROUSEL_FACTORY?.create?.({
      icon,
      openSlide: async (type, target) => { if (type === 'curation') await openCuration(target); else await openMovie(target); },
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
    const seen = new Set();
    const slides = (records || heroSlidePool(key)).filter((record) => {
      const signature = String(record?.heroKey || record?.id || '');
      if (!signature || seen.has(signature)) return false;
      seen.add(signature); return true;
    }).slice(0, 5);
    if (!slides.length) { element.innerHTML = '<div class="empty-state">표시할 프로그램을 준비하지 못했습니다.</div>'; return; }
    getHeroController().render(element, key, slides, requestedIndex);
  }

  function collectionsForMovie(id) {
    const key = String(id);
    return (state.collections || []).filter((collection) => (collection.movieIds || []).some((movieId) => String(movieId) === key));
  }

  function libraryAccessLabel(record) {
    if (!record || record.metadataLoading) return '';
    const mine = consolidatedProviders(record).find((provider) => provider.isMine);
    if (mine) return `${mine.label || mine.name}에서 감상 가능`;
    if (isInTheatres(record)) return '극장 상영 중';
    return '';
  }

  function movieCardContext() {
    return {
      relationship: lib,
      signedIn: isSignedIn,
      poster,
      escapeHtml,
      availableOnMine,
      logsForMovie,
      collectionsForMovie,
      accessLabel: libraryAccessLabel,
      formatDate,
    };
  }

  function card(record, variant = 'discover') {
    return renderMovieCard(record, variant, movieCardContext());
  }

  function railFrame(inner, rowClass = 'poster-row') {
    return `<div class="film-rail-shell"><button class="film-rail-arrow is-prev" data-rail-step="prev" aria-label="이전 영화" hidden>${icon('chevron-left')}</button><div class="${rowClass}" data-film-rail>${inner}</div><button class="film-rail-arrow is-next" data-rail-step="next" aria-label="다음 영화">${icon('chevron-right')}</button></div>`;
  }

  function syncRailArrows(root = document) {
    root.querySelectorAll?.('.film-rail-shell').forEach((shell) => {
      const rail = shell.querySelector('[data-film-rail]');
      const prev = shell.querySelector('[data-rail-step="prev"]');
      const next = shell.querySelector('[data-rail-step="next"]');
      if (!rail || !prev || !next) return;
      const max = Math.max(0, rail.scrollWidth - rail.clientWidth);
      prev.hidden = rail.scrollLeft <= 2;
      next.hidden = max <= 2 || rail.scrollLeft >= max - 2;
      if (!rail.dataset.railBound) {
        rail.dataset.railBound = '1';
        rail.addEventListener('scroll', () => syncRailArrows(shell), { passive: true });
        new ResizeObserver(() => syncRailArrows(shell)).observe(rail);
      }
    });
  }

  function rowSection(title, subtitle, movies, limit = 12, variant = 'discover') {
    const list = uniqueById(movies || []).slice(0, limit);
    const rowClass = variant === 'arthouse' ? 'poster-row arthouse-poster-row' : 'poster-row';
    return `<section class="content-section"><div class="section-head"><div><h2>${escapeHtml(title)}</h2>${subtitle ? `<p>${escapeHtml(subtitle)}</p>` : ''}</div></div>${list.length ? railFrame(list.map((record) => card(record, variant)).join(''), rowClass) : `<div class="empty-state"><b>표시할 영화가 없습니다.</b></div>`}</section>`;
  }


  function explicitCurationMovieIds(item) {
    const direct = (item?.movies || []).map((entry) => String(entry.id));
    const chapterIds = (item?.chapters || []).flatMap((chapter) => (chapter.movies || []).map((entry) => String(entry.id)));
    return [...new Set([...direct, ...chapterIds])];
  }

  function curationMovieIds(item) {
    if (!item) return [];
    const explicit = explicitCurationMovieIds(item);
    if (explicit.length) return explicit;
    // Legacy fallback only. New Director Archives are explicitly authored in Studio.
    return (item?.source?.snapshot || []).map((record) => String(record.id)).filter(Boolean);
  }

  function seedCurationSnapshots(item) {
    for (const entry of item?.movies || []) {
      if (!entry?.snapshot) continue;
      rememberMovie({ ...entry.snapshot, id: String(entry.id || entry.snapshot.id), tmdbId: String(entry.id || entry.snapshot.id), source: 'programme-snapshot', detailLoaded: false }, { persist: false });
    }
  }
  function curationMovies(item) { seedCurationSnapshots(item); return curationMovieIds(item).map((id) => movie(id)).filter(Boolean); }
  function curationHeroMovie(item) { seedCurationSnapshots(item); return movie(item?.heroMovieId) || curationMovies(item)[0] || null; }
  function curationHeroImage(item) { if (item?.heroImageUrl) return item.heroImageUrl; const hero = curationHeroMovie(item); return hero ? backdrop(hero) : ''; }
  async function hydrateCurationIds(ids, concurrency = 5) { let cursor = 0; const workers = Array.from({ length: Math.min(concurrency, ids.length) }, async () => { while (cursor < ids.length) { const id = ids[cursor++]; await ensureMovieDetail(id,{persist:false}).catch(()=>null); } }); await Promise.all(workers); }

  async function ensureCurationMovies(item) {
    if (!item) return false;
    seedCurationSnapshots(item);
    if (!canUseLiveApi()) return false;
    const missing = curationMovieIds(item).filter((id) => !movie(id));
    if (!missing.length) return false;
    const loader = getMovieLoader();
    if (loader) await loader.loadSummaries(missing, { persist: false }); else await hydrateCurationIds(missing, 2);
    return true;
  }

  async function ensureCurationPreview(item) {
    if (!item) return { changed: false, stateChanged: false };
    seedCurationSnapshots(item);
    if (!canUseLiveApi()) return { changed: false, stateChanged: false };
    const missing = curationMovieIds(item).filter((id) => !movie(id));
    if (!missing.length) return { changed: false, stateChanged: false };
    const loader = getMovieLoader();
    if (loader) await loader.loadSummaries(missing, { persist: false }); else await hydrateCurationIds(missing, 2);
    return { changed: true, stateChanged: false };
  }

  function curationRail(item) {
    if (!item) return '';
    const films = curationMovies(item).slice(0, 12);
    const isArchive = item.kind === 'director-archive';
    const rail = films.length ? films.map((record) => card(record, 'arthouse')).join('') : Array.from({ length: Math.min(6, curationMovieIds(item).length || 4) }, () => `<article class="movie-card arthouse-movie-card is-metadata-loading curation-rail-placeholder"><div class="poster-wrap"><div class="poster-loading"><span class="loading-ring mini"></span><small>LOADING</small></div></div><div class="card-info"><p class="card-title">영화 정보 불러오는 중</p></div></article>`).join('');
    const kicker = isArchive ? 'DIRECTOR ARCHIVE' : 'KINOSIS CURATION';
    const subtitle = item.subtitle ? `<span class="curation-rail-subtitle">${escapeHtml(item.subtitle)}</span>` : '';
    return `<section class="content-section curation-rail-section" data-programme-kind="${isArchive ? 'archive' : 'editorial'}"><div class="section-head curation-rail-head"><div><p class="editorial-kicker">${kicker}</p><h2>${escapeHtml(item.title)}</h2>${subtitle}${item.description ? `<p>${escapeHtml(item.description)}</p>` : ''}</div><button class="section-action" data-curation="${escapeHtml(item.slug)}">전체 보기 →</button></div>${films.length ? railFrame(rail, 'poster-row arthouse-poster-row curation-poster-rail') : rail}</section>`;
  }

  function curationCollectionCard(item) {
    const films = curationMovies(item).slice(0, 5);
    const hero = curationHeroMovie(item) || films[0] || null;
    const heroArt = curationHeroImage(item) || (hero ? backdrop(hero) : '');
    const posterStrip = films.slice(0, 4).map((record) => poster(record) ? `<img src="${escapeHtml(poster(record))}" alt="" loading="lazy">` : '').join('');
    return `<button class="arthouse-collection-card" data-curation="${escapeHtml(item.slug)}" aria-label="${escapeHtml(item.title)} 큐레이션 보기">
      <span class="arthouse-collection-media">${heroArt ? `<img class="arthouse-collection-bg" src="${escapeHtml(heroArt)}" alt="">` : ''}<span class="arthouse-collection-shade"></span>${posterStrip ? `<span class="arthouse-collection-posters">${posterStrip}</span>` : ''}</span>
      <span class="arthouse-collection-copy"><small>KINOSIS CURATION · ${films.length || explicitCurationMovieIds(item).length} FILMS</small><b>${escapeHtml(item.title)}</b>${item.description ? `<span>${escapeHtml(item.description)}</span>` : ''}<em>살펴보기 →</em></span>
    </button>`;
  }


  function discoverCurationPromo() {
    const item = CURATIONS.forSurface('arthouse').find((row) => row.kind === 'editorial');
    if (!item) return '';
    const image = curationHeroImage(item);
    const films = curationMovieIds(item).length;
    return `<section class="discover-curation-promo"><button data-curation="${escapeHtml(item.slug)}" aria-label="${escapeHtml(item.title)} 큐레이션 보기">${image ? `<img src="${escapeHtml(image)}" alt="">` : ''}<span class="discover-curation-shade"></span><span class="discover-curation-copy"><small>KINOSIS CURATION · ${films} FILMS</small><b>${escapeHtml(item.title)}</b><em>${escapeHtml(item.description || '')}</em><strong>큐레이션 보기 →</strong></span></button></section>`;
  }


  function myStreamingSection(title = '내 구독 서비스에서', source = null, variant = 'discover') {
    if (!isSignedIn()) return '';
    if (!(state.subscriptions || []).length) return `<section class="content-section"><div class="section-head"><div><h2>${escapeHtml(title)}</h2><p>프로필 → 설정에서 이용 중인 OTT를 먼저 선택하세요.</p></div></div></section>`;
    const sourceProvided = Array.isArray(source);
    const allMine = myStreamingMovies().filter(availableOnMine);
    const list = (sourceProvided ? source : allMine).filter(availableOnMine);
    if (list.length) return rowSection(title, myStreamingState.status === 'ready' ? '선택한 OTT의 대한민국 구독 제공작을 실시간으로 탐색합니다.' : '구독 서비스에서 확인된 영화.', list, 14, variant);
    // If allocation removed every item because it already appeared above, omit
    // this rail rather than falsely claiming the subscription has no movies.
    if (sourceProvided && allMine.length) return '';
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
      return `<section class="content-section"><div class="section-head"><div><h2>현재 상영작</h2><p>정확한 박스오피스 순위는 KOBIS 연결 시 표시됩니다.</p></div></div>${railFrame(rows.map((record)=>card(record)).join(''))}</section>`;
    }
    return `<section class="content-section"><div class="section-head"><div><h2>박스오피스</h2><p>KOBIS 일별 박스오피스 기준</p></div></div>${railFrame(rows.map((record,index)=>`<div class="ranked-card"><span class="rank-number">${String(record.boxOfficeRank||index+1).padStart(2,'0')}</span>${card(record)}</div>`).join(''), 'poster-row ranked-row')}</section>`;
  }
  function upcomingSection(list) {
    const rows=uniqueById(list||[]).slice(0,14); if(!rows.length)return'';
    return `<section class="content-section"><div class="section-head"><div><h2>공개 예정작</h2></div></div>${railFrame(rows.map((record)=>`<div class="upcoming-card">${card(record)}<time>${record.releaseDate?formatDate(record.releaseDate):''}</time></div>`).join(''))}</section>`;
  }
  function renderDiscover({ hero = true, streaming = true, upcoming = true } = {}) {
    const heroSlides = heroSlidePool('discover'); if (hero) renderHeroCarousel('hero', heroSlides);
    if (boxOfficeState.status === 'idle') loadLiveBoxOffice().catch(() => {});
    if (upcoming && (CATALOG.sections?.upcoming || []).length < 7 && upcomingState.status === 'idle') loadLiveUpcoming().catch(() => {});
    if (streaming && isSignedIn() && (state.subscriptions || []).length) loadMyStreaming().catch(() => {});
    const rawBoxOffice = boxOfficeState.status === 'ready' ? boxOfficeState.results : (CATALOG.sources?.boxOffice?.mode === 'kobis' ? CATALOG.sections?.boxOffice || [] : (CATALOG.sections?.theatres || []));
    const rawUpcoming = upcomingState.status === 'ready' && upcomingState.results.length ? upcomingState.results : (CATALOG.sections?.upcoming?.length ? CATALOG.sections.upcoming : (CATALOG.movies || []).filter((record) => record.releaseDate && Date.parse(record.releaseDate) > Date.now()).sort((a, b) => String(a.releaseDate).localeCompare(String(b.releaseDate))));
    const heroMovieIds = heroSlides.map((slide) => slide.heroType === 'curation' ? slide.sourceMovieId : slide.id).filter(Boolean).map(String);
    const rawStreaming = isSignedIn() ? myStreamingMovies().filter(availableOnMine) : [];
    const rawRated = uniqueById([...(CATALOG.sections?.rated || []), ...(CATALOG.movies || []).filter((record) => Number(record.voteAverage || 0) > 0 && Number(record.voteCount || 0) >= 100)]);
    const allocated = allocateSections({ heroMovieIds, boxOffice: rawBoxOffice, upcoming: rawUpcoming, streaming: rawStreaming, rated: rawRated });
    let html = '';
    if (allocated.boxOffice.length) html += rankedSection(allocated.boxOffice, { exact: boxOfficeState.status === 'ready' || CATALOG.sources?.boxOffice?.mode === 'kobis' || THEATRICAL?.mode === 'kobis-snapshot' });
    html += discoverCurationPromo();
    html += upcomingSection(allocated.upcoming);
    html += isSignedIn() ? myStreamingSection('내 구독 서비스에서', allocated.streaming, 'discover') : guestStreamingPrompt();
    html += rowSection('높은 평가를 받은 영화', '평가 수를 함께 반영한 가중 평점 순', allocated.rated, 14, 'discover');
    document.getElementById('discoverContent').innerHTML = html;
    requestAnimationFrame(() => syncRailArrows(document.getElementById('discoverView')));
  }

  function renderArthouse() {
    const allCurations = CURATIONS.forSurface('arthouse');
    const editorials = allCurations.filter((item) => item.kind === 'editorial');
    const archives = allCurations.filter((item) => item.kind === 'director-archive');
    renderHeroCarousel('arthouseHero', heroSlidePool('arthouse'));
    const editorialIndex = editorials.length ? `<section class="arthouse-curation-index"><div class="section-head"><div><p class="editorial-kicker">CURATIONS</p><h2>큐레이션</h2></div></div><div class="arthouse-collection-grid">${editorials.map(curationCollectionCard).join('')}</div></section>` : '';
    document.getElementById('arthouseContent').innerHTML = `${editorialIndex}${archives.map(curationRail).join('')}`;
    requestAnimationFrame(() => syncRailArrows(document.getElementById('arthouseView')));
    Promise.allSettled(allCurations.map(ensureCurationPreview)).then((results) => {
      const changed = results.some((result) => result.status === 'fulfilled' && (result.value?.changed || result.value?.stateChanged));
      if (changed && activeView === 'arthouse') renderArthouse();
    }).catch(() => {});
  }

  function renderCollectionsSide() {
    const element = document.getElementById('collectionSideLinks');
    if (!element) return;
    const pinned = [...state.collections].sort((a, b) => String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || ''))).slice(0, 5);
    element.innerHTML = pinned.map((collection) => `<button class="side-link" data-collection="${escapeHtml(collection.id)}">${icon('folder')}${escapeHtml(collection.name)}</button>`).join('');
  }

  function collectionCover(collection) {
    if (!collection) return '';
    const preferred = collection.coverMovieId ? personalMovie(collection.coverMovieId) : null;
    if (preferred?.posterUrl || preferred?.backdropUrl) return backdrop(preferred);
    for (const id of collection.movieIds || []) {
      const record = movie(id);
      if (record?.posterUrl || record?.backdropUrl) return backdrop(record);
    }
    return '';
  }

  function libraryHeader(title, summary = '', extras = '') { return `<header class="library-header simple-library-head"><div><h1>${escapeHtml(title)}</h1>${summary ? `<span>${escapeHtml(summary)}</span>` : ''}</div><div class="library-header-actions">${extras}</div></header>`; }

  function libraryListRows(list) {
    return `<div class="library-list">${list.map((record) => {
      const entry = lib(record.id);
      const logs = logsForMovie(record.id);
      const last = logs[0];
      const collections = collectionsForMovie(record.id);
      const access = libraryAccessLabel(record);
      const image = record.metadataLoading ? '<span class="row-poster-loading"><span class="loading-ring mini"></span></span>' : poster(record) ? `<img src="${escapeHtml(poster(record))}" alt="">` : '<span class="row-poster-loading is-empty"></span>';
      return `<div class="library-row ${record.metadataLoading ? 'is-metadata-loading' : ''}" data-movie="${record.id}" tabindex="0">${image}<div><div class="library-row-title">${escapeHtml(record.title)}</div><div class="library-row-sub">${record.metadataLoading ? '영화 정보를 동기화하는 중입니다.' : `${escapeHtml(record.director || '')}${record.director ? ' · ' : ''}${genreNames(record).slice(0, 2).map(escapeHtml).join(' · ')}`}</div></div><div class="library-row-cell">${record.metadataLoading ? '…' : (record.year || '—')}</div><div class="library-row-cell rating">${entry?.rating ? `★ ${Number(entry.rating).toFixed(1)}` : '—'}</div><div class="library-row-cell">${logs.length ? `${logs.length}회 · ${formatDate(last.watchedAt)}` : '미감상'}</div><div class="library-row-cell library-row-context">${record.metadataLoading ? '동기화 중' : [access, collections[0]?.name].filter(Boolean).map(escapeHtml).join(' · ') || '—'}</div><button class="library-row-remove" data-remove-library="${record.id}" aria-label="내 영화장에서 제거">×</button></div>`;
    }).join('')}</div>`;
  }

  function libraryHydrationBanner() {
    if (libraryHydrationState.status === 'loading') return `<div class="library-sync-banner" role="status"><span class="loading-ring mini"></span><span>저장된 영화 정보 ${libraryHydrationState.pending}편을 불러오는 중입니다.</span></div>`;
    if (libraryHydrationState.status === 'error') return `<div class="library-sync-banner is-error" role="status"><span>${escapeHtml(libraryHydrationState.message || '일부 영화 정보를 불러오지 못했습니다.')}</span><button class="secondary-button mini" data-retry-library-hydration>다시 시도</button></div>`;
    return '';
  }

  function libraryFeatureContext() {
    return {
      normalizeText,
      genreNames,
      relationship: lib,
      logsForMovie,
      availableOnMine,
      isInTheatres,
      membership,
      icon,
      escapeHtml,
      card,
      listRows: libraryListRows,
      collectionCover,
    };
  }

  function renderCollectionDetail(collection) {
    const movies = collection.movieIds.map(personalMovie);
    const cover = collectionCover(collection);
    return `${libraryHeader(collection.name, collection.description || '직접 만든 컬렉션', `<div class="collection-head-actions"><button class="secondary-button" data-edit-collection="${escapeHtml(collection.id)}">${icon('edit')} 편집</button><button class="danger-text-button" data-delete-collection="${escapeHtml(collection.id)}">삭제</button></div>`)}
      <section class="collection-detail-hero ${cover ? 'has-cover' : ''}">${cover ? `<img src="${escapeHtml(cover)}" alt="">` : ''}<div><p class="eyebrow">PERSONAL COLLECTION</p><h2>${escapeHtml(collection.name)}</h2><p>${escapeHtml(collection.description || `${movies.length}편의 영화`)}</p></div></section>
      ${movies.length ? `<div class="collection-order-list">${movies.map((record, index) => `<div class="collection-order-row"><button class="collection-film-main" data-movie="${record.id}">${record.metadataLoading ? '<span class="row-poster-loading"><span class="loading-ring mini"></span></span>' : poster(record) ? `<img src="${escapeHtml(poster(record))}" alt="">` : '<span class="row-poster-loading is-empty"></span>'}<span><b>${escapeHtml(record.title)}</b><small>${record.year || '—'} · ${escapeHtml(record.director || '')}</small></span></button><div class="collection-order-actions"><button data-collection-move="up" data-collection-id="${escapeHtml(collection.id)}" data-index="${index}" ${index === 0 ? 'disabled' : ''}>↑</button><button data-collection-move="down" data-collection-id="${escapeHtml(collection.id)}" data-index="${index}" ${index === movies.length - 1 ? 'disabled' : ''}>↓</button><button data-collection-remove="${record.id}" data-collection-id="${escapeHtml(collection.id)}">×</button></div></div>`).join('')}</div>` : '<div class="empty-state"><b>아직 영화가 없습니다.</b><span>영화 상세에서 Collection에 추가해보세요.</span></div>'}`;
  }

  function renderLibrary() {
    const content = document.getElementById('libraryContent');
    if (!content) return;
    if (!isSignedIn()) {
      content.innerHTML = gateHtml('Library');
      document.getElementById('libraryCount').textContent = '0';
      return;
    }
    const saved = allSavedMovies();
    const watchlist = allWatchlistMovies();
    document.getElementById('libraryCount').textContent = saved.length;
    const watchlistCount = document.getElementById('watchlistCount');
    if (watchlistCount) watchlistCount.textContent = watchlist.length;
    renderCollectionsSide();
    document.querySelectorAll('[data-library]').forEach((button) => button.classList.toggle('is-active', button.dataset.library === libraryMode));
    if (libraryMode === 'all') {
      content.innerHTML = renderLibraryShelf({
        list: saved,
        filter: libraryFilter,
        view: libraryView,
        collections: state.collections,
        hydrationHtml: libraryHydrationBanner(),
        c: libraryFeatureContext(),
      });
    } else if (libraryMode === 'watchlist') {
      content.innerHTML = `${libraryHydrationBanner()}${renderWatchlistShelf({ list: watchlist, c: libraryFeatureContext() })}`;
    } else if (libraryMode === 'collections') {
      content.innerHTML = `${libraryHeader('컬렉션', `${state.collections.length}개 컬렉션`, '<button class="primary-button" data-new-collection>＋ 새 컬렉션</button>')}<p class="library-page-intro">컬렉션은 영화와 나의 상태와 별개로, 내 영화장을 직접 분류하는 개인 서가입니다.</p><div class="collection-grid">${state.collections.map((collection) => { const cover = collectionCover(collection); return `<article class="collection-card rich-collection" data-collection-card="${escapeHtml(collection.id)}">${cover ? `<img src="${escapeHtml(cover)}" alt="">` : ''}<div class="collection-card-shade"></div><div class="collection-card-copy"><h3>${escapeHtml(collection.name)}</h3><p>${collection.movieIds.length}편</p></div></article>`; }).join('')}</div>`;
    } else if (libraryMode.startsWith('collection:')) {
      const collection = state.collections.find((item) => item.id === libraryMode.split(':')[1]);
      content.innerHTML = collection ? renderCollectionDetail(collection) : renderLibraryShelf({ list: saved, filter: libraryFilter, view: libraryView, collections: state.collections, hydrationHtml: libraryHydrationBanner(), c: libraryFeatureContext() });
    } else {
      libraryMode = 'all';
      content.innerHTML = renderLibraryShelf({ list: saved, filter: libraryFilter, view: libraryView, collections: state.collections, hydrationHtml: libraryHydrationBanner(), c: libraryFeatureContext() });
    }
    requestAnimationFrame(() => syncRailArrows(document.getElementById('libraryView')));
  }

  function profileCounts() {
    const watched = new Set(state.logs.map((log) => String(log.movieId)));
    return {
      films: watched.size,
      ratings: Object.values(state.relationships || {}).filter((item) => item?.rating != null).length,
      reviews: Object.values(state.relationships || {}).filter((item) => String(item?.comment || '').trim()).length,
      collections: state.collections.length,
    };
  }

  function renderProfileCard() {
    const element = document.getElementById('profileCard');
    if (!element) return;
    if (!isSignedIn()) { element.innerHTML = ''; return; }
    const counts = profileCounts();
    const name = state.profile.name || currentUser?.user_metadata?.full_name || currentUser?.email?.split('@')[0] || 'KINOSIS User';
    const initial = name[0]?.toUpperCase() || 'K';
    const lastLog = latestLogs()[0];
    const lastMovie = lastLog ? personalMovie(lastLog.movieId) : null;
    element.innerHTML = `<section class="profile-summary"><div class="profile-summary-identity"><div class="profile-avatar">${escapeHtml(initial)}</div><div class="profile-copy"><p class="eyebrow">PERSONAL FILM ARCHIVE</p><h1>${escapeHtml(name)}</h1><p>${escapeHtml(state.profile.bio || '내 영화생활을 기록합니다.')}</p><small>${demoMode ? 'SESSION DEMO · 저장되지 않음' : escapeHtml(currentUser?.email || '')}</small></div><button class="secondary-button" id="editProfile">${icon('edit')} 수정</button></div><div class="profile-summary-stats"><button data-my-drill="films"><strong>${counts.films}</strong><span>감상 영화</span></button><button data-my-drill="ratings"><strong>${counts.ratings}</strong><span>평가</span></button><button data-my-drill="reviews"><strong>${counts.reviews}</strong><span>한줄평</span></button><button data-my-drill="collections"><strong>${counts.collections}</strong><span>컬렉션</span></button></div>${lastMovie ? `<button class="profile-last-film" data-movie="${escapeHtml(lastMovie.id)}">${backdrop(lastMovie) ? `<img src="${escapeHtml(backdrop(lastMovie))}" alt="">` : ''}<span><small>LAST VIEWED</small><b>${escapeHtml(lastMovie.title)}</b><em>${escapeHtml(formatDate(lastLog.watchedAt))}</em></span></button>` : ''}</section>`;
  }

  function viewingTimeline(logs = latestLogs()) {
    return `<div class="review-list viewing-timeline">${logs.map((log) => {
      const record = personalMovie(log.movieId);
      const count = logsForMovie(record.id).length;
      const image = record.metadataLoading ? '<span class="review-poster-loading"><span class="loading-ring mini"></span></span>' : poster(record) ? `<img src="${escapeHtml(poster(record))}" alt="">` : '<span class="review-poster-loading is-empty"></span>';
      return `<article class="review-row timeline-row"><button class="review-main" data-movie="${record.id}">${image}<div><div class="review-title">${escapeHtml(record.title)}</div><div class="review-meta">${formatDate(log.watchedAt)}${log.rewatch || count > 1 ? ' · ↻ REWATCH' : ''}${log.ratingSnapshot ? ` · 당시 ★ ${log.ratingSnapshot}` : ''}</div>${log.note ? `<div class="review-text">${escapeHtml(log.note)}</div>` : '<div class="review-text muted-review">감상 기록</div>'}</div></button><div class="review-actions"><button class="secondary-button mini" data-log-edit="${escapeHtml(log.id)}">수정</button><button class="ghost-icon danger" data-log-delete="${escapeHtml(log.id)}">×</button></div></article>`;
    }).join('')}</div>`;
  }

  function relationshipReviewRows() {
    return Object.entries(state.relationships || {})
      .filter(([, relation]) => String(relation?.comment || '').trim())
      .map(([id, relation]) => ({ record: personalMovie(id), relation }))
      .sort((a, b) => String(b.relation.updatedAt || '').localeCompare(String(a.relation.updatedAt || '')));
  }

  function reviewArchiveHtml(limit = null) {
    const allRows = relationshipReviewRows();
    const rows = limit ? allRows.slice(0, limit) : allRows;
    if (!rows.length) return '<div class="empty-state"><b>아직 한줄평이 없습니다.</b><span>영화 상세에서 별점과 한줄평을 남기면 이곳에 모입니다.</span></div>';
    return `<div class="review-archive-list">${rows.map(({ record, relation }) => {
      const image = record.metadataLoading ? '<span class="review-poster-loading"><span class="loading-ring mini"></span></span>' : poster(record) ? `<img src="${escapeHtml(poster(record))}" alt="">` : '<span class="review-poster-loading is-empty"></span>';
      return `<article class="review-archive-row"><button class="review-main" data-movie="${escapeHtml(record.id)}">${image}<div><div class="review-title">${escapeHtml(record.title)}</div><div class="review-meta">${relation.rating ? `★ ${relation.rating} · ` : ''}${formatDate(relation.updatedAt)}</div><div class="review-text">${escapeHtml(relation.comment)}</div></div></button><button class="secondary-button mini" data-edit-relationship="${escapeHtml(record.id)}">수정</button></article>`;
    }).join('')}</div>`;
  }

  function ratingArchiveHtml() {
    const rows = Object.entries(state.relationships || {})
      .filter(([, relation]) => relation?.rating != null)
      .map(([id, relation]) => ({ record: personalMovie(id), relation }))
      .sort((a, b) => String(b.relation.updatedAt || '').localeCompare(String(a.relation.updatedAt || '')));
    if (!rows.length) return '<div class="empty-state"><b>아직 평가한 영화가 없습니다.</b><span>영화 상세에서 별점을 남기면 이곳에 모입니다.</span></div>';
    return `<div class="rating-archive-list">${rows.map(({ record, relation }) => {
      const image = record.metadataLoading ? '<span class="review-poster-loading"><span class="loading-ring mini"></span></span>' : poster(record) ? `<img src="${escapeHtml(poster(record))}" alt="">` : '<span class="review-poster-loading is-empty"></span>';
      return `<article class="review-archive-row rating-archive-row"><button class="review-main" data-movie="${escapeHtml(record.id)}">${image}<div><div class="review-title">${escapeHtml(record.title)}</div><div class="review-meta rating-archive-score">★ ${Number(relation.rating).toFixed(1)}</div><div class="review-text muted-review">${relation.comment ? escapeHtml(relation.comment) : '한줄평 없음'}</div></div></button><button class="secondary-button mini" data-edit-relationship="${escapeHtml(record.id)}">수정</button></article>`;
    }).join('')}</div>`;
  }

  function calendarHtml() {
    const year = calendarCursor.getFullYear();
    const month = calendarCursor.getMonth();
    const first = new Date(year, month, 1);
    const days = new Date(year, month + 1, 0).getDate();
    const offset = first.getDay();
    const monthPrefix = `${year}-${String(month + 1).padStart(2, '0')}`;
    const logsByDate = {};
    for (const log of state.logs) {
      if (!String(log.watchedAt).startsWith(monthPrefix)) continue;
      (logsByDate[log.watchedAt] || (logsByDate[log.watchedAt] = [])).push(log);
    }
    const representativeLog = (logs) => selectCalendarLead(logs, (movieId) => lib(movieId)?.rating ?? null);
    const uniqueFilmCount = (logs) => uniqueCalendarMovieCount(logs);
    const cellMedia = (logs) => {
      const lead = representativeLog(logs);
      const record = lead ? personalMovie(lead.movieId) : null;
      const imageUrl = record ? (backdrop(record) || poster(record)) : '';
      const count = uniqueFilmCount(logs);
      const extra = Math.max(0, count - 1);
      const leadRating = lead?.ratingSnapshot != null ? Number(lead.ratingSnapshot) : (lead && lib(lead.movieId)?.rating != null ? Number(lib(lead.movieId).rating) : null);
      const rating = leadRating != null ? `★ ${leadRating.toFixed(1)}` : '';
      const meta = [rating, extra ? `외 ${extra}편` : ''].filter(Boolean).join(' · ');
      const art = imageUrl ? `<img class="calendar-still" src="${escapeHtml(imageUrl)}" alt="${escapeHtml(record?.title || '')}"><span class="calendar-still-shade"></span>` : record?.metadataLoading ? '<span class="calendar-still calendar-still-loading"></span>' : '';
      return { lead, record, art, meta, count };
    };

    let cells = '';
    let cellCount = 0;
    for (let i = 0; i < offset; i++, cellCount++) cells += '<div class="calendar-cell is-empty" aria-hidden="true"></div>';
    for (let day = 1; day <= days; day++, cellCount++) {
      const date = `${monthPrefix}-${String(day).padStart(2, '0')}`;
      const logs = logsByDate[date] || [];
      const media = logs.length ? cellMedia(logs) : null;
      cells += `<button class="calendar-cell ${date === isoDate(new Date()) ? 'today' : ''} ${logs.length ? 'has-logs' : ''}" ${logs.length ? `data-calendar-day="${date}" aria-label="${month + 1}월 ${day}일, ${media.count}편 감상"` : `disabled aria-label="${month + 1}월 ${day}일"`}><span class="day-number">${day}</span>${logs.length ? `<span class="calendar-art">${media.art}</span><span class="calendar-cell-copy"><b>${escapeHtml(media.record?.title || '감상 기록')}</b><small>${escapeHtml(media.meta || `${media.count}편 감상`)}</small></span>` : ''}</button>`;
    }
    while (cellCount % 7 !== 0 || cellCount < 35) { cells += '<div class="calendar-cell is-empty" aria-hidden="true"></div>'; cellCount++; }

    const agenda = Object.keys(logsByDate).sort().map((date) => {
      const logs = logsByDate[date] || [];
      const media = cellMedia(logs);
      const day = Number(date.slice(-2));
      const weekday = new Intl.DateTimeFormat(LOCALE.language || 'ko-KR', { weekday: 'short' }).format(new Date(`${date}T12:00:00`));
      return `<button class="calendar-agenda-row" data-calendar-day="${date}"><span class="calendar-agenda-date"><b>${day}</b><small>${escapeHtml(weekday)}</small></span><span class="calendar-agenda-art">${media.art}</span><span class="calendar-agenda-copy"><b>${escapeHtml(media.record?.title || '감상 기록')}</b><small>${escapeHtml(media.meta || `${media.count}편 감상`)}</small></span></button>`;
    }).join('');

    const monthLogs = Object.values(logsByDate).flat();
    const monthFilms = new Set(monthLogs.map((log) => String(log.movieId))).size;
    return `<div class="calendar-head calendar-head-feature"><div><p class="eyebrow">VIEWING CALENDAR</p><h2>${year}. ${String(month + 1).padStart(2, '0')}</h2><p>${monthFilms ? `${monthFilms}편 · ${monthLogs.length}회 감상` : '이 달의 감상 기록이 없습니다.'}</p></div><div class="calendar-controls"><button class="secondary-button" data-cal="prev" aria-label="이전 달">‹</button><button class="secondary-button" data-cal="next" aria-label="다음 달">›</button></div></div><div class="calendar-grid calendar-grid-cinematic">${['일', '월', '화', '수', '목', '금', '토'].map((label) => `<div class="calendar-weekday">${label}</div>`).join('')}${cells}</div><div class="calendar-agenda">${agenda || '<div class="empty-state compact"><span>이 달에는 감상 기록이 없습니다.</span></div>'}</div>`;
  }

  function statsHtml() {
    const ratings = Object.values(state.relationships || {}).map((relation) => relation?.rating).filter((value) => value != null);
    const average = ratings.length ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(2) : '—';
    const knownRuntime = state.logs.reduce((sum, log) => sum + Number(movie(log.movieId)?.runtime || 0), 0);
    const unknownRuntime = state.logs.filter((log) => !Number(movie(log.movieId)?.runtime || 0)).length;
    const hours = Math.round(knownRuntime / 60);
    const distribution = [5, 4.5, 4, 3.5, 3, 2.5, 2, 1.5, 1, 0.5].map((value) => ({ value, count: ratings.filter((rating) => rating === value).length }));
    const max = Math.max(1, ...distribution.map((row) => row.count));
    return `<div class="stat-grid"><div class="stat-card"><strong>${state.logs.length}</strong><span>감상 기록</span></div><div class="stat-card"><strong>${hours}h${unknownRuntime ? '+' : ''}</strong><span>확인된 러닝타임${unknownRuntime ? ` · ${unknownRuntime}회 정보 보강 중` : ''}</span></div><div class="stat-card"><strong>${average}</strong><span>현재 평균 평점</span></div></div><div class="my-section"><h2>평점 분포</h2><div class="rating-bars">${distribution.map((row) => `<div class="rating-bar"><span>★ ${row.value}</span><div class="rating-track"><div class="rating-fill" style="width:${row.count / max * 100}%"></div></div><b>${row.count}</b></div>`).join('')}</div></div>`;
  }

  function settingsHtml() {
    if (demoMode) return `<div class="settings-grid"><section class="settings-card demo-settings-card"><p class="eyebrow">SESSION DEMO</p><h3>둘러보기 모드</h3><p>현재 기록은 이 브라우저 세션에만 존재하며 Cloud Sync에 저장되지 않습니다.</p><button class="secondary-button" data-demo-exit>데모 종료</button></section><section class="settings-card"><h3>구독 서비스</h3><p>데모에서는 Netflix와 WATCHA가 예시로 선택되어 있습니다. 설정을 바꿔도 세션 종료 시 초기화됩니다.</p></section></div>`;
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
      <section class="settings-card"><h3>가져오기 / 내보내기</h3><p>KINOSIS JSON과 Letterboxd 호환 CSV로 기록을 이동할 수 있습니다.</p><button class="secondary-button" id="openLetterboxdImport">Letterboxd CSV 가져오기</button><button class="secondary-button" id="openAboutFromSettings">KINOSIS JSON · 데이터 출처</button></section>
      <section class="settings-card danger-zone"><h3>계정 삭제</h3><p>인증 계정과 Cloud Sync 데이터를 모두 삭제합니다. 이 작업은 되돌릴 수 없습니다.</p><button class="danger-button" id="deleteAccountButton">계정 완전히 삭제</button></section>
    </div>`;
  }

  function renderMy() {
    const content = document.getElementById('myContent');
    if (!content) return;
    if (!isSignedIn()) {
      document.getElementById('profileCard').innerHTML = '';
      content.innerHTML = gateHtml('PROFILE');
      return;
    }
    renderProfileCard();
    document.querySelectorAll('#myTabs [role="tab"]').forEach((button) => {
      const active = button.dataset.my === myMode;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-selected', active ? 'true' : 'false');
      button.tabIndex = active ? 0 : -1;
    });
    content.setAttribute('aria-labelledby', `my-tab-${myMode}`);
    if (myMode === 'overview') {
      const recent = latestUniqueMovies();
      const recentComments = relationshipReviewRows().slice(0, 4);
      const year = new Date().getFullYear();
      const yearLogs = state.logs.filter((log) => String(log.watchedAt || '').startsWith(`${year}-`));
      const yearFilms = new Set(yearLogs.map((log) => String(log.movieId))).size;
      const knownYearRuntime = yearLogs.reduce((sum, log) => sum + Number(movie(log.movieId)?.runtime || 0), 0);
      const unknownYearRuntime = yearLogs.filter((log) => !Number(movie(log.movieId)?.runtime || 0)).length;
      const yearHours = Math.round(knownYearRuntime / 60);
      content.innerHTML = `<section class="my-year-summary"><span>${year}</span><strong>${yearFilms}편 · ${yearHours}시간${unknownYearRuntime ? ' 이상' : ''}</strong></section>${recent.length ? rowSection('최근 감상', '', recent, 8, 'my') : ''}${recentComments.length ? `<section class="my-section"><div class="section-head"><div><h2>최근 한줄평</h2></div><button class="section-action" data-my-review-archive>전체 보기</button></div>${reviewArchiveHtml(4)}</section>` : ''}<section class="my-section">${calendarHtml()}</section>`;
    } else if (myMode === 'reviews') {
      content.innerHTML = mySubMode === 'comments'
        ? `<section class="my-section"><div class="my-drill-head"><button class="secondary-button mini" data-my-log-timeline>← 기록</button><div><p class="eyebrow">PROFILE / COMMENTS</p><h2>내 한줄평</h2><p>영화마다 남긴 현재 한줄평을 확인합니다.</p></div></div>${reviewArchiveHtml()}</section>`
        : mySubMode === 'ratings'
          ? `<section class="my-section"><div class="my-drill-head"><button class="secondary-button mini" data-my-log-timeline>← 기록</button><div><p class="eyebrow">PROFILE / RATINGS</p><h2>내 평가</h2><p>현재 평점을 영화별로 확인합니다.</p></div></div>${ratingArchiveHtml()}</section>`
          : `<section class="my-section"><div class="section-head"><div><h2>감상 기록</h2><p>관람 사건을 날짜순으로 확인합니다.</p></div><div class="profile-record-links"><button class="section-action" data-my-ratings>내 평가 →</button><button class="section-action" data-my-review-archive>내 한줄평 →</button></div></div>${state.logs.length ? viewingTimeline() : '<div class="empty-state"><b>아직 감상 기록이 없습니다.</b><span>영화를 본 뒤 감상 기록을 남겨보세요.</span></div>'}</section>`;
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
    if (record.availabilityLoading) {
      return `<section class="detail-side-card watch-card is-loading" aria-live="polite"><div class="detail-side-title"><p>AVAILABILITY</p><h2>제공 정보 확인 중</h2></div><div class="watch-loading"><span class="loading-ring mini"></span><span>극장과 OTT 제공 정보를 불러오고 있습니다.</span></div>${rows.length ? `<div class="watch-rows is-stale">${rows.join('')}</div>` : ''}</section>`;
    }
    if (!rows.length) {
      return `<section class="detail-side-card watch-card is-empty"><div class="detail-side-title"><p>감상처</p><h2>현재 확인된 감상처가 없습니다.</h2></div><p class="watch-empty-copy">현재 확인 가능한 극장·OTT 정보가 없습니다.</p></section>`;
    }
    return `<section class="detail-side-card watch-card"><div class="detail-side-title"><p>AVAILABILITY</p><h2>제공 서비스</h2></div><div class="watch-rows">${rows.join('')}</div>${record.watchLink ? `<a class="watch-all-link" href="${escapeHtml(record.watchLink)}" target="_blank" rel="noopener noreferrer">전체 감상처 확인 <span>↗</span></a>` : ''}<p class="watch-source">${fresh ? `${escapeHtml(fresh)} · ` : ''}JustWatch via TMDB 기준${inTheatres ? ' · 극장 상영 정보 포함' : ''}</p></section>`;
  }

  function localRelatedMovies(record) {
    const genres = new Set(genreNames(record));
    return (CATALOG.movies || []).filter((item) => String(item.id) !== String(record.id) && genreNames(item).some((genre) => genres.has(genre))).slice(0, 10);
  }

  function relatedMovies(record) {
    const remote = relatedState.get(String(record.id));
    return remote?.status === 'ready' && remote.results.length ? remote.results : localRelatedMovies(record);
  }

  function starRatingHtml(movieId, rating = null, scope = 'detail') {
    const current = rating == null ? 0 : Number(rating);
    const inputs = Array.from({ length: 10 }, (_, index) => {
      const value = (index + 1) / 2;
      const inputId = `rating-${scope}-${movieId}-${index + 1}`.replace(/[^a-zA-Z0-9_-]/g, '-');
      return `<input class="star-radio" type="radio" name="rating-${escapeHtml(scope)}-${escapeHtml(movieId)}" id="${escapeHtml(inputId)}" value="${value}" data-rating-input data-rating-scope="${escapeHtml(scope)}" data-movie-id="${escapeHtml(movieId)}" ${Number(current) === value ? 'checked' : ''}><label for="${escapeHtml(inputId)}" data-star-value="${value}" aria-label="${value}점"></label>`;
    }).join('');
    return `<fieldset class="star-rating" data-star-rating data-current-rating="${current}" style="--rating:${current}" aria-label="내 평점"><legend>내 평점</legend><div class="star-control"><span class="star-visual" aria-hidden="true">★★★★★</span><span class="star-hit-grid">${inputs}</span></div><output>${current ? current.toFixed(1) : '평가하기'}</output><button type="button" class="star-clear" data-rating-clear="${escapeHtml(movieId)}" ${current ? '' : 'hidden'}>평점 취소</button></fieldset>`;
  }

  function ratingFromHost(host) {
    const checked = host?.querySelector?.('[data-rating-input]:checked');
    return checked ? Number(checked.value) : null;
  }

  function updateStarWidgetVisual(inputOrRoot) {
    const root = inputOrRoot?.closest?.('[data-star-rating]') || inputOrRoot;
    if (!root?.matches?.('[data-star-rating]')) return;
    const rating = ratingFromHost(root) || 0;
    root.dataset.currentRating = String(rating);
    root.style.setProperty('--rating', String(rating));
    const output = root.querySelector('output');
    if (output) output.textContent = rating ? rating.toFixed(1) : '평가하기';
    const clear = root.querySelector('[data-rating-clear]');
    if (clear) clear.hidden = !rating;
  }

  function setCurrentRating(movieId, rating) {
    setRelationship(state, movieId, { rating }, new Date().toISOString());
    if (rating != null) ensureShelfForEngagement(movieId);
    saveState();
    if (activeView === 'movie' && String(detailMovieId) === String(movieId)) patchMoviePage(movie(movieId), ['hero', 'activity']);
    if (activeView === 'my') renderMy();
  }

  async function openRelationshipEditor(id) {
    if (!requireAuth()) return;
    const record = movie(id) || personalMovie(id);
    const relation = lib(id);
    document.getElementById('relationshipMovieId').value = String(id);
    document.getElementById('relationshipMovieTitle').textContent = `${record.title} · 내 평가`;
    document.getElementById('relationshipRatingHost').innerHTML = starRatingHtml(id, relation?.rating ?? null, 'relationship');
    document.getElementById('relationshipComment').value = relation?.comment || '';
    UI.showDialog('relationshipDialog');
  }

  function viewingHistoryHtml(record) {
    const logs = logsForMovie(record.id);
    if (!logs.length) return '<div class="activity-empty">아직 감상 기록이 없습니다.</div>';
    return `<div class="detail-viewing-history">${logs.slice(0, 6).map((log, index) => `<button class="history-log" data-log-edit="${escapeHtml(log.id)}"><span>${formatDate(log.watchedAt)}${log.rewatch || index > 0 ? ' · ↻' : ''}</span><b>${log.ratingSnapshot ? `당시 ★ ${log.ratingSnapshot}` : '감상 기록'}</b>${log.note ? `<small>${escapeHtml(log.note)}</small>` : ''}</button>`).join('')}</div>`;
  }

  function detailContext(record) {
    const relationship = lib(record.id);
    const membershipEntry = membership(record.id);
    const art = artInfo(record);
    const logs = logsForMovie(record.id);
    const related = relatedMovies(record);
    const country = (record.productionCountries || []).slice(0, 2).join(' · ');
    const genres = genreNames(record).slice(0, 4);
    const releaseLabel = isInTheatres(record) ? '극장 상영 중' : record.theatricalStatus === 'upcoming' ? '개봉 예정' : record.theatricalStatus === 'recent' ? '최근 극장 개봉' : '';
    const titleMeta = [record.year || '', genres.slice(0, 2).join(' / '), country, record.runtime ? fmtRuntime(record.runtime) : ''].filter(Boolean).join(' · ');
    const cast = uniqueById(record.cast || []).slice(0, 8);
    const writers = uniqueById((record.writers || []).map((person) => ({ ...person, id: person.id || `writer-${person.name}`, title: person.name }))).slice(0, 4);
    const cinematographers = uniqueById((record.cinematographers || []).map((person) => ({ ...person, id: person.id || `dp-${person.name}`, title: person.name }))).slice(0, 2);
    const backLabel = previousView === 'curation' ? '기획전' : previousView === 'arthouse' ? 'ARTHOUSE' : previousView === 'library' ? 'LIBRARY' : previousView === 'my' ? 'PROFILE' : 'DISCOVER';
    return {
      relationship, membership: membershipEntry, entry: relationship, logs, related, media: mediaState.get(String(record.id)) || { status: 'idle', trailers: [], stills: [] }, collections: collectionsForMovie(record.id), country, genres, releaseLabel, titleMeta, cast, writers, cinematographers, backLabel,
      isArt: art.isArt, isSignedIn, escapeHtml, icon, backdrop, poster, fmtRuntime, formatDate,
      watchAvailabilityHtml, viewingHistoryHtml, uniqueMovies: uniqueById, card, starRatingHtml, railFrame,
    };
  }

  function renderMoviePage(record) {
    if (!record) return;
    document.title = `${record.title} — KINOSIS`;
    try {
      const html = renderDetail(record, detailContext(record));
      if (!html) throw new Error('Detail renderer returned empty output.');
      document.getElementById('moviePage').innerHTML = html;
    } catch (error) {
      console.error('detail render failed', error);
      document.getElementById('moviePage').innerHTML = detailErrorHtml(record, error);
    }
  }

  function patchMoviePage(record, parts) {
    if (!record || activeView !== 'movie' || String(detailMovieId) !== String(record.id)) return false;
    try {
      return patchDetail(document.getElementById('moviePage'), record, detailContext(record), parts);
    } catch (error) {
      console.warn('detail patch failed; falling back to full render', error);
      renderMoviePage(record);
      return false;
    }
  }

  function renderCurationPage(item) {
    if (!item) return;
    ensureCurationMovies(item).then((changed) => { if (changed && activeView === 'curation' && curationSlug === item.slug) renderCurationPage(item); }).catch(() => {});
    const films = curationMovies(item);
    const isArchive = item.kind === 'director-archive';
    const sourceLabel = isArchive ? 'DIRECTOR ARCHIVE' : 'KINOSIS CURATION';
    const backDestination = curationPreviousView === 'studio' ? 'Studio' : curationPreviousView === 'discover' ? 'Discover' : 'Arthouse';
    const heroImage = curationHeroImage(item);
    const entries = orderedEditorialEntries(item).map((entry) => ({ entry, record: movie(entry.id) })).filter(({ record }) => !!record);
    let body = '';
    if (isArchive) {
      body = films.length ? `<div class="director-manual-grid">${films.map((record) => card(record, 'arthouse')).join('')}</div>` : `<div class="empty-state"><b>선택된 영화가 없습니다.</b><span>Studio에서 이 Archive에 보여줄 작품을 직접 추가하세요.</span></div>`;
    } else if (!entries.length) {
      body = `<div class="empty-state"><b>큐레이션 영화를 불러오는 중입니다.</b><span class="loading-ring mini" aria-hidden="true"></span></div>`;
    } else {
      body = `<div class="curation-feature-list">${entries.map(({ entry, record }, index) => { const still = backdrop(record); const relation = lib(record.id); return `<article class="curation-feature-row"><div class="curation-feature-media">${still ? `<img src="${escapeHtml(still)}" alt="${escapeHtml(record.title)} 스틸" loading="lazy">` : poster(record) ? `<img class="is-poster" src="${escapeHtml(poster(record))}" alt="${escapeHtml(record.title)} 포스터" loading="lazy">` : '<span></span>'}<span class="curation-feature-index">${String(index + 1).padStart(2,'0')}</span></div><div class="curation-feature-copy"><p class="editorial-kicker">CURATED FILM</p><h2>${escapeHtml(record.title)}</h2><p class="curation-feature-meta">${escapeHtml([record.originalTitle && record.originalTitle !== record.title ? record.originalTitle : '', record.year, record.director].filter(Boolean).join(' · '))}</p>${relation?.rating != null ? `<p class="curation-feature-rating">내 ★ ${Number(relation.rating).toFixed(1)}</p>` : ''}<p class="curation-feature-note">${escapeHtml(entry.note || '이 작품에 대한 큐레이션 설명이 필요합니다.')}</p><div class="curation-feature-actions"><button class="secondary-button" data-movie="${escapeHtml(record.id)}">영화 상세</button><button class="secondary-button" data-action="watchlist" data-id="${escapeHtml(record.id)}">${relation?.watchlist ? '✓ 보고싶어요' : '＋ 보고싶어요'}</button></div></div></article>`; }).join('')}</div>`;
    }
    document.title = `${item.title} — KINOSIS`;
    document.getElementById('curationPage').innerHTML = `<div class="movie-page-back"><button data-curation-back>${icon('back')} ${backDestination}로 돌아가기</button><button class="share-link" data-share-curation="${escapeHtml(item.slug)}">공유</button></div>
      <section class="curation-page-hero ${isArchive ? 'is-archive' : 'is-editorial'}">${heroImage ? `<img class="curation-page-bg" src="${escapeHtml(heroImage)}" alt="">` : ''}<div class="arthouse-surface-texture" aria-hidden="true"></div><div class="curation-page-copy"><p class="editorial-kicker">${sourceLabel}</p><h1>${escapeHtml(item.title)}</h1>${item.subtitle ? `<h2>${escapeHtml(item.subtitle)}</h2>` : ''}<p>${escapeHtml(item.description || '')}</p><div class="curation-page-meta"><span>${films.length || curationMovieIds(item).length}편</span>${isSignedIn() ? `<button class="secondary-button mini" data-save-programme-collection="${escapeHtml(item.slug)}">＋ 내 컬렉션에 저장</button>` : ''}</div></div></section>
      <section class="content-section curation-film-section"><div class="section-head"><div><p class="editorial-kicker">${sourceLabel}</p><h2>${isArchive ? '선정 작품' : '큐레이션'}</h2><p>${isArchive ? '감독의 전체 필모그래피가 아니라 KINOSIS가 선택한 작품만 보여줍니다.' : '각 영화가 이 큐레이션에 놓인 이유를 함께 봅니다.'}</p></div></div>${body}</section>`;
    requestAnimationFrame(() => syncRailArrows(document.getElementById('curationPage')));
  }


  function routeUrlForCuration(slug, from) { return ROUTER.curationUrl(slug, from); }

  async function openCuration(slug, { route = 'push', from = null } = {}) {
    curationPreviewItem = null;
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
      ROUTER.write(historyValue, routeUrlForCuration(item.slug, curationPreviousView), route);
    }
    renderCurationPage(item);
  }

  function backFromCuration() {
    if (curationPreviousView === 'studio') { curationPreviewItem = null; studioMode = studioDraft ? 'edit' : 'list'; setView('studio', { skipGate: true, keepScroll: true, route: 'replace' }); renderStudio(); return; }
    if (canUseLiveApi() && history.state?.kinRoute && history.length > 1) history.back();
    else setView(curationPreviousView || 'arthouse', { skipGate: true, keepScroll: true, route: 'replace' });
  }

  function routeUrlForView(view) { return ROUTER.viewUrl(view); }

  function routeUrlForMovie(id, from) { return ROUTER.movieUrl(id, from, curationSlug); }

  function shareUrlForMovie(id) {
    if (!canUseLiveApi()) return new URL(routeUrlForMovie(id, previousView), location.href).href;
    const url = new URL('/share', location.origin);
    url.searchParams.set('movie', String(id));
    return url.href;
  }

  function shareUrlForCuration(item) {
    if (!item || !canUseLiveApi()) return location.href;
    const url = new URL('/share', location.origin);
    url.searchParams.set('curation', item.slug);
    url.searchParams.set('title', item.title);
    if (item.description) url.searchParams.set('description', item.description.slice(0, 220));
    const hero = curationHeroMovie(item);
    if (hero) url.searchParams.set('image', backdrop(hero));
    return url.href;
  }

  function updateHistoryForView(view, mode = 'push') {
    ROUTER.write({ kinRoute: true, view }, routeUrlForView(view), mode);
  }

  function setView(view, { skipGate = false, keepScroll = false, route = 'push', deferRender = false } = {}) {
    if (!skipGate && (view === 'library' || view === 'my') && !requireAuth(`${view === 'library' ? 'Library' : '프로필'}은 로그인 후 사용할 수 있습니다.`)) return false;
    if (view === 'studio' && !isAdmin()) { UI.toast('관리자 권한이 필요합니다.'); return false; }
    if (activeView !== view) scrollPositions.set(activeView, window.scrollY);
    activeView = view;
    document.querySelectorAll('.view').forEach((element) => element.classList.toggle('is-active', element.dataset.view === view));
    const navView = view === 'curation' ? curationPreviousView : view === 'movie' ? (previousView === 'curation' ? curationPreviousView : previousView) : view;
    document.querySelectorAll('[data-nav]').forEach((button) => button.classList.toggle('is-active', button.dataset.nav === navView));
    document.querySelectorAll('.mobile-nav-item[data-nav]').forEach((button) => button.classList.toggle('is-active', button.dataset.nav === navView));
    if (view !== 'movie') { const titleView = view === 'my' ? 'Profile' : view === 'studio' ? 'Studio' : view.charAt(0).toUpperCase() + view.slice(1); document.title = `KINOSIS — ${titleView}`; }
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

  function detailLoadingHtml(record) {
    const title = record?.metadataLoading ? '영화 정보를 확인하는 중' : (record?.title || '영화 상세정보');
    const posterUrl = poster(record);
    return `<div class="detail-progress-shell" role="status" aria-live="polite">
      <div class="detail-progress-visual">${posterUrl ? `<img src="${escapeHtml(posterUrl)}" alt="">` : '<div class="detail-progress-poster"></div>'}</div>
      <div class="detail-progress-copy">
        <div class="loading-ring"></div>
        <p class="eyebrow">LOADING FILM</p>
        <h1>${escapeHtml(title)}</h1>
        <p>작품 정보와 감상 가능 서비스를 불러오고 있습니다.</p>
        <div class="detail-skeleton-line wide"></div><div class="detail-skeleton-line"></div><div class="detail-skeleton-line short"></div>
      </div>
    </div>`;
  }

  function detailErrorHtml(record, error) {
    const title = record?.metadataLoading ? '영화 상세정보' : (record?.title || '영화 상세정보');
    const reason = error?.code === 'TIMEOUT'
      ? '응답 시간이 길어 요청을 중단했습니다.'
      : error?.status === 429
        ? '요청이 많아 잠시 제한되었습니다.'
        : '상세정보를 불러오지 못했습니다.';
    return `<div class="detail-load-error">
      <p class="eyebrow">DETAIL UNAVAILABLE</p>
      <h1>${escapeHtml(title)}</h1>
      <p>${escapeHtml(reason)} 검색 결과나 저장된 기록은 그대로 보존됩니다.</p>
      <div class="detail-load-error-actions"><button class="primary-button" data-detail-retry="${escapeHtml(record?.id || detailMovieId || '')}">다시 불러오기</button><button class="secondary-button" data-movie-back>돌아가기</button></div>
    </div>`;
  }

  async function openMovie(id, { route = 'push', from = null, force = false } = {}) {
    const key = String(id);
    PERFORMANCE.mark('detail.click', { movieId: key });
    let record = movie(key) || moviePlaceholder(key);
    const persistPersonal = personalMovieIds().includes(key);

    previousView = from || (activeView === 'movie' ? previousView : activeView);
    if (activeView !== 'movie') scrollPositions.set(previousView, window.scrollY);
    detailMovieId = key;
    setView('movie', { skipGate: true, keepScroll: false, route: 'none', deferRender: true });

    if (canUseLiveApi()) {
      const historyValue = { kinRoute: true, view: 'movie', movieId: key, from: previousView };
      ROUTER.write(historyValue, routeUrlForMovie(key, previousView), route);
    }

    // Paint the real movie surface immediately from whatever entity the caller
    // already knows. Network enrichment must never block route feedback.
    record = rememberMovie({ ...record, availabilityLoading: !record.availabilityUpdatedAt }, { persist: persistPersonal }) || record;
    renderMoviePage(record);
    PERFORMANCE.mark('detail.route-mounted', { movieId: key });
    PERFORMANCE.measure('detail.route-latency', 'detail.click', { movieId: key });
    if (!record.metadataLoading) {
      PERFORMANCE.mark('detail.first-usable', { movieId: key });
      PERFORMANCE.measure('detail.first-usable-latency', 'detail.click', { movieId: key, source: 'known-entity' });
    }

    const detailPromise = ensureMovieDetail(key, { persist: persistPersonal, throwOnFailure: true, force });
    const availabilityPromise = fetchMovieAvailability(key, { persist: persistPersonal, force });
    const relatedPromise = loadRelatedRecommendations(key, force);
    const mediaPromise = loadMovieMedia(key, force);
    const detailSlowTimer = setTimeout(() => {
      const current = movie(key);
      if (activeView === 'movie' && String(detailMovieId) === key && current?.metadataLoading) {
        const slowRecord = rememberMovie({ ...current, metadataSlow: true }, { persist: false }) || current;
        patchMoviePage(slowRecord, ['metadata']);
      }
    }, 3500);

    detailPromise.then((detailed) => {
      clearTimeout(detailSlowTimer);
      if (!detailed || activeView !== 'movie' || String(detailMovieId) !== key) return;
      record = rememberMovie({ ...detailed, availabilityLoading: !movie(key)?.availabilityUpdatedAt }, { persist: persistPersonal }) || detailed;
      patchMoviePage(record, ['hero', 'metadata', 'activity']);
      PERFORMANCE.mark('detail.metadata-ready', { movieId: key });
      PERFORMANCE.measure('detail.metadata-latency', 'detail.click', { movieId: key });
      if (!record.metadataLoading) {
        PERFORMANCE.mark('detail.first-usable', { movieId: key });
        PERFORMANCE.measure('detail.first-usable-latency', 'detail.click', { movieId: key, source: 'metadata' });
      }
    }).catch((error) => {
      clearTimeout(detailSlowTimer);
      console.warn('openMovie detail failed', error);
      if (activeView !== 'movie' || String(detailMovieId) !== key) return;
      const fallback = movie(key) || record;
      // If search/cache already gave us a usable title/poster, keep the film
      // page alive and fail only the metadata section. A network failure is not
      // an application failure.
      if (!fallback.metadataLoading && fallback.title) {
        const enriched = rememberMovie({ ...fallback, detailError: error.message || '상세정보를 불러오지 못했습니다.' }, { persist: persistPersonal }) || fallback;
        patchMoviePage(enriched, ['metadata']);
      } else {
        const page = document.getElementById('moviePage');
        if (page) page.innerHTML = detailErrorHtml(fallback, error);
      }
    });

    availabilityPromise.then((updated) => {
      if (activeView !== 'movie' || String(detailMovieId) !== key || !updated) return;
      patchMoviePage(updated, ['availability', 'hero']);
      PERFORMANCE.mark('detail.availability-ready', { movieId: key });
      PERFORMANCE.measure('detail.availability-latency', 'detail.click', { movieId: key });
    }).catch((error) => {
      console.warn('movie availability failed', error);
      const current = movie(key);
      if (current) rememberMovie({ ...current, availabilityLoading: false, availabilityError: error.message || 'availability failed' }, { persist: persistPersonal });
      if (activeView === 'movie' && String(detailMovieId) === key) patchMoviePage(movie(key) || record, ['availability']);
    });

    relatedPromise.catch(() => {});
    mediaPromise.catch(() => {});
  }

  function backFromMovie() {
    if (getSearchController()?.restoreAfterDetail?.()) {
      setView(previousView || 'discover', { skipGate: true, keepScroll: true, route: 'replace' });
      return;
    }
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
    const requestedView = params.get('view');
    const view = ['discover', 'arthouse', 'library', 'my'].includes(requestedView) ? requestedView : (requestedView === 'studio' && isAdmin() ? 'studio' : 'discover');
    setView(view, { skipGate: false, keepScroll: true, route: replace ? 'replace' : 'none' });
  }

  let searchController = null;
  function getSearchController() {
    if (searchController) return searchController;
    searchController = createSearchController({
      catalogMovies: CATALOG.movies || [],
      trendingMovies: CATALOG.sections?.trending || [],
      normalizeText, uniqueMovies: uniqueById, genreNames, escapeHtml, poster, rememberMovie, lib, isSignedIn, canUseLiveApi,
      movieRepository: MOVIE_REPOSITORY, prefetchMovieDetail: (id) => getMovieLoader()?.prefetchDetail(id),
      showDialog: (id) => UI.showDialog(id),
      closeDialog: (id) => UI.closeDialog(id),
    });
    searchController.attach();
    return searchController;
  }

  function renderSearch(query = '') { getSearchController()?.render(query); }
  function queueSearch(value) { getSearchController()?.queue(value); }
  function openSearch() { getSearchController()?.open(); }
  async function openPersonFilmography(id, name = '') { return getSearchController()?.openPersonFilmography(id, name); }


  async function openLog(id, logId = null) {
    if (!requireAuth()) return;
    let record = movie(id) || personalMovie(id);
    if (!record.metadataLoading) {
      rememberMovie(record, { persist: true });
      persistLocalCache();
    } else {
      hydrateReferencedMovies().catch(() => {});
    }
    const existing = logId ? state.logs.find((log) => String(log.id) === String(logId)) : null;
    const priorCount = logsForMovie(id).filter((log) => !existing || String(log.id) !== String(existing.id)).length;
    document.getElementById('logMovieId').value = String(id);
    document.getElementById('logEntryId').value = existing?.id || '';
    document.getElementById('logMovieTitle').textContent = existing ? `${record.title} 기록 수정` : record.title;
    document.getElementById('logDate').value = existing?.watchedAt || isoDate(new Date());
    const relation = lib(id);
    document.getElementById('logRatingHost').innerHTML = starRatingHtml(id, existing ? (existing.ratingSnapshot ?? null) : (relation?.rating ?? null), 'log');
    document.getElementById('logRatingLabel').textContent = existing ? '당시 평점' : '이번 감상 평점';
    document.getElementById('logNote').value = existing?.note || '';
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
    recomputeViewingSequence(log.movieId);
    saveState();
    UI.closeDialog('logDialog');
    UI.closeDialog('dayDialog');
    renderAfterPersonalChange(log.movieId, ['hero', 'activity']);
    UI.toast('감상 기록을 삭제했습니다.');
  }

  function toggleWatchlist(id) {
    if (!requireAuth()) return;
    const record = movie(id);
    if (record) rememberMovie(record, { persist: true });
    const next = !lib(id)?.watchlist;
    setRelationship(state, id, { watchlist: next }, new Date().toISOString());
    saveState();
    renderAfterPersonalChange(id, ['hero', 'activity']);
    refreshWatchlistAvailability(true).catch(() => {});
    UI.toast(next ? '보고싶어요에 추가했습니다.' : '보고싶어요에서 제거했습니다.');
  }

  function toggleFavorite(id) {
    if (!requireAuth()) return;
    const record = movie(id);
    if (record) rememberMovie(record, { persist: true });
    const next = !lib(id)?.favorite;
    setRelationship(state, id, { favorite: next }, new Date().toISOString());
    if (next) ensureShelfForEngagement(id);
    saveState();
    renderAfterPersonalChange(id, ['hero', 'activity']);
    UI.toast(next ? '좋아요에 추가하고 내 영화장에 보관했습니다.' : '좋아요를 해제했습니다.');
  }

  async function addMovieToLibrary(id) {
    if (!requireAuth()) return;
    const record = movie(id);
    if (record) rememberMovie(record, { persist: true });
    addLibraryMembership(state, id, new Date().toISOString());
    saveState();
    renderAfterPersonalChange(id, ['hero', 'activity']);
    UI.toast('내 영화장에 추가했습니다.');
  }

  async function removeMovieFromLibrary(id) {
    if (!requireAuth()) return;
    const record = movie(id);
    if (!membership(id)) return;
    const answer = await UI.ask({
      eyebrow: 'LIBRARY',
      title: '내 영화장에서 제거할까요?',
      message: `${record?.title || '영화'}는 현재 서가에서만 사라집니다. 별점, 한줄평, 감상 기록, 보고싶어요와 컬렉션은 그대로 보존됩니다.`,
      confirmText: '내 영화장에서 제거',
    });
    if (!answer.confirmed) return;
    removeLibraryMembership(state, id, new Date().toISOString());
    saveState();
    if (activeView === 'movie') patchMoviePage(movie(id), ['hero', 'activity']);
    else renderAll();
    UI.toast('내 영화장에서 제거했습니다. 개인 기록은 보존됩니다.');
  }

  async function deletePersonalMovieData(id) {
    if (!requireAuth()) return;
    const record = movie(id);
    const logs = logsForMovie(id);
    const answer = await UI.ask({
      eyebrow: 'DANGER ZONE',
      title: '이 영화의 모든 개인 데이터를 삭제할까요?',
      message: `${record?.title || '영화'}의 별점, 한줄평, 감상 기록 ${logs.length}개, 보고싶어요, 좋아요, Library 및 컬렉션 연결이 모두 삭제됩니다. 이 작업은 다른 기기에도 동기화됩니다.`,
      confirmText: '모든 개인 데이터 삭제',
      danger: true,
    });
    if (!answer.confirmed) return;
    deletePersonalFilmData(state, id, new Date().toISOString());
    if (!personalMovieIds().includes(String(id))) delete state.movieCache[String(id)];
    saveState();
    if (activeView === 'movie') {
      UI.toast('이 영화의 모든 개인 데이터를 삭제했습니다.');
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
    if (collection) pendingCollectionMovieId = null;
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
      pendingCollectionMovieId = String(id);
      openCollectionEditor();
      UI.toast('새 컬렉션을 만들면 이 영화가 바로 추가됩니다.');
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
    ensureShelfForEngagement(id);
    collection.coverMovieId = collection.coverMovieId || String(id);
    collection.updatedAt = new Date().toISOString();
    const record = movie(id);
    if (record) rememberMovie(record, { persist: true });
    saveState();
    renderAll();
    UI.toast(`${collection.name}에 추가했습니다.`);
  }


  async function saveProgrammeAsCollection(slug) {
    if (!requireAuth()) return;
    const item = CURATIONS.get(slug) || (curationPreviewItem?.slug === slug ? curationPreviewItem : null);
    if (!item) return;
    const ids = curationMovieIds(item);
    if (!ids.length) { UI.toast('저장할 영화가 없습니다.'); return; }
    let collection = state.collections.find((row) => row.sourceProgrammeSlug === item.slug);
    const now = new Date().toISOString();
    if (!collection) {
      collection = { id: `collection-${Date.now()}`, name: item.title, description: item.description || '', movieIds: [], coverMovieId: item.heroMovieId || ids[0], sourceProgrammeSlug: item.slug, createdAt: now, updatedAt: now };
      state.collections.push(collection);
    }
    for (const id of ids) {
      if (!collection.movieIds.includes(String(id))) collection.movieIds.push(String(id));
      ensureShelfForEngagement(id);
      const record = movie(id); if (record) rememberMovie(record, { persist: true });
    }
    collection.coverMovieId = item.heroMovieId || collection.coverMovieId || ids[0];
    collection.updatedAt = now;
    saveState();
    renderAll();
    UI.toast(`${item.title}을(를) 내 컬렉션에 저장했습니다.`);
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
      const record = personalMovie(log.movieId);
      const image = record.metadataLoading ? '<span class="row-poster-loading"><span class="loading-ring mini"></span></span>' : poster(record) ? `<img src="${escapeHtml(poster(record))}" alt="">` : '<span class="row-poster-loading is-empty"></span>';
      return `<div class="day-log-row"><button class="day-log-main" data-movie="${record.id}">${image}<span><b>${escapeHtml(record.title)}</b><small>${log.ratingSnapshot ? `당시 ★ ${log.ratingSnapshot}` : '평점 기록 없음'}${log.rewatch ? ' · ↻ 재관람' : ''}</small>${log.note ? `<em>${escapeHtml(log.note)}</em>` : ''}</span></button><button class="secondary-button mini" data-log-edit="${escapeHtml(log.id)}">수정</button></div>`;
    }).join('');
    UI.showDialog('dayDialog');
  }


  async function hydratePublishedProgrammes() {
    if (!CLOUD?.readPublishedProgrammes) return false;
    try {
      const rows = await CLOUD.readPublishedProgrammes();
      CURATIONS.replaceDynamic?.(rows || []);
      return true;
    } catch (error) {
      console.warn('published programmes unavailable; using static curations', error);
      return false;
    }
  }

  async function loadStudioProgrammes() {
    if (!isAdmin()) return [];
    let rows = [];
    if (CLOUD?.readStudioProgrammes) {
      try { rows = await CLOUD.readStudioProgrammes(); }
      catch (error) { console.warn('Studio database unavailable; static programmes remain editable as templates.', error); }
    }
    const merged = new Map((CURATIONS.all?.() || []).map((item) => [String(item.slug), { ...item, status: item.status || 'published' }]));
    for (const item of rows || []) if (item?.slug) merged.set(String(item.slug), item);
    studioProgrammes = [...merged.values()].sort((a, b) => Number(a.priority || 100) - Number(b.priority || 100));
    return studioProgrammes;
  }

  function normalizeStudioDraftFromDom() {
    if (!studioDraft) return null;
    const root = document.getElementById('studioContent');
    if (!root) return studioDraft;
    root.querySelectorAll('[data-studio-field]').forEach((field) => {
      const key = field.dataset.studioField;
      if (key === 'priority') studioDraft[key] = Number(field.value || 100);
      else studioDraft[key] = field.value.trim();
    });
    root.querySelectorAll('[data-studio-director]').forEach((field) => {
      studioDraft.source = studioDraft.source || { type: 'director', snapshot: [] };
      studioDraft.source[field.dataset.studioDirector] = field.value.trim();
    });
    const notes = [...root.querySelectorAll('[data-studio-film-note]')];
    if (notes.length && studioDraft.kind === 'editorial') {
      const entries = orderedEditorialEntries(studioDraft);
      notes.forEach((field) => { const index = Number(field.dataset.studioFilmNote); if (entries[index]) entries[index].note = field.value.trim(); });
      studioDraft.movies = entries;
      studioDraft.chapters = [];
    }
    return studioDraft;
  }

  function renderStudio() {
    const root = document.getElementById('studioContent');
    if (!root) return;
    if (!isAdmin()) {
      root.innerHTML = '<div class="gate-card"><div class="gate-card-inner"><p class="eyebrow">403</p><h1>관리자 전용</h1><p>KINOSIS Studio는 관리자 계정에만 노출됩니다.</p><button class="secondary-button" data-nav="discover">Discover로 돌아가기</button></div></div>';
      return;
    }
    root.innerHTML = studioMode === 'edit' && studioDraft
      ? renderStudioEditor(studioDraft, movie)
      : renderStudioHome(studioProgrammes, { loading: studioLoading, error: studioError });
  }

  async function openStudio() {
    if (!isAdmin()) { UI.toast('관리자 권한이 필요합니다.'); return; }
    studioMode = 'list'; studioDraft = null; studioError = ''; studioLoading = true;
    setView('studio', { skipGate: true });
    renderStudio();
    try { await loadStudioProgrammes(); studioError = ''; }
    catch (error) { console.warn('studio load', error); studioError = error.message || 'Studio 데이터를 불러오지 못했습니다.'; }
    finally { studioLoading = false; if (activeView === 'studio') renderStudio(); }
  }

  async function saveStudio(status) {
    if (!isAdmin() || !studioDraft) return;
    normalizeStudioDraftFromDom();
    if (!studioDraft.title || !studioDraft.slug) { UI.toast('제목과 slug를 입력하세요.'); return; }
    const studioEntries = orderedEditorialEntries(studioDraft);
    if (!studioEntries.length) { UI.toast('프로그램에는 영화가 한 편 이상 필요합니다.'); return; }
    if (studioDraft.kind === 'editorial' && studioEntries.some((entry) => !String(entry.note || '').trim())) { UI.toast('Curation의 모든 영화에 큐레이션 설명을 작성하세요.'); return; }
    if (studioDraft.kind === 'director-archive' && !studioDraft.source?.name && !studioDraft.subtitle) { UI.toast('Director Archive에는 감독 이름이 필요합니다.'); return; }
    try {
      const saved = await CLOUD.saveStudioProgramme(studioDraft, status);
      const summary = { ...saved, _summaryOnly: false };
      const index = studioProgrammes.findIndex((item) => String(item.slug) === String(summary.slug));
      if (index >= 0) studioProgrammes[index] = summary; else studioProgrammes.push(summary);
      studioProgrammes.sort((a, b) => Number(a.priority || 100) - Number(b.priority || 100));
      if (status === 'published') {
        const dynamic = (CURATIONS.dynamic?.() || []).filter((item) => String(item.slug) !== String(summary.slug));
        CURATIONS.replaceDynamic?.([...dynamic, { ...summary, status: 'published' }]);
      }
      studioMode = 'list'; studioDraft = null; renderStudio();
      hydratePublishedProgrammes().catch(() => {});
      UI.toast(status === 'published' ? '프로그램을 공개했습니다.' : '초안으로 저장했습니다.');
    } catch (error) { UI.toast(error.message || '저장하지 못했습니다.'); }
  }


  function renderStatus() {
    const live = CATALOG.mode === 'live';
    document.getElementById('sourceStatus').innerHTML = `Catalog: <b>${live ? 'LIVE API SYNC' : 'LOCAL DEMO'}</b><br>Updated: ${escapeHtml(CATALOG.updatedAt || 'unknown')}<br>Region: ${escapeHtml(CATALOG.region || LOCALE.region)}<br>Auth: ${isSignedIn() ? `SIGNED IN · ${escapeHtml(syncState.status.toUpperCase())}` : 'SIGNED OUT'}`;
  }

  function renderActiveView() {
    if (activeView === 'discover') renderDiscover();
    else if (activeView === 'arthouse') renderArthouse();
    else if (activeView === 'library') renderLibrary();
    else if (activeView === 'my') renderMy();
    else if (activeView === 'movie' && detailMovieId) renderMoviePage(movie(detailMovieId));
    else if (activeView === 'curation' && curationSlug) renderCurationPage(curationPreviewItem?.slug === curationSlug ? curationPreviewItem : CURATIONS.get(curationSlug));
    else if (activeView === 'studio') renderStudio();
  }

  function renderAll() {
    renderActiveView();
    renderStatus();
    renderAccountChrome();
    requestAnimationFrame(() => syncRailArrows());
  }

  function renderAfterPersonalChange(movieId, parts = ['hero', 'activity']) {
    if (activeView === 'movie' && String(detailMovieId) === String(movieId)) patchMoviePage(movie(movieId), parts);
    else renderActiveView();
    renderStatus();
    renderAccountChrome();
  }

  function downloadBlob(filename, content, type) {
    const blob = new Blob([content], { type });
    const anchor = document.createElement('a');
    anchor.href = URL.createObjectURL(blob);
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(anchor.href), 0);
  }

  function csvCell(value) {
    const text = String(value ?? '');
    return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  }

  function letterboxdDiaryCsv() {
    const header = ['Date','Name','Year','Letterboxd URI','Rating','Rewatch','Review','Tags','Watched Date'];
    const rows = [...state.logs].sort((a,b) => String(a.watchedAt || '').localeCompare(String(b.watchedAt || ''))).map((log) => {
      const record = movie(log.movieId) || state.movieCache?.[String(log.movieId)] || {};
      const watchedDate = String(log.watchedAt || '').slice(0, 10);
      return [watchedDate, record.title || `TMDB ${log.movieId}`, record.year || '', '', log.ratingSnapshot ?? '', log.rewatch ? 'Yes' : 'No', log.note || '', '', watchedDate];
    });
    return [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n');
  }

  function letterboxdWatchlistCsv() {
    const header = ['Date','Name','Year','Letterboxd URI'];
    const rows = Object.entries(state.relationships || {}).filter(([, relation]) => relation?.watchlist).map(([id, relation]) => {
      const record = movie(id) || state.movieCache?.[String(id)] || {};
      return [String(relation.updatedAt || '').slice(0, 10), record.title || `TMDB ${id}`, record.year || '', ''];
    });
    return [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n');
  }

  async function exportData() {
    if (!requireAuth()) return;
    const choice = await UI.ask({
      eyebrow: 'EXPORT', title: '내 데이터 다운로드', message: '계정 삭제 전에도 언제든 기록을 꺼내갈 수 있습니다.',
      select: { label: '형식', value: 'json', options: [{ value: 'json', label: 'KINOSIS JSON — 전체 백업' }, { value: 'letterboxd', label: 'Letterboxd 호환 CSV — Diary + Watchlist' }] },
      confirmText: '다운로드',
    });
    if (!choice?.confirmed) return;
    state.settings.lastExportAt = new Date().toISOString();
    saveState();
    const stamp = isoDate(new Date());
    if (choice.select === 'letterboxd') {
      downloadBlob(`kinosis-letterboxd-diary-${stamp}.csv`, `\uFEFF${letterboxdDiaryCsv()}`, 'text/csv;charset=utf-8');
      downloadBlob(`kinosis-letterboxd-watchlist-${stamp}.csv`, `\uFEFF${letterboxdWatchlistCsv()}`, 'text/csv;charset=utf-8');
      UI.toast('Diary와 Watchlist CSV를 내보냈습니다.');
      return;
    }
    downloadBlob(`kinosis-${stamp}.json`, JSON.stringify({ version: PERSONAL_SCHEMA_VERSION, exportedAt: new Date().toISOString(), locale: LOCALE, state }, null, 2), 'application/json');
    UI.toast('KINOSIS 전체 데이터를 내보냈습니다.');
  }


  async function handleImport(event) {
    if (!requireAuth()) return;
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      if (!parsed.state?.library) throw new Error('invalid');
      replaceState(mergeImport(state, parsed.state), 'json-import');
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
        const relation = ensureRelationship(matched.id);
        const watchlist = group.entries.some((row) => row.watchlist);
        const ratingRows = group.entries.filter((row) => row.rating != null);
        const reviewRows = group.entries.filter((row) => String(row.review || '').trim());
        if (watchlist) relation.watchlist = true;
        if (ratingRows.length) relation.rating = ratingRows[ratingRows.length - 1].rating;
        if (reviewRows.length) relation.comment = reviewRows[reviewRows.length - 1].review.trim();
        relation.updatedAt = new Date().toISOString();
        if (ratingRows.length || reviewRows.length || group.entries.some((row) => row.watched)) ensureMembership(matched.id);

        for (const row of group.entries.filter((item) => ['diary', 'reviews'].includes(item.sourceType) && item.watchedAt)) {
          const duplicate = state.logs.some((log) => String(log.movieId) === String(matched.id) && log.watchedAt === row.watchedAt && normalizeText(log.note) === normalizeText(row.review));
          if (!duplicate) {
            state.logs.push({
              id: `lb-${matched.id}-${row.watchedAt}-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
              movieId: String(matched.id),
              watchedAt: row.watchedAt,
              ratingSnapshot: row.rating,
              note: row.review || '',
              rewatch: !!row.rewatch,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            });
          }
        }
        recomputeViewingSequence(matched.id);
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

  document.addEventListener('error', (event) => {
    const image = event.target;
    if (image?.matches?.('[data-poster-image]')) {
      if (image.classList.contains('detail-poster')) {
        const fallback = document.createElement('div');
        fallback.className = 'detail-poster detail-poster-placeholder';
        fallback.setAttribute('aria-label', '포스터 없음');
        const label = document.createElement('span');
        label.textContent = String(image.alt || '').replace(/ 포스터$/, '') || '포스터 없음';
        fallback.appendChild(label);
        image.replaceWith(fallback);
      } else {
        image.parentElement?.classList.add('is-poster-error');
        image.remove();
      }
      return;
    }
    if (image?.matches?.('[data-hero-title-logo]')) {
      image.hidden = true;
      if (image.nextElementSibling) image.nextElementSibling.hidden = false;
    }
  }, true);

  document.addEventListener('pointerover', (event) => {
    const target = event.target instanceof Element ? event.target.closest('[data-movie]') : null;
    if (!target || target.dataset.prefetchGlobal === '1') return;
    target.dataset.prefetchGlobal = '1';
    moviePrefetchTimers.set(target, setTimeout(() => {
      const id = target.dataset.movie;
      if (id && String(id) !== String(detailMovieId || '')) getMovieLoader()?.prefetchDetail(id).catch(() => {});
    }, 140));
  });
  document.addEventListener('pointerout', (event) => {
    const target = event.target instanceof Element ? event.target.closest('[data-movie]') : null;
    if (!target) return;
    clearTimeout(moviePrefetchTimers.get(target));
    moviePrefetchTimers.delete(target);
    target.dataset.prefetchGlobal = '0';
  });
  document.addEventListener('focusin', (event) => {
    const target = event.target instanceof Element ? event.target.closest('[data-movie]') : null;
    const id = target?.dataset.movie;
    if (id && String(id) !== String(detailMovieId || '')) getMovieLoader()?.prefetchDetail(id).catch(() => {});
  });

  document.addEventListener('click', async (event) => {
    const close = event.target.closest('[data-close]');
    if (close) { UI.closeDialog(close.dataset.close); return; }

    const accountMenu = document.getElementById('accountMenu');
    if (accountMenu && !accountMenu.hidden && !event.target.closest('.account-menu-wrap')) {
      accountMenu.hidden = true;
      document.getElementById('topAccountButton')?.setAttribute('aria-expanded', 'false');
    }

    const railStep = event.target.closest('[data-rail-step]');
    if (railStep) {
      const shell = railStep.closest('.film-rail-shell');
      const rail = shell?.querySelector('[data-film-rail]');
      if (rail) {
        const direction = railStep.dataset.railStep === 'prev' ? -1 : 1;
        rail.scrollBy({ left: direction * Math.max(260, rail.clientWidth * 0.82), behavior: 'smooth' });
        setTimeout(() => syncRailArrows(shell), 360);
      }
      return;
    }

    const nav = event.target.closest('[data-nav]');
    if (nav) {
      if (nav.dataset.nav === 'my') { myMode = 'overview'; mySubMode = 'timeline'; }
      setView(nav.dataset.nav); return;
    }

    const libraryTab = event.target.closest('[data-library]');
    if (libraryTab) { libraryMode = libraryTab.dataset.library; renderLibrary(); return; }

    const myTab = event.target.closest('[data-my]');
    if (myTab) { myMode = myTab.dataset.my; if (myMode === 'reviews') mySubMode = 'timeline'; renderMy(); return; }

    const myDrill = event.target.closest('[data-my-drill]');
    if (myDrill) {
      const target = myDrill.dataset.myDrill;
      if (target === 'reviews' || target === 'ratings') { myMode = 'reviews'; mySubMode = target === 'reviews' ? 'comments' : 'ratings'; renderMy(); }
      else if (target === 'collections') { setView('library'); libraryMode = 'collections'; renderLibrary(); }
      else { myMode = 'reviews'; mySubMode = 'timeline'; renderMy(); }
      return;
    }
    if (event.target.closest('[data-my-review-archive]')) { myMode = 'reviews'; mySubMode = 'comments'; renderMy(); return; }
    if (event.target.closest('[data-my-ratings]')) { myMode = 'reviews'; mySubMode = 'ratings'; renderMy(); return; }
    if (event.target.closest('[data-my-log-timeline]')) { myMode = 'reviews'; mySubMode = 'timeline'; renderMy(); return; }

    const relationshipFilter = event.target.closest('[data-library-relationship]');
    if (relationshipFilter) {
      libraryFilter.relationship = relationshipFilter.dataset.libraryRelationship || 'all';
      renderLibrary();
      return;
    }

    const listView = event.target.closest('[data-library-view]');
    if (listView) { libraryView = listView.dataset.libraryView; renderLibrary(); return; }

    const ratingClear = event.target.closest('[data-rating-clear]');
    if (ratingClear) {
      const root = ratingClear.closest('[data-star-rating]');
      root?.querySelectorAll('[data-rating-input]').forEach((input) => { input.checked = false; });
      updateStarWidgetVisual(root);
      const scope = root?.querySelector('[data-rating-input]')?.dataset.ratingScope;
      if (scope === 'detail') setCurrentRating(ratingClear.dataset.ratingClear, null);
      return;
    }

    const editRelationship = event.target.closest('[data-edit-relationship]');
    if (editRelationship) { await openRelationshipEditor(editRelationship.dataset.editRelationship); return; }

    const saveProgramme = event.target.closest('[data-save-programme-collection]');
    if (saveProgramme) { await saveProgrammeAsCollection(saveProgramme.dataset.saveProgrammeCollection); return; }

    const addLibrary = event.target.closest('[data-add-library]');
    if (addLibrary) { await addMovieToLibrary(addLibrary.dataset.addLibrary); return; }

    const deletePersonal = event.target.closest('[data-delete-personal-movie]');
    if (deletePersonal) { await deletePersonalMovieData(deletePersonal.dataset.deletePersonalMovie); return; }

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

    const detailRetry = event.target.closest('[data-detail-retry]');
    if (detailRetry) {
      await openMovie(detailRetry.dataset.detailRetry, { route: 'none', from: previousView, force: true });
      return;
    }

    if (event.target.closest('[data-retry-library-hydration]')) {
      hydrateReferencedMovies({ force: true }).catch(() => {});
      return;
    }

    const deleteCollectionButton = event.target.closest('[data-delete-collection]');
    if (deleteCollectionButton) { await deleteCollection(deleteCollectionButton.dataset.deleteCollection); return; }

    const curationElement = event.target.closest('[data-curation]');
    if (curationElement) { await openCuration(curationElement.dataset.curation); return; }
    if (event.target.closest('[data-curation-back]')) { backFromCuration(); return; }

    const movieElement = event.target.closest('[data-movie]');
    if (movieElement) {
      UI.closeDialog('dayDialog');
      if (movieElement.closest('#searchDialog')) getSearchController()?.closeForDetail?.();
      await openMovie(movieElement.dataset.movie); return;
    }
    if (event.target.closest('[data-movie-back]')) { backFromMovie(); return; }

    const curationShare = event.target.closest('[data-share-curation]');
    if (curationShare) {
      const item = CURATIONS.get(curationShare.dataset.shareCuration);
      try { await navigator.clipboard.writeText(shareUrlForCuration(item)); UI.toast('미리보기 카드가 포함된 기획전 링크를 복사했습니다.'); }
      catch { UI.toast('공유 링크를 복사하지 못했습니다.'); }
      return;
    }

    const share = event.target.closest('[data-share-movie]');
    if (share) {
      try { await navigator.clipboard.writeText(shareUrlForMovie(share.dataset.shareMovie)); UI.toast('미리보기 카드가 포함된 영화 링크를 복사했습니다.'); }
      catch { UI.toast('공유 링크를 복사하지 못했습니다.'); }
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
      if (!isSignedIn()) { UI.showDialog('authDialog'); return; }
      const menu = document.getElementById('accountMenu');
      const button = document.getElementById('topAccountButton');
      const willOpen = !!menu?.hidden;
      if (menu) menu.hidden = !willOpen;
      button?.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
      return;
    }
    const accountNav = event.target.closest('[data-account-nav]');
    if (accountNav) {
      document.getElementById('accountMenu')?.setAttribute('hidden', '');
      document.getElementById('topAccountButton')?.setAttribute('aria-expanded', 'false');
      if (accountNav.dataset.accountNav === 'studio') { await openStudio(); return; }
      myMode = accountNav.dataset.accountNav === 'settings' ? 'settings' : 'overview';
      mySubMode = 'timeline';
      setView('my'); renderMy(); return;
    }
    const accountAction = event.target.closest('[data-account-action]');
    if (accountAction?.dataset.accountAction === 'signout') {
      if (demoMode) exitDemoMode(); else await CLOUD?.signOut();
      return;
    }
    if (event.target.closest('#enterDemoButton')) { enterDemoMode(); return; }
    if (event.target.closest('[data-demo-exit]')) { exitDemoMode(); return; }


    if (event.target.closest('[data-studio-back]')) { studioMode = 'list'; studioDraft = null; renderStudio(); return; }
    if (event.target.closest('[data-studio-reload]')) { studioLoading = true; studioError = ''; renderStudio(); try { await loadStudioProgrammes(); } catch (error) { studioError = error.message || 'Studio 데이터를 불러오지 못했습니다.'; } finally { studioLoading = false; renderStudio(); } return; }
    const studioNew = event.target.closest('[data-studio-new]');
    if (studioNew) { studioDraft = emptyProgramme(studioNew.dataset.studioNew); studioMode = 'edit'; renderStudio(); return; }
    const studioEdit = event.target.closest('[data-studio-edit]');
    if (studioEdit) {
      const slug = studioEdit.dataset.studioEdit;
      const listed = studioProgrammes.find((item) => item.slug === slug);
      studioMode = 'edit'; studioDraft = null; studioLoading = true; studioError = ''; renderStudio();
      try {
        const full = listed?._summaryOnly && CLOUD?.readStudioProgramme ? await CLOUD.readStudioProgramme(slug) : (listed || CURATIONS.get(slug));
        studioDraft = JSON.parse(JSON.stringify(full || CURATIONS.get(slug) || emptyProgramme()));
      } catch (error) { studioError = error.message || '프로그램을 불러오지 못했습니다.'; UI.toast(studioError); studioMode = 'list'; }
      finally { studioLoading = false; renderStudio(); }
      return;
    }
    const studioSave = event.target.closest('[data-studio-save]');
    if (studioSave) { await saveStudio(studioSave.dataset.studioSave); return; }
    const studioArchive = event.target.closest('[data-studio-archive]');
    if (studioArchive) {
      try {
        const archived = await CLOUD.archiveStudioProgramme(studioArchive.dataset.studioArchive);
        const index = studioProgrammes.findIndex((item) => String(item.slug) === String(archived.slug));
        if (index >= 0) studioProgrammes[index] = { ...studioProgrammes[index], status: 'archived', updatedAt: archived.updatedAt || new Date().toISOString() };
        const dynamic = (CURATIONS.dynamic?.() || []).filter((item) => String(item.slug) !== String(archived.slug));
        CURATIONS.replaceDynamic?.([...dynamic, { slug: archived.slug, status: 'archived' }]);
        renderStudio(); hydratePublishedProgrammes().catch(() => {}); UI.toast('프로그램을 보관했습니다.');
      } catch (error) { UI.toast(error.message || '보관하지 못했습니다.'); }
      return;
    }
    if (event.target.closest('[data-studio-pick-hero-image]')) {
      normalizeStudioDraftFromDom();
      const heroId = String(studioDraft?.heroMovieId || orderedEditorialEntries(studioDraft)[0]?.id || '');
      if (!heroId) { UI.toast('먼저 대표 영화를 선택해주세요.'); return; }
      const host = document.getElementById('studioHeroImageResults');
      host.innerHTML = '<div class="studio-search-loading"><span class="loading-ring"></span><span>대표 영화 이미지를 불러오는 중…</span></div>';
      UI.showDialog('studioHeroImageDialog');
      try {
        const record = movie(heroId) || await getMovieLoader()?.loadSummary?.(heroId, { persist: false }) || movie(heroId);
        const media = await MOVIE_REPOSITORY.media(heroId);
        const candidates = [];
        const add = (url, label) => { if (url && !candidates.some((row) => row.url === url)) candidates.push({ url, label }); };
        add(backdrop(record), '대표 백드롭');
        for (const still of media?.stills || []) add(still.originalUrl || still.url, '스틸컷');
        host.innerHTML = candidates.length ? candidates.slice(0, 16).map((row) => `<button type="button" class="studio-hero-image-option" data-studio-hero-image="${escapeHtml(row.url)}"><img src="${escapeHtml(row.url)}" alt=""><span>${escapeHtml(row.label)}</span></button>`).join('') : '<div class="empty-state compact"><b>선택할 이미지를 찾지 못했습니다.</b><span>Hero 이미지 URL을 직접 입력할 수도 있습니다.</span></div>';
      } catch (error) {
        host.innerHTML = `<div class="empty-state compact"><b>이미지를 불러오지 못했습니다.</b><span>${escapeHtml(error.message || '')}</span></div>`;
      }
      return;
    }
    const studioHeroImage = event.target.closest('[data-studio-hero-image]');
    if (studioHeroImage && studioDraft) {
      studioDraft.heroImageUrl = String(studioHeroImage.dataset.studioHeroImage || '');
      UI.closeDialog('studioHeroImageDialog');
      renderStudio();
      return;
    }
    if (event.target.closest('[data-studio-add-movie]')) {
      normalizeStudioDraftFromDom();
      studioSearchResults = [];
      document.getElementById('studioMovieSearchInput').value = '';
      document.getElementById('studioMovieSearchResults').innerHTML = '<div class="empty-state compact"><span>제목을 검색하면 포스터·연도·감독을 함께 확인할 수 있습니다.</span></div>';
      UI.showDialog('studioMovieDialog');
      setTimeout(() => document.getElementById('studioMovieSearchInput')?.focus(), 40);
      return;
    }
    if (event.target.closest('[data-studio-movie-search-submit]')) {
      const query = document.getElementById('studioMovieSearchInput')?.value.trim();
      if (!query) return;
      const host = document.getElementById('studioMovieSearchResults');
      host.innerHTML = '<div class="studio-search-loading"><span class="loading-ring"></span><span>영화를 찾는 중…</span></div>';
      try {
        const data = await MOVIE_REPOSITORY.search(query);
        studioSearchResults = data.results || [];
        const top = studioSearchResults.slice(0, 8);
        if (top.length) {
          try { await getMovieLoader()?.loadSummaries(top.map((row) => String(row.id)), { persist: false }); } catch { /* detail enrichment is best effort */ }
        }
        host.innerHTML = top.length ? top.map((row) => { const full = movie(row.id) || row; return `<button class="studio-search-result" data-studio-pick-movie="${escapeHtml(row.id)}"><span class="studio-search-poster">${poster(full) ? `<img src="${escapeHtml(poster(full))}" alt="">` : ''}</span><span class="studio-search-copy"><b>${escapeHtml(full.title)}</b><small>${escapeHtml([full.originalTitle && full.originalTitle !== full.title ? full.originalTitle : '', full.year, full.director || '감독 정보 없음'].filter(Boolean).join(' · '))}</small></span><span>추가</span></button>`; }).join('') : '<div class="empty-state compact"><b>검색 결과가 없습니다.</b></div>';
      } catch (error) { host.innerHTML = `<div class="empty-state compact"><b>검색하지 못했습니다.</b><span>${escapeHtml(error.message || '')}</span></div>`; }
      return;
    }
    const studioPickMovie = event.target.closest('[data-studio-pick-movie]');
    if (studioPickMovie && studioDraft) {
      normalizeStudioDraftFromDom();
      const id = String(studioPickMovie.dataset.studioPickMovie);
      const entries = orderedEditorialEntries(studioDraft);
      if (!entries.some((row) => row.id === id)) { const picked = movie(id) || studioSearchResults.find((row) => String(row.id) === id); entries.push({ id, note: '', ...(picked ? { snapshot: MOVIE_ENTITIES.compactSnapshot(picked) || picked } : {}) }); }
      studioDraft.movies = entries; studioDraft.chapters = []; studioDraft.heroMovieId = studioDraft.heroMovieId || id;
      UI.closeDialog('studioMovieDialog'); renderStudio(); return;
    }

    const studioRemove = event.target.closest('[data-studio-film-remove]');
    if (studioRemove && studioDraft) { normalizeStudioDraftFromDom(); const rows = orderedEditorialEntries(studioDraft); rows.splice(Number(studioRemove.dataset.studioFilmRemove), 1); studioDraft.movies = rows; studioDraft.chapters = []; renderStudio(); return; }
    const studioUp = event.target.closest('[data-studio-film-up],[data-studio-film-down]');
    if (studioUp && studioDraft) { normalizeStudioDraftFromDom(); const rows = orderedEditorialEntries(studioDraft); const index = Number(studioUp.dataset.studioFilmUp ?? studioUp.dataset.studioFilmDown); const delta = studioUp.hasAttribute('data-studio-film-up') ? -1 : 1; const next = Math.max(0, Math.min(rows.length - 1, index + delta)); if (next !== index) [rows[index], rows[next]] = [rows[next], rows[index]]; studioDraft.movies = rows; studioDraft.chapters = []; renderStudio(); return; }
    const studioPreview = event.target.closest('[data-studio-preview],[data-studio-preview-current]');
    if (studioPreview) {
      let candidate = studioPreview.hasAttribute('data-studio-preview-current') ? normalizeStudioDraftFromDom() : (studioProgrammes.find((item) => item.slug === studioPreview.dataset.studioPreview) || CURATIONS.get(studioPreview.dataset.studioPreview));
      if (candidate?._summaryOnly && CLOUD?.readStudioProgramme) {
        try { candidate = await CLOUD.readStudioProgramme(candidate.slug); } catch (error) { UI.toast(error.message || '미리보기 데이터를 불러오지 못했습니다.'); return; }
      }
      if (candidate) {
        curationPreviewItem = { ...candidate, status: 'draft-preview' };
        curationSlug = candidate.slug; curationPreviousView = 'studio';
        setView('curation', { skipGate: true, route: 'none', deferRender: true });
        renderCurationPage(curationPreviewItem);
      }
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

    if (event.target.closest('[data-new-collection]')) { openCollectionEditor(); return; }
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

    if (event.target.closest('#libraryFilterReset')) {
      libraryFilter = { ...libraryFilter, relationship: 'all', status: 'all', minRating: 'all', genre: 'all', availability: 'all' };
      renderLibrary();
      return;
    }

    if (event.target.closest('#editProfile')) { editProfile(); return; }
    if (event.target.closest('#syncNowButton')) { await syncNow(); return; }
    if (event.target.closest('#signOutButton')) { await CLOUD?.signOut(); return; }
    if (event.target.closest('#deleteAccountButton')) { await deleteAccount(); return; }
    if (event.target.closest('#accountExportButton') || event.target.closest('#exportButton')) { await exportData(); return; }
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
      getSearchController()?.backFromPerson();
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

  document.addEventListener('pointerover', (event) => {
    const star = event.target.closest?.('[data-star-value]');
    if (!star) return;
    const root = star.closest('[data-star-rating]');
    const value = Number(star.dataset.starValue || 0);
    root?.style.setProperty('--rating', String(value));
    const output = root?.querySelector('output');
    if (output) output.textContent = `${value.toFixed(1)} 미리보기`;
  });

  document.addEventListener('pointerout', (event) => {
    const target = event.target instanceof Element ? event.target : null;
    const root = target?.closest?.('[data-star-rating]');
    if (!root) return;
    // Preview is transient component state. Leaving a star for the output/clear
    // button stays inside the component; leaving the component restores the
    // committed radio value even when the last pointer target was not a star.
    if (event.relatedTarget instanceof Node && root.contains(event.relatedTarget)) return;
    const current = ratingFromHost(root) ?? (Number(root.dataset.currentRating || 0) || 0);
    root.dataset.currentRating = String(current);
    root.style.setProperty('--rating', String(current));
    const output = root.querySelector('output');
    if (output) output.textContent = current ? current.toFixed(1) : '평가하기';
  });

  document.addEventListener('change', (event) => {
    const ratingInput = event.target.closest?.('[data-rating-input]');
    if (ratingInput) {
      updateStarWidgetVisual(ratingInput);
      if (ratingInput.dataset.ratingScope === 'detail') setCurrentRating(ratingInput.dataset.movieId, Number(ratingInput.value));
      return;
    }
    const filterKeys = { librarySort: 'sort', libraryStatus: 'status', libraryRating: 'minRating', libraryGenre: 'genre', libraryAvailability: 'availability' };
    const key = filterKeys[event.target.id];
    if (key) { libraryFilter[key] = event.target.value; renderLibrary(); }
  });


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
    const ratingValue = ratingFromHost(document.getElementById('logRatingHost'));
    const note = document.getElementById('logNote').value.trim();
    if (!movieId || !watchedAt) return;
    const record = movie(movieId);
    if (record) rememberMovie(record, { persist: true });
    const prior = logsForMovie(movieId).filter((log) => String(log.id) !== String(logId));
    const now = new Date().toISOString();
    // A new viewing is a present-tense engagement and enters the current shelf.
    // Editing an old event must preserve a deliberate later shelf removal.
    if (!logId) ensureShelfForEngagement(movieId);
    // A new viewing may update the current rating; editing history must never
    // rewrite FilmRelationship from an old snapshot.
    if (!logId && ratingValue != null) setRelationship(state, movieId, { rating: ratingValue }, now);
    const payload = {
      movieId: String(movieId),
      watchedAt,
      ratingSnapshot: ratingValue,
      note,
      rewatch: false,
      updatedAt: now,
    };
    if (logId) {
      const index = state.logs.findIndex((log) => String(log.id) === String(logId));
      if (index >= 0) state.logs[index] = { ...state.logs[index], ...payload };
    } else {
      state.logs.push({ id: `log-${Date.now()}-${Math.random().toString(16).slice(2, 7)}`, createdAt: now, ...payload });
    }
    recomputeViewingSequence(movieId);
    saveState();
    UI.closeDialog('logDialog');
    renderAfterPersonalChange(movieId, ['hero', 'activity']);
    UI.toast(logId ? '감상 기록을 수정했습니다.' : (prior.length ? '재관람을 기록했습니다.' : '감상 기록을 저장했습니다.'));
  });

  document.getElementById('relationshipForm').addEventListener('submit', (event) => {
    event.preventDefault();
    if (!requireAuth()) return;
    const movieId = document.getElementById('relationshipMovieId').value;
    if (!movieId) return;
    const rating = ratingFromHost(document.getElementById('relationshipRatingHost'));
    const comment = document.getElementById('relationshipComment').value.trim();
    setRelationship(state, movieId, { rating, comment }, new Date().toISOString());
    if (rating != null || comment) ensureShelfForEngagement(movieId);
    saveState();
    UI.closeDialog('relationshipDialog');
    renderAfterPersonalChange(movieId, ['hero', 'activity']);
    UI.toast('내 평가를 저장했습니다.');
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
      const now = new Date().toISOString();
      const pendingId = pendingCollectionMovieId;
      const created = {
        id: `col-${Date.now()}`,
        name,
        description,
        coverMovieId: pendingId || null,
        type: 'manual',
        movieIds: pendingId ? [pendingId] : [],
        createdAt: now,
        updatedAt: now,
      };
      state.collections.push(created);
      if (pendingId) {
        ensureShelfForEngagement(pendingId);
        const record = movie(pendingId);
        if (record) rememberMovie(record, { persist: true });
      }
      pendingCollectionMovieId = null;
      libraryMode = 'collections';
    }
    saveState();
    UI.closeDialog('collectionDialog');
    renderAll();
  });

  document.getElementById('importInput').addEventListener('change', handleImport);
  document.getElementById('letterboxdInput').addEventListener('change', handleLetterboxdFiles);

  document.getElementById('myTabs')?.addEventListener('keydown', (event) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    const tabs = [...document.querySelectorAll('#myTabs [role="tab"]')];
    const index = tabs.indexOf(document.activeElement);
    if (index < 0) return;
    event.preventDefault();
    let next = index;
    if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
    else if (event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = tabs.length - 1;
    tabs[next].focus();
    tabs[next].click();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && document.activeElement?.id === 'studioMovieSearchInput') {
      event.preventDefault();
      document.querySelector('[data-studio-movie-search-submit]')?.click();
      return;
    }
    if (event.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) {
      event.preventDefault();
      openSearch();
    }
    if ((event.key === 'Enter' || event.key === ' ') && document.activeElement?.matches('.movie-card,.search-result')) {
      event.preventDefault();
      openMovie(document.activeElement.dataset.movie);
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
      if (demoMode && !user) { renderAccountChrome(); return; }
      if (user && demoMode) demoMode = false;
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
        replaceState(initialState(), 'account-delete');
        syncState = { status: 'guest', lastSyncedAt: null, message: '' };
        renderAll();
        const params = new URLSearchParams(location.search);
        if (!params.get('movie') && !params.get('curation')) setView('discover', { skipGate: true, route: 'replace' });
      }
    });
    CLOUD.init().then(() => { authReady = true; hydratePublishedProgrammes().catch(() => {}); }).catch(() => {});
  } else authReady = true;

  getSearchController()?.attach();
  renderAll();
  applyLocationRoute({ replace: true }).catch(() => setView('discover', { skipGate: true, route: 'replace' }));
