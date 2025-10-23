from flask import Flask, jsonify, request, send_from_directory, make_response
import os
import requests
import traceback
import time
from dotenv import load_dotenv
import json

# Load environment variables from .env file
load_dotenv()

app = Flask(__name__, static_folder='static')

# Create static folder if it doesn't exist
os.makedirs('static', exist_ok=True)

# API keys and configuration from environment variables
OPENMAPTILES_API_KEY = os.environ.get('OPENMAPTILES_API_KEY')
NOMINATIM_EMAIL = os.environ.get('NOMINATIM_EMAIL', 'user@example.com')

# API endpoints
NOMINATIM_URL = 'https://nominatim.openstreetmap.org/reverse'
NOMINATIM_SEARCH_URL = 'https://nominatim.openstreetmap.org/search'
OSM_BOUNDARIES_URL = 'https://nominatim.openstreetmap.org/details.php'

# User agent for Nominatim requests (required by their usage policy)
USER_AGENT = f'TestFrontieresApp/1.0 (Contact: {NOMINATIM_EMAIL})'

# Print configuration for debugging
print(f"\nConfiguration:")
print(f"- OPENMAPTILES_API_KEY: {'Set (hidden value)' if OPENMAPTILES_API_KEY else 'Not set'}")
print(f"- Using Nominatim with email: {NOMINATIM_EMAIL}")
print(f"- NOMINATIM_URL: {NOMINATIM_URL}")
print(f"- NOMINATIM_SEARCH_URL: {NOMINATIM_SEARCH_URL}")
print(f"- OSM_BOUNDARIES_URL: {OSM_BOUNDARIES_URL}")

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

