const http = require('http');
const qs = require('querystring');
const fs = require('fs');

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

function postLogin(cookie, csrf) {
  return new Promise((resolve, reject) => {
    const payload = qs.stringify({ username: 'admin', password: 'Admin@12345', _csrf: csrf });
    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path: '/admin/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(payload),
        Cookie: cookie
      }
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ headers: res.headers, body: data, statusCode: res.statusCode }));
    });
    req.on('error', reject);
    req.write(payload);
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
      headers: { Cookie: cookie }
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
  const output = [];
  try {
    const loginPage = await getLoginPage();
    output.push(`GET status: ${loginPage.statusCode}`);
    output.push(`GET set-cookie: ${JSON.stringify(loginPage.headers['set-cookie'])}`);
    const csrfMatch = loginPage.body.match(/name="_csrf" value="([^"]+)"/);
    const csrf = csrfMatch ? csrfMatch[1] : 'NOT_FOUND';
    output.push(`CSRF token: ${csrf}`);
    const initialCookie = (loginPage.headers['set-cookie'] || []).map(v => v.split(';')[0]).join('; ');
    output.push(`Initial cookie: ${initialCookie}`);

    const loginResponse = await postLogin(initialCookie, csrf);
    output.push(`POST status: ${loginResponse.statusCode}`);
    output.push(`POST location: ${loginResponse.headers.location || 'none'}`);
    output.push(`POST set-cookie: ${JSON.stringify(loginResponse.headers['set-cookie'])}`);
    output.push(`POST body start: ${loginResponse.body.slice(0, 300).replace(/\s+/g, ' ')}
`);

    const loginCookie = (loginResponse.headers['set-cookie'] || []).map(v => v.split(';')[0]).join('; ');
    const combinedCookie = [initialCookie, loginCookie].filter(Boolean).join('; ');
    output.push(`Combined cookie: ${combinedCookie}`);

    const dashboardResponse = await getDashboard(combinedCookie);
    output.push(`DASH status: ${dashboardResponse.statusCode}`);
    output.push(`DASH body start: ${dashboardResponse.body.slice(0, 300).replace(/\s+/g, ' ')}
`);
  } catch (err) {
    output.push(`ERROR: ${err.message}`);
    output.push(err.stack || 'no stack');
  }
  fs.writeFileSync('temp_admin_cookie_test_output.txt', output.join('\n'), 'utf8');
})();
