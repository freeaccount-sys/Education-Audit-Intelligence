# Google Sheets -> CSV 자동 저장

이 스크립트는 Google Sheets를 원본으로 두고, 주기적으로 CSV 파일을 Google Drive에 다시 저장합니다.

## 동작 방식

- 시트 데이터를 읽습니다.
- `연도, 학교명, 구분` 헤더 행부터 아래 데이터를 CSV로 변환합니다.
- 기존 `keyword-audit-source.csv` 파일을 삭제하고 새 파일로 다시 만듭니다.
- 시간 기반 트리거로 자동 반복 실행할 수 있습니다.

## 설정할 값

`scripts/google-sheets-csv-export.gs`의 `CONFIG`를 채우세요.

- `SPREADSHEET_ID`: 원본 Google Sheets ID
- `SHEET_NAME`: 사용할 시트 이름
- `OUTPUT_FOLDER_ID`: CSV를 저장할 Drive 폴더 ID
- `OUTPUT_FILE_NAME`: 저장될 CSV 파일명
- `TRIGGER_EVERY_HOURS`: 자동 저장 주기

## 처음 한 번 할 일

1. Apps Script 편집기에 코드를 붙여넣습니다.
2. `CONFIG` 값을 채웁니다.
3. `setupKeywordCsvAutomation()`를 한 번 실행합니다.
4. 권한을 승인합니다.

## 수동 실행

- `exportKeywordCsvToDrive()`를 실행하면 CSV를 즉시 다시 만듭니다.

## 자동화 해제

- `removeKeywordCsvAutomation()`를 실행하면 등록된 자동 트리거를 삭제합니다.
