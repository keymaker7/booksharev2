import fs from 'fs';
import path from 'path';
import {
  BlobNotFoundError,
  BlobServiceNotAvailable,
  BlobServiceRateLimited,
  del,
  get,
  list,
  put,
} from '@vercel/blob';
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
const BLOB_READ_RETRIES = 4;

export class StoreReadError extends Error {
  constructor(message = '저장소를 읽을 수 없어요. 잠시 후 다시 시도해 주세요.') {
    super(message);
    this.name = 'StoreReadError';
  }
}

const emptyStore = (): StoreData => ({ revision: 0, books: [], applicants: [] });
const onVercel = () => Boolean(process.env.VERCEL);
const useBlobStorage = () => onVercel() || Boolean(process.env.BLOB_READ_WRITE_TOKEN?.trim());

function getBlobToken(): string {
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim();
  if (!token) throw new StoreReadError('Blob 저장소 설정이 필요해요');
  return token;
}

function blobOptions() {
  return { access: 'public' as const, token: getBlobToken() };
}

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
  if (err instanceof BlobNotFoundError) return true;
  if (!err || typeof err !== 'object') return false;
  const e = err as { name?: string; message?: string };
  if (e.name === 'BlobNotFoundError') return true;
  return /not found|does not exist|404/i.test(String(e.message || ''));
}

function isTransientBlobError(err: unknown): boolean {
  return err instanceof BlobServiceRateLimited || err instanceof BlobServiceNotAvailable;
}

async function streamToText(stream: ReadableStream<Uint8Array>): Promise<string> {
  return new Response(stream).text();
}

async function parseBlobResult(
  result: NonNullable<Awaited<ReturnType<typeof get>>>,
): Promise<StoreData> {
  if (result.statusCode !== 200 || !result.stream) {
    throw new StoreReadError();
  }
  const text = await streamToText(result.stream);
  if (!text.trim()) return emptyStore();
  return normalizeStore(JSON.parse(text) as StoreData);
}

async function readBlobJson(): Promise<StoreData> {
  const options = blobOptions();

  for (let attempt = 0; attempt < BLOB_READ_RETRIES; attempt++) {
    try {
      const result = await get(STORE_PATH, options);
      if (result === null) return emptyStore();
      return await parseBlobResult(result);
    } catch (err) {
      if (isBlobNotFound(err)) return emptyStore();
      if (err instanceof SyntaxError) {
        throw new StoreReadError('저장 데이터 형식 오류예요. 관리자에게 문의해 주세요.');
      }
      if (isTransientBlobError(err)) {
        await sleep(250 * (attempt + 1));
        continue;
      }
      if (attempt < BLOB_READ_RETRIES - 1) {
        await sleep(120 * (attempt + 1));
        continue;
      }
      throw err;
    }
  }

  try {
    const { blobs } = await list({ prefix: 'bookshare/', token: getBlobToken() });
    const blob = blobs.find((item) => item.pathname === STORE_PATH);
    if (!blob) return emptyStore();
    const result = await get(blob.url, options);
    if (result === null) return emptyStore();
    return await parseBlobResult(result);
  } catch (err) {
    if (isBlobNotFound(err)) return emptyStore();
    throw err;
  }
}

export async function readStore(): Promise<StoreData> {
  if (useBlobStorage()) {
    try {
      return await readBlobJson();
    } catch (err) {
      if (err instanceof StoreReadError) throw err;
      if (err instanceof SyntaxError) {
        throw new StoreReadError('저장 데이터 형식 오류예요. 관리자에게 문의해 주세요.');
      }
      console.error('readStore blob error:', err);
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

  if (useBlobStorage()) {
    await put(STORE_PATH, JSON.stringify(payload), {
      ...blobOptions(),
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
  if (!useBlobStorage()) {
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

  if (useBlobStorage()) {
    const blob = await put(`bookshare/covers/${filename}`, buffer, {
      ...blobOptions(),
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
    if (useBlobStorage()) {
      try {
        await del(coverUrl, blobOptions());
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
