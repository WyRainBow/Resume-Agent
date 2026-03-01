export type PDFExportBehavior = "alwaysAsk" | "preferDefault";

export interface PDFExportPreferences {
  behavior: PDFExportBehavior;
}

const PREF_KEY = "pdf-export-preferences-v1";
const DIR_LABEL_KEY = "pdf-export-default-dir-label-v1";
const DB_NAME = "resume-agent-settings";
const DB_VERSION = 1;
const STORE_NAME = "file-handles";
const DEFAULT_DIR_HANDLE_KEY = "pdf-default-directory-handle";

const DEFAULT_PREFS: PDFExportPreferences = {
  behavior: "alwaysAsk",
};

function openSettingsDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function idbGet<T>(key: string): Promise<T | null> {
  return openSettingsDB().then(
    (db) =>
      new Promise<T | null>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readonly");
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(key);
        req.onsuccess = () => resolve((req.result as T | undefined) ?? null);
        req.onerror = () => reject(req.error);
        tx.oncomplete = () => db.close();
      }),
  );
}

function idbSet<T>(key: string, value: T): Promise<void> {
  return openSettingsDB().then(
    (db) =>
      new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        const req = store.put(value, key);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
        tx.oncomplete = () => db.close();
      }),
  );
}

function idbDelete(key: string): Promise<void> {
  return openSettingsDB().then(
    (db) =>
      new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        const req = store.delete(key);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
        tx.oncomplete = () => db.close();
      }),
  );
}

export function getPDFExportPreferences(): PDFExportPreferences {
  try {
    const raw = localStorage.getItem(PREF_KEY);
    if (!raw) return DEFAULT_PREFS;
    const parsed = JSON.parse(raw) as Partial<PDFExportPreferences>;
    return {
      behavior:
        parsed.behavior === "preferDefault" ? "preferDefault" : "alwaysAsk",
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function setPDFExportPreferences(
  prefs: PDFExportPreferences,
): void {
  localStorage.setItem(PREF_KEY, JSON.stringify(prefs));
}

export function supportsDirectoryPicker(): boolean {
  return typeof (window as any).showDirectoryPicker === "function";
}

export async function saveDefaultPDFDirectoryHandle(
  handle: any,
): Promise<void> {
  await idbSet(DEFAULT_DIR_HANDLE_KEY, handle);
  try {
    const label =
      handle && typeof handle.name === "string" && handle.name.trim()
        ? handle.name.trim()
        : "未命名文件夹";
    localStorage.setItem(DIR_LABEL_KEY, label);
  } catch {
    // ignore localStorage errors
  }
}

export async function getDefaultPDFDirectoryHandle(): Promise<any | null> {
  return idbGet<any>(DEFAULT_DIR_HANDLE_KEY);
}

export async function clearDefaultPDFDirectoryHandle(): Promise<void> {
  await idbDelete(DEFAULT_DIR_HANDLE_KEY);
  try {
    localStorage.removeItem(DIR_LABEL_KEY);
  } catch {
    // ignore localStorage errors
  }
}

export async function hasDefaultPDFDirectory(): Promise<boolean> {
  const handle = await getDefaultPDFDirectoryHandle();
  return !!handle;
}

export function getDefaultPDFDirectoryLabel(): string | null {
  try {
    const label = localStorage.getItem(DIR_LABEL_KEY);
    return label && label.trim() ? label : null;
  } catch {
    return null;
  }
}

export async function ensureDirectoryPermission(
  handle: any,
): Promise<boolean> {
  if (!handle) return false;
  try {
    if (typeof handle.queryPermission === "function") {
      const status = await handle.queryPermission({ mode: "readwrite" });
      if (status === "granted") return true;
    }
    if (typeof handle.requestPermission === "function") {
      const granted = await handle.requestPermission({ mode: "readwrite" });
      return granted === "granted";
    }
  } catch {
    return false;
  }
  return false;
}

export async function writePdfToDirectory(
  dirHandle: any,
  filename: string,
  blob: Blob,
): Promise<void> {
  const fileHandle = await dirHandle.getFileHandle(filename, {
    create: true,
  });
  const writable = await fileHandle.createWritable();
  await writable.write(blob);
  await writable.close();
}
