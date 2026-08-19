import { personalMovieIds } from '../domain/personal-state.js';

export function normalize(record) {
  if (!record || record.id == null) return null;
  return {
    ...record,
    id: String(record.id),
    title: record.title || record.originalTitle || 'Untitled',
    originalTitle: record.originalTitle || '',
    year: record.year || String(record.releaseDate || '').slice(0, 4) || null,
    providers: Array.isArray(record.providers) ? record.providers : [],
    genres: Array.isArray(record.genres) ? record.genres : [],
    source: record.source || 'catalog',
  };
}


export function merge(existing = {}, incoming = {}) {
  const next = normalize(incoming);
  if (!next) return normalize(existing);
  const merged = { ...existing, ...next };
  // Some lightweight endpoints intentionally omit expensive arrays. `normalize()`
  // gives those fields empty defaults for new entities, but an update that does
  // not own a field must never erase richer data already attached to the entity.
  if (!Object.prototype.hasOwnProperty.call(incoming, 'providers') && Array.isArray(existing?.providers)) merged.providers = existing.providers;
  if (!Object.prototype.hasOwnProperty.call(incoming, 'genres') && Array.isArray(existing?.genres)) merged.genres = existing.genres;
  if (!Object.prototype.hasOwnProperty.call(incoming, 'cast') && Array.isArray(existing?.cast)) merged.cast = existing.cast;
  if (!Object.prototype.hasOwnProperty.call(incoming, 'keywords') && Array.isArray(existing?.keywords)) merged.keywords = existing.keywords;
  if (!Object.prototype.hasOwnProperty.call(incoming, 'productionCompanies') && Array.isArray(existing?.productionCompanies)) merged.productionCompanies = existing.productionCompanies;
  return normalize(merged);
}

export function placeholder(id) {
  return {
    id: String(id),
    title: '영화 정보 불러오는 중',
    originalTitle: '',
    year: null,
    genres: [],
    providers: [],
    source: 'placeholder',
    detailLoaded: false,
    metadataLoading: true,
  };
}

export function personalIds(state) {
  return personalMovieIds(state);
}

export function compactSnapshot(record) {
  if (!record || record.metadataLoading) return null;
  const fields = [
    'id', 'title', 'originalTitle', 'year', 'releaseDate', 'director',
    'genres', 'posterUrl', 'backdropUrl',
  ];
  const snapshot = {};
  for (const field of fields) if (record[field] !== undefined) snapshot[field] = record[field];
  snapshot.id = String(record.id);
  snapshot.source = 'cloud-snapshot';
  snapshot.detailLoaded = false;
  return snapshot;
}
