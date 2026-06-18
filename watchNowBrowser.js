(function () {
  const RUNTIME_SPLIT = 90;
  const WATCH_NOW_LIMIT = 5;
  const WATCH_NOW_LIST_LIMIT = 3;
  const WATCH_NOW_MIN_NEW = 2;

  const MOOD_GENRE_PATTERNS = {
    light: ['комед', 'мульт', 'семей'],
    heavy: ['драм', 'воен', 'истор', 'биограф'],
    romance: ['мелодрам', 'романт'],
    puzzle: ['детект', 'триллер', 'кримин', 'загад'],
    action: ['боевик', 'приключ', 'экшен']
  };

  const MOOD_LABELS = {
    light: 'лёгкое',
    heavy: 'тяжёлое',
    romance: 'романтика',
    puzzle: 'мозголомка',
    action: 'экшен'
  };

  const STATUS_LABELS = {
    want: 'Хочу посмотреть',
    watching: 'Смотрю',
    watched: 'Посмотрел'
  };

  function normalizeTitle(text) {
    return String(text || '').toLowerCase().replace(/ё/g, 'е').trim();
  }

  function getMovieRuntime(movie) {
    const runtime = movie?.meta?.runtime;
    return typeof runtime === 'number' && runtime > 0 ? runtime : null;
  }

  function matchesDuration(movie, duration) {
    if (!duration || duration === 'any') return true;
    const runtime = getMovieRuntime(movie);
    if (runtime == null) return false;
    if (duration === 'short') return runtime <= RUNTIME_SPLIT;
    if (duration === 'long') return runtime > RUNTIME_SPLIT;
    return true;
  }

  function moodScore(movie, mood) {
    const patterns = MOOD_GENRE_PATTERNS[mood];
    if (!patterns?.length) return 0;
    const genres = (movie.genres || []).map((g) => g.toLowerCase()).join(' ');
    return patterns.reduce((score, pattern) => (
      genres.includes(pattern) ? score + 1 : score
    ), 0);
  }

  function runtimeSortValue(movie, duration) {
    const runtime = getMovieRuntime(movie);
    if (runtime == null) return Number.MAX_SAFE_INTEGER;
    if (duration === 'short') return runtime;
    if (duration === 'long') return -runtime;
    return runtime;
  }

  function scoreWatchNowMovie(movie, prefs) {
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

  function filterWatchNowPool(movies, prefs) {
    let pool = movies.filter((m) => m.status === 'want' || m.status === 'watching');
    if (prefs.mediaType && prefs.mediaType !== 'both') {
      pool = pool.filter((m) => (m.mediaType || 'movie') === prefs.mediaType);
    }
    if (prefs.duration && prefs.duration !== 'any') {
      pool = pool.filter((m) => matchesDuration(m, prefs.duration));
    }
    return pool;
  }

  function rankWatchNowCandidates(movies, prefs) {
    const pool = filterWatchNowPool(movies, prefs);
    if (!pool.length) return [];
    return pool
      .map((movie) => ({ movie, score: scoreWatchNowMovie(movie, prefs) }))
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return runtimeSortValue(a.movie, prefs.duration) - runtimeSortValue(b.movie, prefs.duration);
      });
  }

  function formatWatchNowPick(movie, prefs) {
    const durationLabel = prefs.duration === 'long'
      ? 'больше полутора часов'
      : 'до полутора часов';
    return {
      title: movie.title,
      reason: `Из вашего списка · ${STATUS_LABELS[movie.status] || movie.status}`,
      whyDetailed: getMovieRuntime(movie)
        ? `~${getMovieRuntime(movie)} мин — ${durationLabel}, ${MOOD_LABELS[prefs.mood] || 'под ваш запрос'}.`
        : `Подходит под настроение (${durationLabel}).`,
      fromList: true,
      poster: movie.meta?.poster,
      year: movie.meta?.year,
      runtime: getMovieRuntime(movie),
      mediaType: movie.mediaType || 'movie'
    };
  }

  function formatNewWatchNowPick(pick, prefs) {
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

  function findMovieTitle(movies, title) {
    const normalized = normalizeTitle(title);
    return movies.find((m) => normalizeTitle(m.title) === normalized)
      || movies.find((m) => normalizeTitle(m.meta?.originalTitle) === normalized)
      || movies.find((m) => normalizeTitle(m.meta?.matchedTitle) === normalized);
  }

  function isTitleInUserList(movies, title) {
    return !!findMovieTitle(movies, title);
  }

  function getPickRuntime(pick, movies) {
    if (typeof pick?.runtime === 'number' && pick.runtime > 0) return pick.runtime;
    const movie = findMovieTitle(movies, pick?.title);
    return getMovieRuntime(movie);
  }

  function matchesPickDuration(pick, movies, duration) {
    if (!duration || duration === 'any') return true;
    if (pick.durationVerified) return true;
    const runtime = getPickRuntime(pick, movies);
    if (runtime == null) return false;
    if (duration === 'short') return runtime <= RUNTIME_SPLIT;
    if (duration === 'long') return runtime > RUNTIME_SPLIT;
    return true;
  }

  function filterPicksByDuration(picks, movies, prefs) {
    if (!prefs?.duration || prefs.duration === 'any') return picks || [];
    return (picks || []).filter((pick) => matchesPickDuration(pick, movies, prefs.duration));
  }

  function fillWatchNowMerged(listPicks, newPicks, limit) {
    const merged = [];
    let listIdx = 0;
    let newIdx = 0;
    const listCap = Math.min(WATCH_NOW_LIST_LIMIT, listPicks.length);

    while (merged.length < limit && listIdx < listCap) merged.push(listPicks[listIdx++]);
    while (merged.length < limit && newIdx < newPicks.length) merged.push(newPicks[newIdx++]);
    while (merged.length < limit && listIdx < listPicks.length) merged.push(listPicks[listIdx++]);
    while (merged.length < limit && newIdx < newPicks.length) merged.push(newPicks[newIdx++]);

    return merged.slice(0, limit);
  }

  window.WatchNow = {
    pickWatchNowLocal(movies, prefs, limit = WATCH_NOW_LIMIT) {
      return rankWatchNowCandidates(movies, prefs)
        .slice(0, limit)
        .map(({ movie }) => formatWatchNowPick(movie, prefs));
    },
    mergeWatchNowPicks(rawPicks, movies, prefs, options = {}) {
      const { limit = WATCH_NOW_LIMIT, excludeTitles = [] } = options;
      const exclude = new Set(excludeTitles.map(normalizeTitle));
      const ranked = rankWatchNowCandidates(movies, prefs);
      const allowed = new Set(ranked.map(({ movie }) => normalizeTitle(movie.title)));

      const listPicks = [];
      const newPicks = [];
      const seen = new Set();

      for (const pick of rawPicks || []) {
        const normalized = normalizeTitle(pick.title);
        if (!pick.title || seen.has(normalized) || exclude.has(normalized)) continue;

        const movie = findMovieTitle(movies, pick.title);
        const inList = movie && allowed.has(normalizeTitle(movie.title));

        if (inList) {
          const formatted = formatWatchNowPick(movie, prefs);
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
        const normalized = normalizeTitle(movie.title);
        if (seen.has(normalized) || exclude.has(normalized)) continue;
        const formatted = formatWatchNowPick(movie, prefs);
        if (!matchesPickDuration(formatted, movies, prefs.duration)) continue;
        seen.add(normalized);
        listPicks.push(formatted);
      }

      return filterPicksByDuration(
        fillWatchNowMerged(listPicks, newPicks, limit).slice(0, WATCH_NOW_LIMIT),
        movies,
        prefs
      );
    },
    topUpWatchNowFromList(picks, movies, prefs, options = {}) {
      const limit = WATCH_NOW_LIMIT;
      const exclude = new Set([
        ...(options.excludeTitles || []),
        ...(picks || []).map((pick) => pick.title)
      ].filter(Boolean).map(normalizeTitle));
      const result = [...(picks || [])];
      const seen = new Set(result.map((pick) => normalizeTitle(pick.title)));

      const tryAdd = (pick) => {
        const normalized = normalizeTitle(pick.title);
        if (!pick.title || seen.has(normalized) || exclude.has(normalized)) return;
        if (!matchesPickDuration(pick, movies, prefs.duration)) return;
        seen.add(normalized);
        result.push(pick);
      };

      for (const { movie } of rankWatchNowCandidates(movies, prefs)) {
        if (result.length >= limit) break;
        tryAdd(formatWatchNowPick(movie, prefs));
      }

      return filterPicksByDuration(result.slice(0, limit), movies, prefs);
    },
    filterPicksByDuration,
    isWatchNowComplete(picks) {
      return Array.isArray(picks) && picks.length === WATCH_NOW_LIMIT;
    }
  };
})();
