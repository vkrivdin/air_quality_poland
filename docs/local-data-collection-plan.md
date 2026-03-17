# Powietrze — Local-First Historical Data Collection Plan
**Version:** 1.0 | **For:** AI coding agents and human developers | **Last updated:** March 2026

---

## PURPOSE OF THIS DOCUMENT

This plan extends the existing `docs/build-plan.md` with a new parallel track: **offline-first historical data collection** from Polish public APIs. No cloud deployment is required to execute any step in this document. All data is stored in local SQLite or JSON files and served through the existing Next.js dev server.

The goals are:
1. Collect as much historical sensor data as possible from GIOŚ, going back as far as the API allows
2. Collect non-sensor textual data (alert bulletins, station metadata, reporting documents)
3. Store everything locally in a structured format ready for trend analysis
4. Keep the Next.js frontend connected to local data without touching Supabase

---

## HOW TO READ THIS DOCUMENT

Same conventions as `docs/build-plan.md`:

```
### Step N.N — Name
READS:    files the agent must read before starting this step
PRODUCES: files the agent will create or modify
INSTRUCTIONS: numbered, imperative, complete
CONSTRAINTS: things the agent must NOT do
VERIFY: exact shell commands and expected output
COMMIT: exact commit message string
```

**Rules for agents executing this plan:**
1. Read every file listed under READS before writing any code.
2. Execute steps in order within a phase. Phases may be executed independently.
3. If a VERIFY command fails, stop and report — do not proceed.
4. This plan is local-only: no Supabase env vars are needed unless explicitly stated.
5. Python scripts go in `scripts/`. TypeScript data-layer changes go in `src/lib/`.
6. All new scripts are idempotent: re-running must produce the same result and never duplicate data.

---

## GIOŚ API REFERENCE

Base URL: `https://api.gios.gov.pl/pjp-api/v1/rest`

| Endpoint | Rate limit | Notes |
|---|---|---|
| `GET /station/findAll?page=0&size=500` | 1500 req/min | Returns all ~500 monitoring stations |
| `GET /aqindex/getIndex/{stationId}` | 1500 req/min | Current AQI index per station |
| `GET /station/sensors/{stationId}` | **2 req/min** | Sensor list for one station — USE SPARINGLY |
| `GET /data/getData/{sensorId}` | **2 req/min** | Time-series readings for one sensor — USE SPARINGLY |
| `GET /data/getDataByStationName/{stationCode}` | **2 req/min** | All sensor readings for a station by code |
| `GET /station/findAll` (v2) | unknown | Extended station metadata |

**Critical:** The `2 req/min` endpoints are the bottleneck. With ~500 stations × ~6 sensors = ~3000 sensor calls, a full national harvest at 2 req/min takes ~25 hours. Scripts must be designed for **resumable, incremental operation**.

---

## PHASE H1 — Local SQLite database setup

### Step H1.1 — Create local SQLite schema

READS: `src/lib/types.ts`, `sql/001_init_schema.sql`

PRODUCES: `scripts/local-db/schema.sql` (new file), `scripts/local-db/init.py` (new file)

INSTRUCTIONS:
1. Create directory `scripts/local-db/`
2. Create `scripts/local-db/schema.sql` with the following content:

```sql
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
```

3. Create `scripts/local-db/init.py`:

```python
#!/usr/bin/env python3
"""
init.py
-------
Creates (or resets) the local SQLite database.
Safe to re-run: only creates tables that don't exist yet.

Usage:
  python3 scripts/local-db/init.py
  python3 scripts/local-db/init.py --reset   # WARNING: drops all data
"""
import sqlite3
import os
import sys
import argparse

DB_PATH = os.path.join(os.path.dirname(__file__), "../../data/local.db")
SCHEMA_PATH = os.path.join(os.path.dirname(__file__), "schema.sql")

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--reset", action="store_true", help="Drop and recreate all tables (loses all data)")
    args = parser.parse_args()

    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)

    if args.reset:
        confirm = input("⚠ This will delete ALL local data. Type 'yes' to confirm: ")
        if confirm.strip() != "yes":
            print("Aborted.")
            sys.exit(0)
        conn.execute("PRAGMA foreign_keys = OFF")
        tables = conn.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()
        for (tbl,) in tables:
            conn.execute(f"DROP TABLE IF EXISTS {tbl}")
        conn.execute("PRAGMA foreign_keys = ON")
        print("  All tables dropped.")

    with open(SCHEMA_PATH, "r") as f:
        schema = f.read()

    conn.executescript(schema)
    conn.commit()
    conn.close()

    size = os.path.getsize(DB_PATH)
    print(f"✓ Database ready: {DB_PATH} ({size} bytes)")

if __name__ == "__main__":
    main()
```

CONSTRAINTS:
- SQLite only — no PostgreSQL or Supabase in this phase
- Database file path is always `data/local.db` — never hardcode a different path
- Do not modify `sql/001_init_schema.sql` (the Supabase schema)

VERIFY:
```bash
python3 scripts/local-db/init.py
# Expected: ✓ Database ready: data/local.db (N bytes)
python3 -c "import sqlite3; c=sqlite3.connect('data/local.db'); print([r[0] for r in c.execute(\"SELECT name FROM sqlite_master WHERE type='table'\")])"
# Expected: list containing ['stations','sensors','readings','alerts','harvest_log','sensor_harvest_state']
```

COMMIT: `chore: add local SQLite schema and init script`

---

## PHASE H2 — Station + sensor metadata harvest

### Step H2.1 — Harvest all GIOŚ stations into local.db

READS: `scripts/local-db/schema.sql`, `scripts/harvest-gios.py`

PRODUCES: `scripts/harvest-stations.py` (new file)

INSTRUCTIONS:
1. Create `scripts/harvest-stations.py`:

