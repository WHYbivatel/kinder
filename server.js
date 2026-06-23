import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import os from 'os';
import { fileURLToPath } from 'url';
import {
  parseLocalChat,
  formatOpenAIError,
  validateChatActions,
  isMovieRelatedPrompt,
  classifyChatIntent,
  detectRecommendationRequest,
  OFF_TOPIC_REPLY
} from './localAssistant.js';
import { pickRandomTitles, randomRating } from './moviePool.js';
import { pickBestTmdbResult } from './tmdbMatch.js';
import { resolveSearchQuery, buildTmdbSearchQueries } from './titleAliases.js';
import { resolveHdrezkaMovie } from './hdrezka.js';
import { resolveKinogoMovie, buildKinogoSearchUrl } from './kinogo.js';
import { initGlobalSignals, recordInteraction, getSocialScore, getTopLiked } from './globalSignals.js';
import { fetchExternalRatings } from './ratings.js';
import { findDuplicate } from './dedupe.js';
import { computeAchievements } from './achievements.js';
import {
  loadUserPrefs, saveUserPrefs, buildBlacklistPrompt, matchesBlacklist
} from './prefs.js';
import {
  PSYCH_QUESTIONS,
  PSYCH_PROFILES,
  PSYCH_FEEDBACK_REASONS,
  calculatePsychResult,
  buildPsychTestPrompt,
  buildPsychRecFeedbackPrompt,
  buildPsychRecommendationUserContext,
  buildPsychRecommendationPrompt,
  parsePsychRecommendationsJson,
  enrichScales,
  enrichPsychAnswers,
  buildDynamicsText
} from './psychTestLogic.js';
import {
  VISUAL_QUESTIONS,
  VISUAL_PROFILES,
  VISUAL_FEEDBACK_REASONS,
  calculateVisualResult,
  buildVisualTestPrompt,
  buildVisualRecFeedbackPrompt,
  buildVisualRecommendationUserContext,
  buildVisualRecommendationPrompt,
  parseVisualRecommendationsJson,
  enrichVisualScales,
  buildVisualDynamicsText
} from './visualTestLogic.js';
import {
  SHORT_VISUAL_TESTS,
  calculateShortVisualResult,
  getTestQuestions,
  saveShortVisualTestResult,
  normalizeShortVisualPrefs,
  findShortVisualResultById,
  buildShortVisualTestPrompt,
  buildShortVisualRecFeedbackPrompt,
  buildShortVisualRecommendationUserContext,
  buildShortVisualRecommendationPrompt,
  parseShortVisualRecommendationsJson,
  sanitizeShortVisualTestConnection,
  SHORT_VISUAL_FEEDBACK_REASONS
} from './shortVisualTestLogic.js';
import { parseImportText, detectImportFormat } from './importParsers.js';
import {
  recommendForUser,
  buildUserTasteProfile,
  scoreTmdbResultsForUser,
  scoreMovieForUser,
  canonicalGenre,
  getGenreNameMap
} from './recommendationEngine.js';
import {
  buildUserItemMatrix,
  getCollaborativeScores,
  getHybridRecommendations,
  actionWeight as hybridActionWeight,
  movieKey as hybridMovieKey
} from './hybrid.js';
import { buildCategoryProfile } from './filmCategories.js';
import { buildSiteRatings } from './siteRatings.js';
import {
  buildGraph,
  setSimilarEdges,
  graphCollaborativeCandidates,
  graphStats
} from './graph.js';
import {
  pickWatchNowLocal,
  rankWatchNowCandidates,
  mergeWatchNowPicks,
  buildWatchNowCandidateSummary,
  buildWatchNowPromptCounts,
  topUpWatchNowFromList,
  appendNewWatchNowPicks,
  finalizeWatchNowPicks,
  filterPicksByDuration,
  isWatchNowComplete,
  normalizeWatchTitle,
  matchesPickDuration,
  formatNewWatchNowPick,
  DURATION_LABELS,
  MOOD_LABELS,
  MOOD_TMDB_GENRES,
  WATCH_NOW_LIMIT
} from './watchNow.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = 3000;

const DATA_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const MOVIES_DIR = path.join(DATA_DIR, 'movies');
const sessions = new Map();

const tools = [
  {
    type: 'function',
    function: {
      name: 'add_random_movies',
      description: 'Добавить N случайных фильмов или сериалов из известного пула (для тестов и быстрого наполнения списка)',
      parameters: {
        type: 'object',
        properties: {
          count: { type: 'number', description: 'Сколько добавить (1–50)' },
          status: { type: 'string', enum: ['want', 'watching', 'watched'] },
          randomRating: { type: 'boolean', description: 'Случайная оценка 1–10 для каждого (для watched)' },
          rating: { type: 'number', description: 'Одна оценка для всех' },
          mediaType: { type: 'string', enum: ['movie', 'tv'] }
        },
        required: ['count']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'add_movies',
      description: 'Добавить несколько фильмов или сериалов',
      parameters: {
        type: 'object',
        properties: {
          titles: { type: 'array', items: { type: 'string' } },
          status: { type: 'string', enum: ['want', 'watching', 'watched'] },
          mediaType: { type: 'string', enum: ['movie', 'tv'], description: 'movie = фильм, tv = сериал' },
          rating: { type: 'number', description: 'Оценка 1–10 для всех (для watched)' },
          genres: { type: 'array', items: { type: 'string' } },
          tags: { type: 'array', items: { type: 'string' } }
        },
        required: ['titles']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'add_movie',
      description: 'Добавить один фильм или сериал',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Русское название как на HDRezka/Кинопоиске' },
          originalTitle: { type: 'string', description: 'Оригинальное название (англ.) для поиска в TMDB, если знаете' },
          status: { type: 'string', enum: ['want', 'watching', 'watched'] },
          mediaType: { type: 'string', enum: ['movie', 'tv'], description: 'movie = фильм, tv = сериал' },
          rating: { type: 'number' },
          genres: { type: 'array', items: { type: 'string' } },
          tags: { type: 'array', items: { type: 'string' } }
        },
        required: ['title', 'status']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'delete_movie',
      description: 'Удалить фильм или сериал из списка',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          mediaType: { type: 'string', enum: ['movie', 'tv'] }
        },
        required: ['title']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'update_movie',
      description: 'Изменить статус, оценку, жанры или теги фильма/сериала',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          mediaType: { type: 'string', enum: ['movie', 'tv'] },
          status: { type: 'string', enum: ['want', 'watching', 'watched'] },
          rating: { type: 'number' },
          genres: { type: 'array', items: { type: 'string' } },
          tags: { type: 'array', items: { type: 'string' } }
        },
        required: ['title']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'update_movie_notes',
      description: 'Обновить заметки к фильму',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          mediaType: { type: 'string', enum: ['movie', 'tv'] },
          personal: { type: 'string' },
          liked: { type: 'string' },
          disliked: { type: 'string' },
          favoriteScene: { type: 'string' },
          rewatch: { type: 'string' },
          review: { type: 'string' }
        },
        required: ['title']
      }
    }
  }
];

function ensureDataDirs() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
  if (!fs.existsSync(MOVIES_DIR)) fs.mkdirSync(MOVIES_DIR);
  if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, '{}');
}

function loadUsers() {
  return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
}

function saveUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

function findCanonicalUsername(users, username) {
  const requested = String(username || '').trim();
  if (!requested) return null;
  if (users[requested]) return requested;
  const lower = requested.toLowerCase();
  return Object.keys(users).find((name) => name.toLowerCase() === lower) || null;
}

function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

function getMoviesPath(username) {
  const requested = String(username || '').trim();
  const exactPath = path.join(MOVIES_DIR, `${requested}.json`);
  if (fs.existsSync(exactPath)) return exactPath;

  const lowerFileName = `${requested}.json`.toLowerCase();
  const existingFile = fs.readdirSync(MOVIES_DIR)
    .find((fileName) => fileName.toLowerCase() === lowerFileName);
  return path.join(MOVIES_DIR, existingFile || `${requested}.json`);
}

function repairMovieFromHistory(movie) {
  if (!movie || !Array.isArray(movie.history) || movie.history.length === 0) return movie;

  const sorted = [...movie.history].sort((a, b) => String(a.at || '').localeCompare(String(b.at || '')));
  let statusFromHistory = null;
  let ratingFromHistory = null;

  for (const entry of sorted) {
    if (entry.type === 'status') {
      statusFromHistory = entry.to;
      ratingFromHistory = entry.rating ?? ratingFromHistory;
    } else if (entry.type === 'added' && !statusFromHistory) {
      statusFromHistory = entry.status || 'want';
    }
  }

  if (
    statusFromHistory
    && statusRank(statusFromHistory) > statusRank(movie.status || 'want')
  ) {
    movie.status = statusFromHistory;
    if (statusFromHistory === 'watched' && ratingFromHistory != null) {
      movie.rating = ratingFromHistory;
    }
    if (statusFromHistory === 'want') {
      movie.rating = null;
    }
  }

  return movie;
}

function loadUserMovies(username) {
  const filePath = getMoviesPath(username);
  if (!fs.existsSync(filePath)) return { movies: [], nextId: 1 };
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  if (Array.isArray(data.movies)) {
    data.movies = data.movies.map(repairMovieFromHistory);
  }
  return data;
}

function saveUserMovies(username, data) {
  const filePath = getMoviesPath(username);
  if (fs.existsSync(filePath)) {
    fs.copyFileSync(filePath, `${filePath}.bak`);
  }
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  // Список/оценки/статусы/заметки/битвы изменились — сбрасываем кеш рекомендаций.
  invalidateUserRecommendations(username);
}

function normalizeMovieKey(movie) {
  const mediaType = movie?.mediaType || 'movie';
  if (movie?.tmdbId) return `${mediaType}:tmdb:${movie.tmdbId}`;
  const title = String(movie?.title || movie?.meta?.originalTitle || '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/\s+/g, ' ')
    .trim();
  return title ? `${mediaType}:title:${title}` : null;
}

function isValidMovieId(id) {
  return Number.isInteger(id) && id > 0;
}

function nextFreeMovieId(usedIds, nextId) {
  let id = Math.max(1, Number(nextId) || 1);
  while (usedIds.has(id)) id += 1;
  usedIds.add(id);
  return id;
}

function repairMovieIds(movies, nextId = 1) {
  const usedIds = new Set();
  let cursor = nextId;
  const repaired = [];

  for (const movie of movies || []) {
    if (!movie?.title) continue;
    const copy = { ...movie };
    if (!isValidMovieId(copy.id) || usedIds.has(copy.id)) {
      copy.id = nextFreeMovieId(usedIds, cursor);
      cursor = copy.id + 1;
    } else {
      usedIds.add(copy.id);
      cursor = Math.max(cursor, copy.id + 1);
    }
    repaired.push(copy);
  }

  return { movies: repaired, nextId: cursor };
}

function normalizeIncomingMovies(existingMovies, incomingMovies, nextId = 1) {
  const usedIds = new Set((existingMovies || []).map((movie) => movie.id).filter(isValidMovieId));
  const existingKeyToId = new Map();
  const existingIdToKey = new Map();
  for (const movie of existingMovies || []) {
    const key = normalizeMovieKey(movie);
    if (!key) continue;
    existingKeyToId.set(key, movie.id);
    existingIdToKey.set(movie.id, key);
  }

  const normalized = [];
  let cursor = nextId;
  for (const movie of incomingMovies || []) {
    if (!movie?.title) continue;
    const copy = { ...movie };
    const key = normalizeMovieKey(copy);
    const existingId = key ? existingKeyToId.get(key) : null;
    const idBelongsToOtherMovie = isValidMovieId(copy.id)
      && existingIdToKey.has(copy.id)
      && existingIdToKey.get(copy.id) !== key;
    const idAlreadyUsedByIncoming = isValidMovieId(copy.id)
      && usedIds.has(copy.id)
      && copy.id !== existingId;

    if (existingId) {
      copy.id = existingId;
    } else if (!isValidMovieId(copy.id) || idBelongsToOtherMovie || idAlreadyUsedByIncoming) {
      copy.id = nextFreeMovieId(usedIds, cursor);
      cursor = copy.id + 1;
    } else {
      usedIds.add(copy.id);
      cursor = Math.max(cursor, copy.id + 1);
    }
    normalized.push(copy);
  }

  return { movies: normalized, nextId: cursor };
}

function buildSavedMoviePayload(existing, incomingMovies, options = {}) {
  const deletedIds = new Set((options.deletedMovieIds || []).filter(isValidMovieId));
  const filteredIncoming = (incomingMovies || []).filter((movie) => movie?.title && !deletedIds.has(movie.id));
  const existingById = new Map((existing.movies || []).map((movie) => [movie.id, movie]));
  const existingByKey = new Map();
  for (const movie of existing.movies || []) {
    const key = normalizeMovieKey(movie);
    if (key) existingByKey.set(key, movie);
  }

  const normalizedIncoming = normalizeIncomingMovies(existing.movies || [], filteredIncoming, existing.nextId || options.nextId || 1);
  const mergedMovies = normalizedIncoming.movies.map((incoming) => {
    const key = normalizeMovieKey(incoming);
    const prev = existingById.get(incoming.id) || (key ? existingByKey.get(key) : null);
    return prev ? mergeMovieRecord(prev, incoming) : incoming;
  });

  return {
    movies: repairMovieIds(mergedMovies, normalizedIncoming.nextId).movies,
    nextId: mergeNextId(existing.nextId, options.nextId, mergedMovies),
    battleSessions: options.battleSessions ?? existing.battleSessions ?? [],
    battleMatches: options.battleMatches ?? existing.battleMatches ?? []
  };
}

function mergeNextId(existingNextId, incomingNextId, movies) {
  const maxId = (movies || []).reduce((max, movie) => Math.max(max, movie.id || 0), 0);
  return Math.max(existingNextId || 1, incomingNextId || 1, maxId + 1);
}

function statusRank(status) {
  return { want: 0, watching: 1, watched: 2 }[status] ?? 0;
}

function mergeMovieRecord(existing, incoming) {
  if (!existing) return incoming;
  if (!incoming) return existing;

  const merged = { ...existing, ...incoming };

  if (statusRank(incoming.status) >= statusRank(existing.status)) {
    merged.status = incoming.status;
    merged.rating = incoming.status === 'want' ? null : (incoming.rating ?? existing.rating);
    merged.watchedAt = incoming.watchedAt ?? existing.watchedAt;
  } else {
    merged.status = existing.status;
    merged.rating = existing.rating ?? incoming.rating;
    merged.watchedAt = existing.watchedAt ?? incoming.watchedAt;
  }

  if (existing.mediaType && incoming.mediaType && existing.mediaType !== incoming.mediaType) {
    merged.mediaType = existing.mediaType;
    if (existing.tmdbId) merged.tmdbId = existing.tmdbId;
  }

  const exHist = existing.history || [];
  const inHist = incoming.history || [];
  merged.history = exHist.length >= inHist.length ? exHist : inHist;

  merged.meta = { ...(incoming.meta || {}), ...(existing.meta || {}) };
  if (existing.meta?.matchSource === 'manual') {
    merged.meta.matchSource = 'manual';
    if (existing.meta?.poster) merged.meta.poster = existing.meta.poster;
    if (existing.meta?.originalTitle) merged.meta.originalTitle = existing.meta.originalTitle;
  }

  merged.notes = { ...(incoming.notes || {}), ...(existing.notes || {}) };

  merged.battleWins = Math.max(existing.battleWins || 0, incoming.battleWins || 0);
  merged.battleLosses = Math.max(existing.battleLosses || 0, incoming.battleLosses || 0);
  merged.battleScore = Math.max(existing.battleScore || 0, incoming.battleScore || 0);

  return merged;
}

function initUserMovies(username) {
  saveUserMovies(username, { movies: [], nextId: 1 });
}

function createSession(username) {
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, { username });
  return token;
}

function getUsernameFromRequest(req) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return null;
  return sessions.get(token)?.username || null;
}

function requireAuth(req, res) {
  const username = getUsernameFromRequest(req);
  if (!username) {
    res.status(401).json({ error: 'Войдите в аккаунт' });
    return null;
  }
  return username;
}

/* optionalAuth — для публичных эндпоинтов: возвращает username, если
   пользователь вошёл, либо null. Никогда не отвечает 401, чтобы гость
   мог пользоваться ограниченным функционалом без входа. */
function optionalAuth(req) {
  return getUsernameFromRequest(req);
}

function buildTasteContext(movies, blacklist = null) {
  const filtered = blacklist
    ? movies.filter((m) => !matchesBlacklist(m, blacklist))
    : movies;
  const watched = filtered.filter((m) => m.status === 'watched');

  const battleTop = [...watched]
    .filter((m) => (m.battleWins || 0) > 0 || (m.battleScore || 0) > 0)
    .sort((a, b) => {
      const scoreDiff = (b.battleScore || 0) - (a.battleScore || 0);
      if (scoreDiff !== 0) return scoreDiff;
      return (b.battleWins || 0) - (a.battleWins || 0);
    })
    .slice(0, 10);

  const lines = watched.map((m) => {
    const parts = [`${m.title}${m.mediaType === 'tv' ? ' (сериал)' : ''}`];
    if (m.rating) parts.push(`оценка ${m.rating}`);
    if (m.genres?.length) parts.push(`жанры: ${m.genres.join(', ')}`);
    if (m.tags?.length) parts.push(`теги: ${m.tags.join(', ')}`);
    if (m.meta?.director) parts.push(`режиссёр: ${m.meta.director}`);
    if (m.battleWins) parts.push(`побед в битве: ${m.battleWins}`);
    if (m.battleScore) parts.push(`battleScore: ${m.battleScore}`);
    if (m.notes?.liked) parts.push(`понравилось: ${m.notes.liked}`);
    if (m.notes?.disliked) parts.push(`не понравилось: ${m.notes.disliked}`);
    if (m.notes?.review) parts.push(`отзыв: ${m.notes.review}`);
    return parts.join(' | ');
  });

  let battleBlock = '';
  if (battleTop.length) {
    battleBlock = '\n\nТоп по битвам фильмов (важно для вкуса):\n' +
      battleTop.map((m, i) => {
        const extra = [
          m.battleWins ? `${m.battleWins} побед` : null,
          m.battleScore ? `score ${m.battleScore}` : null,
          m.rating ? `оценка ${m.rating}` : null
        ].filter(Boolean).join(', ');
        return `${i + 1}. ${m.title} (${extra})`;
      }).join('\n');
  }

  return lines.join('\n') + battleBlock;
}

function appendPsychSignals(prefs) {
  if (!prefs) return '';
  return buildPsychTestPrompt(prefs.psychTest)
    + buildPsychRecFeedbackPrompt(prefs.psychRecFeedback)
    + buildVisualTestPrompt(prefs.visualTest)
    + buildVisualRecFeedbackPrompt(prefs.visualRecFeedback)
    + buildShortVisualTestPrompt(prefs.shortVisualTests?.lastResults)
    + buildShortVisualRecFeedbackPrompt(prefs.shortVisualRecFeedback);
}

async function enrichPsychRecommendations(items) {
  return Promise.all((items || []).map(async (item) => {
    const mediaType = item.type === 'series' || item.mediaType === 'tv' ? 'tv' : 'movie';
    const searchTitle = resolveSearchQuery(item.tmdbQuery || item.title);
    const enriched = await enrichMovieSuggestion({
      title: item.title,
      mediaType,
      poster: item.poster,
      year: item.year
    });
    const tmdbFallback = searchTitle !== item.title
      ? await enrichMovieSuggestion({ title: searchTitle, mediaType })
      : null;
    return {
      ...enriched,
      title: enriched.title || item.title,
      poster: enriched.poster || tmdbFallback?.poster || null,
      year: enriched.year || item.year || tmdbFallback?.year || null,
      tmdbId: enriched.tmdbId || tmdbFallback?.tmdbId || null,
      type: mediaType === 'tv' ? 'series' : 'movie',
      mediaType,
      genres: item.genres || [],
      reason: item.reason || '',
      testConnection: item.testConnection || '',
      mood: item.mood || '',
      pace: item.pace || '',
      overview: item.overview || enriched.meta?.overview || item.reason || ''
    };
  }));
}

