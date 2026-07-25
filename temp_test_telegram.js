const path = require('path');
const dotenv = require('dotenv');
const https = require('https');
dotenv.config({ path: path.resolve(__dirname, '.env') });

const token = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;

if (!token || !chatId) {
  console.error('Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID');
  process.exit(1);
}

function requestTelegram(path, payload) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.telegram.org',
      path,
      method: payload ? 'POST' : 'GET',
      headers: payload ? {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      } : {}
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve({ statusCode: res.statusCode, body: data }));
    });

    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

(async () => {
  try {
    const getMe = await requestTelegram(`/bot${token}/getMe`);
    console.log('getMe', getMe.statusCode, getMe.body);
    const payload = JSON.stringify({ chat_id: chatId, text: 'Test message from local validation.' });
    const send = await requestTelegram(`/bot${token}/sendMessage`, payload);
    console.log('sendMessage', send.statusCode, send.body);
  } catch (err) {
    console.error('error', err.message);
  }
})();
