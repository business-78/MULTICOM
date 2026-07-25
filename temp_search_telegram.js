const fs = require('fs');
const path = require('path');

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.git') continue;
      walk(fullPath);
    } else if (entry.isFile() && fullPath.endsWith('.js')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      if (content.includes('Telegram non configuré')) {
        console.log(fullPath);
      }
      if (content.includes("sendTelegramMessage")) {
        console.log('sendTelegramMessage found in', fullPath);
      }
      if (content.includes("require('../models/settingsModel')") || content.includes("require('../models/settingsModel')")) {
        console.log('settings model require in', fullPath);
      }
    }
  }
}
walk('C:/MULTICOM');
