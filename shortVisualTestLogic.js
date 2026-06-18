import crypto from 'crypto';

export const IMAGE_TYPES = {
  place: {
    id: 'place',
    src: '/public/visual-tests/place.png',
    alt: 'Выбери место — уютная комната с 10 местами',
    optionCount: 10,
    defaultQuestion: 'Где бы вы хотели устроиться для просмотра?'
  },
  doors: {
    id: 'doors',
    src: '/public/visual-tests/doors.png',
    alt: 'Выбери дверь — 8 дверей в разные миры',
    optionCount: 8,
    defaultQuestion: 'В какой мир вам хочется зайти?'
  },
  characters: {
    id: 'characters',
    src: '/public/visual-tests/characters.png',
    alt: 'Выбери персонажа',
    optionCount: 10,
    defaultQuestion: 'За каким героем вам было бы интереснее наблюдать?'
  },
  landscapes: {
    id: 'landscapes',
    src: '/public/visual-tests/landscapes.png',
    alt: 'Выбери пейзаж',
    optionCount: 8,
    defaultQuestion: 'В какую атмосферу хочется попасть?'
  }
};

export const SHORT_VISUAL_TESTS = [
  {
    id: 'movie_genre_visual_test',
    title: 'Какой жанр вам сейчас подойдёт?',
    description: 'Определите жанровый вектор — романтика, интрига, глубина или приключения.',
    cardHint: '4 картинки · ~2 минуты'
  },
  {
    id: 'evening_visual_test',
    title: 'Что посмотреть сегодня вечером?',
    description: 'Подберите фильм под вечер: лёгкий, атмосферный, с интригой или вдохновляющий.',
    cardHint: '4 картинки · ~2 минуты'
  },
  {
    id: 'viewing_style_visual_test',
    title: 'Ваш стиль просмотра',
    description: 'Узнайте, как вы обычно выбираете кино — по эмоциям, смыслу, динамике или комфорту.',
    cardHint: '4 картинки · ~2 минуты'
  },
  {
    id: 'mood_visual_test',
    title: 'Фильм под внутреннее состояние',
    description: 'Текущее настроение для рекомендаций прямо сейчас — отдых, погружение, напряжение или вдохновение.',
    cardHint: '4 картинки · ~2 минуты'
  }
];

const QUESTION_SEQUENCE = ['place', 'doors', 'characters', 'landscapes'];

const TEST_QUESTIONS = {
  movie_genre_visual_test: [
    'Где бы вы хотели устроиться для просмотра фильма прямо сейчас?',
    'В какой мир вам хочется зайти?',
    'За каким героем вам было бы интереснее наблюдать?',
    'В какую атмосферу хочется попасть?'
  ],
  evening_visual_test: [
    'Какое место больше похоже на ваше состояние сейчас?',
    'Какой вход кажется самым притягательным сегодня?',
    'Кто лучше совпадает с вашим настроением?',
    'Какой фон больше хочется видеть в фильме?'
  ],
  viewing_style_visual_test: [
    'Как вы любите смотреть фильмы?',
    'Что для вас важнее в истории?',
    'Какой тип героя вам ближе?',
    'Какое кино-пространство вам приятнее?'
  ],
  mood_visual_test: [
    'Где бы вы сейчас хотели оказаться?',
    'Куда вас больше тянет?',
    'Кто вызывает больше интереса?',
    'Какой мир сейчас ближе?'
  ]
};

function mapScores(entries) {
  const out = {};
  for (const [key, profiles] of entries) {
    const num = Number(key);
    const list = Array.isArray(profiles) ? profiles : [profiles];
    out[num] = [...new Set([...(out[num] || []), ...list])];
  }
  return out;
}

