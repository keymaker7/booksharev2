import { deleteCoverUrl, readStore, updateStore } from './store';
import type { Applicant, Book } from './types';

export type AdminBook = Book & { applicantCount: number };

export async function getAdminDashboard() {
  const store = await readStore();
  const books: AdminBook[] = store.books.map((b) => ({
    ...b,
    applicantCount: store.applicants.filter((a) => a.bookId === b.id).length,
  }));
  return {
    bookCount: store.books.length,
    applicantCount: store.applicants.length,
    openCount: store.books.filter((b) => b.status === 'open').length,
    closedCount: store.books.filter((b) => b.status === 'closed').length,
    books,
    applicants: store.applicants,
  };
}

export async function adminDeleteBook(bookId: string) {
  let coverUrl = '';

  await updateStore((store) => {
    const book = store.books.find((b) => b.id === bookId);
    if (!book) throw new Error('책을 찾을 수 없어요');
    coverUrl = book.coverUrl;
    store.books = store.books.filter((b) => b.id !== bookId);
    store.applicants = store.applicants.filter((a) => a.bookId !== bookId);
  });

  await deleteCoverUrl(coverUrl);
}

export async function adminResetAll() {
  const coverUrls: string[] = [];

  await updateStore((store) => {
    coverUrls.push(...store.books.map((b) => b.coverUrl));
    store.books = [];
    store.applicants = [];
  });

  for (const url of coverUrls) {
    await deleteCoverUrl(url);
  }
}

export function buildCsv(books: Book[], applicants: Applicant[]): string {
  const esc = (s: string) => `"${String(s).replace(/"/g, '""')}"`;
  const lines = ['구분,제목,등록자,상태,선택된친구,신청자,내용,일시'];

  for (const b of books) {
    lines.push(
      [
        '책',
        esc(b.title),
        esc(b.ownerName),
        b.status === 'open' ? '나눔중' : '완료',
        esc(b.selectedApplicant),
        '',
        esc(b.recommendation.slice(0, 200)),
        '',
      ].join(','),
    );
  }

  for (const a of applicants) {
    const book = books.find((b) => b.id === a.bookId);
    lines.push(
      [
        '신청',
        esc(book?.title || ''),
        esc(book?.ownerName || ''),
        '',
        '',
        esc(a.applicantName),
        esc(a.reason.slice(0, 200)),
        esc(a.appliedAt),
      ].join(','),
    );
  }

  return '\uFEFF' + lines.join('\n');
}
