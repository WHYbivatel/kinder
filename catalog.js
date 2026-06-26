/* ===================================================================
   catalog.js — каталог готовых подборок поверх TMDB.

   Конфиг подборок — readyCollections.js (единый источник для главной
   и каталога). Наполнение динамическое: discover/trending + скоринг.
   =================================================================== */

import {
  getReadyCollection,
  getHomeCollections,
  getCatalogCollectionGroups
} from './readyCollections.js';
import { normalizeAppLang } from './serverLocales.js';
import { buildUserTasteProfile, scoreMovieForUser, canonicalGenre } from './recommendationEngine.js';
import { matchesBlacklist } from './prefs.js';
import { normalizeWatchTitle } from './watchNow.js';

export function weightedRating(voteAverage, voteCount, { minVotes = 300, meanVote = 6.8 } = {}) {
  const v = Number(voteCount) || 0;
  const R = Number(voteAverage) || 0;
  if (v <= 0) return 0;
  const m = minVotes;
  const C = meanVote;
  return (v / (v + m)) * R + (m / (v + m)) * C;
}

export function blendedScore(item, siteRating, opts) {
  const wr = weightedRating(item.voteAverage, item.voteCount, opts);
  if (siteRating && Number(siteRating.count) >= 2 && Number(siteRating.average) > 0) {
    const sc = Number(siteRating.count);
    const siteWeight = Math.min(sc / (sc + 12), 0.35);
    return wr * (1 - siteWeight) + Number(siteRating.average) * siteWeight;
  }
  return wr;
}

const CACHE_TTL_MS = (Number(process.env.CATALOG_CACHE_TTL_HOURS) || 12) * 60 * 60 * 1000;
const cache = new Map();
const inflight = new Map();

function getCached(id) {
  const hit = cache.get(id);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.data;
  return null;
}
function setCached(id, data) {
  cache.set(id, { at: Date.now(), data });
  return data;
}
function coalesce(key, build) {
  if (inflight.has(key)) return inflight.get(key);
  const promise = (async () => build())().finally(() => { inflight.delete(key); });
  inflight.set(key, promise);
  return promise;
}
function normLang(lang) {
  return normalizeAppLang(lang);
}
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

async function genreNameToId(deps) {
  const cached = getCached('__genreNameToId');
  if (cached) return cached;
  const byId = await deps.getGenreNameMap(deps.tmdbFetch);
  const byName = new Map();
  for (const [id, name] of byId) {
    if (!byName.has(name)) byName.set(name, id);
  }
  return setCached('__genreNameToId', byName);
}

async function genreIdToName(deps) {
  return deps.getGenreNameMap(deps.tmdbFetch);
}

function mapGenreIds(genreIds, idToName) {
  return (genreIds || []).map((id) => idToName.get(id)).filter(Boolean);
}

function mapItem(deps, raw, mediaType, idToName) {
  const releaseDate = raw.release_date || raw.first_air_date || null;
  const title = raw.title || raw.name || '';
  return {
    tmdbId: raw.id,
    title,
    originalTitle: raw.original_title || raw.original_name || null,
    mediaType,
    type: mediaType === 'tv' ? 'series' : 'movie',
    poster: deps.tmdbPosterFromPath(raw.poster_path, 'w342'),
    year: releaseDate ? Number(releaseDate.slice(0, 4)) || null : null,
    releaseDate,
    overview: raw.overview || '',
    genres: mapGenreIds(raw.genre_ids, idToName),
    voteAverage: raw.vote_average || 0,
    voteCount: raw.vote_count || 0,
    popularity: raw.popularity || 0,
    originalLanguage: raw.original_language || null,
    originCountry: (raw.origin_country && raw.origin_country[0]) || null
  };
}

function passesContentType(item, contentType) {
  if (!contentType) return true;
  const lang = String(item.originalLanguage || '').toLowerCase();
  const genres = (item.genres || []).map((g) => String(g).toLowerCase());
  const animated = genres.some((g) => /мульт|анимац/.test(g));
  if (contentType === 'anime') return lang === 'ja' && animated;
  if (contentType === 'western-animation') return animated && lang !== 'ja';
  return true;
}

