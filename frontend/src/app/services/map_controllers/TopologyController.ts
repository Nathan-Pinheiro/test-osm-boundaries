import { HttpClient } from "@angular/common/http";
import { MapController } from "../map_controllers/MapController";
import { AudioService } from "../audio.service";
import { ElevationService } from "../elevation.service";
import L from "leaflet";

export class TopologyController extends MapController {

  private elevationService: ElevationService;

  private isBeeping: boolean = false;

  constructor(map: L.Map,
    private audioService: AudioService,
    private http: HttpClient
  ) {
    super(map);
    this.elevationService = new ElevationService(this.http, 1, 1, 1);
    this.elevationService.initElevation(this.map.getZoom(), ...this.getTileBounds())
  }

  override refreshData(): void {
      this.elevationService.updateElevation(this.map.getZoom(), ...this.getTileBounds())
  }

  override onSimpleClick(lng: number, lat: number): void {
      this.audioService.speakCountry(`${this.elevationService.getElevation(lat, lng)} mêtres`);
  }

  override onPanStart(lng: number, lat: number): void {
    if (this.isBeeping || this.elevationService.minValue === null || this.elevationService.maxValue === null) return;
    this.isBeeping = true;

    this.audioService.startBeep(this.audioService.calculateFrequencyFromValue(
      this.elevationService.getElevation(lat, lng),
      this.elevationService.minValue,
      this.elevationService.maxValue
    ))
  }

  override onSimplePanMove(lng: number, lat: number): void {
    if (!this.isBeeping || this.elevationService.minValue === null || this.elevationService.maxValue === null) return;

    this.audioService.updateBeepFrequency(this.audioService.calculateFrequencyFromValue(
      this.elevationService.getElevation(lat, lng),
      this.elevationService.minValue,
      this.elevationService.maxValue
    ))
  }

  override onPanStop(lng: number, lat: number): void {
    if (!this.isBeeping) return;
    this.isBeeping = false;

    this.audioService.stopBeep()
    this.audioService.speakCountry(`${this.elevationService.getElevation(lat, lng)} mêtres`);
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

  override getName(): string 
    {
        return "Altitude"
    }   
}