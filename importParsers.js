import { resolveSearchQuery } from './titleAliases.js';

function parseCsvLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

export function parseLetterboxdCsv(text) {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]).map((h) => h.toLowerCase());
  const nameIdx = headers.findIndex((h) => h === 'name' || h === 'title');
  const yearIdx = headers.findIndex((h) => h === 'year');
  if (nameIdx === -1) return [];

  return lines.slice(1).map((line) => {
    const cols = parseCsvLine(line);
    const title = cols[nameIdx];
    if (!title) return null;
    const year = yearIdx >= 0 ? cols[yearIdx] : null;
    return {
      title: resolveSearchQuery(title),
      status: 'want',
      rating: null,
      genres: [],
      tags: year ? [`${year}`] : [],
      mediaType: 'movie'
    };
  }).filter(Boolean);
}

export function parseImdbList(text) {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  const movies = [];

  for (const line of lines) {
    const constMatch = line.match(/tt\d{7,8}/);
    const titleMatch = line.match(/^[\d.]+\.\s+(.+?)(?:\s+\(\d{4}\))?$/);
    const simple = line.match(/^(.+?)\s*\((\d{4})\)\s*$/);

    if (titleMatch) {
      movies.push({
        title: resolveSearchQuery(titleMatch[1].trim()),
        status: 'want', rating: null, genres: [], tags: [], mediaType: 'movie'
      });
    } else if (simple) {
      movies.push({
        title: resolveSearchQuery(simple[1].trim()),
        status: 'want', rating: null, genres: [], tags: [simple[2]], mediaType: 'movie'
      });
    } else if (!constMatch && line.length > 1 && !line.startsWith('Position')) {
      movies.push({
        title: resolveSearchQuery(line.replace(/^[-•*]\s*/, '').trim()),
        status: 'want', rating: null, genres: [], tags: [], mediaType: 'movie'
      });
    }
  }

  return movies;
}

export function parsePlainList(text, mediaType = 'movie') {
  return text.split(/\n|,|;/).map((t) => t.trim()).filter(Boolean).map((title) => ({
    title: resolveSearchQuery(title),
    status: 'want',
    rating: null,
    genres: [],
    tags: [],
    mediaType
  }));
}

export function detectImportFormat(text, filename = '') {
  const lower = (filename + text.slice(0, 200)).toLowerCase();
  if (lower.includes('letterboxd') || (text.includes('Name,Year') && text.includes('Date'))) {
    return 'letterboxd';
  }
  if (lower.includes('imdb') || /tt\d{7,8}/.test(text)) return 'imdb';
  if (lower.includes('сериал') || lower.includes('series')) return 'series';
  return 'plain';
}

export function parseImportText(text, format, mediaType = 'movie') {
  switch (format) {
    case 'letterboxd': return parseLetterboxdCsv(text);
    case 'imdb': return parseImdbList(text);
    case 'series': return parsePlainList(text, 'tv');
    case 'kinopoisk':
    case 'plain':
    default:
      return parsePlainList(text, mediaType);
  }
}
