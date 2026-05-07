"use strict";

const fs = require("fs");
const path = require("path");
const os = require("os");
const { PDFDocument } = require("pdf-lib");

const ROOT = path.resolve(__dirname, "..");
const ENV_PATH = path.join(ROOT, ".env");
const SOURCE_PATH = process.argv[2] || "C:\\antigravity\\audit_files";
const OUTPUT_PATH = process.argv[3] || path.join(ROOT, "ocr-results.json");
const RETRY_LIST_PATH = process.argv[4] || "";
const UPSTAGE_API_URL = "https://api.upstage.ai/v1/document-digitization";
const MODEL = "document-parse";
const MODE = "auto";
const MAX_PAGES_PER_REQUEST = 100;

function loadDotEnv(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }
  const raw = fs.readFileSync(filePath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const idx = trimmed.indexOf("=");
    if (idx < 1) {
      continue;
    }
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim().replace(/^"|"$/g, "");
    if (key && !process.env[key]) {
      process.env[key] = value;
    }
  }
}

function normalizeFilenameToken(value) {
  return String(value)
    .replace(/\+/g, " ")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripFilenameNoise(value) {
  return normalizeFilenameToken(value)
    .replace(/^\[.*?\]\s*/g, "")
    .replace(/^(?:붙임\d*|붙임|첨부|공개본|홈페이지\s*탑재|홈페이지탑재)\s*/gi, "")
    .replace(/^\d{6}\s*/g, "")
    .trim();
}

function parseAuditFilename(fileName) {
  const stem = stripFilenameNoise(String(fileName).replace(/\.pdf$/i, "").replace(/\.hwpx$/i, ""));
  const typeMatch = stem.match(/(종합감사|회계부분\s*감사|회계부분감사|재무감사|특정감사)/);
  const auditType = typeMatch ? typeMatch[1].replace(/\s+/g, "") : "미분류";
  const institutionKind = stem.includes("학교법인") ? "학교법인" : "사립대학";

  const pairedMatch = stem.match(
    /학교법인\s+(.+?)\s+및\s+(.+?)\s+(종합감사|회계부분\s*감사|회계부분감사|재무감사|특정감사)/
  );
  if (pairedMatch?.[2]) {
    return {
      institution: normalizeFilenameToken(pairedMatch[2]),
      institutionKind,
      type: auditType,
    };
  }

  const directMatch = stem.match(/(.+?)\s+(종합감사|회계부분\s*감사|회계부분감사|재무감사|특정감사)/);
  if (directMatch?.[1]) {
    return {
      institution: normalizeFilenameToken(directMatch[1].replace(/^학교법인\s+/i, "")),
      institutionKind,
      type: auditType,
    };
  }

  return {
    institution: normalizeFilenameToken(stem.replace(/^학교법인\s+/i, "")) || "기관명 미확인",
    institutionKind,
    type: auditType,
  };
}

function inferAuditType(text) {
  const normalized = text.replace(/\s+/g, " ");
  const keywords = [
    { label: "종합감사", terms: ["종합감사", "종합 감사"] },
    { label: "회계부분감사", terms: ["회계부분감사", "회계 부분 감사", "회계감사"] },
    { label: "재무감사", terms: ["재무감사", "재무 감사"] },
    { label: "특정감사", terms: ["특정감사", "특정 감사"] },
  ];
  for (const item of keywords) {
    if (item.terms.some((term) => normalized.includes(term))) {
      return item.label;
    }
  }
  return "미분류";
}

function inferSeverity(text) {
  const normalized = text.toLowerCase();
  if (/(즉시|중대한|횡령|부정수급|중복지급|위법)/.test(normalized)) {
    return "critical";
  }
  if (/(미흡|누락|지연|불일치|부적정)/.test(normalized)) {
    return "high";
  }
  if (/(권고|보완|정비|개선)/.test(normalized)) {
    return "medium";
  }
  return "low";
}

function extractInstitution(text) {
  const patterns = [
    /기관명[:\s]+([^\n\r]+)/,
    /([가-힣A-Za-z0-9·\s]+?(?:사립대학교|대학교|대학|학교법인|학원법인))/,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      return match[1].trim();
    }
  }
  return "기관명 미확인";
}

