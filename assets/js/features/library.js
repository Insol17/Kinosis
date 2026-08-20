/**
 * Library is KINOSIS's present-tense shelf: films the user deliberately keeps
 * close. Watchlist/favorite/rating are relationship filters, not sibling
 * shelves. Collections are user-authored organization.
 */
export function filterLibrary(list, filter, c) {
  let out = [...(list || [])];
  const query = c.normalizeText(filter.q);
  if (query) out = out.filter((record) => c.normalizeText([record.title, record.originalTitle, record.director, ...c.genreNames(record)].filter(Boolean).join(' ')).includes(query));

  if (filter.relationship === 'favorite') out = out.filter((record) => !!c.relationship(record.id)?.favorite);
  else if (filter.relationship === 'rated') out = out.filter((record) => c.relationship(record.id)?.rating != null);

  if (filter.status === 'watched') out = out.filter((record) => c.logsForMovie(record.id).length > 0);
  else if (filter.status === 'unwatched') out = out.filter((record) => c.logsForMovie(record.id).length === 0);
  if (filter.minRating !== 'all') out = out.filter((record) => Number(c.relationship(record.id)?.rating || 0) >= Number(filter.minRating));
  if (filter.genre !== 'all') out = out.filter((record) => c.genreNames(record).includes(filter.genre));
  if (filter.availability === 'mine') out = out.filter(c.availableOnMine);
  else if (filter.availability === 'now') out = out.filter((record) => c.availableOnMine(record) || c.isInTheatres(record));

  if (filter.sort === 'title') out.sort((a, b) => a.title.localeCompare(b.title, 'ko'));
  else if (filter.sort === 'rating') out.sort((a, b) => (c.relationship(b.id)?.rating || 0) - (c.relationship(a.id)?.rating || 0));
  else if (filter.sort === 'year') out.sort((a, b) => (b.year || 0) - (a.year || 0));
  else if (filter.sort === 'watched') out.sort((a, b) => String(c.logsForMovie(b.id)[0]?.watchedAt || '').localeCompare(String(c.logsForMovie(a.id)[0]?.watchedAt || '')));
  else out.sort((a, b) => String(c.membership(b.id)?.savedAt || '').localeCompare(String(c.membership(a.id)?.savedAt || '')));
  return out;
}

function relationshipChip(key, label, filter) {
  return `<button type="button" class="library-filter-chip ${filter.relationship === key ? 'is-active' : ''}" data-library-relationship="${key}">${label}</button>`;
}

export function renderLibraryToolbar(list, filter, view, c) {
  const genres = [...new Set((list || []).flatMap((record) => c.genreNames(record)))].sort((a, b) => a.localeCompare(b, 'ko'));
  const activeFilters = [filter.relationship !== 'all', filter.status !== 'all', filter.minRating !== 'all', filter.genre !== 'all', filter.availability !== 'all'].filter(Boolean).length;
  return `<div class="library-retrieval">
    <div class="library-relationship-filters" aria-label="영화 상태 필터">
      ${relationshipChip('all', '전체', filter)}
      ${relationshipChip('favorite', '좋아요', filter)}
      ${relationshipChip('rated', '평가함', filter)}
    </div>
    <div class="library-toolbar simple-library-toolbar">
      <label class="library-search">${c.icon('search')}<input id="libraryQuery" value="${c.escapeHtml(filter.q)}" placeholder="내 영화장에서 찾기"></label>
      <details class="library-filter-menu"><summary>${c.icon('sliders')} 필터${activeFilters ? ` <span>${activeFilters}</span>` : ''}</summary><div class="library-filter-panel">
        <label>감상 상태<select id="libraryStatus"><option value="all">전체</option><option value="watched" ${filter.status === 'watched' ? 'selected' : ''}>감상함</option><option value="unwatched" ${filter.status === 'unwatched' ? 'selected' : ''}>미감상</option></select></label>
        <label>평점<select id="libraryRating"><option value="all">전체</option><option value="4" ${filter.minRating === '4' ? 'selected' : ''}>4점 이상</option><option value="3" ${filter.minRating === '3' ? 'selected' : ''}>3점 이상</option></select></label>
        <label>장르<select id="libraryGenre"><option value="all">전체</option>${genres.map((genre) => `<option value="${c.escapeHtml(genre)}" ${filter.genre === genre ? 'selected' : ''}>${c.escapeHtml(genre)}</option>`).join('')}</select></label>
        <label>감상 가능<select id="libraryAvailability"><option value="all">전체</option><option value="mine" ${filter.availability === 'mine' ? 'selected' : ''}>내 구독에서 가능</option><option value="now" ${filter.availability === 'now' ? 'selected' : ''}>현재 볼 수 있음</option></select></label>
        <button class="secondary-button" type="button" id="libraryFilterReset">필터 초기화</button>
      </div></details>
      <select id="librarySort" aria-label="정렬"><option value="recent" ${filter.sort === 'recent' ? 'selected' : ''}>최근 추가</option><option value="watched" ${filter.sort === 'watched' ? 'selected' : ''}>최근 감상</option><option value="title" ${filter.sort === 'title' ? 'selected' : ''}>제목</option><option value="rating" ${filter.sort === 'rating' ? 'selected' : ''}>내 평점</option><option value="year" ${filter.sort === 'year' ? 'selected' : ''}>개봉연도</option></select>
      <div class="view-toggle"><button class="${view === 'grid' ? 'is-active' : ''}" data-library-view="grid" aria-label="그리드 보기">${c.icon('grid')}</button><button class="${view === 'list' ? 'is-active' : ''}" data-library-view="list" aria-label="목록 보기">${c.icon('list')}</button></div>
    </div>
  </div>`;
}

