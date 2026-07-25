const http = require('http');
const querystring = require('querystring');
const fs = require('fs');

function getCookieValue(headers, name) {
  const cookies = headers['set-cookie'] || [];
  const cookie = cookies.find((entry) => entry.startsWith(name + '='));
  return cookie ? cookie.split(';')[0] : '';
}

const getReq = http.request({ hostname: '127.0.0.1', port: 3000, path: '/', method: 'GET' }, (res) => {
  let body = '';
  const cookie = getCookieValue(res.headers, '_csrf');
  res.on('data', (chunk) => body += chunk.toString());
  res.on('end', () => {
    const match = body.match(/name="_csrf" value="([^"]+)"/);
    const csrfToken = match ? match[1] : null;
    console.log('csrfToken', csrfToken);
    console.log('cookie', cookie);
    const payload = {
      fullName: 'Test User',
      email: 'test@example.com',
      phone: '+22312345678',
      country: 'Mali',
      _csrf: csrfToken
    };
    const data = JSON.stringify(payload);
    const postReq = http.request({
      hostname: '127.0.0.1',
      port: 3000,
      path: '/visitor',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
        'Accept': 'application/json',
        'Cookie': cookie,
        'X-CSRF-Token': csrfToken
      }
    }, (res2) => {
      let body2 = '';
      console.log('status', res2.statusCode);
      console.log('headers', res2.headers);
      res2.on('data', (chunk) => body2 += chunk.toString());
      res2.on('end', () => console.log('body', body2));
    });
    postReq.on('error', (err) => console.error('post error', err));
    postReq.write(data);
    postReq.end();
  });
});
getReq.on('error', (err) => console.error('get error', err));
getReq.end();
