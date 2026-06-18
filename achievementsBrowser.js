(function () {
  const DEFS = [
    { id: 'watched_5_month', icon: '🎬', title: '5 фильмов за месяц', desc: '5+ просмотров за 30 дней' },
    { id: 'first_10', icon: '⭐', title: 'Первая десятка', desc: 'Оценка 10/10' },
    { id: 'director_3', icon: '🎥', title: 'Фанат режиссёра', desc: '3+ фильма одного режиссёра' },
    { id: 'week_streak', icon: '🔥', title: 'Активный месяц', desc: '4+ недели с просмотрами' },
    { id: 'watched_100', icon: '🏆', title: 'Сотня', desc: '100 просмотренных' },
    { id: 'series_started', icon: '📺', title: 'Сериальный', desc: 'Начали сериал' },
    { id: 'notes_10', icon: '📝', title: 'Критик', desc: 'Заметки к 10+ фильмам' },
    { id: 'genres_5', icon: '🌈', title: 'Разнообразие', desc: '5+ жанров' }
  ];

  function hasNotes(movie) {
    const n = movie.notes || {};
    return Object.values(n).some((v) => String(v || '').trim());
  }

  function compute(movies) {
    const watched = movies.filter((m) => m.status === 'watched');
    const since = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const monthWatched = watched.filter((m) => m.watchedAt && new Date(m.watchedAt) >= since);
    const directorCounts = {};
    watched.forEach((m) => {
      const d = m.meta?.director;
      if (d) directorCounts[d] = (directorCounts[d] || 0) + 1;
    });
    const maxDirector = Math.max(0, ...Object.values(directorCounts));
    const genres = new Set(watched.flatMap((m) => m.genres || []));
    const weeks = new Set();
    watched.forEach((m) => {
      if (!m.watchedAt) return;
      const d = new Date(m.watchedAt);
      weeks.add(`${d.getFullYear()}-${d.getMonth()}-W${Math.floor(d.getDate() / 7)}`);
    });

    const flags = {
      watched_5_month: monthWatched.length >= 5,
      first_10: watched.some((m) => m.rating === 10),
      director_3: maxDirector >= 3,
      week_streak: weeks.size >= 4,
      watched_100: watched.length >= 100,
      series_started: movies.some((m) => m.mediaType === 'tv' && m.status !== 'want'),
      notes_10: movies.filter(hasNotes).length >= 10,
      genres_5: genres.size >= 5
    };

    return DEFS.map((d) => ({ ...d, unlocked: !!flags[d.id] }));
  }

  window.AchievementsClient = { compute };
})();
