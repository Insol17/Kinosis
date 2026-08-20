/** Discovery surface allocation and ranking. */

export function weightedRating(record, { mean = 7, confidence = 1500 } = {}) {
  const rating = Number(record?.voteAverage || 0);
  const votes = Math.max(0, Number(record?.voteCount || 0));
  if (!rating) return 0;
  return (votes / (votes + confidence)) * rating + (confidence / (votes + confidence)) * mean;
}

export function rankWeighted(rows = [], { confidence = 1500 } = {}) {
  const valid = rows.filter((row) => Number(row?.voteAverage || 0) > 0);
  const mean = valid.length ? valid.reduce((sum, row) => sum + Number(row.voteAverage || 0), 0) / valid.length : 7;
  return [...valid].sort((a, b) => weightedRating(b, { mean, confidence }) - weightedRating(a, { mean, confidence }) || Number(b.voteCount || 0) - Number(a.voteCount || 0));
}

export function excludeMovieIds(rows = [], ids = new Set()) {
  const excluded = ids instanceof Set ? ids : new Set(Array.from(ids || [], String));
  return rows.filter((row) => row?.id != null && !excluded.has(String(row.id)));
}

/**
 * Pick a deliberately varied Discover hero instead of slicing one popularity pool.
 * Each source gets a turn, so the first viewport does not become four copies of
 * the current box-office rail.
 */
export function selectDiscoverHeroMovies({ featured = [], boxOffice = [], upcoming = [], rated = [] } = {}, limit = 4) {
  const sources = [featured, boxOffice, upcoming, rankWeighted(rated)];
  const used = new Set();
  const result = [];
  for (const source of sources) {
    const next = (source || []).find((row) => row?.id != null && !used.has(String(row.id)));
    if (!next) continue;
    used.add(String(next.id));
    result.push(next);
    if (result.length >= limit) return result;
  }
  const remainder = sources.flat();
  for (const row of remainder) {
    if (row?.id == null || used.has(String(row.id))) continue;
    used.add(String(row.id));
    result.push(row);
    if (result.length >= limit) break;
  }
  return result;
}

/** Allocate each rail from a shared inventory so adjacent surfaces feel broad. */
export function allocateSections({ heroMovieIds = [], boxOffice = [], upcoming = [], streaming = [], rated = [] }, limits = {}) {
  const used = new Set(Array.from(heroMovieIds || [], String));
  const take = (rows, limit = 14) => {
    const out = excludeMovieIds(rows, used).slice(0, limit);
    out.forEach((row) => used.add(String(row.id)));
    return out;
  };
  const box = take(boxOffice, limits.boxOffice || 14);
  const up = take(upcoming, limits.upcoming || 14);
  const stream = take(streaming, limits.streaming || 14);
  const high = take(rankWeighted(rated), limits.rated || 14);
  return { boxOffice: box, upcoming: up, streaming: stream, rated: high };
}
