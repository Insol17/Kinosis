export const DISCOVER_GENRES = Object.freeze([
  ['공포', 'HORROR'], ['코미디', 'COMEDY'], ['SF', 'SCIENCE FICTION'], ['로맨스', 'ROMANCE'],
  ['드라마', 'DRAMA'], ['액션', 'ACTION'], ['스릴러', 'THRILLER'], ['범죄', 'CRIME'],
  ['애니메이션', 'ANIMATION'], ['다큐멘터리', 'DOCUMENTARY'], ['판타지', 'FANTASY'], ['모험', 'ADVENTURE'],
  ['가족', 'FAMILY'], ['역사', 'HISTORY'], ['음악', 'MUSIC'], ['미스터리', 'MYSTERY'],
  ['전쟁', 'WAR'], ['서부', 'WESTERN'],
]);

export function watchNowProviderKeys(records = [], subscriptions = [], { canonicalKey = (value) => value, isVerified = (_value) => false } = {}) {
  const enabled = new Set((subscriptions || []).map((value) => String(canonicalKey(value) || value)));
  const keys = [];
  for (const record of records || []) {
    for (const provider of record?.providers || []) {
      if (provider?.type !== 'subscription' || !isVerified(provider)) continue;
      const key = String(canonicalKey(provider) || provider?.name || '');
      if (key && enabled.has(key) && !keys.includes(key)) keys.push(key);
    }
  }
  return keys;
}

export function moviesForProvider(records = [], providerKey = '', { canonicalKey = (value) => value, isVerified = (_value) => false } = {}) {
  const target = String(canonicalKey(providerKey) || providerKey);
  return (records || []).filter((record) => (record?.providers || []).some((provider) => provider?.type === 'subscription' && isVerified(provider) && String(canonicalKey(provider) || provider?.name || '') === target));
}
