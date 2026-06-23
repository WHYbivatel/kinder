const STATUS_LABELS = {
  want: 'Хочу посмотреть',
  watching: 'Смотрю',
  watched: 'Посмотрел'
};

const STATUS_WORD_PATTERN = [
  'смотрю',
  'watching',
  'в\\s+процессе',
  'начал(?:а|и)?\\s+смотреть',
  'посмотрел',
  'посмотрел(?:а|и)?',
  'посмотренн(?:ые|ое|ых|ый|ым|ую)',
  'просмотрен(?:ные|ное|ных|ный|ным|ную)',
  'просмотрен',
  'досмотрел(?:а|и)?',
  'закончил(?:а|и)?\\s+смотреть',
  'watched',
  'хочу(?:\\s+посмотреть)?',
  'хочу\\s+глянуть',
  'буду\\s+смотреть',
  'на\\s+потом',
  'want'
].join('|');

const ADD_VERB_PATTERN = [
  'добав(?:ь|ить|ьте|ляй)',
  'закин(?:ь|уть|ьте)',
  'кинь',
  'занеси',
  'внеси',
  'запиши',
  'сохрани',
  'положи'
].join('|');

const DELETE_VERB_PATTERN = [
  'удали(?:ть|те)?',
  'убери(?:те|ть)?',
  'выкинь',
  'вычеркни',
  'сотри',
  'убрать'
].join('|');

const UPDATE_VERB_PATTERN = [
  'отметь',
  'пометь',
  'поставь',
  'измени',
  'обнови',
  'перенеси',
  'перемести',
  'перекинь',
  'сделай'
].join('|');

const SHOW_VERB_PATTERN = [
  'покажи(?:те)?',
  'показать',
  'выведи',
  'вывести',
  'отобрази',
  'список',
  'фильтр',
  'найди',
  'найти'
].join('|');

const INTENT_ALIAS_WORDS = {
  add: [
    'добавь', 'добавить', 'добавьте', 'добавил', 'добавила', 'добавим',
    'закинь', 'закинуть', 'занеси', 'внеси', 'запиши', 'сохрани', 'положи',
    'включи', 'докинь', 'кинь', 'засунь', 'запомни', 'впиши', 'прибавь',
    'add', 'save'
  ],
  delete: [
    'удали', 'удалить', 'удалите', 'убери', 'уберите', 'убрать', 'выкинь',
    'вычеркни', 'сотри', 'очисти', 'убрал', 'remove', 'delete'
  ],
  update: [
    'отметь', 'пометь', 'поставь', 'измени', 'обнови', 'перенеси',
    'перемести', 'перекинь', 'сделай', 'отправь', 'назначь', 'поменяй',
    'update', 'mark', 'move'
  ],
  show: [
    'покажи', 'показать', 'выведи', 'вывести', 'отобрази', 'список',
    'фильтр', 'найди', 'найти', 'поиск', 'какие', 'что', 'show', 'list',
    'find', 'search'
  ],
  stats: [
    'сколько', 'скока', 'количество', 'статистика', 'итоги', 'сводка',
    'сколька', 'стата', 'summary', 'stats', 'count'
  ],
  help: [
    'помощь', 'помоги', 'help', 'команды', 'возможности', 'умеешь',
    'можешь', 'инструкция'
  ]
};

const STATUS_ALIAS_WORDS = {
  watched: [
    'посмотрел', 'посмотрела', 'посмотрели', 'посмотрено', 'посмотренный',
    'посмотренные', 'просмотрел', 'просмотрела', 'просмотрено', 'просмотренные',
    'просмотренный', 'досмотрел', 'досмотрела', 'досмотрено', 'видел', 'видела',
    'завершил', 'завершила', 'готово', 'watched', 'finished', 'done'
  ],
  watching: [
    'смотрю', 'смотрим', 'смотреть', 'начал', 'начала', 'начали', 'процессе',
    'сейчас', 'watching', 'ongoing'
  ],
  want: [
    'хочу', 'хотел', 'хотела', 'потом', 'позже', 'планирую', 'буду',
    'посмотреть', 'глянуть', 'заценить', 'wishlist', 'want'
  ]
};

const MEDIA_ALIAS_WORDS = {
  tv: ['сериал', 'сериалы', 'сериалчик', 'шоу', 'series', 'сериальчик'],
  movie: ['фильм', 'фильмы', 'кино', 'муви', 'movie', 'film']
};

const RANDOM_ALIAS_WORDS = [
  'рандом', 'рандомный', 'рандомных', 'случайный', 'случайных', 'любой',
  'любые', 'random'
];

const POLITE_WORDS = new Set([
  'можешь', 'можно', 'давай', 'ну', 'пожалуйста', 'плиз', 'pls', 'мне',
  'ка', 'ты', 'помощник', 'ассистент', 'хочу', 'надо', 'нужно', 'сделай',
  'попробуй', 'пж', 'пожалста'
]);

const STATUS_CONNECTOR_WORDS = new Set([
  'как', 'статус', 'статусом', 'со', 'с', 'в', 'во', 'к', 'раздел',
  'разделе', 'категорию', 'категории'
]);

function normalizeLooseWord(word) {
  return String(word || '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^a-zа-я0-9]/gi, '');
}

function getWordSpans(text) {
  return [...String(text || '').matchAll(/[a-zа-яё0-9]+/gi)].map((match) => ({
    word: normalizeLooseWord(match[0]),
    raw: match[0],
    start: match.index,
    end: match.index + match[0].length
  })).filter((item) => item.word);
}

function levenshteinDistance(a, b) {
  const left = normalizeLooseWord(a);
  const right = normalizeLooseWord(b);
  if (left === right) return 0;
  if (!left || !right) return Math.max(left.length, right.length);

  const previous = Array.from({ length: right.length + 1 }, (_, i) => i);
  const current = new Array(right.length + 1);

  for (let i = 1; i <= left.length; i += 1) {
    current[0] = i;
    for (let j = 1; j <= right.length; j += 1) {
      const cost = left[i - 1] === right[j - 1] ? 0 : 1;
      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + cost
      );
    }
    previous.splice(0, previous.length, ...current);
  }

  return previous[right.length];
}

function maxFuzzyDistance(a, b) {
  const length = Math.max(normalizeLooseWord(a).length, normalizeLooseWord(b).length);
  if (length <= 3) return 0;
  if (length <= 5) return 1;
  if (length <= 8) return 2;
  return 3;
}

function looseWordEquals(word, alias) {
  const w = normalizeLooseWord(word);
  const a = normalizeLooseWord(alias);
  if (!w || !a) return false;
  if (w === a) return true;
  if (w.length >= 5 && a.length >= 5 && (w.startsWith(a.slice(0, 5)) || a.startsWith(w.slice(0, 5)))) {
    return true;
  }
  return levenshteinDistance(w, a) <= maxFuzzyDistance(w, a);
}

function hasLooseWord(text, aliases) {
  return getWordSpans(text).some((item) => aliases.some((alias) => looseWordEquals(item.word, alias)));
}

