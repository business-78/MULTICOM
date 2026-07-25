const { loadSiteSettings, getSiteSettings, saveSiteSettings } = require('../models/settingsModel');
const { logEvent, logError } = require('../config/logger');

async function renderSettings(req, res) {
  try {
    logEvent('Render settings start');
    const settings = await loadSiteSettings();
    return res.render('admin/settings', {
      title: 'Paramètres du site',
      settings,
      csrfToken: req.csrfToken ? req.csrfToken() : '',
      error: null,
      success: null
    });
  } catch (error) {
    logError(`Render settings error: ${error.message}`);
    return res.render('admin/settings', {
      title: 'Paramètres du site',
      settings: getSiteSettings(),
      csrfToken: req.csrfToken ? req.csrfToken() : '',
      error: 'Impossible de charger les paramètres pour le moment.'
    });
  }
}

async function updateSettings(req, res) {
  try {
    logEvent('Update settings start');
    const updates = {
      siteName: req.body.siteName,
      logoUrl: req.body.logoUrl,
      primaryColor: req.body.primaryColor,
      secondaryColor: req.body.secondaryColor,
      contactEmail: req.body.contactEmail,
      contactPhone: req.body.contactPhone,
      businessAddress: req.body.businessAddress,
      telegramBotToken: req.body.telegramBotToken,
      telegramChatId: req.body.telegramChatId,
      notificationsEnabled: req.body.notificationsEnabled
    };

    const settings = await saveSiteSettings(updates);
    logEvent('Paramètres du site mis à jour.');
    return res.render('admin/settings', {
      title: 'Paramètres du site',
      settings,
      success: 'Paramètres enregistrés avec succès.',
      error: null,
      csrfToken: req.csrfToken ? req.csrfToken() : ''
    });
  } catch (error) {
    logError(`Update settings error: ${error.message}`);
    return res.render('admin/settings', {
      title: 'Paramètres du site',
      settings: getSiteSettings(),
      error: 'Impossible d’enregistrer les paramètres.',
      csrfToken: req.csrfToken ? req.csrfToken() : ''
    });
  }
}

module.exports = {
  renderSettings,
  updateSettings
};
