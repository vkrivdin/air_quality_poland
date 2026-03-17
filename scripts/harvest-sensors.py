#!/usr/bin/env python3
"""
harvest-sensors.py
-------------------
Fetches sensor metadata for every station in local.db.
Uses the GIOŚ /station/sensors/{id} endpoint — rate-limited to ~2 req/min.

RESUMABLE: Only fetches stations that have no sensor rows yet.
Re-run safely — already-fetched stations are skipped.

Usage:
  python3 scripts/harvest-sensors.py             # fetch all remaining stations
  python3 scripts/harvest-sensors.py --limit 50  # fetch at most 50 stations
  python3 scripts/harvest-sensors.py --city Kraków  # only stations in one city

Rate: 1 request per 31 seconds — safe under the 2/min GIOŚ limit.
Full national run (~289 stations): ~2.5 hours.

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


def now_iso() -> str:
    return datetime.datetime.now(datetime.UTC).isoformat(timespec="seconds")


def log(msg: str) -> None:
    line = f"[{now_iso()}] {msg}"
    print(line, flush=True)
    with open(LOG_PATH, "a", encoding="utf-8") as f:
        f.write(line + "\n")


def fetch(url: str):
    req = urllib.request.Request(url, headers={
        "Accept": "*/*",
        "User-Agent": "Powietrze/0.1 (local harvest)"
    })
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            return json.loads(r.read())
    except Exception as e:
        log(f"  ERROR fetching {url}: {e}")
        return None


def main() -> None:
    os.makedirs(os.path.dirname(LOG_PATH), exist_ok=True)
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=None)
    parser.add_argument("--city",  type=str, default=None)
    args = parser.parse_args()

    # timeout=30: waits up to 30s for SQLite write lock instead of failing
    # immediately when another harvest script is running concurrently (BUG-6)
    conn = sqlite3.connect(DB_PATH, timeout=30)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")

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

    log(f"[harvest-sensors] START — {len(todo)} stations to process" +
        (f" (city={args.city})" if args.city else ""))

    if not todo:
        log("  Nothing to do — all stations already have sensor data.")
        return

    started = now_iso()
    inserted_total = 0
    errors = 0

    for i, station in enumerate(todo):
        gios_id    = station["gios_id"]
        station_id = station["id"]
        log(f"  [{i+1}/{len(todo)}] {station['city']} — {station['name']} (gios_id={gios_id})")

        data = fetch(f"{BASE_URL}/station/sensors/{gios_id}")
        if not data:
            errors += 1
        else:
            sensors = (
                data if isinstance(data, list)
                else data.get("Lista stanowisk pomiarowych dla podanej stacji")
                   or data.get("Lista stanowisk pomiarowych", [])
            )
            inserted = 0
            for sensor in sensors:
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
                param_id = sensor.get("Id wskaźnika") or param.get("idParam")
                formula  = (
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
                    """, (sensor_id, station_id, param_name, param_code, param_id, formula))
                    inserted += conn.execute("SELECT changes()").fetchone()[0]
                except Exception as e:
                    log(f"    ⚠ insert error: {e}")
            conn.commit()
            inserted_total += inserted
            log(f"    → {inserted} sensors added (total so far: {inserted_total})")

        if i < len(todo) - 1:
            time.sleep(DELAY_SEC)

    conn.execute("""
        INSERT INTO harvest_log
          (script, phase, stations_processed, readings_inserted, errors_count, started_at, finished_at)
        VALUES (?,?,?,?,?,?,?)
    """, ("harvest-sensors.py", "sensors", len(todo), inserted_total, errors, started, now_iso()))
    conn.commit()
    conn.close()

    log(f"[harvest-sensors] DONE — stations={len(todo)} sensors={inserted_total} errors={errors}")


if __name__ == "__main__":
    main()
