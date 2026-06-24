/* ===================================================================
   recommendationEngine.js — локальный быстрый recommender.

   Идея: вместо того, чтобы каждый раз просить OpenAI «придумать»
   названия фильмов, мы:
     1) собираем профиль вкуса пользователя из реальных данных
        (просмотренное, оценки, заметки, теги, битвы, watchlist, тесты);
     2) берём РЕАЛЬНЫХ кандидатов из TMDB (discover/similar/trending);
     3) сами их оцениваем (scoreMovieForUser) и сортируем;
     4) формируем человекопонятные причины без GPT.

   OpenAI остаётся опциональным слоем (rerank/красивые объяснения),
   подключается в server.js, а не здесь. Этот модуль не импортирует
   server.js (во избежание циклических зависимостей): доступ к TMDB
   передаётся через deps (tmdbFetch, tmdbPosterFromPath).

   Совместимость: recommendForUser() возвращает объекты с теми же
   полями, что ждёт фронтенд (title, mediaType, reason, whyDetailed,
   poster, year, overview, tmdbId, genres, releaseDate ...).
   =================================================================== */

import { PSYCH_PROFILES } from './psychTestLogic.js';
import { matchesBlacklist } from './prefs.js';
import { pickRandomTitles } from './moviePool.js';
import { normalizeWatchTitle } from './watchNow.js';

const DEBUG = String(process.env.RECOMMENDER_DEBUG || '').toLowerCase() === 'true';
const GENRE_CACHE_TTL_MS =
  (Number(process.env.RECOMMENDER_CATALOG_CACHE_TTL_HOURS) || 24) * 60 * 60 * 1000;

function debugLog(...args) {
  if (DEBUG) console.log('[recommender]', ...args);
}

/* ── Канонизация жанров ───────────────────────────────────────────
   В данных пользователя жанры хранятся русскими названиями (TMDB ru-RU).
   Кандидаты из TMDB приходят с genre_ids, которые мы превращаем в те же
   русские названия через загруженную карту жанров. Синонимы из тестовых
   профилей («романтика», «экшен», «биография») приводим к названиям TMDB. */
