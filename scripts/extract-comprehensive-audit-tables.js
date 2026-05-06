"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const INDEX_PATH = path.join(ROOT, "audit-index.json");
const OUTPUT_DIR_BASE = ROOT;
const EXTRACTOR_PATH = path.join(ROOT, "scripts", "extract-audit-table-sample.js");
const DEFAULT_PDF_ROOT = "C:\\antigravity\\audit_files";

function normalizeType(value) {
  return String(value ?? "").replace(/\s+/g, "");
}

function safeName(value) {
  return String(value ?? "미상")
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/\s+/g, " ")
    .trim();
}

function parseJsonFile(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed) ? parsed : parsed.audits;
}

function resolvePdfPath(item) {
  if (item.filePath && fs.existsSync(item.filePath)) {
    return item.filePath;
  }
  const fallback = path.join(DEFAULT_PDF_ROOT, String(item.fileName ?? ""));
  if (fs.existsSync(fallback)) {
    return fallback;
  }
  return "";
}

function normalize(text) {
  return String(text ?? "")
    .replace(/\r/g, " ")
    .replace(/\n/g, " ")
    .replace(/\u00A0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanSegment(text) {
  return normalize(text)
    .replace(/-\s*\d+\s*-/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function pickTitle(segment) {
  const cutTokens = ["○", "①", "②", "「", "【"];
  const points = cutTokens
    .map((token) => segment.indexOf(token))
    .filter((idx) => idx >= 0);
  const cut = points.length ? Math.min(...points) : Math.min(120, segment.length);
  return segment.slice(0, cut).trim();
}

function pickDisposition(segment) {
  const factTokens = ["사실이 있음", "사실이 있고", "사실이 확인됨"];
  let cut = -1;
  let token = "";

  for (const t of factTokens) {
    const idx = segment.lastIndexOf(t);
    if (idx > cut) {
      cut = idx;
      token = t;
    }
  }

  let tail = cut >= 0 ? segment.slice(cut + token.length) : segment;
  const appendixIdx = tail.search(/【\s*붙임\s*.*?생략/);
  if (appendixIdx >= 0) {
    tail = tail.slice(0, appendixIdx);
  }

  return normalize(tail)
    .replace(/[○◦●]/g, " ; ")
    .replace(/\s*;\s*/g, "; ")
    .replace(/^;\s*/, "")
    .trim();
}

function pickSummary(segment) {
  const factsIdx = segment.lastIndexOf("사실이 있음");
  const scope = factsIdx > 0 ? segment.slice(0, factsIdx) : segment;
  const startIdx = scope.search(/-\s*(학교법인|[가-힣A-Za-z0-9]+대학교|[가-힣A-Za-z0-9]+대학)/);
  const summarySource = startIdx >= 0 ? scope.slice(startIdx) : scope;
  const summary = normalize(summarySource);
  return summary.length <= 320 ? summary : `${summary.slice(0, 320).trim()}...`;
}

function splitFindings(fullText) {
  const marker = /연\s*번\s*지\s*적\s*사\s*항\s*처\s*분\s*(\d+)\s+/g;
  const points = [];
  let m;
  while ((m = marker.exec(fullText)) !== null) {
    points.push({
      no: Number(m[1]),
      start: m.index,
      end: marker.lastIndex,
    });
  }

  if (!points.length) {
    return [];
  }

  const rows = [];
  for (let i = 0; i < points.length; i += 1) {
    const current = points[i];
    const next = points[i + 1];
    const rawSegment = fullText.slice(current.end, next ? next.start : fullText.length);
    const segment = cleanSegment(rawSegment);

    rows.push({
      no: current.no,
      issue_title: pickTitle(segment),
      summary: pickSummary(segment),
      disposition: pickDisposition(segment),
    });
  }
  return rows;
}

function splitFindingsLegacy(fullText) {
  const markerMatch = fullText.match(/지\s*적\s*사\s*항/);
  const startIdx = markerMatch ? markerMatch.index : 0;

  let body = fullText.slice(startIdx);
  body = body
    .replace(/지\s*적\s*건\s*명\s*지\s*적\s*내\s*용\s*처\s*분/g, " ")
    .replace(/연\s*번\s*지\s*적\s*건\s*명\s*지\s*적\s*내\s*용\s*처\s*분/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const marker = /(?:^|\s)(\d{1,2})(?:\.|\s)(?=[가-힣A-Za-z【(])/g;
  const points = [];
  let m;
  while ((m = marker.exec(body)) !== null) {
    points.push({
      no: Number(m[1]),
      start: m.index,
      end: marker.lastIndex,
    });
  }

  if (!points.length) {
    return [];
  }

  const rows = [];
  for (let i = 0; i < points.length; i += 1) {
    const current = points[i];
    const next = points[i + 1];
    const rawSegment = body.slice(current.end, next ? next.start : body.length);
    const segment = cleanSegment(rawSegment);
    const title = segment.split(/◦|○|【/)[0].trim();
    rows.push({
      no: current.no,
      issue_title: title || pickTitle(segment),
      summary: pickSummary(segment),
      disposition: pickDisposition(segment),
    });
  }

  const deduped = [];
  const seen = new Set();
  for (const row of rows) {
    const key = `${row.no}-${row.issue_title}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    deduped.push(row);
  }
  return deduped;
}

function splitFindingsOutline(fullText) {
  const text = normalize(fullText);
  const marker = /(?:^|\s)(\d{1,2})\s+([가-힣A-Za-z][^0-9]{2,90}?)(?=\s+\d{1,2}\s+[가-힣A-Za-z]|$)/g;
  const rows = [];
  let m;
  while ((m = marker.exec(text)) !== null) {
    const no = Number(m[1]);
    const title = normalize(m[2]).replace(/[【】()]/g, "").trim();
    if (!title || title.length < 2) {
      continue;
    }
    rows.push({
      no,
      issue_title: title,
      summary: title,
      disposition: "원문 본문 OCR 필요",
    });
  }

  if (!rows.length) {
    return [];
  }

  const unique = [];
  const seenNo = new Set();
  for (const row of rows) {
    if (seenNo.has(row.no)) {
      continue;
    }
    seenNo.add(row.no);
    unique.push(row);
  }
  return unique;
}

function csvEscape(value) {
  const text = String(value ?? "");
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

async function extractPdfText(pdfPath, pdfjs) {
  const data = new Uint8Array(fs.readFileSync(pdfPath));
  const doc = await pdfjs.getDocument({
    data,
    useWorkerFetch: false,
    isEvalSupported: false,
  }).promise;

  let joined = "";
  for (let pageNum = 1; pageNum <= doc.numPages; pageNum += 1) {
    const page = await doc.getPage(pageNum);
    const textContent = await page.getTextContent();
    joined += " " + textContent.items.map((item) => item.str).join(" ");
  }

  return normalize(joined);
}

function writeRowsToCsv(outputCsv, rows) {
  const header = ["연번", "지적사항", "주요내용(요약)", "처분요구"];
  const lines = [header.map(csvEscape).join(",")];
  rows.forEach((row) => {
    lines.push([row.no, row.issue_title, row.summary, row.disposition].map(csvEscape).join(","));
  });
  fs.writeFileSync(outputCsv, `\uFEFF${lines.join("\n")}`, "utf8");
}

async function main() {
  if (!fs.existsSync(INDEX_PATH)) {
    throw new Error(`index not found: ${INDEX_PATH}`);
  }
  if (!fs.existsSync(EXTRACTOR_PATH)) {
    throw new Error(`extractor not found: ${EXTRACTOR_PATH}`);
  }

  const audits = parseJsonFile(INDEX_PATH);
  if (!Array.isArray(audits)) {
    throw new Error("audit-index.json 형식이 올바르지 않습니다.");
  }

  const targets = audits.filter(item => item.type && item.type !== "미분류");
  const results = [];
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");

  for (let idx = 0; idx < targets.length; idx += 1) {
    const item = targets[idx];
    const type = normalizeType(item.type) || "미분류";
    const typeDir = path.join(OUTPUT_DIR_BASE, `${type}_정리표`);
    if (!fs.existsSync(typeDir)) {
      fs.mkdirSync(typeDir, { recursive: true });
    }
    const pdfPath = resolvePdfPath(item);
    const institution = safeName(item.institution || item.fileName || `기관_${idx + 1}`);
    const outputCsv = path.join(typeDir, `${institution}_${type}_정리표.csv`);

    if (!pdfPath) {
      results.push({
        institution,
        fileName: item.fileName ?? "",
        status: "failed",
        message: "PDF 경로를 찾지 못함",
        outputCsv,
      });
      continue;
    }

    try {
      const text = await extractPdfText(pdfPath, pdfjs);
      const rows = splitFindings(text);
      const legacyRows = rows.length ? rows : splitFindingsLegacy(text);
      const outlineRows = legacyRows.length ? legacyRows : splitFindingsOutline(text);
      if (!outlineRows.length) {
        throw new Error("연번/지적사항/처분 블록을 찾지 못했습니다.");
      }
      writeRowsToCsv(outputCsv, outlineRows);
      results.push({
        institution,
        fileName: item.fileName ?? "",
        status: "ok",
        message: `rows=${outlineRows.length}`,
        outputCsv,
      });
    } catch (error) {
      results.push({
        institution,
        fileName: item.fileName ?? "",
        status: "failed",
        message: String(error.message ?? error),
        outputCsv,
      });
    }
  }

  const summaryPath = path.join(OUTPUT_DIR_BASE, "_전체_생성결과.json");
  fs.writeFileSync(summaryPath, JSON.stringify({
    generatedAt: new Date().toISOString(),
    total: targets.length,
    success: results.filter((r) => r.status === "ok").length,
    failed: results.filter((r) => r.status !== "ok").length,
    results,
  }, null, 2), "utf8");

  const failed = results.filter((r) => r.status !== "ok");
  console.log(`total=${targets.length}`);
  console.log(`success=${targets.length - failed.length}`);
  console.log(`failed=${failed.length}`);
  console.log(`summary=${summaryPath}`);

  if (failed.length) {
    process.exitCode = 2;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
