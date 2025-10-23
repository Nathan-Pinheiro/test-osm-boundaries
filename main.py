from flask import Flask, jsonify, request, send_from_directory, make_response
import os
import requests
import traceback
import time

app = Flask(__name__, static_folder='static')

# Create static folder if it doesn't exist
os.makedirs('static', exist_ok=True)

# API key from environment variable 
GEOAPIFY_API_KEY = os.environ.get('GEOAPIFY_API_KEY', '87b5dce83fa140c4acfa6722d255938c')
GEOCODING_URL = 'https://api.geoapify.com/v1/geocode/reverse'
CONSISTS_OF_URL = 'https://api.geoapify.com/v1/boundaries/consists-of'

# Print configuration for debugging
print(f"\nConfiguration:")
print(f"- GEOAPIFY_API_KEY: {'Set (hidden value)' if GEOAPIFY_API_KEY else 'Not set'}")
print(f"- GEOCODING_URL: {GEOCODING_URL}")
print(f"- CONSISTS_OF_URL: {CONSISTS_OF_URL}")

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

@app.route('/api/country-at-point')
def get_country_at_point():

    if not GEOAPIFY_API_KEY:
        return jsonify({
            "error": "GEOAPIFY_API_KEY not set in environment", 
            "instructions": "Get a free API key from https://www.geoapify.com/"
        }), 500

    # Get lat/lon from request
    try:
        lat = float(request.args.get('lat'))
        lon = float(request.args.get('lon'))
    except (TypeError, ValueError):
        return jsonify({"error": "Missing or invalid lat/lon parameters"}), 400

    try:
        print(f"\n=== STEP 1: Reverse geocoding to identify country at: {lat}, {lon} ===")
        
        start = time.time()  

        # First, use reverse geocoding to identify the country
        geocode_params = {
            'lat': lat,
            'lon': lon,
            'type': 'country',  # Specifically request country information
            'format': 'json',   # Use JSON format for easier parsing
            'apiKey': GEOAPIFY_API_KEY
        }
        
        print(f"Geocoding API URL: {GEOCODING_URL}")
        print(f"Geocoding Parameters: {geocode_params}")
        
        r_geo = requests.get(GEOCODING_URL, params=geocode_params, timeout=30)
        print(f"Geocoding API Status Code: {r_geo.status_code}")
        
        r_geo.raise_for_status()
        geo_data = r_geo.json()
        
        # Check if we have results
        if 'results' in geo_data and geo_data['results']:
            country_info = geo_data['results'][0]
            country_name = country_info.get('country')
            country_code = country_info.get('country_code')
            place_id = country_info.get('place_id')
            
            print(f"Found country: {country_name} ({country_code}), Place ID: {place_id}")
            
            end = time.time()  
            
            print("took : ", end - start)

            start = time.time()

            # Now get the country boundaries using the consists-of endpoint
            if place_id:
                print(f"\n=== STEP 2: Getting country boundary for {country_name} using place_id {place_id} ===")
                
                consists_params = {
                    'id': place_id,
                    'geometry': 'geometry_10000',  # Higher detail level for country borders
                    'type': 'country',            # Specify country type explicitly
                    'format': 'geojson',          # Explicitly request GeoJSON format
                    'apiKey': GEOAPIFY_API_KEY
                }
                
                print(f"Consists-of API URL: {CONSISTS_OF_URL}")
                print(f"Consists-of Parameters: {consists_params}")
                
                r_borders = requests.get(CONSISTS_OF_URL, params=consists_params, timeout=30)
                print(f"Consists-of API Status Code: {r_borders.status_code}")
                
                r_borders.raise_for_status()
                borders_data = r_borders.json()
                
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
                    # If we couldn't get the boundary, just return the country information
                    print(f"No boundary features found, returning country info only")
                    
                    # Create a placeholder feature with the country information
                    country_feature = {
                        'type': 'Feature',
                        'properties': {
                            'name': country_name,
                            'country': country_name,
                            'country_code': country_code,
                            'formatted': country_info.get('formatted', country_name),
                            'admin_level': 2,
                            '_enhanced': {
                                'best_name': country_name,
                                'admin_type': 'Country',
                                'found_via': 'geocoding_api'
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
                print("No place_id found in geocoding response")
        else:
            print("No country found in geocoding response")


        # If we've reached this point, try getting location information directly
        print("\n=== STEP 3: Falling back to direct location lookup ===")
        
        # Use generic reverse geocoding without type restriction
        fallback_params = {
            'lat': lat,
            'lon': lon,
            'format': 'json',
            'apiKey': GEOAPIFY_API_KEY
        }
        
        r_fallback = requests.get(GEOCODING_URL, params=fallback_params, timeout=30)
        r_fallback.raise_for_status()
        fallback_data = r_fallback.json()
        
        if 'results' in fallback_data and fallback_data['results']:
            location_info = fallback_data['results'][0]
            
            # Determine best name for the location
            location_name = None
            for key in ['name', 'city', 'county', 'state', 'country']:
                if key in location_info and location_info[key]:
                    location_name = location_info[key]
                    break
                    
            if not location_name:
                location_name = location_info.get('formatted', 'Unknown Location')
                
            print(f"Fallback found location: {location_name}")
            
            # Create a feature with the location information
            location_feature = {
                'type': 'Feature',
                'properties': {
                    'name': location_name,
                    'country': location_info.get('country'),
                    'state': location_info.get('state'),
                    'city': location_info.get('city'),
                    'formatted': location_info.get('formatted'),
                    '_enhanced': {
                        'best_name': location_name,
                        'admin_type': 'Location',
                        'found_via': 'geocoding_fallback'
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