// Point d'entrée local (développement).
const app = require('./app');
const { logEvent, logError } = require('./config/logger');

const port = Number(process.env.PORT || 3000);

async function startServer() {
  try {
    logEvent('Démarrage du serveur Express (local)');
    app.listen(port, '0.0.0.0', () => {
      console.log(`Serveur démarré sur le port ${port}`);
    });
  } catch (error) {
    logError(`Impossible de démarrer le serveur: ${error?.message || error}`);
    process.exit(1);
  }
}

if (require.main === module) {
  startServer();
}

module.exports = app;