const GENRE_SYNONYMS = {
  'романтика': 'мелодрама',
  'романтический': 'мелодрама',
  'романтическая драма': 'мелодрама',
  'экшен': 'боевик',
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

export function canonicalGenre(name) {
  const key = String(name || '').toLowerCase().replace(/ё/g, 'е').trim();
  return GENRE_SYNONYMS[key] || key;
}

/* ── Карта жанров TMDB (id → русское имя), кешируется ────────────── */
let genreMapCache = { at: 0, byId: new Map() };

async function loadTmdbGenreMap(tmdbFetch) {
  if (genreMapCache.byId.size && Date.now() - genreMapCache.at < GENRE_CACHE_TTL_MS) {
    return genreMapCache.byId;
  }
  const byId = new Map();
  try {
    for (const path of ['/genre/movie/list', '/genre/tv/list']) {
      const data = await tmdbFetch(path, {});
      (data?.genres || []).forEach((g) => {
        if (g?.id && g?.name) byId.set(g.id, canonicalGenre(g.name));
      });
    }
  } catch (e) {
    debugLog('genre map fetch failed', e?.message);
  }
  if (byId.size) genreMapCache = { at: Date.now(), byId };
  return genreMapCache.byId.size ? genreMapCache.byId : byId;
}

/* getGenreNameMap — публичная обёртка над картой жанров TMDB (id → имя).
   Нужна server.js, чтобы превращать genre_ids кандидатов в русские имена
   при локальных подборках по жанру (без OpenAI). */
export async function getGenreNameMap(tmdbFetch) {
  return loadTmdbGenreMap(tmdbFetch);
}

function mapGenreIds(genreIds, genreMap) {
  return (genreIds || [])
    .map((id) => genreMap.get(id))
    .filter(Boolean);
}

/* ── Веса сигналов вкуса ──────────────────────────────────────────
   Чем выше оценка/победы в битвах/«понравилось» — тем сильнее жанры
   фильма влияют на профиль. Отрицательные оценки и «не понравилось»
   тянут жанр вниз. */
function ratingWeight(rating) {
  if (!rating && rating !== 0) return 0.4; // просто просмотрено — слабый плюс
  if (rating >= 9) return 3;
  if (rating >= 8) return 2.4;
  if (rating === 7) return 1.2;
  if (rating === 6) return 0.6;
  if (rating === 5) return 0;
  if (rating === 4) return -0.9;
  return -1.6; // 1-3
}

function statusWeight(status) {
  if (status === 'watched') return 0; // оценка считается отдельно
  if (status === 'want') return 0.5;
  if (status === 'watching') return 0.4;
  return 0.1;
}

function addWeight(map, key, weight) {
  if (!key) return;
  map.set(key, (map.get(key) || 0) + weight);
}

function tokenizeNotes(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .split(/[^a-zа-я0-9]+/i)
    .filter((w) => w.length >= 4)
    .slice(0, 12);
}

/**
 * buildUserTasteProfile — превращает список фильмов и prefs в профиль вкуса.
 * Не падает, если каких-то полей нет (directors/cast/tags/keywords).
 */
export function buildUserTasteProfile(movies = [], prefs = {}) {
  const genreWeight = new Map();   // signed: положит. = нравится, отрицат. = нет
  const tagWeight = new Map();
  const keywordWeight = new Map();
  const likedDirectors = new Map();
  const likedActors = new Map();
  const preferredMediaTypes = new Map();

  const likedMovies = [];          // { title, tmdbId, mediaType, genres, weight, rating }
  const dislikedMovies = [];
  const battleChampions = [];      // победители «битвы фильмов» — сильный сигнал вкуса
  const watchlistTitles = [];
  const watchedTmdbIds = new Set();
  const listTitles = new Set();    // всё, что уже в списке (любой статус)

  for (const m of movies) {
    const genres = (m.genres || []).map(canonicalGenre);
    const status = m.status || 'want';
    const titleKey = normalizeWatchTitle(m.title);
    if (titleKey) listTitles.add(titleKey);
    if (m.tmdbId) watchedTmdbIds.add(`${m.mediaType || 'movie'}:${m.tmdbId}`);

    if (status === 'want') watchlistTitles.push(m.title);

    // Базовый вес фильма
    let weight = statusWeight(status);
    if (status === 'watched' || m.rating) weight += ratingWeight(m.rating);

    // Сильные сигналы из битв фильмов
    if (m.battleScore) weight += Math.max(-1.5, Math.min(2, m.battleScore / 50));
    if (m.battleWins) weight += Math.min(1.5, m.battleWins * 0.3);
    if (m.battleLosses) weight -= Math.min(1, m.battleLosses * 0.15);

    // Заметки
    const hasLiked = m.notes?.liked?.trim();
    const hasDisliked = m.notes?.disliked?.trim();
    if (hasLiked) weight += 1;
    if (hasDisliked) weight -= 1.2;

    addWeight(preferredMediaTypes, m.mediaType || 'movie', Math.max(0, weight));

    // Раскладываем вес по жанрам
    for (const g of genres) addWeight(genreWeight, g, weight);

    // Теги
    for (const t of (m.tags || [])) {
      addWeight(tagWeight, String(t).toLowerCase().trim(), weight);
    }

    // Ключевые слова из заметок (понравилось → +, не понравилось → −)
    if (hasLiked) tokenizeNotes(m.notes.liked).forEach((w) => addWeight(keywordWeight, w, 1));
    if (m.notes?.review) tokenizeNotes(m.notes.review).forEach((w) => addWeight(keywordWeight, w, 0.4));
    if (hasDisliked) tokenizeNotes(m.notes.disliked).forEach((w) => addWeight(keywordWeight, w, -1));

    // Режиссёр / актёры (если есть в meta)
    if (weight > 0.5) {
      if (m.meta?.director) addWeight(likedDirectors, m.meta.director.toLowerCase().trim(), weight);
      const castNames = m.meta?.castDetails?.map((c) => c.name)
        || String(m.meta?.cast || '').split(',').map((s) => s.trim()).filter(Boolean);
      for (const name of (castNames || []).slice(0, 5)) {
        addWeight(likedActors, name.toLowerCase().trim(), weight * 0.5);
      }
    }

    const movieRef = {
      title: m.title,
      tmdbId: m.tmdbId || null,
      mediaType: m.mediaType || 'movie',
      genres,
      weight,
      rating: m.rating || null
    };
    if (weight >= 1.2) likedMovies.push(movieRef);
    else if (weight <= -0.6) dislikedMovies.push(movieRef);

    // ── Результаты «битвы фильмов» как отдельный сигнал ──────────────
    // Победители битв — это прямой выбор пользователя «что лучше», поэтому
    // мы выделяем их в отдельный список battleChampions. Он используется
    // как сид для похожих рекомендаций и для объяснимости.
    const battleStrength =
      (m.battleScore ? clamp(m.battleScore / 50, -1.5, 2.5) : 0)
      + Math.min(2, (m.battleWins || 0) * 0.4)
      - Math.min(1.5, (m.battleLosses || 0) * 0.2);
    if (battleStrength > 0.4 && ((m.battleWins || 0) > 0 || (m.battleScore || 0) > 50)) {
      battleChampions.push({
        title: m.title,
        tmdbId: m.tmdbId || null,
        mediaType: m.mediaType || 'movie',
        genres,
        battleStrength,
        wins: m.battleWins || 0,
        score: m.battleScore || 0
      });
    }
  }

  likedMovies.sort((a, b) => b.weight - a.weight);
  dislikedMovies.sort((a, b) => a.weight - b.weight);
  battleChampions.sort((a, b) => b.battleStrength - a.battleStrength);

  const psychModifiers = buildPsychTasteModifiers(prefs);
  const feedbackBlockedTitles = collectFeedbackBlockedTitles(prefs);

  // Чёрный список (по названиям, на всякий случай)
  const blacklistTitles = new Set();
  (prefs?.blacklist?.titles || []).forEach((t) => blacklistTitles.add(normalizeWatchTitle(t)));

  return {
    likedGenres: signedToPositive(genreWeight),
    dislikedGenres: signedToNegative(genreWeight),
    genreWeight,                  // signed (для скоринга)
    likedTags: signedToPositive(tagWeight),
    dislikedTags: signedToNegative(tagWeight),
    tagWeight,
    likedKeywords: signedToPositive(keywordWeight),
    dislikedKeywords: signedToNegative(keywordWeight),
    keywordWeight,
    likedDirectors,
    likedActors,
    preferredMediaTypes,
    likedMovies,
    dislikedMovies,
    battleChampions,
    watchlistTitles,
    watchedTmdbIds,
    listTitles,
    blacklistTitles,
    feedbackBlockedTitles,
    psychModifiers,
    rawSignals: {
      maxAbsGenreWeight: maxAbs(genreWeight),
      maxAbsKeywordWeight: maxAbs(keywordWeight),
      watchedCount: movies.filter((m) => m.status === 'watched').length,
      ratedCount: movies.filter((m) => m.rating).length
    }
  };
}

function signedToPositive(map) {
  const out = {};
  for (const [k, v] of map) if (v > 0) out[k] = v;
  return out;
}
function signedToNegative(map) {
  const out = {};
  for (const [k, v] of map) if (v < 0) out[k] = -v;
  return out;
}
function maxAbs(map) {
  let max = 0;
  for (const v of map.values()) max = Math.max(max, Math.abs(v));
  return max || 1;
}

/* ── Модификаторы из тестов ───────────────────────────────────────
   Тесты не генерируют фильмы — они дают коэффициенты для скоринга.
   Тест трактуется только как стиль восприятия, без диагнозов. */
const PSYCH_GENRE_BOOST = {
  deep_observer: { boost: ['драма', 'триллер', 'фантастика', 'детектив'], penalty: ['ужасы'] },
  emotional_empath: { boost: ['драма', 'мелодрама', 'семейный', 'история'], penalty: [] },
  tension_seeker: { boost: ['триллер', 'криминал', 'боевик', 'детектив', 'фантастика'], penalty: [] },
  comfort_viewer: { boost: ['комедия', 'мелодрама', 'семейный', 'мультфильм'], penalty: ['ужасы', 'триллер'] }
};
const VISUAL_GENRE_BOOST = {
  atmospheric_observer: { boost: ['драма', 'триллер', 'фантастика', 'детектив'], penalty: ['ужасы'] },
  emotional_viewer: { boost: ['драма', 'мелодрама', 'семейный', 'история'], penalty: [] },
  intrigue_seeker: { boost: ['триллер', 'детектив', 'криминал', 'фантастика'], penalty: [] },
  visual_comfort: { boost: ['комедия', 'мелодрама', 'семейный'], penalty: ['ужасы', 'триллер'] }
};

// Поиск жанровых хинтов в свободных фразах (suits/avoid коротких тестов)
const GENRE_KEYWORDS = [
  'драма', 'триллер', 'детектив', 'комеди', 'мелодрам', 'романт', 'фантастик',
  'фэнтези', 'боевик', 'экшен', 'криминал', 'ужас', 'хоррор', 'семейн',
  'приключ', 'мультф', 'анимац', 'биограф', 'истор', 'военн', 'музык'
];
const GENRE_KEYWORD_TO_NAME = {
  'драма': 'драма', 'триллер': 'триллер', 'детектив': 'детектив', 'комеди': 'комедия',
  'мелодрам': 'мелодрама', 'романт': 'мелодрама', 'фантастик': 'фантастика',
  'фэнтези': 'фэнтези', 'боевик': 'боевик', 'экшен': 'боевик', 'криминал': 'криминал',
  'ужас': 'ужасы', 'хоррор': 'ужасы', 'семейн': 'семейный', 'приключ': 'приключения',
  'мультф': 'мультфильм', 'анимац': 'мультфильм', 'биограф': 'история', 'истор': 'история',
  'военн': 'военный', 'музык': 'музыка'
};

function genresFromPhrases(phrases = []) {
  const hits = new Set();
  const text = phrases.join(' ').toLowerCase().replace(/ё/g, 'е');
  for (const kw of GENRE_KEYWORDS) {
    if (text.includes(kw) && GENRE_KEYWORD_TO_NAME[kw]) hits.add(GENRE_KEYWORD_TO_NAME[kw]);
  }
  return [...hits];
}

function mergeModifier(target, genres, value) {
  for (const g of genres) {
    const key = canonicalGenre(g);
    // Берём наиболее выраженный множитель в нужную сторону
    if (value >= 1) target[key] = Math.max(target[key] || 1, value);
    else target[key] = Math.min(target[key] || 1, value);
  }
}

/**
 * buildPsychTasteModifiers — собирает множители скоринга из всех тестов.
 * Возвращает { boostGenres, penaltyGenres, boostKeywords, penaltyKeywords, moodHints, sources }.
 */
export function buildPsychTasteModifiers(prefs = {}) {
  const boostGenres = {};
  const penaltyGenres = {};
  const boostKeywords = {};
  const penaltyKeywords = {};
  const moodHints = [];
  const sources = [];

  // Кино-психологический тест
  const psych = prefs.psychTest;
  if (psych?.profile && PSYCH_GENRE_BOOST[psych.profile]) {
    const cfg = PSYCH_GENRE_BOOST[psych.profile];
    mergeModifier(boostGenres, cfg.boost, 1.2);
    mergeModifier(penaltyGenres, cfg.penalty, 0.85);
    (PSYCH_PROFILES[psych.profile]?.moods || []).forEach((mood) => moodHints.push(mood));
    sources.push(`psych:${psych.profile}`);
  }

  // Визуальный тест
  const visual = prefs.visualTest;
  if (visual?.profile && VISUAL_GENRE_BOOST[visual.profile]) {
    const cfg = VISUAL_GENRE_BOOST[visual.profile];
    mergeModifier(boostGenres, cfg.boost, 1.15);
    mergeModifier(penaltyGenres, cfg.penalty, 0.9);
    sources.push(`visual:${visual.profile}`);
  }

  // Короткие визуальные тесты (последние результаты)
  const shortResults = prefs.shortVisualTests?.lastResults || {};
  for (const result of Object.values(shortResults)) {
    if (!result) continue;
    const boost = genresFromPhrases(result.suits || []);
    const penalty = genresFromPhrases(result.avoid || []);
    if (boost.length) mergeModifier(boostGenres, boost, 1.12);
    if (penalty.length) mergeModifier(penaltyGenres, penalty, 0.9);
    if (result.profileTitle) sources.push(`short:${result.profileTitle}`);
  }

  // Обратная связь «не хочу такое» по причинам → лёгкие штрафы настроения
  collectFeedback(prefs).forEach((fb) => {
    if (fb.reason === 'too_dynamic') mergeModifier(penaltyGenres, ['боевик'], 0.9);
    if (fb.reason === 'too_dark') mergeModifier(penaltyGenres, ['ужасы', 'триллер'], 0.9);
    if (fb.reason === 'wrong_genre' && fb.note) {
      const g = genresFromPhrases([fb.note]);
      if (g.length) mergeModifier(penaltyGenres, g, 0.85);
    }
  });

  return { boostGenres, penaltyGenres, boostKeywords, penaltyKeywords, moodHints: [...new Set(moodHints)], sources };
}

function collectFeedback(prefs = {}) {
  return [
    ...(prefs.psychRecFeedback || []),
    ...(prefs.visualRecFeedback || []),
    ...(prefs.shortVisualRecFeedback || [])
  ];
}

function collectFeedbackBlockedTitles(prefs = {}) {
  const set = new Set();
  collectFeedback(prefs).forEach((fb) => {
    if (fb?.title) set.add(normalizeWatchTitle(fb.title));
  });
  return set;
}

/* ===================================================================
   SESSION TASTE PROFILE ДЛЯ СВАЙПОВ
   -------------------------------------------------------------------
   Временный профиль вкуса на одну сессию свайпов. Не сохраняется в
   данные пользователя: живёт только пока человек листает ленту и
   влияет ИМЕННО на текущую выдачу (даже если фильм ещё не добавлен в
   список). Свайп вправо усиливает похожие признаки, влево — понижает.
   =================================================================== */

/**
 * buildSwipeSessionProfile — нормализует «сырые» сигналы свайпов с фронтенда
 * в структуру для движка: сиды для TMDB similar/recommendations, бусты и
 * штрафы по жанрам с учётом свежести (последние свайпы весят больше).
 *
 * session: {
 *   right: [{ tmdbId, mediaType, title, genres }],  // свайпы вправо (нравится)
 *   left:  [{ tmdbId, mediaType, title, genres }],  // свайпы влево (не интересно)
 *   boostGenres: { genre: weight },                 // опц. готовые бусты с фронта
 *   penalizeGenres: { genre: weight }               // опц. готовые штрафы
 * }
 */
export function buildSwipeSessionProfile(session = {}) {
  const right = Array.isArray(session.right) ? session.right.filter(Boolean) : [];
  const left = Array.isArray(session.left) ? session.left.filter(Boolean) : [];

  const boostGenres = new Map();
  const penalizeGenres = new Map();

  // Свежесть: самый недавний свайп весит ~1, более старые — мягче (до 0.5).
  const recencyWeight = (i, total) => (total <= 1 ? 1 : 0.5 + 0.5 * ((i + 1) / total));

  right.forEach((m, i) => {
    const w = recencyWeight(i, right.length);
    for (const g of (m.genres || [])) addWeight(boostGenres, canonicalGenre(g), w);
  });
  left.forEach((m, i) => {
    const w = recencyWeight(i, left.length);
    for (const g of (m.genres || [])) addWeight(penalizeGenres, canonicalGenre(g), w);
  });

  // Явные карты с фронтенда (если есть) — складываем поверх вычисленных.
  for (const [g, w] of Object.entries(session.boostGenres || {})) {
    addWeight(boostGenres, canonicalGenre(g), Number(w) || 0);
  }
  for (const [g, w] of Object.entries(session.penalizeGenres || {})) {
    addWeight(penalizeGenres, canonicalGenre(g), Number(w) || 0);
  }

  // Сиды для TMDB similar/recommendations. Берём самые свежие (в начало).
  const toSeed = (m) => ({
    tmdbId: m.tmdbId,
    mediaType: m.mediaType || 'movie',
    title: m.title || '',
    genres: (m.genres || []).map(canonicalGenre)
  });
  const rightSeeds = right.filter((m) => m.tmdbId).slice(-4).reverse().map(toSeed);
  const leftSeeds = left.filter((m) => m.tmdbId).slice(-3).reverse().map(toSeed);

  return {
    active: right.length > 0 || left.length > 0,
    boostGenres,
    penalizeGenres,
    rightSeeds,
    leftSeeds,
    // Множество tmdbKey фильмов, похожих на свайпы влево — заполняется при
    // сборе кандидатов, чтобы понижать их в скоринге.
    leftSimilarKeys: new Set(),
    recentRightTitles: right.map((m) => normalizeWatchTitle(m.title)).filter(Boolean),
    recentLeftTitles: left.map((m) => normalizeWatchTitle(m.title)).filter(Boolean),
    maxBoost: maxAbs(boostGenres),
    maxPenalty: maxAbs(penalizeGenres)
  };
}

/* ===================================================================
   КАНДИДАТЫ ИЗ TMDB
   =================================================================== */

function genreIdsForTaste(tasteProfile, genreMap) {
  // имя жанра → id (инвертируем карту)
  const nameToId = new Map();
  for (const [id, name] of genreMap) {
    if (!nameToId.has(name)) nameToId.set(name, id);
  }
  // топ любимых жанров пользователя + boost из тестов
  const liked = Object.entries(tasteProfile.likedGenres || {})
    .sort((a, b) => b[1] - a[1])
    .map(([name]) => name);
  const boosted = Object.keys(tasteProfile.psychModifiers?.boostGenres || {});
  const ordered = [...new Set([...liked, ...boosted])];
  return ordered.map((name) => nameToId.get(canonicalGenre(name))).filter(Boolean);
}

function mapTmdbResultToCandidate(item, mediaType, genreMap, tmdbPosterFromPath) {
  const releaseDate = item.release_date || item.first_air_date || null;
  return {
    tmdbId: item.id,
    title: item.title || item.name,
    originalTitle: item.original_title || item.original_name || null,
    mediaType,
    poster: tmdbPosterFromPath(item.poster_path, 'w780'),
    year: releaseDate ? Number(releaseDate.slice(0, 4)) || null : null,
    overview: item.overview || '',
    genres: mapGenreIds(item.genre_ids, genreMap),
    genreIds: item.genre_ids || [],
    releaseDate,
    popularity: item.popularity || 0,
    voteAverage: item.vote_average || 0,
    voteCount: item.vote_count || 0,
    originalLanguage: item.original_language || null
  };
}

/**
 * getRecommendationCandidates — собирает реальных кандидатов из TMDB.
 * Источники (по убыванию полезности): similar/recommendations к любимым
 * фильмам → discover по любимым жанрам → trending/popular → moviePool.
 * Жёстко исключает уже просмотренное, список и blacklist.
 */
export async function getRecommendationCandidates(options) {
  const {
    tmdbFetch,
    tmdbPosterFromPath,
    movies = [],
    prefs = {},
    tasteProfile,
    mediaType = null,
    mode = 'personal',
    limit = 10,
    excludeTitles = [],
    swipeSession = null,
    debug = DEBUG
  } = options;

  const stats = { similar: 0, discover: 0, trending: 0, upcoming: 0, pool: 0, swipe: 0, excludedSeen: 0, excludedBlacklist: 0 };
  const swipeActive = !!(swipeSession && swipeSession.active);

  if (!tmdbFetch) {
    return { candidates: buildPoolCandidates(movies, limit, excludeTitles, stats), stats };
  }

  const genreMap = await loadTmdbGenreMap(tmdbFetch);
  const types = mediaType ? [mediaType] : ['movie', 'tv'];
  const targetPool = Math.max(limit * 4, 40);

  const blockedTitles = new Set([
    ...[...tasteProfile.listTitles],
    ...[...tasteProfile.feedbackBlockedTitles],
    ...[...tasteProfile.blacklistTitles],
    ...excludeTitles.map(normalizeWatchTitle)
  ].filter(Boolean));
  const seenTmdb = new Set(tasteProfile.watchedTmdbIds);
  const collected = new Map(); // key → candidate

  // Лента свайпов делится на «корзины»: adapted (под текущие свайпы),
  // personal (долгий вкус), diversity (тренды/новинки). Это нужно для
  // смешивания выдачи в нужных пропорциях (см. mixByBucket).
  const bucketForSource = (source) => {
    if (source === 'swipe' || source === 'swipe_discover') return 'adapted';
    if (source === 'tmdb_trending' || source === 'tmdb_upcoming' || source === 'explore') return 'diversity';
    return 'personal';
  };

  const tryAdd = (raw, type, source, similarTo = null) => {
    const cand = mapTmdbResultToCandidate(raw, type, genreMap, tmdbPosterFromPath);
    if (!cand.title || !cand.tmdbId) return;
    if (!cand.poster) return; // фронтенд ожидает постер
    const titleKey = normalizeWatchTitle(cand.title);
    const tmdbKey = `${type}:${cand.tmdbId}`;
    if (seenTmdb.has(tmdbKey)) { stats.excludedSeen += 1; return; }
    if (blockedTitles.has(titleKey)) { stats.excludedSeen += 1; return; }
    // Не показываем то, что прямо сейчас свайпнули (вправо или влево).
    if (swipeActive && (
      swipeSession.recentRightTitles.includes(titleKey) ||
      swipeSession.recentLeftTitles.includes(titleKey)
    )) { stats.excludedSeen += 1; return; }
    if (collected.has(tmdbKey) || collected.has(`t:${titleKey}`)) return;
    // blacklist (жанры/страна/рантайм/год)
    if (matchesBlacklist({ title: cand.title, genres: cand.genres, meta: { year: cand.year } }, prefs.blacklist)) {
      stats.excludedBlacklist += 1; return;
    }
    cand.source = source;
    cand.bucket = bucketForSource(source);
    if (similarTo) cand.similarTo = similarTo;
    // Кандидат пришёл от победителя «битвы фильмов» — помечаем для скоринга
    // и объяснимости (см. scoreMovieForUser / buildReasonFromScore).
    if (source === 'battle') cand.battleSeed = similarTo;
    // Кандидат — похож на недавний свайп вправо: сильный сессионный сигнал.
    if (source === 'swipe') cand.swipeRight = similarTo;
    if (source === 'swipe_discover') cand.swipeBoosted = true;
    // Похож на свайп влево → пометка для понижения в скоринге.
    if (swipeActive && swipeSession.leftSimilarKeys.has(tmdbKey)) cand.swipeLeft = true;
    collected.set(tmdbKey, cand);
    collected.set(`t:${titleKey}`, cand);
  };

  // ── Сессия свайпов: предварительно собираем «похожие на свайпы влево»,
  //    чтобы пометить и понизить их (а не полностью убрать). ──────────────
  if (swipeActive && swipeSession.leftSeeds.length) {
    for (const seed of swipeSession.leftSeeds) {
      const t = seed.mediaType === 'tv' ? 'tv' : 'movie';
      if (mediaType && t !== mediaType) continue;
      try {
        const data = await tmdbFetch(`/${t}/${seed.tmdbId}/similar`, { page: '1' });
        (data?.results || []).slice(0, 10).forEach((r) => {
          if (r?.id) swipeSession.leftSimilarKeys.add(`${t}:${r.id}`);
        });
      } catch { /* мягко игнорируем */ }
    }
  }

  for (const type of types) {
    // 0) Сессия свайпов: фильмы, похожие на недавние свайпы ВПРАВО —
    //    самый сильный сигнал текущей ленты. Тянем similar/recommendations.
    if (swipeActive) {
      const rightSeeds = swipeSession.rightSeeds
        .filter((m) => m.tmdbId && (m.mediaType === type))
        .slice(0, 3);
      for (const seed of rightSeeds) {
        for (const kind of ['recommendations', 'similar']) {
          const data = await tmdbFetch(`/${type}/${seed.tmdbId}/${kind}`, { page: '1' });
          (data?.results || []).slice(0, 12).forEach((r) => {
            stats.swipe += 1;
            tryAdd(r, type, 'swipe', seed.title);
          });
        }
      }
      // discover по бустнутым жанрам сессии (новые фильмы в духе свайпов)
      const boostedIds = [...swipeSession.boostGenres.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([name]) => name)
        .map((name) => {
          for (const [id, gName] of genreMap) if (gName === name) return id;
          return null;
        })
        .filter(Boolean)
        .slice(0, 3);
      if (boostedIds.length) {
        const data = await tmdbFetch(`/discover/${type}`, {
          sort_by: 'popularity.desc',
          include_adult: 'false',
          'vote_count.gte': 60,
          with_genres: boostedIds.join('|'),
          page: '1'
        });
        (data?.results || []).forEach((r) => { stats.swipe += 1; tryAdd(r, type, 'swipe_discover'); });
      }

      // ── Exploration: качественные фильмы ИЗ ДРУГИХ жанров ──────────
      // Чтобы лента не схлопывалась в одну любимую категорию, всегда
      // подмешиваем сильные фильмы вне текущих бустнутых жанров. Это
      // «корзина разнообразия», из которой anti-loop достаёт замену,
      // если подряд идёт слишком много похожего.
      // Тянем НЕСКОЛЬКО страниц разнообразия, чтобы анти-зацикливанию всегда
      // было чем заменить однообразный хвост (иначе при сильном перекосе в
      // лайках пул кандидатов целиком уходит в одну категорию).
      for (let page = 1; page <= 2; page += 1) {
        const exploreParams = {
          sort_by: page === 1 ? 'vote_count.desc' : 'popularity.desc',
          include_adult: 'false',
          'vote_count.gte': 300,
          'vote_average.gte': 6.6,
          page: String(page)
        };
        if (boostedIds.length) exploreParams.without_genres = boostedIds.join(',');
        const exData = await tmdbFetch(`/discover/${type}`, exploreParams);
        (exData?.results || []).forEach((r) => { stats.swipe += 1; tryAdd(r, type, 'explore'); });
      }
    }

    // 1) similar / recommendations к сидам с tmdbId.
    //    Сиды = победители «битвы фильмов» (приоритет) + просто любимые
    //    фильмы. Так результаты битвы напрямую влияют на общие рекомендации:
    //    мы ищем фильмы, похожие на тех, кого пользователь выбрал в битвах.
    const battleSeeds = (tasteProfile.battleChampions || [])
      .filter((m) => m.tmdbId && m.mediaType === type);
    const likedSeeds = (tasteProfile.likedMovies || [])
      .filter((m) => m.tmdbId && m.mediaType === type);

    const seedMap = new Map(); // tmdbId → { seed, fromBattle }
    for (const m of battleSeeds) {
      if (!seedMap.has(m.tmdbId)) seedMap.set(m.tmdbId, { seed: m, fromBattle: true });
    }
    for (const m of likedSeeds) {
      if (!seedMap.has(m.tmdbId)) seedMap.set(m.tmdbId, { seed: m, fromBattle: false });
    }
    const seeds = [...seedMap.values()].slice(0, 4);

    for (const { seed, fromBattle } of seeds) {
      for (const kind of ['recommendations', 'similar']) {
        if (collected.size / 2 >= targetPool) break;
        const data = await tmdbFetch(`/${type}/${seed.tmdbId}/${kind}`, { page: '1' });
        (data?.results || []).slice(0, 12).forEach((r) => {
          stats.similar += 1;
          // source 'battle' помечает кандидата как «похож на победителя битвы».
          tryAdd(r, type, fromBattle ? 'battle' : `similar:${kind}`, seed.title);
        });
      }
    }

    // 2) discover по любимым жанрам
    if (mode !== 'premieres') {
      const genreIds = genreIdsForTaste(tasteProfile, genreMap).slice(0, 4);
      if (genreIds.length) {
        for (let page = 1; page <= 2 && collected.size / 2 < targetPool; page += 1) {
          const data = await tmdbFetch(`/discover/${type}`, {
            sort_by: 'popularity.desc',
            include_adult: 'false',
            'vote_count.gte': 80,
            with_genres: genreIds.join('|'),
            page: String(page)
          });
          (data?.results || []).forEach((r) => { stats.discover += 1; tryAdd(r, type, 'tmdb_discover'); });
        }
      }
    }

    // 3) Премьеры: будущие релизы
    if (mode === 'premieres') {
      const today = new Date().toISOString().slice(0, 10);
      const upPath = type === 'tv' ? '/tv/on_the_air' : '/movie/upcoming';
      const data = await tmdbFetch(upPath, { region: 'RU' });
      (data?.results || []).forEach((r) => {
        const rd = r.release_date || r.first_air_date || '';
        if (rd && rd > today) { stats.upcoming += 1; tryAdd(r, type, 'tmdb_upcoming'); }
      });
      // discover будущих по жанрам
      const genreIds = genreIdsForTaste(tasteProfile, genreMap).slice(0, 4);
      const discData = await tmdbFetch(`/discover/${type}`, {
        sort_by: 'popularity.desc',
        include_adult: 'false',
        with_genres: genreIds.join('|'),
        ...(type === 'tv'
          ? { 'first_air_date.gte': today }
          : { 'primary_release_date.gte': today })
      });
      (discData?.results || []).forEach((r) => { stats.upcoming += 1; tryAdd(r, type, 'tmdb_upcoming'); });
    }

    // 4) trending/popular как запасной источник (не для премьер —
    //    там нужны только будущие релизы). Для свайп-ленты тянем всегда:
    //    это «корзина разнообразия» (diversity) при смешивании.
    if (mode !== 'premieres' && (swipeActive || collected.size / 2 < targetPool)) {
      const data = await tmdbFetch(`/trending/${type}/week`, {});
      (data?.results || []).forEach((r) => { stats.trending += 1; tryAdd(r, type, 'tmdb_trending'); });
    }
  }

  // только реальные кандидаты (значения по tmdbKey, без дублей по t:)
  let candidates = [...new Set([...collected.values()])];

  // Для премьер оставляем строго будущие релизы.
  if (mode === 'premieres') {
    const today = new Date().toISOString().slice(0, 10);
    candidates = candidates.filter((c) => c.releaseDate && c.releaseDate > today);
  }

  // 5) последний fallback — moviePool (без tmdbId), не для премьер
  if (!candidates.length && mode !== 'premieres') {
    candidates = buildPoolCandidates(movies, limit, excludeTitles, stats);
  }

  debugLog('candidates', { mode, mediaType, total: candidates.length, ...stats });
  return { candidates, stats };
}

function buildPoolCandidates(movies, limit, excludeTitles, stats) {
  const blocked = new Set(excludeTitles.map(normalizeWatchTitle));
  const out = [];
  for (const type of ['movie', 'tv']) {
    for (const title of pickRandomTitles(movies, limit, type === 'tv' ? 'tv' : 'movie')) {
      const key = normalizeWatchTitle(title);
      if (blocked.has(key)) continue;
      blocked.add(key);
      out.push({
        title,
        originalTitle: title,
        mediaType: type,
        poster: null,
        year: null,
        overview: '',
        genres: [],
        genreIds: [],
        releaseDate: null,
        popularity: 0,
        voteAverage: 0,
        voteCount: 0,
        source: 'movie_pool'
      });
      stats.pool += 1;
    }
  }
  return out;
}

/* ===================================================================
   СКОРИНГ
   =================================================================== */

const MODE_WEIGHTS = {
  personal: {
    genre: 0.28, keyword: 0.20, tag: 0.12, director: 0.10, actor: 0.06,
    rating: 0.08, psych: 0.07, popularity: 0.03, freshness: 0.02, similar: 0.14
  },
  psych: {
    genre: 0.22, keyword: 0.14, tag: 0.10, director: 0.06, actor: 0.04,
    rating: 0.08, psych: 0.24, popularity: 0.02, freshness: 0.02, similar: 0.12
  },
  premieres: {
    genre: 0.32, keyword: 0.16, tag: 0.10, director: 0.08, actor: 0.04,
    rating: 0.06, psych: 0.10, popularity: 0.06, freshness: 0.10, similar: 0.10
  }
};

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

/**
 * scoreMovieForUser — оценивает одного кандидата под профиль вкуса.
 * Возвращает { score, breakdown, reasonCodes }. Уже просмотренное и
 * blacklist получают hard exclude (score = -Infinity).
 */
export function scoreMovieForUser(candidate, tasteProfile, options = {}) {
  const mode = options.mode || 'personal';
  const weights = MODE_WEIGHTS[mode] || MODE_WEIGHTS.personal;
  const reasonCodes = [];

  // Hard excludes
  const titleKey = normalizeWatchTitle(candidate.title);
  const tmdbKey = `${candidate.mediaType || 'movie'}:${candidate.tmdbId}`;
  if (
    tasteProfile.listTitles.has(titleKey) ||
    tasteProfile.feedbackBlockedTitles.has(titleKey) ||
    tasteProfile.blacklistTitles.has(titleKey) ||
    (candidate.tmdbId && tasteProfile.watchedTmdbIds.has(tmdbKey))
  ) {
    return { score: -Infinity, breakdown: {}, reasonCodes: ['excluded'] };
  }

  const candGenres = (candidate.genres || []).map(canonicalGenre);
  const overview = `${candidate.title || ''} ${candidate.overview || ''}`.toLowerCase().replace(/ё/g, 'е');

  // genreScore: сумма знаковых весов жанров кандидата, нормированная
  const maxG = tasteProfile.rawSignals.maxAbsGenreWeight || 1;
  let genreRaw = 0;
  let matchedLikedGenres = [];
  for (const g of candGenres) {
    const w = tasteProfile.genreWeight.get(g) || 0;
    genreRaw += w;
    if (w > 0) matchedLikedGenres.push(g);
  }
  const genreScore = clamp(genreRaw / (maxG * 1.5), -1, 1);
  if (matchedLikedGenres.length) reasonCodes.push('genre_match');

  // keywordScore: пересечение overview с любимыми/нелюбимыми ключевыми словами
  const maxK = tasteProfile.rawSignals.maxAbsKeywordWeight || 1;
  let kwRaw = 0;
  for (const [w, val] of tasteProfile.keywordWeight) {
    if (overview.includes(w)) kwRaw += val;
  }
  const keywordScore = clamp(kwRaw / (maxK * 2), -1, 1);
  if (kwRaw > 0) reasonCodes.push('keyword_match');

  // tagScore
  let tagRaw = 0;
  for (const [t, val] of tasteProfile.tagWeight) {
    if (overview.includes(t) || candGenres.includes(canonicalGenre(t))) tagRaw += val;
  }
  const tagScore = clamp(tagRaw / (maxG * 1.5), -1, 1);

  // director/actor (обычно 0 — у discover нет кредитов)
  let directorScore = 0;
  if (candidate.meta?.director) {
    const w = tasteProfile.likedDirectors.get(candidate.meta.director.toLowerCase().trim());
    if (w) { directorScore = clamp(w / maxG, 0, 1); reasonCodes.push('director_match'); }
  }
  let actorScore = 0;

  // ratingScore (с поправкой на число голосов)
  const voteConfidence = clamp((candidate.voteCount || 0) / 500, 0, 1);
  const ratingScore = clamp(((candidate.voteAverage || 0) / 10) * (0.4 + 0.6 * voteConfidence), 0, 1);

  // popularityScore
  const popularityScore = clamp(Math.log10((candidate.popularity || 0) + 1) / 3, 0, 1);

  // freshnessScore
  const yearNum = candidate.year || (candidate.releaseDate ? Number(candidate.releaseDate.slice(0, 4)) : null);
  const nowYear = new Date().getFullYear();
  const freshnessScore = yearNum ? clamp((yearNum - (nowYear - 25)) / 25, 0, 1) : 0.3;

  // psychScore: множители из тестов, применённые к жанрам/overview
  const mods = tasteProfile.psychModifiers || {};
  let psychMult = 1;
  let testMatched = false;
  for (const g of candGenres) {
    if (mods.boostGenres?.[g]) { psychMult *= mods.boostGenres[g]; testMatched = true; }
    if (mods.penaltyGenres?.[g]) { psychMult *= mods.penaltyGenres[g]; }
  }
  const psychScore = clamp(psychMult - 1, -0.6, 0.6);
  if (testMatched && psychScore > 0) reasonCodes.push('test_profile');

  // similarity bonus. Похожесть на победителя «битвы фильмов» — самый
  // сильный личный сигнал (пользователь сам выбрал этот фильм в битве),
  // поэтому даём максимальный бонус и отдельный reasonCode.
  let similarScore = 0;
  if (candidate.battleSeed) {
    similarScore = 1;
    reasonCodes.push('battle_match');
  } else if (candidate.similarTo) {
    similarScore = 0.8;
    reasonCodes.push('similar_to');
  }

  if (ratingScore > 0.75 && (candidate.voteCount || 0) > 300) reasonCodes.push('acclaimed');
  if (mode === 'premieres') reasonCodes.push('upcoming');

  // ── Сессионный сигнал свайпов ───────────────────────────────────────
  // Свайп вправо сильно поднимает похожие фильмы и бустнутые жанры; свайп
  // влево — понижает (но не обнуляет, чтобы сохранить разнообразие).
  let swipeScore = 0;
  const ss = options.swipeSession;
  if (ss && ss.active) {
    if (candidate.swipeRight) swipeScore += 1;
    else if (candidate.swipeBoosted) swipeScore += 0.45;

    let boostRaw = 0;
    let penaltyRaw = 0;
    for (const g of candGenres) {
      boostRaw += ss.boostGenres.get(g) || 0;
      penaltyRaw += ss.penalizeGenres.get(g) || 0;
    }
    if (boostRaw > 0) swipeScore += clamp(boostRaw / ((ss.maxBoost || 1) * 1.5), 0, 0.8);
    if (penaltyRaw > 0) swipeScore -= clamp(penaltyRaw / ((ss.maxPenalty || 1) * 1.2), 0, 0.9);
    if (candidate.swipeLeft) swipeScore -= 0.7;

    if (swipeScore > 0.15 && (candidate.swipeRight || candidate.swipeBoosted || boostRaw > 0)) {
      reasonCodes.push('swipe_match');
    }
  }
  swipeScore = clamp(swipeScore, -1.2, 1.2);

  const breakdown = {
    genreScore, keywordScore, tagScore, directorScore, actorScore,
    ratingScore, popularityScore, freshnessScore, psychScore, similarScore, swipeScore,
    blacklistPenalty: 0, alreadySeenPenalty: 0
  };

  // Вес сессии свайпов — заметный, но ограниченный, чтобы пара свайпов не
  // схлопнула ленту в один жанр/страну. Разнообразие держат mixByBucket
  // (пропорции корзин) и diversifySwipeFeed (анти-зацикливание) на сервере.
  const SWIPE_WEIGHT = 0.42;

  const score =
    genreScore * weights.genre +
    keywordScore * weights.keyword +
    tagScore * weights.tag +
    directorScore * weights.director +
    actorScore * weights.actor +
    ratingScore * weights.rating +
    psychScore * weights.psych +
    popularityScore * weights.popularity +
    freshnessScore * weights.freshness +
    similarScore * weights.similar +
    swipeScore * SWIPE_WEIGHT;

  return { score, breakdown, reasonCodes, matchedLikedGenres };
}

/* ===================================================================
   ПРИЧИНЫ БЕЗ OPENAI
   =================================================================== */

const GENRE_GENITIVE = {
  'драма': 'драмы', 'триллер': 'триллеры', 'детектив': 'детективы', 'комедия': 'комедии',
  'мелодрама': 'мелодрамы', 'фантастика': 'фантастику', 'фэнтези': 'фэнтези',
  'боевик': 'боевики', 'криминал': 'криминал', 'ужасы': 'хорроры', 'семейный': 'семейное кино',
  'приключения': 'приключения', 'мультфильм': 'анимацию', 'история': 'исторические фильмы',
  'военный': 'военное кино', 'музыка': 'музыкальные фильмы'
};

function genreList(genres) {
  return genres.map((g) => GENRE_GENITIVE[g] || g).slice(0, 3).join(', ');
}

/**
 * buildReasonFromScore — человекопонятные reason/whyDetailed без GPT,
 * на основе реальных совпадений (жанры, похожесть, тест, рейтинг).
 */
export function buildReasonFromScore(candidate, breakdown, tasteProfile, scoreInfo = {}) {
  const codes = new Set(scoreInfo.reasonCodes || []);
  const matched = scoreInfo.matchedLikedGenres || [];
  const detail = [];
  let reason = '';

  if (candidate.swipeRight) {
    reason = `Похож на фильмы, которые вы выбирали в свайпах`;
    detail.push(`Вы свайпнули «${candidate.swipeRight}» вправо, а TMDB относит этот вариант к похожим — подстраиваем ленту под вас.`);
  } else if (codes.has('swipe_match') && candidate.swipeBoosted) {
    reason = `Под ваши недавние свайпы вправо`;
    detail.push('Подобрано под жанры, которые вы только что отмечали в свайпах.');
  } else if (codes.has('battle_match') && candidate.battleSeed) {
    reason = `Похоже на «${candidate.battleSeed}» — победителя ваших битв`;
    detail.push(`Вы выбрали «${candidate.battleSeed}» в «битве фильмов», а TMDB относит этот вариант к похожим.`);
  } else if (codes.has('similar_to') && candidate.similarTo) {
    reason = `Похоже на «${candidate.similarTo}», который вам зашёл`;
    detail.push(`TMDB относит этот вариант к похожим на «${candidate.similarTo}» из вашего списка.`);
  } else if (codes.has('genre_match') && matched.length) {
    reason = `Совпадает с любимыми жанрами: ${genreList(matched)}`;
  } else if (codes.has('test_profile')) {
    reason = 'Подходит под ваш профиль восприятия из теста';
  } else if (codes.has('acclaimed')) {
    reason = 'Высоко оценён зрителями и подходит по духу';
  } else {
    reason = 'Свежая находка под ваш вкус';
  }

  if (matched.length) {
    detail.push(`Совпадают жанры ${genreList(matched)}, которые часто встречаются среди ваших высоких оценок.`);
  }
  if (codes.has('test_profile') && tasteProfile.psychModifiers?.moodHints?.length) {
    detail.push(`Соответствует вашему стилю восприятия (${tasteProfile.psychModifiers.moodHints.slice(0, 3).join(', ')}).`);
  }
  if (codes.has('keyword_match')) {
    detail.push('Темы и описание перекликаются с тем, что вам нравилось раньше.');
  }
  if (codes.has('acclaimed') && candidate.voteAverage) {
    detail.push(`Рейтинг TMDB ${Number(candidate.voteAverage).toFixed(1)} при большом числе оценок.`);
  }
  if (!detail.length) {
    detail.push('Подобрано локальным алгоритмом по вашему списку и предпочтениям.');
  }

  return { reason, whyDetailed: detail.join(' ') };
}

/* ===================================================================
   ОРКЕСТРАТОР
   =================================================================== */

/**
 * mixByBucket — собирает финальный список из корзин в заданных пропорциях:
 *   adapted   — фильмы под текущие свайпы (similar к свайпам вправо + бусты);
 *   personal  — общий персональный вкус (долгая история);
 *   diversity — тренды/новинки для разнообразия и расширения вкуса.
 * Каждая корзина уже отсортирована по score (вход отсортирован глобально).
 * Недобор одной корзины добиваем из остальных — лента всегда полная.
 */
function mixByBucket(scored, limit, ratios = {}) {
  const r = {
    adapted: ratios.adapted ?? 0.55,
    personal: ratios.personal ?? 0.25,
    diversity: ratios.diversity ?? 0.20
  };
  const buckets = { adapted: [], personal: [], diversity: [] };
  for (const s of scored) {
    const b = s.cand?.bucket;
    (buckets[b] || buckets.personal).push(s);
  }

  const quota = {
    adapted: Math.round(limit * r.adapted),
    personal: Math.round(limit * r.personal),
    diversity: Math.max(0, limit - Math.round(limit * r.adapted) - Math.round(limit * r.personal))
  };

  const out = [];
  const used = new Set();
  const order = ['adapted', 'personal', 'diversity'];
  for (const name of order) {
    let taken = 0;
    for (const s of buckets[name]) {
      if (taken >= quota[name]) break;
      if (used.has(s)) continue;
      used.add(s); out.push(s); taken += 1;
    }
  }
  // Добор до limit из всего, что осталось (по убыванию score).
  if (out.length < limit) {
    for (const s of scored) {
      if (out.length >= limit) break;
      if (used.has(s)) continue;
      used.add(s); out.push(s);
    }
  }
  // Перемешиваем так, чтобы adapted шли в начале, но не сплошняком —
  // чередуем корзины для естественного ощущения адаптации.
  return interleaveByBucket(out, limit);
}

/** Чередование элементов по корзинам, с приоритетом adapted. */
function interleaveByBucket(items, limit) {
  const groups = { adapted: [], personal: [], diversity: [] };
  for (const s of items) (groups[s.cand?.bucket] || groups.personal).push(s);
  const pattern = ['adapted', 'adapted', 'personal', 'diversity'];
  const out = [];
  let p = 0;
  while (out.length < Math.min(limit, items.length)) {
    let placed = false;
    for (let tries = 0; tries < pattern.length; tries += 1) {
      const name = pattern[(p + tries) % pattern.length];
      if (groups[name].length) { out.push(groups[name].shift()); placed = true; p = (p + tries + 1) % pattern.length; break; }
    }
    if (!placed) break;
  }
  return out;
}

/**
 * recommendForUser — главная точка входа локального движка.
 * Возвращает { recommendations, tasteProfile, stats } где recommendations
 * совместимы с фронтендом.
 */
export async function recommendForUser(options) {
  const started = Date.now();
  const {
    tmdbFetch,
    tmdbPosterFromPath,
    movies = [],
    prefs = {},
    mode = 'personal',
    limit = 10,
    mediaType = null,
    excludeTitles = [],
    swipeSession: rawSwipeSession = null,
    mix = null,
    debug = DEBUG
  } = options;

  const tasteProfile = buildUserTasteProfile(movies, prefs);
  const swipeSession = rawSwipeSession ? buildSwipeSessionProfile(rawSwipeSession) : null;
  const { candidates, stats } = await getRecommendationCandidates({
    tmdbFetch, tmdbPosterFromPath, movies, prefs, tasteProfile,
    mediaType, mode, limit, excludeTitles, swipeSession, debug
  });

  const scored = candidates
    .map((cand) => {
      const info = scoreMovieForUser(cand, tasteProfile, { mode, swipeSession });
      // Лёгкий джиттер для корзины разнообразия в свайп-ленте: чтобы
      // «Обновить» приносило свежий порядок, а не один и тот же набор.
      if (swipeSession?.active && cand.bucket === 'diversity') {
        info.score += (Math.random() - 0.5) * 0.03;
      }
      return { cand, ...info };
    })
    .filter((s) => Number.isFinite(s.score));

  scored.sort((a, b) => b.score - a.score);

  // Смешиваем выдачу по корзинам (adapted/personal/diversity) с заданными
  // пропорциями. Если mix не задан — обычный топ-N по score.
  const selected = (mix && (swipeSession?.active))
    ? mixByBucket(scored, limit, mix)
    : scored.slice(0, limit);

  const recommendations = selected.map(({ cand, score, breakdown, reasonCodes, matchedLikedGenres }) => {
    const { reason, whyDetailed } = buildReasonFromScore(cand, breakdown, tasteProfile, { reasonCodes, matchedLikedGenres });
    return {
      title: cand.title,
      originalTitle: cand.originalTitle || null,
      mediaType: cand.mediaType || 'movie',
      type: (cand.mediaType === 'tv') ? 'series' : 'movie',
      tmdbId: cand.tmdbId || null,
      poster: cand.poster || null,
      year: cand.year || null,
      overview: cand.overview || '',
      genres: cand.genres || [],
      releaseDate: cand.releaseDate || null,
      voteAverage: cand.voteAverage || null,
      originalLanguage: cand.originalLanguage || null,
      reason,
      whyDetailed,
      testConnection: mode === 'psych' && reasonCodes.includes('test_profile') ? whyDetailed : '',
      score: Number(score.toFixed(4)),
      scoreBreakdown: breakdown,
      bucket: cand.bucket || 'personal',
      swipeAdapted: !!(cand.swipeRight || cand.swipeBoosted),
      source: cand.source === 'movie_pool' ? 'movie_pool' : 'local_algorithm'
    };
  });

  const elapsed = Date.now() - started;
  if (debug) {
    debugLog('recommendForUser', {
      mode, mediaType, elapsedMs: elapsed,
      candidates: candidates.length, returned: recommendations.length,
      topGenres: Object.entries(tasteProfile.likedGenres).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([g]) => g),
      stats
    });
  }

  return {
    recommendations,
    tasteProfile: debug ? summarizeTasteProfile(tasteProfile) : undefined,
    stats: { ...stats, elapsedMs: elapsed, candidates: candidates.length }
  };
}

