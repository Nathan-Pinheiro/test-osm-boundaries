import { Component, AfterViewInit, OnDestroy, Inject, PLATFORM_ID, NgZone } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import * as L from 'leaflet';
import { InteractionService } from '../services/interaction.service';
import { ConfigService } from '../services/config.service';
import { GeocodingService, FeatureCollection } from '../services/geocoding.service';
import { AudioService } from '../services/audio.service';
import { GeometryService } from '../services/geometry.service';
import { SpatialAudioService } from '../services/spatial-audio.service';
import { MapInfoComponent } from './components/map-info/map-info.component';
import { MapDragHandler } from './handlers/map-drag-handler';

@Component({
  selector: 'app-map',
  standalone: true,
  imports: [CommonModule, MapInfoComponent],
  templateUrl: './map.component.html',
  styleUrls: ['./map.component.css']
})
export class MapComponent implements AfterViewInit, OnDestroy {
  private map: L.Map | undefined;
  private currentCountryLayer: L.Layer | null = null;
  private currentMarker: L.Marker | null = null;
  private dragHandler: MapDragHandler | null = null;

  // UI State
  infoState = {
    visible: false,
    loading: false,
    error: false,
    errorMessage: '',
    locationName: '',
    details: [] as string[],
    lat: 0,
    lng: 0
  };

  constructor(
    private configService: ConfigService,
    private geocodingService: GeocodingService,
    private audioService: AudioService,
    private geometryService: GeometryService,
    private spatialAudioService: SpatialAudioService,
    private interactionService: InteractionService,
    private ngZone: NgZone,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  ngAfterViewInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      // Fix Leaflet's default icon paths
      const iconRetinaUrl = '/marker-icon-2x.png';
      const iconUrl = '/marker-icon.png';
      const shadowUrl = '/marker-shadow.png';
      const iconDefault = L.icon({
        iconRetinaUrl,
        iconUrl,
        shadowUrl,
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        tooltipAnchor: [16, -28],
        shadowSize: [41, 41]
      });
      L.Marker.prototype.options.icon = iconDefault;
      
      this.initMap();
    }
  }

  ngOnDestroy(): void {
    if (this.map) {
      this.map.remove();
    }
    this.interactionService.destroy();
    if (this.dragHandler) {
      this.dragHandler.destroy();
    }
  }

  private initMap(): void {
    const initialView: [number, number] = [46, 2];
    const initialZoom = 5;
    
    this.map = L.map('map', {
      dragging: false,
      touchZoom: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      boxZoom: false,
      keyboard: false,
      zoomControl: false
    }).setView(initialView, initialZoom);

    this.dragHandler = new MapDragHandler(
      this.geocodingService,
      this.audioService,
      this.geometryService,
      this.spatialAudioService,
      (point) => this.getLatLngFromPoint(point)
    );
    
    const mapContainer = document.getElementById('map');
    if (mapContainer) {
      this.interactionService.init(mapContainer, {
        onTap: (center) => {
          this.ngZone.run(() => {
            this.handleTap(center);
          });
        },
        onDown: (center, fingers) => {
          this.ngZone.run(() => {
            if (fingers === 1 && this.dragHandler) this.dragHandler.handlePanStart(center);
          });
        },
        onMove: (center, fingers) => {
          this.ngZone.run(() => {
            if (fingers === 1 && this.dragHandler) this.dragHandler.handlePanMove(center);
          });
        },
        onUp: (center, fingers) => {
          this.ngZone.run(() => {
            if (fingers === 1 && this.dragHandler) this.dragHandler.handlePanEnd(center);
          });
        },
        onDoubleTap: (center) => {
          this.ngZone.run(() => {
            console.log('Double tap');
            if (this.map) this.map.zoomIn();
          });
        },
        onTwoFingerTap: (center) => {
          this.ngZone.run(() => {
            console.log('Two finger tap');
            if (this.map) this.map.zoomOut();
          });
        },
        onThreeFingerDoubleTap: (center) => {
          this.ngZone.run(() => {
            console.log('Three finger double tap');
          });
        },
        onThreeFingerTap: (center) => {
          this.ngZone.run(() => {
            console.log('Three finger tap');
          });
        },
        onFourFingerTap: (center) => {
          this.ngZone.run(() => {
            console.log('Four finger tap');
          });
        },
        onPinch: (delta, scale, center) => {
          this.ngZone.run(() => {
            console.log('Pinch delta : ' + delta + ', scale : ' + scale + ', center : ' + center);
          });
        }
      });
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
    
    if (this.configService.config.OPENMAPTILES_API_KEY) basemaps['OpenMapTiles (Streets)'].addTo(this.map);
    else basemaps['OpenStreetMap'].addTo(this.map);
    
    L.control.layers(basemaps, {}, {position: 'topright'}).addTo(this.map);
  }

  private getLatLngFromPoint(point: {x: number, y: number}): L.LatLng | null {
    if (!this.map) return null;
    
    const container = this.map.getContainer();
    const rect = container.getBoundingClientRect();
    
    // Calculate position relative to map container
    const x = point.x - rect.left;
    const y = point.y - rect.top;
    
    return this.map.containerPointToLatLng(L.point(x, y));
  }



  private async handleTap(point: {x: number, y: number}): Promise<void> {
    if (!this.map) return;

    if (this.currentMarker) this.map.removeLayer(this.currentMarker);
    if (this.currentCountryLayer) this.map.removeLayer(this.currentCountryLayer);
    
    const latlng = this.getLatLngFromPoint(point);
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
    this.infoState.visible = true;
    this.infoState.loading = true;
    this.infoState.error = false;
  }

  private showInfo(locationName: string, details: string[], lat: number, lng: number): void {
    this.infoState.visible = true;
    this.infoState.loading = false;
    this.infoState.error = false;
    this.infoState.locationName = locationName;
    this.infoState.details = details;
    this.infoState.lat = lat;
    this.infoState.lng = lng;
  }

  private showError(message: string): void {
    this.infoState.visible = true;
    this.infoState.loading = false;
    this.infoState.error = true;
    this.infoState.errorMessage = message;
  }
}
