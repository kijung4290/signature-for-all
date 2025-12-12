/*************************************************
 * 공통 스프레드시트/드라이브 설정
 ************************************************/
const COMMON_SPREADSHEET_ID = '1up_4Cid4h6Ar6EXiCtunkWgpAdzqYfbMHUElviCvZME';
const COMMON_FOLDER_ID      = '1Ujo0UfX95z-Va7rW689l9WwoKDcj2ytu';

/** 관리자 접근 비밀번호 설정 (여기서 변경하세요) */
const ADMIN_PASSWORD = '1234';

/** 드롭다운 값 ↔ 실제 시트 탭 이름 */
const FORM_SHEETS = {
  '운영위원회': '운영위원회',
  '후원물품': '후원물품',
  '서명부3': '서명부3',
};

/** '이름' 헤더 텍스트 */
const NAME_HEADER = '이름';

/** 웹앱 진입 */
function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('서명부 웹앱')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/** * 관리자 비밀번호 검증 
 * 클라이언트에서 호출하여 비밀번호 일치 여부 반환
 */
function verifyAdminPassword(inputPassword) {
  if (!inputPassword) return false;
  // 문자열로 변환하여 비교
  return String(inputPassword).trim() === String(ADMIN_PASSWORD);
}

/* ==============================================
 * 기존 기능 (목록 조회, 서명 저장 등)
 * ============================================== */

function getFormList() {
  return Object.keys(FORM_SHEETS);
}

function getHeaders(formKey) {
  const sh = _getSheet_(formKey);
  const lastCol = sh.getLastColumn();
  if (lastCol === 0) return [];
  return sh.getRange(1, 1, 1, lastCol).getValues()[0]
    .map(v => (typeof v === 'string' ? v.trim() : String(v).trim()));
}

function getNameList(formKey) {
  const sh = _getSheet_(formKey);
  const headers = getHeaders(formKey);
  const nameColIdx = headers.findIndex(h => h === NAME_HEADER);
  if (nameColIdx === -1) throw new Error(`시트에 '${NAME_HEADER}' 헤더가 없습니다.`);

  const lastRow = sh.getLastRow();
  if (lastRow < 2) return [];

  const values = sh.getRange(2, nameColIdx + 1, lastRow - 1, 1).getValues()
    .map(r => (r[0] != null ? String(r[0]).trim() : ''))
    .filter(v => v.length > 0);

  return Array.from(new Set(values));
}

function addName(formKey, rowData) {
  if (!formKey) throw new Error('formKey 누락');
  const headers = getHeaders(formKey);
  const nameColIdx = headers.findIndex(h => h === NAME_HEADER);
  if (nameColIdx === -1) throw new Error(`시트에 '${NAME_HEADER}' 헤더가 없습니다.`);

  const name = (rowData[NAME_HEADER] != null ? String(rowData[NAME_HEADER]).trim() : '');
  if (!name) throw new Error(`'${NAME_HEADER}' 항목은 필수입니다.`);

  const sh = _getSheet_(formKey);
  const existingRow = _findRowByName_(sh, nameColIdx + 1, name);
  if (existingRow !== -1) return { ok: true, row: existingRow, name };

  const nextRow = Math.max(sh.getLastRow() + 1, 2);
  const values = headers.map(h => {
    if (h === '서명') return '';
    return (rowData[h] != null ? String(rowData[h]).trim() : '');
  });

  sh.getRange(nextRow, 1, 1, values.length).setValues([values]);
  return { ok: true, row: nextRow, name };
}

function saveSignatureToRow(payload) {
  const { formKey, targetName, dataUrl } = payload;
  const sh = _getSheet_(formKey);
  const headers = getHeaders(formKey);
  const nameColIdx = headers.findIndex(h => h === NAME_HEADER);
  
  const rowIndex = _findRowByName_(sh, nameColIdx + 1, targetName);
  if (rowIndex === -1) throw new Error(`'${targetName}' 행을 찾을 수 없습니다.`);

  let lastCol = sh.getLastColumn();
  let headerAtLastCol = sh.getRange(1, lastCol).getValue();
  headerAtLastCol = String(headerAtLastCol).trim();
  
  if (headerAtLastCol !== '서명') {
    if (headerAtLastCol === '') {
      sh.getRange(1, lastCol).setValue('서명');
    } else {
      lastCol += 1;
      sh.getRange(1, lastCol).setValue('서명');
    }
  }
  const sigCol = lastCol;

  const fileId = _saveDataUrlToDriveAndReturnId_(dataUrl, `${FORM_SHEETS[formKey]}_${targetName}_sign_${_ts('yyyyMMdd_HHmmss')}.png`);
  
  // 공식 입력
  const formula = `=IMAGE("https://drive.google.com/uc?export=view&id=${fileId}")`;
  sh.getRange(rowIndex, sigCol).setFormula(formula);

  return { ok: true, row: rowIndex, col: sigCol, name: targetName };
}

function getTargetData(formKey, targetName) {
  if (!formKey || !targetName) return { ok: false, message: '파라미터 누락' };
  const sh = _getSheet_(formKey);
  const headers = getHeaders(formKey);
  const nameColIdx = headers.findIndex(h => h === NAME_HEADER);
  if (nameColIdx === -1) return { ok: false, message: '이름 헤더 없음' };

  const rowIndex = _findRowByName_(sh, nameColIdx + 1, targetName);
  if (rowIndex === -1) return { ok: false, message: '대상자 없음' };

  const lastCol = sh.getLastColumn();
  const rowValues = sh.getRange(rowIndex, 1, 1, lastCol).getValues()[0];

  const data = {};
  headers.forEach((h, i) => {
    let val = rowValues[i];
    if (val instanceof Date) val = Utilities.formatDate(val, 'Asia/Seoul', 'yyyy-MM-dd');
    data[h] = String(val != null ? val : '');
  });
  return { ok: true, data: data };
}


