#!/usr/bin/env python3
"""
harvest-gios.py
---------------
Fetches all GIOŚ monitoring stations and their current AQI indexes,
then saves normalised JSON files for use as local demo data in the
Powietrze app.

Output files (written to ../data/):
  stations.json   — all 289 stations with coordinates and metadata
  aqi.json        — current AQI index per station (where available)
  readings.json   — current sensor readings per station/sensor
  summary.json    — combined per-station object ready for map rendering

Rate limits:
  - /station/findAll, /aqindex/getIndex — 1500 req/min (generous)
  - /station/sensors, /data/getData     — 2 req/min (slow, used sparingly)
"""

import json
import time
import urllib.request
import urllib.error
import os
from typing import Any

BASE_URL = "https://api.gios.gov.pl/pjp-api/v1/rest"
OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
os.makedirs(OUT_DIR, exist_ok=True)


def fetch(url: str) -> Any:
    """Fetch JSON from a URL. Returns parsed dict/list or None on error."""
    try:
        req = urllib.request.Request(url, headers={"Accept": "*/*", "User-Agent": "Powietrze/0.1 (dev)"})

        with urllib.request.urlopen(req, timeout=10) as resp:
            return json.loads(resp.read())
    except Exception as e:
        print(f"  ERROR fetching {url}: {e}")
        return None


def save(filename: str, data: Any) -> None:
    path = os.path.join(OUT_DIR, filename)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"  Saved {filename} ({len(json.dumps(data, ensure_ascii=False)) // 1024} KB)")


# ─────────────────────────────────────────────
# 1. Fetch all stations
# ─────────────────────────────────────────────
print("\n[1/3] Fetching all stations...")
raw = fetch(f"{BASE_URL}/station/findAll?size=500&page=0")
raw_stations = raw.get("Lista stacji pomiarowych", []) if raw else []

stations = []
for s in raw_stations:
    lat = s.get("WGS84 φ N") or s.get("WGS84 \u03c6 N")
    lon = s.get("WGS84 λ E") or s.get("WGS84 \u03bb E")
    # Skip stations with no coordinates
    if not lat or not lon:
        continue
    stations.append({
        "id": f"gios_{s['Identyfikator stacji']}",
        "gios_id": s["Identyfikator stacji"],
        "code": s.get("Kod stacji", ""),
        "name": s.get("Nazwa stacji", ""),
        "city": s.get("Nazwa miasta", ""),
        "street": s.get("Ulica"),
        "commune": s.get("Gmina", ""),
        "district": s.get("Powiat", ""),
        "voivodeship": s.get("Województwo", ""),
        "lat": float(lat),
        "lon": float(lon),
        "source": "gios",
    })

print(f"  Found {len(stations)} stations with coordinates (out of {len(raw_stations)} total)")
save("stations.json", stations)


# ─────────────────────────────────────────────
# 2. Fetch AQI index for every station
# ─────────────────────────────────────────────
print(f"\n[2/3] Fetching AQI indexes for {len(stations)} stations...")
print("  (This hits 1500 req/min endpoint — going fast with short delays)")

aqi_map = {}
batch_size = 50

for i, station in enumerate(stations):
    gios_id = station["gios_id"]
    data = fetch(f"{BASE_URL}/aqindex/getIndex/{gios_id}")
    
    if data:
        # The AQI response is nested under "AqIndex" key with long Polish field names
        aq = data.get("AqIndex", {})
        aqi_map[station["id"]] = {
            "station_id": station["id"],
            "gios_id": gios_id,
            "calc_date": aq.get("Data wykonania obliczeń indeksu"),
            "aqi_value": aq.get("Wartość indeksu"),
            "aqi_level_name": aq.get("Nazwa kategorii indeksu"),
            "status_ok": aq.get("Status indeksu ogólnego dla stacji pomiarowej"),
            "critical_pollutant": aq.get("Kod zanieczyszczenia krytycznego"),
            "pm25_value": aq.get("Wartość indeksu dla wskaźnika PM2.5"),
            "pm25_level": aq.get("Nazwa kategorii indeksu dla wskaźnika PM2.5"),
            "pm10_value": aq.get("Wartość indeksu dla wskaźnika PM10"),
            "pm10_level": aq.get("Nazwa kategorii indeksu dla wskaźnika PM10"),
            "no2_value": aq.get("Wartość indeksu dla wskaźnika NO2"),
            "no2_level": aq.get("Nazwa kategorii indeksu dla wskaźnika NO2"),
            "o3_value": aq.get("Wartość indeksu dla wskaźnika O3"),
            "o3_level": aq.get("Nazwa kategorii indeksu dla wskaźnika O3"),
            "so2_value": aq.get("Wartość indeksu dla wskaźnika SO2"),
            "so2_level": aq.get("Nazwa kategorii indeksu dla wskaźnika SO2"),
        }
    
    if (i + 1) % batch_size == 0:
        print(f"  Progress: {i + 1}/{len(stations)} stations processed...")
        time.sleep(0.5)  # light throttle every 50 requests

