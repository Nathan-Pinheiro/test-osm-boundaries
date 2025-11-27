import geopandas as gpd
import json

def simplify_geojson(input_path: str, output_path: str, tolerance: float = 0.01):
    """
    Reads a GeoJSON file, simplifies the geometry of its features, and saves
    the result to a new GeoJSON file.

    Args:
        input_path (str): Path to the input GeoJSON file.
        output_path (str): Path where the simplified GeoJSON will be saved.
        tolerance (float): The maximum allowed distance between the original
                           and the simplified geometry (in the unit of the CRS,
                           e.g., degrees for WGS 84).
    """
    print(f"Reading GeoJSON from: {input_path}")

    # 1. Read the GeoJSON into a GeoDataFrame
    try:
        # geopandas handles reading the geojson file
        gdf = gpd.read_file(input_path)
    except Exception as e:
        print(f"Error reading GeoJSON: {e}")
        return

    print(f"Original number of features: {len(gdf)}")
    print(f"Simplifying geometries with tolerance: {tolerance}")

    # 2. Apply the simplify operation
    # The `simplify` method uses the Visvalingam-Whyatt algorithm by default,
    # or Douglas-Peucker if preserve_topology=False is set (which is usually best for simplification).
    # `copy=False` modifies the geometry column in place for performance.
    # Note: For preserving topology (avoiding gaps/overlaps between adjacent polygons),
    # a library like `topojson` is recommended, but for simple file reduction, this is fine.
    gdf['geometry'] = gdf['geometry'].simplify(tolerance, preserve_topology=True)

    print("Simplification complete.")

    # 3. Save the simplified GeoDataFrame back to a GeoJSON file
    try:
        # Ensure the GeoJSON driver is used and 'name' is preserved in properties
        gdf.to_file(output_path, driver='GeoJSON', encoding='utf-8')
        print(f"Successfully saved simplified GeoJSON to: {output_path}")
    except Exception as e:
        print(f"Error saving GeoJSON: {e}")

# --- Example Usage ---

# ⚠️ **Important:** Replace 'your_input.geojson' with the actual path to your file.
# Since you provided a GeoJSON snippet, I'll create a temporary mock file for the example.

# Create a mock GeoJSON file for demonstration purposes
mock_data = {
    "type": "FeatureCollection",
    "name": "ne_10m_admin_0_countries",
    "crs": { "type": "name", "properties": { "name": "urn:ogc:def:crs:OGC:1.3:CRS84" } },
    "features": [
        { "type": "Feature", "properties": { "name": "Indonesia", "ISO3166-1-Alpha-3": "IDN", "ISO3166-1-Alpha-2": "ID" }, "geometry": { "type": "MultiPolygon", "coordinates": [ [ [ [ 117.703608, 4.163415 ], [117.7, 4.2], [118.0, 4.1], [117.9, 4.15], [ 117.703608, 4.163415 ] ] ] ] } },
        { "type": "Feature", "properties": { "name": "Malaysia", "ISO3166-1-Alpha-3": "MYS", "ISO3166-1-Alpha-2": "MY" }, "geometry": { "type": "Polygon", "coordinates": [ [ [ 100.0, 5.0 ], [100.1, 5.2], [100.5, 5.0], [ 100.0, 5.0 ] ] ] } }
    ]
}

INPUT_FILE = "./countries.geojson"
OUTPUT_FILE = "./simplified_countries.geojson"
TOLERANCE = 0.05

# Save mock data to a file
with open(INPUT_FILE, 'w') as f:
    json.dump(mock_data, f)

# Run the simplification function
simplify_geojson(
    input_path=INPUT_FILE,
    output_path=OUTPUT_FILE,
    tolerance=TOLERANCE
)

# You can now delete the temporary files if you wish
# import os
# os.remove(INPUT_FILE)
# os.remove(OUTPUT_FILE)