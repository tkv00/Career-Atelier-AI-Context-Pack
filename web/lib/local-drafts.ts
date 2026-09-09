'use client';

// §7 "로컬 즉시" 저장 — 타이핑마다 IndexedDB에 쓴다. 브라우저가 강제 종료되거나
// 오프라인이어도 이 레이어는 살아남는다. 클라우드 저장과 별개의 안전망이다.
const DB_NAME = 'career-atelier';
const STORE_NAME = 'essay_drafts';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export type LocalDraft = { content: string; baseRevision: number | null };

const pendingWrites = new Map<string, Promise<void>>();

export function saveLocalDraft(essayId: string, content: string, baseRevision: number | null = null): Promise<void> {
  const pending = (pendingWrites.get(essayId) ?? Promise.resolve()).catch(() => {}).then(() => writeLocalDraft(essayId, content, baseRevision));
  pendingWrites.set(essayId, pending);
  const clear = () => { if (pendingWrites.get(essayId) === pending) pendingWrites.delete(essayId); };
  void pending.then(clear, clear);
  return pending;
}

async function writeLocalDraft(essayId: string, content: string, baseRevision: number | null): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put({ content, baseRevision }, essayId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function loadLocalDraft(essayId: string): Promise<LocalDraft | null> {
  const db = await openDb();
  const result = await new Promise<LocalDraft | null>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(essayId);
    req.onsuccess = () => {
      const value = req.result;
      // 구버전 본문에는 기준 리비전이 없으므로 자동 덮어쓰기하지 않는다.
      resolve(typeof value === 'string' ? { content: value, baseRevision: null } : value ?? null);
    };
    req.onerror = () => reject(req.error);
  });
  db.close();
  return result;
}
