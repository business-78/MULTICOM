const http = require('http');
const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.resolve(__dirname, '.env') });

const payload = JSON.stringify({
  fullName: 'QA Tester',
  email: 'qa@test.local',
  phone: '+1234567890',
  country: 'Testland'
});

const options = {
  hostname: '127.0.0.1',
  port: 3000,
  path: '/api/visitors',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload)
  }
};

const req = http.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    console.log('response status', res.statusCode);
    console.log('response body', data);
  });
});

req.on('error', (err) => {
  console.error('request error', err.message);
});
req.write(payload);
req.end();
