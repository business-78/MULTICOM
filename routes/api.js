const express = require('express');
const router = express.Router();
const { createVisitor, findVisitors, getVisitorStats } = require('../models/visitorModel');
const { getClientInfo, validateBody, validateVisitorInput } = require('../middleware/security');
const { sendTelegramMessage } = require('../middleware/telegram');
const { ensureAdminApi } = require('../controllers/adminController');
const { DatabaseUnavailableError } = require('../config/errors');
const { logEvent, logError } = require('../config/logger');

function handleDatabaseError(res, error, context) {
  if (error instanceof DatabaseUnavailableError || error.statusCode === 503) {
    logError(`${context}: base de données indisponible.`);
    return res.status(503).json({
      success: false,
      errors: ['Service temporairement indisponible. Veuillez réessayer.']
    });
  }

  logError(`${context}: ${error.message}`);
  return res.status(500).json({ success: false, errors: ['Erreur serveur.'] });
}

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

    logEvent(`API visitor created in Neon: ${normalized.fullName} (id=${visitorResult.id})`);

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
    return handleDatabaseError(res, error, 'API visitor POST');
  }
});

router.get('/visitors', ensureAdminApi, async (req, res) => {
  try {
    const visitors = await findVisitors({ search: req.query.q, sort: 'DESC' });
    return res.json({ success: true, visitors });
  } catch (error) {
    return handleDatabaseError(res, error, 'API visitors GET');
  }
});

router.get('/stats', ensureAdminApi, async (req, res) => {
  try {
    const stats = await getVisitorStats();
    return res.json({ success: true, stats });
  } catch (error) {
    return handleDatabaseError(res, error, 'API stats GET');
  }
});

module.exports = router;