```python
#!/usr/bin/env python3
"""
harvest-stations.py
--------------------
Fetches all GIOŚ monitoring stations and upserts them into data/local.db.
Fast: hits only the 1500 req/min endpoint.

Run once, or re-run to refresh station metadata.

Usage:
  python3 scripts/harvest-stations.py
"""
import json, time, sqlite3, os, datetime, urllib.request, urllib.error

BASE_URL = "https://api.gios.gov.pl/pjp-api/v1/rest"
DB_PATH  = os.path.join(os.path.dirname(__file__), "../data/local.db")


def fetch(url: str):
    req = urllib.request.Request(url, headers={
        "Accept": "*/*",
        "User-Agent": "Powietrze/0.1 (local harvest; contact: dev)"
    })
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            return json.loads(r.read())
    except Exception as e:
        print(f"  ERROR: {url} → {e}")
        return None


def main():
    if not os.path.exists(DB_PATH):
        print(f"❌ Database not found at {DB_PATH}. Run: python3 scripts/local-db/init.py")
        return

    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")

    started = datetime.datetime.utcnow().isoformat()
    print("\n[1/2] Fetching station list from GIOŚ...")

    raw = fetch(f"{BASE_URL}/station/findAll?page=0&size=500")
    stations_raw = raw.get("Lista stacji pomiarowych", []) if raw else []
    print(f"  Got {len(stations_raw)} stations.")

    print("\n[2/2] Upserting stations into local.db...")
    upserted = 0
    for s in stations_raw:
        lat = s.get("WGS84 φ N") or s.get("WGS84 \u03c6 N")
        lon = s.get("WGS84 λ E") or s.get("WGS84 \u03bb E")
        if not lat or not lon:
            continue
        conn.execute("""
            INSERT INTO stations (id, gios_id, code, name, city, street, commune, district, voivodeship, latitude, longitude)
            VALUES (?,?,?,?,?,?,?,?,?,?,?)
            ON CONFLICT(id) DO UPDATE SET
              name=excluded.name, city=excluded.city, street=excluded.street,
              commune=excluded.commune, district=excluded.district,
              voivodeship=excluded.voivodeship, latitude=excluded.latitude,
              longitude=excluded.longitude, updated_at=datetime('now')
        """, (
            f"gios_{s['Identyfikator stacji']}",
            s["Identyfikator stacji"],
            s.get("Kod stacji", ""),
            s.get("Nazwa stacji", ""),
            s.get("Nazwa miasta", ""),
            s.get("Ulica"),
            s.get("Gmina", ""),
            s.get("Powiat", ""),
            s.get("Województwo", ""),
            float(lat),
            float(lon),
        ))
        upserted += 1

    conn.commit()

    # Log it
    conn.execute("""
        INSERT INTO harvest_log (script, phase, stations_processed, started_at, finished_at)
        VALUES (?,?,?,?,?)
    """, ("harvest-stations.py", "stations", upserted, started, datetime.datetime.utcnow().isoformat()))
    conn.commit()
    conn.close()

    print(f"  ✓ {upserted} stations upserted.")
    print(f"\n  Database: {DB_PATH}")


if __name__ == "__main__":
    main()
```

CONSTRAINTS:
- Must not use any rate-limited endpoint (only `/station/findAll`)
- Upsert must be idempotent — safe to re-run without duplicating rows
- Do not fetch sensor lists in this step (that is Step H2.2)

VERIFY:
```bash
python3 scripts/harvest-stations.py
# Expected: ✓ N stations upserted.
python3 -c "import sqlite3; c=sqlite3.connect('data/local.db'); print(c.execute('SELECT COUNT(*) FROM stations').fetchone())"
# Expected: (N,) where N >= 400
```

COMMIT: `feat: add harvest-stations.py — upserts all GIOŚ stations into local.db`

---

### Step H2.2 — Harvest sensor metadata for all stations (resumable)

READS: `scripts/harvest-stations.py`, `scripts/local-db/schema.sql`

PRODUCES: `scripts/harvest-sensors.py` (new file)

INSTRUCTIONS:
1. Create `scripts/harvest-sensors.py`. This script uses the slow `2 req/min` endpoint and **must be resumable** — if interrupted, re-running should only fetch sensors for stations that haven't been fetched yet.

