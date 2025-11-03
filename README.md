# Test Frontières

Pure client-side application to identify countries and display their boundaries on a map.

## Features

- Click anywhere on the map to identify the country
- Display country boundaries with GeoJSON data
- Client-side caching for better performance
- Statistics panel to monitor cache efficiency
- Speech synthesis to announce locations
- Multiple map layers (OpenStreetMap, OpenMapTiles)

## Quick Start

1. Edit `static/config.js` and add your MapTiler API key (optional)
2. Serve the static folder with any HTTP server:
   ```powershell
   cd static
   python -m http.server 8000
   ```
3. Open http://localhost:8000 in your browser

## Alternative Servers

Node.js:
```bash
npx http-server static -p 8000
```

Python 3:
```bash
cd static && python -m http.server 8000
```

VS Code: Install "Live Server" extension and right-click `index.html`

## Configuration

Edit `static/config.js`:
- `OPENMAPTILES_API_KEY`: Your MapTiler key for premium tiles
- `NOMINATIM_EMAIL`: Contact email (required by Nominatim)
- `GEOCODING_TIMEOUT`: Timeout for geocoding requests (ms)
- `BOUNDARY_TIMEOUT`: Timeout for boundary requests (ms)
- `MAX_CACHE_SIZE`: Maximum cache entries

## Structure

```
static/
 index.html      # Main HTML structure
 styles.css      # All styles
 config.js       # Configuration
 geocoding.js    # Nominatim API + caching
 stats.js        # Statistics panel
 ui.js           # UI helpers
 map.js          # Map initialization + click handler
```

## APIs Used

- Nominatim: Reverse geocoding and boundary data
- Leaflet: Interactive map library
- MapTiler/OpenMapTiles: Optional premium map tiles
