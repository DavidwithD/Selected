// IndexedDB access for saved selections.
// The service worker writes. The manager page reads and deletes.

const DB_NAME = 'selected';
const DB_VERSION = 1;
const STORE = 'selections';

// A query scans the ts index. This caps the work on a very large store.
const SCAN_LIMIT = 100000;

// A new selection that extends the previous one replaces it.
export const SUPERSEDE_WINDOW_MS = 4000;

let dbPromise = null;

export function openDb() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          const store = db.createObjectStore(STORE, {
            keyPath: 'id',
            autoIncrement: true,
          });
          store.createIndex('ts', 'ts');
          store.createIndex('host', 'host');
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

function done(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

function request(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function hostOf(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

/**
 * Store one selection.
 * If the newest record is from the same page, was saved seconds ago, and its
 * text is contained in the new text, that record is updated instead. This keeps
 * one row when the user drags a selection wider in several steps.
 * Returns { id, superseded }.
 */
export async function addSelection({ text, url, title, ts = Date.now() }) {
  const db = await openDb();
  const tx = db.transaction(STORE, 'readwrite');
  const store = tx.objectStore(STORE);
  const record = { text, url, title, host: hostOf(url), ts };

  const newest = await request(store.index('ts').openCursor(null, 'prev'));
  const prev = newest && newest.value;
  const isWiderSelection =
    prev &&
    prev.url === record.url &&
    record.ts - prev.ts < SUPERSEDE_WINDOW_MS &&
    prev.text !== record.text &&
    record.text.includes(prev.text);

  let id;
  if (isWiderSelection) {
    id = prev.id;
    await request(store.put({ ...prev, ...record, id }));
  } else {
    id = await request(store.add(record));
  }
  await done(tx);
  return { id, superseded: Boolean(isWiderSelection) };
}

function matches(record, { text, host, from, to }) {
  if (host && record.host !== host) return false;
  if (from && record.ts < from) return false;
  if (to && record.ts > to) return false;
  if (text && !record.text.toLowerCase().includes(text)) return false;
  return true;
}

/**
 * Read one page of records, newest first by default.
 * Returns { rows, total }. total counts every match, not just this page.
 */
export async function query({
  text = '',
  host = '',
  from = null,
  to = null,
  order = 'desc',
  offset = 0,
  limit = 50,
} = {}) {
  const db = await openDb();
  const store = db.transaction(STORE, 'readonly').objectStore(STORE);
  const filter = { text: text.trim().toLowerCase(), host, from, to };
  const rows = [];
  let total = 0;
  let scanned = 0;

  await new Promise((resolve, reject) => {
    const req = store
      .index('ts')
      .openCursor(null, order === 'asc' ? 'next' : 'prev');
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const cursor = req.result;
      if (!cursor || scanned >= SCAN_LIMIT) return resolve();
      scanned += 1;
      if (matches(cursor.value, filter)) {
        if (total >= offset && rows.length < limit) rows.push(cursor.value);
        total += 1;
      }
      cursor.continue();
    };
  });

  return { rows, total };
}

/** Read every match, for export. One scan. */
export async function queryAll(filters = {}) {
  const { rows } = await query({ ...filters, offset: 0, limit: Infinity });
  return rows;
}

export async function getByIds(ids) {
  const db = await openDb();
  const store = db.transaction(STORE, 'readonly').objectStore(STORE);
  const rows = await Promise.all(ids.map((id) => request(store.get(id))));
  return rows.filter(Boolean);
}

export async function deleteIds(ids) {
  const db = await openDb();
  const tx = db.transaction(STORE, 'readwrite');
  const store = tx.objectStore(STORE);
  ids.forEach((id) => store.delete(id));
  await done(tx);
  return ids.length;
}

/** Delete everything saved before cutoff. Returns the number deleted. */
export async function deleteOlderThan(cutoff) {
  const db = await openDb();
  const tx = db.transaction(STORE, 'readwrite');
  const index = tx.objectStore(STORE).index('ts');
  let deleted = 0;
  await new Promise((resolve, reject) => {
    const req = index.openCursor(IDBKeyRange.upperBound(cutoff, true));
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const cursor = req.result;
      if (!cursor) return resolve();
      cursor.delete();
      deleted += 1;
      cursor.continue();
    };
  });
  await done(tx);
  return deleted;
}

export async function clearAll() {
  const db = await openDb();
  const tx = db.transaction(STORE, 'readwrite');
  tx.objectStore(STORE).clear();
  await done(tx);
}

export async function countAll() {
  const db = await openDb();
  const store = db.transaction(STORE, 'readonly').objectStore(STORE);
  return request(store.count());
}

/** Distinct hosts, for the filter dropdown. */
export async function listHosts() {
  const db = await openDb();
  const store = db.transaction(STORE, 'readonly').objectStore(STORE);
  const hosts = [];
  await new Promise((resolve, reject) => {
    const req = store.index('host').openKeyCursor(null, 'nextunique');
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const cursor = req.result;
      if (!cursor) return resolve();
      if (cursor.key) hosts.push(cursor.key);
      cursor.continue();
    };
  });
  return hosts.sort();
}
