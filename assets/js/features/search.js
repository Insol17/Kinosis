export function createSearchController(deps) {
    const {
      catalogMovies, normalizeText, uniqueMovies, genreNames, escapeHtml, poster, rememberMovie,
      lib, isSignedIn, canUseLiveApi, movieRepository, showDialog, prefetchMovieDetail,
    } = deps;
    const MIN_CHARS = 2;
    const DEBOUNCE = 250;
    let timer = null;
    let aborter = null;
    let serial = 0;
    let composing = false;
    let live = { query: '', status: 'idle', results: [], people: [], message: '' };
    let person = { status: 'idle', person: null, results: [] };
    const prefetchTimers = new WeakMap();

    const resultRoot = () => /** @type {HTMLElement | null} */ (document.getElementById('searchResults'));
    const input = () => /** @type {HTMLInputElement | null} */ (document.getElementById('searchInput'));

    function score(record, query) {
      const needle = normalizeText(query);
      const title = normalizeText(record.title);
      const original = normalizeText(record.originalTitle);
      const director = normalizeText(record.director);
      let value = 0;
      if (title === needle || original === needle) value += 1000;
      if (title.startsWith(needle) || original.startsWith(needle)) value += 320;
      if (title.includes(needle) || original.includes(needle)) value += 150;
      if (director === needle) value += 130;
      else if (director.includes(needle)) value += 55;
      if (genreNames(record).some((genre) => normalizeText(genre) === needle)) value += 90;
      value += Math.min(30, Math.log10(Math.max(1, Number(record.voteCount || 0))) * 6);
      value += Math.min(20, Number(record.popularity || 0) / 50);
      return value;
    }

    function localSearch(query) {
      const needle = normalizeText(query);
      if (!needle) return [];
      return (catalogMovies || []).filter((record) => {
        const haystack = [record.title, record.originalTitle, record.director, ...(record.cast || []).map((p) => p?.name || p), ...genreNames(record)]
          .filter(Boolean).map(normalizeText).join(' ');
        return haystack.includes(needle);
      });
    }

    function combined(query) {
      const local = localSearch(query);
      const remote = live.query === query ? live.results : [];
      return uniqueMovies([...local, ...remote]).sort((a, b) => score(b, query) - score(a, query));
    }

    function movieRow(record, exact = false) {
      const action = isSignedIn()
        ? `<div class="search-actions"><button class="secondary-button" data-action="watchlist" data-id="${escapeHtml(record.id)}">${lib(record.id)?.watchlist ? '✓ 보고싶어요' : '＋ 보고싶어요'}</button><button class="secondary-button" data-action="log" data-id="${escapeHtml(record.id)}">감상 기록</button></div>`
        : '';
      const posterUrl = poster(record);
      const media = posterUrl ? `<span class="search-poster-media"><span class="search-poster-placeholder"><span>FILM</span></span><img data-poster-image src="${escapeHtml(posterUrl)}" alt=""></span>` : '<span class="search-poster-placeholder"><span>FILM</span></span>';
      return `<article class="search-result${exact ? ' is-exact' : ''}" data-movie="${escapeHtml(record.id)}" tabindex="-1" role="option" aria-label="${escapeHtml(record.title)} ${record.year || ''}">
        ${media}
        <div class="search-result-copy"><h3>${escapeHtml(record.title)}</h3><p>${record.originalTitle && record.originalTitle !== record.title ? `${escapeHtml(record.originalTitle)} · ` : ''}${record.year || '—'}${record.director ? ` · ${escapeHtml(record.director)}` : ''}${record.personRole ? ` · ${escapeHtml(record.personRole)}` : ''}</p></div>${action}
      </article>`;
    }

    function personRow(row) {
      return `<button class="person-result" data-person-id="${escapeHtml(row.id)}" data-person-name="${escapeHtml(row.name)}" tabindex="-1" role="option">
        ${row.profileUrl ? `<img src="${escapeHtml(row.profileUrl)}" alt="">` : '<span class="person-avatar-placeholder"></span>'}
        <span><b>${escapeHtml(row.name)}</b><small>${escapeHtml(row.knownForDepartment || 'Person')}</small></span><span class="person-arrow">›</span>
      </button>`;
    }

    function options() {
      const root = resultRoot();
      return root ? /** @type {HTMLElement[]} */ (Array.from(root.querySelectorAll('[role="option"]'))) : [];
    }

    function focusOption(index) {
      const rows = options();
      if (!rows.length) return;
      const target = rows[(index + rows.length) % rows.length];
      rows.forEach((row) => row.setAttribute('aria-selected', row === target ? 'true' : 'false'));
      target.focus();
      target.scrollIntoView({ block: 'nearest' });
    }

    function render(query = '') {
      const root = resultRoot();
      if (!root) return;
      const trimmed = query.trim();
      root.setAttribute('role', 'listbox');
      root.setAttribute('aria-label', '검색 결과');
      if (person.status === 'ready' && person.person) {
        root.innerHTML = `<div class="person-filmography-head"><button class="secondary-button" data-search-back>← 검색 결과</button><div><p class="eyebrow">FILMOGRAPHY</p><h2>${escapeHtml(person.person.name)}</h2><p>${escapeHtml(person.person.knownForDepartment || '')}</p></div></div>${person.results.length ? person.results.map((row) => movieRow(row)).join('') : '<div class="empty-state"><b>표시할 영화가 없습니다.</b></div>'}`;
        return;
      }
      if (!trimmed) {
        const recent = uniqueMovies(deps.trendingMovies || []).slice(0, 8);
        root.innerHTML = `<section class="search-section"><div class="search-section-label">지금 많이 찾는 영화</div>${recent.map((row) => movieRow(row)).join('')}</section>`;
        return;
      }
      const results = combined(trimmed);
      const people = live.query === trimmed ? live.people || [] : [];
      const exact = results.filter((row) => [row.title, row.originalTitle].some((value) => normalizeText(value) === normalizeText(trimmed)));
      const exactIds = new Set(exact.map((row) => String(row.id)));
      const others = results.filter((row) => !exactIds.has(String(row.id)));
      const status = live.status === 'loading' ? '<div class="search-status" role="status">온라인 결과를 합치는 중…</div>' : live.status === 'error' ? '<div class="search-status" role="status">온라인 검색을 사용할 수 없어 로컬 결과만 표시합니다.</div>' : '';
      const peopleHtml = people.length ? `<section class="search-section search-people"><div class="search-section-label">인물</div>${people.slice(0, 6).map(personRow).join('')}</section>` : '';
      const exactHtml = exact.length ? `<section class="search-section"><div class="search-section-label">정확히 일치</div>${exact.slice(0, 4).map((row) => movieRow(row, true)).join('')}</section>` : '';
      const moviesHtml = others.length ? `<section class="search-section"><div class="search-section-label">영화</div>${others.slice(0, 24).map((row) => movieRow(row)).join('')}</section>` : (!exact.length ? '<div class="empty-state"><b>검색 결과가 없습니다.</b></div>' : '');
      root.innerHTML = status + peopleHtml + exactHtml + moviesHtml;
    }

    async function run(query, runSerial) {
      if (!canUseLiveApi() || query.length < MIN_CHARS) return;
      aborter?.abort();
      aborter = new AbortController();
      live = { query, status: 'loading', results: live.query === query ? live.results : [], people: live.query === query ? live.people : [], message: '' };
      render(query);
      try {
        const data = await movieRepository.search(query, { signal: aborter.signal });
        if (runSerial !== serial) return;
        live = { query, status: 'done', results: data.results || [], people: data.people || [], message: '' };
      } catch (error) {
        if (error?.name === 'AbortError' || runSerial !== serial) return;
        live = { query, status: 'error', results: [], people: [], message: error.message || 'Live search failed' };
      }
      render(query);
    }

    function queue(value) {
      const query = value.trim();
      clearTimeout(timer);
      const runSerial = ++serial;
      person = { status: 'idle', person: null, results: [] };
      if (query !== live.query) live = { query, status: 'idle', results: [], people: [], message: '' };
      render(query); // instant local results
      if (composing || query.length < MIN_CHARS || !canUseLiveApi()) return;
      timer = setTimeout(() => run(query, runSerial), DEBOUNCE);
    }

    function open() {
      const context = document.getElementById('searchContext');
      if (context) context.textContent = '영화와 인물을 함께 찾습니다. 로컬 결과를 즉시 표시하고 온라인 결과를 합칩니다.';
      showDialog('searchDialog');
      const field = input();
      field.value = '';
      live = { query: '', status: 'idle', results: [], people: [], message: '' };
      person = { status: 'idle', person: null, results: [] };
      render('');
      setTimeout(() => field.focus(), 30);
    }

    async function openPersonFilmography(id, name = '') {
      if (!canUseLiveApi()) return;
      person = { status: 'loading', person: { id, name }, results: [] };
      resultRoot().innerHTML = `<div class="detail-loading"><div class="loading-ring"></div><b>${escapeHtml(name || 'Filmography')}</b><span>필모그래피를 불러오는 중…</span></div>`;
      try {
        const data = await movieRepository.personFilms(id);
        person = { status: 'ready', person: data.person, results: (data.results || []).map((row) => rememberMovie({ ...row, source: 'tmdb-live', detailLoaded: false })).filter(Boolean) };
      } catch {
        person = { status: 'error', person: { id, name }, results: [] };
      }
      render(input()?.value || '');
    }

    function backFromPerson() {
      person = { status: 'idle', person: null, results: [] };
      render(input()?.value || '');
    }

    function attach() {
      const field = input();
      if (!field || field.dataset.searchBound === '1') return;
      field.dataset.searchBound = '1';
      field.setAttribute('role', 'combobox');
      field.setAttribute('aria-autocomplete', 'list');
      field.setAttribute('aria-controls', 'searchResults');
      field.setAttribute('aria-expanded', 'true');
      field.addEventListener('compositionstart', () => { composing = true; });
      field.addEventListener('compositionend', (event) => { composing = false; queue(/** @type {HTMLInputElement} */ (event.target).value); });
      field.addEventListener('input', (event) => { if (!composing) queue(/** @type {HTMLInputElement} */ (event.target).value); });
      field.addEventListener('keydown', (event) => {
        if (event.key === 'ArrowDown') { event.preventDefault(); focusOption(0); }
        else if (event.key === 'ArrowUp') { event.preventDefault(); focusOption(options().length - 1); }
      });
      resultRoot()?.addEventListener('keydown', (event) => {
        const rows = options();
        const index = rows.indexOf(document.activeElement instanceof HTMLElement ? document.activeElement : /** @type {HTMLElement} */ (null));
        if (index < 0) return;
        if (event.key === 'ArrowDown') { event.preventDefault(); focusOption(index + 1); }
        else if (event.key === 'ArrowUp') { event.preventDefault(); if (index === 0) field.focus(); else focusOption(index - 1); }
        else if (event.key === 'Enter') { event.preventDefault(); if (document.activeElement instanceof HTMLElement) document.activeElement.click(); }
        else if (event.key === 'Escape') { event.preventDefault(); field.focus(); }
      });
    }

    /** @param {Element | null} target */
    function prefetchFromTarget(target) {
      const movieRow = /** @type {HTMLElement | null} */ (target?.closest?.('[data-movie]') || null);
      if (!movieRow?.dataset.movie) return;
      prefetchMovieDetail?.(movieRow.dataset.movie);
    }

    resultRoot()?.addEventListener('pointerover', (event) => {
      const target = event.target instanceof Element ? event.target : null;
      const row = /** @type {HTMLElement | null} */ (target?.closest?.('[data-movie]') || null);
      if (!row || row.dataset.prefetchArmed === '1') return;
      row.dataset.prefetchArmed = '1';
      prefetchTimers.set(row, setTimeout(() => prefetchFromTarget(row), 120));
    });
    resultRoot()?.addEventListener('pointerout', (event) => {
      const target = event.target instanceof Element ? event.target : null;
      const row = /** @type {HTMLElement | null} */ (target?.closest?.('[data-movie]') || null);
      if (!row) return;
      clearTimeout(prefetchTimers.get(row));
      prefetchTimers.delete(row);
      row.dataset.prefetchArmed = '0';
    });
    resultRoot()?.addEventListener('focusin', (event) => prefetchFromTarget(event.target instanceof Element ? event.target : null));

    return Object.freeze({ attach, open, queue, render, openPersonFilmography, backFromPerson, get composing() { return composing; } });
}
