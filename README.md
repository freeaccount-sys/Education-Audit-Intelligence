# 교육부 감사결과 대시보드

교육부 감사결과를 검색하고 요약해서 볼 수 있는 웹 대시보드입니다.

## 주요 기능

- 통합 검색과 키워드 검색
- 감사구분, 연도, 기관명 필터
- 감사결과 요약 카드와 상세 목록
- PDF 원문 링크 확인
- OCR 기반 PDF 분석

## 로컬 실행

```powershell
Copy-Item .env.example .env
npm install
npm start
```

브라우저에서 `http://127.0.0.1:3000/`을 열면 됩니다.

## 배포

Render Blueprint 배포를 지원합니다. `render.yaml`을 그대로 사용하면 됩니다.

### 키워드 검색 CSV

배포용 권장 방식은 Google Drive 공유 링크를 `KEYWORD_CSV_URL`에 넣는 것입니다.

- `KEYWORD_CSV_URL`: Google Drive 공유 링크 또는 Google Sheets CSV export URL
- `KEYWORD_CSV_FILE_ID`: 공유 링크 대신 파일 ID만 사용할 때

서버는 Google Drive 공유 링크를 직접 다운로드 URL로 변환해서 읽습니다.

## 환경 변수

- `PORT`: 서버 포트, 기본값 `3000`
- `HOST`: 바인딩 주소, 기본값 `0.0.0.0`
- `UPSTAGE_API_KEY`: Upstage OCR 사용 시 필요
- `GOOGLE_AI_API_KEY`: Gemini OCR 사용 시 필요
- `AUDIT_PDF_DIR`: 감사 PDF가 있는 폴더 경로
- `KEYWORD_CSV_URL`: 키워드 검색 CSV의 Google Drive 공유 링크
- `KEYWORD_CSV_FILE_ID`: 대안으로 사용할 Drive 파일 ID
- `KEYWORD_CSV_LOCAL_PATH`: 로컬 개발용 CSV 경로

## 배포 후 확인

1. `/healthz`가 `200`을 반환하는지 확인합니다.
2. `/api/keyword-audit-source.csv`에서 CSV가 내려오는지 확인합니다.
3. 키워드 검색에서 제목 키워드로 결과가 잘 나오는지 확인합니다.

## 데이터 흐름

1. Google Sheets가 원본입니다.
2. Apps Script가 `keyword-audit-source.csv`를 Google Drive에 내보냅니다.
3. Render는 `KEYWORD_CSV_URL` 또는 `KEYWORD_CSV_FILE_ID`로 Drive 파일을 읽습니다.
4. 대시보드는 `/api/keyword-audit-source.csv`를 통해 CSV를 가져옵니다.

## 참고

- 이 저장소는 감사 결과 JSON과 PDF 링크 데이터를 함께 사용합니다.
- 키워드 검색 원본을 바꾸면 배포 후 바로 검색 결과에 반영됩니다.
