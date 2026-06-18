export const PSYCH_PROFILES = {
  deep_observer: {
    id: 'deep_observer',
    title: 'Глубокий наблюдатель',
    description:
      'Вам чаще подходят атмосферные истории, сложные персонажи, моральный выбор и фильмы, после которых хочется подумать. Вы можете спокойно смотреть медленное кино, если в нём есть смысл, напряжение и внутренний конфликт.',
    shortDescription:
      'Вам чаще подходят атмосферные фильмы, психологические драмы, истории с внутренним конфликтом и сильной концовкой.',
    suits: [
      'психологические драмы',
      'философская фантастика',
      'арт-драмы',
      'медленные триллеры',
      'фильмы с моральным выбором',
      'истории с подтекстом'
    ],
    avoid: [
      'слишком простые комедии',
      'поверхностные боевики',
      'хаотичные фильмы без смысла'
    ],
    genres: ['драма', 'триллер', 'фантастика', 'детектив'],
    moods: ['атмосферное', 'задумчивое', 'напряжённое'],
    pace: 'медленный или средний',
    finales: 'открытые, оставляющие пространство для размышлений',
    heroes: 'сложные, противоречивые'
  },
  emotional_empath: {
    id: 'emotional_empath',
    title: 'Эмоциональный эмпат',
    description:
      'Вы смотрите кино сердцем: важны живые персонажи, искренние чувства и истории, в которых легко сопереживать. Вам близки драмы с сильной актёрской игрой, семейные и личные истории, финалы, которые трогают до глубины.',
    shortDescription:
      'Вам близки драмы, истории взросления, семейные сюжеты и фильмы с сильной актёрской игрой.',
    suits: [
      'драмы',
      'романтические драмы',
      'биографии',
      'истории взросления',
      'семейные истории',
      'фильмы с сильной актёрской игрой'
    ],
    avoid: [
      'сухие интеллектуальные фильмы без эмоций',
      'слишком холодные сюжеты',
      'фильмы со слабо раскрытыми персонажами'
    ],
    genres: ['драма', 'мелодрама', 'биография', 'семейный'],
    moods: ['тёплое', 'трогательное', 'эмоциональное'],
    pace: 'средний',
    finales: 'эмоциональные, запоминающиеся',
    heroes: 'ранимые, живые, эмоциональные'
  },
  tension_seeker: {
    id: 'tension_seeker',
    title: 'Искатель напряжения',
    description:
      'Вам нужен темп, интрига и события. Вы быстро вовлекаетесь в динамичные сюжеты, любите неожиданные повороты, зрелищность и ощущение, что что-то постоянно происходит.',
    shortDescription:
      'Вам подходят триллеры, детективы, динамичная фантастика и истории с постоянной интригой.',
    suits: [
      'триллеры',
      'детективы',
      'криминальные сериалы',
      'экшен',
      'фантастика с динамикой',
      'фильмы с неожиданными поворотами'
    ],
    avoid: [
      'слишком медленные драмы',
      'фильмы без событий',
      'затянутые авторские фильмы'
    ],
    genres: ['триллер', 'криминал', 'боевик', 'фантастика', 'детектив'],
    moods: ['напряжённое', 'захватывающее', 'динамичное'],
    pace: 'быстрый',
    finales: 'мощные, эффектные',
    heroes: 'сильные, решительные, активные'
  },
  comfort_viewer: {
    id: 'comfort_viewer',
    title: 'Комфортный зритель',
    description:
      'Вы цените лёгкий и приятный просмотр: уют, доброту, понятных героев и финалы, после которых остаётся хорошее настроение. Вам подходят комедии, добрые драмы и сериалы «на вечер без перегруза».',
    shortDescription:
      'Вам подходят лёгкие комедии, добрые драмы, романтика и уютные сериалы на вечер.',
    suits: [
      'лёгкие комедии',
      'добрые драмы',
      'романтика',
      'семейные фильмы',
      'уютные сериалы',
      'фильмы на вечер без перегруза'
    ],
    avoid: [
      'тяжёлые драмы',
      'психологически давящие фильмы',
      'хорроры',
      'слишком мрачные сюжеты'
    ],
    genres: ['комедия', 'мелодрама', 'семейный', 'романтика'],
    moods: ['лёгкое', 'уютное', 'расслабляющее'],
    pace: 'спокойный',
    finales: 'добрые или спокойные',
    heroes: 'добрые, понятные, уютные'
  }
};

