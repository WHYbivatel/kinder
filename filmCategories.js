/* ===================================================================
   filmCategories.js — извлечение «богатых» категорий фильма из тех
   данных, что у нас уже есть (жанры TMDB на русском, overview, год,
   длительность, тип медиа, язык/страна, рейтинг).

   Категории (из ТЗ): genre, mood, pace, tone, themes, setting,
   targetEmotion, complexity, visualStyle, era, audienceType,
   durationType, rewatchability, franchise/standalone, country/language.

   Зачем: строим по ним профиль вкуса пользователя и сравниваем фильмы
   не только по жанрам, но и по настроению/темпу/темам и т.д. Это
   повышает точность content-based части и даёт объяснимость
   (matchedCategories).

   Реализация — детерминированные таблицы соответствий + лёгкий разбор
   overview по ключевым словам. Никаких внешних вызовов, не падает на
   отсутствующих полях.
   =================================================================== */

import { canonicalGenre } from './recommendationEngine.js';

function lc(s) {
  return String(s || '').toLowerCase().replace(/ё/g, 'е');
}

/* Жанры TMDB (ru, в нижнем регистре) → вклад в категории. */
const GENRE_TABLE = {
  'боевик':         { mood: ['tense'], pace: 'fast', tone: 'serious', targetEmotion: 'adrenaline', complexity: 'medium', rewatch: 'high' },
  'триллер':        { mood: ['tense', 'dark'], pace: 'fast', tone: 'serious', targetEmotion: 'adrenaline', complexity: 'complex' },
  'ужасы':          { mood: ['dark', 'tense'], pace: 'medium', tone: 'serious', targetEmotion: 'adrenaline', complexity: 'medium', audience: 'adult' },
  'детектив':       { mood: ['tense'], pace: 'medium', tone: 'philosophical', targetEmotion: 'think', complexity: 'complex' },
  'криминал':       { mood: ['dark'], pace: 'medium', tone: 'serious', targetEmotion: 'think', complexity: 'complex', audience: 'adult' },
  'драма':          { mood: ['emotional'], pace: 'slow', tone: 'serious', targetEmotion: 'cry', complexity: 'medium', rewatch: 'low' },
  'мелодрама':      { mood: ['emotional'], pace: 'slow', tone: 'romantic', targetEmotion: 'cry', complexity: 'easy', themes: ['love'] },
  'комедия':        { mood: ['light'], pace: 'medium', tone: 'light', targetEmotion: 'laugh', complexity: 'easy', rewatch: 'high' },
  'фантастика':     { mood: ['epic'], pace: 'medium', tone: 'philosophical', targetEmotion: 'think', complexity: 'complex', themes: ['future', 'technology'], visual: 'stylized' },
  'фэнтези':        { mood: ['epic', 'inspiring'], pace: 'medium', tone: 'light', targetEmotion: 'think', complexity: 'medium', visual: 'stylized', rewatch: 'high' },
  'приключения':    { mood: ['epic', 'inspiring'], pace: 'fast', tone: 'light', targetEmotion: 'adrenaline', complexity: 'easy', rewatch: 'high' },
  'военный':        { mood: ['tense', 'emotional'], pace: 'slow', tone: 'serious', targetEmotion: 'think', complexity: 'medium', themes: ['war', 'survival'], setting: ['war'], audience: 'adult' },
  'история':        { mood: ['emotional'], pace: 'slow', tone: 'serious', targetEmotion: 'think', complexity: 'medium', themes: ['history'], setting: ['historical'] },
  'семейный':       { mood: ['light', 'inspiring'], pace: 'medium', tone: 'light', targetEmotion: 'relax', complexity: 'easy', audience: 'family', rewatch: 'high', themes: ['family'] },
  'мультфильм':     { mood: ['light'], pace: 'medium', tone: 'light', targetEmotion: 'laugh', complexity: 'easy', audience: 'family', visual: 'animated', rewatch: 'high' },
  'музыка':         { mood: ['inspiring'], pace: 'medium', tone: 'light', targetEmotion: 'relax', complexity: 'easy' },
  'документальный': { mood: ['calm'], pace: 'slow', tone: 'philosophical', targetEmotion: 'think', complexity: 'medium', visual: 'realistic', rewatch: 'low' },
  'вестерн':        { mood: ['tense'], pace: 'medium', tone: 'serious', targetEmotion: 'adrenaline', complexity: 'medium', setting: ['historical'] }
};

