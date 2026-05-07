const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const INDEX_PATH = path.join(ROOT, "audit-index.json");
const OUTPUT_PATH = path.join(ROOT, "ocr-retry-priority.json");

// 사용자 요청 + 점검 중 품질 이슈가 컸던 종합감사 학교
const PRIORITY_SCHOOLS = [
  "서영대학교",
  "수원대학교",
  "유원대학교",
  "서울신학대학교",
  "경주대학교",
  "청강문화산업대학교",
  "남서울대학교",
  "영남신학대학교",
  "중부대학교",
];

function main() {
  const index = JSON.parse(fs.readFileSync(INDEX_PATH, "utf8"));
  const wanted = new Set(PRIORITY_SCHOOLS);

  const items = index
    .filter((row) => wanted.has(String(row.institution || "")))
    .filter((row) => String(row.type || "").includes("종합감사"))
    .map((row) => ({
      institution: row.institution,
      type: row.type,
      fileName: row.fileName,
      filePath: row.filePath,
    }))
    .sort((a, b) => a.institution.localeCompare(b.institution, "ko"));

  const payload = {
    generatedAt: new Date().toISOString(),
    source: "audit-index.json",
    note: "Upstage OCR 배치 재처리 우선순위 목록",
    items,
  };

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(payload, null, 2), "utf8");
  console.log(`Saved: ${OUTPUT_PATH}`);
  console.log(`Items: ${items.length}`);
}

main();