function generatePsychResultId() {
  return `ptr_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
}

function buildPsychResultRecord(result) {
  const scalesDetailed = result.scalesDetailed || enrichScales(result.scales, result.scaleScores);
  return {
    id: generatePsychResultId(),
    completedAt: new Date().toISOString(),
    profile: result.profile,
    profileTitle: result.profileTitle,
    profileDescription: result.profileDescription,
    profileShortDescription: result.profileShortDescription,
    scores: result.scores,
    scales: scalesDetailed,
    answers: result.answers,
    traits: result.traits,
    suits: result.suits,
    avoid: result.avoid
  };
}

function normalizeScaleEntry(scales) {
  if (!scales) return {};
  const out = {};
  for (const key of ['depth', 'emotionality', 'dynamics', 'comfort']) {
    const val = scales[key];
    if (typeof val === 'object' && val?.level) {
      out[key] = val;
    } else if (val) {
      out[key] = enrichScales({ [key]: val })[key];
    }
  }
  return out;
}

function normalizePsychHistoryEntry(entry) {
  if (!entry) return null;
  return {
    id: entry.id || generatePsychResultId(),
    completedAt: entry.completedAt,
    profile: entry.profile,
    profileTitle: entry.profileTitle,
    profileDescription: entry.profileDescription || '',
    profileShortDescription: entry.profileShortDescription || '',
    scores: entry.scores || {},
    scales: normalizeScaleEntry(entry.scales),
    answers: entry.answers || [],
    traits: entry.traits || null,
    suits: entry.suits || [],
    avoid: entry.avoid || []
  };
}

function normalizePsychPrefs(prefs) {
  if (!Array.isArray(prefs.psychTestHistory)) prefs.psychTestHistory = [];

  if (prefs.psychTest?.completedAt) {
    if (!prefs.psychTest.id) prefs.psychTest.id = generatePsychResultId();
    prefs.psychTest.scales = normalizeScaleEntry(prefs.psychTest.scales);
    const inHistory = prefs.psychTestHistory.some(
      (h) => h.id === prefs.psychTest.id
        || (h.completedAt === prefs.psychTest.completedAt && h.profile === prefs.psychTest.profile)
    );
    if (!inHistory) {
      prefs.psychTestHistory.unshift(normalizePsychHistoryEntry(prefs.psychTest));
    }
  }

  prefs.psychTestHistory = prefs.psychTestHistory
    .map(normalizePsychHistoryEntry)
    .filter(Boolean)
    .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt));

  if (prefs.psychTestHistory.length > 20) {
    prefs.psychTestHistory = prefs.psychTestHistory.slice(0, 20);
  }

  if (prefs.psychTestHistory[0]?.completedAt && prefs.psychTest?.completedAt) {
    const latest = prefs.psychTestHistory[0];
    if (new Date(latest.completedAt) > new Date(prefs.psychTest.completedAt)) {
      prefs.psychTest = { ...latest };
    }
  }
}

function findPsychResultById(prefs, resultId) {
  if (!resultId) return prefs.psychTest || null;
  if (prefs.psychTest?.id === resultId) return prefs.psychTest;
  return (prefs.psychTestHistory || []).find((h) => h.id === resultId) || null;
}

function savePsychTestResult(prefs, result) {
  const psychTest = buildPsychResultRecord(result);
  prefs.psychTest = psychTest;
  if (!Array.isArray(prefs.psychTestHistory)) prefs.psychTestHistory = [];
  prefs.psychTestHistory.unshift(normalizePsychHistoryEntry(psychTest));
  if (prefs.psychTestHistory.length > 20) {
    prefs.psychTestHistory = prefs.psychTestHistory.slice(0, 20);
  }
  return psychTest;
}

async function enrichVisualRecommendations(items) {
  return Promise.all((items || []).map(async (item) => {
    const mediaType = item.type === 'series' || item.mediaType === 'tv' ? 'tv' : 'movie';
    const searchTitle = resolveSearchQuery(item.tmdbQuery || item.title);
    const enriched = await enrichMovieSuggestion({
      title: item.title,
      mediaType,
      poster: item.poster,
      year: item.year
    });
    const tmdbFallback = searchTitle !== item.title
      ? await enrichMovieSuggestion({ title: searchTitle, mediaType })
      : null;
    return {
      ...enriched,
      title: enriched.title || item.title,
      poster: enriched.poster || tmdbFallback?.poster || null,
      year: enriched.year || item.year || tmdbFallback?.year || null,
      tmdbId: enriched.tmdbId || tmdbFallback?.tmdbId || null,
      type: mediaType === 'tv' ? 'series' : 'movie',
      mediaType,
      genres: item.genres || [],
      reason: item.reason || '',
      visualConnection: item.visualConnection || '',
      visualMood: item.visualMood || '',
      pace: item.pace || '',
      overview: item.overview || enriched.meta?.overview || item.reason || ''
    };
  }));
}

function generateVisualResultId() {
  return `vtr_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
}

function buildVisualResultRecord(result) {
  const scalesDetailed = result.scalesDetailed || enrichVisualScales(result.scales, result.scaleScores);
  return {
    id: generateVisualResultId(),
    completedAt: new Date().toISOString(),
    profile: result.profile,
    profileTitle: result.profileTitle,
    profileDescription: result.profileDescription,
    profileShortDescription: result.profileShortDescription,
    scores: result.scores,
    scales: scalesDetailed,
    answers: result.answers,
    suits: result.suits,
    avoid: result.avoid
  };
}

function normalizeVisualScaleEntry(scales) {
  if (!scales) return {};
  const out = {};
  for (const key of ['atmosphere', 'emotionality', 'tension', 'comfort']) {
    const val = scales[key];
    if (typeof val === 'object' && val?.level) {
      out[key] = val;
    } else if (val) {
      out[key] = enrichVisualScales({ [key]: val })[key];
    }
  }
  return out;
}

function normalizeVisualHistoryEntry(entry) {
  if (!entry) return null;
  return {
    id: entry.id || generateVisualResultId(),
    completedAt: entry.completedAt,
    profile: entry.profile,
    profileTitle: entry.profileTitle,
    profileDescription: entry.profileDescription || '',
    profileShortDescription: entry.profileShortDescription || '',
    scores: entry.scores || {},
    scales: normalizeVisualScaleEntry(entry.scales),
    answers: entry.answers || [],
    suits: entry.suits || [],
    avoid: entry.avoid || []
  };
}

function normalizeVisualPrefs(prefs) {
  if (!Array.isArray(prefs.visualTestHistory)) prefs.visualTestHistory = [];

  if (prefs.visualTest?.completedAt) {
    if (!prefs.visualTest.id) prefs.visualTest.id = generateVisualResultId();
    prefs.visualTest.scales = normalizeVisualScaleEntry(prefs.visualTest.scales);
    const inHistory = prefs.visualTestHistory.some(
      (h) => h.id === prefs.visualTest.id
        || (h.completedAt === prefs.visualTest.completedAt && h.profile === prefs.visualTest.profile)
    );
    if (!inHistory) {
      prefs.visualTestHistory.unshift(normalizeVisualHistoryEntry(prefs.visualTest));
    }
  }

  prefs.visualTestHistory = prefs.visualTestHistory
    .map(normalizeVisualHistoryEntry)
    .filter(Boolean)
    .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt));

  if (prefs.visualTestHistory.length > 20) {
    prefs.visualTestHistory = prefs.visualTestHistory.slice(0, 20);
  }

  if (prefs.visualTestHistory[0]?.completedAt && prefs.visualTest?.completedAt) {
    const latest = prefs.visualTestHistory[0];
    if (new Date(latest.completedAt) > new Date(prefs.visualTest.completedAt)) {
      prefs.visualTest = { ...latest };
    }
  }
}

function findVisualResultById(prefs, resultId) {
  if (!resultId) return prefs.visualTest || null;
  if (prefs.visualTest?.id === resultId) return prefs.visualTest;
  return (prefs.visualTestHistory || []).find((h) => h.id === resultId) || null;
}

function saveVisualTestResult(prefs, result) {
  const visualTest = buildVisualResultRecord(result);
  prefs.visualTest = visualTest;
  if (!Array.isArray(prefs.visualTestHistory)) prefs.visualTestHistory = [];
  prefs.visualTestHistory.unshift(normalizeVisualHistoryEntry(visualTest));
  if (prefs.visualTestHistory.length > 20) {
    prefs.visualTestHistory = prefs.visualTestHistory.slice(0, 20);
  }
  return visualTest;
}

const OPENAI_TIMEOUT_MS = Number(process.env.OPENAI_TIMEOUT_MS) || 30000;

async function callOpenAI(apiKey, messages, useTools = true) {
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  const body = { model, messages };
  if (useTools) {
    body.tools = tools;
    body.tool_choice = 'auto';
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), OPENAI_TIMEOUT_MS);

  let response;
  try {
    response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(body)
    });
  } catch (error) {
    const err = new Error(error.name === 'AbortError'
      ? 'OpenAI не ответил вовремя'
      : 'Не удалось связаться с OpenAI');
    err.openai = formatOpenAIError(err.message);
    throw err;
  } finally {
    clearTimeout(timer);
  }

  const data = await response.json();
  if (!response.ok) {
    const err = new Error(data.error?.message || 'Ошибка OpenAI API');
    err.openai = formatOpenAIError(data.error?.message);
    throw err;
  }
  return data.choices[0].message;
}

function getLastUserMessage(messages) {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'user') return messages[i].content;
  }
  return '';
}

function handleOpenAIFailure(error, movies, userText) {
  // ВАЖНО: локальный фолбэк применяем ТОЛЬКО если он даёт реальные действия
  // (add/delete/update). «show»-результат parseLocalChat слишком жадный и при
  // сбое OpenAI выдавал «Найдено N: …» (весь список) на запрос «посоветуй …».
  // Настоящие list-команды до OpenAI не доходят (отрабатывают в /api/chat
  // раньше), поэтому здесь текстовый show-результат — это почти всегда ложное
  // срабатывание, которое показывать нельзя.
  const local = parseLocalChat(userText, movies);
  if (local && (local.actions || []).length > 0) {
    return {
      reply: `${error.openai?.message || error.message}\n\nЯ выполнил команду локально:\n${local.reply}`,
      actions: local.actions
    };
  }

  return {
    reply: error.openai?.message || error.message || 'Ошибка OpenAI',
    actions: []
  };
}

const TMDB_TIMEOUT_MS = Number(process.env.TMDB_TIMEOUT_MS) || 4000;

async function tmdbFetch(endpoint, params = {}, options = {}) {
  const apiKey = (process.env.TMDB_API_KEY || '').trim();
  if (!apiKey) return null;

  const url = new URL(`https://api.themoviedb.org/3${endpoint}`);
  url.searchParams.set('api_key', apiKey);
  url.searchParams.set('language', options.language || 'ru-RU');
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TMDB_TIMEOUT_MS);

  let response;
  try {
    response = await fetch(url, { signal: controller.signal });
  } catch (error) {
    return null;
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) return null;
  return response.json();
}

const TITLE_RULE = 'title: официальное русское название как на HDRezka/Кинопоиске. originalTitle (опционально): оригинальное английское название для поиска в TMDB — указывай, если знаете (Riverdale, Breaking Bad, The Office). Примеры: «Ривердейл» + originalTitle «Riverdale»; «Помни» + «Memento».';

function upgradeTmdbPosterUrl(url, size = 'w780') {
  if (!url) return null;
  const raw = String(url);
  if (raw.includes('image.tmdb.org/t/p/')) {
    return raw.replace(/\/t\/p\/w\d+/, `/t/p/${size}`);
  }
  return raw;
}

function tmdbPosterFromPath(posterPath, size = 'w780') {
  if (!posterPath) return null;
  const pathPart = String(posterPath).startsWith('/') ? posterPath : `/${posterPath}`;
  return `https://image.tmdb.org/t/p/${size}${pathPart}`;
}

function tmdbBackdropFromPath(backdropPath, size = 'w1280') {
  if (!backdropPath) return null;
  const pathPart = String(backdropPath).startsWith('/') ? backdropPath : `/${backdropPath}`;
  return `https://image.tmdb.org/t/p/${size}${pathPart}`;
}

/* Выбираем один YouTube-трейлер из TMDB /videos. Приоритет: официальный
   трейлер → любой трейлер → тизер. Русские дорожки предпочтительнее, но
   если их нет — берём английские. Возвращаем { key, name, site } или null. */
function pickTmdbTrailer(videos) {
  const list = (videos?.results || []).filter((v) => v.site === 'YouTube' && v.key);
  if (!list.length) return null;
  const score = (v) => {
    let s = 0;
    if (v.type === 'Trailer') s += 4;
    else if (v.type === 'Teaser') s += 2;
    if (v.official) s += 2;
    if (v.iso_639_1 === 'ru') s += 1;
    return s;
  };
  const best = [...list].sort((a, b) => score(b) - score(a))[0];
  return best ? { key: best.key, name: best.name || 'Трейлер', site: 'YouTube' } : null;
}

function mapSearchResult(m, mediaType = 'movie') {
  const date = m.release_date || m.first_air_date || null;
  return {
    tmdbId: m.id,
    title: m.title || m.name,
    originalTitle: m.original_title || m.original_name || null,
    year: date?.slice(0, 4) || null,
    releaseDate: date,
    overview: m.overview?.slice(0, 120),
    poster: tmdbPosterFromPath(m.poster_path, 'w780'),
    voteCount: m.vote_count || 0,
    mediaType
  };
}

function mapCreditsMeta(credits) {
  const directorCrew = credits?.crew?.find((c) => c.job === 'Director');
  const castList = (credits?.cast || []).slice(0, 8);
  return {
    director: directorCrew?.name || null,
    directorId: directorCrew?.id || null,
    cast: castList.map((c) => c.name).join(', ') || null,
    castDetails: castList.map((c) => ({ id: c.id, name: c.name }))
  };
}

function mapTmdbMovie(movie, credits, matchSource = 'auto', externalRatings = null, mediaType = 'movie') {
  const creditMeta = mapCreditsMeta(credits);
  const imdbId = movie.imdb_id || movie.external_ids?.imdb_id || null;
  const displayTitle = externalRatings?.title || movie.title || movie.name;
  const releaseDate = movie.release_date || movie.first_air_date || null;
  const runtime = movie.runtime
    || (movie.episode_run_time?.[0] ?? null)
    || null;

  const meta = {
    poster: tmdbPosterFromPath(movie.poster_path, 'w780'),
    backdrop: tmdbBackdropFromPath(movie.backdrop_path, 'w1280'),
    trailer: pickTmdbTrailer(movie.videos),
    year: releaseDate?.slice(0, 4) || null,
    releaseDate,
    overview: movie.overview || '',
    director: creditMeta.director,
    directorId: creditMeta.directorId,
    runtime,
    seasons: movie.number_of_seasons || null,
    voteAverage: movie.vote_average || null,
    voteCount: movie.vote_count || null,
    tagline: movie.tagline || null,
    country: movie.production_countries?.[0]?.name || null,
    cast: creditMeta.cast,
    castDetails: creditMeta.castDetails,
    matchedTitle: externalRatings?.fullTitle || displayTitle,
    originalTitle: externalRatings?.originalTitle || movie.original_title || movie.original_name || null,
    matchSource,
    imdbId,
    imdb: externalRatings?.imdb || null,
    kinopoisk: externalRatings?.kinopoisk || null,
    hdrezkaUrl: externalRatings?.hdrezkaUrl || null
  };

  return {
    tmdbId: movie.id,
    title: displayTitle,
    genres: (movie.genres || []).map((g) => g.name),
    mediaType,
    meta
  };
}

// Кэши деталей фильма/сериала. Страница фильма дёргает несколько источников:
//  • TMDB (постер, описание, жанры, актёры, трейлер) — быстро (~0.3–0.5 c);
//  • рейтинги IMDb/Кинопоиск + ссылка на Kinogo — медленный веб-скрейпинг
//    (~1.5–2.5 c на «холодный» фильм).
// Поэтому делим загрузку на две части: «ядро» (TMDB) отдаём мгновенно, а
// тяжёлые «доп-данные» (рейтинги/где смотреть) фронтенд подгружает отдельно и
// дорисовывает на странице. Так страница открывается сразу, без ожидания скрейпа.
const tmdbCoreCache = new Map();   // только TMDB-данные (быстро)
const tmdbExtrasCache = new Map(); // рейтинги IMDb/КП + Kinogo (медленно)
const TMDB_DETAILS_TTL_MS = 30 * 60 * 1000;

function cacheGet(cache, key) {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.at < TMDB_DETAILS_TTL_MS) return entry.data;
  return undefined;
}

function cacheSet(cache, key, data) {
  cache.set(key, { at: Date.now(), data });
  if (cache.size > 300) cache.delete(cache.keys().next().value);
}

// «Ядро» — только TMDB, без внешнего скрейпинга. Быстро и кэшируется.
async function loadTmdbCore(tmdbId, mediaType = 'movie') {
  const cacheKey = `${mediaType}:${tmdbId}`;
  const cached = cacheGet(tmdbCoreCache, cacheKey);
  if (cached) return cached;

  const endpoint = mediaType === 'tv' ? `/tv/${tmdbId}` : `/movie/${tmdbId}`;
  const movie = await tmdbFetch(endpoint, {
    append_to_response: 'credits,external_ids,videos',
    include_video_language: 'ru,en,null'
  });
  if (!movie) return null;

  // Маппим без внешних рейтингов (передаём null) — добавим их позже.
  const mapped = mapTmdbMovie(movie, movie.credits, 'auto', null, mediaType);
  mapped._raw = {
    imdbId: movie.imdb_id || movie.external_ids?.imdb_id || null,
    baseTitle: movie.original_title || movie.original_name || movie.title || movie.name,
    year: (movie.release_date || movie.first_air_date || '')?.slice(0, 4) || null
  };
  cacheSet(tmdbCoreCache, cacheKey, mapped);
  return mapped;
}

// «Доп-данные» — медленный скрейпинг рейтингов и ссылки на Kinogo. Кэшируется.
async function loadTmdbExtras(core, mediaType = 'movie') {
  if (!core) return null;
  const tmdbId = core.tmdbId;
  const cacheKey = `${mediaType}:${tmdbId}`;
  const cached = cacheGet(tmdbExtrasCache, cacheKey);
  if (cached) return cached;

  const matchedTitle = core.meta?.matchedTitle || core.title;
  const originalTitle = core.meta?.originalTitle || null;
  const imdbId = core._raw?.imdbId || core.meta?.imdbId || null;
  const baseTitle = core._raw?.baseTitle || originalTitle || matchedTitle;
  const year = core._raw?.year || core.meta?.year || null;

  // Рейтинги и Kinogo тянем ПАРАЛЛЕЛЬНО.
  const [externalRatings, kinogo] = await Promise.all([
    fetchExternalRatings({ imdbId, title: baseTitle, matchedTitle, originalTitle, year })
      .catch(() => null),
    resolveKinogoMovie({ title: matchedTitle, originalTitle, matchedTitle, year })
      .catch(() => null)
  ]);

  const extras = {
    imdb: externalRatings?.imdb || null,
    kinopoisk: externalRatings?.kinopoisk || null,
    hdrezkaUrl: externalRatings?.hdrezkaUrl || null,
    kinogoUrl: kinogo?.url || buildKinogoSearchUrl(matchedTitle)
  };
  cacheSet(tmdbExtrasCache, cacheKey, extras);
  return extras;
}

// Полные детали (ядро + доп-данные) — для внутренних потребителей (добавление
// фильма, импорт и т.п.), которым нужны рейтинги в одном объекте.
async function loadTmdbDetails(tmdbId, mediaType = 'movie') {
  const core = await loadTmdbCore(tmdbId, mediaType);
  if (!core) return null;
  const extras = await loadTmdbExtras(core, mediaType);
  if (extras) {
    if (extras.imdb) core.meta.imdb = extras.imdb;
    if (extras.kinopoisk) core.meta.kinopoisk = extras.kinopoisk;
    if (extras.hdrezkaUrl) core.meta.hdrezkaUrl = extras.hdrezkaUrl;
    core.meta.kinogoUrl = extras.kinogoUrl;
  }
  return core;
}

async function loadTmdbMovieDetails(tmdbId) {
  return loadTmdbDetails(tmdbId, 'movie');
}

async function lookupTmdbPreview(title, mediaType = 'movie') {
  const hit = await pickTmdbMatchForTitle(title, mediaType);
  if (!hit) return null;

  return {
    poster: upgradeTmdbPosterUrl(hit.poster, 'w780'),
    year: hit.year,
    releaseDate: hit.releaseDate || null,
    tmdbId: hit.tmdbId,
    originalTitle: hit.originalTitle,
    overview: hit.overview || null,
    mediaType
  };
}

async function searchTmdbResults(query, mediaType = 'movie', language = 'ru-RU') {
  const searchPath = mediaType === 'tv' ? '/search/tv' : '/search/movie';
  const data = await tmdbFetch(searchPath, { query, include_adult: 'false' }, { language });
  if (!data?.results?.length) return [];
  return data.results.slice(0, 10).map((r) => mapSearchResult(r, mediaType));
}

const TMDB_SEARCH_LANGUAGES = ['ru-RU', 'en-US'];

async function collectTmdbSearchResults(title, mediaType = 'movie', extraQueries = []) {
  const trimmed = String(title || '').trim();
  if (!trimmed) return [];

  const queries = buildTmdbSearchQueries(trimmed, extraQueries);
  const merged = new Map();

  const addResults = (results) => {
    for (const result of results) {
      if (!merged.has(result.tmdbId)) merged.set(result.tmdbId, result);
    }
  };

  for (const query of queries) {
    for (const language of TMDB_SEARCH_LANGUAGES) {
      addResults(await searchTmdbResults(query, mediaType, language));
    }
  }

  // Префикс для кириллицы: опечатка в конце слова не ломает поиск
  if (/[\u0400-\u04FF]/u.test(trimmed) && trimmed.length >= 5) {
    const prefixLen = Math.max(4, trimmed.length - 2);
    const prefixQueries = buildTmdbSearchQueries(trimmed.slice(0, prefixLen));
    for (const query of prefixQueries) {
      for (const language of TMDB_SEARCH_LANGUAGES) {
        addResults(await searchTmdbResults(query, mediaType, language));
      }
    }
  }

  return Array.from(merged.values());
}

