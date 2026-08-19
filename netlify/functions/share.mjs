import { imageUrl, tmdb } from '../lib/tmdb.mjs';
import { KINOSIS_LOCALE } from '../lib/locale.mjs';

const esc = (value) => String(value || '').replace(/[&<>"']/g, (char) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[char]));

function html({ title, description, image, landingUrl }) {
  const safeTitle = esc(title || 'KINOSIS');
  const safeDescription = esc(description || '영화를 발견하고, 보고, 기록하고, 다시 꺼내보는 영화 라이브러리.');
  const safeImage = esc(image || '');
  const safeLanding = esc(landingUrl);
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${safeTitle} — KINOSIS</title><meta name="description" content="${safeDescription}"><meta property="og:type" content="website"><meta property="og:site_name" content="KINOSIS"><meta property="og:title" content="${safeTitle}"><meta property="og:description" content="${safeDescription}">${safeImage ? `<meta property="og:image" content="${safeImage}">` : ''}<meta property="og:url" content="${safeLanding}"><meta name="twitter:card" content="summary_large_image"><meta http-equiv="refresh" content="0;url=${safeLanding}"><link rel="canonical" href="${safeLanding}"></head><body><p><a href="${safeLanding}">KINOSIS에서 보기</a></p><script>location.replace(${JSON.stringify(landingUrl)})</script></body></html>`;
}

export default async (request) => {
  if (request.method !== 'GET') return new Response('Method not allowed.', { status: 405 });
  const url = new URL(request.url);
  const movieId = (url.searchParams.get('movie') || '').trim();
  const curation = (url.searchParams.get('curation') || '').trim();
  const origin = url.origin;

  try {
    if (/^\d+$/.test(movieId)) {
      const detail = await tmdb(`/movie/${movieId}`, { language: KINOSIS_LOCALE.language });
      const landing = new URL('/', origin); landing.searchParams.set('movie', movieId);
      return new Response(html({
        title: detail.title || detail.original_title || '영화',
        description: [String(detail.release_date || '').slice(0,4), detail.overview || 'KINOSIS에서 영화 정보와 감상처를 확인하세요.'].filter(Boolean).join(' · ').slice(0, 260),
        image: imageUrl(detail.backdrop_path || detail.poster_path, detail.backdrop_path ? 'w1280' : 'w780'),
        landingUrl: landing.href,
      }), { headers: { 'Content-Type':'text/html; charset=utf-8', 'Cache-Control':'public, max-age=0, s-maxage=21600, stale-while-revalidate=86400', 'X-Content-Type-Options':'nosniff' } });
    }

    if (/^[a-z0-9][a-z0-9-]{1,62}$/.test(curation)) {
      const landing = new URL('/', origin); landing.searchParams.set('curation', curation);
      const title = (url.searchParams.get('title') || 'KINOSIS Curation').slice(0, 120);
      const description = (url.searchParams.get('description') || 'KINOSIS의 영화 큐레이션을 확인하세요.').slice(0, 260);
      const image = (url.searchParams.get('image') || '').slice(0, 600);
      return new Response(html({ title, description, image, landingUrl: landing.href }), { headers: { 'Content-Type':'text/html; charset=utf-8', 'Cache-Control':'public, max-age=0, s-maxage=21600, stale-while-revalidate=86400', 'X-Content-Type-Options':'nosniff' } });
    }
    return new Response('Invalid share target.', { status: 400 });
  } catch (error) {
    console.error('share:', error.message);
    return new Response('Share preview unavailable.', { status: 502 });
  }
};

export const config = { path: '/share', method: 'GET', rateLimit: { action: 'rate_limit', aggregateBy: ['ip'], windowSize: 60, windowLimit: 100 } };
