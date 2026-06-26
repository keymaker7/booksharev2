export type BookStatus = 'open' | 'closed';

export interface Book {
  id: string;
  ownerName: string;
  title: string;
  coverUrl: string;
  recommendation: string;
  status: BookStatus;
  selectedApplicant: string;
}

export interface Applicant {
  id: string;
  bookId: string;
  applicantName: string;
  reason: string;
  appliedAt: string;
}

export interface ApiError {
  error: string;
}