async function pickTmdbMatchForTitle(title, mediaType = 'movie', extraQueries = []) {
  const trimmed = String(title || '').trim();
  if (!trimmed) return null;

  const results = await collectTmdbSearchResults(trimmed, mediaType, extraQueries);
  if (!results.length) return null;

  const pick = pickBestTmdbResult(trimmed, results);
  return pick.autoPick ? pick.best : (pick.best?.score >= 52 ? pick.best : null);
}

async function resolveMovieForAdd(title, mediaType = 'movie', options = {}) {
  const trimmed = String(title || '').trim();
  if (!trimmed) return { title: trimmed, unresolved: true, mediaType };

  const aliasHint = resolveSearchQuery(trimmed);
  const originalHint = String(options.originalTitle || aliasHint || '').trim();
  const extraQueries = originalHint ? [originalHint] : [];

  let hit = originalHint
    ? await pickTmdbMatchForTitle(originalHint, mediaType)
    : null;

  if (!hit?.tmdbId) {
    hit = await pickTmdbMatchForTitle(trimmed, mediaType, extraQueries);
  }

  if (!hit?.tmdbId && mediaType === 'tv') {
    const altQueries = [
      trimmed.replace(/\s*\(.*?сериал.*?\)\s*/gi, '').trim(),
      trimmed.replace(/\s+сериал$/i, '').trim()
    ].filter((q) => q && q !== trimmed);

    for (const query of altQueries) {
      hit = await pickTmdbMatchForTitle(query, mediaType, extraQueries);
      if (hit?.tmdbId) break;
    }
  }

  if (!hit?.tmdbId) return { title: trimmed, unresolved: true, mediaType };

  const details = await loadTmdbDetails(hit.tmdbId, mediaType);
  if (!details) return { title: trimmed, unresolved: true, mediaType };

  return {
    title: details.title,
    tmdbId: details.tmdbId,
    mediaType: details.mediaType || mediaType,
    genres: details.genres || [],
    meta: { ...details.meta, matchSource: 'auto' },
    unresolved: false
  };
}

async function resolveMoviesForAdd(titles, mediaType = 'movie') {
  const resolved = [];
  for (const title of titles || []) {
    resolved.push(await resolveMovieForAdd(title, mediaType));
  }
  return resolved;
}

function appendUnresolvedNotice(reply, unresolvedTitles) {
  if (!unresolvedTitles?.length) return reply;
  const unique = [...new Set(unresolvedTitles)];
  const notice = `\n\n⚠ Не найдено в TMDB (не добавлено): ${unique.map((t) => `«${t}»`).join(', ')}. Уточните название или напишите на английском.`;
  return `${reply || 'Готово!'}${notice}`;
}

async function finalizeChatResponse(reply, actions, movies = []) {
  const { actions: validatedActions, ratingAsk } = validateChatActions(actions || []);
  const { actions: enrichedActions, unresolvedTitles } = validatedActions.length
    ? await enrichChatActions(validatedActions, movies)
    : { actions: [], unresolvedTitles: [] };
  return {
    reply: ratingAsk || appendUnresolvedNotice(reply, unresolvedTitles),
    actions: enrichedActions
  };
}

async function enrichChatActions(actions, movies = []) {
  const enriched = [];
  const unresolvedTitles = [];

  for (const action of actions || []) {
    if (action.type === 'add_random_movies') {
      const count = Math.min(50, Math.max(1, Number(action.count) || 1));
      const mediaType = action.mediaType || 'movie';
      const titles = pickRandomTitles(movies, count, mediaType);
      const wantsRandomRating = Boolean(action.randomRating);
      let status = action.status || 'want';
      if (wantsRandomRating && status !== 'watching') status = 'watched';

      for (const title of titles) {
        let rating = null;
        if (status === 'watched') {
          rating = wantsRandomRating ? randomRating() : (action.rating ?? null);
          if (rating === null && wantsRandomRating) rating = randomRating();
        } else if (action.rating != null) {
          rating = action.rating;
        }

        const resolved = await resolveMovieForAdd(title, mediaType, {
          originalTitle: resolveSearchQuery(title)
        });
        if (resolved.unresolved) unresolvedTitles.push(title);
        enriched.push({
          type: 'add_movie',
          title: resolved.title || title,
          status,
          rating,
          tmdbId: resolved.tmdbId,
          mediaType: resolved.mediaType || mediaType,
          meta: resolved.meta,
          unresolved: resolved.unresolved,
          unresolvedTitles: resolved.unresolved ? [title] : []
        });
      }
      continue;
    }

    if (action.type === 'add_movies' && action.titles?.length) {
      const patched = { ...action };
      if (patched.randomRating || (patched.rating != null && !patched.status)) {
        patched.status = 'watched';
      }
      const resolved = await resolveMoviesForAdd(patched.titles, patched.mediaType || 'movie');
      resolved.forEach((item, index) => {
        if (item.unresolved) unresolvedTitles.push(patched.titles[index]);
      });
      enriched.push({ ...patched, resolved, unresolvedTitles });
    } else if (action.type === 'add_movie' && action.title) {
      const resolved = await resolveMovieForAdd(action.title, action.mediaType || 'movie', {
        originalTitle: action.originalTitle || resolveSearchQuery(action.title)
      });
      if (resolved.unresolved) unresolvedTitles.push(action.title);
      enriched.push({
        ...action,
        ...resolved,
        title: resolved.title || action.title,
        unresolvedTitles: resolved.unresolved ? [action.title] : []
      });
    } else {
      enriched.push(action);
    }
  }

  return { actions: enriched, unresolvedTitles };
}

async function enrichPremiereSuggestion(item) {
  const enriched = await enrichMovieSuggestion(item);
  if (!enriched?.title || enriched.title === 'Начните с просмотра') return enriched;

  const mediaType = enriched.mediaType || 'movie';
  const searchTitle = resolveSearchQuery(enriched.title);
  const tmdb = await lookupTmdbPreview(searchTitle, mediaType);

  return {
    ...enriched,
    releaseDate: tmdb?.releaseDate || enriched.releaseDate || null,
    year: enriched.year || tmdb?.year || null,
    poster: upgradeTmdbPosterUrl(enriched.poster || tmdb?.poster, 'w780'),
    tmdbId: enriched.tmdbId || tmdb?.tmdbId || null
  };
}

async function enrichPremiereSuggestions(items) {
  return Promise.all((items || []).map((item) => enrichPremiereSuggestion(item)));
}

async function enrichMovieSuggestion(item) {
  if (!item?.title || item.title === 'Начните с просмотра') return item;

  const mediaType = item.mediaType || 'movie';
  const searchTitle = resolveSearchQuery(item.title);
  const tmdb = await lookupTmdbPreview(searchTitle, mediaType);
  const hdrezka = mediaType === 'movie' ? await resolveHdrezkaMovie({
    title: searchTitle,
    year: tmdb?.year,
    originalTitle: tmdb?.originalTitle,
    matchedTitle: item.title
  }) : null;

  return {
    ...item,
    title: hdrezka?.title || searchTitle,
    originalTitle: hdrezka?.originalTitle || tmdb?.originalTitle || null,
    year: hdrezka?.year || tmdb?.year || null,
    poster: upgradeTmdbPosterUrl(tmdb?.poster || item.poster, 'w780'),
    tmdbId: tmdb?.tmdbId || null,
    runtime: item.runtime ?? null,
    overview: item.overview || tmdb?.overview || null,
    mediaType,
    hdrezkaUrl: hdrezka?.url || null
  };
}

async function enrichWatchNowPick(item) {
  if (!item?.title) return item;

  const mediaType = item.mediaType || 'movie';
  if (item.runtime && item.poster) {
    return { ...item, poster: upgradeTmdbPosterUrl(item.poster, 'w780') };
  }

  const searchTitle = resolveSearchQuery(item.title);
  const tmdb = item.tmdbId
    ? {
      tmdbId: item.tmdbId,
      poster: item.poster,
      year: item.year,
      originalTitle: item.originalTitle
    }
    : await lookupTmdbPreview(searchTitle, mediaType);

  if (!tmdb?.tmdbId) return { ...item, mediaType };

  const runtime = item.runtime ?? await loadTmdbRuntime(tmdb.tmdbId, mediaType);

  return {
    ...item,
    title: item.title,
    originalTitle: item.originalTitle || tmdb.originalTitle || null,
    year: item.year || tmdb.year || null,
    poster: upgradeTmdbPosterUrl(item.poster || tmdb.poster, 'w780'),
    tmdbId: tmdb.tmdbId,
    runtime: runtime ?? null,
    mediaType
  };
}

async function enrichWatchNowPicks(items) {
  return Promise.all((items || []).map((item) => enrichWatchNowPick(item)));
}

async function enrichFinalWatchNowPicks(picks) {
  const needEnrich = (picks || []).filter((pick) => (
    !pick.fromList && !pick.poster && !pick.durationVerified
  ));
  if (!needEnrich.length) return picks || [];

  const enriched = await enrichWatchNowPicks(needEnrich);
  const byTitle = new Map(enriched.map((pick) => [normalizeWatchTitle(pick.title), pick]));
  return (picks || []).map((pick) => {
    const extra = byTitle.get(normalizeWatchTitle(pick.title));
    return extra ? { ...pick, ...extra } : pick;
  });
}

async function loadTmdbRuntime(tmdbId, mediaType = 'movie') {
  const endpoint = mediaType === 'tv' ? `/tv/${tmdbId}` : `/movie/${tmdbId}`;
  const data = await tmdbFetch(endpoint);
  if (!data) return null;
  return data.runtime || data.episode_run_time?.[0] || null;
}

async function discoverTmdbWatchNowCandidates(prefs, limit = 15, excludeTitles = new Set(), pageStart = 1) {
  const genreIds = MOOD_TMDB_GENRES[prefs.mood] || MOOD_TMDB_GENRES.light;
  const mediaType = prefs.mediaType === 'tv' ? 'tv' : 'movie';
  const discoverPath = mediaType === 'tv' ? '/discover/tv' : '/discover/movie';
  const durationFiltered = prefs.duration === 'short' || prefs.duration === 'long';

  const candidates = [];
  for (let page = pageStart; page < pageStart + 5 && candidates.length < limit; page += 1) {
    const params = {
      sort_by: 'popularity.desc',
      include_adult: 'false',
      'vote_count.gte': 80,
      with_genres: genreIds.join('|'),
      page: String(page)
    };

    if (prefs.duration === 'short') {
      params['with_runtime.lte'] = '90';
    } else if (prefs.duration === 'long') {
      params['with_runtime.gte'] = '91';
    }

    const data = await tmdbFetch(discoverPath, params);
    if (!data?.results?.length) break;

    for (const item of data.results) {
      if (candidates.length >= limit) break;

      const title = item.title || item.name;
      if (!title || excludeTitles.has(normalizeWatchTitle(title))) continue;

      const releaseDate = item.release_date || item.first_air_date || null;
      candidates.push({
        title,
        originalTitle: item.original_title || item.original_name || null,
        year: releaseDate?.slice(0, 4) || null,
        poster: tmdbPosterFromPath(item.poster_path, 'w780'),
        runtime: null,
        durationVerified: durationFiltered,
        tmdbId: item.id,
        mediaType,
        genres: (item.genre_ids || []).map(String)
      });
    }
  }

  if (!durationFiltered && candidates.length) {
    await Promise.all(candidates.map(async (candidate) => {
      candidate.runtime = await loadTmdbRuntime(candidate.tmdbId, candidate.mediaType);
    }));
  }

  return candidates;
}

function formatDiscoverWatchNowPick(candidate, prefs) {
  const durationLabel = prefs.duration === 'long'
    ? 'больше полутора часов'
    : 'до полутора часов';
  const runtimeHint = candidate.runtime
    ? `~${candidate.runtime} мин`
    : (prefs.duration === 'short' ? 'до 90 мин' : prefs.duration === 'long' ? '90+ мин' : '');
  return formatNewWatchNowPick({
    title: candidate.title,
    reason: 'Из каталога TMDB',
    whyDetailed: runtimeHint
      ? `${runtimeHint} — ${durationLabel}, ${MOOD_LABELS[prefs.mood] || 'под ваш запрос'}.`
      : `Подходит под настроение (${durationLabel}).`,
    poster: candidate.poster,
    year: candidate.year,
    originalTitle: candidate.originalTitle,
    runtime: candidate.runtime,
    durationVerified: candidate.durationVerified,
    mediaType: candidate.mediaType,
    tmdbId: candidate.tmdbId
  }, prefs);
}

async function topUpWatchNowFromDiscover(picks, movies, prefs, options = {}) {
  const limit = WATCH_NOW_LIMIT;
  const result = [...(picks || [])];
  if (result.length >= limit) {
    return filterPicksByDuration(result.slice(0, limit), movies, prefs);
  }

  const exclude = new Set([
    ...(options.excludeTitles || []),
    ...result.map((pick) => pick.title),
    ...movies.map((m) => m.title)
  ].filter(Boolean).map(normalizeWatchTitle));

  const blacklist = options.blacklist || null;
  let pageStart = options.pageStart || 1;
  const seen = new Set(result.map((pick) => normalizeWatchTitle(pick.title)));
  let candidates = (options.prefetchedCandidates || [])
    .filter((candidate) => !exclude.has(normalizeWatchTitle(candidate.title)));

  while (result.length < limit) {
    if (!candidates.length) {
      candidates = await discoverTmdbWatchNowCandidates(
        prefs,
        Math.max((limit - result.length) * 4, 10),
        exclude,
        pageStart
      );
      pageStart += 5;
    }
    if (!candidates.length) break;

    const candidate = candidates.shift();
    const normalized = normalizeWatchTitle(candidate.title);
    if (seen.has(normalized) || exclude.has(normalized)) continue;

    const formatted = formatDiscoverWatchNowPick(candidate, prefs);
    if (!matchesPickDuration(formatted, movies, prefs.duration)) continue;

    if (blacklist && matchesBlacklist({
      title: formatted.title,
      genres: candidate.genres || [],
      meta: { runtime: formatted.runtime, year: formatted.year }
    }, blacklist)) {
      continue;
    }

    seen.add(normalized);
    result.push(formatted);
  }

  return filterPicksByDuration(result.slice(0, limit), movies, prefs);
}

const RECOMMENDATION_DEFAULT_LIMIT = 10;
const RECOMMENDATION_MAX_LIMIT = 20;

function normalizeRecommendationLimit(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return RECOMMENDATION_DEFAULT_LIMIT;
  return Math.max(1, Math.min(RECOMMENDATION_MAX_LIMIT, Math.floor(parsed)));
}

function parseExcludedTitles(value) {
  if (Array.isArray(value)) return value.flatMap(parseExcludedTitles);
  return String(value || '')
    .split(',')
    .map((title) => title.trim())
    .filter(Boolean);
}

function recommendationTitleKey(item) {
  return normalizeWatchTitle(item?.title || item?.originalTitle || '');
}

function recommendationTmdbKey(item) {
  if (!item?.tmdbId) return null;
  return `${item.mediaType || 'movie'}:${item.tmdbId}`;
}

function filterFreshRecommendations(items, movies, excludeTitles = []) {
  const blockedTitles = new Set([
    ...movies.map((movie) => movie.title),
    ...movies.map((movie) => movie.meta?.originalTitle),
    ...excludeTitles
  ].filter(Boolean).map(normalizeWatchTitle));
  const blockedTmdb = new Set(
    movies
      .filter((movie) => movie.tmdbId)
      .map((movie) => `${movie.mediaType || 'movie'}:${movie.tmdbId}`)
  );
  const seenTitles = new Set();
  const seenTmdb = new Set();

  return (items || []).filter((item) => {
    const titleKey = recommendationTitleKey(item);
    const tmdbKey = recommendationTmdbKey(item);
    if (!titleKey) return false;
    if (blockedTitles.has(titleKey) || seenTitles.has(titleKey)) return false;
    if (tmdbKey && (blockedTmdb.has(tmdbKey) || seenTmdb.has(tmdbKey))) return false;
    seenTitles.add(titleKey);
    if (tmdbKey) seenTmdb.add(tmdbKey);
    return true;
  });
}

async function discoverTmdbRecommendationCandidates(movies, limit, excludeTitles = []) {
  const blockedTitles = new Set([
    ...movies.map((movie) => movie.title),
    ...movies.map((movie) => movie.meta?.originalTitle),
    ...excludeTitles
  ].filter(Boolean).map(normalizeWatchTitle));
  const picks = [];

  for (const mediaType of ['movie', 'tv']) {
    const discoverPath = mediaType === 'tv' ? '/discover/tv' : '/discover/movie';
    for (let page = 1; page <= 5 && picks.length < limit; page += 1) {
      const data = await tmdbFetch(discoverPath, {
        sort_by: 'popularity.desc',
        include_adult: 'false',
        'vote_count.gte': 120,
        page: String(page)
      });
      if (!data?.results?.length) break;

      for (const item of data.results) {
        if (picks.length >= limit) break;
        const title = item.title || item.name;
        const titleKey = normalizeWatchTitle(title);
        if (!titleKey || blockedTitles.has(titleKey)) continue;

        const releaseDate = item.release_date || item.first_air_date || null;
        blockedTitles.add(titleKey);
        picks.push({
          title,
          originalTitle: item.original_title || item.original_name || null,
          year: releaseDate?.slice(0, 4) || null,
          releaseDate,
          poster: tmdbPosterFromPath(item.poster_path, 'w780'),
          tmdbId: item.id,
          mediaType,
          overview: item.overview?.slice(0, 180),
          reason: 'Популярная находка, которой ещё нет в вашем списке',
          whyDetailed: 'Добавлено как запасной вариант, чтобы подборка не заканчивалась.'
        });
      }
    }
  }

  return picks;
}

function buildPoolRecommendationCandidates(movies, limit, excludeTitles = []) {
  const blocked = new Set(excludeTitles.filter(Boolean).map(normalizeWatchTitle));
  const poolItems = [
    ...pickRandomTitles(movies, limit * 2, 'movie').map((title) => ({
      title,
      originalTitle: title,
      mediaType: 'movie',
      reason: 'Популярный фильм для старта',
      whyDetailed: 'Запасной вариант из встроенного пула, чтобы свайп всегда был наполнен.'
    })),
    ...pickRandomTitles(movies, limit, 'tv').map((title) => ({
      title,
      originalTitle: title,
      mediaType: 'tv',
      reason: 'Популярный сериал для старта',
      whyDetailed: 'Запасной вариант из встроенного пула, чтобы свайп всегда был наполнен.'
    }))
  ];

  const fresh = [];
  for (const item of poolItems) {
    if (fresh.length >= limit) break;
    const key = normalizeWatchTitle(item.title);
    if (!key || blocked.has(key)) continue;
    blocked.add(key);
    fresh.push(item);
  }
  return fresh;
}

function isAnimationRecommendation(item) {
  if ((item.mediaType || 'movie') !== 'tv') return false;
  const genres = (item.genres || []).map((g) => String(g).toLowerCase());
  if (genres.some((g) => /анimat|animation|мульт|cartoon/.test(g))) return true;
  return /анimat|animation|мульт|cartoon/i.test(item.title || '');
}

function filterSwipeRecommendations(items, { mediaType = null, category = null } = {}) {
  if (!mediaType && !category) return items;
  return items.filter((item) => {
    const mt = item.mediaType || 'movie';
    const anim = isAnimationRecommendation(item);
    if (category === 'animation') return mt === 'tv' && anim;
    if (mediaType === 'movie') return mt === 'movie';
    if (mediaType === 'tv') return mt === 'tv' && !anim;
    return true;
  });
}

async function enrichRecommendations(recommendations, movies = [], options = {}) {
  const enriched = await Promise.all((recommendations || []).map((item) => enrichMovieSuggestion(item)));
  const fresh = filterFreshRecommendations(enriched, movies, options.excludeTitles || []);
  const limit = options.limit || RECOMMENDATION_DEFAULT_LIMIT;
  const finalize = (list) => filterSwipeRecommendations(list.slice(0, limit), options);

  if (fresh.length >= limit) return finalize(fresh);

  const topUp = await discoverTmdbRecommendationCandidates(
    movies,
    limit - fresh.length,
    [...(options.excludeTitles || []), ...fresh.map((item) => item.title)]
  );
  const withTmdb = filterFreshRecommendations([...fresh, ...topUp], movies, options.excludeTitles || []);
  if (withTmdb.length >= limit) return finalize(withTmdb);

  const poolTopUp = buildPoolRecommendationCandidates(
    movies,
    limit - withTmdb.length,
    [...(options.excludeTitles || []), ...withTmdb.map((item) => item.title)]
  );
  return finalize(
    filterFreshRecommendations([...withTmdb, ...poolTopUp], movies, options.excludeTitles || [])
  );
}