function extractDate(text) {
  const match = text.match(/(\d{4}[.\-/]\d{1,2}[.\-/]\d{1,2})/);
  if (!match) {
    return "미상";
  }
  return match[1].replace(/\./g, "-").replace(/\//g, "-");
}

function normalizeText(text) {
  return String(text)
    .replace(/\r/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function splitIssuePhrases(text) {
  return String(text)
    .split(/[,，;]/)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 5);
}

function cleanIssueTitle(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .replace(/^[\-•·◦]\s*/, "")
    .replace(/^\d{1,2}[.)]\s*/, "")
    .trim();
}

function extractTableData(payload) {
  if (!payload || !payload.elements || !Array.isArray(payload.elements)) {
    return null;
  }

  const tables = payload.elements.filter(el => el.category === 'table');
  if (!tables.length) {
    return null;
  }

  // 가장 큰 표를 선택 (감사 결과 표일 가능성이 높음)
  const mainTable = tables.sort((a, b) => {
    const aSize = a.content?.html?.length || 0;
    const bSize = b.content?.html?.length || 0;
    return bSize - aSize;
  })[0];

  if (!mainTable.content?.html) {
    return null;
  }

  // HTML 표를 파싱해서 CSV 형태로 변환
  const html = mainTable.content.html;
  const rows = [];
  const tableRegex = /<tr[^>]*>(.*?)<\/tr>/gi;
  const cellRegex = /<t[dh][^>]*>(.*?)<\/t[dh]>/gi;

  let tableMatch;
  while ((tableMatch = tableRegex.exec(html)) !== null) {
    const rowHtml = tableMatch[1];
    const cells = [];
    let cellMatch;
    while ((cellMatch = cellRegex.exec(rowHtml)) !== null) {
      const cellText = cellMatch[1].replace(/<[^>]+>/g, '').trim();
      cells.push(cellText);
    }
    if (cells.length >= 3) { // 최소 3열 (번호, 지적사항, 요약 등)
      rows.push(cells);
    }
  }

  return rows.length > 1 ? rows : null; // 헤더 포함 최소 2행
}

function classifyAuditText(text, fileName, rawPayload) {
  const normalized = normalizeText(text);
  const fromFileName = parseAuditFilename(fileName);
  const institutionFromText = extractInstitution(normalized);
  const institution = institutionFromText === "기관명 미확인" ? fromFileName.institution : institutionFromText;
  const auditTypeFromText = inferAuditType(normalized);
  const auditType = auditTypeFromText === "미분류" ? fromFileName.type : auditTypeFromText;
  const auditDate = extractDate(normalized);
  const severity = inferSeverity(normalized);
  const statusMatch = normalized.match(/조치결과[:\s]+([^\n\r]+)/);
  const status = statusMatch?.[1]?.trim() ?? "미상";

  // 표 데이터 추출 시도
  const tableData = extractTableData(rawPayload);
  let findings = [];
  let summary = "";

  if (tableData && tableData.length > 1) {
    // 표에서 데이터 추출
    const header = tableData[0].map(h => normalizeText(h));
    const dataRows = tableData.slice(1);

    findings = dataRows.map((row, index) => {
      const issue = row[1] || ""; // 지적사항 열
      const summaryText = row[2] || ""; // 요약 열
      const disposition = row[3] || ""; // 처분요구 열

      return {
        title: cleanIssueTitle(issue) || `지적사항 ${index + 1}`,
        detail: summaryText,
        disposition: disposition,
      };
    });

    summary = `표에서 ${dataRows.length}개의 감사 지적사항을 추출했습니다.`;
  } else {
    // 기존 텍스트 기반 추출
    const findingsSource =
      normalized.match(/지적사항[:\s]+([^\n\r]+)/)?.[1] ??
      normalized.match(/주요지적[:\s]+([^\n\r]+)/)?.[1] ??
      "";
    findings = splitIssuePhrases(findingsSource).map((issue, index) => ({
      title: `지적사항 ${index + 1}`,
      detail: issue,
    }));

    const summarySource =
      normalized.match(/요약[:\s]+([^\n\r]+)/)?.[1] ??
      normalized.match(/처분요구[:\s]+([^\n\r]+)/)?.[1] ??
      findingsSource;

    summary = summarySource || "OCR 텍스트에서 요약을 추출하지 못했습니다.";
  }

  return {
    institution,
    institutionKind: fromFileName.institutionKind,
    type: auditType,
    region: "미상",
    year: Number.parseInt(auditDate.slice(0, 4), 10) || new Date().getFullYear(),
    auditDate,
    status,
    severity,
    summary,
    findings,
    textLength: normalized.length,
    hasStructuredTable: !!tableData,
  };
}

function extractStrings(value, out = []) {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed) {
      out.push(trimmed);
    }
    return out;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      extractStrings(item, out);
    }
    return out;
  }
  if (value && typeof value === "object") {
    for (const item of Object.values(value)) {
      extractStrings(item, out);
    }
  }
  return out;
}

