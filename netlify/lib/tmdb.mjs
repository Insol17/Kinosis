import { KINOSIS_LOCALE } from './locale.mjs';
const TMDB_BASE = 'https://api.themoviedb.org/3';
const IMAGE_BASE = 'https://image.tmdb.org/t/p';

export function requireToken() {
  const token = process.env.TMDB_READ_ACCESS_TOKEN?.trim();
  if (!token) {
    const error = new Error('TMDB_READ_ACCESS_TOKEN is not configured on Netlify.');
    error.status = 500;
    throw error;
  }
  return token;
}

export function imageUrl(path, size = 'w500') {
  return path ? `${IMAGE_BASE}/${size}${path}` : null;
}

export async function tmdb(path, params = {}, { signal } = {}) {
  const token = requireToken();
  const url = new URL(`${TMDB_BASE}${path}`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
  }

  const controller = signal ? null : new AbortController();
  const timer = controller ? setTimeout(() => controller.abort(), 6500) : null;
  try {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
      signal: signal || controller?.signal,
    });

    let body = null;
    try { body = await response.json(); } catch {}
    if (!response.ok) {
      const error = new Error(body?.status_message || `TMDB request failed (${response.status})`);
      error.status = response.status === 429 ? 429 : 502;
      throw error;
    }
    return body;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function json(data, status = 200, cacheControl = 'no-store', extraHeaders = {}) {
  return Response.json(data, {
    status,
    headers: {
      'Cache-Control': cacheControl,
      'X-Content-Type-Options': 'nosniff',
      ...extraHeaders,
    },
  });
}

export function normalizeProviderResults(payload, region = KINOSIS_LOCALE.region) {
  const regionData = payload?.results?.[region];
  if (!regionData) return { providers: [], watchLink: null };
  const groups = [
    ['flatrate', 'subscription'],
    ['free', 'free'],
    ['ads', 'ads'],
    ['rent', 'rent'],
    ['buy', 'buy'],
  ];
  const seen = new Set();
  const providers = [];
  for (const [sourceKey, type] of groups) {
    for (const provider of regionData[sourceKey] || []) {
      const key = `${provider.provider_id}:${type}`;
      if (seen.has(key)) continue;
      seen.add(key);
      providers.push({
        id: provider.provider_id,
        name: provider.provider_name,
        type,
        logoUrl: imageUrl(provider.logo_path, 'w92'),
        displayPriority: provider.display_priority ?? 999,
        source: 'tmdb-justwatch',
        confidence: 'reported',
      });
    }
  }
  providers.sort((a, b) => a.displayPriority - b.displayPriority);
  return { providers, watchLink: regionData.link || null };
}
