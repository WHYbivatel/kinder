import fs from 'fs';
import path from 'path';

let dataDir = null;
let store = { items: {} };

function signalKey({ tmdbId, mediaType, title }) {
  if (tmdbId) return `${mediaType === 'tv' ? 'tv' : 'movie'}:${tmdbId}`;
  const t = String(title || '').trim().toLowerCase();
  return t || null;
}

function persist() {
  if (!dataDir) return;
  try {
    fs.writeFileSync(path.join(dataDir, 'globalSignals.json'), JSON.stringify(store, null, 2));
  } catch { /* ignore */ }
}

export function initGlobalSignals(dir) {
  dataDir = dir;
  const file = path.join(dir, 'globalSignals.json');
  try {
    if (fs.existsSync(file)) store = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    store = { items: {} };
  }
}

export function recordInteraction({ tmdbId, mediaType, title, action }) {
  if (!['like', 'dislike', 'watched'].includes(action)) return null;
  const key = signalKey({ tmdbId, mediaType, title });
  if (!key) return null;
  if (!store.items[key]) {
    store.items[key] = { like: 0, dislike: 0, watched: 0, title, tmdbId, mediaType };
  }
  store.items[key][action]++;
  persist();
  return store.items[key];
}

export function getSocialScore(item) {
  const entry = store.items[signalKey(item)];
  if (!entry) return 0;
  return (entry.like || 0) * 2 + (entry.watched || 0) - (entry.dislike || 0);
}

export function getTopLiked(limit = 20) {
  return Object.values(store.items)
    .sort((a, b) => (b.like || 0) - (a.like || 0))
    .slice(0, limit);
}
