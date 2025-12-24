-- /backend/src/db/schema.sql
-- Purpose: Defines the database schema for CodeCache Pro.
-- This script is executed on application startup to ensure tables exist.

CREATE TABLE IF NOT EXISTS packages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    version TEXT NOT NULL,
    file_path TEXT NOT NULL UNIQUE,
    size_bytes INTEGER NOT NULL,
    hits INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_accessed TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    checksum TEXT NOT NULL,
    CONSTRAINT unq_package_version UNIQUE (name, version)
);

CREATE INDEX IF NOT EXISTS idx_packages_name ON packages (name);
CREATE INDEX IF NOT EXISTS idx_packages_last_accessed ON packages (last_accessed);

CREATE TABLE IF NOT EXISTS stats (
    key TEXT PRIMARY KEY,
    value INTEGER NOT NULL
);

-- Initialize stats if not present
INSERT INTO stats (key, value) VALUES ('hits', 0) ON CONFLICT(key) DO NOTHING;
INSERT INTO stats (key, value) VALUES ('misses', 0) ON CONFLICT(key) DO NOTHING;
INSERT INTO stats (key, value) VALUES ('bandwidthSaved', 0) ON CONFLICT(key) DO NOTHING;