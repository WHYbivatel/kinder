/** Есть ли кириллица в строке */
export function containsCyrillic(text) {
  return /[\u0400-\u04FF]/u.test(String(text || ''));
}

const MULTI_CHAR = [
  ['щ', 'shch'],
  ['ж', 'zh'],
  ['ч', 'ch'],
  ['ш', 'sh'],
  ['ю', 'yu'],
  ['я', 'ya'],
  ['ё', 'yo'],
  ['й', 'y'],
  ['х', 'kh'],
  ['ц', 'ts']
];

const SINGLE_CHAR = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', з: 'z', и: 'i',
  к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's',
  т: 't', у: 'u', ф: 'f', ы: 'y', э: 'e', ъ: '', ь: ''
};

/** Транслитерация русского названия в латиницу для поиска в TMDB (en-US). */
export function transliterateRuToLatin(text) {
  let input = String(text || '').toLowerCase().replace(/ё/g, 'е').trim();
  if (!input) return '';

  let out = '';
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    let matched = false;

    for (const [ru, lat] of MULTI_CHAR) {
      if (input.startsWith(ru, i)) {
        out += lat;
        i += ru.length - 1;
        matched = true;
        break;
      }
    }
    if (matched) continue;

    if (SINGLE_CHAR[ch] !== undefined) {
      out += SINGLE_CHAR[ch];
      continue;
    }

    if (/[a-z0-9\s:.-]/i.test(ch)) {
      out += ch;
    }
  }

  return out.replace(/\s+/g, ' ').trim();
}
