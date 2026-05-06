const fs = require('fs');
const path = require('path');

const filePath = path.join(process.cwd(), '종합감사_정리표_정제본/명지대학교_종합감사_정리표.csv');
let content = fs.readFileSync(filePath, 'utf8');

console.log('Before:', content.split('원문 본문 OCR 필요').length - 1, 'OCR markers found');

// Item 7: 외부 심사위원 미위촉
content = content.replace('위촉하지 않은,원문 본문 OCR 필요\n8,', 
  '위촉하지 않은,기관경고; 통보 - 향후 채용심사 시 관련 규정을 준수하여 외부심사위원을 위촉하기 바람\n8,');

// Item 18: 임대료 보증금 계좌 관리 부적정
content = content.replace('관리하지 않고 운영비 계좌로 관리한,원문 본문 OCR 필요\n19,', 
  '관리하지 않고 운영비 계좌로 관리한,기관경고; 통보 - 임대보증금을 별도 계좌로 관리하여 교비회계 손실을 방지하기 바람\n19,');

// Item 20: 타인 학위논문 활용 교내연구비 부당 수령
content = content.replace('당 사 자 로 부 터 교내연구비 합계 6,000천원을 회수 하여 관련회계로 세입조치하기 바람 연 번 지 적 사 항 처 분 개발을 수행한 경우,원문 본문 OCR 필요\n21,',
  '당 사 자 로 부 터 교내연구비 합계 6,000천원을 회수 하여 관련회계로 세입조치하기 바람 연 번 지 적 사 항 처 분 개발을 수행한 경우,경징계(2명); 시정(회수) - 타인 (제자 등) 의 학위 논문을 요약 한 후 교내연구 결과물로 제출한 당 사 자 로 부 터 교내연구비 합계 6,000천원을 회수 하여 관련회계로 세입조치하기 바람\n21,');

// Item 31: 관할청 미신고 건축물 설치
content = content.replace('사용하고 있는,원문 본문 OCR 필요', 
  '사용하고 있는,기관경고; 통보 - 관할청에 건축물 신고를 하여 적법한 요건을 충족하기 바람');

console.log('After:', content.split('원문 본문 OCR 필요').length - 1, 'OCR markers found');

fs.writeFileSync(filePath, content, 'utf8');
console.log('✓ File updated successfully');
