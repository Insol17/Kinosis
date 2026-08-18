import assert from 'node:assert/strict';

process.env.TMDB_READ_ACCESS_TOKEN = 'test-token-not-real';

const searchModule = await import('../netlify/functions/movie-search.mjs');
const detailModule = await import('../netlify/functions/movie-detail.mjs');

const realFetch = globalThis.fetch;
try {
  globalThis.fetch = async (url, options = {}) => {
    const value = String(url);
    assert.equal(options.headers.Authorization, 'Bearer test-token-not-real');
    if (value.includes('/search/movie')) {
      return Response.json({
        page: 1,
        total_results: 1,
        results: [{ id: 15, title: '시민 케인', original_title: 'Citizen Kane', release_date: '1941-04-17', overview: 'x', vote_average: 8.0, vote_count: 999, poster_path: '/poster.jpg', backdrop_path: '/backdrop.jpg' }]
      });
    }
    if (value.includes('/movie/15/credits')) return Response.json({ crew: [{ job: 'Director', name: 'Orson Welles' }], cast: [] });
    if (value.includes('/movie/15/external_ids')) return Response.json({ imdb_id: 'tt0033467' });
    if (value.includes('/movie/15/watch/providers')) return Response.json({ results: { KR: { link: 'https://example.test/watch', flatrate: [{ provider_id: 8, provider_name: 'Netflix', logo_path: '/netflix.jpg', display_priority: 1 }] } } });
    if (value.includes('/movie/15')) return Response.json({ id: 15, title: '시민 케인', original_title: 'Citizen Kane', release_date: '1941-04-17', runtime: 119, overview: 'x', tagline: '', vote_average: 8.0, vote_count: 999, genres: [{ id: 18, name: '드라마' }], poster_path: '/poster.jpg', backdrop_path: '/backdrop.jpg' });
    throw new Error(`unexpected URL ${value}`);
  };

  const searchResponse = await searchModule.default(new Request('https://kinosis.test/api/movie-search?q=%EC%8B%9C%EB%AF%BC%20%EC%BC%80%EC%9D%B8'));
  assert.equal(searchResponse.status, 200);
  const searchData = await searchResponse.json();
  assert.equal(searchData.results[0].id, '15');
  assert.equal(searchData.results[0].title, '시민 케인');
  assert.ok(!JSON.stringify(searchData).includes('test-token-not-real'), 'secret leaked in search response');

  const detailResponse = await detailModule.default(new Request('https://kinosis.test/api/movie-detail?id=15'));
  assert.equal(detailResponse.status, 200);
  const detailData = await detailResponse.json();
  assert.equal(detailData.director, 'Orson Welles');
  assert.equal(detailData.imdbId, 'tt0033467');
  assert.equal(detailData.providers[0].type, 'subscription');
  assert.ok(!JSON.stringify(detailData).includes('test-token-not-real'), 'secret leaked in detail response');

  console.log('netlify-functions.test: live search/detail contract OK');
} finally {
  globalThis.fetch = realFetch;
}
