import { fetchHdrezkaRatings } from './hdrezka.js';

function parseVoteCount(value) {
  if (value == null || value === '' || value === 'N/A') return null;
  const num = Number(String(value).replace(/[^\d]/g, ''));
  return Number.isFinite(num) && num > 0 ? num : null;
}

function parseRating(value) {
  if (value == null || value === '' || value === 'N/A') return null;
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? Number(num.toFixed(1)) : null;
}

async function fetchOmdbRating(imdbId, apiKey) {
  if (!apiKey || !imdbId) return null;

  try {
    const url = new URL('https://www.omdbapi.com/');
    url.searchParams.set('i', imdbId);
    url.searchParams.set('apikey', apiKey);

    const response = await fetch(url);
    if (!response.ok) return null;

    const data = await response.json();
    if (data.Response === 'False') return null;

    const rating = parseRating(data.imdbRating);
    const votes = parseVoteCount(data.imdbVotes);
    if (rating == null && votes == null) return null;

    return {
      rating,
      votes,
      url: `https://www.imdb.com/title/${imdbId}/`,
      source: 'omdb'
    };
  } catch {
    return null;
  }
}

async function fetchKinopoiskDetails(filmId, apiKey) {
  const response = await fetch(
    `https://kinopoiskapiunofficial.tech/api/v2.2/films/${filmId}`,
    { headers: { 'X-API-KEY': apiKey } }
  );
  if (!response.ok) return null;

  const film = await response.json();
  return mapKinopoiskFilm(film);
}

async function fetchKinopoiskByImdb(imdbId, apiKey) {
  const response = await fetch(
    `https://kinopoiskapiunofficial.tech/api/v2.2/films?imdbId=${encodeURIComponent(imdbId)}`,
    { headers: { 'X-API-KEY': apiKey } }
  );
  if (!response.ok) return null;

  const data = await response.json();
  const film = data.items?.[0] || (data.kinopoiskId || data.filmId ? data : null);
  if (!film) return null;

  const filmId = film.kinopoiskId || film.filmId;
  if (filmId && !film.ratingKinopoiskVoteCount) {
    return fetchKinopoiskDetails(filmId, apiKey);
  }

  return mapKinopoiskFilm(film);
}

async function fetchKinopoiskBySearch(title, year, apiKey) {
  const response = await fetch(
    `https://kinopoiskapiunofficial.tech/api/v2.1/films/search-by-keyword?keyword=${encodeURIComponent(title)}`,
    { headers: { 'X-API-KEY': apiKey } }
  );
  if (!response.ok) return null;

  const data = await response.json();
  const films = data.films || [];
  if (!films.length) return null;

  const yearNum = year ? Number(year) : null;
  const ranked = films
    .map((film) => {
      let score = 0;
      const filmYear = film.year ? Number(film.year) : null;
      if (yearNum && filmYear === yearNum) score += 50;
      else if (yearNum && filmYear && Math.abs(filmYear - yearNum) <= 1) score += 20;
      if (film.rating) score += 10;
      return { film, score };
    })
    .sort((a, b) => b.score - a.score);

  const filmId = ranked[0].film.filmId || ranked[0].film.kinopoiskId;
  if (filmId) {
    const details = await fetchKinopoiskDetails(filmId, apiKey);
    if (details) return details;
  }

  return mapKinopoiskFilm(ranked[0].film);
}

function mapKinopoiskFilm(film) {
  const filmId = film.kinopoiskId || film.filmId;
  const rating = parseRating(film.ratingKinopoisk ?? film.rating);
  const votes = parseVoteCount(film.ratingKinopoiskVoteCount ?? film.ratingVoteCount);

  if (rating == null && votes == null && !filmId) return null;

  return {
    rating,
    votes,
    filmId,
    url: filmId ? `https://www.kinopoisk.ru/film/${filmId}/` : null,
    imdbRating: parseRating(film.ratingImdb),
    source: 'kinopoisk-api'
  };
}

async function fetchKinopoiskRating({ imdbId, title, year }, apiKey) {
  if (!apiKey) return null;

  try {
    if (imdbId) {
      const byImdb = await fetchKinopoiskByImdb(imdbId, apiKey);
      if (byImdb) return byImdb;
    }
    if (title) {
      return fetchKinopoiskBySearch(title, year, apiKey);
    }
  } catch {
    return null;
  }

  return null;
}

async function fetchApiRatings({ imdbId, title, year }) {
  const omdbKey = process.env.OMDB_API_KEY;
  const kpKey = process.env.KINOPOISK_API_KEY;

  const [omdb, kinopoisk] = await Promise.all([
    fetchOmdbRating(imdbId, omdbKey),
    fetchKinopoiskRating({ imdbId, title, year }, kpKey)
  ]);

  const imdb = omdb || (kinopoisk?.imdbRating
    ? { rating: kinopoisk.imdbRating, votes: null, url: imdbId ? `https://www.imdb.com/title/${imdbId}/` : null, source: 'kinopoisk-api' }
    : null);

  const kp = kinopoisk
    ? { rating: kinopoisk.rating, votes: kinopoisk.votes, url: kinopoisk.url, source: 'kinopoisk-api' }
    : null;

  return { imdb, kinopoisk: kp, hdrezkaUrl: null };
}

export async function fetchExternalRatings({ imdbId, title, year, matchedTitle, originalTitle }) {
  const hdrezka = await fetchHdrezkaRatings({ title, year, matchedTitle, originalTitle });

  if (hdrezka?.imdb?.rating && hdrezka?.kinopoisk?.rating) {
    return hdrezka;
  }

  const api = await fetchApiRatings({ imdbId, title, year });

  return {
    title: hdrezka?.title || null,
    fullTitle: hdrezka?.fullTitle || null,
    altTitle: hdrezka?.altTitle || null,
    originalTitle: hdrezka?.originalTitle || originalTitle || null,
    imdb: hdrezka?.imdb?.rating ? hdrezka.imdb : api.imdb,
    kinopoisk: hdrezka?.kinopoisk?.rating ? hdrezka.kinopoisk : api.kinopoisk,
    hdrezkaUrl: hdrezka?.hdrezkaUrl || null
  };
}
