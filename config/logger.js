// Journalisation compatible Vercel (console uniquement).

function formatMessage(level, message) {
  const timestamp = new Date().toISOString();
  return `[${timestamp}] [${level}] ${message}`;
}

function logEvent(message) {
  console.log(formatMessage('INFO', message));
}

function logError(message) {
  console.error(formatMessage('ERROR', message));
}

function logWarn(message) {
  console.warn(formatMessage('WARN', message));
}

module.exports = {
  logEvent,
  logError,
  logWarn
};