function buildUserExcludes(userContext) {
  const blockedTitles = new Set();
  const blockedTmdb = new Set();
  if (!userContext?.movies?.length) {
    return { blockedTitles, blockedTmdb, tasteProfile: null };
  }
  const tasteProfile = buildUserTasteProfile(userContext.movies, userContext.prefs || {});
  for (const m of userContext.movies) {
    const titleKey = normalizeWatchTitle(m.title);
    if (titleKey) blockedTitles.add(titleKey);
    if (m.tmdbId) blockedTmdb.add(`${m.mediaType || 'movie'}:${m.tmdbId}`);
  }
  for (const t of tasteProfile.blacklistTitles) blockedTitles.add(t);
  for (const t of tasteProfile.feedbackBlockedTitles) blockedTitles.add(t);
  return { blockedTitles, blockedTmdb, tasteProfile };
}

function filterExcluded(items, userContext) {
  const { blockedTitles, blockedTmdb } = buildUserExcludes(userContext);
  const prefs = userContext?.prefs || {};
  return items.filter((it) => {
    const key = `${it.mediaType}:${it.tmdbId}`;
    const titleKey = normalizeWatchTitle(it.title);
    if (blockedTmdb.has(key) || blockedTitles.has(titleKey)) return false;
    if (prefs.blacklist && matchesBlacklist({ title: it.title, genres: it.genres, meta: { year: it.year } }, prefs.blacklist)) {
      return false;
    }
    return true;
  });
}

