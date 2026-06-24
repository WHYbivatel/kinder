/* ===================================================================
   hybrid.js — гибридные рекомендации: коллаборативная фильтрация
   (по поведению ДРУГИХ пользователей) + смешивание с content-based,
   популярностью сообщества и качеством (внешние рейтинги).

   Модуль чистый: НЕ читает файлы и не импортирует server.js. Все данные
   (списки всех пользователей, профиль вкуса, социальные счётчики)
   передаются снаружи — это делает функции тестируемыми. Опирается на
   recommendationEngine (профиль вкуса) и filmCategories (категории);
   обратный ре-экспорт в recommendationEngine безопасен, т.к. кросс-модульные
   функции вызываются только во время запроса, а не на этапе загрузки.

   ── Как это работает ──────────────────────────────────────────────
   1. buildUserItemMatrix(): строки — пользователи, столбцы — фильмы,
      значение — вес действия (watched+высокая оценка = сильный +,
      blacklist/низкая оценка = −). Это «система матриц» из ТЗ.
   2. calculateUserSimilarity(): косинусная близость двух пользователей
      по их строкам матрицы. Если общих фильмов мало — fallback на
      косинус по их жанровым векторам (профилям вкуса).
   3. findSimilarUsers(): топ соседей по близости.
   4. getCollaborativeScores(): фильмы, которые соседи оценили высоко,
      а у текущего пользователя их нет, получают коллаборативный балл,
      взвешенный близостью соседа.
   5. blendRecommendation(): итоговый score =
         wContent*content + wCollab*collab + wPopular*social + wQuality*rating
      Веса вынесены в HYBRID_WEIGHTS (легко менять).
   =================================================================== */

import { buildUserTasteProfile } from './recommendationEngine.js';
import { buildCategoryProfile, categoryMatch, prettyCategories } from './filmCategories.js';

// Весовые коэффициенты гибридного скоринга. Меняются в одном месте.
// Усилен вклад «похожих пользователей» (collaborative): теперь то, что
// понравилось людям с похожим вкусом, влияет на итог сильнее, чем раньше.
export const HYBRID_WEIGHTS = {
  content: 0.34,      // личный вкус (content-based движок)
  collaborative: 0.42, // похожие пользователи (усилено)
  popularity: 0.12,   // популярность внутри приложения (лайки всех)
  quality: 0.12       // внешние рейтинги / качество
};

// Порог близости, ниже которого пользователь не считается «похожим».
// Снижен, чтобы находить больше соседей и активнее использовать коллаборацию.
const SIMILARITY_THRESHOLD = 0.08;
// Минимум общих фильмов, чтобы доверять косинусу по фильмам (иначе fallback).
const MIN_SHARED_ITEMS = 2;

function norm(text) {
  return String(text || '').toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();
}

export function movieKey(m) {
  const mediaType = m?.mediaType || 'movie';
  if (m?.tmdbId) return `${mediaType}:tmdb:${m.tmdbId}`;
  const t = norm(m?.title || m?.meta?.originalTitle);
  return t ? `${mediaType}:title:${t}` : null;
}

/* Вес действия пользователя над фильмом для матрицы.
   watched + 9-10 = очень сильный сигнал (+2), 7-8 = хороший (+1.2),
   want = слабый интерес (+0.4), низкая оценка = отрицательный сигнал. */
