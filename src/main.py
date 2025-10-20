# src/main.py
import json
import pandas as pd
from api_client import get_all_stations
from data_processor import stations_to_dataframe

def main():
    """Main function to run the data pipeline."""
    print("Starting data pipeline...")
    
    # 1. Gather Data
    print("Fetching station data from GIOŚ API...")
    raw_stations = get_all_stations()
    
    if raw_stations:
        # Save the raw data (good practice!)
        with open('data/raw/stations.json', 'w', encoding='utf-8') as f:
            json.dump(raw_stations, f, ensure_ascii=False, indent=4)
        print("Raw station data saved to data/raw/stations.json")
        
        # 2. Transform Data
        print("Processing station data...")
        stations_df = stations_to_dataframe(raw_stations)
        
        # 3. Save Processed Data
        output_path = 'data/processed/stations.csv'
        stations_df.to_csv(output_path, index=False)
        print(f"Processed station data saved to {output_path}")
    
    print("Pipeline finished.")

if __name__ == "__main__":
    main()