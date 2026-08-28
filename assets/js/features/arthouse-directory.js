/**
 * Pure Arthouse directory renderers.
 * This module owns presentation policy for Curation/Director indexes only.
 * It has no DOM, network, or application-state side effects.
 */

export const ARTHOUSE_PREVIEW_DIRECTOR_COUNT = 35;
export const ARTHOUSE_PREVIEW_CURATION_COUNT = 3;

export function groupDirectors(entries = []) {
  const groups = new Map();
  for (const entry of entries || []) {
    const key = entry?.group || '기타';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(entry);
  }
  return [...groups.entries()].map(([name, directors]) => ({ name, directors }));
}

export function renderCurationBanner({ item, image = '', filmCount = 0, escapeHtml }) {
  return `<button class="arthouse-curation-banner" data-curation="${escapeHtml(item.slug)}" aria-label="${escapeHtml(item.title)} 큐레이션 보기">
    <span class="arthouse-curation-banner-media">${image ? `<img src="${escapeHtml(image)}" alt="" loading="lazy">` : ''}<span class="arthouse-curation-banner-shade"></span></span>
    <span class="arthouse-curation-banner-copy"><small>KINOSIS CURATION</small><b>${escapeHtml(item.title)}</b>${item.subtitle ? `<em>${escapeHtml(item.subtitle)}</em>` : ''}${item.description ? `<span>${escapeHtml(item.description)}</span>` : ''}<strong>VIEW CURATION →</strong></span>
  </button>`;
}

export function renderCurationPreview({ items = [], renderBanner, allCount = 0 }) {
  if (!items.length) return '';
  return `<section class="arthouse-curation-index is-preview"><div class="section-head arthouse-index-head"><div><p class="editorial-kicker">CURATIONS</p><h2>큐레이션</h2><p>영화를 장르가 아니라 하나의 관점과 문장으로 다시 엮습니다.</p></div>${allCount > items.length ? '<button class="section-action" data-arthouse-section="curations">전체 보기 →</button>' : ''}</div><div class="arthouse-curation-banner-list">${items.map(renderBanner).join('')}</div></section>`;
}

export function renderCurationDirectory({ items = [], renderBanner }) {
  return `<section class="arthouse-directory-page arthouse-curation-directory"><header class="arthouse-directory-head"><div><p class="editorial-kicker">ARTHOUSE / CURATION</p><h1>CURATION</h1><p>주제와 관점으로 구성한 KINOSIS의 영화 기획전 전체 목록입니다.</p></div><button class="section-action" data-arthouse-section="overview">← Arthouse</button></header><div class="arthouse-curation-banner-list is-all">${items.map(renderBanner).join('')}</div></section>`;
}

export function renderDirectorCard({ entry, profile = null, escapeHtml }) {
  const profileUrl = profile?.profileUrl || entry?.profileUrl || '';
  const personId = profile?.personId || entry?.personId || '';
  const fallback = String(entry?.displayName || entry?.name || '?').trim().slice(0, 1);
  return `<button class="director-index-card ${profileUrl ? 'has-photo' : 'is-photo-loading'}" data-director-open="${escapeHtml(entry.name)}" data-director-display="${escapeHtml(entry.displayName || entry.name)}" data-director-person-id="${escapeHtml(personId)}" aria-label="${escapeHtml(entry.displayName || entry.name)} 감독 작품 보기"><span class="director-index-photo">${profileUrl ? `<img src="${escapeHtml(profileUrl)}" alt="${escapeHtml(entry.displayName || entry.name)}" loading="lazy">` : `<span class="director-photo-fallback">${escapeHtml(fallback)}</span>`}<span class="director-index-shade"></span></span><span class="director-index-copy"><b>${escapeHtml(entry.displayName || entry.name)}</b><small>${escapeHtml(entry.name)}</small></span></button>`;
}

export function renderDirectorPreview({ entries = [], renderCard, allCount = 0 }) {
  if (!entries.length) return '';
  return `<section class="arthouse-director-index is-preview"><div class="section-head director-index-head"><div><p class="editorial-kicker">DIRECTORS</p><h2>감독 아카이브</h2><p>감독을 고르면 전체 크레딧 대신 대표 장편부터 보여줍니다.</p></div>${allCount > entries.length ? '<button class="section-action" data-arthouse-section="directors">전체 보기 →</button>' : ''}</div><div class="director-index-grid">${entries.map(renderCard).join('')}</div></section>`;
}

export function renderDirectorDirectory({ entries = [], renderCard, escapeHtml = (value) => String(value ?? '') }) {
  const groups = groupDirectors(entries);
  return `<section class="arthouse-directory-page arthouse-director-directory"><header class="arthouse-directory-head"><div><p class="editorial-kicker">ARTHOUSE / DIRECTOR'S ARCHIVE</p><h1>DIRECTOR'S ARCHIVE</h1><p>지역별로 감독을 찾고, 각 감독의 대표 장편을 시작점으로 작품 세계에 들어갑니다.</p></div><button class="section-action" data-arthouse-section="overview">← Arthouse</button></header><div class="director-group-list">${groups.map(({ name, directors }) => `<section class="director-group"><header><h2>${escapeHtml(name)}</h2><span>${directors.length}명</span></header><div class="director-index-grid">${directors.map(renderCard).join('')}</div></section>`).join('')}</div></section>`;
}
