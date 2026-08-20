function signedIn(c) { return typeof c.isSignedIn === 'function' ? c.isSignedIn() : !!c.isSignedIn; }
function commentOf(relation) { return String(relation?.comment ?? relation?.review ?? '').trim(); }

function directorButton(record, c) {
  return record.directorId
    ? `<button data-person-id="${c.escapeHtml(record.directorId)}" data-person-name="${c.escapeHtml(record.director || '')}">${c.escapeHtml(record.director || '—')}</button>`
    : `<b>${c.escapeHtml(record.director || '—')}</b>`;
}

function sectionHead(eyebrow, title) {
  return `<header class="detail-section-title"><p>${eyebrow}</p><h2>${title}</h2></header>`;
}

export function renderDetailHero(record, c) {
  const relationship = c.relationship || c.entry || null;
  const membership = c.membership || null;
  const logs = c.logs || [];
  const posterUrl = c.poster(record);
  const backdropUrl = c.backdrop(record);
  const comment = commentOf(relationship);
  const director = directorButton(record, c);
  const isLoading = !!record.metadataLoading;
  const libraryAction = membership
    ? `<button data-remove-library="${c.escapeHtml(record.id)}">내 영화장에서 제거</button>`
    : `<button data-add-library="${c.escapeHtml(record.id)}">영화장에 보관</button>`;

  return `<section class="detail-hero ${backdropUrl ? '' : 'has-no-backdrop'} ${isLoading ? 'is-partial' : ''}" data-detail-part="hero">
    ${backdropUrl ? `<img class="detail-backdrop" src="${c.escapeHtml(backdropUrl)}" alt="">` : '<div class="detail-backdrop-placeholder" aria-hidden="true"></div>'}<div class="detail-backdrop-shade"></div>
    <div class="detail-hero-inner">
      ${posterUrl ? `<img class="detail-poster" data-poster-image src="${c.escapeHtml(posterUrl)}" alt="${c.escapeHtml(record.title)} 포스터">` : `<div class="detail-poster detail-poster-placeholder" aria-label="포스터 없음"><span>${isLoading ? 'LOADING' : c.escapeHtml(record.title)}</span></div>`}
      <div class="detail-intro">
        <div class="detail-badges">${Number(record.boxOfficeRank || 0) > 0 ? `<span class="detail-badge is-boxoffice">박스오피스 ${Number(record.boxOfficeRank)}위</span>` : ''}${c.releaseLabel ? `<span class="detail-badge is-cinema">${c.icon('cinema')}${c.escapeHtml(c.releaseLabel)}</span>` : ''}${c.isArt ? '<span class="detail-badge">KINOSIS ARTHOUSE</span>' : ''}${isLoading ? '<span class="detail-badge is-loading">정보 보강 중</span>' : ''}</div>
        <h1>${c.escapeHtml(record.title)}</h1>
        ${record.originalTitle && record.originalTitle !== record.title ? `<p class="detail-original">${c.escapeHtml(record.originalTitle)}</p>` : ''}
        <p class="detail-meta">${c.escapeHtml(c.titleMeta || (isLoading ? '영화 정보를 불러오는 중…' : '영화 정보'))}</p>
        ${record.director ? `<p class="detail-director">감독 ${director}</p>` : isLoading ? '<p class="detail-director detail-meta-skeleton">감독 정보 확인 중</p>' : ''}
        ${record.tagline ? `<p class="detail-tagline">${c.escapeHtml(record.tagline)}</p>` : ''}
        <div class="detail-actions"><button class="primary-button detail-action" data-action="log" data-id="${c.escapeHtml(record.id)}">${logs.length ? '감상 기록 추가' : '감상 기록'}</button><button class="detail-watchlist ${relationship?.watchlist ? 'is-active' : ''}" data-action="watchlist" data-id="${c.escapeHtml(record.id)}">${relationship?.watchlist ? '✓ 보고싶어요' : '＋ 보고싶어요'}</button>${signedIn(c) ? `<button class="detail-favorite ${relationship?.favorite ? 'is-active' : ''}" data-action="favorite" data-id="${c.escapeHtml(record.id)}">${relationship?.favorite ? '♥ 좋아요' : '♡ 좋아요'}</button>` : ''}<details class="film-more"><summary class="detail-more" aria-label="더 보기">${c.icon('more')}</summary><div class="film-more-menu">${signedIn(c) ? libraryAction : ''}<button data-action="collection-add" data-id="${c.escapeHtml(record.id)}">＋ 컬렉션에 추가</button>${relationship || logs.length || membership ? `<button class="is-danger" data-delete-personal-movie="${c.escapeHtml(record.id)}">모든 개인 데이터 삭제…</button>` : ''}</div></details></div>
      </div>
      <aside class="detail-relationship" aria-label="내 평가와 한줄평">
        <p class="detail-relationship-kicker">RATING</p>
        ${signedIn(c) ? `${c.starRatingHtml(record.id, relationship?.rating ?? null, 'detail')}<div class="detail-comment"><div class="detail-comment-head"><span>내 한줄평</span><button data-edit-relationship="${c.escapeHtml(record.id)}">${comment ? '수정' : '작성'}</button></div>${comment ? `<p>${c.escapeHtml(comment)}</p>` : '<p class="is-empty">이 영화에 대한 한줄평을 남겨보세요.</p>'}</div><div class="detail-personal-glance">${membership ? '<span>내 영화장에 보관됨</span>' : ''}${logs.length ? `<span>${logs.length}회 감상</span>` : ''}${relationship?.favorite ? '<span>좋아요</span>' : ''}</div>` : '<button class="streaming-signin compact" data-open-auth>로그인하고 내 영화로 기록하기</button>'}
      </aside>
    </div>
  </section>`;
}

