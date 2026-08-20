(function () {
  'use strict';

  /**
   * Director Archive loader.
   *
   * Snapshot rows are content, live TMDB is enrichment. A failed live request
   * must never turn a populated archive into an empty archive, and network
   * errors are not the same state as a genuinely empty filmography.
   */
  function create({ fetchDirector, fallbackDirector, normalizeRows }) {
    const states = new Map();
    const loads = new Map();
    const keyFor = (value) => String(value || '');
    const normalize = (rows) => normalizeRows ? normalizeRows(rows || []) : (rows || []);

    function snapshotRows(item) {
      const rows = item?.source?.snapshot;
      return Array.isArray(rows) ? normalize(rows) : [];
    }

    function seed(item) {
      const slug = keyFor(item?.slug);
      if (!slug) return null;
      const existing = states.get(slug);
      if (existing) return existing.rows;
      const rows = snapshotRows(item);
      states.set(slug, {
        status: rows.length ? 'ready' : 'idle',
        rows,
        source: rows.length ? 'snapshot' : null,
        error: null,
        updatedAt: item?.source?.snapshotGeneratedAt || null,
      });
      return rows;
    }

    function peek(slug) {
      return states.get(keyFor(slug))?.rows || null;
    }

    function state(slug) {
      const value = states.get(keyFor(slug));
      return value ? { ...value, rows: value.rows.slice() } : { status: 'idle', rows: [], source: null, error: null, updatedAt: null };
    }

    function snapshotFresh(item, maxAgeMs = 30 * 24 * 60 * 60 * 1000) {
      const stamp = Date.parse(item?.source?.snapshotGeneratedAt || 0) || 0;
      return !!stamp && Date.now() - stamp < maxAgeMs && snapshotRows(item).length > 0;
    }

    async function ensure(item, { force = false } = {}) {
      if (!item?.source || item.source.type !== 'director') return { changed: false, rows: null, status: 'idle' };
      const slug = keyFor(item.slug);
      if (!slug) return { changed: false, rows: null, status: 'idle' };
      seed(item);
      const current = states.get(slug);
      // Portfolio-safe archives are content snapshots first. Fresh snapshots do
      // not need a live TMDB refresh on every visit.
      if (!force && current?.source === 'snapshot' && snapshotFresh(item)) {
        return { changed: false, stateChanged: false, rows: current.rows, status: current.status, skipped: 'fresh-snapshot' };
      }
      if (!force && current?.source === 'live' && (current.status === 'ready' || current.status === 'empty')) {
        return { changed: false, stateChanged: false, rows: current.rows, status: current.status };
      }
      // Error is a stable UI state until the user explicitly retries. Otherwise a
      // rerender would immediately start another failing request and could loop.
      if (!force && current?.status === 'error') {
        return { changed: false, stateChanged: false, rows: current.rows, status: 'error', error: current.error };
      }
      if (loads.has(slug)) return loads.get(slug);

      const previousStatus = current?.status || 'idle';
      const previousSource = current?.source || null;
      const beforeSignature = (current?.rows || []).map((row) => String(row?.id || '')).join('|');
      states.set(slug, { ...current, status: 'loading', error: null });

      const task = (async () => {
        try {
          let rows = normalize(await fetchDirector(item));
          if (!rows.length && fallbackDirector) rows = normalize(await fallbackDirector(item));
          const previous = states.get(slug);
          // A genuinely successful empty response may be represented as empty,
          // but a static snapshot is retained because it is the portfolio-safe
          // source of truth until an explicit content rebuild replaces it.
          const snapshot = snapshotRows(item);
          const finalRows = rows.length ? rows : snapshot;
          const status = rows.length || snapshot.length ? 'ready' : 'empty';
          const source = rows.length ? 'live' : snapshot.length ? 'snapshot' : 'live';
          states.set(slug, { status, rows: finalRows, source, error: null, updatedAt: new Date().toISOString() });
          const afterSignature = finalRows.map((row) => String(row?.id || '')).join('|');
          return {
            changed: beforeSignature !== afterSignature,
            stateChanged: previousStatus !== status || previousSource !== source,
            rows: finalRows,
            status,
          };
        } catch (error) {
          const previous = states.get(slug) || { rows: [] };
          let fallback = previous.rows || [];
          try {
            if (!fallback.length && fallbackDirector) fallback = normalize(await fallbackDirector(item));
          } catch { /* fallback is best-effort */ }
          const snapshot = snapshotRows(item);
          if (!fallback.length && snapshot.length) fallback = snapshot;
          states.set(slug, {
            status: 'error',
            rows: fallback,
            source: fallback.length ? (snapshot.length ? 'snapshot' : 'fallback') : null,
            error: error?.message || 'Director archive failed.',
            updatedAt: previous.updatedAt || null,
          });
          return { changed: false, stateChanged: previousStatus !== 'error', rows: fallback, status: 'error', error };
        }
      })().finally(() => loads.delete(slug));

      loads.set(slug, task);
      return task;
    }

    return Object.freeze({
      ensure,
      retry: (item) => ensure(item, { force: true }),
      seed,
      peek,
      state,
      isLoading: (slug) => loads.has(keyFor(slug)),
    });
  }

  window.KINOSIS_CURATION_LOADER = Object.freeze({ create });
})();
