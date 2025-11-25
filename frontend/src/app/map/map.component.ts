import { Component, AfterViewInit, OnDestroy, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import * as L from 'leaflet';
import Hammer from 'hammerjs';
import { ConfigService } from '../services/config.service';
import { GeocodingService, FeatureCollection } from '../services/geocoding.service';
import { AudioService } from '../services/audio.service';
import { GeometryService } from '../services/geometry.service';

interface LeafletMouseEvent {
  latlng: L.LatLng;
  originalEvent: MouseEvent;
}

@Component({
  selector: 'app-map',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './map.component.html',
  styleUrls: ['./map.component.css']
})
export class MapComponent implements AfterViewInit, OnDestroy {
  private map: L.Map | undefined;
  private currentCountryLayer: L.Layer | null = null;
  private currentMarker: L.Marker | null = null;
  private hammer: HammerManager | null = null;

  // State for drag
  private isDragging: boolean = false;
  private currentCountryCode: string = '';
  private currentCountryGeometry: any = null;
  private dragInterval: any = null;
  private lastMousePosition: L.LatLng | null = null;

  // UI State
  infoVisible: boolean = false;
  loading: boolean = false;
  error: boolean = false;
  errorMessage: string = '';
  locationName: string = '';
  details: string[] = [];
  lat: number = 0;
  lng: number = 0;

  constructor(
    private configService: ConfigService,
    private geocodingService: GeocodingService,
    private audioService: AudioService,
    private geometryService: GeometryService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  ngAfterViewInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.initMap();
    }
  }

  ngOnDestroy(): void {
    if (this.map) {
      this.map.remove();
    }
    if (this.hammer) {
      this.hammer.destroy();
    }
    this.stopDistanceTracking();
  }

  private initMap(): void {
    const initialView: [number, number] = [46, 2];
    const initialZoom = 5;
    
    this.map = L.map('map', {
      dragging: false,        // Disable Leaflet dragging
      touchZoom: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      boxZoom: false,
      keyboard: false,
      zoomControl: false
    }).setView(initialView, initialZoom);
    
    // Initialize Hammer
    const mapContainer = document.getElementById('map');
    if (mapContainer) {
      this.hammer = new Hammer(mapContainer);
      
      // Configure Pan to detect all directions
      this.hammer.get('pan').set({ direction: Hammer.DIRECTION_ALL });
      
      // Bind events
      this.hammer.on('tap', (e) => this.handleTap(e));
      this.hammer.on('panstart', (e) => this.handlePanStart(e));
      this.hammer.on('panmove', (e) => this.handlePanMove(e));
      this.hammer.on('panend', (e) => this.handlePanEnd(e));
    }
    
    const basemaps: Record<string, L.TileLayer> = {
      'OpenMapTiles (Streets)': L.tileLayer('https://api.maptiler.com/maps/streets-v2/{z}/{x}/{y}.png?key={apikey}', {
        attribution: '<a href="https://www.maptiler.com/copyright/" target="_blank">&copy; MapTiler</a> <a href="https://www.openstreetmap.org/copyright" target="_blank">&copy; OpenStreetMap contributors</a>',
        // @ts-ignore
        apikey: this.configService.config.OPENMAPTILES_API_KEY,
        tileSize: 512,
        zoomOffset: -1,
        minZoom: 1,
        maxZoom: 19
      }),
      'OpenStreetMap': L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19
      }),
      'OpenMapTiles (Satellite)': L.tileLayer('https://api.maptiler.com/maps/hybrid/{z}/{x}/{y}.jpg?key={apikey}', {
        attribution: '<a href="https://www.maptiler.com/copyright/" target="_blank">&copy; MapTiler</a> <a href="https://www.openstreetmap.org/copyright" target="_blank">&copy; OpenStreetMap contributors</a>',
        // @ts-ignore
        apikey: this.configService.config.OPENMAPTILES_API_KEY,
        tileSize: 512,
        zoomOffset: -1,
        minZoom: 1,
        maxZoom: 19
      })
    };
    
    if (this.configService.config.OPENMAPTILES_API_KEY) {
      basemaps['OpenMapTiles (Streets)'].addTo(this.map);
    } else {
      basemaps['OpenStreetMap'].addTo(this.map);
    }
    
    L.control.layers(basemaps, {}, {position: 'topright'}).addTo(this.map);
  }

  private getLatLngFromHammerEvent(e: HammerInput): L.LatLng | null {
    if (!this.map) return null;
    
    const container = this.map.getContainer();
    const rect = container.getBoundingClientRect();
    
    // Calculate position relative to map container
    const x = e.center.x - rect.left;
    const y = e.center.y - rect.top;
    
    return this.map.containerPointToLatLng(L.point(x, y));
  }

  private async handlePanStart(e: HammerInput): Promise<void> {
    console.log("Pan start");
    this.isDragging = true;
    
    const latlng = this.getLatLngFromHammerEvent(e);
    if (!latlng) return;
    
    const lat = latlng.lat;
    const lng = latlng.lng;
    
    try {
      const data = await this.geocodingService.getCountryAtPoint(lat, lng);
      if (data.features && data.features.length > 0) {
        const country = data.features[0];
        const countryName = country.properties.name || country.properties.country;
        this.currentCountryCode = country.properties.country_code || '';
        this.currentCountryGeometry = country.geometry;
        
        this.audioService.speakCountry(countryName);
        console.log(`Starting drag in: ${countryName}`);
        
        setTimeout(() => {
          if (this.isDragging) {
            const initialDistance = this.geometryService.calculateDistanceToBoundary(lat, lng, this.currentCountryGeometry);
            const initialFrequency = this.audioService.calculateFrequencyFromDistance(initialDistance, 50);
            this.audioService.startBeep(initialFrequency);
            this.startDistanceTracking();
            console.log(`Beep started at ${initialFrequency.toFixed(0)} Hz`);
          }
        }, 600);
      }
    } catch (error) {
      console.error('Error getting country on drag start:', error);
    }
  }

  private startDistanceTracking(): void {
    if (this.dragInterval) return;
    
    this.dragInterval = window.setInterval(() => {
      if (!this.isDragging || !this.currentCountryGeometry || !this.lastMousePosition) return;
      
      const distance = this.geometryService.calculateDistanceToBoundary(
        this.lastMousePosition.lat,
        this.lastMousePosition.lng,
        this.currentCountryGeometry
      );
      
      const frequency = this.audioService.calculateFrequencyFromDistance(distance, 50);
      this.audioService.updateBeepFrequency(frequency);
      
      console.log(`Distance to boundary: ${distance.toFixed(2)} km, Frequency: ${frequency.toFixed(0)} Hz`);
    }, 100);
  }

  private stopDistanceTracking(): void {
    if (this.dragInterval) {
      clearInterval(this.dragInterval);
      this.dragInterval = null;
    }
  }

  private async handlePanMove(e: HammerInput): Promise<void> {
    if (!this.isDragging) return;
    
    const latlng = this.getLatLngFromHammerEvent(e);
    if (!latlng) return;
    
    this.lastMousePosition = latlng;
    
    const lat = latlng.lat;
    const lng = latlng.lng;
    
    try {
      const data = await this.geocodingService.getCountryAtPoint(lat, lng);
      if (data.features && data.features.length > 0) {
        const country = data.features[0];
        const newCountryCode = country.properties.country_code || '';
        
        if (newCountryCode !== this.currentCountryCode && this.currentCountryCode !== '') {
          const countryName = country.properties.name || country.properties.country;
          this.currentCountryCode = newCountryCode;
          this.currentCountryGeometry = country.geometry;
          
          this.audioService.speakCountry(countryName);
          console.log(`Country changed to: ${countryName}`);
        }
      }
    } catch (error) {
      // Ignore errors during drag
    }
  }

  private async handlePanEnd(e: HammerInput): Promise<void> {
    if (!this.isDragging) return;
    
    console.log("Pan end");
    this.isDragging = false;
    this.stopDistanceTracking();
    this.audioService.stopBeep();
    
    const latlng = this.getLatLngFromHammerEvent(e);
    
    if (latlng) {
      try {
        const data = await this.geocodingService.getCountryAtPoint(latlng.lat, latlng.lng);
        if (data.features && data.features.length > 0) {
          const country = data.features[0];
          const countryName = country.properties.name || country.properties.country;
          
          setTimeout(() => {
            this.audioService.speakCountry(countryName);
          }, 300);
        }
      } catch (error) {
        console.error('Error getting final country:', error);
      }
    }
    
    this.currentCountryCode = '';
    this.currentCountryGeometry = null;
    this.lastMousePosition = null;
  }

  private async handleTap(e: HammerInput): Promise<void> {
    if (!this.map) return;

    if (this.currentMarker) this.map.removeLayer(this.currentMarker);
    if (this.currentCountryLayer) this.map.removeLayer(this.currentCountryLayer);
    
    const latlng = this.getLatLngFromHammerEvent(e);
    if (!latlng) return;
    
    const lat = latlng.lat;
    const lng = latlng.lng;
    
    this.currentMarker = L.marker(latlng).addTo(this.map);
    
    this.showLoading();
    
    try {
      const data = await this.geocodingService.getCountryAtPoint(lat, lng);
      
      if (!data.features || data.features.length === 0) {
        this.showError('Aucun pays trouvé');
        this.currentMarker.bindTooltip("Aucun pays").openTooltip();
        return;
      }
      
      const country = data.features[0];
      const props = country.properties;
      const enhanced = props._enhanced || {};
      
      const locationName = enhanced.best_name || props.name || props.country || 'Lieu inconnu';
      const adminType = enhanced.admin_type || (props.admin_level ? `Niveau administratif ${props.admin_level}` : 'Lieu');
      const isCountry = adminType.includes('Country') || adminType.includes('Pays');
      
      if (data.features.length > 1) {
        this.currentCountryLayer = L.geoJSON(data as any, {
          style: () => ({
            color: '#2980b9',
            weight: 4,
            fillColor: '#3498db',
            fillOpacity: 0.2,
            dashArray: '0'
          }),
          onEachFeature: (feature: any, layer: any) => {
            if (feature.properties) {
              const p = feature.properties;
              const e = p._enhanced || {};
              const name = e.best_name || p.name || p.country || 'Unknown';
              const level = p.admin_level || 'Unknown';
              const type = e.admin_type || `Level ${level}`;
              
              let popupContent = `<b>${name}</b><br>Type: ${type}`;
              if (p.country_code) popupContent += `<br>Country Code: ${p.country_code}`;
              
              layer.bindPopup(popupContent);
            }
          }
        }).addTo(this.map);
      } else {
        this.currentCountryLayer = L.geoJSON(country as any, {
          style: {
            color: isCountry ? '#2980b9' : '#e67e22',
            weight: isCountry ? 4 : 3,
            fillColor: isCountry ? '#3498db' : '#f39c12',
            fillOpacity: 0.2,
            dashArray: isCountry ? '0' : '5, 5'
          },
          onEachFeature: (feature: any, layer: any) => {
            if (feature.properties) {
              const p = feature.properties;
              const e = p._enhanced || {};
              const name = e.best_name || p.name || p.country || 'Unknown';
              const level = p.admin_level || 'Unknown';
              const type = e.admin_type || `Level ${level}`;
              
              let popupContent = `<b>${name}</b><br>Type: ${type}`;
              if (p.country_code) popupContent += `<br>Country Code: ${p.country_code}`;
              
              layer.bindPopup(popupContent);
            }
          }
        }).addTo(this.map);
      }
      
      if (this.map.getZoom() > 6 && this.currentCountryLayer) {
        try {
          // @ts-ignore
          const bounds = this.currentCountryLayer.getBounds();
          if (bounds.isValid()) {
            this.map.flyToBounds(bounds, {
              padding: [50, 50],
              maxZoom: 8,
              duration: 1
            });
          }
        } catch(err) {
          console.warn('Cannot zoom to bounds:', err);
        }
      }
      
      const details: string[] = [];
      if (props.country && props.country !== locationName) 
        details.push(`Pays: ${props.country}`);
      if (props.state && props.state !== locationName) 
        details.push(`Région: ${props.state}`);
      if (props.county && props.county !== locationName) 
        details.push(`Département: ${props.county}`);
      if (props.city && props.city !== locationName) 
        details.push(`Ville: ${props.city}`);
      
      if (details.length === 0) {
        details.push(adminType);
      }
      
      this.showInfo(locationName, details, lat, lng);
      this.currentMarker.bindTooltip(locationName).openTooltip();
      
      this.audioService.speakCountry(locationName);
      
    } catch (error) {
      console.error('Error:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.showError(errorMessage);
    }
  }

  private showLoading(): void {
    this.infoVisible = true;
    this.loading = true;
    this.error = false;
  }

  private showInfo(locationName: string, details: string[], lat: number, lng: number): void {
    this.infoVisible = true;
    this.loading = false;
    this.error = false;
    this.locationName = locationName;
    this.details = details;
    this.lat = lat;
    this.lng = lng;
  }

  private showError(message: string): void {
    this.infoVisible = true;
    this.loading = false;
    this.error = true;
    this.errorMessage = message;
  }
}
