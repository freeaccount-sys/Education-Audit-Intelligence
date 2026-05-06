const fs = require('fs');
const files = fs.readdirSync('.').filter(f => f.endsWith('.json'));
files.forEach(f => {
  let content = fs.readFileSync(f, 'utf8');
  if (content.includes('대구가톨릭대')) {
    content = content.replace(/"institution"\s*:\s*"대구가톨릭대"/g, '"institution": "대구가톨릭대학교"');
    fs.writeFileSync(f, content);
    console.log('Updated ' + f);
  }
});