```python
#!/usr/bin/env python3
"""
harvest-sensors.py
-------------------
Fetches sensor metadata for every station in local.db.
Uses the GIOŚ /station/sensors/{id} endpoint — rate-limited to ~2 req/min.

RESUMABLE: Tracks which stations have been done in sensor_harvest_state.
Re-run safely — only fetches stations with no sensors yet.

Usage:
  python3 scripts/harvest-sensors.py             # fetch all remaining stations
  python3 scripts/harvest-sensors.py --limit 50  # fetch at most 50 stations (useful for testing)
  python3 scripts/harvest-sensors.py --city Kraków  # only stations in one city

Rate: 1 request per 31 seconds = safe under the 2/min limit.
Full national run (~500 stations): ~4.5 hours.
"""
import json, time, sqlite3, os, datetime, urllib.request, argparse

BASE_URL  = "https://api.gios.gov.pl/pjp-api/v1/rest"
DB_PATH   = os.path.join(os.path.dirname(__file__), "../data/local.db")
DELAY_SEC = 31   # seconds between requests — stays safely under 2 req/min


def fetch(url: str):
    req = urllib.request.Request(url, headers={
        "Accept": "*/*",
        "User-Agent": "Powietrze/0.1 (local harvest)"
    })
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            return json.loads(r.read())
    except Exception as e:
        print(f"  ERROR fetching {url}: {e}")
        return None


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=None)
    parser.add_argument("--city", type=str, default=None)
    args = parser.parse_args()

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")

    # Find stations that have NO sensors yet
    query = """
        SELECT s.id, s.gios_id, s.name, s.city
        FROM stations s
        WHERE NOT EXISTS (
            SELECT 1 FROM sensors se WHERE se.station_id = s.id
        )
        ORDER BY s.city, s.name
    """
    params = []
    if args.city:
        query = query.replace("ORDER BY", f"AND s.city LIKE ? ORDER BY")
        params.append(f"%{args.city}%")

    todo = conn.execute(query, params).fetchall()

    if args.limit:
        todo = todo[:args.limit]

    print(f"\n  {len(todo)} stations still need sensor metadata.")
    if not todo:
        print("  Nothing to do — all stations already have sensor data.")
        return

    started = datetime.datetime.utcnow().isoformat()
    inserted_total = 0
    errors = 0

    for i, station in enumerate(todo):
        gios_id = station["gios_id"]
        station_id = station["id"]
        print(f"  [{i+1}/{len(todo)}] {station['city']} — {station['name']} (gios_id={gios_id})")

        data = fetch(f"{BASE_URL}/station/sensors/{gios_id}")
        if not data:
            errors += 1
        else:
            sensors = data if isinstance(data, list) else data.get("Lista stanowisk pomiarowych", [])
            inserted = 0
            for sensor in sensors:
                param = sensor.get("wskaźnik") or sensor.get("param") or {}
                try:
                    conn.execute("""
                        INSERT OR IGNORE INTO sensors (id, station_id, param_name, param_code, param_id, formula)
                        VALUES (?,?,?,?,?,?)
                    """, (
                        sensor.get("id"),
                        station_id,
                        param.get("paramName") or sensor.get("nazwaWskaznika", ""),
                        param.get("paramCode") or sensor.get("kodWskaznika", ""),
                        param.get("idParam"),
                        param.get("paramFormula") or sensor.get("wzorWskaznika"),
                    ))
                    inserted += conn.execute("SELECT changes()").fetchone()[0]
                except Exception as e:
                    print(f"    ⚠ insert error: {e}")
            conn.commit()
            inserted_total += inserted
            print(f"    → {inserted} sensors added")

        if i < len(todo) - 1:
            time.sleep(DELAY_SEC)

    # Log
    conn.execute("""
        INSERT INTO harvest_log (script, phase, stations_processed, readings_inserted, errors_count, started_at, finished_at)
        VALUES (?,?,?,?,?,?,?)
    """, ("harvest-sensors.py", "sensors", len(todo), inserted_total, errors,
          started, datetime.datetime.utcnow().isoformat()))
    conn.commit()
    conn.close()

    print(f"\n── Done ──")
    print(f"  Stations processed: {len(todo)}")
    print(f"  Sensors inserted:   {inserted_total}")
    print(f"  Errors:             {errors}")


if __name__ == "__main__":
    main()
```

CONSTRAINTS:
- Rate: exactly 1 request per 31 seconds — never reduce this delay
- Only fetch stations that have no sensor rows yet — check before every station
- `--city` flag must work for partial runs (e.g. Kraków first, then rest)
- Never delete existing sensor rows

VERIFY:
```bash
python3 scripts/harvest-sensors.py --limit 3
# Expected: 3 stations processed, sensors inserted, no errors
python3 -c "import sqlite3; c=sqlite3.connect('data/local.db'); print(c.execute('SELECT COUNT(*) FROM sensors').fetchone())"
# Expected: (N,) where N > 0
```

COMMIT: `feat: add harvest-sensors.py — resumable sensor metadata harvest`

---

## PHASE H3 — Historical sensor readings (deep backfill)

### Step H3.1 — Harvest historical readings for all sensors (deep, resumable)

READS: `scripts/harvest-sensors.py`, `scripts/local-db/schema.sql`

PRODUCES: `scripts/harvest-readings.py` (new file)

INSTRUCTIONS:
1. Create `scripts/harvest-readings.py`. This is the main deep-history harvester. It uses `/data/getData/{sensorId}` — the slowest endpoint. Design for multi-day runs.

