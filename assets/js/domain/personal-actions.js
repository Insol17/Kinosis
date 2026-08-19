import { ensureMembership, ensureRelationship, hasRelationshipContent } from './personal-state.js';

function ensureMeta(state) {
  state.meta ||= {};
  state.meta.deletedLibrary ||= {};
  state.meta.deletedRelationships ||= {};
  state.meta.deletedLogs ||= {};
  return state.meta;
}

export function setRelationship(state, movieId, patch = {}, now = new Date().toISOString()) {
  const key = String(movieId);
  const relation = ensureRelationship(state, key, now);
  if ('rating' in patch) relation.rating = patch.rating == null ? null : Number(patch.rating);
  if ('comment' in patch) relation.comment = String(patch.comment || '').trim();
  if ('watchlist' in patch) relation.watchlist = !!patch.watchlist;
  if ('favorite' in patch) relation.favorite = !!patch.favorite;
  relation.updatedAt = now;

  const meta = ensureMeta(state);
  if (!hasRelationshipContent(relation)) {
    delete state.relationships[key];
    meta.deletedRelationships[key] = now;
    return null;
  }
  delete meta.deletedRelationships[key];
  return relation;
}

export function addLibraryMembership(state, movieId, now = new Date().toISOString()) {
  const key = String(movieId);
  const row = ensureMembership(state, key, now);
  row.updatedAt = now;
  const meta = ensureMeta(state);
  delete meta.deletedLibrary[key];
  return row;
}

export function removeLibraryMembership(state, movieId, now = new Date().toISOString()) {
  const key = String(movieId);
  if (!state.library?.[key]) return false;
  delete state.library[key];
  ensureMeta(state).deletedLibrary[key] = now;
  return true;
}

export function deletePersonalFilmData(state, movieId, now = new Date().toISOString()) {
  const key = String(movieId);
  const meta = ensureMeta(state);
  const removedLogIds = [];

  state.logs = (state.logs || []).filter((log) => {
    if (String(log.movieId) !== key) return true;
    removedLogIds.push(String(log.id));
    meta.deletedLogs[String(log.id)] = now;
    return false;
  });

  for (const collection of state.collections || []) {
    if (!(collection.movieIds || []).some((id) => String(id) === key)) continue;
    collection.movieIds = (collection.movieIds || []).filter((id) => String(id) !== key);
    collection.coverMovieId = collection.movieIds[0] || null;
    collection.updatedAt = now;
  }

  if (state.library?.[key]) delete state.library[key];
  if (state.relationships?.[key]) delete state.relationships[key];
  meta.deletedLibrary[key] = now;
  meta.deletedRelationships[key] = now;
  return { removedLogIds };
}
