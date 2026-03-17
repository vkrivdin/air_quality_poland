#!/usr/bin/env python3
"""
db-summary.py
--------------
Prints a human-readable summary of data collected in data/local.db.
Shows counts, time ranges, per-pollutant stats, per-city coverage,
AQI level distribution, and harvest run history.

Run any time to check what has been collected so far.

Usage:
  python3 scripts/db-summary.py
  python3 scripts/db-summary.py --json       # machine-readable JSON output
"""
import sqlite3
import os
import json
import argparse
import datetime

DB_PATH = os.path.join(os.path.dirname(__file__), "../data/local.db")

SEPARATOR = "─" * 60


def connect() -> sqlite3.Connection:
    if not os.path.exists(DB_PATH):
        print(f"❌  Database not found at {DB_PATH}")
        print("    Run: python3 scripts/local-db/init.py")
        raise SystemExit(1)
    conn = sqlite3.connect(DB_PATH, timeout=10)
    conn.row_factory = sqlite3.Row
    return conn


def scalar(conn: sqlite3.Connection, sql: str, *args) -> int | float | str | None:
    row = conn.execute(sql, args).fetchone()
    return row[0] if row else None


def rows(conn: sqlite3.Connection, sql: str, *args) -> list:
    return conn.execute(sql, args).fetchall()


def section(title: str) -> None:
    print(f"\n{SEPARATOR}")
    print(f"  {title}")
    print(SEPARATOR)


