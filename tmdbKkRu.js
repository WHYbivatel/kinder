/**
 * TMDB kk-KZ often returns English titles when Kazakh localization is missing.
 * For app language kk: keep Kazakh when localized, otherwise use ru-RU.
 */

const CYRILLIC_RE = /[а-яёәғқңөұүіһА-ЯЁӘҒҚҢӨҰҮІҺ]/;

export function tmdbItemTitle(raw) {
  return String(raw?.title || raw?.name || '').trim();
}

export function tmdbItemOriginal(raw) {
  return String(raw?.original_title || raw?.original_name || '').trim();
}

/** TMDB did not return a localized (kk/ru) title — usually the English original. */
export function needsRuTitleFallback(raw) {
  const title = tmdbItemTitle(raw);
  const original = tmdbItemOriginal(raw);
  if (!title) return true;
  if (!original) return !CYRILLIC_RE.test(title);
  if (title !== original) {
    return !CYRILLIC_RE.test(title);
  }
  return true;
}

export function mergeKkRuItem(kkRaw, ruRaw) {
  if (!kkRaw) return ruRaw || null;
  if (!ruRaw) return kkRaw;
  const merged = { ...kkRaw };
  if (needsRuTitleFallback(kkRaw)) {
    const ruTitle = tmdbItemTitle(ruRaw);
    if (ruTitle) {
      // Фильмы — title, сериалы — name; downstream читает title || name.
      merged.title = ruRaw.title ?? ruRaw.name ?? ruTitle;
      merged.name = ruRaw.name ?? ruRaw.title ?? ruTitle;
    }
  }
  if (!(merged.overview || '').trim() && (ruRaw.overview || '').trim()) {
    merged.overview = ruRaw.overview;
  }
  return merged;
}

export function mergeKkRuList(kkData, ruData) {
  if (!kkData) return ruData || null;
  if (!ruData || !Array.isArray(kkData.results)) return kkData;
  const ruById = new Map((ruData.results || []).map((r) => [r.id, r]));
  return {
    ...kkData,
    results: kkData.results.map((item) => mergeKkRuItem(item, ruById.get(item.id)))
  };
}

function inferTmdbMediaType(endpoint) {
  return /\/tv(\/|$)/.test(String(endpoint || '')) ? 'tv' : 'movie';
}

/** kk-списки TMDB часто содержат id, которых нет в ru-ответе того же эндпоинта. */
export async function enrichMissingRuTitles(results, endpoint, tmdbFetchRaw) {
  if (!Array.isArray(results) || !results.length || !tmdbFetchRaw) return results;
  const pending = results.filter(needsRuTitleFallback);
  if (!pending.length) return results;

  const mediaType = inferTmdbMediaType(endpoint);
  const ruById = new Map(
    await Promise.all(
      pending.map(async (item) => {
        const ru = await tmdbFetchRaw(`/${mediaType}/${item.id}`, {}, { language: 'ru-RU' });
        return [item.id, ru];
      })
    )
  );

  return results.map((item) => {
    const ru = ruById.get(item.id);
    return ru ? mergeKkRuItem(item, ru) : item;
  });
}

export function isKkAppLang(lang) {
  const raw = String(lang || '').toLowerCase();
  return raw === 'kk' || raw === 'kz' || raw === 'kk-kz';
}

/** Первый непустой текст из primary и fallback-цепочки (overview, biography, …). */
export function pickLocalizedText(primary, ...fallbacks) {
  const first = String(primary || '').trim();
  if (first) return first;
  for (const fb of fallbacks) {
    const text = String(fb || '').trim();
    if (text) return text;
  }
  return '';
}
