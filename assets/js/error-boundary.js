(function () {
  'use strict';
  let shownAt = 0;

  function report(error, source) {
    console.error(`[KINOSIS:${source}]`, error);
    const now = Date.now();
    if (now - shownAt < 2500) return;
    shownAt = now;
    const message = '문제가 발생했습니다. 기록은 브라우저에 보존되어 있습니다. 새로고침 후 다시 시도해주세요.';
    if (window.KINOSIS_UI?.toast) window.KINOSIS_UI.toast(message);
    else {
      const toast = document.getElementById('toast');
      if (toast) {
        toast.textContent = message;
        toast.classList.add('is-visible');
        setTimeout(() => toast.classList.remove('is-visible'), 5000);
      }
    }
  }

  window.addEventListener('error', (event) => report(event.error || event.message, 'error'));
  window.addEventListener('unhandledrejection', (event) => report(event.reason, 'promise'));
})();
