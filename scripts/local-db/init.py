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

DB_PATH     = os.path.join(os.path.dirname(__file__), "../../data/local.db")
SCHEMA_PATH = os.path.join(os.path.dirname(__file__), "schema.sql")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--reset", action="store_true",
                        help="Drop and recreate all tables (loses all data)")
    args = parser.parse_args()

    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)

    if args.reset:
        confirm = input("⚠ This will delete ALL local data. Type 'yes' to confirm: ")
        if confirm.strip() != "yes":
            print("Aborted.")
            sys.exit(0)
        conn.execute("PRAGMA foreign_keys = OFF")
        tables = conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table'"
        ).fetchall()
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
