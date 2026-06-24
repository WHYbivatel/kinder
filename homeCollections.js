/* ===================================================================
   homeCollections.js — подборки на главной в виде компактных «чипов».

   Идея: вместо тяжёлых горизонтальных лент показываем подборки строкой
   чипов (иконка + название + описание) — точно как в каталоге
   (.cat-chips / .cat-chip). По клику чип разворачивает ленту фильмов в
   панель снизу. Карточки и добавление в список переиспользуются из
   каталога (window.CatalogUI), поведение единое.

   Лента подборки грузится через /api/catalog/collection/:id только по
   клику на чип — никаких десятков фоновых запросов при показе главной.
   =================================================================== */
(function () {
  'use strict';

  var root = document.getElementById('home-collections');
  if (!root) return;

  var listEl = root.querySelector('#home-collections-list');
  if (!listEl) return;

  var icons = window.CatalogIcons || {};
  var built = false;
  var loadingIndex = false;
  var collCache = {};

  function esc(text) {
    return (window.MovieDisplay && window.MovieDisplay.escapeHtml)
      ? window.MovieDisplay.escapeHtml(text)
      : String(text == null ? '' : text);
  }

  function hdrs() {
    return (typeof window.authHeaders === 'function') ? window.authHeaders() : {};
  }

  function lang() {
    return (window.I18N && window.I18N.tmdbLang) ? window.I18N.tmdbLang() : 'ru';
  }

  function withLang(url) {
    return url + (url.indexOf('?') === -1 ? '?' : '&') + 'lang=' + encodeURIComponent(lang());
  }

  function iconSvg(key) {
    return icons[key] || icons.film || '';
  }

  function rowSkeleton() {
    var cards = '';
    for (var i = 0; i < 6; i++) {
      cards += '<div class="cat-card cat-card--skeleton"><div class="cat-card-poster cat-card-poster--skeleton"></div></div>';
    }
    return cards;
  }

  // Чипы подборок в строку + общая панель для развёрнутой ленты.
  function renderChips(rails) {
    listEl.innerHTML = '' +
      '<div class="cat-chips" role="tablist" aria-label="Подборки">' +
        rails.map(function (r) {
          return '<button type="button" class="cat-chip" data-collection="' + esc(r.id) + '" aria-expanded="false">' +
            '<span class="cat-chip-icon" aria-hidden="true">' + iconSvg(r.icon) + '</span>' +
            '<span class="cat-chip-info">' +
              '<span class="cat-chip-text">' + esc(r.title) + '</span>' +
              (r.desc ? '<span class="cat-chip-desc">' + esc(r.desc) + '</span>' : '') +
            '</span>' +
            '<span class="cat-chip-caret" aria-hidden="true">▾</span>' +
          '</button>';
        }).join('') +
      '</div>' +
      '<div id="home-chip-panel" class="cat-chip-panel" hidden></div>';
  }

  function openCollection(id) {
    var panel = document.getElementById('home-chip-panel');
    if (!panel) return;
    panel.hidden = false;
    panel.innerHTML = '<div class="cat-row-scroll" id="home-cat-row-' + esc(id) + '">' + rowSkeleton() + '</div>';
    var target = document.getElementById('home-cat-row-' + id);
    if (!target) return;

    if (collCache[id]) {
      if (window.CatalogUI && window.CatalogUI.renderCardsInto) window.CatalogUI.renderCardsInto(target, collCache[id]);
      return;
    }

    fetch(withLang('/api/catalog/collection/' + encodeURIComponent(id)), { headers: hdrs() })
      .then(function (res) { return res.json().then(function (d) { return { ok: res.ok, d: d }; }); })
      .then(function (out) {
        var items = (out.ok && out.d && out.d.items) ? out.d.items : [];
        if (!items.length) {
          target.innerHTML = '<p class="cat-row-empty">Не удалось загрузить</p>';
          return;
        }
        collCache[id] = items;
        if (window.CatalogUI && window.CatalogUI.renderCardsInto) window.CatalogUI.renderCardsInto(target, items);
      })
      .catch(function () {
        target.innerHTML = '<p class="cat-row-empty">Сервер недоступен</p>';
      });
  }

  // Делегированные клики: чип открывает/закрывает свою ленту,
  // «+ В список» добавляет фильм (через общий хелпер каталога).
  listEl.addEventListener('click', function (e) {
    var chip = e.target.closest && e.target.closest('.cat-chip');
    if (chip) {
      var id = chip.getAttribute('data-collection');
      var wasActive = chip.classList.contains('cat-chip--active');
      var panel = document.getElementById('home-chip-panel');

      listEl.querySelectorAll('.cat-chip').forEach(function (c) {
        c.classList.remove('cat-chip--active');
        c.setAttribute('aria-expanded', 'false');
      });

      if (wasActive) {
        if (panel) { panel.hidden = true; panel.innerHTML = ''; }
        return;
      }

      chip.classList.add('cat-chip--active');
      chip.setAttribute('aria-expanded', 'true');
      openCollection(id);
      return;
    }

    var addBtn = e.target.closest && e.target.closest('.cat-card-add[data-add]');
    if (addBtn && window.CatalogUI && window.CatalogUI.addFromCard) {
      var card = addBtn.closest('.cat-card');
      if (card) window.CatalogUI.addFromCard(card, addBtn);
    }
  });

  // Смена языка: названия/описания подборок и фильмы (TMDB) зависят от
  // языка, поэтому пересобираем чипы заново.
  document.addEventListener('i18n:change', function () {
    built = false;
    loadingIndex = false;
    collCache = {};
    root.style.display = '';
    listEl.innerHTML = '';
    init();
  });

  function init() {
    if (built || loadingIndex) return;
    loadingIndex = true;
    fetch(withLang('/api/catalog/home'), { headers: hdrs() })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        loadingIndex = false;
        built = true;
        var rails = (data && data.rails) || [];
        if (!rails.length) { root.style.display = 'none'; return; }
        renderChips(rails);
      })
      .catch(function () {
        loadingIndex = false;
        listEl.innerHTML = '<p class="cat-row-empty">Не удалось загрузить подборки. ' +
          '<button type="button" class="cat-card-add" data-home-retry="1">Повторить</button></p>';
      });
  }

  root.addEventListener('click', function (e) {
    if (e.target.closest && e.target.closest('[data-home-retry]')) {
      built = false;
      init();
    }
  });

  window.HomeCollections = { refresh: init };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(init, 300); });
  } else {
    setTimeout(init, 300);
  }
})();
