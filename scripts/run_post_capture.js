const http = require('http');
const fs = require('fs');
const path = require('path');
const data = JSON.stringify({ fullName: 'Script Test', email: 'script@test.example', phone: '+999', country: 'Testland' });
const opts = { host: '127.0.0.1', port: 3000, path: '/api/visitors', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } };
const req = http.request(opts, (res) => { let b=''; res.on('data', c => b+=c); res.on('end', () => { fs.writeFileSync(path.join(__dirname,'..','tmp_post_result.json'), JSON.stringify({status:res.statusCode,body:b}), 'utf8'); console.log('WROTE tmp_post_result.json'); }); });
req.on('error', (e) => { fs.writeFileSync(path.join(__dirname,'..','tmp_post_result.json'), JSON.stringify({error: e.message}), 'utf8'); console.error('ERR'); });
req.write(data);
req.end();
