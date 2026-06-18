import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { resolveMovieTitle } from '../titleAliases.js';
import { pickBestTmdbResult } from '../tmdbMatch.js';
import { fetchExternalRatings } from '../ratings.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataPath = path.join(__dirname, '../data/movies/Sanzhar.json');

async function tmdbFetch(endpoint, params = {}) {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) throw new Error('TMDB_API_KEY не задан');

  const url = new URL(`https://api.themoviedb.org/3${endpoint}`);
  url.searchParams.set('api_key', apiKey);
  url.searchParams.set('language', 'ru-RU');
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const response = await fetch(url);
  if (!response.ok) throw new Error(`TMDB ${response.status}`);
  return response.json();
}

function mapTmdbMovie(movie, credits, externalRatings) {
  const director = credits?.crew?.find((c) => c.job === 'Director')?.name || null;
  const imdbId = movie.imdb_id || movie.external_ids?.imdb_id || null;

  return {
    tmdbId: movie.id,
    genres: (movie.genres || []).map((g) => g.name),
    meta: {
      poster: movie.poster_path ? `https://image.tmdb.org/t/p/w780${movie.poster_path}` : null,
      year: movie.release_date?.slice(0, 4) || null,
      overview: movie.overview || '',
      director,
      runtime: movie.runtime || null,
      country: movie.production_countries?.[0]?.name || null,
      cast: (credits?.cast || []).slice(0, 5).map((c) => c.name).join(', ') || null,
      matchedTitle: movie.title,
      originalTitle: movie.original_title || null,
      matchSource: 'auto',
      imdbId,
      imdb: externalRatings?.imdb || null,
      kinopoisk: externalRatings?.kinopoisk || null,
      hdrezkaUrl: externalRatings?.hdrezkaUrl || null,
    },
  };
}

async function loadTmdbMovieDetails(tmdbId) {
  const movie = await tmdbFetch(`/movie/${tmdbId}`, {
    append_to_response: 'credits,external_ids',
  });

  const imdbId = movie.imdb_id || movie.external_ids?.imdb_id || null;
  const externalRatings = await fetchExternalRatings({
    imdbId,
    title: movie.original_title || movie.title,
    matchedTitle: movie.title,
    year: movie.release_date?.slice(0, 4) || null,
  });

  return mapTmdbMovie(movie, movie.credits, externalRatings);
}

async function searchAndLoad(title) {
  const data = await tmdbFetch('/search/movie', { query: title, include_adult: 'false' });
  const results = (data.results || []).slice(0, 10).map((m) => ({
    tmdbId: m.id,
    title: m.title,
    originalTitle: m.original_title || null,
    year: m.release_date?.slice(0, 4) || null,
    voteCount: m.vote_count || 0,
  }));
  const pick = pickBestTmdbResult(title, results);
  const hit = pick.autoPick ? pick.best : results[0];
  if (!hit) return null;
  return loadTmdbMovieDetails(hit.tmdbId);
}

const REFRESH_IDS = new Set([7, 13]);

async function main() {
  const store = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

  for (const movie of store.movies) {
    const fixedTitle = resolveMovieTitle(movie.title);
    if (fixedTitle !== movie.title) {
      console.log(`Название: «${movie.title}» → «${fixedTitle}»`);
      movie.title = fixedTitle;
    }

    const needsData = !movie.meta?.poster || !movie.tmdbId || REFRESH_IDS.has(movie.id);
    if (!needsData) continue;

    try {
      const data = movie.tmdbId && !REFRESH_IDS.has(movie.id)
        ? await loadTmdbMovieDetails(movie.tmdbId)
        : await searchAndLoad(movie.title);

      if (!data) {
        console.warn(`Не найден в TMDB: «${movie.title}»`);
        continue;
      }

      movie.tmdbId = data.tmdbId;
      movie.genres = data.genres.length ? data.genres : movie.genres;
      movie.meta = { ...movie.meta, ...data.meta, matchSource: 'auto' };
      console.log(`Обновлён: «${movie.title}» (${data.meta.year})`);
    } catch (err) {
      console.warn(`Ошибка для «${movie.title}»:`, err.message);
    }
  }

  fs.writeFileSync(dataPath, `${JSON.stringify(store, null, 2)}\n`, 'utf8');
  console.log('Готово.');
}

main();
