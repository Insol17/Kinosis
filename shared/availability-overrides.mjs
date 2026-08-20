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
        Object.freeze({ id: 'kinosis-watcha', name: 'WATCHA', type: 'subscription', displayPriority: 1, source: 'kinosis-verified', confidence: 'verified', verifiedAt: '2026-08-20T00:00:00+09:00' }),
        Object.freeze({ id: 'kinosis-youtube-rent', name: 'YouTube', type: 'rent', displayPriority: 20, source: 'kinosis-verified', confidence: 'verified', verifiedAt: '2026-08-20T00:00:00+09:00' }),
        Object.freeze({ id: 'kinosis-youtube-buy', name: 'YouTube', type: 'buy', displayPriority: 21, source: 'kinosis-verified', confidence: 'verified', verifiedAt: '2026-08-20T00:00:00+09:00' }),
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
  const indexByKey = new Map();
  for (const provider of [...(value.providers || []), ...(override.providers || [])]) {
    const key = providerKey(provider);
    if (!key) continue;
    const existingIndex = indexByKey.get(key);
    if (existingIndex == null) {
      indexByKey.set(key, merged.length);
      merged.push({ ...provider });
      continue;
    }
    // A verified correction must be allowed to upgrade a stale aggregator row
    // for the same provider + monetization type instead of being discarded.
    const existing = merged[existingIndex];
    if (provider.confidence === 'verified' || provider.source === 'kinosis-verified') {
      merged[existingIndex] = { ...existing, ...provider };
    }
  }
  return {
    ...value,
    providers: merged,
    theatricalStatus: override.theatricalStatus ?? value.theatricalStatus ?? null,
    availabilityVerifiedAt: override.verifiedAt || value.availabilityVerifiedAt || null,
    availabilitySources: [...new Set([...(value.availabilitySources || []), 'kinosis-verified'])],
  };
}
