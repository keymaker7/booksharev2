# 📚 마음 나눔 책장 v2 (풀스택)

Next.js + SQLite 기반 책 나눔 웹앱입니다. Google Sheets / Apps Script 없이 동작합니다.

## 기능

- **나의 책 소개하기** — 표지 사진 업로드 + 책 등록
- **책 전시장** — 등록된 책 그리드 보기
- **읽고 싶은 마음 전하기** — 여러 권 선택 + 권마다 이유 작성
- **새로운 주인 찾기** — 신청자 중 한 명 선택

## 기술 스택

| 구분 | 기술 |
|------|------|
| 프론트 | Next.js 15, React 19 |
| API | Next.js Route Handlers |
| DB | JSON 파일 (`data/store.json`) |
| 표지 | `public/uploads/covers/` 파일 저장 |

## 로컬 실행

```bash
npm install
npm run dev
```

브라우저에서 http://localhost:3000 접속

## 배포 URL

**프로덕션:** https://booksharev2.vercel.app

GitHub push 시 Vercel이 자동 배포합니다. (구 GitHub Pages URL은 Vercel로 리다이렉트)

## 배포 (Vercel / Railway 등)

SQLite 파일은 **서버리스(Vercel)에 그대로 쓰기 어렵습니다.** JSON DB + 업로드 폴더도 **쓰기 가능한 디스크**가 필요합니다. 아래 중 하나를 선택하세요.

1. **Railway / Render / VPS** — `npm run build && npm start` (SQLite + 업로드 폴더 유지)
2. **Vercel** — DB를 [Turso](https://turso.tech/) 또는 Supabase Postgres로 교체 필요

### Railway 예시

1. GitHub repo 연결
2. Start command: `npm start`
3. Volume 마운트: `/app/data`, `/app/public/uploads` (데이터 유지)

## API

| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/ping` | 헬스체크 |
| GET | `/api/books` | 전체 책 목록 |
| POST | `/api/books` | 책 등록 (multipart) |
| DELETE | `/api/books/:id` | 책 삭제 |
| GET | `/api/books/by-owner?ownerName=` | 내 책 목록 |
| GET | `/api/books/:id/applicants` | 신청 목록 |
| POST | `/api/books/:id/applicants` | 신청 추가 |
| POST | `/api/books/:id/select` | 수령자 선택 |

## 이전 버전

Google Apps Script 버전은 `legacy/` 폴더에 보관되어 있습니다.
