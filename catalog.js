/* ===================================================================
   catalog.js — каталог фильмов как отдельный слой поверх TMDB.

   Идея: каталог — это набор готовых подборок (по жанрам, «лучшее за всё
   время», новинки, сериалы, популярное, кассовое и т.д.). Подборки
   основаны не на голой популярности, а на КАЧЕСТВЕ: используется
   взвешенный (Байесовский) рейтинг, который учитывает и оценку, и
   надёжность (число голосов). Дополнительно подмешивается средняя
   оценка фильма по нашему сайту, если она есть.

   Модуль чистый: доступ к TMDB и к оценкам сайта передаётся через deps
   (tmdbFetch, tmdbPosterFromPath, getSiteRating, getGenreNameMap).
   Не зависит от server.js (нет циклических зависимостей). Результаты
   кешируются в памяти, чтобы не дёргать TMDB на каждый запрос.
   =================================================================== */

/* ── Взвешенный рейтинг (формула в духе IMDb Top-250) ───────────────
   WR = (v / (v + m)) * R + (m / (v + m)) * C
     R — средняя оценка фильма (TMDB vote_average)
     v — число голосов (vote_count)
     m — «порог доверия»: сколько голосов нужно, чтобы оценка считалась
         надёжной (чем выше — тем сильнее малопопулярные фильмы тянутся
         к среднему C и не вылетают наверх из-за 9.0 при 10 голосах)
     C — средняя оценка по всему пулу (около 6.8 у TMDB)
   Гарантия из ТЗ: 9.0 при 10 голосах не обгонит 8.5 при тысячах. */
export function weightedRating(voteAverage, voteCount, { minVotes = 300, meanVote = 6.8 } = {}) {
  const v = Number(voteCount) || 0;
  const R = Number(voteAverage) || 0;
  if (v <= 0) return 0;
  const m = minVotes;
  const C = meanVote;
  return (v / (v + m)) * R + (m / (v + m)) * C;
}

/* blendedScore — взвешенный рейтинг TMDB + (опционально) средняя оценка
   по сайту. Оценка сайта подмешивается тем сильнее, чем больше у неё
   собственных голосов, но её максимальное влияние ограничено (~35%),
   чтобы пара случайных оценок не переворачивала каталог. */
export function blendedScore(item, siteRating, opts) {
  const wr = weightedRating(item.voteAverage, item.voteCount, opts);
  if (siteRating && Number(siteRating.count) >= 2 && Number(siteRating.average) > 0) {
    const sc = Number(siteRating.count);
    const siteWeight = Math.min(sc / (sc + 12), 0.35);
    return wr * (1 - siteWeight) + Number(siteRating.average) * siteWeight;
  }
  return wr;
}

/* ── Кеш ───────────────────────────────────────────────────────────
   Каждая подборка кешируется по своему id. Жанровая карта — отдельно. */
const CACHE_TTL_MS = (Number(process.env.CATALOG_CACHE_TTL_HOURS) || 12) * 60 * 60 * 1000;
const cache = new Map(); // id → { at, data }

function getCached(id) {
  const hit = cache.get(id);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.data;
  return null;
}
function setCached(id, data) {
  cache.set(id, { at: Date.now(), data });
  return data;
}

/* ── Основные жанры каталога ───────────────────────────────────────
   key — каноническое русское имя жанра (как в TMDB ru и в данных),
   title — заголовок подборки, emo — эмодзи для пустой карточки. */
export const CATALOG_GENRES = [
  { key: 'боевик',       title: '20 лучших боевиков',                titleEn: 'Top 20 action movies',      short: 'Боевики',     shortEn: 'Action' },
  { key: 'драма',        title: '20 лучших драм',                    titleEn: 'Top 20 dramas',             short: 'Драмы',       shortEn: 'Drama' },
  { key: 'комедия',      title: '20 лучших комедий',                 titleEn: 'Top 20 comedies',           short: 'Комедии',     shortEn: 'Comedy' },
  { key: 'фантастика',   title: '20 лучших фантастических фильмов',  titleEn: 'Top 20 sci-fi movies',      short: 'Фантастика',  shortEn: 'Sci-Fi' },
  { key: 'триллер',      title: '20 лучших триллеров',               titleEn: 'Top 20 thrillers',          short: 'Триллеры',    shortEn: 'Thrillers' },
  { key: 'ужасы',        title: '20 лучших ужасов',                  titleEn: 'Top 20 horror movies',      short: 'Ужасы',       shortEn: 'Horror' },
  { key: 'криминал',     title: '20 лучших криминальных фильмов',    titleEn: 'Top 20 crime movies',       short: 'Криминал',    shortEn: 'Crime' },
  { key: 'мелодрама',    title: '20 лучших романтических фильмов',   titleEn: 'Top 20 romance movies',     short: 'Романтика',   shortEn: 'Romance' },
  { key: 'фэнтези',      title: '20 лучших фэнтези',                 titleEn: 'Top 20 fantasy movies',     short: 'Фэнтези',     shortEn: 'Fantasy' },
  { key: 'детектив',     title: '20 лучших детективов',              titleEn: 'Top 20 mystery movies',     short: 'Детективы',   shortEn: 'Mystery' },
  { key: 'приключения',  title: '20 лучших приключений',             titleEn: 'Top 20 adventure movies',   short: 'Приключения', shortEn: 'Adventure' },
  { key: 'мультфильм',   title: '20 лучших мультфильмов',            titleEn: 'Top 20 animated movies',    short: 'Мультфильмы', shortEn: 'Animation' },
  { key: 'история',      title: '20 лучших исторических фильмов',    titleEn: 'Top 20 historical movies',  short: 'Историческое',shortEn: 'History' },
  { key: 'военный',      title: '20 лучших военных фильмов',         titleEn: 'Top 20 war movies',         short: 'Военные',     shortEn: 'War' }
];

