/**
 * KINOSIS contextual movie card.
 *
 * A Movie Entity is shared across the product, but each surface answers a
 * different user question. Discover/Arthouse emphasize identification,
 * Library emphasizes the user's current relationship, and MY emphasizes the
 * viewing history. Keeping that policy here prevents every surface from
 * accumulating its own incompatible card markup.
 */
export function renderMovieCard(record, variant, c) {
  if (!record) return '';
  const relationship = c.relationship(record.id);
  const libraryCard = variant === 'library';
  const myCard = variant === 'my';
  const arthouseCard = variant === 'arthouse';
  const loading = !!record.metadataLoading;
  const posterUrl = c.poster(record);
  const logs = c.logsForMovie(record.id);
  const collections = c.collectionsForMovie(record.id);
  const access = c.accessLabel(record);

  const media = loading
    ? `<div class="poster-loading" aria-label="영화 정보를 불러오는 중"><span class="loading-ring mini"></span><small>LOADING</small></div>`
    : posterUrl
      ? `<div class="poster-fallback is-visible">${c.escapeHtml(record.title || '포스터 없음')}</div><img data-poster-image src="${c.escapeHtml(posterUrl)}" alt="${c.escapeHtml(record.title)} 포스터" loading="lazy">`
      : `<div class="poster-fallback is-visible">${c.escapeHtml(record.title || '포스터 없음')}</div>`;

  const personalMeta = loading ? '' : [
    relationship?.rating != null ? `<span class="film-object-rating">★ ${Number(relationship.rating).toFixed(1)}</span>` : '',
    logs.length ? `<span>${logs.length}회 감상</span>` : '',
  ].filter(Boolean).join('<span class="film-object-dot">·</span>');

  const libraryContext = libraryCard && !loading
    ? `<div class="film-object-context">
        <div class="film-object-primary">${personalMeta || '<span class="film-object-muted">아직 평가·감상 기록 없음</span>'}</div>
        <div class="film-object-secondary">${access ? `<span class="film-object-access">${c.escapeHtml(access)}</span>` : ''}${collections.length ? `<span class="film-object-collection">${c.escapeHtml(collections[0].name)}${collections.length > 1 ? ` +${collections.length - 1}` : ''}</span>` : ''}</div>
      </div>`
    : '';

  const myContext = myCard && !loading
    ? `<div class="film-object-context is-my"><div class="film-object-primary">${personalMeta || '<span class="film-object-muted">감상 기록</span>'}</div>${logs[0]?.watchedAt ? `<div class="film-object-secondary"><span>${c.escapeHtml(c.formatDate(logs[0].watchedAt))}</span>${relationship?.comment ? '<span>한줄평 있음</span>' : ''}</div>` : ''}</div>`
    : '';

  const standardMeta = !libraryCard && !myCard
    ? `<div class="card-meta"><span>${loading ? '동기화 중…' : (record.year || '—')}</span>${!loading && c.availableOnMine(record) ? '<span class="mine-dot"></span><span>내 구독</span>' : ''}</div>`
    : '';

  return `<article class="movie-card ${libraryCard ? 'library-movie-card' : ''} ${myCard ? 'my-movie-card' : ''} ${arthouseCard ? 'arthouse-movie-card' : ''} ${loading ? 'is-metadata-loading' : ''}" data-movie="${c.escapeHtml(record.id)}" tabindex="0" aria-label="${c.escapeHtml(loading ? '영화 정보 불러오는 중' : `${record.title} 상세보기`)}">
    <div class="poster-wrap">
      ${media}
      ${!loading ? c.availabilityBadges(record) : ''}
      <div class="card-overlay">${c.signedIn() && !loading ? `<div class="quick-actions"><button class="tiny-button ${relationship?.watchlist ? 'is-active' : 'accent'}" data-action="watchlist" data-id="${c.escapeHtml(record.id)}" aria-label="${relationship?.watchlist ? '보고싶어요 해제' : '보고싶어요 추가'}">${relationship?.watchlist ? '✓' : '＋'}</button><button class="tiny-button" data-action="log" data-id="${c.escapeHtml(record.id)}">감상 기록</button>${libraryCard ? `<button class="tiny-button is-danger-soft" data-remove-library="${c.escapeHtml(record.id)}">제거</button>` : ''}</div>` : ''}</div>
    </div>
    <div class="card-info"><p class="card-title">${c.escapeHtml(record.title)}</p>${standardMeta}${libraryContext}${myContext}</div>
  </article>`;
}
