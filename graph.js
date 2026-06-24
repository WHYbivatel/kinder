/* ===================================================================
   graph.js — внутренняя графовая модель связей (без отдельной БД).

   Узлы: user, movie, genre, actor, keyword.
   Рёбра (из ТЗ):
     user  --rated-->     movie   (вес = оценка)
     user  --watched-->   movie
     user  --wants-->     movie
     user  --likesGenre-->genre   (вес = суммарный сигнал)
     movie --hasGenre-->  genre
     movie --hasActor-->  actor
     movie --hasKeyword-->keyword
     user  --similarTo--> user    (вес = близость; заполняется отдельно)

   Реализуется как набор Map-ов смежности поверх JSON-данных. Граф
   используется для: (а) фолбэка похожести по жанрам, (б) обхода
   user→similarTo→user→rated→movie (коллаборативные кандидаты),
   (в) объяснимости.
   =================================================================== */

function lc(s) { return String(s || '').toLowerCase().replace(/ё/g, 'е').trim(); }

/**
 * buildGraph — строит граф из allUsers: [{ username, movies, prefs }].
 * deps: { movieKeyFn(movie)->key, actionWeightFn(movie, prefs)->number }
 */
export function buildGraph(allUsers = [], { movieKeyFn, actionWeightFn }) {
  const g = {
    users: new Set(),
    movies: new Map(),          // key -> { title, tmdbId, mediaType, poster, genres, year, voteAverage }
    genres: new Set(),
    actors: new Set(),
    keywords: new Set(),

    userRated: new Map(),       // user -> Map<movieKey, rating>
    userWatched: new Map(),     // user -> Set<movieKey>
    userWants: new Map(),       // user -> Set<movieKey>
    userLikesGenre: new Map(),  // user -> Map<genre, weight>
    userSimilarTo: new Map(),   // user -> Map<user, sim>

    movieHasGenre: new Map(),   // movieKey -> Set<genre>
    movieHasActor: new Map(),   // movieKey -> Set<actor>
    movieHasKeyword: new Map(), // movieKey -> Set<keyword>
    genreMovies: new Map()      // genre -> Set<movieKey>
  };

  const add = (map, k, v) => {
    if (!map.has(k)) map.set(k, new Set());
    map.get(k).add(v);
  };

  for (const { username, movies = [], prefs = null } of allUsers) {
    g.users.add(username);
    g.userRated.set(username, new Map());
    g.userWatched.set(username, new Set());
    g.userWants.set(username, new Set());
    const likesGenre = new Map();

    for (const m of movies) {
      const key = movieKeyFn(m);
      if (!key) continue;
      const weight = actionWeightFn ? actionWeightFn(m, prefs) : 1;

      if (!g.movies.has(key)) {
        g.movies.set(key, {
          title: m.title,
          tmdbId: m.tmdbId || null,
          mediaType: m.mediaType || 'movie',
          poster: m.meta?.poster || null,
          genres: m.genres || [],
          year: m.meta?.year || null,
          voteAverage: m.meta?.imdb?.rating || m.meta?.kinopoisk?.rating || null
        });
      }

      // user -> rated/watched/wants -> movie
      if (m.status === 'watched') {
        g.userWatched.get(username).add(key);
        if (m.rating != null) g.userRated.get(username).set(key, m.rating);
      } else if (m.status === 'want' || m.status === 'watching') {
        g.userWants.get(username).add(key);
      }

      // movie -> hasGenre -> genre  и  user -> likesGenre -> genre
      for (const raw of (m.genres || [])) {
        const genre = lc(raw);
        if (!genre) continue;
        g.genres.add(genre);
        add(g.movieHasGenre, key, genre);
        add(g.genreMovies, genre, key);
        likesGenre.set(genre, (likesGenre.get(genre) || 0) + weight);
      }

      // movie -> hasActor -> actor
      const castNames = m.meta?.castDetails?.map((c) => c.name)
        || String(m.meta?.cast || '').split(',').map((s) => s.trim()).filter(Boolean);
      for (const name of (castNames || []).slice(0, 6)) {
        const actor = lc(name);
        if (!actor) continue;
        g.actors.add(actor);
        add(g.movieHasActor, key, actor);
      }
      if (m.meta?.director) {
        const d = lc(m.meta.director);
        g.actors.add(d);
        add(g.movieHasActor, key, d);
      }

      // movie -> hasKeyword -> keyword (из тегов и заметок)
      for (const t of (m.tags || [])) {
        const kw = lc(t);
        if (!kw) continue;
        g.keywords.add(kw);
        add(g.movieHasKeyword, key, kw);
      }
    }

    g.userLikesGenre.set(username, likesGenre);
  }

  return g;
}

/** Установить рёбра user --similarTo--> user (из посчитанной близости). */
export function setSimilarEdges(graph, username, neighbors = []) {
  const m = new Map();
  for (const { username: nb, sim } of neighbors) m.set(nb, sim);
  graph.userSimilarTo.set(username, m);
}

/**
 * graphCollaborativeCandidates — обход графа:
 *   user --similarTo--> сосед --rated/watched--> movie (которого нет у user).
 * Возвращает Map<movieKey, { score, neighbors:Set, ref }>. Это альтернативный
 * (графовый) путь к коллаборативным кандидатам; результат согласуется с
 * матричным, но строится через рёбра графа.
 */
export function graphCollaborativeCandidates(graph, username, { excludeKeys = new Set() } = {}) {
  const out = new Map();
  const neighbors = graph.userSimilarTo.get(username);
  if (!neighbors || !neighbors.size) return out;

  for (const [nb, sim] of neighbors) {
    const rated = graph.userRated.get(nb);
    if (!rated) continue;
    for (const [key, rating] of rated) {
      if (excludeKeys.has(key)) continue;
      if (rating < 7) continue; // сосед должен оценить высоко
      const cur = out.get(key) || { raw: 0, neighbors: new Set(), ref: graph.movies.get(key) };
      cur.raw += sim * (rating / 10);
      cur.neighbors.add(nb);
      out.set(key, cur);
    }
  }
  let max = 0;
  for (const v of out.values()) max = Math.max(max, v.raw);
  for (const v of out.values()) v.score = max > 0 ? v.raw / max : 0;
  return out;
}

export function graphStats(graph) {
  return {
    users: graph.users.size,
    movies: graph.movies.size,
    genres: graph.genres.size,
    actors: graph.actors.size,
    keywords: graph.keywords.size
  };
}
