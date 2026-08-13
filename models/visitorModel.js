// /models/visitorModel.js
// Modèle de gestion des visiteurs avec support MySQL et PostgreSQL.
const { getPool, isDbAvailable } = require('../config/database');
const { logError } = require('../config/logger');
const fs = require('fs');
const path = require('path');

const fallbackFile = path.join(__dirname, '..', 'database', 'visitors_fallback.json');

function readFallbackVisitors() {
  try {
    if (!fs.existsSync(fallbackFile)) return [];
    const raw = fs.readFileSync(fallbackFile, 'utf8');
    return JSON.parse(raw || '[]');
  } catch (error) {
    logError(`Lecture fallback visitors impossible: ${error.message}`);
    return [];
  }
}

function writeFallbackVisitors(visitors) {
  try {
    fs.mkdirSync(path.dirname(fallbackFile), { recursive: true });
    fs.writeFileSync(fallbackFile, JSON.stringify(visitors, null, 2), 'utf8');
  } catch (error) {
    logError(`Écriture fallback visitors impossible: ${error.message}`);
  }
}

function isPostgres() {
  return Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL.includes('postgres'));
}

function normalizeRows(rows) {
  return Array.isArray(rows) ? rows : [];
}

function getDbErrorMessage(error) {
  if (!error) return 'Erreur inconnue de la base de données.';
  if (error instanceof AggregateError && Array.isArray(error.errors)) {
    return error.errors.map((err) => err?.message || String(err)).join(' | ');
  }
  return error.message || String(error);
}