export function renderCollectionStrip(collections, allCount, c) {
  const recent = [...(collections || [])].sort((a, b) => String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || ''))).slice(0, 4);
  return `<section class="library-collection-strip"><div class="library-section-head"><div><p class="eyebrow">COLLECTIONS</p><h2>내가 만든 분류</h2></div><button class="section-action" data-library="collections">전체 컬렉션 →</button></div><div class="library-collection-rail">
    <button class="library-all-card" data-library="all"><span>ALL FILMS</span><strong>${allCount}</strong><small>내 영화장 전체</small></button>
    ${recent.map((collection) => { const cover = c.collectionCover(collection); return `<button class="library-mini-collection ${cover ? 'has-cover' : ''}" data-collection-card="${c.escapeHtml(collection.id)}">${cover ? `<img src="${c.escapeHtml(cover)}" alt="">` : ''}<span class="library-mini-shade"></span><span><strong>${c.escapeHtml(collection.name)}</strong><small>${collection.movieIds.length}편</small></span></button>`; }).join('')}
    <button class="library-mini-collection is-create" data-new-collection><span><strong>＋ 새 컬렉션</strong><small>나만의 서가 만들기</small></span></button>
  </div></section>`;
}

export function renderLibraryShelf({ list, filter, view, collections, hydrationHtml = '', c }) {
  const filtered = filterLibrary(list, filter, c);
  const empty = !list.length
    ? '<div class="empty-state library-empty-primary"><b>아직 내 영화장에 담은 영화가 없습니다.</b><span>평가·한줄평·감상 기록·좋아요·컬렉션처럼 영화를 내 것으로 남기는 순간 이 서가에 자동으로 들어옵니다.</span><button class="secondary-button" data-nav="discover">영화 둘러보기</button></div>'
    : '<div class="empty-state"><b>조건에 맞는 영화가 없습니다.</b><span>필터를 바꾸거나 다른 컬렉션을 확인해보세요.</span></div>';
  return `${hydrationHtml}<section class="library-shelf library-primary-surface"><div class="library-section-head shelf-head stable-library-head"><div><p class="eyebrow">MY SHELF</p><h1>내 영화장</h1><span>${filtered.length} / ${list.length}편</span></div></div>${renderLibraryToolbar(list, filter, view, c)}${filtered.length ? (view === 'grid' ? `<div class="library-grid">${filtered.map((record) => c.card(record, 'library')).join('')}</div>` : c.listRows(filtered)) : empty}</section>`;
}

