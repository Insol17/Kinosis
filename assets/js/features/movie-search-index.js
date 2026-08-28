/**
 * Immutable in-memory search index for instant client-side movie lookup.
 * Expensive normalization is paid once at construction time, not on every keypress.
 */
/** @param {any[]} records @param {{normalizeText:(value:any)=>string, genreNames?:(record:any)=>string[]}} options */
export function createMovieSearchIndex(records = [], options) {
  const { normalizeText, genreNames = () => [] } = options || /** @type {any} */ ({});
  if (typeof normalizeText !== 'function') throw new TypeError('normalizeText is required');
  const rows = (records || []).filter(Boolean).map((record) => {
    const title = normalizeText(record.title);
    const original = normalizeText(record.originalTitle);
    const director = normalizeText(record.director);
    const genres = (genreNames(record) || []).map(normalizeText).filter(Boolean);
    const cast = (record.cast || []).map((person) => normalizeText(person?.name || person)).filter(Boolean);
    const haystack = [title, original, director, ...genres, ...cast].filter(Boolean).join(' ');
    return { record, title, original, director, genres, haystack };
  });

  function scoreIndexed(row, needle) {
    let score = 0;
    if (row.title === needle || row.original === needle) score += 1200;
    if (row.title.startsWith(needle) || row.original.startsWith(needle)) score += 380;
    if (row.title.includes(needle) || row.original.includes(needle)) score += 170;
    if (row.director === needle) score += 150;
    else if (row.director.includes(needle)) score += 65;
    if (row.genres.some((genre) => genre === needle)) score += 95;
    const record = row.record;
    score += Math.min(30, Math.log10(Math.max(1, Number(record.voteCount || 0))) * 6);
    score += Math.min(20, Number(record.popularity || 0) / 50);
    return score;
  }

  function search(query, limit = 30) {
    const needle = normalizeText(query);
    if (!needle) return [];
    const matches = [];
    for (const row of rows) {
      if (!row.haystack.includes(needle)) continue;
      matches.push({ record: row.record, score: scoreIndexed(row, needle) });
    }
    matches.sort((a, b) => b.score - a.score);
    return matches.slice(0, Math.max(1, limit)).map((row) => row.record);
  }

  return Object.freeze({ search, size: rows.length });
}