async function requestWatchNowNewPicks(apiKey, prefs, count, context) {
  if (count <= 0) return [];

  const {
    taste,
    blacklistPrompt,
    listTitles,
    excludeTitles
  } = context;

  const excludePrompt = excludeTitles.length
    ? `\nНе предлагай: ${excludeTitles.join(', ')}`
    : '';

  const message = await callOpenAI(apiKey, [
    { role: 'system', content: 'Ты кинокритик. Отвечай только JSON без markdown.' },
    {
      role: 'user',
      content: `Нужно ровно ${count} НОВЫХ рекомендаций «что посмотреть» — не больше и не меньше.

Требования:
- Длительность: ${DURATION_LABELS[prefs.duration] || prefs.duration || 'любая'}
- ${buildWatchNowDurationRule(prefs)}
- Настроение: ${MOOD_LABELS[prefs.mood] || prefs.mood}
- Тип: ${prefs.mediaType || 'movie'}
- Только фильмы/сериалы, которых НЕТ в списке пользователя
- source всегда "new"

Список пользователя (не предлагать): ${listTitles.join(', ') || 'пусто'}
${excludePrompt}

Вкус пользователя:
${taste || 'нет'}
${TITLE_RULE}
${blacklistPrompt}
JSON: {"picks":[{"title":"...","runtime":85,"reason":"...","whyDetailed":"...","source":"new"}]}`
    }
  ], false);

  const parsed = JSON.parse(message.content);
  return (parsed.picks || []).slice(0, count);
}

async function ensureWatchNowFilled(picks, movies, prefs, options = {}) {
  let result = filterPicksByDuration((picks || []).slice(0, WATCH_NOW_LIMIT), movies, prefs);

  if (!isWatchNowComplete(result)) {
    result = await topUpWatchNowFromDiscover(result, movies, prefs, options);
  }

  if (!isWatchNowComplete(result)) {
    result = await topUpWatchNowFromDiscover(result, movies, prefs, {
      ...options,
      prefetchedCandidates: [],
      pageStart: 6
    });
  }

  return enrichFinalWatchNowPicks(result.slice(0, WATCH_NOW_LIMIT));
}

async function buildCompleteWatchNowPicks(rawPicks, movies, prefs, mergeOptions, apiKey, context) {
  let picks = mergeWatchNowPicks(rawPicks, movies, prefs, mergeOptions);
  picks = topUpWatchNowFromList(picks, movies, prefs, mergeOptions);

  if (!isWatchNowComplete(picks)) {
    picks = await topUpWatchNowFromDiscover(picks, movies, prefs, {
      ...mergeOptions,
      blacklist: context.blacklist || null,
      prefetchedCandidates: context.discoverPrefetch
    });
  }

  if (!isWatchNowComplete(picks) && apiKey) {
    const need = WATCH_NOW_LIMIT - picks.length;
    const excludeTitles = [
      ...(mergeOptions.excludeTitles || []),
      ...picks.map((pick) => pick.title)
    ];
    const extraRaw = await requestWatchNowNewPicks(apiKey, prefs, need, {
      ...context,
      excludeTitles
    });
    const extra = await enrichWatchNowPicks(extraRaw);
    picks = appendNewWatchNowPicks(picks, extra, movies, prefs, {
      ...mergeOptions,
      excludeTitles
    });
    picks = topUpWatchNowFromList(picks, movies, prefs, mergeOptions);
  }

  return ensureWatchNowFilled(picks, movies, prefs, {
    ...mergeOptions,
    blacklist: context.blacklist || null
  });
}

function buildWatchNowDurationRule(prefs) {
  if (prefs.duration === 'short') {
    return 'Каждый вариант должен быть не длиннее 90 минут. Не предлагай фильмы на 91+ минут.';
  }
  if (prefs.duration === 'long') {
    return 'Каждый вариант должен быть длиннее 90 минут. Не предлагай фильмы на 90 минут и короче.';
  }
  return '';
}

async function enrichTitleItems(items) {
  return Promise.all((items || []).map((item) => enrichMovieSuggestion(item)));
}

ensureDataDirs();
initGlobalSignals(DATA_DIR);

app.use(cors());
app.use(express.json({ limit: '25mb' }));
app.use(express.static(__dirname));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

// Глобальные реакции из свайпов (лайк/дизлайк/смотрел) — считаем по всем
// пользователям, включая гостей. Публичный эндпоинт.
app.post('/api/interactions', (req, res) => {
  optionalAuth(req);
  const { tmdbId, mediaType, title, action } = req.body || {};
  const updated = recordInteraction({
    tmdbId: Number(tmdbId) || null,
    mediaType: mediaType === 'tv' ? 'tv' : 'movie',
    title: title || null,
    action
  });
  if (!updated) return res.status(400).json({ error: 'Некорректная реакция' });
  res.json({ success: true, counts: { like: updated.like, dislike: updated.dislike, watched: updated.watched } });
});

app.get('/api/interactions/top', (req, res) => {
  optionalAuth(req);
  res.json({ top: getTopLiked(Number(req.query.limit) || 20) });
});

app.post('/api/register', (req, res) => {
  const username = String(req.body?.username || '').trim();
  const { password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Введите логин и пароль' });
  if (username.length < 3) return res.status(400).json({ error: 'Логин — минимум 3 символа' });
  if (password.length < 4) return res.status(400).json({ error: 'Пароль — минимум 4 символа' });

  const users = loadUsers();
  if (findCanonicalUsername(users, username)) {
    return res.status(400).json({ error: 'Пользователь уже существует' });
  }

  const salt = crypto.randomBytes(16).toString('hex');
  const now = new Date().toISOString();
  users[username] = { salt, hash: hashPassword(password, salt), registeredAt: now, lastActiveAt: now };
  saveUsers(users);
  initUserMovies(username);

  res.json({ token: createSession(username), username });
});

app.post('/api/login', (req, res) => {
  const requestedUsername = String(req.body?.username || '').trim();
  const { password } = req.body;
  if (!requestedUsername || !password) return res.status(400).json({ error: 'Введите логин и пароль' });

  const users = loadUsers();
  const username = findCanonicalUsername(users, requestedUsername);
  const user = users[username];
  if (!user || user.hash !== hashPassword(password, user.salt)) {
    return res.status(401).json({ error: 'Неверный логин или пароль' });
  }

  user.lastActiveAt = new Date().toISOString();
  saveUsers(users);

  res.json({ token: createSession(username), username });
});

app.post('/api/logout', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (token) sessions.delete(token);
  res.json({ success: true });
});

app.get('/api/movies', (req, res) => {
  const username = requireAuth(req, res);
  if (!username) return;
  const payload = loadUserMovies(username);
  res.json({
    ...payload,
    username,
    movieCount: Array.isArray(payload.movies) ? payload.movies.length : 0
  });
});

app.put('/api/movies', (req, res) => {
  const username = requireAuth(req, res);
  if (!username) return;
  const { movies, nextId, battleSessions, battleMatches, deletedMovieIds } = req.body;
  const existing = loadUserMovies(username);
  const incomingMovies = Array.isArray(movies) ? movies : [];
  const saved = buildSavedMoviePayload(existing, incomingMovies, {
    deletedMovieIds,
    nextId,
    battleSessions,
    battleMatches
  });
  saveUserMovies(username, saved);
  res.json({ success: true, ...saved });
});

// Быстрое добавление одного фильма (для страницы фильма). Требует входа.
// Если фильм уже есть — обновляет статус; иначе добавляет с метаданными из TMDB.
app.post('/api/movies/add', async (req, res) => {
  const username = requireAuth(req, res);
  if (!username) return;

  const tmdbId = Number(req.body?.tmdbId) || null;
  const mediaType = req.body?.mediaType === 'tv' ? 'tv' : 'movie';
  const status = ['want', 'watched'].includes(req.body?.status) ? req.body.status : 'want';
  const rating = status === 'watched' && Number.isFinite(Number(req.body?.rating))
    ? Number(req.body.rating)
    : null;
  if (!tmdbId && !req.body?.title) {
    return res.status(400).json({ error: 'Нужен tmdbId или название' });
  }

  const data = loadUserMovies(username);
  const movies = Array.isArray(data.movies) ? data.movies : [];

  // Дубликат по tmdbId+тип
  const existing = tmdbId
    ? movies.find((m) => m.tmdbId === tmdbId && (m.mediaType || 'movie') === mediaType)
    : null;

  const now = new Date().toISOString();

  if (existing) {
    existing.status = status;
    if (status === 'watched') existing.rating = rating;
    if (status === 'want') existing.rating = null;
    existing.history = Array.isArray(existing.history) ? existing.history : [];
    existing.history.push({ type: 'status', to: status, rating, at: now });
    saveUserMovies(username, data);
    return res.json({ success: true, updated: true, movie: existing });
  }

  // Подтягиваем детали из TMDB (постер/жанры/мета). Не падаем, если TMDB недоступен.
  let details = null;
  if (tmdbId) {
    try { details = await loadTmdbDetails(tmdbId, mediaType); } catch { details = null; }
  }

  const newMovie = {
    id: data.nextId || 1,
    title: details?.title || req.body?.title || 'Без названия',
    mediaType,
    tmdbId: tmdbId || null,
    status,
    rating,
    genres: details?.genres || req.body?.genres || [],
    addedAt: now,
    history: [{ type: 'added', status, at: now }],
    meta: details?.meta || (req.body?.poster ? { poster: req.body.poster } : {})
  };

  const saved = buildSavedMoviePayload(data, [...movies, newMovie], { nextId: data.nextId });
  saveUserMovies(username, saved);
  res.json({ success: true, added: true, movie: newMovie });
});

app.get('/api/movie/search', async (req, res) => {
  const username = requireAuth(req, res);
  if (!username) return;
  const rawQuery = req.query.q;
  const mediaType = req.query.type === 'tv' ? 'tv' : 'movie';
  if (!rawQuery) return res.status(400).json({ error: 'Укажите название' });

  const results = await collectTmdbSearchResults(rawQuery, mediaType);
  res.json({
    results,
    mediaType,
    searchQueries: buildTmdbSearchQueries(rawQuery)
  });
});

app.get('/api/movie/match', async (req, res) => {
  const username = requireAuth(req, res);
  if (!username) return;
  const rawQuery = req.query.q;
  const mediaType = req.query.type === 'tv' ? 'tv' : 'movie';
  if (!rawQuery) return res.status(400).json({ error: 'Укажите название' });

  const searchQueries = buildTmdbSearchQueries(rawQuery);
  const results = await collectTmdbSearchResults(rawQuery, mediaType);
  const pick = pickBestTmdbResult(rawQuery.trim(), results);

  res.json({
    query: rawQuery,
    searchQueries: searchQueries.length > 1 ? searchQueries : undefined,
    best: pick.best,
    autoPick: pick.autoPick || (pick.best?.score >= 52),
    confidence: pick.confidence,
    gap: pick.gap,
    results: pick.scored,
    mediaType
  });
});

app.get('/api/movie/details/:tmdbId', async (req, res) => {
  // Публичный эндпоинт: страница фильма доступна и гостям (без входа).
  optionalAuth(req);
  const mediaType = req.query.type === 'tv' ? 'tv' : 'movie';
  // Отдаём только «ядро» (TMDB) — это быстро. Тяжёлые рейтинги/ссылки на Kinogo
  // фронтенд подгружает отдельным запросом (/api/movie/extras), чтобы страница
  // фильма открывалась мгновенно, не дожидаясь веб-скрейпинга.
  const data = await loadTmdbCore(req.params.tmdbId, mediaType);
  if (!data) return res.status(503).json({ error: 'TMDB API недоступен' });
  // Средняя оценка по сайту среди пользователей (из их списков) — локально, быстро.
  if (data.meta) {
    data.meta.siteRating = getSiteRating({
      tmdbId: Number(req.params.tmdbId) || req.params.tmdbId,
      mediaType,
      title: data.title
    });
  }
  res.json(data);
});

// Медленные «доп-данные» страницы фильма: рейтинги IMDb/Кинопоиск и ссылка на
// Kinogo. Грузятся отдельно (после быстрого рендера ядра) и кэшируются.
app.get('/api/movie/extras/:tmdbId', async (req, res) => {
  optionalAuth(req);
  const mediaType = req.query.type === 'tv' ? 'tv' : 'movie';
  const core = await loadTmdbCore(req.params.tmdbId, mediaType);
  if (!core) return res.status(503).json({ error: 'TMDB API недоступен' });
  const extras = await loadTmdbExtras(core, mediaType);
  res.json(extras || {});
});

/* ===================================================================
   «Умные подборки» — локально, без OpenAI.
   Переиспользуем локальный recommender (реальные TMDB-кандидаты под вкус
   пользователя) и фильтруем результат по жанрам пресета/свободного запроса.
   OpenAI здесь больше не вызывается — подборки бесплатны и персональны.
   =================================================================== */

// Пресет → целевые жанры (канонические русские названия как в данных/TMDB).
const COLLECTION_PRESET_GENRES = {
  evening: [],
  weekend: ['фэнтези', 'приключения', 'боевик', 'фантастика'],
  short: ['комедия', 'мультфильм', 'ужасы'],
  alone: ['драма', 'триллер', 'детектив', 'фантастика'],
  date: ['мелодрама', 'комедия'],
  friends: ['комедия', 'боевик', 'приключения', 'ужасы'],
  light: ['комедия', 'мелодрама', 'семейный', 'мультфильм'],
  serious: ['драма', 'история', 'военный', 'детектив', 'криминал'],
  puzzle: ['детектив', 'триллер', 'фантастика', 'криминал'],
  twist: ['триллер', 'детектив', 'криминал']
};

// Человекочитаемая подпись пресета — для reason, если у фильма нет своей причины.
const COLLECTION_PRESET_LABEL = {
  evening: 'на вечер',
  weekend: 'на выходные',
  short: 'короткое кино',
  alone: 'для просмотра одному',
  date: 'для просмотра вдвоём',
  friends: 'для компании',
  light: 'лёгкое',
  serious: 'серьёзное',
  puzzle: 'мозголомка',
  twist: 'с неожиданной концовкой'
};

// Простое определение жанров из свободного запроса («хочу что-то смешное»).
const COLLECTION_QUERY_GENRES = {
  'драм': 'драма', 'трилл': 'триллер', 'детектив': 'детектив', 'комед': 'комедия',
  'смешн': 'комедия', 'весёл': 'комедия', 'весел': 'комедия', 'мелодрам': 'мелодрама',
  'романт': 'мелодрама', 'любов': 'мелодрама', 'фантаст': 'фантастика', 'фэнтез': 'фэнтези',
  'боевик': 'боевик', 'экшен': 'боевик', 'криминал': 'криминал', 'ужас': 'ужасы',
  'хоррор': 'ужасы', 'семейн': 'семейный', 'приключ': 'приключения', 'мультф': 'мультфильм',
  'анимац': 'мультфильм', 'истор': 'история', 'военн': 'военный', 'музык': 'музыка'
};

function detectCollectionGenres(query) {
  const text = String(query || '').toLowerCase().replace(/ё/g, 'е');
  const hits = new Set();
  for (const [kw, name] of Object.entries(COLLECTION_QUERY_GENRES)) {
    if (kw && text.includes(kw.replace(/ё/g, 'е'))) hits.add(name);
  }
  return [...hits];
}

app.post('/api/collections', async (req, res) => {
  const username = requireAuth(req, res);
  if (!username) return;

  const { query, preset } = req.body || {};

  try {
    const { movies } = loadUserMovies(username);
    const prefs = loadUserPrefs(DATA_DIR, username);

    // Целевые жанры из пресета и/или свободного запроса.
    const presetGenres = (preset && COLLECTION_PRESET_GENRES[preset]) || [];
    const queryGenres = detectCollectionGenres(query);
    const targetGenres = [...new Set([...presetGenres, ...queryGenres].map((g) => g.toLowerCase()))];

    // Локальный персональный пул кандидатов (без OpenAI).
    const local = await runLocalRecommender({
      movies, prefs, mode: 'personal', limit: 30, mediaType: null, excludeTitles: []
    });
    let picks = local.recommendations || [];

    // Если заданы целевые жанры — двигаем совпадающие вперёд, остальные
    // оставляем как запас, чтобы подборка всегда была заполнена.
    if (targetGenres.length && picks.length) {
      const matched = picks.filter((p) =>
        (p.genres || []).some((g) => targetGenres.includes(String(g).toLowerCase()))
      );
      const rest = picks.filter((p) => !matched.includes(p));
      picks = [...matched, ...rest];
    }

    const label = (preset && COLLECTION_PRESET_LABEL[preset]) || (query ? `«${query}»` : 'подборка');
    const finalPicks = picks.slice(0, 6).map((p) => ({
      title: p.title,
      originalTitle: p.originalTitle || null,
      mediaType: p.mediaType || 'movie',
      poster: p.poster || null,
      year: p.year || null,
      reason: p.reason || `Подборка: ${label}`,
      whyDetailed: p.whyDetailed || ''
    }));

    if (!finalPicks.length) {
      return res.json({
        picks: [],
        notice: 'Отметьте фильмы как «посмотрел» и поставьте оценки — подборки станут точнее.'
      });
    }

    res.json({ picks: finalPicks, source: 'local_algorithm' });
  } catch (error) {
    if (RECOMMENDER_DEBUG) console.error('[collections] local failed', error?.message);
    res.status(500).json({ error: 'Не удалось собрать подборку' });
  }
});

app.post('/api/import', async (req, res) => {
  const apiKey = process.env.OPENAI_API_KEY;
  const username = requireAuth(req, res);
  if (!username || !apiKey) return res.status(500).json({ error: 'API не настроен' });

  const { text } = req.body;
  if (!text?.trim()) return res.status(400).json({ error: 'Вставьте список фильмов' });

  try {
    const message = await callOpenAI(apiKey, [
      { role: 'system', content: 'Парсер списков фильмов. Отвечай только JSON без markdown.' },
      {
        role: 'user',
        content: `Разбери текст и верни фильмы.
Правила:
- status: want (по умолчанию), watching, watched
- rating только для watching/watched если указана
- genres и tags если можно вывести из контекста
- ${TITLE_RULE}

Текст:
${text}

JSON: {"movies":[{"title":"...","status":"want","rating":null,"genres":[],"tags":[]}]}`
      }
    ], false);

    const parsed = JSON.parse(message.content);
    const movies = await enrichTitleItems((parsed.movies || []).map((m) => ({
      ...m,
      title: resolveSearchQuery(m.title)
    })));
    res.json({ movies });
  } catch (error) {
    const formatted = error.openai || formatOpenAIError(error.message);
    if (formatted.code === 'quota') {
      const titles = text.split(/\n|,|;/).map((t) => t.trim()).filter(Boolean);
      if (titles.length) {
        return res.json({
          movies: titles.map((title) => ({
            title: resolveSearchQuery(title),
            status: 'want',
            rating: null,
            genres: [],
            tags: []
          })),
          localFallback: true
        });
      }
    }
    res.status(formatted.code === 'quota' ? 503 : 500).json({ error: formatted.message });
  }
});

app.get('/api/stats', (req, res) => {
  const username = requireAuth(req, res);
  if (!username) return;

  const { movies } = loadUserMovies(username);
  const now = new Date();
  const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
  const monthAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);

  const watched = movies.filter((m) => m.status === 'watched' && m.watchedAt);
  const weekCount = watched.filter((m) => new Date(m.watchedAt) >= weekAgo).length;
  const monthCount = watched.filter((m) => new Date(m.watchedAt) >= monthAgo).length;

  const ratings = watched.filter((m) => m.rating).map((m) => m.rating);
  const avgRating = ratings.length
    ? Number((ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1))
    : null;

  const genreCount = {};
  watched.forEach((m) => {
    (m.genres || []).forEach((g) => { genreCount[g] = (genreCount[g] || 0) + 1; });
  });
  const favoriteGenres = Object.entries(genreCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }));

  const monthly = {};
  watched.forEach((m) => {
    const key = m.watchedAt.slice(0, 7);
    monthly[key] = (monthly[key] || 0) + 1;
  });

  const recent = [...watched]
    .sort((a, b) => new Date(b.watchedAt) - new Date(a.watchedAt))
    .slice(0, 5)
    .map((m) => ({ title: m.title, watchedAt: m.watchedAt, rating: m.rating }));

  res.json({
    weekCount,
    monthCount,
    totalWatched: watched.length,
    avgRating,
    favoriteGenres,
    monthly: Object.entries(monthly).sort((a, b) => a[0].localeCompare(b[0])),
    recent
  });
});

app.get('/api/taste-analysis', async (req, res) => {
  const apiKey = process.env.OPENAI_API_KEY;
  const username = requireAuth(req, res);
  if (!username || !apiKey) return res.status(500).json({ error: 'API не настроен' });

  const { movies } = loadUserMovies(username);
  const prefs = loadUserPrefs(DATA_DIR, username);
  const taste = buildTasteContext(movies, prefs.blacklist);
  const psychPrompt = appendPsychSignals(prefs);

  if (!taste) {
    return res.json({
      insights: ['Добавьте просмотренные фильмы с оценками и заметками — и я проанализирую ваш вкус.']
    });
  }

  try {
    const message = await callOpenAI(apiKey, [
      { role: 'system', content: 'Ты аналитик киновкуса. Отвечай JSON без markdown.' },
      {
        role: 'user',
        content: `Проанализируй вкус пользователя:
${taste}
${psychPrompt}

Верни 4-6 коротких инсайтов на русском о предпочтениях.
JSON: {"insights":["..."]}`
      }
    ], false);

    const parsed = JSON.parse(message.content);
    res.json({ insights: parsed.insights || [] });
  } catch (error) {
    const formatted = error.openai || formatOpenAIError(error.message);
    const watched = movies.filter((m) => m.status === 'watched');
    const avg = watched.filter((m) => m.rating).reduce((sum, m, _, arr) =>
      sum + m.rating / arr.length, 0);
    const topGenres = [...new Set(watched.flatMap((m) => m.genres || []))].slice(0, 3);
    res.json({
      insights: [
        formatted.message,
        `Локально: вы посмотрели ${watched.length} фильм(ов)${avg ? `, средняя оценка ${avg.toFixed(1)}/10` : ''}${topGenres.length ? `, частые жанры: ${topGenres.join(', ')}` : ''}.`
      ]
    });
  }
});

