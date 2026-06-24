export function buildCategoryProfile(movies = [], weightFn = () => 1) {
  const profile = {
    mood: {},
    pace: {},
    tone: {},
    themes: {},
    setting: {}
  };

  for (const movie of movies) {
    const weight = weightFn(movie);
    for (const tag of movie.tags || movie.categories || []) {
      const key = String(tag).toLowerCase().trim();
      if (!key) continue;
      profile.mood[key] = (profile.mood[key] || 0) + weight;
    }
  }

  return profile;
}
