/* ===================================================================
   person.js — отдельная страница человека (актёр / режиссёр / сценарист
   и др.). URL: /person.html?id=<tmdbPersonId>
   По структуре повторяет страницу фильма: крупное фото, основная инфа,
   биография, фильмография сеткой. Локализуется через i18n (RU/EN).
   =================================================================== */
(function () {
  'use strict';

  const root = document.getElementById('person-root');
  const toastEl = document.getElementById('person-toast');
  const backBtn = document.getElementById('person-back');

  const params = new URLSearchParams(location.search);
  const personId = params.get('id');

  const t = (key, vars) => (window.t ? window.t(key, vars) : key);
  const lang = () => (window.I18N ? window.I18N.tmdbLang() : 'ru');

  backBtn?.addEventListener('click', () => {
    if (history.length > 1) history.back();
    else location.href = '/';
  });

  function esc(text) {
    return String(text == null ? '' : text)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  let toastTimer = null;
  function toast(message) {
    if (!toastEl) return;
    toastEl.textContent = message;
    toastEl.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toastEl.hidden = true; }, 2600);
  }

  if (!personId) {
    root.innerHTML = `<p class="moviepage-error">${esc(t('person.notSpecified'))}</p>`;
    return;
  }

  // ── Компактный полноэкранный просмотр фото ──
  let lightboxEl = null;
  function openPhoto(src, alt) {
    if (!src) return;
    if (!lightboxEl) {
      lightboxEl = document.createElement('div');
      lightboxEl.className = 'img-lightbox hidden';
      lightboxEl.innerHTML =
        `<button type="button" class="img-lightbox-back">${esc(t('common.back'))}</button>` +
        '<div class="img-lightbox-stage"><img class="img-lightbox-img" alt=""></div>';
      document.body.appendChild(lightboxEl);
      const close = () => {
        lightboxEl.classList.add('hidden');
        document.body.classList.remove('img-lightbox-open');
      };
      lightboxEl.querySelector('.img-lightbox-back').addEventListener('click', close);
      lightboxEl.querySelector('.img-lightbox-stage').addEventListener('click', (e) => {
        if (e.target.classList.contains('img-lightbox-stage')) close();
      });
    }
    const img = lightboxEl.querySelector('.img-lightbox-img');
    img.src = src;
    img.alt = alt || '';
    lightboxEl.classList.remove('hidden');
    document.body.classList.add('img-lightbox-open');
  }

  function formatDate(iso) {
    if (!iso) return null;
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    try {
      return new Intl.DateTimeFormat(lang() === 'en' ? 'en-US' : 'ru-RU', {
        day: 'numeric', month: 'long', year: 'numeric'
      }).format(d);
    } catch {
      return iso;
    }
  }

  function calcAge(birthday, deathday) {
    if (!birthday) return null;
    const b = new Date(birthday);
    const end = deathday ? new Date(deathday) : new Date();
    if (isNaN(b.getTime()) || isNaN(end.getTime())) return null;
    let age = end.getFullYear() - b.getFullYear();
    const m = end.getMonth() - b.getMonth();
    if (m < 0 || (m === 0 && end.getDate() < b.getDate())) age--;
    return age >= 0 && age < 130 ? age : null;
  }

  function roleLabel(data) {
    let key = data.knownForKey || 'roleCrew';
    if (key === 'roleActor' && data.gender === 1) key = 'roleActress';
    return t('person.' + key);
  }

  function metaRow(label, value) {
    if (!value) return '';
    return `<div class="person-meta-row"><span class="person-meta-label">${esc(label)}</span><span class="person-meta-value">${esc(value)}</span></div>`;
  }

  function filmCardHtml(film) {
    const href = `/movie.html?type=${film.mediaType === 'tv' ? 'tv' : 'movie'}&id=${encodeURIComponent(film.id)}`;
    const rating = film.voteAverage ? Number(film.voteAverage).toFixed(1) : null;
    const poster = film.poster
      ? `<img class="person-film-poster" src="${esc(film.poster)}" alt="${esc(film.title)}" loading="lazy">`
      : `<div class="person-film-poster person-film-poster--empty">🎬</div>`;
    return `
      <a class="person-film-card" href="${href}">
        <div class="person-film-thumb">
          ${poster}
          ${rating ? `<span class="person-film-rating">★ ${esc(rating)}</span>` : ''}
        </div>
        <div class="person-film-info">
          <span class="person-film-title">${esc(film.title)}</span>
          <span class="person-film-sub">${film.year ? esc(film.year) : ''}${film.role ? `${film.year ? ' · ' : ''}${esc(film.role)}` : ''}</span>
        </div>
      </a>`;
  }

  function render(data) {
    const age = calcAge(data.birthday, data.deathday);
    const birthLine = data.birthday
      ? `${formatDate(data.birthday)}${age != null && !data.deathday ? ` · ${t('person.years', { n: age })}` : ''}`
      : null;

    const metaRows = [
      metaRow(t('person.originalName'), data.originalName && data.originalName !== data.name ? data.originalName : null),
      metaRow(t('person.bornDate'), birthLine),
      metaRow(t('person.died'), data.deathday ? formatDate(data.deathday) : null),
      metaRow(t('person.bornPlace'), data.placeOfBirth),
      metaRow(t('person.height'), data.height)
    ].join('');

    const films = Array.isArray(data.filmography) ? data.filmography : [];
    const filmsHtml = films.length
      ? `<div class="person-films-grid">${films.map(filmCardHtml).join('')}</div>`
      : `<p class="movie-overview">${esc(t('person.noFilmography'))}</p>`;

    const photo = data.photo;

    root.innerHTML = `
      <div class="movie-hero person-hero">
        ${photo ? `<div class="movie-hero-bg" style="background-image:url('${esc(photo)}')"></div>` : ''}
        <div class="movie-hero-overlay"></div>
        <div class="movie-hero-content">
          ${photo
            ? `<img class="movie-hero-poster person-photo" src="${esc(photo)}" alt="${esc(data.name)}" loading="lazy">`
            : `<div class="movie-hero-poster person-photo person-photo--empty">👤</div>`}
          <div class="movie-hero-text">
            <h1 class="movie-title">${esc(data.name)}</h1>
            ${data.originalName && data.originalName !== data.name ? `<p class="movie-original">${esc(data.originalName)}</p>` : ''}
            <p class="movie-metaline person-known">${esc(t('person.knownFor'))}: ${esc(roleLabel(data))}</p>
          </div>
        </div>
      </div>

      <div class="movie-body">
        ${metaRows ? `<section class="movie-block person-meta-block">${metaRows}</section>` : ''}
        ${data.biography ? `
          <section class="movie-block">
            <h2 class="movie-block-title">${esc(t('person.biography'))}</h2>
            <p class="movie-overview person-bio">${esc(data.biography)}</p>
          </section>` : ''}
        <section class="movie-block">
          <h2 class="movie-block-title">${esc(t('person.filmography'))}${films.length ? ` <span class="person-films-count">${films.length}</span>` : ''}</h2>
          ${filmsHtml}
        </section>
      </div>`;

    const photoEl = root.querySelector('.person-photo');
    if (photoEl && photo) {
      photoEl.style.cursor = 'zoom-in';
      photoEl.addEventListener('click', () => openPhoto(photo, data.name));
    }

    document.title = `${data.name} — ${t('nav.brand')}`;
  }

  let lastData = null;

  async function load() {
    root.innerHTML = `
      <div class="moviepage-loading">
        <div class="loading-ui" role="status">
          <span class="loading-ui__spinner" aria-hidden="true"></span>
          <span class="loading-ui__text">${esc(t('common.loading'))}</span>
        </div>
      </div>`;
    try {
      const res = await fetch(`/api/person/${encodeURIComponent(personId)}/full?lang=${lang()}`);
      if (!res.ok) throw new Error('TMDB');
      const data = await res.json();
      if (!data?.name) throw new Error('not found');
      lastData = data;
      render(data);
    } catch (err) {
      root.innerHTML = `<p class="moviepage-error">${esc(t('person.loadError'))}</p>`;
    }
  }

  // Смена языка: перезапрашиваем (биография/описания зависят от языка).
  document.addEventListener('i18n:change', () => { load(); });

  load();
})();
