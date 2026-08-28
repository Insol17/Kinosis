import { createMovieSearchIndex } from './movie-search-index.js';

/**
 * Collection-local movie finder.
 *
 * UX policy: the collection's works remain primary. This controller stays
 * dormant until the user types, then performs local-first lookup and offers
 * add-only actions. Removal belongs to the collection's existing works grid.
 */
/** @param {any} deps */
export function createCollectionSearchController(deps) {
  const {
    catalogMovies = [], normalizeText, genreNames, uniqueMovies, escapeHtml, poster,
    movieRepository, canUseLiveApi, getCollection, onAddMovie, onChanged,
  } = deps;
  const localIndex = createMovieSearchIndex(catalogMovies, { normalizeText, genreNames });
  const states = new Map();
  const MIN_REMOTE_CHARS = 2;
  const DEBOUNCE = 120;

  function stateFor(collectionId) {
    const key = String(collectionId || '');
    if (!states.has(key)) states.set(key, { query: '', remoteQuery: '', remote: [], status: 'idle', timer: null, aborter: null, serial: 0 });
    return states.get(key);
  }

  function rootFor(collectionId) {
    return document.querySelector(`[data-collection-search-root="${CSS.escape(String(collectionId || ''))}"]`);
  }

  function resultRows(collectionId) {
    const state = stateFor(collectionId);
    if (!state.query) return [];
    const collection = getCollection(collectionId);
    const included = new Set((collection?.movieIds || []).map(String));
    const local = localIndex.search(state.query, 16);
    const remote = state.remoteQuery === state.query ? state.remote : [];
    return uniqueMovies([...local, ...remote]).filter(Boolean).slice(0, 24).map((record) => ({ record, added: included.has(String(record.id)) }));
  }

  function rowHtml({ record, added }) {
    const image = poster(record);
    return `<div class="collection-search-result"><button type="button" class="collection-search-film" data-movie="${escapeHtml(record.id)}">${image ? `<img src="${escapeHtml(image)}" alt="" loading="lazy" decoding="async">` : '<span class="collection-search-poster-empty">FILM</span>'}<span><b>${escapeHtml(record.title)}</b><small>${record.originalTitle && record.originalTitle !== record.title ? `${escapeHtml(record.originalTitle)} · ` : ''}${record.year || '—'}${record.director ? ` · ${escapeHtml(record.director)}` : ''}</small></span></button><button type="button" class="collection-search-add ${added ? 'is-added' : ''}" ${added ? 'disabled aria-disabled="true"' : `data-collection-search-add="${escapeHtml(record.id)}"`}>${added ? '✓ 추가됨' : '＋ 추가'}</button></div>`;
  }

  function render(collectionId) {
    const root = /** @type {HTMLElement | null} */ (rootFor(collectionId));
    if (!root) return;
    const state = stateFor(collectionId);
    const resultsHost = /** @type {HTMLElement | null} */ (root.querySelector('[data-collection-search-results]'));
    const meta = root.querySelector('[data-collection-search-meta]');
    if (!resultsHost) return;
    const rows = resultRows(collectionId);
    const hasQuery = !!state.query;
    root.classList.toggle('has-query', hasQuery);
    resultsHost.hidden = !hasQuery;
    if (meta) {
      if (!hasQuery) meta.textContent = '';
      else if (state.status === 'loading' || state.status === 'queued') meta.textContent = rows.length ? '온라인에서 더 찾는 중…' : '검색 중…';
      else if (state.status === 'error') meta.textContent = '온라인 검색을 사용할 수 없습니다.';
      else meta.textContent = rows.length ? `${rows.length}개 결과` : '';
    }
    resultsHost.innerHTML = rows.length
      ? rows.map(rowHtml).join('')
      : hasQuery && state.status !== 'loading' && state.status !== 'queued'
        ? '<div class="collection-search-empty">검색 결과가 없습니다.</div>'
        : '';
  }

  async function runRemote(collectionId, query, serial) {
    const state = stateFor(collectionId);
    if (!canUseLiveApi() || query.length < MIN_REMOTE_CHARS) return;
    state.aborter?.abort();
    state.aborter = new AbortController();
    state.status = 'loading';
    render(collectionId);
    try {
      const data = await movieRepository.search(query, { signal: state.aborter.signal });
      if (serial !== state.serial) return;
      state.remoteQuery = query;
      state.remote = (data.results || []).filter(Boolean);
      state.status = 'done';
    } catch (error) {
      if (error?.name === 'AbortError' || error?.code === 'ABORTED' || serial !== state.serial) return;
      state.remoteQuery = query;
      state.remote = [];
      state.status = 'error';
    }
    render(collectionId);
  }

  function queue(collectionId, value) {
    const state = stateFor(collectionId);
    const query = String(value || '').trim();
    state.query = query;
    clearTimeout(state.timer);
    const serial = ++state.serial;
    if (!query || query.length < MIN_REMOTE_CHARS || !canUseLiveApi()) {
      state.status = 'idle';
      if (!query) {
        state.remoteQuery = '';
        state.remote = [];
      }
      render(collectionId);
      return;
    }
    if (state.remoteQuery === query && state.status === 'done') {
      render(collectionId);
      return;
    }
    state.status = 'queued';
    render(collectionId);
    state.timer = setTimeout(() => runRemote(collectionId, query, serial), DEBOUNCE);
  }

  function mount(collectionId) {
    const root = /** @type {HTMLElement | null} */ (rootFor(collectionId));
    if (!root || root.dataset.collectionSearchBound === '1') return;
    root.dataset.collectionSearchBound = '1';
    const state = stateFor(collectionId);
    const field = /** @type {HTMLInputElement | null} */ (root.querySelector('[data-collection-search-input]'));
    if (field) {
      field.value = state.query;
      let composing = false;
      field.addEventListener('compositionstart', () => { composing = true; });
      field.addEventListener('compositionend', (event) => { composing = false; queue(collectionId, /** @type {HTMLInputElement} */ (event.target).value); });
      field.addEventListener('input', (event) => { if (!composing) queue(collectionId, /** @type {HTMLInputElement} */ (event.target).value); });
      field.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape' || !field.value) return;
        field.value = '';
        queue(collectionId, '');
        field.focus();
      });
    }
    root.addEventListener('click', async (event) => {
      const target = event.target instanceof Element ? event.target : null;
      const button = /** @type {HTMLButtonElement | null} */ (target?.closest('[data-collection-search-add]') || null);
      if (!button || button.disabled) return;
      const id = button.dataset.collectionSearchAdd;
      const record = resultRows(collectionId).find((row) => String(row.record.id) === String(id))?.record || null;
      if (!record) return;
      button.disabled = true;
      button.textContent = '추가 중…';
      const changed = await onAddMovie(collectionId, record);
      if (changed) onChanged?.(collectionId);
      else render(collectionId);
    });
    render(collectionId);
  }

  function reset(collectionId) {
    const state = states.get(String(collectionId || ''));
    if (!state) return;
    clearTimeout(state.timer);
    state.aborter?.abort();
    states.delete(String(collectionId || ''));
  }

  return Object.freeze({ mount, queue, render, reset, DEBOUNCE, MIN_REMOTE_CHARS });
}