/* ==============================================
 * [수정됨] 관리자 PDF 생성 기능
 * ============================================== */

function createPdfFromSheet(formKey) {
  if (!formKey) throw new Error('서명부를 선택해주세요.');
  
  const sheetName = FORM_SHEETS[formKey];
  const sh = _getSheet_(formKey);
  
  const lastRow = sh.getLastRow();
  const lastCol = sh.getLastColumn();
  if (lastRow < 2) throw new Error('데이터가 없습니다.');

  // 헤더, 데이터(Values), 공식(Formulas) 모두 가져오기
  const headers = sh.getRange(1, 1, 1, lastCol).getValues()[0];
  const dataRange = sh.getRange(2, 1, lastRow - 1, lastCol);
  const dataValues = dataRange.getValues();
  const dataFormulas = dataRange.getFormulas(); // ★ 중요: IMAGE 수식을 읽기 위함

  let html = `
    <html>
    <head>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;700&display=swap');
        body { font-family: 'Noto Sans KR', sans-serif; padding: 40px; }
        h1 { text-align: center; margin-bottom: 10px; font-size: 24px; text-decoration: underline; }
        .date { text-align: right; margin-bottom: 20px; font-size: 12px; color: #555; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px; }
        th, td { border: 1px solid #000; padding: 6px; text-align: center; vertical-align: middle; }
        th { background-color: #f3f3f3; font-weight: bold; height: 30px; }
        td { height: 40px; }
        .signature-img { max-height: 36px; max-width: 80px; }
      </style>
    </head>
    <body>
      <h1>${sheetName} 서명부</h1>
      <div class="date">출력일자: ${_ts('yyyy-MM-dd HH:mm')}</div>
      <table>
        <thead>
          <tr>
            <th style="width: 40px;">No.</th>
  `;

  headers.forEach(h => {
    html += `<th>${h}</th>`;
  });
  html += `</tr></thead><tbody>`;

  dataValues.forEach((row, rowIdx) => {
    html += `<tr><td>${rowIdx + 1}</td>`;
    
    row.forEach((cellValue, colIdx) => {
      const headerName = headers[colIdx];
      const cellFormula = dataFormulas[rowIdx][colIdx]; // 해당 셀의 공식
      let cellContent = '';

      // 1. 서명 컬럼이고
      // 2. 공식이 존재하며 문자열이고
      // 3. =IMAGE로 시작하는 경우
      if (headerName === '서명' && typeof cellFormula === 'string' && cellFormula.startsWith('=IMAGE')) {
        try {
          // =IMAGE("...id=FILE_ID...") 형태에서 ID 추출
          const fileIdMatch = cellFormula.match(/id=([a-zA-Z0-9_-]+)/);
          if (fileIdMatch && fileIdMatch[1]) {
            const fileId = fileIdMatch[1];
            const imgBlob = DriveApp.getFileById(fileId).getBlob();
            const base64 = Utilities.base64Encode(imgBlob.getBytes());
            const mime = imgBlob.getContentType();
            cellContent = `<img src="data:${mime};base64,${base64}" class="signature-img" />`;
          } else {
            cellContent = '(이미지 링크 오류)';
          }
        } catch (e) {
          // 권한 없음, 파일 삭제됨 등
          cellContent = '(이미지 없음)';
        }
      } else {
        // 일반 데이터
        if (cellValue instanceof Date) {
          cellContent = Utilities.formatDate(cellValue, 'Asia/Seoul', 'yyyy-MM-dd');
        } else {
          cellContent = cellValue ? String(cellValue) : '';
        }
      }

      html += `<td>${cellContent}</td>`;
    });
    html += `</tr>`;
  });

  html += `</tbody></table></body></html>`;

  const blob = Utilities.newBlob(html, MimeType.HTML).getAs(MimeType.PDF);
  blob.setName(`${sheetName}_서명부_${_ts('yyyyMMdd')}.pdf`);

  const folder = DriveApp.getFolderById(COMMON_FOLDER_ID);
  const pdfFile = folder.createFile(blob);
  
  return { ok: true, url: pdfFile.getDownloadUrl(), name: pdfFile.getName() };
}

/* ==============================================
 * 내부 유틸
 * ============================================== */

function _getSheet_(formKey) {
  const sheetName = FORM_SHEETS[formKey];
  if (!sheetName) throw new Error('정의되지 않은 양식: ' + formKey);
  const ss = SpreadsheetApp.openById(COMMON_SPREADSHEET_ID);
  const sh = ss.getSheetByName(sheetName);
  if (!sh) throw new Error('시트를 찾을 수 없습니다: ' + sheetName);
  return sh;
}

function _findRowByName_(sheet, nameCol, targetName) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return -1;
  const range = sheet.getRange(2, nameCol, lastRow - 1, 1).getValues();
  for (let i = 0; i < range.length; i++) {
    const cell = (range[i][0] != null ? String(range[i][0]).trim() : '');
    if (cell === targetName) return i + 2;
  }
  return -1;
}

function _saveDataUrlToDriveAndReturnId_(dataUrl, fileName) {
  const folder = DriveApp.getFolderById(COMMON_FOLDER_ID);
  const base64 = dataUrl.split(',')[1];
  const blob = Utilities.newBlob(Utilities.base64Decode(base64), 'image/png', fileName);
  const file = folder.createFile(blob);
  return file.getId();
}

function _ts(fmt) {
  return Utilities.formatDate(new Date(), 'Asia/Seoul', fmt);
}