const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { getPool, isDbAvailable } = require('../config/database');
const { logError, logEvent } = require('../config/logger');

dotenv.config({ path: path.resolve(__dirname, '..', '.env'), override: true });

const fallbackFile = path.join(__dirname, '..', 'database', 'settings_fallback.json');
const allowedKeys = [
  'siteName',
  'logoUrl',
  'primaryColor',
  'secondaryColor',
  'contactEmail',
  'contactPhone',
  'businessAddress',
  'telegramBotToken',
  'telegramChatId',
  'notificationsEnabled',
  'adminUsername',
  'adminPasswordHash'
];

let settingsCache = {
  siteName: process.env.SITE_NAME || 'MULTIFORMCOM',
  logoUrl: process.env.LOGO_URL || '',
  primaryColor: process.env.SITE_PRIMARY_COLOR || '#b38d42',
  secondaryColor: process.env.SITE_SECONDARY_COLOR || '#ffffff',
  contactEmail: process.env.CONTACT_EMAIL || 'contact@multiformcom.com',
  contactPhone: process.env.CONTACT_PHONE || '+223 63 73 81 58',
  businessAddress: process.env.BUSINESS_ADDRESS || 'Afrique de l\'Ouest · Mali · Sénégal · Côte d’Ivoire',
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || '',
  telegramChatId: process.env.TELEGRAM_CHAT_ID || '',
  notificationsEnabled: process.env.NOTIFICATIONS_ENABLED || 'true',
  adminUsername: process.env.ADMIN_USERNAME?.trim() || 'admin',
  adminPasswordHash: process.env.ADMIN_HASH?.trim() || ''
};

function isPostgres() {
  return Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL.includes('postgres'));
}

function readFallbackSettings() {
  try {
    if (!fs.existsSync(fallbackFile)) return {};
    const raw = fs.readFileSync(fallbackFile, 'utf8');
    return JSON.parse(raw || '{}');
  } catch (error) {
    logError(`Lecture fallback settings impossible: ${error.message}`);
    return {};
  }
}

function writeFallbackSettings(settings) {
  try {
    fs.mkdirSync(path.dirname(fallbackFile), { recursive: true });
    fs.writeFileSync(fallbackFile, JSON.stringify(settings, null, 2), 'utf8');
  } catch (error) {
    logError(`Écriture fallback settings impossible: ${error.message}`);
  }
}

function getEnvValue(key) {
  const envPath = path.resolve(__dirname, '..', '.env');
  dotenv.config({ path: envPath, override: true });
  return process.env[key] ? String(process.env[key]).trim() : '';
}

function normalizeSettings(rawSettings = {}) {
  const normalized = { ...settingsCache };
  for (const key of allowedKeys) {
    if (rawSettings[key] !== undefined && rawSettings[key] !== null) {
      if (key === 'notificationsEnabled') {
        const val = rawSettings[key];
        normalized[key] = (val === true || val === 'true' || val === 'on') ? 'true' : 'false';
      } else {
        normalized[key] = String(rawSettings[key]).trim();
      }
    }
  }
  return normalized;
}

async function loadSiteSettings() {
  const pool = getPool();
  let settings = normalizeSettings();

  if (pool && isDbAvailable()) {
    try {
      const query = 'SELECT config_key, config_value FROM settings';
      const result = isPostgres() ? await pool.query(query) : await pool.query(query);
      const rows = isPostgres() ? result.rows : result[0];
      if (Array.isArray(rows)) {
        rows.forEach((row) => {
          if (row.config_key && allowedKeys.includes(row.config_key)) {
            settings[row.config_key] = row.config_value || '';
          }
        });
      }
    } catch (error) {
      logError(`Chargement des paramètres impossible: ${error.message}`);
      const fallback = readFallbackSettings();
      settings = { ...settings, ...fallback };
    }
  } else {
    const fallback = readFallbackSettings();
    settings = { ...settings, ...fallback };
  }

  settings.telegramBotToken = getEnvValue('TELEGRAM_BOT_TOKEN') || settings.telegramBotToken || '';
  settings.telegramChatId = getEnvValue('TELEGRAM_CHAT_ID') || settings.telegramChatId || '';
  settings.notificationsEnabled = getEnvValue('NOTIFICATIONS_ENABLED') || settings.notificationsEnabled || 'true';
  settings.adminUsername = getEnvValue('ADMIN_USERNAME') || settings.adminUsername || 'admin';
  settings.adminPasswordHash = getEnvValue('ADMIN_HASH') || settings.adminPasswordHash || '';

  if (!settings.telegramBotToken || !settings.telegramChatId) {
    logError(`loadSiteSettings warning: telegram config incomplete. tokenSet=${Boolean(settings.telegramBotToken)} chatIdSet=${Boolean(settings.telegramChatId)} notificationsEnabled=${settings.notificationsEnabled}`);
  } else {
    logEvent(`loadSiteSettings loaded Telegram config. tokenSet=${Boolean(settings.telegramBotToken)} chatIdSet=${Boolean(settings.telegramChatId)} notificationsEnabled=${settings.notificationsEnabled}`);
  }

  settingsCache = settings;
  return settingsCache;
}

async function saveSiteSettings(updates) {
  const pool = getPool();
  const newSettings = normalizeSettings({ ...settingsCache, ...updates });

  if (pool && isDbAvailable()) {
    try {
      if (isPostgres()) {
        const query = `INSERT INTO settings (config_key, config_value) VALUES ($1, $2)
          ON CONFLICT (config_key) DO UPDATE SET config_value = EXCLUDED.config_value`;
        for (const key of allowedKeys) {
          await pool.query(query, [key, newSettings[key]]);
        }
      } else {
        const query = `INSERT INTO settings (config_key, config_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE config_value = VALUES(config_value)`;
        for (const key of allowedKeys) {
          await pool.query(query, [key, newSettings[key]]);
        }
      }
    } catch (error) {
      logError(`Enregistrement des paramètres impossible: ${error.message}`);
      writeFallbackSettings(newSettings);
    }
  } else {
    writeFallbackSettings(newSettings);
  }

  settingsCache = newSettings;
  // Ensure a local fallback is always available so the app can read settings
  // even if the database becomes unreachable later.
  try {
    writeFallbackSettings(newSettings);
  } catch (err) {
    // writeFallbackSettings already logs errors; swallow to avoid crashing.
  }
  return settingsCache;
}

function getSiteSettings() {
  return settingsCache;
}

module.exports = {
  loadSiteSettings,
  getSiteSettings,
  saveSiteSettings
};
