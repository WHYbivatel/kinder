(function () {
  function parseCsvLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') inQuotes = !inQuotes;
      else if (ch === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else current += ch;
    }
    result.push(current.trim());
    return result;
  }

  function parseLetterboxd(text) {
    const lines = text.trim().split(/\r?\n/).filter(Boolean);
    if (lines.length < 2) return [];
    const headers = parseCsvLine(lines[0]).map((h) => h.toLowerCase());
    const nameIdx = headers.findIndex((h) => h === 'name' || h === 'title');
    if (nameIdx === -1) return [];
    return lines.slice(1).map((line) => {
      const cols = parseCsvLine(line);
      const title = cols[nameIdx];
      if (!title) return null;
      return { title: title.trim(), status: 'want', rating: null, genres: [], tags: [], mediaType: 'movie' };
    }).filter(Boolean);
  }

  function parsePlain(text, mediaType) {
    return text.split(/\n|,|;/).map((t) => t.trim()).filter(Boolean).map((title) => ({
      title,
      status: 'want',
      rating: null,
      genres: [],
      tags: [],
      mediaType: mediaType || 'movie'
    }));
  }

  function parseImdb(text) {
    const movies = [];
    text.trim().split(/\r?\n/).forEach((line) => {
      const m = line.match(/^[\d.]+\.\s+(.+?)(?:\s+\(\d{4}\))?$/);
      if (m) movies.push({ title: m[1].trim(), status: 'want', rating: null, genres: [], tags: [], mediaType: 'movie' });
      else if (line.trim() && !line.startsWith('Position') && !/tt\d{7,8}/.test(line)) {
        movies.push({
          title: line.replace(/^[-•*]\s*/, '').trim(),
          status: 'want', rating: null, genres: [], tags: [], mediaType: 'movie'
        });
      }
    });
    return movies.filter((m) => m.title.length > 1);
  }

  function parse(text, format, mediaType) {
    if (format === 'letterboxd') return parseLetterboxd(text);
    if (format === 'imdb') return parseImdb(text);
    if (format === 'series') return parsePlain(text, 'tv');
    return parsePlain(text, mediaType || 'movie');
  }

  window.ImportParsers = { parse };
})();
