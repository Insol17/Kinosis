(function () {
  'use strict';

  function create({ icon, openMovie, renderSlide, getActiveView, interval = 6500 }) {
    const state = new Map();

    function stop(key) {
      const item = state.get(key);
      if (item?.timer) clearTimeout(item.timer);
      if (item) item.timer = null;
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
      const record = item.slides[index];
      element.dataset.heroMovie = String(record.id);
      element.setAttribute('aria-label', `${record.title} 상세 보기`);
      element.querySelectorAll('[data-hero-slide]').forEach((slide) => {
        const active = Number(slide.dataset.heroSlide) === index;
        slide.classList.toggle('is-active', active);
        slide.setAttribute('aria-hidden', active ? 'false' : 'true');
      });
      element.querySelectorAll('[data-hero-index]').forEach((dot) => dot.classList.toggle('is-active', Number(dot.dataset.heroIndex) === index));
      if (restart) schedule(key, element);
    }

    function mount(element, key, slides, signature) {
      stop(key);
      const item = { index: 0, timer: null, manualPaused: false, slides, signature };
      state.set(key, item);
      element.innerHTML = `<div class="hero-slides">${slides.map((record, index) => renderSlide(record, key, index)).join('')}</div>
        <button class="hero-arrow hero-prev" data-hero-dir="-1" aria-label="이전 영화">${icon('chevron-left')}</button>
        <button class="hero-arrow hero-next" data-hero-dir="1" aria-label="다음 영화">${icon('chevron-right')}</button>
        <div class="hero-dots">${slides.map((_, index) => `<button class="hero-dot ${index === 0 ? 'is-active' : ''}" data-hero-index="${index}" aria-label="${index + 1}번째 배너"><span></span></button>`).join('')}</div>
        <button class="hero-autoplay" data-hero-pause aria-label="배너 자동 전환 일시정지">${icon('pause')}</button>`;
      element.tabIndex = 0;
      element.setAttribute('role', 'link');
      element.onclick = (event) => { if (!event.target.closest('button,a')) openMovie(element.dataset.heroMovie); };
      element.onkeydown = (event) => {
        if ((event.key === 'Enter' || event.key === ' ') && !event.target.closest('button,a')) {
          event.preventDefault();
          openMovie(element.dataset.heroMovie);
        }
      };
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
        pause.innerHTML = icon(item.manualPaused ? 'play' : 'pause');
        pause.setAttribute('aria-label', item.manualPaused ? '배너 자동 전환 재생' : '배너 자동 전환 일시정지');
        if (item.manualPaused) stop(key); else schedule(key, element);
      });
      element.onmouseenter = () => stop(key);
      element.onmouseleave = () => schedule(key, element);
      element.onfocusin = () => stop(key);
      element.onfocusout = () => schedule(key, element);
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
