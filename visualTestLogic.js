export const VISUAL_PROFILES = {
  atmospheric_observer: {
    id: 'atmospheric_observer',
    title: 'Атмосферный наблюдатель',
    description:
      'Вы чаще считываете настроение, визуальные детали и подтекст. Вам могут подойти фильмы, где важны не только события, но и атмосфера: свет, цвет, тишина, паузы, внутренний конфликт и неоднозначный финал.',
    shortDescription:
      'Вам чаще подходят фильмы с сильной визуальной эстетикой, настроением, подтекстом и выразительной атмосферой.',
    suits: [
      'атмосферные драмы',
      'философская фантастика',
      'психологические триллеры',
      'неонуар',
      'авторское кино',
      'фильмы с сильным визуальным стилем',
      'медленные, но глубокие истории'
    ],
    avoid: [
      'слишком простые комедии',
      'хаотичные боевики',
      'фильмы без визуальной атмосферы'
    ]
  },
  emotional_viewer: {
    id: 'emotional_viewer',
    title: 'Эмоциональный зритель',
    description:
      'Вы смотрите на образы через чувства: замечаете людей, одиночество, близость и внутреннее состояние. Вам близки драмы с живыми персонажами и истории, в которых легко сопереживать.',
    shortDescription:
      'Вам близки драмы, истории о людях, семейные сюжеты и фильмы с сильной эмоциональной атмосферой.',
    suits: [
      'драмы',
      'романтические драмы',
      'фильмы о взрослении',
      'семейные истории',
      'биографии',
      'сериалы с сильными персонажами',
      'истории с эмоциональным финалом'
    ],
    avoid: [
      'холодные интеллектуальные фильмы без эмоций',
      'фильмы, где персонажи плохо раскрыты'
    ]
  },
  intrigue_seeker: {
    id: 'intrigue_seeker',
    title: 'Искатель интриги',
    description:
      'Вы быстро считываете конфликт, движение, тайну и ожидание события. Вам интересны динамичные сюжеты, загадки и визуальное напряжение.',
    shortDescription:
      'Вам подходят триллеры, детективы, мистические истории и динамичная визуальная подача.',
    suits: [
      'триллеры',
      'детективы',
      'криминальные сериалы',
      'мистические истории',
      'динамичная фантастика',
      'фильмы с поворотами',
      'напряжённые мини-сериалы'
    ],
    avoid: [
      'слишком медленные фильмы без событий',
      'слишком бытовые спокойные истории'
    ]
  },
  visual_comfort: {
    id: 'visual_comfort',
    title: 'Визуальный комфорт',
    description:
      'Вы цените свет, уют, мягкость и гармонию в визуальном образе. Вам подходят красивые, спокойные истории без перегруза и давящей атмосферы.',
    shortDescription:
      'Вам подходят лёгкие фильмы, добрые драмы, романтика и уютные визуально приятные истории.',
    suits: [
      'лёгкие фильмы',
      'добрые драмы',
      'романтика',
      'уютные сериалы',
      'семейные фильмы',
      'красивые визуальные истории',
      'фильмы на вечер без перегруза'
    ],
    avoid: [
      'тяжёлые психологические драмы',
      'хорроры',
      'слишком мрачные фильмы',
      'давящая атмосфера'
    ]
  }
};

const PROFILE_KEYS = ['atmospheric_observer', 'emotional_viewer', 'intrigue_seeker', 'visual_comfort'];
const SCALE_KEYS = ['atmosphere', 'emotionality', 'tension', 'comfort'];

export const VISUAL_SCALE_NAMES = {
  atmosphere: 'Атмосферность',
  emotionality: 'Эмоциональность',
  tension: 'Напряжение',
  comfort: 'Комфорт'
};

