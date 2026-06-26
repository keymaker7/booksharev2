'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api-client';
import type { AdminBook } from '@/lib/admin';
import type { Applicant } from '@/lib/types';

const SESSION_KEY = 'bookshare_admin_key';

type Dashboard = {
  bookCount: number;
  applicantCount: number;
  openCount: number;
  closedCount: number;
  books: AdminBook[];
  applicants: Applicant[];
};

function authHeaders(key: string) {
  return { Authorization: `Bearer ${key}` };
}

export default function AdminPanel() {
  const [key, setKey] = useState('');
  const [inputKey, setInputKey] = useState('');
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (adminKey: string) => {
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch('/api/admin/dashboard', { headers: authHeaders(adminKey) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '불러오기 실패');
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const saved = sessionStorage.getItem(SESSION_KEY);
    if (saved) {
      setKey(saved);
      load(saved);
    }
  }, [load]);

  function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    const k = inputKey.trim();
    if (!k) return;
    sessionStorage.setItem(SESSION_KEY, k);
    setKey(k);
    load(k);
  }

  function handleLogout() {
    sessionStorage.removeItem(SESSION_KEY);
    setKey('');
    setData(null);
    setInputKey('');
  }

  async function handleDeleteBook(id: string, title: string) {
    if (!confirm(`「${title}」을(를) 삭제할까요?`)) return;
    try {
      const res = await apiFetch(`/api/admin/books/${id}`, {
        method: 'DELETE',
        headers: authHeaders(key),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      await load(key);
    } catch (err) {
      alert(err instanceof Error ? err.message : '삭제 실패');
    }
  }

  async function handleResetAll() {
    if (!confirm('⚠️ 모든 책과 신청을 삭제합니다. 정말 진행할까요?')) return;
    if (!confirm('마지막 확인: 복구할 수 없습니다. 계속할까요?')) return;
    try {
      const res = await apiFetch('/api/admin/reset', {
        method: 'POST',
        headers: authHeaders(key),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      await load(key);
      alert('전체 데이터가 삭제되었어요.');
    } catch (err) {
      alert(err instanceof Error ? err.message : '초기화 실패');
    }
  }

  async function handleExport() {
    try {
      const res = await apiFetch('/api/admin/export', { headers: authHeaders(key) });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `bookshare_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(err instanceof Error ? err.message : '다운로드 실패');
    }
  }

  if (!key) {
    return (
      <div className="app admin-app">
        <div className="admin-login">
          <Link href="/" className="admin-back">← 책장으로</Link>
          <h1>🔐 선생님 관리</h1>
          <p>관리자 비밀번호를 입력하세요.</p>
          <form onSubmit={handleLogin}>
            <input
              className="form-input"
              type="password"
              value={inputKey}
              onChange={(e) => setInputKey(e.target.value)}
              placeholder="관리자 비밀번호"
              autoComplete="current-password"
            />
            <button type="submit" className="btn btn-primary">들어가기</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="app admin-app">
      <header className="admin-header">
        <div>
          <Link href="/" className="admin-back">← 책장으로</Link>
          <h1>📋 선생님 관리</h1>
        </div>
        <button type="button" className="admin-logout" onClick={handleLogout}>로그아웃</button>
      </header>

      {error && <div className="status-banner error">{error}</div>}

      {loading && !data ? (
        <div className="loading-box"><div className="spinner" /><p>불러오는 중...</p></div>
      ) : data ? (
        <>
          <div className="admin-stats">
            <div className="admin-stat"><strong>{data.bookCount}</strong><span>등록된 책</span></div>
            <div className="admin-stat"><strong>{data.openCount}</strong><span>나눔 중</span></div>
            <div className="admin-stat"><strong>{data.closedCount}</strong><span>전달 완료</span></div>
            <div className="admin-stat"><strong>{data.applicantCount}</strong><span>신청</span></div>
          </div>

          <div className="admin-actions">
            <button type="button" className="btn btn-outline" onClick={() => load(key)} disabled={loading}>
              새로고침
            </button>
            <button type="button" className="btn btn-primary" onClick={handleExport}>
              📥 CSV 다운로드
            </button>
            <button type="button" className="btn btn-delete" onClick={handleResetAll}>
              🗑️ 전체 초기화
            </button>
          </div>

          {data.books.length === 0 ? (
            <div className="empty-box"><p>등록된 책이 없어요.</p></div>
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>제목</th>
                    <th>등록자</th>
                    <th>상태</th>
                    <th>신청</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {data.books.map((b) => (
                    <tr key={b.id}>
                      <td>{b.title}</td>
                      <td>{b.ownerName}</td>
                      <td>
                        <span className={`admin-badge${b.status === 'closed' ? ' done' : ''}`}>
                          {b.status === 'open' ? '나눔 중' : b.selectedApplicant || '완료'}
                        </span>
                      </td>
                      <td>{b.applicantCount}명</td>
                      <td>
                        <button
                          type="button"
                          className="admin-del-btn"
                          onClick={() => handleDeleteBook(b.id, b.title)}
                        >
                          삭제
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
