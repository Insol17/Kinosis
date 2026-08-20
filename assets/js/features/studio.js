function esc(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
}

export function emptyProgramme(kind = 'editorial') {
  const slug = `programme-${Date.now()}`;
  return kind === 'director-archive'
    ? { slug, kind, surface: 'arthouse', status: 'draft', eyebrow: 'DIRECTOR ARCHIVE', title: '', subtitle: '', description: '', credit: 'KINOSIS', heroMovieId: '', heroImageUrl: '', priority: 100, source: { type: 'director', name: '', personId: '' }, movies: [], orderMode: 'unordered', chapters: [] }
    : { slug, kind: 'editorial', surface: 'arthouse', status: 'draft', eyebrow: 'KINOSIS CURATION', title: '', subtitle: '', description: '', credit: 'KINOSIS', heroMovieId: '', heroImageUrl: '', priority: 100, source: null, movies: [], orderMode: 'curated', chapters: [] };
}

/** Legacy chapter definitions are flattened once at the authoring boundary. */
export function orderedEditorialEntries(programme) {
  const rows = [];
  for (const entry of programme?.movies || []) if (entry?.id) rows.push({ id: String(entry.id), note: String(entry.note || ''), ...(entry.snapshot ? { snapshot: entry.snapshot } : {}) });
  for (const chapter of programme?.chapters || []) {
    for (const entry of chapter?.movies || []) if (entry?.id && !rows.some((row) => row.id === String(entry.id))) rows.push({ id: String(entry.id), note: String(entry.note || ''), ...(entry.snapshot ? { snapshot: entry.snapshot } : {}) });
  }
  return rows;
}

export function renderStudioHome(programmes, { loading = false, error = '' } = {}) {
  const rows = (programmes || []).map((item) => `<article class="studio-programme-row" data-studio-row="${esc(item.slug)}">
    <div><span class="studio-kind">${item.kind === 'director-archive' ? 'DIRECTOR ARCHIVE' : 'CURATION'}</span><h3>${esc(item.title || '제목 없음')}</h3><p>${esc(item.description || '')}</p></div>
    <div class="studio-row-meta"><span class="studio-status is-${esc(item.status || 'draft')}">${esc(String(item.status || 'draft').toUpperCase())}</span><small>${esc(item.updatedAt || '')}</small></div>
    <div class="studio-row-actions"><button class="secondary-button mini" data-studio-edit="${esc(item.slug)}">편집</button><button class="secondary-button mini" data-studio-preview="${esc(item.slug)}">미리보기</button>${item.status !== 'archived' ? `<button class="secondary-button mini" data-studio-archive="${esc(item.slug)}">보관</button>` : ''}</div>
  </article>`).join('');
  const body = loading
    ? '<div class="studio-loading-state" aria-live="polite"><span class="loading-ring"></span><div><b>프로그램을 불러오는 중</b><span>목록만 먼저 가져오고, 편집 데이터는 선택할 때 불러옵니다.</span></div></div>'
    : error
      ? `<div class="empty-state"><b>Studio 목록을 불러오지 못했습니다.</b><span>${esc(error)}</span><button class="secondary-button" data-studio-reload>다시 시도</button></div>`
      : rows || '<div class="empty-state"><b>Studio 프로그램이 없습니다.</b><span>새 Curation 또는 Director Archive를 만들 수 있습니다.</span></div>';
  return `<div class="studio-shell"><header class="studio-header"><div><p class="eyebrow">ADMIN ONLY</p><h1>KINOSIS STUDIO</h1><p>Arthouse 프로그램을 제작·미리보기·발행합니다.</p></div><div class="studio-create-actions"><button class="primary-button" data-studio-new="editorial">+ Curation</button><button class="secondary-button" data-studio-new="director-archive">+ Director Archive</button></div></header><section class="studio-list">${body}</section></div>`;
}

function movieRows(programme, getMovie) {
  const entries = orderedEditorialEntries(programme);
  const editorial = programme.kind === 'editorial';
  return entries.map((entry, index) => {
    const movie = getMovie?.(entry.id) || entry.snapshot || null;
    const poster = movie?.posterUrl ? `<img class="studio-film-poster" src="${esc(movie.posterUrl)}" alt="">` : '<span class="studio-film-poster is-empty"></span>';
    return `<div class="studio-film-row" data-studio-film-index="${index}"><span class="studio-film-order">${String(index + 1).padStart(2, '0')}</span>${poster}<div class="studio-film-copy"><b>${esc(movie?.title || `TMDB ${entry.id}`)}</b><small>${esc([movie?.originalTitle && movie.originalTitle !== movie.title ? movie.originalTitle : '', movie?.year, movie?.director].filter(Boolean).join(' · '))}</small>${editorial ? `<textarea data-studio-film-note="${index}" rows="3" maxlength="700" placeholder="이 영화가 이 큐레이션에 포함된 이유를 적으세요. (필수)">${esc(entry.note)}</textarea>` : ''}</div><div class="studio-film-actions"><button type="button" data-studio-film-up="${index}" aria-label="위로">↑</button><button type="button" data-studio-film-down="${index}" aria-label="아래로">↓</button><button type="button" data-studio-film-remove="${index}" aria-label="제거">×</button></div></div>`;
  }).join('');
}

