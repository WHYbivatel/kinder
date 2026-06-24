(function initShortVisualTests() {
  const TEST_ICONS = {
    movie_genre_visual_test: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><polygon points="16 8 11 11 8 16 13 13 16 8"/></svg>',
    evening_visual_test: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z"/></svg>',
    viewing_style_visual_test: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 3v18M17 3v18M3 8h4M17 8h4M3 16h4M17 16h4"/></svg>',
    mood_visual_test: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.8 5.6a5.5 5.5 0 0 0-7.8 0L12 6.6l-1-1a5.5 5.5 0 1 0-7.8 7.8l8.8 8.6 8.8-8.6a5.5 5.5 0 0 0 0-7.8z"/></svg>'
  };
  const DEFAULT_TEST_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>';
  function iconFor(id) { return TEST_ICONS[id] || DEFAULT_TEST_ICON; }

  const FEEDBACK_REASONS = [
    { id: 'too_heavy', label: 'слишком тяжёлое' },
    { id: 'too_light', label: 'слишком лёгкое' },
    { id: 'too_slow', label: 'слишком медленное' },
    { id: 'too_dynamic', label: 'слишком динамичное' },
    { id: 'wrong_genre', label: 'не тот жанр' },
    { id: 'wrong_atmosphere', label: 'не та атмосфера' },
    { id: 'already_seen', label: 'уже видел' },
    { id: 'other', label: 'другое' }
  ];

  const state = {
    tests: [],
    lastResults: {},
    activeTestId: null,
    questions: [],
    answers: {},
    currentIndex: 0,
    step: 'idle',
    result: null,
    dirty: false,
    selectedResultId: null,
    basedOn: null
  };

  let overlayEl = null;
  let zoomEl = null;

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/"/g, '&quot;');
  }

  function formatDate(iso) {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
    } catch { return ''; }
  }

  function formatTime(iso) {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    } catch { return ''; }
  }

  function getActiveMediaType() {
    return window.MovieApp?.getActiveFilters?.()?.mediaType || 'movie';
  }

  function isInList(title) {
    const lower = String(title || '').toLowerCase().trim();
    return (window.MovieApp?.getMovies?.() || []).some((m) => m.title.toLowerCase() === lower);
  }

  function toast(message, type = 'info') {
    const el = document.getElementById('short-visual-toast');
    if (!el) return;
    el.textContent = message;
    el.className = `short-visual-toast short-visual-toast--${type} short-visual-toast--visible`;
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => el.classList.remove('short-visual-toast--visible'), 3200);
  }

  function ensureZoomOverlay() {
    if (zoomEl) return zoomEl;
    zoomEl = document.createElement('div');
    zoomEl.id = 'short-visual-zoom-overlay';
    zoomEl.className = 'short-visual-zoom-overlay hidden';
    zoomEl.innerHTML = `
      <button type="button" class="short-visual-zoom-close" aria-label="Закрыть">✕</button>
      <img src="" alt="">
    `;
    document.body.appendChild(zoomEl);
    zoomEl.querySelector('.short-visual-zoom-close')?.addEventListener('click', closeZoom);
    zoomEl.addEventListener('click', (e) => { if (e.target === zoomEl) closeZoom(); });
    return zoomEl;
  }

  function openZoom(src, alt) {
    const el = ensureZoomOverlay();
    const img = el.querySelector('img');
    img.src = src;
    img.alt = alt || '';
    el.classList.remove('hidden');
  }

  function closeZoom() {
    zoomEl?.classList.add('hidden');
  }

  function ensureOverlay() {
    if (overlayEl) return overlayEl;
    overlayEl = document.createElement('div');
    overlayEl.id = 'short-visual-overlay';
    overlayEl.className = 'short-visual-overlay hidden';
    overlayEl.innerHTML = `
      <div class="short-visual-shell" role="dialog" aria-modal="true" aria-labelledby="short-visual-step-title">
        <button type="button" class="short-visual-close" aria-label="Закрыть">✕</button>
        <div id="short-visual-step-content" class="short-visual-step-content"></div>
      </div>
      <div id="short-visual-toast" class="short-visual-toast"></div>
    `;
    document.body.appendChild(overlayEl);
    overlayEl.querySelector('.short-visual-close')?.addEventListener('click', handleCloseRequest);
    overlayEl.addEventListener('click', (e) => { if (e.target === overlayEl) handleCloseRequest(); });
    return overlayEl;
  }

  function openOverlay() {
    ensureOverlay();
    overlayEl.classList.remove('hidden');
    document.body.classList.add('short-visual-open');
    renderStep();
  }

  function closeOverlay(force) {
    if (!overlayEl) return;
    if (!force && state.dirty && ['question', 'intro'].includes(state.step)) {
      state.step = 'confirm-exit';
      renderStep();
      return;
    }
    overlayEl.classList.add('hidden');
    document.body.classList.remove('short-visual-open');
    closeZoom();
    if (force) resetSession();
  }

  function resetSession() {
    state.activeTestId = null;
    state.questions = [];
    state.answers = {};
    state.currentIndex = 0;
    state.step = 'idle';
    state.result = null;
    state.dirty = false;
    state.selectedResultId = null;
  }

  document.addEventListener('i18n:change', renderHomeBlock);

  function handleCloseRequest() {
    if (['result', 'recommendations', 'saved-notice', 'pick-test'].includes(state.step)) {
      closeOverlay(true);
      renderHomeBlock();
      return;
    }
    if (state.dirty) {
      state.step = 'confirm-exit';
      renderStep();
      return;
    }
    closeOverlay(true);
  }

  function getActiveTest() {
    return state.tests.find((t) => t.id === state.activeTestId);
  }

  function startTest(testId) {
    const test = state.tests.find((t) => t.id === testId);
    if (!test) return;
    state.activeTestId = testId;
    state.questions = test.questions || [];
    state.answers = {};
    state.currentIndex = 0;
    state.result = null;
    state.dirty = false;
    state.step = 'intro';
    openOverlay();
  }

  function renderHomeBlock() {
    const block = document.getElementById('short-visual-tests-section');
    if (!block) return;
    const T = (k, f) => (window.t ? window.t(k) : f);

    if (!state.tests.length) {
      block.innerHTML = `
        <article class="short-visual-card">
          <h3 class="short-visual-card-title">${escapeHtml(T('short.title', 'Короткие визуальные тесты'))}</h3>
          <div class="rec-loading">${window.LoadingUI.ai('Загрузка тестов...', { tag: false, compact: true })}</div>
        </article>`;
      return;
    }

    const cards = state.tests.map((test) => {
      const last = state.lastResults[test.id];
      const doneHtml = last
        ? `<div class="short-visual-card-done">
            <span class="short-visual-card-done-label">${escapeHtml(T('short.lastResult', 'Последний результат'))}</span>
            <span class="short-visual-card-done-date">${escapeHtml(formatDate(last.completedAt))}</span>
            <strong class="short-visual-card-done-profile">${escapeHtml(last.profileTitle)}</strong>
          </div>`
        : '';
      const actions = last
        ? `<button type="button" class="btn-primary short-visual-start-btn" data-test-id="${escapeHtml(test.id)}">${escapeHtml(T('test.retake', 'Пройти заново'))}</button>
           <button type="button" class="short-visual-btn-secondary short-visual-recs-btn" data-result-id="${escapeHtml(last.id)}">${escapeHtml(T('short.recs', 'Рекомендации'))}</button>`
        : `<button type="button" class="btn-primary short-visual-start-btn" data-test-id="${escapeHtml(test.id)}">${escapeHtml(T('short.start', 'Пройти тест'))}</button>`;

      return `
        <article class="short-visual-card">
          <div class="test-icon">${iconFor(test.id)}</div>
          <h3 class="short-visual-card-title">${escapeHtml(test.title)}</h3>
          <p class="short-visual-card-desc">${escapeHtml(test.description)}</p>
          <p class="short-visual-card-meta">${escapeHtml(test.cardHint || T('short.cards4', '4 картинки'))}</p>
          ${doneHtml}
          <div class="short-visual-card-actions">${actions}</div>
        </article>`;
    }).join('');

    block.innerHTML = cards;

    block.querySelectorAll('.short-visual-start-btn').forEach((btn) => {
      btn.addEventListener('click', () => startTest(btn.dataset.testId));
    });
    block.querySelectorAll('.short-visual-recs-btn').forEach((btn) => {
      btn.addEventListener('click', () => openRecommendationsForResult(btn.dataset.resultId));
    });
  }

  function renderStep() {
    const container = ensureOverlay().querySelector('#short-visual-step-content');
    if (!container) return;
    container.className = `short-visual-step-content short-visual-step-content--${state.step}`;

    const test = getActiveTest();

    if (state.step === 'intro') {
      container.innerHTML = `
        <p class="short-visual-eyebrow">Кино-тест по образам</p>
        <h2 id="short-visual-step-title" class="short-visual-title">${escapeHtml(test?.title || 'Визуальный тест')}</h2>
        <p class="short-visual-lead">Это развлекательный подбор по картинкам — не диагностика. На каждом из 4 изображений выберите номер, который ближе по ощущению.</p>
        <button type="button" class="btn-primary" id="short-visual-begin-btn">Начать</button>
      `;
      container.querySelector('#short-visual-begin-btn')?.addEventListener('click', () => {
        state.step = 'question';
        state.currentIndex = 0;
        renderStep();
      });
      return;
    }

    if (state.step === 'confirm-exit') {
      container.innerHTML = `
        <h2 id="short-visual-step-title" class="short-visual-title">Выйти из теста?</h2>
        <p class="short-visual-lead">Ваши текущие ответы не сохранятся.</p>
        <div class="short-visual-actions">
          <button type="button" class="btn-primary" id="short-visual-continue-btn">Продолжить</button>
          <button type="button" class="short-visual-btn-ghost" id="short-visual-exit-btn">Выйти</button>
        </div>
      `;
      container.querySelector('#short-visual-continue-btn')?.addEventListener('click', () => {
        state.step = state.currentIndex >= 0 ? 'question' : 'intro';
        renderStep();
      });
      container.querySelector('#short-visual-exit-btn')?.addEventListener('click', () => closeOverlay(true));
      return;
    }

    if (state.step === 'question') {
      const q = state.questions[state.currentIndex];
      if (!q) return;
      const progress = ((state.currentIndex + 1) / state.questions.length) * 100;
      const selected = state.answers[q.id];
      const options = Array.from({ length: q.optionCount }, (_, i) => i + 1);

      container.innerHTML = `
        <div class="short-visual-progress-wrap"><div class="short-visual-progress-bar" style="width:${progress}%"></div></div>
        <p class="short-visual-progress-label">Вопрос ${state.currentIndex + 1} из ${state.questions.length}</p>
        <div class="short-visual-image-wrap">
          <img src="${escapeHtml(q.imageSrc)}" alt="${escapeHtml(q.imageAlt)}" loading="lazy" decoding="async">
          <button type="button" class="short-visual-zoom-btn" id="short-visual-zoom-trigger">Увеличить картинку</button>
        </div>
        <h2 id="short-visual-step-title" class="short-visual-question">${escapeHtml(q.text)}</h2>
        <div class="short-visual-options" role="radiogroup" aria-label="Выберите номер">
          ${options.map((n) => `
            <button type="button" class="short-visual-option${selected === n ? ' short-visual-option--selected' : ''}"
              data-option="${n}" role="radio" aria-checked="${selected === n}">${n}</button>`).join('')}
        </div>
        <p class="short-visual-error hidden" id="short-visual-answer-error">Выберите номер, чтобы продолжить</p>
        <div class="short-visual-nav">
          <button type="button" class="short-visual-btn-ghost" id="short-visual-back-btn"${state.currentIndex === 0 ? ' disabled' : ''}>Назад</button>
          <button type="button" class="btn-primary" id="short-visual-next-btn">${state.currentIndex === state.questions.length - 1 ? 'Завершить' : 'Далее'}</button>
        </div>
      `;

      container.querySelector('#short-visual-zoom-trigger')?.addEventListener('click', () => {
        openZoom(q.imageSrc, q.imageAlt);
      });

      container.querySelectorAll('.short-visual-option').forEach((btn) => {
        btn.addEventListener('click', () => {
          const num = Number(btn.dataset.option);
          state.answers[q.id] = num;
          state.dirty = true;
          container.querySelectorAll('.short-visual-option').forEach((el) => {
            el.classList.toggle('short-visual-option--selected', Number(el.dataset.option) === num);
            el.setAttribute('aria-checked', Number(el.dataset.option) === num);
          });
          container.querySelector('#short-visual-answer-error')?.classList.add('hidden');
        });
      });

      container.querySelector('#short-visual-back-btn')?.addEventListener('click', () => {
        if (state.currentIndex > 0) { state.currentIndex -= 1; renderStep(); }
      });

      container.querySelector('#short-visual-next-btn')?.addEventListener('click', () => {
        if (!state.answers[q.id]) {
          container.querySelector('#short-visual-answer-error')?.classList.remove('hidden');
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
      const r = state.result;
      if (!r) return;
      const guestNotice = state.guestResult
        ? `<p class="psych-guest-notice">⚠ Результат не сохранится. <button type="button" class="psych-inline-login" id="short-visual-login-link">Войдите</button>, чтобы хранить историю профиля и получать персональные рекомендации.</p>`
        : '';
      const saveBtn = state.guestResult
        ? `<button type="button" class="short-visual-btn-ghost" id="short-visual-login-save-btn">Войти, чтобы сохранить</button>`
        : `<button type="button" class="short-visual-btn-ghost" id="short-visual-save-btn">Сохранить результат</button>`;

      container.innerHTML = `
        <p class="short-visual-eyebrow">Ваш результат</p>
        <h2 id="short-visual-step-title" class="short-visual-title">${escapeHtml(r.profileTitle)}</h2>
        <p class="short-visual-lead">${escapeHtml(r.profileDescription || '')}</p>
        ${guestNotice}
        <div class="short-visual-meta-row">
          <span class="short-visual-meta-chip">Вторичный: ${escapeHtml(r.secondaryProfileTitle || '—')}</span>
          <span class="short-visual-meta-chip">Темп: ${escapeHtml(r.pace || '—')}</span>
          <span class="short-visual-meta-chip">Комфорт: ${escapeHtml(r.comfort || '—')}</span>
        </div>
        <div class="short-visual-traits">
          <h3>Подходящие жанры</h3>
          <ul>${(r.recommendedGenres || []).map((g) => `<li>${escapeHtml(g)}</li>`).join('')}</ul>
          <h3>Что лучше избегать</h3>
          <ul>${(r.avoid || []).map((g) => `<li>${escapeHtml(g)}</li>`).join('')}</ul>
        </div>
        <div class="short-visual-actions short-visual-actions--result">
          <button type="button" class="btn-primary" id="short-visual-get-recs-btn">Получить рекомендации</button>
          ${saveBtn}
          <button type="button" class="short-visual-btn-ghost" id="short-visual-other-test-btn">Пройти другой тест</button>
          <button type="button" class="short-visual-btn-ghost" id="short-visual-retake-btn">Пройти заново</button>
          <button type="button" class="short-visual-btn-ghost" id="short-visual-close-result-btn">Закрыть</button>
        </div>
      `;
      container.querySelector('#short-visual-get-recs-btn')?.addEventListener('click', () => {
        state.selectedResultId = r.id || null;
        state.step = 'recommendations';
        renderStep();
      });
      container.querySelector('#short-visual-save-btn')?.addEventListener('click', () => toast('Результат уже сохранён', 'success'));
      const shortLogin = () => (window.requireLogin ? window.requireLogin() : (window.location.href = '/'));
      container.querySelector('#short-visual-login-link')?.addEventListener('click', shortLogin);
      container.querySelector('#short-visual-login-save-btn')?.addEventListener('click', shortLogin);
      container.querySelector('#short-visual-other-test-btn')?.addEventListener('click', () => {
        state.step = 'pick-test';
        renderStep();
      });
      container.querySelector('#short-visual-retake-btn')?.addEventListener('click', () => startTest(state.activeTestId));
      container.querySelector('#short-visual-close-result-btn')?.addEventListener('click', () => {
        closeOverlay(true);
        renderHomeBlock();
      });
      return;
    }

    if (state.step === 'pick-test') {
      container.innerHTML = `
        <h2 id="short-visual-step-title" class="short-visual-title">Выберите другой тест</h2>
        <div class="short-visual-grid" style="margin-top:1rem">
          ${state.tests.filter((t) => t.id !== state.activeTestId).map((t) => `
            <button type="button" class="short-visual-card short-visual-pick-card" data-test-id="${escapeHtml(t.id)}" style="cursor:pointer;text-align:left;width:100%">
              <h3 class="short-visual-card-title">${escapeHtml(t.title)}</h3>
              <p class="short-visual-card-desc">${escapeHtml(t.description)}</p>
            </button>`).join('')}
        </div>
      `;
      container.querySelectorAll('.short-visual-pick-card').forEach((btn) => {
        btn.addEventListener('click', () => startTest(btn.dataset.testId));
      });
      return;
    }

    if (state.step === 'saved-notice') {
      container.innerHTML = `
        <p class="short-visual-eyebrow">Готово</p>
        <h2 id="short-visual-step-title" class="short-visual-title">Результат сохранён</h2>
        <p class="short-visual-lead">История доступна в профиле.</p>
        <div class="short-visual-actions">
          <button type="button" class="btn-primary" id="short-visual-saved-recs-btn">Получить рекомендации</button>
          <button type="button" class="short-visual-btn-ghost" id="short-visual-saved-close-btn">Закрыть</button>
        </div>
      `;
      container.querySelector('#short-visual-saved-recs-btn')?.addEventListener('click', () => {
        state.selectedResultId = state.result?.id || null;
        state.step = 'recommendations';
        renderStep();
      });
      container.querySelector('#short-visual-saved-close-btn')?.addEventListener('click', () => {
        closeOverlay(true);
        renderHomeBlock();
      });
      return;
    }

    if (state.step === 'recommendations') {
      const basedOnLabel = state.basedOn?.completedAt
        ? `На основе «${state.basedOn.testTitle || 'теста'}» от ${formatDate(state.basedOn.completedAt)}`
        : 'Рекомендации по результату визуального теста';
      container.innerHTML = `
        <h2 id="short-visual-step-title" class="short-visual-title">Рекомендации</h2>
        <p class="short-visual-lead short-visual-recs-based-on">${escapeHtml(basedOnLabel)}</p>
        <div id="short-visual-recs-list" class="short-visual-recs-list">${window.LoadingUI.aiRecommendations('Подбираю рекомендации...', 4)}</div>
        <div class="short-visual-actions">
          <button type="button" class="short-visual-btn-ghost" id="short-visual-recs-back-btn">Назад к результату</button>
          <button type="button" class="short-visual-btn-ghost" id="short-visual-recs-refresh-btn">Обновить</button>
        </div>
      `;
      container.querySelector('#short-visual-recs-back-btn')?.addEventListener('click', () => {
        if (state.result) { state.step = 'result'; renderStep(); }
        else closeOverlay(true);
      });
      container.querySelector('#short-visual-recs-refresh-btn')?.addEventListener('click', loadRecommendations);
      loadRecommendations();
      return;
    }
  }

  function isGuest() {
    return typeof window.isLoggedIn === 'function' ? !window.isLoggedIn() : false;
  }

  async function submitTest() {
    const container = ensureOverlay().querySelector('#short-visual-step-content');
    if (container) container.innerHTML = '<div class="short-visual-loading">' + window.LoadingUI.ai('Считаем ваш профиль просмотра...', { panel: true, tag: false }) + '</div>';

    const answers = state.questions.map((q) => ({
      imageType: q.imageType,
      selectedOption: state.answers[q.id]
    }));
    state.lastAnswers = answers;

    try {
      const res = await fetch('/api/short-visual-tests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...window.authHeaders() },
        body: JSON.stringify({ testId: state.activeTestId, answers })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Не удалось сохранить');

      state.result = data.result;
      state.lastResults[state.activeTestId] = data.result;
      state.dirty = false;
      state.guestResult = data.guest === true || data.saved === false;
      if (state.guestResult) window.GuestStore?.saveTest?.('short', { testId: state.activeTestId, answers });
      state.selectedResultId = data.result?.id || null;
      state.step = (data.isRetake && !state.guestResult) ? 'saved-notice' : 'result';
      renderStep();
      renderHomeBlock();
      window.refreshProfilePage?.();
      if (state.guestResult) {
        toast('Результат не сохранён — войдите, чтобы хранить историю', 'info');
      } else {
        toast('Профиль просмотра сохранён', 'success');
      }
    } catch (err) {
      toast(err.message || 'Ошибка сохранения', 'error');
      state.step = 'question';
      state.currentIndex = state.questions.length - 1;
      renderStep();
    }
  }

  function formatTestConnection(item) {
    const raw = String(item.testConnection || item.visualConnection || '').trim();
    const placeholders = [
      'связь с результатом теста',
      'как связано с результатом теста',
      'связь с визуальным профилем'
    ];
    if (!raw || placeholders.includes(raw.toLowerCase())) {
      const profile = state.basedOn?.profileTitle || state.result?.profileTitle;
      return profile ? `Подходит вашему профилю «${profile}» по настроению и визуальному стилю.` : '';
    }
    return raw;
  }

  function renderRecommendationCard(item, index) {
    const card = document.createElement('article');
    card.className = 'short-visual-rec-card';
    card.style.animationDelay = `${index * 70}ms`;
    const typeLabel = item.type === 'series' || item.mediaType === 'tv' ? 'Сериал' : 'Фильм';
    const posterUrl = window.MovieDisplay?.posterUrl?.(item.poster) || item.poster;
    const inList = isInList(item.title);
    const testConnection = formatTestConnection(item);
    // Постер/название ведут на страницу фильма (если известен tmdbId).
    const pageHref = window.MovieDisplay?.moviePageUrl?.(item);
    const posterInner = `${posterUrl ? `<img src="${escapeHtml(posterUrl)}" alt="" loading="lazy">` : '🎬'}`;
    const posterHtml = pageHref
      ? `<a href="${pageHref}" class="short-visual-rec-poster" title="Открыть страницу фильма">${posterInner}</a>`
      : `<div class="short-visual-rec-poster">${posterInner}</div>`;
    const titleHtml = pageHref
      ? `<h3><a href="${pageHref}" class="short-visual-rec-title-link" title="Открыть страницу фильма">${escapeHtml(item.title)}</a></h3>`
      : `<h3>${escapeHtml(item.title)}</h3>`;

    card.innerHTML = `
      ${posterHtml}
      <div class="short-visual-rec-body">
        <div class="short-visual-rec-head">
          ${titleHtml}
          <span class="short-visual-rec-meta">${escapeHtml(String(item.year || ''))} · ${typeLabel}</span>
        </div>
        ${item.genres?.length ? `<p class="short-visual-rec-genres">${item.genres.map(escapeHtml).join(' · ')}</p>` : ''}
        <p class="short-visual-rec-reason">${escapeHtml(item.reason || '')}</p>
        ${testConnection ? `<p class="short-visual-rec-connection">${escapeHtml(testConnection)}</p>` : ''}
        ${item.mood ? `<p class="short-visual-rec-mood">Настроение: ${escapeHtml(item.mood)} · ${escapeHtml(item.pace || '')}</p>` : ''}
        <div class="short-visual-rec-actions">
          <button type="button" class="rec-add-btn"${inList ? ' disabled' : ''} title="Добавить">${inList ? '✓' : '+'}</button>
          <div class="short-visual-dislike-wrap">
            <button type="button" class="short-visual-dislike-btn">Не хочу такое</button>
            <div class="short-visual-dislike-menu hidden"></div>
          </div>
        </div>
      </div>
    `;

    card.querySelector('.rec-add-btn')?.addEventListener('click', async function () {
      if (this.disabled) return;
      const mediaType = item.mediaType === 'tv' || item.type === 'series' ? 'tv' : 'movie';
      const results = await window.MovieApp.executeActions([{
        type: 'add_movie', title: item.title, status: 'want', mediaType, tmdbId: item.tmdbId || undefined
      }]);
      if (results?.[0]?.success) { this.textContent = '✓'; this.disabled = true; }
      else toast(results?.[0]?.error || 'Не удалось добавить', 'error');
    });

    const menuBtn = card.querySelector('.short-visual-dislike-btn');
    const menu = card.querySelector('.short-visual-dislike-menu');
    menuBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = !menu.classList.contains('hidden');
      document.querySelectorAll('.short-visual-dislike-menu').forEach((m) => m.classList.add('hidden'));
      if (isOpen) return;
      menu.innerHTML = FEEDBACK_REASONS.map((r) =>
        `<button type="button" data-reason="${r.id}">${escapeHtml(r.label)}</button>`
      ).join('');
      menu.classList.remove('hidden');
      menu.querySelectorAll('button').forEach((btn) => {
        btn.addEventListener('click', async () => {
          menu.classList.add('hidden');
          try {
            const res = await fetch('/api/short-visual-tests/feedback', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', ...window.authHeaders() },
              body: JSON.stringify({ title: item.title, reason: btn.dataset.reason })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            card.classList.add('short-visual-rec-card--dismissed');
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
    const listEl = document.getElementById('short-visual-recs-list');
    if (!listEl) return;
    listEl.innerHTML = window.LoadingUI.aiRecommendations('Подбираю рекомендации...', 4);
    state.basedOn = null;

    try {
      const body = { mediaType: getActiveMediaType() };
      if (state.selectedResultId) body.resultId = state.selectedResultId;
      // Гость: профиль не сохранён — передаём testId и ответы для пересчёта.
      if (isGuest() && Array.isArray(state.lastAnswers) && state.lastAnswers.length) {
        body.testId = state.activeTestId;
        body.answers = state.lastAnswers;
      }

      const res = await fetch('/api/short-visual-tests/recommendations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...window.authHeaders() },
        body: JSON.stringify(body)
      });
      const data = await res.json();

      if (!res.ok) {
        listEl.innerHTML = `<p class="short-visual-recs-error">${escapeHtml(data.error || 'Не удалось загрузить рекомендации')}</p>`;
        return;
      }

      state.basedOn = data.basedOn || null;
      const basedEl = ensureOverlay().querySelector('.short-visual-recs-based-on');
      if (basedEl && state.basedOn?.completedAt) {
        basedEl.textContent = state.basedOn.testTitle
          ? `На основе «${state.basedOn.testTitle}» от ${formatDate(state.basedOn.completedAt)}`
          : `Рекомендации на основе профиля «${state.basedOn.profileTitle || ''}» от ${formatDate(state.basedOn.completedAt)}`;
      }

      const recs = data.recommendations || [];
      if (!recs.length) {
        listEl.innerHTML = '<p class="short-visual-recs-error">Пока нет подходящих рекомендаций.</p>';
        return;
      }

      listEl.innerHTML = '';
      recs.forEach((item, i) => listEl.appendChild(renderRecommendationCard(item, i)));
    } catch {
      listEl.innerHTML = '<p class="short-visual-recs-error">Сервер недоступен. Проверьте подключение.</p>';
    }
  }

  async function refresh() {
    const block = document.getElementById('short-visual-tests-section');
    if (block) {
      block.innerHTML = '<article class="short-visual-card"><div class="rec-loading">' + window.LoadingUI.ai('Загрузка тестов...', { tag: false, compact: true }) + '</div></article>';
    }
    try {
      const res = await fetch('/api/short-visual-tests', { headers: window.authHeaders() });
      if (!res.ok) return;
      const data = await res.json();
      state.tests = data.tests || [];
      state.lastResults = data.lastResults || {};
      renderHomeBlock();
    } catch {
      renderHomeBlock();
    }
  }

  function openRecommendationsForResult(resultId) {
    state.selectedResultId = resultId || null;
    state.step = 'recommendations';
    openOverlay();
  }

  document.addEventListener('click', () => {
    document.querySelectorAll('.short-visual-dislike-menu').forEach((m) => m.classList.add('hidden'));
  });

  window.ShortVisualTest = {
    refresh,
    startTest,
    openRecommendationsForResult
  };

  refresh();
})();
