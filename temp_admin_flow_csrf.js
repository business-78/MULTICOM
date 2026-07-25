const http = require('http');
const querystring = require('querystring');
const { URL } = require('url');

function getCookieValue(headers, name) {
  const cookies = headers['set-cookie'] || [];
  const cookie = cookies.find((entry) => entry.startsWith(name + '='));
  return cookie ? cookie.split(';')[0] : '';
}

const getOptions = {
  hostname: '127.0.0.1',
  port: 3000,
  path: '/admin/login',
  method: 'GET'
};

const req = http.request(getOptions, (res) => {
  let body = '';
  const cookie = getCookieValue(res.headers, '_csrf');
  res.on('data', (chunk) => body += chunk.toString());
  res.on('end', () => {
    const match = body.match(/name="_csrf" value="([^"]+)"/);
    const csrfToken = match ? match[1] : null;
    console.log('csrfToken', csrfToken);
    console.log('cookie', cookie);

    if (!csrfToken) {
      console.error('No CSRF token found');
      return;
    }

    const postData = querystring.stringify({ username: 'admin', password: 'Admin@12345', _csrf: csrfToken });
    const postOptions = {
      hostname: '127.0.0.1',
      port: 3000,
      path: '/admin/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData),
        'Cookie': cookie
      }
    };

    const req2 = http.request(postOptions, (res2) => {
      let body2 = '';
      console.log('login status', res2.statusCode);
      console.log('login headers', res2.headers);
      res2.on('data', (chunk) => body2 += chunk.toString());
      res2.on('end', () => {
        console.log('login body', body2.slice(0, 400));
        const newCookie = getCookieValue(res2.headers, 'multicom.sid') || cookie;
        const opts3 = {
          hostname: '127.0.0.1',
          port: 3000,
          path: '/admin/dashboard',
          method: 'GET',
          headers: { Cookie: [cookie, newCookie].filter(Boolean).join('; ') }
        };
        const req3 = http.request(opts3, (res3) => {
          let body3 = '';
          console.log('dashboard status', res3.statusCode);
          res3.on('data', (chunk) => body3 += chunk.toString());
          res3.on('end', () => {
            console.log('dashboard body', body3.slice(0, 500));
          });
        });
        req3.on('error', (err) => console.error('dashboard error', err));
        req3.end();
      });
    });
    req2.on('error', (err) => console.error('login request error', err));
    req2.write(postData);
    req2.end();
  });
});
req.on('error', (err) => console.error('initial request error', err));
req.end();