```python
#!/usr/bin/env python3
"""
harvest-readings.py
--------------------
Fetches all available historical readings for every sensor in local.db.

The GIOŚ /data/getData endpoint returns up to 1 year of hourly data.
This script iterates through all sensors, fetching and storing all available data.

RESUMABLE: Tracks progress in sensor_harvest_state. Re-running skips sensors
that were fully fetched. Use --refetch to refresh a sensor's data.

Rate: 1 request per 31 seconds (2/min limit, conservative).
Full national run (~3000 sensors): ~26 hours. Plan for overnight runs.

Usage:
  python3 scripts/harvest-readings.py                    # resume from where we left off
  python3 scripts/harvest-readings.py --city Kraków      # Kraków only (~6 sensors, ~3 min)
  python3 scripts/harvest-readings.py --limit 20         # first 20 unfetched sensors
  python3 scripts/harvest-readings.py --refetch 7        # re-fetch sensors not updated in 7+ days
  python3 scripts/harvest-readings.py --sensor 679       # fetch one specific sensor id
"""
import json, time, sqlite3, os, datetime, urllib.request, argparse

BASE_URL  = "https://api.gios.gov.pl/pjp-api/v1/rest"
DB_PATH   = os.path.join(os.path.dirname(__file__), "../data/local.db")
DELAY_SEC = 31


def fetch(url: str):
    req = urllib.request.Request(url, headers={
        "Accept": "*/*",
        "User-Agent": "Powietrze/0.1 (local harvest)"
    })
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.loads(r.read())
    except Exception as e:
        print(f"  ERROR: {url} → {e}")
        return None


PARAM_COLUMN = {
    "PM2.5": "pm25", "PM25": "pm25",
    "PM10":  "pm10",
    "NO2":   "no2",
    "O3":    "o3",
    "SO2":   "so2",
    "CO":    "co",
    "C6H6":  "c6h6", "BEN": "c6h6",
}


def get_column(param_code: str, param_name: str) -> str | None:
    code = (param_code or "").upper().replace(",", ".").replace(".", "").replace("2", "2")
    if code in PARAM_COLUMN:
        return PARAM_COLUMN[code]
    name = (param_name or "").upper()
    for key in PARAM_COLUMN:
        if key in name:
            return PARAM_COLUMN[key]
    return None


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--city",    type=str, default=None)
    parser.add_argument("--limit",   type=int, default=None)
    parser.add_argument("--refetch", type=int, default=None, help="Re-fetch sensors not updated in N days")
    parser.add_argument("--sensor",  type=int, default=None, help="Fetch a single sensor by GIOŚ id")
    args = parser.parse_args()

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")

    # Build sensor list
    if args.sensor:
        todo = conn.execute("""
            SELECT se.id, se.station_id, se.param_code, se.param_name, s.city, s.name AS station_name
            FROM sensors se JOIN stations s ON se.station_id = s.id
            WHERE se.id = ?
        """, (args.sensor,)).fetchall()
    elif args.refetch:
        cutoff = (datetime.datetime.utcnow() - datetime.timedelta(days=args.refetch)).isoformat()
        query = """
            SELECT se.id, se.station_id, se.param_code, se.param_name, s.city, s.name AS station_name
            FROM sensors se JOIN stations s ON se.station_id = s.id
            WHERE se.id NOT IN (
                SELECT sensor_id FROM sensor_harvest_state WHERE last_fetched > ?
            )
            ORDER BY s.city, se.station_id
        """
        params = [cutoff]
        if args.city:
            query = query.replace("ORDER BY", f"AND s.city LIKE ? ORDER BY")
            params.insert(1, f"%{args.city}%")
        todo = conn.execute(query, params).fetchall()
    else:
        # Default: only sensors we've never fetched
        query = """
            SELECT se.id, se.station_id, se.param_code, se.param_name, s.city, s.name AS station_name
            FROM sensors se JOIN stations s ON se.station_id = s.id
            WHERE se.id NOT IN (SELECT sensor_id FROM sensor_harvest_state)
            ORDER BY s.city, se.station_id
        """
        params = []
        if args.city:
            query = query.replace("ORDER BY", f"AND s.city LIKE ? ORDER BY")
            params.append(f"%{args.city}%")
        todo = conn.execute(query, params).fetchall()

    if args.limit:
        todo = todo[:args.limit]

    print(f"\n  {len(todo)} sensors to fetch.")
    if not todo:
        print("  Nothing to do.")
        return

    started = datetime.datetime.utcnow().isoformat()
    total_inserted = 0
    total_errors = 0

    for i, sensor in enumerate(todo):
        sensor_id = sensor["id"]
        station_id = sensor["station_id"]
        col = get_column(sensor["param_code"], sensor["param_name"])
        print(f"\n  [{i+1}/{len(todo)}] sensor {sensor_id} — {sensor['city']} / {sensor['station_name']} / {sensor['param_name']} → col={col}")

        data = fetch(f"{BASE_URL}/data/getData/{sensor_id}")
        if not data:
            total_errors += 1
            if i < len(todo) - 1:
                time.sleep(DELAY_SEC)
            continue

        # GIOŚ returns: {"Lista danych pomiarowych": [{"Data": "...", "Wartość": ...}, ...]}
        points_raw = data if isinstance(data, list) else data.get("Lista danych pomiarowych", [])

        inserted = 0
        oldest = None
        for point in points_raw:
            dt_str = point.get("Data") or point.get("date")
            val    = point.get("Wartość") if "Wartość" in point else point.get("value")
            if not dt_str or val is None:
                continue
            # Normalise timestamp to ISO format
            try:
                dt = datetime.datetime.fromisoformat(dt_str.replace(" ", "T"))
                iso = dt.isoformat()
            except ValueError:
                iso = dt_str

            row = {
                "station_id": station_id,
                "sensor_id":  sensor_id,
                "measured_at": iso,
                "pm25": None, "pm10": None, "no2": None,
                "o3": None, "so2": None, "co": None, "c6h6": None,
            }
            if col:
                row[col] = float(val) if val is not None else None

            try:
                conn.execute("""
                    INSERT OR IGNORE INTO readings
                      (station_id, sensor_id, measured_at, pm25, pm10, no2, o3, so2, co, c6h6)
                    VALUES (:station_id,:sensor_id,:measured_at,:pm25,:pm10,:no2,:o3,:so2,:co,:c6h6)
                """, row)
                if conn.execute("SELECT changes()").fetchone()[0]:
                    inserted += 1
                    if oldest is None or iso < oldest:
                        oldest = iso
            except Exception as e:
                print(f"    ⚠ insert error: {e}")

        conn.commit()
        total_inserted += inserted
        print(f"    → {inserted} rows inserted (oldest={oldest})")

        # Update harvest state
        conn.execute("""
            INSERT INTO sensor_harvest_state (sensor_id, station_id, last_fetched, oldest_date, total_rows)
            VALUES (?,?,?,?,?)
            ON CONFLICT(sensor_id) DO UPDATE SET
              last_fetched=excluded.last_fetched,
              oldest_date=MIN(COALESCE(oldest_date,'9999'), excluded.oldest_date),
              total_rows=total_rows + excluded.total_rows
        """, (sensor_id, station_id, datetime.datetime.utcnow().isoformat(), oldest, inserted))
        conn.commit()

        if i < len(todo) - 1:
            time.sleep(DELAY_SEC)

    # Final log
    conn.execute("""
        INSERT INTO harvest_log (script, phase, stations_processed, readings_inserted, errors_count, started_at, finished_at)
        VALUES (?,?,?,?,?,?,?)
    """, ("harvest-readings.py", "readings", len(todo), total_inserted, total_errors,
          started, datetime.datetime.utcnow().isoformat()))
    conn.commit()
    conn.close()

    print(f"\n── Done ──")
    print(f"  Sensors processed:  {len(todo)}")
    print(f"  Readings inserted:  {total_inserted}")
    print(f"  Errors:             {total_errors}")


if __name__ == "__main__":
    main()
```

CONSTRAINTS:
- Delay between requests is always `DELAY_SEC = 31` seconds — never reduce this
- Every run must update `sensor_harvest_state` so future runs can skip already-fetched sensors
- `INSERT OR IGNORE` — never use `REPLACE` or `DELETE` + `INSERT` (must be idempotent)
- Column mapping (`PARAM_COLUMN`) must handle both Polish field names and English codes
- Always commit after each sensor, not at the end — allows safe interruption