const SCORE_MAPS = {
  movie_genre_visual_test: {
    place: mapScores([
      ['1', ['romance']], ['5', ['romance']], ['6', ['romance']], ['9', ['romance']],
      ['3', ['thriller', 'drama']], ['8', ['thriller']], ['10', ['thriller', 'drama']],
      ['4', ['drama', 'adventure']], ['5', ['drama']], ['9', ['drama']],
      ['2', ['adventure']], ['7', ['adventure']]
    ]),
    doors: mapScores([
      ['1', ['romance']], ['3', ['romance', 'drama']], ['8', ['romance']],
      ['4', ['thriller']], ['6', ['thriller', 'drama']], ['7', ['thriller', 'drama', 'adventure']],
      ['5', ['drama']], ['2', ['adventure']]
    ]),
    characters: mapScores([
      ['2', ['romance']], ['8', ['romance']], ['10', ['romance']],
      ['1', ['thriller', 'drama']], ['7', ['thriller']],
      ['3', ['drama']], ['5', ['drama']],
      ['6', ['adventure']], ['9', ['adventure']]
    ]),
    landscapes: mapScores([
      ['1', ['romance']], ['5', ['romance']], ['6', ['romance']],
      ['3', ['thriller', 'drama']], ['4', ['thriller']],
      ['7', ['drama']], ['8', ['drama', 'adventure']],
      ['2', ['adventure']]
    ])
  },
  evening_visual_test: {
    place: mapScores([
      ['1', ['light']], ['5', ['light']], ['6', ['light']], ['7', ['light', 'inspiration']],
      ['2', ['atmospheric', 'inspiration']], ['3', ['atmospheric']], ['4', ['atmospheric', 'inspiration']], ['9', ['atmospheric']],
      ['8', ['intrigue']], ['10', ['intrigue', 'inspiration']]
    ]),
    doors: mapScores([
      ['1', ['light']], ['8', ['light']],
      ['5', ['atmospheric', 'inspiration']], ['6', ['atmospheric']], ['7', ['atmospheric', 'intrigue']],
      ['4', ['intrigue']], ['2', ['inspiration']]
    ]),
    characters: mapScores([
      ['2', ['light']], ['8', ['light']],
      ['1', ['atmospheric']], ['3', ['atmospheric']], ['10', ['atmospheric']],
      ['4', ['intrigue']], ['7', ['intrigue']],
      ['5', ['inspiration']], ['6', ['inspiration']], ['9', ['inspiration']]
    ]),
    landscapes: mapScores([
      ['1', ['light']], ['5', ['light']], ['6', ['light']],
      ['3', ['atmospheric']], ['7', ['atmospheric']],
      ['4', ['intrigue']],
      ['2', ['inspiration']], ['6', ['inspiration']], ['8', ['inspiration']]
    ])
  },
  viewing_style_visual_test: {
    place: mapScores([
      ['1', ['emotional', 'comfort']], ['5', ['emotional']], ['6', ['emotional', 'comfort']],
      ['3', ['intellectual']], ['4', ['intellectual']], ['9', ['intellectual']],
      ['8', ['tension']], ['10', ['tension']],
      ['2', ['comfort']], ['7', ['comfort']]
    ]),
    doors: mapScores([
      ['1', ['emotional', 'comfort']], ['3', ['emotional']], ['8', ['emotional', 'comfort']],
      ['5', ['intellectual']], ['6', ['intellectual']], ['7', ['intellectual', 'tension']],
      ['4', ['tension']], ['2', ['comfort']]
    ]),
    characters: mapScores([
      ['2', ['emotional']], ['8', ['emotional']],
      ['3', ['intellectual']], ['5', ['intellectual']],
      ['1', ['tension']], ['4', ['tension']], ['7', ['tension']], ['9', ['tension']],
      ['10', ['comfort']]
    ]),
    landscapes: mapScores([
      ['1', ['emotional', 'comfort']], ['5', ['emotional', 'comfort']], ['6', ['emotional', 'comfort']],
      ['3', ['intellectual']], ['7', ['intellectual', 'comfort']], ['8', ['intellectual']],
      ['4', ['tension']]
    ])
  },
  mood_visual_test: {
    place: mapScores([
      ['1', ['rest']], ['5', ['rest']], ['6', ['rest']], ['7', ['rest']],
      ['3', ['immersion']], ['4', ['immersion', 'inspiration']], ['9', ['immersion']],
      ['8', ['tension_want']], ['10', ['tension_want', 'inspiration']],
      ['2', ['inspiration']], ['7', ['inspiration']]
    ]),
    doors: mapScores([
      ['1', ['rest']], ['8', ['rest']],
      ['5', ['immersion', 'inspiration']], ['6', ['immersion']], ['7', ['immersion', 'tension_want']],
      ['4', ['tension_want']], ['2', ['inspiration']]
    ]),
    characters: mapScores([
      ['2', ['rest']], ['8', ['rest']],
      ['1', ['immersion']], ['3', ['immersion']], ['5', ['immersion', 'inspiration']],
      ['4', ['tension_want']], ['7', ['tension_want']], ['9', ['tension_want', 'inspiration']],
      ['6', ['inspiration']]
    ]),
    landscapes: mapScores([
      ['1', ['rest']], ['5', ['rest']], ['6', ['rest', 'inspiration']],
      ['3', ['immersion']], ['7', ['immersion']], ['8', ['immersion', 'inspiration']],
      ['4', ['tension_want']],
      ['2', ['inspiration']]
    ])
  }
};

