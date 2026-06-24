/* ===================================================================
   guestStore.js — локальное сохранение действий гостя и перенос их
   в аккаунт после входа (merge guest session → user account).

   Пока пользователь не вошёл, его список фильмов, статусы, оценки,
   заметки и результаты тестов хранятся в localStorage. После успешного
   входа GuestStore.merge() аккуратно переносит всё на сервер, используя
   существующую серверную дедупликацию (PUT /api/movies), и очищает
   локальные данные.
   =================================================================== */
(function () {
  'use strict';

  const KEY = 'mf_guest_data_v1';

  function defaultData() {
    return {
      movies: [],
      nextId: 1,
      battleSessions: [],
      battleMatches: [],
      tests: {} // { psych: [...], visual: [...], short: { testId, answers } }
    };
  }

  function read() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return defaultData();
      const parsed = JSON.parse(raw);
      return { ...defaultData(), ...parsed };
    } catch (e) {
      return defaultData();
    }
  }

  function write(data) {
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch (e) { /* квота/приватный режим — не критично */ }
  }

  // Гостевой режим активен, пока пользователь не вошёл.
  function isActive() {
    return !(typeof window.isLoggedIn === 'function' && window.isLoggedIn());
  }

  function load() {
    return read();
  }

  // Полностью перезаписываем список (script.js хранит весь массив в памяти).
  function saveMovies(movies, nextId, battleSessions, battleMatches) {
    const data = read();
    data.movies = Array.isArray(movies) ? movies : [];
    data.nextId = nextId || data.nextId || 1;
    if (Array.isArray(battleSessions)) data.battleSessions = battleSessions;
    if (Array.isArray(battleMatches)) data.battleMatches = battleMatches;
    write(data);
  }

  function saveTest(type, payload) {
    if (!type || !payload) return;
    const data = read();
    data.tests = data.tests || {};
    data.tests[type] = payload;
    write(data);
  }

  function hasData() {
    const data = read();
    return (
      (Array.isArray(data.movies) && data.movies.length > 0) ||
      (data.tests && Object.keys(data.tests).length > 0)
    );
  }

  function clear() {
    try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
  }

  // Перенос гостевых данных в аккаунт. Вызывается после установки токена,
  // но до загрузки данных аккаунта. Сетевые ошибки не должны ломать вход.
  async function merge() {
    if (!hasData()) { clear(); return; }
    const data = read();
    const headers = { 'Content-Type': 'application/json', ...(window.authHeaders ? window.authHeaders() : {}) };

    try {
      if (Array.isArray(data.movies) && data.movies.length) {
        // Сервер сам дедуплицирует и выбирает более важный статус (mergeMovieRecord).
        await fetch('/api/movies', {
          method: 'PUT',
          cache: 'no-store',
          headers,
          body: JSON.stringify({
            movies: data.movies,
            nextId: data.nextId || 1,
            battleSessions: data.battleSessions || [],
            battleMatches: data.battleMatches || []
          })
        });
      }
    } catch (e) { /* список не перенёсся — оставим гостевые данные на месте */ }

    // Результаты тестов: переотправляем ответы, чтобы они сохранились в аккаунт.
    const tests = data.tests || {};
    try {
      if (Array.isArray(tests.psych) && tests.psych.length) {
        await fetch('/api/psych-test', {
          method: 'POST', headers, body: JSON.stringify({ answers: tests.psych })
        });
      }
    } catch (e) { /* ignore */ }
    try {
      if (Array.isArray(tests.visual) && tests.visual.length) {
        await fetch('/api/visual-test', {
          method: 'POST', headers, body: JSON.stringify({ answers: tests.visual })
        });
      }
    } catch (e) { /* ignore */ }
    try {
      if (tests.short && Array.isArray(tests.short.answers) && tests.short.answers.length) {
        await fetch('/api/short-visual-tests', {
          method: 'POST', headers,
          body: JSON.stringify({ testId: tests.short.testId, answers: tests.short.answers })
        });
      }
    } catch (e) { /* ignore */ }

    clear();
  }

  window.GuestStore = {
    isActive,
    load,
    saveMovies,
    saveTest,
    hasData,
    clear,
    merge
  };
})();
