import { CONFIG } from './config.js';

interface Address {
  country?: string;
  country_code?: string;
  state?: string;
  county?: string;
  city?: string;
  [key: string]: string | undefined;
}

interface NominatimResponse {
  address?: Address;
  osm_id?: number;
  osm_type?: string;
  display_name?: string;
  [key: string]: any;
}

interface GeoJSON {
  type: string;
  coordinates?: any;
  geometries?: GeoJSON[];
}

interface BoundaryData {
  geojson: GeoJSON;
  osm_id?: number;
  osm_type?: string;
  display_name?: string;
}

interface CacheStats {
  hits: number;
  misses: number;
}

interface GeocodeCache {
  geocode: Map<string, NominatimResponse>;
  boundary: Map<string, BoundaryData>;
  stats: {
    geocoding: CacheStats;
    boundary: CacheStats;
  };
}

export interface FeatureProperties {
  name: string;
  country: string;
  country_code: string;
  admin_level: number;
  osm_id?: number;
  osm_type?: string;
  display_name?: string;
  state?: string;
  county?: string;
  city?: string;
  _enhanced: {
    best_name: string;
    admin_type: string;
    found_via: string;
  };
}

interface Feature {
  type: 'Feature';
  properties: FeatureProperties;
  geometry: GeoJSON;
}

interface FeatureCollection {
  type: 'FeatureCollection';
  features: Feature[];
}

const GeocodeCache: GeocodeCache = {
  geocode: new Map<string, NominatimResponse>(),
  boundary: new Map<string, BoundaryData>(),
  stats: {
    geocoding: { hits: 0, misses: 0 },
    boundary: { hits: 0, misses: 0 }
  }
};

async function reverseGeocode(lat: number, lon: number): Promise<NominatimResponse> {
  const cacheKey = `${lat.toFixed(4)},${lon.toFixed(4)}`;
  
  if (GeocodeCache.geocode.has(cacheKey)) {
    GeocodeCache.stats.geocoding.hits++;
    console.log(`[GEOCODE CACHE HIT] ${cacheKey}`);
    return GeocodeCache.geocode.get(cacheKey)!;
  }
  
  GeocodeCache.stats.geocoding.misses++;
  
  const params = new URLSearchParams({
    lat: lat.toString(),
    lon: lon.toString(),
    format: 'json',
    zoom: '3',
    addressdetails: '1'
  });
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), CONFIG.GEOCODING_TIMEOUT);
  const startTime = performance.now();
  
  try {
    const response = await fetch(`${CONFIG.NOMINATIM_URL}?${params}`, {
      signal: controller.signal,
      headers: {
        'User-Agent': CONFIG.USER_AGENT
      }
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    
    const data: NominatimResponse = await response.json();
    const duration = (performance.now() - startTime).toFixed(2);
    console.log(`[GEOCODE] ${lat.toFixed(4)}, ${lon.toFixed(4)} → ${data.address?.country || 'Unknown'} (${duration}ms)`);
    
    if (GeocodeCache.geocode.size >= CONFIG.MAX_CACHE_SIZE) {
      const firstKey = GeocodeCache.geocode.keys().next().value;
      if (firstKey) GeocodeCache.geocode.delete(firstKey);
    }
    
    GeocodeCache.geocode.set(cacheKey, data);
    return data;
  } catch (error) {
    clearTimeout(timeoutId);
    const duration = (performance.now() - startTime).toFixed(2);
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[GEOCODE ERROR] ${lat.toFixed(4)}, ${lon.toFixed(4)} (${duration}ms):`, errorMessage);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Timeout');
    }
    throw error;
  }
}

function countGeometryPoints(geometry: GeoJSON | null | undefined): number {
  if (!geometry) return 0;
  
  let count = 0;
  
  if (geometry.type === 'Point') {
    return 1;
  } else if (geometry.type === 'LineString') {
    return geometry.coordinates.length;
  } else if (geometry.type === 'Polygon') {
    geometry.coordinates.forEach((ring: any) => {
      count += ring.length;
    });
  } else if (geometry.type === 'MultiPolygon') {
    geometry.coordinates.forEach((polygon: any) => {
      polygon.forEach((ring: any) => {
        count += ring.length;
      });
    });
  } else if (geometry.type === 'MultiLineString') {
    geometry.coordinates.forEach((line: any) => {
      count += line.length;
    });
  } else if (geometry.type === 'MultiPoint') {
    return geometry.coordinates.length;
  } else if (geometry.type === 'GeometryCollection' && geometry.geometries) {
    geometry.geometries.forEach((geom: GeoJSON) => {
      count += countGeometryPoints(geom);
    });
  }
  
  return count;
}

async function getCountryBoundary(countryCode: string): Promise<BoundaryData | null> {
  const cacheKey = countryCode.toLowerCase();
  
  if (GeocodeCache.boundary.has(cacheKey)) {
    GeocodeCache.stats.boundary.hits++;
    const cached = GeocodeCache.boundary.get(cacheKey)!;
    console.log(`[BOUNDARY CACHE HIT] ${countryCode}: ${countGeometryPoints(cached.geojson)} points`);
    return cached;
  }
  
  GeocodeCache.stats.boundary.misses++;
  
  const params = new URLSearchParams({
    country: countryCode.toLowerCase(),
    format: 'json',
    polygon_geojson: '1',
    limit: '1'
  });
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), CONFIG.BOUNDARY_TIMEOUT);
  const startTime = performance.now();
  
  try {
    const response = await fetch(`${CONFIG.NOMINATIM_SEARCH_URL}?${params}`, {
      signal: controller.signal,
      headers: {
        'User-Agent': CONFIG.USER_AGENT
      }
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    
    const data: BoundaryData[] = await response.json();
    
    if (data && data.length > 0 && data[0].geojson) {
      const pointCount = countGeometryPoints(data[0].geojson);
      const duration = (performance.now() - startTime).toFixed(2);
      console.log(`[BOUNDARY FETCHED] ${countryCode}: ${pointCount} points (${data[0].geojson.type}) in ${duration}ms`);
      GeocodeCache.boundary.set(cacheKey, data[0]);
      return data[0];
    }
    
    return null;
  } catch (error) {
    clearTimeout(timeoutId);
    const duration = (performance.now() - startTime).toFixed(2);
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[BOUNDARY ERROR] ${countryCode} (${duration}ms):`, errorMessage);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Timeout');
    }
    throw error;
  }
}

export async function getCountryAtPoint(lat: number, lon: number): Promise<FeatureCollection> {
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

export { GeocodeCache };