const PROFILE_KEYS = ['deep_observer', 'emotional_empath', 'tension_seeker', 'comfort_viewer'];
const SCALE_KEYS = ['depth', 'emotionality', 'dynamics', 'comfort'];

export const PSYCH_QUESTIONS = [
  {
    id: 'q1',
    text: 'Какой фильм чаще всего оставляет у вас сильное впечатление?',
    options: [
      { id: 'a1', text: 'Тот, после которого долго думаешь', profile: 'deep_observer', scale: 'depth' },
      { id: 'a2', text: 'Тот, который эмоционально пробивает', profile: 'emotional_empath', scale: 'emotionality' },
      { id: 'a3', text: 'Тот, где много событий и напряжения', profile: 'tension_seeker', scale: 'dynamics' },
      { id: 'a4', text: 'Тот, который расслабляет и даёт выдохнуть', profile: 'comfort_viewer', scale: 'comfort' }
    ]
  },
  {
    id: 'q2',
    text: 'Что вам чаще хочется получить от просмотра?',
    options: [
      { id: 'a1', text: 'Глубину и смысл', profile: 'deep_observer', scale: 'depth' },
      { id: 'a2', text: 'Эмоции и сопереживание', profile: 'emotional_empath', scale: 'emotionality' },
      { id: 'a3', text: 'Адреналин и динамику', profile: 'tension_seeker', scale: 'dynamics' },
      { id: 'a4', text: 'Лёгкость и комфорт', profile: 'comfort_viewer', scale: 'comfort' }
    ]
  },
  {
    id: 'q3',
    text: 'Какой темп вам чаще подходит?',
    options: [
      { id: 'a1', text: 'Медленный, если есть атмосфера', profile: 'deep_observer', scale: 'depth' },
      { id: 'a2', text: 'Средний, с хорошим развитием персонажей', profile: 'emotional_empath', scale: 'emotionality' },
      { id: 'a3', text: 'Быстрый, чтобы не было скучно', profile: 'tension_seeker', scale: 'dynamics' },
      { id: 'a4', text: 'Спокойный и ненапряжный', profile: 'comfort_viewer', scale: 'comfort' }
    ]
  },
  {
    id: 'q4',
    text: 'Какие герои вам интереснее?',
    options: [
      { id: 'a1', text: 'Сложные, противоречивые', profile: 'deep_observer', scale: 'depth' },
      { id: 'a2', text: 'Ранимые, живые, эмоциональные', profile: 'emotional_empath', scale: 'emotionality' },
      { id: 'a3', text: 'Сильные, решительные, активные', profile: 'tension_seeker', scale: 'dynamics' },
      { id: 'a4', text: 'Добрые, понятные, уютные', profile: 'comfort_viewer', scale: 'comfort' }
    ]
  },
  {
    id: 'q5',
    text: 'Какой финал вам чаще нравится?',
    options: [
      { id: 'a1', text: 'Открытый, чтобы можно было подумать', profile: 'deep_observer', scale: 'depth' },
      { id: 'a2', text: 'Эмоциональный, даже если тяжёлый', profile: 'emotional_empath', scale: 'emotionality' },
      { id: 'a3', text: 'Мощный и эффектный', profile: 'tension_seeker', scale: 'dynamics' },
      { id: 'a4', text: 'Добрый или хотя бы спокойный', profile: 'comfort_viewer', scale: 'comfort' }
    ]
  },
  {
    id: 'q6',
    text: 'Как вы относитесь к тяжёлым фильмам?',
    options: [
      { id: 'a1', text: 'Люблю, если они глубокие', profile: 'deep_observer', scale: 'depth' },
      { id: 'a2', text: 'Могу смотреть, если есть сильная эмоция', profile: 'emotional_empath', scale: 'emotionality' },
      { id: 'a3', text: 'Иногда, но не слишком медленные', profile: 'tension_seeker', scale: 'dynamics' },
      { id: 'a4', text: 'Сейчас чаще хочется чего-то лёгкого', profile: 'comfort_viewer', scale: 'comfort' }
    ]
  },
  {
    id: 'q7',
    text: 'Что вас быстрее всего отталкивает от фильма?',
    options: [
      { id: 'a1', text: 'Поверхностный сюжет', profile: 'deep_observer', scale: 'depth' },
      { id: 'a2', text: 'Отсутствие эмоций', profile: 'emotional_empath', scale: 'emotionality' },
      { id: 'a3', text: 'Скучный темп', profile: 'tension_seeker', scale: 'dynamics' },
      { id: 'a4', text: 'Слишком тяжёлая атмосфера', profile: 'comfort_viewer', scale: 'comfort' }
    ]
  },
  {
    id: 'q8',
    text: 'Какой визуальный стиль вам ближе?',
    options: [
      { id: 'a1', text: 'Мрачный, атмосферный, эстетичный', profile: 'deep_observer', scale: 'depth' },
      { id: 'a2', text: 'Тёплый, живой, эмоциональный', profile: 'emotional_empath', scale: 'emotionality' },
      { id: 'a3', text: 'Яркий, динамичный, зрелищный', profile: 'tension_seeker', scale: 'dynamics' },
      { id: 'a4', text: 'Светлый, уютный, простой', profile: 'comfort_viewer', scale: 'comfort' }
    ]
  },
  {
    id: 'q9',
    text: 'Когда вы выбираете фильм, что для вас важнее?',
    options: [
      { id: 'a1', text: 'Идея и смысл', profile: 'deep_observer', scale: 'depth' },
      { id: 'a2', text: 'Персонажи и эмоции', profile: 'emotional_empath', scale: 'emotionality' },
      { id: 'a3', text: 'Сюжет и события', profile: 'tension_seeker', scale: 'dynamics' },
      { id: 'a4', text: 'Настроение и лёгкость просмотра', profile: 'comfort_viewer', scale: 'comfort' }
    ]
  },
  {
    id: 'q10',
    text: 'Какой сериал вам легче досмотреть?',
    options: [
      { id: 'a1', text: 'Медленный, но глубокий', profile: 'deep_observer', scale: 'depth' },
      { id: 'a2', text: 'С сильными персонажами и драмой', profile: 'emotional_empath', scale: 'emotionality' },
      { id: 'a3', text: 'С постоянной интригой', profile: 'tension_seeker', scale: 'dynamics' },
      { id: 'a4', text: 'Лёгкий, комфортный, без перегруза', profile: 'comfort_viewer', scale: 'comfort' }
    ]
  },
  {
    id: 'q11',
    text: 'Какое состояние у вас чаще бывает перед просмотром?',
    options: [
      { id: 'a1', text: 'Хочу подумать и погрузиться', profile: 'deep_observer', scale: 'depth' },
      { id: 'a2', text: 'Хочу почувствовать что-то настоящее', profile: 'emotional_empath', scale: 'emotionality' },
      { id: 'a3', text: 'Хочу отвлечься и залипнуть', profile: 'tension_seeker', scale: 'dynamics' },
      { id: 'a4', text: 'Хочу расслабиться и не напрягаться', profile: 'comfort_viewer', scale: 'comfort' }
    ]
  },
  {
    id: 'q12',
    text: 'Какой подбор вам сейчас был бы полезнее?',
    options: [
      { id: 'a1', text: 'Что-то глубокое и атмосферное', profile: 'deep_observer', scale: 'depth' },
      { id: 'a2', text: 'Что-то эмоциональное и сильное', profile: 'emotional_empath', scale: 'emotionality' },
      { id: 'a3', text: 'Что-то динамичное и захватывающее', profile: 'tension_seeker', scale: 'dynamics' },
      { id: 'a4', text: 'Что-то лёгкое и комфортное', profile: 'comfort_viewer', scale: 'comfort' }
    ]
  }
];

