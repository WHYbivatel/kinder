/* ===================================================================
   i18n.js — единый слой локализации (RU/EN) для всего приложения.

   Возможности:
   • словари ru/en (см. DICT ниже);
   • t(key, vars) — перевод по ключу с подстановкой {var};
   • выбор языка хранится в localStorage('app_lang') → переживает
     перезагрузку и работает в установленном PWA;
   • автоматический перевод статической разметки через атрибуты:
       data-i18n            → textContent
       data-i18n-html       → innerHTML
       data-i18n-placeholder→ placeholder
       data-i18n-title      → title
       data-i18n-aria       → aria-label
   • переключатель RU/EN внедряется рядом с кнопкой входа/назад;
   • событие 'i18n:change' для динамических ререндеров (movie.js и т.п.).

   Подключать как можно раньше (в <head>), чтобы window.t был доступен
   остальным скриптам.
   =================================================================== */
(function () {
  'use strict';

  var STORAGE_KEY = 'app_lang';
  var SUPPORTED = ['ru', 'en'];
  var DEFAULT_LANG = 'ru';

  var DICT = {
    ru: {
      // ── Общие ──
      'common.loading': 'Загрузка…',
      'common.loadingShort': 'Загрузка',
      'common.back': '‹ Назад',
      'common.home': 'На главную',
      'common.retry': 'Повторить',
      'common.close': 'Закрыть',
      'common.save': 'Сохранить',
      'common.cancel': 'Отмена',
      'common.error': 'Произошла ошибка',
      'common.notFound': 'Ничего не найдено',
      'common.minutes': 'мин',
      'common.year': 'год',
      'common.film': 'Фильм',
      'common.series': 'Сериал',
      'common.seasonsShort': 'сезон(ов)',
      'common.empty': 'Пусто',
      'common.refresh': 'Обновить',
      'lang.label': 'Язык',
      'lang.ru': 'RU',
      'lang.en': 'EN',
      'rating.kinopoisk': 'КиноПоиск',
      'rating.site': '★ Сайт',
      'rating.siteTitle': 'Средняя оценка пользователей сайта',

      // ── Хедер / навигация ──
      'nav.list': 'Список',
      'nav.battle': 'Битва фильмов',
      'nav.brand': 'Мои фильмы',
      'btn.login': 'Войти',
      'btn.account': 'Мой аккаунт',
      'btn.theme': 'Переключить тему',
      'btn.aiAssistant': 'AI-помощник',

      // ── Авторизация ──
      'auth.title': 'Мой список фильмов',
      'auth.intro': 'Войдите по номеру телефона — так сохранятся ваш список, оценки и результаты тестов.',
      'auth.phonePlaceholder': 'Номер телефона',
      'auth.getCode': 'Получить код',
      'auth.codePlaceholder': 'Код из SMS',
      'auth.submit': 'Войти',
      'auth.changeNumber': 'Изменить номер',
      'auth.sentTo': 'Отправили код на',
      'auth.hintDefault': 'Без пароля. Войдём по коду из SMS. Новый номер — аккаунт создаётся автоматически.',
      'auth.guest': 'Продолжить как гость',
      'auth.loginToAdd': 'Войдите на главной странице, чтобы добавить фильм',
      'auth.sessionExpired': 'Сессия истекла. Войдите снова на главной.',

      // ── Главная ──
      'home.heroEyebrow': 'Персональный кинозал',
      'home.heroTitle': 'Не знаешь, что включить?',
      'home.heroSubtitle': 'AI подберёт фильм или сериал под настроение и ваш список',
      'home.watchNow': 'Что посмотреть прямо сейчас',
      'home.premieresEyebrow': 'Премьеры',
      'home.premieresTitle': 'Скоро в кино',
      'home.testsTitle': 'Тесты',
      'home.testsSub': 'Пройдите тест — AI подберёт фильмы и сериалы под ваше состояние, восприятие и настроение.',
      'home.discoveryEyebrow': 'Discovery',
      'home.discoveryTitle': 'Свайп-рекомендации',
      'home.discoveryHint': 'Свайп вправо — хочу, влево — мимо. Нажмите на карточку, чтобы открыть фильм.',
      'home.collectionsEyebrow': 'Подборки',
      'home.collectionsTitle': 'Готовые подборки',
      'home.collectionsHint': 'Топы, жанры, страны и темы — листайте ленты вбок, открывайте подборку и добавляйте фильмы в список.',
      'home.catalogEyebrow': 'Каталог',
      'home.catalogTitle': 'Категории',
      'home.catalogHint': 'Выберите категорию — фильмы раскроются прямо под ней. Ниже — 200 лучших за всё время.',
      'home.recommendations': 'Рекомендации для вас',
      'home.smartCollections': 'Умные подборки',
      'home.mayInterest': 'Может заинтересовать',

      // Свайпы (discover)
      'discover.skip': '✕ Мимо',
      'discover.watched': '✓ Уже смотрел',
      'discover.like': '＋ Хочу',
      'sort.premieresAria': 'Сортировка премьер',
      'sort.dateAsc': 'По дате ↑',
      'sort.dateDesc': 'По дате ↓',
      'sort.titleAsc': 'По алфавиту А–Я',
      'sort.titleDesc': 'По алфавиту Я–А',
      'home.greeting': 'Привет, {name}',
      'collections.open': 'Открыть',
      'collections.collapse': 'Свернуть',
      'common.updated': 'Подборка обновлена',
      'discover.nothing': 'Пока нечего показать.',
      'media.movie': 'Фильм',
      'media.series': 'Сериал',
      'media.animation': 'Мультфильм',
      'rotate.title': 'Поверните телефон вертикально',
      'rotate.text': '«Мои фильмы» работают только в вертикальном режиме.',
      'discover.empty': 'Карточки закончились. Нажмите «Обновить».',
      'discover.emptyTitle': 'Карточки закончились',
      'discover.emptyHint': 'Нажмите «Обновить», чтобы получить новую пачку рекомендаций.',

      // Список фильмов
      'list.title': 'Мои фильмы',
      'list.titleSeries': 'Мои сериалы',
      'list.tabMovies': 'Фильмы',
      'list.tabSeries': 'Сериалы',
      'list.searchPlaceholder': 'Поиск по названию, жанру, тегу...',
      'list.addSeries': '+ Добавить сериал',
      'list.allGenres': 'Все жанры',
      'list.sortAdded': 'Сначала новые',
      'list.sortRating': 'По рейтингу',
      'list.sortYear': 'По году',
      'list.sortTitle': 'По названию',
      'list.resetFilters': 'Сбросить фильтры',
      'list.empty': 'Пока нет фильмов.',
      'list.tabMovies': 'Фильмы',
      'list.tabSeries': 'Сериалы',

      // Каталог
      'catalog.top200': '200 лучших за всё время',
      'catalog.all': 'Всё',
      'catalog.categories': 'Категории',
      'catalog.loadError': 'Не удалось загрузить каталог.',
      'catalog.collectionsError': 'Не удалось загрузить подборки.',
      'card.add': '+ В список',
      'card.added': '✓ В списке',
      'card.adding': 'Добавляю…',
      'card.series': 'Сериал',
      'card.loadFailed': 'Не удалось загрузить',
      'card.serverDown': 'Сервер недоступен',
      'card.loginToAdd': 'Войдите, чтобы добавлять фильмы в свой список.',

      // ── Страница фильма ──
      'movie.notSpecified': 'Не указан фильм.',
      'movie.loadError': 'Не удалось загрузить фильм.',
      'movie.addToList': 'Добавить в список:',
      'movie.want': '＋ Хочу посмотреть',
      'movie.watched': '✓ Уже смотрел',
      'movie.adding': 'Добавляю…',
      'movie.updated': '✓ Обновлено',
      'movie.inList': '✓ В списке',
      'movie.addedWatched': 'Добавлено в «Посмотрел»',
      'movie.addedWant': 'Добавлено в «Хочу посмотреть»',
      'movie.addFailed': 'Не удалось добавить',
      'movie.ratings': 'Рейтинги',
      'movie.overview': 'Описание',
      'movie.director': 'Режиссёр',
      'movie.writers': 'Сценарий',
      'movie.cast': 'В ролях',
      'movie.trailer': 'Трейлер',
      'movie.trailerDefault': 'Трейлер',
      'movie.whereToWatch': 'Где смотреть и искать',
      'movie.watchOn': 'Смотреть на {site}',
      'movie.checking': 'Проверяем {site}…',
      'movie.notOn': 'Нет на {site}',
      'movie.findGoogle': 'Найти в Google',
      'movie.watchNote': 'Неактивная кнопка означает, что точного совпадения этого {kind} на сайте найти не удалось — возможно, его там пока нет. Попробуйте поиск в Google.',
      'movie.expand': 'Открыть на весь экран',

      // ── Страница человека ──
      'person.loadError': 'Не удалось загрузить страницу человека.',
      'person.notSpecified': 'Человек не указан.',
      'person.biography': 'Биография',
      'person.filmography': 'Фильмография',
      'person.bornDate': 'Дата рождения',
      'person.bornPlace': 'Место рождения',
      'person.died': 'Дата смерти',
      'person.height': 'Рост',
      'person.knownFor': 'Известность',
      'person.originalName': 'Оригинальное имя',
      'person.noFilmography': 'Фильмография недоступна.',
      'person.showMore': 'Показать ещё',
      'person.noBio': 'Биография недоступна.',
      'person.years': '{n} лет',
      'person.roleActor': 'Актёр',
      'person.roleActress': 'Актриса',
      'person.roleDirector': 'Режиссёр',
      'person.roleWriter': 'Сценарист',
      'person.roleProducer': 'Продюсер',
      'person.roleCrew': 'Съёмочная группа',
      'department.Acting': 'Актёр',
      'department.Directing': 'Режиссёр',
      'department.Writing': 'Сценарист',
      'department.Production': 'Продюсер',
      'department.Sound': 'Звук',
      'department.Camera': 'Оператор',
      'department.Editing': 'Монтаж',
      'department.Art': 'Художник',

      // ── Чат ──
      'chat.title': 'AI-помощник',
      'chat.sub': 'Управление списком и подборки',
      'chat.placeholder': 'Напишите сообщение...',
      'chat.send': 'Отправить',
      'chat.close': 'Закрыть чат',
      'chat.introLead': 'Управляю списком без OpenAI:',
      'chat.ex1': '«Добавь Интерстеллар»',
      'chat.ex2': '«Покажи что хочу посмотреть»',
      'chat.ex3': '«Удали Матрица»',
      'chat.introNote': 'Для умных рекомендаций нужен баланс OpenAI.',

      // ── Битва (промо на главной) ──
      'battle.eyebrow': 'Мини-игра',
      'battle.desc': 'Сравнивайте только фильмы с фильмами и сериалы с сериалами — из того, что вы уже посмотрели. Мы соберём ваш личный топ и покажем, что для вас действительно на первом месте.',
      'battle.point1': 'Нужны только «Посмотрел» с оценками — ничего нового добавлять не надо',
      'battle.point2': 'Быстрая битва за пару минут или полный топ на вечер',
      'battle.point3': 'Результат сохраняется — можно вернуться к своему топу позже',
      'battle.start': 'Начать битву',

      // ── Умные подборки / пресеты ──
      'collections.inputPlaceholder': 'Например: устал, хочу лёгкое и не тупое',
      'collections.submit': 'Подобрать',
      'collections.picking': 'Подбираю...',
      'collections.error': 'Ошибка подборки',
      'collections.serverDown': 'Сервер недоступен',
      'preset.evening': 'На вечер',
      'preset.weekend': 'На выходные',
      'preset.short': 'До 90 мин',
      'preset.alone': 'Одному',
      'preset.date': 'С парой',
      'preset.friends': 'С друзьями',
      'preset.light': 'Лёгкое',
      'preset.serious': 'Серьёзное',
      'preset.puzzle': 'Мозголомки',
      'preset.twist': 'С концовкой',

      // ── Может заинтересовать / рекомендации ──
      'premiereSuggest.hint': 'Предстоящие премьеры по вашему вкусу — нажмите «Обновить»',
      'premiereSuggest.empty': 'Нажмите «Обновить», чтобы получить подборку',
      'premiereSuggest.none': 'Пока нет подборки',
      'rec.empty': 'Нажмите «Обновить», чтобы получить рекомендации',
      'rec.none': 'Пока нет рекомендаций',
      'rec.addTitle': 'Добавить в список',

      // ── Чёрный список ──
      'blacklist.title': 'Чёрный список AI',
      'blacklist.hint': 'AI не будет рекомендовать то, что вы исключили',
      'blacklist.genres': 'Жанры',
      'blacklist.actors': 'Актёры',
      'blacklist.directors': 'Режиссёры',
      'blacklist.countries': 'Страны',
      'blacklist.maxRuntime': 'Макс. длительность (мин)',
      'blacklist.minYear': 'Не старше года',
      'blacklist.excludeHorror': 'Исключить ужасы',
      'blacklist.comma': 'через запятую',
      'blacklist.genresPh': 'ужасы, мелодрама',
      'blacklist.countriesPh': 'Индия, Турция',

      // ── Импорт / экспорт ──
      'import.title': 'Импорт и экспорт',
      'import.fmtPlain': 'Простой список / Telegram / заметки',
      'import.fmtLetterboxd': 'Letterboxd CSV',
      'import.fmtImdb': 'IMDb Watchlist',
      'import.fmtKinopoisk': 'Кинопоиск (текстом)',
      'import.fmtSeries': 'Список сериалов',
      'import.btnAi': 'Импорт (AI)',
      'import.btnImport': 'Импортировать',
      'import.exportLabel': 'Экспорт:',
      'import.backup': 'Резервная копия',

      // ── Нижняя навигация ──
      'btn.accountOf': 'Аккаунт: {name}',
      'nav.tabsAria': 'Вкладки приложения',
      'nav.home': 'Главная',
      'nav.catalog': 'Каталог',
      'nav.swipe': 'Свайп',
      'nav.tests': 'Тесты',
      'nav.ai': 'AI',
      'nav.listShort': 'Список',

      // ── Карточки тестов на главной ──
      'test.psychTitle': 'Кино-психологический тест',
      'test.psychDesc': 'Ответьте на 12 вопросов, а AI подберёт фильмы и сериалы под ваше состояние, настроение и стиль восприятия.',
      'test.psychStart': 'Пройти тест',
      'test.lastTest': 'Последний тест: {date}',
      'test.yourProfile': 'Ваш профиль: {title}',
      'test.viewRecs': 'Посмотреть рекомендации',
      'test.retake': 'Пройти заново',
      'test.visualTitle': 'Визуальный тест восприятия',
      'test.visualDesc': 'Посмотрите на 8 изображений, выберите, что вы в них видите, а AI подберёт фильмы и сериалы под ваш визуальный стиль.',
      'test.visualStart': 'Пройти визуальный тест',
      'test.yourVisualProfile': 'Ваш визуальный профиль: {title}',
      'test.visualRecs': 'Рекомендации по визуальному профилю',
      'test.start': 'Начать',
      'test.close': 'Закрыть',
      'short.title': 'Короткие визуальные тесты',
      'short.lastResult': 'Последний результат',
      'short.recs': 'Рекомендации',
      'short.cards4': '4 картинки',
      'short.start': 'Пройти тест',

      // ── Список / карточки фильмов ──
      'list.countMovies': '{n} фильмов',
      'list.countSeries': '{n} сериалов',
      'list.emptySeries': 'Пока нет сериалов.',
      'list.searchEmpty': 'Ничего не найдено по запросу.',
      'list.inList': '{n} в списке',
      'list.shownOf': 'Показано {n} из {total}',
      'list.emptyAll': 'Пока нет фильмов и сериалов. Импортируйте список или напишите AI-помощнику.',
      'list.ofMovies': 'фильмов',
      'list.ofSeries': 'сериалов',
      'list.noSearch': 'По запросу «{q}» ничего не найдено.',
      'list.noPremieres': 'Нет предстоящих премьер среди {type}.',
      'list.noReleased': 'Нет вышедших {type} по выбранным фильтрам.',
      'list.noStatus': 'Нет {type} со статусом «{status}». Выберите «Все статусы» в фильтре выше.',
      'list.noFilters': 'Нет {type} по выбранным фильтрам.',
      'status.want': 'Хочу посмотреть',
      'status.watched': 'Посмотрел',
      'status.watching': 'Смотрю',
      'common.add': 'Добавить',
      'common.added': 'В списке',
      'common.delete': 'Удалить',
      'common.loadingPick': 'Подбираю…'
    },

    en: {
      // ── Common ──
      'common.loading': 'Loading…',
      'common.loadingShort': 'Loading',
      'common.back': '‹ Back',
      'common.home': 'Home',
      'common.retry': 'Retry',
      'common.close': 'Close',
      'common.save': 'Save',
      'common.cancel': 'Cancel',
      'common.error': 'Something went wrong',
      'common.notFound': 'Nothing found',
      'common.minutes': 'min',
      'common.year': 'year',
      'common.film': 'Movie',
      'common.series': 'TV series',
      'common.seasonsShort': 'season(s)',
      'common.empty': 'Empty',
      'common.refresh': 'Refresh',
      'lang.label': 'Language',
      'lang.ru': 'RU',
      'lang.en': 'EN',
      'rating.kinopoisk': 'Kinopoisk',
      'rating.site': '★ Site',
      'rating.siteTitle': 'Average rating by site users',

      // ── Header / nav ──
      'nav.list': 'My list',
      'nav.battle': 'Movie battle',
      'nav.brand': 'My Movies',
      'btn.login': 'Sign in',
      'btn.account': 'My account',
      'btn.theme': 'Toggle theme',
      'btn.aiAssistant': 'AI assistant',

      // ── Auth ──
      'auth.title': 'My movie list',
      'auth.intro': 'Sign in with your phone number — your list, ratings and test results will be saved.',
      'auth.phonePlaceholder': 'Phone number',
      'auth.getCode': 'Get code',
      'auth.codePlaceholder': 'SMS code',
      'auth.submit': 'Sign in',
      'auth.changeNumber': 'Change number',
      'auth.sentTo': 'Code sent to',
      'auth.hintDefault': 'No password. We sign you in with an SMS code. A new number creates an account automatically.',
      'auth.guest': 'Continue as guest',
      'auth.loginToAdd': 'Sign in on the home page to add a movie',
      'auth.sessionExpired': 'Session expired. Please sign in again on the home page.',

      // ── Home ──
      'home.heroEyebrow': 'Personal cinema',
      'home.heroTitle': "Don't know what to watch?",
      'home.heroSubtitle': 'AI will pick a movie or series for your mood and your list',
      'home.watchNow': 'What to watch right now',
      'home.premieresEyebrow': 'Premieres',
      'home.premieresTitle': 'Coming soon',
      'home.testsTitle': 'Tests',
      'home.testsSub': 'Take a test — AI will pick movies and series for your state, perception and mood.',
      'home.discoveryEyebrow': 'Discovery',
      'home.discoveryTitle': 'Swipe recommendations',
      'home.discoveryHint': 'Swipe right to want it, left to skip. Tap a card to open the movie.',
      'home.collectionsEyebrow': 'Collections',
      'home.collectionsTitle': 'Ready-made collections',
      'home.collectionsHint': 'Tops, genres, countries and themes — scroll the rails, open a collection and add movies to your list.',
      'home.catalogEyebrow': 'Catalog',
      'home.catalogTitle': 'Categories',
      'home.catalogHint': 'Pick a category — movies open right below it. Below — the 200 best of all time.',
      'home.recommendations': 'Recommended for you',
      'home.smartCollections': 'Smart collections',
      'home.mayInterest': 'You may like',

      // Discover
      'discover.skip': '✕ Skip',
      'discover.watched': '✓ Seen it',
      'discover.like': '＋ Want',
      'sort.premieresAria': 'Sort premieres',
      'sort.dateAsc': 'By date ↑',
      'sort.dateDesc': 'By date ↓',
      'sort.titleAsc': 'A–Z',
      'sort.titleDesc': 'Z–A',
      'home.greeting': 'Hi, {name}',
      'collections.open': 'Open',
      'collections.collapse': 'Collapse',
      'common.updated': 'Selection updated',
      'discover.nothing': 'Nothing to show yet.',
      'media.movie': 'Movie',
      'media.series': 'Series',
      'media.animation': 'Animation',
      'rotate.title': 'Rotate your phone to portrait',
      'rotate.text': '“My Movies” works only in portrait mode.',
      'discover.empty': 'No more cards. Tap “Refresh”.',
      'discover.emptyTitle': 'No more cards',
      'discover.emptyHint': 'Tap “Refresh” to get a new batch of recommendations.',

      // List
      'list.title': 'My movies',
      'list.titleSeries': 'My series',
      'list.tabMovies': 'Movies',
      'list.tabSeries': 'Series',
      'list.searchPlaceholder': 'Search by title, genre, tag...',
      'list.addSeries': '+ Add series',
      'list.allGenres': 'All genres',
      'list.sortAdded': 'Newest first',
      'list.sortRating': 'By rating',
      'list.sortYear': 'By year',
      'list.sortTitle': 'By title',
      'list.resetFilters': 'Reset filters',
      'list.empty': 'No movies yet.',
      'list.tabMovies': 'Movies',
      'list.tabSeries': 'TV series',

      // Catalog
      'catalog.top200': 'Top 200 of all time',
      'catalog.all': 'All',
      'catalog.categories': 'Categories',
      'catalog.loadError': 'Failed to load the catalog.',
      'catalog.collectionsError': 'Failed to load collections.',
      'card.add': '+ Add',
      'card.added': '✓ In list',
      'card.adding': 'Adding…',
      'card.series': 'Series',
      'card.loadFailed': 'Failed to load',
      'card.serverDown': 'Server unavailable',
      'card.loginToAdd': 'Sign in to add movies to your list.',

      // ── Movie page ──
      'movie.notSpecified': 'No movie specified.',
      'movie.loadError': 'Failed to load the movie.',
      'movie.addToList': 'Add to list:',
      'movie.want': '＋ Want to watch',
      'movie.watched': '✓ Seen it',
      'movie.adding': 'Adding…',
      'movie.updated': '✓ Updated',
      'movie.inList': '✓ In list',
      'movie.addedWatched': 'Added to “Watched”',
      'movie.addedWant': 'Added to “Want to watch”',
      'movie.addFailed': 'Could not add',
      'movie.ratings': 'Ratings',
      'movie.overview': 'Overview',
      'movie.director': 'Director',
      'movie.writers': 'Writers',
      'movie.cast': 'Cast',
      'movie.trailer': 'Trailer',
      'movie.trailerDefault': 'Trailer',
      'movie.whereToWatch': 'Where to watch and search',
      'movie.watchOn': 'Watch on {site}',
      'movie.checking': 'Checking {site}…',
      'movie.notOn': 'Not on {site}',
      'movie.findGoogle': 'Search on Google',
      'movie.watchNote': 'A disabled button means we could not find an exact match for this {kind} on the site — it may not be there yet. Try a Google search.',
      'movie.expand': 'Open fullscreen',

      // ── Person page ──
      'person.loadError': 'Failed to load the person page.',
      'person.notSpecified': 'No person specified.',
      'person.biography': 'Biography',
      'person.filmography': 'Filmography',
      'person.bornDate': 'Born',
      'person.bornPlace': 'Place of birth',
      'person.died': 'Died',
      'person.height': 'Height',
      'person.knownFor': 'Known for',
      'person.originalName': 'Original name',
      'person.noFilmography': 'Filmography unavailable.',
      'person.showMore': 'Show more',
      'person.noBio': 'Biography unavailable.',
      'person.years': '{n} years',
      'person.roleActor': 'Actor',
      'person.roleActress': 'Actress',
      'person.roleDirector': 'Director',
      'person.roleWriter': 'Writer',
      'person.roleProducer': 'Producer',
      'person.roleCrew': 'Crew',
      'department.Acting': 'Acting',
      'department.Directing': 'Directing',
      'department.Writing': 'Writing',
      'department.Production': 'Production',
      'department.Sound': 'Sound',
      'department.Camera': 'Camera',
      'department.Editing': 'Editing',
      'department.Art': 'Art',

      // ── Chat ──
      'chat.title': 'AI assistant',
      'chat.sub': 'List management and picks',
      'chat.placeholder': 'Type a message...',
      'chat.send': 'Send',
      'chat.close': 'Close chat',
      'chat.introLead': 'I manage your list without OpenAI:',
      'chat.ex1': '“Add Interstellar”',
      'chat.ex2': '“Show what I want to watch”',
      'chat.ex3': '“Delete The Matrix”',
      'chat.introNote': 'Smart recommendations require an OpenAI balance.',

      // ── Battle promo ──
      'battle.eyebrow': 'Mini-game',
      'battle.desc': 'Compare only movies with movies and series with series — from what you have already watched. We build your personal top and show what truly comes first for you.',
      'battle.point1': 'Only rated “Watched” items are needed — no need to add anything new',
      'battle.point2': 'A quick battle in a couple of minutes or a full top for the evening',
      'battle.point3': 'The result is saved — you can return to your top later',
      'battle.start': 'Start battle',

      // ── Smart collections / presets ──
      'collections.inputPlaceholder': 'e.g. tired, want something light but not dumb',
      'collections.submit': 'Find',
      'collections.picking': 'Picking...',
      'collections.error': 'Collection error',
      'collections.serverDown': 'Server unavailable',
      'preset.evening': 'For the evening',
      'preset.weekend': 'For the weekend',
      'preset.short': 'Under 90 min',
      'preset.alone': 'Alone',
      'preset.date': 'With a partner',
      'preset.friends': 'With friends',
      'preset.light': 'Light',
      'preset.serious': 'Serious',
      'preset.puzzle': 'Mind-benders',
      'preset.twist': 'With a twist',

      // ── You may like / recommendations ──
      'premiereSuggest.hint': 'Upcoming premieres to your taste — tap “Refresh”',
      'premiereSuggest.empty': 'Tap “Refresh” to get a selection',
      'premiereSuggest.none': 'No selection yet',
      'rec.empty': 'Tap “Refresh” to get recommendations',
      'rec.none': 'No recommendations yet',
      'rec.addTitle': 'Add to list',

      // ── Blacklist ──
      'blacklist.title': 'AI blacklist',
      'blacklist.hint': 'AI will not recommend what you excluded',
      'blacklist.genres': 'Genres',
      'blacklist.actors': 'Actors',
      'blacklist.directors': 'Directors',
      'blacklist.countries': 'Countries',
      'blacklist.maxRuntime': 'Max runtime (min)',
      'blacklist.minYear': 'Not older than year',
      'blacklist.excludeHorror': 'Exclude horror',
      'blacklist.comma': 'comma-separated',
      'blacklist.genresPh': 'horror, melodrama',
      'blacklist.countriesPh': 'India, Turkey',

      // ── Import / export ──
      'import.title': 'Import and export',
      'import.fmtPlain': 'Plain list / Telegram / notes',
      'import.fmtLetterboxd': 'Letterboxd CSV',
      'import.fmtImdb': 'IMDb Watchlist',
      'import.fmtKinopoisk': 'Kinopoisk (text)',
      'import.fmtSeries': 'Series list',
      'import.btnAi': 'Import (AI)',
      'import.btnImport': 'Import',
      'import.exportLabel': 'Export:',
      'import.backup': 'Backup',

      // ── Bottom navigation ──
      'btn.accountOf': 'Account: {name}',
      'nav.tabsAria': 'App tabs',
      'nav.home': 'Home',
      'nav.catalog': 'Catalog',
      'nav.swipe': 'Swipe',
      'nav.tests': 'Tests',
      'nav.ai': 'AI',
      'nav.listShort': 'List',

      // ── Test cards on home ──
      'test.psychTitle': 'Cinema psychology test',
      'test.psychDesc': 'Answer 12 questions and AI will pick movies and series for your state, mood and perception style.',
      'test.psychStart': 'Take the test',
      'test.lastTest': 'Last test: {date}',
      'test.yourProfile': 'Your profile: {title}',
      'test.viewRecs': 'View recommendations',
      'test.retake': 'Retake',
      'test.visualTitle': 'Visual perception test',
      'test.visualDesc': 'Look at 8 images, choose what you see in them, and AI will pick movies and series for your visual style.',
      'test.visualStart': 'Take the visual test',
      'test.yourVisualProfile': 'Your visual profile: {title}',
      'test.visualRecs': 'Recommendations by visual profile',
      'test.start': 'Start',
      'test.close': 'Close',
      'short.title': 'Short visual tests',
      'short.lastResult': 'Last result',
      'short.recs': 'Recommendations',
      'short.cards4': '4 images',
      'short.start': 'Take the test',

      // ── List / movie cards ──
      'list.countMovies': '{n} movies',
      'list.countSeries': '{n} series',
      'list.emptySeries': 'No series yet.',
      'list.searchEmpty': 'Nothing found for your query.',
      'list.inList': '{n} in list',
      'list.shownOf': 'Showing {n} of {total}',
      'list.emptyAll': 'No movies or series yet. Import a list or message the AI assistant.',
      'list.ofMovies': 'movies',
      'list.ofSeries': 'series',
      'list.noSearch': 'Nothing found for “{q}”.',
      'list.noPremieres': 'No upcoming premieres among {type}.',
      'list.noReleased': 'No released {type} for the selected filters.',
      'list.noStatus': 'No {type} with status “{status}”. Choose “All statuses” in the filter above.',
      'list.noFilters': 'No {type} for the selected filters.',
      'status.want': 'Want to watch',
      'status.watched': 'Watched',
      'status.watching': 'Watching',
      'common.add': 'Add',
      'common.added': 'In list',
      'common.delete': 'Delete',
      'common.loadingPick': 'Picking…'
    }
  };

  function normalizeLang(value) {
    return SUPPORTED.indexOf(value) !== -1 ? value : null;
  }

  function readStoredLang() {
    try {
      var stored = normalizeLang(localStorage.getItem(STORAGE_KEY));
      if (stored) return stored;
    } catch (e) { /* localStorage может быть недоступен */ }
    return DEFAULT_LANG;
  }

  var currentLang = readStoredLang();

  function t(key, vars) {
    var table = DICT[currentLang] || DICT[DEFAULT_LANG];
    var str = table[key];
    if (str == null) {
      str = (DICT[DEFAULT_LANG][key] != null) ? DICT[DEFAULT_LANG][key] : key;
    }
    if (vars) {
      str = str.replace(/\{(\w+)\}/g, function (m, name) {
        return vars[name] != null ? vars[name] : m;
      });
    }
    return str;
  }

  // TMDB-формат языка для запросов к API.
  function tmdbLang() {
    return currentLang === 'en' ? 'en' : 'ru';
  }

  function applyAttributes(root) {
    var scope = root || document;
    scope.querySelectorAll('[data-i18n]').forEach(function (el) {
      el.textContent = t(el.getAttribute('data-i18n'));
    });
    scope.querySelectorAll('[data-i18n-html]').forEach(function (el) {
      el.innerHTML = t(el.getAttribute('data-i18n-html'));
    });
    scope.querySelectorAll('[data-i18n-placeholder]').forEach(function (el) {
      el.setAttribute('placeholder', t(el.getAttribute('data-i18n-placeholder')));
    });
    scope.querySelectorAll('[data-i18n-title]').forEach(function (el) {
      el.setAttribute('title', t(el.getAttribute('data-i18n-title')));
    });
    scope.querySelectorAll('[data-i18n-aria]').forEach(function (el) {
      el.setAttribute('aria-label', t(el.getAttribute('data-i18n-aria')));
    });
  }

  function updateToggleUI() {
    document.querySelectorAll('[data-lang-toggle]').forEach(function (toggle) {
      toggle.querySelectorAll('[data-lang-opt]').forEach(function (opt) {
        var active = opt.getAttribute('data-lang-opt') === currentLang;
        opt.classList.toggle('lang-toggle__opt--active', active);
        opt.setAttribute('aria-pressed', active ? 'true' : 'false');
      });
    });
  }

  function setLang(lang) {
    var next = normalizeLang(lang);
    if (!next || next === currentLang) {
      updateToggleUI();
      return;
    }
    currentLang = next;
    try { localStorage.setItem(STORAGE_KEY, next); } catch (e) { /* ignore */ }
    document.documentElement.setAttribute('lang', next);
    applyAttributes(document);
    updateToggleUI();
    document.dispatchEvent(new CustomEvent('i18n:change', { detail: { lang: next } }));
  }

  function ensureToggleStyles() {
    if (document.getElementById('i18n-toggle-style')) return;
    var style = document.createElement('style');
    style.id = 'i18n-toggle-style';
    style.textContent =
      '.lang-toggle{display:inline-flex;align-items:center;gap:0;border:1px solid rgba(255,255,255,.18);' +
      'border-radius:999px;overflow:hidden;background:rgba(255,255,255,.06);flex:0 0 auto;height:34px}' +
      '.lang-toggle__opt{appearance:none;border:0;background:transparent;color:inherit;cursor:pointer;' +
      'font:600 12px/1 Inter,system-ui,sans-serif;letter-spacing:.04em;padding:0 10px;height:100%;' +
      'opacity:.6;transition:background .15s,opacity .15s}' +
      '.lang-toggle__opt--active{background:var(--accent,#6c5ce7);color:#fff;opacity:1}' +
      '.lang-toggle__opt:not(.lang-toggle__opt--active):hover{opacity:.9}' +
      '.lang-toggle--floating{position:fixed;top:max(10px,env(safe-area-inset-top));right:12px;z-index:60;' +
      'backdrop-filter:blur(8px)}';
    document.head.appendChild(style);
  }

  function buildToggle() {
    var wrap = document.createElement('div');
    wrap.className = 'lang-toggle';
    wrap.setAttribute('data-lang-toggle', '');
    wrap.setAttribute('role', 'group');
    wrap.setAttribute('aria-label', t('lang.label'));
    SUPPORTED.forEach(function (lang) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'lang-toggle__opt';
      btn.setAttribute('data-lang-opt', lang);
      btn.textContent = lang.toUpperCase();
      btn.addEventListener('click', function () { setLang(lang); });
      wrap.appendChild(btn);
    });
    return wrap;
  }

  function mountToggle() {
    // Если в разметке уже есть переключатель — просто навешиваем обработчики.
    var existing = document.querySelector('[data-lang-toggle]');
    if (existing && existing.querySelector('[data-lang-opt]')) {
      existing.querySelectorAll('[data-lang-opt]').forEach(function (opt) {
        opt.addEventListener('click', function () { setLang(opt.getAttribute('data-lang-opt')); });
      });
      return;
    }

    ensureToggleStyles();
    var toggle = buildToggle();

    var headerRight = document.querySelector('.header-right');
    var topbar = document.querySelector('.moviepage-topbar, .personpage-topbar');
    if (headerRight) {
      // Рядом с кнопкой входа/аккаунта.
      headerRight.insertBefore(toggle, headerRight.firstChild);
    } else if (topbar) {
      topbar.appendChild(toggle);
    } else {
      toggle.classList.add('lang-toggle--floating');
      document.body.appendChild(toggle);
    }
  }

  function init() {
    document.documentElement.setAttribute('lang', currentLang);
    mountToggle();
    applyAttributes(document);
    updateToggleUI();
  }

  // Публичный API.
  window.I18N = {
    t: t,
    getLang: function () { return currentLang; },
    setLang: setLang,
    apply: applyAttributes,
    tmdbLang: tmdbLang,
    onChange: function (cb) {
      document.addEventListener('i18n:change', function (e) { cb(e.detail.lang); });
    }
  };
  window.t = t;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
