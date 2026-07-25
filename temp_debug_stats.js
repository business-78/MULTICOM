const { getVisitorStats } = require('./models/visitorModel');

(async () => {
  try {
    const stats = await getVisitorStats();
    console.log('STATS', stats);
  } catch (error) {
    console.error('ERROR TYPE', typeof error);
    console.error('ERROR', error);
    console.error('ERROR MESSAGE', error && error.message);
    console.error('ERROR STACK', error && error.stack);
    process.exit(1);
  }
})();
