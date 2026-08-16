const fs = require('fs');
const path = require('path');
const https = require('https');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const envPath = path.join(__dirname, '..', '.env');

function writeEnv(vars) {
  let existing = {};
  if (fs.existsSync(envPath)) {
    const raw = fs.readFileSync(envPath, 'utf8');
    raw.split(/\r?\n/).forEach((line) => {
      const m = line.match(/^([^=]+)=(.*)$/);
      if (m) existing[m[1]] = m[2];
    });
  }
  const merged = { ...existing, ...vars };
  const content = Object.keys(merged).map((k) => `${k}=${merged[k]}`).join('\n');
  fs.writeFileSync(envPath, content, 'utf8');
}

function getUpdates(token) {
  const url = `https://api.telegram.org/bot${token}/getUpdates`;
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (error) {
          reject(error);
        }
      });
    }).on('error', reject);
  });
}

(async () => {
  try {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
      console.error('TELEGRAM_BOT_TOKEN manquant dans .env');
      process.exit(1);
    }

    const updates = await getUpdates(token);
    const results = updates.result || [];
    let chatId = '';

    for (const update of results) {
      const msg = update.message || update.channel_post || update.edited_message;
      if (msg?.chat?.id) {
        chatId = String(msg.chat.id);
        break;
      }
      if (update.callback_query?.message?.chat?.id) {
        chatId = String(update.callback_query.message.chat.id);
        break;
      }
    }

    if (!chatId) {
      console.log('Aucun chat_id trouvé. Envoyez un message au bot puis relancez ce script.');
      process.exit(0);
    }

    writeEnv({ TELEGRAM_BOT_TOKEN: token, TELEGRAM_CHAT_ID: chatId });
    console.log('TELEGRAM_CHAT_ID enregistré dans .env');
  } catch (error) {
    console.error('Erreur setup Telegram:', error.message || error);
    process.exit(1);
  }
})();
