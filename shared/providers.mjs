export const PROVIDER_DATA = Object.freeze({
  version: '0.4.6.6',
  items: [
    { key: 'Netflix', label: 'Netflix', aliases: ['Netflix', 'Netflix Standard with Ads'], prefixes: ['netflix'], logoOverride: 'https://www.netflix.com/favicon.ico', logoKind: 'mark', source: 'Netflix first-party site icon' },
    { key: 'TVING', label: 'TVING', aliases: ['TVING'] },
    { key: 'Coupang Play', label: 'Coupang Play', aliases: ['Coupang Play'], logoOverride: 'https://www.coupangplay.com/favicon.ico', logoKind: 'mark', source: 'Coupang Play first-party site icon' },
    { key: 'Disney+', label: 'Disney+', aliases: ['Disney Plus', 'Disney+'], prefixes: ['disneyplus', 'disney'], logoOverride: 'https://www.disneyplus.com/favicon.ico', logoKind: 'mark', source: 'Disney+ first-party site icon' },
    { key: 'WATCHA', label: 'WATCHA', aliases: ['Watcha', 'WATCHA'], prefixes: ['watcha'], logoOverride: 'https://watcha.com/favicon.ico', logoKind: 'mark', source: 'WATCHA official first-party site icon; BI cross-checked' },
    { key: 'Wavve', label: 'Wavve', aliases: ['wavve', 'Wavve'], prefixes: ['wavve'] },
    { key: 'Apple TV Plus', label: 'Apple TV+', aliases: ['Apple TV Plus', 'Apple TV+'], logoOverride: 'https://www.apple.com/favicon.ico', logoKind: 'mark', source: 'Apple first-party site icon' },
    { key: 'Amazon Prime Video', label: 'Prime Video', aliases: ['Amazon Prime Video', 'Prime Video'], logoOverride: 'https://www.primevideo.com/favicon.ico', logoKind: 'mark', source: 'Prime Video first-party site icon' },
    { key: 'Google Play Movies', label: 'Google Play', aliases: ['Google Play Movies', 'Google Play'] },
    { key: 'YouTube', label: 'YouTube', aliases: ['YouTube', 'Youtube', 'YouTube Movies'], prefixes: ['youtube'], logoOverride: 'https://www.youtube.com/favicon.ico', logoKind: 'mark', source: 'YouTube first-party site icon' },
    { key: 'Collectio', label: '콜렉티오', aliases: ['Collectio', 'COLLECTIO', '콜렉티오'], logoOverride: 'https://collectio.co.kr/favicon.ico', logoKind: 'mark', source: 'Collectio first-party site icon + official catalogue verifier' }
  ]
});

export function normalizeProviderName(value) {
  return String(value || '').normalize('NFKC').toLowerCase().replace(/\+/g, 'plus').replace(/[^a-z0-9가-힣]+/g, '');
}

export function providerDefinition(value) {
  const needle = normalizeProviderName(value);
  if (!needle) return null;
  for (const item of PROVIDER_DATA.items) {
    const aliases = [item.key, item.label, ...(item.aliases || [])].map(normalizeProviderName);
    if (aliases.includes(needle)) return item;
    if ((item.prefixes || []).some((prefix) => needle.startsWith(normalizeProviderName(prefix)))) return item;
  }
  return null;
}

export function providerMatches(requested, providerName) {
  const requestDef = providerDefinition(requested);
  const providerDef = providerDefinition(providerName);
  if (requestDef && providerDef) return requestDef.key === providerDef.key;
  const a = normalizeProviderName(requested);
  const b = normalizeProviderName(providerName);
  return !!a && !!b && a === b;
}
