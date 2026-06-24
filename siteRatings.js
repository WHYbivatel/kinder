export function buildSiteRatings(allUsers = [], keyFn) {
  const buckets = new Map();

  for (const user of allUsers) {
    for (const movie of user.movies || []) {
      const key = keyFn(movie);
      const rating = Number(movie.rating);
      if (!key || !rating) continue;
      const current = buckets.get(key) || { sum: 0, count: 0 };
      current.sum += rating;
      current.count += 1;
      buckets.set(key, current);
    }
  }

  const ratings = new Map();
  for (const [key, value] of buckets) {
    ratings.set(key, {
      average: Math.round((value.sum / value.count) * 10) / 10,
      count: value.count
    });
  }

  return ratings;
}