export const VISUAL_QUESTIONS = [
  {
    id: 'visual_q1',
    imageId: 'visual_img_1',
    text: 'Что вы первым замечаете на этой картинке?',
    options: [
      { id: 'a1', text: 'Настроение и атмосферу', profile: 'atmospheric_observer', scale: 'atmosphere' },
      { id: 'a2', text: 'Фигуру или главный объект', profile: 'emotional_viewer', scale: 'emotionality' },
      { id: 'a3', text: 'Детали и скрытые смыслы', profile: 'atmospheric_observer', scale: 'atmosphere' },
      { id: 'a4', text: 'Цвета и визуальный стиль', profile: 'atmospheric_observer', scale: 'atmosphere' }
    ]
  },
  {
    id: 'visual_q2',
    imageId: 'visual_img_2',
    text: 'Какое ощущение вызывает у вас этот кадр?',
    options: [
      { id: 'a1', text: 'Интерес и желание понять, что происходит', profile: 'intrigue_seeker', scale: 'tension' },
      { id: 'a2', text: 'Эмоциональное напряжение', profile: 'emotional_viewer', scale: 'emotionality' },
      { id: 'a3', text: 'Спокойствие и уют', profile: 'visual_comfort', scale: 'comfort' },
      { id: 'a4', text: 'Динамику и ожидание события', profile: 'intrigue_seeker', scale: 'tension' }
    ]
  },
  {
    id: 'visual_q3',
    imageId: 'visual_img_3',
    text: 'Какую историю вы бы ожидали за такой картинкой?',
    options: [
      { id: 'a1', text: 'Медленную психологическую драму', profile: 'atmospheric_observer', scale: 'atmosphere' },
      { id: 'a2', text: 'Эмоциональную историю о человеке', profile: 'emotional_viewer', scale: 'emotionality' },
      { id: 'a3', text: 'Напряжённый триллер или детектив', profile: 'intrigue_seeker', scale: 'tension' },
      { id: 'a4', text: 'Лёгкую историю с тёплым финалом', profile: 'visual_comfort', scale: 'comfort' }
    ]
  },
  {
    id: 'visual_q4',
    imageId: 'visual_img_4',
    text: 'Что для вас важнее в визуальном образе?',
    options: [
      { id: 'a1', text: 'Смысл и подтекст', profile: 'atmospheric_observer', scale: 'atmosphere' },
      { id: 'a2', text: 'Эмоция', profile: 'emotional_viewer', scale: 'emotionality' },
      { id: 'a3', text: 'Напряжение', profile: 'intrigue_seeker', scale: 'tension' },
      { id: 'a4', text: 'Красота и комфорт', profile: 'visual_comfort', scale: 'comfort' }
    ]
  },
  {
    id: 'visual_q5',
    imageId: 'visual_img_5',
    text: 'Если бы это был фильм, каким был бы его темп?',
    options: [
      { id: 'a1', text: 'Медленный и атмосферный', profile: 'atmospheric_observer', scale: 'atmosphere' },
      { id: 'a2', text: 'Средний, с сильными персонажами', profile: 'emotional_viewer', scale: 'emotionality' },
      { id: 'a3', text: 'Быстрый и напряжённый', profile: 'intrigue_seeker', scale: 'tension' },
      { id: 'a4', text: 'Спокойный и расслабленный', profile: 'visual_comfort', scale: 'comfort' }
    ]
  },
  {
    id: 'visual_q6',
    imageId: 'visual_img_6',
    text: 'Какой герой лучше всего подходит к такому кадру?',
    options: [
      { id: 'a1', text: 'Замкнутый человек с внутренним конфликтом', profile: 'atmospheric_observer', scale: 'atmosphere' },
      { id: 'a2', text: 'Ранимый герой, которому хочется сопереживать', profile: 'emotional_viewer', scale: 'emotionality' },
      { id: 'a3', text: 'Активный герой, который ищет ответы', profile: 'intrigue_seeker', scale: 'tension' },
      { id: 'a4', text: 'Добрый герой, который ищет своё место', profile: 'visual_comfort', scale: 'comfort' }
    ]
  },
  {
    id: 'visual_q7',
    imageId: 'visual_img_7',
    text: 'Какой финал вы бы ожидали от такой истории?',
    options: [
      { id: 'a1', text: 'Открытый и неоднозначный', profile: 'atmospheric_observer', scale: 'atmosphere' },
      { id: 'a2', text: 'Эмоциональный и сильный', profile: 'emotional_viewer', scale: 'emotionality' },
      { id: 'a3', text: 'Неожиданный и эффектный', profile: 'intrigue_seeker', scale: 'tension' },
      { id: 'a4', text: 'Спокойный и светлый', profile: 'visual_comfort', scale: 'comfort' }
    ]
  },
  {
    id: 'visual_q8',
    imageId: 'visual_img_8',
    text: 'Какой фильм вам захотелось бы посмотреть после такого визуального настроения?',
    options: [
      { id: 'a1', text: 'Глубокий и атмосферный', profile: 'atmospheric_observer', scale: 'atmosphere' },
      { id: 'a2', text: 'Эмоциональный и человечный', profile: 'emotional_viewer', scale: 'emotionality' },
      { id: 'a3', text: 'Захватывающий и напряжённый', profile: 'intrigue_seeker', scale: 'tension' },
      { id: 'a4', text: 'Лёгкий и уютный', profile: 'visual_comfort', scale: 'comfort' }
    ]
  }
];