export function renderStudioEditor(programme, getMovie, { syncing = false } = {}) {
  const isArchive = programme.kind === 'director-archive';
  const entries = orderedEditorialEntries(programme);
  const heroOptions = entries.map((entry) => { const m = getMovie?.(entry.id) || entry.snapshot || null; return `<option value="${esc(entry.id)}" ${String(programme.heroMovieId || '') === String(entry.id) ? 'selected' : ''}>${esc(m?.title || `TMDB ${entry.id}`)}</option>`; }).join('');
  return `<div class="studio-editor-shell"><div class="studio-editor-top"><button class="secondary-button mini" data-studio-back>← Studio</button><div><span class="studio-kind">${isArchive ? 'DIRECTOR ARCHIVE' : 'CURATION'}</span><h1>${esc(programme.title || '새 프로그램')}</h1></div><div class="studio-editor-actions"><button class="secondary-button" data-studio-preview-current>미리보기</button><button class="secondary-button" data-studio-save="draft">초안 저장</button><button class="primary-button" data-studio-save="published">공개</button></div></div>
    <div class="studio-editor-grid"><section class="studio-form-panel">
      <label>Slug<input data-studio-field="slug" value="${esc(programme.slug)}" maxlength="63"></label>
      <label>제목<input data-studio-field="title" value="${esc(programme.title || '')}" maxlength="120"></label>
      <label>${isArchive ? '감독 영문명 · 선택' : '부제 · 선택'}<input data-studio-field="subtitle" value="${esc(programme.subtitle || '')}" maxlength="160"></label>
      <label>짧은 소개<textarea data-studio-field="description" rows="4" maxlength="800">${esc(programme.description || '')}</textarea></label>
      ${isArchive ? `<div class="studio-inline-fields"><label>감독 이름<input data-studio-director="name" value="${esc(programme.source?.name || '')}" placeholder="Christian Petzold"></label><label>TMDB Person ID · 선택<input data-studio-director="personId" value="${esc(programme.source?.personId || '')}" inputmode="numeric"></label></div>` : ''}
      <div class="studio-inline-fields"><label>우선순위<input data-studio-field="priority" type="number" value="${Number(programme.priority || 100)}"></label><label>Hero 대표 영화<select data-studio-field="heroMovieId"><option value="">첫 영화 사용</option>${heroOptions}</select></label></div>
      <label>Hero 이미지<input data-studio-field="heroImageUrl" value="${esc(programme.heroImageUrl || '')}" placeholder="대표 영화 backdrop을 기본값으로 사용"><span class="studio-field-actions"><button type="button" class="secondary-button mini" data-studio-pick-hero-image>대표 영화 이미지에서 고르기</button></span></label>
      <div class="studio-film-toolbar"><div><h3>${isArchive ? 'Archive 영화' : '큐레이션 영화'}</h3><p>${isArchive ? '자동 필모그래피가 아니라 공개할 작품만 직접 선택합니다.' : '각 영화에는 이 큐레이션에 포함된 이유를 반드시 작성합니다.'}</p></div><button type="button" class="secondary-button" data-studio-add-movie>+ 영화 추가</button></div>
      <div class="studio-film-list">${movieRows(programme, getMovie) || '<div class="empty-state compact"><b>아직 영화가 없습니다.</b></div>'}</div>
    </section><aside class="studio-preview-note"><p class="eyebrow">AUTHORING</p><h3>${isArchive ? '선택형 감독 아카이브' : '영화 + 큐레이터 설명'}</h3><p>${isArchive ? '졸작·단편·TV까지 자동 노출하지 않습니다. 관리자가 실제로 보여줄 작품만 고릅니다.' : '컬렉션과 구분되도록 각 영화에 편집 이유가 붙습니다.'}</p><dl><div><dt>상태</dt><dd>${esc(programme.status || 'draft')}</dd></div><div><dt>영화</dt><dd>${entries.length}편</dd></div></dl></aside></div></div>`;
}
