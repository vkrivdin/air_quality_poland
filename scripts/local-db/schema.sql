-- Powietrze local SQLite schema
-- Mirrors the Supabase schema but works fully offline
-- All timestamps stored as ISO-8601 strings (SQLite has no native datetime type)

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS stations (
  id          TEXT PRIMARY KEY,        -- e.g. "gios_400"
  gios_id     INTEGER UNIQUE,
  code        TEXT,
  name        TEXT NOT NULL,
  city        TEXT NOT NULL,
  street      TEXT,
  commune     TEXT,
  district    TEXT,
  voivodeship TEXT,
  latitude    REAL NOT NULL,
  longitude   REAL NOT NULL,
  source      TEXT NOT NULL DEFAULT 'gios',
  is_active   INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sensors (
  id          INTEGER PRIMARY KEY,     -- GIOŚ sensor id
  station_id  TEXT NOT NULL REFERENCES stations(id),
  param_name  TEXT NOT NULL,           -- e.g. "PM2.5"
  param_code  TEXT NOT NULL,           -- e.g. "PM25"
  param_id    INTEGER,
  formula     TEXT,                    -- e.g. "PM2,5"
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS readings (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  station_id  TEXT NOT NULL REFERENCES stations(id),
  sensor_id   INTEGER REFERENCES sensors(id),
  measured_at TEXT NOT NULL,
  pm25        REAL,
  pm10        REAL,
  no2         REAL,
  o3          REAL,
  so2         REAL,
  co          REAL,
  c6h6        REAL,                    -- Benzene (GIOŚ reports it for some stations)
  aqi_value   REAL,
  aqi_level   TEXT,
  UNIQUE(station_id, sensor_id, measured_at)
);

CREATE TABLE IF NOT EXISTS alerts (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  station_id   TEXT REFERENCES stations(id),
  city         TEXT,
  voivodeship  TEXT,
  alert_type   TEXT NOT NULL,          -- e.g. "pm10_exceedance", "pm25_exceedance"
  pollutant    TEXT,
  threshold    REAL,
  measured     REAL,
  alert_date   TEXT NOT NULL,
  source_url   TEXT,
  raw_text_pl  TEXT,
  raw_text_en  TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS harvest_log (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  script       TEXT NOT NULL,          -- script name that ran
  phase        TEXT NOT NULL,          -- e.g. "stations", "sensors", "readings"
  stations_processed INTEGER DEFAULT 0,
  readings_inserted  INTEGER DEFAULT 0,
  errors_count       INTEGER DEFAULT 0,
  started_at   TEXT NOT NULL,
  finished_at  TEXT,
  notes        TEXT
);

CREATE TABLE IF NOT EXISTS sensor_harvest_state (
  sensor_id    INTEGER PRIMARY KEY,    -- GIOŚ sensor id
  station_id   TEXT NOT NULL,
  last_fetched TEXT,                   -- ISO timestamp of last successful fetch
  oldest_date  TEXT,                   -- earliest data point we have for this sensor
  total_rows   INTEGER DEFAULT 0
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_readings_station_measured ON readings(station_id, measured_at DESC);
CREATE INDEX IF NOT EXISTS idx_readings_measured_at ON readings(measured_at DESC);
CREATE INDEX IF NOT EXISTS idx_sensors_station ON sensors(station_id);
CREATE INDEX IF NOT EXISTS idx_alerts_date ON alerts(alert_date DESC);
