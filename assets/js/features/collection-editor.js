/**
 * Pure collection mutations. UI, persistence and Movie Entity hydration stay outside.
 * Keeping these commands pure makes add/remove/reorder flows consistent across
 * the collection search surface, poster grid and order editor.
 */
function stamp(collection, now) {
  collection.updatedAt = typeof now === 'function' ? now() : (now || new Date().toISOString());
  collection.coverMovieId = collection.movieIds?.[0] || null;
}

export function addMovieToCollection(collection, movieId, now) {
  if (!collection || movieId == null) return false;
  collection.movieIds ||= [];
  const key = String(movieId);
  if (collection.movieIds.some((id) => String(id) === key)) return false;
  collection.movieIds.push(key);
  stamp(collection, now);
  return true;
}

export function removeMovieFromCollection(collection, movieId, now) {
  if (!collection || movieId == null || !Array.isArray(collection.movieIds)) return false;
  const key = String(movieId);
  const next = collection.movieIds.filter((id) => String(id) !== key);
  if (next.length === collection.movieIds.length) return false;
  collection.movieIds = next;
  stamp(collection, now);
  return true;
}

export function moveMovieInCollection(collection, index, direction, now) {
  if (!collection || !Array.isArray(collection.movieIds)) return false;
  const from = Number(index);
  if (!Number.isInteger(from) || from < 0 || from >= collection.movieIds.length) return false;
  const to = direction === 'up' ? from - 1 : direction === 'down' ? from + 1 : from;
  if (to < 0 || to >= collection.movieIds.length || to === from) return false;
  [collection.movieIds[from], collection.movieIds[to]] = [collection.movieIds[to], collection.movieIds[from]];
  stamp(collection, now);
  return true;
}
