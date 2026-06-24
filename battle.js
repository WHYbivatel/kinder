/**
 * UI мини-игры «Битва фильмов»
 */
(function () {
  const D = window.MovieDisplay;
  const L = window.BattleLogic;

  let overlay = null;
  let state = {
    active: false,
    started: false,
    engine: null,
    battleMeta: null,
    results: null,
    saved: false,
    animating: false
  };

  function esc(text) {
    return D?.escapeHtml(text) || String(text);
  }

  // Инлайн SVG-иконки (стиль svgrepo / Lucide, stroke-based)
  const ICONS = {
    swords: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5"/><line x1="13" y1="19" x2="19" y2="13"/><line x1="16" y1="16" x2="20" y2="20"/><line x1="19" y1="21" x2="21" y2="19"/><polyline points="14.5 6.5 18 3 21 3 21 6 17.5 9.5"/><line x1="5" y1="14" x2="9" y2="18"/><line x1="7" y1="17" x2="4" y2="20"/><line x1="3" y1="19" x2="5" y2="21"/></svg>',
    bolt: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
    trophy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>',
    tag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"/><circle cx="7.5" cy="7.5" r=".5" fill="currentColor"/></svg>',
    film: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M7 3v18"/><path d="M3 7.5h4"/><path d="M3 12h18"/><path d="M3 16.5h4"/><path d="M17 3v18"/><path d="M17 7.5h4"/><path d="M17 16.5h4"/></svg>',
    tv: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="15" x="2" y="7" rx="2" ry="2"/><polyline points="17 2 12 7 7 2"/></svg>',
    crown: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z"/><path d="M5 21h14"/></svg>',
    medal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7.21 15 2.66 7.14a2 2 0 0 1 .13-2.2L4.4 2.8A2 2 0 0 1 6 2h12a2 2 0 0 1 1.6.8l1.6 2.14a2 2 0 0 1 .14 2.2L16.79 15"/><path d="M11 12 5.12 2.2"/><path d="m13 12 5.88-9.8"/><path d="M8 7h8"/><circle cx="12" cy="17" r="5"/><path d="M12 18v-2h-.5"/></svg>',
    play: '<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="6 3 20 12 6 21 6 3"/></svg>',
    star: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
    skip: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 4 15 12 5 20 5 4"/><line x1="19" x2="19" y1="5" y2="19"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
    refresh: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>',
    chevronLeft: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>'
  };

  function icon(name, cls = '') {
    return `<span class="battle-ico${cls ? ` ${cls}` : ''}" aria-hidden="true">${ICONS[name] || ''}</span>`;
  }

  function posterSrc(movie) {
    const url = D?.posterUrl(movie.meta?.poster, 'w500');
    return url || '';
  }

  function formatGenres(movie) {
    return (movie.genres || []).slice(0, 3).join(', ') || '—';
  }

  function formatUserRating(movie) {
    return movie.rating != null ? `${movie.rating}/10` : '—';
  }

  function externalRatingsHtml(movie) {
    const parts = [];
    if (movie.meta?.imdb?.rating) parts.push(`IMDb ${movie.meta.imdb.rating}`);
    if (movie.meta?.kinopoisk?.rating) parts.push(`КП ${movie.meta.kinopoisk.rating}`);
    return parts.length ? `<span class="battle-card-ratings">${icon('star')}${esc(parts.join(' · '))}</span>` : '';
  }

  function mediaBadge(movie) {
    const isTv = movie.mediaType === 'tv';
    const label = isTv ? 'Сериал' : 'Фильм';
    return `<span class="battle-media-badge">${icon(isTv ? 'tv' : 'film')}${label}</span>`;
  }

  function overviewSnippet(movie) {
    const text = movie.meta?.overview;
    if (!text) return '';
    const short = text.length > 100 ? `${text.slice(0, 100).trim()}…` : text;
    return `<p class="battle-card-overview">${esc(short)}</p>`;
  }

  function buildBattleCard(movie, side, { selectable = true } = {}) {
    const poster = posterSrc(movie);
    const posterHtml = poster
      ? `<img class="battle-card-poster" src="${esc(poster)}" alt="" loading="lazy">`
      : `<div class="battle-card-poster battle-card-poster--placeholder" aria-hidden="true">🎬</div>`;

    return `
      <button type="button"
        class="battle-card battle-card--${side}${selectable ? '' : ' battle-card--static'}"
        data-movie-id="${movie.id}"
        ${selectable ? '' : 'disabled'}
        aria-label="Выбрать ${esc(movie.title)}">
        ${mediaBadge(movie)}
        <div class="battle-card-poster-wrap">${posterHtml}</div>
        <div class="battle-card-body">
          <h3 class="battle-card-title">${esc(movie.title)}</h3>
          <p class="battle-card-meta">${esc(movie.meta?.year || '—')}</p>
          <p class="battle-card-rating">Ваша оценка: <strong>${esc(formatUserRating(movie))}</strong></p>
          ${externalRatingsHtml(movie)}
          ${selectable ? `<span class="battle-card-pick">${icon('check')}Выбрать</span>` : ''}
        </div>
      </button>
    `;
  }

  function buildOverlay() {
    if (overlay) return overlay;
    overlay = document.createElement('div');
    overlay.id = 'battle-overlay';
    overlay.className = 'battle-overlay hidden';
    overlay.innerHTML = `
      <div class="battle-backdrop"></div>
      <div class="battle-shell">
        <div class="battle-panel" id="battle-panel"></div>
      </div>
    `;
    document.body.appendChild(overlay);
    return overlay;
  }

  function panel() {
    return document.getElementById('battle-panel');
  }

  function openOverlay() {
    buildOverlay();
    overlay.classList.remove('hidden');
    requestAnimationFrame(() => overlay.classList.add('battle-overlay--visible'));
    document.body.classList.add('battle-open');
    state.active = true;
  }

  function closeOverlay() {
    if (!overlay) return;
    overlay.classList.remove('battle-overlay--visible');
    document.body.classList.remove('battle-open');
    setTimeout(() => {
      overlay.classList.add('hidden');
      panel().innerHTML = '';
    }, 280);
    state = {
      active: false,
      started: false,
      engine: null,
      battleMeta: null,
      results: null,
      saved: false,
      animating: false
    };
  }

  function getWatchedCount(mediaType = 'movie') {
    return L.getWatched(window.MovieApp.getMovies(), { mediaType }).length;
  }

  function mediaTypeLabel(mediaType, plural = true) {
    if (mediaType === 'tv') return plural ? 'сериалов' : 'сериал';
    return plural ? 'фильмов' : 'фильм';
  }

  function scrollToList() {
    closeOverlay();
    const section = document.querySelector('.movie-list-section');
    if (section) section.scrollIntoView({ behavior: 'smooth' });
    window.MovieApp.setFilter('status', '');
    const mediaType = state.battleMeta?.mediaType;
    if (mediaType === 'tv' || mediaType === 'movie') {
      window.MovieApp.setMediaFilter(mediaType);
    }
  }

  function showNotice({ title, body, buttons }) {
    openOverlay();
    panel().innerHTML = `
      <div class="battle-notice battle-fade-in">
        <h2>${esc(title)}</h2>
        <div class="battle-notice-body">${body}</div>
        <div class="battle-notice-actions">
          ${buttons.map((b) =>
            `<button type="button" class="battle-btn ${b.primary ? 'battle-btn--primary' : 'battle-btn--ghost'}" data-action="${esc(b.action)}">${esc(b.label)}</button>`
          ).join('')}
        </div>
      </div>
      <button type="button" class="battle-close-btn" data-action="close-notice" aria-label="Закрыть">✕</button>
    `;
    bindPanelActions();
  }

  function showNotEnough(min, count, extra = {}) {
    const mediaType = extra.mediaType || 'movie';
    const typeLabel = mediaTypeLabel(mediaType);
    let title = 'Пока рано начинать битву';
    let text = `Чтобы составить честный топ, нужно минимум ${min} просмотренных ${typeLabel}. Сейчас у вас: ${count}.`;
    if (extra.genre) {
      title = mediaType === 'tv' ? 'Недостаточно сериалов в этом жанре' : 'Недостаточно фильмов в этом жанре';
      text = `Для битвы по жанру нужно минимум ${min} просмотренных. В жанре «${extra.genre}» сейчас только ${count}.`;
    } else if (mediaType === 'tv') {
      title = 'Недостаточно сериалов';
    }
    const need = min - count;
    if (!extra.genre && need > 0) {
      text += `<br><br>Добавьте или отметьте как просмотренные ещё ${need} ${typeLabel}, и битва станет доступна.`;
    }
    showNotice({
      title,
      body: `<p>${text}</p>`,
      buttons: [
        { label: 'Понятно', action: 'close-notice' },
        { label: 'Перейти к списку', action: 'go-list', primary: true }
      ]
    });
  }

  function showConfirmExit() {
    return new Promise((resolve) => {
      const shell = panel();
      const confirm = document.createElement('div');
      confirm.className = 'battle-confirm';
      confirm.innerHTML = `
        <div class="battle-confirm-box battle-fade-in">
          <p>Выйти из битвы? Прогресс текущей игры будет потерян.</p>
          <div class="battle-notice-actions">
            <button type="button" class="battle-btn battle-btn--ghost" data-resolve="stay">Остаться</button>
            <button type="button" class="battle-btn battle-btn--primary" data-resolve="exit">Выйти</button>
          </div>
        </div>
      `;
      shell.appendChild(confirm);
      confirm.querySelector('[data-resolve="stay"]').onclick = () => {
        confirm.remove();
        resolve(false);
      };
      confirm.querySelector('[data-resolve="exit"]').onclick = () => {
        confirm.remove();
        resolve(true);
      };
    });
  }

  async function tryClose() {
    if (state.started && !state.results) {
      const ok = await showConfirmExit();
      if (!ok) return;
    }
    closeOverlay();
    refreshHomeBlock();
  }

  function modeHeaderLabel() {
    if (!state.battleMeta) return '';
    const { mode, genre, mediaType } = state.battleMeta;
    if (mode === 'genre' && genre) {
      return L.genreBattleTitle(genre, mediaType);
    }
    return L.battleModeLabel(mode, mediaType);
  }

  function renderModeCard(mode, mediaType) {
    const isTv = mediaType === 'tv';
    const watched = getWatchedCount(mediaType);
    const typeLabel = mediaTypeLabel(mediaType);

    if (mode === 'quick') {
      const min = isTv ? L.MIN_SERIES : L.MIN_QUICK;
      const featured = !isTv ? ' battle-mode-card--featured' : '';
      return `
        <button type="button" class="battle-mode-card battle-mode-card--quick${featured}" data-mode="quick" data-media="${mediaType}">
          <span class="battle-mode-icon">${icon('bolt')}</span>
          <span class="battle-mode-name">Быстрая битва</span>
          <span class="battle-mode-desc">${isTv ? '8 сериалов, 7 выборов, быстрый топ-3.' : '8 фильмов, 7 выборов, быстрый топ-3.'}</span>
          ${watched < min ? `<span class="battle-mode-hint">Нужно ${min} ${typeLabel} (сейчас ${watched})</span>` : ''}
        </button>
      `;
    }

    if (mode === 'full') {
      const min = isTv ? L.MIN_SERIES : L.MIN_FULL;
      return `
        <button type="button" class="battle-mode-card battle-mode-card--full" data-mode="full" data-media="${mediaType}">
          <span class="battle-mode-icon">${icon('trophy')}</span>
          <span class="battle-mode-name">Полная битва</span>
          <span class="battle-mode-desc">Более точный рейтинг по всем просмотренным ${typeLabel}.</span>
          ${watched < min ? `<span class="battle-mode-hint">Нужно ${min} ${typeLabel}</span>` : ''}
        </button>
      `;
    }

    return `
      <button type="button" class="battle-mode-card battle-mode-card--genre" data-mode="genre" data-media="${mediaType}">
        <span class="battle-mode-icon">${icon('tag')}</span>
        <span class="battle-mode-name">Битва по жанру</span>
        <span class="battle-mode-desc">${isTv ? 'Лучший сериал в конкретном жанре.' : 'Лучший фильм в конкретном жанре.'}</span>
      </button>
    `;
  }

  function renderModeSelect() {
    const movieCount = getWatchedCount('movie');
    const seriesCount = getWatchedCount('tv');

    panel().innerHTML = `
      <header class="battle-header">
        <h2 class="battle-header-title">${icon('swords')}Выберите режим битвы</h2>
        <button type="button" class="battle-close-btn" data-action="close" aria-label="Закрыть">✕</button>
      </header>
      <div class="battle-mode-sections battle-fade-in">
        <section class="battle-mode-section">
          <h3 class="battle-mode-section-title">${icon('film')}Битва фильмов <span class="battle-mode-section-count">${movieCount}</span></h3>
          <p class="battle-mode-section-meta">${movieCount} в «Посмотрел»</p>
          <div class="battle-mode-grid">
            ${renderModeCard('quick', 'movie')}
            ${renderModeCard('full', 'movie')}
            ${renderModeCard('genre', 'movie')}
          </div>
        </section>
        <section class="battle-mode-section">
          <h3 class="battle-mode-section-title">${icon('tv')}Битва сериалов <span class="battle-mode-section-count">${seriesCount}</span></h3>
          <p class="battle-mode-section-meta">${seriesCount} в «Посмотрел»</p>
          <div class="battle-mode-grid">
            ${renderModeCard('quick', 'tv')}
            ${renderModeCard('full', 'tv')}
            ${renderModeCard('genre', 'tv')}
          </div>
        </section>
      </div>
    `;
    bindPanelActions();
  }

  function renderGenreSelect(mediaType = 'movie') {
    const watched = L.getWatched(window.MovieApp.getMovies(), { mediaType });
    const genres = L.getGenreCounts(watched);
    const typeLabel = mediaTypeLabel(mediaType);
    const sectionTitle = mediaType === 'tv' ? 'Выберите жанр сериала' : 'Выберите жанр фильма';
    const emptyText = mediaType === 'tv'
      ? 'Нет жанров в просмотренных сериалах'
      : 'Нет жанров в просмотренных фильмах';

    panel().innerHTML = `
      <header class="battle-header">
        <h2 class="battle-header-title">${icon(mediaType === 'tv' ? 'tv' : 'film')}${esc(sectionTitle)}</h2>
        <button type="button" class="battle-close-btn" data-action="close" aria-label="Закрыть">✕</button>
      </header>
      <div class="battle-genre-list battle-fade-in">
        ${genres.length ? genres.map((g) => {
          const disabled = g.count < L.MIN_GENRE;
          const display = g.name.charAt(0).toUpperCase() + g.name.slice(1);
          return `
            <button type="button" class="battle-genre-item${disabled ? ' battle-genre-item--disabled' : ''}"
              data-genre="${esc(g.name)}" data-media="${mediaType}" ${disabled ? 'disabled' : ''}>
              <span class="battle-genre-name">${icon('tag')}${esc(display)}</span>
              <span class="battle-genre-count">${g.count} ${typeLabel}</span>
            </button>
          `;
        }).join('') : `<p class="battle-empty">${esc(emptyText)}</p>`}
      </div>
      <div class="battle-footer-actions">
        <button type="button" class="battle-btn battle-btn--ghost" data-action="modes">${icon('chevronLeft')}Назад</button>
      </div>
    `;
    bindPanelActions();
  }

  function startBattle(mode, options = {}) {
    const mediaType = options.mediaType || 'movie';
    const result = L.createBattle(mode, window.MovieApp.getMovies(), { ...options, mediaType });
    if (result.error === 'not_enough') {
      showNotEnough(result.min, result.count, { mediaType: result.mediaType || mediaType });
      return;
    }
    if (result.error === 'not_enough_series') {
      showNotEnough(result.min, result.count, { mediaType: 'tv' });
      return;
    }
    if (result.error === 'not_enough_genre') {
      const display = result.genre.charAt(0).toUpperCase() + result.genre.slice(1);
      showNotEnough(result.min, result.count, {
        genre: display,
        mediaType: result.mediaType || mediaType
      });
      return;
    }
    if (result.error) return;

    state.engine = result.engine;
    state.battleMeta = {
      mode: result.mode,
      genre: result.genre,
      pool: result.pool,
      mediaType: result.mediaType || mediaType
    };
    state.started = true;
    state.results = null;
    state.saved = false;
    renderArena();
  }

  function renderArena() {
    const pair = state.engine.getCurrentPair();
    if (!pair) {
      finishBattle();
      return;
    }
    const progress = state.engine.getProgress();
    const pct = Math.round(((progress.current - 1) / progress.total) * 100);

    const pickLabel = state.battleMeta?.mediaType === 'tv' ? 'сериал' : 'фильм';

    panel().innerHTML = `
      <header class="battle-header">
        <div class="battle-header-left">
          <h2 class="battle-header-title">${icon('swords')}${esc(modeHeaderLabel())}</h2>
          <span class="battle-progress-label">Раунд ${progress.current} / ${progress.total}</span>
        </div>
        <button type="button" class="battle-close-btn" data-action="close" aria-label="Закрыть">✕</button>
      </header>
      <p class="battle-prompt battle-fade-in">Что выбираете?</p>
      <p class="battle-prompt-sub">Нажмите на ${pickLabel}, который нравится вам больше.</p>
      <div class="battle-arena battle-pair-enter" id="battle-arena">
        ${buildBattleCard(pair.left, 'left')}
        <div class="battle-vs" aria-hidden="true">${icon('swords', 'battle-vs-icon')}<span class="battle-vs-text">VS</span></div>
        ${buildBattleCard(pair.right, 'right')}
      </div>
      <footer class="battle-footer">
        <button type="button" class="battle-btn battle-btn--ghost battle-skip-btn" data-action="skip">${icon('skip')}Пропустить пару</button>
        <div class="battle-progress-bar-wrap">
          <div class="battle-progress-bar" style="width:${pct}%"></div>
        </div>
      </footer>
    `;
    bindPanelActions();
    bindCardClicks();
  }

  function bindCardClicks() {
    panel().querySelectorAll('.battle-card').forEach((card) => {
      card.addEventListener('click', () => {
        if (state.animating) return;
        const id = Number(card.dataset.movieId);
        handlePick(id, card);
      });
    });
  }

  function handlePick(winnerId, clickedCard) {
    state.animating = true;
    const arena = document.getElementById('battle-arena');
    const cards = arena?.querySelectorAll('.battle-card') || [];
    cards.forEach((c) => {
      const isWinner = Number(c.dataset.movieId) === winnerId;
      c.classList.toggle('battle-card--winner', isWinner);
      c.classList.toggle('battle-card--loser', !isWinner);
      c.disabled = true;
    });
    if (clickedCard) clickedCard.classList.add('battle-card--pulse');

    setTimeout(() => {
      const res = state.engine.pickWinner(winnerId);
      state.animating = false;
      if (res.done) {
        state.results = res.results;
        renderResults();
      } else {
        renderArena();
      }
    }, 520);
  }

  function finishBattle() {
    state.results = state.engine._top3?.() || state.engine._results?.() || [];
    renderResults();
  }

  function resultSubtitle(item) {
    if (item.wins != null && item.wins > 0) return `${item.wins} побед в битве`;
    if (item.score != null) return `Счёт: ${Math.round(item.score)}`;
    return 'Ваш фаворит';
  }

  function buildResultCard(item, size) {
    const movie = item.movie;
    const poster = posterSrc(movie);
    const posterHtml = poster
      ? `<img src="${esc(poster)}" alt="" loading="lazy">`
      : `<div class="battle-result-placeholder">🎬</div>`;
    const placeIcon = item.place === 1 ? 'crown' : 'medal';
    return `
      <div class="battle-result-card battle-result-card--${size} battle-result-stagger" data-place="${item.place}">
        <div class="battle-result-medal battle-result-medal--${item.place}">${icon(placeIcon)}</div>
        <div class="battle-result-place">#${item.place}</div>
        <div class="battle-result-poster">${posterHtml}</div>
        <h3>${esc(movie.title)}</h3>
        <p class="battle-result-meta">${esc(movie.meta?.year || '—')} · ${esc(formatUserRating(movie))}</p>
        <p class="battle-result-sub">${esc(resultSubtitle(item))}</p>
      </div>
    `;
  }

  function renderResults() {
    const results = state.results || [];
    const isFull = state.battleMeta?.mode === 'full';
    const isTop10 = isFull && results.length > 3;

    let body;
    if (isTop10) {
      body = `
        <h2 class="battle-results-title battle-fade-in">${icon('trophy')}Ваш личный рейтинг</h2>
        <div class="battle-results-list battle-fade-in">
          ${results.map((item) => `
            <div class="battle-results-row battle-result-stagger" data-place="${item.place}">
              <span class="battle-results-rank">#${item.place}</span>
              <span class="battle-results-name">${esc(item.movie.title)}</span>
              <span class="battle-results-year">${esc(item.movie.meta?.year || '')}</span>
              <span class="battle-results-score">${item.wins} побед · ${Math.round(item.score)}</span>
              <span class="battle-results-rating">${esc(formatUserRating(item.movie))}</span>
            </div>
          `).join('')}
        </div>
      `;
    } else {
      const ordered = [...results].sort((a, b) => {
        const order = { 1: 0, 2: 1, 3: 2 };
        return (order[a.place] ?? a.place) - (order[b.place] ?? b.place);
      });
      const first = ordered.find((r) => r.place === 1) || ordered[0];
      const second = ordered.find((r) => r.place === 2) || ordered[1];
      const third = ordered.find((r) => r.place === 3) || ordered[2];

      body = `
        <h2 class="battle-results-title battle-fade-in">${icon('trophy')}Ваш топ-3 готов</h2>
        <div class="battle-results-podium battle-fade-in">
          ${second ? buildResultCard(second, 'second') : ''}
          ${first ? buildResultCard(first, 'first') : ''}
          ${third ? buildResultCard(third, 'third') : ''}
        </div>
        <div class="battle-confetti" aria-hidden="true"></div>
      `;
    }

    panel().innerHTML = `
      <header class="battle-header">
        <h2 class="battle-header-title">${icon('trophy')}${esc(modeHeaderLabel())}</h2>
        <button type="button" class="battle-close-btn" data-action="close" aria-label="Закрыть">✕</button>
      </header>
      ${body}
      <div class="battle-final-actions battle-fade-in">
        <button type="button" class="battle-btn battle-btn--primary" data-action="save"${state.saved ? ' disabled' : ''}>
          ${state.saved ? `${icon('check')}Сохранено` : `${icon('check')}Сохранить результат`}
        </button>
        <button type="button" class="battle-btn battle-btn--ghost" data-action="replay">${icon('refresh')}Сыграть ещё раз</button>
        <button type="button" class="battle-btn battle-btn--ghost" data-action="modes">${icon('swords')}Другой режим</button>
        <button type="button" class="battle-btn battle-btn--ghost" data-action="close-finish">Закрыть</button>
      </div>
      <div id="battle-save-error" class="battle-save-error hidden"></div>
    `;
    bindPanelActions();
    spawnConfetti();
  }

  function spawnConfetti() {
    const wrap = panel().querySelector('.battle-confetti');
    if (!wrap) return;
    for (let i = 0; i < 24; i++) {
      const p = document.createElement('span');
      p.className = 'battle-confetti-piece';
      p.style.left = `${10 + Math.random() * 80}%`;
      p.style.animationDelay = `${Math.random() * 0.8}s`;
      p.style.background = i % 3 === 0 ? 'var(--accent)' : i % 3 === 1 ? '#fff' : '#6b6b76';
      wrap.appendChild(p);
    }
  }

  async function saveResults() {
    const errEl = document.getElementById('battle-save-error');
    try {
      const ok = await window.MovieApp.saveBattleResults({
        mode: state.battleMeta.mode,
        genre: state.battleMeta.genre,
        mediaType: state.battleMeta.mediaType,
        results: state.results,
        matches: state.engine.getMatches()
      });
      if (!ok.success) {
        if (errEl) {
          errEl.textContent = ok.error || 'Не удалось сохранить результат';
          errEl.classList.remove('hidden');
        }
        return;
      }
      state.saved = true;
      const saveBtn = panel().querySelector('[data-action="save"]');
      if (saveBtn) {
        saveBtn.innerHTML = `${icon('check')}Сохранено`;
        saveBtn.disabled = true;
      }
      refreshHomeBlock();
    } catch (e) {
      if (errEl) {
        errEl.textContent = 'Ошибка сохранения. Попробуйте ещё раз.';
        errEl.classList.remove('hidden');
      }
    }
  }

  function bindPanelActions() {
    const p = panel();
    p.querySelector('[data-action="close"]')?.addEventListener('click', () => tryClose());
    p.querySelector('[data-action="close-notice"]')?.addEventListener('click', () => closeOverlay());
    p.querySelector('[data-action="close-finish"]')?.addEventListener('click', () => closeOverlay());
    p.querySelector('[data-action="go-list"]')?.addEventListener('click', () => scrollToList());
    p.querySelector('[data-action="modes"]')?.addEventListener('click', () => {
      state.started = false;
      state.engine = null;
      state.results = null;
      renderModeSelect();
    });
    p.querySelector('[data-action="replay"]')?.addEventListener('click', () => {
      const { mode, genre, mediaType } = state.battleMeta;
      startBattle(mode, { genre, mediaType });
    });
    p.querySelector('[data-action="save"]')?.addEventListener('click', () => saveResults());
    p.querySelector('[data-action="skip"]')?.addEventListener('click', () => {
      if (state.animating) return;
      state.animating = true;
      setTimeout(() => {
        const res = state.engine.skipPair();
        state.animating = false;
        if (res.done) {
          state.results = res.results;
          renderResults();
        } else {
          renderArena();
        }
      }, 200);
    });

    p.querySelectorAll('[data-mode]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const mode = btn.dataset.mode;
        const mediaType = btn.dataset.media || 'movie';
        const watched = getWatchedCount(mediaType);
        const isTv = mediaType === 'tv';

        if (mode === 'quick') {
          const min = isTv ? L.MIN_SERIES : L.MIN_QUICK;
          if (watched < min) {
            showNotEnough(min, watched, { mediaType });
            return;
          }
        }
        if (mode === 'full') {
          const min = isTv ? L.MIN_SERIES : L.MIN_FULL;
          if (watched < min) {
            showNotEnough(min, watched, { mediaType });
            return;
          }
        }
        if (mode === 'genre') {
          renderGenreSelect(mediaType);
          return;
        }
        startBattle(mode, { mediaType });
      });
    });

    p.querySelectorAll('[data-genre]:not([disabled])').forEach((btn) => {
      btn.addEventListener('click', () => {
        startBattle('genre', {
          genre: btn.dataset.genre,
          mediaType: btn.dataset.media || 'movie'
        });
      });
    });
  }

  function openBattle() {
    openOverlay();
    renderModeSelect();
  }

  function refreshHomeBlock() {
    const topEl = document.getElementById('battle-my-top');
    if (!topEl) return;
    const sessions = window.MovieApp.getBattleSessions?.() || [];
    const movies = window.MovieApp.getMovies();
    const last = sessions[sessions.length - 1];
    if (!last?.result?.length) {
      topEl.classList.add('hidden');
      topEl.innerHTML = '';
      return;
    }
    const titles = last.result.slice(0, 3).map((id) => {
      const m = movies.find((x) => x.id === id);
      return m ? m.title : `#${id}`;
    });
    const modeLabel = L.battleModeLabel(last.mode, last.mediaType || (last.mode === 'series' ? 'tv' : 'movie'));
    topEl.classList.remove('hidden');
    topEl.innerHTML = `
      <h3 class="battle-home-top-title">${icon('trophy')}Мой топ</h3>
      <p class="battle-home-top-meta">${esc(modeLabel)} · ${new Date(last.createdAt).toLocaleDateString('ru-RU')}</p>
      <ol class="battle-home-top-list">
        ${titles.map((t, i) => `<li><span class="battle-home-rank">${i + 1}</span> ${esc(t)}</li>`).join('')}
      </ol>
    `;
  }

  function initHomeBlock() {
    const section = document.getElementById('battle-section');
    if (!section) return;
    section.querySelector('#battle-start-btn')?.addEventListener('click', () => openBattle());
    section.querySelectorAll('[data-open-battle]').forEach((card) => {
      card.addEventListener('click', () => openBattle());
    });
    refreshHomeBlock();
  }

  window.BattleUI = {
    init: initHomeBlock,
    refresh: refreshHomeBlock,
    open: openBattle
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initHomeBlock);
  } else {
    initHomeBlock();
  }
})();
