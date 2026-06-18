const loginOverlay = document.getElementById('login-overlay');
const appContent = document.getElementById('app-content');
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const loginError = document.getElementById('login-error');
const registerError = document.getElementById('register-error');
const showRegisterBtn = document.getElementById('show-register');
const showLoginBtn = document.getElementById('show-login');
const loginBox = document.getElementById('login-box');
const registerBox = document.getElementById('register-box');
const userGreeting = document.getElementById('user-greeting');
const logoutBtn = document.getElementById('logout-btn');

function getToken() {
  return sessionStorage.getItem('token');
}

function authHeaders() {
  return { Authorization: `Bearer ${getToken()}` };
}

window.authHeaders = authHeaders;

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

function showLoginScreen(message = '') {
  loginOverlay.classList.remove('hidden');
  appContent.classList.add('hidden');
  if (message) loginError.textContent = message;
}

window.handleAuthExpired = function handleAuthExpired(message) {
  sessionStorage.removeItem('token');
  sessionStorage.removeItem('username');
  showLoginScreen(message || 'Сессия истекла. Войдите снова.');
};

function showApp(username) {
  loginOverlay.classList.add('hidden');
  appContent.classList.remove('hidden');
  userGreeting.textContent = `Привет, ${username}`;
  window.initHeaderNav?.(username);
}

showRegisterBtn.addEventListener('click', function () {
  loginBox.classList.add('hidden');
  registerBox.classList.remove('hidden');
  loginError.textContent = '';
});

showLoginBtn.addEventListener('click', function () {
  registerBox.classList.add('hidden');
  loginBox.classList.remove('hidden');
  registerError.textContent = '';
});

loginForm.addEventListener('submit', async function (event) {
  event.preventDefault();
  loginError.textContent = '';

  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value;

  try {
    const response = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    const data = await response.json();
    if (!response.ok) {
      loginError.textContent = data.error || 'Ошибка входа';
      return;
    }

    sessionStorage.setItem('token', data.token);
    sessionStorage.setItem('username', data.username);
    await startApp(data.username);
  } catch (error) {
    loginError.textContent = getConnectionErrorMessage();
  }
});

registerForm.addEventListener('submit', async function (event) {
  event.preventDefault();
  registerError.textContent = '';

  const username = document.getElementById('register-username').value.trim();
  const password = document.getElementById('register-password').value;

  try {
    const response = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    const data = await response.json();
    if (!response.ok) {
      registerError.textContent = data.error || 'Ошибка регистрации';
      return;
    }

    sessionStorage.setItem('token', data.token);
    sessionStorage.setItem('username', data.username);
    await startApp(data.username);
  } catch (error) {
    registerError.textContent = getConnectionErrorMessage();
  }
});

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
  loginForm.reset();
  registerForm.reset();

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

async function tryAutoLogin() {
  const token = getToken();
  const username = sessionStorage.getItem('username');

  if (!token || !username) {
    showLoginScreen();
    return;
  }

  try {
    const response = await fetch('/api/movies', { headers: authHeaders() });
    if (!response.ok) {
      sessionStorage.clear();
      showLoginScreen();
      return;
    }
    await startApp(username);
  } catch (error) {
    showLoginScreen();
  }
}

tryAutoLogin();
showFileProtocolWarning();
