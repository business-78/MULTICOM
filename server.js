// /server.js
// Point d'entrée principal du serveur Express.
const express = require('express');
const path = require('path');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const csrf = require('csurf');
const rateLimit = require('express-rate-limit');
const dotenv = require('dotenv');
const crypto = require('crypto');

dotenv.config({ path: path.resolve(__dirname, '.env') });

const { initializeDatabase } = require('./config/database');
const { loadSiteSettings } = require('./models/settingsModel');
const { logEvent, logError } = require('./config/logger');
const routes = require('./routes');
const apiRoutes = require('./routes/api');

const app = express();
app.set('trust proxy', 1);
const port = Number(process.env.PORT || 3000);

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
app.use(session({
  name: 'multicom.sid',
  secret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex'),
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 1000 * 60 * 60
  }
}));
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

app.use('/api', apiRoutes);
app.use('/', routes);

app.use((req, res) => {
  res.status(404).render('404', { title: 'Page introuvable' });
});

app.use((err, req, res, next) => {
  logError(`Erreur serveur: ${err.message}`);
  console.error(err);
  res.status(500).render('error', { title: 'Erreur', message: 'Une erreur est survenue.' });
});

async function startServer() {
  try {
    await initializeDatabase();
    await loadSiteSettings();
    logEvent('Démarrage du serveur Express');
    app.listen(port, '0.0.0.0', () => {
      console.log(`Serveur démarré sur le port ${port}`);
    });
  } catch (error) {
    logError(`Impossible de démarrer le serveur: ${error?.message || error}`);
    logError(`Détails erreur serveur: ${error?.stack || error}`);
    try {
      await loadSiteSettings();
      logEvent('Chargement des paramètres en mode dégradé');
    } catch (settingsError) {
      logError(`Impossible de charger les paramètres en mode dégradé: ${settingsError?.message || settingsError}`);
    }
    app.listen(port, '0.0.0.0', () => {
      console.log(`Serveur démarré sur le port ${port} avec mode dégradé.`);
    });
  }
}

startServer();
