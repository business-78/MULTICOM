// Modèle visiteurs — PostgreSQL (Neon) uniquement.
const { assertDbAvailable } = require('../config/database');
const { DatabaseUnavailableError } = require('../config/errors');
const { logError } = require('../config/logger');

async function createVisitor(data) {
  const pool = assertDbAvailable();
  const { full_name, email, phone, country, message, service, visited_at, ip_address, browser, os } = data;

  try {
    const dupCheck = await pool.query(
      `SELECT id FROM visitors
       WHERE email = $1 AND phone = $2 AND ip_address = $3
         AND visited_at >= NOW() - INTERVAL '10 seconds'
       LIMIT 1`,
      [email, phone, ip_address]
    );
    if (dupCheck.rows && dupCheck.rows.length) {
      return { id: dupCheck.rows[0].id, isDuplicate: true };
    }

    const result = await pool.query(
      `INSERT INTO visitors (full_name, email, phone, country, message, service, visited_at, ip_address, browser, os)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id`,
      [full_name, email, phone, country, message, service, visited_at, ip_address, browser, os]
    );

    if (!result.rows?.[0]?.id) {
      throw new DatabaseUnavailableError('Insertion visiteur non confirmée.');
    }

    return { id: result.rows[0].id, isDuplicate: false };
  } catch (error) {
    if (error instanceof DatabaseUnavailableError) {
      throw error;
    }
    logError('createVisitor error: base de données indisponible.');
    throw new DatabaseUnavailableError();
  }
}

async function findVisitors(params = {}) {
  const pool = assertDbAvailable();
  const { search, sort = 'DESC' } = params;
  const direction = String(sort).toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

  try {
    let query = 'SELECT * FROM visitors';
    const values = [];

    if (search) {
      query += ' WHERE full_name ILIKE $1 OR email ILIKE $1 OR phone ILIKE $1 OR country ILIKE $1';
      values.push(`%${search}%`);
    }

    query += ` ORDER BY visited_at ${direction}`;

    const result = await pool.query(query, values);
    return result.rows || [];
  } catch (error) {
    if (error instanceof DatabaseUnavailableError) {
      throw error;
    }
    logError('findVisitors error: base de données indisponible.');
    throw new DatabaseUnavailableError();
  }
}

async function getVisitorStats() {
  const pool = assertDbAvailable();

  try {
    const totalResult = await pool.query('SELECT COUNT(*)::int AS total FROM visitors');
    const todayResult = await pool.query(
      "SELECT COUNT(*)::int AS total FROM visitors WHERE DATE(visited_at) = CURRENT_DATE"
    );
    const monthResult = await pool.query(
      `SELECT COUNT(*)::int AS total FROM visitors
       WHERE DATE_PART('month', visited_at) = DATE_PART('month', CURRENT_DATE)
         AND DATE_PART('year', visited_at) = DATE_PART('year', CURRENT_DATE)`
    );

    return {
      total: Number(totalResult.rows?.[0]?.total || 0),
      today: Number(todayResult.rows?.[0]?.total || 0),
      month: Number(monthResult.rows?.[0]?.total || 0)
    };
  } catch (error) {
    if (error instanceof DatabaseUnavailableError) {
      throw error;
    }
    logError('getVisitorStats error: base de données indisponible.');
    throw new DatabaseUnavailableError();
  }
}

async function deleteVisitor(id) {
  const pool = assertDbAvailable();

  try {
    const result = await pool.query('DELETE FROM visitors WHERE id = $1 RETURNING id', [id]);
    return Boolean(result.rowCount);
  } catch (error) {
    logError('Suppression visiteur impossible: base de données indisponible.');
    throw new DatabaseUnavailableError();
  }
}

async function updateVisitor(id, data) {
  const pool = assertDbAvailable();
  const { full_name, email, phone, country } = data;

  try {
    const result = await pool.query(
      'UPDATE visitors SET full_name = $1, email = $2, phone = $3, country = $4 WHERE id = $5 RETURNING id',
      [full_name, email, phone, country, id]
    );
    return Boolean(result.rowCount);
  } catch (error) {
    logError('Mise à jour visiteur impossible: base de données indisponible.');
    throw new DatabaseUnavailableError();
  }
}

module.exports = {
  createVisitor,
  findVisitors,
  getVisitorStats,
  deleteVisitor,
  updateVisitor
};
