import { imageUrl, json, normalizeProviderResults, tmdb } from '../lib/tmdb.mjs';

export default async (request) => {
  if (request.method !== 'GET') return json({ error: 'Method not allowed.' }, 405);
  const url = new URL(request.url);
  const id = (url.searchParams.get('id') || '').trim();
  if (!/^\d+$/.test(id)) return json({ error: 'Invalid movie ID.' }, 400);

  try {
    const [detail, credits, externalIds, providerPayload, keywordsPayload, releasePayload] = await Promise.all([
      tmdb(`/movie/${id}`, { language: 'ko-KR' }),
      tmdb(`/movie/${id}/credits`, { language: 'ko-KR' }).catch(() => ({ crew: [], cast: [] })),
      tmdb(`/movie/${id}/external_ids`).catch(() => ({})),
      tmdb(`/movie/${id}/watch/providers`).catch(() => ({ results: {} })),
      tmdb(`/movie/${id}/keywords`).catch(() => ({ keywords: [] })),
      tmdb(`/movie/${id}/release_dates`).catch(() => ({ results: [] })),
    ]);

    const directorCredit = (credits.crew || []).find((person) => person.job === 'Director') || null;
    const director = directorCredit?.name || null;
    const krReleaseDates = (releasePayload.results || []).find((row) => row.iso_3166_1 === 'KR')?.release_dates || [];
    const theatricalDates = krReleaseDates
      .filter((row) => row.type === 2 || row.type === 3)
      .map((row) => row.release_date)
      .filter(Boolean)
      .sort();
    const theatricalReleaseDate = theatricalDates[0] || null;
    const releaseTime = theatricalReleaseDate ? Date.parse(theatricalReleaseDate) : 0;
    const now = Date.now();
    const theatricalStatus = releaseTime
      ? (releaseTime <= now + 86400000 && releaseTime >= now - 90 * 86400000 ? 'now' : releaseTime > now ? 'upcoming' : 'past')
      : null;
    const { providers, watchLink } = normalizeProviderResults(providerPayload, 'KR');

    return json({
      id: String(detail.id),
      title: detail.title || detail.original_title || 'Untitled',
      originalTitle: detail.original_title || '',
      releaseDate: theatricalReleaseDate || detail.release_date || null,
      year: (theatricalReleaseDate || detail.release_date || '').slice(0, 4) || null,
      runtime: detail.runtime || null,
      overview: detail.overview || '',
      tagline: detail.tagline || '',
      voteAverage: detail.vote_average ?? null,
      voteCount: detail.vote_count ?? 0,
      director,
      directorId: directorCredit?.id || null,
      cast: (credits.cast || []).slice(0, 12).map((person) => ({ id: person.id, name: person.name, character: person.character || '' })),
      genres: (detail.genres || []).map((genre) => ({ id: genre.id, name: genre.name })),
      productionCountries: (detail.production_countries || []).map((country) => country.name).filter(Boolean),
      originalLanguage: detail.original_language || null,
      theatricalStatus,
      theatricalReleaseDate,
      keywords: (keywordsPayload.keywords || keywordsPayload.results || []).map((keyword) => keyword.name).filter(Boolean),
      productionCompanies: (detail.production_companies || []).map((company) => company.name).filter(Boolean),
      posterUrl: imageUrl(detail.poster_path, 'w500'),
      backdropUrl: imageUrl(detail.backdrop_path, 'w1280'),
      heroBackdropUrl: imageUrl(detail.backdrop_path, 'w1280'),
      imdbId: externalIds.imdb_id || null,
      providers,
      watchLink,
    }, 200, 'public, max-age=0, s-maxage=21600, stale-while-revalidate=86400');
  } catch (error) {
    console.error('movie-detail:', error.message);
    return json({ error: error.message || 'Movie detail failed.' }, error.status || 500);
  }
};

export const config = {
  path: '/api/movie-detail',
  method: 'GET',
};
