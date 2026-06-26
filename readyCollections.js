/* ===================================================================
   readyCollections.js — единый конфиг готовых подборок.

   Главная и каталог читают один и тот же список:
     showOnHome / showInCatalog / homePriority / catalogPriority
   Наполнение — динамическое через catalog.js + TMDB (не вручную).
   =================================================================== */

import { getCollectionGroupKk, getCollectionKkLabels } from './collectionLabels.kk.js';

/** @typedef {'tops'|'movies'|'series'|'animated-series'|'anime'|'genres'|'mood'|'themes'|'countries'} CollectionGroup */

export const COLLECTION_GROUP_META = {
  tops: { title: 'Топы', titleEn: 'Top picks' },
  movies: { title: 'Фильмы', titleEn: 'Movies', homeTitle: 'Фильмы', homeTitleEn: 'Movies' },
  series: { title: 'Сериалы', titleEn: 'TV series', homeTitle: 'Сериалы', homeTitleEn: 'TV series' },
  'animated-series': { title: 'Мультсериалы', titleEn: 'Animated series', homeTitle: 'Мультсериалы', homeTitleEn: 'Animated series' },
  anime: { title: 'Аниме', titleEn: 'Anime', homeTitle: 'Аниме', homeTitleEn: 'Anime' },
  genres: { title: 'Жанры', titleEn: 'Genres' },
  mood: { title: 'Настроение', titleEn: 'Mood' },
  themes: { title: 'Темы', titleEn: 'Themes' },
  countries: { title: 'Страны', titleEn: 'Countries', homeTitle: 'По странам', homeTitleEn: 'By country' }
};

const HOME_SECTION_ORDER = ['movies', 'series', 'animated-series', 'anime', 'countries'];
const CATALOG_GROUP_ORDER = ['tops', 'movies', 'series', 'animated-series', 'anime', 'genres', 'mood', 'themes', 'countries'];

/** Ровно эти подборки показываются на главной (витрина, не каталог). */
export const HOME_COLLECTION_IDS = [
  'popular-now',
  'new-releases',
  'feel-evening',
  'best-series-all-time',
  'anime',
  'underrated'
];

const GENRE_DEFS = [
  { key: 'боевик', title: '20 лучших боевиков', titleEn: 'Top 20 action movies', short: 'Боевики', shortEn: 'Action', icon: 'bolt', desc: 'Экшен и динамика', descEn: 'Action and momentum' },
  { key: 'драма', title: '20 лучших драм', titleEn: 'Top 20 dramas', short: 'Драмы', shortEn: 'Drama', icon: 'masks', desc: 'Сильные истории', descEn: 'Powerful stories' },
  { key: 'комедия', title: '20 лучших комедий', titleEn: 'Top 20 comedies', short: 'Комедии', shortEn: 'Comedy', icon: 'smile', desc: 'Посмеяться', descEn: 'For a laugh' },
  { key: 'фантастика', title: '20 лучших фантастических фильмов', titleEn: 'Top 20 sci-fi movies', short: 'Фантастика', shortEn: 'Sci-Fi', icon: 'rocket', desc: 'Будущее и иные миры', descEn: 'The future and other worlds' },
  { key: 'триллер', title: '20 лучших триллеров', titleEn: 'Top 20 thrillers', short: 'Триллеры', shortEn: 'Thrillers', icon: 'eye', desc: 'Держит в напряжении', descEn: 'Keeps you on edge' },
  { key: 'ужасы', title: '20 лучших ужасов', titleEn: 'Top 20 horror movies', short: 'Ужасы', shortEn: 'Horror', icon: 'ghost', desc: 'Страшно по-настоящему', descEn: 'Genuinely scary' },
  { key: 'криминал', title: '20 лучших криминальных фильмов', titleEn: 'Top 20 crime movies', short: 'Криминал', shortEn: 'Crime', icon: 'cuffs', desc: 'Преступления и нуар', descEn: 'Crime and noir' },
  { key: 'мелодрама', title: '20 лучших романтических фильмов', titleEn: 'Top 20 romance movies', short: 'Романтика', shortEn: 'Romance', icon: 'heart', desc: 'О любви', descEn: 'About love' },
  { key: 'фэнтези', title: '20 лучших фэнтези', titleEn: 'Top 20 fantasy movies', short: 'Фэнтези', shortEn: 'Fantasy', icon: 'wand', desc: 'Магия и приключения', descEn: 'Magic and adventure' },
  { key: 'детектив', title: '20 лучших детективов', titleEn: 'Top 20 mystery movies', short: 'Детективы', shortEn: 'Mystery', icon: 'search', desc: 'Загадки и расследования', descEn: 'Mysteries and investigations' },
  { key: 'приключения', title: '20 лучших приключений', titleEn: 'Top 20 adventure movies', short: 'Приключения', shortEn: 'Adventure', icon: 'compass', desc: 'Большие приключения', descEn: 'Big adventures' },
  { key: 'мультфильм', title: '20 лучших мультфильмов', titleEn: 'Top 20 animated movies', short: 'Мультфильмы', shortEn: 'Animation', icon: 'toon', desc: 'Анимация для всех', descEn: 'Animation for everyone' },
  { key: 'история', title: '20 лучших исторических фильмов', titleEn: 'Top 20 historical movies', short: 'Историческое', shortEn: 'History', icon: 'scroll', desc: 'Основано на истории', descEn: 'Based on history' },
  { key: 'военный', title: '20 лучших военных фильмов', titleEn: 'Top 20 war movies', short: 'Военные', shortEn: 'War', icon: 'shield', desc: 'О войне и людях', descEn: 'About war and people' }
];