export function actionWeight(movie, prefs = null) {
  const status = movie.status || 'want';
  const rating = movie.rating;
  let w = 0;

  if (status === 'watched') {
    if (rating == null) w = 0.6;
    else if (rating >= 9) w = 2;
    else if (rating >= 8) w = 1.4;
    else if (rating === 7) w = 1;
    else if (rating === 6) w = 0.4;
    else if (rating === 5) w = 0;
    else if (rating === 4) w = -0.6;
    else w = -1.2; // 1-3
  } else if (status === 'want' || status === 'watching') {
    w = 0.4;
  }

  if (movie.notes?.liked?.trim()) w += 0.5;
  if (movie.notes?.disliked?.trim()) w -= 0.6;

  // Результаты «битвы фильмов» усиливают/ослабляют сигнал в матрице
  // пользователь×фильм: победы и высокий battleScore — плюс, поражения —
  // небольшой минус. Так битвы влияют и на коллаборативную часть, и на
  // категорийный профиль (он строится через тот же actionWeight).
  if ((movie.battleWins || 0) > 0) w += Math.min(0.6, movie.battleWins * 0.2);
  if ((movie.battleLosses || 0) > 0) w -= Math.min(0.4, movie.battleLosses * 0.1);
  if (movie.battleScore) w += Math.max(-0.5, Math.min(0.6, movie.battleScore / 100));

  // blacklist по названию (если переданы prefs) — отрицательный сигнал
  if (prefs?.blacklist?.titles?.some((t) => norm(t) === norm(movie.title))) w = -2;

  return w;
}

/* Жанровый вектор пользователя (для fallback-похожести): суммарный вес
   по жанрам всех его фильмов. */
function genreVector(movies) {
  const vec = new Map();
  for (const m of movies) {
    const w = actionWeight(m);
    for (const g of (m.genres || [])) {
      const key = norm(g);
      vec.set(key, (vec.get(key) || 0) + w);
    }
  }
  return vec;
}

/**
 * buildUserItemMatrix — строит матрицу пользователь×фильм и индекс фильмов.
 * allUsers: [{ username, movies, prefs }]
 * Возвращает { matrix: Map<user, Map<key, weight>>, genres: Map<user, Map<genre, weight>>,
 *              index: Map<key, { title, tmdbId, mediaType, poster, genres }> }
 */
export function buildUserItemMatrix(allUsers = []) {
  const matrix = new Map();
  const genres = new Map();
  const index = new Map();

  for (const { username, movies = [], prefs = null } of allUsers) {
    const row = new Map();
    for (const m of movies) {
      const key = movieKey(m);
      if (!key) continue;
      row.set(key, actionWeight(m, prefs));
      if (!index.has(key)) {
        index.set(key, {
          title: m.title,
          tmdbId: m.tmdbId || null,
          mediaType: m.mediaType || 'movie',
          poster: m.meta?.poster || null,
          genres: m.genres || [],
          year: m.meta?.year || null,
          voteAverage: m.meta?.imdb?.rating || m.meta?.kinopoisk?.rating || null
        });
      }
    }
    matrix.set(username, row);
    genres.set(username, genreVector(movies));
  }

  return { matrix, genres, index };
}