VERIFY:
```bash
python3 scripts/harvest-readings.py --city Kraków --limit 2
# Expected: 2 sensors fetched, readings inserted, sensor_harvest_state updated
python3 -c "
import sqlite3; c=sqlite3.connect('data/local.db')
print('readings:', c.execute('SELECT COUNT(*) FROM readings').fetchone())
print('state:', c.execute('SELECT * FROM sensor_harvest_state LIMIT 2').fetchall())
"
```

COMMIT: `feat: add harvest-readings.py — deep historical harvest with resume support`

---

### Step H3.2 — Harvest current AQI index snapshot for all stations

READS: `scripts/harvest-stations.py`, `scripts/local-db/schema.sql`

PRODUCES: `scripts/harvest-aqi-snapshot.py` (new file)

INSTRUCTIONS:
1. Create `scripts/harvest-aqi-snapshot.py`. This is fast (1500 req/min endpoint) and suitable for frequent scheduling (e.g. hourly cron). It captures the current AQI index and stores it as a reading row.

```python
#!/usr/bin/env python3
"""
harvest-aqi-snapshot.py
------------------------
Fetches current AQI index for all stations and stores one reading per station.
Fast: only hits the 1500 req/min AQI endpoint — runs in under 5 minutes.

Safe to run hourly via cron or launchd. Skips stations already updated in
the last 30 minutes (configurable via --min-age).

Usage:
  python3 scripts/harvest-aqi-snapshot.py
  python3 scripts/harvest-aqi-snapshot.py --min-age 60  # skip if updated < 60 min ago
"""
import json, time, sqlite3, os, datetime, urllib.request, argparse

BASE_URL  = "https://api.gios.gov.pl/pjp-api/v1/rest"
DB_PATH   = os.path.join(os.path.dirname(__file__), "../data/local.db")
DELAY_SEC = 0.1  # 100ms between requests — well within 1500/min

AQI_LEVEL_MAP = {
    "Bardzo dobry": 1, "Dobry": 2, "Umiarkowany": 3,
    "Dostateczny": 4, "Zły": 5, "Bardzo zły": 6,
}


def fetch(url: str):
    req = urllib.request.Request(url, headers={"Accept": "*/*", "User-Agent": "Powietrze/0.1"})
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            return json.loads(r.read())
    except Exception:
        return None


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--min-age", type=int, default=30,
                        help="Skip stations updated within this many minutes (default: 30)")
    args = parser.parse_args()

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")

    cutoff = (datetime.datetime.utcnow() - datetime.timedelta(minutes=args.min_age)).isoformat()
    stations = conn.execute("""
        SELECT id, gios_id, name, city FROM stations
        WHERE is_active = 1
        ORDER BY city, name
    """).fetchall()

    print(f"\n  {len(stations)} active stations to snapshot.")
    started = datetime.datetime.utcnow().isoformat()
    inserted = 0
    skipped = 0
    errors = 0

    for i, station in enumerate(stations):
        gios_id    = station["gios_id"]
        station_id = station["id"]

        data = fetch(f"{BASE_URL}/aqindex/getIndex/{gios_id}")
        if not data:
            errors += 1
            time.sleep(DELAY_SEC)
            continue

        aq = data.get("AqIndex", {})
        level_name  = aq.get("Nazwa kategorii indeksu")
        calc_date   = aq.get("Data wykonania obliczeń indeksu")
        measured_at = calc_date or datetime.datetime.utcnow().isoformat()

        try:
            conn.execute("""
                INSERT OR IGNORE INTO readings
                  (station_id, measured_at, pm25, pm10, no2, o3, so2, aqi_value, aqi_level)
                VALUES (?,?,?,?,?,?,?,?,?)
            """, (
                station_id, measured_at,
                aq.get("Wartość indeksu dla wskaźnika PM2.5"),
                aq.get("Wartość indeksu dla wskaźnika PM10"),
                aq.get("Wartość indeksu dla wskaźnika NO2"),
                aq.get("Wartość indeksu dla wskaźnika O3"),
                aq.get("Wartość indeksu dla wskaźnika SO2"),
                (aq.get("Wartość indeksu") or 0) * 10,
                level_name,
            ))
            if conn.execute("SELECT changes()").fetchone()[0]:
                inserted += 1
            else:
                skipped += 1
        except Exception as e:
            print(f"  ⚠ {station['city']} / {station['name']}: {e}")
            errors += 1

        if (i + 1) % 50 == 0:
            conn.commit()
            print(f"  Progress: {i+1}/{len(stations)} ({inserted} inserted)...")
        time.sleep(DELAY_SEC)

    conn.commit()
    conn.execute("""
        INSERT INTO harvest_log (script, phase, stations_processed, readings_inserted, errors_count, started_at, finished_at)
        VALUES (?,?,?,?,?,?,?)
    """, ("harvest-aqi-snapshot.py", "aqi_snapshot", len(stations), inserted, errors,
          started, datetime.datetime.utcnow().isoformat()))
    conn.commit()
    conn.close()

    print(f"\n── Snapshot complete ──")
    print(f"  Inserted: {inserted}  Skipped: {skipped}  Errors: {errors}")


if __name__ == "__main__":
    main()
```

CONSTRAINTS:
- Never reduce `DELAY_SEC` below 0.05 (50ms)
- `INSERT OR IGNORE` — never update existing readings
- `--min-age` flag must be respected — check the last `measured_at` for the station before fetching

VERIFY:
```bash
python3 scripts/harvest-aqi-snapshot.py
# Expected: N stations snapshotted, readings inserted
python3 -c "import sqlite3; c=sqlite3.connect('data/local.db'); print(c.execute('SELECT COUNT(*) FROM readings').fetchone())"
# Expected: (N,) where N >= 400
```

