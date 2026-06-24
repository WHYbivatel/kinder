/* One-off migration: переносит все данные пользователя FROM → TO (на номер телефона).
   Запуск: node scripts/migrate-user.js "sanzhar@gmail.com" "87471226814"
   - переносит запись в users.json (ключ становится номером телефона);
   - переносит файл списка фильмов data/movies/<user>.json;
   - переносит настройки data/prefs/<user>.json (если есть);
   - делает резервные копии перед изменениями. */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const MOVIES_DIR = path.join(DATA_DIR, 'movies');
const PREFS_DIR = path.join(DATA_DIR, 'prefs');

const FROM = process.argv[2];
const TO = process.argv[3];

if (!FROM || !TO) {
  console.error('Usage: node scripts/migrate-user.js <from> <toPhone>');
  process.exit(1);
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
function backup(file) {
  if (fs.existsSync(file)) {
    const dest = `${file}.premigration-${stamp}.bak`;
    fs.copyFileSync(file, dest);
    console.log(`  backup: ${path.basename(dest)}`);
  }
}

console.log(`Migrating "${FROM}" → "${TO}"`);

// 1) users.json
const users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
if (!users[FROM]) {
  console.error(`ERROR: user "${FROM}" not found in users.json`);
  process.exit(2);
}
if (users[TO]) {
  console.error(`ERROR: target user "${TO}" already exists. Aborting to avoid overwrite.`);
  process.exit(3);
}
backup(USERS_FILE);

const now = new Date().toISOString();
const account = { ...users[FROM] };
account.phone = TO;
account.previousUsername = FROM;
account.migratedAt = now;
users[TO] = account;
delete users[FROM];
fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
console.log('  users.json: account key moved to phone number');

// 2) movies file
function moveJson(dir, label) {
  const src = path.join(dir, `${FROM}.json`);
  const dest = path.join(dir, `${TO}.json`);
  if (!fs.existsSync(src)) {
    console.log(`  ${label}: no file for source — skipped`);
    return;
  }
  if (fs.existsSync(dest)) backup(dest);
  fs.copyFileSync(src, dest);
  // сохраняем исходник как .migrated.bak, затем удаляем активный исходный файл
  fs.copyFileSync(src, `${src}.migrated-${stamp}.bak`);
  fs.rmSync(src);
  console.log(`  ${label}: ${FROM}.json → ${TO}.json`);
}

moveJson(MOVIES_DIR, 'movies');
if (fs.existsSync(PREFS_DIR)) moveJson(PREFS_DIR, 'prefs');

console.log('Done.');
