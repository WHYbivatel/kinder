(function () {
  const stack = document.getElementById('discover-stack');
  if (!stack) return;

  const refreshBtn = document.getElementById('discover-refresh');
  const likeBtn = document.getElementById('discover-like');
  const skipBtn = document.getElementById('discover-skip');
  const statusEl = document.getElementById('discover-status');
  const hintEl = document.getElementById('discover-hint');

  const BATCH_SIZE = 10;
  const SWIPE_THRESHOLD = 96;
  const feeds = {
    movie: { label: 'Подборка фильмов', mediaType: 'movie' },
    tv: { label: 'Подборка сериалов', mediaType: 'tv' },
    animation: { label: 'Анимационные и мультсериалы', mediaType: 'tv', category: 'animation' }
  };
  const localRecommendations = [
    { title: 'Интерстеллар', originalTitle: 'Interstellar', mediaType: 'movie', reason: 'Большая научная фантастика', genres: ['Фантастика', 'Драма'] },
    { title: 'Начало', originalTitle: 'Inception', mediaType: 'movie', reason: 'Умный триллер с сильной идеей', genres: ['Фантастика', 'Триллер'] },
    { title: 'Матрица', originalTitle: 'The Matrix', mediaType: 'movie', reason: 'Классика фантастики и экшена', genres: ['Фантастика', 'Экшен'] },
    { title: 'Достать ножи', originalTitle: 'Knives Out', mediaType: 'movie', reason: 'Легкий и умный детектив', genres: ['Детектив', 'Комедия'] },
    { title: 'Одержимость', originalTitle: 'Whiplash', mediaType: 'movie', reason: 'Напряженная история про амбиции', genres: ['Драма', 'Музыка'] },
    { title: 'Дюна', originalTitle: 'Dune', mediaType: 'movie', reason: 'Эпичная фантастика с сильной атмосферой', genres: ['Фантастика', 'Приключения'] },
    { title: 'Во все тяжкие', originalTitle: 'Breaking Bad', mediaType: 'tv', reason: 'Сильная криминальная драма', genres: ['Криминал', 'Драма'] },
    { title: 'Чернобыль', originalTitle: 'Chernobyl', mediaType: 'tv', reason: 'Мини-сериал с мощной драматургией', genres: ['Драма', 'История'] },
    { title: 'Настоящий детектив', originalTitle: 'True Detective', mediaType: 'tv', reason: 'Атмосферный криминальный сериал', genres: ['Криминал', 'Детектив'] },
    { title: 'Тьма', originalTitle: 'Dark', mediaType: 'tv', reason: 'Сложная фантастическая загадка', genres: ['Фантастика', 'Драма'] },
    { title: 'Аркейн', originalTitle: 'Arcane', mediaType: 'tv', reason: 'Сильная анимационная драма', genres: ['Анимация', 'Драма'] },
    { title: 'Рик и Морти', originalTitle: 'Rick and Morty', mediaType: 'tv', reason: 'Научная фантастика и черный юмор', genres: ['Анимация', 'Комедия'] },
    { title: 'Гравити Фолз', originalTitle: 'Gravity Falls', mediaType: 'tv', reason: 'Мистика и юмор для всей семьи', genres: ['Анимация', 'Приключения'] },
    { title: 'Аватар: Легенда об Аанге', originalTitle: 'Avatar: The Last Airbender', mediaType: 'tv', reason: 'Культовый мультсериал с приключениями', genres: ['Анимация', 'Фэнтези'] }
  ];

  let activeFeed = 'movie';
  let items = [];
  let index = 0;
  let loading = false;
  let pointerState = null;

  function esc(text) {
    return window.MovieDisplay?.escapeHtml(text) || String(text || '');
  }

  function normalizeTitle(title) {
    return String(title || '').toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();
  }

  function isAnimationItem(item) {
    if ((item.mediaType || 'movie') !== 'tv') return false;
    const haystack = `${item.title || ''} ${(item.genres || []).join(' ')}`;
    return /анимац|мульт|animation|cartoon/i.test(haystack);
  }

  function matchesFeed(item, feed) {
    const mediaType = item.mediaType || 'movie';
    if (feed === 'movie') return mediaType === 'movie';
    if (feed === 'animation') return isAnimationItem(item);
    return mediaType === 'tv' && !isAnimationItem(item);
  }

  function recommendationKey(item) {
    if (item.tmdbId) return `${item.mediaType || 'movie'}:tmdb:${item.tmdbId}`;
    return `${item.mediaType || 'movie'}:title:${normalizeTitle(item.title || item.originalTitle)}`;
  }

  function existingTitles() {
    return (window.MovieApp?.getMovies?.() || []).map((movie) => movie.title);
  }

  function isAlreadySaved(item) {
    const title = normalizeTitle(item.title);
    const mediaType = item.mediaType || 'movie';
    return (window.MovieApp?.getMovies?.() || []).some((movie) =>
      normalizeTitle(movie.title) === title && (movie.mediaType || 'movie') === mediaType
    );
  }

  function localTopUp(limit, knownKeys) {
    const blockedTitles = new Set(existingTitles().map(normalizeTitle));
    const picked = [];
    localRecommendations.forEach((item) => {
      if (picked.length >= limit) return;
      if (!matchesFeed(item, activeFeed)) return;
      if (blockedTitles.has(normalizeTitle(item.title)) || blockedTitles.has(normalizeTitle(item.originalTitle))) return;
      const key = recommendationKey(item);
      if (knownKeys.has(key)) return;
      knownKeys.add(key);
      picked.push({
        ...item,
        whyDetailed: item.whyDetailed || 'Локальная рекомендация добавлена, чтобы свайп-лента продолжала работать даже без AI.'
      });
    });
    return picked;
  }

  function setStatus(message, tone) {
    if (!statusEl) return;
    statusEl.textContent = message || '';
    statusEl.className = `discover-status${tone ? ` discover-status--${tone}` : ''}`;
  }

  function setLoading(next) {
    loading = next;
    if (refreshBtn) {
      refreshBtn.disabled = next;
      refreshBtn.textContent = next ? 'Загрузка...' : 'Обновить';
    }
    if (likeBtn) likeBtn.disabled = next || !items[index];
    if (skipBtn) skipBtn.disabled = next || !items[index];
  }

  function posterSrc(item) {
    return window.MovieDisplay?.posterUrl(item.poster) || item.poster || '';
  }

  function mediaLabel(item) {
    if (isAnimationItem(item)) return 'Мультсериал';
    return item.mediaType === 'tv' ? 'Сериал' : 'Фильм';
  }

  function formatRuntime(minutes) {
    if (!minutes) return '';
    if (minutes >= 60) {
      const hours = Math.floor(minutes / 60);
      const rest = minutes % 60;
      return rest ? `${hours} ч ${rest} мин` : `${hours} ч`;
    }
    return `${minutes} мин`;
  }

  function renderCard(item, offset) {
    const card = document.createElement('article');
    card.className = `discover-card${offset === 0 ? ' discover-card--top' : ' discover-card--behind'}`;
    card.style.setProperty('--stack-offset', String(offset));
    card.dataset.index = String(index + offset);

    const poster = posterSrc(item);
    const year = item.year || item.releaseDate?.slice(0, 4) || '';
    const meta = [year, item.director, formatRuntime(item.runtime), mediaLabel(item)].filter(Boolean).join(' · ');
    const genres = (item.genres || []).slice(0, 4);
    const description = item.overview || item.whyDetailed || item.reason || '';

    card.innerHTML = `
      <div class="discover-badge discover-badge--like">Хочу</div>
      <div class="discover-badge discover-badge--skip">Пропуск</div>
      <div class="discover-poster ${poster ? '' : 'discover-poster--empty'}">
        ${poster ? `<img src="${esc(poster)}" alt="${esc(item.title)}" loading="lazy" decoding="async">` : '<span>🎬</span>'}
      </div>
      <div class="discover-card-info">
        <div class="discover-card-title-row">
          <h3>${esc(item.title)}</h3>
          ${isAlreadySaved(item) ? '<span class="discover-saved-pill">В списке</span>' : ''}
        </div>
        ${window.MovieDisplay?.formatOriginalTitleHtml(item.originalTitle, item.title, 'discover-original-title') || ''}
        ${meta ? `<p class="discover-meta">${esc(meta)}</p>` : ''}
        ${genres.length ? `<div class="discover-genres">${genres.map((genre) => `<span>${esc(genre)}</span>`).join('')}</div>` : ''}
        ${item.reason ? `<p class="discover-reason">${esc(item.reason)}</p>` : ''}
        ${description ? `<button type="button" class="discover-desc-btn">Описание</button>` : ''}
      </div>
    `;

    const descBtn = card.querySelector('.discover-desc-btn');
    descBtn?.addEventListener('click', (event) => {
      event.stopPropagation();
      window.openModal?.(item.title, `
        ${item.reason ? `<h4>Почему в подборке</h4><p>${esc(item.reason)}</p>` : ''}
        ${item.whyDetailed && item.whyDetailed !== item.reason ? `<h4>Подробнее</h4><p>${esc(item.whyDetailed)}</p>` : ''}
        ${item.overview ? `<h4>Сюжет</h4><p>${esc(item.overview)}</p>` : ''}
      `);
    });

    if (offset === 0) attachSwipe(card);
    return card;
  }

  function renderStack() {
    stack.innerHTML = '';
    const visible = items.slice(index, index + 2);
    if (!visible.length) {
      stack.innerHTML = `
        <div class="discover-empty">
          <strong>Карточки закончились</strong>
          <span>Нажмите «Обновить», чтобы получить новую пачку рекомендаций.</span>
        </div>
      `;
      setLoading(false);
      return;
    }

    visible.reverse().forEach((item, reverseOffset) => {
      const offset = visible.length - reverseOffset - 1;
      stack.appendChild(renderCard(item, offset));
    });
    setLoading(false);
  }

  function attachSwipe(card) {
    card.addEventListener('pointerdown', (event) => {
      if (loading) return;
      pointerState = {
        startX: event.clientX,
        startY: event.clientY,
        x: 0,
        pointerId: event.pointerId
      };
      card.setPointerCapture(event.pointerId);
      card.classList.add('discover-card--dragging');
    });

    card.addEventListener('pointermove', (event) => {
      if (!pointerState || pointerState.pointerId !== event.pointerId) return;
      pointerState.x = event.clientX - pointerState.startX;
      const y = (event.clientY - pointerState.startY) * 0.12;
      const rotation = Math.max(-10, Math.min(10, pointerState.x / 14));
      card.style.transform = `translate(${pointerState.x}px, ${y}px) rotate(${rotation}deg)`;
      card.classList.toggle('discover-card--like', pointerState.x > SWIPE_THRESHOLD * 0.45);
      card.classList.toggle('discover-card--skip', pointerState.x < -SWIPE_THRESHOLD * 0.45);
    });

    card.addEventListener('pointerup', (event) => finishPointer(card, event.pointerId));
    card.addEventListener('pointercancel', (event) => finishPointer(card, event.pointerId, true));
  }

  function finishPointer(card, pointerId, cancelled = false) {
    if (!pointerState || pointerState.pointerId !== pointerId) return;
    const x = pointerState.x;
    pointerState = null;
    card.classList.remove('discover-card--dragging');

    if (!cancelled && x > SWIPE_THRESHOLD) {
      animateChoice('like');
    } else if (!cancelled && x < -SWIPE_THRESHOLD) {
      animateChoice('skip');
    } else {
      card.style.transform = '';
      card.classList.remove('discover-card--like', 'discover-card--skip');
    }
  }

  function animateChoice(choice) {
    const card = stack.querySelector('.discover-card--top');
    if (!card || loading) return;
    setLoading(true);
    card.classList.add(choice === 'like' ? 'discover-card--out-like' : 'discover-card--out-skip');
    window.setTimeout(() => {
      if (choice === 'like') {
        addCurrent();
      } else {
        nextCard('Пропущено');
      }
    }, 230);
  }

  function nextCard(message, tone) {
    index += 1;
    setStatus(message || '', tone);
    renderStack();
    if (items.length - index <= 3 && !loading) {
      loadFeed(true).catch(() => undefined);
    }
  }

  async function addCurrent() {
    const item = items[index];
    if (!item) return;
    if (isAlreadySaved(item)) {
      nextCard('Уже есть в списке', 'success');
      return;
    }

    try {
      const result = await window.MovieApp.executeActions([{
        type: 'add_movie',
        title: item.title,
        status: 'want',
        mediaType: item.mediaType || 'movie',
        tmdbId: item.tmdbId,
        genres: item.genres || [],
        meta: {
          poster: item.poster,
          year: item.year,
          overview: item.overview,
          hdrezkaUrl: item.hdrezkaUrl,
          originalTitle: item.originalTitle
        }
      }]);

      if (result?.[0]?.success) {
        nextCard(`Добавлено: ${item.title}`, 'success');
        return;
      }

      nextCard(result?.[0]?.error || 'Не удалось добавить', 'error');
    } catch (error) {
      nextCard(error.message || 'Не удалось сохранить на сервер', 'error');
    }
  }

  async function loadFeed(append = false) {
    if (loading && !append) return;
    setLoading(true);
    if (!append) {
      items = [];
      index = 0;
      stack.innerHTML = window.LoadingUI?.aiRecommendations('Загружаю свайп-ленту...', 1, { tag: 'div' }) || '<div class="rec-empty">Загрузка...</div>';
      setStatus('');
    }
    if (hintEl) hintEl.textContent = feeds[activeFeed].label;

    try {
      const params = new URLSearchParams();
      params.set('limit', String(BATCH_SIZE));
      params.set('excludeTitles', [...existingTitles(), ...items.map((item) => item.title)].filter(Boolean).join(','));
      if (feeds[activeFeed].mediaType) params.set('mediaType', feeds[activeFeed].mediaType);
      if (feeds[activeFeed].category) params.set('category', feeds[activeFeed].category);

      const response = await fetch(`/api/recommendations?${params}`, { headers: window.authHeaders() });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Ошибка загрузки');

      const knownKeys = new Set(items.map(recommendationKey));
      const fresh = (data.recommendations || [])
        .filter((item) => matchesFeed(item, activeFeed))
        .filter((item) => {
          const key = recommendationKey(item);
          if (knownKeys.has(key) || isAlreadySaved(item)) return false;
          knownKeys.add(key);
          return true;
        });
      const topUp = localTopUp(Math.max(0, BATCH_SIZE - fresh.length), knownKeys);
      items = append ? [...items, ...fresh, ...topUp] : [...fresh, ...topUp].slice(0, BATCH_SIZE);
      if (!items.length) setStatus('Пока нечего показать для этой ленты.', 'error');
    } catch (error) {
      const knownKeys = new Set(items.map(recommendationKey));
      const fallback = localTopUp(BATCH_SIZE, knownKeys);
      items = append ? [...items, ...fallback] : fallback;
      setStatus(fallback.length ? 'Показываю локальные рекомендации, сервер недоступен.' : (error.message || 'Ошибка загрузки'), fallback.length ? '' : 'error');
    } finally {
      renderStack();
    }
  }

  document.querySelectorAll('.discover-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      const nextFeed = tab.dataset.feed;
      if (!nextFeed || nextFeed === activeFeed || loading) return;
      activeFeed = nextFeed;
      document.querySelectorAll('.discover-tab').forEach((item) => {
        item.classList.toggle('discover-tab--active', item === tab);
      });
      loadFeed(false);
    });
  });

  refreshBtn?.addEventListener('click', () => loadFeed(false));
  likeBtn?.addEventListener('click', () => animateChoice('like'));
  skipBtn?.addEventListener('click', () => animateChoice('skip'));

  window.DiscoverPWA = {
    refresh: () => loadFeed(false)
  };
})();
