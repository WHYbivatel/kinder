(function initVisualTestScenes() {
  const SCENE_LABELS = {
    visual_img_1: 'Свет в темноте — абстрактная сцена с мягким источником света',
    visual_img_2: 'Размытый ночной город — огни и bokeh',
    visual_img_3: 'Окно с тёплым светом — уютная атмосфера',
    visual_img_4: 'Абстрактные тени и пересекающиеся формы',
    visual_img_5: 'Дорога в тумане — перспектива и глубина',
    visual_img_6: 'Красно-синий неоновый контраст',
    visual_img_7: 'Мягкий светлый пейзаж',
    visual_img_8: 'Тёмная комната с лучом света'
  };

  function render(imageId) {
    const label = SCENE_LABELS[imageId] || 'Визуальная сцена';
    const num = (imageId || '').replace('visual_img_', '');
    return `<div class="visual-scene visual-scene--${num}" role="img" aria-label="${label}"><span class="visual-scene-sr">${label}</span></div>`;
  }

  window.VisualTestScenes = { render, getLabel: (id) => SCENE_LABELS[id] || '' };
})();
