const GeocodeCache = {
  geocode: new Map(),
  boundary: new Map(),
  stats: {
    geocoding: { hits: 0, misses: 0 },
    boundary: { hits: 0, misses: 0 }
  }
};

async function reverseGeocode(lat, lon) {
  const cacheKey = `${lat.toFixed(4)},${lon.toFixed(4)}`;
  
  if (GeocodeCache.geocode.has(cacheKey)) {
    GeocodeCache.stats.geocoding.hits++;
    return GeocodeCache.geocode.get(cacheKey);
  }
  
  GeocodeCache.stats.geocoding.misses++;
  
  const params = new URLSearchParams({
    lat: lat,
    lon: lon,
    format: 'json',
    zoom: 3,
    addressdetails: 1
  });
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), CONFIG.GEOCODING_TIMEOUT);
  
  try {
    const response = await fetch(`${CONFIG.NOMINATIM_URL}?${params}`, {
      signal: controller.signal,
      headers: {
        'User-Agent': CONFIG.USER_AGENT
      }
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    
    const data = await response.json();
    
    if (GeocodeCache.geocode.size >= CONFIG.MAX_CACHE_SIZE) {
      const firstKey = GeocodeCache.geocode.keys().next().value;
      GeocodeCache.geocode.delete(firstKey);
    }
    
    GeocodeCache.geocode.set(cacheKey, data);
    return data;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('Timeout');
    }
    throw error;
  }
}

async function getCountryBoundary(countryCode) {
  const cacheKey = countryCode.toLowerCase();
  
  if (GeocodeCache.boundary.has(cacheKey)) {
    GeocodeCache.stats.boundary.hits++;
    return GeocodeCache.boundary.get(cacheKey);
  }
  
  GeocodeCache.stats.boundary.misses++;
  
  const params = new URLSearchParams({
    country: countryCode.toLowerCase(),
    format: 'json',
    polygon_geojson: 1,
    limit: 1
  });
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), CONFIG.BOUNDARY_TIMEOUT);
  
  try {
    const response = await fetch(`${CONFIG.NOMINATIM_SEARCH_URL}?${params}`, {
      signal: controller.signal,
      headers: {
        'User-Agent': CONFIG.USER_AGENT
      }
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    
    const data = await response.json();
    
    if (data && data.length > 0 && data[0].geojson) {
      GeocodeCache.boundary.set(cacheKey, data[0]);
      return data[0];
    }
    
    return null;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('Timeout');
    }
    throw error;
  }
}

async function getCountryAtPoint(lat, lon) {
  const geoData = await reverseGeocode(lat, lon);
  
  if (!geoData || !geoData.address) {
    throw new Error('No location found');
  }
  
  const address = geoData.address;
  const countryName = address.country;
  const countryCode = address.country_code ? address.country_code.toUpperCase() : '';
  
  if (!countryCode || !countryName) {
    throw new Error('No country found');
  }
  
  const boundaryData = await getCountryBoundary(countryCode);
  
  if (!boundaryData || !boundaryData.geojson) {
    throw new Error('No boundary data found');
  }
  
  return {
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      properties: {
        name: countryName,
        country: countryName,
        country_code: countryCode,
        admin_level: 2,
        osm_id: boundaryData.osm_id,
        osm_type: boundaryData.osm_type,
        display_name: boundaryData.display_name,
        _enhanced: {
          best_name: countryName,
          admin_type: 'Country',
          found_via: 'nominatim_client'
        }
      },
      geometry: boundaryData.geojson
    }]
  };
}
