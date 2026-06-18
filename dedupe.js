import { normalizeTitle, titleSimilarity } from './tmdbMatch.js';

export function findDuplicate(movies, candidate) {
  const title = candidate.title?.trim();
  if (!title) return null;

  const tmdbId = candidate.tmdbId || null;
  const imdbId = candidate.imdbId || candidate.meta?.imdbId || null;
  const year = candidate.year || candidate.meta?.year || null;
  const originalTitle = candidate.originalTitle || candidate.meta?.originalTitle || null;
  const mediaType = candidate.mediaType || 'movie';

  for (const movie of movies) {
    if (movie.mediaType !== mediaType) continue;

    if (tmdbId && movie.tmdbId && tmdbId === movie.tmdbId) {
      return { movie, reason: 'tmdbId', confidence: 1 };
    }
    if (imdbId && movie.meta?.imdbId && imdbId === movie.meta.imdbId) {
      return { movie, reason: 'imdbId', confidence: 1 };
    }

    const titleSim = titleSimilarity(title, movie.title);
    const origSim = originalTitle && movie.meta?.originalTitle
      ? titleSimilarity(originalTitle, movie.meta.originalTitle)
      : 0;
    const crossSim = Math.max(
      originalTitle ? titleSimilarity(title, movie.meta?.originalTitle || '') : 0,
      movie.meta?.originalTitle ? titleSimilarity(originalTitle || title, movie.title) : 0
    );
    const bestSim = Math.max(titleSim, origSim, crossSim);

    const yearMatch = !year || !movie.meta?.year || year === movie.meta.year;
    if (bestSim >= 0.92 && yearMatch) {
      return { movie, reason: 'title', confidence: bestSim };
    }
    if (bestSim >= 0.78 && yearMatch && year) {
      return { movie, reason: 'title+year', confidence: bestSim };
    }
  }

  const norm = normalizeTitle(title);
  const loose = movies.find((m) => {
    if (m.mediaType !== mediaType) return false;
    const mn = normalizeTitle(m.title);
    return mn.includes(norm) || norm.includes(mn);
  });
  if (loose) return { movie: loose, reason: 'partial', confidence: 0.7 };

  return null;
}