function finalizeItems(deps, items, {
  limit = 20, scoreOpts = {}, sortBy = 'score', userContext = null, contentType = null
} = {}) {
  const seen = new Set();
  const scored = [];
  const { tasteProfile } = buildUserExcludes(userContext);

  for (const it of items) {
    if (!it.tmdbId || !it.poster || !it.title) continue;
    if (!passesContentType(it, contentType)) continue;
    const key = `${it.mediaType}:${it.tmdbId}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const siteRating = deps.getSiteRating
      ? deps.getSiteRating({ tmdbId: it.tmdbId, mediaType: it.mediaType, title: it.title })
      : null;
    it.siteRating = siteRating || null;
    it.weightedScore = Number(blendedScore(it, siteRating, scoreOpts).toFixed(3));

    let personalBoost = 0;
    if (tasteProfile) {
      const personal = scoreMovieForUser(
        { ...it, genres: (it.genres || []).map(canonicalGenre) },
        tasteProfile,
        { mode: 'personal' }
      );
      if (Number.isFinite(personal.score)) {
        personalBoost = clamp(personal.score * 0.12, -0.15, 0.15);
      }
    }
    it.sortScore = it.weightedScore + personalBoost;
    scored.push(it);
  }

  if (sortBy === 'popularity') scored.sort((a, b) => b.popularity - a.popularity);
  else scored.sort((a, b) => (b.sortScore ?? b.weightedScore) - (a.sortScore ?? a.weightedScore));

  return scored.slice(0, limit);
}

async function fetchDiscoverPages(deps, type, params, pages = 2) {
  const out = [];
  for (let page = 1; page <= pages; page += 1) {
    const data = await deps.tmdbFetch(`/discover/${type}`, { ...params, page: String(page) });
    const results = data?.results || [];
    out.push(...results);
    if (!results.length) break;
  }
  return out;
}

async function resolveKeywordIds(deps, queries = []) {
  const ids = [];
  for (const q of queries) {
    const cacheId = `kw:${q}`;
    let id = getCached(cacheId);
    if (id === null || id === undefined) {
      try {
        const data = await deps.tmdbFetch('/search/keyword', { query: q }, { language: 'en-US' });
        id = (data?.results || []).slice(0, 1).map((k) => k.id).filter(Boolean)[0] || 0;
      } catch { id = 0; }
      setCached(cacheId, id);
    }
    if (id) ids.push(id);
  }
  return ids;
}

async function buildTopSeries(deps, limit = 20, userContext = null) {
  const idToName = await genreIdToName(deps);
  const raw = await fetchDiscoverPages(deps, 'tv', {
    sort_by: 'vote_count.desc',
    include_adult: 'false',
    'vote_count.gte': '300'
  }, 3);
  const items = raw.map((r) => mapItem(deps, r, 'tv', idToName));
  return finalizeItems(deps, filterExcluded(items, userContext), {
    limit, scoreOpts: { minVotes: 400, meanVote: 6.8 }, userContext
  });
}

async function buildBestRecent(deps, limit = 20, userContext = null) {
  const idToName = await genreIdToName(deps);
  const year = new Date().getFullYear();
  const from = `${year - 3}-01-01`;
  const raw = await fetchDiscoverPages(deps, 'movie', {
    sort_by: 'vote_count.desc',
    include_adult: 'false',
    'vote_count.gte': '300',
    'primary_release_date.gte': from
  }, 3);
  const items = raw.map((r) => mapItem(deps, r, 'movie', idToName));
  return finalizeItems(deps, filterExcluded(items, userContext), {
    limit, scoreOpts: { minVotes: 400, meanVote: 6.5 }, userContext
  });
}

async function buildMostPopular(deps, limit = 20, media = 'movie', userContext = null) {
  const idToName = await genreIdToName(deps);
  const path = media === 'tv' ? '/trending/tv/week' : '/trending/movie/week';
  const data = await deps.tmdbFetch(path, {});
  const type = media === 'tv' ? 'tv' : 'movie';
  const items = (data?.results || []).map((r) => mapItem(deps, r, type, idToName));
  return finalizeItems(deps, filterExcluded(items, userContext), {
    limit, sortBy: 'popularity', userContext
  });
}

async function buildTrendingMixed(deps, limit = 30, userContext = null) {
  const [movies, tv] = await Promise.all([
    buildMostPopular(deps, Math.ceil(limit * 0.6), 'movie', userContext),
    buildMostPopular(deps, Math.ceil(limit * 0.6), 'tv', userContext)
  ]);
  const merged = [...movies, ...tv];
  merged.sort((a, b) => b.popularity - a.popularity);
  return merged.slice(0, limit);
}

async function buildNewReleasesMixed(deps, cfg, userContext = null) {
  const idToName = await genreIdToName(deps);
  const recentDays = cfg.recentDays || 150;
  const from = new Date(Date.now() - recentDays * 86400000).toISOString().slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);
  const pool = [];
  for (const type of ['movie', 'tv']) {
    const params = {
      sort_by: 'popularity.desc',
      include_adult: 'false',
      'vote_count.gte': String(cfg.voteGte || 40)
    };
    if (type === 'tv') {
      params['first_air_date.gte'] = from;
      params['first_air_date.lte'] = today;
    } else {
      params['primary_release_date.gte'] = from;
      params['primary_release_date.lte'] = today;
    }
    const raw = await fetchDiscoverPages(deps, type, params, cfg.pages || 3);
    pool.push(...raw.map((r) => mapItem(deps, r, type, idToName)));
  }
  return finalizeItems(deps, filterExcluded(pool, userContext), {
    limit: cfg.limit || 40,
    scoreOpts: { minVotes: cfg.minVotes || 200, meanVote: cfg.meanVote || 6.4 },
    sortBy: 'popularity',
    userContext
  });
}

async function buildHighestGrossing(deps, limit = 20, userContext = null) {
  const idToName = await genreIdToName(deps);
  const raw = await fetchDiscoverPages(deps, 'movie', {
    sort_by: 'revenue.desc',
    include_adult: 'false',
    'vote_count.gte': '300'
  }, 2);
  const items = raw.map((r) => mapItem(deps, r, 'movie', idToName));
  finalizeItems(deps, items, { limit: items.length });
  const seen = new Set();
  const out = [];
  for (const it of filterExcluded(items, userContext)) {
    if (!it.tmdbId || !it.poster) continue;
    const key = `${it.mediaType}:${it.tmdbId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(it);
    if (out.length >= limit) break;
  }
  return out;
}

async function buildMultiCountryCollection(deps, cfg, userContext = null) {
  const idToName = await genreIdToName(deps);
  const pool = [];
  for (const code of (cfg.countries || [])) {
    const params = {
      sort_by: 'vote_count.desc',
      include_adult: 'false',
      'vote_count.gte': String(cfg.voteGte || 60),
      with_origin_country: code
    };
    const raw = await fetchDiscoverPages(deps, 'movie', params, 2);
    pool.push(...raw.map((r) => mapItem(deps, r, 'movie', idToName)));
  }
  return finalizeItems(deps, filterExcluded(pool, userContext), {
    limit: cfg.limit || 40,
    scoreOpts: { minVotes: cfg.minVotes || 200, meanVote: cfg.meanVote || 6.4 },
    userContext
  });
}

async function buildConfigCollection(deps, cfg, userContext = null) {
  if (cfg.special === 'trending') return buildMostPopular(deps, cfg.limit || 20, 'movie', userContext);
  if (cfg.special === 'trending-tv') return buildMostPopular(deps, cfg.limit || 20, 'tv', userContext);
  if (cfg.special === 'trending-mixed') return buildTrendingMixed(deps, cfg.limit || 30, userContext);
  if (cfg.special === 'new-releases-mixed') return buildNewReleasesMixed(deps, cfg, userContext);
  if (cfg.special === 'best-recent') return buildBestRecent(deps, cfg.limit || 20, userContext);
  if (cfg.special === 'highest-grossing') return buildHighestGrossing(deps, cfg.limit || 20, userContext);
  if (cfg.special === 'top-series') return buildTopSeries(deps, cfg.limit || 20, userContext);
  if (cfg.countries?.length) return buildMultiCountryCollection(deps, cfg, userContext);

  const media = cfg.media === 'tv' ? 'tv' : 'movie';
  const idToName = await genreIdToName(deps);
  const nameToId = await genreNameToId(deps);

  const params = {
    sort_by: cfg.sort === 'date'
      ? (media === 'tv' ? 'first_air_date.desc' : 'primary_release_date.desc')
      : cfg.sort === 'popularity' ? 'popularity.desc' : 'vote_count.desc',
    include_adult: 'false',
    'vote_count.gte': String(cfg.voteGte || 200)
  };
  if (cfg.voteLte) params['vote_count.lte'] = String(cfg.voteLte);
  if (cfg.ratingGte) params['vote_average.gte'] = String(cfg.ratingGte);
  if (cfg.lang) params.with_original_language = cfg.lang;
  if (cfg.country) params.with_origin_country = cfg.country;

  const genreList = [...(cfg.genres || [])];
  if (cfg.contentType === 'anime' || cfg.contentType === 'western-animation') {
    if (!genreList.includes('мультфильм')) genreList.push('мультфильм');
  }
  if (genreList.length) {
    const ids = genreList.map((g) => nameToId.get(g)).filter(Boolean);
    if (ids.length) params.with_genres = ids.join('|');
  }
  if (cfg.excludeGenres?.length) {
    const ids = cfg.excludeGenres.map((g) => nameToId.get(g)).filter(Boolean);
    if (ids.length) params.without_genres = ids.join(',');
  }
  if (cfg.keywords?.length) {
    const kwIds = await resolveKeywordIds(deps, cfg.keywords);
    if (kwIds.length) params.with_keywords = kwIds.join('|');
  }
  if (cfg.recentDays) {
    const from = new Date(Date.now() - cfg.recentDays * 86400000).toISOString().slice(0, 10);
    const today = new Date().toISOString().slice(0, 10);
    if (media === 'tv') { params['first_air_date.gte'] = from; params['first_air_date.lte'] = today; }
    else { params['primary_release_date.gte'] = from; params['primary_release_date.lte'] = today; }
  }
  if (cfg.dateTo) {
    if (media === 'tv') params['first_air_date.lte'] = cfg.dateTo;
    else params['primary_release_date.lte'] = cfg.dateTo;
  }

  const raw = await fetchDiscoverPages(deps, media, params, cfg.pages || 4);
  let items = raw.map((r) => mapItem(deps, r, media, idToName));
  items = filterExcluded(items, userContext);

  let result = finalizeItems(deps, items, {
    limit: cfg.limit || 40,
    scoreOpts: { minVotes: cfg.minVotes || 400, meanVote: cfg.meanVote || 6.6 },
    sortBy: cfg.sort === 'popularity' || cfg.sort === 'date' ? 'popularity' : 'score',
    userContext,
    contentType: cfg.contentType || null
  });

  if (result.length < Math.min(8, (cfg.limit || 20) / 2) && cfg.fallback) {
    const fb = getReadyCollection(cfg.fallback);
    if (fb && fb.id !== cfg.id) {
      const fbItems = await buildConfigCollection(deps, fb, userContext);
      const seen = new Set(result.map((r) => `${r.mediaType}:${r.tmdbId}`));
      for (const it of fbItems) {
        const k = `${it.mediaType}:${it.tmdbId}`;
        if (!seen.has(k)) { result.push(it); seen.add(k); }
        if (result.length >= (cfg.limit || 20)) break;
      }
    }
  }

  return result.slice(0, cfg.limit || 40);
}

async function buildTop200(deps, filter = 'all', userContext = null) {
  const idToName = await genreIdToName(deps);
  const collect = async (type, pages, voteGte) => {
    const raw = await fetchDiscoverPages(deps, type, {
      sort_by: 'vote_count.desc',
      include_adult: 'false',
      'vote_count.gte': String(voteGte)
    }, pages);
    return raw.map((r) => mapItem(deps, r, type, idToName));
  };

  let items = [];
  if (filter === 'movie') items = await collect('movie', 12, 1000);
  else if (filter === 'tv') items = await collect('tv', 12, 400);
  else {
    const [movies, tv] = await Promise.all([collect('movie', 10, 1000), collect('tv', 6, 400)]);
    items = [...movies, ...tv];
  }
  return finalizeItems(deps, filterExcluded(items, userContext), {
    limit: 200,
    scoreOpts: { minVotes: 1500, meanVote: 6.8 },
    userContext
  });
}

function builderFor(id) {
  const cfg = getReadyCollection(id);
  if (cfg) return (deps, userContext) => buildConfigCollection(deps, cfg, userContext);
  return null;
}

export function getCatalogIndex(lang = 'ru') {
  return {
    groups: getCatalogCollectionGroups(lang),
    hasTop200: true
  };
}

export function getHomeRails(lang = 'ru') {
  return { collections: getHomeCollections(lang) };
}

export async function getCatalogCollection(deps, id, lang = 'ru', userContext = null) {
  const cacheId = `col:${normLang(lang)}:${id}:${userContext ? 'u' : 'g'}`;
  const cached = getCached(cacheId);
  if (cached) return cached;
  const builder = builderFor(id);
  if (!builder) return null;
  return coalesce(cacheId, async () => {
    const fresh = getCached(cacheId);
    if (fresh) return fresh;
    const items = await builder(deps, userContext);
    return setCached(cacheId, items);
  });
}

export async function getCatalogTop200(deps, filter = 'all', lang = 'ru', userContext = null) {
  const f = ['movie', 'tv', 'all'].includes(filter) ? filter : 'all';
  const cacheId = `top200:${normLang(lang)}:${f}:${userContext ? 'u' : 'g'}`;
  const cached = getCached(cacheId);
  if (cached) return cached;
  return coalesce(cacheId, async () => {
    const fresh = getCached(cacheId);
    if (fresh) return fresh;
    const items = await buildTop200(deps, f, userContext);
    return setCached(cacheId, items);
  });
}