const COUNTRY_DEFS = [
  { code: 'KZ', lang: 'kk', title: 'Казахские фильмы', titleEn: 'Kazakh movies', voteGte: 5, minVotes: 20, meanVote: 6.0 },
  { code: 'RU', lang: 'ru', title: 'Российские фильмы', titleEn: 'Russian movies', voteGte: 60, minVotes: 200, meanVote: 6.2 },
  { code: 'IN', lang: 'hi', title: 'Индийские фильмы', titleEn: 'Indian movies', voteGte: 60, minVotes: 200, meanVote: 6.3 },
  { code: 'US', lang: 'en', title: 'Американские фильмы', titleEn: 'American movies', voteGte: 300, minVotes: 800, meanVote: 6.6 },
  { code: 'KR', lang: 'ko', title: 'Корейские фильмы', titleEn: 'Korean movies', voteGte: 80, minVotes: 250, meanVote: 6.5 },
  { code: 'JP', lang: 'ja', title: 'Японские фильмы', titleEn: 'Japanese movies', voteGte: 80, minVotes: 250, meanVote: 6.5 },
  { code: 'CN', lang: 'zh', title: 'Китайские фильмы', titleEn: 'Chinese movies', voteGte: 40, minVotes: 150, meanVote: 6.3 },
  { code: 'FR', lang: 'fr', title: 'Французские фильмы', titleEn: 'French movies', voteGte: 80, minVotes: 250, meanVote: 6.4 },
  { code: 'GB', lang: 'en', title: 'Британские фильмы', titleEn: 'British movies', voteGte: 150, minVotes: 500, meanVote: 6.6 },
  { code: 'TR', lang: 'tr', title: 'Турецкие фильмы', titleEn: 'Turkish movies', voteGte: 20, minVotes: 80, meanVote: 6.2 },
  { code: 'DE', lang: 'de', title: 'Немецкие фильмы', titleEn: 'German movies', voteGte: 80, minVotes: 250, meanVote: 6.4 },
  { code: 'ES', lang: 'es', title: 'Испанские фильмы', titleEn: 'Spanish movies', voteGte: 80, minVotes: 250, meanVote: 6.4 }
];

const MOOD_DEFS = [
  { id: 'mood-light', title: 'Лёгкое и доброе', titleEn: 'Light and feel-good', genres: ['комедия', 'мелодрама', 'семейный', 'мультфильм'], icon: 'sun', desc: 'Без напряжения', descEn: 'Easy watching', catalogPriority: 1 },
  { id: 'mood-tense', title: 'Напряжённое', titleEn: 'Tense', genres: ['триллер', 'детектив', 'криминал'], icon: 'bolt', desc: 'Триллеры и интрига', descEn: 'Thrillers and intrigue', catalogPriority: 2 },
  { id: 'mood-think', title: 'Заставляет задуматься', titleEn: 'Makes you think', genres: ['драма', 'фантастика', 'история'], icon: 'bulb', desc: 'Глубокие сюжеты', descEn: 'Deep stories', catalogPriority: 3 },
  { id: 'mood-epic', title: 'Эпичное и зрелищное', titleEn: 'Epic and spectacular', genres: ['приключения', 'фэнтези', 'боевик'], icon: 'mountains', desc: 'Зрелищное кино', descEn: 'Spectacular cinema', catalogPriority: 4 },
  { id: 'mood-atmospheric', title: 'Атмосферное', titleEn: 'Atmospheric', genres: ['драма', 'триллер', 'детектив'], keywords: ['atmospheric', 'slow burn'], icon: 'moon', desc: 'Погружение в мир', descEn: 'Immersive worlds', catalogPriority: 5 },
  { id: 'mood-calm', title: 'Спокойное', titleEn: 'Calm', genres: ['драма', 'мелодрама', 'семейный'], keywords: ['slice of life'], icon: 'sun', desc: 'Без спешки', descEn: 'Unhurried viewing', catalogPriority: 6 },
  { id: 'mood-dynamic', title: 'Динамичное', titleEn: 'Dynamic', genres: ['боевик', 'приключения', 'криминал'], icon: 'bolt', desc: 'Быстрый темп', descEn: 'Fast-paced', catalogPriority: 7 },
  { id: 'mood-dark', title: 'Мрачное', titleEn: 'Dark', genres: ['триллер', 'ужасы', 'криминал', 'драма'], keywords: ['dark', 'neo-noir'], icon: 'moon', desc: 'Тяжёлая атмосфера', descEn: 'Heavy atmosphere', catalogPriority: 8 }
];

function base(overrides) {
  return {
    showOnHome: false,
    showInCatalog: true,
    homePriority: 50,
    catalogPriority: 50,
    limit: 20,
    media: 'movie',
    sort: 'score',
    pages: 4,
    voteGte: 200,
    minVotes: 400,
    meanVote: 6.6,
    icon: 'film',
    desc: '',
    descEn: '',
    shortTitle: null,
    shortTitleEn: null,
    ...overrides
  };
}

