import fs from 'fs';
import path from 'path';
import { del, head, put } from '@vercel/blob';
import type { Applicant, Book } from './types';

export interface StoreData {
  books: Book[];
  applicants: Applicant[];
}

const STORE_PATH = 'bookshare/store.json';
const dataDir = path.join(process.cwd(), 'data');
const storePath = path.join(dataDir, 'store.json');
const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'covers');

const emptyStore = (): StoreData => ({ books: [], applicants: [] });
const useBlob = () => !!process.env.BLOB_READ_WRITE_TOKEN;

function ensureDirs() {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
}

export async function readStore(): Promise<StoreData> {
  if (useBlob()) {
    try {
      const meta = await head(STORE_PATH);
      const res = await fetch(meta.url);
      if (!res.ok) return emptyStore();
      return (await res.json()) as StoreData;
    } catch {
      return emptyStore();
    }
  }

  ensureDirs();
  if (!fs.existsSync(storePath)) {
    const store = emptyStore();
    fs.writeFileSync(storePath, JSON.stringify(store, null, 2), 'utf8');
    return store;
  }
  try {
    return JSON.parse(fs.readFileSync(storePath, 'utf8')) as StoreData;
  } catch {
    return emptyStore();
  }
}

export async function writeStore(store: StoreData) {
  if (useBlob()) {
    await put(STORE_PATH, JSON.stringify(store), {
      access: 'public',
      addRandomSuffix: false,
      contentType: 'application/json',
    });
    return;
  }
  ensureDirs();
  fs.writeFileSync(storePath, JSON.stringify(store, null, 2), 'utf8');
}

export async function updateStore(mutator: (store: StoreData) => void) {
  const store = await readStore();
  mutator(store);
  await writeStore(store);
  return store;
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
