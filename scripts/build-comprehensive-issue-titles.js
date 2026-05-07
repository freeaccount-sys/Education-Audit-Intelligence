const fs = require("fs");
const path = require("path");

const INPUT_DIR = path.join(__dirname, "..", "종합감사_정리표_정제본");
const OUTPUT_FILE = path.join(__dirname, "..", "comprehensive-issue-titles.json");
const OCR_SECTION_TITLE_OVERRIDES = {
  서영대학교: [
    "이사회 운영 부당",
    "법인 감사 대상 이사회 소집(출석) 미통지 부당",
    "C 권한 위임 및 대학 보직 부여 부당",
    "법인 임원의 친족관계에 있는 교직원 홈페이지 미공개",
    "정관 개정 및 명예퇴직수당 지급 부당",
    "사무직원 신규채용 및 전보 부적정",
    "범죄사실 통보 교원에 대한 징계의결 미요구",
    "감사자료 제출 누락",
    "교원 의원면직 제한사유 미조회",
    "신규 일반직원(특수관계인) 부당 채용",
    "파주 문화예술관 운영 부적정",
    "신규교원 연봉 책정 부적정",
    "계약직(임시직) 보직 부여 등 부적정",
    "보직 및 직책수당 중복 지급 부적정",
    "일반직원 정원 초과 임용(채용·승진) 부당",
    "전임교원 공개채용 지원자격 심사위원 구성 부적정",
    "강사 임용 전 성범죄 경력 미조회",
    "I 자녀 교원 신규채용 부당",
  ],
};

function normalizeSpace(value) {
  return String(value ?? "")
    .replace(/\uFEFF/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseCsv(text) {
  const source = String(text ?? "");
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i];
    const next = source[i + 1];

    if (ch === '"') {
      if (inQuotes && next === '"') {
        cell += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (ch === "," && !inQuotes) {
      row.push(cell);
      cell = "";
      continue;
    }

    if ((ch === "\n" || ch === "\r") && !inQuotes) {
      if (ch === "\r" && next === "\n") {
        i += 1;
      }
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    cell += ch;
  }

  if (cell.length || row.length) {
    row.push(cell);
    rows.push(row);
  }

  return rows;
}

function pickTitleColumn(headers = []) {
  const normalizedHeaders = headers.map((header) => normalizeSpace(header));

  const exactCandidates = ["지적사항", "지적건명", "지적 건명", "지적사항(건명)"];
  for (const candidate of exactCandidates) {
    const index = normalizedHeaders.findIndex((header) => header === candidate);
    if (index >= 0) {
      return index;
    }
  }

  const fuzzyIndex = normalizedHeaders.findIndex(
    (header) => header.includes("지적") && (header.includes("사항") || header.includes("건명"))
  );
  if (fuzzyIndex >= 0) {
    return fuzzyIndex;
  }

  if (normalizedHeaders.length > 1) {
    return 1;
  }
  return 0;
}

function cleanIssueTitle(rawValue) {
  let value = normalizeSpace(rawValue);
  if (!value) {
    return "";
  }

  value = value.replace(/^[0-9]{1,3}\s*[.)]?\s*/, "").trim();
  value = value.replace(/^[-•·○◦▶▷▸►]+\s*/, "").trim();
  value = value.replace(/[▶▷▸►]+/g, " ").replace(/\s+/g, " ").trim();
  value = value.replace(/^(지적사항|지적건명|제목|제 목)\s*[:：]?\s*/i, "").trim();
  value = value.replace(/^(감사결과\s*처분서\s*기관명\s*[:：]?\s*)/i, "").trim();
  value = value.replace(/^(연\s*번\s*)/i, "").trim();

  const splitDelimiters = ["◦", ";", "；", ":", "：", "【", "\n"];
  for (const delimiter of splitDelimiters) {
    const idx = value.indexOf(delimiter);
    if (idx > 0) {
      value = value.slice(0, idx).trim();
    }
  }

  const datePatterns = [
    /\b\d{4}\.\s*\d{1,2}\.\s*\d{1,2}\./,
    /\b\d{4}\.\s*\d{1,2}\./,
    /\b\d{2}\.\s*\d{1,2}\./,
    /\b\d{4}-\d{1,2}-\d{1,2}\b/,
  ];
  const dateCut = datePatterns
    .map((pattern) => value.search(pattern))
    .filter((index) => index >= 0)
    .sort((a, b) => a - b)[0];
  if (typeof dateCut === "number" && dateCut > 0) {
    value = value.slice(0, dateCut).trim();
  }

  const sectionMarkers = [
    "감사결과 확인된 문제점",
    "감사결과",
    "관계기관 등 의견",
    "검토결과",
    "붙임",
  ];
  for (const marker of sectionMarkers) {
    const idx = value.indexOf(marker);
    if (idx > 0) {
      value = value.slice(0, idx).trim();
    }
  }

  value = value.replace(/[)\]】>\-–—.,\s]+$/g, "").trim();
  value = value.replace(/\s+등$/g, "").trim();
  value = normalizeSpace(value);

  return value;
}

