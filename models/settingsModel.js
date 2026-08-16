const dotenv = require('dotenv');
const path = require('path');
const { assertDbAvailable, isDbAvailable, getPool } = require('../config/database');
const { DatabaseUnavailableError } = require('../config/errors');
const { logError, logEvent, logWarn } = require('../config/logger');

dotenv.config({ path: path.resolve(__dirname, '..', '.env'), override: true });

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

let settingsCache = buildEnvDefaults();

function buildEnvDefaults() {
  return {
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

function applyEnvOverrides(settings) {
  settings.telegramBotToken = getEnvValue('TELEGRAM_BOT_TOKEN') || settings.telegramBotToken || '';
  settings.telegramChatId = getEnvValue('TELEGRAM_CHAT_ID') || settings.telegramChatId || '';
  settings.notificationsEnabled = getEnvValue('NOTIFICATIONS_ENABLED') || settings.notificationsEnabled || 'true';
  settings.adminUsername = getEnvValue('ADMIN_USERNAME') || settings.adminUsername || 'admin';
  settings.adminPasswordHash = getEnvValue('ADMIN_HASH') || settings.adminPasswordHash || '';
  return settings;
}

async function loadSiteSettings() {
  let settings = normalizeSettings(buildEnvDefaults());

  if (isDbAvailable()) {
    try {
      const pool = getPool();
      const result = await pool.query('SELECT config_key, config_value FROM settings');
      if (Array.isArray(result.rows)) {
        result.rows.forEach((row) => {
          if (row.config_key && allowedKeys.includes(row.config_key)) {
            settings[row.config_key] = row.config_value || '';
          }
        });
      }
    } catch (error) {
      logError(`Chargement des paramètres impossible: ${error.message}`);
    }
  } else {
    logWarn('loadSiteSettings: base de données indisponible, utilisation des valeurs env uniquement.');
  }

  settings = applyEnvOverrides(settings);

  if (!settings.telegramBotToken || !settings.telegramChatId) {
    logWarn(`loadSiteSettings: configuration Telegram incomplète. notificationsEnabled=${settings.notificationsEnabled}`);
  } else {
    logEvent(`loadSiteSettings: configuration Telegram chargée. notificationsEnabled=${settings.notificationsEnabled}`);
  }

  settingsCache = settings;
  return settingsCache;
}

async function saveSiteSettings(updates) {
  const pool = assertDbAvailable();
  const newSettings = normalizeSettings({ ...settingsCache, ...updates });

  try {
    const query = `INSERT INTO settings (config_key, config_value) VALUES ($1, $2)
      ON CONFLICT (config_key) DO UPDATE SET config_value = EXCLUDED.config_value`;
    for (const key of allowedKeys) {
      await pool.query(query, [key, newSettings[key]]);
    }
  } catch (error) {
    logError(`Enregistrement des paramètres impossible: ${error.message}`);
    throw new DatabaseUnavailableError();
  }

  settingsCache = applyEnvOverrides(newSettings);
  return settingsCache;
}

function getSiteSettings() {
  return settingsCache;
}

function hasSecureAdminCredentials(settings = getSiteSettings()) {
  const hash = settings.adminPasswordHash || getEnvValue('ADMIN_HASH');
  return Boolean(hash && hash.length >= 20);
}

module.exports = {
  loadSiteSettings,
  getSiteSettings,
  saveSiteSettings,
  hasSecureAdminCredentials
};
