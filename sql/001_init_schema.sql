-- Powietrze: initial database schema for Supabase
-- This file mirrors the schema described in docs/project-description.md.

-- Monitoring stations (one row per physical station)
CREATE TABLE IF NOT EXISTS stations (
  id           TEXT PRIMARY KEY,        -- e.g. "gios_123" or "airly_456"
  source       TEXT NOT NULL,           -- 'gios' | 'airly'
  name         TEXT NOT NULL,
  city         TEXT NOT NULL,
  latitude     NUMERIC(9,6) NOT NULL,
  longitude    NUMERIC(9,6) NOT NULL,
  is_active    BOOLEAN DEFAULT true,
  created_at   TIMESTAMPTZ DEFAULT now()
);

-- Periodic air quality readings
CREATE TABLE IF NOT EXISTS readings (
  id           BIGSERIAL PRIMARY KEY,
  station_id   TEXT REFERENCES stations(id),
  measured_at  TIMESTAMPTZ NOT NULL,
  pm25         NUMERIC(6,2),
  pm10         NUMERIC(6,2),
  no2          NUMERIC(6,2),
  o3           NUMERIC(6,2),
  so2          NUMERIC(6,2),
  co           NUMERIC(6,2),
  aqi_value    NUMERIC(6,2),
  aqi_level    TEXT,                    -- 'very_good'|'good'|'moderate'|'bad'|'very_bad'
  fetched_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_readings_station_time
  ON readings(station_id, measured_at DESC);

-- Normalised city name for diacritic-insensitive lookups
ALTER TABLE stations
ADD COLUMN IF NOT EXISTS city_normalized TEXT GENERATED ALWAYS AS (
  translate(
    lower(city),
    'ąćęłńóśźż',
    'acelnoszz'
  )
) STORED;

CREATE INDEX IF NOT EXISTS idx_stations_city_normalized
  ON stations(city_normalized);