function cosine(aMap, bMap) {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (const v of aMap.values()) na += v * v;
  for (const v of bMap.values()) nb += v * v;
  // итерируем по меньшей карте
  const [small, big] = aMap.size <= bMap.size ? [aMap, bMap] : [bMap, aMap];
  for (const [k, v] of small) {
    const o = big.get(k);
    if (o !== undefined) dot += v * o;
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

function sharedCount(aMap, bMap) {
  let c = 0;
  const [small, big] = aMap.size <= bMap.size ? [aMap, bMap] : [bMap, aMap];
  for (const k of small.keys()) if (big.has(k)) c += 1;
  return c;
}

/**
 * calculateUserSimilarity — косинус по фильмам; при нехватке общих фильмов
 * откатываемся на косинус по жанровым векторам. Возвращает 0..1.
 */
export function calculateUserSimilarity(userA, userB, model) {
  const aRow = model.matrix.get(userA);
  const bRow = model.matrix.get(userB);
  if (!aRow || !bRow) return 0;

  if (sharedCount(aRow, bRow) >= MIN_SHARED_ITEMS) {
    return cosine(aRow, bRow);
  }
  // Fallback по жанрам/категориям (данных по фильмам мало).
  const ag = model.genres.get(userA);
  const bg = model.genres.get(userB);
  if (ag && bg) return cosine(ag, bg) * 0.7; // чуть осторожнее, чем точное совпадение
  return 0;
}

/**
 * findSimilarUsers — топ соседей текущего пользователя по близости.
 * Возвращает [{ username, sim }] (sim убыванием), отфильтровано по порогу.
 */
export function findSimilarUsers(username, model, limit = 8) {
  const out = [];
  for (const other of model.matrix.keys()) {
    if (other === username) continue;
    const sim = calculateUserSimilarity(username, other, model);
    if (sim >= SIMILARITY_THRESHOLD) out.push({ username: other, sim });
  }
  out.sort((a, b) => b.sim - a.sim);
  return out.slice(0, limit);
}

/**
 * getCollaborativeScores — для фильмов, которые соседи оценили высоко и
 * которых нет у пользователя, считаем коллаборативный балл, взвешенный
 * близостью соседа. Возвращает Map<key, { score(0..1), neighbors:Set, ref }>.
 *
 * excludeKeys — фильмы пользователя/blacklist (не рекомендуем).
 */
export function getCollaborativeScores(username, model, { excludeKeys = new Set() } = {}) {
  const neighbors = findSimilarUsers(username, model);
  const scores = new Map();
  if (!neighbors.length) return { scores, neighbors };

  for (const { username: nb, sim } of neighbors) {
    const row = model.matrix.get(nb);
    if (!row) continue;
    for (const [key, weight] of row) {
      if (weight < 0.6) continue;            // сосед должен любить фильм
      if (excludeKeys.has(key)) continue;    // уже у пользователя/в blacklist
      const cur = scores.get(key) || { raw: 0, neighbors: new Set(), ref: model.index.get(key) };
      cur.raw += sim * weight;
      cur.neighbors.add(nb);
      scores.set(key, cur);
    }
  }

  // Бонус за согласие нескольких соседей: фильм, который любят сразу
  // несколько похожих пользователей — более надёжный сигнал.
  for (const v of scores.values()) {
    if (v.neighbors.size > 1) v.raw *= 1 + Math.min(0.5, (v.neighbors.size - 1) * 0.15);
  }

  // Нормируем raw → 0..1 (всегда задаём score, чтобы не было undefined)
  let max = 0;
  for (const v of scores.values()) max = Math.max(max, v.raw);
  for (const v of scores.values()) v.score = max > 0 ? v.raw / max : 0;
  return { scores, neighbors };
}

/* ── Смешивание (hybrid scoring) ─────────────────────────────────── */

function clamp01(v) { return Math.max(0, Math.min(1, v)); }

/**
 * blendRecommendation — считает итоговый score и собирает объяснимость.
 * Вход — сигналы 0..1 (кроме social: -1..1). Возвращает
 * { finalScore, source, signals }.
 */
export function blendRecommendation({ contentScore = 0, collabScore = 0, socialScore = 0, ratingScore = 0 }, weights = HYBRID_WEIGHTS) {
  const popularityScore = clamp01((socialScore + 1) / 2); // -1..1 → 0..1
  const finalScore =
    weights.content * clamp01(contentScore) +
    weights.collaborative * clamp01(collabScore) +
    weights.popularity * popularityScore +
    weights.quality * clamp01(ratingScore);

  let source = 'popular';
  if (contentScore > 0 && collabScore > 0) source = 'hybrid';
  else if (collabScore > 0) source = 'collaborative';
  else if (contentScore > 0) source = 'content-based';

  return {
    finalScore: Number(finalScore.toFixed(4)),
    source,
    signals: {
      contentScore: Number(clamp01(contentScore).toFixed(3)),
      collaborativeScore: Number(clamp01(collabScore).toFixed(3)),
      popularityScore: Number(popularityScore.toFixed(3)),
      ratingScore: Number(clamp01(ratingScore).toFixed(3))
    }
  };
}

/* ── Функции с «ожидаемыми» именами из ТЗ (п.8) ───────────────────
   Живут здесь, а в recommendationEngine.js ре-экспортируются, чтобы
   быть доступными и через привычный модуль движка. */

/** Профили вкуса всех пользователей: content-профиль + категорийный профиль. */
export function buildAllUsersProfiles(allUsers = []) {
  const profiles = new Map();
  for (const { username, movies = [], prefs = {} } of allUsers) {
    profiles.set(username, {
      taste: buildUserTasteProfile(movies, prefs),
      categories: buildCategoryProfile(movies, (m) => actionWeight(m, prefs))
    });
  }
  return profiles;
}

/** Content-based рекомендации = обёртка над движком (для единообразия API). */
export { recommendForUser as getContentBasedRecommendations } from './recommendationEngine.js';

/** Коллаборативные рекомендации в виде массива (а не Map) — удобно для API. */
export function getCollaborativeRecommendations(username, model, opts = {}) {
  const { scores, neighbors } = getCollaborativeScores(username, model, opts);
  const list = [];
  for (const [key, entry] of scores) {
    if (!entry.ref) continue;
    list.push({
      key,
      title: entry.ref.title,
      tmdbId: entry.ref.tmdbId,
      mediaType: entry.ref.mediaType,
      poster: entry.ref.poster,
      genres: entry.ref.genres,
      collaborativeScore: entry.score,
      similarUsersCount: entry.neighbors.size
    });
  }
  list.sort((a, b) => b.collaborativeScore - a.collaborativeScore);
  return { recommendations: list, similarUsersCount: neighbors.length };
}

/**
 * getHybridRecommendations — ЕДИНАЯ точка смешивания. Принимает уже готовые
 * content-рекомендации (recs) и данные, пересчитывает итоговый score с учётом:
 *   • контента (движок) + совпадения категорий (mood/pace/tone/themes/…)
 *   • поведения похожих пользователей (collaborative)
 *   • популярности сообщества (social)
 *   • качества (внешние рейтинги)
 * Добавляет объяснимость и дописывает collaborative-only кандидатов.
 *
 * deps:
 *   recs, currentMovies, prefs, model (user-item matrix),
 *   tasteProfile, categoryProfile, socialScoreFn(item)->[-1..1],
 *   collaborative (Map<key,{score,neighbors,ref}>) — источник коллаборации
 *   (можно из матрицы или из графа), neighbors (массив соседей), limit.
 */
export function getHybridRecommendations({
  recs = [], currentMovies = [], model = null,
  tasteProfile = null, categoryProfile = new Map(),
  socialScoreFn = () => 0, collaborative = new Map(),
  neighbors = [], limit = 10
}) {
  const excludeKeys = new Set();
  for (const m of currentMovies) {
    const k = movieKey(m);
    if (k) excludeKeys.add(k);
  }

  const maxContent = Math.max(0.0001, ...recs.map((r) => Number(r.score) || 0));

  // Совпавшие жанры из content-профиля (signed genreWeight > 0).
  const genreMatch = (genres = []) => {
    const out = [];
    if (!tasteProfile?.genreWeight) return out;
    for (const g of genres) {
      const cg = String(g || '').toLowerCase().replace(/ё/g, 'е').trim();
      if ((tasteProfile.genreWeight.get(cg) || 0) > 0) out.push(cg);
    }
    return out;
  };

  const blended = recs.map((r) => {
    const key = movieKey(r);
    const collabEntry = key ? collaborative.get(key) : null;
    const contentNorm = (Number(r.score) || 0) / maxContent;

    // Категорийное совпадение (mood/pace/tone/themes/setting/…)
    const cm = categoryMatch(r, categoryProfile);
    const contentScore = clamp01(0.65 * contentNorm + 0.35 * cm.score);

    const collabScore = collabEntry?.score || 0;
    const socialScore = socialScoreFn(r);
    const ratingScore = (Number(r.voteAverage) || 0) / 10;

    const { finalScore, source, signals } = blendRecommendation(
      { contentScore, collabScore, socialScore, ratingScore }
    );
    const similarUsersCount = collabEntry ? collabEntry.neighbors.size : 0;
    const matchedTokens = [...genreMatch(r.genres).map((g) => `genre:${g}`), ...cm.matched];
    const matchedCategories = prettyCategories(matchedTokens);

    return {
      ...r,
      score: finalScore,
      source,
      signals: { ...signals, categoryScore: Number(cm.score.toFixed(3)) },
      matchedCategories,
      similarUsersCount,
      reason: buildHybridReason({ source, matchedCategories, similarUsersCount, baseReason: r.reason }) || r.reason,
      whyDetailed: buildHybridWhy({ source, matchedCategories, similarUsersCount, base: r.whyDetailed })
    };
  });

  // Collaborative-only: фильмы соседей, которых нет в подборке.
  const present = new Set(blended.map((r) => movieKey(r)).filter(Boolean));
  const extras = [];
  for (const [key, entry] of collaborative) {
    if (present.has(key) || !entry.ref || !entry.ref.tmdbId) continue;
    if (!(entry.score > 0)) continue;
    const ref = entry.ref;
    const cm = categoryMatch(ref, categoryProfile);
    const socialScore = socialScoreFn(ref);
    const ratingScore = (Number(ref.voteAverage) || 0) / 10;
    const { finalScore, source, signals } = blendRecommendation(
      { contentScore: clamp01(0.35 * cm.score), collabScore: entry.score, socialScore, ratingScore }
    );
    const matchedTokens = [...genreMatch(ref.genres).map((g) => `genre:${g}`), ...cm.matched];
    const matchedCategories = prettyCategories(matchedTokens);
    extras.push({
      title: ref.title, year: ref.year || null, tmdbId: ref.tmdbId,
      mediaType: ref.mediaType || 'movie', poster: ref.poster || null,
      genres: ref.genres || [], voteAverage: ref.voteAverage || null,
      score: finalScore, source, signals: { ...signals, categoryScore: Number(cm.score.toFixed(3)) },
      matchedCategories, similarUsersCount: entry.neighbors.size,
      reason: buildHybridReason({ source, matchedCategories, similarUsersCount: entry.neighbors.size }),
      whyDetailed: buildHybridWhy({ source, matchedCategories, similarUsersCount: entry.neighbors.size })
    });
  }
  extras.sort((a, b) => b.score - a.score);

  const merged = [...blended, ...extras.slice(0, Math.max(4, Math.ceil(limit / 2)))];
  merged.sort((a, b) => (b.score || 0) - (a.score || 0));

  return { recommendations: merged, similarUsersCount: neighbors.length };
}

/** Человекопонятная причина с учётом источника и совпавших жанров. */
export function buildHybridReason({ source, matchedCategories = [], similarUsersCount = 0, baseReason = '' }) {
  const genres = matchedCategories.slice(0, 3).join(', ');
  const people = similarUsersCount === 1
    ? 'пользователю с похожим вкусом'
    : `${similarUsersCount} пользователям с похожим вкусом`;

  if (source === 'hybrid') {
    return genres
      ? `Вы любите похожие жанры (${genres}), а ещё это понравилось ${people}`
      : `Понравилось ${people} и подходит под ваш вкус`;
  }
  if (source === 'collaborative') {
    return `Понравилось ${people}`;
  }
  if (source === 'popular') {
    return 'Популярно у пользователей приложения';
  }
  return baseReason || (genres ? `Совпадает с вашими жанрами: ${genres}` : 'Подобрано под ваш вкус');
}

/** Развёрнутое объяснение (whyDetailed) с акцентом на похожих пользователей. */
export function buildHybridWhy({ source, matchedCategories = [], similarUsersCount = 0, base = '' }) {
  const genres = matchedCategories.slice(0, 3).join(', ');
  const people = similarUsersCount === 1
    ? 'пользователь с похожим на ваш вкусом'
    : `${similarUsersCount} пользователей с похожим на ваш вкусом`;

  if (source === 'hybrid') {
    const head = genres
      ? `Вы любите похожие жанры (${genres}), а ${people} высоко оценили этот фильм.`
      : `Подходит под ваш вкус, и ${people} высоко оценили этот фильм.`;
    return base ? `${head} ${base}` : head;
  }
  if (source === 'collaborative') {
    return `Этот фильм высоко оценили ${people}. Мы рекомендуем его, потому что ваши вкусы во многом совпадают.`;
  }
  return base || '';
}
