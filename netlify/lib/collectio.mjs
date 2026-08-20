const COLLECTIO_SEARCH = 'https://collectio.co.kr/main/search.jsp';
const CACHE_TTL = 12 * 60 * 60 * 1000;
const REQUEST_TIMEOUT = 4500;
const cache = new Map();

function normalizeTitle(value) {
  return String(value || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/&amp;/g, '&')
    .replace(/[^0-9a-z가-힣]+/g, '');
}

function decodeHtml(value) {
  return String(value || '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

export function parseCollectioSearchHtml(html = '') {
  const text = decodeHtml(String(html))
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '\n')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?(?:div|p|li|article|section|h\d|a|span)\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ');

  const rows = [];
  const seen = new Set();
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/\s+/g, ' ').trim();
    if (!line.includes('｜') && !/\s\|\s/.test(line)) continue;
    const parts = line.split(/\s*[｜]\s*|\s+\|\s+/).map((part) => part.trim()).filter(Boolean);
    if (parts.length < 3) continue;
    const yearIndex = parts.findIndex((part, index) => index > 0 && /^(?:18|19|20)\d{2}$/.test(part));
    if (yearIndex < 1) continue;
    const title = parts[0];
    const year = parts[yearIndex];
    const creator = parts.slice(1, yearIndex).join(' · ');
    if (!title || !year) continue;
    const key = `${normalizeTitle(title)}:${year}`;
    if (!normalizeTitle(title) || seen.has(key)) continue;
    seen.add(key);
    rows.push({ title, creator, year });
  }
  return rows;
}

export function findCollectioMatch(rows, { title, originalTitle, year } = {}) {
  const wanted = new Set([title, originalTitle].map(normalizeTitle).filter(Boolean));
  const targetYear = String(year || '').slice(0, 4);
  if (!wanted.size) return null;
  return (rows || []).find((row) => {
    if (!wanted.has(normalizeTitle(row.title))) return false;
    if (targetYear && row.year && row.year !== targetYear) return false;
    return true;
  }) || null;
}

async function fetchSearch(query) {
  const normalized = normalizeTitle(query);
  if (!normalized) return { url: null, rows: [], checkedAt: null };
  const hit = cache.get(normalized);
  if (hit?.expiresAt > Date.now()) return hit.value;

  const url = new URL(COLLECTIO_SEARCH);
  url.searchParams.set('q', query);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
  try {
    const response = await fetch(url, {
      headers: {
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.6',
        'User-Agent': 'KINOSIS availability verifier/0.4.5.8',
      },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Collectio search failed (${response.status})`);
    const html = await response.text();
    const value = { url: url.toString(), rows: parseCollectioSearchHtml(html), checkedAt: new Date().toISOString() };
    cache.set(normalized, { value, expiresAt: Date.now() + CACHE_TTL });
    return value;
  } finally {
    clearTimeout(timer);
  }
}

export async function collectioAvailability({ title, originalTitle, year } = {}) {
  const queries = [...new Set([title, originalTitle].map((value) => String(value || '').trim()).filter(Boolean))];
  for (const query of queries) {
    try {
      const result = await fetchSearch(query);
      const match = findCollectioMatch(result.rows, { title, originalTitle, year });
      if (!match) continue;
      return {
        provider: {
          id: 'collectio-official',
          name: 'Collectio',
          type: 'subscription',
          displayPriority: 2,
          source: 'collectio-official',
          confidence: 'verified',
          verifiedAt: result.checkedAt,
          sourceUrl: result.url,
        },
        checkedAt: result.checkedAt,
        sourceUrl: result.url,
        match,
      };
    } catch (error) {
      // Collectio is a supplementary verifier. A timeout or markup change must not
      // break the movie page or erase other availability information.
      console.warn('collectio availability:', error?.message || error);
    }
  }
  return null;
}
