// =====================================================
// 📚 마음 나눔 책장 — Google Apps Script 백엔드
// =====================================================
// 설치 순서:
//   1. 새 Google Spreadsheet 생성 → URL에서 SPREADSHEET_ID 복사
//   2. 새 Google Drive 폴더 생성 → URL에서 FOLDER_ID 복사
//   3. 위 두 값을 아래에 붙여넣기
//   4. initSheets() 함수 1회 실행 (메뉴 → 실행)
//   5. 배포 → 새 배포 → 유형: 웹 앱
//      - 액세스 권한: 모든 사용자 (익명 포함)
//      - 실행 계정: 내 계정
//   6. 배포 URL을 index.html의 API_URL에 붙여넣기
// =====================================================

const SPREADSHEET_ID = '1uUfTktVOgf-zufur_TxYVgNtboAHDHj5n5K14RBjcX0';
const FOLDER_ID      = '1P4xOa14yDoCYhdYUhDRafOGwliVcs1jg';

// ── 라우터 ──────────────────────────────────────────

function doGet(e) {
  try {
    const action = e.parameter.action || '';
    switch (action) {
      case 'ping':
        return res({ ok: true, message: '마음 나눔 책장 API 연결됨' });
      case 'getBooks':
        return res(getBooks());
      case 'getApplicants':
        return res(getApplicants(e.parameter.bookId));
      case 'getBooksByOwner':
        return res(getBooksByOwner(e.parameter.ownerName));
      default:
        return res({
          error: 'action 파라미터가 필요합니다',
          hint: '테스트: ?action=ping 또는 ?action=getBooks',
          available: ['ping', 'getBooks', 'getApplicants', 'getBooksByOwner']
        });
    }
  } catch (err) {
    return res({ error: err.message });
  }
}

function doPost(e) {
  try {
    const d = JSON.parse(e.postData.contents);
    switch (d.action) {
      case 'addBook':         return res(addBook(d));
      case 'addApplicant':    return res(addApplicant(d));
      case 'selectApplicant': return res(selectApplicant(d));
      case 'deleteBook':      return res(deleteBook(d));
      default:                return res({ error: 'unknown action' });
    }
  } catch (err) {
    return res({ error: err.message });
  }
}

