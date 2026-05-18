const sampleAudits = [
  {
    id: "audit-001",
    institution: "한빛사립대학교",
    institutionKind: "사립대학",
    type: "종합감사",
    region: "서울",
    year: 2024,
    auditDate: "2024-11-18",
    status: "시정 중",
    summary:
      "교비회계 집행 절차 미흡과 산학협력단 계약관리 누락이 반복적으로 발견되어 재무 통제 강화가 필요합니다.",
    findings: [
      {
        title: "교비회계 증빙 미비",
        detail: "지출결의서와 증빙자료가 일부 누락되어 예산 집행의 적정성을 즉시 보완해야 합니다.",
      },
      {
        title: "산학협력 계약 관리 소홀",
        detail: "계약 변경 이력과 승인 절차가 체계적으로 기록되지 않아 사후 점검이 필요합니다.",
      },
    ],
  },
  {
    id: "audit-002",
    institution: "푸른들사립대학교",
    institutionKind: "사립대학",
    type: "회계부분감사",
    region: "부산",
    year: 2023,
    auditDate: "2023-09-05",
    status: "조치 완료",
    summary:
      "등록금 회계와 연구비 정산 관리가 일부 지연되었으나, 시정 요구에 대한 후속 조치는 대부분 완료되었습니다.",
    findings: [
      {
        title: "등록금 회계 정산 지연",
        detail: "정산 주기가 일관되지 않아 월별 검증 프로세스를 표준화할 필요가 있습니다.",
      },
      {
        title: "연구비 집행 증빙 미흡",
        detail: "허가 만료일 사전 알림 체계를 두어 관리 누락을 줄이는 것이 좋습니다.",
      },
    ],
  },
  {
    id: "audit-003",
    institution: "청림학교법인",
    institutionKind: "학교법인",
    type: "특정감사",
    region: "대구",
    year: 2024,
    auditDate: "2024-07-22",
    status: "시정 권고",
    summary:
      "특정 감사에서 법인 전입금 관리 기준 위반과 산하기관 자금 집행 통제가 미흡해 즉시적인 개선 조치가 필요한 상태입니다.",
    findings: [
      {
        title: "법인 전입금 집행 기준 위반",
        detail: "사용 목적이 명확하지 않은 지출이 확인되어 재발 방지 교육과 승인 절차 재정비가 필요합니다.",
      },
      {
        title: "산하기관 자금 통제 미흡",
        detail: "납부 기록과 환불 기록이 분리 관리되지 않아 회계 투명성 확보가 시급합니다.",
      },
    ],
  },
  {
    id: "audit-004",
    institution: "동해학원법인",
    institutionKind: "학교법인",
    type: "종합감사",
    region: "광주",
    year: 2022,
    auditDate: "2022-12-14",
    status: "종결",
    summary:
      "이사회 회의록의 일부 서식 통일 문제가 있었으나, 법인 운영의 핵심 리스크는 낮은 편입니다.",
    findings: [
      {
        title: "회의록 서식 불일치",
        detail: "의결 항목 표현이 문서마다 달라 장기 보관 시 검색성과 일관성이 떨어집니다.",
      },
    ],
  },
  {
    id: "audit-005",
    institution: "미래교육사립대학",
    institutionKind: "사립대학",
    type: "회계부분감사",
    region: "대전",
    year: 2023,
    auditDate: "2023-05-30",
    status: "시정 중",
    summary:
      "장학금 심사 기준과 연구비 정산 체계가 불명확해, 내부 규정 정비와 관리 권한 재배치가 요구됩니다.",
    findings: [
      {
        title: "장학금 심사 기준 불명확",
        detail: "심사 점수표가 항목별로 상이해 정량 기준을 통일해야 합니다.",
      },
      {
        title: "연구비 정산 체계 미흡",
        detail: "증빙 검토 전 단계가 누락되어 정산 책임자를 분명히 지정할 필요가 있습니다.",
      },
    ],
  },
];

const state = {
  audits: sampleAudits,
  filters: {
    institutionSearch: "",
    keywordSearch: "",
    type: "all",
    year: "all",
  },
  selectedId: sampleAudits[0]?.id ?? null,
  ocrJobs: [],
  ocrText: "",
  ocrResult: null,
  ocrAnalysis: null,
  ocrStatus: "대기 중",
  ocrProcessing: false,
  ocrEngine: "local",
  upstageMode: "enhanced",
  dataSource: "api",
  dataSourceLabel: "전체 감사 데이터",
  dataSourceUrl: "",
  keywordAudits: [],
  keywordDataSourceLabel: "키워드 검색 원본",
  keywordDataSourceUrl: "",
  currentStep: 1,
  sampleTableCache: {},
};

const APP_STATE_STORAGE_KEY = "moe-audit-dashboard-ui-state";

function loadPersistedAppState() {
  try {
    const raw = localStorage.getItem(APP_STATE_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch (_error) {
    return null;
  }
}

function persistAppState() {
  try {
    const payload = {
      dataSource: state.dataSource,
      dataSourceLabel: state.dataSourceLabel,
      dataSourceUrl: state.dataSourceUrl || "",
      selectedId: state.selectedId,
      audits: state.dataSource === "uploaded-json" ? state.audits : undefined,
    };
    localStorage.setItem(APP_STATE_STORAGE_KEY, JSON.stringify(payload));
  } catch (_error) {
    // localStorage가 막혀 있어도 앱은 계속 동작한다.
  }
}

const comprehensiveIssueTitleMap = {};
let comprehensiveIssueTitleMapLoaded = false;
let comprehensiveIssueTitleMapPromise = null;

function normalizeInstitutionKey(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^0-9a-z\uac00-\ud7a3]+/gi, "");
}

function institutionNameVariants(value) {
  const base = normalizeSingleLineText(value);
  if (!base) {
    return [];
  }
  const variants = new Set([base]);
  if (base.endsWith("대학교")) {
    variants.add(base.replace(/대학교$/, "대"));
  }
  if (base.endsWith("대")) {
    variants.add(base.replace(/대$/, "대학교"));
  }
  return [...variants];
}

function applyComprehensiveIssueMap(rawMap = {}) {
  Object.keys(comprehensiveIssueTitleMap).forEach((key) => delete comprehensiveIssueTitleMap[key]);

  for (const [institution, titles] of Object.entries(rawMap)) {
    if (!Array.isArray(titles)) {
      continue;
    }
    for (const variant of institutionNameVariants(institution)) {
      const key = normalizeInstitutionKey(variant);
      if (!key) {
        continue;
      }
      comprehensiveIssueTitleMap[key] = titles
        .map((title) => normalizeSingleLineText(title))
        .filter((title) => title.length > 0);
    }
  }
}

async function loadComprehensiveIssueTitleMap() {
  if (comprehensiveIssueTitleMapLoaded) {
    return comprehensiveIssueTitleMap;
  }
  if (comprehensiveIssueTitleMapPromise) {
    return comprehensiveIssueTitleMapPromise;
  }

  comprehensiveIssueTitleMapPromise = fetch("/comprehensive-issue-titles.json")
    .then((response) => {
      if (!response.ok) {
        throw new Error(`종합감사 지적건명 맵 로드 실패: ${response.status}`);
      }
      return response.json();
    })
    .then((payload) => {
      applyComprehensiveIssueMap(payload?.schools ?? {});
      comprehensiveIssueTitleMapLoaded = true;
      return comprehensiveIssueTitleMap;
    })
    .catch((error) => {
      console.warn(error);
      return comprehensiveIssueTitleMap;
    });

  return comprehensiveIssueTitleMapPromise;
}

function getComprehensiveIssueTitlesForAudit(audit) {
  const typeLabel = normalizeSingleLineText(formatAuditTypeLabel(audit?.type ?? ""));
  if (typeLabel !== "종합감사") {
    return null;
  }

  const candidates = [
    normalizeSingleLineText(audit?.institution ?? ""),
    normalizeAuditInstitutionLabel(normalizeSingleLineText(audit?.institution ?? "")),
    normalizeAuditInstitutionLabel(formatAuditTarget(audit)),
  ];

  for (const name of candidates) {
    for (const variant of institutionNameVariants(name)) {
      const key = normalizeInstitutionKey(variant);
      if (key && Object.prototype.hasOwnProperty.call(comprehensiveIssueTitleMap, key)) {
        return Array.isArray(comprehensiveIssueTitleMap[key]) ? comprehensiveIssueTitleMap[key] : [];
      }
    }
  }

  return null;
}

function normalizeIssueTitleForDisplay(value) {
  let title = normalizeSingleLineText(value);
  if (!title) {
    return "";
  }

  title = title.replace(/^[\s•·◦ㅇ]+\s*/, "");
  title = title.split("【")[0];
  title = title.split("<")[0];
  title = title.split(";")[0];
  title = title.split(":")[0];
  title = title.replace(/^\d{1,2}\.\s*/, "").trim();
  title = normalizeSingleLineText(title);

  if (!title || title.length < 4 || title.length > 50) {
    return "";
  }

  if (/^제\d{4}\s*-\s*\d+회/.test(title)) {
    return "";
  }
  if (/[0-9]{4}\.\s*[0-9]{1,2}\./.test(title)) {
    return "";
  }
  if (/(그럼에도|따르면|있었|있고|있음|하여|하였|때문|검토결과|의견|사실관계)/.test(title)) {
    return "";
  }
  if (/^(자\s|까지\s|부터\s|에\s|로\s|은\s|는\s)/.test(title)) {
    return "";
  }
  if (/^[\(\[]/.test(title)) {
    return "";
  }

  const issueKeywordPattern =
    /(부적정|부당|미준수|미이행|미제출|미조치|위반|미흡|미비|미편입|미심의|미보관|미징수|미작성|미실시|관리|운영|집행|지출|선정|평가|임용|채용|회계|장학금|성적|학점|계약|처리|누락|은폐|허위|초과|부실)/;
  if (!issueKeywordPattern.test(title)) {
    return "";
  }

  return title;
}

function filterIssueTitlesForDisplay(titles = []) {
  const list = Array.isArray(titles) ? titles : [];
  const seen = new Set();
  const out = [];

  for (const item of list) {
    const title = normalizeIssueTitleForDisplay(item);
    if (!title || seen.has(title)) {
      continue;
    }
    seen.add(title);
    out.push(title);
  }

  return out;
}

async function loadAuditsFromAPI() {
  try {
    await loadComprehensiveIssueTitleMap();
    const response = await fetch('/api/audit-results');
    if (!response.ok) {
      throw new Error(`API 요청 실패: ${response.status}`);
    }
    const data = await response.json();
    state.audits = data.results || [];
    state.selectedId = state.audits[0]?.id ?? null;
    state.dataSource = "api";
    state.dataSourceLabel = "교육부 종합감사 데이터";
    reconcileKeywordSearchAudits();
    render();
  } catch (error) {
    console.error('종합감사 데이터 로드 실패:', error);
    throw error;
  }
}



const auditTypeKeywords = [
  { label: "종합감사", keywords: ["종합감사", "종합 감사"] },
  { label: "회계부분감사", keywords: ["회계부분감사", "회계 부분 감사", "회계감사"] },
  { label: "재무감사", keywords: ["재무감사", "재무 감사"] },
  { label: "특정감사", keywords: ["특정감사", "특정 감사"] },
];

const sampleOcrText = `교육부 감사결과
감사구분: 종합감사
기관명: 한빛사립대학교
감사일자: 2024.11.18
지적사항: 교비회계 증빙 미비, 산학협력 계약 관리 소홀
처분요구: 관련 규정에 따라 증빙 보완 및 계약관리 체계 정비
조치결과: 시정 중
`;

const manualAuditOverrides = {
  "[공개본]+학교법인+서강학원+및+서영대학교+종합감사+결과+보고서.최종본.pdf": {
    auditDate: "2024-09",
    auditPeriod: "2024.9",
    year: 2024,
  },
  "[붙임]+학교법인+포항대학교+및+포항대학교+회계부분감사+결과.pdf": {
    auditDate: "2018-05-30",
    auditPeriod: "2018. 5. 30. ~ 6. 8.",
    year: 2018,
  },
};

const manualIssueTitleOverrides = {
  "대구가톨릭대학교|종합감사": [
    "기본재산 관리 부적정",
    "제3자 소유 토지 교지 사용",
    "법인 적립금 관리 부적정",
    "부속병원 기부금 법인 세입",
    "법인 자금 관리 부적정",
    "학교법인 직원의 타법인 업무수행",
    "이사회 심의·의결 사항 미심의·의결",
    "교원 채용 심사위원 위촉 부적정",
    "겸직 미승인 및 복무 미처리 외부 출강",
    "연구년 교원 연구결과물 미제출",
    "연구년 교원 선정 부당",
    "부설학교 교원 결격사유 회보 전 신규임용",
    "연구비 집행 부적정",
    "가족수당 지급 부적정",
    "적립금 투자기준 미비",
    "국유재산 무단 사용 및 변상금 납부",
    "산학협력단 운영비 교비회계 집행",
    "포상금 지급 부적정",
    "정년퇴직 직원 특별휴가 부여 부적정",
    "교수회의 참석비 지급 부적정",
    "일반경쟁 대상 용역 등 수의계약 체결 부적정",
    "교비회계 집행 부적정",
    "교내연구비 연구결과물 미제출 및 지연제출",
    "국가연구개발사업 연구책임자 연구노트 등 미제출",
    "지식재산권 관리 부적정",
    "공동장비 사용료 미징수",
    "대학특성화사업 입찰계약 전자조달시스템(G2B) 미이용",
    "이사회 미의결 교직원 보수 지급",
    "전임의 근로계약서 미작성",
    "병원회계 소관 경조사비(외부인) 지출증빙 미첨부",
    "병원회계 소관 일반경쟁 대상 용역 등 수의계약 부당",
    "현장실습 수업 학점 부여 부적정",
    "재직기관 교육봉사활동 실적 학점 부여 부적정",
    "성적 임의정정 부적정",
    "미인가 학습장 운영 부적정",
    "휴·보강 미실시 등 초과강의료 지급 부적정",
    "교직원 본인 자녀 장학금 부당 지급",
    "출석기준 미충족자 학점 부여 및 교내 장학금 지급",
    "기숙복지장학금 대상자 선정 부적정",
    "성적 증빙자료 미보관",
    "평생교육원 교육과정 신규개설 미보고",
    "평생교육원 운영위원회 운영 부적정",
    "평생교육원 민간자격 표시 의무 미준수",
    "전기 및 정보통신 공사 미분리 발주",
  ],
};

function getManualIssueTitleOverride(audit) {
  const institution = normalizeAuditInstitutionLabel(
    normalizeSingleLineText(audit?.institution ?? formatAuditTarget(audit))
  );
  const typeLabel = normalizeSingleLineText(formatAuditTypeLabel(audit?.type ?? ""));
  return manualIssueTitleOverrides[`${institution}|${typeLabel}`] ?? null;
}

const $ = (selector) => document.querySelector(selector);

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}

function parseCsv(text) {
  const normalizedText = String(text || "").replace(/\uFEFF/g, "");
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < normalizedText.length; i += 1) {
    const char = normalizedText[i];
    const next = normalizedText[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        cell += '"';
        i += 1;
        continue;
      }
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(cell);
      cell = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") {
        i += 1;
      }
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    cell += char;
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  if (!rows.length) {
    return { headers: [], rows: [] };
  }

  const headers = rows[0].map((value) => String(value ?? "").trim());
  const bodyRows = rows
    .slice(1)
    .filter((values) => values.some((value) => String(value ?? "").trim().length > 0));

  return { headers, rows: bodyRows };
}

