const CACHE_VERSION = 'kinder-pwa-v8';
const APP_SHELL = [
  '/',
  '/index.html',
  '/account.html',
  '/battle.html',
  '/movie.html',
  '/person.html',
  '/i18n.js',
  '/person.js',
  '/style.css',
  '/psychTest.css',
  '/visualTest.css',
  '/shortVisualTest.css',
  '/appShell.css',
  '/mobile.css',
  '/theme.js',
  '/mobileShell.js',
  '/guestStore.js',
  '/guestSwipeActions.js',
  '/mediaCategories.js',
  '/movie.js',
  '/appShell.js',
  '/display.js',
  '/loadingUI.js',
  '/dedupeBrowser.js',
  '/importParsersBrowser.js',
  '/battleLogic.js',
  '/script.js',
  '/features.js',
  '/battle.js',
  '/watchNowBrowser.js',
  '/discover.js',
  '/watchedRatingModal.js',
  '/extendedFeatures.js',
  '/visualTestScenes.js',
  '/visualTest.js',
  '/shortVisualTest.js',
  '/psychTest.js',
  '/profile.js',
  '/account.js',
  '/headerNav.js',
  '/pwa.js',
  '/auth.js',
  '/manifest.webmanifest',
  '/icons/brand-mark.png',
  '/icons/favicon-16.png',
  '/icons/favicon-32.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/maskable-512.png',
  '/icons/apple-touch-icon-180.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(request));
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match('/index.html')))
    );
    return;
  }

  // Статические ресурсы (js/css/иконки): network-first, чтобы правки
  // кода всегда доезжали до установленной PWA, а кэш служил оффлайн-фоллбэком.
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response && response.status === 200) {
          const copy = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request))
  );
});
