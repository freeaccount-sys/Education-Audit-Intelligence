const fs = require('fs');
const path = require('path');
const csv = require('csv-parse/sync');

const INPUT_DIR = path.join(__dirname, '..', '종합감사_정리표_정제본');
const OUTPUT_FILE = path.join(__dirname, '..', 'audit-data.json');

function normalizeInstitutionName(filename) {
  return filename.replace('_종합감사_정리표.csv', '').trim();
}

function convertCsvToAudits() {
  const files = fs.readdirSync(INPUT_DIR)
    .filter(f => f.endsWith('_종합감사_정리표.csv') && !f.includes('.tmp'))
    .sort();

  const audits = [];

  files.forEach((file, index) => {
    const filePath = path.join(INPUT_DIR, file);
    const institutionName = normalizeInstitutionName(file);

    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const records = csv.parse(content, {
        columns: true,
        skip_empty_lines: true,
      });

      if (!records || records.length === 0) {
        console.log(`⚠️  ${institutionName}: 데이터 없음`);
        return;
      }

      const findings = records.map((row, idx) => ({
        no: row['연번'] || `${idx + 1}`,
        title: row['지적사항'] || '지적사항 없음',
        detail: row['주요내용(요약)'] || '',
      }));

      const dispositions = records
        .map(r => r['처분요구'] || '')
        .filter(d => d && d.trim() && d !== '원문 본문 OCR 필요')
        .slice(0, 3);

      const summary = findings.slice(0, 2)
        .map(f => f.title)
        .join(', ');

      const audit = {
        id: `audit-${institutionName}`,
        institution: institutionName,
        institutionKind: '사립대학',
        type: '종합감사',
        region: '미분류',
        year: 2024,
        auditDate: '2024-01-01',
        status: dispositions[0] || '조치 대기',
        summary: summary || `${findings.length}개 항목 지적`,
        findings: findings.slice(0, 20).map(f => ({
          title: f.title,
          detail: f.detail,
        })),
        totalFindings: findings.length,
      };

      audits.push(audit);
      console.log(`✓ ${institutionName}: ${findings.length} 항목`);
    } catch (error) {
      console.error(`✗ ${institutionName}:`, error.message);
    }
  });

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(audits, null, 2), 'utf-8');
  console.log(`\n✓ 완료: ${OUTPUT_FILE}`);
  console.log(`  - 총 ${audits.length}개 대학 변환됨`);
}

convertCsvToAudits();