const CORE_COLLECTIONS = [
  // ── Топы ────────────────────────────────────────────────────────
  base({ id: 'most-popular', group: 'tops', title: '20 самых популярных', titleEn: 'Top 20 most popular', shortTitle: 'Популярное', shortTitleEn: 'Popular', desc: 'Сейчас на слуху', descEn: 'Trending right now', icon: 'flame', special: 'trending', media: 'movie', catalogPriority: 1, limit: 20 }),
  base({ id: 'best-recent', group: 'tops', title: '20 лучших за последние годы', titleEn: 'Top 20 of recent years', shortTitle: 'Лучшее за годы', shortTitleEn: 'Recent best', desc: 'Высокие оценки', descEn: 'Highly rated', icon: 'star', special: 'best-recent', media: 'movie', catalogPriority: 2, limit: 20 }),
  base({ id: 'highest-grossing', group: 'tops', title: '20 самых кассовых', titleEn: 'Top 20 highest-grossing', shortTitle: 'Кассовые', shortTitleEn: 'Box office', desc: 'Хиты проката', descEn: 'Box-office hits', icon: 'cash', special: 'highest-grossing', media: 'movie', catalogPriority: 3, limit: 20 }),
  base({ id: 'top-series', group: 'tops', title: '20 лучших сериалов', titleEn: 'Top 20 TV series', shortTitle: 'Сериалы', shortTitleEn: 'TV series', desc: 'Лучшие шоу', descEn: 'The best shows', icon: 'tv', special: 'top-series', media: 'tv', catalogPriority: 4, limit: 20 }),
  base({ id: 'popular-now', group: 'tops', title: 'Популярное сейчас', titleEn: 'Popular now', shortTitle: 'Популярное сейчас', shortTitleEn: 'Popular now', desc: 'У всех на слуху', descEn: 'Everyone is talking', icon: 'flame', special: 'trending-mixed', media: 'mixed', catalogPriority: 5, limit: 30 }),
  base({ id: 'new-releases', group: 'tops', title: 'Новинки', titleEn: 'New releases', shortTitle: 'Новинки', shortTitleEn: 'New', desc: 'Свежие премьеры', descEn: 'Fresh premieres', icon: 'sparkles', special: 'new-releases-mixed', media: 'mixed', recentDays: 150, voteGte: 40, sort: 'popularity', catalogPriority: 6, limit: 40 }),
  base({ id: 'high-rating', group: 'tops', title: 'Фильмы с высоким рейтингом', titleEn: 'Highly rated movies', shortTitle: 'Высокий рейтинг', shortTitleEn: 'Top rated', desc: 'Оценка 7.5+', descEn: 'Rated 7.5+', icon: 'star', media: 'movie', voteGte: 2000, ratingGte: 7.5, minVotes: 2000, meanVote: 7.2, catalogPriority: 7, limit: 50 }),
  base({ id: 'underrated', group: 'tops', title: 'Недооценённые фильмы', titleEn: 'Underrated movies', shortTitle: 'Недооценённые', shortTitleEn: 'Underrated', desc: 'Хорошие, но незаметные', descEn: 'Great but overlooked', icon: 'gem', media: 'movie', voteGte: 150, voteLte: 1800, ratingGte: 7.3, minVotes: 250, catalogPriority: 8 }),

  // ── Фильмы ──────────────────────────────────────────────────────
  base({ id: 'best-all-time', group: 'movies', title: 'Лучшие фильмы за всё время', titleEn: 'Best movies of all time', shortTitle: 'Лучшие фильмы', shortTitleEn: 'Best movies', desc: 'Золотой фонд кино', descEn: 'The golden age of cinema', icon: 'trophy', media: 'movie', voteGte: 3000, minVotes: 3000, meanVote: 7.0, pages: 5, limit: 50, catalogPriority: 1 }),
  base({ id: 'popular-movies', group: 'movies', title: 'Популярные фильмы', titleEn: 'Popular movies', shortTitle: 'Популярные', shortTitleEn: 'Popular', desc: 'Сейчас на слуху', descEn: 'Trending movies', icon: 'flame', special: 'trending', media: 'movie', catalogPriority: 2 }),
  base({ id: 'new-movies', group: 'movies', title: 'Новинки фильмов', titleEn: 'New movies', shortTitle: 'Новинки', shortTitleEn: 'New', desc: 'Свежие премьеры', descEn: 'Fresh premieres', icon: 'sparkles', media: 'movie', recentDays: 150, voteGte: 40, sort: 'popularity', catalogPriority: 3 }),
  base({ id: 'feel-evening', group: 'movies', title: 'Фильмы на вечер', titleEn: 'Movies for the evening', shortTitle: 'На вечер', shortTitleEn: 'Evening', desc: 'Идеально под настроение', descEn: 'Perfect for the mood', icon: 'sun', genres: ['комедия', 'мелодрама', 'приключения'], voteGte: 600, minVotes: 700, catalogPriority: 4 }),
  base({ id: 'family', group: 'movies', title: 'Семейные фильмы', titleEn: 'Family movies', shortTitle: 'Семейные', shortTitleEn: 'Family', desc: 'Для всей семьи', descEn: 'For the whole family', icon: 'family', genres: ['семейный', 'мультфильм'], voteGte: 400, minVotes: 500, catalogPriority: 5 }),
  base({ id: 'feel-dark', group: 'movies', title: 'Мрачные фильмы', titleEn: 'Dark movies', shortTitle: 'Мрачные', shortTitleEn: 'Dark', desc: 'Тяжёлая атмосфера', descEn: 'Heavy atmosphere', icon: 'moon', genres: ['триллер', 'ужасы', 'криминал', 'драма'], keywords: ['dark', 'neo-noir'], voteGte: 500, minVotes: 600, catalogPriority: 6 }),
  base({ id: 'twist-ending', group: 'movies', title: 'Фильмы с неожиданной концовкой', titleEn: 'Movies with a twist ending', shortTitle: 'С концовкой', shortTitleEn: 'Twist ending', desc: 'Финал-перевёртыш', descEn: 'A finale that flips it all', icon: 'shuffle', keywords: ['twist ending', 'plot twist'], voteGte: 400, minVotes: 500, catalogPriority: 7 }),
  base({ id: 'theme-travel', group: 'movies', title: 'Фильмы про путешествия', titleEn: 'Movies about travel', shortTitle: 'Путешествия', shortTitleEn: 'Travel', desc: 'Дорога и открытия', descEn: 'The road and discovery', icon: 'plane', keywords: ['travel', 'road trip', 'journey'], voteGte: 300, minVotes: 400, meanVote: 6.4, catalogPriority: 8 }),
  base({ id: 'theme-sport', group: 'movies', title: 'Фильмы про спорт', titleEn: 'Movies about sports', shortTitle: 'Спорт', shortTitleEn: 'Sports', desc: 'Победы и характер', descEn: 'Victories and character', icon: 'ball', keywords: ['sport', 'boxing', 'football'], voteGte: 200, minVotes: 350, meanVote: 6.4, catalogPriority: 9 }),
  base({ id: 'theme-business', group: 'movies', title: 'Фильмы про бизнес и деньги', titleEn: 'Movies about business and money', shortTitle: 'Бизнес', shortTitleEn: 'Business', desc: 'Амбиции и капитал', descEn: 'Ambition and capital', icon: 'briefcase', keywords: ['business', 'wall street', 'entrepreneur', 'money'], voteGte: 250, minVotes: 400, catalogPriority: 10 }),
  base({ id: 'theme-school', group: 'movies', title: 'Фильмы про школу и университет', titleEn: 'Movies about school and college', shortTitle: 'Школа', shortTitleEn: 'School', desc: 'Юность и взросление', descEn: 'Youth and coming of age', icon: 'grad', keywords: ['high school', 'college', 'university', 'coming of age'], voteGte: 250, minVotes: 400, catalogPriority: 11 }),
  base({ id: 'theme-survival', group: 'movies', title: 'Фильмы про выживание', titleEn: 'Movies about survival', shortTitle: 'Выживание', shortTitleEn: 'Survival', desc: 'На грани', descEn: 'On the edge', icon: 'tent', genres: ['боевик', 'триллер', 'приключения'], keywords: ['survival'], voteGte: 300, minVotes: 400, catalogPriority: 12 }),

  // ── Сериалы ─────────────────────────────────────────────────────
  base({ id: 'best-series-all-time', group: 'series', title: 'Лучшие сериалы', titleEn: 'Best TV series', shortTitle: 'Лучшие сериалы', shortTitleEn: 'Best series', desc: 'Главные шоу', descEn: 'The essential shows', icon: 'tv', media: 'tv', voteGte: 800, minVotes: 800, meanVote: 6.9, pages: 4, limit: 50, catalogPriority: 1 }),
  base({ id: 'popular-series', group: 'series', title: 'Популярные сериалы', titleEn: 'Popular TV series', shortTitle: 'Популярные', shortTitleEn: 'Popular', desc: 'Сейчас на слуху', descEn: 'Trending shows', icon: 'flame', special: 'trending-tv', media: 'tv', catalogPriority: 2 }),
  base({ id: 'new-series', group: 'series', title: 'Новинки сериалов', titleEn: 'New TV series', shortTitle: 'Новинки', shortTitleEn: 'New', desc: 'Свежие премьеры', descEn: 'Fresh premieres', icon: 'sparkles', media: 'tv', recentDays: 180, voteGte: 30, sort: 'popularity', catalogPriority: 3 }),
  base({ id: 'mini-series', group: 'series', title: 'Мини-сериалы', titleEn: 'Miniseries', shortTitle: 'Мини-сериалы', shortTitleEn: 'Miniseries', desc: 'Короткие истории', descEn: 'Short-form stories', icon: 'tv', media: 'tv', keywords: ['miniseries', 'limited series'], voteGte: 80, minVotes: 150, catalogPriority: 4, maxSeasons: 1 }),
  base({ id: 'crime-series', group: 'series', title: 'Криминальные сериалы', titleEn: 'Crime TV series', shortTitle: 'Криминал', shortTitleEn: 'Crime', desc: 'Расследования и нуар', descEn: 'Crime and noir', icon: 'cuffs', media: 'tv', genres: ['криминал', 'детектив'], voteGte: 200, minVotes: 300, catalogPriority: 5 }),
  base({ id: 'comedy-series', group: 'series', title: 'Комедийные сериалы', titleEn: 'Comedy TV series', shortTitle: 'Комедии', shortTitleEn: 'Comedy', desc: 'Посмеяться', descEn: 'For a laugh', icon: 'smile', media: 'tv', genres: ['комедия'], voteGte: 200, minVotes: 300, catalogPriority: 6 }),
  base({ id: 'drama-series', group: 'series', title: 'Драматические сериалы', titleEn: 'Drama TV series', shortTitle: 'Драмы', shortTitleEn: 'Drama', desc: 'Сильные истории', descEn: 'Powerful stories', icon: 'masks', media: 'tv', genres: ['драма'], voteGte: 200, minVotes: 300, catalogPriority: 7 }),
  base({ id: 'scifi-series', group: 'series', title: 'Фантастические сериалы', titleEn: 'Sci-fi TV series', shortTitle: 'Фантастика', shortTitleEn: 'Sci-Fi', desc: 'Будущее и иные миры', descEn: 'The future and other worlds', icon: 'rocket', media: 'tv', genres: ['фантастика', 'фэнтези'], voteGte: 150, minVotes: 250, catalogPriority: 8 }),
  base({ id: 'high-rating-series', group: 'series', title: 'Сериалы с высоким рейтингом', titleEn: 'Highly rated TV series', shortTitle: 'Высокий рейтинг', shortTitleEn: 'Top rated', desc: 'Оценка 7.5+', descEn: 'Rated 7.5+', icon: 'star', media: 'tv', voteGte: 500, ratingGte: 7.5, minVotes: 500, meanVote: 7.1, catalogPriority: 9 }),
  base({ id: 'evening-series', group: 'series', title: 'Сериалы на вечер', titleEn: 'TV series for the evening', shortTitle: 'На вечер', shortTitleEn: 'Evening', desc: 'Лёгкий просмотр', descEn: 'Easy evening watch', icon: 'sun', media: 'tv', genres: ['комедия', 'мелодрама', 'драма'], voteGte: 200, minVotes: 300, catalogPriority: 10 }),

  // ── Мультсериалы ─────────────────────────────────────────────────
  base({ id: 'best-animated-series', group: 'animated-series', title: 'Лучшие мультсериалы', titleEn: 'Best animated series', shortTitle: 'Лучшие', shortTitleEn: 'Best', desc: 'Анимация для всех', descEn: 'Animation for everyone', icon: 'toon', media: 'tv', contentType: 'western-animation', voteGte: 150, minVotes: 250, catalogPriority: 1 }),
  base({ id: 'adult-animated-series', group: 'animated-series', title: 'Мультсериалы для взрослых', titleEn: 'Adult animated series', shortTitle: 'Для взрослых', shortTitleEn: 'Adult', desc: 'Сатира и чёрный юмор', descEn: 'Satire and dark humor', icon: 'smile', media: 'tv', contentType: 'western-animation', genres: ['комедия'], excludeGenres: ['семейный'], keywords: ['adult animation', 'satire'], voteGte: 100, minVotes: 200, catalogPriority: 2 }),
  base({ id: 'family-animated-series', group: 'animated-series', title: 'Семейные мультсериалы', titleEn: 'Family animated series', shortTitle: 'Семейные', shortTitleEn: 'Family', desc: 'Для всей семьи', descEn: 'For the whole family', icon: 'family', media: 'tv', contentType: 'western-animation', genres: ['семейный', 'мультфильм', 'комедия'], voteGte: 100, minVotes: 200, catalogPriority: 3 }),
  base({ id: 'comedy-animated-series', group: 'animated-series', title: 'Комедийные мультсериалы', titleEn: 'Comedy animated series', shortTitle: 'Комедии', shortTitleEn: 'Comedy', desc: 'Посмеяться', descEn: 'For a laugh', icon: 'smile', media: 'tv', contentType: 'western-animation', genres: ['комедия', 'мультфильм'], voteGte: 100, minVotes: 200, catalogPriority: 4 }),
  base({ id: 'adventure-animated-series', group: 'animated-series', title: 'Приключенческие мультсериалы', titleEn: 'Adventure animated series', shortTitle: 'Приключения', shortTitleEn: 'Adventure', desc: 'Большие приключения', descEn: 'Big adventures', icon: 'compass', media: 'tv', contentType: 'western-animation', genres: ['приключения', 'мультфильм'], voteGte: 100, minVotes: 200, catalogPriority: 5 }),
  base({ id: 'scifi-animated-series', group: 'animated-series', title: 'Фантастические мультсериалы', titleEn: 'Sci-fi animated series', shortTitle: 'Фантастика', shortTitleEn: 'Sci-Fi', desc: 'Будущее и иные миры', descEn: 'Other worlds', icon: 'rocket', media: 'tv', contentType: 'western-animation', genres: ['фантастика', 'мультфильм'], voteGte: 80, minVotes: 150, catalogPriority: 6 }),
  base({ id: 'superhero-animated-series', group: 'animated-series', title: 'Супергеройские мультсериалы', titleEn: 'Superhero animated series', shortTitle: 'Супергерои', shortTitleEn: 'Superheroes', desc: 'Герои и команды', descEn: 'Heroes and teams', icon: 'bolt', media: 'tv', contentType: 'western-animation', genres: ['боевик', 'мультфильм'], keywords: ['superhero'], voteGte: 80, minVotes: 150, catalogPriority: 7 }),
  base({ id: 'nostalgic-animated-series', group: 'animated-series', title: 'Ностальгические мультсериалы', titleEn: 'Nostalgic animated series', shortTitle: 'Ностальгия', shortTitleEn: 'Nostalgia', desc: 'Классика детства', descEn: 'Childhood classics', icon: 'scroll', media: 'tv', contentType: 'western-animation', dateTo: '2012-12-31', voteGte: 150, minVotes: 250, catalogPriority: 8 }),
  base({ id: 'like-gravity-falls', group: 'animated-series', title: 'Мультсериалы как «Гравити Фолз»', titleEn: 'Animated series like “Gravity Falls”', shortTitle: 'Как Гравити Фолз', shortTitleEn: 'Like Gravity Falls', desc: 'Тайны, юмор, приключения', descEn: 'Mystery, humor, adventure', icon: 'compass', media: 'tv', contentType: 'western-animation', genres: ['приключения', 'комедия', 'мультфильм'], keywords: ['mystery', 'small town', 'supernatural'], voteGte: 80, minVotes: 150, sort: 'popularity', catalogPriority: 9 }),
  base({ id: 'like-rick-and-morty', group: 'animated-series', title: 'Мультсериалы как «Рик и Морти»', titleEn: 'Animated series like “Rick and Morty”', shortTitle: 'Как Рик и Морти', shortTitleEn: 'Like Rick and Morty', desc: 'Научная сатира', descEn: 'Sci-fi satire', icon: 'rocket', media: 'tv', contentType: 'western-animation', genres: ['комедия', 'фантастика', 'мультфильм'], keywords: ['sci-fi comedy', 'multiverse'], voteGte: 80, minVotes: 150, sort: 'popularity', catalogPriority: 10 }),

  // ── Аниме ────────────────────────────────────────────────────────
  base({ id: 'anime', group: 'anime', title: 'Лучшие аниме', titleEn: 'Best anime', shortTitle: 'Лучшие аниме', shortTitleEn: 'Best anime', desc: 'Японская анимация', descEn: 'Japanese animation', icon: 'toon', media: 'tv', contentType: 'anime', country: 'JP', voteGte: 100, minVotes: 200, catalogPriority: 1 }),
  base({ id: 'anime-shonen', group: 'anime', title: 'Аниме как «Наруто»', titleEn: 'Anime like “Naruto”', shortTitle: 'Как Наруто', shortTitleEn: 'Like Naruto', desc: 'Сёнэн и приключения', descEn: 'Shonen and adventure', icon: 'bolt', media: 'tv', contentType: 'anime', country: 'JP', genres: ['мультфильм', 'боевик', 'приключения'], keywords: ['anime', 'based on manga'], voteGte: 60, sort: 'popularity', catalogPriority: 2 }),
  base({ id: 'anime-shonen-pure', group: 'anime', title: 'Сёнэн-аниме', titleEn: 'Shonen anime', shortTitle: 'Сёнэн', shortTitleEn: 'Shonen', desc: 'Экшен и развитие героя', descEn: 'Action and hero growth', icon: 'bolt', media: 'tv', contentType: 'anime', country: 'JP', genres: ['мультфильм', 'боевик', 'приключения'], keywords: ['shonen', 'martial arts'], voteGte: 60, catalogPriority: 3 }),
  base({ id: 'anime-isekai', group: 'anime', title: 'Исекай-аниме', titleEn: 'Isekai anime', shortTitle: 'Исекай', shortTitleEn: 'Isekai', desc: 'Другой мир', descEn: 'Another world', icon: 'wand', media: 'tv', contentType: 'anime', country: 'JP', genres: ['фэнтези', 'приключения', 'мультфильм'], keywords: ['isekai', 'another world'], voteGte: 40, catalogPriority: 4 }),
  base({ id: 'anime-romance', group: 'anime', title: 'Романтическое аниме', titleEn: 'Romance anime', shortTitle: 'Романтика', shortTitleEn: 'Romance', desc: 'Чувства и отношения', descEn: 'Feelings and relationships', icon: 'heart', media: 'tv', contentType: 'anime', country: 'JP', genres: ['мелодрама', 'драма', 'мультфильм'], keywords: ['romance', 'slice of life'], voteGte: 40, catalogPriority: 5 }),
  base({ id: 'anime-dark', group: 'anime', title: 'Мрачное аниме', titleEn: 'Dark anime', shortTitle: 'Мрачное', shortTitleEn: 'Dark', desc: 'Психологическое и тёмное', descEn: 'Psychological and dark', icon: 'moon', media: 'tv', contentType: 'anime', country: 'JP', genres: ['триллер', 'ужасы', 'драма'], keywords: ['psychological', 'dark fantasy'], voteGte: 40, catalogPriority: 6 }),
  base({ id: 'anime-seinen', group: 'anime', title: 'Сэйнэн-аниме', titleEn: 'Seinen anime', shortTitle: 'Сэйнэн', shortTitleEn: 'Seinen', desc: 'Взрослые истории', descEn: 'Mature stories', icon: 'masks', media: 'tv', contentType: 'anime', country: 'JP', genres: ['драма', 'криминал', 'триллер'], keywords: ['seinen'], voteGte: 40, catalogPriority: 7 }),
  base({ id: 'anime-sports', group: 'anime', title: 'Спортивное аниме', titleEn: 'Sports anime', shortTitle: 'Спорт', shortTitleEn: 'Sports', desc: 'Соревнования и характер', descEn: 'Competition and character', icon: 'ball', media: 'tv', contentType: 'anime', country: 'JP', genres: ['драма', 'мультфильм'], keywords: ['sport', 'tournament'], voteGte: 40, catalogPriority: 8 }),
  base({ id: 'anime-fantasy', group: 'anime', title: 'Фэнтези-аниме', titleEn: 'Fantasy anime', shortTitle: 'Фэнтези', shortTitleEn: 'Fantasy', desc: 'Магия и миры', descEn: 'Magic and worlds', icon: 'wand', media: 'tv', contentType: 'anime', country: 'JP', genres: ['фэнтези', 'приключения'], voteGte: 40, catalogPriority: 9 }),
  base({ id: 'anime-school', group: 'anime', title: 'Аниме про школу', titleEn: 'School anime', shortTitle: 'Школа', shortTitleEn: 'School', desc: 'Школьные истории', descEn: 'School stories', icon: 'grad', media: 'tv', contentType: 'anime', country: 'JP', keywords: ['high school', 'school'], voteGte: 40, catalogPriority: 10 }),
  base({ id: 'anime-classic', group: 'anime', title: 'Классика аниме', titleEn: 'Classic anime', shortTitle: 'Классика', shortTitleEn: 'Classics', desc: 'Проверенные хиты', descEn: 'Timeless hits', icon: 'scroll', media: 'tv', contentType: 'anime', country: 'JP', dateTo: '2010-12-31', voteGte: 150, minVotes: 250, catalogPriority: 11 }),
  base({ id: 'anime-strong-hero', group: 'anime', title: 'Аниме с сильным главным героем', titleEn: 'Anime with a strong hero', shortTitle: 'Сильный герой', shortTitleEn: 'Strong hero', desc: 'Развитие и сила', descEn: 'Growth and power', icon: 'bolt', media: 'tv', contentType: 'anime', country: 'JP', genres: ['боевик', 'приключения'], keywords: ['super power', 'hero'], voteGte: 40, catalogPriority: 12 }),

  // ── Темы (дублируют часть фильмов, но в отдельной секции каталога) ─
  base({ id: 'theme-space', group: 'themes', title: 'Фильмы про космос', titleEn: 'Movies about space', shortTitle: 'Космос', shortTitleEn: 'Space', desc: 'Звёзды и галактики', descEn: 'Stars and galaxies', icon: 'rocket', keywords: ['space', 'alien'], voteGte: 300, minVotes: 400, catalogPriority: 6 }),
  base({ id: 'theme-heist', group: 'themes', title: 'Фильмы про ограбления', titleEn: 'Heist movies', shortTitle: 'Ограбления', shortTitleEn: 'Heists', desc: 'Планы и риск', descEn: 'Plans and risk', icon: 'cuffs', keywords: ['heist', 'robbery'], voteGte: 250, minVotes: 350, catalogPriority: 7 }),
  base({ id: 'theme-maniac', group: 'themes', title: 'Фильмы про маньяков', titleEn: 'Movies about serial killers', shortTitle: 'Маньяки', shortTitleEn: 'Serial killers', desc: 'Психологический ужас', descEn: 'Psychological horror', icon: 'ghost', keywords: ['serial killer', 'murder'], genres: ['триллер', 'ужасы'], voteGte: 200, minVotes: 300, catalogPriority: 8 }),
  base({ id: 'theme-friendship', group: 'themes', title: 'Фильмы про дружбу', titleEn: 'Movies about friendship', shortTitle: 'Дружба', shortTitleEn: 'Friendship', desc: 'Связь и поддержка', descEn: 'Bond and support', icon: 'family', keywords: ['friendship', 'friends'], voteGte: 200, minVotes: 300, catalogPriority: 9 }),
  base({ id: 'theme-love', group: 'themes', title: 'Фильмы про любовь', titleEn: 'Movies about love', shortTitle: 'Любовь', shortTitleEn: 'Love', desc: 'Чувства и отношения', descEn: 'Feelings and relationships', icon: 'heart', genres: ['мелодрама', 'драма'], keywords: ['love', 'romance'], voteGte: 250, minVotes: 350, catalogPriority: 10 }),

  // ── Составные страны ─────────────────────────────────────────────
  base({ id: 'country-scandinavia', group: 'countries', title: 'Скандинавское кино', titleEn: 'Scandinavian cinema', shortTitle: 'Скандинавия', shortTitleEn: 'Scandinavia', desc: 'Север Европы', descEn: 'Northern Europe', icon: 'globe', media: 'movie', countries: ['SE', 'NO', 'DK', 'FI', 'IS'], voteGte: 40, minVotes: 100, meanVote: 6.3, catalogPriority: 13 }),
  base({ id: 'country-europe', group: 'countries', title: 'Европейское кино', titleEn: 'European cinema', shortTitle: 'Европа', shortTitleEn: 'Europe', desc: 'Разные страны Европы', descEn: 'Films from across Europe', icon: 'globe', media: 'movie', countries: ['FR', 'DE', 'IT', 'ES', 'PL', 'SE', 'NO'], voteGte: 80, minVotes: 200, meanVote: 6.4, catalogPriority: 14 })
];

