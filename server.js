const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const ENV_PATH = path.join(ROOT, ".env");
const UPSTAGE_DEFAULT_MODEL = "document-parse-nightly";

function loadDotEnv(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const raw = fs.readFileSync(filePath, "utf8");
  raw.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      return;
    }
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex < 1) {
      return;
    }
    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim().replace(/^"|"$/g, "");
    if (key && !process.env[key]) {
      process.env[key] = value;
    }
  });
}

loadDotEnv(ENV_PATH);

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "0.0.0.0";
const UPSTAGE_API_KEY = process.env.UPSTAGE_API_KEY;
const GOOGLE_AI_API_KEY = process.env.GOOGLE_AI_API_KEY;
const UPSTAGE_API_URL = "https://api.upstage.ai/v1/document-digitization";
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";
const KEYWORD_CSV_FILE_ID = String(process.env.KEYWORD_CSV_FILE_ID || "").trim();
const KEYWORD_CSV_URL = String(process.env.KEYWORD_CSV_URL || "").trim();
const KEYWORD_CSV_LOCAL_PATH = path.resolve(ROOT, String(process.env.KEYWORD_CSV_LOCAL_PATH || "keyword-audit-source.csv"));
const AUDIT_PDF_ROOTS = String(process.env.AUDIT_PDF_DIR || "")
  .split(/[;,]/)
  .map((value) => value.trim())
  .filter(Boolean);

if (!AUDIT_PDF_ROOTS.length) {
  AUDIT_PDF_ROOTS.push(path.resolve(ROOT, "audit_files"));
  AUDIT_PDF_ROOTS.push(path.resolve(ROOT, "..", "audit_files"));
}

// Load audit data
let auditDataCache = null;
function loadAuditData() {
  const auditDataPath = path.join(ROOT, 'audit-data.json');
  if (fs.existsSync(auditDataPath)) {
    try {
      const raw = fs.readFileSync(auditDataPath, 'utf-8');
      auditDataCache = JSON.parse(raw);
    } catch (e) {
      console.error('Failed to load audit-data.json:', e.message);
      auditDataCache = [];
    }
  } else {
    auditDataCache = [];
  }
}
loadAuditData();

let auditPdfLinkCache = null;
function loadAuditPdfLinks() {
  const auditPdfLinksPath = path.join(ROOT, "audit-pdf-links.json");
  if (!fs.existsSync(auditPdfLinksPath)) {
    auditPdfLinkCache = [];
    return;
  }

  try {
    const raw = fs.readFileSync(auditPdfLinksPath, "utf8");
    const parsed = JSON.parse(raw);
    auditPdfLinkCache = Array.isArray(parsed) ? parsed : parsed?.links ?? [];
    if (!Array.isArray(auditPdfLinkCache)) {
      auditPdfLinkCache = [];
    }
  } catch (error) {
    console.error("Failed to load audit-pdf-links.json:", error.message);
    auditPdfLinkCache = [];
  }
}
loadAuditPdfLinks();

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
  });
  res.end(JSON.stringify(payload));
}

function sendText(res, statusCode, text, contentType = "text/plain; charset=utf-8") {
  res.writeHead(statusCode, {
    "Content-Type": contentType,
  });
  res.end(text);
}

function getKeywordCsvSource() {
  if (KEYWORD_CSV_URL) {
    return {
      kind: "remote",
      url: KEYWORD_CSV_URL,
      label: KEYWORD_CSV_URL,
    };
  }

  if (KEYWORD_CSV_FILE_ID) {
    return {
      kind: "remote",
      url: `https://drive.google.com/uc?export=download&id=${encodeURIComponent(KEYWORD_CSV_FILE_ID)}`,
      label: `Drive file ${KEYWORD_CSV_FILE_ID}`,
    };
  }

  return {
    kind: "local",
    path: KEYWORD_CSV_LOCAL_PATH,
    label: KEYWORD_CSV_LOCAL_PATH,
  };
}