function isValidIssueTitle(title) {
  if (!title) {
    return false;
  }
  if (title.length < 4 || title.length > 60) {
    return false;
  }

  const blockedPatterns = [
    /원문\s*본문\s*OCR/i,
    /^제?\d{4}\s*[-.]\s*\d+/,
    /^\d+\s*$/,
    /^[()[\]{}<>"'`~!@#$%^&*_+=|\\/?.,;:-\s]+$/,
    /^감사결과\s*확인된\s*문제점$/,
    /^감사결과$/,
    /^관계기관.*의견/,
    /^개최내용$/,
    /^소집통보내용$/,
    /^처분요구$/,
  ];

  if (blockedPatterns.some((pattern) => pattern.test(title))) {
    return false;
  }

  if (/제\d+호/.test(title) && /심의/.test(title) && title.length > 24) {
    return false;
  }

  return true;
}

function institutionFromFilename(fileName) {
  return fileName.replace(/_종합감사_정리표\.csv$/i, "").trim();
}

function build() {
  if (!fs.existsSync(INPUT_DIR)) {
    throw new Error(`Input directory not found: ${INPUT_DIR}`);
  }

  const files = fs
    .readdirSync(INPUT_DIR)
    .filter((name) => /_종합감사_정리표\.csv$/i.test(name))
    .sort((a, b) => a.localeCompare(b, "ko"));

  const schools = {};

  for (const fileName of files) {
    const institution = institutionFromFilename(fileName);
    const csvPath = path.join(INPUT_DIR, fileName);
    const rows = parseCsv(fs.readFileSync(csvPath, "utf8"));

    if (!rows.length) {
      schools[institution] = [];
      continue;
    }

    const headers = rows[0].map((cell) => normalizeSpace(cell));
    const titleColumnIndex = pickTitleColumn(headers);
    const seen = new Set();
    const titles = [];

    for (const row of rows.slice(1)) {
      const rawTitle = row[titleColumnIndex] ?? "";
      const title = cleanIssueTitle(rawTitle);
      if (!isValidIssueTitle(title)) {
        continue;
      }
      if (seen.has(title)) {
        continue;
      }
      seen.add(title);
      titles.push(title);
    }

    schools[institution] = OCR_SECTION_TITLE_OVERRIDES[institution] ?? titles;
  }

  const output = {
    generatedAt: new Date().toISOString(),
    type: "종합감사",
    schools,
  };

  fs.writeFileSync(OUTPUT_FILE, `${JSON.stringify(output, null, 2)}\n`, "utf8");
  console.log(`Saved ${OUTPUT_FILE}`);
  console.log(`Schools ${Object.keys(schools).length}`);
}

build();
