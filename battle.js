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
    return parts.length ? `<span class="battle-card-ratings">${esc(parts.join(' · '))}</span>` : '';
  }

  function mediaBadge(movie) {
    const label = movie.mediaType === 'tv' ? 'Сериал' : 'Фильм';
    return `<span class="battle-media-badge">${label}</span>`;
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
          <p class="battle-card-meta">${esc(movie.meta?.year || '—')} · ${esc(formatGenres(movie))}</p>
          <p class="battle-card-rating">Ваша оценка: <strong>${esc(formatUserRating(movie))}</strong></p>
          ${externalRatingsHtml(movie)}
          ${overviewSnippet(movie)}
          ${selectable ? '<span class="battle-card-pick">Выбрать</span>' : ''}
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
        <button type="button" class="battle-mode-card${featured}" data-mode="quick" data-media="${mediaType}">
          <span class="battle-mode-name">Быстрая битва</span>
          <span class="battle-mode-desc">${isTv ? '8 сериалов, 7 выборов, быстрый топ-3.' : '8 фильмов, 7 выборов, быстрый топ-3.'}</span>
          ${watched < min ? `<span class="battle-mode-hint">Нужно ${min} ${typeLabel} (сейчас ${watched})</span>` : ''}
        </button>
      `;
    }

    if (mode === 'full') {
      const min = isTv ? L.MIN_SERIES : L.MIN_FULL;
      return `
        <button type="button" class="battle-mode-card" data-mode="full" data-media="${mediaType}">
          <span class="battle-mode-name">Полная битва</span>
          <span class="battle-mode-desc">Более точный рейтинг по всем просмотренным ${typeLabel}.</span>
          ${watched < min ? `<span class="battle-mode-hint">Нужно ${min} ${typeLabel}</span>` : ''}
        </button>
      `;
    }

    return `
      <button type="button" class="battle-mode-card" data-mode="genre" data-media="${mediaType}">
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
        <h2 class="battle-header-title">Выберите режим битвы</h2>
        <button type="button" class="battle-close-btn" data-action="close" aria-label="Закрыть">✕</button>
      </header>
      <div class="battle-mode-sections battle-fade-in">
        <section class="battle-mode-section">
          <h3 class="battle-mode-section-title">Битва фильмов</h3>
          <p class="battle-mode-section-meta">${movieCount} в «Посмотрел»</p>
          <div class="battle-mode-grid">
            ${renderModeCard('quick', 'movie')}
            ${renderModeCard('full', 'movie')}
            ${renderModeCard('genre', 'movie')}
          </div>
        </section>
        <section class="battle-mode-section">
          <h3 class="battle-mode-section-title">Битва сериалов</h3>
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
        <h2 class="battle-header-title">${esc(sectionTitle)}</h2>
        <button type="button" class="battle-close-btn" data-action="close" aria-label="Закрыть">✕</button>
      </header>
      <div class="battle-genre-list battle-fade-in">
        ${genres.length ? genres.map((g) => {
          const disabled = g.count < L.MIN_GENRE;
          const display = g.name.charAt(0).toUpperCase() + g.name.slice(1);
          return `
            <button type="button" class="battle-genre-item${disabled ? ' battle-genre-item--disabled' : ''}"
              data-genre="${esc(g.name)}" data-media="${mediaType}" ${disabled ? 'disabled' : ''}>
              <span>${esc(display)}</span>
              <span class="battle-genre-count">${g.count} ${typeLabel}</span>
            </button>
          `;
        }).join('') : `<p class="battle-empty">${esc(emptyText)}</p>`}
      </div>
      <div class="battle-footer-actions">
        <button type="button" class="battle-btn battle-btn--ghost" data-action="modes">Назад</button>
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
          <h2 class="battle-header-title">${esc(modeHeaderLabel())}</h2>
          <span class="battle-progress-label">Раунд ${progress.current} / ${progress.total}</span>
        </div>
        <button type="button" class="battle-close-btn" data-action="close" aria-label="Закрыть">✕</button>
      </header>
      <p class="battle-prompt battle-fade-in">Что выбираете?</p>
      <p class="battle-prompt-sub">Нажмите на ${pickLabel}, который нравится вам больше.</p>
      <div class="battle-arena battle-pair-enter" id="battle-arena">
        ${buildBattleCard(pair.left, 'left')}
        <div class="battle-vs" aria-hidden="true">VS</div>
        ${buildBattleCard(pair.right, 'right')}
      </div>
      <footer class="battle-footer">
        <button type="button" class="battle-btn battle-btn--ghost battle-skip-btn" data-action="skip">Пропустить пару</button>
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
    return `
      <div class="battle-result-card battle-result-card--${size} battle-result-stagger" data-place="${item.place}">
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
        <h2 class="battle-results-title battle-fade-in">Ваш личный рейтинг</h2>
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
        <h2 class="battle-results-title battle-fade-in">Ваш топ-3 готов</h2>
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
        <h2 class="battle-header-title">${esc(modeHeaderLabel())}</h2>
        <button type="button" class="battle-close-btn" data-action="close" aria-label="Закрыть">✕</button>
      </header>
      ${body}
      <div class="battle-final-actions battle-fade-in">
        <button type="button" class="battle-btn battle-btn--primary" data-action="save"${state.saved ? ' disabled' : ''}>
          ${state.saved ? 'Сохранено' : 'Сохранить результат'}
        </button>
        <button type="button" class="battle-btn battle-btn--ghost" data-action="replay">Сыграть ещё раз</button>
        <button type="button" class="battle-btn battle-btn--ghost" data-action="modes">Другой режим</button>
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
        saveBtn.textContent = 'Сохранено';
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
      <h3 class="battle-home-top-title">Мой топ</h3>
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
