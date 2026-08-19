(function () {
  'use strict';

  function render(record, c) {
    if (!record) return '';
    const entry = c.entry;
    const logs = c.logs || [];
    const genres = c.genres || [];
    const cast = c.cast || [];
    const writers = c.writers || [];
    const cinematographers = c.cinematographers || [];
    const related = c.related || [];
    const directorButton = record.directorId
      ? `<button data-person-id="${c.escapeHtml(record.directorId)}" data-person-name="${c.escapeHtml(record.director || '')}">${c.escapeHtml(record.director || '—')}</button>`
      : `<b>${c.escapeHtml(record.director || '—')}</b>`;
    const myRecord = c.isSignedIn()
      ? (entry ? `<div class="my-activity">${entry.rating ? `<div class="activity-rating">★ ${entry.rating}</div>` : ''}${entry.review ? `<div class="activity-review">${c.escapeHtml(entry.review)}</div>` : ''}<div class="activity-empty">${logs.length ? `${logs.length}회 감상 · 최근 ${c.formatDate(logs[0]?.watchedAt)}` : entry.watchlist ? '보고싶어요에 저장됨' : '영화와의 기록이 저장됨'}</div>${c.viewingHistoryHtml(record)}<button class="danger-text-button" data-remove-library="${c.escapeHtml(record.id)}">이 영화의 모든 기록 삭제</button></div>` : '<div class="activity-empty">아직 이 영화에 대한 기록이 없습니다.</div>')
      : '<button class="streaming-signin compact" data-open-auth>로그인하고 감상 기록 남기기</button>';

    return `<div class="detail-topnav">
      <button data-movie-back>${c.icon('back')}<span>${c.escapeHtml(c.backLabel)}</span></button>
      <button class="detail-share" data-share-movie="${c.escapeHtml(record.id)}">${c.icon('share')}<span>공유</span></button>
    </div>
    <section class="detail-hero">
      <img class="detail-backdrop" src="${c.escapeHtml(c.backdrop(record))}" alt=""><div class="detail-backdrop-shade"></div>
      <div class="detail-hero-inner">
        <img class="detail-poster" src="${c.escapeHtml(c.poster(record))}" alt="${c.escapeHtml(record.title)} 포스터">
        <div class="detail-intro">
          <div class="detail-badges">${Number(record.boxOfficeRank || 0) > 0 ? `<span class="detail-badge is-boxoffice">박스오피스 ${Number(record.boxOfficeRank)}위</span>` : ''}${c.releaseLabel ? `<span class="detail-badge is-cinema">${c.icon('cinema')}${c.escapeHtml(c.releaseLabel)}</span>` : ''}${c.isArt ? '<span class="detail-badge">KINOSIS ARTHOUSE</span>' : ''}</div>
          <h1>${c.escapeHtml(record.title)}</h1>
          ${record.originalTitle && record.originalTitle !== record.title ? `<p class="detail-original">${c.escapeHtml(record.originalTitle)}</p>` : ''}
          <p class="detail-meta">${c.escapeHtml(c.titleMeta || '영화 정보')}</p>
          <p class="detail-director">감독 ${directorButton}</p>
          ${record.tagline ? `<p class="detail-tagline">${c.escapeHtml(record.tagline)}</p>` : ''}
          <div class="detail-actions"><button class="primary-button detail-action" data-action="log" data-id="${c.escapeHtml(record.id)}">${logs.length ? '감상 기록 추가' : '감상 기록'}</button><button class="detail-watchlist ${entry?.watchlist ? 'is-active' : ''}" data-action="watchlist" data-id="${c.escapeHtml(record.id)}">${entry?.watchlist ? '✓ 보고싶어요' : '＋ 보고싶어요'}</button><details class="film-more"><summary class="detail-more" aria-label="더 보기">${c.icon('more')}</summary><div class="film-more-menu"><button class="${entry?.favorite ? 'is-active' : ''}" data-action="favorite" data-id="${c.escapeHtml(record.id)}">${entry?.favorite ? '♥ 좋아요 해제' : '♡ 좋아요'}</button><button data-action="collection-add" data-id="${c.escapeHtml(record.id)}">＋ 컬렉션에 추가</button></div></details></div>
        </div>
        <div class="detail-rating-box">${entry?.rating ? `<div class="detail-user-rating"><span>내 평점</span><strong>★ ${entry.rating}</strong><small>${logs.length ? `${logs.length}회 감상` : ''}</small></div>` : `<button class="detail-rate-cta" data-action="log" data-id="${c.escapeHtml(record.id)}"><span>내 평점</span><strong>평가하기</strong></button>`}</div>
      </div>
    </section>
    <div class="detail-watch-band">${c.watchAvailabilityHtml(record)}</div>
    <main class="detail-body">
      <section class="detail-section detail-synopsis"><h2>줄거리</h2><p>${c.escapeHtml(record.overview || '줄거리 정보가 없습니다.')}</p></section>
      <section class="detail-section detail-director-section"><div class="detail-section-head"><h2>감독</h2></div><div class="detail-director-card"><span class="cast-avatar-fallback">${c.escapeHtml(String(record.director || '?').slice(0, 1))}</span><div><strong>${directorButton}</strong><small>${record.year || ''}${record.runtime ? ` · ${c.escapeHtml(c.fmtRuntime(record.runtime))}` : ''}</small></div></div></section>
      ${cast.length ? `<section class="detail-section"><div class="detail-section-head"><h2>출연</h2><span>${record.cast?.length > cast.length ? `${record.cast.length}명 중 주요 출연진` : '주요 출연진'}</span></div><div class="detail-cast-grid">${cast.map((person) => `<button class="detail-cast-person" data-person-id="${c.escapeHtml(person.id || '')}" data-person-name="${c.escapeHtml(person.name || person)}">${person.profileUrl ? `<img src="${c.escapeHtml(person.profileUrl)}" alt="${c.escapeHtml(person.name || person)}">` : `<span class="cast-avatar-fallback">${c.escapeHtml(String(person.name || person).slice(0,1))}</span>`}<span><b>${c.escapeHtml(person.name || person)}</b><small>${c.escapeHtml(person.character || '')}</small></span></button>`).join('')}</div></section>` : ''}
      <section class="detail-section detail-my-record"><div class="detail-section-head"><h2>내 기록</h2></div>${myRecord}</section>
      <section class="detail-section detail-facts-section"><div class="detail-section-head"><h2>작품 정보</h2></div><dl class="detail-facts">
        <div><dt>감독</dt><dd>${directorButton}</dd></div>
        ${writers.length ? `<div><dt>각본</dt><dd>${writers.map((p) => c.escapeHtml(p.name)).join(' · ')}</dd></div>` : ''}
        ${cinematographers.length ? `<div><dt>촬영</dt><dd>${cinematographers.map((p) => c.escapeHtml(p.name)).join(' · ')}</dd></div>` : ''}
        <div><dt>장르</dt><dd>${genres.map((g) => `<button data-search-query="${c.escapeHtml(g)}">${c.escapeHtml(g)}</button>`).join(' · ') || '—'}</dd></div>
        ${c.country ? `<div><dt>국가</dt><dd>${c.escapeHtml(c.country)}</dd></div>` : ''}${record.originalLanguage ? `<div><dt>언어</dt><dd>${c.escapeHtml(String(record.originalLanguage).toUpperCase())}</dd></div>` : ''}${record.releaseDate ? `<div><dt>공개일</dt><dd>${c.escapeHtml(c.formatDate(record.releaseDate))}</dd></div>` : ''}${record.runtime ? `<div><dt>러닝타임</dt><dd>${c.escapeHtml(c.fmtRuntime(record.runtime))}</dd></div>` : ''}${record.voteAverage ? `<div><dt>TMDB</dt><dd>${Number(record.voteAverage).toFixed(1)}${record.voteCount ? ` · ${Number(record.voteCount).toLocaleString()}명` : ''}</dd></div>` : ''}
      </dl></section>
      ${related.length ? `<section class="detail-section detail-related"><div class="detail-section-head"><h2>비슷한 영화</h2></div><div class="poster-row">${c.uniqueMovies(related).slice(0, 7).map((item) => c.card(item)).join('')}</div></section>` : ''}
    </main>`;
  }

  window.KINOSIS_DETAIL = Object.freeze({ render });
})();
