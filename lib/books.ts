import { v4 as uuidv4 } from 'uuid';
import { deleteCoverUrl, readStore, saveCoverBuffer, updateStore } from './store';
import type { Applicant, Book } from './types';

export async function listBooks(): Promise<Book[]> {
  return (await readStore()).books;
}

export async function listBooksByOwner(ownerName: string): Promise<Book[]> {
  return (await readStore()).books.filter((b) => b.ownerName === ownerName.trim());
}

export async function getBook(id: string): Promise<Book | null> {
  return (await readStore()).books.find((b) => b.id === id) ?? null;
}

export async function listApplicants(bookId: string): Promise<Applicant[]> {
  return (await readStore())
    .applicants.filter((a) => a.bookId === bookId)
    .sort((a, b) => a.appliedAt.localeCompare(b.appliedAt));
}

export async function saveCoverFile(file: File): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer());
  return saveCoverBuffer(buffer, file.type || 'image/jpeg');
}

export async function createBook(input: {
  ownerName: string;
  title: string;
  recommendation: string;
  coverUrl: string;
}): Promise<Book> {
  const book: Book = {
    id: uuidv4(),
    ownerName: input.ownerName.trim(),
    title: input.title.trim(),
    coverUrl: input.coverUrl,
    recommendation: input.recommendation.trim(),
    status: 'open',
    selectedApplicant: '',
  };
  await updateStore((store) => {
    store.books.unshift(book);
  });
  return book;
}

export async function addApplicant(input: {
  bookId: string;
  applicantName: string;
  reason: string;
}): Promise<Applicant> {
  const book = await getBook(input.bookId);
  if (!book) throw new Error('책 ID를 찾을 수 없어요');
  if (book.status !== 'open') throw new Error('이미 전달이 완료된 책이에요');

  const applicant: Applicant = {
    id: uuidv4(),
    bookId: input.bookId,
    applicantName: input.applicantName.trim(),
    reason: input.reason.trim(),
    appliedAt: new Date().toISOString(),
  };
  await updateStore((store) => {
    store.applicants.push(applicant);
  });
  return applicant;
}

export async function selectApplicant(input: {
  bookId: string;
  applicantName: string;
  ownerName: string;
}): Promise<void> {
  const book = await getBook(input.bookId);
  if (!book) throw new Error('책 ID를 찾을 수 없어요');
  if (book.ownerName !== input.ownerName.trim()) {
    throw new Error('등록할 때 입력한 이름과 같아야 선택할 수 있어요');
  }
  if (book.status !== 'open') throw new Error('이미 전달이 완료된 책이에요');

  await updateStore((store) => {
    const target = store.books.find((b) => b.id === input.bookId);
    if (target) {
      target.status = 'closed';
      target.selectedApplicant = input.applicantName.trim();
    }
  });
}

export async function deleteBook(bookId: string, ownerName: string): Promise<void> {
  const book = await getBook(bookId);
  if (!book) throw new Error('책을 찾을 수 없어요');
  if (book.ownerName !== ownerName.trim()) {
    throw new Error('등록할 때 입력한 이름과 같아야 삭제할 수 있어요');
  }

  await deleteCoverUrl(book.coverUrl);
  await updateStore((store) => {
    store.applicants = store.applicants.filter((a) => a.bookId !== bookId);
    store.books = store.books.filter((b) => b.id !== bookId);
  });
}
