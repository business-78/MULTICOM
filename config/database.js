// /config/database.js
// Configuration et initialisation de la base de données avec support MySQL ou PostgreSQL.
const mysql = require('mysql2/promise');
const { Pool } = require('pg');
const dns = require('dns');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

try {
  if (typeof dns.setDefaultResultOrder === 'function') {
    dns.setDefaultResultOrder('ipv4first');
  }
} catch (error) {
  // Node version may not support dns.setDefaultResultOrder; ignore and continue.
}

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const databaseUrl = process.env.DATABASE_URL?.trim() || null;
let pool;
let dbAvailable = false;

if (databaseUrl) {
  pool = new Pool({
    connectionString: databaseUrl,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    family: 4
  });
} else {
  const mysqlHost = (process.env.DB_HOST || '127.0.0.1').trim();
  pool = mysql.createPool({
    host: mysqlHost === 'localhost' ? '127.0.0.1' : mysqlHost,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'multicom_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    charset: 'utf8mb4'
  });
}

async function initializeDatabase() {
  if (!pool) {
    console.warn('initializeDatabase: database pool non disponible.');
    dbAvailable = false;
    return;
  }

  try {
    await pool.query('SELECT 1');
    dbAvailable = true;
  } catch (error) {
    console.warn('Database initial connection failed:', error?.message || error);
    pool = null;
    dbAvailable = false;
    return;
  }

  try {
    if (databaseUrl) {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS visitors (
          id SERIAL PRIMARY KEY,
          full_name TEXT NOT NULL,
          email TEXT NOT NULL,
          phone TEXT NOT NULL,
          country TEXT NOT NULL,
          message TEXT,
          service TEXT,
          visited_at TIMESTAMP NOT NULL,
          ip_address TEXT NOT NULL,
          browser TEXT NOT NULL,
          os TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS admin_logs (
          id SERIAL PRIMARY KEY,
          action TEXT NOT NULL,
          details TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS settings (
          config_key TEXT PRIMARY KEY,
          config_value TEXT
        )
      `);
    } else {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS visitors (
          id INT AUTO_INCREMENT PRIMARY KEY,
          full_name VARCHAR(255) NOT NULL,
          email VARCHAR(255) NOT NULL,
          phone VARCHAR(50) NOT NULL,
          country VARCHAR(100) NOT NULL,
          message TEXT,
          service TEXT,
          visited_at DATETIME NOT NULL,
          ip_address VARCHAR(45) NOT NULL,
          browser VARCHAR(255) NOT NULL,
          os VARCHAR(255) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS admin_logs (
          id INT AUTO_INCREMENT PRIMARY KEY,
          action VARCHAR(255) NOT NULL,
          details TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS settings (
          config_key VARCHAR(255) PRIMARY KEY,
          config_value TEXT
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
    }

    if (databaseUrl) {
      await pool.query(`ALTER TABLE visitors ADD COLUMN IF NOT EXISTS message TEXT`);
      await pool.query(`ALTER TABLE visitors ADD COLUMN IF NOT EXISTS service TEXT`);
    } else {
      try {
        await pool.query(`ALTER TABLE visitors ADD COLUMN IF NOT EXISTS message TEXT`);
        await pool.query(`ALTER TABLE visitors ADD COLUMN IF NOT EXISTS service TEXT`);
      } catch (alterError) {
        // Some MySQL versions may not support IF NOT EXISTS on ALTER TABLE; ignore if already exists.
      }
    }

    const logsDir = path.join(__dirname, '..', 'logs');
    if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });
  } catch (error) {
    console.warn('Database init warning:', error?.message || error);
    console.warn('Database init details:', error?.stack || error);
  }
}

module.exports = {
  getPool: () => pool,
  initializeDatabase,
  isDbAvailable: () => dbAvailable
};
