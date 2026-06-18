export const RUNTIME_SPLIT = 90;
export const WATCH_NOW_LIMIT = 5;
export const WATCH_NOW_LIST_LIMIT = 3;
export const WATCH_NOW_MIN_NEW = 2;

export const MOOD_GENRE_PATTERNS = {
  light: ['комед', 'мульт', 'семей'],
  heavy: ['драм', 'воен', 'истор', 'биограф'],
  romance: ['мелодрам', 'романт'],
  puzzle: ['детект', 'триллер', 'кримин', 'загад'],
  action: ['боевик', 'приключ', 'экшен']
};

/** TMDB genre IDs (OR via pipe in discover API) */
export const MOOD_TMDB_GENRES = {
  light: [35, 16, 10751],
  heavy: [18, 10752, 36],
  romance: [10749],
  puzzle: [9648, 53, 80],
  action: [28, 12]
};

export const DURATION_LABELS = {
  short: 'до полутора часов (≤90 мин)',
  long: 'больше полутора часов (>90 мин)'
};

export const MOOD_LABELS = {
  light: 'лёгкое',
  heavy: 'тяжёлое',
  romance: 'романтика',
  puzzle: 'мозголомка',
  action: 'экшен'
};

export function normalizeWatchTitle(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .trim();
}

export function getMovieRuntime(movie) {
  const runtime = movie?.meta?.runtime;
  return typeof runtime === 'number' && runtime > 0 ? runtime : null;
}

export function matchesDuration(movie, duration) {
  if (!duration || duration === 'any') return true;
  const runtime = getMovieRuntime(movie);
  if (runtime == null) return false;
  if (duration === 'short') return runtime <= RUNTIME_SPLIT;
  if (duration === 'long') return runtime > RUNTIME_SPLIT;
  return true;
}

export function moodScore(movie, mood) {
  const patterns = MOOD_GENRE_PATTERNS[mood];
  if (!patterns?.length) return 0;
  const genres = (movie.genres || []).map((g) => g.toLowerCase()).join(' ');
  return patterns.reduce((score, pattern) => (
    genres.includes(pattern) ? score + 1 : score
  ), 0);
}

export function runtimeSortValue(movie, duration) {
  const runtime = getMovieRuntime(movie);
  if (runtime == null) return Number.MAX_SAFE_INTEGER;
  if (duration === 'short') return runtime;
  if (duration === 'long') return -runtime;
  return runtime;
}

export function scoreWatchNowMovie(movie, prefs) {
  let score = moodScore(movie, prefs.mood) * 10;
  if (movie.status === 'watching') score += 3;

  const runtime = getMovieRuntime(movie);
  if (runtime != null && prefs.duration === 'short') {
    score += Math.max(0, (RUNTIME_SPLIT - runtime) / 5);
  } else if (runtime != null && prefs.duration === 'long') {
    score += Math.max(0, (runtime - RUNTIME_SPLIT) / 5);
  }

  return score;
}

export function filterWatchNowPool(movies, prefs) {
  let pool = movies.filter((m) => m.status === 'want' || m.status === 'watching');

  if (prefs.mediaType && prefs.mediaType !== 'both') {
    pool = pool.filter((m) => (m.mediaType || 'movie') === prefs.mediaType);
  }

  if (prefs.duration && prefs.duration !== 'any') {
    pool = pool.filter((m) => matchesDuration(m, prefs.duration));
  }

  return pool;
}

export function rankWatchNowCandidates(movies, prefs) {
  const pool = filterWatchNowPool(movies, prefs);
  if (!pool.length) return [];

  return pool
    .map((movie) => ({ movie, score: scoreWatchNowMovie(movie, prefs) }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return runtimeSortValue(a.movie, prefs.duration) - runtimeSortValue(b.movie, prefs.duration);
    });
}

export function formatWatchNowPick(movie, prefs, statusLabels = {}) {
  const durationLabel = prefs.duration === 'long'
    ? 'больше полутора часов'
    : 'до полутора часов';
  const statusLabel = statusLabels[movie.status] || movie.status;

  return {
    title: movie.title,
    reason: `Из вашего списка · ${statusLabel}`,
    whyDetailed: getMovieRuntime(movie)
      ? `~${getMovieRuntime(movie)} мин — ${durationLabel}, ${MOOD_LABELS[prefs.mood] || 'под ваш запрос'}.`
      : `Подходит под настроение (${durationLabel}).`,
    fromList: true,
    movieId: movie.id,
    poster: movie.meta?.poster,
    year: movie.meta?.year,
    originalTitle: movie.meta?.originalTitle,
    runtime: getMovieRuntime(movie),
    mediaType: movie.mediaType || 'movie'
  };
}