app.post('/api/similar', async (req, res) => {
  const apiKey = process.env.OPENAI_API_KEY;
  const username = requireAuth(req, res);
  if (!username || !apiKey) return res.status(500).json({ error: 'API не настроен' });

  const { movieId } = req.body;
  const { movies } = loadUserMovies(username);
  const movie = movies.find((m) => m.id === movieId);
  if (!movie) return res.status(404).json({ error: 'Фильм не найден' });

  const prefs = loadUserPrefs(DATA_DIR, username);
  const taste = buildTasteContext(movies, prefs.blacklist);
  const blacklistPrompt = buildBlacklistPrompt(prefs.blacklist);
  const psychPrompt = appendPsychSignals(prefs);
  const movieInfo = JSON.stringify(movie, null, 2);

  try {
    const message = await callOpenAI(apiKey, [
      { role: 'system', content: 'Ты кинокритик. Отвечай JSON без markdown.' },
      {
        role: 'user',
        content: `Найди 5 похожих фильмов на:
${movieInfo}

Учти вкус пользователя:
${taste || 'нет данных'}

${TITLE_RULE}${blacklistPrompt}${psychPrompt}
JSON: {"similar":[{"title":"...","reason":"...","whyDetailed":"..."}]}`
      }
    ], false);

    const parsed = JSON.parse(message.content);
    const similar = await enrichTitleItems((parsed.similar || []).slice(0, 5));
    res.json({ similar });
  } catch (error) {
    const formatted = error.openai || formatOpenAIError(error.message);
    res.status(formatted.code === 'quota' ? 503 : 500).json({ error: formatted.message });
  }
});

const RECOMMENDATION_CACHE_TTL_MS = Number(process.env.RECOMMENDATION_CACHE_TTL_MS) || 10 * 60 * 1000;
const recommendationCache = new Map();

function recommendationCacheKey(username, mediaTypeFilter, categoryFilter) {
  return `${username}::${mediaTypeFilter || 'all'}::${categoryFilter || 'none'}`;
}

function getCachedRecommendations(key) {
  const entry = recommendationCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.at > RECOMMENDATION_CACHE_TTL_MS) {
    recommendationCache.delete(key);
    return null;
  }
  return entry.recommendations;
}

function setCachedRecommendations(key, recommendations) {
  if (!recommendations?.length) return;
  recommendationCache.set(key, { at: Date.now(), recommendations });
  if (recommendationCache.size > 200) {
    const oldestKey = recommendationCache.keys().next().value;
    recommendationCache.delete(oldestKey);
  }
}

// Сбрасываем все кеши рекомендаций пользователя (вызывать при изменении
// списка/оценок/статусов/заметок/теста/feedback/битв/blacklist).
function invalidateUserRecommendations(username) {
  if (!username) return;
  const prefix = `${username}::`;
  for (const key of [...recommendationCache.keys()]) {
    if (key.startsWith(prefix)) recommendationCache.delete(key);
  }
}

/* ===================================================================
   Локальный recommender engine — настройки и подключение.
   =================================================================== */
const RECOMMENDER_MODE = process.env.RECOMMENDER_MODE || 'local_first'; // 'local_first' | 'ai_first'
const OPENAI_RECOMMENDATION_RERANK =
  String(process.env.OPENAI_RECOMMENDATION_RERANK || '').toLowerCase() === 'true';
const OPENAI_RECOMMENDATION_EXPLANATIONS =
  String(process.env.OPENAI_RECOMMENDATION_EXPLANATIONS || '').toLowerCase() === 'true';
const RECOMMENDER_DEBUG = String(process.env.RECOMMENDER_DEBUG || '').toLowerCase() === 'true';

// Тонкая обёртка: прокидывает доступ к TMDB в движок (без циклических импортов).
function runLocalRecommender({ movies, prefs, mode = 'personal', limit = 10, mediaType = null, excludeTitles = [] }) {
  return recommendForUser({
    tmdbFetch,
    tmdbPosterFromPath,
    movies,
    prefs,
    mode,
    limit,
    mediaType,
    excludeTitles,
    debug: RECOMMENDER_DEBUG
  });
}

// Короткое summary вкуса для опционального AI-слоя (НЕ вся история).
function buildTasteSummaryForAI(movies, prefs) {
  const tp = buildUserTasteProfile(movies, prefs);
  const topLiked = Object.entries(tp.likedGenres).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([g]) => g);
  const topMovies = tp.likedMovies.slice(0, 8).map((m) => m.title);
  const parts = [];
  if (topLiked.length) parts.push(`Любимые жанры: ${topLiked.join(', ')}`);
  if (topMovies.length) parts.push(`Высоко оценённые: ${topMovies.join(', ')}`);
  if (prefs.psychTest?.profileTitle) parts.push(`Профиль восприятия: ${prefs.psychTest.profileTitle}`);
  if (tp.psychModifiers?.moodHints?.length) parts.push(`Стиль: ${tp.psychModifiers.moodHints.slice(0, 4).join(', ')}`);
  return parts.join('\n') || 'нет явных предпочтений';
}

/**
 * Опциональный AI-слой: НЕ генерирует новые фильмы. Только переранжирует
 * и/или переписывает reason/whyDetailed для уже выбранных локально фильмов,
 * выбирая исключительно из переданных tmdbId.
 */
async function aiPolishLocalRecommendations(apiKey, { summary, recs, count, rerank }) {
  if (!apiKey || !recs?.length) return recs;
  const candidates = recs.map((r) => ({
    tmdbId: r.tmdbId,
    title: r.title,
    genres: r.genres,
    overview: (r.overview || '').slice(0, 160)
  })).filter((c) => c.tmdbId);
  if (!candidates.length) return recs;

  const message = await callOpenAI(apiKey, [
    { role: 'system', content: 'Ты кинокритик. Отвечай только валидным JSON без markdown.' },
    {
      role: 'user',
      content: `Краткий профиль вкуса пользователя:
${summary}

Вот список реальных кандидатов из TMDB (выбраны локальным алгоритмом):
${JSON.stringify(candidates)}

${rerank ? `Выбери и упорядочи лучшие ${count} фильмов ТОЛЬКО из этого списка по соответствию вкусу.` : 'Не меняй порядок и состав.'}
Не придумывай новые фильмы и используй только переданные tmdbId.
Для каждого верни короткий reason и whyDetailed (2-3 предложения, чем подходит).
JSON: {"recommendations":[{"tmdbId":123,"reason":"...","whyDetailed":"..."}]}`
    }
  ], false);

  let parsed;
  try { parsed = JSON.parse(message.content); } catch { return recs; }
  const byId = new Map((parsed.recommendations || []).map((p) => [String(p.tmdbId), p]));

  const polished = recs.map((r) => {
    const ai = byId.get(String(r.tmdbId));
    if (!ai) return r;
    return {
      ...r,
      reason: ai.reason || r.reason,
      whyDetailed: ai.whyDetailed || r.whyDetailed,
      source: 'ai_rerank'
    };
  });

  if (rerank) {
    // переупорядочиваем по порядку из AI, неупомянутые — в конец
    const order = (parsed.recommendations || []).map((p) => String(p.tmdbId));
    polished.sort((a, b) => {
      const ia = order.indexOf(String(a.tmdbId));
      const ib = order.indexOf(String(b.tmdbId));
      return (ia === -1 ? 1e9 : ia) - (ib === -1 ? 1e9 : ib);
    });
  }
  return polished;
}

/* ── Гибридные рекомендации: collaborative filtering + граф + смешивание ──
   Матрица пользователь×фильм и граф связей строятся из всех файлов
   data/movies/*.json и кешируются на короткое время (списки меняются редко). */
let hybridModelCache = { model: null, graph: null, siteRatings: new Map(), builtAt: 0 };
const HYBRID_MODEL_TTL_MS = 3 * 60 * 1000;

function listAllUsernames() {
  try {
    return fs.readdirSync(MOVIES_DIR)
      .filter((f) => f.endsWith('.json') && !f.endsWith('.bak.json') && !f.includes('.bak'))
      .map((f) => f.replace(/\.json$/i, ''))
      .filter((u) => u && u !== '__guest__');
  } catch {
    return [];
  }
}

function buildHybridModel() {
  const now = Date.now();
  if (hybridModelCache.model && now - hybridModelCache.builtAt < HYBRID_MODEL_TTL_MS) {
    return hybridModelCache;
  }
  const allUsers = [];
  for (const username of listAllUsernames()) {
    try {
      const { movies = [] } = loadUserMovies(username);
      if (!movies.length) continue;
      const prefs = loadUserPrefs(DATA_DIR, username);
      allUsers.push({ username, movies, prefs });
    } catch { /* пропускаем битый файл */ }
  }
  // Матрица (для похожести) + граф связей (для обхода и объяснимости).
  const model = buildUserItemMatrix(allUsers);
  const graph = buildGraph(allUsers, {
    movieKeyFn: hybridMovieKey,
    actionWeightFn: hybridActionWeight
  });
  // Средняя оценка фильма по сайту (из реальных оценок 1–10 всех пользователей).
  const siteRatings = buildSiteRatings(allUsers, hybridMovieKey);
  hybridModelCache = { model, graph, siteRatings, builtAt: now };
  if (RECOMMENDER_DEBUG) console.log('[hybrid] graph', graphStats(graph), 'rated movies', siteRatings.size);
  return hybridModelCache;
}

/**
 * getSiteRating — средняя оценка фильма по сайту: { average, count } | null.
 * Принимает объект с tmdbId/mediaType/title (как у фильмов/рекомендаций).
 */
function getSiteRating(item) {
  if (!item) return null;
  const key = hybridMovieKey(item);
  if (!key) return null;
  const r = buildHybridModel().siteRatings.get(key);
  return r ? { average: r.average, count: r.count } : null;
}

/**
 * applyHybridScoring — собирает все сигналы и делегирует смешивание в
 * getHybridRecommendations(): content + категории (mood/pace/tone/…),
 * похожие пользователи (через матрицу И обход графа), популярность
 * сообщества и качество. Возвращает объяснимые рекомендации.
 *
 * Безопасно для гостя: нет профиля → коллаборативная часть пустая,
 * работает content + категории + популярность + качество.
 */
function applyHybridScoring({ username, recs, movies, prefs, limit }) {
  try {
    const { model, graph } = buildHybridModel();
    const tasteProfile = buildUserTasteProfile(movies, prefs);
    // Категорийный профиль вкуса (mood/pace/tone/themes/setting/…).
    const categoryProfile = buildCategoryProfile(movies, (m) => hybridActionWeight(m, prefs));

    const excludeKeys = new Set();
    for (const m of movies) {
      const k = hybridMovieKey(m);
      if (k) excludeKeys.add(k);
    }

    const hasProfile = model.matrix.has(username);
    const { scores: collaborative, neighbors } = hasProfile
      ? getCollaborativeScores(username, model, { excludeKeys })
      : { scores: new Map(), neighbors: [] };

    // Граф: проставляем рёбра user--similarTo-->user и добавляем кандидатов,
    // полученных ОБХОДОМ графа (user→similarTo→сосед→rated→movie). Так граф
    // реально участвует в пайплайне, а не просто хранится.
    if (hasProfile && neighbors.length) {
      setSimilarEdges(graph, username, neighbors);
      const viaGraph = graphCollaborativeCandidates(graph, username, { excludeKeys });
      for (const [key, entry] of viaGraph) {
        const cur = collaborative.get(key);
        if (!cur) collaborative.set(key, entry);
        else cur.score = Math.max(cur.score || 0, entry.score || 0);
      }
    }

    const socialScoreFn = (item) => getSocialScore({
      tmdbId: item.tmdbId, mediaType: item.mediaType, title: item.title
    });

    const hybrid = getHybridRecommendations({
      recs,
      currentMovies: movies,
      model,
      tasteProfile,
      categoryProfile,
      socialScoreFn,
      collaborative,
      neighbors,
      limit
    });
    // Доп. поле: средняя оценка по сайту среди пользователей.
    hybrid.recommendations = hybrid.recommendations.map((r) => ({
      ...r,
      siteRating: getSiteRating(r)
    }));
    return hybrid;
  } catch (err) {
    if (RECOMMENDER_DEBUG) console.error('[hybrid] scoring failed', err?.message);
    return { recommendations: recs, similarUsersCount: 0 };
  }
}

app.get('/api/recommendations', async (req, res) => {
  const apiKey = process.env.OPENAI_API_KEY;
  // Публичный эндпоинт: гость получает популярные/трендовые подборки,
  // вошедший — персональные. Ключ кеша и данные зависят от наличия входа.
  const authedUser = optionalAuth(req);
  const username = authedUser || '__guest__';

  try {
    const { movies } = authedUser ? loadUserMovies(authedUser) : { movies: [] };
    const prefs = authedUser ? loadUserPrefs(DATA_DIR, authedUser) : loadUserPrefs(DATA_DIR, '__guest__');
    const taste = buildTasteContext(movies, prefs.blacklist);
    const blacklistPrompt = buildBlacklistPrompt(prefs.blacklist);
    const psychPrompt = appendPsychSignals(prefs);
    const limit = normalizeRecommendationLimit(req.query.limit);
    const excludeTitles = parseExcludedTitles(req.query.excludeTitles);
    const mediaTypeFilter = req.query.mediaType === 'tv' ? 'tv' : req.query.mediaType === 'movie' ? 'movie' : null;
    const categoryFilter = req.query.category === 'animation' ? 'animation' : null;
    const enrichOpts = { limit, excludeTitles, mediaType: mediaTypeFilter, category: categoryFilter };
    const aiForced = req.query.ai === '1';

    // ── ЛОКАЛЬНЫЙ ДВИЖОК (local-first) ────────────────────────────
    // По умолчанию рекомендации собирает быстрый локальный алгоритм из
    // реальных TMDB-кандидатов. OpenAI подключается только опционально
    // (rerank/объяснения) и не является основным генератором.
    if (RECOMMENDER_MODE !== 'ai_first') {
      const localKey = recommendationCacheKey(username, mediaTypeFilter, categoryFilter);
      const cachedLocal = getCachedRecommendations(localKey);
      if (cachedLocal && !aiForced) {
        const finalized = filterSwipeRecommendations(
          filterFreshRecommendations(cachedLocal, movies, excludeTitles).slice(0, limit),
          enrichOpts
        );
        if (finalized.length >= Math.min(limit, 5)) {
          return res.json({ recommendations: finalized, cached: true, source: 'local_algorithm' });
        }
      }

      try {
        const engineMediaType = categoryFilter === 'animation' ? 'tv' : mediaTypeFilter;
        const local = await runLocalRecommender({
          movies, prefs, mode: 'personal',
          limit: Math.max(limit + 6, 16),
          mediaType: engineMediaType, excludeTitles
        });
        let recs = filterSwipeRecommendations(local.recommendations, enrichOpts);

        if (recs.length >= Math.min(limit, 5)) {
          const wantAi = apiKey && (aiForced || OPENAI_RECOMMENDATION_RERANK || OPENAI_RECOMMENDATION_EXPLANATIONS);
          if (wantAi) {
            try {
              recs = await aiPolishLocalRecommendations(apiKey, {
                summary: buildTasteSummaryForAI(movies, prefs),
                recs: recs.slice(0, Math.max(limit + 4, 12)),
                count: limit,
                rerank: aiForced || OPENAI_RECOMMENDATION_RERANK
              });
            } catch (aiErr) {
              if (RECOMMENDER_DEBUG) console.error('[recommender] ai polish failed', aiErr?.message);
            }
          }
          // ── ГИБРИД: учитываем похожих пользователей + популярность ──
          const hybrid = applyHybridScoring({ username, recs, movies, prefs, limit });
          recs = hybrid.recommendations;
          setCachedRecommendations(localKey, recs);
          const payload = {
            recommendations: recs.slice(0, limit),
            source: recs[0]?.source || 'hybrid',
            similarUsers: hybrid.similarUsersCount
          };
          if (!taste) payload.notice = 'Отметьте фильмы как «посмотрел» и поставьте оценки — рекомендации станут точнее.';
          return res.json(payload);
        }
        // Локальных результатов мало — уходим в legacy/TMDB ниже.
      } catch (engineErr) {
        if (RECOMMENDER_DEBUG) console.error('[recommender] local engine failed', engineErr?.message);
      }
    }

    if (!apiKey) {
      const recommendations = await enrichRecommendations([], movies, enrichOpts);
      return res.json({ recommendations, mode: 'tmdb' });
    }

    if (!taste) {
      const recommendations = await enrichRecommendations([], movies, enrichOpts);
      return res.json({
        recommendations,
        notice: recommendations.length
          ? 'Добавьте просмотренные фильмы с оценками, чтобы рекомендации стали точнее.'
          : 'Отметьте фильмы как «посмотрел», чтобы собрать персональную подборку.'
      });
    }

    const cacheKey = recommendationCacheKey(username, mediaTypeFilter, categoryFilter);
    const cached = getCachedRecommendations(cacheKey);
    if (cached) {
      const freshCached = filterFreshRecommendations(cached, movies, excludeTitles);
      const finalized = filterSwipeRecommendations(freshCached.slice(0, limit), enrichOpts);
      if (finalized.length >= Math.min(limit, 5)) {
        return res.json({ recommendations: finalized, cached: true });
      }
    }

    const requestCount = Math.min(RECOMMENDATION_MAX_LIMIT, Math.max(limit + 4, 12));
    const blockedList = [
      ...movies.map((movie) => movie.title),
      ...excludeTitles
    ].filter(Boolean);

    const typePrompt = categoryFilter === 'animation'
      ? 'Только анимационные сериалы и мультсериалы (mediaType "tv", жанр анимация).'
      : mediaTypeFilter === 'tv'
        ? 'Только сериалы (mediaType "tv"), без мультсериалов.'
        : mediaTypeFilter === 'movie'
          ? 'Только фильмы (mediaType "movie").'
          : '';

    const message = await callOpenAI(apiKey, [
      { role: 'system', content: 'Ты кинокритик. Отвечай JSON без markdown.' },
      {
        role: 'user',
        content: `Вкус пользователя:
${taste}

Предложи ${requestCount} фильмов или сериалов с учётом предпочтений и заметок.
${typePrompt}
Для каждого укажи reason (коротко) и whyDetailed (2-3 предложения: на какие конкретные просмотренные фильмы опираешься и почему подходит).
Не предлагай то, что уже есть или уже было показано: ${blockedList.join(', ') || 'пусто'}.
${TITLE_RULE}${blacklistPrompt}${psychPrompt}
JSON: {"recommendations":[{"title":"...","mediaType":"movie","reason":"...","whyDetailed":"..."}]}
В массиве recommendations должно быть ровно ${requestCount} элементов. mediaType: "movie" или "tv".`
      }
    ], false);

    const parsed = JSON.parse(message.content);
    const enrichedAll = await enrichRecommendations(
      (parsed.recommendations || []).slice(0, requestCount),
      movies,
      { ...enrichOpts, limit: requestCount }
    );
    setCachedRecommendations(recommendationCacheKey(username, mediaTypeFilter, categoryFilter), enrichedAll);
    res.json({ recommendations: enrichedAll.slice(0, limit) });
  } catch (error) {
    const formatted = error.openai || formatOpenAIError(error.message);
    try {
      const { movies } = loadUserMovies(username);
      const recommendations = await enrichRecommendations([], movies, {
        limit: normalizeRecommendationLimit(req.query.limit),
        excludeTitles: parseExcludedTitles(req.query.excludeTitles),
        mediaType: req.query.mediaType === 'tv' ? 'tv' : req.query.mediaType === 'movie' ? 'movie' : null,
        category: req.query.category === 'animation' ? 'animation' : null,
      });
      if (recommendations.length) {
        return res.json({ recommendations, mode: 'tmdb', notice: formatted.message });
      }
    } catch (fallbackError) {
      // Preserve the original AI error if the local fallback also fails.
    }
    res.status(formatted.code === 'quota' ? 503 : 500).json({ error: formatted.message });
  }
});

/* ===================================================================
   ХЕЛПЕРЫ AI-ЧАТА: подборки с карточками
   -------------------------------------------------------------------
   Логика экономии OpenAI:
     • Простые подборки (жанр/тема) собираются из TMDb локальным скорингом
       (buildSimpleRecommendations) — OpenAI не вызывается вообще.
     • Сложные запросы идут в OpenAI, но КАЖДОЕ предложенное название
       проверяется через TMDb (buildComplexRecommendations): факты (постер,
       год, рейтинг, описание, жанры) берём только из TMDb, выдуманные
       тайтлы отбрасываем.
     • Любой ответ-подборка превращается в структуру { type:"recommendations",
       items:[...] } — фронтенд рисует это карточками.
   =================================================================== */

