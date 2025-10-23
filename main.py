from flask import Flask, jsonify, request, send_from_directory, make_response
import os
import requests
import traceback
import time
from dotenv import load_dotenv
import json
from functools import lru_cache
import threading
import collections

# Load environment variables from .env file
load_dotenv()

app = Flask(__name__, static_folder='static')

# Create static folder if it doesn't exist
os.makedirs('static', exist_ok=True)

# Simple memory cache for geocoding results
geocode_cache = {}
boundary_cache = {}
cache_lock = threading.Lock()
MAX_CACHE_SIZE = 100  # Maximum number of items to keep in cache

# Cache statistics
CACHE_STATS = {
    "geocoding": {"hits": 0, "misses": 0},
    "boundary": {"hits": 0, "misses": 0}
}

# API keys and configuration from environment variables
OPENMAPTILES_API_KEY = os.environ.get('OPENMAPTILES_API_KEY')
NOMINATIM_EMAIL = os.environ.get('NOMINATIM_EMAIL', 'user@example.com')

# API endpoints
NOMINATIM_URL = 'https://nominatim.openstreetmap.org/reverse'
NOMINATIM_SEARCH_URL = 'https://nominatim.openstreetmap.org/search'
OSM_BOUNDARIES_URL = 'https://nominatim.openstreetmap.org/details.php'

# User agent for Nominatim requests (required by their usage policy)
USER_AGENT = f'TestFrontieresApp/1.0 (Contact: {NOMINATIM_EMAIL})'

# Timeout settings (seconds)
GEOCODING_TIMEOUT = 5.0   # Increased timeout for geocoding
BOUNDARY_TIMEOUT = 8.0    # Longer timeout for boundary data

# Print configuration for debugging
print(f"\nConfiguration:")
print(f"- OPENMAPTILES_API_KEY: {'Set (hidden value)' if OPENMAPTILES_API_KEY else 'Not set'}")
print(f"- Using Nominatim with email: {NOMINATIM_EMAIL}")
print(f"- NOMINATIM_URL: {NOMINATIM_URL}")
print(f"- NOMINATIM_SEARCH_URL: {NOMINATIM_SEARCH_URL}")
print(f"- OSM_BOUNDARIES_URL: {OSM_BOUNDARIES_URL}")
print(f"- Request timeouts: Geocoding={GEOCODING_TIMEOUT}s, Boundaries={BOUNDARY_TIMEOUT}s")

# Function to get geocoding data with caching
def get_reverse_geocoding(lat, lon, use_cache=True):
    """
    Get reverse geocoding data with caching for performance
    """
    # Generate a cache key based on rounded coordinates (for nearby points)
    # Round to 4 decimal places (approximately 10 meters accuracy)
    cache_key = f"{round(lat, 4)},{round(lon, 4)}"
    
    # Check cache first if enabled
    if use_cache:
        with cache_lock:
            if cache_key in geocode_cache:
                print(f"Cache hit for {cache_key}")
                CACHE_STATS["geocoding"]["hits"] += 1
                return geocode_cache[cache_key]
            else:
                CACHE_STATS["geocoding"]["misses"] += 1
    
    # Set up the request parameters - include essential data for country identification
    params = {
        'lat': lat,
        'lon': lon,
        'format': 'json',
        'zoom': 3,  # Country level (0=country, 18=building/street)
        'addressdetails': 1,
        'namedetails': 0,  # We don't need name details for faster response
        'extratags': 0,    # We don't need extra tags for faster response
    }
    
    headers = {'User-Agent': USER_AGENT}
    
    print(f"Fetching geocoding data from Nominatim for {lat}, {lon} with timeout {GEOCODING_TIMEOUT}s")
    
    try:
        # Use our configured timeout for geocoding
        response = requests.get(
            NOMINATIM_URL, 
            params=params, 
            headers=headers, 
            timeout=GEOCODING_TIMEOUT
        )
        response.raise_for_status()
        
        # Process the response
        data = response.json() if isinstance(response.json(), dict) else {'error': 'Invalid response'}
        
        # Check if we have address data which contains country information
        if 'address' in data and data['address']:
            print(f"Found address data with {len(data['address'])} components")
            if 'country' in data['address']:
                print(f"Found country: {data['address']['country']}")
            else:
                print("No country field in address data")
        else:
            print("No address data found in response")
        
        # Cache the result if valid
        if use_cache and 'error' not in data:
            with cache_lock:
                # If cache gets too large, remove oldest entries
                if len(geocode_cache) >= MAX_CACHE_SIZE:
                    # Remove a random item to avoid complexity
                    geocode_cache.pop(next(iter(geocode_cache)))
                
                geocode_cache[cache_key] = data
        
        return data
    except requests.Timeout:
        print(f"Timeout while geocoding {lat}, {lon}")
        return {'error': 'Geocoding request timed out', 'timeout': True}
    except requests.RequestException as e:
        print(f"Request error while geocoding: {e}")
        return {'error': f'Geocoding request failed: {str(e)}'}
    except Exception as e:
        print(f"Error in geocoding: {e}")
        return {'error': f'Geocoding processing error: {str(e)}'}

