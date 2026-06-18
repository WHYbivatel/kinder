/**
 * Логика мини-игры «Битва фильмов» — чистые функции без DOM.
 */
(function () {
  const MIN_QUICK = 8;
  const MIN_FULL = 10;
  const MIN_GENRE = 4;
  const MIN_SERIES = 4;

  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function externalRating(movie) {
    const imdb = movie.meta?.imdb?.rating || 0;
    const kp = movie.meta?.kinopoisk?.rating || 0;
    return Math.max(imdb, kp);
  }

  function candidateSortScore(movie) {
    let score = 0;
    if (movie.rating != null) score += movie.rating * 1000;
    score += (movie.battleScore || 0) * 10;
    score += (movie.battleWins || 0) * 5;
    score += externalRating(movie) * 2;
    const date = movie.watchedAt || movie.addedAt;
    if (date) score += new Date(date).getTime() / 1e15;
    return score;
  }

  function sortByPriority(movies) {
    return [...movies].sort((a, b) => candidateSortScore(b) - candidateSortScore(a));
  }

  function getMediaType(movie) {
    return movie.mediaType || 'movie';
  }

  function getWatched(movies, { mediaType = null, genre = null } = {}) {
    let list = movies.filter((m) => m.status === 'watched');
    if (mediaType === 'movie') {
      list = list.filter((m) => getMediaType(m) === 'movie');
    } else if (mediaType === 'tv') {
      list = list.filter((m) => getMediaType(m) === 'tv');
    }
    if (genre) {
      const g = genre.toLowerCase();
      list = list.filter((m) => (m.genres || []).some((x) => x.toLowerCase() === g));
    }
    return list;
  }

  function pickPool(movies, maxSize) {
    if (movies.length <= maxSize) return sortByPriority(movies);
    return sortByPriority(movies).slice(0, maxSize);
  }

  function prepareQuickPool(watched) {
    if (watched.length <= 8) return watched;
    const top20 = pickPool(watched, 20);
    return shuffle(top20).slice(0, 8);
  }

  function prepareFullPool(watched) {
    if (watched.length <= 40) return sortByPriority(watched);
    return pickPool(watched, 40);
  }

  function prepareGenrePool(watchedInGenre) {
    if (watchedInGenre.length <= 20) return sortByPriority(watchedInGenre);
    return pickPool(watchedInGenre, 20);
  }

  function prepareSeriesPool(watchedSeries) {
    if (watchedSeries.length <= 20) return sortByPriority(watchedSeries);
    return pickPool(watchedSeries, 20);
  }

  function getGenreCounts(watched) {
    const map = new Map();
    watched.forEach((m) => {
      (m.genres || []).forEach((g) => {
        const key = g.toLowerCase();
        map.set(key, (map.get(key) || 0) + 1);
      });
    });
    return [...map.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }

  function initialSessionScore(movie) {
    if (movie.battleScore) return movie.battleScore;
    if (movie.rating != null) return movie.rating * 10;
    return 50;
  }

  /** Турнирная сетка (8 фильмов → 7 матчей → топ-3) */
  class BracketBattle {
    constructor(pool, modeLabel) {
      this.mode = modeLabel;
      this.pool = shuffle(pool);
      this.round = 1;
      this.winners = [];
      this.currentPairs = [];
      this.pairIndex = 0;
      this.allMatches = [];
      this.wins = {};
      this.semifinalLosers = [];
      this.finalLoser = null;
      this.pool.forEach((m) => { this.wins[m.id] = 0; });
      this.totalRounds = Math.ceil(Math.log2(pool.length));
      this.totalMatches = pool.length - 1;
      this._startRound();
    }

    _startRound() {
      const participants = this.round === 1 ? this.pool : this.winners;
      this.winners = [];
      this.currentPairs = [];
      const shuffled = shuffle(participants);
      for (let i = 0; i < shuffled.length; i += 2) {
        if (i + 1 < shuffled.length) {
          this.currentPairs.push({ left: shuffled[i], right: shuffled[i + 1] });
        } else {
          this.winners.push(shuffled[i]);
        }
      }
      this.pairIndex = 0;
    }

    getCurrentPair() {
      return this.pairIndex < this.currentPairs.length ? this.currentPairs[this.pairIndex] : null;
    }

    getProgress() {
      return { current: this.allMatches.length + 1, total: this.totalMatches };
    }

    pickWinner(winnerId, { skipped = false } = {}) {
      const pair = this.currentPairs[this.pairIndex];
      if (!pair) return { done: true, results: this._top3() };

      const winner = pair.left.id === winnerId ? pair.left : pair.right;
      const loser = pair.left.id === winnerId ? pair.right : pair.left;

      this.wins[winner.id] = (this.wins[winner.id] || 0) + 1;
      this.allMatches.push({
        leftId: pair.left.id,
        rightId: pair.right.id,
        winnerId: winner.id,
        skipped
      });

      this.winners.push(winner);
      if (this.round === this.totalRounds) this.finalLoser = loser;
      else if (this.round === this.totalRounds - 1) this.semifinalLosers.push(loser);

      this.pairIndex++;
      if (this.pairIndex >= this.currentPairs.length) {
        if (this.winners.length === 1) {
          return { done: true, results: this._top3() };
        }
        this.round++;
        this._startRound();
      }

      const next = this.getCurrentPair();
      if (!next && this.winners.length === 1) {
        return { done: true, results: this._top3() };
      }
      return { done: false, pair: next, progress: this.getProgress() };
    }

    skipPair() {
      const pair = this.getCurrentPair();
      if (!pair) return this.pickWinner(pair?.left?.id);
      const pick = Math.random() < 0.5 ? pair.left.id : pair.right.id;
      return this.pickWinner(pick, { skipped: true });
    }

    _top3() {
      const champion = this.winners[0];
      const ranked = sortByPriority(this.pool).map((m) => ({
        movie: m,
        wins: this.wins[m.id] || 0
      }));
      ranked.sort((a, b) => {
        if (b.wins !== a.wins) return b.wins - a.wins;
        return candidateSortScore(b.movie) - candidateSortScore(a.movie);
      });

      const top3 = [];
      const used = new Set();

      if (champion) {
        top3.push({ movie: champion, wins: this.wins[champion.id] || 0, place: 1 });
        used.add(champion.id);
      }
      if (this.finalLoser && !used.has(this.finalLoser.id)) {
        top3.push({ movie: this.finalLoser, wins: this.wins[this.finalLoser.id] || 0, place: 2 });
        used.add(this.finalLoser.id);
      }
      if (this.semifinalLosers.length) {
        const bestSemi = sortByPriority(this.semifinalLosers)[0];
        if (bestSemi && !used.has(bestSemi.id)) {
          top3.push({ movie: bestSemi, wins: this.wins[bestSemi.id] || 0, place: 3 });
          used.add(bestSemi.id);
        }
      }
      for (const r of ranked) {
        if (top3.length >= 3) break;
        if (!used.has(r.movie.id)) {
          top3.push({ movie: r.movie, wins: r.wins, place: top3.length + 1 });
          used.add(r.movie.id);
        }
      }
      top3.forEach((t, i) => { t.place = i + 1; });
      return top3;
    }

    getMatches() { return this.allMatches; }
  }

  /** Очковая битва (полная / жанр / сериалы) */
  class ScoreBattle {
    constructor(pool, mode, { topN = 3, minRounds = null, maxRounds = null } = {}) {
      this.mode = mode;
      this.pool = pool;
      this.topN = topN;
      this.scores = {};
      this.wins = {};
      this.losses = {};
      pool.forEach((m) => {
        this.scores[m.id] = initialSessionScore(m);
        this.wins[m.id] = 0;
        this.losses[m.id] = 0;
      });
      const defaultRounds = Math.max(10, Math.min(30, pool.length * 2));
      this.totalRounds = minRounds != null && maxRounds != null
        ? Math.max(minRounds, Math.min(maxRounds, pool.length * 2))
        : defaultRounds;
      if (mode === 'genre' || mode === 'series') {
        this.totalRounds = Math.max(3, Math.min(pool.length * 2, 15));
      }
      this.currentRound = 0;
      this.allMatches = [];
      this.currentPair = null;
      this._nextPair();
    }

    _nextPair() {
      if (this.pool.length < 2) {
        this.currentPair = null;
        return;
      }
      const a = this.pool[Math.floor(Math.random() * this.pool.length)];
      let b = this.pool[Math.floor(Math.random() * this.pool.length)];
      let tries = 0;
      while (b.id === a.id && tries < 30) {
        b = this.pool[Math.floor(Math.random() * this.pool.length)];
        tries++;
      }
      this.currentPair = { left: a, right: b };
    }

    getCurrentPair() { return this.currentPair; }

    getProgress() {
      return { current: this.currentRound + 1, total: this.totalRounds };
    }

    pickWinner(winnerId, { skipped = false } = {}) {
      const pair = this.currentPair;
      if (!pair) return { done: true, results: this._results() };

      const winner = pair.left.id === winnerId ? pair.left : pair.right;
      const loser = pair.left.id === winnerId ? pair.right : pair.left;

      if (!skipped) {
        this.wins[winner.id]++;
        this.losses[loser.id]++;
        const prevWinnerScore = this.scores[winner.id];
        this.scores[winner.id] += 10;
        this.scores[loser.id] -= 3;

        const loserRating = loser.rating ?? 0;
        const winnerRating = winner.rating ?? 0;
        if (loserRating > winnerRating || this.scores[loser.id] > prevWinnerScore) {
          this.scores[winner.id] += 3;
        }
      }

      this.allMatches.push({
        leftId: pair.left.id,
        rightId: pair.right.id,
        winnerId: winner.id,
        skipped
      });

      this.currentRound++;
      if (this.currentRound >= this.totalRounds) {
        return { done: true, results: this._results() };
      }
      this._nextPair();
      return { done: false, pair: this.currentPair, progress: this.getProgress() };
    }

    skipPair() {
      const pair = this.getCurrentPair();
      if (!pair) return { done: true, results: this._results() };
      const pick = Math.random() < 0.5 ? pair.left.id : pair.right.id;
      return this.pickWinner(pick, { skipped: true });
    }

    _results() {
      const n = this.pool.length >= 10 && this.mode === 'full' ? 10 : this.topN;
      const ranked = this.pool.map((m) => ({
        movie: m,
        wins: this.wins[m.id],
        score: this.scores[m.id],
        place: 0
      })).sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        if (b.wins !== a.wins) return b.wins - a.wins;
        return candidateSortScore(b.movie) - candidateSortScore(a.movie);
      });
      ranked.forEach((r, i) => { r.place = i + 1; });
      return ranked.slice(0, n);
    }

    getMatches() { return this.allMatches; }
  }

  function resolveBattleMode(mode, options = {}) {
    if (mode === 'series') return options.battleMode || 'quick';
    return mode;
  }

  function resolveMediaType(mode, options = {}) {
    if (options.mediaType === 'tv' || options.mediaType === 'movie') return options.mediaType;
    if (mode === 'series') return 'tv';
    return 'movie';
  }

  function createBattle(mode, movies, options = {}) {
    const battleMode = resolveBattleMode(mode, options);
    const mediaType = resolveMediaType(mode, options);
    const watched = getWatched(movies, { mediaType });

    if (battleMode === 'quick') {
      const min = mediaType === 'tv' ? MIN_SERIES : MIN_QUICK;
      if (watched.length < min) {
        return {
          error: mediaType === 'tv' ? 'not_enough_series' : 'not_enough',
          count: watched.length,
          min,
          mediaType
        };
      }
      const pool = mediaType === 'tv' ? prepareSeriesPool(watched) : prepareQuickPool(watched);
      return {
        engine: new BracketBattle(pool, battleMode),
        mode: battleMode,
        pool,
        mediaType
      };
    }

    if (battleMode === 'full') {
      const min = mediaType === 'tv' ? MIN_SERIES : MIN_FULL;
      if (watched.length < min) {
        return {
          error: mediaType === 'tv' ? 'not_enough_series' : 'not_enough',
          count: watched.length,
          min,
          mediaType
        };
      }
      const pool = mediaType === 'tv' ? prepareSeriesPool(watched) : prepareFullPool(watched);
      return {
        engine: new ScoreBattle(pool, 'full', { topN: pool.length >= 10 ? 10 : 3 }),
        mode: battleMode,
        pool,
        mediaType
      };
    }

    if (battleMode === 'genre') {
      const genre = options.genre;
      if (!genre) return { error: 'no_genre' };
      const inGenre = getWatched(movies, { genre, mediaType });
      if (inGenre.length < MIN_GENRE) {
        return {
          error: 'not_enough_genre',
          count: inGenre.length,
          min: MIN_GENRE,
          genre,
          mediaType
        };
      }
      const pool = prepareGenrePool(inGenre);
      const scoreMode = mediaType === 'tv' ? 'series' : 'genre';
      if (pool.length === 8) {
        return { engine: new BracketBattle(pool, scoreMode), mode: battleMode, pool, genre, mediaType };
      }
      return {
        engine: new ScoreBattle(pool, scoreMode, { topN: 3 }),
        mode: battleMode,
        pool,
        genre,
        mediaType
      };
    }

    return { error: 'unknown_mode' };
  }

  function canStartQuick(watchedCount) { return watchedCount >= MIN_QUICK; }
  function canStartFull(watchedCount) { return watchedCount >= MIN_FULL; }

  const GENRE_LABELS = {
    драма: 'Лучшая драма',
    комедия: 'Лучшая комедия',
    фантастика: 'Лучшая фантастика',
    триллер: 'Лучший триллер',
    боевик: 'Лучший боевик',
    ужасы: 'Лучшие ужасы',
    мелодрама: 'Лучшая мелодрама',
    криминал: 'Лучший криминал',
    детектив: 'Лучший детектив',
    фэнтези: 'Лучшее фэнтези',
    анимация: 'Лучшая анимация',
    документальный: 'Лучший документальный',
    биография: 'Лучшая биография',
    история: 'Лучшая история',
    военный: 'Лучший военный',
    семейный: 'Лучший семейный',
    музыка: 'Лучшая музыка',
    спорт: 'Лучший спорт'
  };

  function genreBattleTitle(genre, mediaType = 'movie') {
    const key = (genre || '').toLowerCase();
    const cap = genre.charAt(0).toUpperCase() + genre.slice(1);
    if (mediaType === 'tv') {
      if (GENRE_LABELS[key]) return `Лучший сериал: ${cap}`;
      return `Лучший сериал в жанре «${cap}»`;
    }
    if (GENRE_LABELS[key]) return GENRE_LABELS[key];
    return `Лучший ${cap}`;
  }

  const MODE_LABELS = {
    quick: 'Быстрая битва',
    full: 'Полная битва',
    genre: 'Битва по жанру',
    series: 'Битва сериалов'
  };

  function battleModeLabel(mode, mediaType = 'movie') {
    if (mode === 'series') return MODE_LABELS.series;
    const isTv = mediaType === 'tv';
    if (mode === 'quick') return isTv ? 'Быстрая битва сериалов' : 'Быстрая битва фильмов';
    if (mode === 'full') return isTv ? 'Полная битва сериалов' : 'Полная битва фильмов';
    if (mode === 'genre') return isTv ? 'Битва сериалов по жанру' : 'Битва фильмов по жанру';
    return MODE_LABELS[mode] || mode;
  }

  window.BattleLogic = {
    MIN_QUICK,
    MIN_FULL,
    MIN_GENRE,
    MIN_SERIES,
    getMediaType,
    getWatched,
    getGenreCounts,
    createBattle,
    canStartQuick,
    canStartFull,
    genreBattleTitle,
    battleModeLabel,
    MODE_LABELS,
    candidateSortScore,
    sortByPriority
  };
})();
