/* ===================================================================
   kinogo.js — лёгкий резолвер ссылок на Kinogo (по образцу hdrezka.js).

   Цель: для страницы фильма дать ссылку «смотреть на Kinogo». Делаем
   так же, как с HDRezka — пытаемся найти прямую ссылку на страницу
   фильма через поиск сайта, а если не получилось (другой движок,
   анти-бот, недоступность зеркала) — отдаём надёжный фолбэк на
   страницу поиска Kinogo по названию.

   Домен Kinogo часто меняется, поэтому базовый адрес вынесен в
   переменную окружения KINOGO_BASE.
   =================================================================== */

import { titleSimilarity } from './tmdbMatch.js';

const KINOGO_BASE = (process.env.KINOGO_BASE || 'https://kinogo.media').replace(/\/$/, '');
const KINOGO_TIMEOUT_MS = Number(process.env.KINOGO_TIMEOUT_MS) || 2500;

const DEFAULT_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
  Referer: `${KINOGO_BASE}/`
};

function decodeHtml(text) {
  return String(text || '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&laquo;|&raquo;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Ссылка на поиск Kinogo по названию — всегда рабочий фолбэк. */
export function buildKinogoSearchUrl(query) {
  const q = encodeURIComponent(String(query || '').trim());
  return `${KINOGO_BASE}/index.php?do=search&subaction=search&q=${q}`;
}

async function fetchKinogoHtml(pathOrUrl, options = {}) {
  const url = pathOrUrl.startsWith('http')
    ? pathOrUrl
    : `${KINOGO_BASE}${pathOrUrl.startsWith('/') ? '' : '/'}${pathOrUrl}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), KINOGO_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: { ...DEFAULT_HEADERS, ...(options.headers || {}) }
    });
    if (!response.ok) return null;
    return await response.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/* DLE-движок (как у Kinogo) отдаёт результаты поиска ссылками вида
   <a href="https://.../12345-nazvanie.html">Название (2024)</a>. Берём
   все ссылки на .html-страницы внутри тела и оцениваем их по схожести
   названия и совпадению года. */
function parseSearchCandidates(html) {
  if (!html) return [];
  const out = [];
  const linkRe = /<a[^>]+href="([^"]+\.html)"[^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = linkRe.exec(html)) && out.length < 60) {
    const url = m[1];
    const text = decodeHtml(m[2].replace(/<[^>]+>/g, ' '));
    if (!text || text.length < 2) continue;
    // отсекаем служебные ссылки
    if (/index\.php|\/page\/|\/user\/|\/xfsearch\/|do=/i.test(url)) continue;
    const year = text.match(/\b(19|20)\d{2}\b/)?.[0] || null;
    const cleanTitle = text.replace(/\((19|20)\d{2}\)/g, '').replace(/\s+/g, ' ').trim();
    out.push({ url, title: cleanTitle, year });
  }
  return out;
}

function pickBestCandidate(candidates, { title, year, originalTitle }) {
  if (!candidates.length) return null;
  const targets = [title, originalTitle].filter(Boolean);
  let best = null;
  let bestScore = 0;

  for (const cand of candidates) {
    let score = 0;
    for (const t of targets) {
      score = Math.max(score, titleSimilarity(t, cand.title));
    }
    if (year && cand.year) {
      if (String(cand.year) === String(year)) score += 0.15;
      else if (Math.abs(Number(cand.year) - Number(year)) <= 1) score += 0.05;
    }
    if (score > bestScore) {
      bestScore = score;
      best = cand;
    }
  }

  // Требуем разумного совпадения, иначе лучше отдать фолбэк на поиск.
  return bestScore >= 0.5 ? best : null;
}

/**
 * resolveKinogoMovie — пытается найти прямую ссылку на страницу Kinogo.
 * Возвращает { url, source } где source = 'resolved' | 'search'.
 * Никогда не бросает исключений и не возвращает null — всегда есть
 * хотя бы ссылка на поиск.
 */
export async function resolveKinogoMovie({ title, year, originalTitle, matchedTitle } = {}) {
  const searchUrl = buildKinogoSearchUrl(matchedTitle || title || originalTitle || '');
  // Ограничиваем число сетевых попыток, чтобы не тормозить страницу фильма.
  const queries = [...new Set([title, originalTitle].filter(Boolean))].slice(0, 2);

  for (const query of queries) {
    const html = await fetchKinogoHtml(buildKinogoSearchUrl(query));
    const candidates = parseSearchCandidates(html);
    const picked = pickBestCandidate(candidates, { title, year, originalTitle });
    if (picked?.url) {
      return { url: picked.url.startsWith('http') ? picked.url : `${KINOGO_BASE}${picked.url}`, source: 'resolved' };
    }
  }

  return { url: searchUrl, source: 'search' };
}
