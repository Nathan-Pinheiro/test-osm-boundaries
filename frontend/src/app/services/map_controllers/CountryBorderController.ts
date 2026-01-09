import * as L from 'leaflet';
import { MapController } from './MapController';
import { AudioService } from '../audio.service';
import { GeocodingService } from '../geocoding.service';
import { HttpClient } from '@angular/common/http';
import { ConfigService } from '../config.service';
import { GeometryService } from '../geometry.service';
import { GeoJSON, Geometry, GeoJsonProperties } from 'geojson';

export class CountryBorderController extends MapController {

    private currentCountry : string;
    private currentBorders: GeoJSON.GeoJSON | null;

    private geocodingService;

    constructor(
        map: L.Map, 
        private http: HttpClient, 
        private configService: ConfigService,
        private audioService: AudioService,
        private geometryService: GeometryService
    ) {
        super(map);
        this.geocodingService = new GeocodingService(this.http, this.configService);
        this.currentCountry = "";
        this.currentBorders = null;
    }

    private updateBeepSound(lat: number, lng: number) 
    {
        this.audioService.updateBeepFrequency(
            this.audioService.calculateFrequencyFromDistance(
                this.geometryService.calculateDistanceToBoundary(
                    lat, lng, this.currentBorders
                )
            )
        );
    }

    private async updateCountry(lat: number, lng: number) 
    {
        const countryFeature = await this.geocodingService.getCountryAtPoint(lat, lng);
        const countryName = countryFeature.features[0]?.properties?.name || 'Unknown';
        this.audioService.speakCountry(countryName);

        this.currentCountry = countryName;
        this.currentBorders = await this.geocodingService.getCountryBordersByName(countryName) as GeoJSON<Geometry, GeoJsonProperties> | null;
    }

    // ==========================
    // interactions
    // ==========================

    override async onSimpleClick(lng: number, lat: number): Promise<void> 
    {
        const countryFeature = await this.geocodingService.getCountryAtPoint(lat, lng);
        const countryName = countryFeature.features[0]?.properties?.name || 'Unknown';
        this.audioService.speakCountry(countryName);
    }
    
    override async onPanStart(lng: number, lat: number): Promise<void> 
    {
        this.updateCountry(lat, lng);
        this.audioService.startBeep();
        this.updateBeepSound(lat, lng);
    }

    override async onSimplePanMove(lng: number, lat: number): Promise<void> 
    {
        if(!this.currentCountry || !this.currentBorders) return;
        
        let coordinates: any[] | null = null;
        const geometry = this.currentBorders as Geometry;
        
        if (geometry.type === 'Polygon') 
        {
            coordinates = (geometry as GeoJSON.Polygon).coordinates;
        } 
        else if (geometry.type === 'MultiPolygon') 
        {
            coordinates = (geometry as GeoJSON.MultiPolygon).coordinates[0];
        }
        
        const isInCurrentCountry = coordinates != null && this.geometryService.isPointInPolygon(lat, lng, coordinates);
        
        if(!isInCurrentCountry) this.updateCountry(lat, lng);
        this.updateBeepSound(lat, lng);
    }

    override onDoublePanMove(directionX: number, directionY: number): void 
    {
        const moveSensitivity = 0.5; 
        this.map.panBy([directionX * moveSensitivity, directionY * moveSensitivity], { animate: true });
    }

    override onPanStop(lng: number, lat: number): void 
    {
        this.audioService.stopBeep();
    }   
}