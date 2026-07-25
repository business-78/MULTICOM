// /middleware/security.js
// Helpers de sécurité, détection d'agent utilisateur et validation de base.
const useragent = require('useragent');

function validateVisitorInput(data) {
  const errors = [];
  const { fullName, email, phone, country } = data;

  if (!fullName || typeof fullName !== 'string' || fullName.trim().length < 3) errors.push('Le nom est requis.');
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push('Email invalide.');
  if (!phone || !/^\+?[0-9\s-]{6,15}$/.test(phone)) errors.push('Téléphone invalide.');
  if (!country || typeof country !== 'string' || country.trim().length < 2) errors.push('Le pays est requis.');

  return errors;
}

function getClientInfo(req) {
  const agent = useragent.parse(req.headers['user-agent'] || '');
  return {
    ip: req.ip || req.headers['x-forwarded-for'] || 'unknown',
    browser: agent.family || 'Unknown',
    os: agent.os.family || 'Unknown'
  };
}

function sanitizeInput(value) {
  return String(value || '').replace(/[<>"']/g, '').trim();
}

function validateBody(req, res, next) {
  const fields = ['fullName', 'email', 'phone', 'country'];
  for (const field of fields) {
    if (req.body[field]) {
      req.body[field] = sanitizeInput(req.body[field]);
    }
  }
  next();
}

module.exports = {
  getClientInfo,
  sanitizeInput,
  validateBody,
  validateVisitorInput
};