const SCALE_LABELS = { low: 'низкая', medium: 'средняя', high: 'высокая' };

export const SCALE_NAMES = {
  depth: 'Глубина',
  emotionality: 'Эмоциональность',
  dynamics: 'Динамика',
  comfort: 'Лёгкость'
};

export function scaleLevelToValue(level) {
  if (level === 'low') return 33;
  if (level === 'high') return 100;
  return 66;
}

export function scaleScoreToValue(score, max = 12) {
  if (score == null) return 50;
  return Math.min(100, Math.max(0, Math.round((score / max) * 100)));
}

export function enrichScales(scales, scaleScores = null) {
  return Object.fromEntries(
    SCALE_KEYS.map((key) => {
      const level = scales[key] || 'medium';
      const value = scaleScores?.[key] != null
        ? scaleScoreToValue(scaleScores[key])
        : scaleLevelToValue(level);
      return [key, { label: SCALE_NAMES[key], level, value }];
    })
  );
}

export function enrichPsychAnswers(answers) {
  return answers.map((a) => {
    const question = PSYCH_QUESTIONS.find((q) => q.id === a.questionId);
    const option = question?.options.find((o) => o.id === a.answerId);
    return {
      questionId: a.questionId,
      answerId: a.answerId,
      questionText: question?.text || a.questionText || '',
      answerText: option?.text || a.answerText || ''
    };
  });
}

