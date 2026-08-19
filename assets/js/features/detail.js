function signedIn(c) { return typeof c.isSignedIn === 'function' ? c.isSignedIn() : !!c.isSignedIn; }
function commentOf(relation) { return String(relation?.comment ?? relation?.review ?? '').trim(); }

function directorButton(record, c) {
  return record.directorId
    ? `<button data-person-id="${c.escapeHtml(record.directorId)}" data-person-name="${c.escapeHtml(record.director || '')}">${c.escapeHtml(record.director || '—')}</button>`
    : `<b>${c.escapeHtml(record.director || '—')}</b>`;
}

function questionHead(number, eyebrow, title, description = '') {
  return `<header class="detail-question-head"><span class="detail-question-number">${number}</span><div><p>${eyebrow}</p><h2>${title}</h2>${description ? `<span>${description}</span>` : ''}</div></header>`;
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
    ? `<button class="detail-library-toggle is-active" data-remove-library="${c.escapeHtml(record.id)}">✓ 내 영화장</button>`
    : `<button class="detail-library-toggle" data-add-library="${c.escapeHtml(record.id)}">＋ 내 영화장에 담기</button>`;

  return `<section class="detail-hero ${backdropUrl ? '' : 'has-no-backdrop'} ${isLoading ? 'is-partial' : ''}" data-detail-part="hero">
    ${backdropUrl ? `<img class="detail-backdrop" src="${c.escapeHtml(backdropUrl)}" alt="">` : '<div class="detail-backdrop-placeholder" aria-hidden="true"></div>'}<div class="detail-backdrop-shade"></div>
    <div class="detail-hero-inner">
      ${posterUrl ? `<img class="detail-poster" data-poster-image src="${c.escapeHtml(posterUrl)}" alt="${c.escapeHtml(record.title)} 포스터">` : `<div class="detail-poster detail-poster-placeholder" aria-label="포스터 없음"><span>${isLoading ? 'LOADING' : c.escapeHtml(record.title)}</span></div>`}
      <div class="detail-intro">
        <div class="detail-badges">${Number(record.boxOfficeRank || 0) > 0 ? `<span class="detail-badge is-boxoffice">박스오피스 ${Number(record.boxOfficeRank)}위</span>` : ''}${c.releaseLabel ? `<span class="detail-badge is-cinema">${c.icon('cinema')}${c.escapeHtml(c.releaseLabel)}</span>` : ''}${c.isArt ? '<span class="detail-badge">KINOSIS ARTHOUSE</span>' : ''}${isLoading ? '<span class="detail-badge is-loading">정보 보강 중</span>' : ''}</div>
        <h1>${c.escapeHtml(record.title)}</h1>
        ${record.originalTitle && record.originalTitle !== record.title ? `<p class="detail-original">${c.escapeHtml(record.originalTitle)}</p>` : ''}
        <p class="detail-meta">${c.escapeHtml(c.titleMeta || (isLoading ? '영화 정보를 불러오는 중…' : '영화 정보'))}</p>
        ${record.director ? `<p class="detail-director">감독 ${director}</p>` : '<p class="detail-director detail-meta-skeleton">감독 정보 확인 중</p>'}
        ${record.tagline ? `<p class="detail-tagline">${c.escapeHtml(record.tagline)}</p>` : ''}
        <div class="detail-actions"><button class="primary-button detail-action" data-action="log" data-id="${c.escapeHtml(record.id)}">${logs.length ? '감상 기록 추가' : '감상 기록'}</button>${signedIn(c) ? libraryAction : ''}<button class="detail-watchlist ${relationship?.watchlist ? 'is-active' : ''}" data-action="watchlist" data-id="${c.escapeHtml(record.id)}">${relationship?.watchlist ? '✓ 보고싶어요' : '＋ 보고싶어요'}</button><details class="film-more"><summary class="detail-more" aria-label="더 보기">${c.icon('more')}</summary><div class="film-more-menu"><button class="${relationship?.favorite ? 'is-active' : ''}" data-action="favorite" data-id="${c.escapeHtml(record.id)}">${relationship?.favorite ? '♥ 좋아요 해제' : '♡ 좋아요'}</button><button data-action="collection-add" data-id="${c.escapeHtml(record.id)}">＋ 컬렉션에 추가</button>${relationship || logs.length || membership ? `<button class="is-danger" data-delete-personal-movie="${c.escapeHtml(record.id)}">모든 개인 데이터 삭제…</button>` : ''}</div></details></div>
      </div>
      <aside class="detail-relationship" aria-label="나와 이 영화">
        <p class="detail-relationship-kicker">MY FILM</p>
        ${signedIn(c) ? `${c.starRatingHtml(record.id, relationship?.rating ?? null, 'detail')}<div class="detail-comment"><div class="detail-comment-head"><span>내 한줄평</span><button data-edit-relationship="${c.escapeHtml(record.id)}">${comment ? '수정' : '작성'}</button></div>${comment ? `<p>${c.escapeHtml(comment)}</p>` : '<p class="is-empty">이 영화에 대한 한줄평을 남겨보세요.</p>'}</div><div class="detail-personal-glance">${membership ? '<span>내 영화장</span>' : ''}${logs.length ? `<span>${logs.length}회 감상</span>` : ''}${relationship?.favorite ? '<span>좋아요</span>' : ''}</div>` : '<button class="streaming-signin compact" data-open-auth>로그인하고 내 영화로 기록하기</button>'}
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
  const head = questionHead('01', 'ABOUT THE FILM', '이 영화는 무엇인가?', '작품 자체를 이해하는 데 필요한 정보');
  if (record.metadataLoading) {
    return `<section class="detail-question detail-question-about" data-detail-part="metadata">${head}<div class="detail-section detail-metadata-loading" role="status"><span class="loading-ring mini"></span><div><h3>작품 정보를 불러오는 중입니다.</h3><p>감독·출연·러닝타임은 준비되는 대로 이 영역만 갱신됩니다.</p></div></div></section>`;
  }
  if (record.detailError) {
    return `<section class="detail-question detail-question-about" data-detail-part="metadata">${head}<div class="detail-section detail-metadata-error" role="status"><div><h3>일부 작품 정보를 불러오지 못했습니다.</h3><p>${c.escapeHtml(record.detailError)} 이미 확인된 제목·포스터·내 기록은 그대로 사용할 수 있습니다.</p></div><button class="secondary-button" data-detail-retry="${c.escapeHtml(record.id)}">다시 불러오기</button></div></section>`;
  }
  return `<section class="detail-question detail-question-about" data-detail-part="metadata">${head}<div class="detail-about-grid">
    <div class="detail-about-main">
      <section class="detail-section detail-synopsis"><h3>줄거리</h3><p>${c.escapeHtml(record.overview || '줄거리 정보가 없습니다.')}</p></section>
      ${record.director ? `<section class="detail-section detail-director-section"><div class="detail-section-head"><h3>감독</h3></div><div class="detail-director-card"><span class="cast-avatar-fallback">${c.escapeHtml(String(record.director || '?').slice(0, 1))}</span><div><strong>${director}</strong><small>${record.year || ''}${record.runtime ? ` · ${c.escapeHtml(c.fmtRuntime(record.runtime))}` : ''}</small></div></div></section>` : ''}
      ${cast.length ? `<section class="detail-section"><div class="detail-section-head"><h3>출연</h3><span>${record.cast?.length > cast.length ? `${record.cast.length}명 중 주요 출연진` : '주요 출연진'}</span></div><div class="detail-cast-grid">${cast.map((person) => `<button class="detail-cast-person" data-person-id="${c.escapeHtml(person.id || '')}" data-person-name="${c.escapeHtml(person.name || person)}">${person.profileUrl ? `<img src="${c.escapeHtml(person.profileUrl)}" alt="${c.escapeHtml(person.name || person)}">` : `<span class="cast-avatar-fallback">${c.escapeHtml(String(person.name || person).slice(0,1))}</span>`}<span><b>${c.escapeHtml(person.name || person)}</b><small>${c.escapeHtml(person.character || '')}</small></span></button>`).join('')}</div></section>` : ''}
    </div>
    <section class="detail-section detail-facts-section"><div class="detail-section-head"><h3>작품 정보</h3></div><dl class="detail-facts">
      ${record.director ? `<div><dt>감독</dt><dd>${director}</dd></div>` : ''}
      ${writers.length ? `<div><dt>각본</dt><dd>${writers.map((p) => c.escapeHtml(p.name)).join(' · ')}</dd></div>` : ''}
      ${cinematographers.length ? `<div><dt>촬영</dt><dd>${cinematographers.map((p) => c.escapeHtml(p.name)).join(' · ')}</dd></div>` : ''}
      <div><dt>장르</dt><dd>${genres.map((g) => `<button data-search-query="${c.escapeHtml(g)}">${c.escapeHtml(g)}</button>`).join(' · ') || '—'}</dd></div>
      ${c.country ? `<div><dt>국가</dt><dd>${c.escapeHtml(c.country)}</dd></div>` : ''}${record.originalLanguage ? `<div><dt>언어</dt><dd>${c.escapeHtml(String(record.originalLanguage).toUpperCase())}</dd></div>` : ''}${record.releaseDate ? `<div><dt>공개일</dt><dd>${c.escapeHtml(c.formatDate(record.releaseDate))}</dd></div>` : ''}${record.runtime ? `<div><dt>러닝타임</dt><dd>${c.escapeHtml(c.fmtRuntime(record.runtime))}</dd></div>` : ''}${record.voteAverage ? `<div><dt>TMDB</dt><dd>${Number(record.voteAverage).toFixed(1)}${record.voteCount ? ` · ${Number(record.voteCount).toLocaleString()}명` : ''}</dd></div>` : ''}
    </dl></section>
  </div></section>`;
}

export function renderDetailAvailability(record, c) {
  return `<section class="detail-question detail-question-watch detail-watch-band" data-detail-part="availability">${questionHead('02', 'WHERE TO WATCH', '지금 어디서 볼 수 있는가?', '내 구독 서비스와 대한민국 극장·OTT 제공 정보')}${c.watchAvailabilityHtml(record)}</section>`;
}

export function renderDetailActivity(record, c) {
  const relationship = c.relationship || c.entry || null;
  const membership = c.membership || null;
  const logs = c.logs || [];
  const collections = c.collections || [];
  const head = questionHead('03', 'MY FILM', '나와 어떤 관계인가?', '현재의 평가와 지금까지의 감상 경험을 한 영화 아래 모읍니다.');
  if (!signedIn(c)) return `<section class="detail-question detail-question-personal" data-detail-part="activity">${head}<div class="detail-section detail-my-record"><button class="streaming-signin compact" data-open-auth>로그인하고 내 영화로 기록하기</button></div></section>`;
  const stateItems = [
    `<span class="personal-state-pill ${membership ? 'is-active' : ''}">${membership ? '✓ 내 영화장 기본 서가' : '기본 서가에 없음'}</span>`,
    relationship?.watchlist ? '<span class="personal-state-pill is-active">보고싶어요</span>' : '',
    relationship?.favorite ? '<span class="personal-state-pill is-active">좋아요</span>' : '',
  ].filter(Boolean).join('');
  const collectionHtml = collections.length
    ? `<div class="detail-personal-collections"><span>컬렉션</span>${collections.map((collection) => `<button data-collection="${c.escapeHtml(collection.id)}">${c.escapeHtml(collection.name)}</button>`).join('')}</div>`
    : '<div class="detail-personal-collections is-empty"><span>컬렉션</span><small>아직 분류한 컬렉션이 없습니다.</small></div>';
  return `<section class="detail-question detail-question-personal" data-detail-part="activity">${head}<div class="detail-personal-grid">
    <section class="detail-section detail-personal-state"><div class="detail-section-head"><h3>현재 관계</h3><button class="section-action" data-edit-relationship="${c.escapeHtml(record.id)}">평가 수정</button></div><div class="personal-state-pills">${stateItems}</div>${collectionHtml}</section>
    <section class="detail-section detail-my-record"><div class="detail-section-head"><h3>감상 기록</h3><span>${logs.length ? `${logs.length}회` : ''}</span></div>${logs.length ? c.viewingHistoryHtml(record) : '<div class="activity-empty">아직 감상 기록이 없습니다.</div>'}</section>
  </div></section>`;
}

export function renderDetailRelated(record, c) {
  const related = c.related || [];
  return `<div data-detail-part="related">${related.length ? `<section class="detail-section detail-related"><div class="detail-section-head"><h2>비슷한 영화</h2></div><div class="poster-row">${c.uniqueMovies(related).slice(0, 7).map((item) => c.card(item)).join('')}</div></section>` : '<section class="detail-section detail-related is-loading"><div class="detail-section-head"><h2>비슷한 영화</h2></div><div class="rail-loading">추천을 불러오는 중…</div></section>'}</div>`;
}

export function renderDetail(record, c) {
  if (!record) return '';
  return `<div class="detail-topnav"><button data-movie-back>${c.icon('back')}<span>${c.escapeHtml(c.backLabel)}</span></button><button class="detail-share" data-share-movie="${c.escapeHtml(record.id)}">${c.icon('share')}<span>공유</span></button></div>${renderDetailHero(record, c)}<main class="detail-body">${renderDetailMetadata(record, c)}${renderDetailAvailability(record, c)}${renderDetailActivity(record, c)}${renderDetailRelated(record, c)}</main>`;
}

const PART_RENDERERS = {
  hero: renderDetailHero,
  availability: renderDetailAvailability,
  metadata: renderDetailMetadata,
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
