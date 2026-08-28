/**
 * Profile avatar candidates are derived only from movie metadata already present
 * in the browser cache/catalogue. No dedicated avatar/search API is used.
 */
export function collectProfileAvatarCandidates(movies = []) {
  const seen = new Set();
  const rows = [];
  for (const movie of movies || []) {
    for (const person of movie?.cast || []) {
      const url = String(person?.profileUrl || '').trim();
      if (!url) continue;
      const personId = String(person?.id || '').trim();
      const key = personId || url;
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push({
        id: key,
        personId,
        url,
        name: String(person?.name || '').trim(),
        character: String(person?.character || '').trim(),
        movieId: String(movie?.id || '').trim(),
        movieTitle: String(movie?.title || '').trim(),
      });
    }
  }
  return rows;
}

export function searchProfileAvatarCandidates(candidates = [], query = '', normalize = (value) => String(value || '').toLowerCase()) {
  const needle = normalize(query);
  if (!needle) return candidates.slice(0, 24);
  return candidates.filter((item) => normalize([item.character, item.name, item.movieTitle].filter(Boolean).join(' ')).includes(needle)).slice(0, 36);
}
