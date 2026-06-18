(function () {
  function initHeaderNav(username) {
    const avatar = document.getElementById('header-avatar');
    if (avatar && username) {
      const letter = username.trim().charAt(0).toUpperCase() || '?';
      avatar.textContent = letter;
      avatar.setAttribute('title', `Аккаунт: ${username}`);
      avatar.setAttribute('aria-label', `Аккаунт ${username}`);
    }

    const page = document.body.dataset.page || '';
    document.querySelectorAll('.header-nav-link[data-page]').forEach((link) => {
      link.classList.toggle('header-nav-link--active', link.dataset.page === page);
    });
  }

  window.initHeaderNav = initHeaderNav;
})();