export const PROFILE_DEFS = {
  movie_genre_visual_test: {
    romance: {
      profileTitle: 'Романтическая драма / feel-good',
      profileDescription: 'Сейчас вам ближе тёплые истории, отношения, эмоции и приятное послевкусие после просмотра.',
      primaryMood: 'warmth',
      secondaryMood: 'emotion',
      pace: 'medium',
      comfort: 'high',
      depth: 'medium',
      recommendedGenres: ['романтическая драма', 'feel-good', 'лёгкая драма', 'мелодрама', 'семейный'],
      avoid: ['тяжёлый хоррор', 'пустой экшен', 'слишком мрачные сюжеты'],
      suits: ['романтические драмы', 'лёгкие драмы', 'feel-good', 'уютные сериалы', 'фильмы про отношения']
    },
    thriller: {
      profileTitle: 'Триллер / детектив / мистика',
      profileDescription: 'Вам ближе интрига, тайна, напряжение и постепенное раскрытие — истории, где хочется следить за каждой деталью.',
      primaryMood: 'mystery',
      secondaryMood: 'tension',
      pace: 'medium_fast',
      comfort: 'low',
      depth: 'medium_high',
      recommendedGenres: ['триллер', 'детектив', 'криминал', 'мистика', 'неонуар'],
      avoid: ['простые комедии', 'слишком медленное кино без интриги'],
      suits: ['триллеры', 'детективы', 'криминальные сериалы', 'психологические триллеры']
    },
    drama: {
      profileTitle: 'Драма / психологическое кино',
      profileDescription: 'Сейчас вам ближе глубокие истории с внутренним конфликтом, подтекстом и атмосферой, которая остаётся после финала.',
      primaryMood: 'depth',
      secondaryMood: 'introspection',
      pace: 'medium_slow',
      comfort: 'medium',
      depth: 'high',
      recommendedGenres: ['психологическая драма', 'авторское кино', 'философская фантастика', 'арт-драма'],
      avoid: ['поверхностные комедии', 'пустой экшен', 'слишком простые сюжеты'],
      suits: ['психологические драмы', 'авторское кино', 'медленные атмосферные сериалы']
    },
    adventure: {
      profileTitle: 'Приключения / фантастика / путь героя',
      profileDescription: 'Вам ближе движение, перемены, путь героя и истории, где мир открывается шаг за шагом.',
      primaryMood: 'journey',
      secondaryMood: 'growth',
      pace: 'medium',
      comfort: 'medium',
      depth: 'medium',
      recommendedGenres: ['приключения', 'фэнтези', 'фантастика', 'роуд-муви', 'история взросления'],
      avoid: ['слишком статичные драмы', 'камерные истории без движения'],
      suits: ['приключения', 'фэнтези', 'фантастика', 'роуд-муви', 'истории взросления']
    }
  },
  evening_visual_test: {
    light: {
      profileTitle: 'Лёгкий вечер',
      profileDescription: 'Сегодня лучше выбрать что-то лёгкое и приятное — без перегруза, с комфортным темпом и хорошим настроением.',
      primaryMood: 'light',
      secondaryMood: 'comfort',
      pace: 'light_medium',
      comfort: 'high',
      depth: 'low_medium',
      recommendedGenres: ['комедия', 'романтика', 'feel-good', 'семейный', 'лёгкий сериал'],
      avoid: ['тяжёлые драмы', 'хорроры', 'давящие триллеры'],
      suits: ['комедии', 'романтику', 'feel-good', 'фильмы до 90 минут']
    },
    atmospheric: {
      profileTitle: 'Атмосферный вечер',
      profileDescription: 'Вечер для погружения в настроение, визуальную атмосферу и истории с подтекстом — не обязательно быстрые, но запоминающиеся.',
      primaryMood: 'atmosphere',
      secondaryMood: 'depth',
      pace: 'medium_slow',
      comfort: 'medium',
      depth: 'high',
      recommendedGenres: ['арт-драма', 'неонуар', 'философская фантастика', 'атмосферная драма'],
      avoid: ['пустой экшен', 'слишком простые комедии'],
      suits: ['атмосферные драмы', 'арт-драмы', 'фильмы с сильным визуалом']
    },
    intrigue: {
      profileTitle: 'Вечер с интригой',
      profileDescription: 'Сегодня хочется напряжения, загадки и сюжета, который держит внимание до финала.',
      primaryMood: 'intrigue',
      secondaryMood: 'tension',
      pace: 'medium_fast',
      comfort: 'low_medium',
      depth: 'medium_high',
      recommendedGenres: ['детектив', 'триллер', 'криминал', 'мистика'],
      avoid: ['спокойные бытовые драмы', 'уютные сериалы без конфликта'],
      suits: ['детективы', 'триллеры', 'фильмы с неожиданным финалом']
    },
    inspiration: {
      profileTitle: 'Вечер для вдохновения',
      profileDescription: 'Вечер для историй о росте, творчестве, пути и переменах — фильмов, после которых хочется что-то сделать.',
      primaryMood: 'inspiration',
      secondaryMood: 'growth',
      pace: 'medium',
      comfort: 'medium_high',
      depth: 'medium',
      recommendedGenres: ['биография', 'приключения', 'мотивационная драма', 'роуд-муви'],
      avoid: ['мрачные сюжеты без надежды', 'слишком тяжёлые драмы'],
      suits: ['мотивирующие фильмы', 'биографии', 'истории про рост']
    }
  },
  viewing_style_visual_test: {
    emotional: {
      profileTitle: 'Эмоциональный зритель',
      profileDescription: 'Вы выбираете чувства, тепло, отношения и человечность. Вам важны герои, эмоции и финал с послевкусием.',
      primaryMood: 'emotion',
      secondaryMood: 'warmth',
      pace: 'medium',
      comfort: 'high',
      depth: 'medium',
      recommendedGenres: ['драма', 'романтическая драма', 'семейный', 'мелодрама'],
      avoid: ['холодные интеллектуальные фильмы без эмоций'],
      suits: ['драмы', 'семейные истории', 'сериалы с сильными персонажами']
    },
    intellectual: {
      profileTitle: 'Интеллектуальный наблюдатель',
      profileDescription: 'Вы любите подтекст, идеи, внутренний конфликт и фильмы, после которых хочется подумать.',
      primaryMood: 'depth',
      secondaryMood: 'ideas',
      pace: 'medium_slow',
      comfort: 'medium',
      depth: 'high',
      recommendedGenres: ['философская фантастика', 'психологическая драма', 'авторское кино', 'историческая драма'],
      avoid: ['поверхностные комедии', 'пустой экшен'],
      suits: ['авторское кино', 'фильмы с моральным выбором', 'открытые финалы']
    },
    tension: {
      profileTitle: 'Искатель напряжения',
      profileDescription: 'Вы выбираете конфликт, интригу, энергию и ощущение движения — кино, где постоянно что-то происходит.',
      primaryMood: 'tension',
      secondaryMood: 'dynamics',
      pace: 'fast',
      comfort: 'low',
      depth: 'medium',
      recommendedGenres: ['триллер', 'детектив', 'криминал', 'экшен', 'мистика'],
      avoid: ['слишком медленные драмы', 'фильмы без событий'],
      suits: ['триллеры', 'детективы', 'динамичные сериалы']
    },
    comfort: {
      profileTitle: 'Комфортный зритель',
      profileDescription: 'Вы выбираете комфорт, визуальную мягкость и приятный просмотр без перегруза.',
      primaryMood: 'comfort',
      secondaryMood: 'light',
      pace: 'slow_medium',
      comfort: 'high',
      depth: 'low_medium',
      recommendedGenres: ['feel-good', 'романтическая комедия', 'семейный', 'лёгкий сериал'],
      avoid: ['тяжёлые драмы', 'хорроры', 'давящая атмосфера'],
      suits: ['feel-good', 'добрые драмы', 'уютные истории']
    }
  },
  mood_visual_test: {
    rest: {
      profileTitle: 'Хочу отдохнуть',
      profileDescription: 'Сейчас лучше выбрать лёгкое и приятное кино — без давления, с комфортным темпом и хорошим настроением.',
      primaryMood: 'rest',
      secondaryMood: 'comfort',
      pace: 'light',
      comfort: 'high',
      depth: 'low',
      recommendedGenres: ['комедия', 'романтика', 'feel-good', 'лёгкий сериал'],
      avoid: ['тяжёлые драмы', 'хорроры', 'давящие триллеры', 'слишком медленное кино'],
      suits: ['лёгкие фильмы', 'комедии', 'фильмы до 90 минут']
    },
    immersion: {
      profileTitle: 'Хочу погрузиться',
      profileDescription: 'Сейчас хочется глубины, атмосферы и историй с медленным раскрытием — кино, в которое можно войти.',
      primaryMood: 'immersion',
      secondaryMood: 'depth',
      pace: 'medium_slow',
      comfort: 'medium',
      depth: 'high',
      recommendedGenres: ['арт-драма', 'философская фантастика', 'психологическая драма'],
      avoid: ['поверхностные комедии', 'пустой экшен', 'слишком простые сюжеты'],
      suits: ['глубокие драмы', 'арт-драмы', 'медленные сериалы']
    },
    tension_want: {
      profileTitle: 'Хочу напряжения',
      profileDescription: 'Сейчас тянет к интриге, тайне и динамике — историям, где каждый поворот держит внимание.',
      primaryMood: 'tension',
      secondaryMood: 'mystery',
      pace: 'medium_fast',
      comfort: 'low',
      depth: 'medium_high',
      recommendedGenres: ['триллер', 'детектив', 'криминал', 'мистика'],
      avoid: ['спокойные бытовые драмы', 'уютные сериалы без конфликта'],
      suits: ['триллеры', 'детективы', 'фильмы с неожиданным финалом']
    },
    inspiration: {
      profileTitle: 'Хочу вдохновения',
      profileDescription: 'Сейчас хочется историй о росте, пути, творчестве и переменах — фильмов с надеждой и движением вперёд.',
      primaryMood: 'inspiration',
      secondaryMood: 'growth',
      pace: 'medium',
      comfort: 'medium_high',
      depth: 'medium',
      recommendedGenres: ['биография', 'приключения', 'мотивационная драма', 'роуд-муви'],
      avoid: ['фильмы без развития героя', 'мрачные сюжеты без надежды'],
      suits: ['биографии', 'приключения', 'истории взросления']
    }
  }
};

