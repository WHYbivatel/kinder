export function canonicalGenre(genre) {
  if (!genre) return '';
  if (typeof genre === 'string') return genre.toLowerCase().trim();
  return String(genre.name || genre.id || '').toLowerCase().trim();
}

export async function getGenreNameMap(tmdbFetch) {
  try {
    const [movies, tv] = await Promise.all([
      tmdbFetch('/genre/movie/list?language=ru-RU'),
      tmdbFetch('/genre/tv/list?language=ru-RU')
    ]);
    const map = {};
    for (const g of [...(movies?.genres || []), ...(tv?.genres || [])]) map[g.id] = g.name;
    return map;
  } catch {
    return {};
  }
}

export function buildUserTasteProfile(movies = [], prefs = {}) {
  const likedGenres = {};
  const likedMovies = [];
  for (const movie of movies) {
    const rating = Number(movie?.rating) || 0;
    if (rating >= 7 || movie?.status === 'watched') {
      likedMovies.push({ title: movie.title, rating });
      for (const genre of movie.genres || []) {
        const key = canonicalGenre(genre);
        if (key) likedGenres[key] = (likedGenres[key] || 0) + 1;
      }
    }
  }
  return {
    likedGenres,
    likedMovies,
    psychModifiers: { moodHints: prefs?.psychTest?.tags || [] }
  };
}

export function scoreMovieForUser(movie, tasteProfile, { mode } = {}) {
  let score = 0;
  for (const genre of movie?.genres || []) {
    score += tasteProfile.likedGenres[canonicalGenre(genre)] || 0;
  }
  if (mode === 'personal' && score > 0) {
    return { score, reason: 'Совпадает с вашими жанрами' };
  }
  return { score, reason: score > 0 ? 'Подходит по жанрам' : 'Общая подборка' };
}

export async function scoreTmdbResultsForUser({
  results = [],
  movies = [],
  prefs = {},
  mode = 'personal'
}) {
  const tasteProfile = buildUserTasteProfile(movies, prefs);
  return results
    .map((result) => ({
      result,
      score: scoreMovieForUser(
        { genres: (result.genre_ids || []).map(String) },
        tasteProfile,
        { mode }
      ).score
    }))
    .sort((a, b) => b.score - a.score);
}

export async function recommendForUser({
  tmdbFetch,
  tmdbPosterFromPath,
  movies = [],
  prefs = {},
  mode = 'personal',
  limit = 10,
  mediaType = null,
  excludeTitles = []
}) {
  const excluded = new Set((excludeTitles || []).map((t) => String(t).toLowerCase()));
  const path = mediaType === 'tv' ? '/trending/tv/week' : '/trending/movie/week';
  const data = await tmdbFetch(`${path}?language=ru-RU`);
  return (data?.results || [])
    .filter((item) => !excluded.has(String(item.title || item.name || '').toLowerCase()))
    .slice(0, limit)
    .map((item) => ({
      tmdbId: item.id,
      title: item.title || item.name,
      mediaType: mediaType === 'tv' ? 'tv' : 'movie',
      poster: tmdbPosterFromPath ? tmdbPosterFromPath(item.poster_path, 'w780') : item.poster_path,
      reason: mode === 'premieres' ? 'Скоро в прокате' : 'Популярное сейчас',
      source: 'trending',
      genres: []
    }));
}
