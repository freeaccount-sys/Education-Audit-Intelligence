const fs = require("fs");
const path = require("path");

const [, , cliPdfPath, cliOutPath] = process.argv;
const PDF_PATH =
  process.env.PDF_PATH ||
  cliPdfPath ||
  "C:/antigravity/audit_files/[공개본]+학교법인+서강학원+및+서영대학교+종합감사+결과+보고서.최종본.pdf";
const OUT_PATH =
  process.env.OUT_PATH ||
  cliOutPath ||
  path.join(process.cwd(), "종합감사_정리표_정제본", "서영대학교_종합감사_지적사항_2열.csv");

function normalizeSpace(text) {
  return String(text ?? "")
    .replace(/\s+/g, " ")
    .replace(/\s*-\s*\d+\s*-\s*/g, " ")
    .replace(/\s+\)/g, ")")
    .replace(/\(\s+/g, "(")
    .trim();
}

function stripBracketedRefs(text) {
  return String(text ?? "")
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/\(\s*\d+\s*\)/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanTitle(text) {
  return normalizeSpace(text)
    .replace(/\s*\(\s*/g, "(")
    .replace(/\s*\)\s*/g, ")")
    .replace(/\s*\/\s*/g, "/")
    .trim();
}

function csvEscape(value) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function extractPageLines(pageItems) {
  const lines = new Map();
  for (const item of pageItems) {
    const y = Math.round(item.y * 2) / 2;
    if (!lines.has(y)) {
      lines.set(y, []);
    }
    lines.get(y).push(item);
  }

  return [...lines.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([, items]) => {
      items.sort((a, b) => a.x - b.x);
      return items.map((item) => item.str).join(" ").replace(/\s+/g, " ").trim();
    })
    .filter(Boolean);
}

function countHangul(text) {
  return (String(text ?? "").match(/\p{Script=Hangul}/gu) || []).length;
}

function isSectionBreak(line) {
  const text = normalizeSpace(stripBracketedRefs(line));
  return /^(?:4|5)\.\s*/u.test(text);
}

function isSection3Header(line) {
  const text = normalizeSpace(stripBracketedRefs(line));
  return /^3\.\s*감사\s*결과\s*확인된\s*문제점/u.test(text) || /^3\.\s*감사결과\s*확인된\s*문제점/u.test(text);
}

function isFootnoteLine(line) {
  const text = normalizeSpace(stripBracketedRefs(line));
  return /^\d+\)\s*/u.test(text) || /^-\s*\d+\s*-\s*$/u.test(text);
}

function isPageHeaderOrFooter(line) {
  const text = normalizeSpace(stripBracketedRefs(line));
  return (
    /^교\s*육\s*부$/u.test(text) ||
    /^교육부$/u.test(text) ||
    /^-?\s*\d+\s*-\s*$/u.test(text) ||
    /^제\s*목\s+/u.test(text) ||
    /^소관기관\s+/u.test(text) ||
    /^조치기관\s+/u.test(text) ||
    /^내\s*용$/u.test(text) ||
    /^내용$/u.test(text)
  );
}

function isObviousTableNoise(line) {
  const text = normalizeSpace(stripBracketedRefs(line));
  if (!text) {
    return true;
  }

  if (isPageHeaderOrFooter(text) || isFootnoteLine(text)) {
    return true;
  }

  if (/^(?:구분|항목|내역|현황|비고|참고|합계|일자|일시|금액|수량|대상|조치|계약|지급|사용|운영|처리|구매|배정|정산|점검|검토|기준|사유)$/u.test(text)) {
    return true;
  }

  if (/^(?:주|※|\*)\s*/u.test(text)) {
    return true;
  }

  if (/^[\d\.\-\(\)\s,]+$/u.test(text)) {
    return true;
  }

  if (/^(?:\d+\s+){3,}\d+$/u.test(text)) {
    return true;
  }

  const hangulCount = countHangul(text);
  const digitCount = (text.match(/\d/g) || []).length;
  if (hangulCount < 4) {
    return true;
  }

  if (text.length <= 18 && digitCount >= 3 && !/[.。!?]$/u.test(text)) {
    return true;
  }

  return false;
}

