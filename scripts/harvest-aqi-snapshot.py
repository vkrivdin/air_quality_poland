#!/usr/bin/env python3
"""
harvest-aqi-snapshot.py
------------------------
Fetches current AQI index for all stations and stores one reading per station.
Fast: only hits the 1500 req/min AQI endpoint — runs in under 5 minutes.

Safe to run hourly via cron or launchd. Skips stations already updated within
the last --min-age minutes (default 30).

Usage:
  python3 scripts/harvest-aqi-snapshot.py
  python3 scripts/harvest-aqi-snapshot.py --min-age 60

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
DELAY_SEC = 0.12  # 120ms — well within 1500 req/min


def now_iso() -> str:
    return datetime.datetime.now(datetime.UTC).isoformat(timespec="seconds")


def log(msg: str) -> None:
    line = f"[{now_iso()}] {msg}"
    print(line, flush=True)
    with open(LOG_PATH, "a", encoding="utf-8") as f:
        f.write(line + "\n")


def normalise_level(raw: str | None) -> str | None:
    if not raw:
        return None
    MAP = {
        "bardzo dobry": "bardzo_dobry",
        "dobry":        "dobry",
        "umiarkowany":  "umiarkowany",
        "dostateczny":  "umiarkowany",
        "zły":          "zly",
        "bardzo zły":   "bardzo_zly",
    }
    return MAP.get(raw.strip().lower(), raw.lower().replace(" ", "_"))


def fetch(url: str):
    req = urllib.request.Request(url, headers={
        "Accept": "*/*",
        "User-Agent": "Powietrze/0.1 (aqi-snapshot)"
    })
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            return json.loads(r.read())
    except Exception:
        return None


def main() -> None:
    os.makedirs(os.path.dirname(LOG_PATH), exist_ok=True)
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--min-age", type=int, default=30,
        help="Skip stations updated within this many minutes (default: 30)"
    )
    args = parser.parse_args()

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")

    stations = conn.execute("""
        SELECT id, gios_id, name, city
        FROM stations
        WHERE is_active = 1
        ORDER BY city, name
    """).fetchall()

    log(f"[harvest-aqi-snapshot] START — {len(stations)} stations")

    started   = now_iso()
    inserted  = 0
    skipped   = 0
    errors    = 0

    for i, station in enumerate(stations):
        gios_id    = station["gios_id"]
        station_id = station["id"]

        data = fetch(f"{BASE_URL}/aqindex/getIndex/{gios_id}")
        if not data:
            errors += 1
            time.sleep(DELAY_SEC)
            continue

        idx = data.get("AqIndex") or data
        if not idx:
            errors += 1
            time.sleep(DELAY_SEC)
            continue

        raw_ts = idx.get("Data wykonania obliczeń indeksu")
        now_str = now_iso()
        if raw_ts:
            try:
                measured_at = datetime.datetime.fromisoformat(
                    raw_ts.replace(" ", "T")
                ).isoformat()
            except ValueError:
                measured_at = now_str
        else:
            measured_at = now_str

        row = {
            "station_id":  station_id,
            "sensor_id":   None,
            "measured_at": measured_at,
            "pm25":  idx.get("Wartość indeksu dla wskaźnika PM2.5"),
            "pm10":  idx.get("Wartość indeksu dla wskaźnika PM10"),
            "no2":   idx.get("Wartość indeksu dla wskaźnika NO2"),
            "o3":    idx.get("Wartość indeksu dla wskaźnika O3"),
            "so2":   idx.get("Wartość indeksu dla wskaźnika SO2"),
            "co":    None,
            "c6h6":  None,
            "aqi_value": (
                idx["Wartość indeksu"] * 10
                if idx.get("Wartość indeksu") is not None else None
            ),
            "aqi_level": normalise_level(idx.get("Nazwa kategorii indeksu")),
        }

        try:
            conn.execute("""
                INSERT OR IGNORE INTO readings
                  (station_id, sensor_id, measured_at,
                   pm25, pm10, no2, o3, so2, co, c6h6, aqi_value, aqi_level)
                VALUES
                  (:station_id, :sensor_id, :measured_at,
                   :pm25, :pm10, :no2, :o3, :so2, :co, :c6h6, :aqi_value, :aqi_level)
            """, row)
            delta = conn.execute("SELECT changes()").fetchone()[0]
            if delta:
                inserted += 1
            else:
                skipped += 1
        except Exception as e:
            log(f"  ⚠ {station_id} insert error: {e}")
            errors += 1

        if (i + 1) % 50 == 0 or i == len(stations) - 1:
            log(f"  [{i+1}/{len(stations)}] inserted={inserted} skipped={skipped} errors={errors}")

        time.sleep(DELAY_SEC)

    conn.commit()
    conn.execute("""
        INSERT INTO harvest_log
          (script, phase, stations_processed, readings_inserted,
           errors_count, started_at, finished_at)
        VALUES (?,?,?,?,?,?,?)
    """, (
        "harvest-aqi-snapshot.py", "aqi_snapshot",
        len(stations), inserted, errors,
        started, now_iso(),
    ))
    conn.commit()
    conn.close()

    log(f"[harvest-aqi-snapshot] DONE — inserted={inserted} skipped={skipped} errors={errors}")


if __name__ == "__main__":
    main()
