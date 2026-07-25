const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const outPath = path.resolve(__dirname, '..', 'tmp_verify_telegram.json');
const token = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;

const result = {
  env: {
    TELEGRAM_BOT_TOKEN: token ? token.slice(0, 10) + '...' : null,
    TELEGRAM_CHAT_ID: chatId || null
  },
  getUpdates: null,
  visitorPost: null,
  errors: []
};

function writeResult() {
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2), 'utf8');
}

function getUpdates() {
  return new Promise((resolve) => {
    if (!token) {
      return resolve({ error: 'Missing TELEGRAM_BOT_TOKEN' });
    }
    const url = `https://api.telegram.org/bot${token}/getUpdates`;
    https.get(url, (res) => {
      let b = '';
      res.on('data', (chunk) => b += chunk);
      res.on('end', () => {
        try {
          const body = JSON.parse(b);
          resolve({ statusCode: res.statusCode, body });
        } catch (err) {
          resolve({ statusCode: res.statusCode, error: err.message, raw: b });
        }
      });
    }).on('error', (err) => resolve({ error: err.message }));
  });
}

function postVisitor() {
  return new Promise((resolve) => {
    const data = JSON.stringify({ fullName: 'Script Test', email: 'script@test.example', phone: '+999', country: 'Testland' });
    const opts = {
      host: '127.0.0.1',
      port: 3000,
      path: '/api/visitors',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    };
    const req = http.request(opts, (res) => {
      let b = '';
      res.on('data', (chunk) => b += chunk);
      res.on('end', () => {
        resolve({ statusCode: res.statusCode, body: b });
      });
    });
    req.on('error', (err) => {
      resolve({ error: err.message });
    });
    req.write(data);
    req.end();
  });
}

(async () => {
  try {
    result.getUpdates = await getUpdates();
    writeResult();
    result.visitorPost = await postVisitor();
    writeResult();
  } catch (err) {
    result.errors.push(err.message || String(err));
    writeResult();
  }
})();