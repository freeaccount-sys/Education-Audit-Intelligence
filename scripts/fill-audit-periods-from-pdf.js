"use strict";

const fs = require("fs");
const path = require("path");

const INPUT_PATH = process.argv[2] || path.join(process.cwd(), "audit-index.json");
const OUTPUT_PATH = process.argv[3] || INPUT_PATH;
const PAGE_SCAN_LIMIT = Number(process.argv[4] || 1);

function normalizeWhitespace(text) {
  return String(text ?? "")
    .replace(/\r/g, "\n")
    .replace(/\u00A0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizeSearchText(text) {
  return normalizeWhitespace(text)
    .replace(/[·•]/g, ".")
    .replace(/[∼〜～]/g, "~")
    .replace(/\((?:월|화|수|목|금|토|일)\)/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function pad2(value) {
  return String(value).padStart(2, "0");
}

function isValidDateParts(year, month, day) {
  return (
    Number.isInteger(year) &&
    year >= 1900 &&
    year <= 2100 &&
    Number.isInteger(month) &&
    month >= 1 &&
    month <= 12 &&
    Number.isInteger(day) &&
    day >= 1 &&
    day <= 31
  );
}

function formatPeriodDate(year, month, day) {
  if (!Number.isInteger(year)) {
    return "";
  }
  if (Number.isInteger(month) && Number.isInteger(day)) {
    return `${year}.${pad2(month)}.${pad2(day)}`;
  }
  if (Number.isInteger(month)) {
    return `${year}.${pad2(month)}`;
  }
  return String(year);
}

function formatAuditDate(year, month, day) {
  if (!Number.isInteger(year)) {
    return "";
  }
  if (Number.isInteger(month) && Number.isInteger(day)) {
    return `${year}-${pad2(month)}-${pad2(day)}`;
  }
  if (Number.isInteger(month)) {
    return `${year}-${pad2(month)}`;
  }
  return String(year);
}

function parseSingleDate(text) {
  const normalized = normalizeSearchText(text);
  if (!normalized) {
    return null;
  }

  const fullDate = normalized.match(/((?:19|20)\d{2})\s*[.\-/]\s*(\d{1,2})\s*[.\-/]\s*(\d{1,2})/);
  if (fullDate) {
    const year = Number(fullDate[1]);
    const month = Number(fullDate[2]);
    const day = Number(fullDate[3]);
    if (isValidDateParts(year, month, day)) {
      return {
        year,
        auditPeriod: formatPeriodDate(year, month, day),
        auditDate: formatAuditDate(year, month, day),
      };
    }
  }

  const yearMonth = normalized.match(/((?:19|20)\d{2})\s*[.\-/]\s*(\d{1,2})(?!\s*[.\-/]\s*\d)/);
  if (yearMonth) {
    const year = Number(yearMonth[1]);
    const month = Number(yearMonth[2]);
    if (Number.isInteger(year) && year >= 1900 && year <= 2100 && month >= 1 && month <= 12) {
      return {
        year,
        auditPeriod: formatPeriodDate(year, month),
        auditDate: formatAuditDate(year, month),
      };
    }
  }

  return null;
}

function parseDateRange(text) {
  const normalized = normalizeSearchText(text);
  if (!normalized) {
    return null;
  }

  const fullRange = normalized.match(
    /((?:19|20)\d{2})\s*[.\-/]\s*(\d{1,2})\s*[.\-/]\s*(\d{1,2})(?:\s*\([^)]*\))?\s*(?:~|부터|-|—|–)\s*(?:(?:(?:19|20)\d{2})\s*[.\-/]\s*)?(\d{1,2})\s*[.\-/]\s*(\d{1,2})(?:\s*\([^)]*\))?/
  );
  if (fullRange) {
    const year1 = Number(fullRange[1]);
    const month1 = Number(fullRange[2]);
    const day1 = Number(fullRange[3]);
    const month2 = Number(fullRange[4]);
    const day2 = Number(fullRange[5]);
    const year2 = year1;

    if (isValidDateParts(year1, month1, day1) && isValidDateParts(year2, month2, day2)) {
      return {
        year: year1,
        auditPeriod: `${formatPeriodDate(year1, month1, day1)} ~ ${formatPeriodDate(year2, month2, day2)}`,
        auditDate: `${formatAuditDate(year1, month1, day1)} ~ ${formatAuditDate(year2, month2, day2)}`,
      };
    }
  }

  const monthRange = normalized.match(
    /((?:19|20)\d{2})\s*[.\-/]\s*(\d{1,2})(?:\s*\([^)]*\))?\s*(?:~|부터|-|—|–)\s*(?:(?:(?:19|20)\d{2})\s*[.\-/]\s*)?(\d{1,2})(?:\s*\([^)]*\))?/
  );
  if (monthRange) {
    const year1 = Number(monthRange[1]);
    const month1 = Number(monthRange[2]);
    const month2 = Number(monthRange[3]);
    const year2 = year1;

    if (
      Number.isInteger(year1) &&
      year1 >= 1900 &&
      year1 <= 2100 &&
      month1 >= 1 &&
      month1 <= 12 &&
      month2 >= 1 &&
      month2 <= 12
    ) {
      return {
        year: year1,
        auditPeriod: `${formatPeriodDate(year1, month1)} ~ ${formatPeriodDate(year2, month2)}`,
        auditDate: `${formatAuditDate(year1, month1)} ~ ${formatAuditDate(year2, month2)}`,
      };
    }
  }

  return parseSingleDate(normalized);
}

