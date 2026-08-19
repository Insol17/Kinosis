export const PROVIDER_DATA = Object.freeze({
  version: '0.4.4.7',
  items: [
    { key: 'Netflix', label: 'Netflix', aliases: ['Netflix', 'Netflix Standard with Ads'], prefixes: ['netflix'] },
    { key: 'TVING', label: 'TVING', aliases: ['TVING'] },
    { key: 'Coupang Play', label: 'Coupang Play', aliases: ['Coupang Play'] },
    { key: 'Disney+', label: 'Disney+', aliases: ['Disney Plus', 'Disney+'], prefixes: ['disneyplus', 'disney'] },
    { key: 'WATCHA', label: 'WATCHA', aliases: ['Watcha', 'WATCHA'], prefixes: ['watcha'], logoOverride: './assets/branding/providers/watcha-logo-white.png', logoKind: 'wordmark', source: 'WATCHA official media kit' },
    { key: 'Wavve', label: 'Wavve', aliases: ['wavve', 'Wavve'], prefixes: ['wavve'] },
    { key: 'Apple TV Plus', label: 'Apple TV+', aliases: ['Apple TV Plus', 'Apple TV+'] },
    { key: 'Amazon Prime Video', label: 'Prime Video', aliases: ['Amazon Prime Video', 'Prime Video'] },
    { key: 'Google Play Movies', label: 'Google Play', aliases: ['Google Play Movies', 'Google Play'] },
    { key: 'Collectio', label: '콜렉티오', aliases: ['Collectio', 'COLLECTIO', '콜렉티오'], manualOnly: true }
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
