'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch, apiJson, checkApiHealth } from '@/lib/api-client';
import { cacheUpdatedLabel, loadBooksCache, saveBooksCache } from '@/lib/book-cache';
import type { Applicant, Book } from '@/lib/types';
import { compressCover, getStoredName, saveName } from '@/lib/client-utils';

type Page = 'home' | 'register' | 'gallery' | 'apply' | 'owner';
type ApiStatus = 'checking' | 'online' | 'offline';

async function fetchBooks(): Promise<Book[]> {
  return apiJson<Book[]>('/api/books');
}

export default function BookshareApp() {
  const [page, setPage] = useState<Page>('home');
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type?: string } | null>(null);

  const [coverPreview, setCoverPreview] = useState('');
  const [coverBlob, setCoverBlob] = useState<Blob | null>(null);
  const [regName, setRegName] = useState('');
  const [regTitle, setRegTitle] = useState('');
  const [regReason, setRegReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [applyName, setApplyName] = useState('');
  const [selectedApply, setSelectedApply] = useState<Set<string>>(new Set());
  const [applyReasons, setApplyReasons] = useState<Record<string, string>>({});

  const [ownerName, setOwnerName] = useState('');
  const [ownerBooks, setOwnerBooks] = useState<Book[]>([]);
  const [ownerApplicants, setOwnerApplicants] = useState<Record<string, Applicant[]>>({});
  const [ownerLoading, setOwnerLoading] = useState(false);
  const [ownerLoaded, setOwnerLoaded] = useState(false);

  const [detailBook, setDetailBook] = useState<Book | null>(null);
  const [deleteOwnerName, setDeleteOwnerName] = useState('');
  const [celebrate, setCelebrate] = useState<{ owner: string; applicant: string } | null>(null);
  const [selectingBookId, setSelectingBookId] = useState<string | null>(null);
  const [apiStatus, setApiStatus] = useState<ApiStatus>('checking');
  const [usingCache, setUsingCache] = useState(false);
  const [cacheLabel, setCacheLabel] = useState<string | null>(null);

  const showToast = useCallback((msg: string, type = '') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const loadBooks = useCallback(async () => {
    setLoading(true);
    setUsingCache(false);
    try {
      const data = await fetchBooks();
      setBooks(data);
      saveBooksCache(data);
      setApiStatus('online');
      setCacheLabel(null);
    } catch (err) {
      const cached = loadBooksCache();
      if (cached.length) {
        setBooks(cached);
        setUsingCache(true);
        setCacheLabel(cacheUpdatedLabel());
        showToast('오프라인 — 마지막으로 저장된 목록을 보여드려요', 'error');
      } else {
        setBooks([]);
        showToast(err instanceof Error ? err.message : '책 목록을 불러올 수 없어요', 'error');
      }
      setApiStatus('offline');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  const refreshConnection = useCallback(async () => {
    setApiStatus('checking');
    const ok = await checkApiHealth();
    setApiStatus(ok ? 'online' : 'offline');
    if (ok) await loadBooks();
    else showToast('아직 서버에 연결되지 않았어요', 'error');
  }, [loadBooks, showToast]);

  useEffect(() => {
    setDetailBook((prev) => {
      if (!prev) return null;
      return books.find((b) => b.id === prev.id) ?? null;
    });
  }, [books]);

  const goPage = useCallback(
    (next: Page, skipLoad = false) => {
      setPage(next);
      window.scrollTo(0, 0);
      const name = getStoredName();
      if (next === 'register' && name) setRegName(name);
      if (next === 'apply' && name) setApplyName(name);
      if (next === 'owner' && name) setOwnerName(name);
      if (next === 'gallery' && !skipLoad) loadBooks();
      if (next === 'apply') {
        loadBooks().then(() => {
          setSelectedApply(new Set());
          setApplyReasons({});
        });
      }
    },
    [loadBooks]
  );

  useEffect(() => {
    checkApiHealth().then((ok) => setApiStatus(ok ? 'online' : 'offline'));
    loadBooks();
    const name = getStoredName();
    if (name) {
      setRegName(name);
      setApplyName(name);
      setOwnerName(name);
      setDeleteOwnerName(name);
    }
  }, [loadBooks]);

  const openBooks = useMemo(() => books.filter((b) => b.status === 'open'), [books]);

  async function handleCoverChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      showToast('8MB 이하 사진만 가능해요', 'error');
      return;
    }
    try {
      const blob = await compressCover(file);
      setCoverBlob(blob);
      setCoverPreview(URL.createObjectURL(blob));
    } catch (err) {
      showToast(err instanceof Error ? err.message : '사진 오류', 'error');
      e.target.value = '';
    }
  }

  async function handleRegister(e: FormEvent) {
    e.preventDefault();
    const name = regName.trim();
    if (!name || !regTitle.trim() || !regReason.trim()) {
      showToast('모든 항목을 입력해 주세요', 'error');
      return;
    }

    setSubmitting(true);
    try {
      saveName(name);
      const form = new FormData();
      form.append('ownerName', name);
      form.append('title', regTitle.trim());
      form.append('recommendation', regReason.trim());
      if (coverBlob) form.append('cover', coverBlob, 'cover.jpg');

      const res = await apiFetch('/api/books', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      if (data.book) {
        setBooks((prev) => {
          const next = [data.book, ...prev];
          saveBooksCache(next);
          return next;
        });
      }
      showToast('책이 전시장에 등록되었어요! 📚', 'success');
      setRegTitle('');
      setRegReason('');
      setCoverBlob(null);
      setCoverPreview('');
      goPage('gallery', true);
      setTimeout(() => loadBooks(), 3000);
    } catch (err) {
      showToast(err instanceof Error ? err.message : '등록 실패', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  function toggleApply(id: string) {
    setSelectedApply((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleApplySubmit() {
    const name = applyName.trim();
    if (!name) {
      showToast('이름을 입력해 주세요', 'error');
      return;
    }
    if (!selectedApply.size) {
      showToast('책을 하나 이상 선택해 주세요', 'error');
      return;
    }

    const items: { bookId: string; reason: string }[] = [];
    for (const id of selectedApply) {
      const reason = (applyReasons[id] || '').trim();
      if (!reason) {
        showToast('선택한 모든 책에 이유를 적어 주세요', 'error');
        return;
      }
      items.push({ bookId: id, reason });
    }

    setSubmitting(true);
    try {
      saveName(name);
      await apiJson('/api/books/applications/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ applicantName: name, items }),
      });
      showToast(`${items.length}권에 마음을 전했어요! 💌`, 'success');
      setSelectedApply(new Set());
      goPage('home');
      await loadBooks();
    } catch (err) {
      showToast(err instanceof Error ? err.message : '전송 실패', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  async function loadOwner() {
    const name = ownerName.trim();
    if (!name) {
      showToast('이름을 입력해 주세요', 'error');
      return;
    }
    saveName(name);
    setOwnerLoading(true);
    setOwnerLoaded(false);
    try {
      const myBooks = await apiJson<Book[]>(`/api/books/by-owner?ownerName=${encodeURIComponent(name)}`);
      const open = myBooks.filter((b) => b.status === 'open');
      setOwnerBooks(open);

      const apps: Record<string, Applicant[]> = {};
      for (const b of open) {
        apps[b.id] = await apiJson<Applicant[]>(`/api/books/${b.id}/applicants`);
      }
      setOwnerApplicants(apps);
      await loadBooks();
      setOwnerLoaded(true);
    } catch (err) {
      showToast(err instanceof Error ? err.message : '불러오기 실패', 'error');
      setOwnerBooks([]);
      setOwnerLoaded(true);
    } finally {
      setOwnerLoading(false);
    }
  }

  async function handleSelectApplicant(bookId: string, applicantId: string, applicantName: string) {
    if (!confirm(`${applicantName}님에게 이 책을 전달할까요?`)) return;
    setSelectingBookId(bookId);
    try {
      await apiJson(`/api/books/${bookId}/select`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          applicantId,
          ownerName: ownerName.trim(),
        }),
      });
      setCelebrate({ owner: ownerName.trim(), applicant: applicantName });
      await loadBooks();
      if (ownerLoaded) await loadOwner();
    } catch (err) {
      showToast(err instanceof Error ? err.message : '선택 실패', 'error');
    } finally {
      setSelectingBookId(null);
    }
  }

  async function handleDeleteBook(bookId: string) {
    const name = deleteOwnerName.trim();
    if (!name) {
      showToast('등록자 이름을 입력해 주세요', 'error');
      return;
    }
    if (!confirm('정말 이 책을 전시장에서 삭제할까요?')) return;
    try {
      await apiJson(`/api/books/${bookId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ownerName: name }),
      });
      setBooks((prev) => {
        const next = prev.filter((b) => b.id !== bookId);
        saveBooksCache(next);
        return next;
      });
      showToast('책이 삭제되었어요', 'success');
      setDetailBook(null);
      setTimeout(() => loadBooks(), 3000);
    } catch (err) {
      showToast(err instanceof Error ? err.message : '삭제 실패', 'error');
    }
  }

  function CoverImg({ src, alt = '' }: { src: string; alt?: string }) {
    if (!src) return null;
    return <img src={src} alt={alt} loading="lazy" />;
  }

  function StatusBanner() {
    if (apiStatus === 'online' && !usingCache) return null;
    if (apiStatus === 'checking') {
      return (
        <div className="status-banner warn">
          <span>⏳ 서버 연결 확인 중...</span>
        </div>
      );
    }
    return (
      <div className={`status-banner${apiStatus === 'offline' ? ' error' : ' warn'}`}>
        <span>
          {usingCache
            ? `📦 저장된 목록 표시 중${cacheLabel ? ` (${cacheLabel})` : ''}. 새로 등록·신청은 연결 후 가능해요.`
            : '⚠️ 서버 연결이 불안정해요. Wi‑Fi를 바꾸거나 잠시 후 다시 시도해 주세요.'}
        </span>
        <button type="button" onClick={refreshConnection}>다시 연결</button>
      </div>
    );
  }

  return (
    <div className="app">
      <StatusBanner />
      {/* 홈 */}
      <div className={`page${page === 'home' ? ' active' : ''}`}>
        <header className="home-hero">
          <div className="home-logo">📚</div>
          <h1 className="home-title">마음 나눔 책장</h1>
          <p className="home-sub">책을 나누고, 마음을 전하는 작은 도서관</p>
          <div className="home-intro">
            읽은 책을 친구들에게 소개하고, 읽고 싶은 이유를 진심을 담아 전하며,
            책과 함께 마음까지 이어지는 책 나눔 플랫폼이에요.
          </div>
        </header>
        <nav className="menu-list">
          {[
            { go: 'register' as Page, icon: 'green', emoji: '📖', title: '나의 책 소개하기', desc: '내가 좋아하는 책을 친구들에게 소개해 보세요' },
            { go: 'gallery' as Page, icon: 'amber', emoji: '📚', title: '책 전시장', desc: '친구들의 책 이야기를 둘러보세요' },
            { go: 'apply' as Page, icon: 'rose', emoji: '❤️', title: '읽고 싶은 마음 전하기', desc: '마음에 드는 책에 당신의 이야기를 들려주세요' },
            { go: 'owner' as Page, icon: 'gold', emoji: '🎁', title: '새로운 주인 찾기', desc: '가장 소중히 읽어 줄 친구를 선택하세요' },
          ].map((m) => (
            <button key={m.go} type="button" className="menu-card" onClick={() => goPage(m.go)}>
              <div className={`menu-icon ${m.icon}`}>{m.emoji}</div>
              <div className="menu-text">
                <h3>{m.title}</h3>
                <p>{m.desc}</p>
              </div>
              <span className="menu-arrow">›</span>
            </button>
          ))}
        </nav>
      </div>

      {/* 등록 */}
      <div className={`page${page === 'register' ? ' active' : ''}`}>
        <div className="sub-header">
          <button type="button" className="back-btn" onClick={() => goPage('home')} aria-label="뒤로">←</button>
          <h2>📖 나의 책 소개하기</h2>
        </div>
        <div className="page-body">
          <p className="section-label">
            내가 좋아하는 책을 친구들에게 소개해 보세요.
            <br />
            책 표지를 직접 촬영하여 등록할 수 있어요.
          </p>
          <form onSubmit={handleRegister}>
            <div className="form-group">
              <label>책 표지 사진</label>
              <div className="cover-upload">
                <input type="file" accept="image/*" capture="environment" onChange={handleCoverChange} />
                {!coverPreview ? (
                  <div className="cover-placeholder">
                    <span>📷</span>
                    <span>탭하여 표지 촬영</span>
                  </div>
                ) : (
                  <img className="cover-preview" src={coverPreview} alt="표지" />
                )}
              </div>
            </div>
            <div className="form-group">
              <label htmlFor="regName">내 이름 (등록자)</label>
              <input
                className="form-input"
                id="regName"
                value={regName}
                onChange={(e) => {
                  setRegName(e.target.value);
                  saveName(e.target.value.trim());
                }}
                placeholder="예: 김서연"
                required
                maxLength={20}
              />
            </div>
            <div className="form-group">
              <label htmlFor="regTitle">책 제목</label>
              <input
                className="form-input"
                id="regTitle"
                value={regTitle}
                onChange={(e) => setRegTitle(e.target.value)}
                placeholder="예: 어린 왕자"
                required
                maxLength={100}
              />
            </div>
            <div className="form-group">
              <label htmlFor="regReason">추천하는 이유</label>
              <textarea
                className="form-textarea"
                id="regReason"
                value={regReason}
                onChange={(e) => setRegReason(e.target.value)}
                placeholder="왜 이 책을 친구들에게 추천하고 싶은지 적어 주세요"
                required
                maxLength={500}
              />
            </div>
            <button type="submit" className="btn btn-primary" disabled={submitting || apiStatus === 'offline'}>
              {submitting ? '등록 중...' : '책 등록하기'}
            </button>
          </form>
        </div>
      </div>

      {/* 전시장 */}
      <div className={`page${page === 'gallery' ? ' active' : ''}`}>
        <div className="sub-header">
          <button type="button" className="back-btn" onClick={() => goPage('home')} aria-label="뒤로">←</button>
          <h2>📚 책 전시장</h2>
        </div>
        <div className="page-body">
          <p className="section-label">
            친구들의 책 이야기를 둘러보세요.
            <br />
            책을 누르면 추천 이유를 볼 수 있어요.
          </p>
          {loading ? (
            <div className="loading-box">
              <div className="spinner" />
              <p>전시장을 준비하고 있어요...</p>
            </div>
          ) : apiStatus === 'offline' && !books.length ? (
            <div className="empty-box">
              <div className="icon">📡</div>
              <h3>서버에 연결할 수 없어요</h3>
              <p>Wi‑Fi를 확인하거나 아래 &quot;다시 연결&quot;을 눌러 주세요.</p>
              <button type="button" className="btn btn-outline" style={{ marginTop: 16 }} onClick={refreshConnection}>
                다시 연결
              </button>
            </div>
          ) : !books.length ? (
            <div className="empty-box">
              <div className="icon">📚</div>
              <h3>아직 전시된 책이 없어요</h3>
              <p>첫 번째 책을 등록해 보세요!</p>
            </div>
          ) : (
            <div className="gallery-grid">
              {books.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  className="exhibit-card"
                  onClick={() => {
                    setDetailBook(b);
                    setDeleteOwnerName(getStoredName());
                  }}
                >
                  <div className="exhibit-cover">
                    {b.coverUrl ? <CoverImg src={b.coverUrl} alt={b.title} /> : <div className="placeholder">📖</div>}
                    <span className={`exhibit-badge${b.status === 'closed' ? ' done' : ''}`}>
                      {b.status === 'open' ? '나눔 중' : '완료'}
                    </span>
                  </div>
                  <div className="exhibit-info">
                    <div className="exhibit-title">{b.title}</div>
                    <div className="exhibit-owner">{b.ownerName}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 마음 전하기 */}
      <div className={`page${page === 'apply' ? ' active' : ''}`}>
        <div className="sub-header">
          <button type="button" className="back-btn" onClick={() => goPage('home')} aria-label="뒤로">←</button>
          <h2>❤️ 읽고 싶은 마음 전하기</h2>
        </div>
        <div className="page-body">
          <div className="name-bar">
            <label htmlFor="applyName">내 이름</label>
            <input
              id="applyName"
              value={applyName}
              onChange={(e) => {
                setApplyName(e.target.value);
                saveName(e.target.value.trim());
              }}
              placeholder="이름을 입력하세요"
              maxLength={20}
            />
          </div>
          <p className="section-label">
            마음에 드는 책을 선택하고, 읽고 싶은 이유를 적어 주세요.
            <br />
            여러 권 선택 가능해요. (권마다 이유 필요)
          </p>
          {loading ? (
            <div className="loading-box">
              <div className="spinner" />
            </div>
          ) : !openBooks.length ? (
            <div className="empty-box">
              <div className="icon">❤️</div>
              <h3>신청할 수 있는 책이 없어요</h3>
              <p>전시장에 나눔 중인 책이 없습니다</p>
            </div>
          ) : (
            <>
              <div className="apply-list">
                {openBooks.map((b) => (
                  <div key={b.id} className={`apply-item${selectedApply.has(b.id) ? ' selected' : ''}`}>
                    <div className="apply-item-head" onClick={() => toggleApply(b.id)}>
                      <div className="apply-check">{selectedApply.has(b.id) ? '✓' : ''}</div>
                      <div className="apply-thumb">
                        {b.coverUrl ? (
                          <CoverImg src={b.coverUrl} />
                        ) : (
                          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem' }}>📖</div>
                        )}
                      </div>
                      <div className="apply-meta">
                        <h4>{b.title}</h4>
                        <p>{b.ownerName}</p>
                      </div>
                    </div>
                    <div className="apply-reason">
                      <textarea
                        value={applyReasons[b.id] || ''}
                        onChange={(e) => setApplyReasons((prev) => ({ ...prev, [b.id]: e.target.value }))}
                        placeholder="예: 저는 동물을 좋아해서 꼭 읽어보고 싶어요."
                        maxLength={500}
                      />
                      <p className="hint">왜 이 책을 읽고 싶은지 진심을 담아 적어 주세요</p>
                    </div>
                  </div>
                ))}
              </div>
              <button
                type="button"
                className="btn btn-rose"
                style={{ marginTop: 20 }}
                disabled={submitting || apiStatus === 'offline'}
                onClick={handleApplySubmit}
              >
                {submitting ? '전송 중...' : '마음 전하기 💌'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* 주인 찾기 */}
      <div className={`page${page === 'owner' ? ' active' : ''}`}>
        <div className="sub-header">
          <button type="button" className="back-btn" onClick={() => goPage('home')} aria-label="뒤로">←</button>
          <h2>🎁 새로운 주인 찾기</h2>
        </div>
        <div className="page-body">
          <div className="name-bar">
            <label htmlFor="ownerName">내 이름</label>
            <input
              id="ownerName"
              value={ownerName}
              onChange={(e) => {
                setOwnerName(e.target.value);
                saveName(e.target.value.trim());
              }}
              placeholder="등록한 이름을 입력하세요"
              maxLength={20}
            />
          </div>
          <p className="section-label">
            내가 등록한 책에 신청한 친구들의 글을 읽고,
            <br />
            마음이 가장 전달된 친구를 선택하세요.
          </p>
          <button
            type="button"
            className="btn btn-outline"
            style={{ marginBottom: 20 }}
            disabled={ownerLoading || apiStatus === 'offline'}
            onClick={loadOwner}
          >
            내 책 불러오기
          </button>
          {ownerLoading ? (
            <div className="loading-box">
              <div className="spinner" />
            </div>
          ) : ownerLoaded && ownerBooks.length === 0 ? (
            <div className="empty-box">
              <div className="icon">📖</div>
              <h3>나눔 중인 내 책이 없어요</h3>
              <p>책을 등록하거나, 이미 전달을 완료했을 수 있어요</p>
            </div>
          ) : (
            ownerBooks.map((b) => {
              const applicants = ownerApplicants[b.id] || [];
              return (
                <div key={b.id} className="owner-book">
                  <div className="owner-book-head">
                    <div className="owner-cover">
                      {b.coverUrl ? (
                        <CoverImg src={b.coverUrl} />
                      ) : (
                        <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem' }}>📖</div>
                      )}
                    </div>
                    <div>
                      <h3>{b.title}</h3>
                      <p>신청 {applicants.length}명</p>
                    </div>
                  </div>
                  {applicants.length ? (
                    applicants.map((a) => (
                      <div key={a.id} className="applicant-card">
                        <div className="applicant-name">{a.applicantName}</div>
                        <div className="applicant-reason">&quot;{a.reason}&quot;</div>
                        <button
                          type="button"
                          className="btn btn-primary"
                          disabled={selectingBookId === b.id || apiStatus === 'offline'}
                          onClick={() => handleSelectApplicant(b.id, a.id, a.applicantName)}
                        >
                          {selectingBookId === b.id ? '전달 중...' : '이 친구에게 전달 🎁'}
                        </button>
                      </div>
                    ))
                  ) : (
                    <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', textAlign: 'center', padding: 12 }}>
                      아직 신청한 친구가 없어요
                    </p>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* 상세 시트 */}
      <div className={`overlay${detailBook ? ' open' : ''}`} onClick={() => setDetailBook(null)} />
      <div className={`sheet${detailBook ? ' open' : ''}`}>
        <div className="sheet-handle" />
        <div className="sheet-header">
          <h3>책 이야기</h3>
          <button type="button" className="sheet-close" onClick={() => setDetailBook(null)}>✕</button>
        </div>
        {detailBook && (
          <div className="sheet-body">
            <div className="detail-cover">
              {detailBook.coverUrl ? <CoverImg src={detailBook.coverUrl} /> : <div className="ph">📖</div>}
            </div>
            <h2 className="detail-title">{detailBook.title}</h2>
            <p className="detail-owner">등록자 · {detailBook.ownerName}</p>
            <div className="reason-box">
              <h4>추천하는 이유</h4>
              <p>{detailBook.recommendation || '등록자가 추천 이유를 적지 않았어요.'}</p>
            </div>
            {detailBook.status === 'closed' && detailBook.selectedApplicant && (
              <div className="reason-box" style={{ background: 'var(--amber-soft)' }}>
                <h4 style={{ color: 'var(--amber)' }}>🎁 전달 완료</h4>
                <p>{detailBook.selectedApplicant}님께 전달되었어요</p>
              </div>
            )}
            {detailBook.status === 'open' && (
              <div className="delete-box">
                <h4>잘못 올리셨나요?</h4>
                <p className="delete-hint">등록할 때 입력한 이름과 같아야 삭제할 수 있어요.</p>
                <input
                  className="form-input"
                  type="text"
                  value={deleteOwnerName}
                  onChange={(e) => setDeleteOwnerName(e.target.value)}
                  placeholder="등록자 이름"
                  maxLength={20}
                />
                <button
                  type="button"
                  className="btn btn-delete"
                  disabled={apiStatus === 'offline'}
                  onClick={() => handleDeleteBook(detailBook.id)}
                >
                  🗑️ 이 책 삭제하기
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 축하 */}
      <div className={`celebrate${celebrate ? ' open' : ''}`}>
        <div className="celebrate-icon">🎉</div>
        {celebrate && (
          <h2>
            <span style={{ color: 'var(--amber)' }}>{celebrate.owner}</span>님의 책은
            <br />
            <span style={{ color: 'var(--forest)' }}>{celebrate.applicant}</span>님에게 전달됩니다.
          </h2>
        )}
        <p>따뜻한 나눔이 완성되었어요!</p>
        <button
          type="button"
          className="btn btn-primary"
          style={{ maxWidth: 240 }}
          onClick={() => {
            setCelebrate(null);
            goPage('home');
          }}
        >
          홈으로 돌아가기
        </button>
      </div>

      {/* 토스트 */}
      <div className={`toast${toast ? ' show' : ''}${toast?.type ? ` ${toast.type}` : ''}`}>
        {toast?.msg}
      </div>
    </div>
  );
}
