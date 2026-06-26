/* ===================================================================
   watchedRatingModal.js — единое окно оценки при добавлении в «Посмотрел».
   =================================================================== */
(function () {
  'use strict';

  function tt(key, fallback, vars) {
    return (window.t ? window.t(key, vars) : null) || fallback;
  }

  function esc(text) {
    if (window.MovieDisplay?.escapeHtml) return window.MovieDisplay.escapeHtml(text);
    return String(text == null ? '' : text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function buildBody(displayTitle, confirmLabel) {
    return `
      <div class="discover-rating-modal">
        <p class="discover-rating-modal__lead">${esc(tt('discover.rateLead', 'Как вам «{title}»?', { title: displayTitle }))}</p>
        <div class="discover-rating-modal__grid" role="radiogroup" aria-label="${esc(tt('discover.rateHint', 'Выберите оценку от 1 до 10'))}">
          ${Array.from({ length: 10 }, (_, i) => {
            const n = i + 1;
            return `<button type="button" class="discover-rating-opt" data-rating="${n}" aria-label="${esc(tt('discover.rateValue', '{n} из 10', { n }))}">${n}</button>`;
          }).join('')}
        </div>
        <p class="discover-rating-modal__value" aria-live="polite"></p>
        <p class="discover-rating-modal__hint">${esc(tt('discover.rateHint', 'Выберите оценку от 1 до 10'))}</p>
        <div class="discover-rating-modal__actions">
          <button type="button" class="btn btn-secondary watched-rating-cancel">${esc(tt('common.cancel', 'Отмена'))}</button>
          <button type="button" class="btn btn-primary watched-rating-confirm" disabled>${esc(confirmLabel)}</button>
        </div>
      </div>`;
  }

  function bindRatingModal(modalBody, { initialRating, onConfirm, onCancel }) {
    let selected = Number.isFinite(initialRating) && initialRating >= 1 && initialRating <= 10
      ? initialRating
      : null;

    const confirmBtn = modalBody.querySelector('.watched-rating-confirm');
    const valueEl = modalBody.querySelector('.discover-rating-modal__value');

    const pickRating = (rating) => {
      selected = rating;
      modalBody.querySelectorAll('.discover-rating-opt').forEach((btn) => {
        btn.classList.toggle('is-active', Number(btn.dataset.rating) === rating);
      });
      if (confirmBtn) confirmBtn.disabled = false;
      if (valueEl) {
        valueEl.textContent = tt('discover.rateSelected', 'Ваша оценка: {rating}/10', { rating });
      }
    };

    if (selected) pickRating(selected);

    modalBody.querySelectorAll('.discover-rating-opt').forEach((btn) => {
      btn.addEventListener('click', () => pickRating(Number(btn.dataset.rating)));
    });

    modalBody.querySelector('.watched-rating-cancel')?.addEventListener('click', (e) => {
      e.preventDefault();
      onCancel();
    });

    confirmBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      if (!selected || selected < 1 || selected > 10) return;
      onConfirm(selected);
    });
  }

  function getModalParts(overlay) {
    return {
      titleEl: overlay.querySelector('#modal-title') || overlay.querySelector('#watched-rating-title'),
      bodyEl: overlay.querySelector('#modal-body') || overlay.querySelector('#watched-rating-body'),
      closeBtn: overlay.querySelector('#modal-close') || overlay.querySelector('.watched-rating-close')
    };
  }

  function ensureOverlay() {
    let overlay = document.getElementById('modal-overlay') || document.getElementById('watched-rating-overlay');
    if (overlay) return overlay;

    overlay = document.createElement('div');
    overlay.id = 'watched-rating-overlay';
    overlay.className = 'modal-overlay hidden';
    overlay.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true">
        <div class="modal-header">
          <h3 id="watched-rating-title"></h3>
          <button type="button" class="watched-rating-close" aria-label="${esc(tt('common.close', 'Закрыть'))}">✕</button>
        </div>
        <div id="watched-rating-body" class="modal-body"></div>
      </div>`;
    document.body.appendChild(overlay);
    return overlay;
  }

  function openStandaloneModal(modalTitle, bodyHtml, initialRating, finish) {
    const overlay = ensureOverlay();
    const { titleEl, bodyEl, closeBtn } = getModalParts(overlay);
    if (titleEl) titleEl.textContent = modalTitle;
    if (bodyEl) bodyEl.innerHTML = bodyHtml;
    overlay.classList.remove('hidden');

    const onOverlayClick = (e) => {
      if (e.target === overlay) finish(null);
    };
    overlay.addEventListener('click', onOverlayClick, { once: true });
    closeBtn?.addEventListener('click', () => finish(null), { once: true });

    if (bodyEl) {
      bindRatingModal(bodyEl, {
        initialRating,
        onConfirm: (rating) => finish(rating),
        onCancel: () => finish(null)
      });
    } else {
      finish(null);
    }
  }

  function promptWatchedRating({ title, confirmLabel, initialRating } = {}) {
    const displayTitle = String(title || '').trim();
    if (!displayTitle) return Promise.resolve(null);

    const modalTitle = tt('discover.rateTitle', 'Оцените фильм');
    const confirm = confirmLabel || tt('discover.rateConfirm', 'Добавить в «Посмотрел»');
    const bodyHtml = buildBody(displayTitle, confirm);

    if (!window.openModal && !document.getElementById('modal-overlay')) {
      const raw = window.prompt(
        tt('discover.ratePrompt', 'Оценка от 1 до 10 для «{title}»:', { title: displayTitle }),
        initialRating != null ? String(initialRating) : '8'
      );
      const rating = Number(raw);
      return Promise.resolve(Number.isFinite(rating) && rating >= 1 && rating <= 10 ? rating : null);
    }

    return new Promise((resolve) => {
      let settled = false;
      const finish = (rating) => {
        if (settled) return;
        settled = true;
        if (window.closeModal) window.closeModal();
        else document.getElementById('modal-overlay')?.classList.add('hidden');
        resolve(rating);
      };

      const useSharedModal = Boolean(window.openModal && document.getElementById('modal-body'));

      if (useSharedModal) {
        window.openModal(modalTitle, bodyHtml);
        const modalBody = document.getElementById('modal-body');
        if (!modalBody) {
          finish(null);
          return;
        }
        bindRatingModal(modalBody, {
          initialRating,
          onConfirm: (rating) => finish(rating),
          onCancel: () => finish(null)
        });
        return;
      }

      openStandaloneModal(modalTitle, bodyHtml, initialRating, finish);
    });
  }

  window.promptWatchedRating = promptWatchedRating;
})();