function buildWindows(text) {
  const normalized = normalizeSearchText(text);
  if (!normalized) {
    return [];
  }

  const windows = [];
  const keywords = [/감사\s*기간/i, /감사\s*시기/i, /감사\s*실시\s*기간/i, /감사\s*대상\s*기간/i];

  for (const keyword of keywords) {
    const match = normalized.match(keyword);
    if (match && typeof match.index === "number") {
      windows.push(normalized.slice(match.index, Math.min(normalized.length, match.index + 220)));
    }
  }

  windows.push(normalized);
  return windows;
}

function findDateCandidate(text) {
  for (const window of buildWindows(text)) {
    const rangeCandidate = parseDateRange(window);
    if (rangeCandidate) {
      return rangeCandidate;
    }
  }

  return null;
}

async function extractLeadingText(pdfPath, pageLimit = 1) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const data = new Uint8Array(fs.readFileSync(pdfPath));
  const loadingTask = pdfjs.getDocument({
    data,
    useWorkerFetch: false,
    isEvalSupported: false,
  });
  const doc = await loadingTask.promise;

  const pages = Math.min(doc.numPages, Math.max(1, pageLimit));
  const pageTexts = [];

  for (let pageNumber = 1; pageNumber <= pages; pageNumber += 1) {
    const page = await doc.getPage(pageNumber);
    const textContent = await page.getTextContent();
    const text = textContent.items.map((item) => item.str).join(" ");
    pageTexts.push(text);
  }

  return pageTexts.map((text) => normalizeWhitespace(text)).join("\n");
}

async function main() {
  if (!fs.existsSync(INPUT_PATH)) {
    throw new Error(`Input file not found: ${INPUT_PATH}`);
  }

  const raw = fs.readFileSync(INPUT_PATH, "utf8").replace(/^\uFEFF/, "");
  const parsed = JSON.parse(raw);
  const list = Array.isArray(parsed) ? parsed : parsed.audits;

  if (!Array.isArray(list)) {
    throw new Error("Input JSON must be an array or { audits: [] }.");
  }

  const targets = list.filter((item) => !normalizeWhitespace(item.auditPeriod));

  let updated = 0;
  let unresolved = 0;

  for (let i = 0; i < targets.length; i += 1) {
    const item = targets[i];
    const pdfPath = item.filePath || "";
    process.stdout.write(`[${i + 1}/${targets.length}] ${item.fileName || item.id} ... `);

    if (!pdfPath || !fs.existsSync(pdfPath)) {
      unresolved += 1;
      console.log("skip(no-file)");
      continue;
    }

    try {
      const text = await extractLeadingText(pdfPath, PAGE_SCAN_LIMIT);
      const candidate = findDateCandidate(text);

      if (!candidate) {
        unresolved += 1;
        console.log("no-date");
        continue;
      }

      item.auditPeriod = candidate.auditPeriod;
      item.auditDate = candidate.auditDate;
      item.year = candidate.year;
      updated += 1;
      console.log(`updated(${candidate.auditPeriod})`);
    } catch (error) {
      unresolved += 1;
      console.log("error");
    }
  }

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(list, null, 2), "utf8");
  console.log(`done: updated=${updated}, unresolved=${unresolved}, output=${OUTPUT_PATH}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