async function loadSampleTableCsv(cacheKey, filePath) {
  const cache = state.sampleTableCache[cacheKey];

  if (cache?.status === "success") {
    return cache.data;
  }

  if (cache?.status === "loading" && cache.promise) {
    return cache.promise;
  }

  const promise = fetch(encodeURI(filePath), { cache: "no-store" })
    .then((response) => {
      if (!response.ok) {
        throw new Error(`CSV 로드 실패 (${response.status})`);
      }
      return response.text();
    })
    .then((text) => parseCsv(text));

  state.sampleTableCache[cacheKey] = {
    status: "loading",
    promise,
  };

  try {
    const data = await promise;
    state.sampleTableCache[cacheKey] = {
      status: "success",
      data,
    };
    return data;
  } catch (error) {
    state.sampleTableCache[cacheKey] = {
      status: "error",
      error,
    };
    throw error;
  }
}

function isGeukdongComprehensiveAudit(audit) {
  const sourceText = [audit?.institution, audit?.fileName, audit?.id]
    .filter(Boolean)
    .join(" ");
  return sourceText.includes("극동대학교") && String(audit?.type ?? "").includes("종합감사");
}

function buildSampleTableHtml(parsedCsv) {
  const headers = parsedCsv?.headers ?? [];
  const rows = parsedCsv?.rows ?? [];

  if (!headers.length) {
    return `<div class="issue"><p>표 헤더를 찾지 못했습니다.</p></div>`;
  }

  return `
    <div class="table-wrap">
      <table class="audit-table sample-result-table">
        <thead>
          <tr>
            ${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}
          </tr>
        </thead>
        <tbody>
          ${rows
            .map((values) => {
              const cells = headers.map((_, index) => values[index] ?? "");
              return `<tr>${cells.map((value) => `<td>${escapeHtml(value)}</td>`).join("")}</tr>`;
            })
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

async function renderSampleTableForAudit(audit) {
  if (!isGeukdongComprehensiveAudit(audit)) {
    return;
  }

  const host = $("#sampleTableContainer");
  if (!host) {
    return;
  }

  try {
    let parsedCsv;
    try {
      parsedCsv = await loadSampleTableCsv("geukdong-comprehensive-v2", "극동대학교_종합감사_샘플표_수정본.csv");
    } catch (_error) {
      parsedCsv = await loadSampleTableCsv("geukdong-comprehensive", "극동대학교_종합감사_샘플표.csv");
    }
    if (state.selectedId !== audit.id) {
      return;
    }
    const currentHost = $("#sampleTableContainer");
    if (!currentHost) {
      return;
    }
    currentHost.innerHTML = buildSampleTableHtml(parsedCsv);
  } catch (error) {
    if (state.selectedId !== audit.id) {
      return;
    }
    const currentHost = $("#sampleTableContainer");
    if (!currentHost) {
      return;
    }
    currentHost.innerHTML = `
      <div class="issue">
        <p>샘플표를 불러오지 못했습니다. (${escapeHtml(error.message)})</p>
      </div>
    `;
  }
}

function isComprehensiveAudit(audit) {
  return String(audit?.type ?? "").includes("종합감사");
}

function buildExternalSearchLink(audit) {
  const institution = normalizeSingleLineText(audit?.institution ?? "");
  if (!institution) {
    return "";
  }

  const query = encodeURIComponent(institution);
  const url =
    `https://www.spotlightuniv.com/%ea%b5%90%ec%9c%a1%eb%b6%80-%ea%b0%90%ec%82%ac-%ea%b2%b0%ea%b3%bc-%ea%b2%80%ec%83%89-%ea%b5%90%ec%9c%a1%eb%b6%80-%ea%b0%90%ec%82%ac-%ea%b2%b0%ea%b3%bc/?q=${query}`;

  return `
    <a class="external-link" href="${url}" target="_blank" rel="noreferrer">
      감사결과 확인하기
    </a>
  `;
}

function buildActionLink(href, label, extraClass = "") {
  if (!href) {
    return "";
  }

  return `
    <a class="external-link card-action-link ${extraClass}" href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">
      ${escapeHtml(label)}
    </a>
  `;
}

