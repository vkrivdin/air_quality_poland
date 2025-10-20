# src/data_processor.py
import pandas as pd

def stations_to_dataframe(stations_json):
    """Converts the raw JSON list of stations into a pandas DataFrame."""
    if not stations_json:
        return pd.DataFrame() # Return empty DataFrame if input is empty
    
    df = pd.DataFrame(stations_json)
    # Example transformation: select and rename columns
    df = df[['id', 'stationName', 'gegrLat', 'gegrLon', 'city']]
    df = df.rename(columns={
        'id': 'station_id',
        'stationName': 'station_name',
        'gegrLat': 'latitude',
        'gegrLon': 'longitude'
    })
    return df