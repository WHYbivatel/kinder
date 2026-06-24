/* ===================================================================
   scrapers/torrentSearch.js — поиск раздач и проксирование .torrent-файлов.

   Основной источник — Rutor (https://rutor.info): открытый, без регистрации.
   Опционально поддержан Rutracker (если в .env заданы RUTRACKER_BASE и
   RUTRACKER_COOKIE), но по умолчанию используется Rutor.

   Экспортируем:
     • searchTorrents(query, type)   → массив { title, size, seeds, leechs, magnet, torrentUrl }
     • downloadTorrentFile(url)      → { buffer, contentType, filename }

   Результаты поиска кэшируются в памяти (Map, TTL 15 минут), чтобы не дёргать
   источник на каждый запрос и не словить бан по IP. Любая ошибка → [].
   =================================================================== */

const RUTOR_BASE = (process.env.RUTOR_BASE || 'https://rutor.info').replace(/\/$/, '');
const RUTRACKER_BASE = (process.env.RUTRACKER_BASE || '').replace(/\/$/, '');
const RUTRACKER_COOKIE = process.env.RUTRACKER_COOKIE || '';

const TORRENT_TIMEOUT_MS = Number(process.env.TORRENT_TIMEOUT_MS) || 6000;
const SEARCH_CACHE_TTL_MS = 15 * 60 * 1000; // 15 минут
const MAX_RESULTS = 40;

// Спуфинг заголовков «как обычный браузер» — снижает риск блокировок.
const DEFAULT_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7'
};

// ── Кэш поиска в памяти ──
const searchCache = new Map(); // key → { at, data }

function cacheGet(key) {
  const entry = searchCache.get(key);
  if (entry && Date.now() - entry.at < SEARCH_CACHE_TTL_MS) return entry.data;
  return undefined;
}

function cacheSet(key, data) {
  searchCache.set(key, { at: Date.now(), data });
  if (searchCache.size > 200) searchCache.delete(searchCache.keys().next().value);
}

function decodeEntities(text) {
  return String(text || '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripTags(html) {
  return decodeEntities(String(html || '').replace(/<[^>]+>/g, ' '));
}

function absolutize(base, url) {
  if (!url) return null;
  if (url.startsWith('//')) return `https:${url}`;
  if (url.startsWith('http')) return url;
  return `${base}${url.startsWith('/') ? '' : '/'}${url}`;
}

async function fetchHtml(url, headers = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TORRENT_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { ...DEFAULT_HEADERS, ...headers }
    });
    if (!response.ok) return null;
    return await response.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// ── Парсинг одной строки таблицы результатов Rutor ──
