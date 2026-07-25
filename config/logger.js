// /config/logger.js
// Journalisation centralisée des événements et erreurs.
const fs = require('fs');
const path = require('path');

const logsDir = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

function formatMessage(level, message) {
  const timestamp = new Date().toISOString();
  return `[${timestamp}] [${level}] ${message}\n`;
}

function appendToFile(fileName, message) {
  const filePath = path.join(logsDir, fileName);
  fs.appendFileSync(filePath, message, 'utf8');
}

function logEvent(message) {
  const formatted = formatMessage('INFO', message);
  appendToFile('app.log', formatted);
  console.log(message);
}

function logError(message) {
  const formatted = formatMessage('ERROR', message);
  appendToFile('app.log', formatted);
  console.error(message);
}

module.exports = {
  logEvent,
  logError
};
