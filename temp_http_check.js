const http = require('http');
const options = {
  hostname: '127.0.0.1',
  port: 3000,
  path: '/admin/dashboard',
  method: 'GET',
  headers: {
    'User-Agent': 'Node.js'
  }
};
const req = http.request(options, (res) => {
  console.log('statusCode', res.statusCode);
  console.log('headers', res.headers);
  let body = '';
  res.on('data', chunk => body += chunk.toString());
  res.on('end', () => {
    console.log('bodyPreview', body.slice(0, 300));
  });
});
req.on('error', (err) => {
  console.error('request error', err.message);
});
req.end();
