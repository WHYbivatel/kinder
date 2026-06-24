const loginOverlay = document.getElementById('login-overlay');
const appContent = document.getElementById('app-content');
const authPhoneForm = document.getElementById('auth-phone-form');
const authPhone = document.getElementById('auth-phone');
const authCodeForm = document.getElementById('auth-code-form');
const authCode = document.getElementById('auth-code');
const authCodeBackBtn = document.getElementById('auth-code-back');
const authCodeHint = document.getElementById('auth-code-hint');
const authHintDefault = document.getElementById('auth-hint-default');
const authPhoneDisplay = document.getElementById('auth-phone-display');
const authError = document.getElementById('auth-error');
const authGuestBtn = document.getElementById('auth-guest-btn');

// Телефон, на который запросили код (между шагом 1 и шагом 2).
let pendingPhone = '';

// Постоянный идентификатор устройства: по нему PWA «помнит» пользователя
// и пускает без ввода пароля. Хранится в localStorage (переживает перезапуск).
function getDeviceId() {
  let id = localStorage.getItem('mf_device_id');
  if (!id) {
    id = (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2));
    localStorage.setItem('mf_device_id', id);
  }
  return id;
}
const userGreeting = document.getElementById('user-greeting');
const logoutBtn = document.getElementById('logout-btn');
const loginCloseBtn = document.getElementById('login-close');
const guestLoginBtn = document.getElementById('guest-login-btn');
const guestBanner = document.getElementById('guest-banner');

function getToken() {
  return sessionStorage.getItem('token');
}