export function renderDetailMetadata(record, c) {
  const genres = c.genres || [];
  const cast = c.cast || [];
  const writers = c.writers || [];
  const cinematographers = c.cinematographers || [];
  const director = directorButton(record, c);
  const head = sectionHead('FILM', '작품 정보');
  if (record.metadataLoading) {
    const slow = !!record.metadataSlow;
    return `<section class="detail-question detail-question-about" data-detail-part="metadata">${head}<div class="detail-section detail-metadata-loading ${slow ? 'is-slow' : ''}" role="status"><span class="loading-ring mini"></span><div><h3>${slow ? '작품 정보 응답이 평소보다 늦습니다.' : '작품 정보를 불러오는 중입니다.'}</h3><p>${slow ? '제목·포스터·내 기록은 먼저 사용할 수 있습니다. 8초 안에 응답이 없으면 요청을 중단합니다.' : '감독·출연·러닝타임 정보를 확인하고 있습니다.'}</p></div></div></section>`;
  }
  if (record.detailError) {
    return `<section class="detail-question detail-question-about" data-detail-part="metadata">${head}<div class="detail-section detail-metadata-error" role="status"><div><h3>일부 작품 정보를 불러오지 못했습니다.</h3><p>${c.escapeHtml(record.detailError)} 이미 확인된 제목·포스터·내 기록은 그대로 사용할 수 있습니다.</p></div><button class="secondary-button" data-detail-retry="${c.escapeHtml(record.id)}">다시 불러오기</button></div></section>`;
  }
  return `<section class="detail-question detail-question-about" data-detail-part="metadata">${head}<div class="detail-about-grid">
    <div class="detail-about-main">
      <section class="detail-section detail-synopsis"><h3>줄거리</h3><p>${c.escapeHtml(record.overview || '줄거리 정보가 없습니다.')}</p></section>
      ${cast.length ? `<section class="detail-section"><div class="detail-section-head"><h3>출연</h3><span>${record.cast?.length > cast.length ? `${record.cast.length}명 중 주요 출연진` : '주요 출연진'}</span></div><div class="detail-cast-grid">${cast.map((person) => `<button class="detail-cast-person" data-person-id="${c.escapeHtml(person.id || '')}" data-person-name="${c.escapeHtml(person.name || person)}">${person.profileUrl ? `<img src="${c.escapeHtml(person.profileUrl)}" alt="${c.escapeHtml(person.name || person)}">` : `<span class="cast-avatar-fallback">${c.escapeHtml(String(person.name || person).slice(0,1))}</span>`}<span><b>${c.escapeHtml(person.name || person)}</b><small>${c.escapeHtml(person.character || '')}</small></span></button>`).join('')}</div></section>` : ''}
    </div>
    <section class="detail-section detail-facts-section"><div class="detail-section-head"><h3>기본 정보</h3></div><dl class="detail-facts">
      ${writers.length ? `<div><dt>각본</dt><dd>${writers.map((p) => c.escapeHtml(p.name)).join(' · ')}</dd></div>` : ''}
      ${cinematographers.length ? `<div><dt>촬영</dt><dd>${cinematographers.map((p) => c.escapeHtml(p.name)).join(' · ')}</dd></div>` : ''}
      <div><dt>장르</dt><dd>${genres.map((g) => `<button data-search-query="${c.escapeHtml(g)}">${c.escapeHtml(g)}</button>`).join(' · ') || '—'}</dd></div>
      ${c.country ? `<div><dt>국가</dt><dd>${c.escapeHtml(c.country)}</dd></div>` : ''}${record.originalLanguage ? `<div><dt>언어</dt><dd>${c.escapeHtml(String(record.originalLanguage).toUpperCase())}</dd></div>` : ''}${record.releaseDate ? `<div><dt>공개일</dt><dd>${c.escapeHtml(c.formatDate(record.releaseDate))}</dd></div>` : ''}${record.runtime ? `<div><dt>러닝타임</dt><dd>${c.escapeHtml(c.fmtRuntime(record.runtime))}</dd></div>` : ''}${record.voteAverage ? `<div><dt>TMDB</dt><dd>${Number(record.voteAverage).toFixed(1)}${record.voteCount ? ` · ${Number(record.voteCount).toLocaleString()}명` : ''}</dd></div>` : ''}
    </dl></section>
  </div></section>`;
}