export function buildDynamicsText(first, last) {
  if (!first || !last) return '';
  const firstScales = normalizeScaleMap(first.scales);
  const lastScales = normalizeScaleMap(last.scales);
  const changed = SCALE_KEYS.filter((k) => firstScales[k]?.level !== lastScales[k]?.level);
  const grew = changed.filter((k) => scaleLevelRank(lastScales[k]?.level) > scaleLevelRank(firstScales[k]?.level));
  const fell = changed.filter((k) => scaleLevelRank(lastScales[k]?.level) < scaleLevelRank(firstScales[k]?.level));

  if (first.profile === last.profile) {
    return `Вы несколько раз получали результат «${last.profileTitle}». Это значит, что вам стабильно подходят ${getProfileStableHint(last.profile)}.`;
  }

  let scalePart = '';
  if (grew.length || fell.length) {
    const parts = [];
    if (grew.length) parts.push(`выросла шкала «${SCALE_NAMES[grew[0]]}»`);
    if (fell.length) parts.push(`шкала «${SCALE_NAMES[fell[0]]}» стала ниже`);
    scalePart = ` За последние прохождения у вас ${parts.join(', а ')}.`;
  }
  return `Раньше вам ближе был профиль «${first.profileTitle}», сейчас — «${last.profileTitle}».${scalePart} Возможно, сейчас вам чаще подходят ${getProfileStableHint(last.profile)}.`;
}

function scaleLevelRank(level) {
  return { low: 0, medium: 1, high: 2 }[level] ?? 1;
}

function normalizeScaleMap(scales) {
  if (!scales) return {};
  const out = {};
  for (const key of SCALE_KEYS) {
    const val = scales[key];
    out[key] = typeof val === 'object' && val?.level ? val : { level: val || 'medium', label: SCALE_NAMES[key] };
  }
  return out;
}

function getProfileStableHint(profile) {
  const hints = {
    deep_observer: 'атмосферные истории, сложные персонажи и фильмы с подтекстом',
    emotional_empath: 'эмоциональные драмы и истории с сильными персонажами',
    tension_seeker: 'динамичные триллеры и захватывающие сюжеты',
    comfort_viewer: 'лёгкие и уютные фильмы на вечер'
  };
  return hints[profile] || 'фильмы под ваш стиль восприятия';
}

export const PSYCH_FEEDBACK_REASONS = {
  too_heavy: 'слишком тяжёлое',
  too_light: 'слишком лёгкое',
  too_slow: 'слишком медленное',
  too_dynamic: 'слишком динамичное',
  wrong_genre: 'не тот жанр',
  bad_description: 'не нравится описание',
  already_seen: 'уже видел',
  other: 'другое'
};

function scaleLevel(score) {
  if (score <= 3) return 'low';
  if (score <= 7) return 'medium';
  return 'high';
}

function findOption(questionId, answerId) {
  const question = PSYCH_QUESTIONS.find((q) => q.id === questionId);
  if (!question) return null;
  return question.options.find((o) => o.id === answerId) || null;
}

