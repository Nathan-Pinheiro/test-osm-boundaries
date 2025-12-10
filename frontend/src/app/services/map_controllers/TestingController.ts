import * as L from 'leaflet';
import { MapController } from './MapController';

export class TestingController extends MapController {
    /**
     * A testing controller that prints interaction events to the console
     */

    constructor(map: L.Map) {
        super(map);
        console.log('[TestingController] Initialized');
    }

    override refreshData(): void {
        console.log('[TestingController] refreshData() called');
    }

    override onSimpleClick(): void {
        const center = this.map.getCenter();
        const zoom = this.map.getZoom();
        console.log(`Simple Click detected - Position: [${center.lat}, ${center.lng}], Zoom: ${zoom}`);
    }
    
    override onLongClick(): void {
        console.log('[TestingController] Long Click detected');
    }
    
    override onDoubleClick(): void {
        console.log('[TestingController] Double Click detected');
    }
    
    override onSimplePanMove(): void {
        console.log('[TestingController] Simple Pan Move detected');
    }
    
    override onDoublePanMove(): void {
        console.log('[TestingController] Double Pan Move detected');
    }
    
    override onPinch(): void {
        console.log('[TestingController] Pinch detected');
    }
    
    override onSwipe(): void {
        console.log('[TestingController] Swipe detected');
    }
}