function pickBestText(payload) {
  if (typeof payload === "string") {
    return payload.trim();
  }
  if (!payload || typeof payload !== "object") {
    return "";
  }
  const preferredKeys = [
    "plainText",
    "structuredText",
    "text",
    "content",
    "markdown",
    "html",
    "document",
    "result",
    "output",
  ];
  for (const key of preferredKeys) {
    const value = payload[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  const strings = extractStrings(payload);
  if (!strings.length) {
    return "";
  }
  return strings.sort((a, b) => b.length - a.length)[0];
}

function stripMarkup(text) {
  return String(text)
    .replace(/<[^>]+>/g, " ")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[*_`>#-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function parseWithUpstageBuffer(buffer, fileName) {
  const apiKey = process.env.UPSTAGE_API_KEY;
  if (!apiKey) {
    throw new Error("UPSTAGE_API_KEY is not set.");
  }

  const formData = new FormData();
  formData.append("document", new Blob([buffer], { type: "application/pdf" }), fileName);
  formData.append("model", MODEL);
  formData.append("mode", MODE);
  formData.append("merge_multipage_tables", "true");
  formData.append("ocr", "force");

  const response = await fetch(UPSTAGE_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: formData,
  });

  const contentType = response.headers.get("content-type") || "";
  let payload;
  if (contentType.includes("application/json")) {
    payload = await response.json();
  } else {
    payload = await response.text();
  }

  if (!response.ok) {
    const detail = typeof payload === "string" ? payload : JSON.stringify(payload);
    throw new Error(`Upstage error(${response.status}): ${detail.slice(0, 1200)}`);
  }

  const structuredText = pickBestText(payload);
  const plainText = stripMarkup(structuredText);
  return { structuredText, plainText, raw: payload };
}

async function getPdfPageCount(buffer) {
  const doc = await PDFDocument.load(buffer);
  return doc.getPageCount();
}

async function splitPdfBufferByPages(buffer, chunkSize = MAX_PAGES_PER_REQUEST) {
  const sourceDoc = await PDFDocument.load(buffer);
  const pageCount = sourceDoc.getPageCount();
  const chunks = [];

  for (let start = 0; start < pageCount; start += chunkSize) {
    const endExclusive = Math.min(start + chunkSize, pageCount);
    const chunkDoc = await PDFDocument.create();
    const pageIndexes = [];
    for (let i = start; i < endExclusive; i += 1) {
      pageIndexes.push(i);
    }
    const copied = await chunkDoc.copyPages(sourceDoc, pageIndexes);
    for (const page of copied) {
      chunkDoc.addPage(page);
    }
    const bytes = await chunkDoc.save();
    chunks.push({
      startPage: start + 1,
      endPage: endExclusive,
      buffer: Buffer.from(bytes),
    });
  }
  return chunks;
}

function isPageLimitError(message) {
  const text = String(message || "").toLowerCase();
  return text.includes("exceeds the page limit") || text.includes("maximum allowed is 100");
}

async function parseWithAutoSplit(file) {
  const buffer = fs.readFileSync(file.fullPath);
  const pageCount = await getPdfPageCount(buffer);

  if (pageCount <= MAX_PAGES_PER_REQUEST) {
    const parsed = await parseWithUpstageBuffer(buffer, file.name);
    return {
      ...parsed,
      meta: {
        pageCount,
        splitApplied: false,
        chunkCount: 1,
      },
    };
  }

  const chunks = await splitPdfBufferByPages(buffer, MAX_PAGES_PER_REQUEST);
  const structuredPieces = [];
  const plainPieces = [];

  for (let i = 0; i < chunks.length; i += 1) {
    const chunk = chunks[i];
    const chunkName = `${path.parse(file.name).name}__p${chunk.startPage}-${chunk.endPage}.pdf`;
    const parsed = await parseWithUpstageBuffer(chunk.buffer, chunkName);
    structuredPieces.push(`\n\n--- CHUNK ${i + 1} (${chunk.startPage}-${chunk.endPage}) ---\n${parsed.structuredText}`);
    plainPieces.push(`\n\n--- CHUNK ${i + 1} (${chunk.startPage}-${chunk.endPage}) ---\n${parsed.plainText}`);
  }

  return {
    structuredText: structuredPieces.join("").trim(),
    plainText: plainPieces.join("").trim(),
    raw: {
      splitApplied: true,
      chunks: chunks.map((chunk) => ({ startPage: chunk.startPage, endPage: chunk.endPage })),
    },
    meta: {
      pageCount,
      splitApplied: true,
      chunkCount: chunks.length,
    },
  };
}

function toAuditRecord(file, ocrPayload) {
  const parsed = classifyAuditText(ocrPayload.plainText || ocrPayload.structuredText || "", file.name, ocrPayload.raw);
  const fallback = parseAuditFilename(file.name);
  return {
    id: `${file.name}`,
    institution: parsed.institution || fallback.institution,
    institutionKind: parsed.institutionKind || fallback.institutionKind,
    type: parsed.type || fallback.type,
    region: parsed.region || "미상",
    year: parsed.year || new Date().getFullYear(),
    auditDate: parsed.auditDate || "미상",
    status: parsed.status || "미상",
    severity: parsed.severity || "low",
    summary: parsed.summary || "OCR 요약 없음",
    findings: parsed.findings?.length ? parsed.findings : [{ title: "지적사항", detail: "추출 결과 없음" }],
    fileName: file.name,
    filePath: file.fullPath,
    fileSize: file.size,
    lastWriteTime: file.lastWriteTime,
    source: "upstage",
    ocrTextLength: parsed.textLength || 0,
    pageCount: ocrPayload.meta?.pageCount ?? null,
    splitApplied: Boolean(ocrPayload.meta?.splitApplied),
    chunkCount: ocrPayload.meta?.chunkCount ?? 1,
  };
}

function readExistingOutput(outputPath) {
  if (!fs.existsSync(outputPath)) {
    return [];
  }
  try {
    const raw = fs.readFileSync(outputPath, "utf8").replace(/^\uFEFF/, "");
    const parsed = JSON.parse(raw);
    const audits = Array.isArray(parsed) ? parsed : parsed.audits;
    return Array.isArray(audits) ? audits : [];
  } catch {
    return [];
  }
}

function readRetrySet(retryListPath) {
  if (!retryListPath) {
    return null;
  }
  const resolved = path.resolve(retryListPath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`Retry list not found: ${resolved}`);
  }

  const raw = fs.readFileSync(resolved, "utf8").replace(/^\uFEFF/, "");
  const parsed = JSON.parse(raw);
  const items = Array.isArray(parsed) ? parsed : Array.isArray(parsed.items) ? parsed.items : [];
  const set = new Set();

  for (const item of items) {
    if (typeof item === "string") {
      const key = item.trim();
      if (key) {
        set.add(key);
      }
      continue;
    }
    if (item && typeof item === "object") {
      const key = String(item.fileName || item.name || "").trim();
      if (key) {
        set.add(key);
      }
    }
  }
  return set;
}

function upsertRecord(records, recordByFile, record) {
  const index = recordByFile.get(record.fileName);
  if (typeof index === "number") {
    records[index] = record;
    return;
  }
  records.push(record);
  recordByFile.set(record.fileName, records.length - 1);
}

function writeOutput(outputPath, audits) {
  fs.writeFileSync(outputPath, JSON.stringify(audits, null, 2), "utf8");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  loadDotEnv(ENV_PATH);
  console.log('API Key loaded:', process.env.UPSTAGE_API_KEY ? 'YES' : 'NO');

  if (!fs.existsSync(SOURCE_PATH)) {
    throw new Error(`Source not found: ${SOURCE_PATH}`);
  }

  let files;
  const stat = fs.statSync(SOURCE_PATH);
  if (stat.isFile() && SOURCE_PATH.toLowerCase().endsWith('.pdf')) {
    // 단일 파일 처리
    files = [{
      name: path.basename(SOURCE_PATH),
      fullPath: SOURCE_PATH,
      size: stat.size,
      lastWriteTime: stat.mtime.toISOString(),
    }];
  } else if (stat.isDirectory()) {
    // 폴더 처리
    files = fs
      .readdirSync(SOURCE_PATH, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".pdf"))
      .map((entry) => {
        const fullPath = path.join(SOURCE_PATH, entry.name);
        const fileStat = fs.statSync(fullPath);
        return {
          name: entry.name,
          fullPath,
          size: fileStat.size,
          lastWriteTime: fileStat.mtime.toISOString(),
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name, "ko"));
  } else {
    throw new Error(`Source must be a PDF file or directory: ${SOURCE_PATH}`);
  }

  const retrySet = readRetrySet(RETRY_LIST_PATH);
  if (retrySet) {
    files = files.filter((file) => retrySet.has(file.name));
  }

  const existing = readExistingOutput(OUTPUT_PATH);
  const recordByFile = new Map();
  existing.forEach((item, idx) => {
    if (item?.fileName) {
      recordByFile.set(item.fileName, idx);
    }
  });
  const succeededSet = new Set(
    existing
      .filter((item) => item?.fileName && item?.source === "upstage")
      .map((item) => item.fileName)
  );
  const result = [...existing];

  console.log(`Total PDF: ${files.length}`);
  console.log(`Existing records: ${existing.length}`);
  console.log(`Output: ${OUTPUT_PATH}`);
  if (retrySet) {
    console.log(`Retry list: ${path.resolve(RETRY_LIST_PATH)} (${retrySet.size} items)`);
  }

  let done = 0;
  let failed = 0;

  for (let i = 0; i < files.length; i += 1) {
    const file = files[i];
    if (succeededSet.has(file.name)) {
      done += 1;
      continue;
    }

    process.stdout.write(`[${i + 1}/${files.length}] ${file.name} ... `);
    try {
      const ocrPayload = await parseWithAutoSplit(file);
      const record = toAuditRecord(file, ocrPayload);
      upsertRecord(result, recordByFile, record);
      writeOutput(OUTPUT_PATH, result);
      succeededSet.add(file.name);
      done += 1;

      if (record.splitApplied) {
        console.log(`done (split ${record.chunkCount} chunks)`);
      } else {
        console.log("done");
      }
    } catch (error) {
      console.error(`Error processing ${file.name}:`, error.message);
      failed += 1;
      const fallback = parseAuditFilename(file.name);
      const failRecord = {
        id: `${file.name}`,
        institution: fallback.institution,
        institutionKind: fallback.institutionKind,
        type: fallback.type,
        region: "미상",
        year: new Date().getFullYear(),
        auditDate: "미상",
        status: "OCR 실패",
        severity: "medium",
        summary: `OCR 실패: ${error.message}`,
        findings: [{ title: "OCR 오류", detail: error.message }],
        fileName: file.name,
        filePath: file.fullPath,
        fileSize: file.size,
        lastWriteTime: file.lastWriteTime,
        source: "upstage-failed",
      };

      if (isPageLimitError(error.message)) {
        failRecord.summary = `OCR 실패(페이지 제한): ${error.message}`;
      }

      upsertRecord(result, recordByFile, failRecord);
      writeOutput(OUTPUT_PATH, result);
      console.log("failed");
    }
    await sleep(250);
  }

  console.log(`Done: ${done}, Failed: ${failed}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