function parseRutorRow(row) {
  const magnet = row.match(/href=["'](magnet:\?[^"']+)["']/i)?.[1] || null;

  // Прямая ссылка на .torrent: //d.rutor.info/download/<id> либо /download/<id>.
  const rawDownload = row.match(/href=["']([^"']*\/download\/[^"']+)["']/i)?.[1] || null;
  const torrentUrl = rawDownload ? absolutize(RUTOR_BASE, rawDownload) : null;

  if (!magnet && !torrentUrl) return null;

  // Название — ссылка на страницу раздачи /torrent/<id>/<slug>.
  const titleRaw = row.match(/href=["']\/torrent\/[^"']+["'][^>]*>([\s\S]*?)<\/a>/i)?.[1];
  const title = decodeEntities(titleRaw ? titleRaw.replace(/<[^>]+>/g, '') : '');
  if (!title) return null;

  // Размер — ячейка с GB/MB/TB.
  const sizeMatch = row.match(/>\s*([\d.,]+)\s*(?:&nbsp;|\s)*\s*(TB|GB|MB|KB|ТБ|ГБ|МБ|КБ)\s*</i);
  const size = sizeMatch ? `${sizeMatch[1].replace(',', '.')} ${sizeMatch[2]}` : null;

  // Сиды (зелёный) и личи (красный).
  const seeds = Number((row.match(/class=["']green["'][^>]*>\D*(\d+)/i)?.[1]) || 0);
  const leechs = Number((row.match(/class=["']red["'][^>]*>\D*(\d+)/i)?.[1]) || 0);

  return { title, size, seeds, leechs, magnet, torrentUrl };
}

function parseRutorResults(html) {
  if (!html) return [];
  const results = [];
  // Строки результатов Rutor имеют классы gai/tum.
  const rows = html.match(/<tr class=["'](?:gai|tum)["'][\s\S]*?<\/tr>/gi) || [];
  for (const row of rows) {
    const parsed = parseRutorRow(row);
    if (parsed) results.push(parsed);
    if (results.length >= MAX_RESULTS) break;
  }
  return results;
}

async function searchRutor(query) {
  // Rutor использует path-based поиск: /search/{page}/{category}/{type}/{sort}/{query}.
  // Вариант с ?q=… отдаёт пустую страницу, поэтому строго путь.
  const url = `${RUTOR_BASE}/search/0/0/000/0/${encodeURIComponent(query)}`;
  const html = await fetchHtml(url, { Referer: `${RUTOR_BASE}/` });
  return parseRutorResults(html);
}

// ── Rutracker (опционально, по кукам) ──
function parseRutrackerResults(html) {
  if (!html) return [];
  const results = [];
  const rows = html.match(/<tr[^>]*class=["'][^"']*tCenter[^"']*["'][\s\S]*?<\/tr>/gi) || [];
  for (const row of rows) {
    const topicId = row.match(/dl\.php\?t=(\d+)/i)?.[1]
      || row.match(/viewtopic\.php\?t=(\d+)/i)?.[1];
    const titleRaw = row.match(/class=["']tt-text["'][^>]*>([\s\S]*?)<\/a>/i)?.[1]
      || row.match(/class=["']torTopic[^"']*["'][^>]*>([\s\S]*?)<\/a>/i)?.[1];
    const title = decodeEntities(titleRaw ? titleRaw.replace(/<[^>]+>/g, '') : '');
    if (!topicId || !title) continue;

    const sizeMatch = stripTags(row).match(/([\d.,]+)\s*(TB|GB|MB|KB|ТБ|ГБ|МБ|КБ)/i);
    const seeds = Number(row.match(/class=["'][^"']*seedmed[^"']*["'][^>]*>\D*(\d+)/i)?.[1] || 0);
    const leechs = Number(row.match(/class=["']leechmed["'][^>]*>\D*(\d+)/i)?.[1] || 0);

    results.push({
      title,
      size: sizeMatch ? `${sizeMatch[1].replace(',', '.')} ${sizeMatch[2]}` : null,
      seeds,
      leechs,
      magnet: null,
      torrentUrl: `${RUTRACKER_BASE}/forum/dl.php?t=${topicId}`
    });
    if (results.length >= MAX_RESULTS) break;
  }
  return results;
}

async function searchRutracker(query) {
  if (!RUTRACKER_BASE || !RUTRACKER_COOKIE) return [];
  const url = `${RUTRACKER_BASE}/forum/tracker.php?nm=${encodeURIComponent(query)}`;
  const html = await fetchHtml(url, {
    Referer: `${RUTRACKER_BASE}/forum/index.php`,
    Cookie: RUTRACKER_COOKIE
  });
  return parseRutrackerResults(html);
}

/**
 * searchTorrents — поиск раздач. По умолчанию Rutor; если он пуст и настроен
 * Rutracker — пробуем его. Результаты сортируются по числу сидов и кэшируются.
 */
export async function searchTorrents(query, type = 'movie') {
  const cleaned = String(query || '').trim();
  if (!cleaned) return [];

  const cacheKey = `${type}:${cleaned.toLowerCase()}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  let results = [];
  try {
    results = await searchRutor(cleaned);
    if (!results.length && RUTRACKER_BASE && RUTRACKER_COOKIE) {
      results = await searchRutracker(cleaned);
    }
  } catch {
    results = [];
  }

  results.sort((a, b) => (b.seeds || 0) - (a.seeds || 0));
  cacheSet(cacheKey, results);
  return results;
}

function filenameFromContentDisposition(header) {
  if (!header) return null;
  const star = header.match(/filename\*=(?:UTF-8'')?["']?([^"';]+)/i)?.[1];
  if (star) {
    try { return decodeURIComponent(star); } catch { return star; }
  }
  return header.match(/filename=["']?([^"';]+)/i)?.[1] || null;
}

function filenameFromUrl(url) {
  try {
    const pathname = new URL(url).pathname;
    const last = pathname.split('/').filter(Boolean).pop() || 'download';
    return /\.torrent$/i.test(last) ? last : `${last}.torrent`;
  } catch {
    return 'download.torrent';
  }
}

/**
 * downloadTorrentFile — проксированное скачивание .torrent от имени сервера
 * (обход CORS и проверки Referer). Возвращает буфер и метаданные файла.
 * Разрешаем только http(s)-ссылки, чтобы эндпоинт нельзя было использовать
 * как универсальный прокси к внутренним ресурсам.
 */
export async function downloadTorrentFile(torrentUrl) {
  if (!torrentUrl || !/^https?:\/\//i.test(torrentUrl)) {
    throw new Error('Некорректная ссылка на торрент');
  }

  const isRutracker = RUTRACKER_BASE && torrentUrl.startsWith(RUTRACKER_BASE);
  const headers = {
    Referer: isRutracker ? `${RUTRACKER_BASE}/` : `${RUTOR_BASE}/`
  };
  if (isRutracker && RUTRACKER_COOKIE) headers.Cookie = RUTRACKER_COOKIE;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TORRENT_TIMEOUT_MS);
  try {
    const response = await fetch(torrentUrl, {
      headers: { ...DEFAULT_HEADERS, ...headers },
      redirect: 'follow'
    });
    if (!response.ok) throw new Error(`Источник ответил ${response.status}`);

    const buffer = Buffer.from(await response.arrayBuffer());
    const filename = filenameFromContentDisposition(response.headers.get('content-disposition'))
      || filenameFromUrl(torrentUrl);

    return {
      buffer,
      contentType: 'application/x-bittorrent',
      filename: /\.torrent$/i.test(filename) ? filename : `${filename}.torrent`
    };
  } finally {
    clearTimeout(timer);
  }
}
