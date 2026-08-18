import { imageUrl, json, tmdb } from '../lib/tmdb.mjs';

function normalize(value) {
  return String(value || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/\+/g, 'plus')
    .replace(/[^a-z0-9가-힣]+/g, '');
}

function providerMatches(requested, providerName) {
  const a = normalize(requested);
  const b = normalize(providerName);
  if (!a || !b) return false;
  return a === b || b.startsWith(a) || a.startsWith(b);
}

function movieRow(movie, provider) {
  return {
    id: String(movie.id),
    title: movie.title || movie.original_title || 'Untitled',
    originalTitle: movie.original_title || '',
    year: String(movie.release_date || '').slice(0, 4) || null,
    releaseDate: movie.release_date || null,
    overview: movie.overview || '',
    voteAverage: movie.vote_average ?? null,
    voteCount: movie.vote_count ?? 0,
    popularity: movie.popularity ?? 0,
    posterUrl: imageUrl(movie.poster_path, 'w500'),
    backdropUrl: imageUrl(movie.backdrop_path, 'w1280'),
    providers: [{
      id: provider.provider_id,
      name: provider.provider_name,
      type: 'subscription',
      logoUrl: imageUrl(provider.logo_path, 'w92'),
      displayPriority: provider.display_priority ?? 999,
    }],
    source: 'tmdb-live-streaming',
  };
}

export default async (request) => {
  if (request.method !== 'GET') return json({ error: 'Method not allowed.' }, 405);
  const url = new URL(request.url);
  const requested = (url.searchParams.get('providers') || '').split(',').map((value) => value.trim()).filter(Boolean).slice(0, 8);
  if (!requested.length) return json({ results: [], matchedProviders: [] }, 200, 'private, max-age=60');

  try {
    const providerPayload = await tmdb('/watch/providers/movie', { watch_region: 'KR', language: 'ko-KR' });
    const available = providerPayload?.results || [];
    const matched = [];
    for (const name of requested) {
      const target = normalize(name);
      const exact = available.filter((provider) => normalize(provider.provider_name) === target);
      const hits = exact.length ? exact : available.filter((provider) => providerMatches(name, provider.provider_name));
      for (const hit of hits) if (!matched.some((provider) => provider.provider_id === hit.provider_id)) matched.push(hit);
    }

    const chosen = matched.slice(0, 8);
    const pages = await Promise.all(chosen.map(async (provider) => {
      const data = await tmdb('/discover/movie', {
        language: 'ko-KR',
        region: 'KR',
        watch_region: 'KR',
        with_watch_providers: provider.provider_id,
        with_watch_monetization_types: 'flatrate',
        include_adult: false,
        include_video: false,
        sort_by: 'popularity.desc',
        page: 1,
      });
      return { provider, results: data.results || [] };
    }));

    const byId = new Map();
    for (const page of pages) {
      for (const movie of page.results) {
        const row = movieRow(movie, page.provider);
        const existing = byId.get(row.id);
        if (!existing) byId.set(row.id, row);
        else if (!existing.providers.some((provider) => provider.id === page.provider.provider_id)) existing.providers.push(row.providers[0]);
      }
    }
    const results = [...byId.values()]
      .sort((a, b) => Number(b.popularity || 0) - Number(a.popularity || 0) || Number(b.voteCount || 0) - Number(a.voteCount || 0))
      .slice(0, 42);

    return json({
      results,
      matchedProviders: chosen.map((provider) => ({ id: provider.provider_id, name: provider.provider_name, logoUrl: imageUrl(provider.logo_path, 'w92') })),
    }, 200, 'public, max-age=0, s-maxage=3600, stale-while-revalidate=21600');
  } catch (error) {
    console.error('my-streaming:', error.message);
    return json({ error: error.message || 'Streaming discovery failed.' }, error.status || 500);
  }
};

export const config = { path: '/api/my-streaming', method: 'GET',
  rateLimit: { action: 'rate_limit', aggregateBy: ['ip'], windowSize: 60, windowLimit: 25 }
};
