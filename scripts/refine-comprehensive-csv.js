"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    const next = text[i + 1];

    if (ch === "\"") {
      if (inQuotes && next === "\"") {
        cell += "\"";
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

  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  return rows;
}

function toCsv(rows) {
  return rows
    .map((row) =>
      row
        .map((value) => {
          const text = String(value ?? "");
          if (/[",\n]/.test(text)) {
            return `"${text.replace(/"/g, "\"\"")}"`;
          }
          return text;
        })
        .join(",")
    )
    .join("\n");
}

function normalizeText(value) {
  return String(value ?? "")
    .replace(/\uFEFF/g, "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanIssueTitle(value) {
  return normalizeText(value)
    .replace(/^[\-–—•◦○●]\s*/, "")
    .replace(/^\d+[.)]\s*/, "")
    .replace(/[;:]\s*$/, "")
    .trim();
}

function truncate(value, max) {
  const text = normalizeText(value);
  if (text.length <= max) {
    return text;
  }
  return `${text.slice(0, Math.max(0, max - 1)).trim()}…`;
}

function hasMostlySymbols(value) {
  const text = normalizeText(value);
  if (!text) {
    return true;
  }
  // 더 관대한 기호 비율 체크 (45% -> 70%)
  const clean = text.replace(/[가-힣A-Za-z0-9\s]/g, "");
  return clean.length / text.length > 0.7;
}

function hasMeaningfulContent(value) {
  const text = normalizeText(value);
  if (!text || text.length < 3) {
    return false;
  }
  // 최소한의 의미 있는 단어가 있는지 확인
  const koreanWords = text.match(/[가-힣]{2,}/g);
  const englishWords = text.match(/[A-Za-z]{3,}/g);
  const totalWords = (koreanWords?.length || 0) + (englishWords?.length || 0);
  return totalWords >= 1;
}

function isLikelyOcrNoise(value) {
  const text = normalizeText(value);
  if (!text) {
    return true;
  }
  // OCR 노이즈 패턴들
  const noisePatterns = [
    /^[^\w가-힣]*$/,  // 기호만 있는 경우
    /^[\d\s\-\.\,\;\:\[\]\(\)\{\}]+$/,  // 숫자와 기호만 있는 경우
    /만\s*추출/,  // "에서 추출" 같은 불완전한 문장
    /미상|알\s*수\s*없음|확인\s*불가/,  // 불확실한 내용
  ];
  return noisePatterns.some(pattern => pattern.test(text));
}

function inferDispositionFromSummary(summary) {
  const text = normalizeText(summary);
  if (!text) return null;

  // 처분 관련 키워드로 유추
  const dispositionKeywords = [
    { pattern: /경고|주의|견책|감봉|정직|해임|면직/, result: "경고" },
    { pattern: /시정|개선|보완|조치/, result: "시정" },
    { pattern: /통보|보고|의결/, result: "통보" },
    { pattern: /환수|반납|회수/, result: "환수" },
    { pattern: /교육|훈련|연수/, result: "교육" },
  ];

  for (const { pattern, result } of dispositionKeywords) {
    if (pattern.test(text)) {
      return result;
    }
  }

  return null;
}

function refineRow(row) {
  const no = normalizeText(row[0]);
  const issue = cleanIssueTitle(row[1]);
  let summary = truncate(row[2], 420);
  let disposition = truncate(row[3], 420);

  if (!summary) {
    summary = issue;
  }

  // disposition이 약하면 summary에서 유추 시도
  const sameAsIssue = disposition && normalizeText(disposition) === normalizeText(issue);
  const sameAsSummary = disposition && normalizeText(disposition) === normalizeText(summary);
  const weakDisposition =
    !disposition ||
    sameAsIssue ||
    sameAsSummary ||
    disposition === "원문 본문 OCR 필요" ||
    disposition.length < 8 ||
    isLikelyOcrNoise(disposition);

  if (weakDisposition) {
    const inferred = inferDispositionFromSummary(summary);
    if (inferred) {
      disposition = inferred;
    } else {
      disposition = "원문 본문 OCR 필요";
    }
  }

  const needsReview =
    !hasMeaningfulContent(issue) ||
    isLikelyOcrNoise(issue) ||
    (!hasMeaningfulContent(summary) && summary !== issue) ||
    isLikelyOcrNoise(summary) ||
    disposition === "원문 본문 OCR 필요";

  return {
    row: [no, issue, summary, disposition],
    needsReview,
  };
}

function refineFile(inputPath, outputPath) {
  const raw = fs.readFileSync(inputPath, "utf8");
  const rows = parseCsv(raw);
  if (!rows.length) {
    return { totalRows: 0, reviewRows: 0 };
  }

  const header = rows[0].map((v) => normalizeText(v));
  const refinedRows = [header];
  let reviewRows = 0;

  for (const row of rows.slice(1)) {
    const result = refineRow(row);
    if (!result.row.some((cell) => String(cell).trim().length > 0)) {
      continue;
    }
    if (result.needsReview) {
      reviewRows += 1;
    }
    refinedRows.push(result.row);
  }

  fs.writeFileSync(outputPath, `\uFEFF${toCsv(refinedRows)}`, "utf8");
  return {
    totalRows: Math.max(0, refinedRows.length - 1),
    reviewRows,
  };
}

function main() {
  const dirs = fs.readdirSync(ROOT).filter(name => name.endsWith("_정리표") && fs.statSync(path.join(ROOT, name)).isDirectory());
  let globalFileCount = 0;
  let globalTotalRows = 0;
  let globalReviewRows = 0;

  for (const inputDirName of dirs) {
    const INPUT_DIR = path.join(ROOT, inputDirName);
    const OUTPUT_DIR = path.join(ROOT, `${inputDirName}_정제본`);
    const SUMMARY_PATH = path.join(OUTPUT_DIR, "_정제결과.json");

    fs.mkdirSync(OUTPUT_DIR, { recursive: true });

    const files = fs
      .readdirSync(INPUT_DIR)
      .filter((name) => name.endsWith(".csv") && !name.startsWith("_"));

    const results = [];
    for (const file of files) {
      const inputPath = path.join(INPUT_DIR, file);
      const outputPath = path.join(OUTPUT_DIR, file);
      const refined = refineFile(inputPath, outputPath);
      results.push({
        file,
        ...refined,
      });
    }

    const summary = {
      generatedAt: new Date().toISOString(),
      fileCount: results.length,
      totalRows: results.reduce((sum, item) => sum + item.totalRows, 0),
      totalReviewRows: results.reduce((sum, item) => sum + item.reviewRows, 0),
      results,
    };

    fs.writeFileSync(SUMMARY_PATH, JSON.stringify(summary, null, 2), "utf8");
    globalFileCount += summary.fileCount;
    globalTotalRows += summary.totalRows;
    globalReviewRows += summary.totalReviewRows;
  }

  console.log(`files=${globalFileCount}`);
  console.log(`rows=${globalTotalRows}`);
  console.log(`reviewRows=${globalReviewRows}`);
}

main();
