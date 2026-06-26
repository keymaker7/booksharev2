import fs from 'fs';
import path from 'path';
import { del, head, put } from '@vercel/blob';
import type { Applicant, Book } from './types';

export interface StoreData {
  revision?: number;
  books: Book[];
  applicants: Applicant[];
}

const STORE_PATH = 'bookshare/store.json';
const dataDir = path.join(process.cwd(), 'data');
const storePath = path.join(dataDir, 'store.json');
const lockPath = path.join(dataDir, 'store.lock');
const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'covers');

const MAX_RETRIES = 10;

export class StoreReadError extends Error {
  constructor(message = '저장소를 읽을 수 없어요. 잠시 후 다시 시도해 주세요.') {
    super(message);
    this.name = 'StoreReadError';
  }
}

const emptyStore = (): StoreData => ({ revision: 0, books: [], applicants: [] });
const useBlob = () => !!process.env.BLOB_READ_WRITE_TOKEN;

function normalizeStore(raw: StoreData): StoreData {
  return {
    revision: raw.revision ?? 0,
    books: raw.books ?? [],
    applicants: raw.applicants ?? [],
  };
}

function ensureDirs() {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function acquireLocalLock(): void {
  ensureDirs();
  for (let i = 0; i < 80; i++) {
    try {
      fs.writeFileSync(lockPath, String(process.pid), { flag: 'wx' });
      return;
    } catch {
      const start = Date.now();
      while (Date.now() - start < 20) {
        /* spin */
      }
    }
  }
  throw new Error('잠시 후 다시 시도해 주세요');
}

function releaseLocalLock() {
  try {
    if (fs.existsSync(lockPath)) fs.unlinkSync(lockPath);
  } catch {
    /* ignore */
  }
}

function isBlobNotFound(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { name?: string; message?: string };
  if (e.name === 'BlobNotFoundError') return true;
  return /not found|does not exist/i.test(String(e.message || ''));
}

export async function readStore(): Promise<StoreData> {
  if (useBlob()) {
    try {
      const meta = await head(STORE_PATH);
      const res = await fetch(meta.url);
      if (!res.ok) throw new StoreReadError();
      return normalizeStore((await res.json()) as StoreData);
    } catch (err) {
      if (isBlobNotFound(err)) return emptyStore();
      if (err instanceof StoreReadError) throw err;
      throw new StoreReadError();
    }
  }

  ensureDirs();
  if (!fs.existsSync(storePath)) {
    const store = emptyStore();
    fs.writeFileSync(storePath, JSON.stringify(store, null, 2), 'utf8');
    return store;
  }
  try {
    return normalizeStore(JSON.parse(fs.readFileSync(storePath, 'utf8')) as StoreData);
  } catch {
    throw new StoreReadError('저장 파일이 손상되었어요. 관리자에게 문의해 주세요.');
  }
}

export async function writeStore(store: StoreData) {
  const payload = normalizeStore(store);

  if (useBlob()) {
    await put(STORE_PATH, JSON.stringify(payload), {
      access: 'public',
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: 'application/json',
    });
    return;
  }

  ensureDirs();
  const tmpPath = `${storePath}.${process.pid}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(payload, null, 2), 'utf8');
  fs.renameSync(tmpPath, storePath);
}

export async function updateStore(mutator: (store: StoreData) => void): Promise<StoreData> {
  if (!useBlob()) {
    acquireLocalLock();
    try {
      const store = await readStore();
      mutator(store);
      store.revision = (store.revision ?? 0) + 1;
      await writeStore(store);
      return store;
    } finally {
      releaseLocalLock();
    }
  }

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const base = await readStore();
    const baseRevision = base.revision ?? 0;

    const latest = await readStore();
    if ((latest.revision ?? 0) !== baseRevision) {
      await sleep(30 + Math.random() * 70 * (attempt + 1));
      continue;
    }

    const working = normalizeStore(JSON.parse(JSON.stringify(latest)));
    mutator(working);
    working.revision = baseRevision + 1;
    await writeStore(working);

    const verify = await readStore();
    if ((verify.revision ?? 0) === baseRevision + 1) {
      return verify;
    }

    await sleep(40 + Math.random() * 80 * (attempt + 1));
  }

  throw new Error('잠시 후 다시 시도해 주세요');
}

export async function saveCoverBuffer(buffer: Buffer, contentType: string): Promise<string> {
  const ext = contentType === 'image/png' ? 'png' : 'jpg';
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  if (useBlob()) {
    const blob = await put(`bookshare/covers/${filename}`, buffer, {
      access: 'public',
      contentType,
    });
    return blob.url;
  }

  ensureDirs();
  fs.writeFileSync(path.join(uploadDir, filename), buffer);
  return `/uploads/covers/${filename}`;
}

export async function deleteCoverUrl(coverUrl: string) {
  if (!coverUrl) return;

  if (coverUrl.startsWith('http')) {
    if (useBlob()) {
      try {
        await del(coverUrl);
      } catch {
        /* ignore */
      }
    }
    return;
  }

  if (coverUrl.startsWith('/uploads/')) {
    const filepath = path.join(process.cwd(), 'public', coverUrl);
    if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
  }
}
