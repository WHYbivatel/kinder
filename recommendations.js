const recommendationsBox = document.getElementById('recommendations-box');
const recommendationsList = document.getElementById('recommendations-list');
const recRefreshBtn = document.getElementById('rec-refresh-btn');

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/"/g, '&quot;');
}

function isMovieInList(title) {
  const lower = title.toLowerCase().trim();
  return window.MovieApp.getMovies().some(function (movie) {
    return movie.title.toLowerCase() === lower;
  });
}

function createRecButton(title) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'rec-add-btn';
  btn.title = 'Добавить в список';

  if (isMovieInList(title)) {
    btn.textContent = '✓';
    btn.disabled = true;
    btn.classList.add('rec-add-btn--added');
    return btn;
  }

  btn.textContent = '+';
  btn.addEventListener('click', function () {
    const result = window.MovieApp.executeActions([{
      type: 'add_movie',
      title: title,
      status: 'want'
    }]);

    if (result[0].success) {
      btn.textContent = '✓';
      btn.disabled = true;
      btn.classList.add('rec-add-btn--added');
    } else {
      btn.textContent = '—';
      btn.disabled = true;
      btn.title = result[0].error;
    }
  });

  return btn;
}

function renderRecPoster(item) {
  const poster = document.createElement('div');
  poster.className = 'rec-poster';

  if (item.poster) {
    const img = document.createElement('img');
    img.className = 'rec-poster-img';
    img.src = window.MovieDisplay?.posterUrl(item.poster) || item.poster;
    img.alt = item.title;
    img.loading = 'lazy';
    img.decoding = 'async';
    poster.appendChild(img);
  } else {
    poster.classList.add('rec-poster--empty');
    poster.textContent = '🎬';
  }

  return poster;
}

function renderRecItem(item) {
  const li = document.createElement('li');
  li.className = 'rec-item';

  li.appendChild(renderRecPoster(item));

  const info = document.createElement('div');
  info.className = 'rec-info';

  const titleRow = document.createElement('div');
  titleRow.className = 'rec-title-row';

  const titleEl = document.createElement('strong');
  titleEl.textContent = item.title;
  titleRow.appendChild(titleEl);

  if (item.year) {
    const yearEl = document.createElement('span');
    yearEl.className = 'rec-year';
    yearEl.textContent = item.year;
    titleRow.appendChild(yearEl);
  }

  info.appendChild(titleRow);

  const originalHtml = window.MovieDisplay?.formatOriginalTitleHtml(
    item.originalTitle,
    item.title,
    'rec-original-title'
  );
  if (originalHtml) {
    info.insertAdjacentHTML('beforeend', originalHtml);
  }

  const reasonEl = document.createElement('span');
  reasonEl.className = 'rec-reason';
  reasonEl.textContent = item.reason || '';

  info.appendChild(reasonEl);

  const whyText = item.whyDetailed && item.whyDetailed !== item.reason
    ? item.whyDetailed
    : (item.whyDetailed && !item.reason ? item.whyDetailed : null);
  const whyToggle = window.MovieDisplay?.createWhyToggle(whyText);
  if (whyToggle) info.appendChild(whyToggle);

  li.appendChild(info);

  if (item.title !== 'Начните с просмотра') {
    li.appendChild(createRecButton(item.title));
  }

  return li;
}

async function refreshRecommendations() {
  recommendationsList.innerHTML = window.LoadingUI.aiRecommendations('Подбираю рекомендации...', 3, { tag: 'li' });
  if (recRefreshBtn) {
    recRefreshBtn.disabled = true;
    recRefreshBtn.textContent = 'Загрузка...';
  }

  try {
    const response = await fetch('/api/recommendations', {
      headers: window.authHeaders()
    });

    const data = await response.json();
    recommendationsList.innerHTML = '';

    if (!response.ok) {
      recommendationsList.innerHTML = `<li class="rec-empty">${escapeHtml(data.error || 'Не удалось загрузить')}</li>`;
      return;
    }

    if (!data.recommendations || data.recommendations.length === 0) {
      recommendationsList.innerHTML = '<li class="rec-empty">Пока нет рекомендаций</li>';
      return;
    }

    data.recommendations.forEach(function (item) {
      recommendationsList.appendChild(renderRecItem(item));
    });
  } catch (error) {
    recommendationsList.innerHTML = '<li class="rec-empty">Сервер недоступен</li>';
  } finally {
    if (recRefreshBtn) {
      recRefreshBtn.disabled = false;
      recRefreshBtn.textContent = 'Обновить';
    }
  }
}

function showRecommendationsPlaceholder() {
  recommendationsList.innerHTML = '<li class="rec-empty">Нажмите «Обновить», чтобы получить рекомендации</li>';
}

recRefreshBtn?.addEventListener('click', refreshRecommendations);
showRecommendationsPlaceholder();

window.refreshRecommendations = refreshRecommendations;
