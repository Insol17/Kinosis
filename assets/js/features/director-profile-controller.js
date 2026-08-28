/**
 * Lazily enriches rendered Director Archive cards with TMDB person portraits.
 * The controller owns viewport observation, batching and profile cache only;
 * Arthouse layout/rendering stays in arthouse-directory.js.
 */
/** @param {{repository:any, keyFor:(value:any)=>string, batchSize?:number}} options */
export function createDirectorProfileController(options) {
  const { repository, keyFor, batchSize = 10 } = options || /** @type {any} */ ({});
  if (!repository?.directorProfiles) throw new Error('directorProfiles repository is required');
  if (typeof keyFor !== 'function') throw new Error('keyFor is required');

  const cache = new Map();
  const queued = new Map();
  let observer = null;
  let flushTimer = null;
  let flushing = false;

  function get(entry) {
    if (!entry?.name) return null;
    return cache.get(keyFor(entry.name)) || null;
  }

  function patchCard(card, profile) {
    if (!card || !profile) return;
    if (profile.personId) card.dataset.directorPersonId = String(profile.personId);
    if (!profile.profileUrl) {
      card.classList.remove('is-photo-loading');
      card.classList.add('is-photo-unavailable');
      return;
    }
    const photo = card.querySelector('.director-index-photo');
    if (!photo || photo.querySelector('img')) return;
    const img = document.createElement('img');
    img.src = profile.profileUrl;
    img.alt = card.dataset.directorDisplay || card.dataset.directorOpen || '';
    img.loading = 'lazy';
    photo.prepend(img);
    photo.querySelector('.director-photo-fallback')?.remove();
    card.classList.remove('is-photo-loading', 'is-photo-unavailable');
    card.classList.add('has-photo');
  }

  function patchVisibleCards(root, profile) {
    const key = keyFor(profile?.name);
    if (!key || !root) return;
    root.querySelectorAll('[data-director-open]').forEach((card) => {
      if (keyFor(card.dataset.directorOpen) === key) patchCard(card, profile);
    });
  }

  async function flush(root) {
    if (flushing || !queued.size) return;
    flushing = true;
    const entries = [...queued.values()].slice(0, batchSize);
    entries.forEach((entry) => queued.delete(keyFor(entry.name)));
    try {
      const data = await repository.directorProfiles(entries.map((entry) => entry.name)).catch(() => ({ results: [] }));
      const returned = new Map((data.results || []).map((row) => [keyFor(row.name), row]));
      for (const entry of entries) {
        const key = keyFor(entry.name);
        const profile = returned.get(key) || { name: entry.name, personId: entry.personId || '', profileUrl: entry.profileUrl || null, unavailable: true };
        cache.set(key, profile);
        patchVisibleCards(root, profile);
      }
    } finally {
      flushing = false;
      if (queued.size) scheduleFlush(root);
    }
  }

  function scheduleFlush(root) {
    if (flushTimer) return;
    flushTimer = setTimeout(() => {
      flushTimer = null;
      flush(root).catch(() => {});
    }, 24);
  }

  function enqueue(root, entry) {
    const key = keyFor(entry?.name);
    if (!key) return;
    const cached = cache.get(key);
    if (cached) {
      patchVisibleCards(root, cached);
      return;
    }
    queued.set(key, entry);
    scheduleFlush(root);
  }

  function observe(root, entries = []) {
    observer?.disconnect?.();
    observer = null;
    if (!root || !entries.length) return;
    const byKey = new Map(entries.map((entry) => [keyFor(entry.name), entry]));
    const cards = [...root.querySelectorAll('[data-director-open]')];
    for (const card of cards) {
      const cached = cache.get(keyFor(card.dataset.directorOpen));
      if (cached) patchCard(card, cached);
    }
    const pendingCards = cards.filter((card) => !cache.has(keyFor(card.dataset.directorOpen)));
    if (!pendingCards.length) return;

    if (typeof IntersectionObserver !== 'function') {
      pendingCards.forEach((card) => {
        const entry = byKey.get(keyFor(card.dataset.directorOpen));
        if (entry) enqueue(root, entry);
      });
      return;
    }

    observer = new IntersectionObserver((rows) => {
      for (const row of rows) {
        if (!row.isIntersecting) continue;
        observer?.unobserve(row.target);
        const card = /** @type {HTMLElement} */ (row.target);
        const entry = byKey.get(keyFor(card.dataset.directorOpen));
        if (entry) enqueue(root, entry);
      }
    }, { rootMargin: '520px 0px' });
    pendingCards.forEach((card) => observer.observe(card));
  }

  function disconnect() {
    observer?.disconnect?.();
    observer = null;
    if (flushTimer) clearTimeout(flushTimer);
    flushTimer = null;
    queued.clear();
  }

  return Object.freeze({ get, observe, disconnect });
}