export const ANSWER_MOOD_MAP = {
  place: {
    1: ['comfort', 'emotion'], 2: ['aesthetic', 'inspiration'], 3: ['depth', 'introspection'],
    4: ['immersion', 'depth'], 5: ['nostalgia', 'comfort'], 6: ['comfort', 'light'],
    7: ['balance'], 8: ['focus', 'tension'], 9: ['aesthetic', 'depth'], 10: ['freedom', 'indie']
  },
  doors: {
    1: ['romance', 'comfort'], 2: ['adventure', 'growth'], 3: ['nostalgia', 'emotion'],
    4: ['tension', 'crime'], 5: ['calm', 'depth'], 6: ['cold_aesthetic', 'depth'],
    7: ['mystery', 'journey'], 8: ['comfort', 'feel_good']
  },
  characters: {
    1: ['mystery', 'depth'], 2: ['romance', 'emotion'], 3: ['intellectual', 'depth'],
    4: ['ambition', 'strategy'], 5: ['creative', 'indie'], 6: ['adventure', 'journey'],
    7: ['dark_mystery', 'tension'], 8: ['comfort', 'warmth'], 9: ['energy', 'action'],
    10: ['style', 'aesthetic']
  },
  landscapes: {
    1: ['romance', 'warmth'], 2: ['growth', 'adventure'], 3: ['mystery', 'tension'],
    4: ['urban', 'crime'], 5: ['comfort', 'family'], 6: ['light', 'freedom'],
    7: ['calm', 'depth'], 8: ['journey', 'change']
  }
};

