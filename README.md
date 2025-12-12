# 서명부 웹앱 (SmartWorker Signature App)

Google Apps Script와 단일 페이지 HTML 프런트엔드로 구현된 전자 서명부입니다. 복지관/기관 현장에서 참가자 선택 → 정보 확인 → 실시간 서명을 한 번에 처리하고, 관리자 모드에서 비밀번호 검증 후 PDF로 내보낼 수 있습니다.

## 주요 특징

- **스프레드시트 기반 폼 선택**: 여러 서명부 시트를 키 기반으로 노출하고 선택합니다. (`03_서명부 웹앱/Code.gs:24` `getFormList()`)
- **한글 초성 검색 리스트**: 모바일 친화형 커스텀 목록과 초성 검색으로 참가자를 빠르게 찾습니다. (`03_서명부 웹앱/Index.html:420`, `03_서명부 웹앱/Index.html:528`)
- **현장 신규 등록**: 입력 필드를 동적으로 생성하고, 시트에 바로 행을 추가합니다. (`03_서명부 웹앱/Index.html:454`, `03_서명부 웹앱/Code.gs:69`)
- **서명 패드 & 드라이브 연동**: Canvas 서명은 PNG로 변환돼 지정 폴더에 저장되고, 시트에는 `=IMAGE()`가 삽입됩니다. (`03_서명부 웹앱/Index.html:674`, `03_서명부 웹앱/Code.gs:92`)
- **참가자 정보 카드**: 선택된 행의 모든 컬럼을 UI 카드로 표시해 서명 전 정보를 검증합니다. (`03_서명부 웹앱/Index.html:389`, `03_서명부 웹앱/Code.gs:124`)
- **관리자 모드 & PDF 내보내기**: 비밀번호 검증 후 PDF를 생성해 드라이브에 저장하고 다운로드 링크를 제공합니다. (`03_서명부 웹앱/Code.gs:31`, `03_서명부 웹앱/Code.gs:151`, `03_서명부 웹앱/Index.html:604`)

## 기술 스택

- Google Apps Script (HtmlService, SpreadsheetApp, DriveApp, Utilities)
- Google Sheets + Google Drive
- HTML/CSS/Vanilla JS (Pretendard, Noto Sans KR)

## 폴더 구조


test 1234