def fmt_val(v: float | None, unit: str = "") -> str:
    if v is None:
        return "—"
    return f"{v:,.2f}{' ' + unit if unit else ''}"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--json", action="store_true", help="Output as JSON")
    args = parser.parse_args()

    conn = connect()
    out: dict = {}

    # ── Stations ──────────────────────────────────────────────────────────────
    total_stations = scalar(conn, "SELECT COUNT(*) FROM stations")
    active_stations = scalar(conn, "SELECT COUNT(*) FROM stations WHERE is_active = 1")
    cities = scalar(conn, "SELECT COUNT(DISTINCT city) FROM stations")
    out["stations"] = {
        "total": total_stations,
        "active": active_stations,
        "cities": cities,
    }

    by_city = rows(conn, """
        SELECT city, COUNT(*) as n
        FROM stations GROUP BY city ORDER BY n DESC LIMIT 20
    """)

    # ── Sensors ───────────────────────────────────────────────────────────────
    total_sensors = scalar(conn, "SELECT COUNT(*) FROM sensors")
    stations_with_sensors = scalar(
        conn, "SELECT COUNT(DISTINCT station_id) FROM sensors"
    )
    by_param = rows(conn, """
        SELECT param_code, COUNT(*) as n
        FROM sensors GROUP BY param_code ORDER BY n DESC
    """)
    out["sensors"] = {
        "total": total_sensors,
        "stations_covered": stations_with_sensors,
        "by_param": {r["param_code"]: r["n"] for r in by_param},
    }

    # ── Readings ──────────────────────────────────────────────────────────────
    total_rows = scalar(conn, "SELECT COUNT(*) FROM readings")
    rows_with_data = scalar(conn, """
        SELECT COUNT(*) FROM readings
        WHERE pm25 IS NOT NULL OR pm10 IS NOT NULL OR no2 IS NOT NULL
           OR o3   IS NOT NULL OR so2  IS NOT NULL OR co  IS NOT NULL
           OR c6h6 IS NOT NULL OR aqi_value IS NOT NULL
    """)
    earliest = scalar(conn, "SELECT MIN(measured_at) FROM readings")
    latest   = scalar(conn, "SELECT MAX(measured_at) FROM readings")

    pollutant_stats: dict = {}
    for col, label, unit in [
        ("pm25",      "PM2.5",     "µg/m³"),
        ("pm10",      "PM10",      "µg/m³"),
        ("no2",       "NO2",       "µg/m³"),
        ("o3",        "O3",        "µg/m³"),
        ("so2",       "SO2",       "µg/m³"),
        ("co",        "CO",        "µg/m³"),
        ("c6h6",      "C6H6",      "µg/m³"),
        ("aqi_value", "AQI value", ""),
    ]:
        r = conn.execute(f"""
            SELECT COUNT(*) as n,
                   MIN({col}) as lo, AVG({col}) as avg, MAX({col}) as hi
            FROM readings WHERE {col} IS NOT NULL
        """).fetchone()
        if r and r["n"] > 0:
            pollutant_stats[col] = {
                "label": label, "unit": unit,
                "count": r["n"],
                "min": round(r["lo"], 2),
                "avg": round(r["avg"], 2),
                "max": round(r["hi"], 2),
            }

    by_city_readings = rows(conn, """
        SELECT st.city, COUNT(*) as n
        FROM readings r
        JOIN stations st ON r.station_id = st.id
        GROUP BY st.city ORDER BY n DESC LIMIT 20
    """)

    aqi_dist = rows(conn, """
        SELECT aqi_level, COUNT(*) as n
        FROM readings WHERE aqi_level IS NOT NULL
        GROUP BY aqi_level ORDER BY n DESC
    """)

    out["readings"] = {
        "total_rows": total_rows,
        "rows_with_data": rows_with_data,
        "time_range": {"earliest": earliest, "latest": latest},
        "pollutants": pollutant_stats,
        "by_city": {r["city"]: r["n"] for r in by_city_readings},
        "aqi_distribution": {r["aqi_level"]: r["n"] for r in aqi_dist},
    }

    # ── Sensor harvest state ───────────────────────────────────────────────────
    sensors_tracked = scalar(conn, "SELECT COUNT(*) FROM sensor_harvest_state")
    total_fetched   = scalar(conn, "SELECT SUM(total_rows) FROM sensor_harvest_state") or 0
    out["sensor_harvest_state"] = {
        "sensors_tracked": sensors_tracked,
        "total_rows_fetched": total_fetched,
    }

    # ── Harvest log ────────────────────────────────────────────────────────────
    harvest_runs = rows(conn, """
        SELECT script, phase, stations_processed, readings_inserted,
               errors_count, started_at, finished_at, notes
        FROM harvest_log ORDER BY id DESC LIMIT 10
    """)
    out["harvest_log"] = [dict(r) for r in harvest_runs]

    conn.close()

    # ── JSON output ───────────────────────────────────────────────────────────
    if args.json:
        print(json.dumps(out, indent=2, ensure_ascii=False))
        return

    # ── Human-readable output ─────────────────────────────────────────────────
    now = datetime.datetime.now(datetime.UTC).isoformat(timespec="seconds")
    print(f"\n  Powietrze — local.db summary  [{now}]")

    section("STATIONS")
    print(f"  Total:   {total_stations}")
    print(f"  Active:  {active_stations}")
    print(f"  Cities:  {cities}")
    print()
    print(f"  {'City':<30} {'Stations':>8}")
    print(f"  {'─'*30} {'─'*8}")
    for r in by_city:
        print(f"  {r['city']:<30} {r['n']:>8}")

    section("SENSORS")
    print(f"  Total sensors:          {total_sensors}")
    print(f"  Stations with sensors:  {stations_with_sensors} / {total_stations}")
    print()
    print(f"  {'Param':<18} {'Sensors':>7}")
    print(f"  {'─'*18} {'─'*7}")
    for r in by_param[:15]:
        print(f"  {r['param_code']:<18} {r['n']:>7}")
    if len(by_param) > 15:
        print(f"  … and {len(by_param) - 15} more param types")

    section("READINGS")
    print(f"  Total rows:            {total_rows:>7}")
    print(f"  Rows with data:        {rows_with_data:>7}")
    print(f"  Earliest measurement:  {earliest or '—'}")
    print(f"  Latest measurement:    {latest or '—'}")
    print()
    print(f"  {'Param':<12} {'Count':>6}  {'Min':>9}  {'Avg':>9}  {'Max':>9}")
    print(f"  {'─'*12} {'─'*6}  {'─'*9}  {'─'*9}  {'─'*9}")
    for s in pollutant_stats.values():
        u = s["unit"]
        print(
            f"  {s['label']:<12} {s['count']:>6}"
            f"  {s['min']:>7.2f}{' ' + u if u else ''}"
            f"  {s['avg']:>7.2f}{' ' + u if u else ''}"
            f"  {s['max']:>7.2f}{' ' + u if u else ''}"
        )

    print()
    print(f"  {'City':<30} {'Rows':>6}")
    print(f"  {'─'*30} {'─'*6}")
    for r in by_city_readings:
        print(f"  {r['city']:<30} {r['n']:>6}")

    print()
    print("  AQI level distribution:")
    for r in aqi_dist:
        bar = "█" * min(40, int(r["n"] / max(1, (aqi_dist[0]["n"] / 30))))
        print(f"  {r['aqi_level']:<20} {r['n']:>4}  {bar}")

    section("SENSOR HARVEST STATE")
    print(f"  Sensors tracked in state table: {sensors_tracked}")
    print(f"  Total rows fetched across all:  {total_fetched}")

    section("HARVEST LOG  (last 10 runs)")
    print(f"  {'Script':<28} {'Phase':<14} {'Stations':>8} {'Readings':>8} {'Errors':>6}  Started")
    print(f"  {'─'*28} {'─'*14} {'─'*8} {'─'*8} {'─'*6}  {'─'*20}")
    for r in harvest_runs:
        finished = "running…" if not r["finished_at"] else "✓"
        notes = f"  [{r['notes']}]" if r["notes"] else ""
        print(
            f"  {r['script']:<28} {r['phase']:<14}"
            f" {r['stations_processed']:>8} {r['readings_inserted']:>8}"
            f" {r['errors_count']:>6}  {r['started_at']}{notes}"
        )

    print(f"\n{SEPARATOR}\n")


if __name__ == "__main__":
    main()
