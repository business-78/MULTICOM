const http = require('http');
const qs = require('querystring');
const data = JSON.stringify({ fullName: 'Script Test', email: 'script@test.example', phone: '+999', country: 'Testland' });
const opts = { host: '127.0.0.1', port: 3000, path: '/api/visitors', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } };
const req = http.request(opts, (res) => { let b=''; res.on('data', c => b+=c); res.on('end', () => { console.log('status', res.statusCode, 'body', b); }); });
req.on('error', console.error);
req.write(data);
req.end();
