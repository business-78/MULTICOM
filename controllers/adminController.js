// /controllers/adminController.js
// Contrôleur du tableau de bord administrateur.
const bcrypt = require('bcryptjs');
const util = require('util');
const rateLimit = require('express-rate-limit');
const { findVisitors, getVisitorStats, deleteVisitor, updateVisitor } = require('../models/visitorModel');
const { loadSiteSettings } = require('../models/settingsModel');
const { logEvent, logError } = require('../config/logger');

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Trop de tentatives de connexion. Veuillez patienter.'
});

const DEFAULT_ADMIN_PASSWORD = 'Admin@12345';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD?.trim() || DEFAULT_ADMIN_PASSWORD;

async function isValidAdminPassword(password, storedHash) {
  if (!password || typeof password !== 'string') {
    return false;
  }

  const hash = storedHash || process.env.ADMIN_HASH?.trim();
  if (hash) {
    try {
      return await bcrypt.compare(password, hash);
    } catch (error) {
      logError(`Admin hash comparison error: ${error.message}`);
      return false;
    }
  }

  return password === ADMIN_PASSWORD;
}

async function ensureAdminSession(req, res, next) {
  if (req.session && req.session.isAdmin) {
    req.session.cookie.maxAge = 1000 * 60 * 60;
    return next();
  }
  return res.redirect('/admin/login');
}

async function renderLogin(req, res) {
  if (req.session && req.session.isAdmin) {
    return res.redirect('/admin/dashboard');
  }
  res.render('admin/login', { title: 'Connexion admin', error: null, csrfToken: req.csrfToken ? req.csrfToken() : '' });
}

async function loginAdmin(req, res) {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.render('admin/login', { title: 'Connexion admin', error: 'Identifiants requis.', csrfToken: req.csrfToken ? req.csrfToken() : '' });
  }

  try {
    const settings = await loadSiteSettings();
    const adminUsername = settings.adminUsername || process.env.ADMIN_USERNAME?.trim() || 'admin';
    const adminHash = settings.adminPasswordHash || process.env.ADMIN_HASH?.trim();
    const isMatch = username === adminUsername && await isValidAdminPassword(password, adminHash);
    if (isMatch) {
      return req.session.regenerate((regenerateErr) => {
        if (regenerateErr) {
          logError(`Session regeneration error: ${regenerateErr.message}`);
          return res.render('admin/login', { title: 'Connexion admin', error: 'Impossible de démarrer la session.', csrfToken: req.csrfToken ? req.csrfToken() : '' });
        }

        req.session.isAdmin = true;
        req.session.username = username;
        req.session.save((saveErr) => {
          if (saveErr) {
            logError(`Session save error: ${saveErr.message}`);
            return res.render('admin/login', { title: 'Connexion admin', error: 'Impossible de démarrer la session.', csrfToken: req.csrfToken ? req.csrfToken() : '' });
          }

          logEvent(`Connexion admin réussie par ${username}`);
          return res.redirect('/admin/dashboard');
        });
      });
    }
  } catch (error) {
    logError(`Erreur authentification admin: ${error.message}`);
  }

  logError(`Tentative de connexion échouée pour ${username}`);
  return res.render('admin/login', { title: 'Connexion admin', error: 'Identifiants invalides.', csrfToken: req.csrfToken ? req.csrfToken() : '' });
}

function logoutAdmin(req, res) {
  req.session.destroy(() => {
    res.redirect('/admin/login');
  });
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
      username: req.session?.username || ADMIN_USERNAME,
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
    res.render('admin/dashboard', { title: 'Recherche', visitors, stats, username: req.session.username, csrfToken: req.csrfToken ? req.csrfToken() : '', dashboardError: null });
  } catch (error) {
    logError(`Recherche dashboard error: ${error?.message || error}`);
    res.render('admin/dashboard', {
      title: 'Recherche',
      visitors: [],
      stats: { total: 0, today: 0, month: 0 },
      username: req.session?.username || ADMIN_USERNAME,
      csrfToken: req.csrfToken ? req.csrfToken() : '',
      dashboardError: 'Impossible de rechercher les visiteurs. Vérifiez la connexion à la base de données.'
    });
  }
}

async function deleteVisitorHandler(req, res) {
  const deleted = await deleteVisitor(req.params.id);
  if (deleted) {
    logEvent(`Suppression du visiteur ${req.params.id}`);
  }
  res.redirect('/admin/dashboard');
}

async function updateVisitorHandler(req, res) {
  await updateVisitor(req.params.id, req.body);
  logEvent(`Mise à jour du visiteur ${req.params.id}`);
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
  loginLimiter
};