function summarizeTasteProfile(tp) {
  return {
    likedGenres: tp.likedGenres,
    dislikedGenres: tp.dislikedGenres,
    topLikedMovies: tp.likedMovies.slice(0, 8).map((m) => m.title),
    psychModifiers: tp.psychModifiers,
    watchedCount: tp.rawSignals.watchedCount,
    ratedCount: tp.rawSignals.ratedCount
  };
}

export function hasEnoughTasteSignal(tasteProfile) {
  return (tasteProfile?.rawSignals?.watchedCount || 0) > 0
    || Object.keys(tasteProfile?.likedGenres || {}).length > 0;
}

/**
 * scoreTmdbResultsForUser — сортирует «сырые» результаты TMDB по релевантности
 * вкусу пользователя (для премьерной ленты). Не генерирует новые фильмы,
 * только переупорядочивает уже полученные результаты.
 * Возвращает массив [{ result, score }] по убыванию релевантности.
 */
export async function scoreTmdbResultsForUser({ tmdbFetch, tmdbPosterFromPath, results = [], mediaType = 'movie', movies = [], prefs = {}, mode = 'premieres' }) {
  const tasteProfile = buildUserTasteProfile(movies, prefs);
  const genreMap = tmdbFetch ? await loadTmdbGenreMap(tmdbFetch) : new Map();
  return results
    .map((r) => {
      const cand = mapTmdbResultToCandidate(r, mediaType, genreMap, tmdbPosterFromPath || (() => null));
      const info = scoreMovieForUser(cand, tasteProfile, { mode });
      return { result: r, score: Number.isFinite(info.score) ? info.score : -1 };
    })
    .sort((a, b) => b.score - a.score);
}

/* Content-based рекомендации = основной локальный движок (псевдоним для
   единообразия с гибридным API). */
export { recommendForUser as getContentBasedRecommendations };

/* ── Ре-экспорт коллаборативной/гибридной части (живёт в hybrid.js) ──
   Чтобы все «ожидаемые» из ТЗ функции были доступны и через
   recommendationEngine.js: buildUserItemMatrix, calculateUserSimilarity,
   findSimilarUsers, getCollaborativeRecommendations, getHybridRecommendations,
   buildAllUsersProfiles. */
export {
  buildUserItemMatrix,
  calculateUserSimilarity,
  findSimilarUsers,
  getCollaborativeRecommendations,
  getHybridRecommendations,
  buildAllUsersProfiles
} from './hybrid.js';