export function pickWatchNowLocal(movies, prefs, limit = WATCH_NOW_LIMIT, statusLabels = {}) {
  return rankWatchNowCandidates(movies, prefs)
    .slice(0, limit)
    .map(({ movie }) => formatWatchNowPick(movie, prefs, statusLabels));
}

export function findMovieByPickTitle(movies, title) {
  const normalized = normalizeWatchTitle(title);
  return movies.find((m) => normalizeWatchTitle(m.title) === normalized)
    || movies.find((m) => normalizeWatchTitle(m.meta?.originalTitle) === normalized)
    || movies.find((m) => normalizeWatchTitle(m.meta?.matchedTitle) === normalized);
}

export function isTitleInUserList(movies, title) {
  return !!findMovieByPickTitle(movies, title);
}

export function getPickRuntime(pick, movies) {
  if (typeof pick?.runtime === 'number' && pick.runtime > 0) return pick.runtime;
  const movie = findMovieByPickTitle(movies, pick?.title);
  return getMovieRuntime(movie);
}

export function matchesPickDuration(pick, movies, duration) {
  if (!duration || duration === 'any') return true;
  if (pick.durationVerified) return true;
  const runtime = getPickRuntime(pick, movies);
  if (runtime == null) return false;
  if (duration === 'short') return runtime <= RUNTIME_SPLIT;
  if (duration === 'long') return runtime > RUNTIME_SPLIT;
  return true;
}

export function filterPicksByDuration(picks, movies, prefs) {
  if (!prefs?.duration || prefs.duration === 'any') return picks || [];
  return (picks || []).filter((pick) => matchesPickDuration(pick, movies, prefs.duration));
}

export function formatNewWatchNowPick(pick, prefs) {
  return {
    title: pick.title,
    reason: pick.reason || 'Новая рекомендация',
    whyDetailed: pick.whyDetailed || '',
    fromList: false,
    poster: pick.poster || null,
    year: pick.year || null,
    originalTitle: pick.originalTitle || null,
    runtime: pick.runtime || null,
    durationVerified: pick.durationVerified || false,
    mediaType: pick.mediaType || prefs.mediaType || 'movie'
  };
}

function fillWatchNowMerged(listPicks, newPicks, limit) {
  const merged = [];
  let listIdx = 0;
  let newIdx = 0;
  const listCap = Math.min(WATCH_NOW_LIST_LIMIT, listPicks.length);

  while (merged.length < limit && listIdx < listCap) {
    merged.push(listPicks[listIdx++]);
  }
  while (merged.length < limit && newIdx < newPicks.length) {
    merged.push(newPicks[newIdx++]);
  }
  while (merged.length < limit && listIdx < listPicks.length) {
    merged.push(listPicks[listIdx++]);
  }
  while (merged.length < limit && newIdx < newPicks.length) {
    merged.push(newPicks[newIdx++]);
  }

  return merged.slice(0, limit);
}

