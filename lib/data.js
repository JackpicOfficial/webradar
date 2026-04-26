// Central data access layer — all reads/writes go through here.
// Files in data/ are encrypted with AES-256-GCM using ENCRYPTION_KEY env var.
// Falls back to plain JSON if ENCRYPTION_KEY is not set (dev mode).

'use strict';

const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');

const DATA_DIR      = path.join(__dirname, '..', 'data');
const USERS_FILE    = path.join(DATA_DIR, 'users.json');
const ROLES_FILE    = path.join(DATA_DIR, 'roles.json');
const MAPPINGS_FILE = path.join(DATA_DIR, 'cf-mappings.json');

const ENC_PREFIX = 'enc:';
const ALGO       = 'aes-256-gcm';

function getKey() {
  const secret = process.env.ENCRYPTION_KEY || process.env.SESSION_SECRET;
  if (!secret) return null;
  return crypto.createHash('sha256').update(secret).digest(); // 32 bytes
}

function encryptData(plaintext) {
  const key = getKey();
  if (!key) return plaintext; // no key = store plain (dev mode)
  const iv         = crypto.randomBytes(12);
  const cipher     = crypto.createCipheriv(ALGO, key, iv);
  const encrypted  = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag    = cipher.getAuthTag();
  return ENC_PREFIX + [
    iv.toString('base64'),
    authTag.toString('base64'),
    encrypted.toString('base64'),
  ].join(':');
}

function decryptData(stored) {
  if (!stored.startsWith(ENC_PREFIX)) return stored; // plain text fallback
  const key = getKey();
  if (!key) return stored;
  const [, ivB64, tagB64, dataB64] = stored.split(':');
  const iv        = Buffer.from(ivB64,  'base64');
  const authTag   = Buffer.from(tagB64, 'base64');
  const encrypted = Buffer.from(dataB64,'base64');
  const decipher  = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(authTag);
  return decipher.update(encrypted) + decipher.final('utf8');
}

function readFile(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(decryptData(raw));
  } catch { return null; }
}

function writeFile(filePath, data) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(filePath, encryptData(JSON.stringify(data, null, 2)));
}

// ── Public helpers ────────────────────────────────────────────────────────────

function readUsers()      { return readFile(USERS_FILE)    || []; }
function readRoles()      { return readFile(ROLES_FILE)    || []; }
function readMappings()   { return readFile(MAPPINGS_FILE) || []; }
function saveUsers(u)     { writeFile(USERS_FILE,    u); }
function saveRoles(r)     { writeFile(ROLES_FILE,    r); }
function saveMappings(m)  { writeFile(MAPPINGS_FILE, m); }

module.exports = { readUsers, readRoles, readMappings, saveUsers, saveRoles, saveMappings };