# Add CORS headers to all responses
@app.after_request
def add_cors_headers(response):
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'GET, OPTIONS'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type'
    return response

@app.route('/')
def index():
    return send_from_directory('static', 'index.html')

@app.route('/api/map-config')
def get_map_config():
    """Return map configuration with API keys."""
    return jsonify({
        'openmaptiles_key': OPENMAPTILES_API_KEY
    })

# Function to get boundary data efficiently
def get_country_boundary(country_code, country_name):
    """
    Get boundary data for a country using the most efficient method
    with caching for improved performance
    """
    if not country_code:
        return None
    
    # Create a cache key based on the country code
    cache_key = country_code.lower()
    
    # Check cache first
    with cache_lock:
        if cache_key in boundary_cache:
            print(f"Cache hit for boundary: {country_code}")
            CACHE_STATS["boundary"]["hits"] += 1
            return boundary_cache[cache_key]
        else:
            CACHE_STATS["boundary"]["misses"] += 1
    
    # Use simplified search parameters
    params = {
        'country': country_code.lower(),
        'format': 'json',
        'polygon_geojson': 1,
        'limit': 1
    }
    
    headers = {'User-Agent': USER_AGENT}
    
    try:
        # Use a longer but still reasonable timeout
        response = requests.get(
            NOMINATIM_SEARCH_URL, 
            params=params, 
            headers=headers, 
            timeout=BOUNDARY_TIMEOUT
        )
        
        response.raise_for_status()
        data = response.json()
        
        # Process the response
        if data and isinstance(data, list) and len(data) > 0:
            country_data = data[0]
            if 'geojson' in country_data:
                # Store in cache for future use
                with cache_lock:
                    boundary_cache[cache_key] = country_data
                return country_data
    except Exception as e:
        print(f"Error getting country boundary: {e}")
    
    return None

