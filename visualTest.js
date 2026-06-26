(function initVisualTest() {
  const VISUAL_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>';
  const SCALE_LABELS = {
    atmosphere: 'Атмосферность',
    emotionality: 'Эмоциональность',
    tension: 'Напряжение',
    comfort: 'Комфорт'
  };
  const SCALE_LEVEL_LABELS = { low: 'низкая', medium: 'средняя', high: 'высокая' };

  const FEEDBACK_REASONS = [
    { id: 'too_dark', label: 'слишком мрачно' },
    { id: 'too_light', label: 'слишком светло/мягко' },
    { id: 'too_slow', label: 'слишком медленно' },
    { id: 'too_dynamic', label: 'слишком динамично' },
    { id: 'wrong_visual', label: 'не тот визуальный стиль' },
    { id: 'wrong_genre', label: 'не тот жанр' },
    { id: 'already_seen', label: 'уже видел' },
    { id: 'other', label: 'другое' }
  ];

  const state = {
    questions: [],
    answers: {},
    customTexts: {},
    currentIndex: 0,
    step: 'intro',
    visualTest: null,
    result: null,
    dirty: false,
    isRetake: false,
    selectedResultId: null,
    basedOn: null
  };

  let overlayEl = null;

  const T = (key, fallback, vars) => (window.t ? window.t(key, vars) : fallback);

  function dateLocale() {
    const lang = window.I18N?.getLang?.() || 'ru';
    return lang === 'en' ? 'en-US' : lang === 'kk' ? 'kk-KZ' : 'ru-RU';
  }

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/"/g, '&quot;');
  }

  function formatDate(iso) {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleDateString(dateLocale(), { day: 'numeric', month: 'long', year: 'numeric' });
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
    const el = document.getElementById('visual-toast');
    if (!el) return;
    el.textContent = message;
    el.className = `visual-toast visual-toast--${type} visual-toast--visible`;
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => el.classList.remove('visual-toast--visible'), 3200);
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
        <div class="visual-scale">
          <div class="visual-scale-head">
            <span>${SCALE_LABELS[key]}</span>
            <span>${SCALE_LEVEL_LABELS[meta.level] || meta.level} · ${meta.value}%</span>
          </div>
          <div class="visual-scale-track">
            <div class="visual-scale-fill" style="width:${meta.value}%"></div>
          </div>
        </div>`;
    }).join('');
  }

  function ensureOverlay() {
    if (overlayEl) return overlayEl;
    overlayEl = document.createElement('div');
    overlayEl.id = 'visual-test-overlay';
    overlayEl.className = 'visual-overlay hidden';
    overlayEl.innerHTML = `
      <div class="visual-shell" role="dialog" aria-modal="true" aria-labelledby="visual-step-title">
        <button type="button" class="visual-close" aria-label="Закрыть">✕</button>
        <div id="visual-step-content" class="visual-step-content"></div>
      </div>
      <div id="visual-toast" class="visual-toast"></div>
    `;
    document.body.appendChild(overlayEl);
    overlayEl.querySelector('.visual-close')?.addEventListener('click', handleCloseRequest);
    overlayEl.addEventListener('click', (e) => { if (e.target === overlayEl) handleCloseRequest(); });
    return overlayEl;
  }

  function openOverlay() {
    ensureOverlay();
    overlayEl.classList.remove('hidden');
    document.body.classList.add('visual-open');
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
    document.body.classList.remove('visual-open');
    if (force) {
      state.step = 'intro';
      state.currentIndex = 0;
      state.answers = {};
      state.customTexts = {};
      state.dirty = false;
    }
  }

  function handleCloseRequest() {
    if (['result', 'recommendations', 'intro', 'saved-notice'].includes(state.step)) {
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
    const block = document.getElementById('visual-test-section');
    if (!block) return;

    const T = (k, f, v) => (window.t ? window.t(k, v) : f);
    const hasResult = Boolean(state.visualTest?.profileTitle);
    if (!hasResult) {
      block.innerHTML = `
        <div class="visual-home-card">
          <div class="test-icon">${VISUAL_ICON}</div>
          <div class="visual-home-text">
            <h2 class="section-heading">${escapeHtml(T('test.visualTitle', 'Визуальный тест восприятия'))}</h2>
            <p class="panel-hint">${escapeHtml(T('test.visualDesc', 'Посмотрите на 8 изображений, выберите, что вы в них видите, а AI подберёт фильмы и сериалы под ваш визуальный стиль.'))}</p>
          </div>
          <div class="visual-home-actions">
            <button type="button" class="btn-primary visual-home-btn" id="visual-start-btn">${escapeHtml(T('test.visualStart', 'Пройти визуальный тест'))}</button>
          </div>
        </div>`;
    } else {
      const date = formatDate(state.visualTest.completedAt);
      block.innerHTML = `
        <div class="visual-home-card visual-home-card--done">
          <div class="test-icon">${VISUAL_ICON}</div>
          <div class="visual-home-text">
            <h2 class="section-heading">${escapeHtml(T('test.visualTitle', 'Визуальный тест восприятия'))}</h2>
            <p class="visual-home-date">${escapeHtml(T('test.lastTest', `Последний тест: ${date}`, { date }))}</p>
            <p class="visual-home-profile"><strong>${escapeHtml(T('test.yourVisualProfile', `Ваш визуальный профиль: ${state.visualTest.profileTitle}`, { title: state.visualTest.profileTitle }))}</strong></p>
            <p class="panel-hint">${escapeHtml(state.visualTest.profileShortDescription || state.visualTest.profileDescription || '')}</p>
          </div>
          <div class="visual-home-actions">
            <button type="button" class="btn-primary" id="visual-recs-home-btn">${escapeHtml(T('test.viewRecs', 'Посмотреть рекомендации'))}</button>
            <button type="button" class="visual-home-secondary" id="visual-retake-home-btn">${escapeHtml(T('test.retake', 'Пройти заново'))}</button>
          </div>
        </div>`;
    }

    block.querySelector('#visual-start-btn')?.addEventListener('click', startTest);
    block.querySelector('#visual-retake-home-btn')?.addEventListener('click', startTest);
    block.querySelector('#visual-recs-home-btn')?.addEventListener('click', () => {
      state.selectedResultId = state.visualTest?.id || null;
      state.step = 'recommendations';
      openOverlay();
      loadRecommendations();
    });
  }

  function startTest() {
    state.isRetake = Boolean(state.visualTest?.profileTitle);
    state.step = 'intro';
    state.currentIndex = 0;
    state.answers = {};
    state.customTexts = {};
    state.result = null;
    state.dirty = false;
    openOverlay();
  }

  function renderStep() {
    const container = ensureOverlay().querySelector('#visual-step-content');
    if (!container) return;
    container.className = `visual-step-content visual-step-content--${state.step}`;

    if (state.step === 'intro') {
      container.innerHTML = `
        <p class="visual-eyebrow">${escapeHtml(T('test.eyebrowVisual', 'Кино-тест по картинкам'))}</p>
        <h2 id="visual-step-title" class="visual-title">${escapeHtml(T('test.visualTitle', 'Визуальный тест восприятия'))}</h2>
        <p class="visual-lead">${escapeHtml(T('test.notDiagnostic', 'Это не диагностика и не медицинский тест. Здесь нет правильных ответов — важнее первое ощущение от картинки.'))}</p>
        <button type="button" class="btn-primary" id="visual-begin-btn">${escapeHtml(T('test.start', 'Начать'))}</button>
      `;
      container.querySelector('#visual-begin-btn')?.addEventListener('click', () => {
        state.step = 'question';
        state.currentIndex = 0;
        renderStep();
      });
      return;
    }

    if (state.step === 'confirm-exit') {
      container.innerHTML = `
        <h2 id="visual-step-title" class="visual-title">${escapeHtml(T('test.exitTitle', 'Выйти из визуального теста?'))}</h2>
        <p class="visual-lead">${escapeHtml(T('test.exitLost', 'Ваши текущие ответы не сохранятся.'))}</p>
        <div class="visual-actions">
          <button type="button" class="btn-primary" id="visual-continue-btn">${escapeHtml(T('test.continue', 'Продолжить тест'))}</button>
          <button type="button" class="visual-btn-ghost" id="visual-exit-btn">${escapeHtml(T('battle.exit', 'Выйти'))}</button>
        </div>
      `;
      container.querySelector('#visual-continue-btn')?.addEventListener('click', () => {
        state.step = 'question';
        renderStep();
      });
      container.querySelector('#visual-exit-btn')?.addEventListener('click', () => closeOverlay(true));
      return;
    }

    if (state.step === 'question') {
      const q = state.questions[state.currentIndex];
      if (!q) return;
      const progress = ((state.currentIndex + 1) / state.questions.length) * 100;
      const selected = state.answers[q.id];
      const sceneHtml = window.VisualTestScenes?.render(q.imageId) || '';

      container.innerHTML = `
        <div class="visual-progress-wrap"><div class="visual-progress-bar" style="width:${progress}%"></div></div>
        <p class="visual-progress-label">${escapeHtml(T('test.imageProgress', `Изображение ${state.currentIndex + 1} из ${state.questions.length}`, { current: state.currentIndex + 1, total: state.questions.length }))}</p>
        <div class="visual-image-wrap">${sceneHtml}</div>
        <h2 id="visual-step-title" class="visual-question">${escapeHtml(q.text)}</h2>
        <div class="visual-options" role="radiogroup">
          ${q.options.map((opt) => `
            <button type="button" class="visual-option${selected === opt.id ? ' visual-option--selected' : ''}"
              data-answer="${opt.id}" role="radio" aria-checked="${selected === opt.id}">
              ${escapeHtml(opt.text)}
            </button>`).join('')}
        </div>
        <input type="text" class="visual-custom-input" id="visual-custom-text" maxlength="200"
          placeholder="${escapeHtml(T('test.customPlaceholder', 'Можете коротко описать свой вариант, если хотите'))}"
          value="${escapeHtml(state.customTexts[q.id] || '')}">
        <div class="visual-nav">
          <button type="button" class="visual-btn-ghost" id="visual-back-btn"${state.currentIndex === 0 ? ' disabled' : ''}>${escapeHtml(T('test.back', 'Назад'))}</button>
          <button type="button" class="btn-primary" id="visual-next-btn">${escapeHtml(state.currentIndex === state.questions.length - 1 ? T('test.finish', 'Завершить') : T('test.next', 'Далее'))}</button>
        </div>
        <p class="visual-error hidden" id="visual-answer-error">${escapeHtml(T('test.selectAnswer', 'Выберите один из вариантов ответа'))}</p>
      `;

      container.querySelectorAll('.visual-option').forEach((btn) => {
        btn.addEventListener('click', () => {
          state.answers[q.id] = btn.dataset.answer;
          state.dirty = true;
          container.querySelectorAll('.visual-option').forEach((el) => {
            el.classList.toggle('visual-option--selected', el.dataset.answer === btn.dataset.answer);
            el.setAttribute('aria-checked', el.dataset.answer === btn.dataset.answer);
          });
          container.querySelector('#visual-answer-error')?.classList.add('hidden');
        });
      });

      container.querySelector('#visual-custom-text')?.addEventListener('input', (e) => {
        state.customTexts[q.id] = e.target.value;
        state.dirty = true;
      });

      container.querySelector('#visual-back-btn')?.addEventListener('click', () => {
        if (state.currentIndex > 0) { state.currentIndex -= 1; renderStep(); }
      });

      container.querySelector('#visual-next-btn')?.addEventListener('click', () => {
        if (!state.answers[q.id]) {
          container.querySelector('#visual-answer-error')?.classList.remove('hidden');
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
      const r = state.result || state.visualTest;
      if (!r) return;
      const guestNotice = state.guestResult
        ? `<p class="psych-guest-notice">${escapeHtml(T('test.guestNotice', '⚠ Результат не сохранится.'))} <button type="button" class="psych-inline-login" id="visual-login-link">${escapeHtml(T('test.loginLink', 'Войдите'))}</button>${escapeHtml(T('test.guestNoticeTail', ', чтобы хранить историю профиля и получать персональные рекомендации.'))}</p>`
        : '';
      const saveBtn = state.guestResult
        ? `<button type="button" class="visual-btn-ghost" id="visual-login-save-btn">${escapeHtml(T('test.loginToSave', 'Войти, чтобы сохранить'))}</button>`
        : `<button type="button" class="visual-btn-ghost" id="visual-save-btn">${escapeHtml(T('test.saveResult', 'Сохранить результат'))}</button>`;

      container.innerHTML = `
        <p class="visual-eyebrow">${escapeHtml(T('test.resultEyebrow', 'Ваш визуальный профиль'))}</p>
        <h2 id="visual-step-title" class="visual-title">${escapeHtml(r.profileTitle)}</h2>
        <p class="visual-lead">${escapeHtml(r.profileDescription || '')}</p>
        ${guestNotice}
        <div class="visual-scales">${renderScaleBarsHtml(r.scales)}</div>
        <div class="visual-traits">
          <h3>${escapeHtml(T('test.maySuit', 'Что вам может подойти'))}</h3>
          <ul>${(r.suits || []).map((t) => `<li>${escapeHtml(t)}</li>`).join('')}</ul>
          <h3>${escapeHtml(T('test.avoid', 'Что лучше избегать'))}</h3>
          <ul class="visual-avoid">${(r.avoid || []).map((t) => `<li>${escapeHtml(t)}</li>`).join('')}</ul>
        </div>
        <div class="visual-actions visual-actions--result">
          <button type="button" class="btn-primary" id="visual-get-recs-btn">${escapeHtml(T('test.getRecs', 'Получить рекомендации'))}</button>
          ${saveBtn}
          <button type="button" class="visual-btn-ghost" id="visual-retake-btn">${escapeHtml(T('test.retake', 'Пройти заново'))}</button>
          <button type="button" class="visual-btn-ghost" id="visual-close-result-btn">${escapeHtml(T('common.close', 'Закрыть'))}</button>
        </div>
      `;
      container.querySelector('#visual-get-recs-btn')?.addEventListener('click', () => {
        state.selectedResultId = r.id || null;
        state.step = 'recommendations';
        renderStep();
        loadRecommendations();
      });
      container.querySelector('#visual-save-btn')?.addEventListener('click', () => toast(T('test.alreadySaved', 'Результат уже сохранён'), 'success'));
      const visualLogin = () => (window.requireLogin ? window.requireLogin() : (window.location.href = '/'));
      container.querySelector('#visual-login-link')?.addEventListener('click', visualLogin);
      container.querySelector('#visual-login-save-btn')?.addEventListener('click', visualLogin);
      container.querySelector('#visual-retake-btn')?.addEventListener('click', startTest);
      container.querySelector('#visual-close-result-btn')?.addEventListener('click', () => {
        closeOverlay(true);
        renderHomeBlock();
      });
      return;
    }

    if (state.step === 'saved-notice') {
      container.innerHTML = `
        <p class="visual-eyebrow">${escapeHtml(T('test.done', 'Готово'))}</p>
        <h2 id="visual-step-title" class="visual-title">${escapeHtml(T('test.savedTitle', 'Новый результат сохранён'))}</h2>
        <p class="visual-lead">${escapeHtml(T('test.savedLead', 'Вы можете посмотреть историю изменений в профиле.'))}</p>
        <div class="visual-actions">
          <button type="button" class="btn-primary" id="visual-open-profile-btn">${escapeHtml(T('test.openProfile', 'Открыть профиль'))}</button>
          <button type="button" class="btn-primary" id="visual-saved-recs-btn">${escapeHtml(T('test.getRecs', 'Получить рекомендации'))}</button>
          <button type="button" class="visual-btn-ghost" id="visual-saved-close-btn">${escapeHtml(T('common.close', 'Закрыть'))}</button>
        </div>
      `;
      container.querySelector('#visual-open-profile-btn')?.addEventListener('click', () => {
        closeOverlay(true);
        window.location.href = '/account.html';
      });
      container.querySelector('#visual-saved-recs-btn')?.addEventListener('click', () => {
        state.selectedResultId = state.result?.id || state.visualTest?.id || null;
        state.step = 'recommendations';
        renderStep();
        loadRecommendations();
      });
      container.querySelector('#visual-saved-close-btn')?.addEventListener('click', () => {
        closeOverlay(true);
        renderHomeBlock();
      });
      return;
    }

    if (state.step === 'recommendations') {
      const basedOnLabel = state.basedOn?.completedAt
        ? T('test.recsBasedOn', `Рекомендации на основе результата от ${formatDate(state.basedOn.completedAt)}, ${formatTime(state.basedOn.completedAt)}`, { date: formatDate(state.basedOn.completedAt), time: formatTime(state.basedOn.completedAt) })
        : T('test.recsTitle', 'Рекомендации по вашему визуальному профилю');
      container.innerHTML = `
        <h2 id="visual-step-title" class="visual-title">${escapeHtml(T('test.recsTitle', 'Рекомендации по вашему визуальному профилю'))}</h2>
        <p class="visual-lead visual-recs-based-on">${escapeHtml(basedOnLabel)}</p>
        <p class="visual-lead">${escapeHtml(T('test.recsLead', 'Мы учли, как вы воспринимаете образы, атмосферу, темп, настроение и визуальный стиль.'))}</p>
          <div id="visual-recs-list" class="visual-recs-list">${window.LoadingUI.aiRecommendations(T('test.pickingRecs', 'Подбираю рекомендации...'), 4)}</div>
        <div class="visual-actions">
          <button type="button" class="visual-btn-ghost" id="visual-recs-back-btn">${escapeHtml(T('test.recsBack', 'Назад к результату'))}</button>
          <button type="button" class="visual-btn-ghost" id="visual-recs-refresh-btn">${escapeHtml(T('common.refresh', 'Обновить'))}</button>
        </div>
      `;
      container.querySelector('#visual-recs-back-btn')?.addEventListener('click', () => {
        if (state.result || state.visualTest) { state.step = 'result'; renderStep(); }
        else closeOverlay(true);
      });
      container.querySelector('#visual-recs-refresh-btn')?.addEventListener('click', loadRecommendations);
    }
  }

  function isGuest() {
    return typeof window.isLoggedIn === 'function' ? !window.isLoggedIn() : false;
  }

  async function submitTest() {
    const answers = state.questions.map((q) => ({
      questionId: q.id,
      answerId: state.answers[q.id],
      customText: state.customTexts[q.id] || ''
    }));
    state.lastAnswers = answers;

    const container = ensureOverlay().querySelector('#visual-step-content');
    if (container) container.innerHTML = '<div class="visual-loading">' + window.LoadingUI.ai(T('test.buildingProfile', 'Формируем ваш визуальный профиль...'), { panel: true, tag: false }) + '</div>';

    try {
      const res = await fetch('/api/visual-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...window.authHeaders() },
        body: JSON.stringify({ answers })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Не удалось сохранить');

      state.visualTest = data.visualTest;
      state.result = {
        ...data.visualTest,
        avoid: data.profile?.avoid || data.visualTest.avoid || [],
        suits: data.profile?.suits || data.visualTest.suits || []
      };
      state.dirty = false;
      state.guestResult = data.guest === true || data.saved === false;
      if (state.guestResult) window.GuestStore?.saveTest?.('visual', answers);
      state.selectedResultId = data.visualTest?.id || null;
      state.step = (state.isRetake && !state.guestResult) ? 'saved-notice' : 'result';
      renderStep();
      renderHomeBlock();
      window.refreshProfilePage?.();
      if (state.guestResult) {
        toast(T('test.guestNotSaved', 'Результат не сохранён — войдите, чтобы хранить историю'), 'info');
      } else {
        toast(state.isRetake ? T('test.newSaved', 'Новый результат сохранён') : T('test.profileSaved', 'Визуальный профиль сохранён'), 'success');
      }
    } catch (err) {
      toast(err.message || T('test.saveFailed', 'Ошибка сохранения'), 'error');
      state.step = 'question';
      state.currentIndex = state.questions.length - 1;
      renderStep();
    }
  }

  function renderRecommendationCard(item, index) {
    const card = document.createElement('article');
    card.className = 'visual-rec-card';
    card.style.animationDelay = `${index * 80}ms`;
    const typeLabel = item.type === 'series' || item.mediaType === 'tv' ? T('common.series', 'Сериал') : T('common.film', 'Фильм');
    const posterUrl = window.MovieDisplay?.posterUrl?.(item.poster) || item.poster;
    const inList = isInList(item.title);

    card.innerHTML = `
      <div class="visual-rec-poster${posterUrl ? '' : ' visual-rec-poster--empty'}">
        ${posterUrl ? `<img src="${escapeHtml(posterUrl)}" alt="" loading="lazy">` : '🎬'}
      </div>
      <div class="visual-rec-body">
        <div class="visual-rec-head">
          <h3>${escapeHtml(item.title)}</h3>
          <span class="visual-rec-meta">${escapeHtml(item.year || '')} · ${typeLabel}</span>
        </div>
        ${item.genres?.length ? `<p class="visual-rec-genres">${(window.MovieDisplay?.displayGenres(item) || item.genres).map(escapeHtml).join(' · ')}</p>` : ''}
        <p class="visual-rec-reason">${escapeHtml(item.reason || '')}</p>
        ${item.visualConnection ? `<p class="visual-rec-connection">${escapeHtml(item.visualConnection)}</p>` : ''}
        ${item.visualMood ? `<p class="visual-rec-mood">${escapeHtml(T('test.mood', 'Настроение'))}: ${escapeHtml(item.visualMood)} · ${escapeHtml(item.pace || '')}</p>` : ''}
        <div class="visual-rec-actions">
          <button type="button" class="rec-add-btn"${inList ? ' disabled' : ''} title="${escapeHtml(T('common.add', 'Добавить'))}">${inList ? '✓' : '+'}</button>
          <div class="visual-dislike-wrap">
            <button type="button" class="visual-dislike-btn">${escapeHtml(T('test.dislike', 'Не хочу такое'))}</button>
            <div class="visual-dislike-menu hidden"></div>
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
      else toast(results?.[0]?.error || T('test.addFailed', 'Не удалось добавить'), 'error');
    });

    const menuBtn = card.querySelector('.visual-dislike-btn');
    const menu = card.querySelector('.visual-dislike-menu');
    menuBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = !menu.classList.contains('hidden');
      document.querySelectorAll('.visual-dislike-menu').forEach((m) => m.classList.add('hidden'));
      if (isOpen) return;
      menu.innerHTML = FEEDBACK_REASONS.map((r) =>
        `<button type="button" data-reason="${r.id}">${escapeHtml(r.label)}</button>`
      ).join('');
      menu.classList.remove('hidden');
      menu.querySelectorAll('button').forEach((btn) => {
        btn.addEventListener('click', async () => {
          menu.classList.add('hidden');
          try {
            const res = await fetch('/api/visual-test/feedback', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', ...window.authHeaders() },
              body: JSON.stringify({ title: item.title, reason: btn.dataset.reason })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            card.classList.add('visual-rec-card--dismissed');
            toast(T('test.feedbackSaved', 'Учтём в следующих рекомендациях'), 'success');
          } catch (err) {
            toast(err.message || T('test.saveFailed', 'Ошибка сохранения'), 'error');
          }
        });
      });
    });

    return card;
  }

  async function loadRecommendations() {
    const listEl = document.getElementById('visual-recs-list');
    if (!listEl) return;
    listEl.innerHTML = window.LoadingUI.aiRecommendations(T('test.pickingRecs', 'Подбираю рекомендации...'), 4);
    state.basedOn = null;

    try {
      const body = { mediaType: getActiveMediaType() };
      if (state.selectedResultId) body.resultId = state.selectedResultId;
      if (isGuest() && Array.isArray(state.lastAnswers) && state.lastAnswers.length) {
        body.answers = state.lastAnswers;
      }

      const res = await fetch('/api/visual-test/recommendations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...window.authHeaders() },
        body: JSON.stringify(body)
      });
      const data = await res.json();

      if (!res.ok) {
        listEl.innerHTML = `<p class="visual-recs-error">${escapeHtml(data.error || T('test.recsLoadError', 'Не удалось загрузить рекомендации'))}</p>`;
        return;
      }

      state.basedOn = data.basedOn || null;
      const basedEl = ensureOverlay().querySelector('.visual-recs-based-on');
      if (basedEl && state.basedOn?.completedAt) {
        basedEl.textContent = `Рекомендации на основе результата от ${formatDate(state.basedOn.completedAt)}, ${formatTime(state.basedOn.completedAt)}`;
      }

      const recs = data.recommendations || [];
      if (!recs.length) {
        listEl.innerHTML = `<p class="visual-recs-error">${escapeHtml(T('test.recsEmpty', 'Пока нет подходящих рекомендаций. Попробуйте обновить позже.'))}</p>`;
        return;
      }

      listEl.innerHTML = '';
      recs.forEach((item, i) => listEl.appendChild(renderRecommendationCard(item, i)));
    } catch {
      listEl.innerHTML = `<p class="visual-recs-error">${escapeHtml(T('profile.serverDown', 'Сервер недоступен'))}</p>`;
    }
  }

  async function refresh() {
    const block = document.getElementById('visual-test-section');
    if (block) {
      block.innerHTML = '<div class="visual-home-card">' + window.LoadingUI.ai(T('test.loadingTest', 'Загрузка теста...'), { panel: true, compact: true, tag: false }) + '</div>';
    }
    try {
      const res = await fetch('/api/visual-test', { headers: window.authHeaders() });
      if (!res.ok) return;
      const data = await res.json();
      state.questions = data.questions || [];
      state.visualTest = data.visualTest || null;
      renderHomeBlock();
    } catch {
      renderHomeBlock();
    }
  }

  document.addEventListener('click', () => {
    document.querySelectorAll('.visual-dislike-menu').forEach((m) => m.classList.add('hidden'));
  });

  document.addEventListener('i18n:change', renderHomeBlock);

  function openRecommendationsForResult(resultId) {
    state.selectedResultId = resultId || null;
    state.step = 'recommendations';
    openOverlay();
    loadRecommendations();
  }

  window.VisualTest = {
    refresh,
    startTest,
    openRecommendations: () => {
      state.selectedResultId = state.visualTest?.id || null;
      state.step = state.visualTest ? 'recommendations' : 'intro';
      openOverlay();
      if (state.step === 'recommendations') loadRecommendations();
    },
    openRecommendationsForResult
  };

  refresh();
})();
