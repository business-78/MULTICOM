// /middleware/telegram.js
// Intégration Telegram avec gestion d'erreur sans faire planter l'application.
const https = require('https');
const path = require('path');
const dotenv = require('dotenv');
const { logError, logEvent } = require('../config/logger');

dotenv.config({ path: path.resolve(__dirname, '..', '.env'), override: true });

async function sendTelegramMessage(data) {
  const { loadSiteSettings } = require('../models/settingsModel');
  const settings = await loadSiteSettings();
  const { telegramBotToken, telegramChatId, notificationsEnabled } = settings;
  const token = telegramBotToken || process.env.TELEGRAM_BOT_TOKEN || '';
  const chatId = telegramChatId || process.env.TELEGRAM_CHAT_ID || '';
  const enabled = ['true', '1', 'on'].includes(String(notificationsEnabled || 'true').toLowerCase());

  logEvent(`Telegram send check: token=${Boolean(token)} chatId=${Boolean(chatId)} enabled=${enabled}`);

  if (!enabled) {
    logError(`Telegram disabled by settings: notificationsEnabled=${notificationsEnabled}`);
    return false;
  }
  if (!token || !chatId) {
    logError(`Telegram non configuré. token=${Boolean(token)} chatId=${Boolean(chatId)} notificationsEnabled=${notificationsEnabled}`);
    return false;
  }

  const messageText = String(data.message || data.country || '').trim();
  const message = `Nouveau visiteur\n👤 Nom et prénom: ${data.fullName}\n📱 Numéro WhatsApp: ${data.phone}\n💬 Demande / Message: ${messageText}\n📅 Date: ${data.visitedAt}\nIP: ${data.ip}`;

  const payload = JSON.stringify({ chat_id: chatId, text: message });
  const options = {
    hostname: 'api.telegram.org',
    path: `/bot${token}/sendMessage`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload)
    }
  };

  return new Promise((resolve) => {
    const req = https.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => {
        responseData += chunk.toString();
      });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(responseData || '{}');
          if (res.statusCode !== 200 || parsed.ok !== true) {
            logError(`Telegram API error: status=${res.statusCode} body=${responseData}`);
            return resolve(false);
          }
          logEvent(`Telegram message sent to chatId=${chatId}`);
          return resolve(true);
        } catch (parseError) {
          logError(`Telegram response parse error: ${parseError.message} body=${responseData}`);
          return resolve(false);
        }
      });
    });

    req.on('error', (error) => {
      logError(`Telegram error: ${error.message}`);
      resolve(false);
    });
    req.write(payload);
    req.end();
  });
}

module.exports = {
  sendTelegramMessage
};
