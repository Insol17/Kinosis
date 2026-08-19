/**
 * Library is KINOSIS's present-tense shelf: films the user deliberately keeps
 * close. Watchlist/favorite/rating are relationship filters, not sibling
 * shelves. Collections are user-authored organization.
 */
export function filterLibrary(list, filter, c) {
  let out = [...(list || [])];
  const query = c.normalizeText(filter.q);
  if (query) out = out.filter((record) => c.normalizeText([record.title, record.originalTitle, record.director, ...c.genreNames(record)].filter(Boolean).join(' ')).includes(query));

  if (filter.relationship === 'watchlist') out = out.filter((record) => !!c.relationship(record.id)?.watchlist);
  else if (filter.relationship === 'favorite') out = out.filter((record) => !!c.relationship(record.id)?.favorite);
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
    <div class="library-relationship-filters" aria-label="영화 관계 필터">
      ${relationshipChip('all', '전체', filter)}
      ${relationshipChip('watchlist', '보고싶어요', filter)}
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
  return `<header class="library-home-head"><p class="eyebrow">PERSONAL FILM LIBRARY</p><h1>내 영화장</h1><p>내가 남겨두고 계속 관리하는 영화들을 한곳에서 꺼내봅니다.</p><div class="library-home-count"><strong>${list.length}</strong><span>편의 영화</span></div></header>
    ${hydrationHtml}
    ${renderCollectionStrip(collections, list.length, c)}
    <section class="library-shelf"><div class="library-section-head shelf-head"><div><p class="eyebrow">MY SHELF</p><h2>영화</h2><span>${filtered.length}편</span></div></div>${renderLibraryToolbar(list, filter, view, c)}${filtered.length ? (view === 'grid' ? `<div class="library-grid">${filtered.map((record) => c.card(record, 'library')).join('')}</div>` : c.listRows(filtered)) : '<div class="empty-state"><b>조건에 맞는 영화가 없습니다.</b><span>필터를 바꾸거나 다른 컬렉션을 확인해보세요.</span></div>'}</section>`;
}