export function validatePsychAnswers(answers) {
  if (!Array.isArray(answers) || answers.length !== PSYCH_QUESTIONS.length) {
    return { ok: false, error: 'Нужно ответить на все 12 вопросов' };
  }

  const seen = new Set();
  for (const question of PSYCH_QUESTIONS) {
    const answer = answers.find((a) => a.questionId === question.id);
    if (!answer?.answerId) {
      return { ok: false, error: `Нет ответа на вопрос ${question.id}` };
    }
    if (!findOption(question.id, answer.answerId)) {
      return { ok: false, error: 'Некорректный ответ' };
    }
    seen.add(question.id);
  }

  if (seen.size !== PSYCH_QUESTIONS.length) {
    return { ok: false, error: 'Ответы должны быть уникальны для каждого вопроса' };
  }

  return { ok: true };
}

export function calculatePsychResult(answers) {
  const validation = validatePsychAnswers(answers);
  if (!validation.ok) return { error: validation.error };

  const scores = Object.fromEntries(PROFILE_KEYS.map((k) => [k, 0]));
  const scaleScores = Object.fromEntries(SCALE_KEYS.map((k) => [k, 0]));

  for (const answer of answers) {
    const option = findOption(answer.questionId, answer.answerId);
    if (!option) continue;
    scores[option.profile] += 1;
    scaleScores[option.scale] += 1;
  }

  const profile = [...PROFILE_KEYS].sort((a, b) => scores[b] - scores[a])[0];
  const profileData = PSYCH_PROFILES[profile];
  const scales = Object.fromEntries(
    SCALE_KEYS.map((key) => [key, scaleLevel(scaleScores[key])])
  );
  const enrichedAnswers = enrichPsychAnswers(answers);

  return {
    profile,
    profileTitle: profileData.title,
    profileDescription: profileData.description,
    profileShortDescription: profileData.shortDescription,
    scores,
    scales,
    scaleScores,
    scalesDetailed: enrichScales(scales, scaleScores),
    scaleLabels: Object.fromEntries(
      SCALE_KEYS.map((key) => [key, SCALE_LABELS[scales[key]]])
    ),
    answers: enrichedAnswers,
    suits: profileData.suits,
    avoid: profileData.avoid,
    traits: {
      genres: profileData.genres,
      moods: profileData.moods,
      pace: profileData.pace,
      finales: profileData.finales,
      heroes: profileData.heroes
    }
  };
}

export function buildPsychTestPrompt(psychTest) {
  if (!psychTest?.profile) return '';
  const profileData = PSYCH_PROFILES[psychTest.profile] || {};
  const scales = psychTest.scales || {};
  const scaleText = SCALE_KEYS.map((key) => {
    const raw = scales[key];
    const level = typeof raw === 'object' && raw?.level ? raw.level : raw;
    const label = SCALE_LABELS[level] || level || '—';
    const names = { depth: 'Глубина', emotionality: 'Эмоциональность', dynamics: 'Динамика', comfort: 'Лёгкость' };
    return `${names[key]}: ${label}`;
  }).join('; ');

  return `\nКино-психологический профиль (развлекательный тест, не медицинская диагностика):
- Профиль восприятия: ${psychTest.profileTitle || profileData.title}
- ${profileData.shortDescription || profileData.description || ''}
- Шкалы: ${scaleText}
- Подходят: ${(profileData.suits || []).join(', ')}
- Лучше избегать: ${(profileData.avoid || []).join(', ')}
Не ставь диагнозы и не используй медицинские формулировки. Описывай только стиль восприятия контента.`;
}

export function buildPsychRecFeedbackPrompt(feedback = []) {
  if (!feedback?.length) return '';
  const recent = feedback.slice(-20);
  const lines = recent.map((item) => {
    const reason = PSYCH_FEEDBACK_REASONS[item.reason] || item.reason || 'другое';
    return `- «${item.title}»: ${reason}${item.note ? ` (${item.note})` : ''}`;
  });
  return `\nНежелательные рекомендации (обратная связь пользователя):\n${lines.join('\n')}`;
}

