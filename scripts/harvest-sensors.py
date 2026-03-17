#!/usr/bin/env python3
"""
harvest-sensors.py
-------------------
Fetches sensor metadata for every station in local.db.
Uses the GIOŚ /station/sensors/{id} endpoint — rate-limited to ~2 req/min.

RESUMABLE: Tracks which stations have been done by checking for existing sensor
rows. Re-run safely — only fetches stations with no sensors yet.

Usage:
  python3 scripts/harvest-sensors.py             # fetch all remaining stations
  python3 scripts/harvest-sensors.py --limit 50  # fetch at most 50 stations
  python3 scripts/harvest-sensors.py --city Kraków  # only stations in one city

Rate: 1 request per 31 seconds = safe under the 2/min limit.
Full national run (~289 stations): ~2.5 hours.
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


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=None)
    parser.add_argument("--city", type=str, default=None)
    args = parser.parse_args()

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")

    # Find stations that have NO sensors yet
    base_query = """
        SELECT s.id, s.gios_id, s.name, s.city
        FROM stations s
        WHERE NOT EXISTS (
            SELECT 1 FROM sensors se WHERE se.station_id = s.id
        )
    """
    params: list = []
    if args.city:
        base_query += " AND s.city LIKE ?"
        params.append(f"%{args.city}%")
    base_query += " ORDER BY s.city, s.name"

    todo = conn.execute(base_query, params).fetchall()

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
        gios_id    = station["gios_id"]
        station_id = station["id"]
        print(f"  [{i+1}/{len(todo)}] {station['city']} — {station['name']} (gios_id={gios_id})")

        data = fetch(f"{BASE_URL}/station/sensors/{gios_id}")
        if not data:
            errors += 1
        else:
            # Response key varies between API versions
            sensors = (
                data if isinstance(data, list)
                else data.get("Lista stanowisk pomiarowych dla podanej stacji")
                   or data.get("Lista stanowisk pomiarowych", [])
            )
            inserted = 0
            for sensor in sensors:
                # Field names vary: flat dict or nested param object
                param = sensor.get("wskaźnik") or sensor.get("param") or {}
                sensor_id = (
                    sensor.get("Identyfikator stanowiska")
                    or sensor.get("id")
                )
                param_name = (
                    sensor.get("Wskaźnik")
                    or sensor.get("Wskaźnik - wzór")
                    or param.get("paramName")
                    or sensor.get("nazwaWskaznika", "")
                )
                param_code = (
                    sensor.get("Wskaźnik - kod")
                    or param.get("paramCode")
                    or sensor.get("kodWskaznika", "")
                )
                param_id = (
                    sensor.get("Id wskaźnika")
                    or param.get("idParam")
                )
                formula = (
                    sensor.get("Wskaźnik - wzór")
                    or param.get("paramFormula")
                    or sensor.get("wzorWskaznika")
                )
                if not sensor_id or not param_name:
                    continue
                try:
                    conn.execute("""
                        INSERT OR IGNORE INTO sensors
                          (id, station_id, param_name, param_code, param_id, formula)
                        VALUES (?,?,?,?,?,?)
                    """, (
                        sensor_id,
                        station_id,
                        param_name,
                        param_code,
                        param_id,
                        formula,
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
        INSERT INTO harvest_log
          (script, phase, stations_processed, readings_inserted, errors_count, started_at, finished_at)
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