@app.route('/api/country-at-point')
def get_country_at_point():
    # Get lat/lon from request
    try:
        lat = float(request.args.get('lat'))
        lon = float(request.args.get('lon'))
    except (TypeError, ValueError):
        return jsonify({"error": "Missing or invalid lat/lon parameters"}), 400

    try:
        print(f"\n=== Reverse geocoding at: {lat}, {lon} ===")
        
        start = time.time()  
        
        # Use our optimized geocoding function
        geo_data = get_reverse_geocoding(lat, lon)
        
        print(f"Geocoding completed in {time.time() - start:.3f} seconds")
        
        # Check if we have a valid response from Nominatim
        if geo_data and 'error' not in geo_data:
            # Extract country information from address details
            address = geo_data.get('address', {})
            country_name = address.get('country')
            country_code = address.get('country_code', '').upper() if address.get('country_code') else ''
            osm_id = geo_data.get('osm_id')
            osm_type = geo_data.get('osm_type')
            
            # Get display name
            display_name = geo_data.get('display_name', '')
            
            print(f"Found country: {country_name} ({country_code})")
            
            # If we have a country code, get the boundary in a separate thread
            # This is done asynchronously for better UX
            boundary_start = time.time()
            boundary_data = None
            
            if country_code and country_name:
                print(f"Getting boundary for {country_name}")
                boundary_data = get_country_boundary(country_code, country_name)
                print(f"Boundary retrieved in {time.time() - boundary_start:.3f} seconds")
                
            # If we found boundary data, use it to create the response
            if boundary_data and 'geojson' in boundary_data:
                geojson_feature = {
                    'type': 'Feature',
                    'properties': {
                        'name': country_name,
                        'country': country_name,
                        'country_code': country_code,
                        'admin_level': 2,  # Les pays sont de niveau 2
                        'osm_id': boundary_data.get('osm_id', osm_id),
                        'osm_type': boundary_data.get('osm_type', osm_type),
                        'display_name': boundary_data.get('display_name', display_name),
                        '_enhanced': {
                            'best_name': country_name,
                            'admin_type': 'Country',
                            'found_via': 'nominatim_optimized'
                        }
                    },
                    'geometry': boundary_data['geojson']
                }
                
                # Create a GeoJSON FeatureCollection
                result = {
                    'type': 'FeatureCollection',
                    'features': [geojson_feature]
                }
                
                print(f"Successfully returning country boundary for {country_name}")
                print(f"Total processing time: {time.time() - start:.3f} seconds")
                return jsonify(result)
                
            else:
                print("No valid boundary data found for this country")
        else:
            print("No country found in geocoding response")


        # If we've reached this point, try getting location information directly
        print("\n=== STEP 3: Falling back to direct location lookup ===")
        
        # Use generic reverse geocoding without type restriction
        fallback_params = {
            'lat': lat,
            'lon': lon,
            'format': 'json',
            'addressdetails': 1,
            'extratags': 1,
            'zoom': 18  # Most detailed level
        }
        
        r_fallback = requests.get(NOMINATIM_URL, params=fallback_params, headers={'User-Agent': USER_AGENT}, timeout=30)
        r_fallback.raise_for_status()
        fallback_data = r_fallback.json() if isinstance(r_fallback.json(), dict) else {'error': 'Invalid response'}
        
        if fallback_data and 'error' not in fallback_data:
            # Extract location information from address details
            address = fallback_data.get('address', {})
            
            # Determine best name for the location
            location_name = None
            for key in ['name', 'leisure', 'amenity', 'road', 'hamlet', 'village', 'town', 'city', 'county', 'state', 'country']:
                if key in address and address[key]:
                    location_name = address[key]
                    break
                    
            if not location_name:
                location_name = fallback_data.get('display_name', 'Unknown Location')
                
            print(f"Fallback found location: {location_name}")
            
            # Try to get a polygon if available
            location_feature = None
            
            if 'osm_id' in fallback_data and 'osm_type' in fallback_data:
                # Try to get a polygon from OSM for this location
                try:
                    osm_id = fallback_data.get('osm_id')
                    osm_type = fallback_data.get('osm_type')
                    display_name = fallback_data.get('display_name', '')
                    
                    # Utiliser le nom pour rechercher le lieu et obtenir le polygone
                    polygon_params = {
                        'q': display_name.split(',')[0],  # Utiliser la première partie du nom complet
                        'format': 'json',
                        'polygon_geojson': 1,
                        'limit': 1
                    }
                    
                    url = NOMINATIM_SEARCH_URL
                    r_loc_polygon = requests.get(url, params=polygon_params, headers={'User-Agent': USER_AGENT}, timeout=30)
                    r_loc_polygon.raise_for_status()
                    
                    loc_polygon_data = r_loc_polygon.json()
                    
                    if loc_polygon_data and isinstance(loc_polygon_data, list) and len(loc_polygon_data) > 0:
                        poly_item = loc_polygon_data[0]
                        
                        if 'geojson' in poly_item:
                            # Create a GeoJSON feature with the polygon
                            location_feature = {
                                'type': 'Feature',
                                'properties': {
                                    'name': location_name,
                                    'country': address.get('country'),
                                    'state': address.get('state'),
                                    'city': address.get('city'),
                                    'formatted': fallback_data.get('display_name'),
                                    '_enhanced': {
                                        'best_name': location_name,
                                        'admin_type': fallback_data.get('type', 'Location'),
                                        'found_via': 'nominatim_polygon_fallback'
                                    }
                                },
                                'geometry': poly_item['geojson']
                            }
                except Exception as polygon_err:
                    print(f"Error fetching location polygon: {polygon_err}")
            
            # If we couldn't get a polygon, create a point feature
            if not location_feature:
                location_feature = {
                    'type': 'Feature',
                    'properties': {
                        'name': location_name,
                        'country': address.get('country'),
                        'state': address.get('state'),
                        'city': address.get('city'),
                        'formatted': fallback_data.get('display_name'),
                        '_enhanced': {
                            'best_name': location_name,
                            'admin_type': fallback_data.get('type', 'Location'),
                            'found_via': 'nominatim_fallback'
                        }
                    },
                    'geometry': {
                        'type': 'Point',
                        'coordinates': [lon, lat]
                    }
                }
            
            result = {
                'type': 'FeatureCollection',
                'features': [location_feature]
            }
            
            print(f"Returning location information for {location_name}")
            return jsonify(result)
        else:
            print("No location found at these coordinates")
            return jsonify({
                "error": "No location information found at these coordinates",
                "coordinates": {"lat": lat, "lon": lon}
            }), 404
            
    except requests.RequestException as e:
        print(f"API request error: {e}")
        return jsonify({
            "error": f"API request failed: {str(e)}",
            "coordinates": {"lat": lat, "lon": lon},
            "details": str(e)
        }), 500
    except Exception as e:
        print(f"Unexpected error: {e}")
        traceback.print_exc()  # Print the full stack trace
        return jsonify({
            "error": f"Unexpected error: {str(e)}",
            "coordinates": {"lat": lat, "lon": lon}
        }), 500

# Support for old API endpoint
@app.route('/api/frontiers')
def get_frontiers():
    # Check if lat/lon parameters are provided
    lat = request.args.get('lat')
    lon = request.args.get('lon')
    
    if lat and lon:
        # If lat/lon provided, delegate to the new endpoint
        return get_country_at_point()
    else:
        # Otherwise return an error message
        return jsonify({
            "error": "This API has changed. Please use /api/country-at-point with lat and lon parameters."
        }), 400

@app.route('/api/stats')
def get_stats():
    """Return cache statistics and performance metrics"""
    stats = {
        "cache": {
            "size": {
                "geocoding": len(geocode_cache),
                "boundary": len(boundary_cache),
                "max_size": MAX_CACHE_SIZE
            },
            "hits_misses": CACHE_STATS
        },
        "server": {
            "uptime": "Active",
            "version": "1.0.0"
        }
    }
    return jsonify(stats)

if __name__ == '__main__':
    print("\nStarting Flask server on http://127.0.0.1:5000")
    print("Click on the map to identify countries and show their boundaries")
    app.run(host='127.0.0.1', port=5000, debug=True)