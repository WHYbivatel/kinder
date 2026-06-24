export function buildKinogoSearchUrl(title) {
  const q = String(title || '').trim();
  if (!q) return 'https://kinogo.biz/';
  return `https://kinogo.biz/search/?q=${encodeURIComponent(q)}`;
}

export async function resolveKinogoMovie() {
  return null;
}