/* Подборки по настроению (используем уже существующую логику категорий из
   filmCategories.js — но для каталога достаточно сопоставить настроение с
   жанрами TMDB, чтобы получить готовые ленты). */
export const CATALOG_MOODS = [
  { id: 'mood-light',   title: 'Лёгкое и доброе',        titleEn: 'Light and feel-good', genres: ['комедия', 'мелодрама', 'семейный', 'мультфильм'] },
  { id: 'mood-tense',   title: 'Напряжённое',            titleEn: 'Tense',               genres: ['триллер', 'детектив', 'криминал'] },
  { id: 'mood-think',   title: 'Заставляет задуматься',  titleEn: 'Makes you think',     genres: ['драма', 'фантастика', 'история'] },
  { id: 'mood-epic',    title: 'Эпичное и зрелищное',    titleEn: 'Epic and spectacular',genres: ['приключения', 'фэнтези', 'боевик'] }
];

/* ── Подборки по странам ───────────────────────────────────────────
   Используем TMDB discover с with_origin_country (+ родной язык как
   уточнение). Сортировка — по КАЧЕСТВУ (взвешенный рейтинг), а не по
   голой популярности: minVotes держит малопопулярные тайтлы у среднего,
   чтобы случайная высокая оценка не вытаскивала мусор наверх.
   voteGte/minVotes подобраны под объём индустрии (для Казахстана ниже). */
export const CATALOG_COUNTRIES = [
  { code: 'KZ', lang: 'kk', title: 'Казахские фильмы',     titleEn: 'Kazakh movies',   icon: 'globe', voteGte: 5,   minVotes: 20,  meanVote: 6.0 },
  { code: 'RU', lang: 'ru', title: 'Российские фильмы',    titleEn: 'Russian movies',  icon: 'globe', voteGte: 60,  minVotes: 200, meanVote: 6.2 },
  { code: 'IN', lang: 'hi', title: 'Индийские фильмы',     titleEn: 'Indian movies',   icon: 'globe', voteGte: 60,  minVotes: 200, meanVote: 6.3 },
  { code: 'US', lang: 'en', title: 'Американские фильмы',  titleEn: 'American movies', icon: 'globe', voteGte: 300, minVotes: 800, meanVote: 6.6 },
  { code: 'KR', lang: 'ko', title: 'Корейские фильмы',     titleEn: 'Korean movies',   icon: 'globe', voteGte: 80,  minVotes: 250, meanVote: 6.5 },
  { code: 'JP', lang: 'ja', title: 'Японские фильмы',      titleEn: 'Japanese movies', icon: 'globe', voteGte: 80,  minVotes: 250, meanVote: 6.5 },
  { code: 'CN', lang: 'zh', title: 'Китайские фильмы',     titleEn: 'Chinese movies',  icon: 'globe', voteGte: 40,  minVotes: 150, meanVote: 6.3 },
  { code: 'FR', lang: 'fr', title: 'Французские фильмы',   titleEn: 'French movies',   icon: 'globe', voteGte: 80,  minVotes: 250, meanVote: 6.4 },
  { code: 'GB', lang: 'en', title: 'Британские фильмы',    titleEn: 'British movies',  icon: 'globe', voteGte: 150, minVotes: 500, meanVote: 6.6 },
  { code: 'TR', lang: 'tr', title: 'Турецкие фильмы',      titleEn: 'Turkish movies',  icon: 'globe', voteGte: 20,  minVotes: 80,  meanVote: 6.2 },
  { code: 'DE', lang: 'de', title: 'Немецкие фильмы',      titleEn: 'German movies',   icon: 'globe', voteGte: 80,  minVotes: 250, meanVote: 6.4 },
  { code: 'ES', lang: 'es', title: 'Испанские фильмы',     titleEn: 'Spanish movies',  icon: 'globe', voteGte: 80,  minVotes: 250, meanVote: 6.4 }
];

