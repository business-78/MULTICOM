const { getPool, isDbAvailable } = require('./config/database');
console.log('isDbAvailable', isDbAvailable());
console.log('pool exists', Boolean(getPool()));
console.log('pool type', typeof getPool()?.query);
