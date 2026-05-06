const http = require('http');
http.get('http://localhost:3000/api/pdf/%EA%B3%A0%EA%B5%AC%EB%A0%A4%EB%8C%80%ED%95%99%EA%B5%90', res => {
  console.log('statusCode:', res.statusCode);
  console.log('headers:', res.headers);
  let data = '';
  res.on('data', chunk => data += chunk.toString('utf8'));
  res.on('end', () => console.log('body:', data.slice(0, 100)));
});
