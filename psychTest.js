(function initPsychTest() {
  const SCALE_LABELS = {
    depth: 'Глубина',
    emotionality: 'Эмоциональность',
    dynamics: 'Динамика',
    comfort: 'Лёгкость'
  };

  const SCALE_LEVEL_LABELS = { low: 'низкая', medium: 'средняя', high: 'высокая' };

  const FEEDBACK_REASONS = [
    { id: 'too_heavy', label: 'слишком тяжёлое' },
    { id: 'too_light', label: 'слишком лёгкое' },
    { id: 'too_slow', label: 'слишком медленное' },
    { id: 'too_dynamic', label: 'слишком динамичное' },
    { id: 'wrong_genre', label: 'не тот жанр' },
    { id: 'bad_description', label: 'не нравится описание' },
    { id: 'already_seen', label: 'уже видел' },
    { id: 'other', label: 'другое' }
  ];

  const state = {
    questions: [],
    answers: {},
    currentIndex: 0,
    step: 'intro',
    psychTest: null,
    result: null,
    recommendations: [],
    dirty: false,
    saving: false,
    selectedResultId: null,
    isRetake: false,
    basedOn: null
  };

  let overlayEl = null;

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/"/g, '&quot;');
  }

  function formatDate(iso) {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleDateString('ru-RU', {
        day: 'numeric', month: 'long', year: 'numeric'
      });
    } catch {
      return '';
    }
  }

  function formatTime(iso) {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  }

  function getScaleMeta(scales, key) {
    const val = scales?.[key];
    if (typeof val === 'object' && val?.level) {
      return { level: val.level, value: val.value ?? ({ low: 33, medium: 66, high: 100 }[val.level] || 50) };
    }
    const level = val || 'medium';
    return { level, value: { low: 33, medium: 66, high: 100 }[level] || 50 };
  }

  function renderScaleBarsHtml(scales) {
    return Object.keys(SCALE_LABELS).map((key) => {
      const meta = getScaleMeta(scales, key);
      return `
        <div class="psych-scale">
          <div class="psych-scale-head">
            <span>${SCALE_LABELS[key]}</span>
            <span>${SCALE_LEVEL_LABELS[meta.level] || meta.level} · ${meta.value}%</span>
          </div>
          <div class="psych-scale-track">
            <div class="psych-scale-fill" style="width:${meta.value}%"></div>
          </div>
        </div>`;
    }).join('');
  }

  function getActiveMediaType() {
    return window.MovieApp?.getActiveFilters?.()?.mediaType || 'movie';
  }

  function isInList(title) {
    const lower = String(title || '').toLowerCase().trim();
    return (window.MovieApp?.getMovies?.() || []).some((m) => m.title.toLowerCase() === lower);
  }

  function toast(message, type = 'info') {
    const el = document.getElementById('psych-toast');
    if (!el) return;
    el.textContent = message;
    el.className = `psych-toast psych-toast--${type} psych-toast--visible`;
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => el.classList.remove('psych-toast--visible'), 3200);
  }

  function ensureOverlay() {
    if (overlayEl) return overlayEl;
    overlayEl = document.createElement('div');
    overlayEl.id = 'psych-test-overlay';
    overlayEl.className = 'psych-overlay hidden';
    overlayEl.innerHTML = `
      <div class="psych-shell" role="dialog" aria-modal="true" aria-labelledby="psych-step-title">
        <button type="button" class="psych-close" aria-label="Закрыть">✕</button>
        <div id="psych-step-content" class="psych-step-content"></div>
      </div>
      <div id="psych-toast" class="psych-toast"></div>
    `;
    document.body.appendChild(overlayEl);

    overlayEl.querySelector('.psych-close')?.addEventListener('click', handleCloseRequest);
    overlayEl.addEventListener('click', (e) => {
      if (e.target === overlayEl) handleCloseRequest();
    });

    return overlayEl;
  }

  function openOverlay() {
    ensureOverlay();
    overlayEl.classList.remove('hidden');
    document.body.classList.add('psych-open');
    renderStep();
  }

  function closeOverlay(force) {
    if (!overlayEl) return;
    if (!force && state.dirty && state.step === 'question') {
      state.step = 'confirm-exit';
      renderStep();
      return;
    }
    overlayEl.classList.add('hidden');
    document.body.classList.remove('psych-open');
    if (force) {
      state.step = 'intro';
      state.currentIndex = 0;
      state.answers = {};
      state.dirty = false;
    }
  }

  function handleCloseRequest() {
    if (state.step === 'result' || state.step === 'recommendations' || state.step === 'intro' || state.step === 'saved-notice') {
      closeOverlay(true);
      return;
    }
    if (state.dirty) {
      state.step = 'confirm-exit';
      renderStep();
      return;
    }
    closeOverlay(true);
  }

  function renderHomeBlock() {
    const block = document.getElementById('psych-test-section');
    if (!block) return;

    const hasResult = Boolean(state.psychTest?.profileTitle);
    if (!hasResult) {
      block.innerHTML = `
        <div class="psych-home-card">
          <div class="psych-home-text">
            <h2 class="section-heading">Кино-психологический тест</h2>
            <p class="panel-hint">Ответьте на 12 вопросов, а AI подберёт фильмы и сериалы под ваше состояние, настроение и стиль восприятия.</p>
          </div>
          <div class="psych-home-actions">
            <button type="button" class="btn-primary psych-home-btn" id="psych-start-btn">Пройти тест</button>
          </div>
        </div>
      `;
    } else {
      const date = formatDate(state.psychTest.completedAt);
      block.innerHTML = `
        <div class="psych-home-card psych-home-card--done">
          <div class="psych-home-text">
            <h2 class="section-heading">Кино-психологический тест</h2>
            <p class="psych-home-date">Последний тест: ${escapeHtml(date)}</p>
            <p class="psych-home-profile"><strong>Ваш профиль: ${escapeHtml(state.psychTest.profileTitle)}</strong></p>
            <p class="panel-hint">${escapeHtml(state.psychTest.profileShortDescription || state.psychTest.profileDescription || '')}</p>
          </div>
          <div class="psych-home-actions">
            <button type="button" class="btn-primary" id="psych-recs-home-btn">Посмотреть рекомендации</button>
            <button type="button" class="psych-home-secondary" id="psych-retake-home-btn">Пройти заново</button>
          </div>
        </div>
      `;
    }

    block.querySelector('#psych-start-btn')?.addEventListener('click', startTest);
    block.querySelector('#psych-retake-home-btn')?.addEventListener('click', startTest);
    block.querySelector('#psych-recs-home-btn')?.addEventListener('click', () => {
      state.step = 'recommendations';
      openOverlay();
      loadRecommendations();
    });
  }

  function startTest() {
    state.isRetake = Boolean(state.psychTest?.profileTitle);
    state.step = 'intro';
    state.currentIndex = 0;
    state.answers = {};
    state.result = null;
    state.dirty = false;
    openOverlay();
  }

  function renderStep() {
    const container = ensureOverlay().querySelector('#psych-step-content');
    if (!container) return;

    container.className = `psych-step-content psych-step-content--${state.step}`;

    if (state.step === 'intro') {
      container.innerHTML = `
        <p class="psych-eyebrow">Профиль восприятия</p>
        <h2 id="psych-step-title" class="psych-title">Подбор по вашему внутреннему состоянию</h2>
        <p class="psych-lead">Это не медицинская диагностика, а короткий тест для более точных рекомендаций фильмов и сериалов.</p>
        <button type="button" class="btn-primary psych-start-inner" id="psych-begin-btn">Начать</button>
      `;
      container.querySelector('#psych-begin-btn')?.addEventListener('click', () => {
        state.step = 'question';
        state.currentIndex = 0;
        renderStep();
      });
      return;
    }

    if (state.step === 'confirm-exit') {
      container.innerHTML = `
        <h2 id="psych-step-title" class="psych-title">Выйти из теста?</h2>
        <p class="psych-lead">Ваши текущие ответы не сохранятся.</p>
        <div class="psych-actions">
          <button type="button" class="btn-primary" id="psych-continue-btn">Продолжить тест</button>
          <button type="button" class="psych-btn-ghost" id="psych-exit-btn">Выйти</button>
        </div>
      `;
      container.querySelector('#psych-continue-btn')?.addEventListener('click', () => {
        state.step = 'question';
        renderStep();
      });
      container.querySelector('#psych-exit-btn')?.addEventListener('click', () => closeOverlay(true));
      return;
    }

    if (state.step === 'question') {
      const q = state.questions[state.currentIndex];
      if (!q) return;
      const progress = ((state.currentIndex + 1) / state.questions.length) * 100;
      const selected = state.answers[q.id];

      container.innerHTML = `
        <div class="psych-progress-wrap">
          <div class="psych-progress-bar" style="width:${progress}%"></div>
        </div>
        <p class="psych-progress-label">Вопрос ${state.currentIndex + 1} из ${state.questions.length}</p>
        <h2 id="psych-step-title" class="psych-question">${escapeHtml(q.text)}</h2>
        <div class="psych-options" role="radiogroup">
          ${q.options.map((opt) => `
            <button type="button" class="psych-option${selected === opt.id ? ' psych-option--selected' : ''}"
              data-answer="${opt.id}" role="radio" aria-checked="${selected === opt.id}">
              ${escapeHtml(opt.text)}
            </button>
          `).join('')}
        </div>
        <div class="psych-nav">
          <button type="button" class="psych-btn-ghost" id="psych-back-btn"${state.currentIndex === 0 ? ' disabled' : ''}>Назад</button>
          <button type="button" class="btn-primary" id="psych-next-btn">${state.currentIndex === state.questions.length - 1 ? 'Завершить' : 'Далее'}</button>
        </div>
        <p class="psych-error hidden" id="psych-answer-error">Выберите вариант ответа</p>
      `;

      container.querySelectorAll('.psych-option').forEach((btn) => {
        btn.addEventListener('click', () => {
          state.answers[q.id] = btn.dataset.answer;
          state.dirty = true;
          container.querySelectorAll('.psych-option').forEach((el) => {
            el.classList.toggle('psych-option--selected', el.dataset.answer === btn.dataset.answer);
            el.setAttribute('aria-checked', el.dataset.answer === btn.dataset.answer);
          });
          container.querySelector('#psych-answer-error')?.classList.add('hidden');
        });
      });

      container.querySelector('#psych-back-btn')?.addEventListener('click', () => {
        if (state.currentIndex > 0) {
          state.currentIndex -= 1;
          renderStep();
        }
      });

      container.querySelector('#psych-next-btn')?.addEventListener('click', () => {
        if (!state.answers[q.id]) {
          container.querySelector('#psych-answer-error')?.classList.remove('hidden');
          return;
        }
        if (state.currentIndex < state.questions.length - 1) {
          state.currentIndex += 1;
          renderStep();
        } else {
          submitTest();
        }
      });
      return;
    }

    if (state.step === 'result') {
      const r = state.result || state.psychTest;
      if (!r) return;
      const scales = r.scales || {};
      container.innerHTML = `
        <p class="psych-eyebrow">Ваш кино-психологический профиль</p>
        <h2 id="psych-step-title" class="psych-profile-title">${escapeHtml(r.profileTitle)}</h2>
        <p class="psych-profile-desc">${escapeHtml(r.profileDescription || '')}</p>
        <div class="psych-scales">
          ${renderScaleBarsHtml(scales)}
        </div>
        <div class="psych-traits">
          <h3>Что вам может подойти</h3>
          <ul>${(r.suits || r.traits?.genres || []).map((t) => `<li>${escapeHtml(t)}</li>`).join('')}</ul>
          <h3>Что лучше избегать</h3>
          <ul class="psych-avoid">${(r.avoid || []).map((t) => `<li>${escapeHtml(t)}</li>`).join('')}</ul>
        </div>
        <div class="psych-actions psych-actions--result">
          <button type="button" class="btn-primary" id="psych-get-recs-btn">Получить рекомендации</button>
          <button type="button" class="psych-btn-ghost" id="psych-save-btn"${state.saving ? ' disabled' : ''}>${state.saving ? 'Сохранено ✓' : 'Сохранить результат'}</button>
          <button type="button" class="psych-btn-ghost" id="psych-retake-btn">Пройти заново</button>
          <button type="button" class="psych-btn-ghost" id="psych-close-result-btn">Закрыть</button>
        </div>
      `;

      container.querySelector('#psych-get-recs-btn')?.addEventListener('click', () => {
        state.step = 'recommendations';
        renderStep();
        loadRecommendations();
      });
      container.querySelector('#psych-save-btn')?.addEventListener('click', () => toast('Результат уже сохранён', 'success'));
      container.querySelector('#psych-retake-btn')?.addEventListener('click', startTest);
      container.querySelector('#psych-close-result-btn')?.addEventListener('click', () => {
        closeOverlay(true);
        renderHomeBlock();
      });
      return;
    }

    if (state.step === 'saved-notice') {
      container.innerHTML = `
        <p class="psych-eyebrow">Готово</p>
        <h2 id="psych-step-title" class="psych-title">Новый результат сохранён</h2>
        <p class="psych-lead">Вы можете посмотреть историю изменений в профиле.</p>
        <div class="psych-actions">
          <button type="button" class="btn-primary" id="psych-open-profile-btn">Открыть профиль</button>
          <button type="button" class="btn-primary" id="psych-saved-recs-btn">Получить рекомендации</button>
          <button type="button" class="psych-btn-ghost" id="psych-saved-close-btn">Закрыть</button>
        </div>
      `;
      container.querySelector('#psych-open-profile-btn')?.addEventListener('click', () => {
        closeOverlay(true);
        window.location.href = '/account.html';
      });
      container.querySelector('#psych-saved-recs-btn')?.addEventListener('click', () => {
        state.selectedResultId = state.result?.id || state.psychTest?.id || null;
        state.step = 'recommendations';
        renderStep();
        loadRecommendations();
      });
      container.querySelector('#psych-saved-close-btn')?.addEventListener('click', () => {
        closeOverlay(true);
        renderHomeBlock();
      });
      return;
    }

    if (state.step === 'recommendations') {
      const basedOnLabel = state.basedOn?.completedAt
        ? `Рекомендации на основе результата от ${formatDate(state.basedOn.completedAt)}, ${formatTime(state.basedOn.completedAt)}`
        : 'Рекомендации по вашему профилю';
      container.innerHTML = `
        <h2 id="psych-step-title" class="psych-title">Рекомендации по вашему профилю</h2>
        <p class="psych-lead psych-recs-based-on">${escapeHtml(basedOnLabel)}</p>
        <p class="psych-lead">Мы учли результат теста, ваши оценки, просмотренные фильмы и ограничения.</p>
          <div id="psych-recs-list" class="psych-recs-list">${window.LoadingUI.aiRecommendations('Подбираю рекомендации...', 4)}</div>
        <div class="psych-actions">
          <button type="button" class="psych-btn-ghost" id="psych-recs-back-btn">Назад к результату</button>
          <button type="button" class="psych-btn-ghost" id="psych-recs-refresh-btn">Обновить</button>
        </div>
      `;
      container.querySelector('#psych-recs-back-btn')?.addEventListener('click', () => {
        if (state.result || state.psychTest) {
          state.step = 'result';
          renderStep();
        } else {
          closeOverlay(true);
        }
      });
      container.querySelector('#psych-recs-refresh-btn')?.addEventListener('click', loadRecommendations);
    }
  }

  async function submitTest() {
    const answers = state.questions.map((q) => ({
      questionId: q.id,
      answerId: state.answers[q.id]
    }));

    const container = ensureOverlay().querySelector('#psych-step-content');
    if (container) {
      container.innerHTML = '<div class="psych-loading">' + window.LoadingUI.ai('Считаем ваш профиль восприятия...', { panel: true, tag: false }) + '</div>';
    }

    try {
      const res = await fetch('/api/psych-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...window.authHeaders() },
        body: JSON.stringify({ answers })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Не удалось сохранить');

      state.psychTest = data.psychTest;
      state.result = {
        ...data.psychTest,
        avoid: data.profile?.avoid || [],
        suits: data.profile?.suits || [],
        traits: data.psychTest.traits || data.profile
      };
      state.dirty = false;
      state.saving = true;
      state.selectedResultId = data.psychTest?.id || null;
      state.step = state.isRetake ? 'saved-notice' : 'result';
      renderStep();
      renderHomeBlock();
      window.refreshProfilePage?.();
      toast(state.isRetake ? 'Новый результат сохранён' : 'Профиль сохранён', 'success');
    } catch (err) {
      toast(err.message || 'Ошибка сохранения', 'error');
      state.step = 'question';
      state.currentIndex = state.questions.length - 1;
      renderStep();
    }
  }

  function renderRecommendationCard(item, index) {
    const card = document.createElement('article');
    card.className = 'psych-rec-card';
    card.style.animationDelay = `${index * 80}ms`;

    const typeLabel = item.type === 'series' || item.mediaType === 'tv' ? 'Сериал' : 'Фильм';
    const posterUrl = window.MovieDisplay?.posterUrl?.(item.poster) || item.poster;
    const inList = isInList(item.title);

    card.innerHTML = `
      <div class="psych-rec-poster${posterUrl ? '' : ' psych-rec-poster--empty'}">
        ${posterUrl ? `<img src="${escapeHtml(posterUrl)}" alt="" loading="lazy">` : '🎬'}
      </div>
      <div class="psych-rec-body">
        <div class="psych-rec-head">
          <h3>${escapeHtml(item.title)}</h3>
          <span class="psych-rec-meta">${escapeHtml(item.year || '')} · ${typeLabel}</span>
        </div>
        ${item.genres?.length ? `<p class="psych-rec-genres">${item.genres.map(escapeHtml).join(' · ')}</p>` : ''}
        <p class="psych-rec-reason">${escapeHtml(item.reason || '')}</p>
        ${item.testConnection ? `<p class="psych-rec-connection">${escapeHtml(item.testConnection)}</p>` : ''}
        <div class="psych-rec-actions">
          <button type="button" class="rec-add-btn"${inList ? ' disabled' : ''} title="Добавить в список" aria-label="Добавить в список">${inList ? '✓' : '+'}</button>
          <div class="psych-dislike-wrap">
            <button type="button" class="psych-dislike-btn">Не хочу такое</button>
            <div class="psych-dislike-menu hidden"></div>
          </div>
        </div>
      </div>
    `;

    const addBtn = card.querySelector('.rec-add-btn');
    if (!inList) {
      addBtn?.addEventListener('click', async () => {
        const mediaType = item.mediaType === 'tv' || item.type === 'series' ? 'tv' : 'movie';
        const results = await window.MovieApp.executeActions([{
          type: 'add_movie',
          title: item.title,
          status: 'want',
          mediaType,
          tmdbId: item.tmdbId || undefined
        }]);
        if (results?.[0]?.success) {
          addBtn.textContent = '✓';
          addBtn.disabled = true;
          addBtn.classList.add('rec-add-btn--added');
        } else {
          toast(results?.[0]?.error || 'Не удалось добавить', 'error');
        }
      });
    }

    const menuBtn = card.querySelector('.psych-dislike-btn');
    const menu = card.querySelector('.psych-dislike-menu');
    menuBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = !menu.classList.contains('hidden');
      document.querySelectorAll('.psych-dislike-menu').forEach((m) => m.classList.add('hidden'));
      if (isOpen) return;
      menu.innerHTML = FEEDBACK_REASONS.map((r) =>
        `<button type="button" data-reason="${r.id}">${escapeHtml(r.label)}</button>`
      ).join('');
      menu.classList.remove('hidden');
      menu.querySelectorAll('button').forEach((btn) => {
        btn.addEventListener('click', async () => {
          menu.classList.add('hidden');
          try {
            const res = await fetch('/api/psych-test/feedback', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', ...window.authHeaders() },
              body: JSON.stringify({ title: item.title, reason: btn.dataset.reason })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            card.classList.add('psych-rec-card--dismissed');
            toast('Учтём в следующих рекомендациях', 'success');
          } catch (err) {
            toast(err.message || 'Не удалось сохранить', 'error');
          }
        });
      });
    });

    return card;
  }

  async function loadRecommendations() {
    const listEl = document.getElementById('psych-recs-list');
    if (!listEl) return;

    listEl.innerHTML = window.LoadingUI.aiRecommendations('Подбираю рекомендации...', 4);
    state.basedOn = null;

    try {
      const mediaType = getActiveMediaType();
      const body = { mediaType };
      if (state.selectedResultId) body.resultId = state.selectedResultId;

      const res = await fetch('/api/psych-test/recommendations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...window.authHeaders() },
        body: JSON.stringify(body)
      });
      const data = await res.json();

      if (!res.ok) {
        listEl.innerHTML = `<p class="psych-recs-error">${escapeHtml(data.error || 'Не удалось загрузить рекомендации')}</p>`;
        return;
      }

      state.basedOn = data.basedOn || null;
      const basedEl = ensureOverlay().querySelector('.psych-recs-based-on');
      if (basedEl && state.basedOn?.completedAt) {
        basedEl.textContent = `Рекомендации на основе результата от ${formatDate(state.basedOn.completedAt)}, ${formatTime(state.basedOn.completedAt)}`;
      }

      const recs = data.recommendations || [];
      if (!recs.length) {
        listEl.innerHTML = '<p class="psych-recs-error">Пока нет подходящих рекомендаций. Попробуйте обновить позже.</p>';
        return;
      }

      listEl.innerHTML = '';
      recs.forEach((item, i) => listEl.appendChild(renderRecommendationCard(item, i)));
    } catch {
      listEl.innerHTML = '<p class="psych-recs-error">Сервер недоступен. Проверьте подключение.</p>';
    }
  }

  async function refresh() {
    const block = document.getElementById('psych-test-section');
    if (block) {
      block.innerHTML = '<div class="psych-home-card">' + window.LoadingUI.ai('Загрузка теста...', { panel: true, compact: true, tag: false }) + '</div>';
    }
    try {
      const res = await fetch('/api/psych-test', { headers: window.authHeaders() });
      if (!res.ok) return;
      const data = await res.json();
      state.questions = data.questions || [];
      state.psychTest = data.psychTest || null;
      renderHomeBlock();
    } catch {
      renderHomeBlock();
    }
  }

  document.addEventListener('click', () => {
    document.querySelectorAll('.psych-dislike-menu').forEach((m) => m.classList.add('hidden'));
  });

  function openRecommendationsForResult(resultId) {
    state.selectedResultId = resultId || null;
    state.step = 'recommendations';
    openOverlay();
    loadRecommendations();
  }

  window.PsychTest = {
    refresh,
    startTest,
    openRecommendations: () => {
      state.selectedResultId = state.psychTest?.id || null;
      state.step = state.psychTest ? 'recommendations' : 'intro';
      openOverlay();
      if (state.step === 'recommendations') loadRecommendations();
    },
    openRecommendationsForResult
  };

  refresh();
})();