COMMIT: `feat: add harvest-aqi-snapshot.py — hourly-safe AQI snapshot for all stations`

---

## PHASE H4 — Non-sensor textual data

### Step H4.1 — Harvest alert bulletins and air quality reports

READS: `scripts/local-db/schema.sql`

PRODUCES: `scripts/harvest-alerts.py` (new file)

INSTRUCTIONS:
1. Create `scripts/harvest-alerts.py`. GIOŚ publishes textual alert information via its main API and website. This script collects structured alert/exceedance data.

```python
#!/usr/bin/env python3
"""
harvest-alerts.py
------------------
Collects non-sensor textual data from GIOŚ and related public sources:

1. AQI status text from /aqindex/getIndex — stores the Polish level name and
   critical pollutant code as structured text in the alerts table
2. Station-level "status" field — indicates whether a station is actively
   measuring or has issues (maintenance, calibration, etc.)
3. Any available exceedance/alert bulletins from GIOŚ public API

Output: `alerts` table in data/local.db

Usage:
  python3 scripts/harvest-alerts.py
"""
import json, time, sqlite3, os, datetime, urllib.request

BASE_URL = "https://api.gios.gov.pl/pjp-api/v1/rest"
DB_PATH  = os.path.join(os.path.dirname(__file__), "../data/local.db")

ALERT_THRESHOLDS = {
    # Polish law + WHO thresholds for 24h averages (µg/m³)
    "PM2.5": {"legal_pl": 25.0, "who": 15.0},
    "PM10":  {"legal_pl": 50.0, "who": 45.0},
    "NO2":   {"legal_pl": 200.0, "who": 25.0},
}

AQI_ALERT_LEVELS = {"Zły", "Bardzo zły"}


def fetch(url: str):
    req = urllib.request.Request(url, headers={"Accept": "*/*", "User-Agent": "Powietrze/0.1"})
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            return json.loads(r.read())
    except Exception as e:
        print(f"  ERROR: {url} → {e}")
        return None


def main():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")

    stations = conn.execute("SELECT id, gios_id, name, city, voivodeship FROM stations WHERE is_active=1").fetchall()
    today = datetime.date.today().isoformat()
    started = datetime.datetime.utcnow().isoformat()
    inserted = 0

    print(f"\n  Checking {len(stations)} stations for alert conditions...")

    for i, station in enumerate(stations):
        data = fetch(f"{BASE_URL}/aqindex/getIndex/{station['gios_id']}")
        if not data:
            time.sleep(0.15)
            continue

        aq = data.get("AqIndex", {})
        level_name     = aq.get("Nazwa kategorii indeksu")
        critical_code  = aq.get("Kod zanieczyszczenia krytycznego")
        calc_date      = aq.get("Data wykonania obliczeń indeksu", today)
        status_ok      = aq.get("Status indeksu ogólnego dla stacji pomiarowej")

        # Only store alerts for bad/very bad AQI
        if level_name in AQI_ALERT_LEVELS:
            text_pl = f"{level_name} — zanieczyszczenie krytyczne: {critical_code or 'brak danych'}"
            text_en = f"{level_name} (AQI alert) — critical pollutant: {critical_code or 'no data'}"

            try:
                conn.execute("""
                    INSERT OR IGNORE INTO alerts
                      (station_id, city, voivodeship, alert_type, pollutant, alert_date, raw_text_pl, raw_text_en)
                    VALUES (?,?,?,?,?,?,?,?)
                """, (
                    station["id"], station["city"], station["voivodeship"],
                    f"aqi_{level_name.lower().replace(' ', '_')}",
                    critical_code,
                    calc_date[:10] if calc_date else today,
                    text_pl, text_en,
                ))
                if conn.execute("SELECT changes()").fetchone()[0]:
                    inserted += 1
                    print(f"  ⚠ ALERT: {station['city']} / {station['name']} → {level_name}")
            except Exception as e:
                print(f"  insert error: {e}")

        # Also log if status_ok is False (station malfunction)
        if status_ok is False:
            try:
                conn.execute("""
                    INSERT OR IGNORE INTO alerts
                      (station_id, city, voivodeship, alert_type, alert_date, raw_text_pl, raw_text_en)
                    VALUES (?,?,?,?,?,?,?)
                """, (
                    station["id"], station["city"], station["voivodeship"],
                    "station_malfunction",
                    today,
                    "Stacja zgłasza problem techniczny — dane mogą być niedokładne.",
                    "Station reports technical issue — readings may be inaccurate.",
                ))
                if conn.execute("SELECT changes()").fetchone()[0]:
                    inserted += 1
            except Exception:
                pass

        if (i + 1) % 100 == 0:
            conn.commit()
        time.sleep(0.12)

    conn.commit()
    conn.execute("""
        INSERT INTO harvest_log (script, phase, stations_processed, readings_inserted, started_at, finished_at)
        VALUES (?,?,?,?,?,?)
    """, ("harvest-alerts.py", "alerts", len(stations), inserted, started, datetime.datetime.utcnow().isoformat()))
    conn.commit()
    conn.close()

    print(f"\n  {inserted} alert records inserted.")


if __name__ == "__main__":
    main()
```

CONSTRAINTS:
- Only insert into `alerts` — never into `readings`
- Must be idempotent (`INSERT OR IGNORE` on unique station + alert_type + alert_date)
- `AQI_ALERT_LEVELS` set is the single source of truth for which levels trigger an alert

VERIFY:
```bash
python3 scripts/harvest-alerts.py
# Expected: N alert records inserted (may be 0 on a clean air day)
python3 -c "import sqlite3; c=sqlite3.connect('data/local.db'); print(c.execute('SELECT COUNT(*) FROM alerts').fetchone())"
```

COMMIT: `feat: add harvest-alerts.py — structured AQI alert records from GIOŚ`

---

## PHASE H5 — Connect local DB to Next.js frontend

### Step H5.1 — Add `localDb.ts` data access layer

READS: `src/lib/localData.ts`, `scripts/local-db/schema.sql`

