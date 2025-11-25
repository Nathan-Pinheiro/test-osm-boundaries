import { Component, AfterViewInit, OnDestroy, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import * as L from 'leaflet';
import Hammer from 'hammerjs';
import { ConfigService } from '../services/config.service';
import { DataService } from '../services/data.service';
import { AudioService } from '../services/audio.service';

@Component({
  selector: 'app-parc',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './parc.component.html',
  styleUrls: ['./parc.component.css']
})
export class ParcComponent implements AfterViewInit, OnDestroy {
  private map: L.Map | undefined;
  private hammer: HammerManager | null = null;
  private currentLayer: L.Layer | null = null;
  
  infoVisible: boolean = false;
  locationName: string = '';
  details: string[] = [];

  constructor(
    private configService: ConfigService,
    private dataService: DataService,
    private audioService: AudioService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  ngAfterViewInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.initMap();
    }
  }

  ngOnDestroy(): void {
    if (this.map) this.map.remove();
    if (this.hammer) this.hammer.destroy();
  }

  private initMap(): void {
    const initialView: [number, number] = [46.5, 2];
    const initialZoom = 6;
    
    this.map = L.map('map', {
      dragging: false,
      touchZoom: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      boxZoom: false,
      keyboard: false,
      zoomControl: false
    }).setView(initialView, initialZoom);

    const basemaps = {
      'OpenStreetMap': L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19
      })
    };
    basemaps['OpenStreetMap'].addTo(this.map);

    // Load PNR data for visualization
    // We can load it via DataService or just fetch it again for display
    // Since DataService caches it, we can use it.
    // But DataService returns raw JSON. Leaflet needs to parse it.
    // Let's just fetch it for display to keep it simple or expose a method in DataService to get all data.
    // For now, I'll just let the interaction handle the "discovery".
    // But usually we want to SEE the parcs too.
    // Let's add a method to DataService to get all data.
    // Or just fetch it here.
    
    // Initialize Hammer
    const mapContainer = document.getElementById('map');
    if (mapContainer) {
      this.hammer = new Hammer(mapContainer);
      this.hammer.get('pan').set({ direction: Hammer.DIRECTION_ALL });
      
      this.hammer.on('tap', (e) => this.handleTap(e));
      this.hammer.on('panstart', (e) => this.handlePan(e));
      this.hammer.on('panmove', (e) => this.handlePan(e));
    }
    
    // Display the layer
    fetch('data/PNR.geojson')
      .then(r => r.json())
      .then(data => {
        if (this.map) {
          L.geoJSON(data, {
            style: {
              color: "green",
              weight: 2,
              fillOpacity: 0.3
            }
          }).addTo(this.map);
        }
      });
  }

  private getLatLngFromHammerEvent(e: HammerInput): L.LatLng | null {
    if (!this.map) return null;
    const container = this.map.getContainer();
    const rect = container.getBoundingClientRect();
    const x = e.center.x - rect.left;
    const y = e.center.y - rect.top;
    return this.map.containerPointToLatLng(L.point(x, y));
  }

  private async handleTap(e: HammerInput): Promise<void> {
    const latlng = this.getLatLngFromHammerEvent(e);
    if (!latlng) return;
    this.checkParc(latlng.lat, latlng.lng);
  }

  private async handlePan(e: HammerInput): Promise<void> {
    const latlng = this.getLatLngFromHammerEvent(e);
    if (!latlng) return;
    // Debounce or throttle could be good here, but for now direct call
    this.checkParc(latlng.lat, latlng.lng);
  }

  private async checkParc(lat: number, lng: number) {
    const feature = await this.dataService.getParcAtPoint(lat, lng);
    if (feature) {
      const name = feature.properties.DRGP_L_LIB || 'Parc inconnu';
      if (this.locationName !== name) {
        this.locationName = name;
        this.infoVisible = true;
        this.audioService.speakCountry(name); // Reusing speakCountry for generic text
      }
    } else {
      // Optional: clear info or say "Rien"
      // this.infoVisible = false;
      // this.locationName = '';
    }
  }
}