export function mergeWatchNowPicks(rawPicks, movies, prefs, options = {}) {
  const {
    limit = WATCH_NOW_LIMIT,
    statusLabels = {},
    excludeTitles = []
  } = options;

  const exclude = new Set(excludeTitles.map(normalizeWatchTitle));
  const ranked = rankWatchNowCandidates(movies, prefs);
  const allowedListTitles = new Set(
    ranked.map(({ movie }) => normalizeWatchTitle(movie.title))
  );

  const listPicks = [];
  const newPicks = [];
  const seen = new Set();

  for (const pick of rawPicks || []) {
    const normalized = normalizeWatchTitle(pick.title);
    if (!pick.title || seen.has(normalized) || exclude.has(normalized)) continue;

    const movie = findMovieByPickTitle(movies, pick.title);
    const inList = movie && allowedListTitles.has(normalizeWatchTitle(movie.title));

    if (inList) {
      const formatted = formatWatchNowPick(movie, prefs, statusLabels);
      if (!matchesPickDuration(formatted, movies, prefs.duration)) continue;
      seen.add(normalized);
      listPicks.push({
        ...formatted,
        reason: pick.reason || formatted.reason,
        whyDetailed: pick.whyDetailed || formatted.whyDetailed
      });
    } else if (!isTitleInUserList(movies, pick.title)) {
      const formatted = formatNewWatchNowPick(pick, prefs);
      if (!matchesPickDuration(formatted, movies, prefs.duration)) continue;
      seen.add(normalized);
      newPicks.push(formatted);
    }
  }

  for (const { movie } of ranked) {
    const normalized = normalizeWatchTitle(movie.title);
    if (seen.has(normalized) || exclude.has(normalized)) continue;
    const formatted = formatWatchNowPick(movie, prefs, statusLabels);
    if (!matchesPickDuration(formatted, movies, prefs.duration)) continue;
    seen.add(normalized);
    listPicks.push(formatted);
  }

  return filterPicksByDuration(
    fillWatchNowMerged(listPicks, newPicks, limit).slice(0, WATCH_NOW_LIMIT),
    movies,
    prefs
  );
}

export function buildWatchNowCandidateSummary(candidates) {
  return candidates.map(({ movie, score }) => {
    const runtime = getMovieRuntime(movie);
    const genres = (movie.genres || []).join(', ') || 'без жанров';
    return `- ${movie.title} | ${runtime ? `${runtime} мин` : 'нет runtime'} | ${genres} | ${movie.status} | score ${score}`;
  }).join('\n');
}

export function buildWatchNowPromptCounts(listCandidateCount, limit = WATCH_NOW_LIMIT) {
  const fromList = Math.min(WATCH_NOW_LIST_LIMIT, listCandidateCount, limit - WATCH_NOW_MIN_NEW);
  const fromNew = limit - fromList;
  return { fromList, fromNew, total: limit };
}

function collectExcludedTitles(picks, excludeTitles = []) {
  return new Set([
    ...excludeTitles,
    ...(picks || []).map((pick) => pick.title)
  ].filter(Boolean).map(normalizeWatchTitle));
}

export function topUpWatchNowFromList(picks, movies, prefs, options = {}) {
  const limit = WATCH_NOW_LIMIT;
  const statusLabels = options.statusLabels || {};
  const exclude = collectExcludedTitles(picks, options.excludeTitles);
  const result = [...(picks || [])];
  const seen = new Set(result.map((pick) => normalizeWatchTitle(pick.title)));

  const tryAdd = (pick) => {
    const normalized = normalizeWatchTitle(pick.title);
    if (!pick.title || seen.has(normalized) || exclude.has(normalized)) return;
    if (!matchesPickDuration(pick, movies, prefs.duration)) return;
    seen.add(normalized);
    result.push(pick);
  };

  for (const { movie } of rankWatchNowCandidates(movies, prefs)) {
    if (result.length >= limit) break;
    tryAdd(formatWatchNowPick(movie, prefs, statusLabels));
  }

  return filterPicksByDuration(result.slice(0, limit), movies, prefs);
}

export function appendNewWatchNowPicks(picks, newItems, movies, prefs, options = {}) {
  const limit = WATCH_NOW_LIMIT;
  const exclude = collectExcludedTitles(picks, options.excludeTitles);
  const result = [...(picks || [])];
  const seen = new Set(result.map((pick) => normalizeWatchTitle(pick.title)));

  for (const pick of newItems || []) {
    if (result.length >= limit) break;
    const normalized = normalizeWatchTitle(pick.title);
    if (!pick.title || seen.has(normalized) || exclude.has(normalized)) continue;
    if (isTitleInUserList(movies, pick.title)) continue;
    const formatted = formatNewWatchNowPick(pick, prefs);
    if (!matchesPickDuration(formatted, movies, prefs.duration)) continue;
    seen.add(normalized);
    result.push(formatted);
  }

  return filterPicksByDuration(result.slice(0, limit), movies, prefs);
}

export function finalizeWatchNowPicks(picks, movies, prefs, options = {}) {
  const trimmed = (picks || []).slice(0, WATCH_NOW_LIMIT);
  return topUpWatchNowFromList(trimmed, movies, prefs, options);
}

export function isWatchNowComplete(picks) {
  return Array.isArray(picks) && picks.length === WATCH_NOW_LIMIT;
}
