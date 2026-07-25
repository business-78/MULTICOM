const fs = require('fs');
const path = require('path');
const https = require('https');

const envPath = path.join(__dirname, '..', '.env');
function readEnv() {
  if (!fs.existsSync(envPath)) return {};
  const raw = fs.readFileSync(envPath, 'utf8');
  const obj = {};
  raw.split(/\r?\n/).forEach(line => {
    const m = line.match(/^([^=]+)=(.*)$/);
    if (m) obj[m[1]] = m[2];
  });
  return obj;
}

const env = readEnv();
const token = env.TELEGRAM_BOT_TOKEN;
if (!token) {
  console.error('No TELEGRAM_BOT_TOKEN in .env');
  process.exit(1);
}

const url = `https://api.telegram.org/bot${token}/getUpdates`;
https.get(url, (res) => {
  let b = '';
  res.on('data', c => b += c);
  res.on('end', () => {
    try {
      fs.writeFileSync(path.join(__dirname, '..', 'tmp_updates.json'), b, 'utf8');
      console.log('WROTE tmp_updates.json');
    } catch (e) {
      console.error('WRITE_ERR', e.message);
      process.exit(1);
    }
  });
}).on('error', (e) => { console.error('HTTP_ERR', e.message); process.exit(1); });
