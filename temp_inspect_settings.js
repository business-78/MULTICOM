const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.resolve(__dirname, '.env') });
const { loadSiteSettings, getSiteSettings } = require('./models/settingsModel');
(async () => {
  const loaded = await loadSiteSettings();
  console.log('loaded settings', loaded);
  console.log('getSiteSettings', getSiteSettings());
  console.log('process.env token', process.env.TELEGRAM_BOT_TOKEN);
  console.log('process.env chatId', process.env.TELEGRAM_CHAT_ID);
})();
