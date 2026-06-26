/** Проверка свободного текста для «умных подборок». */

export const COLLECTION_QUERY_GENRES = {
  'драм': 'драма', 'трилл': 'триллер', 'детектив': 'детектив', 'комед': 'комедия',
  'смешн': 'комедия', 'весёл': 'комедия', 'весел': 'комедия', 'мелодрам': 'мелодрама',
  'романт': 'мелодрама', 'любов': 'мелодрама', 'фантаст': 'фантастика', 'фэнтез': 'фэнтези',
  'боевик': 'боевик', 'экшен': 'боевик', 'криминал': 'криминал', 'ужас': 'ужасы',
  'хоррор': 'ужасы', 'семейн': 'семейный', 'приключ': 'приключения', 'мультф': 'мультфильм',
  'анимац': 'мультфильм', 'истор': 'история', 'военн': 'военный', 'музык': 'музыка',
  drama: 'драма', thriller: 'триллер', comedy: 'комедия', romance: 'мелодрама',
  horror: 'ужасы', action: 'боевик', fantasy: 'фэнтези', scifi: 'фантастика',
  'sci-fi': 'фантастика', crime: 'криминал', family: 'семейный', adventure: 'приключения',
  animated: 'мультфильм', cartoon: 'мультфильм', documentary: 'документальный'
};

const MOOD_KEYWORDS = [
  'устал', 'устала', 'скучно', 'грустн', 'весел', 'весёл', 'легк', 'лёгк', 'серьез', 'серьёз',
  'сложн', 'умн', 'туп', 'глуп', 'интересн', 'захватыва', 'динамич', 'спокойн', 'романтич',
  'страшн', 'жутк', 'ностальг', 'глубок', 'мрачн', 'светл', 'расслаб', 'напряж', 'смешн',
  'иронич', 'вечер', 'утро', 'ночь', 'выходн', 'одному', 'одна', 'вдвоем', 'вдвоём', 'парой',
  'друзья', 'компание', 'семьей', 'детям', 'коротк', 'длинн', 'долг', 'классик', 'нов', 'популяр',
  'необычн', 'твист', 'концовк', 'атмосфер', 'документальн', 'биограф', 'постапокалипс',
  'tired', 'bored', 'sad', 'funny', 'light', 'serious', 'smart', 'dumb', 'interesting',
  'relaxing', 'scary', 'romantic', 'evening', 'weekend', 'alone', 'friends', 'chill', 'intense',
  'emotional', 'twist', 'mood', 'vibe', 'feel', 'шарша', 'көңіл', 'жеңіл', 'қорқыныш', 'кеш'
];

const CONTEXT_KEYWORDS = [
  'фильм', 'кино', 'сериал', 'сериалы', 'мульт', 'мультик', 'аниме', 'картин', 'лент',
  'посмотреть', 'смотреть', 'подобрать', 'подбери', 'подскаж', 'рекоменд', 'хочу', 'надо',
  'нужно', 'ищу', 'найти', 'выбрать', 'подборк', 'movie', 'movies', 'film', 'films', 'series',
  'show', 'watch', 'recommend', 'something', 'anything', 'фильмдер', 'көргім', 'көру'
];

const PROFANITY_RE = new RegExp(
  [
    'дерьмо', 'говн', 'хуй', 'хуе', 'хуя', 'хуи', 'пизд', 'бля', 'бляд', 'еба', 'ёб', 'ебл',
    'сука', 'сукин', 'мудил', 'мраз', 'урод', 'пидор', 'педик', 'шлюх', 'сран', 'жоп', 'залуп',
    'fuck', 'shit', 'bitch', 'asshole', 'damn'
  ].join('|'),
  'i'
);

export const COLLECTION_QUERY_ERROR_KEYS = {
  empty: 'collections.inputRequired',
  too_short: 'collections.queryTooShort',
  too_long: 'collections.queryTooLong',
  profanity: 'collections.queryProfanity',
  off_topic: 'collections.queryOffTopic'
};

export function normalizeCollectionQuery(query) {
  return String(query || '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^\p{L}\p{N}\s,.!?+-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function detectCollectionGenres(query) {
  const text = normalizeCollectionQuery(query);
  const hits = new Set();
  for (const [kw, name] of Object.entries(COLLECTION_QUERY_GENRES)) {
    if (kw && text.includes(kw.replace(/ё/g, 'е'))) hits.add(name);
  }
  return [...hits];
}

function hasKeyword(text, keywords) {
  return keywords.some((kw) => text.includes(kw.replace(/ё/g, 'е')));
}

function looksLikeGibberish(text) {
  const words = text.split(/\s+/).filter((w) => w.length >= 2);
  if (!words.length) return true;
  if (words.length === 1 && words[0].length <= 3) return true;
  const lettersOnly = text.replace(/[^a-zа-яәғқңөұүіһ]/gi, '');
  if (!lettersOnly) return true;
  const vowels = (lettersOnly.match(/[aeiouyаеёиоуыэюяәөұі]/gi) || []).length;
  if (lettersOnly.length >= 5 && vowels / lettersOnly.length < 0.12) return true;
  return false;
}

export function validateCollectionQuery(query) {
  const text = normalizeCollectionQuery(query);
  if (!text) return { ok: false, code: 'empty' };
  if (text.length < 4) return { ok: false, code: 'too_short' };
  if (text.length > 300) return { ok: false, code: 'too_long' };

  const genres = detectCollectionGenres(query);
  const hasMood = hasKeyword(text, MOOD_KEYWORDS);
  const hasContext = hasKeyword(text, CONTEXT_KEYWORDS);
  const hasProfanity = PROFANITY_RE.test(text);
  const hasIntent = genres.length > 0 || hasMood || hasContext;

  if (hasProfanity && !hasIntent) {
    return { ok: false, code: 'profanity' };
  }

  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 1 && hasProfanity) {
    return { ok: false, code: 'profanity' };
  }

  if (!hasIntent || looksLikeGibberish(text)) {
    return { ok: false, code: 'off_topic' };
  }

  return { ok: true, genres };
}

export function collectionQueryErrorKey(code) {
  return COLLECTION_QUERY_ERROR_KEYS[code] || 'collections.error';
}