function authHeaders() {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

window.authHeaders = authHeaders;

function isLoggedIn() {
  return Boolean(getToken() && sessionStorage.getItem('username'));
}
window.isLoggedIn = isLoggedIn;

// Глобальная точка для гостевых действий: открыть окно входа с подсказкой.
window.requireLogin = function requireLogin(message) {
  openLoginModal(message || 'Войдите, чтобы пользоваться этой функцией.');
  return false;
};

function getConnectionErrorMessage() {
  if (window.location.protocol === 'file:') {
    return 'Вы открыли файл напрямую. Запустите сервер и откройте http://localhost:3000';
  }
  return 'Не удалось связаться с сервером. Проверьте, что в cmd запущен: node server.js';
}

function showFileProtocolWarning() {
  if (window.location.protocol !== 'file:') return;

  const warning = document.getElementById('open-via-server-hint');
  if (warning) {
    warning.classList.remove('hidden');
    warning.textContent = 'Откройте сайт через http://localhost:3000 (не двойным кликом по index.html)';
  }
}

// Окно входа теперь модальное: приложение остаётся видимым под ним,
// чтобы гость мог закрыть его и продолжить без входа.
function openLoginModal(message = '') {
  loginOverlay.classList.remove('hidden');
  if (message && authError) {
    authError.textContent = message;
  }
}

function closeLoginModal() {
  loginOverlay.classList.add('hidden');
  if (authError) authError.textContent = '';
}

// Показать шаг ввода телефона (по умолчанию) / шаг ввода кода.
function showPhoneStep() {
  authPhoneForm?.classList.remove('hidden');
  authCodeForm?.classList.add('hidden');
  authCodeHint?.classList.add('hidden');
  authHintDefault?.classList.remove('hidden');
  if (authError) authError.textContent = '';
}

function showCodeStep(phone) {
  authPhoneForm?.classList.add('hidden');
  authCodeForm?.classList.remove('hidden');
  authHintDefault?.classList.add('hidden');
  authCodeHint?.classList.remove('hidden');
  if (authPhoneDisplay) authPhoneDisplay.textContent = phone || '';
  if (authError) authError.textContent = '';
  if (authCode) { authCode.value = ''; setTimeout(() => authCode.focus(), 50); }
}

// Сброс формы входа в исходное состояние.
function resetAuthForm() {
  authPhoneForm?.reset();
  authCodeForm?.reset();
  pendingPhone = '';
  showPhoneStep();
  if (authError) authError.textContent = '';
}

// Дружелюбное имя: телефон показываем как есть, email — часть до @.
function displayNameFrom(username) {
  if (!username) return '';
  const value = String(username);
  if (value.startsWith('+') || /^\d{7,}$/.test(value)) return value;
  const local = value.split('@')[0];
  return local ? local.charAt(0).toUpperCase() + local.slice(1) : username;
}
window.displayNameFrom = displayNameFrom;

// Применяем визуальное состояние авторизации (гость / вошедший).
function applyAuthState(username) {
  const authed = Boolean(username);
  document.body.dataset.auth = authed ? 'user' : 'guest';

  if (userGreeting) {
    const name = displayNameFrom(username);
    userGreeting.textContent = authed
      ? (window.t ? window.t('home.greeting', { name }) : `Привет, ${name}`)
      : '';
    userGreeting.dataset.authName = authed ? username : '';
  }
  if (guestLoginBtn) guestLoginBtn.hidden = authed;
  if (guestBanner) guestBanner.hidden = authed;
  const avatar = document.getElementById('header-avatar');
  if (avatar) avatar.hidden = !authed;
}

document.addEventListener('i18n:change', function () {
  const name = userGreeting && userGreeting.dataset.authName;
  if (userGreeting && name) {
    userGreeting.textContent = window.t
      ? window.t('home.greeting', { name: displayNameFrom(name) })
      : `Привет, ${displayNameFrom(name)}`;
  }
});

window.handleAuthExpired = function handleAuthExpired(message) {
  sessionStorage.removeItem('token');
  sessionStorage.removeItem('username');
  applyAuthState(null);
  openLoginModal(message || 'Сессия истекла. Войдите снова.');
};

function showApp(username) {
  loginOverlay.classList.add('hidden');
  appContent.classList.remove('hidden');
  applyAuthState(username);
  window.initHeaderNav?.(username || 'Гость');
}

if (loginCloseBtn) loginCloseBtn.addEventListener('click', closeLoginModal);
if (guestLoginBtn) guestLoginBtn.addEventListener('click', () => openLoginModal());
if (loginOverlay) {
  loginOverlay.addEventListener('click', (event) => {
    if (event.target === loginOverlay) closeLoginModal();
  });
}

// Кнопка «Продолжить как гость»: на главной просто закрывает окно входа,
// на остальных страницах возвращает на главную.
if (authGuestBtn) {
  authGuestBtn.addEventListener('click', () => {
    const page = document.body.dataset.page || 'home';
    if (page === 'home') closeLoginModal();
    else window.location.href = '/';
  });
}

// Вход по номеру телефона + SMS-код (без пароля). Шаг 1 — запрос кода.
// Реальная отправка SMS пока не выполняется: используется временный код 1234.
if (authPhoneForm) {
  authPhoneForm.addEventListener('submit', async function (event) {
    event.preventDefault();
    if (authError) authError.textContent = '';

    const phone = authPhone.value.trim();
    const submitBtn = authPhoneForm.querySelector('button[type="submit"]');
    const originalLabel = submitBtn ? submitBtn.textContent : '';
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Отправляем…'; }

    try {
      const response = await fetch('/api/auth/request-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone })
      });

      const data = await response.json();
      if (!response.ok) {
        if (authError) authError.textContent = data.error || 'Не удалось отправить код';
        return;
      }

      pendingPhone = data.phone || phone;
      showCodeStep(pendingPhone);
    } catch (error) {
      if (authError) authError.textContent = getConnectionErrorMessage();
    } finally {
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = originalLabel; }
    }
  });
}

// Шаг 2 — проверка кода и вход. Новый номер → аккаунт создаётся автоматически.
if (authCodeForm) {
  authCodeForm.addEventListener('submit', async function (event) {
    event.preventDefault();
    if (authError) authError.textContent = '';

    const code = authCode.value.trim();
    const submitBtn = authCodeForm.querySelector('button[type="submit"]');
    const originalLabel = submitBtn ? submitBtn.textContent : '';
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Входим…'; }

    try {
      const response = await fetch('/api/auth/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: pendingPhone, code, deviceId: getDeviceId() })
      });

      const data = await response.json();
      if (!response.ok) {
        if (authError) authError.textContent = data.error || 'Неверный код';
        return;
      }

      sessionStorage.setItem('token', data.token);
      sessionStorage.setItem('username', data.username);
      localStorage.removeItem('mf_logged_out');
      // Переносим гостевые действия (свайпы, список, тесты) в аккаунт.
      await window.GuestStore?.merge?.();
      await startApp(data.username);
    } catch (error) {
      if (authError) authError.textContent = getConnectionErrorMessage();
    } finally {
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = originalLabel; }
    }
  });
}

