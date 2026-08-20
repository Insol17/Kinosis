export const PERSONAL_SCHEMA_VERSION = 8;

function numberRating(value) {
  if (value === '' || value == null) return null;
  const rating = Number(value);
  return Number.isFinite(rating) && rating >= 0.5 && rating <= 5 ? Math.round(rating * 2) / 2 : null;
}

export function normalizeRelationship(value = {}) {
  return {
    rating: numberRating(value.rating),
    comment: String(value.comment ?? value.review ?? '').trim(),
    watchlist: !!value.watchlist,
    favorite: !!value.favorite,
    updatedAt: value.updatedAt || value.savedAt || '1970-01-01T00:00:00.000Z',
  };
}

export function normalizeMembership(value = {}) {
  return {
    savedAt: value.savedAt || value.createdAt || value.updatedAt || '1970-01-01T00:00:00.000Z',
    updatedAt: value.updatedAt || value.savedAt || value.createdAt || '1970-01-01T00:00:00.000Z',
  };
}

export function normalizeViewingEvent(log = {}, index = 0, today = new Date().toISOString().slice(0, 10)) {
  const watchedAt = log.watchedAt || today;
  const fallbackTime = watchedAt ? `${watchedAt}T12:00:00.000Z` : '1970-01-01T00:00:00.000Z';
  return {
    id: String(log.id || `legacy-log-${index}-${log.movieId || 'x'}-${watchedAt}`),
    movieId: String(log.movieId),
    watchedAt,
    rewatch: !!log.rewatch,
    ratingSnapshot: numberRating(log.ratingSnapshot ?? log.rating),
    note: String(log.note ?? log.review ?? '').trim(),
    createdAt: log.createdAt || log.updatedAt || fallbackTime,
    updatedAt: log.updatedAt || log.createdAt || fallbackTime,
  };
}

export function migratePersonalShape(source = {}, { today = new Date().toISOString().slice(0, 10) } = {}) {
  const relationships = {};
  for (const [id, value] of Object.entries(source.relationships || {})) {
    relationships[String(id)] = normalizeRelationship(value);
  }

  const library = {};
  for (const [id, value] of Object.entries(source.library || {})) {
    const key = String(id);
    library[key] = normalizeMembership(value);
    if (!relationships[key]) {
      const legacyRelationship = normalizeRelationship(value);
      if (legacyRelationship.rating != null || legacyRelationship.comment || legacyRelationship.watchlist || legacyRelationship.favorite) {
        relationships[key] = legacyRelationship;
      }
    }
  }

  const logs = (Array.isArray(source.logs) ? source.logs : []).map((log, index) => normalizeViewingEvent(log, index, today));

  // Legacy 0.4.4.x stored the latest rating/review in viewing logs and mirrored
  // them into library rows. Preserve the latest authored opinion as the current
  // FilmRelationship while keeping older reviews as immutable viewing notes.
  const byMovie = new Map();
  for (const event of logs) {
    const list = byMovie.get(event.movieId) || [];
    list.push(event);
    byMovie.set(event.movieId, list);
  }
  for (const [movieId, events] of byMovie.entries()) {
    events.sort((a, b) => String(a.watchedAt).localeCompare(String(b.watchedAt)) || String(a.createdAt).localeCompare(String(b.createdAt)));
    events.forEach((event, index) => { event.rewatch = index > 0; });
    if (!relationships[movieId]) relationships[movieId] = normalizeRelationship({});
    const relation = relationships[movieId];
    const latestWithRating = [...events].reverse().find((event) => event.ratingSnapshot != null);
    const latestWithNote = [...events].reverse().find((event) => event.note);
    if (relation.rating == null && latestWithRating) relation.rating = latestWithRating.ratingSnapshot;
    if (!relation.comment && latestWithNote) relation.comment = latestWithNote.note;
    relation.updatedAt = [relation.updatedAt, latestWithRating?.updatedAt, latestWithNote?.updatedAt].filter(Boolean).sort().at(-1) || relation.updatedAt;
  }

  return { library, relationships, logs };
}

export function relationshipFor(state, id) {
  return state?.relationships?.[String(id)] || null;
}

export function membershipFor(state, id) {
  return state?.library?.[String(id)] || null;
}

export function ensureRelationship(state, id, now = new Date().toISOString()) {
  const key = String(id);
  state.relationships ||= {};
  state.meta ||= {};
  state.meta.deletedRelationships ||= {};
  if (state.meta.deletedRelationships[key]) delete state.meta.deletedRelationships[key];
  if (!state.relationships[key]) state.relationships[key] = normalizeRelationship({ updatedAt: now });
  return state.relationships[key];
}

export function ensureMembership(state, id, now = new Date().toISOString()) {
  const key = String(id);
  state.library ||= {};
  state.meta ||= {};
  state.meta.deletedLibrary ||= {};
  if (state.meta.deletedLibrary[key]) delete state.meta.deletedLibrary[key];
  if (!state.library[key]) state.library[key] = { savedAt: now, updatedAt: now };
  return state.library[key];
}

export function promoteEngagedMemberships(state, now = new Date().toISOString()) {
  state.library ||= {};
  const ids = new Set();
  for (const [id, relation] of Object.entries(state.relationships || {})) {
    // Watchlist-only is intentionally not part of the current shelf. Any authored
    // opinion or favorite is a stronger signal that the film belongs to the
    // user's personal film library.
    if (relation && (relation.rating != null || relation.comment || relation.favorite)) ids.add(String(id));
  }
  for (const log of state.logs || []) if (log?.movieId != null) ids.add(String(log.movieId));
  for (const collection of state.collections || []) for (const id of collection?.movieIds || []) ids.add(String(id));
  for (const id of ids) if (!state.library[id]) state.library[id] = { savedAt: now, updatedAt: now };
  return [...ids];
}

export function hasRelationshipContent(value) {
  return !!(value && (value.rating != null || value.comment || value.watchlist || value.favorite));
}

export function personalMovieIds(state) {
  const ids = new Set([
    ...Object.keys(state?.library || {}),
    ...Object.keys(state?.relationships || {}),
  ].map(String));
  for (const log of state?.logs || []) if (log?.movieId != null) ids.add(String(log.movieId));
  for (const collection of state?.collections || []) {
    for (const id of collection?.movieIds || []) ids.add(String(id));
    if (collection?.coverMovieId != null) ids.add(String(collection.coverMovieId));
  }
  return [...ids].filter((id) => /^\d+$/.test(id));
}