async function handleKeywordCsv(req, res) {
  const source = getKeywordCsvSource();

  if (source.kind === "local") {
    if (false) {
      sendJson(res, 404, {
        error: `키워드 CSV를 찾지 못했습니다: ${source.path}`,
      });
      return;
    }

    const text = fs.readFileSync(source.path, "utf8");
    res.writeHead(200, {
      "Content-Type": "text/csv; charset=utf-8",
      "Cache-Control": "no-store",
    });
    res.end(text);
    return;
  }

  const upstream = await fetch(source.url, { redirect: "follow" });
  if (!upstream.ok) {
    if (fs.existsSync(KEYWORD_CSV_LOCAL_PATH)) {
      const fallbackText = fs.readFileSync(KEYWORD_CSV_LOCAL_PATH, "utf8");
      console.warn(`Keyword CSV source failed (${upstream.status}); falling back to local file: ${source.label}`);
      res.writeHead(200, {
        "Content-Type": "text/csv; charset=utf-8",
        "Cache-Control": "no-store",
      });
      res.end(fallbackText);
      return;
    }
    sendJson(res, 502, {
      error: `키워드 CSV를 불러오지 못했습니다: ${upstream.status}`,
      source: source.label,
    });
    return;
  }

  const text = await upstream.text();
  res.writeHead(200, {
    "Content-Type": "text/csv; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(text);
}

function sendHealth(res) {
  sendJson(res, 200, {
    ok: true,
    service: "moe-audit-dashboard",
    port: PORT,
    host: HOST,
    timestamp: new Date().toISOString(),
  });
}

function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return (
    {
      ".html": "text/html; charset=utf-8",
      ".css": "text/css; charset=utf-8",
      ".js": "application/javascript; charset=utf-8",
      ".json": "application/json; charset=utf-8",
      ".svg": "image/svg+xml",
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".ico": "image/x-icon",
    }[ext] || "application/octet-stream"
  );
}

function getAuditPdfRoots() {
  return [...new Set(AUDIT_PDF_ROOTS.map((dir) => path.resolve(dir)))];
}

function normalizeSearchText(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^0-9a-z\uac00-\ud7a3]+/gi, "");
}

const INSTITUTION_NAME_ALIASES = {
  대구가톨릭대: "대구가톨릭대학교",
};

function normalizeInstitutionName(value) {
  const trimmed = String(value ?? "").trim();
  return INSTITUTION_NAME_ALIASES[trimmed] ?? trimmed;
}

function normalizePdfLinkEntry(entry = {}) {
  return {
    id: String(entry.id ?? "").trim(),
    institution: normalizeInstitutionName(entry.institution),
    type: String(entry.type ?? "").trim(),
    fileName: String(entry.fileName ?? entry.pdfName ?? "").trim(),
    pdfUrl: String(entry.pdfUrl ?? entry.pdfDownloadUrl ?? entry.downloadUrl ?? entry.driveUrl ?? entry.fileUrl ?? entry.url ?? "").trim(),
  };
}

function pickAuditPdfLink(audit) {
  const links = Array.isArray(auditPdfLinkCache) ? auditPdfLinkCache.map((entry) => normalizePdfLinkEntry(entry)) : [];
  if (!links.length) {
    return "";
  }

  const auditId = String(audit?.id ?? "").trim();
  const auditInstitution = normalizeInstitutionName(audit?.institution);
  const auditType = String(audit?.type ?? "").trim();
  const auditTypeKey = normalizeSearchText(auditType);
  const auditFileName = String(audit?.fileName ?? "").trim();

  const exactMatch = links.find((entry) => {
    if (!entry.pdfUrl) {
      return false;
    }

    const entryTypeKey = normalizeSearchText(entry.type);
    return (
      (auditId && entry.id === auditId) ||
      (auditFileName && entry.fileName === auditFileName) ||
      (auditInstitution && entry.institution === auditInstitution && entryTypeKey && auditTypeKey && entryTypeKey === auditTypeKey)
    );
  });

  if (exactMatch?.pdfUrl) {
    return exactMatch.pdfUrl;
  }

  return "";
}

function isPathInside(parent, target) {
  const relative = path.relative(parent, target);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function collectPdfFiles(rootDir, out = []) {
  if (!fs.existsSync(rootDir)) {
    return out;
  }

  for (const entry of fs.readdirSync(rootDir, { withFileTypes: true })) {
    const entryPath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      collectPdfFiles(entryPath, out);
      continue;
    }
    if (entry.isFile() && entry.name.toLowerCase().endsWith(".pdf")) {
      out.push(entryPath);
    }
  }

  return out;
}