print(f"  Got AQI data for {len(aqi_map)} stations")
save("aqi.json", aqi_map)


# ─────────────────────────────────────────────
# 3. Build combined summary (stations + AQI merged)
# ─────────────────────────────────────────────
print("\n[3/3] Building combined summary for map rendering...")

# AQI level → numeric score + color (Polish standard 6-level scale)
AQI_LEVEL_MAP = {
    "Bardzo dobry": {"score": 1, "label_pl": "Bardzo dobry", "label_en": "Very Good", "color": "#00BCD4"},
    "Dobry":        {"score": 2, "label_pl": "Dobry",        "label_en": "Good",       "color": "#4CAF50"},
    "Umiarkowany":  {"score": 3, "label_pl": "Umiarkowany",  "label_en": "Moderate",   "color": "#FFEB3B"},
    "Dostateczny":  {"score": 4, "label_pl": "Dostateczny",  "label_en": "Sufficient", "color": "#FF9800"},
    "Zły":          {"score": 5, "label_pl": "Zły",          "label_en": "Bad",        "color": "#F44336"},
    "Bardzo zły":   {"score": 6, "label_pl": "Bardzo zły",   "label_en": "Very Bad",   "color": "#9C27B0"},
}

summary = []
no_aqi_count = 0

for station in stations:
    aqi = aqi_map.get(station["id"])
    aqi_name = aqi.get("aqi_level_name") if aqi else None
    aqi_meta = AQI_LEVEL_MAP.get(aqi_name) if aqi_name else None

    entry = {
        **station,
        "aqi": {
            "level_name": aqi_name,
            "level_name_en": aqi_meta["label_en"] if aqi_meta else None,
            "score": aqi_meta["score"] if aqi_meta else None,
            "color": aqi_meta["color"] if aqi_meta else "#9E9E9E",  # grey = no data
            "calc_date": aqi.get("calc_date") if aqi else None,
            "pm25_level": aqi.get("pm25_level") if aqi else None,
            "pm10_level": aqi.get("pm10_level") if aqi else None,
            "no2_level": aqi.get("no2_level") if aqi else None,
            "o3_level": aqi.get("o3_level") if aqi else None,
            "so2_level": aqi.get("so2_level") if aqi else None,
            "co_level": aqi.get("co_level") if aqi else None,
        }
    }
    summary.append(entry)
    if not aqi_name:
        no_aqi_count += 1

save("summary.json", summary)

# ─────────────────────────────────────────────
# Print statistics
# ─────────────────────────────────────────────
print("\n─── Harvest complete ───")
print(f"  Total stations:     {len(stations)}")
print(f"  With AQI data:      {len(stations) - no_aqi_count}")
print(f"  No AQI (grey):      {no_aqi_count}")

level_counts: dict = {}
for entry in summary:
    name = entry["aqi"]["level_name"] or "No data"
    level_counts[name] = level_counts.get(name, 0) + 1

print("\n  AQI distribution:")
for level, count in sorted(level_counts.items(), key=lambda x: -x[1]):
    print(f"    {level:20s}: {count}")

# Show a sample Kraków station
krakow = [s for s in summary if "kraków" in s["city"].lower() or "krakow" in s["city"].lower() or "Kraków" in s["city"]]
if krakow:
    print(f"\n  Sample Kraków stations ({len(krakow)} found):")
    for s in krakow[:3]:
        print(f"    {s['name']} → AQI: {s['aqi']['level_name']} ({s['aqi']['color']})")

print(f"\n  Output files saved to: {os.path.abspath(OUT_DIR)}/")
