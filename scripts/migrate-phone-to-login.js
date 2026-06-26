/* Перенос аккаунта с телефонного ключа на логин + установка пароля.
   Запуск: node scripts/migrate-phone-to-login.js <fromKey> <login> <password> */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const MOVIES_DIR = path.join(DATA_DIR, 'movies');
const PREFS_DIR = path.join(DATA_DIR, 'prefs');

const FROM = process.argv[2];
const LOGIN = String(process.argv[3] || '').trim();
const PASSWORD = process.argv[4];

function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

function findCanonicalUsername(users, username) {
  const requested = String(username || '').trim();
  if (!requested) return null;
  if (users[requested]) return requested;
  const lower = requested.toLowerCase();
  return Object.keys(users).find((name) => name.toLowerCase() === lower) || null;
}

if (!FROM || !LOGIN || !PASSWORD) {
  console.error('Usage: node scripts/migrate-phone-to-login.js <fromKey> <login> <password>');
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

console.log(`Migrating "${FROM}" → login "${LOGIN}"`);

const users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
if (!users[FROM]) {
  console.error(`ERROR: user "${FROM}" not found in users.json`);
  process.exit(2);
}
if (findCanonicalUsername(users, LOGIN)) {
  console.error(`ERROR: login "${LOGIN}" already exists.`);
  process.exit(3);
}

backup(USERS_FILE);

const now = new Date().toISOString();
const salt = crypto.randomBytes(16).toString('hex');
const account = { ...users[FROM] };
account.previousUsername = FROM;
account.migratedAt = now;
account.lastActiveAt = now;
account.salt = salt;
account.hash = hashPassword(PASSWORD, salt);
if (account.phone == null && /^\d{7,}$/.test(FROM)) account.phone = FROM;
users[LOGIN] = account;
delete users[FROM];
fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
console.log('  users.json: account moved to login with password');

function moveJson(dir, label) {
  const src = path.join(dir, `${FROM}.json`);
  const dest = path.join(dir, `${LOGIN}.json`);
  if (!fs.existsSync(src)) {
    console.log(`  ${label}: no file for source — skipped`);
    return;
  }
  if (fs.existsSync(dest)) backup(dest);
  fs.copyFileSync(src, dest);
  fs.copyFileSync(src, `${src}.migrated-${stamp}.bak`);
  fs.rmSync(src);
  console.log(`  ${label}: ${FROM}.json → ${LOGIN}.json`);
}

moveJson(MOVIES_DIR, 'movies');
if (fs.existsSync(PREFS_DIR)) moveJson(PREFS_DIR, 'prefs');

console.log('Done.');
