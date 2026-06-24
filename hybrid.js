export function movieKey(item) {
  if (!item) return '';
  if (item.tmdbId) return `${item.mediaType === 'tv' ? 'tv' : 'movie'}:${item.tmdbId}`;
  return String(item.title || '').toLowerCase().trim();
}

export function actionWeight(movie, prefs) {
  const rating = Number(movie?.rating) || 0;
  if (rating >= 8) return 1;
  if (rating >= 6) return 0.6;
  if (movie?.status === 'watched') return 0.35;
  if (movie?.status === 'want') return 0.2;
  return 0.1;
}

export function buildUserItemMatrix(allUsers = []) {
  const matrix = new Map();
  for (const user of allUsers) matrix.set(user.username, user.movies || []);
  return { matrix };
}

export function getCollaborativeScores(_username, _model, { excludeKeys = new Set() } = {}) {
  return { scores: new Map(), neighbors: [] };
}

export function getHybridRecommendations({
  recs = [],
  limit = 10
}) {
  return {
    recommendations: recs.slice(0, limit),
    similarUsersCount: 0
  };
}
