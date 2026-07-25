const http = require('http');
const req = http.get('http://127.0.0.1:3000/api/stats', (res) => {
  console.log('status', res.statusCode);
  let body = '';
  res.on('data', (chunk) => body += chunk);
  res.on('end', () => console.log('body', body));
});
req.on('error', (err) => console.error('error', err.message));
