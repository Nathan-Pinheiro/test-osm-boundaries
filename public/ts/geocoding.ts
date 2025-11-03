import { CONFIG } from './config.js';

// Types pour le fichier countries.geojson
interface CountryGeoJSONProperties {
  name: string;
  'ISO3166-1-Alpha-2': string;
  'ISO3166-1-Alpha-3': string;
}

interface GeoJSON {
  type: string;
  coordinates?: any;
  geometries?: GeoJSON[];
}

interface CountryFeature {
  type: 'Feature';
  properties: CountryGeoJSONProperties;
  geometry: GeoJSON;
}

interface CountriesGeoJSON {
  type: 'FeatureCollection';
  features: CountryFeature[];
}

// Types pour l'export
export interface FeatureProperties {
  name: string;
  country: string;
  country_code: string;
  admin_level: number;
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

// Cache
interface CacheStats {
  hits: number;
  misses: number;
}

interface GeocodeCache {
  countriesData: CountriesGeoJSON | null;
  pointLookup: Map<string, string>;
  stats: {
    lookup: CacheStats;
    geojsonLoad: CacheStats;
  };
}

export const GeocodeCache: GeocodeCache = {
  countriesData: null,
  pointLookup: new Map<string, string>(),
  stats: {
    lookup: { hits: 0, misses: 0 },
    geojsonLoad: { hits: 0, misses: 0 }
  }
};

// Chargement du GeoJSON
async function loadCountriesGeoJSON(): Promise<CountriesGeoJSON> {
  if (GeocodeCache.countriesData) {
    GeocodeCache.stats.geojsonLoad.hits++;
    console.log('[GEOJSON CACHE HIT] Countries data already loaded');
    return GeocodeCache.countriesData;
  }

  GeocodeCache.stats.geojsonLoad.misses++;
  const startTime = performance.now();

  try {
    const response = await fetch('data/countries.geojson');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data: CountriesGeoJSON = await response.json();
    const duration = (performance.now() - startTime).toFixed(2);
    console.log(`[GEOJSON LOADED] ${data.features.length} countries in ${duration}ms`);

    GeocodeCache.countriesData = data;
    return data;
  } catch (error) {
    const duration = (performance.now() - startTime).toFixed(2);
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[GEOJSON ERROR] Failed to load countries (${duration}ms):`, errorMessage);
    throw error;
  }
}

// Algorithme Point-in-Polygon
function pointInPolygon(point: [number, number], polygon: number[][][]): boolean {
  const [lon, lat] = point;

  for (const ring of polygon) {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const xi = ring[i][0], yi = ring[i][1];
      const xj = ring[j][0], yj = ring[j][1];

      const intersect = ((yi > lat) !== (yj > lat))
        && (lon < (xj - xi) * (lat - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    if (inside) return true;
  }
  return false;
}

function pointInMultiPolygon(point: [number, number], multiPolygon: number[][][][]): boolean {
  for (const polygon of multiPolygon) {
    if (pointInPolygon(point, polygon)) return true;
  }
  return false;
}

function pointInGeometry(lat: number, lon: number, geometry: GeoJSON): boolean {
  const point: [number, number] = [lon, lat];

  if (geometry.type === 'Polygon') {
    return pointInPolygon(point, geometry.coordinates);
  } else if (geometry.type === 'MultiPolygon') {
    return pointInMultiPolygon(point, geometry.coordinates);
  }

  return false;
}

// Recherche de pays
async function findCountryAtPoint(lat: number, lon: number): Promise<CountryFeature | null> {
  const cacheKey = `${lat.toFixed(4)},${lon.toFixed(4)}`;

  // Vérifier le cache
  if (GeocodeCache.pointLookup.has(cacheKey)) {
    GeocodeCache.stats.lookup.hits++;
    const countryCode = GeocodeCache.pointLookup.get(cacheKey)!;
    console.log(`[LOOKUP CACHE HIT] ${cacheKey} → ${countryCode}`);

    const countriesData = await loadCountriesGeoJSON();
    const country = countriesData.features.find(f => 
      f.properties['ISO3166-1-Alpha-2'] === countryCode
    );
    return country || null;
  }

  GeocodeCache.stats.lookup.misses++;
  const startTime = performance.now();

  // Charger les données
  const countriesData = await loadCountriesGeoJSON();

  // Rechercher le pays
  for (const feature of countriesData.features) {
    if (pointInGeometry(lat, lon, feature.geometry)) {
      const duration = (performance.now() - startTime).toFixed(2);
      const countryCode = feature.properties['ISO3166-1-Alpha-2'];
      const countryName = feature.properties.name;
      console.log(`[COUNTRY FOUND] ${cacheKey} → ${countryName} (${countryCode}) in ${duration}ms`);

      // Mettre en cache
      if (GeocodeCache.pointLookup.size >= CONFIG.MAX_CACHE_SIZE) {
        const firstKey = GeocodeCache.pointLookup.keys().next().value;
        if (firstKey) GeocodeCache.pointLookup.delete(firstKey);
      }
      GeocodeCache.pointLookup.set(cacheKey, countryCode);

      return feature;
    }
  }

  const duration = (performance.now() - startTime).toFixed(2);
  console.log(`[NO COUNTRY FOUND] ${cacheKey} in ${duration}ms`);
  return null;
}

// Export principal
export async function getCountryAtPoint(lat: number, lon: number): Promise<FeatureCollection> {
  const country = await findCountryAtPoint(lat, lon);

  if (!country) {
    throw new Error('No country found at this location');
  }

  const countryName = country.properties.name;
  const countryCode = country.properties['ISO3166-1-Alpha-2'];

  return {
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      properties: {
        name: countryName,
        country: countryName,
        country_code: countryCode,
        admin_level: 2,
        _enhanced: {
          best_name: countryName,
          admin_type: 'Country',
          found_via: 'local_geojson'
        }
      },
      geometry: country.geometry
    }]
  };
}