/* ── Тематические подборки (конфиг → discover) ─────────────────────
   Каждая подборка описывается декларативно: тип медиа, параметры discover
   (жанры/даты/рейтинги/страны/ключевые слова), параметры скоринга и способ
   сортировки. Это позволяет добавлять десятки подборок без нового кода.

   Поля:
     id, title, desc, icon — для UI;
     media — 'movie' | 'tv';
     genres — канонические русские имена жанров (→ with_genres, OR);
     excludeGenres — жанры в without_genres;
     keywords — англоязычные термины (резолвятся в with_keywords);
     lang — with_original_language;
     country — with_origin_country;
     dateFrom/dateTo — окно релиза (primary_release_date / first_air_date);
     voteGte — vote_count.gte; ratingGte — vote_average.gte;
     sort — 'score' (взвешенный) | 'popularity' | 'date';
     pages, limit, minVotes, meanVote. */
export const CATALOG_COLLECTIONS = [
  { id: 'best-all-time', title: 'Лучшие фильмы за всё время', titleEn: 'Best movies of all time', desc: 'Золотой фонд кино', descEn: 'The golden age of cinema', icon: 'trophy',
    media: 'movie', voteGte: 3000, sort: 'score', minVotes: 3000, meanVote: 7.0, pages: 5, limit: 50 },
  { id: 'best-series-all-time', title: 'Лучшие сериалы', titleEn: 'Best TV series', desc: 'Главные шоу', descEn: 'The essential shows', icon: 'tv',
    media: 'tv', voteGte: 800, sort: 'score', minVotes: 800, meanVote: 6.9, pages: 4, limit: 50 },
  { id: 'new-releases', title: 'Новинки', titleEn: 'New releases', desc: 'Свежие премьеры', descEn: 'Fresh premieres', icon: 'sparkles',
    media: 'movie', recentDays: 150, voteGte: 40, sort: 'popularity', pages: 4, limit: 40 },
  { id: 'popular-now', title: 'Популярное сейчас', titleEn: 'Popular now', desc: 'У всех на слуху', descEn: 'Everyone is talking about it', icon: 'flame', special: 'trending', limit: 30 },
  { id: 'high-rating', title: 'Фильмы с высоким рейтингом', titleEn: 'Highly rated movies', desc: 'Оценка 7.5+', descEn: 'Rated 7.5+', icon: 'star',
    media: 'movie', voteGte: 2000, ratingGte: 7.5, sort: 'score', minVotes: 2000, meanVote: 7.2, pages: 5, limit: 50 },
  { id: 'underrated', title: 'Недооценённые фильмы', titleEn: 'Underrated movies', desc: 'Хорошие, но незаметные', descEn: 'Great but overlooked', icon: 'gem',
    media: 'movie', voteGte: 150, voteLte: 1800, ratingGte: 7.3, sort: 'score', minVotes: 250, meanVote: 6.8, pages: 5, limit: 40 },
  { id: 'anime', title: 'Лучшие аниме', titleEn: 'Best anime', desc: 'Японская анимация', descEn: 'Japanese animation', icon: 'toon',
    media: 'tv', genres: ['мультфильм'], lang: 'ja', voteGte: 100, sort: 'score', minVotes: 200, meanVote: 6.8, pages: 4, limit: 50 },
  { id: 'anime-shonen', title: 'Аниме как «Наруто»', titleEn: 'Anime like “Naruto”', desc: 'Сёнэн и приключения', descEn: 'Shonen and adventure', icon: 'bolt',
    media: 'tv', genres: ['мультфильм', 'боевик', 'приключения'], lang: 'ja', keywords: ['anime', 'based on manga'], voteGte: 60, sort: 'popularity', pages: 4, limit: 40 },
  { id: 'family', title: 'Семейные фильмы', titleEn: 'Family movies', desc: 'Для всей семьи', descEn: 'For the whole family', icon: 'family',
    media: 'movie', genres: ['семейный', 'мультфильм'], voteGte: 400, sort: 'score', minVotes: 500, meanVote: 6.6, pages: 4, limit: 40 },
  { id: 'feel-evening', title: 'Фильмы на вечер', titleEn: 'Movies for the evening', desc: 'Идеально под настроение', descEn: 'Perfect for the mood', icon: 'sun',
    media: 'movie', genres: ['комедия', 'мелодрама', 'приключения'], voteGte: 600, sort: 'score', minVotes: 700, meanVote: 6.6, pages: 4, limit: 40 },
  { id: 'feel-dark', title: 'Мрачные фильмы', titleEn: 'Dark movies', desc: 'Тяжёлая атмосфера', descEn: 'Heavy atmosphere', icon: 'moon',
    media: 'movie', genres: ['триллер', 'ужасы', 'криминал', 'драма'], keywords: ['dark', 'neo-noir'], voteGte: 500, sort: 'score', minVotes: 600, meanVote: 6.6, pages: 4, limit: 40 },
  { id: 'twist-ending', title: 'Фильмы с неожиданной концовкой', titleEn: 'Movies with a twist ending', desc: 'Финал-перевёртыш', descEn: 'A finale that flips it all', icon: 'shuffle',
    media: 'movie', keywords: ['twist ending', 'plot twist'], voteGte: 400, sort: 'score', minVotes: 500, meanVote: 6.6, pages: 4, limit: 40 },
  { id: 'theme-travel', title: 'Фильмы про путешествия', titleEn: 'Movies about travel', desc: 'Дорога и открытия', descEn: 'The road and discovery', icon: 'plane',
    media: 'movie', keywords: ['travel', 'road trip', 'journey'], voteGte: 300, sort: 'score', minVotes: 400, meanVote: 6.4, pages: 4, limit: 40 },
  { id: 'theme-sport', title: 'Фильмы про спорт', titleEn: 'Movies about sports', desc: 'Победы и характер', descEn: 'Victories and character', icon: 'ball',
    media: 'movie', keywords: ['sport', 'boxing', 'football'], voteGte: 200, sort: 'score', minVotes: 350, meanVote: 6.4, pages: 4, limit: 40 },
  { id: 'theme-business', title: 'Фильмы про бизнес и деньги', titleEn: 'Movies about business and money', desc: 'Амбиции и капитал', descEn: 'Ambition and capital', icon: 'briefcase',
    media: 'movie', keywords: ['business', 'wall street', 'entrepreneur', 'money'], voteGte: 250, sort: 'score', minVotes: 400, meanVote: 6.5, pages: 4, limit: 40 },
  { id: 'theme-school', title: 'Фильмы про школу и университет', titleEn: 'Movies about school and college', desc: 'Юность и взросление', descEn: 'Youth and coming of age', icon: 'grad',
    media: 'movie', keywords: ['high school', 'college', 'university', 'coming of age'], voteGte: 250, sort: 'score', minVotes: 400, meanVote: 6.4, pages: 4, limit: 40 },
  { id: 'theme-survival', title: 'Фильмы про выживание', titleEn: 'Movies about survival', desc: 'На грани', descEn: 'On the edge', icon: 'tent',
    media: 'movie', keywords: ['survival'], genres: ['боевик', 'триллер', 'приключения'], voteGte: 300, sort: 'score', minVotes: 400, meanVote: 6.5, pages: 4, limit: 40 }
];

