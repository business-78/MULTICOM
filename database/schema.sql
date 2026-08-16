-- Schéma PostgreSQL de référence pour MULTICOM (Neon).
-- Idempotent : peut être exécuté plusieurs fois sans erreur.

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
);

CREATE TABLE IF NOT EXISTS settings (
  config_key TEXT PRIMARY KEY,
  config_value TEXT
);

CREATE INDEX IF NOT EXISTS idx_visitors_visited_at ON visitors (visited_at DESC);

CREATE INDEX IF NOT EXISTS idx_visitors_dedupe ON visitors (email, phone, ip_address, visited_at DESC);