export const SHORT_VISUAL_FEEDBACK_REASONS = {
  too_heavy: 'слишком тяжёлое',
  too_light: 'слишком лёгкое',
  too_slow: 'слишком медленное',
  too_dynamic: 'слишком динамичное',
  wrong_genre: 'не тот жанр',
  wrong_atmosphere: 'не та атмосфера',
  already_seen: 'уже видел',
  other: 'другое'
};

export function getTestQuestions(testId) {
  const test = SHORT_VISUAL_TESTS.find((t) => t.id === testId);
  if (!test) return null;
  const texts = TEST_QUESTIONS[testId] || [];
  return QUESTION_SEQUENCE.map((imageType, index) => ({
    id: `q${index + 1}`,
    imageType,
    text: texts[index] || IMAGE_TYPES[imageType].defaultQuestion,
    optionCount: IMAGE_TYPES[imageType].optionCount,
    imageSrc: IMAGE_TYPES[imageType].src,
    imageAlt: IMAGE_TYPES[imageType].alt
  }));
}

function scoreMoods(answers) {
  const moodScores = {};
  for (const ans of answers) {
    const moods = ANSWER_MOOD_MAP[ans.imageType]?.[ans.selectedOption] || [];
    for (const mood of moods) {
      moodScores[mood] = (moodScores[mood] || 0) + 1;
    }
  }
  const sorted = Object.entries(moodScores).sort((a, b) => b[1] - a[1]);
  return {
    primaryMood: sorted[0]?.[0] || 'balance',
    secondaryMood: sorted[1]?.[0] || sorted[0]?.[0] || 'comfort'
  };
}