function getComprehensiveAuditCsvCandidates(audit) {
  const institution = normalizeSingleLineText(audit?.institution ?? "");
  if (!institution) {
    return [];
  }

  const safeInstitution = institution.replace(/[\\/:*?"<>|]/g, "_");
  return [
    `종합감사_정리표_정제본/${safeInstitution}_종합감사_정리표.csv`,
    `종합감사_정리표/${safeInstitution}_종합감사_정리표.csv`,
  ];
}

async function loadComprehensiveAuditTable(audit) {
  const candidates = getComprehensiveAuditCsvCandidates(audit);
  let lastError = null;

  for (const filePath of candidates) {
    try {
      return await loadSampleTableCsv(`comprehensive:${filePath}`, filePath);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError ?? new Error("종합감사 결과 CSV를 찾지 못했습니다.");
}

function buildAuditTableHtml(parsedCsv) {
  const headers = parsedCsv?.headers ?? [];
  const rows = parsedCsv?.rows ?? [];

  if (!headers.length) {
    return `<div class="issue"><p>표 헤더를 찾지 못했습니다.</p></div>`;
  }

  return `
    <div class="table-wrap">
      <table class="audit-table sample-result-table">
        <thead>
          <tr>
            ${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}
          </tr>
        </thead>
        <tbody>
          ${rows
            .map((values) => {
              const cells = headers.map((_, index) => values[index] ?? "");
              return `<tr>${cells.map((value) => `<td>${escapeHtml(value)}</td>`).join("")}</tr>`;
            })
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

async function renderComprehensiveTableForAudit(audit) {
  if (!isComprehensiveAudit(audit)) {
    return;
  }

  const host = $("#sampleTableContainer");
  if (!host) {
    return;
  }

  try {
    const parsedCsv = await loadComprehensiveAuditTable(audit);
    if (state.selectedId !== audit.id) {
      return;
    }
    const currentHost = $("#sampleTableContainer");
    if (!currentHost) {
      return;
    }
    currentHost.innerHTML = buildAuditTableHtml(parsedCsv);
  } catch (error) {
    if (state.selectedId !== audit.id) {
      return;
    }
    const currentHost = $("#sampleTableContainer");
    if (!currentHost) {
      return;
    }
    currentHost.innerHTML = `
      <div class="issue">
        <p>감사결과 표를 불러오지 못했습니다. (${escapeHtml(error.message)})</p>
      </div>
    `;
  }
}

function extractDispositionTextFromParsedCsv(parsedCsv) {
  const headers = parsedCsv?.headers ?? [];
  const rows = parsedCsv?.rows ?? [];
  const dispositionIndex = headers.findIndex((header) => String(header).includes("처분요구"));

  if (dispositionIndex < 0 || !rows.length) {
    return "";
  }

  return rows
    .map((values) => normalizeSingleLineText(values[dispositionIndex] ?? ""))
    .filter(Boolean)
    .join("\n");
}

function analyzeDispositionKeywords(text) {
  const heavyDisciplineMatches = [...text.matchAll(/중징계\s*\(\s*(\d+)\s*명\s*\)/g)];
  const hasHeavyDisciplineZero = heavyDisciplineMatches.some((match) => Number(match[1]) === 0);
  const hasExecutiveApprovalCancel = /임원\s*취임\s*승인\s*취소|임원취임승인취소/.test(text);

  return {
    hasHeavyDisciplineZero,
    hasExecutiveApprovalCancel,
  };
}

function buildDispositionSummaryHtml(analysis) {
  const points = [];
  if (analysis.hasHeavyDisciplineZero) {
    points.push("중징계(0명)");
  }
  if (analysis.hasExecutiveApprovalCancel) {
    points.push("임원취임승인취소");
  }

  if (!points.length) {
    return `
      <div class="issue">
        <p>처분요구에서 중징계(0명), 임원취임승인취소 항목이 확인되지 않았습니다.</p>
      </div>
    `;
  }

  return `
    <div class="issue">
      <p>처분요구 핵심: ${escapeHtml(points.join(", "))}</p>
    </div>
  `;
}

async function renderDispositionSummaryForAudit(audit) {
  const host = $("#dispositionSummary");
  if (!host) {
    return;
  }

  let sourceText = [
    audit?.summary ?? "",
    ...(Array.isArray(audit?.findings) ? audit.findings.flatMap((finding) => [finding?.title, finding?.detail]) : []),
  ]
    .filter(Boolean)
    .join("\n");

  if (isComprehensiveAudit(audit)) {
    try {
      const parsedCsv = await loadComprehensiveAuditTable(audit);
      if (state.selectedId !== audit.id) {
        return;
      }
      sourceText = `${sourceText}\n${extractDispositionTextFromParsedCsv(parsedCsv)}`.trim();
    } catch (_error) {
      // 표를 불러오지 못해도 기존 텍스트 기반으로 요약을 시도한다.
    }
  }

  if (state.selectedId !== audit.id) {
    return;
  }

  const analysis = analyzeDispositionKeywords(sourceText);
  const currentHost = $("#dispositionSummary");
  if (!currentHost) {
    return;
  }
  currentHost.innerHTML = buildDispositionSummaryHtml(analysis);
}

function configurePdfJs() {
  if (!window.pdfjsLib) {
    return false;
  }

  window.pdfjsLib.GlobalWorkerOptions.workerSrc =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.js";
  return true;
}

function hasOcrRuntime() {
  return Boolean(window.pdfjsLib && window.Tesseract);
}

function normalizeKeywordSearchText(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

function parseKeywordSearchTerms(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .split(/[\s,，;/]+/)
    .map((part) => normalizeKeywordSearchText(part))
    .filter(Boolean);
}

function collectSearchableText(value, out = []) {
  if (value == null) {
    return out;
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    const text = String(value).trim();
    if (text) {
      out.push(text);
    }
    return out;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectSearchableText(item, out);
    }
    return out;
  }

  if (typeof value === "object") {
    for (const item of Object.values(value)) {
      collectSearchableText(item, out);
    }
  }

  return out;
}

function buildKeywordTitleSearchText(audit) {
  return collectSearchableText([
    audit?.summary,
    audit?.issueTitles,
  ])
    .map((value) => normalizeKeywordSearchText(value))
    .join(" ");
}

function buildInstitutionSearchText(audit) {
  return [
    audit?.institution,
    formatAuditTarget(audit),
    audit?.institutionKind,
  ]
    .filter(Boolean)
    .map((value) => normalizeKeywordSearchText(value))
    .join(" ");
}

function buildActiveFilterSummary() {
  const parts = [];

  if (state.currentStep === 1) {
    if (state.filters.institutionSearch.trim()) {
      parts.push(`학교명: ${state.filters.institutionSearch.trim()}`);
    }

    if (state.filters.type !== "all") {
      parts.push(`감사구분: ${state.filters.type}`);
    }

    if (state.filters.year !== "all") {
      parts.push(`연도: ${state.filters.year}`);
    }
  } else if (state.filters.keywordSearch.trim()) {
    parts.push(`키워드: ${state.filters.keywordSearch.trim()}`);
  }

  return parts.length ? `현재 필터: ${parts.join(" · ")}` : "현재 필터: 없음";
}

const DASHBOARD_BASE_DATE = "2026-05-07";

function formatFixedDateLabel(isoDate) {
  const [year, month, day] = String(isoDate ?? "").split("-");
  if (!year || !month || !day) {
    return String(isoDate ?? "");
  }

  return `${year}.${month}.${day}`;
}

function normalizeAuditMatchKey(value) {
  return normalizeKeywordSearchText(value);
}

function preferBestAuditMatch(audits) {
  if (!Array.isArray(audits) || audits.length === 0) {
    return null;
  }

  return audits.find((audit) => audit?.pdfUrl || audit?.filePath) ?? audits[0] ?? null;
}

function findBestAuditMatchForKeywordRow(keywordAudit) {
  const audits = Array.isArray(state.audits) ? state.audits : [];
  if (!audits.length) {
    return null;
  }

  const institutionKey = normalizeAuditMatchKey(keywordAudit?.institution);
  const typeKey = normalizeAuditMatchKey(keywordAudit?.type);
  const yearKey = String(keywordAudit?.year ?? "").trim();

  if (!institutionKey) {
    return null;
  }

  const institutionMatches = audits.filter((audit) => normalizeAuditMatchKey(audit?.institution) === institutionKey);
  if (!institutionMatches.length) {
    return null;
  }

  const typeMatches = institutionMatches.filter((audit) => normalizeAuditMatchKey(audit?.type) === typeKey);
  const yearMatches = institutionMatches.filter((audit) => String(audit?.year ?? "").trim() === yearKey);
  const typeYearMatches = typeMatches.filter((audit) => String(audit?.year ?? "").trim() === yearKey);

  return (
    preferBestAuditMatch(typeYearMatches) ??
    preferBestAuditMatch(typeMatches) ??
    preferBestAuditMatch(yearMatches) ??
    preferBestAuditMatch(institutionMatches)
  );
}

function reconcileKeywordSearchAudits() {
  if (!Array.isArray(state.keywordAudits) || !state.keywordAudits.length) {
    return;
  }

  state.keywordAudits = state.keywordAudits.map((audit) => {
    const matchedAudit = findBestAuditMatchForKeywordRow(audit);
    if (!matchedAudit) {
      return audit;
    }

    const pdfUrl = buildPdfDownloadUrl(matchedAudit);
    return {
      ...audit,
      linkedAuditId: matchedAudit.id,
      linkedAuditFileName: matchedAudit.fileName ?? "",
      linkedAuditFilePath: matchedAudit.filePath ?? "",
      pdfUrl: pdfUrl || audit.pdfUrl || "",
    };
  });

  if (state.currentStep === 2 || state.filters.keywordSearch.trim()) {
    render();
  }
}

function getIntegratedSearchAudits() {
  const institutionSearch = normalizeKeywordSearchText(state.filters.institutionSearch);

  return state.audits.filter((audit) => {
    const matchesInstitution = !institutionSearch || buildInstitutionSearchText(audit).includes(institutionSearch);
    const matchesType = state.filters.type === "all" || audit.type === state.filters.type;
    const matchesYear = state.filters.year === "all" || String(audit.year) === state.filters.year;
    return matchesInstitution && matchesType && matchesYear;
  });
}

function getKeywordSearchAudits() {
  const keywordTerms = parseKeywordSearchTerms(state.filters.keywordSearch);

  if (!keywordTerms.length) {
    return [];
  }

  return state.keywordAudits.filter((audit) => {
    const searchableText = buildKeywordTitleSearchText(audit);
    return keywordTerms.some((term) => searchableText.includes(term));
  });
}

function getDisplayedAudits() {
  return state.currentStep === 1 ? getIntegratedSearchAudits() : getKeywordSearchAudits();
}

function getStepResultLabel() {
  return state.currentStep === 1 ? "통합검색 결과" : "키워드 검색 결과";
}

function getKeywordIssueTitleText(audit) {
  const summaryText = normalizeSingleLineText(audit?.summary ?? "");
  if (summaryText) {
    return summaryText;
  }

  const titles = Array.isArray(audit?.issueTitles)
    ? audit.issueTitles.map((title) => normalizeSingleLineText(title)).filter(Boolean)
    : [];
  return titles.length ? titles.join(", ") : "지적건명 없음";
}

function renderKeywordDetailText(audit) {
  const findings = Array.isArray(audit?.findings) ? audit.findings : [];
  if (!findings.length) {
    return escapeHtml(normalizeSingleLineText(audit?.summary ?? "") || "상세 내용 없음");
  }

  return findings
    .map((finding) => {
      const detail = normalizeSingleLineText(finding?.detail ?? "");
      return detail || "상세 내용 없음";
    })
    .join("<br />");
}

function buildKeywordResultTableHtml(audits) {
  return `
    <div class="table-wrap">
      <table class="audit-table sample-result-table keyword-result-table">
        <thead>
          <tr>
            <th>감사구분</th>
            <th>감사연도</th>
            <th>학교명</th>
            <th>지적건명</th>
            <th>지적내용</th>
          </tr>
        </thead>
        <tbody>
          ${audits
            .map((audit) => {
              const active = audit.id === state.selectedId ? "active" : "";
              const typeLabel = normalizeSingleLineText(formatAuditTypeLabel(audit.type));
              const yearLabel = audit.year ? `${escapeHtml(String(audit.year))}년` : "";
              const institutionLabel = escapeHtml(normalizeAuditInstitutionLabel(formatAuditTarget(audit)));
              const issueTitleText = truncateText(getKeywordIssueTitleText(audit), 90);
              const detailHtml = renderKeywordDetailText(audit);
              return `
                <tr class="${active}" data-id="${escapeHtml(audit.id)}">
                  <td>${escapeHtml(typeLabel)}</td>
                  <td>${yearLabel}</td>
                  <td>${institutionLabel}</td>
                  <td>${escapeHtml(issueTitleText)}</td>
                  <td class="keyword-detail-cell"><div class="keyword-detail-text">${detailHtml}</div></td>
                </tr>
              `;
            })
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

function aggregateStats(audits) {
  return [
    { label: "대상 기관 수", value: audits.length },
    { label: "기준 일자", value: formatFixedDateLabel(DASHBOARD_BASE_DATE) },
  ];
}

function inferAuditType(text) {
  const normalized = text.replace(/\s+/g, " ");

  for (const item of auditTypeKeywords) {
    if (item.keywords.some((keyword) => normalized.includes(keyword))) {
      return item.label;
    }
  }

  return "";
}

async function readPdfPageText(page) {
  const textContent = await page.getTextContent();
  return textContent.items.map((item) => item.str).join(" ").trim();
}

function arrayBufferToBase64(buffer) {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;

  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }

  return btoa(binary);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(url, options = {}, retries = 1, retryDelay = 750) {
  let lastError;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(url, options);
      const rawText = await response.clone().text().catch(() => "");
      let payload;

      try {
        payload = rawText ? JSON.parse(rawText) : null;
      } catch {
        payload = rawText;
      }

      if (!response.ok) {
        const status = response.status;
        const retryable = [429, 502, 503, 504].includes(status);
        if (retryable && attempt < retries) {
          await delay(retryDelay * (attempt + 1));
          continue;
        }

        return { response, payload };
      }

      return { response, payload };
    } catch (error) {
      lastError = error;
      if (attempt < retries) {
        await delay(retryDelay * (attempt + 1));
        continue;
      }
      throw lastError;
    }
  }

  throw lastError;
}

function pickBestResponseText(payload) {
  if (typeof payload === "string") {
    return String(payload).trim();
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
      const found = pickBestResponseText(content);
      if (found) {
        return found;
      }
    }
  }

  const strings = [];
  const collectStrings = (value) => {
    if (typeof value === "string") {
      strings.push(value.trim());
      return;
    }
    if (Array.isArray(value)) {
      value.forEach(collectStrings);
      return;
    }
    if (value && typeof value === "object") {
      Object.values(value).forEach(collectStrings);
    }
  };

  collectStrings(payload);
  return strings.sort((a, b) => b.length - a.length)[0] || "";
}

async function parsePdfWithUpstage(file, mode = "enhanced", onProgress) {
  if (typeof onProgress === "function") {
    onProgress(1, "Upstage 업로드 중", 0.1);
  }

  const arrayBuffer = await file.arrayBuffer();
  const { response, payload } = await fetchWithRetry(
    "/api/upstage/parse",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fileName: file.name,
        mimeType: file.type || "application/pdf",
        base64: arrayBufferToBase64(arrayBuffer),
        mode,
        model: "document-parse-nightly",
      }),
    },
    2,
    750
  );

  if (!response.ok) {
    let errorMessage = `Upstage 파싱 실패 (${response.status})`;
    if (typeof payload === "string" && payload.trim()) {
      errorMessage = payload.trim();
    } else if (payload && typeof payload === "object") {
      errorMessage = payload.error || payload.message || payload.details || errorMessage;
      if (payload.details && typeof payload.details === "string") {
        errorMessage = `${errorMessage}: ${payload.details}`;
      }
    }
    throw new Error(errorMessage);
  }

  if (typeof onProgress === "function") {
    onProgress(1, "Upstage 파싱 완료", 1);
  }

  return payload;
}

