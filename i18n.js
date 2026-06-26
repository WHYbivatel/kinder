/* ===================================================================
   i18n.js — единый слой локализации (RU/KK/EN).

   Словари: locales/ru.js, locales/kk.js, locales/en.js
   API: window.I18N, window.t, window.MovieApp.t / setLanguage / currentLanguage
   =================================================================== */
(function () {
  'use strict';

  var STORAGE_KEY = 'app_lang';
  var SUPPORTED = ['ru', 'kk', 'en'];
  var DEFAULT_LANG = 'ru';

  var LANG_FLAGS = { ru: '🇷🇺', kk: '🇰🇿', en: '🇺🇸' };
  var LANG_LABELS = { ru: 'RU', kk: 'KZ', en: 'EN' };

  var TMDB_LANG_MAP = {
    ru: 'ru-RU',
    kk: 'kk-KZ',
    en: 'en-US'
  };

  var TMDB_FALLBACK_CHAIN = {
    ru: ['ru-RU', 'en-US'],
    kk: ['kk-KZ', 'ru-RU'],
    en: ['en-US', 'ru-RU']
  };

  var DICT = {};
  var locales = window.__LOCALES || {};
  SUPPORTED.forEach(function (lang) {
    if (locales[lang]) DICT[lang] = locales[lang];
  });
  if (!DICT[DEFAULT_LANG]) DICT[DEFAULT_LANG] = {};

  function normalizeLang(value) {
    return SUPPORTED.indexOf(value) !== -1 ? value : null;
  }

  function readStoredLang() {
    try {
      var stored = normalizeLang(localStorage.getItem(STORAGE_KEY));
      if (stored) return stored;
    } catch (e) { /* ignore */ }
    return DEFAULT_LANG;
  }

  var currentLang = readStoredLang();
  var rerenderCallbacks = [];

  function t(key, vars) {
    var table = DICT[currentLang] || DICT[DEFAULT_LANG] || {};
    var str = table[key];
    if (str == null) {
      var fallback = DICT[DEFAULT_LANG] || {};
      str = fallback[key] != null ? fallback[key] : key;
    }
    if (vars) {
      str = String(str).replace(/\{(\w+)\}/g, function (m, name) {
        return vars[name] != null ? vars[name] : m;
      });
    }
    return str;
  }

  function tmdbLang(lang) {
    var code = normalizeLang(lang) || currentLang;
    return TMDB_LANG_MAP[code] || TMDB_LANG_MAP[DEFAULT_LANG];
  }

  function tmdbFallbackChain(lang) {
    var code = normalizeLang(lang) || currentLang;
    return TMDB_FALLBACK_CHAIN[code] || TMDB_FALLBACK_CHAIN[DEFAULT_LANG];
  }

  function movieTitle(movie) {
    if (!movie) return t('movie.noTitle');
    return movie.title || movie.name || movie.original_title || movie.original_name
      || (movie.meta && (movie.meta.matchedTitle || movie.meta.originalTitle))
      || t('movie.noTitle');
  }

  function movieOverview(movie) {
    if (window.MovieDisplay?.displayOverview) {
      const localized = window.MovieDisplay.displayOverview(movie);
      if (localized) return localized;
    }
    var text = movie?.overview || movie?.meta?.overview || '';
    if (typeof text === 'string' && text.trim()) return text.trim();
    return t('movie.noOverview');
  }

  function applyAttributes(root) {
    var scope = root || document;
    scope.querySelectorAll('[data-i18n]').forEach(function (el) {
      el.textContent = t(el.getAttribute('data-i18n'));
    });
    scope.querySelectorAll('[data-i18n-html]').forEach(function (el) {
      el.innerHTML = t(el.getAttribute('data-i18n-html'));
    });
    scope.querySelectorAll('[data-i18n-placeholder]').forEach(function (el) {
      el.setAttribute('placeholder', t(el.getAttribute('data-i18n-placeholder')));
    });
    scope.querySelectorAll('[data-i18n-title]').forEach(function (el) {
      el.setAttribute('title', t(el.getAttribute('data-i18n-title')));
    });
    scope.querySelectorAll('[data-i18n-aria]').forEach(function (el) {
      el.setAttribute('aria-label', t(el.getAttribute('data-i18n-aria')));
    });
    scope.querySelectorAll('title[data-i18n]').forEach(function (el) {
      el.textContent = t(el.getAttribute('data-i18n'));
    });
  }

  function updateToggleUI() {
    document.querySelectorAll('[data-lang-toggle]').forEach(function (toggle) {
      toggle.querySelectorAll('[data-lang-opt]').forEach(function (opt) {
        var lang = opt.getAttribute('data-lang-opt');
        var active = lang === currentLang;
        opt.classList.toggle('lang-toggle__opt--active', active);
        opt.setAttribute('aria-pressed', active ? 'true' : 'false');
      });
    });
  }

  function runRerenderCallbacks() {
    rerenderCallbacks.forEach(function (cb) {
      try { cb(currentLang); } catch (e) { console.warn('i18n rerender', e); }
    });
  }

  function setLang(lang) {
    var next = normalizeLang(lang);
    if (!next) {
      updateToggleUI();
      return;
    }
    var changed = next !== currentLang;
    currentLang = next;
    try { localStorage.setItem(STORAGE_KEY, next); } catch (e) { /* ignore */ }
    document.documentElement.setAttribute('lang', next === 'kk' ? 'kk' : next);
    applyAttributes(document);
    updateToggleUI();
    if (changed) {
      runRerenderCallbacks();
      document.dispatchEvent(new CustomEvent('i18n:change', { detail: { lang: next } }));
    }
  }

  function ensureToggleStyles() {
    if (document.getElementById('i18n-toggle-style')) return;
    var style = document.createElement('style');
    style.id = 'i18n-toggle-style';
    style.textContent =
      '.lang-toggle{display:inline-flex;align-items:center;gap:0;border:1px solid rgba(255,255,255,.18);' +
      'border-radius:999px;overflow:hidden;background:rgba(255,255,255,.06);flex:0 1 auto;min-width:0;height:32px;max-width:100%}' +
      '.lang-toggle__opt{appearance:none;border:0;background:transparent;color:inherit;cursor:pointer;' +
      'font:600 11px/1 Inter,system-ui,sans-serif;letter-spacing:.02em;padding:0 7px;height:100%;' +
      'opacity:.65;transition:background .15s,opacity .15s;white-space:nowrap}' +
      '.lang-toggle__flag{margin-right:.2em}' +
      '.lang-toggle__opt--active{background:var(--accent,#6c5ce7);color:#fff;opacity:1}' +
      '.lang-toggle__opt:not(.lang-toggle__opt--active):hover{opacity:.9}' +
      '.lang-toggle--floating{position:fixed;top:max(10px,env(safe-area-inset-top));right:12px;z-index:60;' +
      'backdrop-filter:blur(8px)}' +
      '@media (max-width:480px){.lang-toggle{height:28px}.lang-toggle__flag{display:none}' +
      '.lang-toggle__opt{padding:0 5px;font-size:10px}}';
    document.head.appendChild(style);
  }

  function buildToggle() {
    var wrap = document.createElement('div');
    wrap.className = 'lang-toggle';
    wrap.setAttribute('data-lang-toggle', '');
    wrap.setAttribute('role', 'group');
    wrap.setAttribute('aria-label', t('lang.label'));
    SUPPORTED.forEach(function (lang) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'lang-toggle__opt';
      btn.setAttribute('data-lang-opt', lang);
      btn.innerHTML =
        '<span class="lang-toggle__flag" aria-hidden="true">' + (LANG_FLAGS[lang] || '') + '</span>' +
        '<span class="lang-toggle__code">' + (LANG_LABELS[lang] || lang.toUpperCase()) + '</span>';
      btn.addEventListener('click', function () { setLang(lang); });
      wrap.appendChild(btn);
    });
    return wrap;
  }

  function mountToggle() {
    var existing = document.querySelector('[data-lang-toggle]');
    if (existing && existing.querySelector('[data-lang-opt]')) {
      existing.querySelectorAll('[data-lang-opt]').forEach(function (opt) {
        if (!opt.dataset.i18nBound) {
          opt.dataset.i18nBound = '1';
          opt.addEventListener('click', function () { setLang(opt.getAttribute('data-lang-opt')); });
        }
      });
      return;
    }

    ensureToggleStyles();
    var toggle = buildToggle();

    var headerRight = document.querySelector('.header-right');
    var topbar = document.querySelector('.moviepage-topbar, .personpage-topbar');
    if (headerRight) {
      headerRight.insertBefore(toggle, headerRight.firstChild);
    } else if (topbar) {
      topbar.appendChild(toggle);
    } else {
      toggle.classList.add('lang-toggle--floating');
      document.body.appendChild(toggle);
    }
  }

  function init() {
    document.documentElement.setAttribute('lang', currentLang === 'kk' ? 'kk' : currentLang);
    mountToggle();
    applyAttributes(document);
    updateToggleUI();
  }

  var I18N = {
    t: t,
    getLang: function () { return currentLang; },
    setLang: setLang,
    apply: applyAttributes,
    tmdbLang: function () { return tmdbLang(); },
    tmdbFallbackChain: tmdbFallbackChain,
    movieTitle: movieTitle,
    movieOverview: movieOverview,
    onChange: function (cb) {
      if (typeof cb === 'function') {
        rerenderCallbacks.push(cb);
        document.addEventListener('i18n:change', function (e) { cb(e.detail.lang); });
      }
    },
    apiHeaders: function () {
      return { 'X-App-Lang': currentLang };
    }
  };

  window.I18N = I18N;
  window.t = t;

  if (!window.MovieApp) window.MovieApp = {};
  Object.defineProperty(window.MovieApp, 'currentLanguage', {
    get: function () { return currentLang; },
    configurable: true
  });
  window.MovieApp.setLanguage = setLang;
  window.MovieApp.t = t;
  window.MovieApp.tmdbLang = function () { return tmdbLang(); };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
