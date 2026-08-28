/**
 * Discover Curation Spotlight
 *
 * Keeps the Discover surface product-like while exposing a small editorial
 * doorway into Arthouse. Rendering and carousel behaviour live here so app.js
 * only supplies data and the open action.
 */

export const DISCOVER_CURATION_SPOTLIGHT_COUNT = 3;

export function selectDiscoverCurations(items = [], preferredSlugs = [], limit = DISCOVER_CURATION_SPOTLIGHT_COUNT) {
  const editorial = (items || []).filter((item) => item?.kind === 'editorial');
  const bySlug = new Map(editorial.map((item) => [String(item.slug), item]));
  const chosen = [];
  const seen = new Set();
  for (const slug of preferredSlugs || []) {
    const item = bySlug.get(String(slug));
    if (!item || seen.has(String(item.slug))) continue;
    seen.add(String(item.slug));
    chosen.push(item);
    if (chosen.length >= limit) return chosen;
  }
  for (const item of editorial) {
    if (!item?.slug || seen.has(String(item.slug))) continue;
    seen.add(String(item.slug));
    chosen.push(item);
    if (chosen.length >= limit) break;
  }
  return chosen;
}

export function renderDiscoverCurationCarousel({ items = [], imageFor, escapeHtml }) {
  if (!items.length) return '';
  const slides = items.map((item, index) => {
    const image = imageFor?.(item) || '';
    return `<article class="discover-curation-slide ${index === 0 ? 'is-active' : ''}" data-discover-curation-slide="${index}" aria-hidden="${index === 0 ? 'false' : 'true'}">
      ${image ? `<img src="${escapeHtml(image)}" alt="" ${index ? 'loading="lazy"' : ''} decoding="async">` : '<span class="discover-curation-fallback" aria-hidden="true"></span>'}
      <span class="discover-curation-shade"></span>
      <button type="button" class="discover-curation-open" data-curation="${escapeHtml(item.slug)}" tabindex="${index === 0 ? '0' : '-1'}" aria-label="${escapeHtml(item.title)} 큐레이션 보기"></button>
      <span class="discover-curation-copy" aria-hidden="true"><small>CURATED IN ARTHOUSE</small><b>${escapeHtml(item.title)}</b>${item.description ? `<em>${escapeHtml(item.description)}</em>` : ''}<strong>큐레이션 보기 →</strong></span>
    </article>`;
  }).join('');
  return `<section class="discover-curation-carousel" data-discover-curation-carousel aria-label="KINOSIS 큐레이션" aria-roledescription="carousel">
    <div class="discover-curation-viewport"><div class="discover-curation-track">${slides}</div></div>
    ${items.length > 1 ? `<div class="discover-curation-controls"><button type="button" data-discover-curation-dir="-1" aria-label="이전 큐레이션">←</button><span class="discover-curation-dots">${items.map((_, index) => `<button type="button" class="${index === 0 ? 'is-active' : ''}" data-discover-curation-index="${index}" aria-label="${index + 1}번째 큐레이션" aria-current="${index === 0 ? 'true' : 'false'}"><span></span></button>`).join('')}</span><button type="button" data-discover-curation-dir="1" aria-label="다음 큐레이션">→</button></div>` : ''}
  </section>`;
}

/** @param {{getActiveView?:()=>string, interval?:number}} options */
export function createDiscoverCurationCarouselController(options = {}) {
  const { getActiveView, interval = 6200 } = options;
  let root = null;
  let timer = null;
  let observer = null;
  let index = 0;
  let inView = false;
  let manualPaused = false;
  let pointerStartX = null;
  let pointerStartY = null;

  function count() { return root?.querySelectorAll('[data-discover-curation-slide]').length || 0; }
  function stop() { if (timer) clearTimeout(timer); timer = null; }
  function canRotate() {
    return !!root && count() > 1 && inView && !manualPaused && getActiveView?.() === 'discover' && !matchMedia('(prefers-reduced-motion: reduce)').matches;
  }
  function schedule() {
    stop();
    if (!canRotate()) return;
    timer = setTimeout(() => apply(index + 1), interval);
  }
  function apply(next, { restart = true } = {}) {
    if (!root || !count()) return;
    index = ((Number(next) % count()) + count()) % count();
    root.querySelectorAll('[data-discover-curation-slide]').forEach((slide) => {
      const active = Number(slide.dataset.discoverCurationSlide) === index;
      slide.classList.toggle('is-active', active);
      slide.setAttribute('aria-hidden', active ? 'false' : 'true');
      const open = slide.querySelector('.discover-curation-open');
      if (open) open.tabIndex = active ? 0 : -1;
    });
    const track = root.querySelector('.discover-curation-track');
    if (track) track.style.transform = `translate3d(${-100 * index}%,0,0)`;
    root.querySelectorAll('[data-discover-curation-index]').forEach((dot) => {
      const active = Number(dot.dataset.discoverCurationIndex) === index;
      dot.classList.toggle('is-active', active);
      dot.setAttribute('aria-current', active ? 'true' : 'false');
    });
    if (restart) schedule();
  }
  function disconnect() {
    stop();
    observer?.disconnect();
    observer = null;
    root = null;
    index = 0;
    inView = false;
    manualPaused = false;
  }
  function mount(nextRoot) {
    disconnect();
    root = nextRoot || null;
    if (!root) return;
    if ('IntersectionObserver' in window) {
      observer = new IntersectionObserver((entries) => {
        inView = entries.some((entry) => entry.isIntersecting && entry.intersectionRatio >= 0.35);
        if (inView) schedule(); else stop();
      }, { threshold: [0, .35, .7] });
      observer.observe(root);
    } else {
      inView = true;
    }
    root.querySelectorAll('[data-discover-curation-dir]').forEach((button) => button.addEventListener('click', (event) => {
      event.stopPropagation();
      manualPaused = true;
      apply(index + Number(button.dataset.discoverCurationDir), { restart: false });
    }));
    root.querySelectorAll('[data-discover-curation-index]').forEach((button) => button.addEventListener('click', (event) => {
      event.stopPropagation();
      manualPaused = true;
      apply(Number(button.dataset.discoverCurationIndex), { restart: false });
    }));
    root.addEventListener('mouseenter', stop);
    root.addEventListener('mouseleave', () => { if (!manualPaused) schedule(); });
    root.addEventListener('focusin', () => { manualPaused = true; stop(); });
    root.addEventListener('pointerdown', (event) => {
      if (event.pointerType === 'mouse' || event.target.closest('button:not(.discover-curation-open)')) return;
      pointerStartX = event.clientX;
      pointerStartY = event.clientY;
    }, { passive: true });
    root.addEventListener('pointerup', (event) => {
      if (pointerStartX == null) return;
      const dx = event.clientX - pointerStartX;
      const dy = event.clientY - pointerStartY;
      pointerStartX = null;
      pointerStartY = null;
      if (Math.abs(dx) < 38 || Math.abs(dx) <= Math.abs(dy) * 1.2) return;
      manualPaused = true;
      apply(index + (dx < 0 ? 1 : -1), { restart: false });
    }, { passive: true });
    apply(0);
  }

  return Object.freeze({ mount, stop, disconnect, apply, state: () => ({ index, inView, manualPaused }) });
}
