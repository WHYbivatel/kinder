// Умные подборки
const collectionPresets = document.getElementById('collection-presets');
const collectionInput = document.getElementById('collection-input');
const collectionSubmit = document.getElementById('collection-submit');
const collectionResults = document.getElementById('collection-results');

const ft = (key, fallback) => (window.t ? window.t(key) : fallback);

const COLLECTION_QUERY_FALLBACKS = {
  empty: 'Опишите, что хотите посмотреть — хотя бы пару слов.',
  too_short: 'Слишком короткий запрос — опишите подробнее.',
  too_long: 'Слишком длинный запрос — сократите до пары предложений.',
  profanity: 'Напишите, что хотите посмотреть — настроение или жанр, без ругательств.',
  off_topic: 'Не понял запрос. Опишите настроение, жанр или ситуацию — например: «устал, хочу лёгкую комедию».'
};

let collectionQueryModule = null;
import('./collectionQueryValidation.js')
  .then((mod) => { collectionQueryModule = mod; })
  .catch(() => undefined);

function collectionQueryErrorText(code) {
  const key = collectionQueryModule?.collectionQueryErrorKey?.(code);
  if (key) return ft(key, COLLECTION_QUERY_FALLBACKS[code] || ft('collections.error', 'Ошибка подборки'));
  return COLLECTION_QUERY_FALLBACKS[code] || ft('collections.error', 'Ошибка подборки');
}

const PRESETS = [
  { id: 'evening', labelKey: 'preset.evening', label: 'На вечер' },
  { id: 'weekend', labelKey: 'preset.weekend', label: 'На выходные' },
  { id: 'short', labelKey: 'preset.short', label: 'До 90 мин' },
  { id: 'alone', labelKey: 'preset.alone', label: 'Одному' },
  { id: 'date', labelKey: 'preset.date', label: 'С парой' },
  { id: 'friends', labelKey: 'preset.friends', label: 'С друзьями' },
  { id: 'light', labelKey: 'preset.light', label: 'Лёгкое' },
  { id: 'serious', labelKey: 'preset.serious', label: 'Серьёзное' },
  { id: 'puzzle', labelKey: 'preset.puzzle', label: 'Мозголомки' },
  { id: 'twist', labelKey: 'preset.twist', label: 'С концовкой' }
];

function renderPickList(container, items, titleKey, reasonKey) {
  container.innerHTML = '';
  items.forEach((item) => {
    const li = document.createElement('li');
    li.className = 'pick-item';
    const title = window.MovieDisplay?.displayTitle(item) || item[titleKey];
    const originalHtml = window.MovieDisplay.formatOriginalTitleHtml(
      item.originalTitle,
      title,
      'pick-original-title'
    );
    const yearHtml = item.year ? `<span class="pick-year">${item.year}</span>` : '';
    const posterSrc = window.MovieDisplay.posterUrl(item.poster);
    const posterHtml = posterSrc
      ? `<img class="pick-poster-img" src="${window.MovieDisplay.escapeHtml(posterSrc)}" alt="${window.MovieDisplay.escapeHtml(title)}" loading="lazy" decoding="async">`
      : '<span class="pick-poster-empty">🎬</span>';
    li.innerHTML = `
      <div class="pick-poster">${posterHtml}</div>
      <div class="pick-info">
        <div class="pick-title-row">
          <strong>${window.MovieDisplay.escapeHtml(title)}</strong>
          ${yearHtml}
        </div>
        ${originalHtml}
        <p class="pick-reason">${window.MovieDisplay.escapeHtml(item[reasonKey] || '')}</p>
      </div>
      <button type="button" class="rec-add-btn pick-add-btn" title="Добавить в список">+</button>
    `;
    const whyText = item.whyDetailed && item.whyDetailed !== item[reasonKey]
      ? item.whyDetailed
      : null;
    const whyToggle = window.MovieDisplay?.createWhyToggle(whyText);
    if (whyToggle) li.querySelector('.pick-info').appendChild(whyToggle);
    li.querySelector('.pick-add-btn').addEventListener('click', function () {
      const result = window.MovieApp.addMovie({
        title,
        status: 'want',
        mediaType: item.mediaType || 'movie'
      });
      if (result.success) {
        this.textContent = '✓';
        this.disabled = true;
        this.classList.add('rec-add-btn--added');
      }
    });
    container.appendChild(li);
  });
}