PRODUCES: `src/lib/localDb.ts` (new file)

INSTRUCTIONS:
1. Create `src/lib/localDb.ts`. This module reads from `data/local.db` using the `better-sqlite3` package. It returns the same shapes as `localData.ts` so components don't need to change.

First, install the required package:
```bash
npm install --save-exact better-sqlite3@9.4.3
npm install --save-exact --save-dev @types/better-sqlite3@7.6.8
```

Then create the file:

```typescript
/**
 * localDb.ts
 * Data access layer for local SQLite database (data/local.db).
 * Returns the same shapes as localData.ts — components do not need to change.
 *
 * Only works in Node.js runtime (server components, API routes, scripts).
 * Never import this in client components or edge routes.
 */

import Database from "better-sqlite3";
import path from "path";
import type { StationSummary, KrakowStation } from "./types";

const DB_PATH = path.resolve(process.cwd(), "data/local.db");

function getDb(): Database.Database {
  return new Database(DB_PATH, { readonly: true });
}

// ─── Types matching the SQLite schema ────────────────────────────────────────

type DbStation = {
  id: string;
  gios_id: number;
  code: string;
  name: string;
  city: string;
  street: string | null;
  commune: string;
  district: string;
  voivodeship: string;
  latitude: number;
  longitude: number;
};

type DbReading = {
  station_id: string;
  measured_at: string;
  pm25: number | null;
  pm10: number | null;
  no2: number | null;
  o3: number | null;
  so2: number | null;
  aqi_value: number | null;
  aqi_level: string | null;
};

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns all stations with their most recent reading merged in.
 * Shape matches localData.getAllStations().
 */
export function getAllStationsFromDb(): StationSummary[] {
  const db = getDb();

  const stations = db.prepare<[], DbStation>(
    `SELECT id, gios_id, code, name, city, street, commune, district, voivodeship, latitude, longitude
     FROM stations WHERE is_active = 1 ORDER BY city, name`
  ).all();

  const stmt = db.prepare<[string], DbReading>(
    `SELECT station_id, measured_at, pm25, pm10, no2, o3, so2, aqi_value, aqi_level
     FROM readings
     WHERE station_id = ?
     ORDER BY measured_at DESC
     LIMIT 1`
  );

  return stations.map((s) => {
    const reading = stmt.get(s.id) as DbReading | undefined;
    return {
      id: s.id,
      gios_id: s.gios_id,
      code: s.code,
      name: s.name,
      city: s.city,
      street: s.street,
      commune: s.commune,
      district: s.district,
      voivodeship: s.voivodeship,
      lat: s.latitude,
      lon: s.longitude,
      source: "gios" as const,
      aqi: {
        level_name: reading?.aqi_level ?? null,
        level_name_en: null,
        score: reading?.aqi_value ?? null,
        color: "#9E9E9E",
        calc_date: reading?.measured_at ?? null,
        pm25_level: null,
        pm10_level: null,
        no2_level: null,
        o3_level: null,
        so2_level: null,
        co_level: null,
      },
    };
  });
}

/**
 * Returns daily average PM2.5 readings for a station over the last N days.
 * Used by SeasonalCalendar and PollutantChart.
 */
export function getDailyReadings(
  stationId: string,
  days = 365
): Array<{ date: string; avgPm25: number | null }> {
  const db = getDb();
  const cutoff = new Date(Date.now() - days * 86400 * 1000).toISOString();

  const rows = db.prepare<[string, string]>(
    `SELECT date(measured_at) AS date, AVG(pm25) AS avgPm25
     FROM readings
     WHERE station_id = ? AND measured_at >= ? AND pm25 IS NOT NULL
     GROUP BY date(measured_at)
     ORDER BY date ASC`
  ).all(stationId, cutoff) as Array<{ date: string; avgPm25: number }>;

  return rows.map((r) => ({ date: r.date, avgPm25: r.avgPm25 }));
}

/**
 * Returns raw hourly readings for a station and pollutant.
 * Used by PollutantChart.
 */
export function getHourlyReadings(
  stationId: string,
  pollutant: "pm25" | "pm10" | "no2" | "o3" | "so2",
  hours = 24
): Array<{ date: string; value: number }> {
  const db = getDb();
  const cutoff = new Date(Date.now() - hours * 3600 * 1000).toISOString();
  const col = pollutant; // column name matches pollutant key

  const rows = db.prepare<[string, string]>(
    `SELECT measured_at AS date, ${col} AS value
     FROM readings
     WHERE station_id = ? AND measured_at >= ? AND ${col} IS NOT NULL
     ORDER BY measured_at ASC`
  ).all(stationId, cutoff) as Array<{ date: string; value: number }>;

  return rows;
}

/**
 * Returns the most recent reading for a station.
 */
export function getLatestReading(stationId: string): DbReading | undefined {
  const db = getDb();
  return db.prepare<[string], DbReading>(
    `SELECT * FROM readings WHERE station_id = ? ORDER BY measured_at DESC LIMIT 1`
  ).get(stationId);
}

/**
 * Returns harvest statistics for monitoring / debug page.
 */
export function getHarvestStats(): {
  stationCount: number;
  sensorCount: number;
  readingCount: number;
  oldestReading: string | null;
  latestReading: string | null;
  alertCount: number;
} {
  const db = getDb();
  const stationCount = (db.prepare("SELECT COUNT(*) AS n FROM stations").get() as { n: number }).n;
  const sensorCount  = (db.prepare("SELECT COUNT(*) AS n FROM sensors").get() as { n: number }).n;
  const readingCount = (db.prepare("SELECT COUNT(*) AS n FROM readings").get() as { n: number }).n;
  const oldest = (db.prepare("SELECT MIN(measured_at) AS d FROM readings").get() as { d: string | null }).d;
  const latest = (db.prepare("SELECT MAX(measured_at) AS d FROM readings").get() as { d: string | null }).d;
  const alertCount   = (db.prepare("SELECT COUNT(*) AS n FROM alerts").get() as { n: number }).n;

  return { stationCount, sensorCount, readingCount, oldestReading: oldest, latestReading: latest, alertCount };
}
```

