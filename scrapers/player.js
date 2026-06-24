/* ===================================================================
   scrapers/player.js — нативный плеер HDRezka (без iframe).

   HDRezka не отдаёт встраиваемый /player/-iframe (страница фильма приходит
   с X-Frame-Options: DENY), но прямые видеопотоки доступны:
     • на странице фильма есть вызов initCDNMoviesEvents(filmId, translatorId,
       …, { streams }) — это потоки озвучки «по умолчанию»;
     • список озвучек — это <li class="b-translator__item" data-translator_id>…;
     • для переключения озвучки есть AJAX /ajax/get_cdn_series/.

   Формат `streams`: `[360p]<hls> or <mp4>,[480p]…`. Берём ПРЯМОЙ .mp4 (часть
   после « or ») — он играется обычным <video> кросс-доменно (CDN поддерживает
   Range и не требует Referer), поэтому ни прокси, ни hls.js не нужны.

   Ссылки на потоки содержат токен с коротким сроком жизни, поэтому кэшируем
   их в памяти ненадолго (30 мин). Метаданные страницы (filmId, озвучки) живут
   дольше и кэшируются отдельно (6 часов). Любая ошибка → null.
   =================================================================== */
import {
  HDREZKA_BASE,
  DEFAULT_HEADERS,
  fetchHdrezkaHtml,
  resolveHdrezkaMovie
} from '../hdrezka.js';

const PAGE_META_TTL_MS = 6 * 60 * 60 * 1000; // 6 часов (filmId/озвучки стабильны)
const STREAM_TTL_MS = 30 * 60 * 1000;        // 30 минут (токены потоков «протухают»)
const AJAX_TIMEOUT_MS = Number(process.env.HDREZKA_TIMEOUT_MS) || 5000;

const pageMetaCache = new Map(); // `${type}:${tmdbId}` → { at, data }
const streamCache = new Map();   // `${type}:${tmdbId}:${translator}` → { at, data }

function cacheGet(cache, key, ttl) {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.at < ttl) return entry.data;
  return undefined;
}

function cacheSet(cache, key, data) {
  cache.set(key, { at: Date.now(), data });
  if (cache.size > 300) cache.delete(cache.keys().next().value);
}

