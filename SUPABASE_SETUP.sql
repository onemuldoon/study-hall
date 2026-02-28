-- ─────────────────────────────────────────────────────────────────
-- Study Hall — Supabase Database Setup
-- Run this entire script in: Supabase → SQL Editor → New query
-- ─────────────────────────────────────────────────────────────────

-- 1. Key-value store (replaces window.storage from the app)
CREATE TABLE IF NOT EXISTS kv_store (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz DEFAULT now()
);

-- 2. Users table (custom auth — username + hashed password)
CREATE TABLE IF NOT EXISTS users (
  username text PRIMARY KEY,
  password_hash text NOT NULL,
  display_name text NOT NULL,
  is_admin boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- 3. Seed the WizardOne admin account
INSERT INTO users (username, password_hash, display_name, is_admin)
VALUES ('wizardone', '-14wizz', 'WizardOne', true)
ON CONFLICT (username) DO NOTHING;

-- 4. Allow public read/write on both tables (the app handles its own auth)
ALTER TABLE kv_store ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_kv" ON kv_store FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_users" ON users FOR ALL USING (true) WITH CHECK (true);
