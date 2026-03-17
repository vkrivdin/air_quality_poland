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
import json
import time
import sqlite3
import os
import datetime
import urllib.request
import urllib.error

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


def main() -> None:
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
        lat = s.get("WGS84 \u03c6 N") or s.get("WGS84 φ N")
        lon = s.get("WGS84 \u03bb E") or s.get("WGS84 λ E")
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
    """, ("harvest-stations.py", "stations", upserted, started,
          datetime.datetime.utcnow().isoformat()))
    conn.commit()
    conn.close()

    print(f"  ✓ {upserted} stations upserted.")
    print(f"\n  Database: {DB_PATH}")


if __name__ == "__main__":
    main()
