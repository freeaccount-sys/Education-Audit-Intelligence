# 사학기관 감사결과 대시보드

이 도구는 `사립대학`과 `학교법인`에 대한 교육부 감사결과만 다룹니다.

브라우저에서 바로 열 수 있는 정적 웹 대시보드입니다.

## 기능

- 사립대학과 학교법인 감사결과 목록 보기
- 검색, 감사구분, 중대도, 연도 필터링
- 선택 기관의 자동 요약 표시
- JSON 파일 업로드로 데이터 교체
- 현재 필터 결과 JSON 내보내기
- 로컬 OCR 작업공간에서 PDF 대기열 관리
- OCR 텍스트를 구조화해서 감사결과 카드로 변환
- 브라우저에서 PDF 폴더를 골라 일괄 OCR 가능

## 실행

`index.html`을 브라우저로 열면 바로 동작합니다.

로컬 OCR까지 사용하려면 브라우저가 `pdf.js`와 `Tesseract.js`를 불러올 수 있어야 합니다.  
대부분의 경우는 그냥 열어도 되지만, 라이브러리 로드가 막히면 `Live Server` 같은 로컬 웹서버로
실행하는 편이 안정적입니다.

Upstage Document Parse를 쓰려면 로컬 서버를 띄워야 합니다.

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
