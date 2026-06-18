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
    return new Date(iso).toLocaleString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  },

  formatDateTimeShort(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('ru-RU', {
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
  }
};