const GENRE_COLLECTIONS = GENRE_DEFS.map((g, i) => base({
  id: `genre-${g.key}`,
  group: 'genres',
  title: g.title,
  titleEn: g.titleEn,
  shortTitle: g.short,
  shortTitleEn: g.shortEn,
  desc: g.desc,
  descEn: g.descEn,
  icon: g.icon,
  media: 'movie',
  genres: [g.key],
  voteGte: 500,
  minVotes: 600,
  meanVote: 6.6,
  pages: 3,
  catalogPriority: i + 1
}));

const COUNTRY_COLLECTIONS = COUNTRY_DEFS.map((c, i) => base({
  id: `country-${c.code}`,
  group: 'countries',
  title: c.title,
  titleEn: c.titleEn,
  shortTitle: c.title.replace(' фильмы', '').replace(' movies', ''),
  shortTitleEn: c.titleEn.replace(' movies', ''),
  desc: 'Топ по качеству',
  descEn: 'Top by quality',
  icon: 'globe',
  media: 'movie',
  country: c.code,
  lang: c.lang,
  voteGte: c.voteGte,
  minVotes: c.minVotes,
  meanVote: c.meanVote,
  catalogPriority: i + 1
}));

const MOOD_COLLECTIONS = MOOD_DEFS.map((m) => base({
  id: m.id,
  group: 'mood',
  title: m.title,
  titleEn: m.titleEn,
  shortTitle: m.title,
  shortTitleEn: m.titleEn,
  desc: m.desc,
  descEn: m.descEn,
  icon: m.icon,
  media: 'movie',
  genres: m.genres,
  keywords: m.keywords || [],
  voteGte: 400,
  minVotes: 500,
  catalogPriority: m.catalogPriority
}));

