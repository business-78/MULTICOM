const fs = require('fs');
const path = require('path');
const https = require('https');

const fallbackPath = path.join(__dirname, '..', 'database', 'settings_fallback.json');
const envPath = path.join(__dirname, '..', '.env');

function readFallback() {
  if (!fs.existsSync(fallbackPath)) return {};
  return JSON.parse(fs.readFileSync(fallbackPath, 'utf8') || '{}');
}

function writeEnv(vars) {
  let existing = {};
  if (fs.existsSync(envPath)) {
    const raw = fs.readFileSync(envPath, 'utf8');
    raw.split(/\r?\n/).forEach(line => {
      const m = line.match(/^([^=]+)=(.*)$/);
      if (m) existing[m[1]] = m[2];
    });
  }
  const merged = { ...existing, ...vars };
  const content = Object.keys(merged).map(k => `${k}=${merged[k]}`).join('\n');
  fs.writeFileSync(envPath, content, 'utf8');
}

function getUpdates(token) {
  const url = `https://api.telegram.org/bot${token}/getUpdates`;
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let b = '';
      res.on('data', c => b += c);
      res.on('end', () => {
        try { resolve(JSON.parse(b)); } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

(async ()=>{
  try {
    const fallback = readFallback();
    const token = fallback.telegramBotToken || process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
      console.error('No bot token found in fallback or env.');
      process.exit(1);
    }
    console.log('Using token:', token.slice(0,8) + '...');
    const updates = await getUpdates(token);
    if (!updates || typeof updates !== 'object') throw new Error('Invalid updates response');
    const results = updates.result || [];
    let chatId = '';
    for (const u of results) {
      const msg = u.message || u.channel_post || u.edited_message;
      if (msg && msg.chat && msg.chat.id) { chatId = String(msg.chat.id); break; }
      // also check callback_query
      if (u.callback_query && u.callback_query.message && u.callback_query.message.chat) {
        chatId = String(u.callback_query.message.chat.id); break;
      }
    }
    if (!chatId) {
      console.log('No chat_id found in bot updates. To get chat_id, send a message to the bot from the desired chat and re-run this script.');
    } else {
      console.log('Found chat id:', chatId);
      // write to .env and update fallback
      writeEnv({ TELEGRAM_BOT_TOKEN: token, TELEGRAM_CHAT_ID: chatId });
      fallback.telegramBotToken = '';
      fallback.telegramChatId = chatId;
      fs.writeFileSync(fallbackPath, JSON.stringify(fallback, null, 2), 'utf8');
      console.log('.env updated and fallback file updated (token removed).');
    }
  } catch (err) {
    console.error('Error during telegram setup:', err.message || err);
    process.exit(1);
  }
})();
