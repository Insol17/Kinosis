(function () {
  'use strict';
  const DATA = window.KINOSIS_PROVIDER_DATA || { items: [] };
  const items = Array.isArray(DATA.items) ? DATA.items.map((item) => ({ ...item })) : [];

  function normalize(value) {
    return String(value || '')
      .normalize('NFKC')
      .toLocaleLowerCase('ko-KR')
      .replace(/\+/g, 'plus')
      .replace(/[^a-z0-9가-힣]+/g, '');
  }

  function configFor(value) {
    const name = typeof value === 'object' ? value?.name : value;
    const normalized = normalize(name);
    return items.find((provider) => [provider.key, provider.label, ...(provider.aliases || [])]
      .some((alias) => normalize(alias) === normalized)
      || (provider.prefixes || []).some((prefix) => normalized.startsWith(normalize(prefix)))) || null;
  }

  function canonicalKey(value) {
    const config = configFor(value);
    return config?.key || (typeof value === 'object' ? value?.name || value?.id : value) || '';
  }

  function label(value) {
    const config = configFor(value);
    return config?.label || (typeof value === 'object' ? value?.name : value) || 'OTT';
  }

  function logo(value) {
    const config = configFor(value);
    const source = typeof value === 'object' ? value : null;
    return {
      url: config?.logoOverride || source?.logoUrl || null,
      kind: config?.logoKind || 'tile',
      source: config?.source || (source?.logoUrl ? 'TMDB / JustWatch' : null),
    };
  }

  function consolidate(rows) {
    const priority = { subscription: 0, free: 1, ads: 2, rent: 3, buy: 4 };
    const map = new Map();
    for (const provider of [...(rows || [])].sort((a, b) => (priority[a.type] ?? 9) - (priority[b.type] ?? 9))) {
      const config = configFor(provider);
      const key = normalize(config?.key || provider.name || provider.id);
      if (!key) continue;
      const current = map.get(key) || { ...provider, key: config?.key || provider.name, label: config?.label || provider.name, types: [] };
      if (!current.types.includes(provider.type)) current.types.push(provider.type);
      if (!current.logoUrl && provider.logoUrl) current.logoUrl = provider.logoUrl;
      const mark = logo({ ...provider, logoUrl: current.logoUrl });
      current.logoResolved = mark.url;
      current.logoKind = mark.kind;
      map.set(key, current);
    }
    return [...map.values()];
  }

  function catalogLogo(key, movies) {
    const normalized = normalize(key);
    for (const movie of movies || []) {
      for (const provider of movie.providers || []) {
        if (normalize(canonicalKey(provider)) !== normalized) continue;
        const mark = logo(provider);
        if (mark.url) return mark;
      }
    }
    const config = configFor(key);
    return config?.logoOverride ? { url: config.logoOverride, kind: config.logoKind || 'tile', source: config.source || null } : { url: null, kind: 'tile', source: null };
  }

  window.KINOSIS_PROVIDERS = Object.freeze({
    all: () => items.map((item) => ({ ...item })),
    normalize,
    configFor,
    canonicalKey,
    label,
    logo,
    consolidate,
    catalogLogo,
    version: DATA.version || 'unknown',
  });
})();
