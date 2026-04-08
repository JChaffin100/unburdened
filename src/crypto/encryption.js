/**
 * AES-256-GCM encryption/decryption via Web Crypto API.
 * Key derivation uses PBKDF2 with SHA-256.
 * The passcode is never stored — only the derived key is held in memory.
 */

const PBKDF2_ITERATIONS = 310000;
const SALT_STORAGE_KEY = 'unburdened_salt';
const VERIFY_PLAINTEXT = 'unburdened_verify_v1';

/** Generate a new random 16-byte salt and persist it to localStorage. */
export function generateAndStoreSalt() {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hex = Array.from(salt).map((b) => b.toString(16).padStart(2, '0')).join('');
  localStorage.setItem(SALT_STORAGE_KEY, hex);
  return salt;
}

/** Read the persisted salt from localStorage. Returns null if not set. */
export function loadSalt() {
  const hex = localStorage.getItem(SALT_STORAGE_KEY);
  if (!hex) return null;
  const bytes = new Uint8Array(hex.match(/.{2}/g).map((b) => parseInt(b, 16)));
  return bytes;
}

/** Derive an AES-256-GCM CryptoKey from passcode + salt. */
export async function deriveKey(passcode, salt) {
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(passcode),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt plaintext string with the given CryptoKey.
 * Returns a Uint8Array: [12-byte IV][ciphertext].
 */
export async function encrypt(key, plaintext) {
  const enc = new TextEncoder();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    enc.encode(plaintext)
  );
  const result = new Uint8Array(12 + ciphertext.byteLength);
  result.set(iv, 0);
  result.set(new Uint8Array(ciphertext), 12);
  return result;
}

/**
 * Decrypt a Uint8Array [12-byte IV][ciphertext] with the given CryptoKey.
 * Returns the original plaintext string.
 * Throws if decryption fails (wrong key).
 */
export async function decrypt(key, data) {
  const iv = data.slice(0, 12);
  const ciphertext = data.slice(12);
  const dec = new TextDecoder();
  const plainbuf = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext
  );
  return dec.decode(plainbuf);
}

/**
 * Encrypt a JS value (any JSON-serializable object/string).
 * Stores as Uint8Array in IndexedDB.
 */
export async function encryptValue(key, value) {
  return encrypt(key, JSON.stringify(value));
}

/**
 * Decrypt and JSON-parse a value from IndexedDB.
 */
export async function decryptValue(key, data) {
  const text = await decrypt(key, data);
  return JSON.parse(text);
}

/**
 * Store a verification blob so we can test if a passcode is correct.
 * Called once during setup.
 */
export async function storeVerificationBlob(key) {
  const blob = await encrypt(key, VERIFY_PLAINTEXT);
  const hex = Array.from(blob).map((b) => b.toString(16).padStart(2, '0')).join('');
  localStorage.setItem('unburdened_verify', hex);
}

/**
 * Attempt to decrypt the verification blob with the given key.
 * Returns true if the key is correct.
 */
export async function verifyKey(key) {
  const hex = localStorage.getItem('unburdened_verify');
  if (!hex) return false;
  try {
    const data = new Uint8Array(hex.match(/.{2}/g).map((b) => parseInt(b, 16)));
    const result = await decrypt(key, data);
    return result === VERIFY_PLAINTEXT;
  } catch {
    return false;
  }
}

/** Read the app version from the active service worker at runtime. */
export function getAppVersion() {
  return new Promise((resolve) => {
    if (!navigator.serviceWorker) return resolve('unknown');
    navigator.serviceWorker.getRegistration().then((reg) => {
      const sw = reg?.active;
      if (!sw) return resolve('unknown');
      const channel = new MessageChannel();
      channel.port1.onmessage = (e) => resolve(e.data.version);
      sw.postMessage({ type: 'GET_VERSION' }, [channel.port2]);
      setTimeout(() => resolve('unknown'), 2000);
    }).catch(() => resolve('unknown'));
  });
}