function clampNum(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

// Перевод русской темы в англоязычный keyword TMDB (keyword-индекс TMDB
// англоязычный). Покрывает частые темы; иначе пробуем тему как есть.
const THEME_KEYWORD_TRANSLATIONS = {
  'маньяк': 'serial killer', 'серийн': 'serial killer', 'убийц': 'murder',
  'зомби': 'zombie', 'вампир': 'vampire', 'оборотн': 'werewolf',
  'космос': 'space', 'инопланет': 'alien', 'пришельц': 'alien',
  'робот': 'robot', 'киборг': 'cyborg', 'апокалипс': 'post-apocalyptic',
  'выживани': 'survival', 'войн': 'war', 'шпион': 'spy', 'мафи': 'mafia',
  'наркот': 'drugs', 'тюрьм': 'prison', 'призрак': 'ghost', 'демон': 'demon',
  'путешестви': 'time travel', 'супергеро': 'superhero', 'магия': 'magic',
  'дракон': 'dragon', 'пират': 'pirate', 'ограблени': 'heist',
  'катастроф': 'disaster', 'монстр': 'monster', 'эпидеми': 'pandemic'
};

function translateThemeToKeyword(theme) {
  const t = String(theme || '').toLowerCase().replace(/ё/g, 'е');
  for (const [stem, en] of Object.entries(THEME_KEYWORD_TRANSLATIONS)) {
    if (t.includes(stem)) return en;
  }
  return theme;
}

async function resolveTmdbKeywordIds(theme) {
  const query = translateThemeToKeyword(theme);
  const data = await tmdbFetch('/search/keyword', { query }, { language: 'en-US' });
  if (!data?.results?.length) return [];
  return data.results.slice(0, 2).map((k) => k.id).filter(Boolean);
}

// Унифицированная карточка фильма/сериала для ответа /api/chat.
function toChatCard(c, reason) {
  return {
    title: c.title,
    originalTitle: c.originalTitle || null,
    year: c.year || null,
    tmdbId: c.tmdbId || null,
    mediaType: c.mediaType || 'movie',
    posterUrl: upgradeTmdbPosterUrl(c.poster, 'w780') || null,
    overview: (c.overview || '').slice(0, 400),
    rating: c.voteAverage ? Number(Number(c.voteAverage).toFixed(1)) : null,
    genres: c.genres || [],
    reason: reason || c.reason || '',
    source: c.source || 'tmdb'
  };
}

function buildSimpleReason(candidate, detection, quality) {
  const parts = [];
  if (detection.genreNames?.length) {
    parts.push(`Подходит под запрос на ${detection.genreNames.join(', ')}`);
  } else if (detection.theme) {
    parts.push(`Подходит под тему «${detection.theme}»`);
  } else {
    parts.push('Подходит под ваш запрос');
  }
  if (candidate.voteAverage >= 7 && candidate.voteCount >= 200) {
    parts.push(`высокий рейтинг TMDB ${Number(candidate.voteAverage).toFixed(1)}`);
  } else if (candidate.voteAverage) {
    parts.push(`рейтинг TMDB ${Number(candidate.voteAverage).toFixed(1)}`);
  }
  return `${parts.join(' и ')}.`;
}

function buildRecommendationsHeader(detection) {
  const what = detection?.mediaType === 'tv' ? 'сериалов' : 'фильмов';
  if (detection?.genreNames?.length) {
    return `Вот подборка (${detection.genreNames.join(', ')}), которая может вам подойти:`;
  }
  if (detection?.theme) {
    return `Вот подборка по теме «${detection.theme}»:`;
  }
  return `Вот подборка ${what}, которые могут вам подойти:`;
}

/**
 * buildSimpleRecommendations — ПРОСТАЯ подборка БЕЗ OpenAI.
 * Алгоритм по ТЗ: распознать жанр/количество/тип → взять кандидатов из TMDb
 * (discover/keyword) → исключить уже добавленное, просмотренное и чёрный
 * список → отсортировать по TMDb-рейтингу, числу голосов, популярности,
 * рейтингу сайта и личным предпочтениям → вернуть карточки.
 */
async function buildSimpleRecommendations({ movies, prefs, detection }) {
  const mediaType = detection.mediaType === 'tv' ? 'tv' : 'movie';
  const limit = Math.max(1, Math.min(20, detection.count || 10));
  const genreNameMap = await getGenreNameMap(tmdbFetch); // id → русское имя жанра
  const tasteProfile = buildUserTasteProfile(movies, prefs);

  // Тема («про маньяков») → keyword id у TMDb (всё ещё без OpenAI).
  let keywordIds = [];
  if (detection.theme) keywordIds = await resolveTmdbKeywordIds(detection.theme);

  // Исключаем: всё, что уже в списке пользователя, и просмотренное по tmdbId.
  const blockedTitles = new Set(
    [...movies.map((m) => m.title), ...movies.map((m) => m.meta?.originalTitle)]
      .filter(Boolean).map(normalizeWatchTitle)
  );
  const blockedTmdb = new Set(
    movies.filter((m) => m.tmdbId).map((m) => `${m.mediaType || 'movie'}:${m.tmdbId}`)
  );

  const discoverPath = mediaType === 'tv' ? '/discover/tv' : '/discover/movie';
  const pool = new Map();

  for (let page = 1; page <= 5 && pool.size < limit * 5; page += 1) {
    const params = {
      sort_by: 'popularity.desc',
      include_adult: 'false',
      'vote_count.gte': detection.theme ? 30 : 100,
      page: String(page)
    };
    if (detection.genreIds?.length) params.with_genres = detection.genreIds.join(',');
    if (keywordIds.length) params.with_keywords = keywordIds.join('|');
    if (detection.originalLanguage) params.with_original_language = detection.originalLanguage;

    const data = await tmdbFetch(discoverPath, params);
    if (!data?.results?.length) break;

    for (const r of data.results) {
      const title = r.title || r.name;
      if (!title || !r.poster_path) continue; // фронтенду нужен постер
      const tmdbKey = `${mediaType}:${r.id}`;
      const titleKey = normalizeWatchTitle(title);
      if (pool.has(tmdbKey)) continue;
      if (blockedTmdb.has(tmdbKey) || blockedTitles.has(titleKey)) continue; // уже добавлено/просмотрено

      const releaseDate = r.release_date || r.first_air_date || null;
      const genres = (r.genre_ids || []).map((id) => genreNameMap.get(id)).filter(Boolean);
      const candidate = {
        tmdbId: r.id,
        title,
        originalTitle: r.original_title || r.original_name || null,
        mediaType,
        poster: tmdbPosterFromPath(r.poster_path, 'w780'),
        year: releaseDate ? Number(releaseDate.slice(0, 4)) || null : null,
        releaseDate,
        overview: r.overview || '',
        genres,
        voteAverage: r.vote_average || 0,
        voteCount: r.vote_count || 0,
        popularity: r.popularity || 0
      };
      // Чёрный список (жанры/год/рантайм/страна).
      if (matchesBlacklist({ title, genres, meta: { year: candidate.year } }, prefs.blacklist)) continue;
      pool.set(tmdbKey, candidate);
    }
  }

  const candidates = [...pool.values()];
  if (!candidates.length) return [];

  // Скоринг: TMDb рейтинг + число голосов + популярность + рейтинг сайта +
  // личные предпочтения пользователя (scoreMovieForUser).
  const scored = candidates.map((c) => {
    const voteConfidence = clampNum((c.voteCount || 0) / 500, 0, 1);
    const quality = clampNum((c.voteAverage / 10) * (0.4 + 0.6 * voteConfidence), 0, 1);
    const popularity = clampNum(Math.log10((c.popularity || 0) + 1) / 3, 0, 1);
    const site = getSiteRating(c);
    const siteScore = site ? clampNum((site.average / 10) * clampNum(site.count / 5, 0, 1), 0, 1) : 0;
    const personalInfo = scoreMovieForUser(
      { ...c, genres: (c.genres || []).map(canonicalGenre) }, tasteProfile, { mode: 'personal' }
    );
    const personal = Number.isFinite(personalInfo.score) ? clampNum(personalInfo.score * 3, -1, 1) : 0;
    const sortScore = quality * 0.5 + popularity * 0.15 + siteScore * 0.15 + personal * 0.2;
    return { c, sortScore, quality };
  });

  scored.sort((a, b) => b.sortScore - a.sortScore);
  return scored.slice(0, limit).map(({ c, quality }) => toChatCard(c, buildSimpleReason(c, detection, quality)));
}

function stripJsonFences(text) {
  return String(text || '').replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
}

/**
 * buildComplexRecommendations — СЛОЖНАЯ подборка через OpenAI + TMDb.
 * OpenAI только предлагает названия/критерии. Каждое название проверяется
 * через TMDb (resolveMovieForAdd); если фильм не найден в TMDb — он не
 * показывается. Все факты (постер, год, рейтинг, описание, жанры) берём
 * исключительно из TMDb, чтобы модель не «выдумывала» фильмы.
 */
async function buildComplexRecommendations({ apiKey, userText, movies, prefs }) {
  const summary = buildTasteSummaryForAI(movies, prefs);
  const blacklistPrompt = buildBlacklistPrompt(prefs.blacklist);

  const message = await callOpenAI(apiKey, [
    {
      role: 'system',
      content: 'Ты кинокритик-рекомендатель. Отвечай только валидным JSON без markdown. Предлагай ТОЛЬКО реально существующие фильмы и сериалы — каждый будет проверен по базе TMDB.'
    },
    {
      role: 'user',
      content: `Запрос пользователя: "${userText}"

Кратко о вкусе пользователя:
${summary}${blacklistPrompt}

Подбери до 8 подходящих фильмов или сериалов. Для каждого верни оригинальное (английское) название, русское название (если знаешь), тип ("movie" или "tv"), год и короткую причину на русском (1–2 предложения), чем подходит под запрос.
Не придумывай несуществующие тайтлы. Формат: {"items":[{"title":"...","originalTitle":"...","mediaType":"movie","year":2010,"reason":"..."}]}`
    }
  ], false);

  let parsed;
  try { parsed = JSON.parse(stripJsonFences(message.content)); } catch { parsed = null; }
  const proposed = parsed?.items || parsed?.recommendations || [];
  if (!Array.isArray(proposed) || !proposed.length) return [];

  const blockedTmdb = new Set(
    movies.filter((m) => m.tmdbId).map((m) => `${m.mediaType || 'movie'}:${m.tmdbId}`)
  );
  const blockedTitles = new Set(movies.map((m) => normalizeWatchTitle(m.title)));

  const cards = [];
  const seen = new Set();
  for (const it of proposed.slice(0, 12)) {
    if (cards.length >= 8) break;
    const mediaType = it.mediaType === 'tv' ? 'tv' : 'movie';
    const queryTitle = it.originalTitle || it.title;
    if (!queryTitle) continue;

    // Проверка через TMDb: если нет совпадения — фильм НЕ показываем.
    const resolved = await resolveMovieForAdd(queryTitle, mediaType, {
      originalTitle: it.originalTitle || it.title
    });
    if (resolved.unresolved || !resolved.tmdbId) continue;

    const tmdbKey = `${resolved.mediaType || mediaType}:${resolved.tmdbId}`;
    if (seen.has(tmdbKey)) continue;
    if (blockedTmdb.has(tmdbKey) || blockedTitles.has(normalizeWatchTitle(resolved.title))) continue;
    seen.add(tmdbKey);

    if (matchesBlacklist({
      title: resolved.title,
      genres: resolved.genres || [],
      meta: resolved.meta
    }, prefs.blacklist)) continue;

    cards.push(toChatCard({
      tmdbId: resolved.tmdbId,
      title: resolved.title,
      originalTitle: resolved.meta?.originalTitle || null,
      mediaType: resolved.mediaType || mediaType,
      poster: resolved.meta?.poster || null,
      year: resolved.meta?.year ? Number(resolved.meta.year) : null,
      overview: resolved.meta?.overview || '',
      genres: resolved.genres || [],
      voteAverage: resolved.meta?.voteAverage || null,
      source: 'openai+tmdb'
    }, it.reason || 'Подобрано под ваш запрос и проверено по TMDB.'));
  }

  return cards;
}

/**
 * buildLocalRecommenderCards — подборка по локальному персональному движку
 * (TMDb + вкус пользователя), без OpenAI. Используется и когда нет ключа,
 * и как фолбэк, если запрос к OpenAI упал (квота/ключ/сеть), чтобы запрос
 * «посоветуй …» всё равно вернул карточки, а не список всего.
 */
async function buildLocalRecommenderCards({ movies, prefs, userText }) {
  const detection = detectRecommendationRequest(userText) || {};
  const local = await runLocalRecommender({
    movies, prefs, mode: 'personal',
    limit: detection.count || 10,
    mediaType: detection.mediaType || null
  });
  return (local.recommendations || []).map((r) => toChatCard({
    tmdbId: r.tmdbId, title: r.title, originalTitle: r.originalTitle,
    mediaType: r.mediaType, poster: r.poster, year: r.year,
    overview: r.overview, genres: r.genres, voteAverage: r.voteAverage,
    source: 'local_algorithm'
  }, r.reason));
}

/**
 * runOpenAIChat — старый путь с tool-calls (управление списком + текстовые
 * ответы про кино). Используется для вопросов о фильмах, анализа вкуса и
 * прочих запросов про кино, где нужен OpenAI.
 */
async function runOpenAIChat({ apiKey, messages, movies, prefs, username }) {
  const taste = buildTasteContext(movies, prefs.blacklist);
  const psychPrompt = appendPsychSignals(prefs);
  const films = movies.filter((m) => (m.mediaType || 'movie') === 'movie');
  const series = movies.filter((m) => m.mediaType === 'tv');

  const systemMessage = {
    role: 'system',
    content: `Ты помощник списка фильмов и сериалов пользователя ${username}. Отвечай на русском. Обсуждай только кино, сериалы, мультфильмы, аниме и связанные темы.

Инструменты: add_random_movies, add_movies, add_movie, delete_movie, update_movie, update_movie_notes.

Списки раздельные:
- Фильмы (mediaType "movie") — вкладка «Фильмы»
- Сериалы (mediaType "tv") — вкладка «Сериалы»
- При добавлении/удалении/изменении сериала ВСЕГДА указывай mediaType: "tv"
- При добавлении фильма — mediaType: "movie" (или не указывай, по умолчанию фильм)
- Не добавляй сериалы в список фильмов и фильмы в список сериалов

Правила:
- По умолчанию добавление → status "want", без оценки
- «смотрю» → watching; «посмотрел» / «в просмотренные» → watched
- add_random_movies: случайные фильмы (mediaType movie) или сериалы (mediaType tv)
- Для watched нужна оценка 1–10 или randomRating: true
- ${TITLE_RULE}
- Фильтрация («покажи сериалы которые смотрю») → отвечай текстом по списку сериалов
- Не дублируй записи в том же списке (фильм/сериал)
- Объясняй сюжет без спойлеров

Вкус и история:
${taste || 'пока нет'}
${psychPrompt}

Список фильмов (JSON):
${JSON.stringify(films, null, 2)}

Список сериалов (JSON):
${JSON.stringify(series, null, 2)}`
  };

  const apiMessages = [systemMessage, ...messages];
  const actions = [];
  let reply = '';

  for (let step = 0; step < 5; step++) {
    const message = await callOpenAI(apiKey, apiMessages, true);

    if (message.tool_calls?.length > 0) {
      apiMessages.push(message);
      for (const toolCall of message.tool_calls) {
        const args = JSON.parse(toolCall.function.arguments);
        actions.push({ type: toolCall.function.name, ...args });
        apiMessages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: JSON.stringify({ success: true })
        });
      }
      continue;
    }

    reply = message.content || 'Готово!';
    break;
  }

  if (!reply && actions.length > 0) reply = 'Список обновлён!';
  return finalizeChatResponse(reply, actions, movies);
}

app.post('/api/chat', async (req, res) => {
  const apiKey = process.env.OPENAI_API_KEY;
  const username = requireAuth(req, res);
  if (!username) return;

  const { messages } = req.body;
  const { movies } = loadUserMovies(username);
  const prefs = loadUserPrefs(DATA_DIR, username);
  const userText = getLastUserMessage(messages || []);

  // ── 1) ФИЛЬТР ТЕМЫ ────────────────────────────────────────────────
  // Нерелевантные запросы (не про кино) НЕ уходят в OpenAI — экономим.
  if (!isMovieRelatedPrompt(userText)) {
    return res.json({ type: 'text', message: OFF_TOPIC_REPLY, reply: OFF_TOPIC_REPLY, mode: 'filtered' });
  }

  // ── 2) ЛОКАЛЬНЫЕ КОМАНДЫ СПИСКА ──────────────────────────────────
  // add/delete/update/show/stats обрабатываются без OpenAI (localAssistant).
  // ВАЖНО: «show»-фильтр локального парсера слишком жадный и иногда ловит
  // запросы на подборку («посоветуй фильм как Интерстеллар, но мрачнее»),
  // выдавая «Найдено N: …» вместо рекомендаций. Поэтому локальный результат
  // без конкретных действий (add/delete/update) НЕ перебивает явный запрос на
  // подборку — такие отправляем в пайплайн рекомендаций ниже.
  const localResult = parseLocalChat(userText, movies);
  const recDetectionEarly = detectRecommendationRequest(userText);
  const isRealRecommendation = Boolean(recDetectionEarly && (recDetectionEarly.isSimple || recDetectionEarly.isComplex));
  const localHasActions = Boolean(localResult && (localResult.actions || []).length > 0);
  if (localResult && (localHasActions || !isRealRecommendation)) {
    const finalized = await finalizeChatResponse(localResult.reply, localResult.actions || [], movies);
    return res.json({ type: 'text', ...finalized, mode: 'local' });
  }

  // ── 3) INTENT DETECTION ──────────────────────────────────────────
  // Определяем тип запроса, чтобы выбрать самый дешёвый путь ответа.
  const intent = classifyChatIntent(userText, { hasLocalCommand: false });

  // ── 4) ПРОСТАЯ ПОДБОРКА (TMDb, без OpenAI) ───────────────────────
  if (intent === 'simple_recommendation') {
    const detection = detectRecommendationRequest(userText);
    try {
      const items = await buildSimpleRecommendations({ movies, prefs, detection });
      if (items.length) {
        return res.json({
          type: 'recommendations',
          message: buildRecommendationsHeader(detection),
          items,
          mode: 'tmdb'
        });
      }
    } catch (err) {
      if (RECOMMENDER_DEBUG) console.error('[chat] simple rec failed', err?.message);
    }
    // Если TMDb ничего не дал — попробуем дальше (OpenAI или локальный движок).
  }

  // ── 5) БЕЗ КЛЮЧА OPENAI ──────────────────────────────────────────
  if (!apiKey) {
    // Для подборок без ключа используем локальный персональный движок (TMDb).
    if (intent === 'complex_recommendation' || intent === 'simple_recommendation') {
      try {
        const items = await buildLocalRecommenderCards({ movies, prefs, userText });
        if (items.length) {
          return res.json({ type: 'recommendations', message: 'Подобрал по вашему вкусу:', items, mode: 'local_algorithm' });
        }
      } catch { /* падаем в текстовый ответ ниже */ }
    }
    const noKeyMsg = 'Для умных рекомендаций и ответов о кино нужен ключ OpenAI. Пока доступны команды списка («Добавь …», «Покажи …») и подборки по жанру («посоветуй 10 боевиков»).';
    return res.json({ type: 'text', message: noKeyMsg, reply: noKeyMsg, mode: 'no_openai' });
  }

  // ── 6) СЛОЖНАЯ ПОДБОРКА (OpenAI предлагает → TMDb проверяет) ──────
  if (intent === 'complex_recommendation' || intent === 'simple_recommendation') {
    try {
      const items = await buildComplexRecommendations({ apiKey, userText, movies, prefs });
      if (items.length) {
        return res.json({
          type: 'recommendations',
          message: 'Вот что подходит под ваш запрос:',
          items,
          mode: 'openai+tmdb'
        });
      }
    } catch (error) {
      // OpenAI недоступен (квота/ключ/сеть). Не вываливаем весь список —
      // пробуем локальный движок рекомендаций, чтобы вернуть карточки.
      try {
        const items = await buildLocalRecommenderCards({ movies, prefs, userText });
        if (items.length) {
          return res.json({
            type: 'recommendations',
            message: 'OpenAI сейчас недоступен — подобрал по вашему вкусу:',
            items,
            mode: 'local_algorithm'
          });
        }
      } catch { /* падаем в текстовый ответ ниже */ }
      const fb = handleOpenAIFailure(error, movies, userText);
      const finalized = await finalizeChatResponse(fb.reply, fb.actions || [], movies);
      return res.json({ type: 'text', ...finalized, mode: 'fallback' });
    }
    // Если проверенных карточек нет — отвечаем текстом ниже.
  }

  // ── 7) ВОПРОСЫ О КИНО / АНАЛИЗ ВКУСА / ПРОЧЕЕ ────────────────────
  // Текстовый ответ OpenAI (с инструментами управления списком).
  try {
    const result = await runOpenAIChat({ apiKey, messages, movies, prefs, username });
    res.json({ type: 'text', ...result, mode: 'openai' });
  } catch (error) {
    const fallback = handleOpenAIFailure(error, movies, userText);
    const finalized = await finalizeChatResponse(fallback.reply, fallback.actions || [], movies);
    res.json({ type: 'text', ...finalized, mode: 'fallback' });
  }
});

