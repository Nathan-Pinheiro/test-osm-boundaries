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

    override refreshData(): void 
    {
        // console.log('[TestingController] refreshData() called');
    }

    override async onSimpleClick(lng: number, lat: number): Promise<void> 
    {
        const countryFeature = await this.geocodingService.getCountryAtPoint(lng, lat);
        const countryName = countryFeature.features[0]?.properties?.name || 'Unknown';
        this.audioService.speakCountry(countryName);
    }
    
    override onLongClick(lng: number, lat: number): void 
    {
        // console.log('[TestingController] Long Click detected');
    }
    
    override onDoubleClick(lng: number, lat: number): void 
    {
        // console.log('[TestingController] Double Click detected');
    }
    
    override async onSimplePanStart(lng: number, lat: number): Promise<void> 
    {
        const countryFeature = await this.geocodingService.getCountryAtPoint(lng, lat);
        const countryName = countryFeature.features[0]?.properties?.name || 'Unknown';

        this.currentCountry = countryName;  

        console.log(countryName);
        this.audioService.speakCountry(countryName);

        this.currentBorders = await this.geocodingService.getCountryBordersByName(countryName) as GeoJSON<Geometry, GeoJsonProperties> | null;
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
        
        console.log('Coordinates:', coordinates ? `${coordinates.length} rings` : 'null');
        console.log('First ring sample:', coordinates?.[0]?.[0]);
        
        const isInCurrentCountry = coordinates != null && this.geometryService.isPointInPolygon(lat, lng, coordinates);
        
        console.log(`Point (lat:${lat}, lng:${lng}) in ${this.currentCountry}:`, isInCurrentCountry);
        
        if(!isInCurrentCountry)
        {
            const countryFeature = await this.geocodingService.getCountryAtPoint(lng, lat);
            const countryName = countryFeature.features[0]?.properties?.name || 'Unknown';

            if(countryName !== this.currentCountry) {
                this.currentCountry = countryName;
                console.log('Changed to:', countryName);
                // this.audioService.speakCountry(countryName);

                this.currentBorders = await this.geocodingService.getCountryBordersByName(countryName) as Geometry | null;
            }
        }
        else
        {
            // UPDATE SOUND FREQUENCY
        }
    }

    override onSimplePanStop(lng: number, lat: number): void 
    {
        this.audioService.stopBeep();
    }

    override onDoublePanMove(): void 
    {
        console.log('[TestingController] Double Pan Move detected');
    }
    
    override onPinch(): void 
    {
        console.log('[TestingController] Pinch detected');
    }
    
    override onSwipe(): void 
    {
        console.log('[TestingController] Swipe detected');
    }
}