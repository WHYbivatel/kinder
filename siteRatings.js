/* ===================================================================
   siteRatings.js — средняя оценка фильма ПО САЙТУ среди пользователей.

   В отличие от внешних рейтингов (IMDb/Кинопоиск) и от «социальных»
   счётчиков лайков/дизлайков из свайпов, здесь усредняются реальные
   оценки 1–10, которые пользователи ставят фильмам в своих списках.

   Модуль чистый: данные (списки всех пользователей) и функция-ключ
   передаются снаружи. Возвращает Map<key, { average, count, sum }>.
   =================================================================== */

/**
 * buildSiteRatings — агрегирует оценки по всем пользователям.
 * allUsers: [{ username, movies }]
 * keyFn(movie) -> стабильный ключ фильма (как в остальной системе)
 */
export function buildSiteRatings(allUsers = [], keyFn) {
  const acc = new Map(); // key -> { sum, count, title, tmdbId, mediaType }
  for (const { movies = [] } of allUsers) {
    for (const m of movies) {
      const rating = Number(m.rating);
      if (!Number.isFinite(rating) || rating < 1 || rating > 10) continue;
      const key = keyFn(m);
      if (!key) continue;
      const cur = acc.get(key) || {
        sum: 0, count: 0,
        title: m.title, tmdbId: m.tmdbId || null, mediaType: m.mediaType || 'movie'
      };
      cur.sum += rating;
      cur.count += 1;
      acc.set(key, cur);
    }
  }
  const out = new Map();
  for (const [key, v] of acc) {
    out.set(key, {
      average: Math.round((v.sum / v.count) * 10) / 10, // одна десятая
      count: v.count,
      title: v.title,
      tmdbId: v.tmdbId,
      mediaType: v.mediaType
    });
  }
  return out;
}
