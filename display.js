(function () {
  const CYRILLIC_RE = /[а-яёәғқңөұүіһА-ЯЁӘҒҚҢӨҰҮІҺ]/;
  const metaCache = new Map();

  function currentLang() {
    return (window.I18N && window.I18N.getLang) ? window.I18N.getLang() : 'ru';
  }

  function itemMetaKey(item, lang) {
    const tmdbId = item?.tmdbId ?? null;
    if (!tmdbId) return null;
    const mediaType = (item.mediaType || item.media_type) === 'tv' ? 'tv' : 'movie';
    return `${mediaType}:${tmdbId}:${lang}`;
  }

  function getCachedMeta(item, lang) {
    const key = itemMetaKey(item, lang || currentLang());
    return key ? metaCache.get(key) : null;
  }

  function latinFallbackTitle(item) {
    const original = item?.originalTitle || item?.meta?.originalTitle || null;
    if (original && !CYRILLIC_RE.test(original)) return original;
    return null;
  }

  function localizeHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    if (window.I18N?.apiHeaders) Object.assign(headers, window.I18N.apiHeaders());
    if (typeof window.authHeaders === 'function') Object.assign(headers, window.authHeaders());
    return headers;
  }

  async function fetchLocalizedMeta(items, lang) {
    const pending = (items || []).filter((item) => {
      const key = itemMetaKey(item, lang);
      return key && !metaCache.has(key);
    });
    if (!pending.length) return;

    const payloadItems = pending
      .map((item) => ({
        tmdbId: item.tmdbId ?? null,
        mediaType: item.mediaType || item.media_type || 'movie'
      }))
      .filter((item) => item.tmdbId);

    for (let i = 0; i < payloadItems.length; i += 80) {
      const chunk = payloadItems.slice(i, i + 80);
      try {
        const res = await fetch('/api/titles/localize', {
          method: 'POST',
          headers: localizeHeaders(),
          body: JSON.stringify({ items: chunk })
        });
        if (!res.ok) continue;
        const data = await res.json();
        const resolvedLang = data.lang || lang;
        Object.entries(data.items || {}).forEach(([baseKey, meta]) => {
          if (meta) metaCache.set(`${baseKey}:${resolvedLang}`, meta);
        });
        Object.entries(data.titles || {}).forEach(([baseKey, title]) => {
          const cacheKey = `${baseKey}:${resolvedLang}`;
          const existing = metaCache.get(cacheKey) || {};
          if (title) existing.title = title;
          metaCache.set(cacheKey, existing);
        });
        Object.entries(data.overviews || {}).forEach(([baseKey, overview]) => {
          const cacheKey = `${baseKey}:${resolvedLang}`;
          const existing = metaCache.get(cacheKey) || {};
          if (overview) existing.overview = overview;
          metaCache.set(cacheKey, existing);
        });
        Object.entries(data.genres || {}).forEach(([baseKey, genres]) => {
          const cacheKey = `${baseKey}:${resolvedLang}`;
          const existing = metaCache.get(cacheKey) || {};
          if (Array.isArray(genres) && genres.length) existing.genres = genres;
          metaCache.set(cacheKey, existing);
        });
      } catch { /* offline / guest */ }
    }
  }

  window.MovieDisplay = {
  escapeHtml(text) {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/"/g, '&quot;');
  },

  normalizeTitle(text) {
    return String(text || '').toLowerCase().replace(/\s+/g, ' ').trim();
  },

  shouldShowOriginal(originalTitle, displayTitle) {
    if (!originalTitle) return false;
    return this.normalizeTitle(originalTitle) !== this.normalizeTitle(displayTitle);
  },

  formatOriginalTitleHtml(originalTitle, displayTitle, className = 'movie-original-title') {
    if (!this.shouldShowOriginal(originalTitle, displayTitle)) return '';
    return `<span class="${className}">${this.escapeHtml(originalTitle)}</span>`;
  },

  formatDateTime(iso) {
    if (!iso) return '—';
    const lang = window.I18N?.getLang?.() || 'ru';
    const locale = lang === 'en' ? 'en-US' : lang === 'kk' ? 'kk-KZ' : 'ru-RU';
    return new Date(iso).toLocaleString(locale, {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  },

  formatDateTimeShort(iso) {
    if (!iso) return '—';
    const lang = window.I18N?.getLang?.() || 'ru';
    const locale = lang === 'en' ? 'en-US' : lang === 'kk' ? 'kk-KZ' : 'ru-RU';
    return new Date(iso).toLocaleString(locale, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  },

  getTodayIso() {
    return new Date().toISOString().slice(0, 10);
  },

  parseReleaseDateIso(value) {
    if (!value) return null;
    const raw = String(value).trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);

    const dmy = raw.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
    if (dmy) {
      const [, day, month, year] = dmy;
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }

    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString().slice(0, 10);
    }

    return null;
  },

  isFutureReleaseDate(value, today = this.getTodayIso()) {
    const iso = this.parseReleaseDateIso(value);
    return iso ? iso > today : false;
  },

  isPastReleaseDate(value, today = this.getTodayIso()) {
    const iso = this.parseReleaseDateIso(value);
    return iso ? iso <= today : false;
  },

  upgradeTmdbPosterUrl(url, size = 'w780') {
    if (!url) return null;
    const raw = String(url);
    if (raw.includes('image.tmdb.org/t/p/')) {
      return raw.replace(/\/t\/p\/w\d+/, `/t/p/${size}`);
    }
    return raw;
  },

  posterUrl(url, size = 'w780') {
    return this.upgradeTmdbPosterUrl(url, size);
  },

  tmdbPosterFromPath(posterPath, size = 'w780') {
    if (!posterPath) return null;
    const path = String(posterPath).startsWith('/') ? posterPath : `/${posterPath}`;
    return `https://image.tmdb.org/t/p/${size}${path}`;
  },

  // Ссылка на внутреннюю страницу фильма (/movie.html). Возвращает null, если
  // у фильма нет tmdbId — тогда переход на страницу невозможен. Используется
  // во всех местах, где показываются фильмы (список, рекомендации, чат и т.д.),
  // чтобы по клику на постер/название открывалась карточка фильма.
  moviePageUrl(item) {
    const tmdbId = item && (item.tmdbId ?? item.id ?? null);
    if (!tmdbId) return null;
    const type = (item.mediaType || item.media_type) === 'tv' ? 'tv' : 'movie';
    return `/movie.html?type=${type}&id=${encodeURIComponent(tmdbId)}`;
  },

  createWhyToggle(whyText, options = {}) {
    const text = String(whyText || '').trim();
    if (!text) return null;

    const label = options.label || 'Почему я это вижу?';
    const wrap = document.createElement('div');
    wrap.className = 'why-toggle';

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'why-toggle-btn';
    btn.textContent = label;

    const panel = document.createElement('div');
    panel.className = 'why-toggle-panel hidden';
    panel.textContent = text;

    btn.addEventListener('click', (event) => {
      event.stopPropagation();
      const isHidden = panel.classList.toggle('hidden');
      btn.classList.toggle('why-toggle-btn--open', !isHidden);
      btn.textContent = isHidden ? label : 'Скрыть';
    });

    wrap.appendChild(btn);
    wrap.appendChild(panel);
    return wrap;
  },

  displayTitle(item) {
    if (!item) return window.t ? window.t('movie.noTitle') : 'Без названия';
    const lang = currentLang();
    const cached = getCachedMeta(item, lang);
    if (cached?.title) return cached.title;
    if (lang === 'ru') {
      return item.title || item.name || latinFallbackTitle(item) || (window.t ? window.t('movie.noTitle') : 'Без названия');
    }
    if (lang === 'en') {
      const latin = latinFallbackTitle(item);
      if (latin) return latin;
    }
    return item.title || item.name || latinFallbackTitle(item) || (window.t ? window.t('movie.noTitle') : 'Без названия');
  },

  displayGenre(name) {
    if (!name) return '';
    const lang = currentLang();
    return window.GenreI18n?.translate?.(name, lang) || String(name);
  },

  displayGenres(item) {
    const lang = currentLang();
    const cached = getCachedMeta(item, lang);
    if (cached?.genres?.length) return cached.genres;
    const source = item?.genres || item?.meta?.genres || [];
    if (lang === 'ru') return source;
    if (window.GenreI18n?.translateList) return window.GenreI18n.translateList(source, lang);
    return source;
  },

  displayOverview(item) {
    const lang = currentLang();
    const cached = getCachedMeta(item, lang);
    if (cached?.overview) return cached.overview;
    const text = item?.overview || item?.meta?.overview || '';
    return typeof text === 'string' ? text.trim() : '';
  },

  async localizeTitles(items) {
    const lang = currentLang();
    await fetchLocalizedMeta(items, lang);
  },

  clearLocalizedCache() {
    metaCache.clear();
  }
};

document.addEventListener('i18n:change', () => {
  metaCache.clear();
});
})();
