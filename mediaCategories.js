/* Общая классификация контента для списка и свайпа. */
(function () {
  'use strict';

  function isAnimatedContent(item) {
    if (!item) return false;
    const genres = (item.genres || []).map((g) => String(g).toLowerCase());
    const text = [
      item.title,
      item.originalTitle,
      item.meta?.originalTitle,
      (item.genres || []).join(' ')
    ].filter(Boolean).join(' ').toLowerCase();
    return genres.some((g) => /анимац|animation|мульт|cartoon/.test(g))
      || /анимац|animation|мульт|cartoon|аниме|anime/i.test(text);
  }

  function isAnimeContent(item) {
    if (!isAnimatedContent(item)) return false;
    const lang = String(item.originalLanguage || item.meta?.originalLanguage || '').toLowerCase();
    if (lang === 'ja') return true;
    const text = `${item.title || ''} ${item.originalTitle || ''} ${(item.genres || []).join(' ')}`.toLowerCase();
    return /\bаниме\b|\banime\b/.test(text);
  }

  /** Категория вкладки списка: movie | tv | animation */
  function getListCategory(item) {
    const type = item?.mediaType || 'movie';
    if (isAnimatedContent(item)) return 'animation';
    return type === 'tv' ? 'tv' : 'movie';
  }

  function matchesListCategory(item, tabType) {
    if (!tabType || tabType === 'all') return true;
    return getListCategory(item) === tabType;
  }

  window.MediaCategories = {
    isAnimatedContent,
    isAnimeContent,
    getListCategory,
    matchesListCategory
  };
})();
