import { Component, AfterViewInit, OnDestroy, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import * as L from 'leaflet';
import Hammer from 'hammerjs';
import { ConfigService } from '../services/config.service';
import { DataService } from '../services/data.service';
import { AudioService } from '../services/audio.service';

@Component({
  selector: 'app-rando',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './rando.component.html',
  styleUrls: ['./rando.component.css']
})
export class RandoComponent implements AfterViewInit, OnDestroy {
  private map: L.Map | undefined;
  private hammer: HammerManager | null = null;
  
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
    const initialView: [number, number] = [45.185198, 6.480861];
    const initialZoom = 12; // Zoomed in for trails
    
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
    fetch('data/reseau-2000-rando.geojson')
      .then(r => r.json())
      .then(data => {
        if (this.map) {
          L.geoJSON(data, {
            style: {
              color: "blue",
              weight: 2
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
    this.checkRando(latlng.lat, latlng.lng);
  }

  private async handlePan(e: HammerInput): Promise<void> {
    const latlng = this.getLatLngFromHammerEvent(e);
    if (!latlng) return;
    this.checkRando(latlng.lat, latlng.lng);
  }

  private async checkRando(lat: number, lng: number) {
    const feature = await this.dataService.getRandoAtPoint(lat, lng);
    if (feature) {
      const p = feature.properties;
      const name = p.nom_itineraire || "Itinéraire inconnu";
      
      if (this.locationName !== name) {
        this.locationName = name;
        this.details = [
            `Pratique: ${p.pratique || "?"}`,
            `Type: ${p.type_itinéraire || "?"}`,
            `Gestion: ${p.gestion || "?"}`
        ];
        this.infoVisible = true;
        this.audioService.speakCountry(name);
      }
    }
  }
}
