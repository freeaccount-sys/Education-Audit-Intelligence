"use strict";

const fs = require("fs");
const path = require("path");

const INPUT_PDF = process.argv[2] || "C:\\antigravity\\audit_files\\[붙임]+학교법인+일현학원+및+극동대학교+종합감사+결과.pdf";
const OUTPUT_CSV =
  process.argv[3] || path.join(process.cwd(), "극동대학교_종합감사_샘플표.csv");

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
    .replace(/감사결과 처분서 기관명\s*:\s*[^]+?연\s*번\s*지\s*적\s*사\s*항\s*처\s*분/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function pickTitle(segment) {
  const idxCircle = segment.indexOf("◦");
  const idxRound = segment.indexOf("○");
  const idxIeung = segment.indexOf("ㅇ");
  const idxLaw1 = segment.indexOf("｢");
  const idxLaw2 = segment.indexOf("「");
  const cutPoints = [idxCircle, idxRound, idxIeung, idxLaw1, idxLaw2].filter((v) => v >= 0);
  const cut = cutPoints.length ? Math.min(...cutPoints) : Math.min(120, segment.length);
  return segment.slice(0, cut).trim();
}

function pickDisposition(segment) {
  const endFacts = ["사실이 있음", "사실이있음"];
  let cut = -1;
  let token = "";

  for (const t of endFacts) {
    const idx = segment.lastIndexOf(t);
    if (idx > cut) {
      cut = idx;
      token = t;
    }
  }

  let tail = cut >= 0 ? segment.slice(cut + token.length) : segment;
  const appendixIdx = tail.search(/【\s*붙임\s*】|※\s*생략/);
  if (appendixIdx >= 0) {
    tail = tail.slice(0, appendixIdx);
  }

  return normalize(tail)
    .replace(/[◦○]/g, " ; ")
    .replace(/\s*;\s*/g, "; ")
    .replace(/^;\s*/, "")
    .trim();
}

function pickSummary(segment) {
  const factsIdx = segment.lastIndexOf("사실이 있음");
  const scope = factsIdx > 0 ? segment.slice(0, factsIdx) : segment;
  const startIdx = scope.search(/-\s*(학교법인|극동대학교)/);
  const summarySource = startIdx >= 0 ? scope.slice(startIdx) : scope;
  const summary = normalize(summarySource);
  if (summary.length <= 320) {
    return summary;
  }
  return `${summary.slice(0, 320).trim()}...`;
}

function csvEscape(value) {
  const text = String(value ?? "");
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

async function extractPdfText(pdfPath) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
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

function splitFindings(fullText) {
  const marker = /\uC5F0\s*\uBC88\s*\uC9C0\s*\uC801\s*\uC0AC\s*\uD56D\s*\uCC98\s*\uBD84\s*(\d+)\s+/g;
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

async function main() {
  if (!fs.existsSync(INPUT_PDF)) {
    throw new Error(`PDF not found: ${INPUT_PDF}`);
  }

  const text = await extractPdfText(INPUT_PDF);
  const rows = splitFindings(text);

  if (!rows.length) {
    throw new Error("연번/지적사항/처분 블록을 찾지 못했습니다.");
  }

  const header = ["연번", "지적사항", "주요내용(요약)", "처분요구"];
  const lines = [header.map(csvEscape).join(",")];
  for (const row of rows) {
    lines.push(
      [row.no, row.issue_title, row.summary, row.disposition]
        .map(csvEscape)
        .join(",")
    );
  }

  fs.writeFileSync(OUTPUT_CSV, `\uFEFF${lines.join("\n")}`, "utf8");
  console.log(`rows=${rows.length}`);
  console.log(`output=${OUTPUT_CSV}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