if (authCodeBackBtn) {
  authCodeBackBtn.addEventListener('click', () => {
    pendingPhone = '';
    showPhoneStep();
    setTimeout(() => authPhone?.focus(), 50);
  });
}

async function handleLogout() {
  try {
    await fetch('/api/logout', {
      method: 'POST',
      headers: authHeaders()
    });
  } catch (error) {
    // ignore
  }

  sessionStorage.removeItem('token');
  sessionStorage.removeItem('username');
  // Помечаем, что пользователь вышел вручную — не входим автоматически по
  // устройству, пока он снова не введёт имя (иначе выход не сработает).
  localStorage.setItem('mf_logged_out', '1');
  resetAuthForm();

  if (document.body.dataset.page === 'account') {
    window.location.href = '/';
    return;
  }
  showLoginScreen();
}

if (logoutBtn) {
  logoutBtn.addEventListener('click', handleLogout);
}

async function startApp(username) {
  showApp(username);
  closeLoginModal();
  await window.MovieApp.init();

  const page = document.body.dataset.page || 'home';
  if (page === 'home') {
    window.refreshExtendedFeatures?.();
    window.BattleUI?.refresh?.();
    window.PsychTest?.refresh?.();
    window.VisualTest?.refresh?.();
    window.ShortVisualTest?.refresh?.();
    window.DiscoverPWA?.refresh?.();
  } else if (page === 'account') {
    window.refreshAccountPage?.();
  } else if (page === 'battle') {
    window.BattleUI?.refresh?.();
  }
}

// Гостевой режим: главная открывается без входа. Доступны публичные
// функции (премьеры, свайпы, тесты без сохранения). Личный список,
// рекомендации «для вас», импорт и т.п. скрыты до входа (через CSS по
// body[data-auth="guest"]).
function startGuest() {
  const page = document.body.dataset.page || 'home';

  // Аккаунт без входа смысла не имеет — отправляем на главную.
  if (page === 'account') {
    window.location.href = '/';
    return;
  }

  showApp(null);

  if (page === 'home') {
    // Загружаем локальный гостевой список в память: нужно для дедупликации
    // свайпов и корректного переноса в аккаунт после входа.
    window.MovieApp?.init?.().catch?.(() => {});
    window.refreshExtendedFeatures?.();   // премьеры — публичный эндпоинт
    window.PsychTest?.refresh?.();
    window.VisualTest?.refresh?.();
    window.ShortVisualTest?.refresh?.();
    window.DiscoverPWA?.refresh?.();      // свайпы — публичные рекомендации
  } else if (page === 'battle') {
    // Битва требует личного списка — предложим войти.
    openLoginModal('Войдите, чтобы устроить битву из своих фильмов.');
  }
}

// Тихий вход по устройству: если это устройство уже привязано к аккаунту —
// восстанавливаем сессию без ввода чего-либо.
async function tryDeviceLogin() {
  if (localStorage.getItem('mf_logged_out') === '1') return false;
  try {
    const response = await fetch('/api/auth-device', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId: getDeviceId() })
    });
    if (!response.ok) return false;
    const data = await response.json();
    sessionStorage.setItem('token', data.token);
    sessionStorage.setItem('username', data.username);
    // Если до тихого входа были гостевые действия — переносим их в аккаунт.
    await window.GuestStore?.merge?.();
    await startApp(data.username);
    return true;
  } catch (error) {
    return false;
  }
}

async function tryAutoLogin() {
  const token = getToken();
  const username = sessionStorage.getItem('username');

  if (token && username) {
    try {
      const response = await fetch('/api/movies', { headers: authHeaders() });
      if (response.ok) {
        await startApp(username);
        return;
      }
      sessionStorage.clear();
    } catch (error) {
      startGuest();
      return;
    }
  }

  // Нет активной сессии — пробуем тихо войти по устройству.
  if (await tryDeviceLogin()) return;
  startGuest();
}

tryAutoLogin();
showFileProtocolWarning();
