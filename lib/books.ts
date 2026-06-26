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
  const name = input.applicantName.trim();
  const reason = input.reason.trim();
  let applicant!: Applicant;

  await updateStore((store) => {
    const book = store.books.find((b) => b.id === input.bookId);
    if (!book) throw new Error('책 ID를 찾을 수 없어요');
    if (book.status !== 'open') throw new Error('이미 전달이 완료된 책이에요');
    if (book.ownerName === name) throw new Error('본인이 등록한 책에는 신청할 수 없어요');
    if (store.applicants.some((a) => a.bookId === input.bookId && a.applicantName === name)) {
      throw new Error('이미 신청한 책이에요');
    }

    applicant = {
      id: uuidv4(),
      bookId: input.bookId,
      applicantName: name,
      reason,
      appliedAt: new Date().toISOString(),
    };
    store.applicants.push(applicant);
  });

  return applicant;
}

export async function addApplicantsBatch(input: {
  applicantName: string;
  items: { bookId: string; reason: string }[];
}): Promise<Applicant[]> {
  const name = input.applicantName.trim();
  if (!name) throw new Error('이름을 입력해 주세요');
  if (!input.items.length) throw new Error('책을 하나 이상 선택해 주세요');

  const created: Applicant[] = [];

  await updateStore((store) => {
    for (const item of input.items) {
      const reason = item.reason.trim();
      if (!reason) throw new Error('선택한 모든 책에 이유를 적어 주세요');

      const book = store.books.find((b) => b.id === item.bookId);
      if (!book) throw new Error('책을 찾을 수 없어요');
      if (book.status !== 'open') throw new Error(`「${book.title}」은(는) 이미 전달되었어요`);
      if (book.ownerName === name) throw new Error('본인이 등록한 책에는 신청할 수 없어요');
      if (store.applicants.some((a) => a.bookId === item.bookId && a.applicantName === name)) {
        throw new Error(`「${book.title}」은(는) 이미 신청했어요`);
      }

      const applicant: Applicant = {
        id: uuidv4(),
        bookId: item.bookId,
        applicantName: name,
        reason,
        appliedAt: new Date().toISOString(),
      };
      store.applicants.push(applicant);
      created.push(applicant);
    }
  });

  return created;
}

export async function selectApplicant(input: {
  bookId: string;
  applicantId?: string;
  applicantName?: string;
  ownerName: string;
}): Promise<void> {
  const ownerName = input.ownerName.trim();

  await updateStore((store) => {
    const book = store.books.find((b) => b.id === input.bookId);
    if (!book) throw new Error('책 ID를 찾을 수 없어요');
    if (book.ownerName !== ownerName) {
      throw new Error('등록할 때 입력한 이름과 같아야 선택할 수 있어요');
    }
    if (book.status !== 'open') throw new Error('이미 전달이 완료된 책이에요');

    const applicant = input.applicantId
      ? store.applicants.find((a) => a.id === input.applicantId && a.bookId === input.bookId)
      : store.applicants.find(
          (a) => a.bookId === input.bookId && a.applicantName === input.applicantName?.trim(),
        );

    if (!applicant) throw new Error('신청자를 찾을 수 없어요');

    book.status = 'closed';
    book.selectedApplicant = applicant.applicantName;
  });
}

export async function deleteBook(bookId: string, ownerName: string): Promise<void> {
  let coverUrl = '';

  await updateStore((store) => {
    const book = store.books.find((b) => b.id === bookId);
    if (!book) throw new Error('책을 찾을 수 없어요');
    if (book.ownerName !== ownerName.trim()) {
      throw new Error('등록할 때 입력한 이름과 같아야 삭제할 수 있어요');
    }
    coverUrl = book.coverUrl;
    store.applicants = store.applicants.filter((a) => a.bookId !== bookId);
    store.books = store.books.filter((b) => b.id !== bookId);
  });

  await deleteCoverUrl(coverUrl);
}
