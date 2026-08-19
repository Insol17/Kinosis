export function createRouter({ canUseHistory = () => true, locationRef = globalThis.location, historyRef = globalThis.history } = {}) {
  function baseUrl() { return new URL(locationRef.href); }
  function viewUrl(view) {
    const url = baseUrl();
    url.search = '';
    if (view !== 'discover') url.searchParams.set('view', view);
    return `${url.pathname}${url.search}${url.hash}`;
  }
  function movieUrl(id, from, fromCuration = '') {
    const url = baseUrl();
    url.search = '';
    url.searchParams.set('movie', String(id));
    if (from && from !== 'discover') url.searchParams.set('from', from);
    if (from === 'curation' && fromCuration) url.searchParams.set('fromCuration', fromCuration);
    return `${url.pathname}${url.search}`;
  }
  function curationUrl(slug, from) {
    const url = baseUrl();
    url.search = '';
    url.searchParams.set('curation', String(slug));
    if (from && from !== 'arthouse') url.searchParams.set('from', from);
    return `${url.pathname}${url.search}`;
  }
  function write(state, url, mode = 'push') {
    if (!canUseHistory() || mode === 'none') return;
    if (mode === 'replace') historyRef.replaceState(state, '', url);
    else historyRef.pushState(state, '', url);
  }
  return Object.freeze({ viewUrl, movieUrl, curationUrl, write });
}