async function loadCollection(query, preset) {
  collectionResults.innerHTML = window.LoadingUI.aiRecommendations(ft('collections.picking', 'Подбираю...'), 3, { tag: 'li' });
  try {
    const res = await fetch('/api/collections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...window.authHeaders() },
      body: JSON.stringify({ query, preset })
    });
    const data = await res.json();
    if (!res.ok) {
      if (res.status === 401 && window.requireLogin) {
        window.requireLogin(data.error || ft('collections.loginRequired', 'Войдите, чтобы пользоваться умными подборками.'));
      }
      const msg = data.error || (data.code ? collectionQueryErrorText(data.code) : ft('collections.error', 'Ошибка подборки'));
      collectionResults.innerHTML = `<li class="rec-empty">${msg}</li>`;
      return;
    }
    const picks = data.picks || [];
    if (!picks.length) {
      collectionResults.innerHTML = `<li class="rec-empty">${data.notice || ft('collections.empty', 'Ничего не подобралось. Отметьте фильмы как «посмотрел» и поставьте оценки.')}</li>`;
      return;
    }
    renderPickList(collectionResults, picks, 'title', 'reason');
  } catch (e) {
    collectionResults.innerHTML = `<li class="rec-empty">${ft('collections.serverDown', 'Сервер недоступен')}</li>`;
  }
}

if (collectionPresets) {
  PRESETS.forEach((p) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'preset-btn';
    btn.dataset.presetKey = p.labelKey;
    btn.textContent = ft(p.labelKey, p.label);
    btn.addEventListener('click', () => loadCollection(null, p.id));
    collectionPresets.appendChild(btn);
  });
  document.addEventListener('i18n:change', () => {
    collectionPresets.querySelectorAll('.preset-btn').forEach((btn) => {
      const key = btn.dataset.presetKey;
      if (key) btn.textContent = ft(key, btn.textContent);
    });
  });
}

function submitFreeCollection() {
  const q = collectionInput?.value.trim() || '';
  if (!q) {
    if (collectionResults) {
      collectionResults.innerHTML = `<li class="rec-empty">${ft('collections.inputRequired', 'Опишите, что хотите посмотреть — хотя бы пару слов.')}</li>`;
    }
    collectionInput?.focus();
    return;
  }
  if (collectionQueryModule?.validateCollectionQuery) {
    const validation = collectionQueryModule.validateCollectionQuery(q);
    if (!validation.ok) {
      if (collectionResults) {
        collectionResults.innerHTML = `<li class="rec-empty">${collectionQueryErrorText(validation.code)}</li>`;
      }
      collectionInput?.focus();
      return;
    }
  }
  loadCollection(q, null);
}

collectionSubmit?.addEventListener('click', submitFreeCollection);

// Enter в поле запроса — тоже запускает подбор.
collectionInput?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    submitFreeCollection();
  }
});

// Импорт
const importText = document.getElementById('import-text');
const importBtn = document.getElementById('import-btn');
const importStatus = document.getElementById('import-status');

importBtn?.addEventListener('click', async () => {
  const text = importText?.value.trim();
  if (!text) return;
  importStatus.textContent = 'Распознаю...';
  try {
    const res = await fetch('/api/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...window.authHeaders() },
      body: JSON.stringify({ text })
    });
    const data = await res.json();
    if (!res.ok) {
      importStatus.textContent = data.error || 'Ошибка';
      return;
    }
    let added = 0;
    (data.movies || []).forEach((m) => {
      const r = window.MovieApp.executeActions([{ type: 'add_movie', ...m }]);
      if (r[0]?.success) added++;
    });
    importStatus.textContent = data.localFallback
      ? `Добавлено: ${added} (простой импорт без AI — по одному названию на строку)`
      : `Добавлено: ${added} из ${data.movies?.length || 0}`;
    importText.value = '';
  } catch (e) {
    importStatus.textContent = 'Сервер недоступен';
  }
});

// Статистика
const statsGrid = document.getElementById('stats-grid');
const statsRecent = document.getElementById('stats-recent');
const statsMonthly = document.getElementById('stats-monthly');

