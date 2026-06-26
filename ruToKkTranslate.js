import crypto from 'crypto';

const KK_CHARS = /[әғқңөұүіһӘҒҚҢӨҰҮІҺ]/;
const CYRILLIC_RE = /[а-яёА-ЯЁ]/;
const MAX_CHUNK = 450;
const CACHE_TTL_MS = 14 * 24 * 60 * 60 * 1000;
const CACHE_MAX = 5000;

/** Уже похоже на казахский (есть ә, ғ, қ, …). */
export function looksKazakh(text) {
  return KK_CHARS.test(String(text || ''));
}

/** Есть кириллица (русский текст). */
export function looksCyrillic(text) {
  return CYRILLIC_RE.test(String(text || ''));
}

/** Нужен перевод en→ru: русский пустой/латиница, есть английский источник. */
export function needsEnToRuTranslation(ruText, enText) {
  const ru = String(ruText || '').trim();
  const en = String(enText || '').trim();
  if (ru && looksCyrillic(ru)) return { needed: false, text: ru };
  if (!en) return { needed: false, text: ru || '' };
  return { needed: true, text: en };
}

/** Нужен перевод ru→kk: kk пустой/русский/английский, есть русский источник. */
export function needsRuToKkTranslation(kkText, ruText) {
  const kk = String(kkText || '').trim();
  const ru = String(ruText || '').trim();
  if (kk && looksKazakh(kk)) return { needed: false, text: kk };
  if (!ru) return { needed: false, text: kk || '' };
  return { needed: true, text: ru };
}

function cacheKey(pair, text) {
  return `${pair}:${crypto.createHash('sha256').update(String(text)).digest('hex').slice(0, 24)}`;
}

function splitForTranslation(text) {
  const raw = String(text || '').trim();
  if (!raw) return [];
  if (raw.length <= MAX_CHUNK) return [raw];

  const parts = [];
  let buf = '';
  const sentences = raw.split(/(?<=[.!?…])\s+/u);
  for (const sentence of sentences) {
    const piece = buf ? `${buf} ${sentence}` : sentence;
    if (piece.length <= MAX_CHUNK) {
      buf = piece;
      continue;
    }
    if (buf) parts.push(buf);
    if (sentence.length <= MAX_CHUNK) {
      buf = sentence;
      continue;
    }
    for (let i = 0; i < sentence.length; i += MAX_CHUNK) {
      parts.push(sentence.slice(i, i + MAX_CHUNK));
    }
    buf = '';
  }
  if (buf) parts.push(buf);
  return parts.filter(Boolean);
}

async function myMemoryTranslate(text, langpair) {
  const chunks = splitForTranslation(text);
  const out = [];
  for (const chunk of chunks) {
    const url = new URL('https://api.mymemory.translated.net/get');
    url.searchParams.set('q', chunk);
    url.searchParams.set('langpair', langpair);
    const res = await fetch(url.toString());
    if (!res.ok) throw new Error(`MyMemory HTTP ${res.status}`);
    const data = await res.json();
    if (data.quotaFinished) throw new Error('MyMemory quota');
    const translated = String(data.responseData?.translatedText || '').trim();
    if (!translated || /MYMEMORY WARNING/i.test(translated) || /QUOTA/i.test(data.responseDetails || '')) {
      throw new Error(data.responseDetails || 'MyMemory empty');
    }
    if (data.responseStatus && data.responseStatus !== 200) {
      throw new Error(data.responseDetails || 'MyMemory error');
    }
    out.push(translated || chunk);
  }
  return out.join(' ');
}

async function openAiTranslate(text, targetLang, callOpenAI, apiKey) {
  const prompt = targetLang === 'kk'
    ? 'Переведи текст на казахский (қазақ тілі). Верни только перевод, без кавычек и пояснений. Имена оставляй как принято в Казахстане.'
    : 'Переведи английский текст на русский. Верни только перевод, без кавычек и пояснений. Имена оставляй как принято в России/СНГ.';
  const msg = await callOpenAI(apiKey, [
    { role: 'system', content: prompt },
    { role: 'user', content: text }
  ], false);
  return String(msg.content || '').trim() || text;
}

export function createRuToKkTranslator({ getApiKey, callOpenAI } = {}) {
  const cache = new Map();

  function getCached(pair, text) {
    const hit = cache.get(cacheKey(pair, text));
    if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.text;
    return null;
  }

  function setCached(pair, src, translated) {
    cache.set(cacheKey(pair, src), { at: Date.now(), text: translated });
    if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value);
  }

  async function translateWithPair(text, langpair, targetLang) {
    const src = String(text || '').trim();
    if (!src) return '';

    const cached = getCached(langpair, src);
    if (cached) return cached;

    let translated = src;
    try {
      translated = await myMemoryTranslate(src, langpair);
    } catch {
      const apiKey = getApiKey?.();
      if (apiKey && callOpenAI) {
        try {
          translated = await openAiTranslate(src, targetLang, callOpenAI, apiKey);
        } catch { /* оставляем исходник */ }
      }
    }

    if (translated && translated !== src) setCached(langpair, src, translated);
    return translated || src;
  }

  async function translateEnToRu(text) {
    const src = String(text || '').trim();
    if (!src || looksCyrillic(src)) return src;
    return translateWithPair(src, 'en|ru', 'ru');
  }

  async function translateRuToKk(text) {
    const src = String(text || '').trim();
    if (!src || looksKazakh(src)) return src;
    return translateWithPair(src, 'ru|kk', 'kk');
  }

  async function translateOneRuToKk(text) {
    return translateRuToKk(text);
  }

  async function translateBatch(texts, langpair = 'ru|kk') {
    const unique = [...new Set((texts || []).map((t) => String(t || '').trim()).filter(Boolean))];
    const result = new Map();
    const fn = langpair === 'en|ru' ? translateEnToRu : translateRuToKk;
    await Promise.all(unique.map(async (src) => {
      result.set(src, await fn(src));
    }));
    return result;
  }

  async function localizeBiographyRu(ruText, enText) {
    const { needed, text } = needsEnToRuTranslation(ruText, enText);
    if (!needed) return text;
    return translateEnToRu(text);
  }

  async function localizeTextRuToKk(kkText, ruText) {
    const { needed, text } = needsRuToKkTranslation(kkText, ruText);
    if (!needed) return text;
    return translateRuToKk(text);
  }

  async function localizeBiographyKk(kkText, ruText, enText) {
    let ru = String(ruText || '').trim();
    if (!ru || !looksCyrillic(ru)) {
      const enResolved = await localizeBiographyRu(ru, enText);
      ru = enResolved || ru;
    }
    return localizeTextRuToKk(kkText, ru);
  }

  return {
    looksKazakh,
    looksCyrillic,
    localizeBiographyRu,
    localizeBiographyKk,
    localizeOverview: localizeTextRuToKk,
    localizeBiography: localizeBiographyKk,
    translateOne: translateOneRuToKk,
    translateEnToRu,
    translateRuToKk,
    translateBatch
  };
}