// Слова-носители типа («фильм», «сериал», «кино»…) — это существительные,
// а не глаголы-команды. Их нельзя матчить как интент-глагол, иначе «фильм»
// по нечёткому сравнению цепляется к «фильтр» (show) и запрос на подборку
// «посоветуй фильм …» ошибочно превращается в «покажи весь список».
const MEDIA_INTENT_BLOCK = new Set(
  [...MEDIA_ALIAS_WORDS.tv, ...MEDIA_ALIAS_WORDS.movie].map(normalizeLooseWord)
);

function findLooseWord(text, aliases, options = {}) {
  const words = getWordSpans(text);
  const maxIndex = options.maxIndex ?? words.length - 1;
  return words.find((item, index) => (
    index <= maxIndex
    && !POLITE_WORDS.has(item.word)
    && !MEDIA_INTENT_BLOCK.has(item.word)
    && aliases.some((alias) => looseWordEquals(item.word, alias))
  )) || null;
}

function stripKnownLeadIn(text) {
  return String(text || '')
    .replace(/^(?:хочу|надо|нужно|можешь|можно|давай|пожалуйста|плиз|pls|сделай|помоги)\s+(?:мне\s+)?(?:чтобы\s+ты\s+)?/i, '')
    .replace(/^(?:ты\s+)?(?:можешь|сможешь)\s+(?:мне\s+)?/i, '')
    .trim();
}

function stripListLeadIn(text) {
  return String(text || '')
    .replace(/^(?:в\s+)?(?:мой\s+)?(?:список|коллекцию|вишлист|wishlist)\s*/i, '')
    .replace(/^(?:к\s+себе|мне)\s+/i, '')
    .trim();
}

function findIntentPayload(text, intent, options = {}) {
  const original = String(text || '').trim();
  const source = stripKnownLeadIn(original);
  const aliases = INTENT_ALIAS_WORDS[intent] || [];
  const exactPattern = {
    add: ADD_VERB_PATTERN,
    delete: DELETE_VERB_PATTERN,
    update: UPDATE_VERB_PATTERN,
    show: SHOW_VERB_PATTERN
  }[intent];

  if (exactPattern) {
    const listAlternatives = intent === 'add' ? '|в\\s+список|в\\s+коллекцию|в\\s+вишлист' : '';
    const exact = source.match(new RegExp(`(?:^|\\s)(?:${exactPattern}${listAlternatives})[\\s:,-]+(.+)`, 'i'));
    if (exact?.[1]) return cleanCommandPayload(exact[1]);
  }

  if (intent === 'add') {
    const wantToWatch = original.match(/^(?:хочу|хотел(?:а)?\s+бы|планирую|буду)\s+(?:посмотреть|глянуть|заценить)\s+(.+)$/i)
      || source.match(/^(?:посмотреть|глянуть|заценить)\s+(.+)$/i);
    if (wantToWatch?.[1]) return cleanCommandPayload(wantToWatch[1]);

    const listOnly = source.match(/^(?:в\s+)?(?:мой\s+)?(?:список|коллекцию|вишлист|wishlist)[\s:,-]+(.+)$/i);
    if (listOnly?.[1]) return cleanCommandPayload(listOnly[1]);
  }

  const match = findLooseWord(source, aliases, { maxIndex: options.maxIntentIndex ?? 7 });
  if (!match) return null;

  const before = source.slice(0, match.start).trim();
  if (before && before.length > 40 && !/^(?:хочу|надо|нужно|можешь|можно|давай|пожалуйста|плиз|pls|ты|мне|\s)+$/i.test(before)) {
    return null;
  }

  return cleanCommandPayload(stripListLeadIn(source.slice(match.end)));
}

function statusFromPhrase(phrase) {
  const p = String(phrase || '').toLowerCase();
  if (/просмотрен|просмотренн|посмотрел|посмотрела|досмотрел|закончил|watched/.test(p)) return 'watched';
  if (/смотрю|в\s+процессе|начал|начала|watching/.test(p)) return 'watching';
  if (/хочу|буду\s+смотреть|на\s+потом|want/.test(p)) return 'want';
  if (hasLooseWord(p, STATUS_ALIAS_WORDS.watched)) return 'watched';
  if (hasLooseWord(p, STATUS_ALIAS_WORDS.watching)) return 'watching';
  if (hasLooseWord(p, STATUS_ALIAS_WORDS.want)) return 'want';
  return 'want';
}

function detectStatus(text) {
  return statusFromPhrase(text);
}

function isStatusWord(text) {
  const t = String(text || '').trim().toLowerCase();
  return new RegExp(`^(?:${STATUS_WORD_PATTERN})$`, 'i').test(t);
}

