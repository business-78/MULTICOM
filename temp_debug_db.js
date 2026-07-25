const dotenv = require('dotenv');
const util = require('util');
const path = require('path');
const fs = require('fs');

console.log('cwd', process.cwd());
dotenv.config({ path: path.join(process.cwd(), '.env') });
console.log('env DB_HOST', process.env.DB_HOST);
console.log('env DB_PORT', process.env.DB_PORT);
console.log('env DB_USER', process.env.DB_USER);
console.log('env DB_NAME', process.env.DB_NAME);
console.log('env DATABASE_URL', process.env.DATABASE_URL);

const { pool } = require('./config/database');
console.log('pool query type', typeof pool.query);

(async () => {
  try {
    const [res] = await pool.query('SELECT 1 AS x');
    console.log('SELECT 1 result', util.inspect(res, { depth: 2 }));
  } catch (err) {
    console.error('SELECT1 ERROR', util.inspect(err, { depth: 3 }));
  }

  try {
    const [count] = await pool.query('SELECT COUNT(*) AS total FROM visitors');
    console.log('COUNT result', util.inspect(count, { depth: 2 }));
  } catch (err) {
    console.error('COUNT ERROR', util.inspect(err, { depth: 3 }));
  }

  try {
    const { findVisitors } = require('./models/visitorModel');
    const visitors = await findVisitors({ sort: 'DESC' });
    console.log('findVisitors result length', visitors && visitors.length);
  } catch (err) {
    console.error('findVisitors ERROR', util.inspect(err, { depth: 3 }));
  }
})();
