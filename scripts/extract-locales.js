import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(path.join(__dirname, '../i18n.js'), 'utf8');

// Extract DICT object via regex on ru/en blocks
function extractLangBlock(lang) {
  const marker = `    ${lang}: {`;
  const start = src.indexOf(marker);
  if (start === -1) throw new Error(`Missing ${lang}`);
  let depth = 0;
  let i = start + marker.length - 1;
  for (; i < src.length; i++) {
    const ch = src[i];
    if (ch === '{') depth++;
    if (ch === '}') {
      depth--;
      if (depth === 0) {
        const block = src.slice(start + marker.length - 1, i + 1);
        // eslint-disable-next-line no-new-func
        return Function(`"use strict"; return (${block});`)();
      }
    }
  }
  throw new Error(`Unclosed block for ${lang}`);
}

const ru = extractLangBlock('ru');
const en = extractLangBlock('en');

function writeLocale(lang, dict) {
  const out = `/* Locale: ${lang} */\n(function () {\n  'use strict';\n  window.__LOCALES = window.__LOCALES || {};\n  window.__LOCALES['${lang}'] = ${JSON.stringify(dict, null, 2)};\n})();\n`;
  fs.writeFileSync(path.join(__dirname, `../locales/${lang}.js`), out);
}

fs.mkdirSync(path.join(__dirname, '../locales'), { recursive: true });
writeLocale('ru', ru);
writeLocale('en', en);
console.log('ru:', Object.keys(ru).length, 'en:', Object.keys(en).length);
