(function initProfilePage() {
  const SCALE_KEYS = ['depth', 'emotionality', 'dynamics', 'comfort'];
  const VISUAL_SCALE_KEYS = ['atmosphere', 'emotionality', 'tension', 'comfort'];
  const LEVEL_LABELS = { low: 'низкая', medium: 'средняя', high: 'высокая' };

  const VISUAL_SCALE_NAMES = {
    atmosphere: 'Атмосферность',
    emotionality: 'Эмоциональность',
    tension: 'Напряжение',
    comfort: 'Комфорт'
  };

  const els = {
    info: document.getElementById('profile-info'),
    latest: document.getElementById('profile-psych-latest'),
    dynamics: document.getElementById('profile-psych-dynamics'),
    history: document.getElementById('profile-psych-history'),
    chart: document.getElementById('profile-psych-chart'),
    visualLatest: document.getElementById('profile-visual-latest'),
    visualDynamics: document.getElementById('profile-visual-dynamics'),
    visualHistory: document.getElementById('profile-visual-history'),
    visualChart: document.getElementById('profile-visual-chart'),
    shortVisualLatest: document.getElementById('profile-short-visual-latest'),
    shortVisualHistory: document.getElementById('profile-short-visual-history')
  };

  let profileData = null;

  function esc(text) {
    return window.MovieDisplay?.escapeHtml(String(text ?? '')) || String(text ?? '');
  }

  function formatDate(iso) {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
    } catch {
      return '—';
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

  function formatDateShort(iso) {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
    } catch {
      return '—';
    }
  }

  function getScaleLevel(scales, key) {
    const val = scales?.[key];
    if (typeof val === 'object' && val?.level) return val.level;
    return val || 'medium';
  }

  function getScaleValue(scales, key) {
    const val = scales?.[key];
    if (typeof val === 'object' && val?.value != null) return val.value;
    const level = getScaleLevel(scales, key);
    return { low: 33, medium: 66, high: 100 }[level] || 50;
  }

  function getScaleLabel(scales, key) {
    const val = scales?.[key];
    if (typeof val === 'object' && val?.label) return val.label;
    const names = { depth: 'Глубина', emotionality: 'Эмоциональность', dynamics: 'Динамика', comfort: 'Лёгкость' };
    return names[key] || key;
  }

  function renderScaleBars(scales, className = '', keys = SCALE_KEYS, nameMap = null) {
    return `
      <div class="profile-scales ${className}">
        ${keys.map((key) => {
          const level = getScaleLevel(scales, key);
          const value = getScaleValue(scales, key);
          const label = nameMap?.[key] || getScaleLabel(scales, key);
          return `
            <div class="profile-scale">
              <div class="profile-scale-head">
                <span class="profile-scale-name">${esc(label)}</span>
                <span class="profile-scale-meta">${LEVEL_LABELS[level] || level} · ${value}%</span>
              </div>
              <div class="profile-scale-track">
                <div class="profile-scale-fill" style="width:${value}%"></div>
              </div>
            </div>`;
        }).join('')}
      </div>`;
  }

  function renderScalesInline(scales, keys = SCALE_KEYS, nameMap = null) {
    return keys.map((key) => {
      const label = nameMap?.[key] || getScaleLabel(scales, key);
      const level = getScaleLevel(scales, key);
      return `${esc(label)}: ${LEVEL_LABELS[level] || level}`;
    }).join(' · ');
  }

  function skeleton(html) {
    return `<div class="profile-skeleton">${html}</div>`;
  }

  function renderInfo(data) {
    if (!els.info) return;
    const rows = [
      ['Логин', data.username],
      ['Фильмов в списке', data.totalMovies],
      ['Просмотрено фильмов', data.watchedMovies],
      ['Просмотрено сериалов', data.watchedSeries]
    ];
    if (data.registeredAt) rows.push(['Дата регистрации', formatDate(data.registeredAt)]);
    if (data.lastActiveAt) rows.push(['Последняя активность', `${formatDate(data.lastActiveAt)}, ${formatTime(data.lastActiveAt)}`]);

    els.info.innerHTML = `
      <div class="profile-info-grid">
        ${rows.map(([label, value]) => `
          <div class="profile-info-item">
            <span class="profile-info-label">${esc(label)}</span>
            <span class="profile-info-value">${esc(String(value))}</span>
          </div>`).join('')}
      </div>`;
  }

  function renderLatest(data) {
    if (!els.latest) return;
    const test = data.psychTest;

    if (!test?.profileTitle) {
      els.latest.innerHTML = `
        <div class="profile-empty-card">
          <h3 class="profile-empty-title">Кино-психологический тест ещё не пройден</h3>
          <p class="panel-hint">Пройдите короткий тест, чтобы AI мог точнее подбирать фильмы и сериалы под ваше состояние и стиль восприятия.</p>
          <button type="button" class="btn-primary" id="profile-start-test-btn">Пройти тест</button>
        </div>`;
      document.getElementById('profile-start-test-btn')?.addEventListener('click', () => {
        if (window.PsychTest?.startTest) window.PsychTest.startTest();
        else window.location.href = '/';
      });
      return;
    }

    els.latest.innerHTML = `
      <div class="profile-result-card">
        <div class="profile-result-meta">
          <span>Дата: ${esc(formatDate(test.completedAt))}</span>
          <span>Время: ${esc(formatTime(test.completedAt))}</span>
        </div>
        <p class="profile-result-profile">Профиль: <strong>${esc(test.profileTitle)}</strong></p>
        <p class="profile-result-desc">${esc(test.profileDescription || test.profileShortDescription || '')}</p>
        ${renderScaleBars(test.scales)}
        <div class="profile-result-actions">
          <button type="button" class="btn-primary" data-rec-id="${esc(test.id || '')}">Рекомендации по этому профилю</button>
          <button type="button" class="profile-btn-secondary" id="profile-retake-btn">Пройти заново</button>
        </div>
      </div>`;

    els.latest.querySelector('[data-rec-id]')?.addEventListener('click', (e) => {
      openRecommendations(e.currentTarget.dataset.recId);
    });
    document.getElementById('profile-retake-btn')?.addEventListener('click', () => {
      if (window.PsychTest?.startTest) window.PsychTest.startTest();
      else window.location.href = '/';
    });
  }

  function renderDynamics(data) {
    if (!els.dynamics) return;
    const history = data.psychTestHistory || [];

    if (history.length < 2) {
      els.dynamics.innerHTML = `
        <p class="panel-hint profile-dynamics-hint">Пройдите тест ещё раз, чтобы увидеть, как меняется ваш стиль выбора фильмов.</p>`;
      if (els.chart) els.chart.innerHTML = '';
      return;
    }

    const first = history[history.length - 1];
    const last = history[0];
    const changed = first.profile !== last.profile;
    const title = changed
      ? `Ваш профиль изменился: ${first.profileTitle} → ${last.profileTitle}`
      : `Ваш профиль остаётся стабильным: ${last.profileTitle}`;

    els.dynamics.innerHTML = `
      <div class="profile-dynamics-card">
        <p class="profile-dynamics-title"><strong>${esc(title)}</strong></p>
        <p class="profile-dynamics-summary">${esc(data.dynamics?.summary || '')}</p>
        <div class="profile-dynamics-compare">
          <div class="profile-dynamics-col">
            <span class="profile-dynamics-label">Раньше</span>
            <strong>${esc(first.profileTitle)}</strong>
            ${renderScaleBars(first.scales, 'profile-scales--compact')}
          </div>
          <div class="profile-dynamics-col">
            <span class="profile-dynamics-label">Сейчас</span>
            <strong>${esc(last.profileTitle)}</strong>
            ${renderScaleBars(last.scales, 'profile-scales--compact')}
          </div>
        </div>
      </div>`;

    renderChart(history);
  }

  function renderChart(history) {
    if (!els.chart) return;
    const reversed = [...history].reverse();

    els.chart.innerHTML = `
      <div class="profile-chart-wrap">
        <table class="profile-chart-table">
          <thead>
            <tr>
              <th>Дата</th>
              <th>Профиль</th>
              ${SCALE_KEYS.map((k) => `<th>${esc(getScaleLabel({}, k))}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${reversed.map((entry) => `
              <tr>
                <td>${esc(formatDateShort(entry.completedAt))}</td>
                <td>${esc(entry.profileTitle)}</td>
                ${SCALE_KEYS.map((k) => `<td>${LEVEL_LABELS[getScaleLevel(entry.scales, k)] || '—'}</td>`).join('')}
              </tr>`).join('')}
          </tbody>
        </table>
        ${renderSvgChart(reversed)}
      </div>`;
  }

  function renderSvgChart(entries) {
    if (entries.length < 2) return '';
    const w = 320;
    const h = 120;
    const pad = 16;
    const colors = ['#5865f2', '#e50914', '#22c55e', '#f59e0b'];
    const lines = SCALE_KEYS.map((key, idx) => {
      const points = entries.map((entry, i) => {
        const x = pad + (i / (entries.length - 1)) * (w - pad * 2);
        const y = h - pad - (getScaleValue(entry.scales, key) / 100) * (h - pad * 2);
        return `${x},${y}`;
      }).join(' ');
      const label = getScaleLabel({}, key);
      return `<polyline fill="none" stroke="${colors[idx]}" stroke-width="2" points="${points}" opacity="0.85"/>
        <text x="${w - pad}" y="${12 + idx * 14}" fill="${colors[idx]}" font-size="10">${esc(label)}</text>`;
    }).join('');

    return `
      <div class="profile-svg-chart">
        <p class="profile-chart-caption">Динамика шкал</p>
        <svg viewBox="0 0 ${w} ${h}" class="profile-chart-svg" aria-hidden="true">${lines}</svg>
      </div>`;
  }

  function renderHistory(data) {
    if (!els.history) return;
    const history = data.psychTestHistory || [];

    if (!history.length) {
      els.history.innerHTML = `<p class="panel-hint">История пока пуста.</p>`;
      return;
    }

    els.history.innerHTML = `
      <p class="panel-hint profile-history-intro">Здесь сохраняются ваши прошлые результаты. Так можно увидеть, как менялся ваш стиль выбора фильмов со временем.</p>
      <div class="profile-history-list">
        ${history.map((entry) => `
          <article class="profile-history-item" data-id="${esc(entry.id || '')}">
            <div class="profile-history-head">
              <time>${esc(formatDate(entry.completedAt))}, ${esc(formatTime(entry.completedAt))}</time>
              <p class="profile-history-profile">Профиль: <strong>${esc(entry.profileTitle)}</strong></p>
              <p class="profile-history-scales">${esc(renderScalesInline(entry.scales))}</p>
            </div>
            <div class="profile-history-actions">
              <button type="button" class="profile-btn-secondary profile-detail-btn" data-id="${esc(entry.id || '')}">Подробнее</button>
              <button type="button" class="btn-primary profile-rec-btn" data-id="${esc(entry.id || '')}">Рекомендации</button>
            </div>
          </article>`).join('')}
      </div>`;

    els.history.querySelectorAll('.profile-detail-btn').forEach((btn) => {
      btn.addEventListener('click', () => openDetail(btn.dataset.id));
    });
    els.history.querySelectorAll('.profile-rec-btn').forEach((btn) => {
      btn.addEventListener('click', () => openRecommendations(btn.dataset.id));
    });
  }

  function openDetail(resultId) {
    const entry = (profileData?.psychTestHistory || []).find((h) => h.id === resultId)
      || (profileData?.psychTest?.id === resultId ? profileData.psychTest : null);
    if (!entry) {
      showProfileToast('Не удалось загрузить результат', 'error');
      return;
    }

    const profileScores = entry.scores || {};
    const scoreLines = Object.entries(profileScores)
      .filter(([, v]) => v > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([key, val]) => {
        const title = {
          deep_observer: 'Глубокий наблюдатель',
          emotional_empath: 'Эмоциональный эмпат',
          tension_seeker: 'Искатель напряжения',
          comfort_viewer: 'Комфортный зритель'
        }[key] || key;
        return `<li>${esc(title)}: ${val}</li>`;
      }).join('');

    const answersHtml = (entry.answers || []).map((a) => `
      <div class="profile-answer">
        <p class="profile-answer-q">${esc(a.questionText || a.questionId)}</p>
        <p class="profile-answer-a">${esc(a.answerText || a.answerId)}</p>
      </div>`).join('');

    const body = `
      <div class="profile-detail">
        <p class="profile-detail-meta">Результат от ${esc(formatDate(entry.completedAt))}, ${esc(formatTime(entry.completedAt))}</p>
        <p class="profile-detail-profile">Профиль: <strong>${esc(entry.profileTitle)}</strong></p>
        <p class="profile-detail-desc">${esc(entry.profileDescription || '')}</p>
        ${renderScaleBars(entry.scales)}
        ${scoreLines ? `<div class="profile-detail-scores"><h4>Баллы по профилям</h4><ul>${scoreLines}</ul></div>` : ''}
        ${(entry.suits || []).length ? `<div class="profile-detail-suits"><h4>Что подходит</h4><ul>${entry.suits.map((s) => `<li>${esc(s)}</li>`).join('')}</ul></div>` : ''}
        ${(entry.avoid || []).length ? `<div class="profile-detail-avoid"><h4>Что лучше избегать</h4><ul>${entry.avoid.map((s) => `<li>${esc(s)}</li>`).join('')}</ul></div>` : ''}
        ${answersHtml ? `<div class="profile-detail-answers"><h4>Ваши ответы</h4>${answersHtml}</div>` : ''}
        <div class="profile-detail-actions">
          <button type="button" class="btn-primary" id="profile-detail-rec-btn" data-id="${esc(entry.id || '')}">Рекомендации по этому результату</button>
          <button type="button" class="profile-btn-secondary" id="profile-detail-close-btn">Закрыть</button>
        </div>
      </div>`;

    window.openModal?.(`Результат от ${formatDate(entry.completedAt)}`, body);
    document.getElementById('profile-detail-rec-btn')?.addEventListener('click', () => {
      window.closeModal?.();
      openRecommendations(entry.id);
    });
    document.getElementById('profile-detail-close-btn')?.addEventListener('click', () => window.closeModal?.());
  }

  function openRecommendations(resultId) {
    if (window.PsychTest?.openRecommendationsForResult) {
      window.PsychTest.openRecommendationsForResult(resultId);
      return;
    }
    window.location.href = '/';
  }

  function renderVisualLatest(data) {
    if (!els.visualLatest) return;
    const test = data.visualTest;

    if (!test?.profileTitle) {
      els.visualLatest.innerHTML = `
        <div class="profile-empty-card">
          <h3 class="profile-empty-title">Визуальный тест ещё не пройден</h3>
          <p class="panel-hint">Посмотрите на 8 изображений и выберите, что вы в них видите — AI подберёт фильмы под ваш визуальный стиль.</p>
          <button type="button" class="btn-primary" id="profile-start-visual-btn">Пройти визуальный тест</button>
        </div>`;
      document.getElementById('profile-start-visual-btn')?.addEventListener('click', () => {
        if (window.VisualTest?.startTest) window.VisualTest.startTest();
        else window.location.href = '/';
      });
      return;
    }

    els.visualLatest.innerHTML = `
      <div class="profile-result-card">
        <div class="profile-result-meta">
          <span>Дата: ${esc(formatDate(test.completedAt))}</span>
          <span>Время: ${esc(formatTime(test.completedAt))}</span>
        </div>
        <p class="profile-result-profile">Профиль: <strong>${esc(test.profileTitle)}</strong></p>
        <p class="profile-result-desc">${esc(test.profileDescription || test.profileShortDescription || '')}</p>
        ${renderScaleBars(test.scales, '', VISUAL_SCALE_KEYS, VISUAL_SCALE_NAMES)}
        <div class="profile-result-actions">
          <button type="button" class="btn-primary profile-visual-rec-btn" data-id="${esc(test.id || '')}">Рекомендации по этому результату</button>
          <button type="button" class="profile-btn-secondary" id="profile-visual-retake-btn">Пройти визуальный тест заново</button>
        </div>
      </div>`;

    els.visualLatest.querySelector('.profile-visual-rec-btn')?.addEventListener('click', (e) => {
      openVisualRecommendations(e.currentTarget.dataset.id);
    });
    document.getElementById('profile-visual-retake-btn')?.addEventListener('click', () => {
      if (window.VisualTest?.startTest) window.VisualTest.startTest();
      else window.location.href = '/';
    });
  }

  function renderVisualDynamics(data) {
    if (!els.visualDynamics) return;
    const history = data.visualTestHistory || [];

    if (history.length < 2) {
      els.visualDynamics.innerHTML = `<p class="panel-hint profile-dynamics-hint">Пройдите визуальный тест ещё раз, чтобы увидеть динамику.</p>`;
      if (els.visualChart) els.visualChart.innerHTML = '';
      return;
    }

    const first = history[history.length - 1];
    const last = history[0];
    const changed = first.profile !== last.profile;
    const title = changed
      ? `Ваш визуальный профиль изменился: ${first.profileTitle} → ${last.profileTitle}`
      : `Ваш визуальный профиль остаётся стабильным: ${last.profileTitle}`;

    els.visualDynamics.innerHTML = `
      <div class="profile-dynamics-card">
        <p class="profile-dynamics-title"><strong>${esc(title)}</strong></p>
        <p class="profile-dynamics-summary">${esc(data.visualDynamics?.summary || '')}</p>
        <div class="profile-dynamics-compare">
          <div class="profile-dynamics-col">
            <span class="profile-dynamics-label">Раньше</span>
            <strong>${esc(first.profileTitle)}</strong>
            ${renderScaleBars(first.scales, 'profile-scales--compact', VISUAL_SCALE_KEYS, VISUAL_SCALE_NAMES)}
          </div>
          <div class="profile-dynamics-col">
            <span class="profile-dynamics-label">Сейчас</span>
            <strong>${esc(last.profileTitle)}</strong>
            ${renderScaleBars(last.scales, 'profile-scales--compact', VISUAL_SCALE_KEYS, VISUAL_SCALE_NAMES)}
          </div>
        </div>
      </div>`;

    renderVisualChart(history);
  }

  function renderVisualChart(history) {
    if (!els.visualChart) return;
    const reversed = [...history].reverse();
    els.visualChart.innerHTML = `
      <div class="profile-chart-wrap">
        <table class="profile-chart-table">
          <thead>
            <tr>
              <th>Дата</th>
              <th>Профиль</th>
              ${VISUAL_SCALE_KEYS.map((k) => `<th>${esc(VISUAL_SCALE_NAMES[k])}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${reversed.map((entry) => `
              <tr>
                <td>${esc(formatDateShort(entry.completedAt))}</td>
                <td>${esc(entry.profileTitle)}</td>
                ${VISUAL_SCALE_KEYS.map((k) => `<td>${LEVEL_LABELS[getScaleLevel(entry.scales, k)] || '—'}</td>`).join('')}
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`;
  }

  function renderVisualHistory(data) {
    if (!els.visualHistory) return;
    const history = data.visualTestHistory || [];

    if (!history.length) {
      els.visualHistory.innerHTML = `<p class="panel-hint">История визуального теста пока пуста.</p>`;
      return;
    }

    els.visualHistory.innerHTML = `
      <div class="profile-history-list">
        ${history.map((entry) => `
          <article class="profile-history-item">
            <div class="profile-history-head">
              <time>${esc(formatDate(entry.completedAt))}, ${esc(formatTime(entry.completedAt))}</time>
              <p class="profile-history-profile">Профиль: <strong>${esc(entry.profileTitle)}</strong></p>
              <p class="profile-history-scales">${esc(renderScalesInline(entry.scales, VISUAL_SCALE_KEYS, VISUAL_SCALE_NAMES))}</p>
            </div>
            <div class="profile-history-actions">
              <button type="button" class="profile-btn-secondary profile-visual-detail-btn" data-id="${esc(entry.id || '')}">Подробнее</button>
              <button type="button" class="btn-primary profile-visual-rec-btn" data-id="${esc(entry.id || '')}">Рекомендации</button>
            </div>
          </article>`).join('')}
      </div>`;

    els.visualHistory.querySelectorAll('.profile-visual-detail-btn').forEach((btn) => {
      btn.addEventListener('click', () => openVisualDetail(btn.dataset.id));
    });
    els.visualHistory.querySelectorAll('.profile-visual-rec-btn').forEach((btn) => {
      btn.addEventListener('click', () => openVisualRecommendations(btn.dataset.id));
    });
  }

  function openVisualDetail(resultId) {
    const entry = (profileData?.visualTestHistory || []).find((h) => h.id === resultId)
      || (profileData?.visualTest?.id === resultId ? profileData.visualTest : null);
    if (!entry) {
      showProfileToast('Не удалось загрузить результат', 'error');
      return;
    }

    const answersHtml = (entry.answers || []).map((a) => `
      <div class="profile-answer">
        <p class="profile-answer-q">${esc(a.questionText || a.questionId)}</p>
        <p class="profile-answer-a">${esc(a.answerText || a.answerId)}${a.customText ? ` · ${esc(a.customText)}` : ''}</p>
      </div>`).join('');

    const body = `
      <div class="profile-detail">
        <p class="profile-detail-meta">Результат от ${esc(formatDate(entry.completedAt))}, ${esc(formatTime(entry.completedAt))}</p>
        <p class="profile-detail-profile">Профиль: <strong>${esc(entry.profileTitle)}</strong></p>
        <p class="profile-detail-desc">${esc(entry.profileDescription || '')}</p>
        ${renderScaleBars(entry.scales, '', VISUAL_SCALE_KEYS, VISUAL_SCALE_NAMES)}
        ${(entry.suits || []).length ? `<div class="profile-detail-suits"><h4>Что подходит</h4><ul>${entry.suits.map((s) => `<li>${esc(s)}</li>`).join('')}</ul></div>` : ''}
        ${(entry.avoid || []).length ? `<div class="profile-detail-avoid"><h4>Что лучше избегать</h4><ul>${entry.avoid.map((s) => `<li>${esc(s)}</li>`).join('')}</ul></div>` : ''}
        ${answersHtml ? `<div class="profile-detail-answers"><h4>Ваши ответы</h4>${answersHtml}</div>` : ''}
        <div class="profile-detail-actions">
          <button type="button" class="btn-primary" id="profile-visual-detail-rec-btn">Рекомендации по этому результату</button>
          <button type="button" class="profile-btn-secondary" id="profile-detail-close-btn">Закрыть</button>
        </div>
      </div>`;

    window.openModal?.(`Визуальный результат от ${formatDate(entry.completedAt)}`, body);
    document.getElementById('profile-visual-detail-rec-btn')?.addEventListener('click', () => {
      window.closeModal?.();
      openVisualRecommendations(entry.id);
    });
    document.getElementById('profile-detail-close-btn')?.addEventListener('click', () => window.closeModal?.());
  }

  function openVisualRecommendations(resultId) {
    if (window.VisualTest?.openRecommendationsForResult) {
      window.VisualTest.openRecommendationsForResult(resultId);
      return;
    }
    window.location.href = '/';
  }

  function formatAnswersSummary(answers) {
    if (!answers?.length) return '—';
    return answers.map((a) => `${a.imageType}:${a.selectedOption}`).join(', ');
  }

  function renderShortVisualLatest(data) {
    if (!els.shortVisualLatest) return;
    const history = data.shortVisualTests?.history || [];
    const latest = history[0];

    if (!latest) {
      els.shortVisualLatest.innerHTML = `<p class="panel-hint">Короткие визуальные тесты ещё не пройдены. <a href="/">Пройти на главной</a></p>`;
      return;
    }

    els.shortVisualLatest.innerHTML = `
      <div class="profile-result-card profile-result-card--short-visual">
        <div class="profile-result-meta">
          <span>Дата: ${esc(formatDate(latest.completedAt))}</span>
          <span>Время: ${esc(formatTime(latest.completedAt))}</span>
        </div>
        <p class="profile-result-test">Тест: <strong>${esc(latest.testTitle || 'Короткий визуальный тест')}</strong></p>
        <p class="profile-result-profile">Результат: <strong>${esc(latest.profileTitle)}</strong></p>
        ${latest.profileDescription ? `<p class="profile-result-desc">${esc(latest.profileDescription)}</p>` : ''}
        ${(latest.recommendedGenres || []).length
          ? `<p class="profile-short-visual-genres"><span class="profile-result-label">Жанры:</span> ${latest.recommendedGenres.map((g) => `<span class="short-visual-meta-chip">${esc(g)}</span>`).join(' ')}</p>`
          : ''}
        <p class="profile-short-visual-meta"><span class="profile-result-label">Выборы:</span> ${esc(formatAnswersSummary(latest.answers))}</p>
        <div class="profile-result-actions">
          <button type="button" class="btn-primary profile-short-visual-rec-btn" data-id="${esc(latest.id || '')}">Рекомендации по этому результату</button>
        </div>
      </div>`;

    els.shortVisualLatest.querySelector('.profile-short-visual-rec-btn')?.addEventListener('click', () => {
      openShortVisualRecommendations(latest.id);
    });
  }

  function renderShortVisualHistory(data) {
    if (!els.shortVisualHistory) return;
    const history = data.shortVisualTests?.history || [];

    if (!history.length) {
      els.shortVisualHistory.innerHTML = `<p class="panel-hint">История пока пуста.</p>`;
      return;
    }

    els.shortVisualHistory.innerHTML = `
      <div class="profile-chart-wrap">
        <table class="short-visual-history-table profile-chart-table">
          <thead>
            <tr>
              <th>Дата</th>
              <th>Тест</th>
              <th>Результат</th>
              <th>Жанры</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${history.map((entry) => `
              <tr>
                <td>${esc(formatDateShort(entry.completedAt))}</td>
                <td>${esc(entry.testTitle || '—')}</td>
                <td><strong class="profile-short-visual-result">${esc(entry.profileTitle || '—')}</strong></td>
                <td>${(entry.recommendedGenres || []).slice(0, 3).map((g) => `<span class="short-visual-meta-chip">${esc(g)}</span>`).join(' ') || '—'}</td>
                <td><button type="button" class="profile-btn-secondary profile-short-visual-rec-btn" data-id="${esc(entry.id || '')}">Рекомендации</button></td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`;

    els.shortVisualHistory.querySelectorAll('.profile-short-visual-rec-btn').forEach((btn) => {
      btn.addEventListener('click', () => openShortVisualRecommendations(btn.dataset.id));
    });
  }

  function openShortVisualRecommendations(resultId) {
    if (window.ShortVisualTest?.openRecommendationsForResult) {
      window.ShortVisualTest.openRecommendationsForResult(resultId);
      return;
    }
    window.location.href = '/';
  }

  function showProfileToast(message, type = 'info') {
    let toast = document.getElementById('profile-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'profile-toast';
      toast.className = 'profile-toast';
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.className = `profile-toast profile-toast--${type} profile-toast--visible`;
    clearTimeout(showProfileToast._timer);
    showProfileToast._timer = setTimeout(() => toast.classList.remove('profile-toast--visible'), 3200);
  }

  function showSkeletons() {
    const sk = window.LoadingUI.skeletonLines(4);
    if (els.info) els.info.innerHTML = skeleton(sk);
    if (els.latest) els.latest.innerHTML = skeleton(sk);
    if (els.dynamics) els.dynamics.innerHTML = skeleton(sk);
    if (els.history) els.history.innerHTML = skeleton(sk);
    if (els.visualLatest) els.visualLatest.innerHTML = skeleton(sk);
    if (els.visualDynamics) els.visualDynamics.innerHTML = skeleton(sk);
    if (els.visualHistory) els.visualHistory.innerHTML = skeleton(sk);
    if (els.shortVisualLatest) els.shortVisualLatest.innerHTML = skeleton(sk);
    if (els.shortVisualHistory) els.shortVisualHistory.innerHTML = skeleton(sk);
  }

  async function refreshProfilePage() {
    if (!els.info) return;
    showSkeletons();

    try {
      const res = await fetch('/api/profile', { headers: window.authHeaders() });
      const data = await res.json();
      if (!res.ok) {
        showProfileToast(data.error || 'Не удалось загрузить профиль', 'error');
        return;
      }
      profileData = data;
      renderInfo(data);
      renderLatest(data);
      renderDynamics(data);
      renderHistory(data);
      renderVisualLatest(data);
      renderVisualDynamics(data);
      renderVisualHistory(data);
      renderShortVisualLatest(data);
      renderShortVisualHistory(data);
    } catch {
      showProfileToast('Сервер недоступен', 'error');
    }
  }

  window.refreshProfilePage = refreshProfilePage;
  window.showProfileToast = showProfileToast;
})();
