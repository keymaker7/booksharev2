import { getApiBases } from './api-base';

const TIMEOUT_MS = 12_000;
const RETRIES = 2;

export class ApiConnectionError extends Error {
  constructor(message = '서버에 연결할 수 없어요. Wi‑Fi를 확인하거나 잠시 후 다시 시도해 주세요.') {
    super(message);
    this.name = 'ApiConnectionError';
  }
}

function isAbortError(err: unknown) {
  return err instanceof DOMException && err.name === 'AbortError';
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** 여러 API 서버를 순서대로 시도 (타임아웃·재시도 포함) */
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const bases = getApiBases();
  let lastError: unknown = new ApiConnectionError();

  for (const base of bases) {
    const url = `${base}${path}`;
    for (let attempt = 0; attempt < RETRIES; attempt++) {
      try {
        const res = await fetchWithTimeout(url, init, TIMEOUT_MS);
        if (res.ok || res.status < 500) return res;
        lastError = new Error(`HTTP ${res.status}`);
      } catch (err) {
        lastError = err;
        if (!isAbortError(err) && !(err instanceof TypeError)) break;
      }
    }
  }

  if (lastError instanceof Error) throw lastError;
  throw new ApiConnectionError();
}

export async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await apiFetch(path, init);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || '요청에 실패했어요');
  return data as T;
}

export async function checkApiHealth(): Promise<boolean> {
  try {
    const data = await apiJson<{ ok: boolean }>('/api/ping');
    return !!data.ok;
  } catch {
    return false;
  }
}

export function getWorkingApiBase(): string {
  return getApiBases()[0] ?? '';
}