// --- Новые API ---

app.get('/api/prefs', (req, res) => {
  const username = requireAuth(req, res);
  if (!username) return;
  res.json(loadUserPrefs(DATA_DIR, username));
});

app.put('/api/prefs', (req, res) => {
  const username = requireAuth(req, res);
  if (!username) return;
  const current = loadUserPrefs(DATA_DIR, username);
  saveUserPrefs(DATA_DIR, username, { ...current, ...req.body });
  invalidateUserRecommendations(username);
  res.json({ success: true });
});

app.get('/api/blacklist', (req, res) => {
  const username = requireAuth(req, res);
  if (!username) return;
  res.json(loadUserPrefs(DATA_DIR, username).blacklist);
});

app.put('/api/blacklist', (req, res) => {
  const username = requireAuth(req, res);
  if (!username) return;
  const prefs = loadUserPrefs(DATA_DIR, username);
  prefs.blacklist = { ...prefs.blacklist, ...req.body };
  saveUserPrefs(DATA_DIR, username, prefs);
  invalidateUserRecommendations(username);
  res.json({ success: true });
});

// Добавление одного названия в чёрный список (кнопка «В чёрный список» на
// карточке рекомендации в чате). Дедуп по нормализованному названию.
app.post('/api/blacklist/title', (req, res) => {
  const username = requireAuth(req, res);
  if (!username) return;
  const title = String(req.body?.title || '').trim();
  if (!title) return res.status(400).json({ error: 'Не указано название' });

  const prefs = loadUserPrefs(DATA_DIR, username);
  const titles = Array.isArray(prefs.blacklist.titles) ? prefs.blacklist.titles : [];
  const exists = titles.some((t) => normalizeWatchTitle(t) === normalizeWatchTitle(title));
  if (!exists) titles.push(title);
  prefs.blacklist = { ...prefs.blacklist, titles };
  saveUserPrefs(DATA_DIR, username, prefs);
  invalidateUserRecommendations(username);
  res.json({ success: true, alreadyExisted: exists });
});

app.get('/api/profile', (req, res) => {
  const username = requireAuth(req, res);
  if (!username) return;

  const { movies } = loadUserMovies(username);
  const prefs = loadUserPrefs(DATA_DIR, username);
  normalizePsychPrefs(prefs);
  normalizeVisualPrefs(prefs);
  normalizeShortVisualPrefs(prefs);

  const users = loadUsers();
  const userMeta = users[username] || {};

  const watched = movies.filter((m) => m.status === 'watched');
  res.json({
    username,
    registeredAt: userMeta.registeredAt || null,
    lastActiveAt: userMeta.lastActiveAt || null,
    totalMovies: movies.length,
    watchedMovies: watched.filter((m) => m.mediaType !== 'tv').length,
    watchedSeries: watched.filter((m) => m.mediaType === 'tv').length,
    psychTest: prefs.psychTest || null,
    psychTestHistory: prefs.psychTestHistory || [],
    visualTest: prefs.visualTest || null,
    visualTestHistory: prefs.visualTestHistory || [],
    dynamics: (prefs.psychTestHistory?.length >= 2)
      ? {
          first: prefs.psychTestHistory[prefs.psychTestHistory.length - 1],
          last: prefs.psychTestHistory[0],
          profileChanged: prefs.psychTestHistory[prefs.psychTestHistory.length - 1].profile
            !== prefs.psychTestHistory[0].profile,
          summary: buildDynamicsText(
            prefs.psychTestHistory[prefs.psychTestHistory.length - 1],
            prefs.psychTestHistory[0]
          )
        }
      : null,
    visualDynamics: (prefs.visualTestHistory?.length >= 2)
      ? {
          first: prefs.visualTestHistory[prefs.visualTestHistory.length - 1],
          last: prefs.visualTestHistory[0],
          profileChanged: prefs.visualTestHistory[prefs.visualTestHistory.length - 1].profile
            !== prefs.visualTestHistory[0].profile,
          summary: buildVisualDynamicsText(
            prefs.visualTestHistory[prefs.visualTestHistory.length - 1],
            prefs.visualTestHistory[0]
          )
        }
      : null,
    shortVisualTests: prefs.shortVisualTests || { lastResults: {}, history: [] }
  });
});

app.get('/api/psych-test', (req, res) => {
  // Публично: вопросы доступны гостям. Сохранённый результат — только у вошедших.
  const username = optionalAuth(req);
  const prefs = username ? loadUserPrefs(DATA_DIR, username) : null;
  if (prefs) normalizePsychPrefs(prefs);
  res.json({
    guest: !username,
    psychTest: prefs?.psychTest || null,
    psychTestHistory: prefs?.psychTestHistory || [],
    questions: PSYCH_QUESTIONS.map((q) => ({
      id: q.id,
      text: q.text,
      options: q.options.map((o) => ({ id: o.id, text: o.text }))
    }))
  });
});

app.post('/api/psych-test', (req, res) => {
  // Публично: гость получает профиль, но он НЕ сохраняется.
  const username = optionalAuth(req);

  const result = calculatePsychResult(req.body?.answers || []);
  if (result.error) return res.status(400).json({ error: result.error });

  if (!username) {
    return res.json({
      success: true,
      saved: false,
      guest: true,
      psychTest: { ...result, profileTitle: PSYCH_PROFILES[result.profile]?.title || null },
      profile: PSYCH_PROFILES[result.profile]
    });
  }

  const prefs = loadUserPrefs(DATA_DIR, username);
  const psychTest = savePsychTestResult(prefs, result);
  saveUserPrefs(DATA_DIR, username, prefs);
  invalidateUserRecommendations(username);

  res.json({
    success: true,
    saved: true,
    psychTest,
    profile: PSYCH_PROFILES[result.profile]
  });
});

app.post('/api/psych-test/recommendations', async (req, res) => {
  const apiKey = process.env.OPENAI_API_KEY;
  // Публично: гость присылает answers (или готовый profile), считаем профиль
  // на лету без сохранения и подбираем рекомендации.
  const username = optionalAuth(req);

  const prefs = username ? loadUserPrefs(DATA_DIR, username) : loadUserPrefs(DATA_DIR, '__guest__');
  if (username) normalizePsychPrefs(prefs);
  const resultId = req.body?.resultId || null;
  let psychTest = username ? prefs.psychTest : null;

  // Гость или явно переданные ответы → считаем профиль из answers.
  if (!psychTest && Array.isArray(req.body?.answers) && req.body.answers.length) {
    const computed = calculatePsychResult(req.body.answers);
    if (!computed.error) {
      psychTest = { ...computed, profileTitle: PSYCH_PROFILES[computed.profile]?.title || null };
    }
  }

  if (username && resultId) {
    psychTest = findPsychResultById(prefs, resultId);
    if (!psychTest) {
      return res.status(404).json({ error: 'Результат теста не найден' });
    }
  }
  if (!psychTest?.profile) {
    return res.status(400).json({ error: 'Сначала пройдите кино-психологический тест' });
  }

  const { movies } = username ? loadUserMovies(username) : { movies: [] };
  const mediaType = req.body?.mediaType === 'tv' ? 'tv' : (req.body?.mediaType === 'movie' ? 'movie' : null);
  const basedOn = {
    resultId: psychTest.id || null,
    completedAt: psychTest.completedAt,
    profileTitle: psychTest.profileTitle
  };
  // Используем выбранный результат теста (на случай resultId) как активный профиль.
  const enginePrefs = { ...prefs, psychTest };

  // ── ЛОКАЛЬНЫЙ ДВИЖОК ──────────────────────────────────────────
  // Профиль теста влияет на скоринг через модификаторы, но история,
  // оценки, blacklist и feedback тоже учитываются. OpenAI больше не
  // обязателен — без ключа эндпоинт всё равно вернёт рекомендации.
  if (RECOMMENDER_MODE !== 'ai_first') {
    try {
      const local = await runLocalRecommender({ movies, prefs: enginePrefs, mode: 'psych', limit: 8, mediaType });
      let recommendations = local.recommendations;
      if (recommendations.length >= 4) {
        if (apiKey && (req.query.ai === '1' || OPENAI_RECOMMENDATION_EXPLANATIONS)) {
          try {
            recommendations = await aiPolishLocalRecommendations(apiKey, {
              summary: buildTasteSummaryForAI(movies, enginePrefs),
              recs: recommendations, count: 8, rerank: false
            });
          } catch (aiErr) {
            if (RECOMMENDER_DEBUG) console.error('[recommender] psych ai polish failed', aiErr?.message);
          }
        }
        return res.json({ recommendations, basedOn, source: 'local_algorithm' });
      }
    } catch (engineErr) {
      if (RECOMMENDER_DEBUG) console.error('[recommender] psych engine failed', engineErr?.message);
    }
  }

  // ── FALLBACK: старая AI-логика (только если есть ключ) ────────
  if (!apiKey) {
    return res.status(503).json({
      error: 'OpenAI не настроен. Добавьте OPENAI_API_KEY в .env для рекомендаций по тесту.'
    });
  }
  const blacklistPrompt = buildBlacklistPrompt(prefs.blacklist);
  const contextBlock = buildPsychRecommendationUserContext({
    psychTest,
    movies,
    prefs,
    mediaType
  }) + buildVisualTestPrompt(prefs.visualTest);
  const prompt = buildPsychRecommendationPrompt(contextBlock, blacklistPrompt, TITLE_RULE);

  try {
    const message = await callOpenAI(apiKey, [
      { role: 'system', content: 'Ты кинокритик. Отвечай только валидным JSON без markdown.' },
      { role: 'user', content: prompt }
    ], false);

    const rawList = parsePsychRecommendationsJson(message.content);
    const recommendations = await enrichPsychRecommendations(rawList);
    res.json({
      recommendations,
      basedOn,
      source: 'legacy_ai_fallback'
    });
  } catch (error) {
    const formatted = error.openai || formatOpenAIError(error.message);
    const isJsonError = error.message === 'invalid_json' || error instanceof SyntaxError;
    res.status(isJsonError ? 502 : (formatted.code === 'quota' ? 503 : 500)).json({
      error: isJsonError
        ? 'Не удалось разобрать ответ AI. Попробуйте ещё раз через минуту.'
        : formatted.message
    });
  }
});

app.post('/api/psych-test/feedback', (req, res) => {
  const username = requireAuth(req, res);
  if (!username) return;

  const { title, reason, note } = req.body || {};
  if (!title?.trim()) return res.status(400).json({ error: 'Укажите название' });
  if (!reason || !PSYCH_FEEDBACK_REASONS[reason]) {
    return res.status(400).json({ error: 'Выберите причину' });
  }

  const prefs = loadUserPrefs(DATA_DIR, username);
  if (!Array.isArray(prefs.psychRecFeedback)) prefs.psychRecFeedback = [];
  prefs.psychRecFeedback.push({
    title: String(title).trim(),
    reason,
    note: note ? String(note).trim() : '',
    at: new Date().toISOString()
  });
  if (prefs.psychRecFeedback.length > 100) {
    prefs.psychRecFeedback = prefs.psychRecFeedback.slice(-100);
  }
  saveUserPrefs(DATA_DIR, username, prefs);
  res.json({ success: true });
});

app.get('/api/visual-test', (req, res) => {
  const username = optionalAuth(req);
  const prefs = username ? loadUserPrefs(DATA_DIR, username) : null;
  if (prefs) normalizeVisualPrefs(prefs);
  res.json({
    guest: !username,
    visualTest: prefs?.visualTest || null,
    visualTestHistory: prefs?.visualTestHistory || [],
    questions: VISUAL_QUESTIONS.map((q) => ({
      id: q.id,
      imageId: q.imageId,
      text: q.text,
      options: q.options.map((o) => ({ id: o.id, text: o.text }))
    }))
  });
});

app.post('/api/visual-test', (req, res) => {
  const username = optionalAuth(req);

  const result = calculateVisualResult(req.body?.answers || []);
  if (result.error) return res.status(400).json({ error: result.error });

  if (!username) {
    return res.json({
      success: true,
      saved: false,
      guest: true,
      visualTest: { ...result, profileTitle: VISUAL_PROFILES[result.profile]?.title || null },
      profile: VISUAL_PROFILES[result.profile]
    });
  }

  const prefs = loadUserPrefs(DATA_DIR, username);
  const visualTest = saveVisualTestResult(prefs, result);
  saveUserPrefs(DATA_DIR, username, prefs);
  invalidateUserRecommendations(username);

  res.json({
    success: true,
    saved: true,
    visualTest,
    profile: VISUAL_PROFILES[result.profile]
  });
});

app.post('/api/visual-test/recommendations', async (req, res) => {
  const apiKey = process.env.OPENAI_API_KEY;
  const username = optionalAuth(req);

  const prefs = username ? loadUserPrefs(DATA_DIR, username) : loadUserPrefs(DATA_DIR, '__guest__');
  if (username) { normalizeVisualPrefs(prefs); normalizePsychPrefs(prefs); }
  const resultId = req.body?.resultId || null;
  let visualTest = username ? prefs.visualTest : null;

  if (!visualTest && Array.isArray(req.body?.answers) && req.body.answers.length) {
    const computed = calculateVisualResult(req.body.answers);
    if (!computed.error) {
      visualTest = { ...computed, profileTitle: VISUAL_PROFILES[computed.profile]?.title || null };
    }
  }

  if (username && resultId) {
    visualTest = findVisualResultById(prefs, resultId);
    if (!visualTest) {
      return res.status(404).json({ error: 'Результат визуального теста не найден' });
    }
  }
  if (!visualTest?.profile) {
    return res.status(400).json({ error: 'Сначала пройдите визуальный тест восприятия' });
  }

  const { movies } = username ? loadUserMovies(username) : { movies: [] };
  const mediaType = req.body?.mediaType === 'tv' ? 'tv' : (req.body?.mediaType === 'movie' ? 'movie' : null);
  const basedOn = {
    resultId: visualTest.id || null,
    completedAt: visualTest.completedAt,
    profileTitle: visualTest.profileTitle
  };
  const enginePrefs = { ...prefs, visualTest };

  // ── ЛОКАЛЬНЫЙ ДВИЖОК (визуальный тест как модификаторы) ───────
  if (RECOMMENDER_MODE !== 'ai_first') {
    try {
      const local = await runLocalRecommender({ movies, prefs: enginePrefs, mode: 'psych', limit: 8, mediaType });
      let recommendations = local.recommendations;
      if (recommendations.length >= 4) {
        if (apiKey && (req.query.ai === '1' || OPENAI_RECOMMENDATION_EXPLANATIONS)) {
          try {
            recommendations = await aiPolishLocalRecommendations(apiKey, {
              summary: buildTasteSummaryForAI(movies, enginePrefs),
              recs: recommendations, count: 8, rerank: false
            });
          } catch (aiErr) {
            if (RECOMMENDER_DEBUG) console.error('[recommender] visual ai polish failed', aiErr?.message);
          }
        }
        return res.json({ recommendations, basedOn, source: 'local_algorithm' });
      }
    } catch (engineErr) {
      if (RECOMMENDER_DEBUG) console.error('[recommender] visual engine failed', engineErr?.message);
    }
  }

  // ── FALLBACK: старая AI-логика ───────────────────────────────
  if (!apiKey) {
    return res.status(503).json({
      error: 'OpenAI не настроен. Добавьте OPENAI_API_KEY в .env для рекомендаций по визуальному тесту.'
    });
  }
  const blacklistPrompt = buildBlacklistPrompt(prefs.blacklist);
  const contextBlock = buildVisualRecommendationUserContext({
    visualTest,
    psychTest: prefs.psychTest,
    movies,
    prefs,
    mediaType
  });
  const prompt = buildVisualRecommendationPrompt(contextBlock, blacklistPrompt, TITLE_RULE);

  try {
    const message = await callOpenAI(apiKey, [
      { role: 'system', content: 'Ты кинокритик. Отвечай только валидным JSON без markdown.' },
      { role: 'user', content: prompt }
    ], false);

    const rawList = parseVisualRecommendationsJson(message.content);
    const recommendations = await enrichVisualRecommendations(rawList);
    res.json({
      recommendations,
      basedOn,
      source: 'legacy_ai_fallback'
    });
  } catch (error) {
    const formatted = error.openai || formatOpenAIError(error.message);
    const isJsonError = error.message === 'invalid_json' || error instanceof SyntaxError;
    res.status(isJsonError ? 502 : (formatted.code === 'quota' ? 503 : 500)).json({
      error: isJsonError
        ? 'Не удалось разобрать ответ AI. Попробуйте ещё раз через минуту.'
        : formatted.message
    });
  }
});

app.post('/api/visual-test/feedback', (req, res) => {
  const username = requireAuth(req, res);
  if (!username) return;

  const { title, reason, note } = req.body || {};
  if (!title?.trim()) return res.status(400).json({ error: 'Укажите название' });
  if (!reason || !VISUAL_FEEDBACK_REASONS[reason]) {
    return res.status(400).json({ error: 'Выберите причину' });
  }

  const prefs = loadUserPrefs(DATA_DIR, username);
  if (!Array.isArray(prefs.visualRecFeedback)) prefs.visualRecFeedback = [];
  prefs.visualRecFeedback.push({
    title: String(title).trim(),
    reason,
    note: note ? String(note).trim() : '',
    at: new Date().toISOString()
  });
  if (prefs.visualRecFeedback.length > 100) {
    prefs.visualRecFeedback = prefs.visualRecFeedback.slice(-100);
  }
  saveUserPrefs(DATA_DIR, username, prefs);
  res.json({ success: true });
});

app.get('/api/short-visual-tests', (req, res) => {
  const username = optionalAuth(req);
  const prefs = username ? loadUserPrefs(DATA_DIR, username) : null;
  if (prefs) normalizeShortVisualPrefs(prefs);

  const tests = SHORT_VISUAL_TESTS.map((test) => ({
    ...test,
    questions: getTestQuestions(test.id)
  }));

  res.json({
    guest: !username,
    tests,
    lastResults: prefs?.shortVisualTests?.lastResults || {},
    history: prefs?.shortVisualTests?.history || []
  });
});

app.post('/api/short-visual-tests', (req, res) => {
  const username = optionalAuth(req);

  const { testId, answers } = req.body || {};
  const result = calculateShortVisualResult(testId, answers);
  if (result.error) return res.status(400).json({ error: result.error });

  if (!username) {
    return res.json({ success: true, saved: false, guest: true, result, isRetake: false });
  }

  const prefs = loadUserPrefs(DATA_DIR, username);
  normalizeShortVisualPrefs(prefs);
  const isRetake = Boolean(prefs.shortVisualTests.lastResults[testId]);
  const saved = saveShortVisualTestResult(prefs, result);
  saveUserPrefs(DATA_DIR, username, prefs);
  invalidateUserRecommendations(username);

  res.json({ success: true, saved: true, result: saved, isRetake });
});

