import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ConfigService } from './config.service';

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

export interface FeatureCollection {
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

@Injectable({
  providedIn: 'root'
})
export class GeocodingService {
  private cache: GeocodeCache = {
    countriesData: null,
    pointLookup: new Map<string, string>(),
    stats: {
      lookup: { hits: 0, misses: 0 },
      geojsonLoad: { hits: 0, misses: 0 }
    }
  };

  constructor(
    private http: HttpClient,
    private configService: ConfigService
  ) {}

  // Chargement du GeoJSON
  private async loadCountriesGeoJSON(): Promise<CountriesGeoJSON> {
    if (this.cache.countriesData) {
      this.cache.stats.geojsonLoad.hits++;
      console.log('[GEOJSON CACHE HIT] Countries data already loaded');
      return this.cache.countriesData;
    }

    this.cache.stats.geojsonLoad.misses++;
    const startTime = performance.now();

    try {
      // Assuming the data is in assets/data/countries.geojson or similar
      // The original code fetched 'data/countries.geojson'
      // In Angular, we should put this in 'public/data/countries.geojson' or 'src/assets/data/countries.geojson'
      // and fetch from there.
      const data = await firstValueFrom(this.http.get<CountriesGeoJSON>('data/countries.geojson'));
      
      const duration = (performance.now() - startTime).toFixed(2);
      console.log(`[GEOJSON LOADED] ${data.features.length} countries in ${duration}ms`);

      this.cache.countriesData = data;
      return data;
    } catch (error) {
      const duration = (performance.now() - startTime).toFixed(2);
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[GEOJSON ERROR] Failed to load countries (${duration}ms):`, errorMessage);
      throw error;
    }
  }

  // Algorithme Point-in-Polygon
  private pointInPolygon(point: [number, number], polygon: number[][][]): boolean {
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

  private pointInMultiPolygon(point: [number, number], multiPolygon: number[][][][]): boolean {
    for (const polygon of multiPolygon) {
      if (this.pointInPolygon(point, polygon)) return true;
    }
    return false;
  }

  private pointInGeometry(lat: number, lon: number, geometry: GeoJSON): boolean {
    const point: [number, number] = [lon, lat];

    if (geometry.type === 'Polygon') {
      return this.pointInPolygon(point, geometry.coordinates);
    } else if (geometry.type === 'MultiPolygon') {
      return this.pointInMultiPolygon(point, geometry.coordinates);
    }

    return false;
  }

  // Recherche de pays
  private async findCountryAtPoint(lat: number, lon: number): Promise<CountryFeature | null> {
    const cacheKey = `${lat.toFixed(4)},${lon.toFixed(4)}`;

    // Vérifier le cache
    if (this.cache.pointLookup.has(cacheKey)) {
      this.cache.stats.lookup.hits++;
      const countryCode = this.cache.pointLookup.get(cacheKey)!;
      console.log(`[LOOKUP CACHE HIT] ${cacheKey} → ${countryCode}`);

      const countriesData = await this.loadCountriesGeoJSON();
      const country = countriesData.features.find(f => 
        f.properties['ISO3166-1-Alpha-2'] === countryCode
      );
      return country || null;
    }

    this.cache.stats.lookup.misses++;
    const startTime = performance.now();

    // Charger les données
    const countriesData = await this.loadCountriesGeoJSON();

    // Rechercher le pays
    for (const feature of countriesData.features) {
      if (this.pointInGeometry(lat, lon, feature.geometry)) {
        const duration = (performance.now() - startTime).toFixed(2);
        const countryCode = feature.properties['ISO3166-1-Alpha-2'];
        const countryName = feature.properties.name;
        console.log(`[COUNTRY FOUND] ${cacheKey} → ${countryName} (${countryCode}) in ${duration}ms`);

        // Mettre en cache
        if (this.cache.pointLookup.size >= this.configService.config.MAX_CACHE_SIZE) {
          const firstKey = this.cache.pointLookup.keys().next().value;
          if (firstKey) this.cache.pointLookup.delete(firstKey);
        }
        this.cache.pointLookup.set(cacheKey, countryCode);

        return feature;
      }
    }

    const duration = (performance.now() - startTime).toFixed(2);
    console.log(`[NO COUNTRY FOUND] ${cacheKey} in ${duration}ms`);
    return null;
  }

  // Export principal
  async getCountryAtPoint(lat: number, lon: number): Promise<FeatureCollection> {
    const country = await this.findCountryAtPoint(lat, lon);

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
}
