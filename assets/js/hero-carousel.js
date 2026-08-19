(function () {
  'use strict';

  function create({ icon, openMovie, renderSlide, getActiveView, interval = 7200 }) {
    const state = new Map();

    function stop(key) {
      const item = state.get(key);
      if (item?.timer) clearTimeout(item.timer);
      if (item) item.timer = null;
    }

    function updatePauseButton(element, item) {
      const pause = element.querySelector('[data-hero-pause]');
      if (!pause) return;
      pause.innerHTML = icon(item.manualPaused ? 'play' : 'pause');
      pause.setAttribute('aria-label', item.manualPaused ? '배너 자동 전환 재생' : '배너 자동 전환 일시정지');
      pause.setAttribute('aria-pressed', item.manualPaused ? 'true' : 'false');
    }

    function schedule(key, element) {
      stop(key);
      const item = state.get(key);
      if (!item || item.slides.length < 2 || item.manualPaused || getActiveView() !== key || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      item.timer = setTimeout(() => apply(element, key, item.index + 1), interval);
    }

    function apply(element, key, requestedIndex, { restart = true } = {}) {
      const item = state.get(key);
      if (!item?.slides?.length) return;
      const index = ((Number(requestedIndex) % item.slides.length) + item.slides.length) % item.slides.length;
      item.index = index;
      element.querySelectorAll('[data-hero-slide]').forEach((slide) => {
        const active = Number(slide.dataset.heroSlide) === index;
        slide.classList.toggle('is-active', active);
        slide.setAttribute('aria-hidden', active ? 'false' : 'true');
        const open = slide.querySelector('[data-hero-open]');
        if (open) open.tabIndex = active ? 0 : -1;
      });
      element.querySelectorAll('[data-hero-index]').forEach((dot) => {
        const active = Number(dot.dataset.heroIndex) === index;
        dot.classList.toggle('is-active', active);
        dot.setAttribute('aria-current', active ? 'true' : 'false');
      });
      if (restart) schedule(key, element);
    }

    function mount(element, key, slides, signature) {
      stop(key);
      const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
      const item = { index: 0, timer: null, manualPaused: reduced, slides, signature, pointerStartX: null, pointerStartY: null };
      state.set(key, item);
      element.setAttribute('role', 'region');
      element.setAttribute('aria-roledescription', 'carousel');
      element.setAttribute('aria-label', key === 'arthouse' ? 'ARTHOUSE 추천 영화' : '추천 영화');
      element.innerHTML = `<div class="hero-slides">${slides.map((record, index) => renderSlide(record, key, index)).join('')}</div>
        <button class="hero-arrow hero-prev" data-hero-dir="-1" aria-label="이전 영화">${icon('chevron-left')}</button>
        <button class="hero-arrow hero-next" data-hero-dir="1" aria-label="다음 영화">${icon('chevron-right')}</button>
        <div class="hero-dots" aria-label="배너 선택">${slides.map((_, index) => `<button class="hero-dot ${index === 0 ? 'is-active' : ''}" data-hero-index="${index}" aria-label="${index + 1}번째 배너" aria-current="${index === 0 ? 'true' : 'false'}"><span></span></button>`).join('')}</div>
        <button class="hero-autoplay" data-hero-pause aria-label="배너 자동 전환 일시정지" aria-pressed="false">${icon(reduced ? 'play' : 'pause')}</button>`;

      element.querySelectorAll('[data-hero-open]').forEach((button) => button.addEventListener('click', () => openMovie(button.dataset.heroOpen)));
      element.querySelectorAll('[data-hero-dir]').forEach((button) => button.addEventListener('click', (event) => {
        event.stopPropagation();
        apply(element, key, item.index + Number(button.dataset.heroDir));
      }));
      element.querySelectorAll('[data-hero-index]').forEach((button) => button.addEventListener('click', (event) => {
        event.stopPropagation();
        apply(element, key, Number(button.dataset.heroIndex));
      }));
      const pause = element.querySelector('[data-hero-pause]');
      pause?.addEventListener('click', (event) => {
        event.stopPropagation();
        item.manualPaused = !item.manualPaused;
        updatePauseButton(element, item);
        if (item.manualPaused) stop(key); else schedule(key, element);
      });

      element.addEventListener('mouseenter', () => stop(key));
      element.addEventListener('mouseleave', () => schedule(key, element));
      element.addEventListener('focusin', (event) => {
        stop(key);
        if (event.target.matches?.(':focus-visible')) {
          item.manualPaused = true;
          updatePauseButton(element, item);
        }
      });
      // Do not resume automatically after keyboard focus. The user explicitly
      // restarts rotation using the play control.

      element.addEventListener('pointerdown', (event) => {
        if (event.pointerType === 'mouse' || event.target.closest('button:not([data-hero-open])')) return;
        item.pointerStartX = event.clientX;
        item.pointerStartY = event.clientY;
      }, { passive: true });
      element.addEventListener('pointerup', (event) => {
        if (item.pointerStartX == null) return;
        const dx = event.clientX - item.pointerStartX;
        const dy = event.clientY - item.pointerStartY;
        item.pointerStartX = null;
        item.pointerStartY = null;
        if (Math.abs(dx) < 42 || Math.abs(dx) <= Math.abs(dy) * 1.2) return;
        item.manualPaused = true;
        updatePauseButton(element, item);
        apply(element, key, item.index + (dx < 0 ? 1 : -1), { restart: false });
      }, { passive: true });

      updatePauseButton(element, item);
      return item;
    }

    function render(element, key, slides, requestedIndex = null) {
      if (!element || !slides?.length) return;
      const signature = slides.map((record) => String(record.id)).join('|');
      let item = state.get(key);
      if (!item || item.signature !== signature) item = mount(element, key, slides, signature);
      else item.slides = slides;
      apply(element, key, requestedIndex == null ? Math.min(item.index, slides.length - 1) : requestedIndex);
    }

    return Object.freeze({ render, stop, state: (key) => state.get(key) || null });
  }

  window.KINOSIS_HERO_CAROUSEL = Object.freeze({ create });
})();