function scoreProfiles(testId, answers) {
  const map = SCORE_MAPS[testId];
  const scores = {};
  if (!map) return scores;

  for (const ans of answers) {
    const profiles = map[ans.imageType]?.[ans.selectedOption] || [];
    for (const profile of profiles) {
      scores[profile] = (scores[profile] || 0) + 1;
    }
  }
  return scores;
}

function pickTopProfiles(scores, profileDefs) {
  const sorted = Object.entries(scores)
    .filter(([key]) => profileDefs[key])
    .sort((a, b) => b[1] - a[1]);

  if (!sorted.length) {
    const fallback = Object.keys(profileDefs)[0];
    return { primary: fallback, secondary: fallback, scores: { [fallback]: 0 } };
  }

  const primary = sorted[0][0];
  const secondary = sorted[1]?.[0] || primary;
  return { primary, secondary, scores: Object.fromEntries(sorted) };
}

export function calculateShortVisualResult(testId, answers) {
  const test = SHORT_VISUAL_TESTS.find((t) => t.id === testId);
  if (!test) return { error: 'Неизвестный тест' };

  const questions = getTestQuestions(testId);
  if (!Array.isArray(answers) || answers.length !== 4) {
    return { error: 'Нужны ответы на все 4 вопроса' };
  }

  const normalized = [];
  for (let i = 0; i < 4; i++) {
    const expected = questions[i];
    const ans = answers[i];
    const imageType = ans.imageType || expected.imageType;
    const selectedOption = Number(ans.selectedOption);
    if (imageType !== expected.imageType) {
      return { error: `Неверный тип изображения для вопроса ${i + 1}` };
    }
    if (!Number.isInteger(selectedOption) || selectedOption < 1 || selectedOption > expected.optionCount) {
      return { error: `Выберите номер от 1 до ${expected.optionCount} для вопроса ${i + 1}` };
    }
    normalized.push({ imageType, selectedOption });
  }

  const profileDefs = PROFILE_DEFS[testId];
  const profileScores = scoreProfiles(testId, normalized);
  const { primary, secondary } = pickTopProfiles(profileScores, profileDefs);
  const primaryDef = profileDefs[primary];
  const secondaryDef = profileDefs[secondary];
  const moodScores = scoreMoods(normalized);

  return {
    testId,
    testTitle: test.title,
    answers: normalized,
    profile: primary,
    secondaryProfile: secondary,
    profileScores,
    profileTitle: primaryDef.profileTitle,
    profileDescription: primaryDef.profileDescription,
    secondaryProfileTitle: secondaryDef.profileTitle,
    primaryMood: moodScores.primaryMood,
    secondaryMood: moodScores.secondaryMood,
    pace: primaryDef.pace,
    comfort: primaryDef.comfort,
    depth: primaryDef.depth,
    recommendedGenres: primaryDef.recommendedGenres,
    avoid: primaryDef.avoid,
    suits: primaryDef.suits,
    recommendationProfile: {
      testId,
      profileTitle: primaryDef.profileTitle,
      primaryMood: moodScores.primaryMood,
      secondaryMood: moodScores.secondaryMood,
      pace: primaryDef.pace,
      comfort: primaryDef.comfort,
      depth: primaryDef.depth,
      recommendedGenres: primaryDef.recommendedGenres,
      avoid: primaryDef.avoid
    }
  };
}