app.post('/api/short-visual-tests/recommendations', async (req, res) => {
  const apiKey = process.env.OPENAI_API_KEY;
  const username = optionalAuth(req);

  const prefs = username ? loadUserPrefs(DATA_DIR, username) : loadUserPrefs(DATA_DIR, '__guest__');
  if (username) { normalizeShortVisualPrefs(prefs); normalizePsychPrefs(prefs); normalizeVisualPrefs(prefs); }

  const resultId = req.body?.resultId || null;
  let shortVisualResult = username && prefs.shortVisualTests.lastResults
    ? Object.values(prefs.shortVisualTests.lastResults)[0]
    : null;

  // Гость: считаем результат из testId + answers без сохранения.
  if (!shortVisualResult && req.body?.testId && Array.isArray(req.body?.answers)) {
    const computed = calculateShortVisualResult(req.body.testId, req.body.answers);
    if (!computed.error) shortVisualResult = computed;
  }

  if (username && resultId) {
    shortVisualResult = findShortVisualResultById(prefs, resultId);
    if (!shortVisualResult) {
      return res.status(404).json({ error: 'Результат теста не найден' });
    }
  } else if (username && !shortVisualResult && prefs.shortVisualTests.history?.length) {
    shortVisualResult = prefs.shortVisualTests.history[0];
  }

  if (!shortVisualResult?.profileTitle) {
    return res.status(400).json({ error: 'Сначала пройдите короткий визуальный тест' });
  }

  const { movies } = username ? loadUserMovies(username) : { movies: [] };
  const mediaType = req.body?.mediaType === 'tv' ? 'tv' : (req.body?.mediaType === 'movie' ? 'movie' : null);
  const basedOn = {
    resultId: shortVisualResult.id || null,
    testId: shortVisualResult.testId,
    testTitle: shortVisualResult.testTitle,
    completedAt: shortVisualResult.completedAt,
    profileTitle: shortVisualResult.profileTitle
  };
  // Подсовываем выбранный результат как активный для модификаторов движка.
  const enginePrefs = {
    ...prefs,
    shortVisualTests: { ...prefs.shortVisualTests, lastResults: { selected: shortVisualResult } }
  };

  // ── ЛОКАЛЬНЫЙ ДВИЖОК (короткий тест как модификаторы) ─────────
  if (RECOMMENDER_MODE !== 'ai_first') {
    try {
      const local = await runLocalRecommender({ movies, prefs: enginePrefs, mode: 'psych', limit: 8, mediaType });
      let recommendations = local.recommendations.map((item) => ({
        ...item,
        testConnection: sanitizeShortVisualTestConnection(item.testConnection || item.whyDetailed, shortVisualResult.profileTitle)
      }));
      if (recommendations.length >= 4) {
        if (apiKey && (req.query.ai === '1' || OPENAI_RECOMMENDATION_EXPLANATIONS)) {
          try {
            recommendations = await aiPolishLocalRecommendations(apiKey, {
              summary: buildTasteSummaryForAI(movies, enginePrefs),
              recs: recommendations, count: 8, rerank: false
            });
          } catch (aiErr) {
            if (RECOMMENDER_DEBUG) console.error('[recommender] short ai polish failed', aiErr?.message);
          }
        }
        return res.json({ recommendations, basedOn, source: 'local_algorithm' });
      }
    } catch (engineErr) {
      if (RECOMMENDER_DEBUG) console.error('[recommender] short engine failed', engineErr?.message);
    }
  }

  // ── FALLBACK: старая AI-логика ───────────────────────────────
  if (!apiKey) {
    return res.status(503).json({
      error: 'OpenAI не настроен. Добавьте OPENAI_API_KEY в .env для рекомендаций по тесту.'
    });
  }
  const blacklistPrompt = buildBlacklistPrompt(prefs.blacklist);
  const contextBlock = buildShortVisualRecommendationUserContext({
    shortVisualResult,
    psychTest: prefs.psychTest,
    visualTest: prefs.visualTest,
    movies,
    prefs,
    mediaType
  });
  const prompt = buildShortVisualRecommendationPrompt(contextBlock, blacklistPrompt, TITLE_RULE);

  try {
    const message = await callOpenAI(apiKey, [
      { role: 'system', content: 'Ты кинокритик. Отвечай только валидным JSON без markdown.' },
      { role: 'user', content: prompt }
    ], false);

    const rawList = parseShortVisualRecommendationsJson(message.content);
    const enriched = await enrichPsychRecommendations(rawList);
    const recommendations = enriched.map((item) => ({
      ...item,
      testConnection: sanitizeShortVisualTestConnection(
        item.testConnection,
        shortVisualResult.profileTitle
      )
    }));
    res.json({
      recommendations,
      basedOn,
      source: 'legacy_ai_fallback'
    });
  } catch (error) {
    const formatted = error.openai || formatOpenAIError(error.message);
    const isJsonError = error.message === 'invalid_json' || error instanceof SyntaxError;
    res.status(isJsonError ? 502 : (formatted.code === 'quota' ? 503 : 500)).json({
      error: isJsonError
        ? 'Не удалось разобрать ответ AI. Попробуйте ещё раз через минуту.'
        : formatted.message
    });
  }
});

app.post('/api/short-visual-tests/feedback', (req, res) => {
  const username = requireAuth(req, res);
  if (!username) return;

  const { title, reason, note } = req.body || {};
  if (!title?.trim()) return res.status(400).json({ error: 'Укажите название' });
  if (!reason || !SHORT_VISUAL_FEEDBACK_REASONS[reason]) {
    return res.status(400).json({ error: 'Выберите причину' });
  }

  const prefs = loadUserPrefs(DATA_DIR, username);
  normalizeShortVisualPrefs(prefs);
  prefs.shortVisualRecFeedback.push({
    title: String(title).trim(),
    reason,
    note: note ? String(note).trim() : '',
    at: new Date().toISOString()
  });
  if (prefs.shortVisualRecFeedback.length > 100) {
    prefs.shortVisualRecFeedback = prefs.shortVisualRecFeedback.slice(-100);
  }
  saveUserPrefs(DATA_DIR, username, prefs);
  res.json({ success: true });
});

app.get('/api/achievements', (req, res) => {
  const username = requireAuth(req, res);
  if (!username) return;
  const { movies } = loadUserMovies(username);
  res.json({ achievements: computeAchievements(movies) });
});

app.post('/api/check-duplicate', (req, res) => {
  const username = requireAuth(req, res);
  if (!username) return;
  const { movies } = loadUserMovies(username);
  const dup = findDuplicate(movies, req.body);
  res.json({ duplicate: dup });
});

app.post('/api/import-formats', async (req, res) => {
  const username = requireAuth(req, res);
  if (!username) return;

  const { text, format, mediaType } = req.body;
  if (!text?.trim()) return res.status(400).json({ error: 'Вставьте данные' });

  const detected = format || detectImportFormat(text);
  const parsed = parseImportText(text, detected, mediaType || 'movie');
  res.json({ movies: parsed.slice(0, 100), format: detected, count: parsed.length });
});

app.get('/api/export', (req, res) => {
  const username = requireAuth(req, res);
  if (!username) return;

  const { movies, nextId } = loadUserMovies(username);
  const format = req.query.format || 'json';

  if (format === 'csv') {
    const header = 'id,title,status,rating,mediaType,year,genres,tags,watchedAt,addedAt,director,runtime,tmdbId';
    const rows = movies.map((m) => [
      m.id,
      `"${(m.title || '').replace(/"/g, '""')}"`,
      m.status,
      m.rating ?? '',
      m.mediaType || 'movie',
      m.meta?.year || '',
      `"${(m.genres || []).join('; ')}"`,
      `"${(m.tags || []).join('; ')}"`,
      m.watchedAt || '',
      m.addedAt || '',
      `"${(m.meta?.director || '').replace(/"/g, '""')}"`,
      m.meta?.runtime || '',
      m.tmdbId || ''
    ].join(','));
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="movies-${username}.csv"`);
    return res.send('\uFEFF' + [header, ...rows].join('\n'));
  }

  if (format === 'backup') {
    const prefs = loadUserPrefs(DATA_DIR, username);
    return res.json({ movies, nextId, prefs, exportedAt: new Date().toISOString() });
  }

  res.setHeader('Content-Disposition', `attachment; filename="movies-${username}.json"`);
  res.json({ movies, nextId, exportedAt: new Date().toISOString() });
});

app.post('/api/watch-now', async (req, res) => {
  const apiKey = process.env.OPENAI_API_KEY;
  const username = requireAuth(req, res);
  if (!username) return;

  const { excludeTitles = [], ...prefs } = req.body;
  const { movies } = loadUserMovies(username);
  const userPrefs = loadUserPrefs(DATA_DIR, username);
  const statusLabels = {
    want: 'Хочу посмотреть',
    watching: 'Смотрю',
    watched: 'Посмотрел'
  };
  const fromList = pickWatchNowLocal(movies, prefs, WATCH_NOW_LIMIT, statusLabels);
  const rankedCandidates = rankWatchNowCandidates(movies, prefs).slice(0, 20);
  const mergeOptions = {
    limit: WATCH_NOW_LIMIT,
    statusLabels,
    excludeTitles: Array.isArray(excludeTitles) ? excludeTitles : []
  };
  const pickCounts = buildWatchNowPromptCounts(rankedCandidates.length, WATCH_NOW_LIMIT);

  if (!apiKey) {
    let picks = finalizeWatchNowPicks(fromList, movies, prefs, mergeOptions);
    picks = await ensureWatchNowFilled(picks, movies, prefs, {
      ...mergeOptions,
      blacklist: userPrefs.blacklist
    });
    return res.json({ picks, mode: 'local', complete: isWatchNowComplete(picks) });
  }

  const taste = buildTasteContext(movies, userPrefs.blacklist);
  const blacklistPrompt = buildBlacklistPrompt(userPrefs.blacklist);
  const psychPrompt = appendPsychSignals(userPrefs);
  const candidateSummary = rankedCandidates.length
    ? buildWatchNowCandidateSummary(rankedCandidates)
    : 'нет подходящих кандидатов в списке';
  const listTitles = movies.map((m) => m.title).filter(Boolean);
  const excludePrompt = mergeOptions.excludeTitles.length
    ? `\nНе предлагай эти варианты (уже показывались): ${mergeOptions.excludeTitles.join(', ')}`
    : '';

  try {
    const excludeSet = new Set(
      [...mergeOptions.excludeTitles, ...movies.map((m) => m.title)]
        .filter(Boolean)
        .map(normalizeWatchTitle)
    );
    const discoverPrefetch = rankedCandidates.length < WATCH_NOW_LIMIT
      ? discoverTmdbWatchNowCandidates(prefs, 10, excludeSet)
      : Promise.resolve([]);

    const [message, prefetchedDiscover] = await Promise.all([
      callOpenAI(apiKey, [
      { role: 'system', content: 'Ты кинокритик. Отвечай только JSON без markdown.' },
      {
        role: 'user',
        content: `Пользователь спрашивает «что посмотреть прямо сейчас».

Жёсткие требования (обязательны для всех 5 вариантов):
- Длительность: ${DURATION_LABELS[prefs.duration] || prefs.duration || 'любая'}
- ${buildWatchNowDurationRule(prefs)}
- Настроение: ${MOOD_LABELS[prefs.mood] || prefs.mood}
- Тип: ${prefs.mediaType || 'movie'}

Кандидаты из списка пользователя (подходят по времени):
${candidateSummary}

Вкус пользователя (просмотренное):
${taste || 'нет'}

Подбери ровно 5 вариантов — не больше и не меньше (picks.length === 5):
- ${pickCounts.fromList} из кандидатов списка выше (source: "list", title дословно)
- ${pickCounts.fromNew} НОВЫХ фильмов/сериалов, которых нет в списке (source: "new")
Новые варианты обязательны и должны подходить под длительность и настроение.
Не предлагай как new то, что уже есть в списке пользователя.
Список пользователя: ${listTitles.join(', ') || 'пусто'}
${excludePrompt}
${TITLE_RULE}
${blacklistPrompt}${psychPrompt}
JSON: {"picks":[{"title":"...","runtime":85,"reason":"...","whyDetailed":"...","source":"list|new"}]}`
      }
    ], false),
      discoverPrefetch
    ]);

    const parsed = JSON.parse(message.content);
    const aiContext = {
      taste,
      blacklistPrompt,
      listTitles,
      excludeTitles: mergeOptions.excludeTitles,
      blacklist: userPrefs.blacklist,
      discoverPrefetch: prefetchedDiscover
    };
    const picks = await buildCompleteWatchNowPicks(
      parsed.picks || [],
      movies,
      prefs,
      mergeOptions,
      apiKey,
      aiContext
    );

    res.json({ picks, mode: 'openai', complete: isWatchNowComplete(picks) });
  } catch (error) {
    const formatted = error.openai || formatOpenAIError(error.message);
    let picks = finalizeWatchNowPicks(fromList, movies, prefs, mergeOptions);
    picks = await ensureWatchNowFilled(picks, movies, prefs, {
      ...mergeOptions,
      blacklist: userPrefs.blacklist
    });
    res.json({
      picks,
      mode: 'local',
      complete: isWatchNowComplete(picks),
      notice: formatted.message
    });
  }
});

app.get('/api/premieres', async (req, res) => {
  // Публичный эндпоинт: премьеры видны и гостям. Для вошедших —
  // персональная сортировка по вкусу, для гостей — по популярности.
  const username = optionalAuth(req);
  const { movies } = username ? loadUserMovies(username) : { movies: [] };
  const prefs = username ? loadUserPrefs(DATA_DIR, username) : loadUserPrefs(DATA_DIR, '__guest__');
  const today = new Date().toISOString().slice(0, 10);

  const fromList = movies
    .filter((m) => m.meta?.releaseDate)
    .map((m) => ({
      id: m.id,
      tmdbId: m.tmdbId || null,
      title: m.title,
      releaseDate: m.meta.releaseDate,
      poster: upgradeTmdbPosterUrl(m.meta?.poster, 'w780'),
      mediaType: m.mediaType || 'movie',
      status: m.status,
      inList: true,
      reminded: prefs.premiereReminders?.some((r) => r.id === m.id),
      overview: (m.meta?.overview || '').slice(0, 320),
      genres: m.genres || [],
      year: m.meta?.year || null,
      originalTitle: m.meta?.originalTitle || null,
      voteAverage: m.meta?.kpRating || m.meta?.imdbRating || null
    }));

  const upcoming = fromList.filter((p) => p.releaseDate > today);

  let tmdbUpcoming = [];
  const movieData = await tmdbFetch('/movie/upcoming', { region: 'RU' });
  if (movieData?.results) {
    // Персональная сортировка: самые релевантные вкусу премьеры — выше,
    // затем берём топ-15 (вместо первых 15 по популярности).
    let ranked = movieData.results;
    try {
      const scored = await scoreTmdbResultsForUser({
        tmdbFetch, tmdbPosterFromPath, results: movieData.results,
        mediaType: 'movie', movies, prefs, mode: 'premieres'
      });
      ranked = scored.map((s) => s.result);
    } catch (err) {
      if (RECOMMENDER_DEBUG) console.error('[recommender] premiere ranking failed', err?.message);
    }
    tmdbUpcoming = ranked.slice(0, 15).map((m) => ({
      tmdbId: m.id,
      title: m.title,
      originalTitle: m.original_title || null,
      releaseDate: m.release_date,
      poster: tmdbPosterFromPath(m.poster_path, 'w780'),
      mediaType: 'movie',
      inList: movies.some((x) => x.tmdbId === m.id),
      overview: (m.overview || '').slice(0, 320),
      voteAverage: m.vote_average || null,
      year: m.release_date ? Number(m.release_date.slice(0, 4)) : null,
      genres: []
    }));
  }

  // Доп. поле: средняя оценка по сайту среди пользователей.
  for (const p of upcoming) p.siteRating = getSiteRating(p);
  for (const p of tmdbUpcoming) p.siteRating = getSiteRating(p);

  res.json({ upcoming, tmdbUpcoming, reminders: prefs.premiereReminders || [] });
});

app.get('/api/premieres/suggest', async (req, res) => {
  const apiKey = process.env.OPENAI_API_KEY;
  const username = requireAuth(req, res);
  if (!username) return;

  const { movies } = loadUserMovies(username);
  const prefs = loadUserPrefs(DATA_DIR, username);
  const aiForced = req.query.ai === '1';

  // ── ЛОКАЛЬНЫЙ ДВИЖОК (mode: premieres) ───────────────────────
  // Подбираем будущие премьеры под вкус из реальных TMDB-кандидатов.
  if (RECOMMENDER_MODE !== 'ai_first') {
    try {
      const local = await runLocalRecommender({ movies, prefs, mode: 'premieres', limit: 6 });
      let suggestions = local.recommendations;
      if (suggestions.length) {
        if (apiKey && (aiForced || OPENAI_RECOMMENDATION_EXPLANATIONS)) {
          try {
            suggestions = await aiPolishLocalRecommendations(apiKey, {
              summary: buildTasteSummaryForAI(movies, prefs),
              recs: suggestions, count: 6, rerank: false
            });
          } catch (aiErr) {
            if (RECOMMENDER_DEBUG) console.error('[recommender] premiere suggest polish failed', aiErr?.message);
          }
        }
        return res.json({ suggestions, source: 'local_algorithm' });
      }
    } catch (engineErr) {
      if (RECOMMENDER_DEBUG) console.error('[recommender] premiere suggest engine failed', engineErr?.message);
    }
  }

  // ── FALLBACK: старая AI-логика ───────────────────────────────
  if (!apiKey) return res.status(503).json({ error: 'API не настроен' });

  try {
    const taste = buildTasteContext(movies, prefs.blacklist);
    const blacklistPrompt = buildBlacklistPrompt(prefs.blacklist);
    const psychPrompt = appendPsychSignals(prefs);
    const today = new Date().toISOString().slice(0, 10);
    const year = new Date().getFullYear();

    if (!taste) {
      return res.json({
        suggestions: [{ title: 'Начните с просмотра', reason: 'Отметьте фильмы как «посмотрел»' }]
      });
    }

    const message = await callOpenAI(apiKey, [
      { role: 'system', content: 'Ты кинокритик. Отвечай JSON без markdown.' },
      {
        role: 'user',
        content: `Вкус пользователя:
${taste}

Сегодня: ${today}. Предложи 6 фильмов или сериалов с предстоящими премьерами (${year}–${year + 1}), которые могут заинтересовать пользователя на основе его просмотренного.
Только реальные анонсы и скорые релизы, не классика и не то, что уже давно вышло.
Для каждого укажи reason (коротко) и whyDetailed (2-3 предложения: на какие конкретные просмотренные фильмы опираешься и почему подходит).
${TITLE_RULE}${blacklistPrompt}${psychPrompt}
JSON: {"suggestions":[{"title":"...","reason":"...","whyDetailed":"...","mediaType":"movie|tv"}]}
В массиве suggestions должно быть ровно 6 элементов.`
      }
    ], false);

    const parsed = JSON.parse(message.content);
    const suggestions = await enrichPremiereSuggestions((parsed.suggestions || []).slice(0, 6));
    res.json({ suggestions });
  } catch (error) {
    const formatted = error.openai || formatOpenAIError(error.message);
    res.status(formatted.code === 'quota' ? 503 : 500).json({ error: formatted.message });
  }
});

app.post('/api/premiere/remind', (req, res) => {
  const username = requireAuth(req, res);
  if (!username) return;

  const { id, title, releaseDate, mediaType } = req.body;
  const prefs = loadUserPrefs(DATA_DIR, username);
  if (!prefs.premiereReminders) prefs.premiereReminders = [];

  const exists = prefs.premiereReminders.find((r) => r.id === id);
  if (exists) {
    prefs.premiereReminders = prefs.premiereReminders.filter((r) => r.id !== id);
  } else {
    prefs.premiereReminders.push({ id, title, releaseDate, mediaType: mediaType || 'movie' });
  }

  saveUserPrefs(DATA_DIR, username, prefs);
  res.json({ success: true, reminders: prefs.premiereReminders });
});

app.get('/api/person/:personId', async (req, res) => {
  const username = requireAuth(req, res);
  if (!username) return;

  const personId = req.params.personId;
  const person = await tmdbFetch(`/person/${personId}`, { append_to_response: 'movie_credits,tv_credits' });
  if (!person) return res.status(503).json({ error: 'TMDB недоступен' });

  const { movies } = loadUserMovies(username);
  const name = person.name;

  const inList = movies.filter((m) => {
    if (m.meta?.director === name) return true;
    if (m.meta?.castDetails?.some((c) => c.id === Number(personId))) return true;
    if (m.meta?.cast?.includes(name)) return true;
    return false;
  });

  const watched = inList.filter((m) => m.status === 'watched');
  const ratings = watched.filter((m) => m.rating).map((m) => m.rating);
  const avgRating = ratings.length
    ? Number((ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1))
    : null;

  const isDirector = inList.some((m) => m.meta?.director === name);
  const role = isDirector ? 'director' : 'actor';

  let insight = null;
  const apiKey = process.env.OPENAI_API_KEY;
  if (apiKey && watched.length >= 2) {
    try {
      const titles = watched.map((m) => `${m.title} (${m.rating || '?'}/10)`).join(', ');
      const message = await callOpenAI(apiKey, [
        { role: 'system', content: 'Краткий инсайт на русском, 1 предложение. JSON: {"insight":"..."}' },
        { role: 'user', content: `Пользователь смотрел фильмы с ${name} (${role}): ${titles}. Что можно сказать о вкусе?` }
      ], false);
      insight = JSON.parse(message.content).insight;
    } catch { /* skip */ }
  }

  res.json({
    id: person.id,
    name: person.name,
    photo: person.profile_path ? `https://image.tmdb.org/t/p/w185${person.profile_path}` : null,
    role,
    inList: inList.map((m) => ({
      id: m.id,
      title: m.title,
      status: m.status,
      rating: m.rating,
      poster: upgradeTmdbPosterUrl(m.meta?.poster, 'w780'),
      year: m.meta?.year,
      mediaType: m.mediaType || 'movie'
    })),
    avgRating,
    watchedCount: watched.length,
    insight
  });
});

app.use((err, req, res, next) => {
  if (err?.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Список слишком большой для сохранения. Обновите страницу (Ctrl+F5).' });
  }
  console.error(err);
  res.status(500).json({ error: 'Внутренняя ошибка сервера' });
});

function getLanAddresses() {
  const nets = os.networkInterfaces();
  const addresses = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      const isIpv4 = net.family === 'IPv4' || net.family === 4;
      if (isIpv4 && !net.internal) addresses.push(net.address);
    }
  }
  return addresses;
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Сервер запущен: http://localhost:${PORT}`);
  const lan = getLanAddresses();
  if (lan.length) {
    console.log('Для телефона в той же Wi‑Fi:');
    lan.forEach((ip) => console.log(`  http://${ip}:${PORT}`));
  }
  // «Прогрев» соединения с TMDB: первый внешний HTTPS-запрос после старта
  // сервера долгий (DNS + TLS ~2.5 c). Делаем его сразу при запуске, чтобы
  // первая открытая пользователем страница фильма грузилась уже быстро.
  tmdbFetch('/configuration').catch(() => {});
});