/* Ключевые слова в названии/overview → темы и сеттинги. */
const KEYWORD_THEMES = [
  { re: /(космос|галактик|звезд|марс|планет|space|alien)/, themes: ['space'], setting: ['space'] },
  { re: /(войн|сражени|битв|фронт|солдат|war|battle)/, themes: ['war', 'survival'], setting: ['war'] },
  { re: /(любов|роман|сердц|свидан|love|romance)/, themes: ['love'] },
  { re: /(семь|семей|отец|мать|сын|дочь|family)/, themes: ['family'] },
  { re: /(друж|друзь|товарищ|friend)/, themes: ['friendship'] },
  { re: /(мест|отомст|возмезди|revenge)/, themes: ['revenge'] },
  { re: /(выжива|спасени|катастроф|survival|survive)/, themes: ['survival'] },
  { re: /(одиноч|изоляц|потер|lonel)/, themes: ['loneliness'] },
  { re: /(амбиц|карьер|власт|ambition|power)/, themes: ['ambition'] },
  { re: /(школ|студент|универ|колледж|school)/, setting: ['school'] },
  { re: /(город|мегаполис|улиц|city|urban)/, setting: ['city'] },
  { re: /(будущ|киберпанк|робот|future|cyber)/, setting: ['future'] }
];

function uniq(arr) { return [...new Set(arr.filter(Boolean))]; }

/**
 * Нормализует вход: принимает и рекомендацию (year:number, overview, genres,
 * voteAverage, mediaType, originalLanguage, runtime), и фильм пользователя
 * (genres, meta:{year, runtime, country, overview, originalLanguage}).
 */
function normInput(movie = {}) {
  const meta = movie.meta || {};
  const year = Number(movie.year || meta.year) || null;
  const runtime = Number(movie.runtime || meta.runtime) || null;
  const overview = movie.overview || meta.overview || '';
  const genres = (movie.genres || []).map(canonicalGenre);
  const mediaType = movie.mediaType || 'movie';
  const language = movie.originalLanguage || meta.originalLanguage || null;
  const country = meta.country || movie.country || null;
  const title = movie.title || '';
  return { year, runtime, overview, genres, mediaType, language, country, title };
}

/**
 * extractFilmCategories — основная функция. Возвращает структуру категорий
 * и плоский список токенов (allTokens) вида "mood:dark", "genre:драма",
 * "theme:war" для подсчёта пересечений между фильмами/профилем.
 */
export function extractFilmCategories(movie = {}) {
  const { year, runtime, overview, genres, mediaType, language, country, title } = normInput(movie);

  const mood = [];
  const themes = [];
  const setting = [];
  const toneVotes = {};
  const emotionVotes = {};
  const complexityVotes = {};
  const visualVotes = {};
  const audienceVotes = {};
  const rewatchVotes = {};
  const paceVotes = {};

  const vote = (obj, key) => { if (key) obj[key] = (obj[key] || 0) + 1; };

  for (const g of genres) {
    const t = GENRE_TABLE[g];
    if (!t) continue;
    (t.mood || []).forEach((m) => mood.push(m));
    (t.themes || []).forEach((x) => themes.push(x));
    (t.setting || []).forEach((x) => setting.push(x));
    vote(paceVotes, t.pace);
    vote(toneVotes, t.tone);
    vote(emotionVotes, t.targetEmotion);
    vote(complexityVotes, t.complexity);
    vote(visualVotes, t.visual);
    vote(audienceVotes, t.audience);
    vote(rewatchVotes, t.rewatch);
  }

  // Разбор overview/названия по ключевым словам
  const text = lc(`${title} ${overview}`);
  for (const rule of KEYWORD_THEMES) {
    if (rule.re.test(text)) {
      (rule.themes || []).forEach((x) => themes.push(x));
      (rule.setting || []).forEach((x) => setting.push(x));
    }
  }

  const topVote = (obj, fallback) => {
    const entries = Object.entries(obj);
    if (!entries.length) return fallback;
    entries.sort((a, b) => b[1] - a[1]);
    return entries[0][0];
  };

  // era по году
  let era = null;
  if (year) {
    if (year < 1970) era = 'classic';
    else if (year < 2000) era = 'retro';
    else if (year < 2015) era = 'modern';
    else era = 'contemporary';
  }

  // durationType
  let durationType = null;
  if (mediaType === 'tv') durationType = 'episodic';
  else if (runtime) durationType = runtime < 90 ? 'short' : runtime > 150 ? 'long' : 'normal';

  // franchise/standalone — эвристика по названию (двоеточие/номер/«часть»)
  const franchise = /[:\d]|часть|part|глава|chapter/i.test(title) ? 'franchise' : 'standalone';

  const categories = {
    genre: uniq(genres),
    mood: uniq(mood),
    pace: topVote(paceVotes, 'medium'),
    tone: topVote(toneVotes, 'serious'),
    themes: uniq(themes),
    setting: uniq(setting),
    targetEmotion: topVote(emotionVotes, 'think'),
    complexity: topVote(complexityVotes, 'medium'),
    visualStyle: topVote(visualVotes, 'live-action'),
    era,
    audienceType: topVote(audienceVotes, 'general'),
    durationType,
    rewatchability: topVote(rewatchVotes, 'medium'),
    franchise,
    language,
    country
  };

  categories.allTokens = buildTokens(categories);
  return categories;
}

