import { normalizeAppLang } from './serverLocales.js';
import { TEST_EN, TEST_KK } from './testTranslations.data.js';
import { PSYCH_QUESTIONS, PSYCH_PROFILES } from './psychTestLogic.js';
import { VISUAL_QUESTIONS, VISUAL_PROFILES } from './visualTestLogic.js';
import { SHORT_VISUAL_TESTS, getTestQuestions } from './shortVisualTestLogic.js';

function dictFor(lang) {
  const app = normalizeAppLang(lang);
  if (app === 'en') return TEST_EN;
  if (app === 'kk') return TEST_KK;
  return null;
}

export function testT(lang, key, fallback, vars = {}) {
  const table = dictFor(lang);
  let str = table?.[key] ?? fallback;
  Object.entries(vars).forEach(([k, v]) => {
    str = String(str).replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
  });
  return str;
}

export function localizePsychQuestions(lang) {
  const table = dictFor(lang);
  return PSYCH_QUESTIONS.map((q) => ({
    id: q.id,
    text: table?.[`psych.${q.id}.text`] || q.text,
    options: q.options.map((o) => ({
      id: o.id,
      text: table?.[`psych.${q.id}.${o.id}`] || o.text
    }))
  }));
}

export function localizePsychProfile(profileId, lang) {
  const base = PSYCH_PROFILES[profileId];
  if (!base) return null;
  const table = dictFor(lang);
  const p = `psych.profile.${profileId}.`;
  return {
    ...base,
    title: table?.[p + 'title'] || base.title,
    description: table?.[p + 'description'] || base.description,
    shortDescription: table?.[p + 'shortDescription'] || base.shortDescription
  };
}

export function localizeVisualQuestions(lang) {
  const table = dictFor(lang);
  return VISUAL_QUESTIONS.map((q) => ({
    id: q.id,
    imageId: q.imageId,
    text: table?.[`visual.${q.id}.text`] || q.text,
    options: q.options.map((o) => ({
      id: o.id,
      text: table?.[`visual.${q.id}.${o.id}`] || o.text
    }))
  }));
}

export function localizeVisualProfile(profileId, lang) {
  const base = VISUAL_PROFILES[profileId];
  if (!base) return null;
  const table = dictFor(lang);
  const p = `visual.profile.${profileId}.`;
  return {
    ...base,
    title: table?.[p + 'title'] || base.title,
    description: table?.[p + 'description'] || base.description,
    shortDescription: table?.[p + 'shortDescription'] || base.shortDescription
  };
}

export function localizeShortVisualTests(lang) {
  const table = dictFor(lang);
  return SHORT_VISUAL_TESTS.map((test) => {
    const questions = getTestQuestions(test.id).map((text, i) =>
      table?.[`short.${test.id}.q${i}`] || text
    );
    return {
      ...test,
      title: table?.[`short.${test.id}.title`] || test.title,
      description: table?.[`short.${test.id}.description`] || test.description,
      cardHint: table?.[`short.${test.id}.cardHint`] || test.cardHint,
      questions
    };
  });
}