function generateResultId() {
  return `svt_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
}

export function saveShortVisualTestResult(prefs, result) {
  if (!prefs.shortVisualTests) {
    prefs.shortVisualTests = { lastResults: {}, history: [] };
  }
  normalizeShortVisualPrefs(prefs);

  const record = {
    id: generateResultId(),
    testId: result.testId,
    testTitle: result.testTitle,
    completedAt: new Date().toISOString(),
    answers: result.answers,
    profile: result.profile,
    secondaryProfile: result.secondaryProfile,
    profileScores: result.profileScores,
    profileTitle: result.profileTitle,
    profileDescription: result.profileDescription,
    secondaryProfileTitle: result.secondaryProfileTitle,
    primaryMood: result.primaryMood,
    secondaryMood: result.secondaryMood,
    pace: result.pace,
    comfort: result.comfort,
    depth: result.depth,
    recommendedGenres: result.recommendedGenres,
    avoid: result.avoid,
    suits: result.suits,
    recommendationProfile: result.recommendationProfile
  };

  prefs.shortVisualTests.lastResults[result.testId] = record;
  prefs.shortVisualTests.history.unshift(record);
  if (prefs.shortVisualTests.history.length > 20) {
    prefs.shortVisualTests.history = prefs.shortVisualTests.history.slice(0, 20);
  }

  return record;
}

export function normalizeShortVisualPrefs(prefs) {
  if (!prefs.shortVisualTests) {
    prefs.shortVisualTests = { lastResults: {}, history: [] };
  }
  if (!prefs.shortVisualTests.lastResults) prefs.shortVisualTests.lastResults = {};
  if (!Array.isArray(prefs.shortVisualTests.history)) prefs.shortVisualTests.history = [];
  if (!Array.isArray(prefs.shortVisualRecFeedback)) prefs.shortVisualRecFeedback = [];
}

export function findShortVisualResultById(prefs, resultId) {
  if (!resultId) return null;
  normalizeShortVisualPrefs(prefs);
  const fromHistory = prefs.shortVisualTests.history.find((r) => r.id === resultId);
  if (fromHistory) return fromHistory;
  return Object.values(prefs.shortVisualTests.lastResults).find((r) => r.id === resultId) || null;
}

export function buildShortVisualTestPrompt(lastResults) {
  if (!lastResults || !Object.keys(lastResults).length) return '';
  const lines = Object.values(lastResults).map((r) =>
    `- «${r.testTitle}»: ${r.profileTitle} (${r.completedAt?.slice(0, 10) || ''})`
  );
  return `\nКороткие визуальные кино-тесты (развлекательный подбор, не диагностика):\n${lines.join('\n')}`;
}

export function buildShortVisualRecFeedbackPrompt(feedback = []) {
  if (!feedback?.length) return '';
  const recent = feedback.slice(-20);
  const lines = recent.map((item) => {
    const reason = SHORT_VISUAL_FEEDBACK_REASONS[item.reason] || item.reason || 'другое';
    return `- «${item.title}»: ${reason}${item.note ? ` (${item.note})` : ''}`;
  });
  return `\nОбратная связь по коротким визуальным тестам «Не хочу такое»:\n${lines.join('\n')}`;
}

export function buildShortVisualRecommendationUserContext({
  shortVisualResult,
  psychTest,
  visualTest,
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
visualShortTestResult: ${JSON.stringify(shortVisualResult)}
selectedAnswers: ${JSON.stringify(shortVisualResult?.answers || [])}
watchedMovies: ${watched.map((m) => m.title).join(', ') || 'нет'}
watchlist: ${want.map((m) => m.title).join(', ') || 'нет'}
ratings: ${ratings.join('; ') || 'нет'}
droppedMovies: ${dropped.map((m) => m.title).join(', ') || 'нет'}
dislikedMovies: ${dislikedNotes.join('; ') || 'нет'}
watchingNow: ${watching.map((m) => m.title).join(', ') || 'нет'}
blacklist: ${JSON.stringify(prefs?.blacklist || {})}
battleTop: ${battleTop.join(', ') || 'нет'}
psychTest: ${psychTest?.profile ? JSON.stringify({ profile: psychTest.profile, profileTitle: psychTest.profileTitle }) : 'нет'}
visualTest: ${visualTest?.profile ? JSON.stringify({ profile: visualTest.profile, profileTitle: visualTest.profileTitle }) : 'нет'}
shortVisualRecFeedback: ${JSON.stringify((prefs?.shortVisualRecFeedback || []).slice(-15))}
${typeHint}`;
}

