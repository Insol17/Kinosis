(function () {
  'use strict';

  function normalize(record) {
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

  function placeholder(id) {
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

  function personalIds(state) {
    const ids = new Set(Object.keys(state?.library || {}).map(String));
    for (const log of state?.logs || []) if (log?.movieId != null) ids.add(String(log.movieId));
    for (const collection of state?.collections || []) {
      for (const id of collection?.movieIds || []) ids.add(String(id));
      if (collection?.coverMovieId != null) ids.add(String(collection.coverMovieId));
    }
    return [...ids].filter((id) => /^\d+$/.test(id));
  }

  function compactSnapshot(record) {
    if (!record || record.metadataLoading) return null;
    const fields = [
      'id', 'title', 'originalTitle', 'year', 'releaseDate', 'director',
      'genres', 'posterUrl',
    ];
    const snapshot = {};
    for (const field of fields) if (record[field] !== undefined) snapshot[field] = record[field];
    snapshot.id = String(record.id);
    snapshot.source = 'cloud-snapshot';
    snapshot.detailLoaded = false;
    return snapshot;
  }

  window.KINOSIS_MOVIE_ENTITIES = Object.freeze({ normalize, placeholder, personalIds, compactSnapshot });
})();
