/**
 * Calendar representation policy.
 * A day can contain several ViewingEvents, but the month grid needs one visual
 * representative. Prefer the highest rating; ties fall back to the event that
 * was recorded most recently. `watchedAt` stores a date, not a clock time, so
 * this is deliberately latest-recorded rather than a fabricated viewing time.
 */
export function selectCalendarLead(logs, currentRatingForMovie = (_movieId) => null) {
  return [...(logs || [])].sort((a, b) => {
    const ar = a?.ratingSnapshot != null ? Number(a.ratingSnapshot) : (currentRatingForMovie(a?.movieId) ?? -1);
    const br = b?.ratingSnapshot != null ? Number(b.ratingSnapshot) : (currentRatingForMovie(b?.movieId) ?? -1);
    return Number(br) - Number(ar) || String(b?.createdAt || '').localeCompare(String(a?.createdAt || ''));
  })[0] || null;
}

export function uniqueCalendarMovieCount(logs) {
  return new Set((logs || []).map((log) => String(log?.movieId || '')).filter(Boolean)).size;
}
