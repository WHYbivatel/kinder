import fs from 'fs';
import path from 'path';

const DEFAULT_BLACKLIST = {
  genres: [],
  actors: [],
  directors: [],
  countries: [],
  excludeHorror: false,
  maxRuntime: null,
  minYear: null
};

const DEFAULT_PREFS = {
  blacklist: { ...DEFAULT_BLACKLIST },
  premiereReminders: [],
  psychTest: null,
  psychTestHistory: [],
  psychRecFeedback: [],
  visualTest: null,
  visualTestHistory: [],
  visualRecFeedback: [],
  shortVisualTests: { lastResults: {}, history: [] },
  shortVisualRecFeedback: []
};

export function getPrefsPath(dataDir, username) {
  const dir = path.join(dataDir, 'prefs');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, `${username}.json`);
}

export function loadUserPrefs(dataDir, username) {
  const filePath = getPrefsPath(dataDir, username);
  if (!fs.existsSync(filePath)) return { ...DEFAULT_PREFS, blacklist: { ...DEFAULT_BLACKLIST } };
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  return {
    ...DEFAULT_PREFS,
    ...raw,
    blacklist: { ...DEFAULT_BLACKLIST, ...(raw.blacklist || {}) },
    psychTestHistory: raw.psychTestHistory || [],
    psychRecFeedback: raw.psychRecFeedback || [],
    visualTestHistory: raw.visualTestHistory || [],
    visualRecFeedback: raw.visualRecFeedback || [],
    shortVisualTests: raw.shortVisualTests || { lastResults: {}, history: [] },
    shortVisualRecFeedback: raw.shortVisualRecFeedback || []
  };
}

export function saveUserPrefs(dataDir, username, prefs) {
  fs.writeFileSync(getPrefsPath(dataDir, username), JSON.stringify(prefs, null, 2));
}

export function buildBlacklistPrompt(blacklist) {
  if (!blacklist) return '';
  const parts = [];
  if (blacklist.genres?.length) parts.push(`Не предлагай жанры: ${blacklist.genres.join(', ')}`);
  if (blacklist.actors?.length) parts.push(`Не предлагай с актёрами: ${blacklist.actors.join(', ')}`);
  if (blacklist.directors?.length) parts.push(`Не предлагай режиссёров: ${blacklist.directors.join(', ')}`);
  if (blacklist.countries?.length) parts.push(`Не предлагай из стран: ${blacklist.countries.join(', ')}`);
  if (blacklist.excludeHorror) parts.push('Не предлагай ужасы и хоррор');
  if (blacklist.maxRuntime) parts.push(`Не предлагай длиннее ${blacklist.maxRuntime} минут`);
  if (blacklist.minYear) parts.push(`Не предлагай фильмы старше ${blacklist.minYear} года`);
  return parts.length ? `\nЧёрный список пользователя:\n${parts.join('\n')}` : '';
}

export function matchesBlacklist(item, blacklist) {
  if (!blacklist) return false;
  const genres = (item.genres || []).map((g) => g.toLowerCase());
  const title = (item.title || '').toLowerCase();
  const cast = (item.meta?.cast || '').toLowerCase();
  const director = (item.meta?.director || '').toLowerCase();
  const country = (item.meta?.country || '').toLowerCase();
  const runtime = item.meta?.runtime || 0;
  const year = parseInt(item.meta?.year, 10);

  if (blacklist.excludeHorror && genres.some((g) => /ужас|хоррор|horror/.test(g))) return true;
  if (blacklist.maxRuntime && runtime > blacklist.maxRuntime) return true;
  if (blacklist.minYear && year && year < blacklist.minYear) return true;

  const inList = (list, haystack) => list.some((x) => haystack.includes(x.toLowerCase()));

  if (inList(blacklist.genres || [], genres.join(' '))) return true;
  if (inList(blacklist.actors || [], cast + ' ' + title)) return true;
  if (inList(blacklist.directors || [], director)) return true;
  if (inList(blacklist.countries || [], country)) return true;

  return false;
}
