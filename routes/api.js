const express = require('express');
const router = express.Router();
const { createVisitor, findVisitors, getVisitorStats } = require('../models/visitorModel');
const { getClientInfo, validateBody, validateVisitorInput } = require('../middleware/security');
const { sendTelegramMessage } = require('../middleware/telegram');
const { logEvent, logError } = require('../config/logger');

router.post('/visitors', validateBody, async (req, res) => {
  try {
    const normalized = {
      fullName: String(req.body.fullName || '').trim(),
      email: String(req.body.email || '').trim().toLowerCase(),
      phone: String(req.body.phone || '').trim(),
      country: String(req.body.country || '').trim(),
      message: String(req.body.message || '').trim(),
      service: String(req.body.service || '').trim()
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
      logEvent(`API visitor duplicate detected: ${normalized.fullName}`);
      return res.status(200).json({ success: true, message: 'Visiteur déjà enregistré récemment.' });
    }

    logEvent(`API visitor created: ${normalized.fullName}`);
    await sendTelegramMessage({
      fullName: normalized.fullName,
      phone: normalized.phone,
      email: normalized.email,
      country: normalized.country,
      message: normalized.message,
      service: normalized.service,
      visitedAt,
      ip: clientInfo.ip
    }).catch((error) => logError(`Telegram error: ${error.message}`));

    return res.status(201).json({ success: true, message: 'Visiteur enregistré.' });
  } catch (error) {
    logError(`API visitor error: ${error.message}`);
    return res.status(500).json({ success: false, errors: ['Erreur serveur.'] });
  }
});

router.get('/visitors', async (req, res) => {
  try {
    const visitors = await findVisitors({ search: req.query.q, sort: 'DESC' });
    return res.json({ success: true, visitors });
  } catch (error) {
    logError(`API visitors list error: ${error.message}`);
    return res.status(500).json({ success: false, errors: ['Erreur serveur.'] });
  }
});

router.get('/stats', async (req, res) => {
  try {
    const stats = await getVisitorStats();
    return res.json({ success: true, stats });
  } catch (error) {
    logError(`API stats error: ${error.message}`);
    return res.status(500).json({ success: false, errors: ['Erreur serveur.'] });
  }
});

// Temporary debug route to write site settings (no CSRF, under /api)
router.post('/debug/settings', async (req, res) => {
  try {
    const { saveSiteSettings } = require('../models/settingsModel');
    const settings = await saveSiteSettings(req.body || {});
    return res.json({ success: true, settings });
  } catch (error) {
    logError(`API debug settings error: ${error.message}`);
    return res.status(500).json({ success: false, errors: ['Impossible d’enregistrer les paramètres.'] });
  }
});

module.exports = router;