function findAuditPdfTarget(search = {}) {
  const roots = getAuditPdfRoots();
  const candidates = new Set();

  const filePath = String(search.filePath ?? "").trim();
  const fileName = String(search.fileName ?? search.pdfName ?? search.name ?? "").trim();
  const institution = String(search.institution ?? "").trim();
  const type = String(search.type ?? "").trim();
  const year = String(search.year ?? "").trim();
  const id = String(search.id ?? "").trim();

  const auditRecord =
    (auditDataCache || []).find((item) => {
      if (!item) {
        return false;
      }

      const itemYear = String(item.year ?? "").trim();
      return (
        (id && item.id === id) ||
        (fileName && item.fileName === fileName) ||
        (institution && item.institution === institution && (!type || item.type === type) && (!year || itemYear === year))
      );
    }) || null;

  if (auditRecord?.filePath) {
    candidates.add(String(auditRecord.filePath).trim());
  }

  if (filePath) {
    candidates.add(filePath);
  }

  if (fileName) {
    candidates.add(fileName);
  }

  if (institution) {
    candidates.add(institution);
  }

  for (const candidate of candidates) {
    const normalizedCandidate = candidate.replace(/^file:\/\//i, "");
    const resolvedCandidate = path.isAbsolute(normalizedCandidate)
      ? path.normalize(normalizedCandidate)
      : "";

    if (resolvedCandidate && fs.existsSync(resolvedCandidate) && fs.statSync(resolvedCandidate).isFile()) {
      if (roots.some((root) => isPathInside(root, resolvedCandidate))) {
        return resolvedCandidate;
      }
    }
  }

  const searchTerms = [fileName, institution, id].map(normalizeSearchText).filter(Boolean);
  const pdfFiles = roots.flatMap((root) => collectPdfFiles(root));

  if (!pdfFiles.length || !searchTerms.length) {
    return null;
  }

  let bestMatch = null;
  let bestScore = -1;

  for (const file of pdfFiles) {
    const baseName = path.basename(file);
    const searchable = normalizeSearchText(baseName);
    let score = 0;

    for (const term of searchTerms) {
      if (!term) {
        continue;
      }
      if (searchable === term) {
        score = Math.max(score, 100);
      } else if (searchable.includes(term)) {
        score = Math.max(score, 80 + Math.min(term.length, 15));
      }
    }

    if (auditRecord?.filePath && path.normalize(file) === path.normalize(String(auditRecord.filePath))) {
      score = Math.max(score, 120);
    }

    if (score > bestScore) {
      bestScore = score;
      bestMatch = file;
    }
  }

  return bestMatch;
}

function safeResolve(urlPath) {
  const normalized = decodeURIComponent(urlPath.split("?")[0]).replace(/^\/+/, "");
  const target = path.normalize(path.join(ROOT, normalized || "index.html"));
  if (!target.startsWith(ROOT)) {
    return null;
  }
  return target;
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
    value.forEach((item) => extractStrings(item, out));
    return out;
  }

  if (value && typeof value === "object") {
    Object.values(value).forEach((item) => extractStrings(item, out));
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

  if (Array.isArray(payload.choices)) {
    for (const choice of payload.choices) {
      const content = choice?.message?.content ?? choice?.text;
      const found = pickBestText(content);
      if (found) {
        return found;
      }
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

function extractNumber(payload, keys) {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  for (const key of keys) {
    const value = payload[key];
    const numberValue = Number(value);
    if (Number.isFinite(numberValue) && numberValue >= 0) {
      return numberValue;
    }
  }

  return null;
}

async function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";

    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 50 * 1024 * 1024) {
        reject(new Error("요청 본문이 너무 큽니다."));
        req.destroy();
      }
    });

    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(error);
      }
    });

    req.on("error", reject);
  });
}

