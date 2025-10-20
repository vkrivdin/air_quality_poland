import os
import requests
from dotenv import load_dotenv

# This line loads the variables from your .env file (like API_BASE_URL)
load_dotenv() 

# Retrieve the base URL from the environment variables
API_BASE_URL = os.getenv("API_BASE_URL")

def get_all_stations():
    """
    Fetches a list of all monitoring stations from the GIOŚ API.
    Returns the JSON response as a Python list of dictionaries, or None on error.
    """
    if not API_BASE_URL:
        print("Error: API_BASE_URL is not set in the .env file.")
        return None

    # Construct the full URL for the endpoint
    url = f"{API_BASE_URL}/station/findAll"
    print(f"Connecting to: {url}")

    try:
        # Make the GET request to the API
        response = requests.get(url, timeout=10) # timeout is good practice
        
        # This will raise an HTTPError if the HTTP request returned an unsuccessful status code (like 404 or 500)
        response.raise_for_status() 
        
        # If the request was successful, parse the JSON and return it
        return response.json()

    except requests.exceptions.RequestException as e:
        # This will catch connection errors, timeouts, etc.
        print(f"An error occurred while connecting to the API: {e}")
        return None

# ---- This is our test block ----
# This code will only run when you execute `python src/api_client.py` directly.
# It will NOT run when another script (like main.py) imports this file.
if __name__ == "__main__":
    print("--- Running api_client.py as a standalone script for testing ---")
    
    stations = get_all_stations()
    
    if stations:
        print(f"\nSuccessfully fetched data for {len(stations)} stations.")
        print("Here is an example of the first station:")
        # Print the first station's data in a readable format
        import json
        print(json.dumps(stations[0], indent=2, ensure_ascii=False))
    else:
        print("\nFailed to fetch station data. Please check the error messages above.")