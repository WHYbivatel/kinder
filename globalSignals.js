/* ===================================================================
   globalSignals.js — глобальные счётчики реакций ВСЕХ пользователей.

   Считаем, сколько раз фильм лайкнули / пропустили (дизлайк) / отметили
   «уже смотрел» во всех свайпах. Эти агрегаты потом влияют на общие
   рекомендации (популярное по сообществу), независимо от конкретного
   пользователя.

   Хранилище — простой JSON-файл data/global/interactions.json:
     { "movie:tmdb:157336": { like, dislike, watched, title, mediaType } }

   Пишем с дебаунсом, чтобы не дёргать диск на каждый свайп.
   =================================================================== */

import fs from 'fs';
import path from 'path';

let STORE_PATH = null;
let store = null;
let saveTimer = null;
let dirty = false;

export function initGlobalSignals(dataDir) {
  const dir = path.join(dataDir, 'global');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  STORE_PATH = path.join(dir, 'interactions.json');
  try {
    store = fs.existsSync(STORE_PATH) ? JSON.parse(fs.readFileSync(STORE_PATH, 'utf8')) : {};
  } catch {
    store = {};
  }
  return store;
}

function ensureLoaded() {
  if (store === null) store = {};
  return store;
}

export function interactionKey({ tmdbId, mediaType = 'movie', title }) {
  if (tmdbId) return `${mediaType}:tmdb:${tmdbId}`;
  const t = String(title || '').toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();
  return t ? `${mediaType}:title:${t}` : null;
}

const VALID = new Set(['like', 'dislike', 'watched']);

/** Зарегистрировать реакцию. action ∈ {like, dislike, watched}. */
export function recordInteraction({ tmdbId, mediaType = 'movie', title, action }) {
  if (!VALID.has(action)) return null;
  const key = interactionKey({ tmdbId, mediaType, title });
  if (!key) return null;
  const s = ensureLoaded();
  if (!s[key]) s[key] = { like: 0, dislike: 0, watched: 0, title: title || null, mediaType, tmdbId: tmdbId || null };
  s[key][action] += 1;
  if (title && !s[key].title) s[key].title = title;
  scheduleSave();
  return s[key];
}

/** Агрегат по фильму (для скоринга). */
export function getInteraction({ tmdbId, mediaType = 'movie', title }) {
  const key = interactionKey({ tmdbId, mediaType, title });
  if (!key) return null;
  return ensureLoaded()[key] || null;
}

/**
 * Нормированный «социальный» балл фильма в диапазоне [-1, 1]:
 *   положительный — многим зашло, отрицательный — многие пропустили.
 * Учитывает объём реакций (мало данных → балл ближе к 0).
 */
export function getSocialScore({ tmdbId, mediaType = 'movie', title }) {
  const it = getInteraction({ tmdbId, mediaType, title });
  if (!it) return 0;
  const positive = it.like + it.watched;
  const negative = it.dislike;
  const total = positive + negative;
  if (total <= 0) return 0;
  const ratio = (positive - negative) / total;       // -1..1
  const confidence = Math.min(1, total / 10);         // объём реакций
  return ratio * confidence;
}

export function getTopLiked(limit = 20) {
  const s = ensureLoaded();
  return Object.values(s)
    .map((v) => ({ ...v, net: (v.like + v.watched) - v.dislike }))
    .filter((v) => v.net > 0)
    .sort((a, b) => b.net - a.net)
    .slice(0, limit);
}

function scheduleSave() {
  dirty = true;
  if (saveTimer) return;
  saveTimer = setTimeout(flush, 1500);
}

export function flush() {
  saveTimer = null;
  if (!dirty || !STORE_PATH) return;
  try {
    fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2));
    dirty = false;
  } catch {
    // молча — счётчики не критичны
  }
}
