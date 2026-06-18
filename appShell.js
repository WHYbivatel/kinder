/* ===================================================================
   appShell.js — «приложение-режим» для PWA / телефона.

   Идея: на ПК-браузере сайт остаётся прежним. В установленной PWA
   (display-mode: standalone) или на узком/мобильном экране включается
   class="app-mode" на <body>, появляется нижняя панель вкладок и
   контент показывается по одному «экрану» за раз — как в мобильном
   приложении.

   Реализация безопасная и аддитивная: исходные секции остаются в DOM,
   мы лишь переключаем их inline-видимость. Существующий JS не меняется.

   Откат: удалить подключение этого файла (и appShell.css) из *.html.
   =================================================================== */
(function () {
  'use strict';

  var STORAGE_KEY = 'appShellScreen';
  var FORCE_KEY = 'appShellForce'; // '1' — всегда вкл, '0' — всегда выкл (для теста на ПК)

  // Вкладки нижней панели (порядок = порядок в панели)
  var TABS = [
    { id: 'home',     icon: '🏠', label: 'Главная',  href: '/#home' },
    { id: 'tests',    icon: '🧪', label: 'Тесты',    href: '/#tests' },
    { id: 'discover', icon: '💕', label: 'Свайп',    href: '/#discover' },
    { id: 'ai',       icon: '💬', label: 'AI',       href: '/#ai' },
    { id: 'list',     icon: '📋', label: 'Список',   href: '/#list' }
  ];

  // Экраны, между которыми переключаемся на главной странице
  var SCREENS = ['home', 'tests', 'discover', 'list', 'ai'];

  // Привязка секций главной страницы к экранам (селектор → экран).
  // Чат (#chat-panel) показывается на экране 'ai' через CSS, отдельно.
  var SECTION_MAP = [
    ['#premiere-ribbon-section', 'home'],
    ['.hero-section', 'home'],
    ['#battle-section', 'home'],
    ['#recommendations-box', 'home'],
    ['.collections-section', 'home'],
    ['.premiere-suggest-section', 'home'],

    ['#psych-test-section', 'tests'],
    ['#visual-test-section', 'tests'],
    ['#short-visual-tests-section', 'tests'],

    ['#discover-section', 'discover'],

    ['.movie-list-section', 'list'],
    ['.blacklist-section', 'list'],
    ['.import-section', 'list']
  ];

  var page = (document.body && document.body.dataset.page) || 'home';
  var isHomePage = page === 'home';
  var sectionEntries = [];   // [{ el, screen }]
  var tabbarEl = null;
  var active = false;

  // ── Определение режима ─────────────────────────────────────────
  function readForce() {
    var qs = new URLSearchParams(window.location.search);
    if (qs.get('app') === '1') { safeStore(FORCE_KEY, '1'); }
    if (qs.get('app') === '0') { safeStore(FORCE_KEY, '0'); }
    try { return localStorage.getItem(FORCE_KEY); } catch (e) { return null; }
  }

  function isStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true;
  }

  function isMobileLike() {
    return window.matchMedia('(max-width: 900px), (pointer: coarse)').matches;
  }

  function shouldBeApp() {
    var force = readForce();
    if (force === '1') return true;
    if (force === '0') return false;
    return isStandalone() || isMobileLike();
  }

  function safeStore(key, val) {
    try { localStorage.setItem(key, val); } catch (e) {}
  }
  function safeRead(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }

  // ── Сбор секций главной страницы ───────────────────────────────
  function collectSections() {
    sectionEntries = [];
    SECTION_MAP.forEach(function (pair) {
      var el = document.querySelector(pair[0]);
      if (el) sectionEntries.push({ el: el, screen: pair[1] });
    });
  }

  // ── Нижняя панель вкладок ──────────────────────────────────────
  function buildTabbar() {
    if (tabbarEl) return tabbarEl;

    // Старую мобильную панель из pwa.js убираем, чтобы не дублировать
    var oldNav = document.getElementById('mobile-app-nav');
    if (oldNav && oldNav.parentNode) oldNav.parentNode.removeChild(oldNav);

    var nav = document.createElement('nav');
    nav.id = 'app-tabbar';
    nav.className = 'app-tabbar';
    nav.setAttribute('aria-label', 'Вкладки приложения');

    TABS.forEach(function (tab) {
      var a = document.createElement('a');
      a.className = 'app-tab';
      a.href = tab.href;
      a.dataset.tab = tab.id;
      a.innerHTML =
        '<span class="app-tab__icon" aria-hidden="true">' + tab.icon + '</span>' +
        '<span class="app-tab__label">' + tab.label + '</span>';

      if (isHomePage && !tab.link) {
        a.addEventListener('click', function (e) {
          e.preventDefault();
          showScreen(tab.id, true);
        });
      }
      nav.appendChild(a);
    });

    // Кладём внутрь #app-content, чтобы панель автоматически скрывалась
    // на экране входа (когда #app-content имеет класс .hidden).
    var host = document.getElementById('app-content') || document.body;
    host.appendChild(nav);
    tabbarEl = nav;
    return nav;
  }

  function setActiveTab(id) {
    if (!tabbarEl) return;
    var items = tabbarEl.querySelectorAll('.app-tab');
    for (var i = 0; i < items.length; i++) {
      items[i].classList.toggle('app-tab--active', items[i].dataset.tab === id);
    }
  }

  // ── Переключение экранов (только на главной) ───────────────────
  function showScreen(screen, updateHash) {
    if (SCREENS.indexOf(screen) === -1) screen = 'home';
    document.body.dataset.appScreen = screen;

    sectionEntries.forEach(function (entry) {
      entry.el.style.display = (entry.screen === screen) ? '' : 'none';
    });

    setActiveTab(screen);
    safeStore(STORAGE_KEY, screen);

    if (updateHash) {
      if (('#' + screen) !== window.location.hash) {
        history.replaceState(null, '', '#' + screen);
      }
      window.scrollTo(0, 0);
    }

    onScreenShown(screen);
  }

  // После показа экрана компоненты снова видимы — даём им пересчитать
  // размеры (карусели/верстка, которые мерили 0 пока были скрыты) и
  // подгружаем свайп-ленту, если она ещё пустая.
  function onScreenShown(screen) {
    window.requestAnimationFrame(function () {
      try { window.dispatchEvent(new Event('resize')); } catch (e) {}
      if (screen === 'discover') ensureDiscoverLoaded();
    });
  }

  function ensureDiscoverLoaded() {
    var stack = document.getElementById('discover-stack');
    if (!stack) return;
    var hasCard = stack.querySelector('.discover-card');
    if (hasCard) return;
    if (window.DiscoverPWA && typeof window.DiscoverPWA.refresh === 'function') {
      window.DiscoverPWA.refresh();
    }
  }

  function initialScreen() {
    var hash = (window.location.hash || '').replace('#', '');
    if (SCREENS.indexOf(hash) !== -1) return hash;
    var stored = safeRead(STORAGE_KEY);
    if (SCREENS.indexOf(stored) !== -1) return stored;
    return 'home';
  }

  // ── Вкл / выкл режима ──────────────────────────────────────────
  function enterAppMode() {
    if (active) return;
    active = true;
    document.body.classList.add('app-mode');
    buildTabbar();

    if (isHomePage) {
      collectSections();
      showScreen(initialScreen(), false);
    } else if (page === 'account') {
      setActiveTab('profile');
    } else {
      setActiveTab(null);
    }
  }

  function exitAppMode() {
    if (!active) return;
    active = false;
    document.body.classList.remove('app-mode');
    delete document.body.dataset.appScreen;

    // Возвращаем секции в исходное состояние (десктоп без изменений)
    sectionEntries.forEach(function (entry) {
      entry.el.style.display = '';
    });
  }

  function sync() {
    if (shouldBeApp()) enterAppMode();
    else exitAppMode();
  }

  // ── Слушатели изменения режима ─────────────────────────────────
  function bindMediaListeners() {
    var mqs = [
      window.matchMedia('(display-mode: standalone)'),
      window.matchMedia('(max-width: 900px)'),
      window.matchMedia('(pointer: coarse)')
    ];
    mqs.forEach(function (mq) {
      if (mq.addEventListener) mq.addEventListener('change', sync);
      else if (mq.addListener) mq.addListener(sync);
    });

    window.addEventListener('hashchange', function () {
      if (active && isHomePage) {
        var hash = (window.location.hash || '').replace('#', '');
        if (SCREENS.indexOf(hash) !== -1) showScreen(hash, false);
      }
    });
  }

  function start() {
    bindMediaListeners();
    sync();
    // экспортируем мини-API на случай ручного переключения
    window.appShell = {
      show: function (s) { if (active && isHomePage) showScreen(s, true); },
      enable: function () { safeStore(FORCE_KEY, '1'); sync(); },
      disable: function () { safeStore(FORCE_KEY, '0'); sync(); },
      auto: function () { try { localStorage.removeItem(FORCE_KEY); } catch (e) {} sync(); }
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
