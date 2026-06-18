/**
 * Пул для «рандомного» добавления.
 * Используются оригинальные (англ.) названия для надёжного поиска в TMDB.
 * Отображаемое русское название подставится из TMDB после добавления.
 */
export const RANDOM_MOVIE_TITLES = [
  'The Matrix',
  'Interstellar',
  'Inception',
  'The Dark Knight',
  'Pulp Fiction',
  'Fight Club',
  'The Green Mile',
  'The Shawshank Redemption',
  'Forrest Gump',
  'Schindler\'s List',
  'Leon: The Professional',
  'Se7en',
  'Gladiator',
  'Avatar',
  'Titanic',
  'The Lord of the Rings: The Return of the King',
  'The Lord of the Rings: The Two Towers',
  'The Lord of the Rings: The Fellowship of the Ring',
  'Terminator 2: Judgment Day',
  'Alien',
  'Back to the Future',
  'Django Unchained',
  'Once Upon a Time in America',
  'The Good, the Bad and the Ugly',
  'The Pianist',
  'Whiplash',
  'Drive',
  'Inglourious Basterds',
  'Kill Bill: Vol. 1',
  'Joker',
  'Parasite',
  'Oldboy',
  'The Big Lebowski',
  'Stalker',
  'Brother',
  'Brother 2',
  'Legend No. 17',
  'The Irony of Fate',
  'The Diamond Arm',
  'Operation Y and Shurik\'s Other Adventures',
  'Kidnapping, Caucasian Style',
  'Office Romance',
  'Moscow Does Not Believe in Tears',
  'Leviathan',
  'Elysium',
  'Edge of Tomorrow',
  'Dunkirk',
  '1917',
  'Dune',
  'Oppenheimer',
  'Barbie',
  'Avengers: Endgame',
  'Iron Man',
  'Guardians of the Galaxy',
  'Doctor Strange',
  'Black Panther',
  'Logan',
  'Deadpool',
  'Venom',
  'The Descent',
  'It',
  'Saw',
  'The Conjuring',
  'Get Out',
  'Insidious',
  'The Shining',
  'Psycho',
  'Jaws',
  'Rocky',
  'The Godfather',
  'Apocalypse Now',
  'Taxi Driver',
  'Jurassic Park',
  'Indiana Jones and the Last Crusade',
  'The Fifth Element',
  'The Matrix Revolutions',
  'Transcendence',
  'Gravity',
  'The Martian',
  'Arrival',
  'Ready Player One',
  'Dune: Part Two',
  'Blade Runner 2049',
  'The Social Network',
  'Green Book',
  'The Gentlemen',
  'The Balkan Line',
  'War',
  'The 9th Company',
  'Stalingrad',
  'Fortress of War',
  'Air Crew',
  'Going Vertical'
];

export const RANDOM_SERIES_TITLES = [
  'Breaking Bad',
  'Game of Thrones',
  'Friends',
  'Sherlock',
  'Chernobyl',
  'Narcos',
  'Lost',
  'Dexter',
  'The Sopranos',
  'Twin Peaks',
  'Sex and the City',
  'Mr. Robot',
  'Fargo',
  'True Detective',
  'Mad Men',
  'Stranger Things',
  'The Mandalorian',
  'Loki',
  'The Crown',
  'Bridgerton',
  'Euphoria',
  'The Walking Dead',
  'Vikings',
  'The Last Kingdom',
  'Dark',
  'The Boys',
  'Wednesday',
  'Arcane',
  'Billions',
  'How I Met Your Mother',
  'The Big Bang Theory',
  'Scrubs',
  'House',
  'Supernatural',
  'Silicon Valley',
  'The Office',
  'White Collar',
  'The Strain',
  '1899',
  'Snowpiercer',
  'Riverdale',
  'Gotham',
  'Arrow',
  'The Flash',
  'The Witcher',
  'House of Cards',
  'Big Little Lies',
  'Fear the Walking Dead',
  'WandaVision'
];

function normalizeTitle(text) {
  return String(text || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = 1; i < a.length; i += 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function pickRandomTitles(existingMovies, count, mediaType = 'movie') {
  const pool = mediaType === 'tv' ? RANDOM_SERIES_TITLES : RANDOM_MOVIE_TITLES;
  const existing = new Set(
    (existingMovies || [])
      .filter((m) => (m.mediaType || 'movie') === mediaType)
      .flatMap((m) => {
        const titles = [normalizeTitle(m.title)];
        if (m.meta?.originalTitle) titles.push(normalizeTitle(m.meta.originalTitle));
        if (m.meta?.matchedTitle) titles.push(normalizeTitle(m.meta.matchedTitle));
        return titles;
      })
  );

  const available = pool.filter((title) => !existing.has(normalizeTitle(title)));
  const source = available.length >= count ? available : [...new Set([...available, ...pool])];
  return shuffle(source).slice(0, Math.min(count, source.length));
}

export function randomRating() {
  return Math.floor(Math.random() * 10) + 1;
}
