# 사학기관 감사결과 대시보드

이 도구는 `사립대학`과 `학교법인`에 대한 교육부 감사결과만 다룹니다.

브라우저에서 바로 열 수 있는 정적 웹 대시보드입니다.

## 서버 포함 배포

이 프로젝트는 `Node 서버 + 정적 프런트엔드` 방식으로 배포하는 구성이 가장 잘 맞습니다.

### 운영 방식

- 프런트엔드는 `server.js`가 정적 파일로 서빙합니다.
- 감사결과 데이터는 `/api/audit-results`와 `/api/audits`로 제공합니다.
- PDF 원문 다운로드는 서버가 지정된 PDF 폴더에서 파일을 찾아 응답합니다.
- Upstage OCR 또는 Gemini를 쓸 때만 해당 API 키가 필요합니다.

### 준비 파일

- `index.html`, `app.js`, `styles.css`
- `audit-index.json`
- `ocr-results.json` 또는 배포에 사용할 감사결과 JSON
- `audit-pdf-links.json`
- `assets/kasedu-ci-horizontal.jpg`
- `.env`

### 환경변수

- `PORT`: 서버 포트, 기본값은 `3000`
- `HOST`: 바인딩 주소, 기본값은 `0.0.0.0`
- `UPSTAGE_API_KEY`: Upstage OCR을 사용할 때 필요
- `GOOGLE_AI_API_KEY`: Gemini OCR을 사용할 때 필요
- `AUDIT_PDF_DIR`: 감사결과 PDF가 들어 있는 폴더 경로, 여러 개면 `;` 또는 `,`로 구분 가능

### 실행

```powershell
Copy-Item .env.example .env
npm install
npm start
```

이후 브라우저에서 `http://127.0.0.1:3000/`으로 접속하면 됩니다.
필요하면 `npm run open`으로 브라우저를 바로 열 수 있습니다.

### Docker 배포

```powershell
docker build -t moe-audit-dashboard .
docker run --rm -p 3000:3000 --env-file .env moe-audit-dashboard
```

컨테이너 실행 후 `http://127.0.0.1:3000/`으로 접속하면 됩니다.

### Render 배포

이 저장소에는 [render.yaml](render.yaml)이 들어 있어서 Render에서 Blueprint로 바로 배포할 수 있습니다.

1. Render에서 `New +` 또는 Blueprint 배포를 선택합니다.
2. 이 Git 저장소를 연결합니다.
3. 웹 서비스가 생성되면 Render가 자동으로 `https://<서비스명>.onrender.com` 형태 주소를 줍니다.
4. 배포 후 `https://<서비스명>.onrender.com/healthz`가 200을 반환하는지 확인합니다.

PDF는 Google Drive 링크를 계속 써도 되고, 필요하면 `audit-pdf-links.json`만 갱신하면 됩니다.

### 배포 팁

- 서버에 PDF 원문 폴더를 같이 올려 두는 것이 가장 안정적입니다.
- `audit-pdf-links.json`으로 외부 링크를 함께 관리하면 원문 다운로드가 더 정확해집니다.
- 운영 환경에서는 `.env`를 별도로 관리하고 저장소에는 넣지 않는 편이 좋습니다.

### 업데이트 기준

기준일자: `2026-05-07`로 고정

이 대시보드는 새 감사결과를 자동 수집하지 않으므로, 새 자료가 공개되면 아래 순서로 수동 갱신하면 됩니다.

1. 교육부 홈페이지 또는 원문 출처에서 새 감사 PDF를 확보합니다.
2. PDF를 Google Drive에 업로드하고 공유 링크를 만듭니다.
3. 새 링크를 `audit-pdf-links.json`에 추가하거나 기존 항목을 수정합니다.
4. 필요하면 `audit-index.json`과 `ocr-results.json`도 새 자료 기준으로 다시 만듭니다.
5. 요약 문구나 표기 기준이 바뀌면 `README.md`와 화면 문구도 함께 고칩니다.
6. 변경 내용을 GitHub에 푸시하면 Render가 자동으로 다시 배포합니다.

갱신할 때 특히 확인할 항목은 다음과 같습니다.

- 기관명
- 감사구분
- 감사연도
- 감사기준일자
- Google Drive PDF 링크
- OCR 결과와 요약 문구

## 기능

- 사립대학과 학교법인 감사결과 목록 보기
- 학교명 검색, 키워드 검색, 감사구분, 중대도, 연도 필터링
- 선택 기관의 자동 요약 표시
- JSON 파일 업로드로 데이터 교체
- 현재 필터 결과 JSON 내보내기
- 로컬 OCR 작업공간에서 PDF 대기열 관리
- OCR 텍스트를 구조화해서 감사결과 카드로 변환
- 브라우저에서 PDF 폴더를 골라 일괄 OCR 가능

## 실행

이 대시보드는 `index.html`을 파일로 직접 여는 것보다 로컬 서버로 여는 편이 안정적입니다.
특히 `fetch`로 데이터를 읽기 때문에 `file://`로 열면 경로 오류가 날 수 있습니다.

