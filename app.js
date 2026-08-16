const express = require('express');
const path = require('path');
const cookieSession = require('cookie-session');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const csrf = require('csurf');
const rateLimit = require('express-rate-limit');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '.env') });

const { initializeDatabase } = require('./config/database');
const { loadSiteSettings } = require('./models/settingsModel');
const { logEvent, logError, logWarn } = require('./config/logger');
const routes = require('./routes');
const apiRoutes = require('./routes/api');

const app = express();
app.set('trust proxy', 1);

const sessionSecret = process.env.SESSION_SECRET?.trim();
if (!sessionSecret && process.env.NODE_ENV === 'production') {
  logWarn('SESSION_SECRET non configuré en production.');
}

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Trop de requêtes. Veuillez réessayer plus tard.'
});

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "https://cdn.jsdelivr.net", "'unsafe-inline'"],
      styleSrc: ["'self'", "https://cdn.jsdelivr.net", "https://fonts.googleapis.com", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'", 'https://fonts.gstatic.com', 'https://fonts.googleapis.com']
    }
  }
}));
app.use(limiter);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

if (sessionSecret) {
  app.use(cookieSession({
    name: 'multicom.sid',
    keys: [sessionSecret],
    maxAge: 1000 * 60 * 60,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax'
  }));
} else {
  app.use((req, res, next) => {
    req.session = null;
    next();
  });
}

app.use(express.static(path.join(__dirname, 'public')));

const csrfProtection = csrf({ cookie: true });
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  return csrfProtection(req, res, next);
});

app.use((req, res, next) => {
  res.locals.csrfToken = req.csrfToken ? req.csrfToken() : '';
  res.locals.currentPath = req.path;
  next();
});

let initPromise = null;
function ensureInitialized() {
  if (!initPromise) {
    initPromise = initializeDatabase()
      .then(() => loadSiteSettings())
      .catch(() => {
        logError('Initialisation application: échec de démarrage.');
      });
  }
  return initPromise;
}

app.use(async (req, res, next) => {
  try {
    await ensureInitialized();
    next();
  } catch (error) {
    next(error);
  }
});

app.use('/api', apiRoutes);
app.use('/', routes);

app.use((req, res) => {
  res.status(404).render('404', { title: 'Page introuvable' });
});

app.use((err, req, res, next) => {
  logError(`Erreur serveur: ${err.message}`);

  if (req.path.startsWith('/api')) {
    return res.status(err.statusCode || 500).json({
      success: false,
      errors: ['Erreur serveur.']
    });
  }

  return res.status(500).render('error', { title: 'Erreur', message: 'Une erreur est survenue.' });
});

module.exports = app;