const SCALE_LABELS = { low: 'низкая', medium: 'средняя', high: 'высокая' };

export const VISUAL_FEEDBACK_REASONS = {
  too_dark: 'слишком мрачно',
  too_light: 'слишком светло/мягко',
  too_slow: 'слишком медленно',
  too_dynamic: 'слишком динамично',
  wrong_visual: 'не тот визуальный стиль',
  wrong_genre: 'не тот жанр',
  already_seen: 'уже видел',
  other: 'другое'
};

function scaleLevel(score) {
  if (score <= 2) return 'low';
  if (score <= 5) return 'medium';
  return 'high';
}

export function scaleLevelToValue(level) {
  if (level === 'low') return 33;
  if (level === 'high') return 100;
  return 66;
}

export function scaleScoreToValue(score, max = 8) {
  if (score == null) return 50;
  return Math.min(100, Math.max(0, Math.round((score / max) * 100)));
}

export function enrichVisualScales(scales, scaleScores = null) {
  return Object.fromEntries(
    SCALE_KEYS.map((key) => {
      const level = scales[key] || 'medium';
      const value = scaleScores?.[key] != null
        ? scaleScoreToValue(scaleScores[key])
        : scaleLevelToValue(level);
      return [key, { label: VISUAL_SCALE_NAMES[key], level, value }];
    })
  );
}

function findOption(questionId, answerId) {
  const question = VISUAL_QUESTIONS.find((q) => q.id === questionId);
  if (!question) return null;
  const option = question.options.find((o) => o.id === answerId);
  if (!option) return null;
  return { option, mapping: { profile: option.profile, scale: option.scale } };
}

export function validateVisualAnswers(answers) {
  if (!Array.isArray(answers) || answers.length !== VISUAL_QUESTIONS.length) {
    return { ok: false, error: 'Нужно ответить на все 8 изображений' };
  }

  const seen = new Set();
  for (const question of VISUAL_QUESTIONS) {
    const answer = answers.find((a) => a.questionId === question.id);
    if (!answer?.answerId) {
      return { ok: false, error: `Выберите вариант для изображения ${question.id.replace('visual_q', '')}` };
    }
    if (!findOption(question.id, answer.answerId)) {
      return { ok: false, error: 'Некорректный ответ' };
    }
    seen.add(question.id);
  }

  if (seen.size !== VISUAL_QUESTIONS.length) {
    return { ok: false, error: 'Ответы должны быть уникальны для каждого изображения' };
  }

  return { ok: true };
}