export function renderDetailMedia(record, c) {
  const media = c.media || { status: 'idle', trailers: [], stills: [] };
  const head = sectionHead('MEDIA', '트레일러 · 스틸');
  if (media.status === 'idle' || media.status === 'loading') {
    return `<section class="detail-question detail-question-media" data-detail-part="media">${head}<div class="detail-media-loading"><span class="loading-ring mini"></span><span>트레일러와 스틸컷을 불러오는 중입니다.</span></div></section>`;
  }
  if (media.status === 'error' && !media.trailers?.length && !media.stills?.length) {
    return `<section class="detail-question detail-question-media" data-detail-part="media">${head}<div class="detail-media-empty"><span>등록된 트레일러·스틸 정보를 불러오지 못했습니다.</span></div></section>`;
  }
  const trailer = media.trailers?.[0];
  const trailerHtml = trailer ? `<section class="detail-media-trailer"><div class="detail-section-head"><h3>트레일러</h3>${media.trailers.length > 1 ? `<span>${media.trailers.length}개 영상</span>` : ''}</div><div class="detail-trailer-frame"><iframe src="https://www.youtube-nocookie.com/embed/${c.escapeHtml(trailer.key)}" title="${c.escapeHtml(trailer.name || `${record.title} 트레일러`)}" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe></div></section>` : '';
  const stills = (media.stills || []).slice(0, 8);
  const stillHtml = stills.length ? `<section class="detail-media-stills"><div class="detail-section-head"><h3>스틸컷</h3><span>${stills.length}장</span></div><div class="detail-still-grid">${stills.map((still) => `<a href="${c.escapeHtml(still.originalUrl || still.url)}" target="_blank" rel="noopener noreferrer"><img src="${c.escapeHtml(still.url)}" alt="${c.escapeHtml(record.title)} 스틸컷" loading="lazy"></a>`).join('')}</div></section>` : '';
  return `<section class="detail-question detail-question-media" data-detail-part="media">${head}${trailerHtml || stillHtml ? `<div class="detail-media-grid">${trailerHtml}${stillHtml}</div>` : '<div class="detail-media-empty"><span>등록된 트레일러·스틸컷이 없습니다.</span></div>'}</section>`;
}