async function parsePdfWithGemini(file, onProgress) {
  if (typeof onProgress === "function") {
    onProgress(1, "Gemini 업로드 중", 0.1);
  }

  const arrayBuffer = await file.arrayBuffer();
  const { response, payload } = await fetchWithRetry(
    "/api/gemini/parse",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fileName: file.name,
        base64: arrayBufferToBase64(arrayBuffer),
      }),
    },
    2,
    750
  );

  if (!response.ok) {
    let errorMessage = `Gemini 분석 실패 (${response.status})`;
    if (typeof payload === "string" && payload.trim()) {
      errorMessage = payload.trim();
    } else if (payload && typeof payload === "object") {
      errorMessage = payload.error || payload.message || payload.details || errorMessage;
    }
    throw new Error(errorMessage);
  }

  if (payload && typeof payload === "object" && !payload.summary) {
    const fallback = pickBestResponseText(payload);
    if (fallback) {
      payload.summary = fallback;
    }
  }

  if (typeof onProgress === "function") {
    onProgress(1, "Gemini 분석 완료", 1);
  }

  return payload;
}

async function renderPdfPageToCanvas(page, scale = 2) {
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("캔버스 렌더링 컨텍스트를 만들 수 없습니다.");
  }

  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);

  await page.render({ canvasContext: context, viewport }).promise;
  return canvas;
}