// Темы из секции «Фильмы» также показываем в «Темы» (ссылки на те же id).
const THEME_MIRROR_IDS = ['theme-travel', 'theme-sport', 'theme-business', 'theme-school', 'theme-survival'];

/** Полный реестр готовых подборок (единый источник). */
export const READY_COLLECTIONS = [
  ...CORE_COLLECTIONS,
  ...GENRE_COLLECTIONS,
  ...MOOD_COLLECTIONS,
  ...COUNTRY_COLLECTIONS
];

for (const c of READY_COLLECTIONS) {
  const homeIdx = HOME_COLLECTION_IDS.indexOf(c.id);
  c.showOnHome = homeIdx >= 0;
  if (c.showOnHome) c.homePriority = homeIdx + 1;
}

const byId = new Map(READY_COLLECTIONS.map((c) => [c.id, c]));

export function getReadyCollection(id) {
  return byId.get(id) || null;
}

export function getAllReadyCollections() {
  return READY_COLLECTIONS.slice();
}

function isEn(lang) { return lang === 'en' || lang === 'en-US'; }
function isKk(lang) {
  const raw = String(lang || '').toLowerCase();
  return raw === 'kk' || raw === 'kz' || raw === 'kk-kz';
}
function pick(lang, ru, en, kk) {
  if (isEn(lang) && en) return en;
  if (isKk(lang) && kk) return kk;
  return ru;
}

