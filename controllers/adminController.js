// Contrôleur du tableau de bord administrateur.
const bcrypt = require('bcryptjs');
const util = require('util');
const rateLimit = require('express-rate-limit');
const { findVisitors, getVisitorStats, deleteVisitor, updateVisitor } = require('../models/visitorModel');
const { loadSiteSettings, hasSecureAdminCredentials } = require('../models/settingsModel');
const { DatabaseUnavailableError } = require('../config/errors');
const { logEvent, logError } = require('../config/logger');

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Trop de tentatives de connexion. Veuillez patienter.'
});

function isAdminSession(req) {
  return Boolean(req.session && req.session.isAdmin);
}

async function ensureAdminSession(req, res, next) {
  if (isAdminSession(req)) {
    return next();
  }
  return res.redirect('/admin/login');
}

function ensureAdminApi(req, res, next) {
  if (isAdminSession(req)) {
    return next();
  }
  return res.status(401).json({ success: false, errors: ['Authentification requise.'] });
}

async function renderLogin(req, res) {
  if (isAdminSession(req)) {
    return res.redirect('/admin/dashboard');
  }

  let secureConfigured = false;
  try {
    const settings = await loadSiteSettings();
    secureConfigured = hasSecureAdminCredentials(settings);
  } catch (error) {
    secureConfigured = hasSecureAdminCredentials();
  }

  res.render('admin/login', {
    title: 'Connexion admin',
    error: secureConfigured ? null : 'Configuration administrateur incomplète. Définissez ADMIN_HASH dans les variables d’environnement.',
    csrfToken: req.csrfToken ? req.csrfToken() : ''
  });
}

async function isValidAdminPassword(password, storedHash) {
  if (!password || typeof password !== 'string') {
    return false;
  }

  const hash = storedHash || process.env.ADMIN_HASH?.trim();
  if (!hash) {
    return false;
  }

  try {
    return await bcrypt.compare(password, hash);
  } catch (error) {
    logError(`Admin hash comparison error: ${error.message}`);
    return false;
  }
}

async function loginAdmin(req, res) {
  const { username, password } = req.body;

  if (!process.env.SESSION_SECRET?.trim() && process.env.NODE_ENV === 'production') {
    logError('Tentative de connexion refusée: SESSION_SECRET non configuré.');
    return res.render('admin/login', {
      title: 'Connexion admin',
      error: 'Authentification indisponible. Configuration serveur incomplète.',
      csrfToken: req.csrfToken ? req.csrfToken() : ''
    });
  }

  if (!username || !password) {
    return res.render('admin/login', {
      title: 'Connexion admin',
      error: 'Identifiants requis.',
      csrfToken: req.csrfToken ? req.csrfToken() : ''
    });
  }

  try {
    const settings = await loadSiteSettings();

    if (!hasSecureAdminCredentials(settings)) {
      logError('Tentative de connexion refusée: ADMIN_HASH non configuré.');
      return res.render('admin/login', {
        title: 'Connexion admin',
        error: 'Authentification indisponible. Configuration administrateur manquante.',
        csrfToken: req.csrfToken ? req.csrfToken() : ''
      });
    }

    const adminUsername = settings.adminUsername || process.env.ADMIN_USERNAME?.trim() || 'admin';
    const adminHash = settings.adminPasswordHash || process.env.ADMIN_HASH?.trim();
    const isMatch = username === adminUsername && await isValidAdminPassword(password, adminHash);

    if (isMatch) {
      req.session = {
        isAdmin: true,
        username
      };
      logEvent(`Connexion admin réussie par ${username}`);
      return res.redirect('/admin/dashboard');
    }
  } catch (error) {
    logError(`Erreur authentification admin: ${error.message}`);
  }

  logError(`Tentative de connexion échouée pour ${username}`);
  return res.render('admin/login', {
    title: 'Connexion admin',
    error: 'Identifiants invalides.',
    csrfToken: req.csrfToken ? req.csrfToken() : ''
  });
}

