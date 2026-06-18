(function () {
  function normalizeTitle(text) {
    return String(text || '')
      .toLowerCase()
      .replace(/ё/g, 'е')
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function titleSimilarity(a, b) {
    const na = normalizeTitle(a);
    const nb = normalizeTitle(b);
    if (!na || !nb) return 0;
    if (na === nb) return 1;
    if (na.includes(nb) || nb.includes(na)) return 0.85;
    return 0;
  }

  function findDuplicate(movies, candidate) {
    const title = candidate.title?.trim();
    if (!title) return null;

    const tmdbId = candidate.tmdbId || null;
    const imdbId = candidate.imdbId || candidate.meta?.imdbId || null;
    const year = candidate.year || candidate.meta?.year || null;
    const originalTitle = candidate.originalTitle || candidate.meta?.originalTitle || null;
    const mediaType = candidate.mediaType || 'movie';

    for (const movie of movies) {
      if ((movie.mediaType || 'movie') !== mediaType) continue;
      if (tmdbId && movie.tmdbId && tmdbId === movie.tmdbId) return { movie, reason: 'tmdbId' };
      if (imdbId && movie.meta?.imdbId && imdbId === movie.meta.imdbId) return { movie, reason: 'imdbId' };

      const bestSim = Math.max(
        titleSimilarity(title, movie.title),
        originalTitle && movie.meta?.originalTitle ? titleSimilarity(originalTitle, movie.meta.originalTitle) : 0,
        originalTitle ? titleSimilarity(title, movie.meta?.originalTitle || '') : 0
      );
      const yearMatch = !year || !movie.meta?.year || year === movie.meta.year;
      if (bestSim >= 0.85 && yearMatch) return { movie, reason: 'title' };
    }

    const norm = normalizeTitle(title);
    const loose = movies.find((m) => {
      if ((m.mediaType || 'movie') !== mediaType) return false;
      const mn = normalizeTitle(m.title);
      return mn.includes(norm) || norm.includes(mn);
    });
    return loose ? { movie: loose, reason: 'partial' } : null;
  }

  window.Dedupe = { findDuplicate };
})();
