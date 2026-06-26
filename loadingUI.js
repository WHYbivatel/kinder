(function () {
  function esc(text) {
    if (window.MovieDisplay?.escapeHtml) return window.MovieDisplay.escapeHtml(text);
    return String(text ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function spinner(size) {
    const sizeCls = size === 'sm' ? ' loading-ui__spinner-wrap--sm' : size === 'lg' ? ' loading-ui__spinner-wrap--lg' : '';
    return `<span class="loading-ui__spinner-wrap${sizeCls}" aria-hidden="true"><span class="loading-ui__spinner"></span></span>`;
  }

  function dots() {
    return `<span class="loading-ui__dots" aria-hidden="true"><span class="loading-ui__dot"></span><span class="loading-ui__dot"></span><span class="loading-ui__dot"></span></span>`;
  }

  function progressBar() {
    return '<div class="loading-ui__progress" aria-hidden="true"><div class="loading-ui__progress-fill"></div></div>';
  }

  function textPart(text) {
    if (!text) return '';
    return `<span class="loading-ui__text">${esc(text)}<span class="loading-ui__ellipsis" aria-hidden="true"></span></span>`;
  }

  function html(text, opts) {
    opts = opts || {};
    const variant = opts.variant || 'spinner';
    const tag = Object.prototype.hasOwnProperty.call(opts, 'tag') ? opts.tag : 'div';
    const useAi = !!opts.ai;
    const useInline = opts.inline !== undefined ? opts.inline : (useAi || tag === 'li' || tag === 'p');
    const classes = [
      'loading-ui',
      opts.compact ? 'loading-ui--compact' : '',
      useInline && !useAi ? 'loading-ui--inline' : '',
      opts.panel ? 'loading-ui--panel' : '',
      useAi ? 'loading-ui--ai' : '',
      opts.className || ''
    ].filter(Boolean).join(' ');

    const indicator = variant === 'dots' ? dots() : spinner(opts.size);
    let inner;

    if (useAi) {
      inner = `<div class="${classes}" role="status" aria-live="polite">
        <div class="loading-ui__row">${indicator}${textPart(text)}</div>
        ${progressBar()}
      </div>`;
    } else {
      inner = `<div class="${classes}" role="status" aria-live="polite">${indicator}${textPart(text)}</div>`;
    }

    if (!tag) return inner;
    const wrapClass = opts.wrapClass !== undefined ? opts.wrapClass : (tag === 'li' || tag === 'p' ? 'rec-loading' : '');
    const wrapAi = useAi && tag === 'li' ? ' rec-loading--ai' : '';
    const allWrap = [wrapClass, wrapAi].filter(Boolean).join(' ');
    return allWrap ? `<${tag} class="${allWrap}">${inner}</${tag}>` : `<${tag}>${inner}</${tag}>`;
  }

  function ai(text, opts) {
    opts = opts || {};
    const fallback = (window.t ? window.t('collections.picking') : 'Подбираю...');
    return html(text || fallback, Object.assign({ ai: true, inline: true }, opts));
  }

  function thinking(text) {
    const fallback = window.t ? window.t('common.loading') : 'Загрузка…';
    return html(text || fallback, {
      variant: 'dots',
      className: 'loading-ui--thinking',
      ai: true,
      tag: false
    });
  }

  function skeletonCard(index) {
    const delay = (index || 0) * 0.08;
    return `<div class="loading-ui-skeleton-card" style="animation-delay:${delay}s">
      <div class="loading-ui-skeleton-poster"></div>
      <div class="loading-ui-skeleton-body">
        <div class="loading-ui-skeleton-line loading-ui-skeleton-line--title"></div>
        <div class="loading-ui-skeleton-line"></div>
        <div class="loading-ui-skeleton-line loading-ui-skeleton-line--short"></div>
      </div>
    </div>`;
  }

  function skeletonCards(count) {
    const n = count || 4;
    const cards = Array.from({ length: n }, function (_, i) { return skeletonCard(i); }).join('');
    return `<div class="loading-ui-skeleton-list" role="status" aria-live="polite">${cards}</div>`;
  }

  function aiRecommendations(text, count, opts) {
    opts = opts || {};
    count = count || 4;
    const tag = Object.prototype.hasOwnProperty.call(opts, 'tag') ? opts.tag : false;
    const block = `<div class="loading-ui-ai-block">${ai(text || (window.t ? window.t('collections.picking') : 'Подбираю...'), { tag: false, compact: true })}${skeletonCards(count)}</div>`;

    if (!tag) return block;

    const wrapClass = opts.wrapClass !== undefined ? opts.wrapClass : 'rec-loading rec-loading--ai';
    return `<${tag} class="${wrapClass}">${block}</${tag}>`;
  }

  function skeletonLines(count) {
    const n = count || 4;
    const lines = Array.from({ length: n }, function (_, i) {
      return `<div class="loading-ui-skeleton-line" style="animation-delay:${i * 0.1}s"></div>`;
    }).join('');
    return `<div class="loading-ui-skeleton-block" role="status" aria-live="polite">${lines}</div>`;
  }

  function statGrid() {
    const cards = Array.from({ length: 4 }, function (_, i) {
      return `<div class="loading-ui-stat-card" style="animation-delay:${i * 0.07}s"><div class="loading-ui-stat-num"></div><div class="loading-ui-stat-label"></div></div>`;
    }).join('');
    return `<div class="loading-ui-stat-grid" role="status" aria-live="polite">${cards}</div>`;
  }

  window.LoadingUI = {
    html: html,
    ai: ai,
    aiRecommendations: aiRecommendations,
    thinking: thinking,
    skeletonCards: skeletonCards,
    skeletonLines: skeletonLines,
    statGrid: statGrid,
    spinner: spinner,
    dots: dots
  };
})();