/* ── Карта жанров name → id (инвертируем getGenreNameMap) ──────────── */
async function genreNameToId(deps) {
  const cached = getCached('__genreNameToId');
  if (cached) return cached;
  const byId = await deps.getGenreNameMap(deps.tmdbFetch); // id → каноническое имя
  const byName = new Map();
  for (const [id, name] of byId) {
    if (!byName.has(name)) byName.set(name, id);
  }
  return setCached('__genreNameToId', byName);
}

/* Превращает genre_ids кандидата в русские имена жанров. */
function mapGenreIds(genreIds, idToName) {
  return (genreIds || []).map((id) => idToName.get(id)).filter(Boolean);
}

async function genreIdToName(deps) {
  return deps.getGenreNameMap(deps.tmdbFetch);
}

/* ── Маппинг сырого результата TMDB в карточку каталога ───────────── */
function mapItem(deps, raw, mediaType, idToName) {
  const releaseDate = raw.release_date || raw.first_air_date || null;
  const title = raw.title || raw.name || '';
  const item = {
    tmdbId: raw.id,
    title,
    originalTitle: raw.original_title || raw.original_name || null,
    mediaType,
    type: mediaType === 'tv' ? 'series' : 'movie',
    poster: deps.tmdbPosterFromPath(raw.poster_path, 'w342'),
    year: releaseDate ? Number(releaseDate.slice(0, 4)) || null : null,
    releaseDate,
    overview: raw.overview || '',
    genres: mapGenreIds(raw.genre_ids, idToName),
    voteAverage: raw.vote_average || 0,
    voteCount: raw.vote_count || 0,
    popularity: raw.popularity || 0
  };
  return item;
}

/* finalizeItems — считает взвешенный/смешанный балл, сортирует, режет до
   limit. Удаляет дубли по tmdbId. Добавляет siteRating в карточку. */
