import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const EXTRA = {
  ru: {
    'lang.kk': 'KZ',
    'movie.noTitle': 'Без названия',
    'movie.noOverview': 'Описание недоступно',
    'chat.offTopic': 'Я могу помочь только с фильмами, сериалами и рекомендациями.',
    'chat.thinking': 'Думаю',
    'chat.analyzingTaste': 'Анализирую ваш вкус',
    'notify.movieAdded': 'Фильм добавлен в список',
    'notify.movieRemoved': 'Фильм удалён',
    'notify.statusChanged': 'Статус изменён',
    'notify.dataSaved': 'Данные сохранены',
    'notify.loginSuccess': 'Вы успешно вошли',
    'notify.logoutSuccess': 'Вы вышли из аккаунта',
    'notify.loginRequired': 'Войдите в аккаунт, чтобы добавить фильм',
    'notify.loginRequiredGeneric': 'Войдите, чтобы пользоваться этой функцией',
    'notify.loadError': 'Ошибка загрузки',
    'notify.offline': 'Нет интернета',
    'notify.alreadyInList': 'Фильм уже есть в списке',
    'notify.aiError': 'Ошибка AI',
    'notify.tmdbError': 'Ошибка TMDB',
    'notify.authError': 'Ошибка входа',
    'notify.registerError': 'Ошибка регистрации',
    'notify.wrongPassword': 'Неверный пароль',
    'notify.userExists': 'Пользователь уже существует',
    'notify.battleTooFew': 'Слишком мало фильмов для битвы',
    'errors.loading': 'Ошибка загрузки',
    'errors.serverDown': 'Сервер не отвечает. Запустите: node server.js',
    'errors.openViaServer': 'Откройте http://localhost:3000',
    'errors.fileProtocol': 'Вы открыли файл напрямую. Запустите сервер и откройте http://localhost:3000',
    'pwa.installTitle': 'Добавить Kinder на главный экран?',
    'pwa.installText': 'Откроется как приложение: список, AI, тесты, битва и свайпы будут под рукой.',
    'pwa.installBtn': 'Добавить',
    'pwa.iosHint': 'В Safari: «Поделиться» → «На экран Домой»',
    'history.added': 'Добавлен в список',
    'history.status': 'Изменён статус',
    'history.rating': 'Изменена оценка',
    'history.addedStatus': 'Статус при добавлении: {status}',
    'history.statusChange': '{from} → {to}{rating}',
    'history.ratingChange': '{from} → {to}',
    'history.ratingSuffix': ', оценка {rating}/10',
    'premiere.loading': 'Загрузка премьер',
    'premiere.prev': 'Предыдущая премьера',
    'premiere.next': 'Следующая премьера',
    'nav.mainAria': 'Навигация',
    'status.all': 'Все статусы',
    'guest.banner': 'Гостевой режим — список сохраняется только на этом устройстве',
    'chat.card.openMovie': 'Открыть страницу фильма',
    'chat.card.alreadyInList': 'Уже в списке: «{title}» — {status}',
    'chat.card.duplicate': 'Похоже, уже есть: «{title}»',
    'chat.card.addedTo': 'Добавлено в «{status}»',
    'chat.card.inYourList': 'Этот фильм уже в вашем списке',
    'chat.card.blacklisted': 'Добавлено в чёрный список',
    'chat.card.blacklistFail': 'Не удалось добавить в чёрный список',
    'psych.intro.eyebrow': 'Профиль восприятия',
    'psych.intro.title': 'Подбор по вашему внутреннему состоянию',
    'psych.intro.lead': 'Это не медицинская диагностика, а короткий тест для более точных рекомендаций фильмов и сериалов.',
    'psych.intro.start': 'Начать',
    'psych.exit.title': 'Выйти из теста?',
    'psych.exit.lead': 'Ваши текущие ответы не сохранятся.',
    'psych.exit.continue': 'Продолжить тест',
    'psych.exit.leave': 'Выйти',
    'psych.progress': 'Вопрос {n} из {total}',
    'psych.next': 'Далее',
    'psych.finish': 'Завершить'
  },
  en: {
    'lang.kk': 'KZ',
    'movie.noTitle': 'Untitled',
    'movie.noOverview': 'Description unavailable',
    'chat.offTopic': 'I can only help with movies, TV shows, and recommendations.',
    'chat.thinking': 'Thinking',
    'chat.analyzingTaste': 'Analyzing your taste',
    'notify.movieAdded': 'Movie added to list',
    'notify.movieRemoved': 'Movie removed',
    'notify.statusChanged': 'Status changed',
    'notify.dataSaved': 'Data saved',
    'notify.loginSuccess': 'You have signed in successfully',
    'notify.logoutSuccess': 'You have signed out',
    'notify.loginRequired': 'Sign in to add this movie',
    'notify.loginRequiredGeneric': 'Sign in to use this feature',
    'notify.loadError': 'Loading error',
    'notify.offline': 'No internet connection',
    'notify.alreadyInList': 'Movie is already in your list',
    'notify.aiError': 'AI error',
    'notify.tmdbError': 'TMDB error',
    'notify.authError': 'Sign-in error',
    'notify.registerError': 'Registration error',
    'notify.wrongPassword': 'Wrong password',
    'notify.userExists': 'User already exists',
    'notify.battleTooFew': 'Too few movies for battle',
    'errors.loading': 'Loading error',
    'errors.serverDown': 'Server is not responding. Run: node server.js',
    'errors.openViaServer': 'Open http://localhost:3000',
    'errors.fileProtocol': 'You opened the file directly. Start the server and open http://localhost:3000',
    'pwa.installTitle': 'Add Kinder to your home screen?',
    'pwa.installText': 'Opens like an app: list, AI, tests, battle and swipes at your fingertips.',
    'pwa.installBtn': 'Add',
    'pwa.iosHint': 'In Safari: Share → Add to Home Screen',
    'history.added': 'Added to list',
    'history.status': 'Status changed',
    'history.rating': 'Rating changed',
    'history.addedStatus': 'Status when added: {status}',
    'history.statusChange': '{from} → {to}{rating}',
    'history.ratingChange': '{from} → {to}',
    'history.ratingSuffix': ', rating {rating}/10',
    'premiere.loading': 'Loading premieres',
    'premiere.prev': 'Previous premiere',
    'premiere.next': 'Next premiere',
    'nav.mainAria': 'Navigation',
    'status.all': 'All statuses',
    'guest.banner': 'Guest mode — your list is saved only on this device',
    'chat.card.openMovie': 'Open movie page',
    'chat.card.alreadyInList': 'Already in list: «{title}» — {status}',
    'chat.card.duplicate': 'Looks like it already exists: «{title}»',
    'chat.card.addedTo': 'Added to «{status}»',
    'chat.card.inYourList': 'This movie is already in your list',
    'chat.card.blacklisted': 'Added to blacklist',
    'chat.card.blacklistFail': 'Could not add to blacklist',
    'psych.intro.eyebrow': 'Perception profile',
    'psych.intro.title': 'Picks for your inner state',
    'psych.intro.lead': 'This is not medical diagnostics — a short test for better movie and series recommendations.',
    'psych.intro.start': 'Start',
    'psych.exit.title': 'Leave the test?',
    'psych.exit.lead': 'Your current answers will not be saved.',
    'psych.exit.continue': 'Continue test',
    'psych.exit.leave': 'Leave',
    'psych.progress': 'Question {n} of {total}',
    'psych.next': 'Next',
    'psych.finish': 'Finish'
  }
};

function parseLocale(file, lang) {
  const src = fs.readFileSync(file, 'utf8');
  const marker = `window.__LOCALES['${lang}'] = `;
  const start = src.indexOf(marker);
  if (start === -1) throw new Error(`marker not found in ${file}`);
  let i = start + marker.length;
  if (src[i] !== '{') throw new Error('expected {');
  let depth = 0;
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    if (src[i] === '}') {
      depth--;
      if (depth === 0) {
        const block = src.slice(start + marker.length, i + 1);
        return Function(`"use strict"; return (${block});`)();
      }
    }
  }
  throw new Error('unclosed dict');
}

function patchLocale(lang) {
  const file = path.join(__dirname, `../locales/${lang}.js`);
  const dict = parseLocale(file, lang);
  Object.assign(dict, EXTRA[lang]);
  const out = `/* Locale: ${lang} */\n(function () {\n  'use strict';\n  window.__LOCALES = window.__LOCALES || {};\n  window.__LOCALES['${lang}'] = ${JSON.stringify(dict, null, 2)};\n})();\n`;
  fs.writeFileSync(file, out);
  console.log(lang, Object.keys(dict).length);
}

patchLocale('ru');
patchLocale('en');
