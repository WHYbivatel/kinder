/** Server-side UI messages (mirrors client locale keys where needed). */
const MESSAGES = {
  ru: {
    tmdbUnavailable: 'TMDB API недоступен',
    emptyBattleResult: 'Пустой результат',
    saveError: 'Ошибка сохранения'
  },
  kk: {
    tmdbUnavailable: 'TMDB API қолжетімсіз',
    emptyBattleResult: 'Бос нәтиже',
    saveError: 'Сақтау қатесі'
  },
  en: {
    tmdbUnavailable: 'TMDB API unavailable',
    emptyBattleResult: 'Empty result',
    saveError: 'Save error'
  }
};

export function normalizeAppLang(lang) {
  const raw = String(lang || 'ru').toLowerCase();
  if (raw === 'en' || raw === 'en-us') return 'en';
  if (raw === 'kk' || raw === 'kz' || raw === 'kk-kz') return 'kk';
  return 'ru';
}

export function normalizeTmdbLanguage(lang) {
  const app = normalizeAppLang(lang);
  if (app === 'en') return 'en-US';
  if (app === 'kk') return 'kk-KZ';
  return 'ru-RU';
}

export function tmdbFallbackChain(lang) {
  const app = normalizeAppLang(lang);
  if (app === 'kk') return ['kk-KZ', 'ru-RU'];
  if (app === 'en') return ['en-US', 'ru-RU'];
  return ['ru-RU', 'en-US'];
}

export function getRequestLang(req) {
  return normalizeAppLang(
    req?.headers?.['x-app-lang'] || req?.body?.lang || req?.query?.lang
  );
}

export function serverT(lang, key) {
  const app = normalizeAppLang(lang);
  const table = MESSAGES[app] || MESSAGES.ru;
  return table[key] ?? MESSAGES.ru[key] ?? key;
}

export function formatOpenAIError(message) {
  const lower = String(message || '').toLowerCase();

  if (lower.includes('quota') || lower.includes('billing') || lower.includes('insufficient')) {
    return {
      code: 'quota',
      message: 'Закончился баланс OpenAI. Пополните счёт на platform.openai.com или замените OPENAI_API_KEY в .env.'
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
      message: 'Слишком много запросов к OpenAI. Подождите минуту и попробуйте снова.'
    };
  }

  return {
    code: 'unknown',
    message: message || 'Ошибка OpenAI API'
  };
}