로컬 서버를 쓰려면 아래처럼 실행하세요.

```powershell
Copy-Item .env.example .env
# .env 파일에 UPSTAGE_API_KEY=... 입력
node server.js
```

이후 `http://127.0.0.1:3000/`으로 접속하면 됩니다.

환경변수 예시는 `.env.example`에 있고, 서버 실행 시 `.env`를 자동으로 읽습니다.
로컬 서버는 `fetch`와 `FormData`를 쓰므로 Node 18 이상을 권장합니다.
터미널에서 `node` 명령이 없으면 Node.js LTS 설치 후 새 터미널을 열어 다시 실행하세요.

### 대량 OCR 배치(자동 분할)

`audit_files` 폴더의 PDF를 Upstage로 일괄 OCR하려면 아래 스크립트를 실행합니다.

```powershell
node scripts/ocr-upstage-batch.js "C:\antigravity\audit_files" ".\ocr-results.json"
```

- `100페이지 초과 PDF`는 자동으로 `100페이지 단위`로 분할 OCR 후 결과를 병합합니다.
- 결과는 `ocr-results.json`에 누적 저장됩니다.
- 이미 `source=upstage`로 성공한 파일은 건너뛰고, 실패 파일은 재시도합니다.

실패 목록(`retry-ocr-list.json`)만 재처리하려면:

```powershell
node scripts/ocr-upstage-batch.js "C:\antigravity\audit_files" ".\ocr-results.json" ".\retry-ocr-list.json"
```

## 로컬 OCR 구조

지금은 `PDF 업로드`와 `OCR 텍스트 입력`을 분리해서 만들어 두었습니다.

- PDF 파일은 로컬 대기열에 쌓입니다.
- Chromium 계열 브라우저에서는 PDF 폴더째로 선택할 수 있습니다.
- PDF 페이지는 먼저 텍스트 추출을 시도하고, 비어 있으면 이미지 OCR로 전환합니다.
- 당장 테스트할 때는 OCR 텍스트를 붙여넣고 `분석 시작`을 누르면 감사결과 카드로 변환됩니다.
- OCR 신뢰도가 낮게 나오면 화면에 경고가 표시됩니다.
- Upstage 모드는 로컬 OCR보다 구조화가 더 강하고, 스캔본 PDF에 특히 유리합니다.

## OCR 품질에 대한 주의

스캔본 PDF는 다음 요인에 따라 정확도가 흔들릴 수 있습니다.

- 해상도가 낮은 스캔본
- 기울어짐, 그림자, 흐린 인쇄
- 표나 다단 편집이 많은 문서
- 작은 글씨와 각주

현재 구조는 이 문제를 완전히 없애는 게 아니라, `전처리 + 신뢰도 표시 + 재검토 유도` 방식으로 줄입니다.

현재 구현은 브라우저에서 `pdf.js`로 페이지를 렌더링하고 `Tesseract.js`로 OCR하는 구조입니다.  
Upstage 모드는 `document-digitization` API의 `document-parse-nightly`와 `enhanced` 조합을 사용합니다.  
나중에 더 빠른 로컬 실행용 파이프라인으로 바꾸고 싶으면 같은 데이터 모델을 유지한 채 엔진만 교체하면 됩니다.

## 파일 인덱스 만들기

`audit_files` 폴더의 PDF 목록을 JSON으로 만들려면 PowerShell에서 아래 스크립트를 실행합니다.

```powershell
.\scripts\build-audit-index.ps1
```

기본 출력은 프로젝트 루트의 `audit-index.json`입니다. 이 파일은 대시보드의 JSON 업로드로 바로 읽을 수 있습니다.

## 데이터 형식

업로드 JSON은 아래 둘 중 하나면 됩니다.

```json
[
  {
    "id": "audit-1",
    "institution": "기관명",
    "type": "사립대학",
    "region": "서울",
    "year": 2024,
    "auditDate": "2024-01-01",
    "status": "시정 중",
    "severity": "high",
    "summary": "요약",
    "findings": [
      { "title": "지적사항", "detail": "설명" }
    ]
  }
]
```

또는:

```json
{
  "audits": []
}
```

## OCR 텍스트 예시

```text
감사구분: 종합감사
기관명: 한빛사립대학교
감사일자: 2024.11.18
지적사항: 교비회계 증빙 미비, 산학협력 계약 관리 소홀
처분요구: 관련 규정에 따라 증빙 보완 및 계약관리 체계 정비
조치결과: 시정 중
```

## 데이터 모델

- `type`은 `종합감사`, `회계부분감사`, `재무감사`, `특정감사`, `미분류` 중 하나로 씁니다.
- `institutionKind`는 `사립대학` 또는 `학교법인`을 넣습니다.
- OCR 결과와 수동 입력 데이터는 같은 구조로 대시보드에 들어갑니다.
