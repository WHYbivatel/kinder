(function initProfilePage() {
  const T = (key, fallback, vars) => (window.t ? window.t(key, vars) : fallback);

  const els = {
    info: document.getElementById('profile-info'),
    tests: document.getElementById('profile-tests-summary')
  };

  let profileData = null;

  function esc(text) {
    return window.MovieDisplay?.escapeHtml(String(text ?? '')) || String(text ?? '');
  }

  function dateLocale() {
    const lang = window.I18N?.getLang?.() || 'ru';
    return lang === 'en' ? 'en-US' : lang === 'kk' ? 'kk-KZ' : 'ru-RU';
  }

  function formatDate(iso) {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleDateString(dateLocale(), { day: 'numeric', month: 'long', year: 'numeric' });
    } catch {
      return '—';
    }
  }

  function levelLabel(level) {
    if (level === 'low') return T('profile.levelLow', 'низкая');
    if (level === 'medium') return T('profile.levelMedium', 'средняя');
    if (level === 'high') return T('profile.levelHigh', 'высокая');
    return level || '';
  }

  function renderInfo(data) {
    if (!els.info) return;
    const name = (window.displayNameFrom ? window.displayNameFrom(data.username) : data.username) || T('profile.guest', 'Гость');
    const letter = name.trim().charAt(0).toUpperCase() || '?';
    const watchedMovies = data.watchedMovies || 0;
    const watchedSeries = data.watchedSeries || 0;
    const watched = watchedMovies + watchedSeries;

    const archetypes = [];
    if (data.psychTest?.profileTitle) {
      archetypes.push(`<span class="profile-archetype">🎭 ${esc(data.psychTest.profileTitle)}</span>`);
    }
    if (data.visualTest?.profileTitle) {
      archetypes.push(`<span class="profile-archetype">🖼️ ${esc(data.visualTest.profileTitle)}</span>`);
    }

    els.info.innerHTML = `
      <div class="profile-card">
        <div class="profile-card-avatar" aria-hidden="true">${esc(letter)}</div>
        <div class="profile-card-body">
          <p class="profile-card-name">${esc(name)}</p>
          <p class="profile-card-sub">${esc(T('profile.watchedLine', `${watched} просмотрено · ${data.totalMovies || 0} в списке`, { watched, total: data.totalMovies || 0 }))}</p>
          <p class="profile-card-split">${esc(T('profile.splitLine', `🎬 Фильмов: ${watchedMovies} · 📺 Сериалов: ${watchedSeries}`, { movies: watchedMovies, series: watchedSeries }))}</p>
          ${archetypes.length ? `<div class="profile-archetypes">${archetypes.join('')}</div>` : ''}
          ${data.registeredAt ? `<p class="profile-card-meta">${esc(T('profile.withUsSince', `С нами с ${formatDate(data.registeredAt)}`, { date: formatDate(data.registeredAt) }))}</p>` : ''}
        </div>
      </div>`;
  }

  const SCALE_ORDER = ['depth', 'emotionality', 'dynamics', 'comfort', 'atmosphere', 'tension'];

  function scalesHtml(scales) {
    if (!scales || typeof scales !== 'object') return '';
    const keys = Object.keys(scales)
      .filter((k) => scales[k])
      .sort((a, b) => {
        const ia = SCALE_ORDER.indexOf(a); const ib = SCALE_ORDER.indexOf(b);
        return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
      });
    if (!keys.length) return '';
    const rows = keys.map((k) => {
      const s = scales[k];
      const val = Math.max(6, Math.min(100, Number(s.value) || 0));
      const lvl = levelLabel(s.level);
      return `
        <div class="profile-scale">
          <div class="profile-scale-top">
            <span class="profile-scale-name">${esc(s.label || k)}</span>
            <span class="profile-scale-lvl">${esc(lvl)}</span>
          </div>
          <span class="profile-scale-track"><span class="profile-scale-fill" style="width:${val}%"></span></span>
        </div>`;
    }).join('');
    return `<div class="profile-test-scales">${rows}</div>`;
  }

  function testCard({ icon, title, result, description, scales, runs, lastDate, onStartId, onRecId, retake }) {
    if (!result) {
      return `
        <article class="profile-test-card profile-test-card--empty">
          <div class="profile-test-head">
            <span class="profile-test-icon" aria-hidden="true">${icon}</span>
            <h3 class="profile-test-title">${esc(title)}</h3>
          </div>
          <p class="profile-test-status">${esc(T('profile.testNotPassed', 'Тест ещё не пройден'))}</p>
          <div class="profile-test-actions">
            <button type="button" class="btn-primary" data-action="${onStartId}">${esc(T('profile.takeTest', 'Пройти тест'))}</button>
          </div>
        </article>`;
    }
    const metaBits = [];
    if (runs > 0) metaBits.push(T('profile.passedRuns', `Пройден ${runs} ${pluralRuns(runs)}`, { n: runs, times: pluralRuns(runs) }));
    if (lastDate) metaBits.push(formatDate(lastDate));
    return `
      <article class="profile-test-card">
        <div class="profile-test-head">
          <span class="profile-test-icon" aria-hidden="true">${icon}</span>
          <h3 class="profile-test-title">${esc(title)}</h3>
        </div>
        <p class="profile-test-result">${esc(result)}</p>
        ${metaBits.length ? `<p class="profile-test-meta">${esc(metaBits.join(' · '))}</p>` : ''}
        ${scalesHtml(scales)}
        ${description ? `<p class="profile-test-desc">${esc(description)}</p>` : ''}
        <div class="profile-test-actions">
          ${onRecId ? `<button type="button" class="btn-primary" data-action="${onRecId}">${esc(T('test.viewRecs', 'Посмотреть рекомендации'))}</button>` : ''}
          <button type="button" class="profile-btn-secondary" data-action="${retake}">${esc(T('test.retake', 'Пройти заново'))}</button>
        </div>
      </article>`;
  }

  function pluralRuns(n) {
    const mod10 = n % 10; const mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return T('profile.runOnce', 'раз');
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return T('profile.runFew', 'раза');
    return T('profile.runMany', 'раз');
  }

  function summaryBar({ typesPassed, totalRuns, lastDate }) {
    if (!typesPassed) {
      return `<p class="profile-tests-hint">${esc(T('profile.testsHint', 'Пройдите тесты ниже — здесь появится ваша статистика по результатам.'))}</p>`;
    }
    return `
      <div class="profile-tests-summary-bar">
        <div class="profile-stat">
          <span class="profile-stat-num">${typesPassed}<span class="profile-stat-of">/3</span></span>
          <span class="profile-stat-label">${esc(T('profile.typesPassed', 'типов пройдено'))}</span>
        </div>
        <div class="profile-stat">
          <span class="profile-stat-num">${totalRuns}</span>
          <span class="profile-stat-label">${esc(T('profile.totalRuns', 'всего прохождений'))}</span>
        </div>
        <div class="profile-stat">
          <span class="profile-stat-num profile-stat-num--sm">${esc(lastDate ? formatDate(lastDate) : '—')}</span>
          <span class="profile-stat-label">${esc(T('profile.lastTest', 'последний тест'))}</span>
        </div>
      </div>`;
  }

  function renderTests(data) {
    if (!els.tests) return;

    const psych = data.psychTest?.profileTitle ? data.psychTest : null;
    const visual = data.visualTest?.profileTitle ? data.visualTest : null;
    const shortVisual = (data.shortVisualTests?.history || [])[0] || null;

    const psychRuns = (data.psychTestHistory || []).length;
    const visualRuns = (data.visualTestHistory || []).length;
    const shortRuns = (data.shortVisualTests?.history || []).length;
    const totalRuns = psychRuns + visualRuns + shortRuns;
    const typesPassed = [psych, visual, shortVisual].filter(Boolean).length;
    const lastDate = [data.psychTest?.completedAt, data.visualTest?.completedAt, shortVisual?.completedAt]
      .filter(Boolean)
      .sort()
      .pop() || null;

    els.tests.innerHTML = `
      ${summaryBar({ typesPassed, totalRuns, lastDate })}
      <div class="profile-tests-grid">
        ${testCard({
          icon: '🎭',
          title: T('test.psychTitle', 'Кино-психологический тест'),
          result: psych?.profileTitle,
          description: psych?.profileShortDescription || psych?.profileDescription,
          scales: psych?.scales,
          runs: psychRuns,
          lastDate: psych?.completedAt,
          onStartId: 'psych-start',
          onRecId: 'psych-rec',
          retake: 'psych-retake'
        })}
        ${testCard({
          icon: '🖼️',
          title: T('test.visualTitle', 'Визуальный тест восприятия'),
          result: visual?.profileTitle,
          description: visual?.profileShortDescription || visual?.profileDescription,
          scales: visual?.scales,
          runs: visualRuns,
          lastDate: visual?.completedAt,
          onStartId: 'visual-start',
          onRecId: 'visual-rec',
          retake: 'visual-retake'
        })}
        ${testCard({
          icon: '⚡',
          title: T('short.title', 'Короткие визуальные тесты'),
          result: shortVisual?.profileTitle,
          description: shortVisual?.profileDescription,
          runs: shortRuns,
          lastDate: shortVisual?.completedAt,
          onStartId: 'short-start',
          onRecId: shortVisual ? 'short-rec' : null,
          retake: 'short-retake'
        })}
      </div>`;

    const goTests = () => { window.location.href = '/#tests'; };
    const handlers = {
      'psych-start': goTests,
      'psych-retake': goTests,
      'psych-rec': goTests,
      'visual-start': goTests,
      'visual-retake': goTests,
      'visual-rec': goTests,
      'short-start': goTests,
      'short-retake': goTests,
      'short-rec': goTests
    };

    els.tests.querySelectorAll('[data-action]').forEach((btn) => {
      const fn = handlers[btn.dataset.action];
      if (fn) btn.addEventListener('click', fn);
    });
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
    const sk = window.LoadingUI?.skeletonLines?.(3) || T('common.loading', 'Загрузка…');
    if (els.info) els.info.innerHTML = `<div class="profile-skeleton">${sk}</div>`;
    if (els.tests) els.tests.innerHTML = `<div class="profile-skeleton">${sk}</div>`;
  }

  async function refreshProfilePage() {
    if (!els.info) return;
    showSkeletons();

    try {
      const res = await fetch('/api/profile', { headers: window.authHeaders() });
      const data = await res.json();
      if (!res.ok) {
        showProfileToast(data.error || T('profile.loadError', 'Не удалось загрузить профиль'), 'error');
        return;
      }
      profileData = data;
      renderInfo(data);
      renderTests(data);
    } catch {
      showProfileToast(T('profile.serverDown', 'Сервер недоступен'), 'error');
    }
  }

  document.addEventListener('i18n:change', () => {
    if (profileData) {
      renderInfo(profileData);
      renderTests(profileData);
    }
  });

  window.refreshProfilePage = refreshProfilePage;
  window.showProfileToast = showProfileToast;
})();
