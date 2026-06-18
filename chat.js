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

      addMessage(data.reply, 'bot');
      chatHistory.push({ role: 'assistant', content: data.reply });
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