export function buildPsychRecommendationUserContext({ psychTest, movies, prefs, mediaType = null }) {
  const watched = movies.filter((m) => m.status === 'watched');
  const want = movies.filter((m) => m.status === 'want');
  const watching = movies.filter((m) => m.status === 'watching');
  const dislikedNotes = movies
    .filter((m) => m.notes?.disliked?.trim())
    .map((m) => `${m.title}: ${m.notes.disliked.trim()}`);
  const feedback = prefs?.psychRecFeedback || [];

  const battleTop = [...watched]
    .filter((m) => (m.battleWins || 0) > 0 || (m.battleScore || 0) > 0)
    .sort((a, b) => (b.battleScore || 0) - (a.battleScore || 0))
    .slice(0, 10)
    .map((m) => `${m.title}${m.rating ? ` (${m.rating}/10)` : ''}`);

  const ratings = watched
    .filter((m) => m.rating)
    .map((m) => `${m.title}: ${m.rating}/10`)
    .slice(0, 40);

  const listTitles = movies.map((m) => m.title);
  const typeHint = mediaType === 'tv'
    ? 'Приоритет — сериалы, но можно смешивать с фильмами.'
    : mediaType === 'movie'
      ? 'Приоритет — фильмы, но можно смешивать с сериалами.'
      : 'Можно смешивать фильмы и сериалы.';

  return `Данные пользователя:
testProfile: ${JSON.stringify({
    profile: psychTest.profile,
    profileTitle: psychTest.profileTitle,
    scores: psychTest.scores,
    scales: psychTest.scales,
    traits: psychTest.traits || PSYCH_PROFILES[psychTest.profile]
  })}
testScales: ${JSON.stringify(psychTest.scales)}
watchedMovies: ${watched.map((m) => m.title).join(', ') || 'нет'}
ratings: ${ratings.join('; ') || 'нет'}
currentWatchlist: ${want.map((m) => m.title).join(', ') || 'нет'}
watchingNow: ${watching.map((m) => m.title).join(', ') || 'нет'}
dislikedMovies: ${dislikedNotes.join('; ') || 'нет'}
blacklist: ${JSON.stringify(prefs?.blacklist || {})}
battleTop: ${battleTop.join(', ') || 'нет'}
psychRecFeedback: ${JSON.stringify(feedback.slice(-15))}
allListTitles: ${listTitles.join(', ') || 'пусто'}
${typeHint}

Приоритет сигналов:
1. Чёрный список AI и явные исключения
2. Обратная связь «Не хочу такое»
3. Личные оценки и заметки «не понравилось»
4. BattleScore из мини-игры
5. Результат кино-психологического теста
6. Жанры и история просмотров
7. Текущий запрос`;
}

export function buildPsychRecommendationPrompt(contextBlock, blacklistPrompt = '', titleRule = '') {
  return `Ты — AI-помощник в персональном трекере фильмов и сериалов.

Твоя задача — рекомендовать фильмы и сериалы на основе кино-психологического теста пользователя, его списка, оценок и ограничений.

Важно:
- Не ставь диагнозы.
- Не используй медицинские формулировки.
- Не называй пользователя тревожным, депрессивным, травмированным и т.д.
- Описывай только стиль восприятия фильмов и предпочтения в контенте.
- Рекомендации должны быть безопасными, мягкими и развлекательными.
- Учитывай blacklist пользователя.
- Учитывай уже просмотренные фильмы и оценки.
- Не рекомендуй фильмы, которые пользователь исключил через обратную связь.
- Не рекомендуй то, что уже есть в списке, кроме случаев когда это в «Хочу посмотреть» и уместно по профилю.
- Не рекомендуй слишком похожие варианты подряд.
- Дай ровно 8 рекомендаций.

${contextBlock}
${blacklistPrompt}

${titleRule}

Верни JSON-массив из 8 объектов в поле recommendations:
{
  "recommendations": [
    {
      "title": "Название на русском",
      "type": "movie или series",
      "year": 2014,
      "genres": ["жанр"],
      "reason": "Почему это подходит пользователю",
      "testConnection": "Как связано с результатом теста",
      "mood": "настроение",
      "pace": "темп",
      "tmdbQuery": "запрос для поиска в TMDB на английском или русском"
    }
  ]
}`;
}

export function parsePsychRecommendationsJson(content) {
  const raw = String(content || '').trim();
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('invalid_json');
  const parsed = JSON.parse(jsonMatch[0]);
  const list = parsed.recommendations || parsed;
  if (!Array.isArray(list)) throw new Error('invalid_json');
  return list.slice(0, 8);
}
