/* Канонические русские названия жанров (TMDB ru-RU) → EN / KK для отображения.
   Внутренняя логика и фильтры по-прежнему используют русские ключи. */
(function () {
  'use strict';

  var SYNONYMS = {
    'романтика': 'мелодрама',
    'романтический': 'мелодрама',
    'романтическая драма': 'мелодрама',
    'экшен': 'боевик',
    'фентези': 'фэнтези',
    'фентэзи': 'фэнтези',
    'нф': 'фантастика',
    'сф': 'фантастика',
    'sci-fi': 'фантастика',
    'научная фантастика': 'фантастика',
    'биография': 'история',
    'биографии': 'история',
    'хоррор': 'ужасы',
    'ужас': 'ужасы',
    'мультсериал': 'мультфильм',
    'анимация': 'мультфильм',
    'детский': 'семейный'
  };

  var MAP = {
    'боевик': { en: 'Action', kk: 'Экшен' },
    'приключения': { en: 'Adventure', kk: 'Шаруашылық' },
    'мультфильм': { en: 'Animation', kk: 'Мультфильм' },
    'анимация': { en: 'Animation', kk: 'Анимация' },
    'комедия': { en: 'Comedy', kk: 'Комедия' },
    'криминал': { en: 'Crime', kk: 'Қылмыс' },
    'документальный': { en: 'Documentary', kk: 'Документалды' },
    'драма': { en: 'Drama', kk: 'Драма' },
    'семейный': { en: 'Family', kk: 'Отбасы' },
    'фэнтези': { en: 'Fantasy', kk: 'Фэнтези' },
    'фентези': { en: 'Fantasy', kk: 'Фэнтези' },
    'история': { en: 'History', kk: 'Тарих' },
    'ужасы': { en: 'Horror', kk: 'Қорқыныш' },
    'музыка': { en: 'Music', kk: 'Музыка' },
    'мелодрама': { en: 'Romance', kk: 'Мелодрама' },
    'фантастика': { en: 'Science Fiction', kk: 'Ғылыми фантастика' },
    'нф': { en: 'Sci-Fi', kk: 'Ғылыми фантастика' },
    'триллер': { en: 'Thriller', kk: 'Триллер' },
    'детектив': { en: 'Mystery', kk: 'Детектив' },
    'военный': { en: 'War', kk: 'Әскери' },
    'вестерн': { en: 'Western', kk: 'Вестерн' },
    'аниме': { en: 'Anime', kk: 'Аниме' },
    'телефильм': { en: 'TV Movie', kk: 'Телефильм' },
    'боевик и приключения': { en: 'Action & Adventure', kk: 'Экшен және шаруашылық' },
    'фантастика и фэнтези': { en: 'Sci-Fi & Fantasy', kk: 'Фантастика және фэнтези' },
    'мыльная опера': { en: 'Soap', kk: 'Сериал-драма' },
    'новости': { en: 'News', kk: 'Жаңалықтар' },
    'реальное тв': { en: 'Reality', kk: 'Реалити' },
    'ток-шоу': { en: 'Talk', kk: 'Ток-шоу' },
    'детский': { en: 'Kids', kk: 'Балалар' }
  };

  function canonicalKey(name) {
    var key = String(name || '').toLowerCase().replace(/ё/g, 'е').trim();
    return SYNONYMS[key] || key;
  }

  function translate(name, lang) {
    if (!name) return '';
    if (!lang || lang === 'ru') return String(name);
    var entry = MAP[canonicalKey(name)];
    if (!entry) return String(name);
    return entry[lang] || String(name);
  }

  function translateList(genres, lang) {
    return (genres || []).map(function (g) { return translate(g, lang); }).filter(Boolean);
  }

  window.GenreI18n = {
    canonicalKey: canonicalKey,
    translate: translate,
    translateList: translateList
  };
})();
