import { openDB } from 'idb';
import { encryptValue, decryptValue } from '../crypto/encryption.js';

const DB_NAME = 'unburdened';
const DB_VERSION = 1;

let _db = null;

async function getDB() {
  if (_db) return _db;
  _db = await openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // areas: { id, encryptedData, createdAt, lastCheckinAt, order }
      if (!db.objectStoreNames.contains('areas')) {
        const areas = db.createObjectStore('areas', { keyPath: 'id' });
        areas.createIndex('lastCheckinAt', 'lastCheckinAt');
      }
      // sessions: { id, areaId, encryptedData, createdAt }
      if (!db.objectStoreNames.contains('sessions')) {
        const sessions = db.createObjectStore('sessions', { keyPath: 'id' });
        sessions.createIndex('areaId', 'areaId');
        sessions.createIndex('createdAt', 'createdAt');
      }
      // summaries: { areaId, encryptedData, updatedAt }
      if (!db.objectStoreNames.contains('summaries')) {
        db.createObjectStore('summaries', { keyPath: 'areaId' });
      }
      // profile: { id: 'user', encryptedData }
      if (!db.objectStoreNames.contains('profile')) {
        db.createObjectStore('profile', { keyPath: 'id' });
      }
    },
  });
  return _db;
}

/** Encrypt a value and store it. storeName must be one of the object stores. */
export async function encryptAndStore(storeName, key, id, value, extraFields = {}) {
  const db = await getDB();
  const encryptedData = await encryptValue(key, value);
  const record = { id, encryptedData, ...extraFields };
  await db.put(storeName, record);
  return record;
}

/** Fetch a record and decrypt its encryptedData field. */
export async function fetchAndDecrypt(storeName, key, id) {
  const db = await getDB();
  const record = await db.get(storeName, id);
  if (!record) return null;
  const value = await decryptValue(key, record.encryptedData);
  return { ...record, data: value };
}

/** Fetch all records from a store and decrypt them all. */
export async function fetchAllAndDecrypt(storeName, key) {
  const db = await getDB();
  const records = await db.getAll(storeName);
  const results = [];
  for (const record of records) {
    try {
      const value = await decryptValue(key, record.encryptedData);
      results.push({ ...record, data: value });
    } catch {
      // Skip corrupted records silently
    }
  }
  return results;
}

/** Fetch all records for a given areaId (for sessions). */
export async function fetchSessionsByArea(key, areaId) {
  const db = await getDB();
  const records = await db.getAllFromIndex('sessions', 'areaId', areaId);
  const results = [];
  for (const record of records) {
    try {
      const value = await decryptValue(key, record.encryptedData);
      results.push({ ...record, data: value });
    } catch {
      // Skip corrupted records
    }
  }
  return results.sort((a, b) => b.createdAt - a.createdAt);
}

/** Delete a record by id. */
export async function deleteRecord(storeName, id) {
  const db = await getDB();
  await db.delete(storeName, id);
}

/** Delete all sessions for a given area. */
export async function deleteSessionsByArea(areaId) {
  const db = await getDB();
  const records = await db.getAllFromIndex('sessions', 'areaId', areaId);
  for (const record of records) {
    await db.delete('sessions', record.id);
  }
}

/** Clear all data from all stores (nuclear reset). */
export async function clearAllData() {
  const db = await getDB();
  const tx = db.transaction(['areas', 'sessions', 'summaries', 'profile'], 'readwrite');
  await Promise.all([
    tx.objectStore('areas').clear(),
    tx.objectStore('sessions').clear(),
    tx.objectStore('summaries').clear(),
    tx.objectStore('profile').clear(),
  ]);
  await tx.done;
}

/** Export all raw encrypted records for backup. */
export async function exportAllRaw() {
  const db = await getDB();
  const [areas, sessions, summaries, profile] = await Promise.all([
    db.getAll('areas'),
    db.getAll('sessions'),
    db.getAll('summaries'),
    db.getAll('profile'),
  ]);

  // Convert Uint8Arrays to base64 for JSON serialization
  const toBase64 = (record) => {
    const out = { ...record };
    if (out.encryptedData instanceof Uint8Array) {
      out.encryptedData = btoa(String.fromCharCode(...out.encryptedData));
    }
    return out;
  };

  return {
    areas: areas.map(toBase64),
    sessions: sessions.map(toBase64),
    summaries: summaries.map(toBase64),
    profile: profile.map(toBase64),
  };
}

/** Import raw encrypted records from backup (after re-encryption). */
export async function importAllRaw(data) {
  const db = await getDB();
  const fromBase64 = (record) => {
    const out = { ...record };
    if (typeof out.encryptedData === 'string') {
      const bin = atob(out.encryptedData);
      out.encryptedData = new Uint8Array(bin.length).map((_, i) => bin.charCodeAt(i));
    }
    return out;
  };

  const tx = db.transaction(['areas', 'sessions', 'summaries', 'profile'], 'readwrite');
  await Promise.all([
    tx.objectStore('areas').clear(),
    tx.objectStore('sessions').clear(),
    tx.objectStore('summaries').clear(),
    tx.objectStore('profile').clear(),
  ]);

  for (const record of (data.areas || [])) await tx.objectStore('areas').put(fromBase64(record));
  for (const record of (data.sessions || [])) await tx.objectStore('sessions').put(fromBase64(record));
  for (const record of (data.summaries || [])) await tx.objectStore('summaries').put(fromBase64(record));
  for (const record of (data.profile || [])) await tx.objectStore('profile').put(fromBase64(record));

  await tx.done;
}
