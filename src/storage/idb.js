// Minimal IndexedDB wrapper (no deps) for MRI.
// Stores:
// - dailyResult: computed daily payload (featuresZ + meta)
// - intradayCache: last intraday payload

const DB_NAME = "mri_db";
const DB_VERSION = 1;

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("kv")) {
        db.createObjectStore("kv");
      }
    };
    req.onsuccess = () => resolve(req.result);
  });
}

async function withStore(mode, fn) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("kv", mode);
    const store = tx.objectStore("kv");
    let out;
    try {
      out = fn(store);
    } catch (e) {
      reject(e);
      return;
    }
    tx.oncomplete = () => resolve(out);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export async function idbGet(key) {
  return withStore("readonly", (store) => {
    return new Promise((resolve, reject) => {
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => reject(req.error);
    });
  });
}

export async function idbSet(key, value) {
  return withStore("readwrite", (store) => {
    store.put(value, key);
  });
}

export async function idbDel(key) {
  return withStore("readwrite", (store) => {
    store.delete(key);
  });
}


// Deletes the whole DB (dev/debug convenience)
export function deleteDB() {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.deleteDatabase(DB_NAME);
      req.onsuccess = () => resolve(true);
      req.onerror = () => resolve(false);
      req.onblocked = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}