function res(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── 조회 ────────────────────────────────────────────

function getBooks() {
  return sheetToObjects('books');
}

function getBooksByOwner(ownerName) {
  if (!ownerName) return [];
  return sheetToObjects('books').filter(r => r.ownerName === ownerName);
}

function getApplicants(bookId) {
  if (!bookId) return [];
  return sheetToObjects('applicants').filter(r => r.bookId === bookId);
}

// ── 쓰기 ────────────────────────────────────────────

function addBook(d) {
  let coverUrl = '';
  let coverWarning = '';

  if (d.coverBase64) {
    const saved = saveCoverImage(d.coverBase64);
    coverUrl = saved.url;
    coverWarning = saved.warning;
  }

  const id = Utilities.getUuid();
  sheet('books').appendRow([
    id,
    d.ownerName,
    d.title,
    coverUrl,
    d.recommendation || '',
    'open',
    ''
  ]);
  return { success: true, id, coverWarning: coverWarning || undefined };
}

function addApplicant(d) {
  const id = Utilities.getUuid();
  sheet('applicants').appendRow([
    id,
    d.bookId,
    d.applicantName,
    d.reason,
    new Date().toISOString()
  ]);
  return { success: true, id };
}

function selectApplicant(d) {
  const s    = sheet('books');
  const rows = s.getDataRange().getValues();
  const h    = rows[0];
  const idCol  = h.indexOf('id');
  const stCol  = h.indexOf('status');
  const selCol = h.indexOf('selectedApplicant');

  for (let i = 1; i < rows.length; i++) {
    if (rows[i][idCol] !== d.bookId) continue;
    s.getRange(i + 1, stCol  + 1).setValue('closed');
    s.getRange(i + 1, selCol + 1).setValue(d.applicantName);
    return { success: true };
  }
  return { error: '책 ID를 찾을 수 없어요' };
}

function deleteBook(d) {
  if (!d.bookId || !d.ownerName) {
    return { error: '책 ID와 등록자 이름이 필요해요' };
  }

  const books = sheetToObjects('books');
  const book = books.find(b => b.id === d.bookId);
  if (!book) return { error: '책을 찾을 수 없어요' };
  if (book.ownerName !== String(d.ownerName).trim()) {
    return { error: '등록할 때 입력한 이름과 같아야 삭제할 수 있어요' };
  }

  deleteRowsByField('applicants', 'bookId', d.bookId);
  deleteRowsByField('books', 'id', d.bookId);
  trashCoverFile(book.coverUrl);

  return { success: true };
}

// ── 표지 저장 (시트 우선 — DriveApp 불필요) ────────────

const MAX_COVER_URL_LEN = 50000;

/** 표지를 Google Sheets 셀에 저장 (Drive 권한 없이 동작) */
function saveCoverImage(base64) {
  const dataUrl = toDataUrl(base64);
  if (!dataUrl) return { url: '', warning: '' };

  if (dataUrl.length <= MAX_COVER_URL_LEN) {
    return { url: dataUrl, warning: '' };
  }

  return {
    url: '',
    warning: '표지 사진이 너무 커요. 자동으로 줄였는데도 큽니다. 다시 촬영해 주세요.'
  };
}

function toDataUrl(base64) {
  if (!base64) return '';
  const s = String(base64).trim();
  if (s.indexOf('data:') === 0) return s;
  const clean = s.replace(/^data:[^;]+;base64,/, '');
  return 'data:image/jpeg;base64,' + clean;
}

/** Drive 업로드 (선택 — 현재 미사용, DriveApp 권한 문제 회피) */
function uploadImageToDrive(base64) {
  const clean = base64.replace(/^data:[^;]+;base64,/, '');
  const bytes = Utilities.base64Decode(clean);
  const blob = Utilities.newBlob(bytes, 'image/jpeg', 'cover_' + Date.now() + '.jpg');
  let file;
  try {
    file = DriveApp.createFile(blob);
  } catch (err) {
    throw new Error('DriveApp: ' + err.message);
  }
  try {
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch (_) {}
  return 'https://drive.google.com/thumbnail?id=' + file.getId() + '&sz=w800';
}

function trashCoverFile(coverUrl) {
  if (!coverUrl || String(coverUrl).indexOf('data:') === 0) return;
  const match = String(coverUrl).match(/[?&]id=([^&]+)/);
  if (!match) return;
  try {
    DriveApp.getFileById(match[1]).setTrashed(true);
  } catch (_) {}
}

function deleteRowsByField(sheetName, field, value) {
  const s = sheet(sheetName);
  const rows = s.getDataRange().getValues();
  if (rows.length <= 1) return;
  const col = rows[0].indexOf(field);
  if (col < 0) return;
  for (let i = rows.length - 1; i >= 1; i--) {
    if (rows[i][col] === value) s.deleteRow(i + 1);
  }
}

// ── 유틸 ────────────────────────────────────────────

function sheet(name) {
  return SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(name);
}

function sheetToObjects(name) {
  const rows = sheet(name).getDataRange().getValues();
  if (rows.length <= 1) return [];
  const h = rows[0];
  return rows.slice(1).map(r => Object.fromEntries(h.map((k, i) => [k, r[i]])));
}

// ── 최초 1회 실행 (시트 헤더 생성) ─────────────────

function initSheets() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  if (!ss.getSheetByName('books')) {
    ss.insertSheet('books').appendRow(
      ['id', 'ownerName', 'title', 'coverUrl', 'recommendation', 'status', 'selectedApplicant']
    );
  }
  if (!ss.getSheetByName('applicants')) {
    ss.insertSheet('applicants').appendRow(
      ['id', 'bookId', 'applicantName', 'reason', 'appliedAt']
    );
  }
  Logger.log('✅ 마음 나눔 책장 시트 초기화 완료');
}