function collectNarrativeContent(lines) {
  const kept = [];

  for (const rawLine of lines) {
    const line = normalizeSpace(stripBracketedRefs(rawLine));
    if (!line) {
      continue;
    }

    if (isSection3Header(line) || isSectionBreak(line)) {
      continue;
    }

    if (isObviousTableNoise(line)) {
      continue;
    }

    kept.push(line);
  }

  return normalizeSpace(kept.join(" "));
}

function cleanupNarrativeParagraph(text) {
  const source = normalizeSpace(stripBracketedRefs(text));
  if (!source) {
    return "";
  }

  const chunks = source.split(/(?<=[.!?。])\s+/u);
  const kept = [];

  for (const chunk of chunks) {
    const line = normalizeSpace(chunk);
    if (!line || isObviousTableNoise(line)) {
      continue;
    }

    kept.push(line);
  }

  return normalizeSpace(kept.join(" "));
}

function firstMatchIndex(text, patterns) {
  let bestIndex = -1;
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match) {
      continue;
    }
    const index = match.index ?? -1;
    if (index >= 0 && (bestIndex < 0 || index < bestIndex)) {
      bestIndex = index;
    }
  }
  return bestIndex;
}

async function main() {
  if (!fs.existsSync(PDF_PATH)) {
    throw new Error(`PDF not found: ${PDF_PATH}`);
  }

  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const data = new Uint8Array(fs.readFileSync(PDF_PATH));
  const doc = await pdfjs.getDocument({ data }).promise;

  const pages = [];
  for (let pageNo = 1; pageNo <= doc.numPages; pageNo += 1) {
    const page = await doc.getPage(pageNo);
    const content = await page.getTextContent();
    const pageItems = content.items.map((item) => ({
      str: item.str,
      x: item.transform[4],
      y: item.transform[5],
    }));

    const lines = extractPageLines(pageItems);
    const rawText = lines.join(" ");
    pages.push({
      pageNo,
      rawText,
      normText: normalizeSpace(rawText),
      lines,
    });
  }

  const issueStarts = [];
  for (const page of pages) {
    const match = page.normText.match(/제\s*목\s+(.+?)\s+소\s*관\s*기\s*관/u);
    if (!match) {
      continue;
    }

    issueStarts.push({
      pageNo: page.pageNo,
      title: cleanTitle(match[1]),
    });
  }

  if (!issueStarts.length) {
    throw new Error("No issue headings were found in the PDF text.");
  }

  const rows = [];
  for (let i = 0; i < issueStarts.length; i += 1) {
    const start = issueStarts[i];
    const endPageNo = (issueStarts[i + 1]?.pageNo ?? doc.numPages + 1) - 1;
    const blockPages = pages.filter((page) => page.pageNo >= start.pageNo && page.pageNo <= endPageNo);

    let started = false;
    const contentLines = [];

    for (const page of blockPages) {
      for (const line of page.lines) {
        const normalizedLine = normalizeSpace(line);
        if (!normalizedLine) {
          continue;
        }

        if (!started) {
          if (isSection3Header(normalizedLine)) {
            started = true;
          }
          continue;
        }

        if (isSectionBreak(normalizedLine)) {
          started = false;
          continue;
        }

        contentLines.push(normalizedLine);
      }
    }

    const content = cleanupNarrativeParagraph(collectNarrativeContent(contentLines));

    rows.push({
      title: start.title,
      content,
    });
  }

  const csvLines = ["지적건명,지적내용"];
  for (const row of rows) {
    csvLines.push([csvEscape(row.title), csvEscape(row.content)].join(","));
  }

  fs.writeFileSync(OUT_PATH, `\ufeff${csvLines.join("\n")}\n`, "utf8");

  console.log(`Wrote ${rows.length} rows to ${OUT_PATH}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
