const http = require('http');
const qs = require('querystring');

function getLoginPage() {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: 'localhost', port: 3000, path: '/admin/login', method: 'GET' }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ headers: res.headers, body: data, statusCode: res.statusCode }));
    });
    req.on('error', reject);
    req.end();
  });
}

function postLogin(cookie, csrfToken) {
  return new Promise((resolve, reject) => {
    const body = qs.stringify({ username: 'admin', password: 'Admin@12345', _csrf: csrfToken });
    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path: '/admin/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body),
        Cookie: cookie
      }
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ headers: res.headers, body: data, statusCode: res.statusCode }));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function getDashboard(cookie) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path: '/admin/dashboard',
      method: 'GET',
      headers: {
        Cookie: cookie
      }
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ headers: res.headers, body: data, statusCode: res.statusCode }));
    });
    req.on('error', reject);
    req.end();
  });
}

(async () => {
  try {
    const page = await getLoginPage();
    console.log('GET login status', page.statusCode);
    const csrf = (page.body.match(/name="_csrf" value="([^"]+)"/) || [])[1];
    console.log('CSRF', csrf);
    const cookie = (page.headers['set-cookie'] || []).map(c => c.split(';')[0]).join('; ');
    console.log('cookie', cookie);
    const login = await postLogin(cookie, csrf);
    console.log('login status', login.statusCode);
    console.log('login location', login.headers.location);
    const sessionCookie = (login.headers['set-cookie'] || []).map(c => c.split(';')[0]).join('; ');
    console.log('sessionCookie', sessionCookie);
    const combinedCookie = [cookie, sessionCookie].filter(Boolean).join('; ');
    console.log('combinedCookie', combinedCookie);
    const dash = await getDashboard(combinedCookie);
    console.log('dashboard status', dash.statusCode);
    console.log('dashboard body head', dash.body.slice(0, 200));
  } catch (err) {
    console.error('ERROR', err);
  }
})();
