/* ===================================================================
   guestSwipeActions.js — отдельное локальное хранилище гостевых свайпов
   для переноса в аккаунт после входа (guestSwipeActionsV1).

   Не заменяет discoverSeenKeysV1 (дедупликация карточек в ленте) и не
   меняет существующую механику свайпа — только дополнительный слой.
   =================================================================== */
(function () {
  'use strict';

  const STORAGE_KEY = 'guestSwipeActionsV1';
  const ACTION_PRIORITY = { watched: 3, like: 2, skip: 1 };
  const MAX_ACTIONS = 400;

  let isSyncingGuestSwipes = false;

  function isGuest() {
    if (typeof window.MovieApp?.isAuthenticated === 'function') {
      return !window.MovieApp.isAuthenticated();
    }
    return !(typeof window.isLoggedIn === 'function' && window.isLoggedIn());
  }

  function actionKey(item) {
    const mediaType = item.mediaType || 'movie';
    if (item.tmdbId) return `${mediaType}:tmdb:${item.tmdbId}`;
    const title = String(item.title || item.originalTitle || '')
      .toLowerCase()
      .replace(/ё/g, 'е')
      .replace(/\s+/g, ' ')
      .trim();
    return title ? `${mediaType}:title:${title}` : null;
  }

  function loadActions() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  }

  function writeActions(actions) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(actions.slice(-MAX_ACTIONS)));
    } catch { /* ignore */ }
  }

  function clearActions() {
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
  }

  function mapChoiceToAction(choice) {
    if (choice === 'watched') {
      return { action: 'watched', status: 'Посмотрел', preferenceSignal: null };
    }
    if (choice === 'skip') {
      return { action: 'skip', status: null, preferenceSignal: 'negative' };
    }
    return { action: 'like', status: 'Хочу посмотреть', preferenceSignal: null };
  }

  function buildEntry(item, choice) {
    const mapped = mapChoiceToAction(choice);
    const year = item.year
      || item.releaseDate?.slice(0, 4)
      || item.release_date?.slice(0, 4)
      || item.firstAirDate?.slice(0, 4)
      || item.first_air_date?.slice(0, 4)
      || item.meta?.year
      || null;
    return {
      key: actionKey(item),
      tmdbId: item.tmdbId || null,
      mediaType: item.mediaType || 'movie',
      title: item.title || item.originalTitle || '',
      originalTitle: item.originalTitle || null,
      poster: item.poster || item.meta?.poster || null,
      year: year ? Number(year) || year : null,
      genres: Array.isArray(item.genres) ? item.genres : [],
      originalLanguage: item.originalLanguage || item.meta?.originalLanguage || null,
      listCategory: window.MediaCategories?.getListCategory?.(item) || null,
      action: mapped.action,
      status: mapped.status,
      preferenceSignal: mapped.preferenceSignal,
      source: 'discover',
      createdAt: new Date().toISOString()
    };
  }

  function saveGuestSwipeAction(item, choice, { rating = null } = {}) {
    if (!isGuest() || !item) return;
    const entry = buildEntry(item, choice);
    if (!entry.key || !entry.title) return;
    if (choice === 'watched' && Number.isFinite(rating) && rating >= 1 && rating <= 10) {
      entry.rating = rating;
    }

    const actions = loadActions();
    const idx = actions.findIndex((a) => a.key === entry.key);
    if (idx === -1) {
      actions.push(entry);
    } else {
      const current = actions[idx];
      const nextPri = ACTION_PRIORITY[entry.action] || 0;
      const curPri = ACTION_PRIORITY[current.action] || 0;
      if (nextPri >= curPri) actions[idx] = entry;
    }
    writeActions(actions);
  }

  function showSyncToast(message) {
    if (!message) return;
    let el = document.getElementById('guest-swipe-sync-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'guest-swipe-sync-toast';
      el.setAttribute('role', 'status');
      el.style.cssText = [
        'position:fixed',
        'left:50%',
        'bottom:calc(1.25rem + env(safe-area-inset-bottom,0px))',
        'transform:translateX(-50%)',
        'z-index:10050',
        'max-width:min(92vw,28rem)',
        'padding:0.75rem 1rem',
        'border-radius:12px',
        'background:rgba(18,22,32,0.94)',
        'color:#f5f7fb',
        'font-size:0.92rem',
        'line-height:1.35',
        'box-shadow:0 8px 28px rgba(0,0,0,0.35)',
        'pointer-events:none'
      ].join(';');
      document.body.appendChild(el);
    }
    el.textContent = message;
    el.hidden = false;
    clearTimeout(showSyncToast._timer);
    showSyncToast._timer = setTimeout(() => { el.hidden = true; }, 3600);
  }

  function formatSyncMessage(stats) {
    const want = Number(stats?.wantAdded || 0) + Number(stats?.wantUpgraded || 0);
    const watched = Number(stats?.watchedAdded || 0);
    if (!want && !watched) return 'Свайпы перенесены в аккаунт';
    if (want && watched) return `Перенесено: ${want} в «Хочу посмотреть», ${watched} в «Посмотрел»`;
    if (want) return `Перенесено: ${want} в «Хочу посмотреть»`;
    return `Перенесено: ${watched} в «Посмотрел»`;
  }

  function serializeForServer(entry) {
    return {
      key: entry.key,
      tmdbId: entry.tmdbId,
      mediaType: entry.mediaType || 'movie',
      title: entry.title,
      originalTitle: entry.originalTitle || null,
      poster: entry.poster || null,
      year: entry.year || null,
      genres: entry.genres || [],
      originalLanguage: entry.originalLanguage || null,
      listCategory: entry.listCategory || null,
      action: entry.action,
      status: entry.status || null,
      rating: entry.rating ?? null,
      preferenceSignal: entry.preferenceSignal || null,
      source: entry.source || 'discover',
      createdAt: entry.createdAt || new Date().toISOString()
    };
  }

  async function syncGuestSwipeActionsToAccount() {
    if (!window.isLoggedIn?.()) return;
    if (isSyncingGuestSwipes) return;

    const actions = loadActions();
    if (!actions.length) return;

    isSyncingGuestSwipes = true;
    try {
      const response = await fetch('/api/user/import-guest-swipes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(window.authHeaders ? window.authHeaders() : {})
        },
        body: JSON.stringify({ actions: actions.map(serializeForServer) })
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        showSyncToast('Не удалось перенести часть свайпов. Попробуем позже.');
        return;
      }

      const importedKeys = new Set(data.importedKeys || []);
      if (!importedKeys.size) return;

      const remaining = actions.filter((a) => !importedKeys.has(a.key));
      if (remaining.length) writeActions(remaining);
      else clearActions();

      const stats = data.stats || {};
      const listChanged = (stats.wantAdded || 0) + (stats.wantUpgraded || 0) + (stats.watchedAdded || 0) > 0;
      const skipsImported = (stats.skips || 0) > 0;

      if (data.partial) {
        showSyncToast('Не удалось перенести часть свайпов. Попробуем позже.');
      } else if (listChanged || skipsImported) {
        showSyncToast(formatSyncMessage(stats));
      }

      if (listChanged) {
        await window.MovieApp?.init?.().catch(() => undefined);
        window.refreshExtendedFeatures?.();
        window.DiscoverPWA?.refresh?.();
      }
    } catch {
      showSyncToast('Не удалось перенести часть свайпов. Попробуем позже.');
    } finally {
      isSyncingGuestSwipes = false;
    }
  }

  window.GuestSwipeActions = {
    isGuest,
    saveGuestSwipeAction,
    syncGuestSwipeActionsToAccount,
    loadActions
  };
  window.syncGuestSwipeActionsToAccount = syncGuestSwipeActionsToAccount;
})();
