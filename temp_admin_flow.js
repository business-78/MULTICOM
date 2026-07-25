const http = require('http');
const querystring = require('querystring');
const creds = querystring.stringify({ username: 'admin', password: 'Admin@12345' });
const options = {
  hostname: '127.0.0.1',
  port: 3000,
  path: '/admin/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
    'Content-Length': Buffer.byteLength(creds),
    'Connection': 'keep-alive'
  }
};
const req = http.request(options, (res) => {
  console.log('login status', res.statusCode);
  console.log('set-cookie', res.headers['set-cookie']);
  const cookie = res.headers['set-cookie']?.map((c) => c.split(';')[0]).join('; ');
  let body = '';
  res.on('data', chunk => body += chunk.toString());
  res.on('end', () => {
    console.log('login body', body.slice(0, 300));
    if (cookie) {
      const opts2 = {
        hostname: '127.0.0.1',
        port: 3000,
        path: '/admin/dashboard',
        method: 'GET',
        headers: { Cookie: cookie }
      };
      const req2 = http.request(opts2, (res2) => {
        console.log('dashboard status', res2.statusCode);
        let body2 = '';
        res2.on('data', chunk => body2 += chunk.toString());
        res2.on('end', () => {
          console.log('dashboard body', body2.slice(0, 500));
        });
      });
      req2.on('error', (err) => console.error('dashboard request error', err));
      req2.end();
    }
  });
});
req.on('error', (err) => console.error('login request error', err));
req.write(creds);
req.end();