async function refreshStats() {
  if (!statsGrid) return;
  statsGrid.innerHTML = window.LoadingUI.statGrid();
  if (statsRecent) statsRecent.innerHTML = window.LoadingUI.skeletonLines(3);
  if (statsMonthly) statsMonthly.innerHTML = window.LoadingUI.skeletonLines(4);
  const genresEl = document.getElementById('stats-genres');
  if (genresEl) genresEl.innerHTML = window.LoadingUI.skeletonLines(2);
  try {
    const res = await fetch('/api/stats', { headers: window.authHeaders() });
    const data = await res.json();
    if (!res.ok) return;

    statsGrid.innerHTML = `
      <div class="stat-card"><span class="stat-num">${data.totalWatched ?? 0}</span><span class="stat-label">${ft('stats.watched', 'просмотрено')}</span></div>
      <div class="stat-card"><span class="stat-num">${data.plannedCount ?? 0}</span><span class="stat-label">${ft('stats.planned', 'в планах')}</span></div>
      <div class="stat-card"><span class="stat-num">${data.avgRating ?? '—'}</span><span class="stat-label">${ft('stats.avgRating', 'средняя оценка')}</span></div>
    `;

    if (statsRecent) {
      statsRecent.innerHTML = (data.recent || []).map((m) =>
        `<li>${m.title} — ${new Date(m.watchedAt).toLocaleDateString('ru')} ${m.rating ? `(${m.rating}/10)` : ''}</li>`
      ).join('') || `<li class="rec-empty">${ft('stats.noGenres', 'Пока нет')}</li>`;
    }

    if (statsMonthly) {
      statsMonthly.innerHTML = (data.monthly || []).map(([month, count]) =>
        `<li><span>${month}</span><div class="bar-wrap"><div class="bar" style="width:${Math.min(count * 20, 100)}%"></div></div><span>${count}</span></li>`
      ).join('') || `<li class="rec-empty">${ft('stats.noGenres', 'Пока нет')}</li>`;
    }

    const genresEl = document.getElementById('stats-genres');
    if (genresEl) {
      genresEl.innerHTML = (data.favoriteGenres || []).map((g) =>
        `<span class="tag-chip">${window.MovieDisplay?.escapeHtml(window.MovieDisplay?.displayGenre(g.name) || g.name)} <small>${g.count}</small></span>`
      ).join('') || `<span class="rec-empty">${ft('stats.noGenres', 'Пока нет данных')}</span>`;
    }
  } catch (e) { /* skip */ }
}

window.refreshStats = refreshStats;

document.addEventListener('i18n:change', () => {
  window.refreshStats?.();
});

// Модалки
const modalOverlay = document.getElementById('modal-overlay');
const modalTitle = document.getElementById('modal-title');
const modalBody = document.getElementById('modal-body');
const modalClose = document.getElementById('modal-close');

function closeModal() {
  modalOverlay?.classList.add('hidden');
}

modalClose?.addEventListener('click', closeModal);
modalOverlay?.addEventListener('click', (e) => {
  if (e.target === modalOverlay) closeModal();
});

// Надёжное закрытие через делегирование: срабатывает, даже если прямой
// слушатель на кнопке был потерян (перерисовка DOM / порядок загрузки),
// плюс закрытие по Escape.
document.addEventListener('click', (e) => {
  if (e.target.closest('#modal-close')) {
    e.preventDefault();
    closeModal();
  }
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && modalOverlay && !modalOverlay.classList.contains('hidden')) {
    closeModal();
  }
});

function openModal(title, bodyHtml) {
  modalTitle.textContent = title;
  modalBody.innerHTML = bodyHtml;
  modalOverlay.classList.remove('hidden');
}

window.openModal = openModal;
window.closeModal = closeModal;

window.openMovieOverview = function (movieId) {
  const movie = window.MovieApp.findMovieById(movieId);
  const overview = window.MovieDisplay?.displayOverview(movie);
  if (!overview) return;

  const title = window.MovieDisplay?.displayTitle(movie) || movie.meta?.matchedTitle || movie.title;
  const body = `<p class="overview-full">${window.MovieDisplay.escapeHtml(overview)}</p>`;
  openModal(title, body);
};

