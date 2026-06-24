/* ===================================================================
   movie.js — отдельная мобильная страница фильма/сериала/мультфильма.
   URL: /movie.html?type=movie|tv&id=<tmdbId>
   Самодостаточна: не зависит от DOM index.html. Авторизацию читает из
   sessionStorage; для добавления в список нужен вход.
   =================================================================== */
(function () {
  const root = document.getElementById('movie-root');
  const toastEl = document.getElementById('movie-toast');
  const backBtn = document.getElementById('movie-back');

  const params = new URLSearchParams(location.search);
  const tmdbId = params.get('id');
  const mediaType = params.get('type') === 'tv' ? 'tv' : 'movie';

  const t = (key, vars) => (window.t ? window.t(key, vars) : key);
  const lang = () => (window.I18N ? window.I18N.tmdbLang() : 'ru');

  backBtn?.addEventListener('click', () => {
    if (history.length > 1) history.back();
    else location.href = '/';
  });

  function token() { return sessionStorage.getItem('token'); }
  function isLoggedIn() { return Boolean(token() && sessionStorage.getItem('username')); }
  function authHeaders() {
    const t = token();
    return t ? { Authorization: `Bearer ${t}` } : {};
  }

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

  if (!tmdbId) {
    root.innerHTML = `<p class="moviepage-error">${esc(t('movie.notSpecified'))}</p>`;
    return;
  }

  function personHref(id) {
    return `/person.html?id=${encodeURIComponent(id)}`;
  }

  // ── Полноэкранный просмотр изображения с зумом и панорамированием ──
  let lightboxEl = null;
  let lbState = null;

  function buildLightbox() {
    const el = document.createElement('div');
    el.className = 'img-lightbox hidden';
    el.dataset.allowPinch = 'true';
    el.innerHTML = `
      <button type="button" class="img-lightbox-back">${esc(t('common.back'))}</button>
      <div class="img-lightbox-tools">
        <button type="button" class="img-lightbox-btn" data-act="out" aria-label="Уменьшить">−</button>
        <button type="button" class="img-lightbox-btn" data-act="reset" aria-label="Сбросить масштаб">1:1</button>
        <button type="button" class="img-lightbox-btn" data-act="in" aria-label="Увеличить">+</button>
      </div>
      <div class="img-lightbox-stage">
        <img class="img-lightbox-img" alt="">
      </div>`;
    document.body.appendChild(el);

    const stage = el.querySelector('.img-lightbox-stage');
    const img = el.querySelector('.img-lightbox-img');
    lbState = { scale: 1, x: 0, y: 0, dragging: false, sx: 0, sy: 0, ox: 0, oy: 0, moved: false };

    const apply = () => {
      img.style.transform = `translate(${lbState.x}px, ${lbState.y}px) scale(${lbState.scale})`;
      img.style.cursor = lbState.scale > 1 ? 'grab' : 'zoom-in';
      el.classList.toggle('img-lightbox--zoomed', lbState.scale > 1);
    };
    const reset = () => { lbState.scale = 1; lbState.x = 0; lbState.y = 0; apply(); };
    const setScale = (next) => {
      lbState.scale = Math.min(5, Math.max(1, next));
      if (lbState.scale === 1) { lbState.x = 0; lbState.y = 0; }
      apply();
    };

    el.querySelector('.img-lightbox-back').addEventListener('click', closeImageLightbox);
    el.querySelectorAll('.img-lightbox-btn').forEach((b) => {
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        const act = b.dataset.act;
        if (act === 'in') setScale(lbState.scale + 0.5);
        else if (act === 'out') setScale(lbState.scale - 0.5);
        else reset();
      });
    });

    // Клик по фону (вне картинки) закрывает; двойной клик по картинке — зум.
    stage.addEventListener('click', (e) => {
      if (lbState.moved) { lbState.moved = false; return; }
      if (e.target === img) {
        setScale(lbState.scale > 1 ? 1 : 2.5);
      } else {
        closeImageLightbox();
      }
    });

    // Колесо мыши — плавный зум.
    stage.addEventListener('wheel', (e) => {
      e.preventDefault();
      setScale(lbState.scale + (e.deltaY < 0 ? 0.3 : -0.3));
    }, { passive: false });

    // Перетаскивание при увеличении (только мышь — тач обрабатываем ниже).
    img.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'touch') return;
      if (lbState.scale <= 1) return;
      lbState.dragging = true; lbState.moved = false;
      lbState.sx = e.clientX; lbState.sy = e.clientY;
      lbState.ox = lbState.x; lbState.oy = lbState.y;
      img.setPointerCapture(e.pointerId);
      img.style.cursor = 'grabbing';
    });
    img.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'touch') return;
      if (!lbState.dragging) return;
      const dx = e.clientX - lbState.sx;
      const dy = e.clientY - lbState.sy;
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) lbState.moved = true;
      lbState.x = lbState.ox + dx;
      lbState.y = lbState.oy + dy;
      img.style.transform = `translate(${lbState.x}px, ${lbState.y}px) scale(${lbState.scale})`;
    });
    const endDrag = (e) => {
      if (e.pointerType === 'touch') return;
      if (!lbState.dragging) return;
      lbState.dragging = false;
      img.style.cursor = 'grab';
      try { img.releasePointerCapture(e.pointerId); } catch {}
    };
    img.addEventListener('pointerup', endDrag);
    img.addEventListener('pointercancel', endDrag);

    // ── Жесты на тач-устройствах: pinch-to-zoom двумя пальцами + панорама ──
    const touchDist = (touches) => {
      const dx = touches[0].clientX - touches[1].clientX;
      const dy = touches[0].clientY - touches[1].clientY;
      return Math.hypot(dx, dy);
    };
    let pinch = null; // { startDist, startScale }
    let touchPan = null; // { sx, sy, ox, oy }

    stage.addEventListener('touchstart', (e) => {
      if (e.touches.length === 2) {
        // Начало pinch — запоминаем расстояние между пальцами и текущий масштаб.
        pinch = { startDist: touchDist(e.touches) || 1, startScale: lbState.scale };
        touchPan = null;
        lbState.moved = true; // не считать как клик после жеста
        e.preventDefault();
      } else if (e.touches.length === 1) {
        lbState.moved = false;
        // Панорама одним пальцем (только когда увеличено).
        if (lbState.scale > 1) {
          const t = e.touches[0];
          touchPan = { sx: t.clientX, sy: t.clientY, ox: lbState.x, oy: lbState.y };
        }
      }
    }, { passive: false });

    stage.addEventListener('touchmove', (e) => {
      if (pinch && e.touches.length === 2) {
        e.preventDefault();
        const ratio = touchDist(e.touches) / pinch.startDist;
        setScale(pinch.startScale * ratio);
      } else if (touchPan && e.touches.length === 1) {
        e.preventDefault();
        const t = e.touches[0];
        const dx = t.clientX - touchPan.sx;
        const dy = t.clientY - touchPan.sy;
        if (Math.abs(dx) > 4 || Math.abs(dy) > 4) lbState.moved = true;
        lbState.x = touchPan.ox + dx;
        lbState.y = touchPan.oy + dy;
        img.style.transform = `translate(${lbState.x}px, ${lbState.y}px) scale(${lbState.scale})`;
      }
    }, { passive: false });

    const endTouch = (e) => {
      if (e.touches.length < 2) pinch = null;
      if (e.touches.length === 0) touchPan = null;
    };
    stage.addEventListener('touchend', endTouch);
    stage.addEventListener('touchcancel', endTouch);

    el._img = img;
    el._reset = reset;
    return el;
  }

  function onLightboxKey(e) {
    if (e.key === 'Escape') closeImageLightbox();
  }

  function openImageLightbox(src, alt) {
    if (!src) return;
    if (!lightboxEl) lightboxEl = buildLightbox();
    lightboxEl._reset();
    lightboxEl._img.src = src;
    lightboxEl._img.alt = alt || '';
    lightboxEl.classList.remove('hidden');
    document.body.classList.add('img-lightbox-open');
    document.addEventListener('keydown', onLightboxKey);
  }

  function closeImageLightbox() {
    if (!lightboxEl) return;
    lightboxEl.classList.add('hidden');
    document.body.classList.remove('img-lightbox-open');
    document.removeEventListener('keydown', onLightboxKey);
  }

  // Список «чипов» рейтингов (TMDB / IMDb / Кинопоиск / оценка сайта).
  function ratingChips(meta) {
    const items = [];
    if (meta.voteAverage) items.push(`<span class="movie-rating movie-rating--tmdb"><span class="movie-rating-src">TMDB</span><span class="movie-rating-val">${Number(meta.voteAverage).toFixed(1)}</span></span>`);
    if (meta.imdb?.rating) items.push(`<span class="movie-rating movie-rating--imdb"><span class="movie-rating-src">IMDb</span><span class="movie-rating-val">${esc(meta.imdb.rating)}</span></span>`);
    if (meta.kinopoisk?.rating) items.push(`<span class="movie-rating movie-rating--kp"><span class="movie-rating-src">${esc(t('rating.kinopoisk'))}</span><span class="movie-rating-val">${esc(meta.kinopoisk.rating)}</span></span>`);
    if (meta.siteRating?.average) {
      const c = meta.siteRating.count;
      const word = lang() === 'en'
        ? (c === 1 ? 'vote' : 'votes')
        : (c % 10 === 1 && c % 100 !== 11 ? 'оценка' : (c % 10 >= 2 && c % 10 <= 4 && (c % 100 < 10 || c % 100 >= 20) ? 'оценки' : 'оценок'));
      items.push(`<span class="movie-rating movie-rating--site" title="${esc(t('rating.siteTitle'))} (${c} ${word})"><span class="movie-rating-src">${esc(t('rating.site'))}</span><span class="movie-rating-val">${esc(meta.siteRating.average)} <small>· ${c}</small></span></span>`);
    }
    return items;
  }

  // Отдельный аккуратный блок рейтингов над описанием фильма.
  function ratingsHtml(meta) {
    const items = ratingChips(meta);
    if (!items.length) return '';
    return `
      <section class="movie-block movie-ratings-block">
        <h2 class="movie-block-title">${esc(t('movie.ratings'))}</h2>
        <div class="movie-ratings">${items.join('')}</div>
      </section>`;
  }

  function metaLine(data) {
    const m = data.meta || {};
    const parts = [];
    if (m.year) parts.push(esc(m.year));
    parts.push(data.mediaType === 'tv' ? t('common.series') : t('common.film'));
    if (m.runtime) parts.push(`${m.runtime} ${t('common.minutes')}`);
    if (m.seasons) parts.push(`${m.seasons} ${t('common.seasonsShort')}`);
    if (m.country) parts.push(esc(m.country));
    return parts.join(' · ');
  }

  // Кликабельный «чип» человека (актёр) → переход на страницу человека.
  function castChip(c) {
    if (c && c.id) {
      return `<a class="movie-cast-chip movie-cast-chip--link" href="${personHref(c.id)}">${esc(c.name)}</a>`;
    }
    return `<span class="movie-cast-chip">${esc(c.name || c)}</span>`;
  }

  function castHtml(meta) {
    const cast = meta.castDetails?.length
      ? meta.castDetails
      : (meta.cast ? String(meta.cast).split(',').map((s) => ({ name: s.trim() })) : []);
    if (!cast.length) return '';
    const chips = cast.slice(0, 12).map(castChip).join('');
    return `
      <section class="movie-block">
        <h2 class="movie-block-title">${esc(t('movie.cast'))}</h2>
        <div class="movie-cast">${chips}</div>
      </section>`;
  }

  // Блок «Сценарий» — кликабельные сценаристы (если есть данные с id).
  function writersHtml(meta) {
    const writers = meta.writerDetails?.length
      ? meta.writerDetails
      : (meta.writers ? String(meta.writers).split(',').map((s) => ({ name: s.trim() })) : []);
    if (!writers.length) return '';
    const chips = writers.slice(0, 6).map(castChip).join('');
    return `
      <section class="movie-block">
        <h2 class="movie-block-title">${esc(t('movie.writers'))}</h2>
        <div class="movie-cast">${chips}</div>
      </section>`;
  }

  function trailerHtml(meta) {
    if (!meta.trailer?.key) return '';
    return `
      <section class="movie-block">
        <h2 class="movie-block-title">${esc(t('movie.trailer'))}</h2>
        <div class="movie-trailer">
          <iframe
            src="https://www.youtube.com/embed/${encodeURIComponent(meta.trailer.key)}"
            title="${esc(meta.trailer.name || t('movie.trailerDefault'))}"
            frameborder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowfullscreen></iframe>
        </div>
      </section>`;
  }

  // Кнопка внешнего сайта: рабочая ссылка только при подтверждённом совпадении.
  // Пока проверяем — состояние «checking». Не нашли — неактивная кнопка.
  function siteBtn({ label, url, matched, loaded, mod }) {
    if (matched && url) {
      return `<a class="movie-watch-btn movie-watch-btn--${mod}" href="${esc(url)}" target="_blank" rel="noopener">${esc(t('movie.watchOn', { site: label }))}</a>`;
    }
    if (!loaded) {
      return `<span class="movie-watch-btn movie-watch-btn--${mod} movie-watch-btn--checking" aria-disabled="true">${esc(t('movie.checking', { site: label }))}</span>`;
    }
    return `<span class="movie-watch-btn movie-watch-btn--${mod} movie-watch-btn--disabled" aria-disabled="true" title="${esc(t('movie.notOn', { site: label }))}">${esc(t('movie.notOn', { site: label }))}</span>`;
  }

  // Внешние ссылки (просмотр / поиск) — отдельный блок в самом низу страницы.
  function watchLinksHtml(meta, data) {
    const loaded = Boolean(meta._extrasLoaded);
    const links = [];
    links.push(siteBtn({ label: 'HDRezka', url: meta.hdrezkaUrl, matched: meta.hdrezkaMatched, loaded, mod: 'hdrezka' }));
    links.push(siteBtn({ label: 'Kinogo', url: meta.kinogoUrl, matched: meta.kinogoMatched, loaded, mod: 'kinogo' }));

    const kindWord = data.mediaType === 'tv' ? t('common.series') : t('common.film');
    const query = encodeURIComponent(`${data.title} ${kindWord} ${lang() === 'en' ? 'watch online' : 'смотреть онлайн'}`);
    links.push(`<a class="movie-watch-btn movie-watch-btn--search" href="https://www.google.com/search?q=${query}" target="_blank" rel="noopener">${esc(t('movie.findGoogle'))}</a>`);

    const missing = loaded && (!meta.hdrezkaMatched || !meta.kinogoMatched);
    const note = missing
      ? `<p class="movie-watch-note">${esc(t('movie.watchNote', { kind: kindWord.toLowerCase() }))}</p>`
      : '';
    return `<div class="movie-watch-links">${links.join('')}</div>${note}`;
  }

  function watchSectionHtml(meta, data) {
    return `
      <section class="movie-block movie-watch-section">
        <h2 class="movie-block-title">${esc(t('movie.whereToWatch'))}</h2>
        <div id="movie-watch-slot">${watchLinksHtml(meta, data)}</div>
      </section>`;
  }

  function addControlsHtml() {
    return `
      <div class="movie-add">
        <p class="movie-add-label">${esc(t('movie.addToList'))}</p>
        <div class="movie-add-actions">
          <button type="button" class="movie-add-btn" data-status="want">${esc(t('movie.want'))}</button>
          <button type="button" class="movie-add-btn movie-add-btn--watched" data-status="watched">${esc(t('movie.watched'))}</button>
        </div>
      </div>`;
  }

  function render(data) {
    const meta = data.meta || {};
    const backdrop = meta.backdrop || meta.poster || '';
    const genres = (data.genres || []).slice(0, 5).map((g) => `<span class="movie-genre">${esc(g)}</span>`).join('');

    root.innerHTML = `
      <div class="movie-hero${backdrop ? ' movie-hero--zoomable' : ''}">
        ${backdrop ? `<div class="movie-hero-bg" style="background-image:url('${esc(backdrop)}')"></div>` : ''}
        <div class="movie-hero-overlay"></div>
        ${backdrop ? `<button type="button" class="movie-hero-expand" aria-label="${esc(t('movie.expand'))}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>
        </button>` : ''}
        <div class="movie-hero-content">
          ${meta.poster ? `<img class="movie-hero-poster" src="${esc(meta.poster)}" alt="${esc(data.title)}" loading="lazy">` : ''}
          <div class="movie-hero-text">
            <h1 class="movie-title">${esc(data.title)}</h1>
            ${meta.originalTitle && meta.originalTitle !== data.title ? `<p class="movie-original">${esc(meta.originalTitle)}</p>` : ''}
            <p class="movie-metaline">${metaLine(data)}</p>
            ${genres ? `<div class="movie-genres">${genres}</div>` : ''}
          </div>
        </div>
      </div>

      <div class="movie-body">
        ${meta.tagline ? `<p class="movie-tagline">«${esc(meta.tagline)}»</p>` : ''}
        ${addControlsHtml()}
        <div id="movie-ratings-slot">${ratingsHtml(meta)}</div>
        <div id="player-section"></div>
        <div id="torrents-section"></div>
        ${meta.overview ? `
          <section class="movie-block">
            <h2 class="movie-block-title">Описание</h2>
            <p class="movie-overview">${esc(meta.overview)}</p>
          </section>` : ''}
        ${meta.director ? `
          <section class="movie-block movie-block--inline">
            <h2 class="movie-block-title">${esc(t('movie.director'))}</h2>
            <p>${meta.directorId
              ? `<a class="movie-person-link" href="${personHref(meta.directorId)}">${esc(meta.director)}</a>`
              : esc(meta.director)}</p>
          </section>` : ''}
        ${writersHtml(meta)}
        ${castHtml(meta)}
        ${trailerHtml(meta)}
        ${watchSectionHtml(meta, data)}
      </div>`;

    root.querySelectorAll('.movie-add-btn').forEach((btn) => {
      btn.addEventListener('click', () => addToList(btn.dataset.status, data, btn));
    });

    // Баннер и постер открываются на весь экран с возможностью увеличения.
    const heroEl = root.querySelector('.movie-hero--zoomable');
    if (heroEl && backdrop) {
      heroEl.addEventListener('click', (e) => {
        if (e.target.closest('.movie-hero-poster')) return;
        openImageLightbox(backdrop, data.title);
      });
    }
    const posterEl = root.querySelector('.movie-hero-poster');
    if (posterEl && meta.poster) {
      posterEl.style.cursor = 'zoom-in';
      posterEl.addEventListener('click', (e) => {
        e.stopPropagation();
        openImageLightbox(meta.poster, data.title);
      });
    }

    document.title = `${data.title} — ${t('nav.brand')}`;
  }

  async function addToList(status, data, btn) {
    if (!isLoggedIn()) {
      toast(t('auth.loginToAdd'));
      setTimeout(() => { location.href = '/'; }, 1500);
      return;
    }
    const original = btn.textContent;
    btn.disabled = true;
    btn.textContent = t('movie.adding');
    try {
      const res = await fetch('/api/movies/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({
          tmdbId: data.tmdbId,
          mediaType: data.mediaType,
          status,
          title: data.title,
          genres: data.genres,
          poster: data.meta?.poster
        })
      });
      if (res.status === 401) {
        toast(t('auth.sessionExpired'));
        btn.disabled = false; btn.textContent = original;
        return;
      }
      const out = await res.json();
      if (!res.ok) throw new Error(out.error || t('common.error'));
      btn.textContent = out.updated ? t('movie.updated') : t('movie.inList');
      toast(status === 'watched' ? t('movie.addedWatched') : t('movie.addedWant'));
    } catch (err) {
      btn.disabled = false;
      btn.textContent = original;
      toast(err.message || t('movie.addFailed'));
    }
  }

  // Подгружаем «доп-данные» (рейтинги IMDb/Кинопоиск + ссылка на Kinogo)
  // отдельно и дорисовываем их на уже отрендеренной странице. Так основная
  // страница появляется мгновенно, а медленный скрейпинг не блокирует показ.
  async function loadExtras(data) {
    const meta = data.meta || (data.meta = {});
    try {
      const res = await fetch(`/api/movie/extras/${encodeURIComponent(tmdbId)}?type=${mediaType}&lang=${lang()}`, {
        headers: authHeaders()
      });
      if (res.ok) {
        const extras = await res.json();
        if (extras.imdb) meta.imdb = extras.imdb;
        if (extras.kinopoisk) meta.kinopoisk = extras.kinopoisk;
        if (extras.hdrezkaUrl) meta.hdrezkaUrl = extras.hdrezkaUrl;
        if (extras.kinogoUrl) meta.kinogoUrl = extras.kinogoUrl;
        meta.hdrezkaMatched = Boolean(extras.hdrezkaMatched);
        meta.kinogoMatched = Boolean(extras.kinogoMatched);
      }
    } catch { /* доп-данные необязательны — молча игнорируем */ }
    finally {
      // Проверка завершена (успешно или нет) — обновляем кнопки и рейтинги.
      meta._extrasLoaded = true;
      const ratingsSlot = document.getElementById('movie-ratings-slot');
      if (ratingsSlot) ratingsSlot.innerHTML = ratingsHtml(meta);
      const watchSlot = document.getElementById('movie-watch-slot');
      if (watchSlot) watchSlot.innerHTML = watchLinksHtml(meta, data);
    }
  }

  // ── Нативный плеер HDRezka. Бэкенд отдаёт прямые .mp4-потоки с качествами и
  //    списком озвучек; собираем обычный <video> и селекторы качества/озвучки.
  //    Потоки кэшируются на сервере, поэтому повторные открытия быстрые. ──
  let playerState = null; // { id, type, voices, activeVoice, qualities, activeQuality }

  // Выбираем качество «по умолчанию»: 720p, иначе максимально доступное.
  function pickDefaultQuality(qualities) {
    const byLabel = qualities.find((q) => /(^|\D)720p/i.test(q.label));
    return (byLabel || qualities[0])?.label || null;
  }

  function renderPlayerError(slot) {
    const body = slot.querySelector('.movie-player-status');
    if (body) {
      body.textContent = t('movie.playerUnavailable') || 'Плеер временно недоступен';
      body.classList.add('movie-player-status--error');
    }
  }

  function playerControlsHtml() {
    const { voices, activeVoice, qualities, activeQuality } = playerState;
    const qualityOpts = qualities
      .map((q) => `<option value="${esc(q.label)}"${q.label === activeQuality ? ' selected' : ''}>${esc(q.label)}</option>`)
      .join('');
    const voiceSelect = voices.length > 1
      ? `<label class="movie-player-ctrl">
           <span>${esc(t('movie.voice') || 'Озвучка')}</span>
           <select class="movie-player-voice">
             ${voices.map((v) => `<option value="${esc(v.id)}"${String(v.id) === String(activeVoice) ? ' selected' : ''}>${esc(v.name)}</option>`).join('')}
           </select>
         </label>`
      : '';
    return `
      <div class="movie-player-controls">
        ${voiceSelect}
        <label class="movie-player-ctrl">
          <span>${esc(t('movie.quality') || 'Качество')}</span>
          <select class="movie-player-quality">${qualityOpts}</select>
        </label>
      </div>`;
  }

  function currentQualityUrl() {
    const q = playerState.qualities.find((x) => x.label === playerState.activeQuality)
      || playerState.qualities[0];
    return q?.url || '';
  }

  // Переключаем источник <video>, сохраняя позицию и состояние воспроизведения.
  function swapVideoSource(video, url, { resumeTime = 0, wasPlaying = false } = {}) {
    if (!url) return;
    video.src = url;
    const restore = () => {
      video.removeEventListener('loadedmetadata', restore);
      if (resumeTime > 0 && Number.isFinite(resumeTime)) {
        try { video.currentTime = resumeTime; } catch {}
      }
      if (wasPlaying) video.play().catch(() => {});
    };
    video.addEventListener('loadedmetadata', restore);
    video.load();
  }

  function mountPlayerUI(slot) {
    const block = slot.querySelector('.movie-player-block');
    block.querySelector('.movie-player-status')?.remove();

    const wrap = document.createElement('div');
    wrap.innerHTML = `
      ${playerControlsHtml()}
      <div class="movie-player">
        <video class="movie-player-video" controls playsinline preload="metadata"></video>
      </div>`;
    block.appendChild(wrap);

    const video = block.querySelector('.movie-player-video');
    swapVideoSource(video, currentQualityUrl());

    block.querySelector('.movie-player-quality')?.addEventListener('change', (e) => {
      playerState.activeQuality = e.target.value;
      swapVideoSource(video, currentQualityUrl(), {
        resumeTime: video.currentTime,
        wasPlaying: !video.paused
      });
    });

    block.querySelector('.movie-player-voice')?.addEventListener('change', async (e) => {
      await switchVoice(slot, e.target.value, video);
    });
  }

  // Смена озвучки: запрашиваем потоки нужного перевода и обновляем плеер.
  async function switchVoice(slot, translatorId, video) {
    const resumeTime = video?.currentTime || 0;
    const wasPlaying = video ? !video.paused : false;
    try {
      const res = await fetch(`/api/movie/player/${encodeURIComponent(playerState.id)}?type=${playerState.type}&translator=${encodeURIComponent(translatorId)}`, {
        headers: authHeaders()
      });
      const data = await res.json().catch(() => ({}));
      if (!data?.qualities?.length) { toast(t('movie.voiceFailed') || 'Не удалось сменить озвучку'); return; }
      playerState.activeVoice = data.activeVoice || translatorId;
      playerState.qualities = data.qualities;
      if (!playerState.qualities.some((q) => q.label === playerState.activeQuality)) {
        playerState.activeQuality = pickDefaultQuality(playerState.qualities);
      }
      // Перерисовываем селектор качества (набор качеств мог измениться).
      const block = slot.querySelector('.movie-player-block');
      const controls = block.querySelector('.movie-player-controls');
      if (controls) controls.outerHTML = playerControlsHtml();
      const vid = block.querySelector('.movie-player-video');
      block.querySelector('.movie-player-quality')?.addEventListener('change', (e) => {
        playerState.activeQuality = e.target.value;
        swapVideoSource(vid, currentQualityUrl(), { resumeTime: vid.currentTime, wasPlaying: !vid.paused });
      });
      block.querySelector('.movie-player-voice')?.addEventListener('change', (e) => switchVoice(slot, e.target.value, vid));
      swapVideoSource(vid, currentQualityUrl(), { resumeTime, wasPlaying });
    } catch {
      toast(t('movie.voiceFailed') || 'Не удалось сменить озвучку');
    }
  }

  async function loadPlayer(id, type) {
    const slot = document.getElementById('player-section');
    if (!slot) return;
    slot.innerHTML = `
      <section class="movie-block movie-player-block">
        <h2 class="movie-block-title">${esc(t('movie.player') || 'Смотреть онлайн')}</h2>
        <div class="movie-player-status">${esc(t('common.loading') || 'Загрузка…')}</div>
      </section>`;
    try {
      const res = await fetch(`/api/movie/player/${encodeURIComponent(id)}?type=${type}`, {
        headers: authHeaders()
      });
      const data = await res.json().catch(() => ({}));
      if (!data?.qualities?.length) { renderPlayerError(slot); return; }
      playerState = {
        id,
        type,
        voices: data.voices || [],
        activeVoice: data.activeVoice || null,
        qualities: data.qualities,
        activeQuality: pickDefaultQuality(data.qualities)
      };
      mountPlayerUI(slot);
    } catch {
      renderPlayerError(slot);
    }
  }

  function torrentRow(item) {
    const seeds = Number(item.seeds || 0);
    const leechs = Number(item.leechs || 0);
    const magnetBtn = item.magnet
      ? `<a href="${esc(item.magnet)}" class="btn-magnet">${esc(t('movie.magnet') || 'Магнит')}</a>`
      : '';
    const fileBtn = item.torrentUrl
      ? `<button type="button" class="btn-download" data-torrent-url="${esc(item.torrentUrl)}">${esc(t('movie.downloadTorrent') || 'Скачать .torrent')}</button>`
      : '';
    return `
      <li class="torrent-item">
        <div class="torrent-title">${esc(item.title)}</div>
        <div class="torrent-meta">
          ${item.size ? `<span class="torrent-size">${esc(item.size)}</span>` : ''}
          <span class="torrent-seeds">▲ ${seeds}</span>
          <span class="torrent-leechs">▼ ${leechs}</span>
        </div>
        <div class="torrent-actions">${magnetBtn}${fileBtn}</div>
      </li>`;
  }

  async function downloadTorrent(btn) {
    const url = btn.dataset.torrentUrl;
    if (!url) return;
    const original = btn.textContent;
    btn.disabled = true;
    btn.textContent = t('movie.downloading') || 'Скачивание…';
    try {
      const res = await fetch(`/api/torrents/download?url=${encodeURIComponent(url)}`, {
        headers: authHeaders()
      });
      if (!res.ok) throw new Error('download');
      const blob = await res.blob();
      const disposition = res.headers.get('content-disposition') || '';
      const name = disposition.match(/filename="?([^"]+)"?/i)?.[1] || 'download.torrent';
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objUrl;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(objUrl), 4000);
    } catch {
      toast(t('movie.downloadFailed') || 'Не удалось скачать торрент');
    } finally {
      btn.disabled = false;
      btn.textContent = original;
    }
  }

  // ── Торренты (Rutor). Поиск по названию, кэшируется на сервере (15 мин). ──
  async function loadTorrents(title, type) {
    const slot = document.getElementById('torrents-section');
    if (!slot || !title) return;
    slot.innerHTML = `
      <section class="movie-block movie-torrents-block">
        <h2 class="movie-block-title">${esc(t('movie.torrents') || 'Торренты')}</h2>
        <div class="movie-torrents-status">${esc(t('common.loading') || 'Загрузка…')}</div>
      </section>`;
    const statusEl = slot.querySelector('.movie-torrents-status');
    try {
      const res = await fetch(`/api/torrents/search?query=${encodeURIComponent(title)}&type=${type}`, {
        headers: authHeaders()
      });
      const items = await res.json().catch(() => []);
      if (!Array.isArray(items) || !items.length) {
        statusEl.textContent = t('movie.torrentsEmpty') || 'Раздачи не найдены';
        return;
      }
      const list = items.slice(0, 25).map(torrentRow).join('');
      statusEl.outerHTML = `<ul class="torrent-list">${list}</ul>`;
      slot.querySelectorAll('.btn-download').forEach((btn) => {
        btn.addEventListener('click', () => downloadTorrent(btn));
      });
    } catch {
      if (statusEl) statusEl.textContent = t('movie.torrentsError') || 'Не удалось загрузить торренты';
    }
  }

  let currentData = null;

  async function load() {
    try {
      const res = await fetch(`/api/movie/details/${encodeURIComponent(tmdbId)}?type=${mediaType}&lang=${lang()}`, {
        headers: authHeaders()
      });
      if (!res.ok) throw new Error('TMDB');
      const data = await res.json();
      if (!data?.title) throw new Error('not found');
      data.mediaType = data.mediaType || mediaType;
      data.tmdbId = data.tmdbId || Number(tmdbId);
      currentData = data;
      render(data);
      // Не ждём доп-данные — страница уже показана.
      loadExtras(data);
      // Плеер и торренты грузим независимо (медленный скрейпинг не блокирует показ).
      loadPlayer(data.tmdbId, data.mediaType);
      loadTorrents(data.title, data.mediaType);
    } catch (err) {
      root.innerHTML = `<p class="moviepage-error">${esc(t('movie.loadError'))}</p>`;
    }
  }

  // Смена языка: перезагружаем данные (описание/жанры/название из TMDB зависят
  // от языка) и заново рендерим страницу.
  document.addEventListener('i18n:change', () => { load(); });

  load();
})();