export function renderDetailAvailability(record, c) {
  return `<section class="detail-question detail-question-watch detail-watch-band" data-detail-part="availability">${sectionHead('WATCH', '감상처')}${c.watchAvailabilityHtml(record)}</section>`;
}

export function renderDetailActivity(record, c) {
  const logs = c.logs || [];
  const collections = c.collections || [];
  const head = sectionHead('ARCHIVE', '내 기록');
  if (!signedIn(c)) return `<section class="detail-question detail-question-personal" data-detail-part="activity">${head}<div class="detail-section detail-my-record"><p class="activity-empty">로그인하면 감상 기록과 컬렉션을 이 영화 아래에 모아둘 수 있습니다.</p><button class="secondary-button" data-open-auth>로그인</button></div></section>`;
  const collectionHtml = collections.length
    ? `<section class="detail-section detail-record-collections"><div class="detail-section-head"><h3>컬렉션</h3><span>${collections.length}개</span></div><div class="detail-personal-collections">${collections.map((collection) => `<button data-collection="${c.escapeHtml(collection.id)}">${c.escapeHtml(collection.name)}</button>`).join('')}</div></section>`
    : '';
  const viewingHtml = logs.length
    ? `<section class="detail-section detail-my-record"><div class="detail-section-head"><h3>감상 기록</h3><span>${logs.length}회</span></div>${c.viewingHistoryHtml(record)}</section>`
    : `<section class="detail-section detail-my-record is-empty"><div class="detail-section-head"><h3>감상 기록</h3></div><div class="detail-record-empty"><p>아직 감상 기록이 없습니다.</p><button class="secondary-button" data-action="log" data-id="${c.escapeHtml(record.id)}">첫 감상 기록</button></div></section>`;
  return `<section class="detail-question detail-question-personal" data-detail-part="activity">${head}<div class="detail-personal-grid is-record-only">${viewingHtml}${collectionHtml}</div></section>`;
}

export function renderDetailRelated(record, c) {
  const related = c.related || [];
  return `<div data-detail-part="related">${related.length ? `<section class="detail-section detail-related"><div class="detail-section-head"><h2>비슷한 영화</h2></div>${c.railFrame ? c.railFrame(c.uniqueMovies(related).slice(0, 7).map((item) => c.card(item)).join('')) : `<div class="poster-row">${c.uniqueMovies(related).slice(0, 7).map((item) => c.card(item)).join('')}</div>`}</section>` : '<section class="detail-section detail-related is-loading"><div class="detail-section-head"><h2>비슷한 영화</h2></div><div class="rail-loading">추천을 불러오는 중…</div></section>'}</div>`;
}

export function renderDetail(record, c) {
  if (!record) return '';
  return `<div class="detail-topnav"><button data-movie-back>${c.icon('back')}<span>${c.escapeHtml(c.backLabel)}</span></button><button class="detail-share" data-share-movie="${c.escapeHtml(record.id)}">${c.icon('share')}<span>공유</span></button></div>${renderDetailHero(record, c)}<main class="detail-body">${renderDetailMetadata(record, c)}${renderDetailMedia(record, c)}${renderDetailAvailability(record, c)}${renderDetailActivity(record, c)}${renderDetailRelated(record, c)}</main>`;
}

const PART_RENDERERS = {
  hero: renderDetailHero,
  availability: renderDetailAvailability,
  metadata: renderDetailMetadata,
  media: renderDetailMedia,
  activity: renderDetailActivity,
  related: renderDetailRelated,
};

export function patchDetail(root, record, c, parts = Object.keys(PART_RENDERERS)) {
  if (!root) return false;
  for (const part of parts) {
    const renderer = PART_RENDERERS[part];
    const current = root.querySelector(`[data-detail-part="${part}"]`);
    if (!renderer || !current) continue;
    const template = document.createElement('template');
    template.innerHTML = renderer(record, c).trim();
    const replacement = template.content.firstElementChild;
    if (replacement) current.replaceWith(replacement);
  }
  return true;
}