window.showTmdbPicker = function (results, title = 'Выберите фильм') {
  return new Promise((resolve) => {
    let html = '<ul class="tmdb-pick-list">';
    results.forEach((r) => {
      const original = r.originalTitle && r.originalTitle !== r.title
        ? `<small>${r.originalTitle}</small>` : '';
      html += `<li class="tmdb-pick" data-id="${r.tmdbId}">
        ${r.poster ? `<img src="${window.MovieDisplay.escapeHtml(window.MovieDisplay.posterUrl(r.poster))}" alt="">` : '<div class="tmdb-pick-no-poster">🎬</div>'}
        <div><strong>${r.title}</strong> (${r.year || '?'}) ${original}
        <p>${r.overview || ''}${r.overview ? '...' : ''}</p></div>
      </li>`;
    });
    html += '</ul><button type="button" class="btn-cancel-pick">Отмена</button>';
    openModal(title, html);

    modalBody.querySelectorAll('.tmdb-pick').forEach((el) => {
      el.addEventListener('click', () => {
        closeModal();
        resolve(Number(el.dataset.id));
      });
    });

    modalBody.querySelector('.btn-cancel-pick')?.addEventListener('click', () => {
      closeModal();
      resolve(null);
    });
  });
};

window.openNotesModal = function (movieId) {
  const movie = window.MovieApp.findMovieById(movieId);
  if (!movie) return;

  const n = movie.notes;
  openModal(`Заметки: ${movie.title}`, `
    <form id="notes-form" class="notes-form">
      <label>Личная заметка<textarea name="personal">${n.personal}</textarea></label>
      <label>Понравилось<textarea name="liked">${n.liked}</textarea></label>
      <label>Не понравилось<textarea name="disliked">${n.disliked}</textarea></label>
      <label>Любимая сцена<textarea name="favoriteScene">${n.favoriteScene}</textarea></label>
      <label>Пересмотреть?<textarea name="rewatch">${n.rewatch}</textarea></label>
      <label>Короткий отзыв<textarea name="review">${n.review}</textarea></label>
      <button type="submit">Сохранить</button>
    </form>
  `);

  document.getElementById('notes-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const data = { title: movie.title };
    fd.forEach((v, k) => { data[k] = v; });
    window.MovieApp.updateMovieNotes(data);
    closeModal();
  });
};

window.openHistoryModal = function (movieId) {
  const movie = window.MovieApp.findMovieById(movieId);
  if (!movie) return;

  const addedLine = movie.addedAt
    ? window.MovieApp.formatDateTime(movie.addedAt)
    : 'не зафиксирована (фильм был в списке до обновления)';

  const historyItems = (movie.history || []).slice().reverse();
  const historyHtml = historyItems.length
    ? historyItems.map((entry) => `
        <li class="history-item">
          <time>${window.MovieApp.formatDateTime(entry.at)}</time>
          <strong>${window.MovieApp.historyEventLabels[entry.type] || entry.type}</strong>
          <span>${window.MovieDisplay.escapeHtml(window.MovieApp.describeHistoryEntry(entry))}</span>
        </li>
      `).join('')
    : '<li class="history-empty">История изменений пока пуста</li>';

  openModal(`История: ${movie.title}`, `
    <div class="history-modal">
      <p class="history-added"><strong>Добавлен:</strong> ${window.MovieDisplay.escapeHtml(addedLine)}</p>
      ${movie.watchedAt ? `<p class="history-watched"><strong>Отмечен как «Посмотрел»:</strong> ${window.MovieDisplay.escapeHtml(window.MovieApp.formatDateTime(movie.watchedAt))}</p>` : ''}
      <ul class="history-list">${historyHtml}</ul>
    </div>
  `);
};

window.findSimilar = async function (movieId) {
  openModal(ft('features.similarTitle', 'Похожие фильмы'), window.LoadingUI.ai(ft('features.findingSimilar', 'Ищу похожие...'), { tag: 'p', wrapClass: '' }));
  try {
    const res = await fetch('/api/similar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...window.authHeaders() },
      body: JSON.stringify({ movieId })
    });
    const data = await res.json();
    if (!res.ok) {
      modalBody.innerHTML = `<p class="rec-empty">${data.error || 'Ошибка поиска'}</p>`;
      return;
    }
    modalBody.innerHTML = '<ul id="similar-results" class="pick-results"></ul>';
    renderPickList(document.getElementById('similar-results'), data.similar || [], 'title', 'reason');
    modalTitle.textContent = 'Похожие фильмы';
  } catch (e) {
    modalBody.innerHTML = '<p class="rec-empty">Ошибка поиска</p>';
  }
};
