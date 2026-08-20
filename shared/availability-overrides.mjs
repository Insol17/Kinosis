/**
 * Small, explicitly verified corrections for gaps in third-party availability data.
 * These rows supplement TMDB/JustWatch; they are not a replacement for the live feed.
 * Keep this file intentionally small and timestamp every manual verification.
 */
export const AVAILABILITY_OVERRIDES = Object.freeze({
  KR: Object.freeze({
    // Eureka (2000), Shinji Aoyama — user-verified KR availability, 2026-08-20.
    '38047': Object.freeze({
      verifiedAt: '2026-08-20T00:00:00+09:00',
      theatricalStatus: 'past',
      providers: Object.freeze([
        Object.freeze({ id: 'kinosis-watcha', name: 'WATCHA', type: 'subscription', displayPriority: 1, source: 'kinosis-verified' }),
        Object.freeze({ id: 'kinosis-youtube-rent', name: 'YouTube', type: 'rent', displayPriority: 20, source: 'kinosis-verified' }),
        Object.freeze({ id: 'kinosis-youtube-buy', name: 'YouTube', type: 'buy', displayPriority: 21, source: 'kinosis-verified' }),
      ]),
    }),
  }),
});

function providerKey(provider) {
  return `${String(provider?.name || '').toLowerCase().replace(/[^a-z0-9가-힣]+/g, '')}:${provider?.type || ''}`;
}

export function applyAvailabilityOverride(movieId, region, value = {}) {
  const override = AVAILABILITY_OVERRIDES?.[region]?.[String(movieId)] || null;
  if (!override) return value;
  const merged = [];
  const seen = new Set();
  for (const provider of [...(value.providers || []), ...(override.providers || [])]) {
    const key = providerKey(provider);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    merged.push({ ...provider });
  }
  return {
    ...value,
    providers: merged,
    theatricalStatus: override.theatricalStatus ?? value.theatricalStatus ?? null,
    availabilityVerifiedAt: override.verifiedAt || value.availabilityVerifiedAt || null,
    availabilitySources: [...new Set([...(value.availabilitySources || []), 'kinosis-verified'])],
  };
}