@app.route('/api/country-at-point')
def get_country_at_point():
    # Get lat/lon from request
    try:
        lat = float(request.args.get('lat'))
        lon = float(request.args.get('lon'))
    except (TypeError, ValueError):
        return jsonify({"error": "Missing or invalid lat/lon parameters"}), 400

    try:
        print(f"\n=== STEP 1: Reverse geocoding to identify country at: {lat}, {lon} ===")
        
        start = time.time()  

        # First, use Nominatim for reverse geocoding to identify the country
        nominatim_params = {
            'lat': lat,
            'lon': lon,
            'format': 'json',
            'zoom': 3,
        }
        
        headers = {'User-Agent': USER_AGENT}
        
        print(f"Nominatim API URL: {NOMINATIM_URL}")
        print(f"Nominatim Parameters: {nominatim_params}")
        
        r_geo = requests.get(NOMINATIM_URL, params=nominatim_params, headers=headers, timeout=30)
        print(f"Nominatim API Status Code: {r_geo.status_code}")
        
        r_geo.raise_for_status()
        geo_data = r_geo.json() if isinstance(r_geo.json(), dict) else {'error': 'Invalid response'}
        
        # Check if we have a valid response from Nominatim
        if geo_data and 'error' not in geo_data:
            # Extract country information from address details
            address = geo_data.get('address', {})
            country_name = address.get('country')
            country_code = address.get('country_code', '').upper() if address.get('country_code') else ''
            osm_id = geo_data.get('osm_id')
            osm_type = geo_data.get('osm_type')
            
            # Nominatim provides name details which may contain local names
            name_details = geo_data.get('namedetails', {})
            local_name = name_details.get('name') or name_details.get('name:en') or country_name
            
            print(f"Found country: {country_name} ({country_code}), OSM ID: {osm_id}, OSM Type: {osm_type}")
            
            end = time.time()  
            print("took : ", end - start)
            
            start = time.time()
            
            # Get boundaries from OSM
            if osm_id and osm_type and country_name:
                print(f"\n=== STEP 2: Getting country boundary for {country_name} using OSM ID: {osm_id} ===")
                
                # Pour les pays, nous utilisons directement l'API Nominatim search avec le polygon_geojson
                # C'est plus fiable que d'utiliser l'API details.php
                osm_params = {
                    'country': country_code.lower(),
                    'format': 'json',
                    'polygon_geojson': 1,
                    'limit': 1
                }
                
                # Utiliser l'API search pour obtenir la géométrie du pays
                url = NOMINATIM_SEARCH_URL
                print(f"Nominatim Search URL: {url}")
                print(f"Search Parameters: {osm_params}")
                
                r_borders = requests.get(url, params=osm_params, headers={'User-Agent': USER_AGENT}, timeout=30)
                print(f"OSM API Status Code: {r_borders.status_code}")
                
                r_borders.raise_for_status()
                borders_data = r_borders.json()
                
                # Nominatim search renvoie une liste de résultats
                if borders_data and isinstance(borders_data, list) and len(borders_data) > 0:
                    country_data = borders_data[0]
                    
                    # Vérifier si nous avons un polygone GeoJSON
                    if 'geojson' in country_data:
                        # Create a GeoJSON feature from OSM geometry
                        geojson_feature = {
                            'type': 'Feature',
                            'properties': {
                                'name': country_name,
                                'country': country_name,
                                'country_code': country_code,
                                'admin_level': 2,  # Les pays sont de niveau 2
                                'osm_id': country_data.get('osm_id', osm_id),
                                'osm_type': country_data.get('osm_type', osm_type),
                                'display_name': country_data.get('display_name', ''),
                                '_enhanced': {
                                    'best_name': local_name or country_name,
                                    'admin_type': 'Country',
                                    'found_via': 'nominatim_search'
                                }
                            },
                            'geometry': country_data['geojson']
                        }
                    
                    # Create a GeoJSON FeatureCollection
                    result = {
                        'type': 'FeatureCollection',
                        'features': [geojson_feature]
                    }
                    
                    end = time.time()
                    print("took : ", end - start)
                    
                    print(f"Successfully returning country boundary for {country_name}")
                    return jsonify(result)
                
                # Check if we got valid country boundaries
                if 'features' in borders_data and borders_data['features']:
                    print(f"Found {len(borders_data['features'])} boundary features")
                    
                    # Enhanced features list to store all processed features
                    enhanced_features = []
                    
                    # Process and enhance each feature
                    for feature in borders_data['features']:
                        # Skip features with invalid geometry
                        has_valid_geometry = (
                            'geometry' in feature and 
                            feature['geometry'] and 
                            'coordinates' in feature['geometry'] and 
                            feature['geometry']['coordinates']
                        )
                        
                        if not has_valid_geometry:
                            print(f"Skipping feature without valid geometry")
                            continue
                            
                        # Skip empty geometries
                        if feature['geometry']['type'] == 'GeometryCollection' and not feature['geometry'].get('geometries'):
                            print(f"Skipping empty GeometryCollection")
                            continue
                            
                        # Make sure properties exists
                        if 'properties' not in feature:
                            feature['properties'] = {}
                        
                        # Get admin level if available (countries are level 2)
                        admin_level = feature['properties'].get('admin_level', 2)
                        
                        # Add country information to every feature
                        feature['properties'].update({
                            'name': country_name,
                            'country': country_name,
                            'country_code': country_code,
                            'admin_level': admin_level,  # Use the admin level from the feature or default to 2
                            '_enhanced': {
                                'best_name': country_name,
                                'admin_type': 'Country' if admin_level == 2 else f'Administrative Level {admin_level}',
                                'found_via': 'consists_of_api'
                            }
                        })
                        
                        # Add to our enhanced features list
                        enhanced_features.append(feature)
                    
                    print(f"Enhanced {len(enhanced_features)} features with valid geometry")
                    
                    # Sort features by importance (countries first, then regions)
                    # This ensures country boundaries are prioritized in display
                    enhanced_features.sort(
                        key=lambda f: f.get('properties', {}).get('admin_level', 999)
                    )
                    
                    # If we have no features after filtering, create a fallback
                    if not enhanced_features:
                        print("WARNING: No valid boundary features found after filtering")
                        
                        # Create a fallback feature using the original first feature
                        fallback_feature = borders_data['features'][0]
                        
                        if 'properties' not in fallback_feature:
                            fallback_feature['properties'] = {}
                            
                        fallback_feature['properties'].update({
                            'name': country_name,
                            'country': country_name,
                            'country_code': country_code,
                            'admin_level': 2,
                            '_enhanced': {
                                'best_name': country_name,
                                'admin_type': 'Country (Fallback)',
                                'found_via': 'consists_of_api_fallback'
                            }
                        })
                        
                        enhanced_features = [fallback_feature]
                    
                    # Return the result with all enhanced features
                    result = {
                        'type': 'FeatureCollection',
                        'features': enhanced_features
                    }
                    
                    end = time.time()
                    print("took : ", end - start)

                    print(f"Successfully returning country boundary for {country_name}")
                    return jsonify(result)
                else:
                    # If we couldn't get the boundary, try to get it from the polygon endpoint
                    print(f"No boundary features found, trying polygon endpoint")
                    
                    # Try to get polygons from a different endpoint
                    polygon_params = {
                        'q': country_name,
                        'polygon_geojson': 1,
                        'format': 'json',
                        'limit': 1,
                        'countrycodes': country_code.lower()
                    }
                    
                    url = NOMINATIM_SEARCH_URL
                    print(f"Polygon search URL: {url}")
                    print(f"Polygon search parameters: {polygon_params}")
                    
                    try:
                        r_polygon = requests.get(url, params=polygon_params, headers={'User-Agent': USER_AGENT}, timeout=30)
                        r_polygon.raise_for_status()
                        
                        polygon_data = r_polygon.json()
                        if polygon_data and isinstance(polygon_data, list) and len(polygon_data) > 0:
                            polygon = polygon_data[0]
                            
                            if 'geojson' in polygon:
                                # Create a GeoJSON feature
                                polygon_feature = {
                                    'type': 'Feature',
                                    'properties': {
                                        'name': country_name,
                                        'country': country_name,
                                        'country_code': country_code,
                                        'admin_level': 2,
                                        '_enhanced': {
                                            'best_name': local_name or country_name,
                                            'admin_type': 'Country',
                                            'found_via': 'nominatim_polygon'
                                        }
                                    },
                                    'geometry': polygon['geojson']
                                }
                                
                                result = {
                                    'type': 'FeatureCollection',
                                    'features': [polygon_feature]
                                }
                                
                                end = time.time()
                                print("took : ", end - start)
                                
                                print(f"Successfully returning country boundary from polygon search")
                                return jsonify(result)
                    except Exception as polygon_err:
                        print(f"Error fetching polygon: {polygon_err}")
                    
                    # If all else fails, return a point feature
                    print(f"No boundary data found, returning point feature")
                    
                    # Create a placeholder feature with the country information
                    country_feature = {
                        'type': 'Feature',
                        'properties': {
                            'name': country_name,
                            'country': country_name,
                            'country_code': country_code,
                            'formatted': geo_data.get('display_name', country_name),
                            'admin_level': 2,
                            '_enhanced': {
                                'best_name': local_name or country_name,
                                'admin_type': 'Country',
                                'found_via': 'nominatim_geocoding'
                            }
                        },
                        'geometry': {
                            'type': 'Point',
                            'coordinates': [lon, lat]  # GeoJSON uses [longitude, latitude]
                        }
                    }
                    
                    result = {
                        'type': 'FeatureCollection',
                        'features': [country_feature]
                    }
                    
                    end = time.time()
                    print("took : ", end - start)

                    print(f"Returning country point for {country_name} (no boundary available)")
                    return jsonify(result)
            else:
                print("No OSM ID found in geocoding response")
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

if __name__ == '__main__':
    print("\nStarting Flask server on http://127.0.0.1:5000")
    print("Click on the map to identify countries and show their boundaries")
    app.run(host='127.0.0.1', port=5000, debug=True)