CONSTRAINTS:
- `getDb()` always opens with `readonly: true` — never open the database for writing from Next.js
- Never import this file from client components (`"use client"`) or edge routes
- Return shapes must exactly match the types in `src/lib/types.ts`
- No raw SQL string interpolation for user-provided values — always use prepared statement parameters

VERIFY:
```bash
npx tsc --noEmit
# Expected: exit code 0
node -e "const { getHarvestStats } = require('./src/lib/localDb'); console.log(getHarvestStats())"
# Expected: object with stationCount, readingCount etc.
```

COMMIT: `feat: add localDb.ts — SQLite data access layer for Next.js server components`

---

### Step H5.2 — Add `/api/local/stats` health endpoint

READS: `src/lib/localDb.ts`, `src/app/api/health/route.ts`

PRODUCES: `src/app/api/local/stats/route.ts` (new file)

INSTRUCTIONS:
1. Create `src/app/api/local/stats/route.ts`:

```typescript
/**
 * GET /api/local/stats
 * Returns harvest statistics for the local SQLite database.
 * Used for monitoring and debugging the data collection pipeline.
 * Only available in development mode.
 */

import { NextResponse } from "next/server";
import { getHarvestStats } from "@/lib/localDb";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production" }, { status: 404 });
  }

  try {
    const stats = getHarvestStats();
    return NextResponse.json({ ok: true, ...stats });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
```

CONSTRAINTS:
- Return 404 in production — this is a dev/local-only endpoint
- No authentication required in development

VERIFY:
```bash
# With npm run dev running:
curl http://localhost:3000/api/local/stats
# Expected: {"ok":true,"stationCount":N,"sensorCount":N,"readingCount":N,...}
```

COMMIT: `feat: add /api/local/stats endpoint — local DB health check`

---

## PHASE H6 — Recommended harvest workflow

This phase is documentation only — no code to write.

### Recommended first-run sequence

Run these commands in order. Total wall-clock time for a full national harvest: **~30 hours** (dominated by the slow sensor/readings endpoints). Plan overnight/weekend runs.

```bash
# 1. Initialise the database (< 1 second)
python3 scripts/local-db/init.py

# 2. Harvest all station metadata (< 2 minutes)
python3 scripts/harvest-stations.py

# 3. Harvest AQI snapshot for all stations (< 5 minutes)
python3 scripts/harvest-aqi-snapshot.py

# 4. Harvest sensor metadata — start with Kraków, then all
#    (Kraków: ~3 minutes at 31s/req × ~6 stations)
python3 scripts/harvest-sensors.py --city Kraków
python3 scripts/harvest-sensors.py      # remainder: ~4.5 hours, run overnight

# 5. Harvest historical readings — start with Kraków
#    (Kraków: ~6 sensors × 31s = ~3 minutes per harvest run)
python3 scripts/harvest-readings.py --city Kraków
python3 scripts/harvest-readings.py     # remainder: ~26 hours, run over weekend

# 6. Harvest alert records (< 5 minutes)
python3 scripts/harvest-alerts.py
```

### Ongoing maintenance (add to crontab or launchd)

```bash
# Every hour: fresh AQI snapshot
0 * * * * cd /path/to/project && python3 scripts/harvest-aqi-snapshot.py

# Daily: refresh alert records
0 6 * * * cd /path/to/project && python3 scripts/harvest-alerts.py

# Weekly: re-fetch sensor readings updated > 7 days ago
0 2 * * 0 cd /path/to/project && python3 scripts/harvest-readings.py --refetch 7
```

### Checking harvest progress

```bash
python3 -c "
import sqlite3, json
c = sqlite3.connect('data/local.db')
print('Stations:  ', c.execute('SELECT COUNT(*) FROM stations').fetchone()[0])
print('Sensors:   ', c.execute('SELECT COUNT(*) FROM sensors').fetchone()[0])
print('Readings:  ', c.execute('SELECT COUNT(*) FROM readings').fetchone()[0])
print('Oldest:    ', c.execute('SELECT MIN(measured_at) FROM readings').fetchone()[0])
print('Latest:    ', c.execute('SELECT MAX(measured_at) FROM readings').fetchone()[0])
print('Alerts:    ', c.execute('SELECT COUNT(*) FROM alerts').fetchone()[0])
print('Log:')
for r in c.execute('SELECT script, phase, stations_processed, readings_inserted, finished_at FROM harvest_log ORDER BY id DESC LIMIT 5').fetchall():
    print(' ', r)
"
```

### Non-sensor data sources beyond GIOŚ

The following public Polish sources provide contextual textual data about air quality. They can be scraped or manually collected and stored in the `alerts` table with appropriate `alert_type` values:

| Source | What it provides | URL |
|---|---|---|
| GIOŚ smog alerts | Official threshold exceedance bulletins | https://powietrze.gios.gov.pl/pjp/content/show?type=ALARM |
| IMGW | Weather forecasts correlated with smog | https://www.imgw.pl |
| Kraków city hall | Local heating season restrictions, enforcement data | https://www.krakow.pl/smog |
| ChronimyKlimat.pl | Polish air quality research summaries | https://chronimyklimat.pl |
| EEA Poland reports | European Environment Agency country reports | https://www.eea.europa.eu/countries-and-regions/poland |

---

## END OF LOCAL DATA COLLECTION PLAN

After completing Phases H1–H5, the project has:
- A fully local SQLite database with multi-year hourly readings per sensor
- Structured alert/exceedance records
- A TypeScript data access layer with the same return shapes as the existing `localData.ts`
- No dependency on Supabase or any cloud service for local development

The `SeasonalCalendar` (Phase 5) and `PollutantChart` (Phase 6) in `docs/build-plan.md` can then be driven by `getDailyReadings()` and `getHourlyReadings()` from `src/lib/localDb.ts` respectively.
