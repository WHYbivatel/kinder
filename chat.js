(function () {
  const chatToggle = document.getElementById('chat-toggle');
  const chatPanel = document.getElementById('chat-panel');
  const chatClose = document.getElementById('chat-close');
  const chatForm = document.getElementById('chat-form');
  const chatInput = document.getElementById('chat-input');
  const chatMessages = document.getElementById('chat-messages');
  const chatSendBtn = document.getElementById('chat-send');
  const chatTasteBtn = document.getElementById('chat-taste-btn');

  if (!chatToggle || !chatPanel) {
    console.error('AI-помощник: не найдены элементы #chat-toggle или #chat-panel');
    return;
  }

  const chatHistory = [];

  if (chatForm) chatForm.setAttribute('autocomplete', 'off');
  if (chatInput) {
    chatInput.setAttribute('autocomplete', 'off');
    chatInput.setAttribute('autocorrect', 'off');
    chatInput.setAttribute('spellcheck', 'false');
    chatInput.setAttribute('readonly', 'readonly');
    chatInput.addEventListener('focus', () => chatInput.removeAttribute('readonly'));
  }

  function escapeHtml(text) {
    return String(text ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function formatChatInline(text) {
    return escapeHtml(text)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/«([^»]+)»/g, '<span class="chat-movie-title">«$1»</span>')
      .replace(/`([^`]+)`/g, '<code class="chat-inline-code">$1</code>');
  }

  function renderChatContent(text) {
    const lines = String(text || '').split('\n');
    const parts = [];
    let listType = null;
    let listItems = [];

    function flushList() {
      if (!listItems.length) return;
      const tag = listType === 'ol' ? 'ol' : 'ul';
      parts.push(
        `<${tag} class="chat-list chat-list--${listType}">${listItems
          .map((item) => `<li>${formatChatInline(item)}</li>`)
          .join('')}</${tag}>`
      );
      listItems = [];
      listType = null;
    }

    for (const line of lines) {
      const trimmed = line.trim();

      if (/^\d+\.\s+/.test(trimmed)) {
        if (listType && listType !== 'ol') flushList();
        listType = 'ol';
        listItems.push(trimmed.replace(/^\d+\.\s+/, ''));
        continue;
      }

      if (/^[-•*]\s+/.test(trimmed)) {
        if (listType && listType !== 'ul') flushList();
        listType = 'ul';
        listItems.push(trimmed.replace(/^[-•*]\s+/, ''));
        continue;
      }

      if (!trimmed) {
        flushList();
        continue;
      }

      flushList();

      if (/^⚠/.test(trimmed)) {
        parts.push(`<p class="chat-notice chat-notice--warn">${formatChatInline(trimmed)}</p>`);
      } else if (/^🎯/.test(trimmed)) {
        parts.push(`<p class="chat-notice chat-notice--accent">${formatChatInline(trimmed)}</p>`);
      } else {
        parts.push(`<p class="chat-paragraph">${formatChatInline(trimmed)}</p>`);
      }
    }

    flushList();
    return parts.join('') || `<p class="chat-paragraph">${formatChatInline(text)}</p>`;
  }

  function getConnectionErrorMessage() {
    if (window.location.protocol === 'file:') {
      return 'Откройте http://localhost:3000';
    }
    return 'Сервер не отвечает. Запустите: node server.js';
  }

  function toggleChat(open) {
    chatPanel.classList.toggle('hidden', !open);
    chatPanel.classList.toggle('chat-panel--open', open);
    chatToggle.setAttribute('aria-expanded', String(open));
    if (open && chatInput) {
      setTimeout(() => chatInput.focus(), 100);
    }
  }

  chatToggle.addEventListener('click', function () {
    const isHidden = chatPanel.classList.contains('hidden');
    toggleChat(isHidden);
  });

  chatClose?.addEventListener('click', function () {
    toggleChat(false);
  });

  function addMessage(text, role) {
    const div = document.createElement('div');
    div.className = `chat-message chat-message--${role}`;

    if (role === 'bot' || role === 'error') {
      div.innerHTML = renderChatContent(text);
    } else {
      div.textContent = text;
    }

    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    return div;
  }

  function setChatBusy(busy) {
    if (chatInput) chatInput.disabled = busy;
    if (chatSendBtn) chatSendBtn.disabled = busy;
    if (chatTasteBtn) chatTasteBtn.disabled = busy;
  }

  /* ── КАРТОЧКИ РЕКОМЕНДАЦИЙ ───────────────────────────────────────────
     Когда /api/chat возвращает { type: "recommendations", items: [...] },
     мы рисуем не текст, а карточки фильмов/сериалов с кнопками действий.
     Это и есть превращение рекомендаций из чата в карточки. */
  const CARD_STATUS_LABELS = {
    want: 'Хочу посмотреть',
    watching: 'Смотрю',
    watched: 'Посмотрел'
  };

  function findExistingMovie(card) {
    const movies = window.MovieApp?.getMovies?.() || [];
    const title = String(card.title || '').trim().toLowerCase();
    return movies.find((m) =>
      (card.tmdbId && m.tmdbId === card.tmdbId)
      || String(m.title || '').trim().toLowerCase() === title
    );
  }

  function showCardNotice(cardEl, text, kind) {
    const notice = cardEl.querySelector('.chat-rec-notice');
    if (!notice) return;
    notice.textContent = text;
    notice.classList.remove('chat-rec-notice--ok', 'chat-rec-notice--warn');
    notice.classList.add(kind === 'warn' ? 'chat-rec-notice--warn' : 'chat-rec-notice--ok');
  }

  function markCardDone(cardEl, chosen) {
    cardEl.classList.add('chat-rec-card--done');
    cardEl.querySelectorAll('.chat-rec-btn').forEach((btn) => {
      btn.disabled = true;
      btn.classList.toggle('chat-rec-btn--active', btn.dataset.action === chosen);
    });
  }

  // Добавление фильма из карточки в выбранную категорию пользователя.
  // Использует существующую логику добавления (с дедупом и сохранением).
  async function addCardToList(card, targetStatus, cardEl) {
    const existing = findExistingMovie(card);
    if (existing) {
      // Не создаём дубликаты — показываем понятное сообщение.
      showCardNotice(cardEl, `Уже в списке: «${existing.title}» — ${CARD_STATUS_LABELS[existing.status] || existing.status}`, 'warn');
      markCardDone(cardEl, existing.status);
      return;
    }

    // «Смотрю» добавляется как «Хочу посмотреть», затем переводится в статус.
    const addStatus = targetStatus === 'watching' ? 'want' : targetStatus;
    const data = {
      title: card.title,
      status: addStatus,
      rating: null,
      tmdbId: card.tmdbId || null,
      mediaType: card.mediaType || 'movie',
      genres: card.genres || [],
      meta: {
        poster: card.posterUrl || null,
        year: card.year || null,
        overview: card.overview || '',
        originalTitle: card.originalTitle || null,
        voteAverage: card.rating || null,
        matchSource: card.tmdbId ? 'auto' : undefined
      }
    };

    const result = window.MovieApp.addMovieInternal(data);
    if (result.duplicate) {
      showCardNotice(cardEl, `Похоже, уже есть: «${result.duplicate.movie.title}»`, 'warn');
      markCardDone(cardEl, result.duplicate.movie.status);
      return;
    }
    if (!result.success) {
      showCardNotice(cardEl, result.error || 'Не удалось добавить', 'warn');
      return;
    }

    if (targetStatus === 'watching') {
      window.MovieApp.updateMovie({
        title: result.movie.title,
        mediaType: result.movie.mediaType,
        status: 'watching'
      });
    }

    await window.MovieApp.saveMovies();
    window.MovieApp.renderMovies();
    markCardDone(cardEl, targetStatus);
    showCardNotice(cardEl, `Добавлено в «${CARD_STATUS_LABELS[targetStatus]}»`, 'ok');
  }

  async function blacklistCard(card, cardEl) {
    if (findExistingMovie(card)) {
      showCardNotice(cardEl, 'Этот фильм уже в вашем списке', 'warn');
      return;
    }
    try {
      const res = await fetch('/api/blacklist/title', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...window.authHeaders() },
        body: JSON.stringify({ title: card.title })
      });
      if (res.ok) {
        markCardDone(cardEl, 'blacklist');
        showCardNotice(cardEl, 'Добавлено в чёрный список', 'ok');
      } else {
        showCardNotice(cardEl, 'Не удалось добавить в чёрный список', 'warn');
      }
    } catch (e) {
      showCardNotice(cardEl, getConnectionErrorMessage(), 'warn');
    }
  }

  function buildRecCard(card) {
    const cardEl = document.createElement('article');
    cardEl.className = 'chat-rec-card';

    const posterWrap = document.createElement('div');
    posterWrap.className = 'chat-rec-poster';
    if (card.posterUrl) {
      const img = document.createElement('img');
      img.src = window.MovieDisplay?.posterUrl?.(card.posterUrl) || card.posterUrl;
      img.alt = card.title;
      img.loading = 'lazy';
      img.decoding = 'async';
      posterWrap.appendChild(img);
    } else {
      posterWrap.classList.add('chat-rec-poster--empty');
      posterWrap.textContent = '🎬';
    }
    // Постер ведёт на страницу фильма (если есть tmdbId).
    const pageHref = window.MovieDisplay?.moviePageUrl?.(card);
    if (pageHref) {
      const posterLink = document.createElement('a');
      posterLink.href = pageHref;
      posterLink.className = 'chat-rec-poster-link';
      posterLink.title = 'Открыть страницу фильма';
      posterLink.appendChild(posterWrap);
      cardEl.appendChild(posterLink);
    } else {
      cardEl.appendChild(posterWrap);
    }

    const body = document.createElement('div');
    body.className = 'chat-rec-body';

    const titleRow = document.createElement('div');
    titleRow.className = 'chat-rec-title-row';
    const titleEl = document.createElement('strong');
    titleEl.className = 'chat-rec-title';
    titleEl.textContent = card.title;
    if (pageHref) {
      const titleLink = document.createElement('a');
      titleLink.href = pageHref;
      titleLink.className = 'chat-rec-title-link';
      titleLink.title = 'Открыть страницу фильма';
      titleLink.appendChild(titleEl);
      titleRow.appendChild(titleLink);
    } else {
      titleRow.appendChild(titleEl);
    }
    if (card.year) {
      const yearEl = document.createElement('span');
      yearEl.className = 'chat-rec-year';
      yearEl.textContent = card.year;
      titleRow.appendChild(yearEl);
    }
    body.appendChild(titleRow);

    const metaRow = document.createElement('div');
    metaRow.className = 'chat-rec-meta';
    if (card.mediaType === 'tv') {
      const t = document.createElement('span');
      t.className = 'chat-rec-tag';
      t.textContent = 'сериал';
      metaRow.appendChild(t);
    }
    if (card.rating) {
      const r = document.createElement('span');
      r.className = 'chat-rec-rating';
      r.textContent = `★ ${card.rating}`;
      metaRow.appendChild(r);
    }
    (card.genres || []).slice(0, 3).forEach((g) => {
      const gEl = document.createElement('span');
      gEl.className = 'chat-rec-genre';
      gEl.textContent = g;
      metaRow.appendChild(gEl);
    });
    if (metaRow.childNodes.length) body.appendChild(metaRow);

    if (card.reason) {
      const reasonEl = document.createElement('p');
      reasonEl.className = 'chat-rec-reason';
      reasonEl.textContent = card.reason;
      body.appendChild(reasonEl);
    }

    const actions = document.createElement('div');
    actions.className = 'chat-rec-actions';
    const buttons = [
      { action: 'want', label: 'Хочу посмотреть' },
      { action: 'watching', label: 'Смотрю' },
      { action: 'watched', label: 'Посмотрел' },
      { action: 'blacklist', label: 'В чёрный список' }
    ];
    buttons.forEach(({ action, label }) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `chat-rec-btn chat-rec-btn--${action}`;
      btn.dataset.action = action;
      btn.textContent = label;
      btn.addEventListener('click', () => {
        if (action === 'blacklist') blacklistCard(card, cardEl);
        else addCardToList(card, action, cardEl);
      });
      actions.appendChild(btn);
    });
    body.appendChild(actions);

    const notice = document.createElement('div');
    notice.className = 'chat-rec-notice';
    body.appendChild(notice);

    cardEl.appendChild(body);

    // Если фильм уже в списке — сразу отмечаем карточку.
    const existing = findExistingMovie(card);
    if (existing) {
      markCardDone(cardEl, existing.status);
      showCardNotice(cardEl, `Уже в списке — ${CARD_STATUS_LABELS[existing.status] || existing.status}`, 'warn');
    }

    return cardEl;
  }

  function addRecommendationCards(items) {
    const wrap = document.createElement('div');
    wrap.className = 'chat-message chat-message--bot chat-rec-message';
    const grid = document.createElement('div');
    grid.className = 'chat-rec-grid';
    items.forEach((card) => grid.appendChild(buildRecCard(card)));
    wrap.appendChild(grid);
    chatMessages.appendChild(wrap);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  async function runTasteAnalysis() {
    addMessage('Покажи анализ моего вкуса', 'user');

    const loadingEl = addMessage('', 'bot');
    loadingEl.classList.add('chat-message--loading');
    loadingEl.innerHTML = window.LoadingUI.thinking('Анализирую ваш вкус');
    setChatBusy(true);

    try {
      const response = await fetch('/api/taste-analysis', {
        headers: window.authHeaders()
      });
      const data = await response.json();
      loadingEl.remove();

      if (!response.ok) {
        addMessage(data.error || 'Не удалось загрузить анализ', 'error');
        return;
      }

      const insights = data.insights || [];
      if (!insights.length) {
        addMessage('Пока недостаточно данных для анализа. Отметьте фильмы как «посмотрел» с оценками.', 'bot');
        return;
      }

      const text = `🎯 Анализ вашего вкуса:\n\n${insights.map((item, i) => `${i + 1}. ${item}`).join('\n')}`;
      addMessage(text, 'bot');
      chatHistory.push(
        { role: 'user', content: 'Покажи анализ моего вкуса' },
        { role: 'assistant', content: text }
      );
    } catch (error) {
      loadingEl.remove();
      addMessage(getConnectionErrorMessage(), 'error');
    } finally {
      setChatBusy(false);
      chatInput?.focus();
    }
  }

  chatTasteBtn?.addEventListener('click', runTasteAnalysis);

  chatForm?.addEventListener('submit', async function (event) {
    event.preventDefault();

    const text = chatInput?.value.trim();
    if (!text) return;

    chatInput.value = '';
    setChatBusy(true);

    addMessage(text, 'user');
    chatHistory.push({ role: 'user', content: text });

    const loadingEl = document.createElement('div');
    loadingEl.className = 'chat-message chat-message--bot chat-message--loading';
    loadingEl.innerHTML = window.LoadingUI.thinking('Думаю');
    chatMessages.appendChild(loadingEl);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...window.authHeaders()
        },
        body: JSON.stringify({
          messages: chatHistory
        })
      });

      const data = await response.json();
      loadingEl.remove();

      if (!response.ok) {
        addMessage(data.error || 'Произошла ошибка', 'error');
        chatHistory.pop();
        return;
      }

      // Структурированный ответ с карточками фильмов/сериалов.
      if (data.type === 'recommendations' && Array.isArray(data.items) && data.items.length) {
        if (data.message) {
          addMessage(data.message, 'bot');
          chatHistory.push({ role: 'assistant', content: data.message });
        }
        addRecommendationCards(data.items);
        return;
      }

      if (data.actions && data.actions.length > 0) {
        const results = await window.MovieApp.executeActions(data.actions);
        const skipped = results.flatMap((r) => r.skipped || []);
        const failed = results.filter((r) => !r.success && !(r.skipped?.length));
        const addedTv = data.actions.some((a) => a.mediaType === 'tv');
        if (addedTv) window.MovieApp?.setMediaFilter?.('tv');
        let reply = data.reply;
        if (skipped.length) {
          reply += `\n\n⚠ Не добавлено: ${skipped.map((s) => `«${s.title}»`).join(', ')}`;
        }
        if (failed.length > 0 && data.mode === 'local') {
          const errors = failed.map((r) => r.error).join('; ');
          addMessage(`${reply}\n\n⚠ ${errors}`, 'bot');
          chatHistory.push({ role: 'assistant', content: `${reply}\n\n${errors}` });
          return;
        }
        const saveWarnings = results.filter((r) => r?.saveWarning).map((r) => r.saveWarning);
        if (saveWarnings.length) {
          reply += `\n\n⚠ ${saveWarnings[0]}`;
        }
        addMessage(reply, 'bot');
        chatHistory.push({ role: 'assistant', content: reply });
        return;
      }

      const replyText = data.message || data.reply || 'Готово!';
      addMessage(replyText, 'bot');
      chatHistory.push({ role: 'assistant', content: replyText });
    } catch (error) {
      loadingEl.remove();
      chatHistory.pop();
      console.error('Chat request failed:', error);
      addMessage(getConnectionErrorMessage(), 'error');
    } finally {
      setChatBusy(false);
      chatInput?.focus();
    }
  });
})();