export function calculateVisualResult(answers) {
  const validation = validateVisualAnswers(answers);
  if (!validation.ok) return { error: validation.error };

  const scores = Object.fromEntries(PROFILE_KEYS.map((k) => [k, 0]));
  const scaleScores = Object.fromEntries(SCALE_KEYS.map((k) => [k, 0]));

  const enrichedAnswers = answers.map((a) => {
    const question = VISUAL_QUESTIONS.find((q) => q.id === a.questionId);
    const found = findOption(a.questionId, a.answerId);
    if (found) {
      scores[found.mapping.profile] += 1;
      scaleScores[found.mapping.scale] += 1;
    }
    const opt = found?.option;
    return {
      questionId: a.questionId,
      imageId: question?.imageId || '',
      answerId: a.answerId,
      answerText: opt?.text || '',
      questionText: question?.text || '',
      customText: String(a.customText || '').trim()
    };
  });

  const profile = [...PROFILE_KEYS].sort((a, b) => scores[b] - scores[a])[0];
  const profileData = VISUAL_PROFILES[profile];
  const scales = Object.fromEntries(
    SCALE_KEYS.map((key) => [key, scaleLevel(scaleScores[key])])
  );

  return {
    profile,
    profileTitle: profileData.title,
    profileDescription: profileData.description,
    profileShortDescription: profileData.shortDescription,
    scores,
    scales,
    scaleScores,
    scalesDetailed: enrichVisualScales(scales, scaleScores),
    answers: enrichedAnswers,
    suits: profileData.suits,
    avoid: profileData.avoid
  };
}

export function buildVisualDynamicsText(first, last) {
  if (!first || !last) return '';
  if (first.profile === last.profile) {
    return `Вы несколько раз получали профиль «${last.profileTitle}». Ваш визуальный стиль восприятия остаётся стабильным.`;
  }
  return `Сейчас вы чаще выбираете более ${getVisualShiftHint(last.profile)} истории, чем раньше.`;
}

function getVisualShiftHint(profile) {
  const hints = {
    atmospheric_observer: 'атмосферные, неоднозначные и визуально выразительные',
    emotional_viewer: 'эмоциональные и человечные',
    intrigue_seeker: 'напряжённые и интригующие',
    visual_comfort: 'мягкие, светлые и уютные'
  };
  return hints[profile] || 'подходящие вашему визуальному настроению';
}

export function buildVisualTestPrompt(visualTest) {
  if (!visualTest?.profile) return '';
  const profileData = VISUAL_PROFILES[visualTest.profile] || {};
  const scales = visualTest.scales || {};
  const scaleText = SCALE_KEYS.map((key) => {
    const raw = scales[key];
    const level = typeof raw === 'object' && raw?.level ? raw.level : raw;
    return `${VISUAL_SCALE_NAMES[key]}: ${SCALE_LABELS[level] || level || '—'}`;
  }).join('; ');

  return `\nВизуальный профиль восприятия (развлекательный тест по картинкам, не медицинская диагностика):
- Профиль: ${visualTest.profileTitle || profileData.title}
- ${profileData.shortDescription || profileData.description || ''}
- Шкалы: ${scaleText}
- Подходят: ${(profileData.suits || visualTest.suits || []).join(', ')}
- Лучше избегать: ${(profileData.avoid || visualTest.avoid || []).join(', ')}
Не ставь диагнозы. Описывай только стиль визуального восприятия контента.`;
}

export function buildVisualRecFeedbackPrompt(feedback = []) {
  if (!feedback?.length) return '';
  const recent = feedback.slice(-20);
  const lines = recent.map((item) => {
    const reason = VISUAL_FEEDBACK_REASONS[item.reason] || item.reason || 'другое';
    return `- «${item.title}»: ${reason}${item.note ? ` (${item.note})` : ''}`;
  });
  return `\nНежелательные визуальные рекомендации (обратная связь):\n${lines.join('\n')}`;
}

