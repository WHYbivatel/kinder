(function () {
  const INSTALL_DISMISSED_KEY = 'moviePwaInstallDismissedAt';
  const INSTALL_DISMISS_DAYS = 14;
  let deferredInstallPrompt = null;

  function isStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true;
  }

  function isMobileLike() {
    return window.matchMedia('(max-width: 900px), (pointer: coarse)').matches;
  }

  function isIos() {
    return /iphone|ipad|ipod/i.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }

  function wasRecentlyDismissed() {
    const raw = localStorage.getItem(INSTALL_DISMISSED_KEY);
    if (!raw) return false;
    const dismissedAt = Number(raw);
    if (!Number.isFinite(dismissedAt)) return false;
    return Date.now() - dismissedAt < INSTALL_DISMISS_DAYS * 24 * 60 * 60 * 1000;
  }

  function rememberDismiss() {
    localStorage.setItem(INSTALL_DISMISSED_KEY, String(Date.now()));
  }

  async function registerServiceWorker() {
    if (!('serviceWorker' in navigator) || window.location.protocol === 'file:') return;
    try {
      await navigator.serviceWorker.register('/sw.js');
    } catch (error) {
      console.warn('PWA service worker registration failed', error);
    }
  }

  function createInstallBanner() {
    if (document.getElementById('pwa-install-banner')) return null;

    const banner = document.createElement('div');
    banner.id = 'pwa-install-banner';
    banner.className = 'pwa-install-banner hidden';
    banner.setAttribute('role', 'dialog');
    banner.setAttribute('aria-live', 'polite');
    banner.innerHTML = `
      <div class="pwa-install-icon" aria-hidden="true">🎬</div>
      <div class="pwa-install-copy">
        <strong>Добавить «Мои фильмы» на главный экран?</strong>
        <span id="pwa-install-text">Откроется как приложение: список, AI, тесты, битва и свайпы будут под рукой.</span>
      </div>
      <div class="pwa-install-actions">
        <button type="button" id="pwa-install-btn" class="pwa-install-btn">Добавить</button>
        <button type="button" id="pwa-install-close" class="pwa-install-close" aria-label="Скрыть">✕</button>
      </div>
    `;
    document.body.appendChild(banner);

    banner.querySelector('#pwa-install-close')?.addEventListener('click', () => {
      rememberDismiss();
      banner.classList.add('hidden');
    });

    banner.querySelector('#pwa-install-btn')?.addEventListener('click', async () => {
      if (deferredInstallPrompt) {
        deferredInstallPrompt.prompt();
        await deferredInstallPrompt.userChoice.catch(() => null);
        deferredInstallPrompt = null;
        banner.classList.add('hidden');
        return;
      }

      const text = banner.querySelector('#pwa-install-text');
      if (text) {
        text.textContent = isIos()
          ? 'На iPhone нажмите «Поделиться» → «На экран Домой».'
          : 'В меню браузера выберите «Установить приложение» или «Добавить на главный экран».';
      }
      banner.classList.add('pwa-install-banner--instructions');
    });

    return banner;
  }

  function maybeShowInstallBanner(force = false) {
    if (isStandalone() || !isMobileLike()) return;
    if (!force && wasRecentlyDismissed()) return;

    const banner = createInstallBanner();
    if (!banner) return;

    const btn = banner.querySelector('#pwa-install-btn');
    const text = banner.querySelector('#pwa-install-text');
    if (!deferredInstallPrompt && text) {
      text.textContent = isIos()
        ? 'Нажмите «Добавить», чтобы увидеть короткую инструкцию для iPhone.'
        : 'Если браузер не откроет окно установки, используйте меню «Добавить на главный экран».';
    }
    if (btn) btn.textContent = deferredInstallPrompt ? 'Добавить' : 'Как добавить';

    window.setTimeout(() => banner.classList.remove('hidden'), force ? 0 : 900);
  }

  function addMobileNav() {
    if (document.getElementById('mobile-app-nav')) return;

    const page = document.body.dataset.page || 'home';
    const nav = document.createElement('nav');
    nav.id = 'mobile-app-nav';
    nav.className = 'mobile-app-nav';
    nav.setAttribute('aria-label', 'Мобильная навигация');
    nav.innerHTML = `
      <a class="mobile-app-nav__item ${page === 'home' ? 'mobile-app-nav__item--active' : ''}" href="/">
        <span>🏠</span><strong>Главная</strong>
      </a>
      <a class="mobile-app-nav__item" href="/#discover-section">
        <span>✨</span><strong>Свайп</strong>
      </a>
      <a class="mobile-app-nav__item ${page === 'battle' ? 'mobile-app-nav__item--active' : ''}" href="/battle.html">
        <span>⚔</span><strong>Битва</strong>
      </a>
      <a class="mobile-app-nav__item ${page === 'account' ? 'mobile-app-nav__item--active' : ''}" href="/account.html">
        <span>👤</span><strong>Профиль</strong>
      </a>
    `;
    document.body.appendChild(nav);
  }

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    maybeShowInstallBanner(true);
  });

  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    document.getElementById('pwa-install-banner')?.classList.add('hidden');
  });

  if (isStandalone()) {
    document.documentElement.classList.add('pwa-standalone');
  }

  registerServiceWorker();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      addMobileNav();
      maybeShowInstallBanner();
    });
  } else {
    addMobileNav();
    maybeShowInstallBanner();
  }
})();
