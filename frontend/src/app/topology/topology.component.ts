import { AfterViewInit, Component, Inject, inject, OnDestroy, PLATFORM_ID } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import * as L from 'leaflet';
import Hammer from 'hammerjs';
import { ConfigService } from '../services/config.service';
import { DataService } from '../services/data.service';
import { AudioService } from '../services/audio.service';
import { ElevationService } from '../services/elevation.service';

@Component({
  selector: 'app-topology',
  imports: [ CommonModule],
  templateUrl: './topology.component.html',
  styleUrl: './topology.component.css',
})
export class TopologyComponent implements AfterViewInit, OnDestroy{

  private http: HttpClient = inject(HttpClient);
  private elevationService: ElevationService;

  private map: L.Map | undefined;
  private hammer: HammerManager | null = null;

  private isDragging: boolean = false;

  constructor(
    private audioService: AudioService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    this.elevationService = new ElevationService(this.http, 1, 1, 1);
  }
  ngOnDestroy(): void {
    if (this.map) this.map.remove();
    if (this.hammer) this.hammer.destroy();
  }
  ngAfterViewInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      console.log('Initializing map');
      this.initMap();
    }
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
      zoomControl: false,
    }).setView(initialView, initialZoom);

    const basemaps = {
      'OpenStreetMap': L.tileLayer('https://cartodb-basemaps-{s}.global.ssl.fastly.net/dark_all/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 15 // Limit max zoom to 15 to match elevation data
      })
    };
    basemaps['OpenStreetMap'].addTo(this.map);
    
    // Initialize Hammer
    const mapContainer = document.getElementById('map');
    if (mapContainer) {
      this.hammer = new Hammer(mapContainer);
      this.hammer.get('pan').set({ direction: Hammer.DIRECTION_ALL });
      
      this.hammer.on('tap', (e) => this.handleTap(e));
      this.hammer.on('panstart', (e) => this.handlePanStart(e));
      this.hammer.on('panmove', (e) => this.handlePanMove(e));
      this.hammer.on('panend', (e) => this.handlePanEnd(e));
    }
    // Initialize elevation service
    this.elevationService.initElevation(this.map.getZoom(), ...this.getTileBounds());
  }
  private getTileBounds(): [[number, number], [number, number]] {
    /**
     * Get the tile coordinates of the north-west and south-east corners of the current map view
     * @returns [[nwTileX, nwTileY], [seTileX, seTileY]]
     * @author mostly YaFred on stack overflow...
     */
    if (!this.map) throw new Error('Map not initialized');

    // get bounds, zoom and tileSize        
    var bounds = this.map.getPixelBounds();
    var zoom = this.map.getZoom();
    var tileSize = 256;  
    if (bounds.min === undefined || bounds.max === undefined) { // Typescript is shit sometimes
      throw new Error('Bounds are not defined');
    }
    if (this.map.options.crs === undefined || this.map.options.crs.scale === undefined) { // Like for real...
      throw new Error('CRS or scale function is not defined');
    }
    // get NorthWest and SouthEast points
    var nwTilePoint = new L.Point(Math.floor(bounds.min.x / tileSize),
        Math.floor(bounds.min.y / tileSize));

    var seTilePoint = new L.Point(Math.floor(bounds.max.x / tileSize),
        Math.floor(bounds.max.y / tileSize));

    // get max number of tiles in this zoom level
    var max = this.map.options.crs.scale(zoom) / tileSize; 

    return [
      [(nwTilePoint.x + max) % max, (nwTilePoint.y + max) % max],
      [(seTilePoint.x + max) % max, (seTilePoint.y + max) % max]
    ]
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
    if (!latlng || this.isDragging) return;

    this.audioService.speakCountry(`${this.elevationService.getElevation(latlng.lat, latlng.lng)} métres`);
  }

  private async handlePanStart(e: HammerInput): Promise<void> {
    if (this.isDragging) return;
    this.isDragging = true;

    const latlng = this.getLatLngFromHammerEvent(e);
    if (!latlng || this.elevationService.minValue === null || this.elevationService.maxValue === null) return;
    console.log('Pan start');
    this.audioService.startBeep(this.audioService.calculateFrequencyFromValue(
      this.elevationService.getElevation(latlng.lat, latlng.lng),
      this.elevationService.minValue,
      this.elevationService.maxValue
    ))
  }
  private async handlePanMove(e: HammerInput): Promise<void> {
    if (!this.isDragging) return;

    const latlng = this.getLatLngFromHammerEvent(e);
    if (!latlng || this.elevationService.minValue === null || this.elevationService.maxValue === null) return;
    console.log('panmove');
    this.audioService.updateBeepFrequency(this.audioService.calculateFrequencyFromValue(
      this.elevationService.getElevation(latlng.lat, latlng.lng),
      this.elevationService.minValue,
      this.elevationService.maxValue
    ))
  }
  private async handlePanEnd(e: HammerInput): Promise<void> {
    if (!this.isDragging) return;
    this.isDragging = false;
    const latlng = this.getLatLngFromHammerEvent(e);
    if (!latlng) return;

    this.audioService.stopBeep();
    this.audioService.speakCountry(`${this.elevationService.getElevation(latlng.lat, latlng.lng)} métres`);
  }
}