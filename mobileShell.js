/* ===================================================================
   mobileShell.js — общий мобильный слой для всех страниц.
   1) Принудительный вертикальный (portrait) режим:
      - попытка screen.orientation.lock('portrait') в установленном PWA;
      - оверлей «Поверните телефон» для landscape на телефонах.
   2) Запрет зума жестами по всему сайту (pinch / double-tap / iOS gesture*),
      КРОМЕ зон, помеченных как масштабируемые (.img-lightbox,
      [data-allow-pinch]) — там зум реализован вручную через transform.
   Подключается на каждой странице как можно раньше.
   =================================================================== */
(function () {
  'use strict';

  let portraitLockSuspended = false;

  // ── 1. Блокировка ориентации (работает в установленном PWA / Android) ──
  function lockPortrait() {
    if (portraitLockSuspended) return;
    try {
      const orientation = window.screen && window.screen.orientation;
      if (orientation && typeof orientation.lock === 'function') {
        // Промис может отклониться (не поддерживается / не fullscreen) — это нормально.
        orientation.lock('portrait').catch(function () {});
      }
    } catch (e) { /* не критично */ }
  }

  function unlockOrientation() {
    try {
      const orientation = window.screen && window.screen.orientation;
      if (orientation && typeof orientation.unlock === 'function') {
        orientation.unlock();
      }
    } catch (e) { /* не критично */ }
  }

  /** В полноэкранном видеоплеере разрешаем горизонтальную ориентацию. */
  function setPlayerFullscreen(active) {
    portraitLockSuspended = Boolean(active);
    document.body.classList.toggle('player-fullscreen-active', portraitLockSuspended);
    if (portraitLockSuspended) {
      unlockOrientation();
    } else {
      lockPortrait();
    }
  }

  window.MobileShell = {
    setPlayerFullscreen: setPlayerFullscreen
  };

  lockPortrait();
  window.addEventListener('orientationchange', lockPortrait);

  // ── 2. Оверлей для landscape на телефонах ──
  function ensureOrientationOverlay() {
    if (document.getElementById('orientation-lock')) return;
    const el = document.createElement('div');
    el.id = 'orientation-lock';
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML =
      '<div class="orientation-lock__inner">' +
      '<div class="orientation-lock__icon">📱</div>' +
      '<p class="orientation-lock__title" data-i18n="rotate.title">' + (window.t ? window.t('rotate.title') : 'Поверните телефон вертикально') + '</p>' +
      '<p class="orientation-lock__text" data-i18n="rotate.text">' + (window.t ? window.t('rotate.text') : 'Kinder работает только в вертикальном режиме.') + '</p>' +
      '</div>';
    document.body.appendChild(el);
  }

  // ── 3. Запрет зума жестами ──
  function inZoomableArea(target) {
    return Boolean(
      target &&
      typeof target.closest === 'function' &&
      target.closest('.img-lightbox, [data-allow-pinch="true"]')
    );
  }

  function blockGesture(event) {
    if (inZoomableArea(event.target)) return;
    event.preventDefault();
  }

  // iOS Safari: события gesture* отвечают за pinch-zoom страницы.
  document.addEventListener('gesturestart', blockGesture, { passive: false });
  document.addEventListener('gesturechange', blockGesture, { passive: false });
  document.addEventListener('gestureend', blockGesture, { passive: false });

  // Любой мультитач вне масштабируемых зон не должен зумить страницу.
  document.addEventListener('touchmove', function (event) {
    if (event.touches && event.touches.length > 1 && !inZoomableArea(event.target)) {
      event.preventDefault();
    }
  }, { passive: false });

  // Запрет double-tap zoom (не мешает обычным кликам/свайпам/скроллу).
  let lastTouchEnd = 0;
  document.addEventListener('touchend', function (event) {
    const now = Date.now();
    if (now - lastTouchEnd <= 300 && !inZoomableArea(event.target)) {
      event.preventDefault();
    }
    lastTouchEnd = now;
  }, { passive: false });

  if (document.body) {
    ensureOrientationOverlay();
  } else {
    document.addEventListener('DOMContentLoaded', ensureOrientationOverlay);
  }
})();