async function handleUpstageParse(req, res) {
  if (!UPSTAGE_API_KEY) {
    sendJson(res, 500, {
      error: "UPSTAGE_API_KEY 환경변수가 설정되지 않았습니다.",
    });
    return;
  }

  const body = await parseJsonBody(req);
  const { fileName = "document.pdf", mimeType = "application/pdf", base64, model, mode } = body;
  const resolvedModel = model || UPSTAGE_DEFAULT_MODEL;
  const resolvedMode = mode || "enhanced";

  if (!base64) {
    sendJson(res, 400, { error: "base64 필드가 필요합니다." });
    return;
  }

  if (typeof fetch !== "function" || typeof FormData !== "function" || typeof Blob !== "function") {
    sendJson(res, 500, {
      error: "현재 Node 런타임에서 fetch/FormData/Blob를 사용할 수 없습니다. Node 18+를 사용하세요.",
    });
    return;
  }

  const buffer = Buffer.from(base64, "base64");
  const formData = new FormData();
  formData.append("document", new Blob([buffer], { type: mimeType }), fileName);
  formData.append("model", resolvedModel);
  formData.append("mode", resolvedMode);

  const upstream = await fetch(UPSTAGE_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${UPSTAGE_API_KEY}`,
    },
    body: formData,
  });

  const contentType = upstream.headers.get("content-type") || "";
  let payload;
  let rawText = "";

  if (contentType.includes("application/json")) {
    payload = await upstream.json().catch(() => null);
  } else {
    rawText = await upstream.text().catch(() => "");
    payload = rawText;
  }

  if (!upstream.ok) {
    let details = payload;
    if (payload && typeof payload === "object") {
      details = payload.error || payload.message || payload.details || payload;
    }
    sendJson(res, upstream.status, {
      error: "Upstage API 요청에 실패했습니다.",
      details,
      raw: rawText || payload,
    });
    return;
  }

  const structuredText = pickBestText(payload || rawText);
  const plainText = stripMarkup(structuredText);
  const pageCount = extractNumber(payload, ["pageCount", "pages", "num_pages", "total_pages"]);
  const averageConfidence = extractNumber(payload, [
    "averageConfidence",
    "avg_confidence",
    "confidence",
    "ocr_confidence",
  ]);

  sendJson(res, 200, {
    structuredText,
    plainText,
    raw: payload,
    meta: {
      model: resolvedModel,
      mode: resolvedMode,
      fileName,
      pageCount,
      averageConfidence,
    },
  });
}

async function handleGeminiParse(req, res) {
  if (!GOOGLE_AI_API_KEY) {
    sendJson(res, 500, {
      error: "GOOGLE_AI_API_KEY 환경변수가 설정되지 않았습니다.",
    });
    return;
  }

  const body = await parseJsonBody(req);
  const { fileName = "document.pdf", base64 } = body;

  if (!base64) {
    sendJson(res, 400, { error: "base64 필드가 필요합니다." });
    return;
  }

  const prompt = `
당신은 대한민국 교육부의 감사 결과를 분석하는 전문가입니다. 
제공된 PDF 문서(사학기관 감사 결과 보고서)를 읽고, 다음 JSON 형식으로 주요 정보를 추출하세요.
반드시 JSON 코드 블록 없이 순수 JSON 객체만 반환하세요.

{
  "institution": "학교명 또는 법인명",
  "type": "종합감사/회계부분감사/재무감사/특정감사/미분류 중 하나",
  "year": 2024,
  "auditDate": "YYYY-MM-DD (또는 YYYY-MM)",
  "auditPeriod": "YYYY.MM.DD. ~ YYYY.MM.DD. (문서 1페이지에서 감사기간을 찾아 기입)",
  "status": "시정 중/조치 완료/종결 등",
  "summary": "전체 감사 결과의 핵심 요약 (200자 이내)",
  "findings": [
    {
      "title": "지적사항 제목",
      "detail": "지적사항의 상세 내용 및 처분 결과 요약"
    }
  ]
}
`;

  const requestBody = {
    contents: [
      {
        parts: [
          { text: prompt },
          {
            inline_data: {
              mime_type: "application/pdf",
              data: base64
            }
          }
        ]
      }
    ],
    generationConfig: {
      response_mime_type: "application/json"
    }
  };

  const url = `${GEMINI_API_URL}?key=${GOOGLE_AI_API_KEY}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(requestBody)
  });

  const payload = await response.json();

  if (!response.ok) {
    sendJson(res, response.status, {
      error: "Gemini API 요청에 실패했습니다.",
      details: payload
    });
    return;
  }

  try {
    const candidateText =
      payload?.candidates?.[0]?.content?.parts?.[0]?.text ?? pickBestText(payload);

    if (!candidateText || !String(candidateText).trim()) {
      throw new Error('Gemini 응답에서 텍스트를 추출할 수 없습니다.');
    }

    const cleanedText = String(candidateText)
      .trim()
      .replace(/^```(?:json)?\s*([\s\S]*)\s*```$/i, '$1')
      .trim();

    const result = JSON.parse(cleanedText);

    sendJson(res, 200, {
      id: `ocr-${Date.now()}`,
      ...result,
      source: 'gemini',
      meta: {
        model: 'gemini-1.5-flash',
        fileName,
      },
    });
  } catch (error) {
    sendJson(res, 500, {
      error: 'Gemini 응답 파싱 실패',
      details: error.message,
      raw: payload,
    });
  }
}

