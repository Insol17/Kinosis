/** Arthouse is programme-driven: Editorial + Director Archives. */

/**
 * Allocate at most one distinct Hero movie per programme. A programme may name
 * a preferred hero; if that film was already used, fall back to the first
 * unused movie in that programme. This keeps the Hero representative instead
 * of letting one popular title dominate several slides.
 */
export function selectProgrammeHeroes(programmes = [], moviesFor, heroFor, limit = 5) {
  const used = new Set();
  const selected = [];
  for (const programme of programmes || []) {
    const rows = moviesFor?.(programme) || [];
    const preferred = heroFor?.(programme) || null;
    const candidates = [preferred, ...rows].filter(Boolean);
    const movie = candidates.find((row) => row?.id != null && !used.has(String(row.id))) || null;
    if (movie?.id != null) used.add(String(movie.id));
    selected.push({ programme, movie });
    if (selected.length >= limit) break;
  }
  return selected;
}