export function renderWatchlistShelf({ list, c }) {
  const rows = [...(list || [])].sort((a, b) => String(c.relationship(b.id)?.updatedAt || '').localeCompare(String(c.relationship(a.id)?.updatedAt || '')));
  return `<section class="library-shelf library-primary-surface"><div class="library-section-head shelf-head stable-library-head"><div><p class="eyebrow">WATCHLIST / ALL</p><h1>보고싶어요 전체</h1><span>${rows.length}편</span></div><button class="section-action" data-watchlist-overview>요약 보기 →</button></div>${rows.length ? `<div class="library-grid">${rows.map((record) => c.card(record, 'watchlist')).join('')}</div>` : '<div class="empty-state library-empty-primary"><b>아직 보고싶어요에 담은 영화가 없습니다.</b><span>Discover, Arthouse 또는 검색에서 ＋ 버튼을 누르면 이곳에 모입니다.</span><button class="secondary-button" data-nav="discover">영화 둘러보기</button></div>'}</section>`;
}

function watchlistTime(record, c) {
  const relation = c.relationship(record.id);
  return Date.parse(relation?.watchlistedAt || relation?.updatedAt || 0) || 0;
}

function watchlistRail(title, description, rows, c) {
  if (!rows.length) return '';
  const inner = rows.slice(0, 10).map((record) => c.card(record, 'watchlist')).join('');
  return `<section class="watchlist-dynamic-section"><div class="library-section-head"><div><h2>${c.escapeHtml(title)}</h2>${description ? `<p>${c.escapeHtml(description)}</p>` : ''}</div></div>${c.railFrame(inner)}</section>`;
}

/** Watchlist landing surface: useful slices first, exhaustive list one click away. */
export function renderWatchlistOverview({ list, c }) {
  const rows = [...(list || [])];
  const recent = [...rows].sort((a, b) => watchlistTime(b, c) - watchlistTime(a, c));
  const available = recent.filter((record) => c.availableOnMine(record));
  const short = recent.filter((record) => Number(record.runtime || 0) > 0 && Number(record.runtime) <= 100);
  const cutoff = Date.now() - 180 * 86400000;
  const waiting = [...rows].filter((record) => watchlistTime(record, c) > 0 && watchlistTime(record, c) < cutoff).sort((a, b) => watchlistTime(a, c) - watchlistTime(b, c));

  if (!rows.length) return '<section class="library-shelf library-primary-surface"><div class="library-section-head shelf-head stable-library-head"><div><p class="eyebrow">WATCHLIST</p><h1>보고싶어요</h1><span>0편</span></div></div><div class="empty-state library-empty-primary"><b>아직 보고싶어요에 담은 영화가 없습니다.</b><span>Discover, Arthouse 또는 검색에서 ＋ 버튼을 누르면 이곳에 모입니다.</span><button class="secondary-button" data-nav="discover">영화 둘러보기</button></div></section>';

  return `<section class="library-shelf library-primary-surface watchlist-overview">
    <div class="library-section-head shelf-head stable-library-head"><div><p class="eyebrow">WATCHLIST</p><h1>보고싶어요</h1><span>${rows.length}편</span></div><button class="section-action watchlist-all-action" data-watchlist-all>전체 보기 →</button></div>
    <p class="watchlist-overview-copy">저장해둔 영화가 실제 선택으로 이어지도록, 지금 볼 수 있는 작품과 오래 기다린 작품을 먼저 꺼냅니다.</p>
    ${watchlistRail('지금 볼 수 있음', '내가 설정한 구독 서비스에서 현재 확인되는 영화', available, c)}
    ${watchlistRail('100분 안에 볼 수 있음', '부담 없이 꺼내기 좋은 짧은 영화', short, c)}
    ${watchlistRail('오래 기다린 영화', '보고싶어요에 6개월 이상 머문 영화', waiting, c)}
    ${watchlistRail('최근 담은 영화', '', recent, c)}
    <div class="watchlist-overview-footer"><button class="secondary-button" data-watchlist-all>보고싶어요 ${rows.length}편 전체 보기</button></div>
  </section>`;
}