function serveStatic(req, res) {
  const target = safeResolve(req.url || "/");
  if (!target) {
    sendText(res, 403, "Forbidden");
    return;
  }

  let filePath = target;
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, "index.html");
  }

  if (!fs.existsSync(filePath)) {
    sendText(res, 404, "Not Found");
    return;
  }

  const content = fs.readFileSync(filePath);
  res.writeHead(200, {
    "Content-Type": getMimeType(filePath),
    "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
    Pragma: "no-cache",
    Expires: "0",
  });
  res.end(content);
}

function getCsvField(row, keys) {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return '';
}

function cleanDispositionText(rawDispositionText, issueText, contentText) {
  const value = String(rawDispositionText || '').trim();
  if (value) {
    return value.replace(/\s+/g, ' ').trim();
  }

  const fallback = String(issueText || contentText || '').trim();
  if (fallback) {
    return fallback;
  }

  return '';
}

function parseCsvToJson(csvText, fileName) {
  const normalizedText = String(csvText || "").replace(/\uFEFF/g, "");
  const rows = [];
  let current = "";
  let row = [];
  let inQuotes = false;

  for (let i = 0; i < normalizedText.length; i += 1) {
    const char = normalizedText[i];
    const next = normalizedText[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
        continue;
      }
      inQuotes = !inQuotes;
      continue;
    }

    if (char === ',' && !inQuotes) {
      row.push(current.trim());
      current = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') {
        i += 1;
      }
      row.push(current.trim());
      rows.push(row);
      row = [];
      current = '';
      continue;
    }

    current += char;
  }

  if (current.length > 0 || row.length > 0) {
    row.push(current.trim());
    rows.push(row);
  }

  if (!rows.length) {
    return [];
  }

  const headers = rows[0].map((value) => String(value ?? '').trim());
  const rowObjects = rows.slice(1).map((values) => {
    const rowObject = {};
    headers.forEach((header, index) => {
      rowObject[header] = String(values[index] ?? '').trim();
    });
    return rowObject;
  });

  const auditType = extractTypeFromFilename(fileName);

  return rowObjects.map((row, index) => {
    const issueText = getCsvField(row, ['지적사항', '지적건명', '지적건', '지적건목']);
    const contentText = getCsvField(row, ['주요내용(요약)', '지적내용', '주요내용', '세부내용']);
    const rawDispositionText = getCsvField(row, ['처분요구', '처분', '처분사항', '처분결과']);
    const dispositionText = cleanDispositionText(rawDispositionText, issueText, contentText);
    const statusText = getCsvField(row, ['조치결과', '처분결과', '결과']) || '미상';
    const summaryText = contentText || issueText;

    return {
      id: `${fileName}-${index + 1}`,
      institution: extractInstitutionFromFilename(fileName),
      institutionKind: fileName.includes('학교법인') ? '학교법인' : '사립대학',
      type: auditType,
      region: '미상',
      year: 2024,
      auditDate: '2024-01-01',
      status: statusText,
      severity: inferSeverity(`${issueText} ${contentText}`),
      summary: summaryText,
      findings: [{
        title: issueText || `지적사항 ${index + 1}`,
        detail: contentText || '',
        disposition: dispositionText || '원문 본문 OCR 필요',
      }],
      textLength: (issueText + contentText).length,
      needsReview: dispositionText === '원문 본문 OCR 필요',
    };
  });
}

function extractInstitutionFromFilename(fileName) {
  return normalizeInstitutionName(fileName.replace(/_.+$/, ""));
}

function extractTypeFromFilename(fileName) {
  const match = fileName.match(/_([^_]+)_정리표\.csv$/);
  return match ? match[1] : '미분류';
}

function mergeAuditPdfLinks(audits) {
  return audits.map((audit) => {
    const pdfUrl = pickAuditPdfLink(audit);
    if (!pdfUrl) {
      return audit;
    }
    return {
      ...audit,
      pdfUrl,
    };
  });
}