export function buildVisualRecommendationUserContext({
  visualTest,
  psychTest,
  movies,
  prefs,
  mediaType = null
}) {
  const watched = movies.filter((m) => m.status === 'watched');
  const want = movies.filter((m) => m.status === 'want');
  const watching = movies.filter((m) => m.status === 'watching');
  const dropped = movies.filter((m) => m.status === 'want' && m.tags?.includes?.('dropped'));
  const dislikedNotes = movies
    .filter((m) => m.notes?.disliked?.trim())
    .map((m) => `${m.title}: ${m.notes.disliked.trim()}`);

  const battleTop = [...watched]
    .filter((m) => (m.battleWins || 0) > 0 || (m.battleScore || 0) > 0)
    .sort((a, b) => (b.battleScore || 0) - (a.battleScore || 0))
    .slice(0, 10)
    .map((m) => `${m.title}${m.rating ? ` (${m.rating}/10)` : ''}`);

  const ratings = watched
    .filter((m) => m.rating)
    .map((m) => `${m.title}: ${m.rating}/10`)
    .slice(0, 40);

  const typeHint = mediaType === 'tv'
    ? 'Приоритет — сериалы, но можно смешивать с фильмами.'
    : mediaType === 'movie'
      ? 'Приоритет — фильмы, но можно смешивать с сериалами.'
      : 'Можно смешивать фильмы и сериалы.';

  return `Данные пользователя:
visualTestProfile: ${JSON.stringify({
    profile: visualTest.profile,
    profileTitle: visualTest.profileTitle,
    scores: visualTest.scores,
    scales: visualTest.scales
  })}
visualTestScales: ${JSON.stringify(visualTest.scales)}
psychTestProfile: ${psychTest?.profile ? JSON.stringify({
    profile: psychTest.profile,
    profileTitle: psychTest.profileTitle,
    scales: psychTest.scales
  }) : 'нет'}
watchedMovies: ${watched.map((m) => m.title).join(', ') || 'нет'}
ratings: ${ratings.join('; ') || 'нет'}
droppedMovies: ${dropped.map((m) => m.title).join(', ') || 'нет'}
dislikedMovies: ${dislikedNotes.join('; ') || 'нет'}
currentWatchlist: ${want.map((m) => m.title).join(', ') || 'нет'}
watchingNow: ${watching.map((m) => m.title).join(', ') || 'нет'}
blacklist: ${JSON.stringify(prefs?.blacklist || {})}
battleTop: ${battleTop.join(', ') || 'нет'}
visualRecFeedback: ${JSON.stringify((prefs?.visualRecFeedback || []).slice(-15))}
psychRecFeedback: ${JSON.stringify((prefs?.psychRecFeedback || []).slice(-10))}
${typeHint}

Приоритет сигналов:
1. Чёрный список AI и явные исключения
2. Статусы «Не хочу смотреть» / «Бросил»
3. Личные оценки и заметки «не понравилось»
4. BattleScore из мини-игры
5. Обычный психологический тест
6. Визуальный тест восприятия
7. Жанры и история просмотров
8. Текущий запрос`;
}

export function buildVisualRecommendationPrompt(contextBlock, blacklistPrompt = '', titleRule = '') {
  return `Ты — AI-помощник в персональном трекере фильмов и сериалов.

Твоя задача — рекомендовать фильмы и сериалы на основе визуального теста восприятия пользователя, его списка, оценок и ограничений.

Важно:
- Не ставь диагнозы.
- Не используй медицинские формулировки.
- Не называй пользователя тревожным, депрессивным, травмированным и т.д.
- Описывай только стиль визуального восприятия, настроение и предпочтения в контенте.
- Учитывай blacklist пользователя.
- Учитывай уже просмотренные фильмы и оценки.
- Учитывай статусы «Не хочу смотреть» и «Бросил», если они есть.
- Учитывай обычный психологический тест, если он есть.
- Учитывай battleScore, если он есть.
- Не рекомендуй фильмы, которые пользователь исключил через обратную связь.
- Не рекомендуй то, что уже есть в списке, кроме случаев когда это в «Хочу посмотреть» и уместно.
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
      "visualConnection": "Как связано с визуальным профилем",
      "visualMood": "визуальное настроение",
      "pace": "темп",
      "tmdbQuery": "запрос для поиска в TMDB"
    }
  ]
}`;
}

export function parseVisualRecommendationsJson(content) {
  const raw = String(content || '').trim();
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('invalid_json');
  const parsed = JSON.parse(jsonMatch[0]);
  const list = parsed.recommendations || parsed;
  if (!Array.isArray(list)) throw new Error('invalid_json');
  return list.slice(0, 8);
}
