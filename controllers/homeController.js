// /controllers/homeController.js
// Contrôleur principal pour la page publique et le formulaire de visiteurs.
const { createVisitor } = require('../models/visitorModel');
const { getSiteSettings } = require('../models/settingsModel');
const { logEvent, logError } = require('../config/logger');
const { sendTelegramMessage } = require('../middleware/telegram');
const { getClientInfo, validateVisitorInput } = require('../middleware/security');

async function renderHome(req, res) {
  const settings = getSiteSettings();
  res.render('pages/home', {
    title: settings.siteName || 'MULTIFORMCOM',
    csrfToken: req.csrfToken ? req.csrfToken() : '',
    settings
  });
}

async function submitVisitor(req, res) {
  try {
    const { fullName, email, phone, country, message, service } = req.body;
    const normalized = {
      fullName: String(fullName || '').trim(),
      email: String(email || '').trim().toLowerCase(),
      phone: String(phone || '').trim(),
      country: String(country || '').trim(),
      message: String(message || '').trim(),
      service: String(service || '').trim()
    };

    const errors = validateVisitorInput(normalized);
    if (errors.length) {
      return res.status(400).json({ success: false, errors });
    }

    const clientInfo = getClientInfo(req);
    const visitedAt = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const visitorResult = await createVisitor({
      full_name: normalized.fullName,
      email: normalized.email,
      phone: normalized.phone,
      country: normalized.country,
      message: normalized.message,
      service: normalized.service,
      visited_at: visitedAt,
      ip_address: clientInfo.ip,
      browser: clientInfo.browser,
      os: clientInfo.os
    });

    if (visitorResult.isDuplicate) {
      logEvent(`Doublon visiteur détecté : ${normalized.fullName}`);
      return res.json({ success: true, message: 'Votre visite a bien été enregistrée.' });
    }

    logEvent(`Nouveau visiteur enregistré: ${normalized.fullName}`);
    try {
      await sendTelegramMessage({
        fullName: normalized.fullName,
        phone: normalized.phone,
        email: normalized.email,
        country: normalized.country,
        message: normalized.message,
        service: normalized.service,
        visitedAt,
        ip: clientInfo.ip
      });
    } catch (telegramError) {
      logError(`Telegram error: ${telegramError.message}`);
    }

    return res.json({ success: true, message: 'Votre visite a bien été enregistrée.' });
  } catch (error) {
    logError(`Erreur soumission visiteur: ${error.message}`);
    return res.status(500).json({ success: false, errors: ['Erreur serveur.'] });
  }
}

module.exports = {
  renderHome,
  submitVisitor
};
