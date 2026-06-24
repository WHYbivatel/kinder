(function () {
  function initHeaderNav(username) {
    const avatar = document.getElementById('header-avatar');
    if (avatar && username) {
      const letter = username.trim().charAt(0).toUpperCase() || '?';
      avatar.textContent = letter;
      const label = window.t ? window.t('btn.accountOf', { name: username }) : `Аккаунт: ${username}`;
      avatar.setAttribute('title', label);
      avatar.setAttribute('aria-label', label);
      avatar.dataset.accountName = username;
    }

    const page = document.body.dataset.page || '';
    document.querySelectorAll('.header-nav-link[data-page]').forEach((link) => {
      link.classList.toggle('header-nav-link--active', link.dataset.page === page);
    });
  }

  // Кнопка «Назад» на отдельных страницах (battle / account и т.п.):
  // возвращает в историю приложения, иначе — на главную.
  function initBackButton() {
    const backBtn = document.getElementById('page-back');
    if (!backBtn || backBtn.dataset.bound === '1') return;
    backBtn.dataset.bound = '1';
    backBtn.addEventListener('click', () => {
      if (history.length > 1 && document.referrer) history.back();
      else if (history.length > 1) history.back();
      else window.location.href = '/';
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initBackButton);
  } else {
    initBackButton();
  }

  document.addEventListener('i18n:change', function () {
    const avatar = document.getElementById('header-avatar');
    const name = avatar && avatar.dataset.accountName;
    if (avatar && name) {
      const label = window.t ? window.t('btn.accountOf', { name }) : `Аккаунт: ${name}`;
      avatar.setAttribute('title', label);
      avatar.setAttribute('aria-label', label);
    }
  });

  window.initHeaderNav = initHeaderNav;
})();