function unescapeSlashes(text) {
  return String(text || '').replace(/\\\//g, '/').replace(/\\"/g, '"');
}

function stripTags(html) {
  return String(html || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

// Числовой «вес» качества для сортировки (по убыванию: 1080 → 360).
function qualityWeight(label) {
  const num = Number(String(label).match(/(\d{3,4})/)?.[1] || 0);
  return /4k|2160/i.test(label) ? 2160 : num;
}

// Разбираем строку streams в массив { label, url } (берём прямой .mp4).
function parseQualities(streamsRaw) {
  const streams = unescapeSlashes(streamsRaw);
  if (!streams) return [];

  const out = [];
  const seen = new Set();
  const re = /\[([^\]]+)\]\s*([^[]+?)(?=,\[|$)/g;
  let m;
  while ((m = re.exec(streams)) !== null) {
    // Метка качества может содержать HTML (премиум «1080p Ultra» с иконкой) — чистим.
    const label = stripTags(m[1]) || m[1].trim();
    let value = m[2].trim().replace(/,+$/, '');
    if (!value) continue;

    // `<hls> or <mp4>` — берём прямой mp4 (последний сегмент после « or »).
    const parts = value.split(/\s+or\s+/);
    let url = (parts[parts.length - 1] || '').trim();
    // У некоторых записей это HLS-манифест: оставляем как есть, иначе чистим.
    url = url.replace(/:hls:manifest\.m3u8$/i, '');
    if (!/^https?:\/\//i.test(url) || seen.has(label)) continue;

    seen.add(label);
    out.push({ label, url });
  }

  out.sort((a, b) => qualityWeight(b.label) - qualityWeight(a.label));
  return out;
}

// Список озвучек со страницы фильма.
function parseVoices(html) {
  const items = html.match(/<li[^>]*class="[^"]*b-translator__item[^"]*"[^>]*>[\s\S]*?<\/li>/gi) || [];
  const voices = [];
  for (const li of items) {
    const id = li.match(/data-translator_id="(\d+)"/i)?.[1];
    if (!id) continue;
    voices.push({
      id,
      name: stripTags(li.replace(/<img[^>]*>/gi, '')) || `Озвучка ${id}`,
      active: /\bactive\b/.test(li.match(/class="([^"]*)"/i)?.[1] || ''),
      camrip: li.match(/data-camrip="(\d+)"/i)?.[1] || '0',
      ads: li.match(/data-ads="(\d+)"/i)?.[1] || '0',
      director: li.match(/data-director="(\d+)"/i)?.[1] || '0'
    });
  }
  return voices;
}

// Вызов initCDNMoviesEvents/initCDNSeriesEvents: filmId, translatorId, …, {…streams…}.
function parseCdnCall(html) {
  const call = html.match(/initCDN(?:Movies|Series)Events\(([\s\S]*?)\);/i)?.[1] || '';
  const filmId = call.match(/^\s*(\d+)/)?.[1] || null;
  const defaultTranslator = call.split(',')[1]?.trim() || null;
  const streams = call.match(/"streams":"((?:[^"\\]|\\.)*)"/)?.[1] || '';
  return { filmId, defaultTranslator, streams };
}

// AJAX-переключение озвучки: возвращает строку streams для выбранного перевода.
async function fetchTranslatorStreams(filmId, voice, pageUrl) {
  const body = new URLSearchParams({
    id: filmId,
    translator_id: voice.id,
    is_camrip: voice.camrip || '0',
    is_ads: voice.ads || '0',
    is_director: voice.director || '0',
    action: 'get_movie'
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AJAX_TIMEOUT_MS);
  try {
    const res = await fetch(`${HDREZKA_BASE}/ajax/get_cdn_series/?t=${Date.now()}`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        ...DEFAULT_HEADERS,
        'Content-Type': 'application/x-www-form-urlencoded',
        Referer: pageUrl || `${HDREZKA_BASE}/`
      },
      body: body.toString()
    });
    if (!res.ok) return '';
    const json = await res.json().catch(() => null);
    return json?.url || '';
  } catch {
    return '';
  } finally {
    clearTimeout(timer);
  }
}

// Метаданные страницы (pageUrl, filmId, озвучки, streams по умолчанию). Кэш 6ч.
async function resolvePageMeta(tmdbId, type, title, year, originalTitle) {
  const key = `${type}:${tmdbId}`;
  const cached = cacheGet(pageMetaCache, key, PAGE_META_TTL_MS);
  if (cached !== undefined) return cached;

  let meta = null;
  try {
    const resolved = await resolveHdrezkaMovie({
      title,
      year,
      matchedTitle: title,
      originalTitle
    });
    const pageUrl = resolved?.hdrezkaUrl || resolved?.url || null;
    if (pageUrl) {
      const html = await fetchHdrezkaHtml(pageUrl, { headers: { 'X-Requested-With': undefined } });
      if (html) {
        const cdn = parseCdnCall(html);
        meta = {
          pageUrl,
          filmId: cdn.filmId,
          defaultTranslator: cdn.defaultTranslator,
          defaultStreams: cdn.streams,
          voices: parseVoices(html),
          title: resolved?.title || title
        };
      }
    }
  } catch {
    meta = null;
  }

  cacheSet(pageMetaCache, key, meta);
  return meta;
}

/**
 * getPlayer — собрать данные нативного плеера HDRezka.
 * @returns {Promise<null | {
 *   title: string,
 *   voices: { id: string, name: string }[],
 *   activeVoice: string | null,
 *   qualities: { label: string, url: string }[]
 * }>}
 */
export async function getPlayer(tmdbId, type = 'movie', title = '', year = null, originalTitle = null, translatorId = null) {
  const meta = await resolvePageMeta(tmdbId, type, title, year, originalTitle);
  if (!meta || !meta.filmId) return null;

  const activeVoice = translatorId || meta.defaultTranslator || null;
  const streamKey = `${type}:${tmdbId}:${activeVoice}`;
  const cachedQualities = cacheGet(streamCache, streamKey, STREAM_TTL_MS);

  let qualities = cachedQualities;
  if (!qualities) {
    let streamsRaw = '';
    // Озвучка «по умолчанию» уже есть в HTML; для остальных — AJAX.
    if (!translatorId || String(translatorId) === String(meta.defaultTranslator)) {
      streamsRaw = meta.defaultStreams;
    }
    if (!streamsRaw) {
      const voice = meta.voices.find((v) => String(v.id) === String(activeVoice))
        || { id: activeVoice, camrip: '0', ads: '0', director: '0' };
      streamsRaw = await fetchTranslatorStreams(meta.filmId, voice, meta.pageUrl);
    }
    qualities = parseQualities(streamsRaw);
    if (qualities.length) cacheSet(streamCache, streamKey, qualities);
  }

  if (!qualities.length) return null;

  return {
    title: meta.title,
    voices: meta.voices.map((v) => ({ id: v.id, name: v.name })),
    activeVoice,
    qualities
  };
}
