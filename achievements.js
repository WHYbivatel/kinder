export const ACHIEVEMENT_DEFS = [
  { id: 'watched_5_month', icon: '🎬', title: '5 фильмов за месяц', desc: 'Посмотрели 5+ за последние 30 дней' },
  { id: 'first_10', icon: '⭐', title: 'Первая десятка', desc: 'Первый фильм с оценкой 10/10' },
  { id: 'director_3', icon: '🎥', title: 'Фанат режиссёра', desc: '3+ фильма одного режиссёра' },
  { id: 'week_streak', icon: '🔥', title: 'Неделя активности', desc: 'Смотрели каждую неделю месяц подряд' },
  { id: 'watched_100', icon: '🏆', title: 'Сотня', desc: '100 просмотренных фильмов/сериалов' },
  { id: 'series_started', icon: '📺', title: 'Сериальный', desc: 'Начали смотреть первый сериал' },
  { id: 'notes_10', icon: '📝', title: 'Критик', desc: 'Заметки к 10+ фильмам' },
  { id: 'genres_5', icon: '🌈', title: 'Разнообразие', desc: '5+ разных жанров в просмотренных' }
];

function hasNotes(movie) {
  const n = movie.notes || {};
  return Object.values(n).some((v) => String(v || '').trim().length > 0);
}

function getWatchedInPeriod(movies, days) {
  const since = Date.now() - days * 24 * 60 * 60 * 1000;
  return movies.filter((m) => m.status === 'watched' && m.watchedAt && new Date(m.watchedAt) >= since);
}

function getDirectorCounts(movies) {
  const counts = {};
  movies.filter((m) => m.status === 'watched').forEach((m) => {
    const d = m.meta?.director;
    if (d) counts[d] = (counts[d] || 0) + 1;
  });
  return counts;
}

function hasWeekStreak(movies) {
  const watched = movies.filter((m) => m.status === 'watched' && m.watchedAt);
  if (watched.length < 4) return false;
  const weeks = new Set();
  watched.forEach((m) => {
    const d = new Date(m.watchedAt);
    const week = `${d.getFullYear()}-W${Math.ceil((d.getDate() + 6 - d.getDay()) / 7)}-${d.getMonth()}`;
    weeks.add(week);
  });
  return weeks.size >= 4;
}

export function computeAchievements(movies) {
  const watched = movies.filter((m) => m.status === 'watched');
  const monthWatched = getWatchedInPeriod(movies, 30);
  const directorCounts = getDirectorCounts(movies);
  const maxDirector = Math.max(0, ...Object.values(directorCounts));
  const genres = new Set(watched.flatMap((m) => m.genres || []));
  const notesCount = movies.filter(hasNotes).length;
  const hasSeries = movies.some((m) => m.mediaType === 'tv' && m.status !== 'want');

  const unlocked = {
    watched_5_month: monthWatched.length >= 5,
    first_10: watched.some((m) => m.rating === 10),
    director_3: maxDirector >= 3,
    week_streak: hasWeekStreak(movies),
    watched_100: watched.length >= 100,
    series_started: hasSeries,
    notes_10: notesCount >= 10,
    genres_5: genres.size >= 5
  };

  const streak = monthWatched.length;

  return ACHIEVEMENT_DEFS.map((def) => ({
    ...def,
    unlocked: !!unlocked[def.id]
  })).concat([{
    id: 'streak',
    icon: '📅',
    title: `Серия: ${streak} за месяц`,
    desc: 'Просмотрено за последние 30 дней',
    unlocked: streak > 0,
    isStreak: true,
    value: streak
  }]);
}
