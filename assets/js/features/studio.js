function esc(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
}

export function emptyProgramme(kind = 'editorial') {
  const slug = `programme-${Date.now()}`;
  return kind === 'director-archive'
    ? { slug, kind, surface: 'arthouse', status: 'draft', eyebrow: 'DIRECTOR ARCHIVE', title: '', subtitle: '', description: '', credit: 'Curated by KINOSIS', heroMovieId: '', priority: 100, source: { type: 'director', name: '', personId: '', sort: 'release_asc', mode: 'all-directed', include: [], exclude: [], snapshot: [], snapshotGeneratedAt: null }, movies: [], chapters: [] }
    : { slug, kind: 'editorial', surface: 'arthouse', status: 'draft', eyebrow: 'KINOSIS CURATION', title: '', subtitle: '', description: '', introduction: [], credit: 'Curated by KINOSIS', heroMovieId: '', priority: 100, source: null, movies: [], chapters: [] };
}

export function orderedEditorialEntries(programme) {
  const rows = [];
  for (const entry of programme?.movies || []) if (entry?.id) rows.push({ id: String(entry.id), note: String(entry.note || '') });
  for (const chapter of programme?.chapters || []) {
    for (const entry of chapter?.movies || []) if (entry?.id && !rows.some((row) => row.id === String(entry.id))) rows.push({ id: String(entry.id), note: String(entry.note || '') });
  }
  return rows;
}

export function renderStudioHome(programmes) {
  const rows = (programmes || []).map((item) => `<article class="studio-programme-row" data-studio-row="${esc(item.slug)}">
    <div><span class="studio-kind">${item.kind === 'director-archive' ? 'DIRECTOR ARCHIVE' : 'EDITORIAL'}</span><h3>${esc(item.title || '제목 없음')}</h3><p>${esc(item.description || '')}</p></div>
    <div class="studio-row-meta"><span class="studio-status is-${esc(item.status || 'draft')}">${esc(String(item.status || 'draft').toUpperCase())}</span><small>${esc(item.updatedAt || '')}</small></div>
    <div class="studio-row-actions"><button class="secondary-button mini" data-studio-edit="${esc(item.slug)}">편집</button><button class="secondary-button mini" data-studio-preview="${esc(item.slug)}">미리보기</button>${item.status !== 'archived' ? `<button class="secondary-button mini" data-studio-archive="${esc(item.slug)}">보관</button>` : ''}</div>
  </article>`).join('');
  return `<div class="studio-shell"><header class="studio-header"><div><p class="eyebrow">ADMIN ONLY</p><h1>KINOSIS STUDIO</h1><p>Arthouse 프로그램을 코드 수정 없이 제작·검수·발행합니다.</p></div><div class="studio-create-actions"><button class="primary-button" data-studio-new="editorial">+ Editorial</button><button class="secondary-button" data-studio-new="director-archive">+ Director Archive</button></div></header><section class="studio-list">${rows || '<div class="empty-state"><b>Studio 프로그램이 없습니다.</b><span>기존 정적 큐레이션은 그대로 서비스되며, 새 프로그램부터 Studio에서 관리할 수 있습니다.</span></div>'}</section></div>`;
}

function movieRows(programme, getMovie) {
  const entries = orderedEditorialEntries(programme);
  return entries.map((entry, index) => {
    const movie = getMovie?.(entry.id);
    return `<div class="studio-film-row" data-studio-film-index="${index}"><span class="studio-film-order">${String(index + 1).padStart(2, '0')}</span><div class="studio-film-copy"><b>${esc(movie?.title || `TMDB ${entry.id}`)}</b><small>${esc(movie?.year || '')}</small><textarea data-studio-film-note="${index}" rows="2" maxlength="220" placeholder="이 순서에 이 작품을 둔 이유 · 선택 사항">${esc(entry.note)}</textarea></div><div class="studio-film-actions"><button type="button" data-studio-film-up="${index}" aria-label="위로">↑</button><button type="button" data-studio-film-down="${index}" aria-label="아래로">↓</button><button type="button" data-studio-film-remove="${index}" aria-label="제거">×</button></div></div>`;
  }).join('');
}

export function renderStudioEditor(programme, getMovie) {
  const isArchive = programme.kind === 'director-archive';
  const entries = orderedEditorialEntries(programme);
  return `<div class="studio-editor-shell"><div class="studio-editor-top"><button class="secondary-button mini" data-studio-back>← Studio</button><div><span class="studio-kind">${isArchive ? 'DIRECTOR ARCHIVE' : 'EDITORIAL'}</span><h1>${esc(programme.title || '새 프로그램')}</h1></div><div class="studio-editor-actions"><button class="secondary-button" data-studio-preview-current>미리보기</button><button class="secondary-button" data-studio-save="draft">초안 저장</button><button class="primary-button" data-studio-save="published">공개</button></div></div>
    <div class="studio-editor-grid"><section class="studio-form-panel">
      <label>Slug<input data-studio-field="slug" value="${esc(programme.slug)}" maxlength="63"></label>
      <label>제목<input data-studio-field="title" value="${esc(programme.title || '')}" maxlength="120"></label>
      <label>부제<input data-studio-field="subtitle" value="${esc(programme.subtitle || '')}" maxlength="160"></label>
      <label>짧은 소개<textarea data-studio-field="description" rows="4" maxlength="800">${esc(programme.description || '')}</textarea></label>
      <div class="studio-inline-fields"><label>우선순위<input data-studio-field="priority" type="number" value="${Number(programme.priority || 100)}"></label><label>Hero 영화 ID<input data-studio-field="heroMovieId" value="${esc(programme.heroMovieId || '')}" inputmode="numeric"></label></div>
      ${isArchive ? `<div class="studio-archive-fields"><label>감독 이름<input data-studio-director="name" value="${esc(programme.source?.name || '')}" placeholder="Christian Petzold"></label><label>TMDB Person ID<input data-studio-director="personId" value="${esc(programme.source?.personId || '')}" inputmode="numeric"></label><button type="button" class="secondary-button" data-studio-director-sync>필모그래피 동기화</button><p class="studio-help">동기화 결과는 snapshot으로 저장되어 런타임 API가 느려도 Archive가 비지 않습니다.</p></div>` : `<label>서문<textarea data-studio-field="intro" rows="5" maxlength="1200">${esc((programme.introduction || [])[0] || '')}</textarea></label><div class="studio-film-toolbar"><div><h3>영화 순서</h3><p>큐레이션은 짧은 서문 + 순서 있는 영화 목록 + 작품별 짧은 코멘트로 구성합니다.</p></div><button type="button" class="secondary-button" data-studio-add-movie>+ 영화 추가</button></div><div class="studio-film-list">${movieRows(programme, getMovie) || '<div class="empty-state compact"><b>아직 영화가 없습니다.</b></div>'}</div>`}
    </section><aside class="studio-preview-note"><p class="eyebrow">AUTHORING RULE</p><h3>같은 KINOSIS, 다른 표면</h3><p>폰트·버튼·카드는 일반 화면과 공유합니다. Arthouse 차이는 필름 그레인, 얇은 프레임, 퍼포레이션 모티프처럼 배경 표면에서만 만듭니다.</p><dl><div><dt>상태</dt><dd>${esc(programme.status || 'draft')}</dd></div><div><dt>영화</dt><dd>${isArchive ? `${programme.source?.snapshot?.length || 0} snapshot` : `${entries.length}편`}</dd></div></dl></aside></div></div>`;
}
