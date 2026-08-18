(function(){
  'use strict';

  function topSeeds(state, limit = 3) {
    const rows = Object.entries(state?.library || {})
      .map(([id, item]) => ({ id: String(id), rating: Number(item?.rating || 0), watched: !!item?.watched }))
      .filter((row) => row.rating >= 3.5 || row.watched)
      .sort((a, b) => b.rating - a.rating);
    return rows.slice(0, limit).map((row) => row.id);
  }

  function buildTasteProfile(state, movieResolver) {
    const genres = new Map();
    const directors = new Map();
    let arthouseLikes = 0;
    let weightedCount = 0;
    for (const [id, item] of Object.entries(state?.library || {})) {
      const rating = Number(item?.rating || 0);
      if (!rating) continue;
      const movie = movieResolver(id);
      if (!movie) continue;
      const weight = Math.max(0, rating - 2.5);
      weightedCount += weight;
      for (const genre of movie.genres || []) {
        const name = typeof genre === 'string' ? genre : genre?.name;
        if (name) genres.set(name, (genres.get(name) || 0) + weight);
      }
      if (movie.director) directors.set(movie.director, (directors.get(movie.director) || 0) + weight * 1.25);
      if (movie.artSeed || movie.artOverride === true) arthouseLikes += weight;
    }
    return {
      genres: [...genres.entries()].sort((a,b)=>b[1]-a[1]).slice(0,5),
      directors: [...directors.entries()].sort((a,b)=>b[1]-a[1]).slice(0,5),
      arthouseBias: weightedCount ? arthouseLikes / weightedCount : 0,
    };
  }

  function explanation(profile) {
    const bits = [];
    if (profile.directors?.[0]?.[0]) bits.push(`${profile.directors[0][0]} 선호`);
    if (profile.genres?.[0]?.[0]) bits.push(`${profile.genres[0][0]} 선호`);
    return bits.length ? bits.join(' · ') : '높게 평가한 영화 기반';
  }

  window.KINOSIS_RECOMMENDER = Object.freeze({ topSeeds, buildTasteProfile, explanation });
})();
