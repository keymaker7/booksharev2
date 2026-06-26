import type { Book } from './types';

const CACHE_KEY = 'bookshare_books_cache';
const CACHE_AT_KEY = 'bookshare_books_cache_at';

export function saveBooksCache(books: Book[]) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(books));
    localStorage.setItem(CACHE_AT_KEY, new Date().toISOString());
  } catch {
    /* ignore quota errors */
  }
}

export function loadBooksCache(): Book[] {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Book[];
  } catch {
    return [];
  }
}

export function cacheUpdatedLabel(): string | null {
  const at = localStorage.getItem(CACHE_AT_KEY);
  if (!at) return null;
  try {
    return new Date(at).toLocaleString('ko-KR', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return null;
  }
}
