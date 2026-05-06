const http = require('http');
const fs = require('fs');

http.get('http://localhost:3000/api/pdf/%EA%B1%B4%EC%96%91%EB%8C%80%ED%95%99%EA%B5%90', (res) => {
  console.log('Status Code:', res.statusCode);
  console.log('Headers:', res.headers);
  
  if (res.statusCode === 200) {
    const file = fs.createWriteStream('test.pdf');
    res.pipe(file);
    file.on('finish', () => {
      file.close();
      console.log('Download completed');
    });
  } else {
    res.setEncoding('utf8');
    let rawData = '';
    res.on('data', (chunk) => { rawData += chunk; });
    res.on('end', () => {
      console.log('Response body:', rawData);
    });
  }
}).on('error', (e) => {
  console.error(`Got error: ${e.message}`);
});
