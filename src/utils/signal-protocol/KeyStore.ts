import type { KeyBundle } from './types';

const DB_NAME = 'wave-signal-keys';
const DB_VERSION = 1;
const STORE_BUNDLES = 'key-bundles';
const STORE_SESSIONS = 'sessions';

export class KeyStore {
  private db: IDBDatabase | null = null;

  async open(): Promise<void> {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = (e.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_BUNDLES)) {
          db.createObjectStore(STORE_BUNDLES);
        }
        if (!db.objectStoreNames.contains(STORE_SESSIONS)) {
          db.createObjectStore(STORE_SESSIONS);
        }
      };
      req.onsuccess = (e) => {
        this.db = (e.target as IDBOpenDBRequest).result;
        resolve();
      };
      req.onerror = () => reject(req.error);
    });
  }

  private getDb(): IDBDatabase {
    if (!this.db) throw new Error('KeyStore not opened');
    return this.db;
  }

  async storeKeyBundle(userId: string, bundle: KeyBundle): Promise<void> {
    const { serializeBundle } = await import('./crypto');
    const serialized = serializeBundle(bundle);
    return new Promise((resolve, reject) => {
      const tx = this.getDb().transaction(STORE_BUNDLES, 'readwrite');
      const req = tx.objectStore(STORE_BUNDLES).put(serialized, userId);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async getKeyBundle(userId: string): Promise<KeyBundle | null> {
    const { deserializeBundle } = await import('./crypto');
    return new Promise((resolve, reject) => {
      const tx = this.getDb().transaction(STORE_BUNDLES, 'readonly');
      const req = tx.objectStore(STORE_BUNDLES).get(userId);
      req.onsuccess = () => {
        if (req.result) {
          try {
            resolve(deserializeBundle(req.result));
          } catch {
            resolve(null);
          }
        } else {
          resolve(null);
        }
      };
      req.onerror = () => reject(req.error);
    });
  }

  async storeSession(recipientId: string, sessionData: Uint8Array): Promise<void> {
    return new Promise((resolve, reject) => {
      const tx = this.getDb().transaction(STORE_SESSIONS, 'readwrite');
      const req = tx.objectStore(STORE_SESSIONS).put(sessionData, recipientId);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async getSession(recipientId: string): Promise<Uint8Array | null> {
    return new Promise((resolve, reject) => {
      const tx = this.getDb().transaction(STORE_SESSIONS, 'readonly');
      const req = tx.objectStore(STORE_SESSIONS).get(recipientId);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => reject(req.error);
    });
  }

  async clear(): Promise<void> {
    return new Promise((resolve, reject) => {
      const tx = this.getDb().transaction([STORE_BUNDLES, STORE_SESSIONS], 'readwrite');
      tx.objectStore(STORE_BUNDLES).clear();
      tx.objectStore(STORE_SESSIONS).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
}