function preprocessCanvas(canvas) {
  const prepared = document.createElement("canvas");
  const context = prepared.getContext("2d");

  if (!context) {
    return canvas;
  }

  prepared.width = canvas.width;
  prepared.height = canvas.height;
  context.drawImage(canvas, 0, 0);

  const imageData = context.getImageData(0, 0, prepared.width, prepared.height);
  const { data } = imageData;

  for (let i = 0; i < data.length; i += 4) {
    const luminance = Math.round(data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
    const threshold = luminance > 180 ? 255 : luminance < 90 ? 0 : luminance;
    data[i] = threshold;
    data[i + 1] = threshold;
    data[i + 2] = threshold;
  }

  context.putImageData(imageData, 0, 0);
  return prepared;
}

async function ocrCanvas(canvas, pageNumber, onProgress) {
  const result = await window.Tesseract.recognize(canvas, "kor+eng", {
    tessedit_pageseg_mode: 6,
    tessedit_ocr_engine_mode: 1,
    logger: (message) => {
      if (typeof onProgress === "function" && message.status) {
        onProgress(pageNumber, message.status, message.progress ?? 0);
      }
    },
  });

  return {
    text: result.data.text,
    confidence: result.data.confidence ?? 0,
  };
}

async function extractTextFromPdfFile(file, onProgress) {
  if (!configurePdfJs()) {
    throw new Error("PDF.js를 찾을 수 없습니다.");
  }

  if (!window.Tesseract) {
    throw new Error("Tesseract.js를 찾을 수 없습니다.");
  }

  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = window.pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;
  const chunks = [];
  const pageResults = [];
  let textPages = 0;
  let ocrPages = 0;

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const extractedText = await readPdfPageText(page);

    if (extractedText.length > 40) {
      chunks.push(`--- PAGE ${pageNumber} TEXT ---\n${extractedText}`);
      pageResults.push({
        pageNumber,
        mode: "text",
        text: extractedText,
        confidence: 100,
      });
      textPages += 1;
      if (typeof onProgress === "function") {
        onProgress(pageNumber, "텍스트 추출 완료", 1);
      }
      continue;
    }

    if (typeof onProgress === "function") {
      onProgress(pageNumber, "이미지 렌더링", 0.1);
    }

    const canvas = await renderPdfPageToCanvas(page, 2);
    const preparedCanvas = preprocessCanvas(canvas);
    if (typeof onProgress === "function") {
      onProgress(pageNumber, "OCR 처리", 0.4);
    }

    const ocrResult = await ocrCanvas(preparedCanvas, pageNumber, onProgress);
    chunks.push(`--- PAGE ${pageNumber} OCR ---\n${ocrResult.text.trim()}`);
    pageResults.push({
      pageNumber,
      mode: "ocr",
      text: ocrResult.text.trim(),
      confidence: ocrResult.confidence,
    });
    ocrPages += 1;
  }

  const averageConfidence =
    pageResults.length > 0
      ? pageResults.reduce((sum, pageResult) => sum + (pageResult.confidence ?? 0), 0) / pageResults.length
      : 0;

  return {
    text: chunks.join("\n\n").trim(),
    pageCount: pdf.numPages,
    textPages,
    ocrPages,
    averageConfidence,
    pages: pageResults,
  };
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

function extractPeriod(text) {
  const periodMatch = text.match(/감사기간\s*[:\s]+([^\n\r]+)/);
  if (periodMatch?.[1]) {
    return periodMatch[1].trim();
  }
  const dateMatch = text.match(/(\d{4}[.\-/]\d{1,2}[.\-/]\d{1,2})\s*~\s*(\d{4}[.\-/]\d{1,2}[.\-/]\d{1,2})/);
  if (dateMatch) {
    return `${dateMatch[1]} ~ ${dateMatch[2]}`;
  }
  return "";
}

function extractDate(text) {
  const match = text.match(/(\d{4}[.\-/]\d{1,2}[.\-/]\d{1,2})/);
  if (!match) {
    return "";
  }

  return match[1].replace(/\./g, "-").replace(/\//g, "-");
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
  const auditType = typeMatch ? typeMatch[1].replace(/\s+/g, "") : "";
  const institutionKind = stem.includes("학교법인") ? "학교법인" : "사립대학";

  const pairedMatch = stem.match(
    /학교법인\s+(.+?)\s+및\s+(.+?)\s+(종합감사|회계부분\s*감사|회계부분감사|재무감사|특정감사)/
  );
  if (pairedMatch?.[2]) {
    return {
      institution: normalizeFilenameToken(pairedMatch[2]),
      institutionKind,
      type: auditType,
      fileStem: stem,
    };
  }

  const directMatch = stem.match(/(.+?)\s+(종합감사|회계부분\s*감사|회계부분감사|재무감사|특정감사)/);
  if (directMatch?.[1]) {
    return {
      institution: normalizeFilenameToken(directMatch[1].replace(/^학교법인\s+/i, "")),
      institutionKind,
      type: auditType,
      fileStem: stem,
    };
  }

  return {
    institution: normalizeFilenameToken(stem.replace(/^학교법인\s+/i, "")) || "기관명 미확인",
    institutionKind,
    type: auditType,
    fileStem: stem,
  };
}

function normalizeText(text) {
  return text
    .replace(/\r/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizeSingleLineText(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function truncateText(value, max = 220) {
  const text = normalizeSingleLineText(value);
  if (text.length <= max) {
    return text;
  }
  return `${text.slice(0, Math.max(0, max - 1)).trim()}…`;
}

function summarizeFailureReason(summary) {
  const text = normalizeSingleLineText(summary);
  if (!text) {
    return "OCR 처리 중 오류가 발생했습니다.";
  }
  if (/insufficient credit|api key suspended|api_key_is_not_allowed/i.test(text)) {
    return "Upstage 크레딧 부족으로 OCR이 중단되었습니다.";
  }
  if (/exceeds the page limit|maximum allowed is 100|page limit/i.test(text)) {
    return "페이지 수 제한으로 OCR이 실패했습니다. 자동분할 재처리가 필요합니다.";
  }
  if (/invalid_document|invalid object|invalid pdf|No pages found/i.test(text)) {
    return "PDF 구조 문제로 OCR이 실패했습니다.";
  }
  return truncateText(text, 200);
}

function isFailedAudit(audit) {
  const status = String(audit?.status ?? "");
  const source = String(audit?.source ?? "");
  const summary = String(audit?.summary ?? "");
  return status.includes("OCR 실패") || source === "upstage-failed" || summary.startsWith("OCR 실패");
}

function formatAuditTarget(audit) {
  const fileName = normalizeSingleLineText(audit?.fileName ?? "");
  const institutionFromData = normalizeSingleLineText(audit?.institution ?? "");

  // 1. 파일명에서 추출 시도 (가장 정확한 소스)
  if (fileName) {
    let cleanName = fileName.replace(/\+/g, " "); // +를 공백으로 변경
    cleanName = cleanName.replace(/\[[^\]]+\]/g, ""); // [공개본] 등 제거
    cleanName = cleanName.trim();

    // "및 OO대학교" 형태 추출
    const matchAnd = cleanName.match(/및\s+([^\s,]+(?:대학교|대학원|대학|학교|대))/);
    if (matchAnd) return matchAnd[1];

    // "XX학원 OO대학교" 또는 "OO대학교" 형태 추출
    const parts = cleanName.split(/\s+/);
    for (const part of parts) {
      if (part.endsWith("대학교") || part.endsWith("대학원") || part.endsWith("대학") || part.endsWith("학교") || part.endsWith("대")) {
        // "김포대학"과 "김포대학교"가 같이 있는 경우 "김포대학교" 선호 (길이가 긴 것)
        if (part.length >= 2) return part;
      }
    }
  }

  // 2. 데이터(OCR 결과)에서 추출 시도 (파일명 실패 시)
  let institution = institutionFromData;

  const schoolMatch = institution.match(/및\s+([^\s,]+(?:대학교|대학|학교|교))/);
  if (schoolMatch) {
    return schoolMatch[1];
  }

  institution = institution.replace(/^학교법인\s+[^\s]+\s+/, "");
  institution = institution.replace(/^학교법인\s+/, "");

  if (institution.length > 20) {
    const parts = institution.split(/\s+/);
    for (const part of parts) {
      if (part.endsWith("대학교") || part.endsWith("대학") || part.endsWith("학교")) {
        return part;
      }
    }
    return parts[0];
  }

  return institution || "";
}

function normalizeAuditInstitutionLabel(label) {
  const normalized = normalizeSingleLineText(label);
  const aliases = {
    "대구가톨릭대": "대구가톨릭대학교",
  };
  return aliases[normalized] ?? normalized;
}

function formatAuditPeriod(audit) {
  const directPeriod = normalizeSingleLineText(audit?.auditPeriod ?? "");
  if (directPeriod && directPeriod !== "미상") {
    return directPeriod;
  }

  const startDate = normalizeSingleLineText(audit?.auditStartDate ?? audit?.startDate ?? "");
  const endDate = normalizeSingleLineText(audit?.auditEndDate ?? audit?.endDate ?? "");
  if (startDate && endDate && startDate !== "미상" && endDate !== "미상") {
    return `${startDate} ~ ${endDate}`;
  }

  const auditDate = normalizeSingleLineText(audit?.auditDate ?? "");
  if (auditDate && auditDate !== "미상") {
    return auditDate;
  }

  if (Number(audit?.year)) {
    return `${audit.year}년`;
  }

  // 파일명에서 연도 추정 시도
  const fileYear = parseYearFromFileName(audit?.fileName ?? "");
  if (fileYear) {
    return `${fileYear}년 (추정)`;
  }

  return "미상";
}

function extractIssueTitleFromText(detail) {
  const text = normalizeSingleLineText(detail);
  if (!text) {
    return "";
  }
  const firstChunk = text.split(/[.:;,\n\r]/)[0]?.trim() ?? "";
  return firstChunk.length > 40 ? `${firstChunk.slice(0, 40).trim()}...` : firstChunk;
}

function buildIssueTitleListSafe(findings = [], summaryText = "", contentText = "") {
  const genericPattern = /^지적사항(\s*\d+)?$/i;
  const noisePattern = /(파일명\s*기반\s*인덱스|요약\s*없음|내용\s*없음|미상)/i;
  const list = Array.isArray(findings) ? findings : findings ? [findings] : [];
  const seen = new Set();
  const titles = [];

  for (const finding of list) {
    const rawTitle = normalizeSingleLineText(finding?.title ?? "");
    const fallback = extractIssueTitleFromText(finding?.detail ?? "");
    const candidate = !rawTitle || genericPattern.test(rawTitle) ? fallback : rawTitle;
    if (!candidate || noisePattern.test(candidate) || seen.has(candidate)) {
      continue;
    }
    seen.add(candidate);
    titles.push(candidate);
  }

  if (!titles.length) {
    const fallbackSources = [summaryText, contentText]
      .map((text) => normalizeSingleLineText(text))
      .filter(Boolean);
    for (const source of fallbackSources) {
      const chunk = extractIssueTitleFromText(source);
      if (!chunk || noisePattern.test(chunk) || seen.has(chunk)) {
        continue;
      }
      seen.add(chunk);
      titles.push(chunk);
    }
  }

  return titles;
}

function extractIssueTitlesFromLongText(text) {
  const source = normalizeSingleLineText(text);
  if (!source) {
    return [];
  }

  const titles = [];
  const pushTitle = (value) => {
    const normalized = normalizeSingleLineText(value)
      .replace(/^\d{1,2}\.\s*/, "")
      .replace(/^[\-•·◦]\s*/, "")
      .trim();
    if (normalized.length < 4 || normalized.length > 80) {
      return;
    }
    titles.push(normalized);
  };

  const numberedPattern = /(?:^|[【】\s])\d{1,2}\.\s*([^◦【】]{4,80})/g;
  for (const match of source.matchAll(numberedPattern)) {
    pushTitle(match[1]);
  }

  const leadPattern = /(^|[【】\s])([^◦【】]{4,80}?(?:미준수|부적정|부당|미이행|미제출|소홀|위반))/g;
  for (const match of source.matchAll(leadPattern)) {
    pushTitle(match[2]);
  }

  if (source.includes("◦")) {
    pushTitle(source.split("◦")[0]);
  }

  return titles;
}

function buildIssueTitleListSafe(findings = [], summaryText = "", contentText = "") {
  const genericPattern = /^지적사항(\s*\d+)?$/i;
  const noisePattern = /(파일명\s*기반\s*인덱스|요약\s*없음|내용\s*없음|미상|index)/i;
  const list = Array.isArray(findings) ? findings : findings ? [findings] : [];
  const seen = new Set();
  const titles = [];

  const addTitle = (value) => {
    const normalized = normalizeSingleLineText(value);
    if (!normalized || noisePattern.test(normalized) || seen.has(normalized)) {
      return;
    }
    seen.add(normalized);
    titles.push(normalized);
  };

  for (const finding of list) {
    const rawTitle = normalizeSingleLineText(finding?.title ?? "");
    const fallback = extractIssueTitleFromText(finding?.detail ?? "");
    let candidate = !rawTitle || genericPattern.test(rawTitle) ? fallback : rawTitle;
    if (candidate.length > 90) {
      candidate = extractIssueTitleFromText(candidate);
    }
    addTitle(candidate);
  }

  const fallbackSources = [summaryText, contentText]
    .map((text) => normalizeSingleLineText(text))
    .filter(Boolean);

  for (const source of fallbackSources) {
    const chunk = extractIssueTitleFromText(source);
    if (chunk && !noisePattern.test(chunk) && !seen.has(chunk)) {
      seen.add(chunk);
      titles.push(chunk);
    }
    for (const title of extractIssueTitlesFromLongText(source)) {
      addTitle(title);
    }
  }

  return titles.slice(0, 20);
}

function collectIssueTitlesFromAudit(audit) {
  const explicitTitles = Array.isArray(audit?.issueTitles) ? audit.issueTitles : [];
  const findings = Array.isArray(audit?.findings) ? audit.findings : [];
  const summaryText = audit?.summary ?? "";
  const contentText = audit?.originalText ?? audit?.ocrText ?? audit?.content ?? audit?.rawText ?? "";

  return filterIssueTitlesForDisplay([
    ...explicitTitles,
    ...buildIssueTitleListSafe(findings, summaryText, contentText),
  ]);
}

function parseYearFromText(value) {
  const text = normalizeSingleLineText(value);
  if (!text || text === "미상") {
    return null;
  }
  const match = text.match(/(19|20)\d{2}/);
  if (!match) {
    return null;
  }
  const year = Number(match[0]);
  return Number.isFinite(year) ? year : null;
}

function parseYearFromFileName(fileName) {
  const name = normalizeSingleLineText(fileName);
  if (!name) {
    return null;
  }

  const ymdMatch = name.match(/(^|[^0-9])(\d{2})(\d{2})(\d{2})([^0-9]|$)/);
  if (ymdMatch) {
    const yy = Number(ymdMatch[2]);
    if (Number.isFinite(yy)) {
      return yy >= 70 ? 1900 + yy : 2000 + yy;
    }
  }

  const yyyyMatch = name.match(/(19|20)\d{2}/);
  if (yyyyMatch) {
    return Number(yyyyMatch[0]);
  }

  return null;
}

function resolveImportedYear(item, fileName, isFailed) {
  const currentYear = new Date().getFullYear();
  const explicitYear = Number(item?.year);
  const hasExplicitYear = Number.isFinite(explicitYear) && explicitYear >= 1900 && explicitYear <= 2100;
  const dateYear = parseYearFromText(item?.auditDate ?? item?.date);
  const fileYear = parseYearFromFileName(fileName);

  if (dateYear) {
    return dateYear;
  }

  if (hasExplicitYear) {
    const looksLikeFallback = explicitYear === currentYear && !dateYear;
    if (!(isFailed && looksLikeFallback)) {
      return explicitYear;
    }
  }

  if (fileYear) {
    return fileYear;
  }

  return null;
}

function formatYearLabel(audit) {
  const year = Number(audit?.year);
  return Number.isFinite(year) && year > 0 ? String(year) : "";
}

function formatAuditContent(audit) {
  const summary = truncateText(audit?.summary ?? "", 140);
  if (summary) {
    return summary;
  }

  if (Array.isArray(audit?.findings) && audit.findings.length) {
    return truncateText(
      audit.findings
        .map((finding) => normalizeSingleLineText(finding?.title ?? ""))
        .filter(Boolean)
        .join(", "),
      140
    );
  }

  return "내용 없음";
}

function sanitizeDownloadFileName(fileName) {
  const value = normalizeSingleLineText(fileName || "");
  if (!value) {
    return "audit-result.pdf";
  }

  const cleaned = value.replace(/[\\/:*?"<>|]+/g, "_").trim();
  if (cleaned.toLowerCase().endsWith(".pdf")) {
    return cleaned;
  }

  return `${cleaned}.pdf`;
}

function normalizePdfDownloadUrl(url) {
  return String(url || "").trim();
}

function buildPdfDownloadUrl(audit) {
  const directUrl = normalizePdfDownloadUrl(
    audit?.pdfUrl ||
      audit?.pdfDownloadUrl ||
      audit?.downloadUrl ||
      audit?.driveUrl ||
      audit?.fileUrl ||
      audit?.url ||
      ""
  );
  if (directUrl) {
    return directUrl;
  }

  const params = new URLSearchParams();

  if (audit?.filePath) params.set("filePath", audit.filePath);
  if (audit?.fileName) params.set("fileName", audit.fileName);
  if (audit?.id) params.set("id", audit.id);
  if (audit?.institution) params.set("institution", audit.institution);
  if (audit?.type) params.set("type", audit.type);

  const query = params.toString();
  return query ? `/api/pdf?${query}` : "";
}

function splitIssuePhrases(text) {
  const phrases = text
    .split(/[,，;]/)
    .map((part) => part.trim())
    .filter(Boolean);

  return phrases.slice(0, 5);
}

function normalizeAuditDateText(text) {
  return normalizeSingleLineText(text)
    .replace(/[·•]/g, ".")
    .replace(/[∼〜～]/g, "~")
    .replace(/\((?:월|화|수|목|금|토|일)\)/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function formatAuditPeriodDate(year, month, day) {
  if (!Number.isInteger(year)) {
    return "";
  }
  if (Number.isInteger(month) && Number.isInteger(day)) {
    return `${year}.${String(month).padStart(2, "0")}.${String(day).padStart(2, "0")}`;
  }
  if (Number.isInteger(month)) {
    return `${year}.${String(month).padStart(2, "0")}`;
  }
  return String(year);
}

function formatAuditIsoDate(year, month, day) {
  if (!Number.isInteger(year)) {
    return "";
  }
  if (Number.isInteger(month) && Number.isInteger(day)) {
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }
  if (Number.isInteger(month)) {
    return `${year}-${String(month).padStart(2, "0")}`;
  }
  return String(year);
}

function extractAuditDateNormalized(text) {
  const normalized = normalizeAuditDateText(text);
  if (!normalized) {
    return "";
  }

  const fullDate = normalized.match(/((?:19|20)\d{2})\s*[.\-/]\s*(\d{1,2})\s*[.\-/]\s*(\d{1,2})/);
  if (fullDate) {
    const year = Number(fullDate[1]);
    const month = Number(fullDate[2]);
    const day = Number(fullDate[3]);
    if (year >= 1900 && year <= 2100 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return formatAuditIsoDate(year, month, day);
    }
  }

  const yearMonth = normalized.match(/((?:19|20)\d{2})\s*[.\-/]\s*(\d{1,2})(?!\s*[.\-/]\s*\d)/);
  if (yearMonth) {
    const year = Number(yearMonth[1]);
    const month = Number(yearMonth[2]);
    if (year >= 1900 && year <= 2100 && month >= 1 && month <= 12) {
      return formatAuditIsoDate(year, month);
    }
  }

  return "";
}

function extractAuditPeriodNormalized(text) {
  const normalized = normalizeAuditDateText(text);
  if (!normalized) {
    return "";
  }

  const windows = [
    /감사\s*기간/i,
    /감사\s*시기/i,
    /감사\s*실시\s*기간/i,
    /감사\s*대상\s*기간/i,
  ]
    .map((keyword) => {
      const match = normalized.match(keyword);
      if (!match || typeof match.index !== "number") {
        return null;
      }
      return normalized.slice(match.index, Math.min(normalized.length, match.index + 220));
    })
    .filter(Boolean);

  windows.push(normalized);

  for (const windowText of windows) {
    const fullRange = windowText.match(
      /((?:19|20)\d{2})\s*[.\-/]\s*(\d{1,2})\s*[.\-/]\s*(\d{1,2})(?:\s*\([^)]*\))?\s*(?:~|부터|-|—|–)\s*(?:(?:(?:19|20)\d{2})\s*[.\-/]\s*)?(\d{1,2})\s*[.\-/]\s*(\d{1,2})(?:\s*\([^)]*\))?/
    );
    if (fullRange) {
      const year1 = Number(fullRange[1]);
      const month1 = Number(fullRange[2]);
      const day1 = Number(fullRange[3]);
      const month2 = Number(fullRange[4]);
      const day2 = Number(fullRange[5]);
      const year2 = year1;
      if (month1 >= 1 && month1 <= 12 && day1 >= 1 && day1 <= 31 && month2 >= 1 && month2 <= 12 && day2 >= 1 && day2 <= 31) {
        return `${formatAuditPeriodDate(year1, month1, day1)} ~ ${formatAuditPeriodDate(year2, month2, day2)}`;
      }
    }

    const monthRange = windowText.match(
      /((?:19|20)\d{2})\s*[.\-/]\s*(\d{1,2})(?:\s*\([^)]*\))?\s*(?:~|부터|-|—|–)\s*(?:(?:(?:19|20)\d{2})\s*[.\-/]\s*)?(\d{1,2})(?:\s*\([^)]*\))?/
    );
    if (monthRange) {
      const year1 = Number(monthRange[1]);
      const month1 = Number(monthRange[2]);
      const month2 = Number(monthRange[3]);
      const year2 = year1;
      if (month1 >= 1 && month1 <= 12 && month2 >= 1 && month2 <= 12) {
        return `${formatAuditPeriodDate(year1, month1)} ~ ${formatAuditPeriodDate(year2, month2)}`;
      }
    }

    const singleDate = windowText.match(/((?:19|20)\d{2})\s*[.\-/]\s*(\d{1,2})\s*[.\-/]\s*(\d{1,2})/);
    if (singleDate) {
      const year = Number(singleDate[1]);
      const month = Number(singleDate[2]);
      const day = Number(singleDate[3]);
      if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        return formatAuditPeriodDate(year, month, day);
      }
    }

    const yearMonth = windowText.match(/((?:19|20)\d{2})\s*[.\-/]\s*(\d{1,2})(?!\s*[.\-/]\s*\d)/);
    if (yearMonth) {
      const year = Number(yearMonth[1]);
      const month = Number(yearMonth[2]);
      if (month >= 1 && month <= 12) {
        return formatAuditPeriodDate(year, month);
      }
    }
  }

  return "";
}

function classifyAuditText(text) {
  const normalized = normalizeText(text);
  const institution = extractInstitution(normalized);
  const auditType = inferAuditType(normalized);
  const auditDate = extractAuditDateNormalized(normalized);
  const auditPeriod = extractAuditPeriodNormalized(normalized);
  const statusMatch = normalized.match(/조치결과[:\s]+([^\n\r]+)/);
  const status = statusMatch?.[1]?.trim() ?? "";
  const findingsSource =
    normalized.match(/지적사항[:\s]+([^\n\r]+)/)?.[1] ??
    normalized.match(/주요지적[:\s]+([^\n\r]+)/)?.[1] ??
    normalized;
  const findings = splitIssuePhrases(findingsSource).map((issue, index) => ({
    title: `지적사항 ${index + 1}`,
    detail: issue,
  }));
  const summarySource =
    normalized.match(/요약[:\s]+([^\n\r]+)/)?.[1] ??
    normalized.match(/처분요구[:\s]+([^\n\r]+)/)?.[1] ??
    findingsSource;

  return {
    institution,
    type: auditType,
    region: "",
    year: Number.parseInt(auditDate.slice(0, 4), 10) || new Date().getFullYear(),
    auditDate,
    auditPeriod,
    status,
    summary: summarySource,
    findings: findings.length ? findings : [{ title: "지적사항", detail: findingsSource }],
    issueTitles: buildIssueTitleListSafe(findings, summarySource, normalized),
    originalText: normalized,
    auditType,
  };
}

function createAuditRecordFromText(text, source = "local-ocr") {
  const classified = classifyAuditText(text);
  const id = `ocr-${Date.now()}`;

  return {
    id,
    institution: classified.institution,
    type: classified.auditType,
    region: classified.region,
    year: classified.year,
    auditDate: classified.auditDate,
    auditPeriod: classified.auditPeriod,
    status: classified.status,
    summary: classified.summary,
    findings: classified.findings,
    source,
  };
}

function normalizeImportedAudit(item, index) {
  const fileName = item.fileName ?? item.pdfName ?? item.name ?? item.file ?? "";
  const override = manualAuditOverrides[fileName] ?? null;
  const filenameInfo = fileName ? parseAuditFilename(fileName) : null;

  const type = item.type ?? filenameInfo?.type ?? "";
  const institutionKind = item.institutionKind ?? item.schoolType ?? filenameInfo?.institutionKind ?? "";
  const institution = item.institution ?? filenameInfo?.institution ?? `기관 ${index + 1}`;

  const baseStatus = item.status ?? (fileName ? "OCR 대기" : "");
  const isFailed =
    String(baseStatus).includes("OCR 실패") ||
    item.source === "upstage-failed" ||
    String(item.summary ?? "").startsWith("OCR 실패");
  const normalizedSummary = isFailed
    ? summarizeFailureReason(item.summary ?? item.title)
    : truncateText(item.summary ?? item.title ?? "", 220);
  const normalizedFindings = isFailed
    ? [{ title: "OCR 실패 사유", detail: summarizeFailureReason(item.summary ?? "") }]
    : Array.isArray(item.findings)
      ? item.findings.map((finding) => ({
          title: finding.title ?? "지적사항",
          detail: truncateText(finding.detail ?? "상세 내용 없음", 260),
        }))
      : [];

  const resolvedYear = override?.year ?? resolveImportedYear(item, fileName, isFailed);
  const manualIssueTitles = getManualIssueTitleOverride({ institution, type });
  const comprehensiveIssueTitles = getComprehensiveIssueTitlesForAudit({
    institution,
    type,
  }) ?? [];
  const issueTitles = filterIssueTitlesForDisplay([
    ...(Array.isArray(manualIssueTitles) ? manualIssueTitles : []),
    ...comprehensiveIssueTitles,
    ...collectIssueTitlesFromAudit({
      findings: normalizedFindings,
      issueTitles: item.issueTitles ?? [],
      summary: normalizedSummary,
      originalText: item.originalText ?? item.ocrText ?? item.content ?? item.rawText ?? "",
      ocrText: item.ocrText ?? "",
      content: item.content ?? "",
      rawText: item.rawText ?? "",
    }),
  ]);

  return {
    id: item.id ?? item.fileId ?? item.fileName ?? `imported-${index}`,
    institution,
    institutionKind,
    type,
    region: item.region ?? "",
    year: resolvedYear,
    auditDate: override?.auditDate ?? item.auditDate ?? item.date ?? "",
    auditPeriod: override?.auditPeriod ?? item.auditPeriod ?? "",
    status: isFailed ? "OCR 실패" : baseStatus,
    summary: normalizedSummary,
    findings: normalizedFindings,
    issueTitles,
    fileName: fileName || undefined,
    filePath: item.filePath ?? item.pdfPath ?? "",
    pdfUrl: item.pdfUrl ?? item.pdfDownloadUrl ?? item.downloadUrl ?? item.driveUrl ?? item.fileUrl ?? item.url ?? "",
    fileSize: item.fileSize ?? null,
    lastWriteTime: item.lastWriteTime ?? "",
    source: item.source ?? (fileName ? "file-index" : "imported"),
  };
}

async function loadAuditIndexFromJson(url = "audit-index.json") {
  await loadComprehensiveIssueTitleMap();

  const cacheBustedUrl = `${url}${url.includes("?") ? "&" : "?"}v=${Date.now()}`;
  const response = await fetch(cacheBustedUrl, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`인덱스 파일을 불러오지 못했습니다. (${response.status})`);
  }

  const parsed = await response.json();
  const normalized = Array.isArray(parsed) ? parsed : parsed.audits;

  if (!Array.isArray(normalized)) {
    throw new Error("인덱스 JSON은 배열 또는 { audits: [] } 형식이어야 합니다.");
  }

  state.audits = normalized.map((audit, index) => normalizeImportedAudit(audit, index));
  state.filters.institutionSearch = "";
  state.filters.keywordSearch = "";
  state.filters.type = "all";
  state.filters.year = "all";
  state.selectedId = state.audits[0]?.id ?? null;
  state.dataSource = "index";
  state.dataSourceLabel = url;
  state.dataSourceUrl = url;
  state.ocrText = "";
  state.ocrResult = null;
  state.ocrAnalysis = null;
  state.ocrStatus = `${state.audits.length}개 인덱스 로드됨`;
  persistAppState();
  reconcileKeywordSearchAudits();
  render();
}

async function loadKeywordSearchIndex(url = "/api/keyword-audit-source.csv") {
  const cacheBustedUrl = `${url}${url.includes("?") ? "&" : "?"}v=${Date.now()}`;
  const response = await fetch(cacheBustedUrl, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`키워드 검색 파일을 불러오지 못했습니다. (${response.status})`);
  }

  const rawText = await response.text();
  const normalizedText = rawText.replace(/^\uFEFF/, "");
  const lines = normalizedText.split(/\r?\n/);
  const headerLineIndex = lines.findIndex((line) => {
    const parsedLine = parseCsv(line);
    const headerCells = parsedLine.headers.map((header) => normalizeKeywordSearchText(header));
    return (
      headerCells[0] === normalizeKeywordSearchText("연도") &&
      headerCells[1] === normalizeKeywordSearchText("학교명") &&
      headerCells[2] === normalizeKeywordSearchText("구분")
    );
  });

  if (headerLineIndex < 0) {
    throw new Error("키워드 검색 CSV에서 실제 헤더를 찾지 못했습니다.");
  }

  const parsedCsv = parseCsv(lines.slice(headerLineIndex).join("\n"));
  const headers = parsedCsv.headers.map((header) => normalizeSingleLineText(header));
  const findHeaderIndex = (pattern) => {
    const normalizedPattern = normalizeKeywordSearchText(pattern);
    return headers.findIndex((header) => normalizeKeywordSearchText(header).includes(normalizedPattern));
  };
  const yearIndex = findHeaderIndex("연도");
  const schoolIndex = findHeaderIndex("학교명");
  const typeIndex = findHeaderIndex("구분");
  const titleIndex = findHeaderIndex("제목") >= 0 ? findHeaderIndex("제목") : findHeaderIndex("지적건명");
  const detailIndex = findHeaderIndex("지적내용");

  if (yearIndex < 0 || schoolIndex < 0 || typeIndex < 0 || titleIndex < 0 || detailIndex < 0) {
    throw new Error("키워드 검색 CSV의 필수 열을 찾지 못했습니다.");
  }

  state.keywordAudits = parsedCsv.rows.map((values, index) => {
    const year = Number(values[yearIndex]);
    const institution = normalizeSingleLineText(values[schoolIndex]);
    const type = normalizeSingleLineText(values[typeIndex]);
    const summary = normalizeSingleLineText(values[titleIndex]);
    const detail = normalizeSingleLineText(values[detailIndex]);

    return {
      id: `keyword-${String(index + 1).padStart(5, "0")}`,
      institution,
      institutionKind: "",
      type,
      region: "",
      year: Number.isFinite(year) ? year : 0,
      auditDate: "",
      auditPeriod: "",
      status: "",
      summary,
      detailText: detail,
      findings: detail ? [{ title: "지적내용", detail }] : [],
      issueTitles: summary ? [summary] : [],
      fileName: "('26. 5. 14.) 2017년 이후 교육부 감사 결과(국공립 포함).csv",
      source: "keyword-csv",
    };
  });

  state.keywordDataSourceLabel = "('26. 5. 14.) 2017년 이후 교육부 감사 결과(국공립 포함).csv";
  state.keywordDataSourceUrl = url;
  reconcileKeywordSearchAudits();
  return state.keywordAudits;
}

function updateOcrJobStatus(jobId, status, statusClass = "medium", error = "") {
  const job = state.ocrJobs.find((item) => item.id === jobId);
  if (!job) {
    return;
  }

  job.status = status;
  job.statusClass = statusClass;
  job.error = error;
}

function renderStats(audits) {
  const statsGrid = $("#statsSection");
  const stats = aggregateStats(audits);

  statsGrid.innerHTML = stats
    .map(
      (stat) => `
        <article class="stat">
          <div class="stat-label">${escapeHtml(stat.label)}</div>
          <div class="stat-value">${escapeHtml(stat.value)}</div>
        </article>
      `
    )
    .join("");
}

function renderDashboardSource() {
  const badge = $("#dataSourceBadge");
  const sourceLabel =
    state.currentStep === 2
      ? state.keywordDataSourceLabel || "키워드 검색 원본"
      : state.dataSourceLabel ||
        (state.dataSource === "index" ? "audit-index.json" : state.dataSource === "ocr" ? "OCR 결과" : "샘플 데이터");

  if (badge) {
    badge.textContent = sourceLabel;
    badge.className = `badge ${
      state.currentStep === 2
        ? "medium"
        : state.dataSource === "index"
          ? "low"
          : state.dataSource === "ocr"
            ? "high"
            : "medium"
    }`;
  }
}

function syncOcrControls() {
  const engineSelect = $("#ocrEngineSelect");
  const modeSelect = $("#upstageModeSelect");

  if (engineSelect) {
    engineSelect.value = state.ocrEngine;
  }

  if (modeSelect) {
    modeSelect.value = state.upstageMode;
  }
}

function syncFilterControls() {
  const institutionSearchInput = $("#institutionSearchInput");
  if (institutionSearchInput) {
    institutionSearchInput.value = state.filters.institutionSearch;
  }

  const keywordSearchInput = $("#keywordSearchInput");
  if (keywordSearchInput) {
    keywordSearchInput.value = state.filters.keywordSearch;
  }

  const filterSummary = $("#filterSummary");
  if (filterSummary) {
    filterSummary.textContent = buildActiveFilterSummary();
  }
}

function populateTypeFilter(audits) {
  const select = $("#typeFilter");
  if (!select) {
    return;
  }

  const currentValue = state.filters.type || "all";
  const types = [...new Set(
    audits
      .map((audit) => normalizeSingleLineText(audit?.type ?? ""))
      .filter(Boolean)
  )].sort((a, b) => a.localeCompare(b, "ko"));

  select.innerHTML = [
    '<option value="all">전체</option>',
    ...types.map((type) => `<option value="${escapeHtml(type)}">${escapeHtml(type)}</option>`),
  ].join("");

  if ([...select.options].some((option) => option.value === currentValue)) {
    select.value = currentValue;
  } else {
    state.filters.type = "all";
    select.value = "all";
  }
}

function populateYearFilter(audits) {
  const select = $("#yearFilter");
  if (!select) {
    return;
  }

  const currentValue = state.filters.year || "all";
  const years = [...new Set(
    audits
      .map((audit) => Number(audit?.year))
      .filter((year) => Number.isFinite(year) && year > 0)
  )].sort((a, b) => b - a);

  const options = ['<option value="all">전체</option>']
    .concat(years.map((year) => `<option value="${year}">${year}</option>`))
    .join("");

  select.innerHTML = options;

  if ([...select.options].some((option) => option.value === currentValue)) {
    select.value = currentValue;
  } else {
    state.filters.year = "all";
    select.value = "all";
  }
}

function formatAuditTypeLabel(value) {
  const text = normalizeSingleLineText(value);
  return text || "-";
}

function getAuditStatusClass(status) {
  const normalized = String(status || "").toLowerCase();
  if (normalized.includes("완료") || normalized.includes("종결") || normalized.includes("처리")) {
    return "good";
  }
  if (normalized.includes("시정") || normalized.includes("권고") || normalized.includes("개선")) {
    return "warn";
  }
  if (normalized.includes("미") || normalized.includes("불") || normalized.includes("부적")) {
    return "bad";
  }
  return "medium";
}

function goToStep(step) {
  const normalized = Math.max(1, Math.min(2, Number(step) || 1));
  state.currentStep = normalized;
}

function renderStepLayout() {
  const step1Btn = $("#step1Btn");
  const step2Btn = $("#step2Btn");
  const stepPrevBtn = $("#stepPrevBtn");
  const stepNextBtn = $("#stepNextBtn");
  const isStep1 = state.currentStep === 1;

  if (step1Btn) {
    step1Btn.classList.toggle("active", isStep1);
  }
  if (step2Btn) {
    step2Btn.classList.toggle("active", !isStep1);
  }
  if (stepPrevBtn) {
    stepPrevBtn.disabled = isStep1;
  }
  if (stepNextBtn) {
    stepNextBtn.disabled = !isStep1;
  }
}

function renderList(audits) {
  const list = $("#auditList");
  const resultCount = $("#resultCount");
  const listPanelTitle = $("#listPanel h3");

  if (listPanelTitle) {
    listPanelTitle.textContent = getStepResultLabel();
  }

  resultCount.textContent = `${audits.length}건`;

  if (audits.length === 0) {
    const emptyMessage =
      state.currentStep === 2 && !state.filters.keywordSearch.trim()
        ? "키워드를 입력하면 검색 결과가 표시됩니다."
        : state.currentStep === 1
          ? "통합검색 결과가 없습니다."
          : "표시할 데이터가 없습니다.";
    list.innerHTML = `
      <div class="empty-state">
        ${emptyMessage}
      </div>
    `;
    return;
  }

  if (state.currentStep === 2) {
    list.innerHTML = buildKeywordResultTableHtml(audits);
    list.querySelectorAll(".keyword-result-table tbody tr").forEach((row) => {
      row.addEventListener("click", () => {
        state.selectedId = row.dataset.id;
        render();
      });
    });
    return;
  }

  list.innerHTML = `
    <div class="result-list">
      ${audits
        .map((audit) => {
          const active = audit.id === state.selectedId ? "active" : "";
          const targetText = normalizeAuditInstitutionLabel(formatAuditTarget(audit));
          const typeLabel = normalizeSingleLineText(formatAuditTypeLabel(audit.type));
          const regionLabel = normalizeSingleLineText(audit.region ?? "");
          const yearBadge = audit.year ? `<span class="badge subdued year-badge">${escapeHtml(String(audit.year))}년</span>` : "";
          const eyebrowText = [escapeHtml(typeLabel), yearBadge, regionLabel ? escapeHtml(regionLabel) : ""]
            .filter(Boolean)
            .join(" · ");
          const summaryRaw = normalizeSingleLineText(audit.summary || formatAuditContent(audit));
          const hideSummary = !summaryRaw || /^(미상|파일명 기반 인덱스|요약 없음|내용 없음)$/i.test(summaryRaw);
          const summaryText = hideSummary ? "" : escapeHtml(summaryRaw);
          const pdfDownloadUrl = buildPdfDownloadUrl(audit);
          const resultActions = `
            <div class="result-card-actions">
              ${buildExternalSearchLink(audit)}
              ${buildActionLink(pdfDownloadUrl, "PDF 원문 열기", "pdf-action")}
            </div>
          `;
          return `
            <article class="result-card ${active}" data-id="${escapeHtml(audit.id)}">
              <div class="result-card-head">
                <div>
                  <p class="eyebrow">${eyebrowText}</p>
                  <h4>${escapeHtml(targetText)}</h4>
                </div>
              </div>
              ${summaryText ? `<p class="result-summary">${summaryText}</p>` : ""}
              ${resultActions}
            </article>
          `;
        })
        .join("")}
    </div>
  `;

  list.querySelectorAll(".result-card").forEach((card) => {
    card.addEventListener("click", () => {
      state.selectedId = card.dataset.id;
      render();
    });
  });

  list.querySelectorAll(".card-action-link").forEach((link) => {
    link.addEventListener("click", (event) => {
      event.stopPropagation();
    });
  });
}

function renderOcrQueue() {
  const queue = $("#ocrQueue");
  if (!queue) {
    return;
  }

  if (!state.ocrJobs.length) {
    queue.innerHTML = `
      <div class="queue-item">
        <div class="queue-item-title">
          <span>대기열이 비어 있습니다</span>
        </div>
        <small>PDF 파일을 선택하면 이 영역에 쌓입니다.</small>
      </div>
    `;
    return;
  }

  queue.innerHTML = state.ocrJobs
      .map(
        (job) => `
        <article class="queue-item">
          <div class="queue-item-title">
            <span>${escapeHtml(job.name)}</span>
            <span class="badge ${job.statusClass ?? "medium"}">${escapeHtml(job.status)}</span>
          </div>
          <small>${escapeHtml(job.sizeLabel ? `${job.sizeLabel} · ` : "")}${escapeHtml(job.type)}</small>
          ${job.engine ? `<small class="muted">엔진: ${escapeHtml(job.engine)}</small>` : ""}
          ${job.relativePath ? `<small class="muted">${escapeHtml(job.relativePath)}</small>` : ""}
          ${job.error ? `<small class="muted">${escapeHtml(job.error)}</small>` : ""}
        </article>
      `
    )
    .join("");
}

function renderOcrOutput(content, analysis = null) {
  const output = $("#ocrOutput");
  if (!output) {
    return;
  }

  const analysisBlock = analysis
    ? `
      <div class="ocr-analysis">
        <div>페이지 수: ${escapeHtml(analysis.pageCount ?? 0)}</div>
        <div>텍스트 추출: ${escapeHtml(analysis.textPages ?? 0)}</div>
        <div>이미지 OCR: ${escapeHtml(analysis.ocrPages ?? 0)}</div>
        <div>평균 신뢰도: ${escapeHtml(
          analysis.averageConfidence ? `${analysis.averageConfidence.toFixed(1)}%` : "-"
        )}</div>
        ${
          analysis.ocrPages > 0 && analysis.averageConfidence > 0 && analysis.averageConfidence < 70
            ? '<div class="warn">경고: 스캔 품질이 낮아 오인식 가능성이 있습니다.</div>'
            : analysis.ocrPages > 0 && analysis.averageConfidence > 0 && analysis.averageConfidence < 85
              ? '<div class="warn">주의: 일부 페이지는 재확인이 필요할 수 있습니다.</div>'
              : ""
        }
      </div>
    `
    : "";

  if (!content) {
    output.classList.add("empty-state");
    output.innerHTML = `${analysisBlock || ""}아직 분석된 결과가 없습니다.`;
    return;
  }

  output.classList.remove("empty-state");
  output.innerHTML = `${analysisBlock}<pre>${escapeHtml(content)}</pre>`;
}

function renderOcrStatus(text) {
  const status = $("#ocrStatus");
  if (!status) {
    return;
  }
  status.textContent = text;
}

function formatSize(bytes) {
  if (!bytes && bytes !== 0) {
    return "";
  }

  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  return `${size.toFixed(size < 10 && unitIndex > 0 ? 1 : 0)}${units[unitIndex]}`;
}

function enqueuePdfFiles(fileList) {
  const files = Array.from(fileList ?? []).filter((file) => {
    const name = String(file.name ?? "").toLowerCase();
    return name.endsWith(".pdf");
  });
  const newJobs = [];

  files.forEach((file) => {
    newJobs.push({
      id: `job-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      name: file.name,
      relativePath: file.webkitRelativePath || file.name,
      type: file.type || "application/pdf",
      sizeLabel: formatSize(file.size),
      status: "대기 중",
      statusClass: "medium",
      engine: state.ocrEngine,
      file,
    });
  });

  state.ocrJobs = [...newJobs, ...state.ocrJobs];
  state.ocrStatus = files.length ? `${files.length}개 PDF가 대기열에 추가됨` : "대기 중";
  renderOcr();
  void processQueuedPdfJobs();
}

function parseAndAddAudit(text, source = "local-ocr") {
  const normalized = normalizeText(text);
  if (!normalized) {
    throw new Error("분석할 텍스트가 비어 있습니다.");
  }

  const record = createAuditRecordFromText(normalized, source);
  state.audits = [record, ...state.audits];
  state.selectedId = record.id;
  state.ocrText = normalized;
  state.ocrResult = record;
  state.ocrStatus = "분석 완료";
  render();

  return record;
}

function renderOcr() {
  if (!$("#ocrQueue") && !$("#ocrOutput") && !$("#ocrStatus")) {
    return;
  }
  renderOcrQueue();
  renderOcrStatus(state.ocrStatus);

  if (state.ocrResult) {
    renderOcrOutput(JSON.stringify(state.ocrResult, null, 2), state.ocrAnalysis);
  } else if (state.ocrText) {
    renderOcrOutput(state.ocrText, state.ocrAnalysis);
  } else {
    renderOcrOutput("");
  }
}

async function processQueuedPdfJobs() {
  if (state.ocrProcessing) {
    return;
  }

  state.ocrProcessing = true;
  try {
    for (const job of state.ocrJobs) {
      if (job.status !== "대기 중") {
        continue;
      }
      const engine = job.engine || state.ocrEngine;

      if (engine === "local" && !hasOcrRuntime()) {
        updateOcrJobStatus(job.id, "엔진 필요", "critical", "pdf.js 또는 Tesseract.js가 로드되지 않았습니다.");
        state.ocrStatus = `${job.name} 처리 불가 (로컬 OCR 런타임 없음)`;
        renderOcr();
        continue;
      }

      state.ocrResult = null;
      state.ocrAnalysis = null;
      updateOcrJobStatus(job.id, "처리 중", "high");
      state.ocrStatus = `처리 중: ${job.name}`;
      renderOcr();

      try {
        let record;
        let analysis;
        let textResult = "";

        if (engine === "gemini") {
          const extracted = await parsePdfWithGemini(job.file, (pageNumber, stage, progress) => {
            state.ocrStatus = `${job.name} · ${stage}`;
            updateOcrJobStatus(job.id, `${Math.round(progress * 100)}%`, "high");
            renderOcr();
          });
          record = extracted;
          analysis = {
            pageCount: 1,
            textPages: 1,
            ocrPages: 0,
            averageConfidence: 100,
          };
          textResult = extracted.summary;
          state.audits = [record, ...state.audits];
        } else {
          const extracted =
            engine === "upstage"
              ? await parsePdfWithUpstage(job.file, state.upstageMode, (pageNumber, stage, progress) => {
                  state.ocrStatus = `${job.name} · ${pageNumber}페이지 · ${stage}`;
                  updateOcrJobStatus(job.id, `${pageNumber}p ${Math.round(progress * 100)}%`, "high");
                  renderOcr();
                })
              : await extractTextFromPdfFile(job.file, (pageNumber, stage, progress) => {
                  state.ocrStatus = `${job.name} · ${pageNumber}페이지 · ${stage}`;
                  updateOcrJobStatus(job.id, `${pageNumber}p ${Math.round(progress * 100)}%`, "high");
                  renderOcr();
                });

          textResult = extracted.plainText ?? extracted.text ?? extracted.structuredText ?? "";
          record = parseAndAddAudit(textResult, engine === "upstage" ? "upstage" : "local-ocr");
          analysis = {
            pageCount: extracted.pageCount ?? extracted.meta?.pageCount ?? 1,
            textPages: extracted.textPages ?? extracted.meta?.textPages ?? 0,
            ocrPages: extracted.ocrPages ?? extracted.meta?.ocrPages ?? 0,
            averageConfidence: extracted.averageConfidence ?? extracted.meta?.averageConfidence ?? 0,
          };
        }

        state.selectedId = record.id;
        state.ocrText = textResult;
        state.ocrResult = record;
        state.ocrAnalysis = analysis;
        state.dataSource = "ocr";

        const confidence = analysis.averageConfidence || 0;
        updateOcrJobStatus(
          job.id,
          confidence && confidence < 70 ? "완료(주의)" : "완료",
          confidence && confidence < 70 ? "medium" : "low"
        );
        state.ocrStatus = `${job.name} 분석 완료`;
        render();
      } catch (error) {
        updateOcrJobStatus(job.id, "실패", "critical", error.message);
        state.ocrStatus = `${job.name} 처리 실패`;
        renderOcr();
      }
    }
  } finally {
    state.ocrProcessing = false;
    if (!state.ocrJobs.some((job) => job.status === "대기 중" || job.status === "처리 중")) {
      state.ocrStatus = "모든 작업 완료";
    }
    renderOcr();
  }
}

function render() {
  const audits = getDisplayedAudits();

  if (!audits.some((audit) => audit.id === state.selectedId)) {
    state.selectedId = audits[0]?.id ?? null;
  }

  renderStepLayout();
  populateTypeFilter(state.audits);
  populateYearFilter(state.audits);
  syncFilterControls();
  syncOcrControls();
  renderStats(audits);
  renderDashboardSource();
  renderList(audits);
  renderOcr();
}

function readUploadedFile(file) {
  const reader = new FileReader();

  reader.onload = () => {
    try {
      const parsed = JSON.parse(String(reader.result));
      const normalized = Array.isArray(parsed) ? parsed : parsed.audits;

      if (!Array.isArray(normalized)) {
        throw new Error("JSON은 배열 또는 { audits: [] } 형식이어야 합니다.");
      }

      state.audits = normalized.map((audit, index) => normalizeImportedAudit(audit, index));

      state.selectedId = state.audits[0]?.id ?? null;
      state.dataSource = "index";
      state.dataSourceLabel = file.name;
      state.dataSourceUrl = "";
      persistAppState();
      render();
    } catch (error) {
      window.alert(`파일을 읽지 못했습니다: ${error.message}`);
    }
  };

  reader.readAsText(file, "utf-8");
}

function exportFilteredData() {
  const audits = getDisplayedAudits();
  const payload = JSON.stringify({ exportedAt: new Date().toISOString(), audits }, null, 2);
  const blob = new Blob([payload], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = `audit-results-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function bindEvents() {
  $("#step1Btn").addEventListener("click", () => {
    goToStep(1);
    render();
  });

  $("#step2Btn").addEventListener("click", () => {
    goToStep(2);
    render();
  });

  $("#stepPrevBtn").addEventListener("click", () => {
    goToStep(state.currentStep - 1);
    render();
  });

  $("#stepNextBtn").addEventListener("click", () => {
    goToStep(state.currentStep + 1);
    render();
  });

  const institutionSearchInput = $("#institutionSearchInput");
  if (institutionSearchInput) {
    institutionSearchInput.addEventListener("input", (event) => {
      state.filters.institutionSearch = event.target.value;
      render();
    });
  }

  const keywordSearchInput = $("#keywordSearchInput");
  if (keywordSearchInput) {
    keywordSearchInput.addEventListener("input", (event) => {
      state.filters.keywordSearch = event.target.value;
      if (event.target.value.trim()) {
        state.currentStep = 2;
      }
      render();
    });
  }

  $("#typeFilter").addEventListener("change", (event) => {
    state.filters.type = event.target.value;
    render();
  });

  $("#yearFilter").addEventListener("change", (event) => {
    state.filters.year = event.target.value;
    render();
  });

  const clearFiltersButton = $("#clearFiltersButton");
  if (clearFiltersButton) {
    clearFiltersButton.addEventListener("click", () => {
      state.filters.institutionSearch = "";
      state.filters.keywordSearch = "";
      state.filters.type = "all";
      state.filters.year = "all";
      render();
    });
  }

  const fileInput = $("#fileInput");
  if (fileInput) {
    fileInput.addEventListener("change", (event) => {
      const [file] = event.target.files ?? [];
      if (file) {
        readUploadedFile(file);
      }
    });
  }

  const keywordChips = document.querySelectorAll(".keyword-chip");
  keywordChips.forEach((chip) => {
    chip.addEventListener("click", () => {
      const value = chip.textContent?.trim() ?? "";
      if (!value || !keywordSearchInput) {
        return;
      }
      state.filters.keywordSearch = value;
      keywordSearchInput.value = value;
      state.currentStep = 2;
      render();
      keywordSearchInput.focus();
    });
  });

  const resetButton = $("#resetButton");
  if (resetButton) {
    resetButton.addEventListener("click", () => {
      state.audits = sampleAudits;
      state.dataSource = "sample";
      state.dataSourceLabel = "샘플 데이터";
      state.dataSourceUrl = "";
      state.filters.institutionSearch = "";
      state.filters.keywordSearch = "";
      state.filters.type = "all";
      state.filters.year = "all";
      state.selectedId = sampleAudits[0]?.id ?? null;
      state.ocrResult = null;
      state.ocrText = "";
      state.ocrAnalysis = null;
      state.ocrJobs = [];
      state.ocrStatus = "대기 중";
      persistAppState();
      render();
    });
  }

  if ($("#exportButton")) {
    $("#exportButton").addEventListener("click", exportFilteredData);
  }

  const loadIndexButton = $("#loadIndexButton");
  if (loadIndexButton) {
    loadIndexButton.addEventListener("click", async () => {
      try {
        await loadAuditIndexFromJson();
      } catch (error) {
        window.alert(error.message);
      }
    });
  }

  const pdfInput = $("#pdfInput");
  if (pdfInput) {
    pdfInput.addEventListener("change", (event) => {
      enqueuePdfFiles(event.target.files);
      event.target.value = "";
    });
  }

  const ocrEngineSelect = $("#ocrEngineSelect");
  if (ocrEngineSelect) {
    ocrEngineSelect.addEventListener("change", (event) => {
      state.ocrEngine = event.target.value;
      state.ocrStatus =
        state.ocrEngine === "gemini" ? "Gemini 분석 준비됨" :
        state.ocrEngine === "upstage" ? "Upstage 파싱 준비됨" : "로컬 OCR 준비됨";
      renderOcr();
    });
  }

  const upstageModeSelect = $("#upstageModeSelect");
  if (upstageModeSelect) {
    upstageModeSelect.addEventListener("change", (event) => {
      state.upstageMode = event.target.value;
      render();
    });
  }

  const analyzeButton = $("#analyzeButton");
  if (analyzeButton) {
    analyzeButton.addEventListener("click", () => {
      try {
        const text = $("#ocrTextInput").value.trim();
        state.dataSource = "ocr";
        state.dataSourceUrl = "";
        state.ocrAnalysis = {
          pageCount: 1,
          textPages: 1,
          ocrPages: 0,
          averageConfidence: 100,
        };
        const record = parseAndAddAudit(text, "manual-text");
        persistAppState();
        renderOcrOutput(JSON.stringify(record, null, 2));
      } catch (error) {
        state.ocrStatus = error.message;
        renderOcr();
        window.alert(error.message);
      }
    });
  }

  const loadSampleTextButton = $("#loadSampleTextButton");
  if (loadSampleTextButton) {
    loadSampleTextButton.addEventListener("click", () => {
      $("#ocrTextInput").value = sampleOcrText;
      state.ocrText = sampleOcrText;
      state.ocrResult = createAuditRecordFromText(sampleOcrText, "sample-text");
      state.ocrAnalysis = {
        pageCount: 1,
        textPages: 1,
        ocrPages: 0,
        averageConfidence: 100,
      };
      state.dataSource = "ocr";
      state.ocrStatus = "샘플 텍스트 로드됨";
      state.dataSourceUrl = "";
      persistAppState();
      renderOcr();
    });
  }
}


function showFileProtocolNotice() {
  const shell = document.querySelector(".shell");
  if (!shell) {
    return;
  }

  shell.innerHTML = `
    <main class="content">
      <section class="panel">
        <h1>브라우저로 직접 연 파일입니다</h1>
        <p class="muted">
          이 대시보드는 "index.html"을 파일로 여는 방식보다 로컬 서버로 여는 방식이 안정적입니다.
        </p>
        <p>
          먼저 터미널에서 <code>npm start</code>를 실행한 뒤
          <code>http://127.0.0.1:3000/</code>으로 접속해 주세요.
        </p>
        <p class="muted">
          필요하면 <code>npm run open</code>으로 브라우저를 바로 열 수 있습니다.
        </p>
      </section>
    </main>
  `;
}



async function initializeApp() {
  if (window.location.protocol === "file:") {
    showFileProtocolNotice();
    return;
  }

  bindEvents();
  await loadComprehensiveIssueTitleMap();
  const keywordSearchDataPromise = loadKeywordSearchIndex()
    .then((keywordAudits) => {
      if (state.currentStep === 2 || state.filters.keywordSearch.trim()) {
        render();
      }
      return keywordAudits;
    })
    .catch((error) => {
      console.warn(error);
      state.keywordAudits = [];
      state.keywordDataSourceLabel = "키워드 검색 원본";
      state.keywordDataSourceUrl = "";
      if (state.currentStep === 2 || state.filters.keywordSearch.trim()) {
        render();
      }
      return state.keywordAudits;
    });

  const savedState = loadPersistedAppState();

  if (savedState?.dataSource === "uploaded-json" && Array.isArray(savedState.audits) && savedState.audits.length) {
    state.audits = savedState.audits.map((audit, index) => normalizeImportedAudit(audit, index));
    state.dataSource = "uploaded-json";
    state.dataSourceLabel = savedState.dataSourceLabel || "업로드한 JSON";
    state.dataSourceUrl = "";
    state.selectedId = savedState.selectedId && state.audits.some((audit) => audit.id === savedState.selectedId)
      ? savedState.selectedId
      : state.audits[0]?.id ?? null;
    state.filters.institutionSearch = "";
    state.filters.keywordSearch = "";
    state.filters.type = "all";
    state.filters.year = "all";
    reconcileKeywordSearchAudits();
    render();
    await keywordSearchDataPromise;
    return;
  }

  const preferredSource = "audit-index.json";
  try {
    await loadAuditIndexFromJson(preferredSource);
    await keywordSearchDataPromise;
    return;
  } catch (_error) {
    try {
      await loadAuditIndexFromJson("ocr-results.json");
      await keywordSearchDataPromise;
      return;
    } catch (_error2) {
      try {
        await loadAuditsFromAPI();
        await keywordSearchDataPromise;
        return;
      } catch (_error3) {
        state.dataSource = "sample";
        state.dataSourceLabel = "샘플 데이터";
        state.dataSourceUrl = "";
        state.audits = sampleAudits;
        state.selectedId = sampleAudits[0]?.id ?? null;
        reconcileKeywordSearchAudits();
        await keywordSearchDataPromise;
        render();
      }
    }
  }
}

initializeApp();