/** Плоский список токенов для пересечений. */
function buildTokens(c) {
  const tokens = [];
  c.genre.forEach((g) => tokens.push(`genre:${g}`));
  c.mood.forEach((m) => tokens.push(`mood:${m}`));
  c.themes.forEach((t) => tokens.push(`theme:${t}`));
  c.setting.forEach((s) => tokens.push(`setting:${s}`));
  if (c.pace) tokens.push(`pace:${c.pace}`);
  if (c.tone) tokens.push(`tone:${c.tone}`);
  if (c.targetEmotion) tokens.push(`emotion:${c.targetEmotion}`);
  if (c.complexity) tokens.push(`complexity:${c.complexity}`);
  if (c.visualStyle) tokens.push(`visual:${c.visualStyle}`);
  if (c.era) tokens.push(`era:${c.era}`);
  if (c.audienceType) tokens.push(`audience:${c.audienceType}`);
  if (c.durationType) tokens.push(`duration:${c.durationType}`);
  if (c.rewatchability) tokens.push(`rewatch:${c.rewatchability}`);
  if (c.franchise) tokens.push(`franchise:${c.franchise}`);
  if (c.language) tokens.push(`lang:${lc(c.language)}`);
  return tokens;
}

/**
 * buildCategoryProfile — агрегирует категории по всем фильмам пользователя
 * с учётом знака веса (нравится → +, не нравится → −). Возвращает
 * Map<token, weight>. Используется для сравнения с кандидатами.
 */
export function buildCategoryProfile(movies = [], actionWeightFn) {
  const profile = new Map();
  for (const m of movies) {
    const w = actionWeightFn ? actionWeightFn(m) : 1;
    if (!w) continue;
    const cats = extractFilmCategories(m);
    for (const token of cats.allTokens) {
      profile.set(token, (profile.get(token) || 0) + w);
    }
  }
  return profile;
}

/**
 * categoryMatch — насколько кандидат совпадает с положительными
 * категориями профиля. Возвращает { score(0..1), matched:[токены] }.
 */
export function categoryMatch(candidateMovie, categoryProfile) {
  const cats = extractFilmCategories(candidateMovie);
  if (!cats.allTokens.length) return { score: 0, matched: [], categories: cats };
  let hit = 0;
  const matched = [];
  for (const token of cats.allTokens) {
    const w = categoryProfile.get(token) || 0;
    if (w > 0) { hit += 1; matched.push(token); }
  }
  const score = hit / cats.allTokens.length;
  return { score, matched, categories: cats };
}

/** Человекочитаемые названия совпавших категорий (для UI). */
export function prettyCategories(tokens = [], limit = 6) {
  const LABELS = {
    'mood:dark': 'мрачное', 'mood:tense': 'напряжённое', 'mood:light': 'лёгкое',
    'mood:emotional': 'эмоциональное', 'mood:epic': 'эпичное', 'mood:inspiring': 'вдохновляющее',
    'mood:calm': 'спокойное',
    'pace:fast': 'динамичное', 'pace:slow': 'медленное', 'pace:medium': 'средний темп',
    'tone:serious': 'серьёзное', 'tone:light': 'несерьёзное', 'tone:philosophical': 'философское',
    'tone:romantic': 'романтичное',
    'emotion:laugh': 'посмеяться', 'emotion:cry': 'тронуть', 'emotion:think': 'подумать',
    'emotion:relax': 'расслабиться', 'emotion:adrenaline': 'адреналин',
    'complexity:complex': 'сложный сюжет', 'complexity:easy': 'простой сюжет',
    'theme:war': 'война', 'theme:love': 'любовь', 'theme:family': 'семья',
    'theme:friendship': 'дружба', 'theme:revenge': 'месть', 'theme:survival': 'выживание',
    'theme:loneliness': 'одиночество', 'theme:ambition': 'амбиции', 'theme:space': 'космос',
    'theme:future': 'будущее', 'theme:technology': 'технологии', 'theme:history': 'история',
    'setting:space': 'космос', 'setting:war': 'война', 'setting:historical': 'историческое',
    'setting:school': 'школа', 'setting:city': 'город', 'setting:future': 'будущее',
    'visual:animated': 'анимация', 'visual:stylized': 'стилизованное', 'visual:realistic': 'реалистичное'
  };
  const out = [];
  for (const t of tokens) {
    if (t.startsWith('genre:')) out.push(t.slice(6));
    else if (LABELS[t]) out.push(LABELS[t]);
  }
  return uniq(out).slice(0, limit);
}
