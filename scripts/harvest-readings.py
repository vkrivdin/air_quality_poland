#!/usr/bin/env python3
"""
harvest-readings.py
--------------------
Fetches historical readings for every sensor in local.db.

The GIOŚ /data/getData endpoint returns ~3 days of hourly data per call.
This script iterates through sensors, stores every data point, and tracks
progress so it is fully resumable.

DAYS-BACK:
  By default the script accepts ALL data the API returns (typically ~3 days).
  Use --days-back N to discard data points older than N days from now.
  Examples:
    --days-back 7    → keep only the past week
    --days-back 365  → keep up to a year (API still returns ~3 days per call,
                       so combine with --refetch 1 run daily to build up history)

RESUMABLE:
  Progress is tracked in sensor_harvest_state. Re-running skips sensors
  already fetched. Use --refetch N to re-fetch sensors not updated in N days.

Rate: 1 request per 31 seconds (conservative 2/min limit).
Full national run (~1700+ sensors): plan for overnight runs.

Usage:
  python3 scripts/harvest-readings.py                        # resume
  python3 scripts/harvest-readings.py --city Kraków          # one city
  python3 scripts/harvest-readings.py --city Kraków --days-back 7
  python3 scripts/harvest-readings.py --limit 20             # first 20
  python3 scripts/harvest-readings.py --refetch 7            # refresh stale
  python3 scripts/harvest-readings.py --sensor 2752          # single sensor
  python3 scripts/harvest-readings.py --days-back 365        # last year only

Progress is logged to data/harvest.log — follow with: tail -f data/harvest.log
"""
import json
import time
import sqlite3
import os
import datetime
import urllib.request
import argparse

BASE_URL  = "https://api.gios.gov.pl/pjp-api/v1/rest"
DB_PATH   = os.path.join(os.path.dirname(__file__), "../data/local.db")
LOG_PATH  = os.path.join(os.path.dirname(__file__), "../data/harvest.log")
DELAY_SEC = 31

PARAM_COLUMN: dict[str, str] = {
    "PM2.5": "pm25", "PM25": "pm25", "PM2,5": "pm25",
    "PM10":  "pm10",
    "NO2":   "no2",
    "O3":    "o3",
    "SO2":   "so2",
    "CO":    "co",
    "C6H6":  "c6h6", "BEN": "c6h6", "BENZ": "c6h6",
}


def now_iso() -> str:
    return datetime.datetime.now(datetime.UTC).isoformat(timespec="seconds")


def log(msg: str) -> None:
    line = f"[{now_iso()}] {msg}"
    print(line, flush=True)
    with open(LOG_PATH, "a", encoding="utf-8") as f:
        f.write(line + "\n")


def get_column(param_code: str, param_name: str) -> str | None:
    for raw in (param_code, param_name):
        key = (raw or "").strip().upper()
        if key in PARAM_COLUMN:
            return PARAM_COLUMN[key]
    for raw in (param_code, param_name):
        upper = (raw or "").upper()
        for k, v in PARAM_COLUMN.items():
            if k in upper:
                return v
    return None


def fetch(url: str):
    req = urllib.request.Request(url, headers={
        "Accept": "*/*",
        "User-Agent": "Powietrze/0.1 (local harvest)"
    })
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.loads(r.read())
    except Exception as e:
        log(f"  ERROR: {url} → {e}")
        return None


def build_todo(conn: sqlite3.Connection, args: argparse.Namespace) -> list:
    if args.sensor:
        return conn.execute("""
            SELECT se.id, se.station_id, se.param_code, se.param_name,
                   s.city, s.name AS station_name
            FROM sensors se JOIN stations s ON se.station_id = s.id
            WHERE se.id = ?
        """, (args.sensor,)).fetchall()

    if args.refetch:
        cutoff = (
            datetime.datetime.now(datetime.UTC)
            - datetime.timedelta(days=args.refetch)
        ).isoformat()
        base = """
            SELECT se.id, se.station_id, se.param_code, se.param_name,
                   s.city, s.name AS station_name
            FROM sensors se JOIN stations s ON se.station_id = s.id
            WHERE se.id NOT IN (
                SELECT sensor_id FROM sensor_harvest_state WHERE last_fetched > ?
            )
        """
        params: list = [cutoff]
        if args.city:
            base += " AND s.city LIKE ?"
            params.append(f"%{args.city}%")
        base += " ORDER BY s.city, se.station_id"
        return conn.execute(base, params).fetchall()

    # Default: only sensors never fetched
    base = """
        SELECT se.id, se.station_id, se.param_code, se.param_name,
               s.city, s.name AS station_name
        FROM sensors se JOIN stations s ON se.station_id = s.id
        WHERE se.id NOT IN (SELECT sensor_id FROM sensor_harvest_state)
        ORDER BY s.city, se.station_id
    """
    params = []
    if args.city:
        base = base.replace("ORDER BY", "AND s.city LIKE ? ORDER BY")
        params.append(f"%{args.city}%")
    return conn.execute(base, params).fetchall()