function normalizeCommandText(text) {
  return String(text || '')
    .replace(/ё/g, 'е')
    .replace(/[!?]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanCommandPayload(text) {
  return String(text || '')
    .replace(/^(?:ка|мне|пожалуйста|пожалуста|пожалста|плиз|пж|pls|к\s+себе|в\s+мой\s+список|в\s+список|в\s+коллекцию)\s+/i, '')
    .replace(/^(?:еще|ещё|также)\s+/i, '')
    .trim();
}

function buildRatingAskReply(titles, verb = 'Добавлю') {
  const unique = [...new Set(titles.filter(Boolean))];
  if (unique.length === 1) {
    return `${verb} «${unique[0]}» в «Посмотрел». Какую оценку поставить от 1 до 10?`;
  }
  return `${verb} ${unique.map((t) => `«${t}»`).join(', ')} в «Посмотрел». Укажите оценку от 1 до 10.`;
}

function extractTitleBeforeStatusSuffix(block) {
  const raw = String(block).trim();
  const patterns = [
    /^(.+?)\s+(?:со|с)\s+статус(?:ом)?\s+/i,
    /^(.+?)\s+(?:в|во|к)\s+(?:раздел\s+|категори(?:ю|я)\s+)?(?:просмотренн[а-яa-z]*|посмотренн[а-яa-z]*|смотрю|хочу\s+(?:посмотреть|глянуть)|на\s+потом)(?:\s|$)/i,
    /^(.+?)\s+как\s+(?:посмотрел[а-яa-z]*|посмотренн[а-яa-z]*|просмотрен[а-яa-z]*|досмотрел[а-яa-z]*|watched|смотрю|watching|хочу(?:\s+(?:посмотреть|глянуть))?|want)(?:\s|$)/i
  ];

  for (const pattern of patterns) {
    const match = raw.match(pattern);
    if (match?.[1]?.trim()) {
      return match[1].trim();
    }
  }

  return null;
}

function splitTitles(raw) {
  return raw
    .split(/[,;\n]|(?:\s+и\s+)/i)
    .map((t) => t.trim())
    .filter(Boolean);
}

function extractQuotedStrings(text) {
  const results = [];
  for (const match of String(text).matchAll(/«([^»]+)»/g)) results.push(match[1].trim());
  for (const match of String(text).matchAll(/"([^"]+)"/g)) results.push(match[1].trim());
  for (const match of String(text).matchAll(/'([^']+)'/g)) results.push(match[1].trim());
  return results;
}

function detectStatusFromText(text) {
  const raw = String(text);
  const lower = raw.toLowerCase();

  const withStatusWord = raw.match(
    new RegExp(`(?:со|с)\\s+статус(?:ом)?\\s*["«']?(${STATUS_WORD_PATTERN})["»']?`, 'i')
  );
  if (withStatusWord) return statusFromPhrase(withStatusWord[1]);

  const inCategory = raw.match(
    /(?:^|\s)(?:в|во|к)\s+(?:раздел\s+|категори(?:ю|я)\s+)?(просмотренн[а-яa-z]*|посмотренн[а-яa-z]*|смотрю|хочу\s+(?:посмотреть|глянуть)|на\s+потом)/i
  );
  if (inCategory) return statusFromPhrase(inCategory[1]);

  const asWord = raw.match(
    new RegExp(`(?:^|\\s)как\\s*["«']?(${STATUS_WORD_PATTERN})["»']?`, 'i')
  );
  if (asWord) return statusFromPhrase(asWord[1]);

  if (/(?:^|\s|,)(?:в|во)\s+просмотрен/i.test(lower)) return 'watched';
  if (/(?:^|\s)(?:просмотренн|посмотренн|просмотрен|досмотрел|посмотрел)[а-яa-z]*(?:\s|$)/i.test(lower) && !/хочу\s+(?:посмотреть|глянуть)/i.test(lower)) return 'watched';
  if (/(?:^|\s)(?:уже\s+смотрел|уже\s+видел|видел)(?:\s|$)/i.test(lower) && !/хочу\s+(?:посмотреть|глянуть)/i.test(lower)) return 'watched';

  if (/(?:^|\s)(?:смотрю|начал[а-яa-z]*\s+смотреть|в\s+процессе)(?:\s|$)/i.test(lower) && !/просмотрен/i.test(lower)) return 'watching';
  if (/(?:хочу\s+(?:посмотреть|глянуть)|буду\s+смотреть|на\s+потом)/i.test(lower)) return 'want';

  if (hasLooseWord(raw, STATUS_ALIAS_WORDS.watched) && !/хочу\s+(?:посмотреть|глянуть)/i.test(lower)) return 'watched';
  if (hasLooseWord(raw, STATUS_ALIAS_WORDS.watching) && !/просмотрен/i.test(lower)) return 'watching';
  if (hasLooseWord(raw, STATUS_ALIAS_WORDS.want)) return 'want';

  return null;
}

function parseExplicitStatus(text) {
  return detectStatusFromText(text) || 'want';
}

function stripAddModifiers(text) {
  const statusClause = new RegExp(
    `(?:,\\s*)?(?:со|с)\\s+статус(?:ом)?\\s*["«']?${STATUS_WORD_PATTERN}["»']?`,
    'gi'
  );
  const asStatusClause = new RegExp(
    `(?:,\\s*)?как\\s*["«']?${STATUS_WORD_PATTERN}["»']?(?:\\s+\\d{1,2}(?:\\s*\\/\\s*10)?)?`,
    'gi'
  );
  const inCategoryClause = /(?:^|\s|,)(?:в|во|к)\s+(?:раздел\s+|категори(?:ю|я)\s+)?(?:просмотренн[а-яa-z]*|посмотренн[а-яa-z]*|смотрю|хочу\s+(?:посмотреть|глянуть)|на\s+потом)/gi;
  const trailingCategory = /\s+(?:в|во|к)\s+(?:раздел\s+|категори(?:ю|я)\s+)?(?:просмотренн[а-яa-z]*|посмотренн[а-яa-z]*|смотрю|хочу\s+(?:посмотреть|глянуть)|на\s+потом)(?=\s|$|[,.])/gi;
  const trailingAsStatus = /\s+как\s+(?:посмотрел[а-яa-z]*|посмотренн[а-яa-z]*|просмотрен[а-яa-z]*|досмотрел[а-яa-z]*|watched|смотрю|watching|хочу(?:\s+(?:посмотреть|глянуть))?|want)(?:\s+\d{1,2}(?:\s*\/\s*10)?)?(?=\s|$|[,.])/gi;

  return String(text)
    .replace(statusClause, '')
    .replace(asStatusClause, '')
    .replace(inCategoryClause, '')
    .replace(trailingCategory, '')
    .replace(trailingAsStatus, '')
    .replace(/\s+(?:уже\s+)?(?:смотрел|видел|досмотрел)(?:а|и)?(?=\s|$|[,.])/gi, '')
    .replace(/\s+(?:с|со)\s+оценк(?:ой|а)\s+\d{1,2}(?:\s*\/\s*10)?/gi, '')
    .replace(/\s+\d{1,2}(?:\s*\/\s*10)?\s*$/i, '')
    .replace(/\s+и\s+хочу\s+.*$/i, '')
    .replace(/\s+и\s+добав(?:ь|ить|ил|лен).*$/i, '')
    .replace(/\s+(?:чтобы|чтоб)\s+.*$/i, '')
    .trim();
}

function stripFlexibleStatusPhrases(text) {
  const raw = String(text || '');
  const spans = getWordSpans(raw);
  const ranges = [];

  spans.forEach((span, index) => {
    const statusAliases = [
      ...STATUS_ALIAS_WORDS.watched,
      ...STATUS_ALIAS_WORDS.watching,
      ...STATUS_ALIAS_WORDS.want
    ];
    if (!statusAliases.some((alias) => looseWordEquals(span.word, alias))) return;

    let start = span.start;
    let end = span.end;
    const previous = spans[index - 1];
    const beforePrevious = spans[index - 2];
    if (previous && STATUS_CONNECTOR_WORDS.has(previous.word)) start = previous.start;
    if (beforePrevious && previous && beforePrevious.word === 'со' && previous.word === 'статусом') {
      start = beforePrevious.start;
    }

    const next = spans[index + 1];
    if (next && /^\d{1,2}$/.test(next.word)) end = next.end;
    ranges.push([start, end]);
  });

  if (!ranges.length) return raw.trim();

  let result = '';
  let cursor = 0;
  ranges.sort((a, b) => a[0] - b[0]).forEach(([start, end]) => {
    if (start < cursor) return;
    result += raw.slice(cursor, start);
    cursor = end;
  });
  result += raw.slice(cursor);

  return result
    .replace(/\s+(?:оценк[аи]|рейтинг|балл[а-яa-z]*).*/i, '')
    .replace(/\s+\d{1,2}(?:\s*\/\s*10)?\s*$/i, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([,.])/g, '$1')
    .trim();
}

function extractAddTitles(block) {
  const quoted = extractQuotedStrings(block).filter((title) => title && !isStatusWord(title));
  if (quoted.length) {
    const findFilm = block.match(/(?:найди|найти|наш(?:ел|ёл|ла|ло))\s+(?:фильм\s+)?["«']?([^"»']+?)["»']?(?:\s+и\s+|\s+со\s+статус|$)/i);
    if (findFilm?.[1]) {
      const fromFind = findFilm[1].trim();
      if (fromFind && !isStatusWord(fromFind)) return [fromFind];
    }
    return [quoted[quoted.length - 1]];
  }

  const titleBeforeStatus = extractTitleBeforeStatusSuffix(block);
  if (titleBeforeStatus) {
    return splitTitles(titleBeforeStatus).map((title) => title.trim()).filter(Boolean);
  }

  const cleaned = stripFlexibleStatusPhrases(stripAddModifiers(block));
  return splitTitles(cleaned.replace(/^(?:в\s+)?(?:хочу\s+посмотреть|список)[:\s]*/i, ''))
    .map((title) => title.trim())
    .filter(Boolean);
}

function isBulkMetaTitle(title) {
  const t = String(title || '').toLowerCase().trim();
  return /^\d+\s+(?:рандом|случайн|random)/.test(t)
    || /(?:рандом|случайн|random).*(?:фильм|сериал)/.test(t)
    || /^(?:рандом|случайн|random)\s+(?:фильм|сериал)/.test(t);
}

function detectMediaTypeFromText(text) {
  const lower = String(text).toLowerCase();
  if (/(?:сериал|сериалы|сериальчик|шоу|series|тв[\s-]?шоу|tv\s*show)/i.test(lower)) return 'tv';
  if (/(?:^|\s)(?:фильм|фильмы|кино|муви)(?:\s|$|[,.])/i.test(lower) && !/сериал/i.test(lower)) return 'movie';
  if (hasLooseWord(lower, MEDIA_ALIAS_WORDS.tv)) return 'tv';
  if (hasLooseWord(lower, MEDIA_ALIAS_WORDS.movie) && !hasLooseWord(lower, MEDIA_ALIAS_WORDS.tv)) return 'movie';
  return null;
}

function stripMediaTypeWords(text) {
  const exact = String(text || '')
    .replace(/^(?:сериал|сериалы|сериальчик|фильм|фильмы|кино|муви)\s+/i, '')
    .replace(/\s+(?:сериал|сериалы|сериальчик|фильм|фильмы|кино|муви)$/i, '')
    .trim();
  const spans = getWordSpans(exact);
  if (spans.length <= 1) return exact;
  const first = spans[0];
  const last = spans[spans.length - 1];
  if ([...MEDIA_ALIAS_WORDS.tv, ...MEDIA_ALIAS_WORDS.movie].some((alias) => looseWordEquals(first.word, alias))) {
    return exact.slice(first.end).trim();
  }
  if ([...MEDIA_ALIAS_WORDS.tv, ...MEDIA_ALIAS_WORDS.movie].some((alias) => looseWordEquals(last.word, alias))) {
    return exact.slice(0, last.start).trim();
  }
  return exact;
}

function mediaLabel(mediaType, count = 1) {
  if (mediaType === 'tv') return count === 1 ? 'сериал' : 'сериалов';
  return count === 1 ? 'фильм' : 'фильмов';
}

function extractRandomCount(text) {
  const lower = String(text).toLowerCase();
  if (/\bнесколько\b/.test(lower)) return 5;
  if (/\bпару\b/.test(lower)) return 2;
  if (/\bпарочку\b/.test(lower)) return 3;

  const m = lower.match(/(\d+)\s*(?:рандом|случайн|любы|random)/i)
    || lower.match(/(?:рандом|случайн|любы|random)[а-яa-z]*\s+(\d+)/i)
    || lower.match(new RegExp(`(?:${ADD_VERB_PATTERN})\\s+(\\d+)`, 'i'))
    || lower.match(/(\d+)\s+(?:фильм|сериал|сериалов|сериала|сериалы)/i);
  if (m) return Math.min(50, Math.max(1, parseInt(m[1], 10)));
  return 10;
}

function parseRandomAddCommand(text) {
  const lower = String(text).toLowerCase();
  const isRandom = /(?:рандом|случайн|любы|random)/i.test(lower) || hasLooseWord(lower, RANDOM_ALIAS_WORDS);

  if (!isRandom) return null;

  const count = extractRandomCount(text);
  const randomRating = /рандомн[а-яa-z]*\s+оценк|случайн[а-яa-z]*\s+оценк|любы[а-яa-z]*\s+оценк|random\s+rat|(?:поставь|поставить)\s+(?:рандом|случайн|любы)/i.test(lower)
    || (/оценк/.test(lower) && /(?:рандом|случайн|любы|random)/.test(lower));
  let fixedRating = extractRating(text);
  if (randomRating) fixedRating = null;
  let status = detectStatusFromText(text) || 'want';
  if (randomRating || /просмотрен|посмотрел/i.test(lower)) status = 'watched';
  const mediaType = detectMediaTypeFromText(text) || 'movie';
  const mediaLabel = mediaType === 'tv' ? 'сериалов' : 'фильмов';

  if (status === 'watched' && !randomRating && fixedRating === null) {
    return {
      reply: `Добавлю ${count} случайных ${mediaLabel} в «Посмотрел». Укажите оценку от 1 до 10 или напишите «с рандомными оценками».`,
      actions: []
    };
  }

  const ratingNote = randomRating
    ? ' со случайными оценками'
    : fixedRating !== null ? `, оценка ${fixedRating}/10` : '';
  const tabHint = mediaType === 'tv' ? ' Смотрите вкладку «Сериалы».' : '';

  return {
    reply: `Добавляю ${count} случайных ${mediaLabel} в «${STATUS_LABELS[status]}»${ratingNote}.${tabHint}`,
    actions: [{
      type: 'add_random_movies',
      count,
      status,
      randomRating: randomRating || (status === 'watched' && fixedRating === null && isRandom),
      rating: fixedRating ?? null,
      mediaType
    }]
  };
}

function parseAddCommand(block) {
  const cleanedBlock = cleanCommandPayload(block);
  const randomFirst = parseRandomAddCommand(cleanedBlock);
  if (randomFirst) return randomFirst;

  const status = parseExplicitStatus(cleanedBlock);
  const mediaType = detectMediaTypeFromText(cleanedBlock) || 'movie';
  const titles = extractAddTitles(cleanedBlock).map((t) => stripMediaTypeWords(t)).filter(Boolean);
  if (!titles.length) return null;
  if (titles.every(isBulkMetaTitle)) return null;

  let rating = status === 'watched' ? extractRating(cleanedBlock) : null;
  if (rating === null && status === 'watched') {
    const trailing = cleanedBlock.match(/(?:посмотрел[а-яa-z]*|просмотрен[а-яa-z]*|досмотрел[а-яa-z]*|watched)\s+(\d{1,2})(?:\s*\/\s*10)?/i);
    if (trailing) {
      const value = Number(trailing[1]);
      if (value >= 1 && value <= 10) rating = value;
    }
  }

  const action = { type: 'add_movies', titles, status, mediaType };
  if (rating !== null) action.rating = rating;

  if (status === 'watched' && rating === null) {
    return {
      reply: buildRatingAskReply(titles, 'Добавлю'),
      actions: []
    };
  }

  const label = mediaLabel(mediaType, titles.length);
  const ratingNote = rating !== null ? `, оценка ${rating}/10` : '';
  const tabHint = mediaType === 'tv' ? ' Смотрите вкладку «Сериалы».' : '';
  return {
    reply: titles.length === 1
      ? `Добавляю «${titles[0]}» (${label}) в «${STATUS_LABELS[status]}»${ratingNote}.${tabHint}`
      : `Добавляю ${titles.length} ${label} в «${STATUS_LABELS[status]}»${ratingNote}.${tabHint}`,
    actions: [action]
  };
}

function extractRating(text) {
  const raw = String(text);
  const nearRating = raw.match(
    /(?:оценк[аи]|рейтинг|балл[а-яa-z]*).{0,25}?(\d{1,2})(?:\s*\/\s*10)?/i
  ) || raw.match(/(\d{1,2})(?:\s*\/\s*10)?(?=.{0,20}(?:оценк|рейтинг|балл))/i);
  if (nearRating) {
    const value = Number(nearRating[1]);
    if (value >= 1 && value <= 10) return value;
  }

  const match = raw.match(/(?:оценк[аи]|рейтинг|на)\s*(\d{1,2})(?:\s*\/\s*10)?/i)
    || raw.match(/(?:с|со)\s+оценк(?:ой|а)\s*(\d{1,2})(?:\s*\/\s*10)?/i)
    || raw.match(/\b(\d{1,2})\s*\/\s*10\b/);
  if (!match) {
    const trailing = raw.match(/\b(\d{1,2})(?:\s*\/\s*10)?\s*$/);
    if (trailing && detectStatusFromText(raw) === 'watched') {
      const value = Number(trailing[1]);
      return value >= 1 && value <= 10 ? value : null;
    }
    return null;
  }
  const value = Number(match[1]);
  return value >= 1 && value <= 10 ? value : null;
}

function stripIntentVerb(text, pattern) {
  return String(text || '')
    .replace(new RegExp(`^(?:можешь|можно|давай|ну|пожалуйста|плиз|pls)?\\s*(?:${pattern})[\\s:,-]*`, 'i'), '')
    .replace(new RegExp(`^(?:можешь|можно|давай|ну|пожалуйста|плиз|pls)\\s+(?:${pattern})[\\s:,-]*`, 'i'), '')
    .trim();
}

function parseFlexibleUpdateCommand(text) {
  const fuzzyPayload = findIntentPayload(text, 'update');
  const raw = cleanCommandPayload(fuzzyPayload || stripIntentVerb(text, UPDATE_VERB_PATTERN));
  const status = detectStatusFromText(raw);
  if (!status || (!fuzzyPayload && raw === text)) return null;

  const rating = extractRating(raw);
  const mediaType = detectMediaTypeFromText(raw);
  const title = stripMediaTypeWords(stripFlexibleStatusPhrases(stripAddModifiers(raw)))
    .replace(/\s+(?:оценк[аи]|рейтинг|балл[а-яa-z]*).*/i, '')
    .replace(/\s+(?:в|во|к)$/i, '')
    .trim();

  if (!title) return null;
  if (status === 'watched' && rating === null) {
    return {
      reply: buildRatingAskReply([title], 'Обновлю'),
      actions: []
    };
  }

  const action = { type: 'update_movie', title, status };
  if (mediaType) action.mediaType = mediaType;
  if (rating !== null && status !== 'want') action.rating = rating;
  return {
    reply: `Обновляю «${title}»: ${STATUS_LABELS[status]}${rating ? `, оценка ${rating}/10` : ''}.`,
    actions: [action]
  };
}

function filterMovies(movies, query) {
  let list = [...movies];
  const lower = query.toLowerCase();

  if ((/сериал/i.test(lower) || hasLooseWord(lower, MEDIA_ALIAS_WORDS.tv)) && !/(?:фильм|кино)/i.test(lower)) {
    list = list.filter((m) => m.mediaType === 'tv');
  } else if ((/(?:фильм|кино)/i.test(lower) || hasLooseWord(lower, MEDIA_ALIAS_WORDS.movie)) && !/сериал/i.test(lower)) {
    list = list.filter((m) => (m.mediaType || 'movie') === 'movie');
  }

  const fuzzyStatus = detectStatusFromText(query);
  if (/хочу\s+посмотреть|\bwant\b/.test(lower) || fuzzyStatus === 'want') {
    list = list.filter((m) => m.status === 'want');
  } else if (/смотрю|\bwatching\b/.test(lower) || fuzzyStatus === 'watching') {
    list = list.filter((m) => m.status === 'watching');
  } else if (/посмотрел|просмотрен|просмотренн|\bwatched\b/.test(lower) || fuzzyStatus === 'watched') {
    list = list.filter((m) => m.status === 'watched');
  }

  const genreMatch = lower.match(/(?:жанр[уа]?|жанры)\s+(.+?)(?:$|,|\.)/i)
    || lower.match(/(?:триллер|комеди|драм|ужас|фантаст|боевик|мелодрам|детектив|аним)/i);
  if (genreMatch) {
    const genre = (genreMatch[1] || genreMatch[0]).trim().toLowerCase();
    list = list.filter((m) =>
      m.genres.some((g) => g.toLowerCase().includes(genre))
      || m.tags.some((t) => t.toLowerCase().includes(genre))
    );
  }

  const highRated = /высок.*оцен|лучш|топ/i.test(lower);
  if (highRated) {
    list = list.filter((m) => m.rating && m.rating >= 8);
  }

  return list;
}

function formatMovieList(movies) {
  if (movies.length === 0) return 'Ничего не найдено по этому запросу.';
  return movies.map((m) => {
    const parts = [`• ${m.title}`];
    if (m.mediaType === 'tv') parts.push('(сериал)');
    parts.push(`(${STATUS_LABELS[m.status] || m.status})`);
    if (m.rating) parts.push(`— ${m.rating}/10`);
    if (m.genres?.length) parts.push(`[${m.genres.join(', ')}]`);
    return parts.join(' ');
  }).join('\n');
}

export function parseLocalChat(text, movies) {
  const trimmed = normalizeCommandText(text);

  if (/^(?:помощь|help|что\s+ты\s+умеешь|команды|что\s+можешь)/i.test(trimmed)
    || findLooseWord(trimmed, INTENT_ALIAS_WORDS.help, { maxIndex: 4 })) {
    return {
      reply: `Локальный режим (без OpenAI). Команды:
• «Добавь Интерстеллар» — по умолчанию в «Хочу посмотреть»
• «Закинь / занеси / сохрани Матрица»
• «Добавь Ужасающий со статусом смотрю»
• «Добавь Матрица в просмотренные с оценкой 9»
• «Удали / убери / вычеркни Матрица»
• «Отметь / перенеси / пометь Форрест Гамп как посмотрел 8»
• «Добавь 15 рандомных фильмов в просмотренные с рандомными оценками»
• «Добавь 10 рандомных сериалов в просмотренные с рандомными оценками»
• «Добавь несколько случайных сериалов в просмотренные»
• «Добавь сериал Шерлок» / «Добавь Игру престолов в просмотренные с оценкой 9»
• «Покажи сериалы которые хочу посмотреть»
• «Сколько фильмов в списке?»`
    };
  }

  if (/^(?:сколько|скока|количество|статистика|итоги|сводка)/i.test(trimmed)
    || findLooseWord(trimmed, INTENT_ALIAS_WORDS.stats, { maxIndex: 4 })) {
    const films = movies.filter((m) => (m.mediaType || 'movie') === 'movie');
    const series = movies.filter((m) => m.mediaType === 'tv');
    const fmt = (list, label) => {
      const want = list.filter((m) => m.status === 'want').length;
      const watching = list.filter((m) => m.status === 'watching').length;
      const watched = list.filter((m) => m.status === 'watched').length;
      return `${label}: ${list.length} (${want} хочу, ${watching} смотрю, ${watched} посмотрел)`;
    };
    return {
      reply: `${fmt(films, 'Фильмы')}\n${fmt(series, 'Сериалы')}`
    };
  }

  const randomParsed = parseRandomAddCommand(trimmed);
  if (randomParsed) return randomParsed;

  const addMatch = trimmed.match(
    new RegExp(`(?:^|\\s)(?:можешь\\s+|можно\\s+|давай\\s+)?(?:${ADD_VERB_PATTERN}|в\\s+список)(?:\\s+(?:мне|пожалуйста|плиз|pls|к\\s+себе|в\\s+мой\\s+список|в\\s+список|в\\s+коллекцию))*[:\\s,-]+(.+)`, 'i')
  );
  if (addMatch) {
    const parsed = parseAddCommand(addMatch[1]);
    if (parsed) return parsed;
  }
  const fuzzyAddPayload = findIntentPayload(trimmed, 'add');
  if (fuzzyAddPayload) {
    const parsed = parseAddCommand(fuzzyAddPayload);
    if (parsed) return parsed;
  }

  const deleteMatch = trimmed.match(new RegExp(`(?:^|\\s)(?:${DELETE_VERB_PATTERN})[\\s:,-]+(.+)`, 'i'));
  if (deleteMatch) {
    const raw = cleanCommandPayload(deleteMatch[1].trim());
    const mediaType = detectMediaTypeFromText(raw);
    const title = stripMediaTypeWords(raw);
    const action = { type: 'delete_movie', title };
    if (mediaType) action.mediaType = mediaType;
    const label = mediaType === 'tv' ? 'сериал' : 'фильм';
    return {
      reply: `Удаляю ${label} «${title}».`,
      actions: [action]
    };
  }
  const fuzzyDeletePayload = findIntentPayload(trimmed, 'delete');
  if (fuzzyDeletePayload) {
    const raw = cleanCommandPayload(fuzzyDeletePayload);
    const mediaType = detectMediaTypeFromText(raw);
    const title = stripMediaTypeWords(raw);
    if (title) {
      const action = { type: 'delete_movie', title };
      if (mediaType) action.mediaType = mediaType;
      const label = mediaType === 'tv' ? 'сериал' : 'фильм';
      return {
        reply: `Удаляю ${label} «${title}».`,
        actions: [action]
      };
    }
  }

  const flexibleUpdate = parseFlexibleUpdateCommand(trimmed);
  if (flexibleUpdate) return flexibleUpdate;

  const updateMatch = trimmed.match(
    new RegExp(`^(?:${UPDATE_VERB_PATTERN})\\s+(.+?)\\s+(?:как\\s+)?(${STATUS_WORD_PATTERN})(?:\\s+(.+))?$`, 'i')
  );
  if (updateMatch) {
    const rawTitle = updateMatch[1].trim();
    const mediaType = detectMediaTypeFromText(rawTitle);
    const title = stripMediaTypeWords(rawTitle);
    const status = detectStatus(updateMatch[2]);
    const rating = extractRating(updateMatch[3] || trimmed);
    if (status === 'watched' && rating === null) {
      return {
        reply: buildRatingAskReply([title], 'Обновлю'),
        actions: []
      };
    }
    const action = { type: 'update_movie', title, status };
    if (mediaType) action.mediaType = mediaType;
    if (rating !== null && status !== 'want') action.rating = rating;
    return {
      reply: `Обновляю «${title}»: ${STATUS_LABELS[status]}${rating ? `, оценка ${rating}/10` : ''}.`,
      actions: [action]
    };
  }

  const showMatch = trimmed.match(new RegExp(`^(?:${SHOW_VERB_PATTERN})\\s*(.*)$`, 'i'))
    || trimmed.match(/^(?:что\s+у\s+меня|какие\s+у\s+меня)\s*(.*)$/i);
  if (showMatch) {
    const query = showMatch[1] || trimmed;
    const filtered = filterMovies(movies, query);
    return {
      reply: filtered.length
        ? `Найдено ${filtered.length}:\n${formatMovieList(filtered)}`
        : 'Ничего не найдено. Попробуйте «покажи что хочу посмотреть» или «покажи посмотренные».'
    };
  }
  const fuzzyShowPayload = findIntentPayload(trimmed, 'show', { maxIntentIndex: 5 });
  if (fuzzyShowPayload !== null) {
    const query = fuzzyShowPayload || trimmed;
    const filtered = filterMovies(movies, query);
    return {
      reply: filtered.length
        ? `Найдено ${filtered.length}:\n${formatMovieList(filtered)}`
        : 'Ничего не найдено. Попробуйте «покажи что хочу посмотреть» или «покажи посмотренные».'
    };
  }

  return null;
}

export function validateChatActions(actions) {
  const valid = [];
  const missingRatingTitles = [];

  for (const action of actions || []) {
    if (!['add_movies', 'add_movie', 'update_movie', 'add_random_movies'].includes(action.type)) {
      valid.push(action);
      continue;
    }

    if (action.type === 'add_random_movies') {
      valid.push(action);
      continue;
    }

    const status = action.status || 'want';
    if (status !== 'watched') {
      valid.push(action);
      continue;
    }

    const rating = action.rating;
    const hasRating = typeof rating === 'number' && rating >= 1 && rating <= 10;
    if (hasRating) {
      valid.push(action);
      continue;
    }

    if (action.type === 'add_movies') {
      missingRatingTitles.push(...(action.titles || []));
    } else if (action.title) {
      missingRatingTitles.push(action.title);
    }
  }

  if (!missingRatingTitles.length) {
    return { actions: valid, ratingAsk: null };
  }

  return {
    actions: valid,
    ratingAsk: buildRatingAskReply(missingRatingTitles)
  };
}

export function formatOpenAIError(message) {
  const lower = String(message || '').toLowerCase();

  if (lower.includes('quota') || lower.includes('billing') || lower.includes('insufficient')) {
    return {
      code: 'quota',
      message: 'Закончился баланс OpenAI. Пополните счёт на platform.openai.com или замените OPENAI_API_KEY в .env. Пока работает локальный режим — попробуйте: «Добавь Интерстеллар» или «Покажи что хочу посмотреть».'
    };
  }

  if (lower.includes('invalid api key') || lower.includes('incorrect api key')) {
    return {
      code: 'auth',
      message: 'Неверный OPENAI_API_KEY в файле .env. Проверьте ключ на platform.openai.com.'
    };
  }

  if (lower.includes('rate limit')) {
    return {
      code: 'rate_limit',
      message: 'Слишком много запросов к OpenAI. Подождите минуту или используйте локальные команды.'
    };
  }

  return {
    code: 'unknown',
    message: message || 'Ошибка OpenAI API'
  };
}

export function isOpenAIQuotaError(message) {
  const lower = String(message || '').toLowerCase();
  return lower.includes('quota') || lower.includes('billing') || lower.includes('insufficient');
}

/* ===================================================================
   INTENT-СЛОЙ AI-ЧАТА (экономия OpenAI)
   -------------------------------------------------------------------
   Этот блок отвечает за то, ЧТОБЫ НЕ ДЁРГАТЬ OpenAI без необходимости:
     1) isMovieRelatedPrompt() — отсекает запросы не про кино/сериалы
        ещё ДО любого обращения к OpenAI (см. server.js /api/chat).
     2) classifyChatIntent() — определяет тип запроса, чтобы выбрать
        самый дешёвый способ ответа (локально / TMDb / OpenAI).
     3) detectRecommendationRequest() — распознаёт «простые» подборки
        (жанр + количество + фильмы/сериалы), которые делаются через
        TMDb без OpenAI.
   Никаких сетевых вызовов здесь нет — только текстовый разбор.
   =================================================================== */

// Слова-сигналы того, что запрос ОТНОСИТСЯ к кино/сериалам.
// Если хоть один встретился — считаем тему разрешённой.
const MOVIE_SIGNAL_PATTERNS = [
  /фильм|сериал|кино|муви|movie|film|киношк|телесериал/,
  /мультф|мультик|мультсериал|анимаци|аниме|anime/,
  /актёр|актер|актрис|режисс|сценар|кинокартин|кинолент/,
  /жанр|боевик|комеди|драм|мелодрам|романт|ужас|ужастик|хоррор|триллер/,
  /детектив|криминал|фантастик|фэнтези|фентези|вестерн|документал|экшен|экшн|приключ|мюзикл/,
  /премьер|кинопоиск|kinopoisk|imdb|tmdb|постер|трейлер|сюжет|спойлер/,
  /\bсери[яи]\b|сезон|эпизод|франшиз|экраниз/,
  /посмотр|просмотр|гляну|глянуть|заценить|пересмотр/,
  /рекоменд|посоветуй|посоветова|порекоменд|подбор|подбери|подскаж|подобрать/,
  /\bвкус\b|watchlist|вишлист|оцен(?:к|и|ил|ить)|рейтинг/,
  /что\s+посмотреть|что\s+глянуть|нужен\s+фильм|нужен\s+сериал|хочется\s+посмотреть/,
  // глаголы управления списком (добавь/удали/отметь/покажи …)
  /добав|закин|занеси|внеси|удали|убери|выкинь|вычеркни|отметь|пометь|поставь\s+\d|перенеси|перемести/,
  /покажи|выведи|список\s+фильм|список\s+сериал|сколько\s+фильм|сколько\s+сериал/
];

// Слова-сигналы того, что запрос НЕ про кино (математика, код, спорт…).
// При отсутствии киносигналов такие запросы НЕ уходят в OpenAI.
const OFF_TOPIC_PATTERNS = [
  /сочинени|эссе|реферат|\bдоклад\b|курсов/,
  /математик|уравнени|интеграл|производн|\bфизик|\bхими[яю]|геометри|алгебр|задач[уа]\s+по/,
  /тренировк|упражнени|фитнес|качал|пресс|диет[уа]|похуде/,
  /инфляц|экономик|биткоин|крипт|\bакци[ийяю]\b|инвест|ипотек|кредит|налог|\bзарплат/,
  /заработ|деньг|подработк|бизнес[\s-]?план/,
  /\bкод\b|кодинг|программир|\bpython\b|\bjavascript\b|\bфункци[яю]\b\s|скрипт\s+на/,
  /перевед|переведи|перевод\s+текст|грамматик|спряжени/,
  /погод[аеуы]|гороскоп|анекдот|\bстих|поэм|\bрецепт|приготов|сварить|пожарить/,
  /резюме|ваканси|медицин|симптом|лекарств|диагноз/
];

function normalizeIntentText(message) {
  return String(message || '').toLowerCase().replace(/ё/g, 'е').trim();
}

/**
 * isMovieRelatedPrompt — главный фильтр релевантности.
 * true  → можно обрабатывать (локально / TMDb / OpenAI);
 * false → запрос не про кино, OpenAI вызывать НЕЛЬЗЯ.
 *
 * Логика строгая: пропускаем только при явном киносигнале. Это и есть
 * место, «где фильтруются нерелевантные запросы».
 */
export function isMovieRelatedPrompt(message) {
  const text = normalizeIntentText(message);
  if (!text) return false;

  // Кавычки с названием + любой намёк на действие — считаем про кино.
  const hasQuotedTitle = /[«"'][^«»"']{2,}[»"']/.test(text);
  const hasMovieSignal = MOVIE_SIGNAL_PATTERNS.some((re) => re.test(text));
  if (hasMovieSignal) return true;

  const hasOffTopic = OFF_TOPIC_PATTERNS.some((re) => re.test(text));
  if (hasOffTopic) return false;

  // Кавычки-название без явного оффтопа трактуем как кинозапрос
  // (например «расскажи про "Дюна"»).
  if (hasQuotedTitle) return true;

  // По умолчанию — строго: нет киносигнала → не наша тема.
  return false;
}

// Стандартный ответ для нерелевантных запросов (без обращения к OpenAI).
export const OFF_TOPIC_REPLY =
  'Я могу помогать только с фильмами, сериалами, подборками, рекомендациями и вашим списком просмотра.';

/* ── Словарь жанров: русское слово → id жанров TMDB (movie/tv) ───────
   id фиксированы у TMDB, поэтому используем статическую таблицу — это
   позволяет распознавать жанр локально, без запроса к TMDb. */
const GENRE_DICTIONARY = [
  { re: /боевик|экшен|экшн/, movie: 28, tv: 10759, name: 'боевик' },
  { re: /приключ/, movie: 12, tv: 10759, name: 'приключения' },
  { re: /комеди/, movie: 35, tv: 35, name: 'комедия' },
  { re: /мелодрам|романт|романс/, movie: 10749, tv: 18, name: 'мелодрама' },
  { re: /(?<!мело)драм/, movie: 18, tv: 18, name: 'драма' },
  { re: /ужас|ужастик|хоррор/, movie: 27, tv: 9648, name: 'ужасы' },
  { re: /триллер/, movie: 53, tv: 9648, name: 'триллер' },
  { re: /детектив/, movie: 9648, tv: 9648, name: 'детектив' },
  { re: /криминал|мафи|гангстер/, movie: 80, tv: 80, name: 'криминал' },
  { re: /фантастик|sci-?fi|научн\w*\s+фантаст/, movie: 878, tv: 10765, name: 'фантастика' },
  { re: /фэнтези|фентези|фэнтэзи/, movie: 14, tv: 10765, name: 'фэнтези' },
  { re: /истори(?:ческ|я|и|й)/, movie: 36, tv: 18, name: 'история' },
  { re: /военн|\bwar\b/, movie: 10752, tv: 10768, name: 'военный' },
  { re: /семейн/, movie: 10751, tv: 10751, name: 'семейный' },
  { re: /мультф|мультик|мультсериал|анимаци/, movie: 16, tv: 16, name: 'мультфильм' },
  { re: /\bаниме\b|\banime\b/, movie: 16, tv: 16, name: 'аниме', originalLanguage: 'ja' },
  { re: /документал/, movie: 99, tv: 99, name: 'документальный' },
  { re: /вестерн/, movie: 37, tv: 37, name: 'вестерн' },
  { re: /мюзикл|музыкальн/, movie: 10402, tv: 10402, name: 'музыка' }
];

// Глаголы/обороты запроса на ПОДБОРКУ (рекомендацию новых фильмов).
const RECOMMEND_INTENT = /посоветуй|посоветова|порекоменд|рекоменд|подбери|подобрать|подскаж|\bдай\b|\bдайте\b|скинь|накидай|\bхочу\b|\bхочется\b|нужен\s+(?:фильм|сериал)|нужны?\s+(?:фильм|сериал)|что\s+(?:посмотреть|глянуть)|на\s+вечер|во\s+что\s+поиграть/i;

// Маркеры СЛОЖНОГО запроса: тут нужен OpenAI (нюансы настроения/сравнения).
const COMPLEX_MARKERS = /как\s+[«"']?\w.*\bно\b|похож\w*.*\bно\b|в\s+духе|напоминает|чтобы\s+было|чтобы\s+(?:не\s+)?\w+|\bно\s+не\b|не\s+банальн|не\s+слишком|более\s+\w|менее\s+\w|поглубже|пофилософск|философск.*мрачн|мрачн.*философск|после\s+[«"']?[А-ЯA-ZЁ]|по\s+мо(?:ему|ем)\s+вкус|на\s+мой\s+вкус|сравни\s+мой\s+вкус|что\s+посмотреть\s+после/i;

// Вопрос про конкретный фильм/сериал (объяснение, факты, сравнение).
const MOVIE_QUESTION_MARKERS = /объясни|поясни|что\s+(?:значит|означает)|в\s+чём\s+смысл|концовк|кто\s+(?:играет|играл|снял|режисс|автор)|о\s+чём|про\s+что\s+(?:фильм|сериал|кино)|чем\s+отлич|\bразниц|сравни\s+(?:фильм|сериал|их)/i;

// Запрос на анализ вкуса пользователя.
const TASTE_ANALYSIS_MARKERS = /(?:анализ|проанализир|разбер|оцени)\w*\s+(?:мой\s+)?вкус|мой\s+вкус|вкус\w*\s+(?:измен|раньш|со\s+времен)|сравни\s+мой\s+вкус/i;

function detectCountForRecommendation(text) {
  if (/\bнесколько\b/.test(text)) return 5;
  if (/\bпарочк/.test(text)) return 3;
  if (/\bпару\b/.test(text)) return 2;
  const m = text.match(/(\d{1,2})\s*(?:фильм|сериал|комеди|боевик|драм|ужас|триллер|детектив|мультф|аниме|штук|шт\b|вариант)/i)
    || text.match(/(?:посоветуй|подбери|дай|дайте|скинь|накидай|хочу|нужно)\s+(\d{1,2})/i)
    || text.match(/\b(\d{1,2})\b/);
  if (m) {
    const n = parseInt(m[1], 10);
    if (n >= 1 && n <= 30) return n;
  }
  return null;
}

function detectGenresForRecommendation(text) {
  const matched = [];
  for (const g of GENRE_DICTIONARY) {
    if (g.re.test(text)) matched.push(g);
  }
  return matched;
}

function detectThemeForRecommendation(text) {
  // «дай сериалы про маньяков» → тема «маньяков»
  const m = text.match(/про\s+([a-zа-я0-9ё][a-zа-я0-9ё\s\-]{1,30}?)(?:$|[,.!?]|\s+на\s+вечер|\s+чтобы)/i)
    || text.match(/\bо\s+([a-zа-яё]{4,}(?:ах|ов|ях|ями)?)\b/i);
  if (!m) return null;
  let theme = m[1].trim();
  // отбрасываем медиаслова, если попали в тему
  theme = theme.replace(/\b(?:фильм\w*|сериал\w*|кино|мультфильм\w*)\b/gi, '').trim();
  if (theme.length < 3) return null;
  return theme.split(/\s+/).slice(0, 3).join(' ');
}

/**
 * detectRecommendationRequest — распознаёт запрос на подборку.
 * Возвращает null, если это не подборка. Иначе:
 *   { count, mediaType, genreIds, genreNames, theme, originalLanguage,
 *     isSimple, isComplex }
 * isSimple=true → можно сделать через TMDb БЕЗ OpenAI.
 * isComplex=true → нужен OpenAI (нюансы вкуса/настроения/сравнения).
 */
export function detectRecommendationRequest(message) {
  const text = normalizeIntentText(message);
  if (!text) return null;

  const wantsRecommendation = RECOMMEND_INTENT.test(text);
  const isComplex = COMPLEX_MARKERS.test(text);

  const genres = detectGenresForRecommendation(text);
  const theme = detectThemeForRecommendation(text);
  const mediaType = detectMediaTypeFromText(text) || 'movie';
  const count = detectCountForRecommendation(text) || 10;

  // Не подборка вовсе: нет ни намёка на рекомендацию, ни сложных маркеров
  if (!wantsRecommendation && !isComplex) return null;

  const genreIds = genres
    .map((g) => (mediaType === 'tv' ? g.tv : g.movie))
    .filter(Boolean);
  const originalLanguage = genres.find((g) => g.originalLanguage)?.originalLanguage || null;

  // Простая подборка: явный жанр или тема, без «сложных» нюансов.
  const isSimple = !isComplex && wantsRecommendation && (genreIds.length > 0 || Boolean(theme));

  return {
    count: Math.max(1, Math.min(20, count)),
    mediaType,
    genreIds: [...new Set(genreIds)],
    genreNames: genres.map((g) => g.name),
    theme: theme || null,
    originalLanguage,
    isSimple,
    isComplex: isComplex && wantsRecommendation ? true : isComplex
  };
}

/**
 * classifyChatIntent — разбивает запрос на типы (см. ТЗ):
 *   off_topic | list_command | simple_recommendation |
 *   complex_recommendation | movie_question | taste_analysis |
 *   unknown_movie_related
 *
 * list_command определяется наличием parseLocalChat-результата на стороне
 * server.js (поэтому здесь возвращается через hasLocalCommand). Это
 * центральная точка intent detection для выбора дешёвого пути ответа.
 */
export function classifyChatIntent(message, { hasLocalCommand = false } = {}) {
  if (!isMovieRelatedPrompt(message)) return 'off_topic';
  if (hasLocalCommand) return 'list_command';

  const text = normalizeIntentText(message);
  if (TASTE_ANALYSIS_MARKERS.test(text)) return 'taste_analysis';

  const rec = detectRecommendationRequest(message);
  if (rec?.isSimple) return 'simple_recommendation';
  if (rec?.isComplex) return 'complex_recommendation';

  if (MOVIE_QUESTION_MARKERS.test(text)) return 'movie_question';

  // Подборка без явного жанра/нюансов, но про кино → отдаём OpenAI.
  if (rec) return 'complex_recommendation';

  return 'unknown_movie_related';
}