function inferSeverity(text) {
  const normalized = (text || '').toLowerCase();
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

async function handleAuditResults(req, res) {
  try {
    const allResults = [];
    const dirs = fs.readdirSync(ROOT).filter(name => name.endsWith("_정제본") && fs.statSync(path.join(ROOT, name)).isDirectory());
    
    for (const dirName of dirs) {
      const refinedDir = path.join(ROOT, dirName);
      const files = fs.readdirSync(refinedDir)
        .filter(file => file.endsWith('.csv') && !file.startsWith('_'));

      for (const file of files) {
        const filePath = path.join(refinedDir, file);
        const csvContent = fs.readFileSync(filePath, 'utf8');
        const jsonData = parseCsvToJson(csvContent, file);
        allResults.push(...jsonData);
      }
    }

    const results = mergeAuditPdfLinks(allResults);

    sendJson(res, 200, {
      total: results.length,
      results
    });
  } catch (error) {
    sendJson(res, 500, { error: error.message });
  }
}

async function handlePdfDownload(req, res) {
  try {
    const requestUrl = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    const legacyPath = requestUrl.pathname.startsWith("/api/pdf/")
      ? decodeURIComponent(requestUrl.pathname.replace("/api/pdf/", ""))
      : "";
    const targetPath = findAuditPdfTarget({
      id: requestUrl.searchParams.get("id") || "",
      institution: requestUrl.searchParams.get("institution") || legacyPath,
      fileName: requestUrl.searchParams.get("fileName") || "",
      filePath: requestUrl.searchParams.get("filePath") || requestUrl.searchParams.get("path") || "",
    });
    if (!targetPath) {
      const redirectUrl = pickAuditPdfLink({
        id: requestUrl.searchParams.get("id") || "",
        institution: requestUrl.searchParams.get("institution") || legacyPath,
        type: requestUrl.searchParams.get("type") || "",
        fileName: requestUrl.searchParams.get("fileName") || "",
      });

      if (redirectUrl && /^https?:\/\//i.test(redirectUrl)) {
        res.writeHead(302, {
          Location: redirectUrl,
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        });
        res.end();
        return;
      }

      sendText(res, 404, "PDF not found");
      return;
    }

    const stat = fs.statSync(targetPath);
    const fileName = path.basename(targetPath);

    res.writeHead(200, {
      "Content-Type": "application/pdf",
      "Content-Length": stat.size,
      "Content-Disposition": `inline; filename="audit-report.pdf"; filename*=UTF-8''${encodeURIComponent(fileName)}`
    });

    const readStream = fs.createReadStream(targetPath);
    readStream.pipe(res);
  } catch (error) {
    sendText(res, 500, error.message);
  }
}

const server = http.createServer(async (req, res) => {
  try {
    const requestUrl = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    const pathname = requestUrl.pathname;

    if (req.method === "GET" && pathname === "/healthz") {
      sendHealth(res);
      return;
    }

    if (req.method === "GET" && pathname === "/api/audit-results") {
      await handleAuditResults(req, res);
      return;
    }

    if (req.method === "GET" && pathname === "/api/keyword-audit-source.csv") {
      await handleKeywordCsv(req, res);
      return;
    }

    if (req.method === "GET" && pathname === "/api/audits") {
      sendJson(res, 200, { audits: auditDataCache || [] });
      return;
    }

    if (req.method === "GET" && pathname.startsWith("/api/audits/")) {
      const institution = decodeURIComponent(pathname.replace("/api/audits/", ""));
      const audit = (auditDataCache || []).find(a => 
        a.institution === institution || a.id === `audit-${institution}`
      );
      if (audit) {
        sendJson(res, 200, audit);
      } else {
        sendJson(res, 404, { error: `감사 결과를 찾을 수 없습니다: ${institution}` });
      }
      return;
    }

    if (req.method === "GET" && pathname.startsWith("/api/pdf/")) {
      await handlePdfDownload(req, res);
      return;
    }

    if (req.method === "GET" && pathname === "/api/pdf") {
      await handlePdfDownload(req, res);
      return;
    }

    if (req.method === "POST" && pathname === "/api/upstage/parse") {
      await handleUpstageParse(req, res);
      return;
    }

    if (req.method === "POST" && pathname === "/api/gemini/parse") {
      await handleGeminiParse(req, res);
      return;
    }

    if (req.method === "GET" || req.method === "HEAD") {
      serveStatic(req, res);
      return;
    }

    sendText(res, 405, "Method Not Allowed");
  } catch (error) {
    sendJson(res, 500, {
      error: error.message || "Unknown error",
    });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Server running at http://${HOST}:${PORT}/`);
});