def main() -> None:
    os.makedirs(os.path.dirname(LOG_PATH), exist_ok=True)
    parser = argparse.ArgumentParser()
    parser.add_argument("--city",      type=str,  default=None)
    parser.add_argument("--limit",     type=int,  default=None)
    parser.add_argument("--refetch",   type=int,  default=None,
                        help="Re-fetch sensors not updated in N days")
    parser.add_argument("--sensor",    type=int,  default=None,
                        help="Fetch a single sensor by GIOŚ id")
    parser.add_argument("--days-back", type=int,  default=None,
                        help="Discard data points older than N days from now "
                             "(e.g. --days-back 7 keeps only the past week)")
    args = parser.parse_args()

    # Compute the earliest timestamp we will accept, if --days-back is set
    cutoff_dt: datetime.datetime | None = None
    if args.days_back is not None:
        cutoff_dt = datetime.datetime.now(datetime.UTC) - datetime.timedelta(days=args.days_back)

    conn = sqlite3.connect(DB_PATH, timeout=30)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")

    todo = build_todo(conn, args)
    if args.limit:
        todo = todo[:args.limit]

    window_str = f" | window=last {args.days_back}d" if args.days_back else ""
    log(f"[harvest-readings] START — {len(todo)} sensors to fetch"
        + (f" (city={args.city})" if args.city else "")
        + window_str)

    if not todo:
        log("  Nothing to do.")
        return

    started = now_iso()
    total_inserted = 0
    total_errors   = 0

    for i, sensor in enumerate(todo):
        sensor_id  = sensor["id"]
        station_id = sensor["station_id"]
        col = get_column(sensor["param_code"], sensor["param_name"])
        log(
            f"  [{i+1}/{len(todo)}] sensor {sensor_id} — "
            f"{sensor['city']} / {sensor['station_name']} / "
            f"{sensor['param_name']} → col={col}"
        )

        data = fetch(f"{BASE_URL}/data/getData/{sensor_id}")
        if not data:
            total_errors += 1
            if i < len(todo) - 1:
                time.sleep(DELAY_SEC)
            continue

        points_raw = (
            data if isinstance(data, list)
            else data.get("Lista danych pomiarowych", [])
        )

        inserted = 0
        oldest: str | None = None

        for point in points_raw:
            dt_str = point.get("Data") or point.get("date")
            val    = point.get("Wartość") if "Wartość" in point else point.get("value")
            if not dt_str or val is None:
                continue
            try:
                dt  = datetime.datetime.fromisoformat(dt_str.replace(" ", "T"))
                # Make timezone-aware for comparison if needed
                if dt.tzinfo is None:
                    dt = dt.replace(tzinfo=datetime.timezone.utc)
                iso = dt.isoformat()
            except ValueError:
                iso = dt_str
                dt  = None

            # Apply --days-back filter
            if cutoff_dt is not None and dt is not None:
                if dt < cutoff_dt:
                    continue

            row: dict = {
                "station_id":  station_id,
                "sensor_id":   sensor_id,
                "measured_at": iso,
                "pm25": None, "pm10": None, "no2": None,
                "o3":   None, "so2":  None, "co":  None, "c6h6": None,
            }
            if col:
                row[col] = float(val)

            try:
                conn.execute("""
                    INSERT OR IGNORE INTO readings
                      (station_id, sensor_id, measured_at,
                       pm25, pm10, no2, o3, so2, co, c6h6)
                    VALUES
                      (:station_id, :sensor_id, :measured_at,
                       :pm25, :pm10, :no2, :o3, :so2, :co, :c6h6)
                """, row)
                if conn.execute("SELECT changes()").fetchone()[0]:
                    inserted += 1
                    if oldest is None or iso < oldest:
                        oldest = iso
            except Exception as e:
                log(f"    ⚠ insert error: {e}")

        conn.commit()
        total_inserted += inserted
        log(f"    → {inserted} rows inserted (oldest={oldest}, total={total_inserted})")

        conn.execute("""
            INSERT INTO sensor_harvest_state
              (sensor_id, station_id, last_fetched, oldest_date, total_rows)
            VALUES (?,?,?,?,?)
            ON CONFLICT(sensor_id) DO UPDATE SET
              last_fetched = excluded.last_fetched,
              oldest_date  = CASE
                WHEN oldest_date IS NULL THEN excluded.oldest_date
                WHEN excluded.oldest_date IS NULL THEN oldest_date
                ELSE MIN(oldest_date, excluded.oldest_date)
              END,
              total_rows = total_rows + excluded.total_rows
        """, (sensor_id, station_id, now_iso(), oldest, inserted))
        conn.commit()

        if i < len(todo) - 1:
            time.sleep(DELAY_SEC)

    conn.execute("""
        INSERT INTO harvest_log
          (script, phase, stations_processed, readings_inserted,
           errors_count, started_at, finished_at, notes)
        VALUES (?,?,?,?,?,?,?,?)
    """, (
        "harvest-readings.py", "readings",
        len(todo), total_inserted, total_errors,
        started, now_iso(),
        f"days_back={args.days_back}" if args.days_back else None,
    ))
    conn.commit()
    conn.close()

    log(f"[harvest-readings] DONE — sensors={len(todo)} readings={total_inserted} errors={total_errors}")


if __name__ == "__main__":
    main()
