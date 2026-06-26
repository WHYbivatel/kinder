(function () {
  'use strict';

  function T(key, fallback, vars) {
    if (!window.t) return fallback;
    const val = window.t(key, vars);
    return val === key ? fallback : val;
  }

  function localizePsychQuestions(questions) {
    return (questions || []).map(function (q) {
      return {
        id: q.id,
        text: T('psych.' + q.id + '.text', q.text),
        options: (q.options || []).map(function (o) {
          return {
            id: o.id,
            text: T('psych.' + q.id + '.' + o.id, o.text),
            profile: o.profile,
            scale: o.scale
          };
        })
      };
    });
  }

  function localizePsychProfile(profile, profileId) {
    if (!profile) return profile;
    const p = 'psych.profile.' + profileId + '.';
    return Object.assign({}, profile, {
      title: T(p + 'title', profile.title),
      description: T(p + 'description', profile.description),
      shortDescription: T(p + 'shortDescription', profile.shortDescription),
      suits: (profile.suits || []).map(function (s, i) { return T(p + 'suits.' + i, s); }),
      avoid: (profile.avoid || []).map(function (s, i) { return T(p + 'avoid.' + i, s); })
    });
  }

  function localizeVisualScene(scene, sceneId) {
    if (!scene) return scene;
    const p = 'visual.scene.' + sceneId + '.';
    return Object.assign({}, scene, {
      title: T(p + 'title', scene.title),
      options: (scene.options || []).map(function (o, i) {
        return Object.assign({}, o, { text: T(p + 'opt.' + i, o.text) });
      })
    });
  }

  window.TestI18n = {
    localizePsychQuestions: localizePsychQuestions,
    localizePsychProfile: localizePsychProfile,
    localizeVisualScene: localizeVisualScene
  };
})();
