const http = require('http');
const qs = require('querystring');

function get() {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { hostname: 'localhost', port: 3000, path: '/admin/login', method: 'GET' },
      (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => resolve({ headers: res.headers, body: data, statusCode: res.statusCode }));
      }
    );
    req.on('error', reject);
    req.end();
  });
}

function post(cookie, csrf) {
  return new Promise((resolve, reject) => {
    const postData = qs.stringify({ username: 'admin', password: 'Admin@12345', _csrf: csrf });
    const req = http.request(
      {
        hostname: 'localhost',
        port: 3000,
        path: '/admin/login',
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(postData),
          Cookie: cookie
        }
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => resolve({ statusCode: res.statusCode, headers: res.headers, body: data }));
      }
    );
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

(async () => {
  try {
    const getRes = await get();
    console.log('GET STATUS', getRes.statusCode);
    console.log('GET SET-COOKIE', getRes.headers['set-cookie']);
    const match = getRes.body.match(/name="_csrf" value="([^"]+)"/);
    console.log('CSRF TOKEN', match ? match[1] : 'NOT_FOUND');
    const cookie = (getRes.headers['set-cookie'] || []).map((s) => s.split(';')[0]).join('; ');
    const postRes = await post(cookie, match ? match[1] : '');
    console.log('POST STATUS', postRes.statusCode);
    console.log('POST LOCATION', postRes.headers.location);
    console.log('POST BODY', postRes.body.slice(0, 400));
  } catch (error) {
    console.error('ERROR', error);
  }
})();