function logoutAdmin(req, res) {
  req.session = null;
  res.redirect('/admin/login');
}

async function renderDashboard(req, res) {
  const defaults = { total: 0, today: 0, month: 0 };
  let stats = defaults;
  let visitors = [];
  let dashboardError = null;

  try {
    logEvent('Render dashboard start');
    const [statsResult, visitorsResult] = await Promise.allSettled([
      getVisitorStats(),
      findVisitors({ sort: 'DESC' })
    ]);

    if (statsResult.status === 'fulfilled') {
      stats = statsResult.value || defaults;
    } else {
      dashboardError = 'Impossible de charger les statistiques des visiteurs.';
      logError(`Dashboard stats error: ${util.inspect(statsResult.reason, { depth: null, colors: false })}`);
    }

    if (visitorsResult.status === 'fulfilled') {
      visitors = visitorsResult.value || [];
    } else {
      dashboardError = dashboardError
        ? `${dashboardError} Impossible de charger la liste des visiteurs.`
        : 'Impossible de charger la liste des visiteurs.';
      logError(`Dashboard visitors error: ${util.inspect(visitorsResult.reason, { depth: null, colors: false })}`);
    }

    res.render('admin/dashboard', {
      title: 'Tableau de bord',
      stats,
      visitors,
      username: req.session?.username || 'admin',
      csrfToken: req.csrfToken ? req.csrfToken() : '',
      dashboardError
    }, (renderError, html) => {
      if (renderError) {
        logError(`Dashboard render callback error: ${util.inspect(renderError, { depth: null, colors: false })}`);
        return res.status(200).send('<h1>Tableau de bord indisponible</h1><p>Impossible d’afficher le tableau de bord pour le moment.</p>');
      }
      return res.status(200).send(html);
    });
  } catch (error) {
    dashboardError = 'Impossible de charger le tableau de bord.';
    logError(`Dashboard render error: ${util.inspect(error, { depth: null, colors: false })}`);
    return res.status(200).send('<h1>Tableau de bord indisponible</h1><p>Impossible d’afficher le tableau de bord pour le moment.</p>');
  }
}

async function searchVisitors(req, res) {
  try {
    const { q } = req.query;
    const visitors = await findVisitors({ search: q, sort: 'DESC' });
    const stats = await getVisitorStats();
    res.render('admin/dashboard', {
      title: 'Recherche',
      visitors,
      stats,
      username: req.session.username,
      csrfToken: req.csrfToken ? req.csrfToken() : '',
      dashboardError: null
    });
  } catch (error) {
    logError(`Recherche dashboard error: ${error?.message || error}`);
    res.render('admin/dashboard', {
      title: 'Recherche',
      visitors: [],
      stats: { total: 0, today: 0, month: 0 },
      username: req.session?.username || 'admin',
      csrfToken: req.csrfToken ? req.csrfToken() : '',
      dashboardError: 'Impossible de rechercher les visiteurs. Vérifiez la connexion à la base de données.'
    });
  }
}

async function deleteVisitorHandler(req, res) {
  try {
    const deleted = await deleteVisitor(req.params.id);
    if (deleted) {
      logEvent(`Suppression du visiteur ${req.params.id}`);
    }
  } catch (error) {
    logError(`Suppression visiteur échouée: ${error.message}`);
  }
  res.redirect('/admin/dashboard');
}

async function updateVisitorHandler(req, res) {
  try {
    await updateVisitor(req.params.id, req.body);
    logEvent(`Mise à jour du visiteur ${req.params.id}`);
  } catch (error) {
    logError(`Mise à jour visiteur échouée: ${error.message}`);
  }
  res.redirect('/admin/dashboard');
}

module.exports = {
  renderLogin,
  loginAdmin,
  logoutAdmin,
  renderDashboard,
  searchVisitors,
  deleteVisitorHandler,
  updateVisitorHandler,
  ensureAdminSession,
  ensureAdminApi,
  loginLimiter
};