export function buildShortVisualRecommendationPrompt(contextBlock, blacklistPrompt = '', titleRule = '') {
  return `Ты — AI-помощник в персональном трекере фильмов и сериалов.

Твоя задача — рекомендовать фильмы и сериалы на основе короткого визуального теста пользователя.

Важно:
- Это развлекательный тест, а не диагностика.
- Не используй медицинские формулировки.
- Не называй пользователя тревожным, депрессивным, травмированным и т.д.
- Описывай только стиль просмотра, настроение, жанровый вкус и предпочтения в контенте.
- Учитывай список пользователя, оценки и ограничения.
- Учитывай blacklist.
- Учитывай статусы «Не хочу смотреть» и «Бросил», если они есть.
- Не рекомендуй уже просмотренное.
- Дай ровно 8 рекомендаций.

${contextBlock}
${blacklistPrompt}
${titleRule}

Верни JSON-массив из 8 объектов. Поле testConnection — конкретное предложение (1–2 строки), как фильм связан с профилем пользователя и его ответами на картинки. Не пиши буквально «Связь с результатом теста» или другие названия полей.

{"recommendations":[{"title":"Название","type":"movie или series","year":2014,"genres":["жанр"],"reason":"Почему подходит","testConnection":"Подходит профилю «Спокойный вечер»: мягкий свет, уютная атмосфера и нет перегруза","mood":"настроение","pace":"темп","tmdbQuery":"запрос для TMDB"}]}`;
}

export function parseShortVisualRecommendationsJson(content) {
  const trimmed = String(content || '').trim();
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('invalid_json');
  const parsed = JSON.parse(jsonMatch[0]);
  const list = parsed.recommendations || parsed;
  if (!Array.isArray(list)) throw new Error('invalid_json');
  return list.slice(0, 8);
}

const TEST_CONNECTION_PLACEHOLDERS = new Set([
  'связь с результатом теста',
  'как связано с результатом теста',
  'связь с визуальным профилем',
  'как связано с визуальным профилем',
  'связь с результатом визуального теста'
]);

export function sanitizeShortVisualTestConnection(connection, profileTitle = '') {
  const value = String(connection || '').trim();
  if (!value || TEST_CONNECTION_PLACEHOLDERS.has(value.toLowerCase())) {
    return profileTitle
      ? `Подходит вашему профилю «${profileTitle}» по настроению и визуальному стилю.`
      : '';
  }
  return value;
}
