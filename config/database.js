// Configuration PostgreSQL (Neon) via DATABASE_URL uniquement.
const { Pool } = require('pg');
const dns = require('dns');
const dotenv = require('dotenv');
const path = require('path');
const { DatabaseUnavailableError } = require('./errors');

try {
  if (typeof dns.setDefaultResultOrder === 'function') {
    dns.setDefaultResultOrder('ipv4first');
  }
} catch (error) {
  // Node version may not support dns.setDefaultResultOrder; ignore and continue.
}

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const databaseUrl = process.env.DATABASE_URL?.trim() || null;
let pool = null;
let dbAvailable = false;

function createPool() {
  if (!databaseUrl) {
    return null;
  }

  const useSsl = databaseUrl.includes('sslmode=require') || process.env.NODE_ENV === 'production';
  return new Pool({
    connectionString: databaseUrl,
    ssl: useSsl ? { rejectUnauthorized: false } : false,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000
  });
}

async function initializeDatabase() {
  if (!databaseUrl) {
    console.warn('initializeDatabase: DATABASE_URL non configurée.');
    pool = null;
    dbAvailable = false;
    return;
  }

  pool = createPool();

  try {
    await pool.query('SELECT 1');
    dbAvailable = true;
  } catch (error) {
    console.warn('Database initial connection failed.');
    try {
      await pool.end();
    } catch (endError) {
      // ignore pool shutdown errors
    }
    pool = null;
    dbAvailable = false;
    return;
  }

  try {
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
      CREATE TABLE IF NOT EXISTS settings (
        config_key TEXT PRIMARY KEY,
        config_value TEXT
      )
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_visitors_visited_at ON visitors (visited_at DESC)
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_visitors_dedupe ON visitors (email, phone, ip_address, visited_at DESC)
    `);
  } catch (error) {
    console.warn('Database schema initialization warning.');
  }
}

function getPool() {
  return pool;
}

function isDbAvailable() {
  return dbAvailable && Boolean(pool);
}

function assertDbAvailable() {
  if (!isDbAvailable()) {
    throw new DatabaseUnavailableError();
  }
  return pool;
}

module.exports = {
  getPool,
  initializeDatabase,
  isDbAvailable,
  assertDbAvailable
};