function finalizeItems(deps, items, { limit = 20, scoreOpts = {}, sortBy = 'score' } = {}) {
  const seen = new Set();
  const scored = [];
  for (const it of items) {
    if (!it.tmdbId || !it.poster || !it.title) continue;
    const key = `${it.mediaType}:${it.tmdbId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const siteRating = deps.getSiteRating
      ? deps.getSiteRating({ tmdbId: it.tmdbId, mediaType: it.mediaType, title: it.title })
      : null;
    it.siteRating = siteRating || null;
    it.weightedScore = Number(blendedScore(it, siteRating, scoreOpts).toFixed(3));
    scored.push(it);
  }
  if (sortBy === 'popularity') scored.sort((a, b) => b.popularity - a.popularity);
  else scored.sort((a, b) => b.weightedScore - a.weightedScore);
  return scored.slice(0, limit);
}

/* fetchDiscoverPages — тянет несколько страниц /discover и собирает сырые
   результаты. Не падает, если TMDB недоступен (возвращает что есть). */
async function fetchDiscoverPages(deps, type, params, pages = 2) {
  const out = [];
  for (let page = 1; page <= pages; page += 1) {
    const data = await deps.tmdbFetch(`/discover/${type}`, { ...params, page: String(page) });
    const results = data?.results || [];
    out.push(...results);
    if (!results.length) break;
  }
  return out;
}

/* ===================================================================
   ПОДБОРКИ
   =================================================================== */

/* Подборка по жанру (фильмы). Берём фильмы с нормальным числом голосов
   (vote_count.gte), затем пересортировываем по взвешенному баллу. */
async function buildGenreCollection(deps, genreKey, limit = 20) {
  const idToName = await genreIdToName(deps);
  const nameToId = await genreNameToId(deps);
  const genreId = nameToId.get(genreKey);
  if (!genreId) return [];
  const raw = await fetchDiscoverPages(deps, 'movie', {
    sort_by: 'vote_count.desc',
    include_adult: 'false',
    'vote_count.gte': '500',
    with_genres: String(genreId)
  }, 3);
  const items = raw.map((r) => mapItem(deps, r, 'movie', idToName));
  return finalizeItems(deps, items, { limit, scoreOpts: { minVotes: 600, meanVote: 6.6 } });
}

/* Лучшие сериалы. */
async function buildTopSeries(deps, limit = 20) {
  const idToName = await genreIdToName(deps);
  const raw = await fetchDiscoverPages(deps, 'tv', {
    sort_by: 'vote_count.desc',
    include_adult: 'false',
    'vote_count.gte': '300'
  }, 3);
  const items = raw.map((r) => mapItem(deps, r, 'tv', idToName));
  return finalizeItems(deps, items, { limit, scoreOpts: { minVotes: 400, meanVote: 6.8 } });
}

/* Лучшие фильмы последних лет (последние 3 года). */
async function buildBestRecent(deps, limit = 20) {
  const idToName = await genreIdToName(deps);
  const year = new Date().getFullYear();
  const from = `${year - 3}-01-01`;
  const raw = await fetchDiscoverPages(deps, 'movie', {
    sort_by: 'vote_count.desc',
    include_adult: 'false',
    'vote_count.gte': '300',
    'primary_release_date.gte': from
  }, 3);
  const items = raw.map((r) => mapItem(deps, r, 'movie', idToName));
  return finalizeItems(deps, items, { limit, scoreOpts: { minVotes: 400, meanVote: 6.5 } });
}

/* Самые популярные фильмы (по популярности TMDB, не по качеству). */
async function buildMostPopular(deps, limit = 20) {
  const idToName = await genreIdToName(deps);
  const data = await deps.tmdbFetch('/trending/movie/week', {});
  const items = (data?.results || []).map((r) => mapItem(deps, r, 'movie', idToName));
  return finalizeItems(deps, items, { limit, sortBy: 'popularity' });
}

/* Самые кассовые фильмы (по сборам, если данные доступны). */
async function buildHighestGrossing(deps, limit = 20) {
  const idToName = await genreIdToName(deps);
  const raw = await fetchDiscoverPages(deps, 'movie', {
    sort_by: 'revenue.desc',
    include_adult: 'false',
    'vote_count.gte': '300'
  }, 2);
  const items = raw.map((r) => mapItem(deps, r, 'movie', idToName));
  // Здесь сортировка не по баллу, а сохраняем порядок TMDB по сборам —
  // но всё равно считаем weightedScore для карточек.
  finalizeItems(deps, items, { limit: items.length });
  const seen = new Set();
  const out = [];
  for (const it of items) {
    if (!it.tmdbId || !it.poster) continue;
    const key = `${it.mediaType}:${it.tmdbId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(it);
    if (out.length >= limit) break;
  }
  return out;
}

/* Подборка по настроению (объединяем несколько жанров). */
async function buildMoodCollection(deps, mood, limit = 20) {
  const idToName = await genreIdToName(deps);
  const nameToId = await genreNameToId(deps);
  const ids = mood.genres.map((g) => nameToId.get(g)).filter(Boolean);
  if (!ids.length) return [];
  const raw = await fetchDiscoverPages(deps, 'movie', {
    sort_by: 'vote_count.desc',
    include_adult: 'false',
    'vote_count.gte': '400',
    with_genres: ids.join('|')
  }, 3);
  const items = raw.map((r) => mapItem(deps, r, 'movie', idToName));
  return finalizeItems(deps, items, { limit, scoreOpts: { minVotes: 500, meanVote: 6.6 } });
}

/* 200 лучших за всё время. filter: 'all' | 'movie' | 'tv'.
   Собираем top_rated с нескольких страниц, считаем взвешенный балл,
   сортируем и режем до 200. Малоизвестное отсекается порогом голосов. */
async function buildTop200(deps, filter = 'all') {
  const idToName = await genreIdToName(deps);
  const collect = async (type, pages, voteGte) => {
    const raw = await fetchDiscoverPages(deps, type, {
      sort_by: 'vote_count.desc',
      include_adult: 'false',
      'vote_count.gte': String(voteGte)
    }, pages);
    return raw.map((r) => mapItem(deps, r, type, idToName));
  };

  let items = [];
  if (filter === 'movie') {
    items = await collect('movie', 12, 1000);
  } else if (filter === 'tv') {
    items = await collect('tv', 12, 400);
  } else {
    const [movies, tv] = await Promise.all([
      collect('movie', 10, 1000),
      collect('tv', 6, 400)
    ]);
    items = [...movies, ...tv];
  }
  return finalizeItems(deps, items, {
    limit: 200,
    scoreOpts: { minVotes: 1500, meanVote: 6.8 }
  });
}

/* ── Резолвинг англоязычных тем в keyword id TMDB ──────────────────
   keyword-индекс TMDB англоязычный, поэтому ищем по en-US и берём
   первый релевантный id каждого термина. Результат кешируется. */
async function resolveKeywordIds(deps, queries = []) {
  const ids = [];
  for (const q of queries) {
    const cacheId = `kw:${q}`;
    let id = getCached(cacheId);
    if (id === null || id === undefined) {
      try {
        const data = await deps.tmdbFetch('/search/keyword', { query: q }, { language: 'en-US' });
        id = (data?.results || []).slice(0, 1).map((k) => k.id).filter(Boolean)[0] || 0;
      } catch { id = 0; }
      setCached(cacheId, id);
    }
    if (id) ids.push(id);
  }
  return ids;
}

/* Подборка по странам: фильмы конкретной страны/языка, отсортированные по
   качеству (взвешенный рейтинг). Берём 30–50 тайтлов. */
async function buildCountryCollection(deps, country, limit = 40) {
  const idToName = await genreIdToName(deps);
  const params = {
    sort_by: 'vote_count.desc',
    include_adult: 'false',
    'vote_count.gte': String(country.voteGte || 60),
    with_origin_country: country.code
  };
  if (country.lang) params.with_original_language = country.lang;
  const raw = await fetchDiscoverPages(deps, 'movie', params, 4);
  const items = raw.map((r) => mapItem(deps, r, 'movie', idToName));
  return finalizeItems(deps, items, {
    limit: country.limit || limit,
    scoreOpts: { minVotes: country.minVotes || 200, meanVote: country.meanVote || 6.4 }
  });
}

/* Generic-подборка по декларативному конфигу (CATALOG_COLLECTIONS). */
async function buildConfigCollection(deps, cfg) {
  if (cfg.special === 'trending') return buildMostPopular(deps, cfg.limit || 30);

  const media = cfg.media === 'tv' ? 'tv' : 'movie';
  const idToName = await genreIdToName(deps);
  const nameToId = await genreNameToId(deps);

  const params = {
    sort_by: cfg.sort === 'date'
      ? (media === 'tv' ? 'first_air_date.desc' : 'primary_release_date.desc')
      : cfg.sort === 'popularity' ? 'popularity.desc' : 'vote_count.desc',
    include_adult: 'false',
    'vote_count.gte': String(cfg.voteGte || 200)
  };
  if (cfg.voteLte) params['vote_count.lte'] = String(cfg.voteLte);
  if (cfg.ratingGte) params['vote_average.gte'] = String(cfg.ratingGte);
  if (cfg.lang) params.with_original_language = cfg.lang;
  if (cfg.country) params.with_origin_country = cfg.country;

  if (cfg.genres && cfg.genres.length) {
    const ids = cfg.genres.map((g) => nameToId.get(g)).filter(Boolean);
    if (ids.length) params.with_genres = ids.join('|');
  }
  if (cfg.excludeGenres && cfg.excludeGenres.length) {
    const ids = cfg.excludeGenres.map((g) => nameToId.get(g)).filter(Boolean);
    if (ids.length) params.without_genres = ids.join(',');
  }
  if (cfg.keywords && cfg.keywords.length) {
    const kwIds = await resolveKeywordIds(deps, cfg.keywords);
    if (kwIds.length) params.with_keywords = kwIds.join('|');
  }
  if (cfg.recentDays) {
    const from = new Date(Date.now() - cfg.recentDays * 86400000).toISOString().slice(0, 10);
    const today = new Date().toISOString().slice(0, 10);
    if (media === 'tv') { params['first_air_date.gte'] = from; params['first_air_date.lte'] = today; }
    else { params['primary_release_date.gte'] = from; params['primary_release_date.lte'] = today; }
  }

  const raw = await fetchDiscoverPages(deps, media, params, cfg.pages || 4);
  const items = raw.map((r) => mapItem(deps, r, media, idToName));
  return finalizeItems(deps, items, {
    limit: cfg.limit || 40,
    scoreOpts: { minVotes: cfg.minVotes || 400, meanVote: cfg.meanVote || 6.6 },
    sortBy: cfg.sort === 'popularity' || cfg.sort === 'date' ? 'popularity' : 'score'
  });
}

/* ── Реестр подборок (id → builder) ───────────────────────────────── */
function builderFor(id) {
  if (id === 'top-series') return (deps) => buildTopSeries(deps);
  if (id === 'best-recent') return (deps) => buildBestRecent(deps);
  if (id === 'most-popular') return (deps) => buildMostPopular(deps);
  if (id === 'highest-grossing') return (deps) => buildHighestGrossing(deps);

  const cfg = CATALOG_COLLECTIONS.find((c) => c.id === id);
  if (cfg) return (deps) => buildConfigCollection(deps, cfg);

  const country = CATALOG_COUNTRIES.find((c) => `country-${c.code}` === id);
  if (country) return (deps) => buildCountryCollection(deps, country);

  const genre = CATALOG_GENRES.find((g) => `genre-${g.key}` === id);
  if (genre) return (deps) => buildGenreCollection(deps, genre.key);

  const mood = CATALOG_MOODS.find((m) => m.id === id);
  if (mood) return (deps) => buildMoodCollection(deps, mood);

  return null;
}

/* ── Метаданные подборок (иконка + короткое описание) для UI ────────
   desc — русское описание, descEn — английское (для полной локализации). */
const SPECIAL_META = {
  'most-popular':     { icon: 'flame',     desc: 'Сейчас на слуху',  descEn: 'Trending right now' },
  'best-recent':      { icon: 'star',      desc: 'Высокие оценки',   descEn: 'Highly rated' },
  'highest-grossing': { icon: 'cash',      desc: 'Хиты проката',     descEn: 'Box-office hits' },
  'top-series':       { icon: 'tv',        desc: 'Лучшие шоу',       descEn: 'The best shows' }
};
const MOOD_META = {
  'mood-light': { icon: 'sun',       desc: 'Без напряжения',     descEn: 'Easy watching' },
  'mood-tense': { icon: 'bolt',      desc: 'Триллеры и интрига', descEn: 'Thrillers and intrigue' },
  'mood-think': { icon: 'bulb',      desc: 'Глубокие сюжеты',    descEn: 'Deep stories' },
  'mood-epic':  { icon: 'mountains', desc: 'Зрелищное кино',     descEn: 'Spectacular cinema' }
};
const GENRE_META = {
  'боевик':      { icon: 'bolt',    desc: 'Экшен и динамика',         descEn: 'Action and momentum' },
  'драма':       { icon: 'masks',   desc: 'Сильные истории',          descEn: 'Powerful stories' },
  'комедия':     { icon: 'smile',   desc: 'Посмеяться',               descEn: 'For a laugh' },
  'фантастика':  { icon: 'rocket',  desc: 'Будущее и иные миры',      descEn: 'The future and other worlds' },
  'триллер':     { icon: 'eye',     desc: 'Держит в напряжении',      descEn: 'Keeps you on edge' },
  'ужасы':       { icon: 'ghost',   desc: 'Страшно по-настоящему',    descEn: 'Genuinely scary' },
  'криминал':    { icon: 'cuffs',   desc: 'Преступления и нуар',      descEn: 'Crime and noir' },
  'мелодрама':   { icon: 'heart',   desc: 'О любви',                  descEn: 'About love' },
  'фэнтези':     { icon: 'wand',    desc: 'Магия и приключения',      descEn: 'Magic and adventure' },
  'детектив':    { icon: 'search',  desc: 'Загадки и расследования',  descEn: 'Mysteries and investigations' },
  'приключения': { icon: 'compass', desc: 'Большие приключения',      descEn: 'Big adventures' },
  'мультфильм':  { icon: 'toon',    desc: 'Анимация для всех',        descEn: 'Animation for everyone' },
  'история':     { icon: 'scroll',  desc: 'Основано на истории',      descEn: 'Based on history' },
  'военный':     { icon: 'shield',  desc: 'О войне и людях',          descEn: 'About war and people' }
};

// Выбор языка: en при английском, иначе русский (с фолбэком на ru).
function isEn(lang) { return lang === 'en' || lang === 'en-US'; }
function pick(lang, ru, en) { return isEn(lang) && en ? en : ru; }

function genreSection(g, lang) {
  const meta = GENRE_META[g.key] || {};
  return {
    id: `genre-${g.key}`,
    title: pick(lang, g.title, g.titleEn),
    shortTitle: pick(lang, g.short, g.shortEn),
    kind: 'genre',
    icon: meta.icon || 'film',
    desc: pick(lang, meta.desc, meta.descEn) || pick(lang, 'Лучшее в жанре', 'Best in the genre')
  };
}
function moodSection(m, lang) {
  const meta = MOOD_META[m.id] || {};
  const title = pick(lang, m.title, m.titleEn);
  return { id: m.id, title, shortTitle: title, kind: 'mood', icon: meta.icon || 'film', desc: pick(lang, meta.desc, meta.descEn) || '' };
}
function specialSection(id, title, titleEn, lang) {
  const meta = SPECIAL_META[id] || {};
  const t = pick(lang, title, titleEn);
  return { id, title: t, shortTitle: t, kind: 'special', icon: meta.icon || 'film', desc: pick(lang, meta.desc, meta.descEn) || '' };
}
function collectionSection(c, lang) {
  const title = pick(lang, c.title, c.titleEn);
  return { id: c.id, title, shortTitle: title, kind: 'collection', icon: c.icon || 'film', desc: pick(lang, c.desc, c.descEn) || '' };
}
function countrySection(c, lang) {
  const title = pick(lang, c.title, c.titleEn);
  return { id: `country-${c.code}`, title, shortTitle: title, kind: 'country', icon: c.icon || 'globe', desc: pick(lang, 'Топ по качеству', 'Top by quality') };
}

/* getCatalogIndex — лёгкий список подборок (без обращения к TMDB).
   Фронтенд по нему рисует пустые ленты и подгружает каждую отдельно. */
export function getCatalogIndex(lang = 'ru') {
  const sections = [];

  sections.push(specialSection('most-popular', '20 самых популярных', 'Top 20 most popular', lang));
  sections.push(specialSection('best-recent', '20 лучших за последние годы', 'Top 20 of recent years', lang));
  sections.push(specialSection('highest-grossing', '20 самых кассовых', 'Top 20 highest-grossing', lang));
  sections.push(specialSection('top-series', '20 лучших сериалов', 'Top 20 TV series', lang));

  CATALOG_COLLECTIONS.forEach((c) => sections.push(collectionSection(c, lang)));
  CATALOG_MOODS.forEach((m) => sections.push(moodSection(m, lang)));
  CATALOG_GENRES.forEach((g) => sections.push(genreSection(g, lang)));
  CATALOG_COUNTRIES.forEach((c) => sections.push(countrySection(c, lang)));

  return { sections, hasTop200: true };
}

/* getHomeRails — курируемый, упорядоченный список лент для ГЛАВНОЙ.
   Фронтенд рисует их как визуальные горизонтальные ленты и лениво
   подгружает фильмы каждой через /api/catalog/collection/:id. */
export function getHomeRails(lang = 'ru') {
  const find = (id) => CATALOG_COLLECTIONS.find((c) => c.id === id);
  const rails = [];

  // Топы «лучшее за всё время» и «высокий рейтинг» намеренно НЕ дублируем —
  // они уже есть в каталоге (раздел «Топ»). На главной оставляем то, что
  // каталог крупно не выносит: новинки, недооценённые, аниме, жанры и т.д.
  rails.push(specialSection('most-popular', 'Популярное сейчас', 'Popular now', lang));
  if (find('new-releases')) rails.push(collectionSection(find('new-releases'), lang));
  rails.push(specialSection('top-series', 'Лучшие сериалы', 'Best TV series', lang));
  if (find('underrated')) rails.push(collectionSection(find('underrated'), lang));
  if (find('anime')) rails.push(collectionSection(find('anime'), lang));
  if (find('anime-shonen')) rails.push(collectionSection(find('anime-shonen'), lang));

  // Жанровые ленты
  ['боевик', 'драма', 'комедия', 'триллер', 'фантастика', 'ужасы', 'мелодрама', 'детектив']
    .forEach((key) => {
      const g = CATALOG_GENRES.find((x) => x.key === key);
      if (g) rails.push(genreSection(g, lang));
    });

  // Страны
  CATALOG_COUNTRIES.forEach((c) => rails.push(countrySection(c, lang)));

  // Тематические в конце
  ['family', 'feel-evening', 'feel-dark', 'twist-ending', 'theme-travel', 'theme-sport', 'theme-business', 'theme-school', 'theme-survival']
    .forEach((id) => { const c = find(id); if (c) rails.push(collectionSection(c, lang)); });

  return { rails };
}

/* Коалесинг параллельных сборок: пока одна и та же подборка собирается из
   TMDB, повторные запросы (например, лента на главной + та же в каталоге, или
   ретраи фронтенда на «холодном» кеше) переиспользуют один и тот же промис,
   а не запускают тяжёлую сборку второй раз. */
const inflight = new Map();
function coalesce(key, build) {
  if (inflight.has(key)) return inflight.get(key);
  const promise = (async () => build())()
    .finally(() => { inflight.delete(key); });
  inflight.set(key, promise);
  return promise;
}

/* getCatalogCollection — items одной подборки (с кешем по языку).
   Кеш зависит от языка: названия/описания фильмов из TMDB локализованы. */
export async function getCatalogCollection(deps, id, lang = 'ru') {
  const cacheId = `col:${normLang(lang)}:${id}`;
  const cached = getCached(cacheId);
  if (cached) return cached;
  const builder = builderFor(id);
  if (!builder) return null;
  return coalesce(cacheId, async () => {
    const fresh = getCached(cacheId);
    if (fresh) return fresh;
    const items = await builder(deps);
    return setCached(cacheId, items);
  });
}

/* getCatalogTop200 — 200 лучших с фильтром (с кешем по фильтру и языку). */
export async function getCatalogTop200(deps, filter = 'all', lang = 'ru') {
  const f = ['movie', 'tv', 'all'].includes(filter) ? filter : 'all';
  const cacheId = `top200:${normLang(lang)}:${f}`;
  const cached = getCached(cacheId);
  if (cached) return cached;
  return coalesce(cacheId, async () => {
    const fresh = getCached(cacheId);
    if (fresh) return fresh;
    const items = await buildTop200(deps, f);
    return setCached(cacheId, items);
  });
}

function normLang(lang) { return (lang === 'en' || lang === 'en-US') ? 'en' : 'ru'; }
