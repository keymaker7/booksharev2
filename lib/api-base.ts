/** API 서버 목록 (앞에서부터 시도) */
export function getApiBases(): string[] {
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host === 'localhost' || host.endsWith('.vercel.app') || host.endsWith('.onrender.com')) {
      return [''];
    }
  }

  const raw =
    process.env.NEXT_PUBLIC_API_URLS ||
    process.env.NEXT_PUBLIC_API_URL ||
    'https://booksharev2.vercel.app';

  return raw
    .split(',')
    .map((s) => s.trim().replace(/\/$/, ''))
    .filter(Boolean);
}

export function apiUrl(path: string, base = getApiBases()[0] ?? ''): string {
  return `${base}${path}`;
}
