import { Injectable } from '@angular/core';

export interface Config {
  OPENMAPTILES_API_KEY: string;
  NOMINATIM_EMAIL: string;
  NOMINATIM_URL: string;
  NOMINATIM_SEARCH_URL: string;
  USER_AGENT: string;
  GEOCODING_TIMEOUT: number;
  BOUNDARY_TIMEOUT: number;
  MAX_CACHE_SIZE: number;
}

@Injectable({
  providedIn: 'root'
})
export class ConfigService {
  readonly config: Config = {
    OPENMAPTILES_API_KEY: '',
    NOMINATIM_EMAIL: 'user@example.com',
    NOMINATIM_URL: 'https://nominatim.openstreetmap.org/reverse',
    NOMINATIM_SEARCH_URL: 'https://nominatim.openstreetmap.org/search',
    USER_AGENT: 'TestFrontieresApp/1.0',
    GEOCODING_TIMEOUT: 5000,
    BOUNDARY_TIMEOUT: 8000,
    MAX_CACHE_SIZE: 100
  };
}
