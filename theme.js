/* ===================================================================
   theme.js — переключение светлой/тёмной темы.
   Тема хранится в localStorage('theme') и применяется к <html> через
   data-theme. Скрипт подключается в <head> и применяет тему сразу,
   чтобы не было вспышки. Кнопка #theme-toggle-btn привязывается, когда
   DOM готов.
   =================================================================== */
(function () {
  'use strict';

  var STORAGE_KEY = 'theme';

  function read() {
    try { return localStorage.getItem(STORAGE_KEY); } catch (e) { return null; }
  }
  function save(value) {
    try { localStorage.setItem(STORAGE_KEY, value); } catch (e) {}
  }

  function current() {
    return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
  }

  function apply(theme) {
    var t = theme === 'light' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', t);
    updateButton(t);
    updateMeta(t);
  }

  function updateMeta(theme) {
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'light' ? '#f4f4f7' : '#08080a');
  }

  function updateButton(theme) {
    var btn = document.getElementById('theme-toggle-btn');
    if (!btn) return;
    var isLight = theme === 'light';
    btn.innerHTML = '<span class="theme-toggle-icon" aria-hidden="true">' +
      (isLight ? '☀️' : '🌙') + '</span>';
    var label = isLight ? 'Светлая тема — переключить на тёмную' : 'Тёмная тема — переключить на светлую';
    btn.setAttribute('title', isLight ? 'Светлая тема' : 'Тёмная тема');
    btn.setAttribute('aria-label', label);
    btn.setAttribute('aria-pressed', isLight ? 'true' : 'false');
  }

  function toggle() {
    var next = current() === 'light' ? 'dark' : 'light';
    save(next);
    apply(next);
  }

  // Применяем сохранённую тему как можно раньше (до отрисовки body)
  apply(read() || 'dark');

  function bind() {
    var btn = document.getElementById('theme-toggle-btn');
    if (btn && !btn.dataset.themeBound) {
      btn.dataset.themeBound = '1';
      btn.addEventListener('click', toggle);
    }
    updateButton(current());
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bind);
  } else {
    bind();
  }

  window.ThemeToggle = { toggle: toggle, apply: apply, current: current };
})();