async function createVisitor(data) {
  const pool = getPool();
  const { full_name, email, phone, country, message, service, visited_at, ip_address, browser, os } = data;

  if (!pool || !isDbAvailable()) {
    const fallback = readFallbackVisitors();
    try {
      // check fallback for recent duplicate (10s window)
      const recent = fallback.find(
        (v) => v.email === email && v.phone === phone && v.ip_address === ip_address && Math.abs(new Date().getTime() - new Date(v.created_at).getTime()) < 10000
      );
      if (recent) {
        return { id: recent.id, isDuplicate: true };
      }
    } catch (err) {
      // ignore fallback dedupe errors
    }

    const newVisitor = {
      id: fallback.length ? fallback[fallback.length - 1].id + 1 : 1,
      full_name,
      email,
      phone,
      country,
      message,
      service,
      visited_at,
      ip_address,
      browser,
      os,
      created_at: new Date().toISOString()
    };
    fallback.push(newVisitor);
    writeFallbackVisitors(fallback);
    logError('createVisitor fallback: database unavailable, sauvegarde locale utilisée.');
    return { id: newVisitor.id, isDuplicate: false };
  }

  if (isPostgres()) {
    try {
      // Basic deduplication: if an identical visitor (email+phone+ip) was recorded very recently, return existing id
      const dupCheck = await pool.query(
        `SELECT id FROM visitors WHERE email = $1 AND phone = $2 AND ip_address = $3 AND visited_at >= NOW() - INTERVAL '10 seconds' LIMIT 1`,
        [email, phone, ip_address]
      );
      if (dupCheck.rows && dupCheck.rows.length) {
        return { id: dupCheck.rows[0].id, isDuplicate: true };
      }
    } catch (err) {
      // ignore dedupe errors and continue to insert
    }
    const result = await pool.query(
      `INSERT INTO visitors (full_name, email, phone, country, message, service, visited_at, ip_address, browser, os)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
      [full_name, email, phone, country, message, service, visited_at, ip_address, browser, os]
    );
    return { id: result.rows[0].id, isDuplicate: false };
  }
  try {
    // MySQL dedupe fallback
    const [existing] = await pool.execute(
      `SELECT id FROM visitors WHERE email = ? AND phone = ? AND ip_address = ? AND visited_at >= DATE_SUB(NOW(), INTERVAL 10 SECOND) LIMIT 1`,
      [email, phone, ip_address]
    );
    if (Array.isArray(existing) && existing.length) {
      return { id: existing[0].id, isDuplicate: true };
    }
  } catch (err) {
    // ignore and continue
  }
  const [result] = await pool.execute(
    `INSERT INTO visitors (full_name, email, phone, country, message, service, visited_at, ip_address, browser, os)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [full_name, email, phone, country, message, service, visited_at, ip_address, browser, os]
  );
  return { id: result.insertId, isDuplicate: false };
}

async function findVisitors(params = {}) {
  const pool = getPool();
  if (!pool || !isDbAvailable()) {
    logError('findVisitors fallback: database unavailable, lecture locale utilisée.');
    return readFallbackVisitors();
  }

  const { search, sort = 'DESC' } = params;
  let query = 'SELECT * FROM visitors';
  const values = [];

  try {
    if (search) {
      if (isPostgres()) {
        query += ' WHERE full_name ILIKE $1 OR email ILIKE $1 OR phone ILIKE $1 OR country ILIKE $1';
        values.push(`%${search}%`);
      } else {
        query += ' WHERE full_name LIKE ? OR email LIKE ? OR phone LIKE ? OR country LIKE ?';
        values.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
      }
    }

    query += ` ORDER BY visited_at ${sort}`;
    const result = isPostgres()
      ? await pool.query(query, values)
      : await pool.execute(query, values);
    return normalizeRows(isPostgres() ? result.rows : result[0]);
  } catch (error) {
    logError(`findVisitors error: ${getDbErrorMessage(error)}`);
    return [];
  }
}

async function getVisitorStats() {
  const pool = getPool();
  if (!pool || !isDbAvailable()) {
    logError('getVisitorStats fallback: database unavailable, statistiques locales utilisées.');
    const visitors = readFallbackVisitors();
    const today = new Date().toISOString().slice(0, 10);
    const month = new Date().toISOString().slice(0, 7);
    return {
      total: visitors.length,
      today: visitors.filter((v) => v.visited_at.startsWith(today)).length,
      month: visitors.filter((v) => v.visited_at.startsWith(month)).length
    };
  }

  try {
    const totalResult = isPostgres()
      ? await pool.query('SELECT COUNT(*)::int AS total FROM visitors')
      : await pool.query('SELECT COUNT(*) AS total FROM visitors');
    const todayResult = isPostgres()
      ? await pool.query("SELECT COUNT(*)::int AS total FROM visitors WHERE DATE(visited_at) = CURRENT_DATE")
      : await pool.query("SELECT COUNT(*) AS total FROM visitors WHERE DATE(visited_at) = CURDATE()");
    const monthResult = isPostgres()
      ? await pool.query("SELECT COUNT(*)::int AS total FROM visitors WHERE DATE_PART('month', visited_at) = DATE_PART('month', CURRENT_DATE) AND DATE_PART('year', visited_at) = DATE_PART('year', CURRENT_DATE)")
      : await pool.query("SELECT COUNT(*) AS total FROM visitors WHERE MONTH(visited_at) = MONTH(CURDATE()) AND YEAR(visited_at) = YEAR(CURDATE())");

    const total = isPostgres() ? totalResult.rows?.[0]?.total : totalResult?.[0]?.[0]?.total;
    const today = isPostgres() ? todayResult.rows?.[0]?.total : todayResult?.[0]?.[0]?.total;
    const month = isPostgres() ? monthResult.rows?.[0]?.total : monthResult?.[0]?.[0]?.total;

    return {
      total: Number(total || 0),
      today: Number(today || 0),
      month: Number(month || 0)
    };
  } catch (error) {
    logError(`getVisitorStats error: ${getDbErrorMessage(error)}`);
    return { total: 0, today: 0, month: 0 };
  }
}

async function deleteVisitor(id) {
  const pool = getPool();
  if (!pool || !isDbAvailable()) {
    logError('deleteVisitor impossible: database unavailable.');
    return false;
  }

  try {
    if (isPostgres()) {
      await pool.query('DELETE FROM visitors WHERE id = $1', [id]);
    } else {
      await pool.execute('DELETE FROM visitors WHERE id = ?', [id]);
    }
    return true;
  } catch (error) {
    logError(`Suppression visiteur impossible: ${getDbErrorMessage(error)}`);
    return false;
  }
}

async function updateVisitor(id, data) {
  const pool = getPool();
  if (!pool || !isDbAvailable()) {
    logError('updateVisitor impossible: database unavailable.');
    return false;
  }

  const { full_name, email, phone, country } = data;
  try {
    if (isPostgres()) {
      await pool.query('UPDATE visitors SET full_name = $1, email = $2, phone = $3, country = $4 WHERE id = $5', [full_name, email, phone, country, id]);
    } else {
      await pool.execute('UPDATE visitors SET full_name = ?, email = ?, phone = ?, country = ? WHERE id = ?', [full_name, email, phone, country, id]);
    }
    return true;
  } catch (error) {
    logError(`Mise à jour visiteur impossible: ${getDbErrorMessage(error)}`);
    return false;
  }
}

module.exports = {
  createVisitor,
  findVisitors,
  getVisitorStats,
  deleteVisitor,
  updateVisitor
};