function toUiEntry(c, lang) {
  const kk = getCollectionKkLabels(c.id);
  const title = pick(lang, c.title, c.titleEn, kk?.title || kk?.shortTitle);
  const shortTitle = pick(
    lang,
    c.shortTitle || c.title,
    c.shortTitleEn || c.titleEn,
    kk?.shortTitle || kk?.title
  );
  return {
    id: c.id,
    title,
    shortTitle,
    group: c.group,
    kind: c.group === 'genres' ? 'genre' : c.group === 'countries' ? 'country' : c.group === 'mood' ? 'mood' : 'collection',
    icon: c.icon || 'film',
    desc: pick(lang, c.desc, c.descEn, kk?.desc) || ''
  };
}

function sortByPriority(items, field) {
  return items.slice().sort((a, b) => (a[field] || 50) - (b[field] || 50));
}

/** Компактная витрина для главной: 5–7 подборок в одном ряду. */
export function getHomeCollections(lang = 'ru') {
  return HOME_COLLECTION_IDS
    .map((id) => byId.get(id))
    .filter(Boolean)
    .map((c) => toUiEntry(c, lang));
}

/** @deprecated Используйте getHomeCollections */
export function getHomeCollectionSections(lang = 'ru') {
  return [{ id: 'home', title: '', collections: getHomeCollections(lang) }];
}

/** Группы для полного каталога. */
export function getCatalogCollectionGroups(lang = 'ru') {
  const themeExtras = THEME_MIRROR_IDS.map((id) => byId.get(id)).filter(Boolean);

  return CATALOG_GROUP_ORDER.map((groupId) => {
    const meta = COLLECTION_GROUP_META[groupId] || {};
    let source = READY_COLLECTIONS.filter((c) => c.showInCatalog && c.group === groupId);
    if (groupId === 'themes') {
      source = [...source, ...themeExtras];
      const seen = new Set();
      source = source.filter((c) => { if (seen.has(c.id)) return false; seen.add(c.id); return true; });
    }
    const collections = sortByPriority(source, 'catalogPriority').map((c) => toUiEntry(c, lang));
    return {
      id: groupId,
      title: pick(lang, meta.title, meta.titleEn, getCollectionGroupKk(groupId)),
      collections
    };
  }).filter((g) => g.collections.length);
}

// Обратная совместимость: плоский индекс (legacy).
export function getFlatCatalogSections(lang = 'ru') {
  return getCatalogCollectionGroups(lang).flatMap((g) => g.collections);
}
