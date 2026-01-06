import * as L from 'leaflet';
import { MapController } from './MapController';

export class TestingController extends MapController {
    /**
     * A testing controller that prints interaction events to the console
     */

    constructor(map: L.Map) {
        super(map);
        console.log(`[TestingController] Initialized`);
    }

    override refreshData(): void {
        console.log(`[TestingController] refreshData() called`);
    }

    override onSimpleClick(lng: number, lat: number): void 
    {
        console.log(`[TestingController] Simple Click detected - Position: [${lat}, ${lng}]`);
    }
    
    override onLongClick(lng: number, lat: number): void {
        console.log(`[TestingController] Long Click detected - Position: [${lat}, ${lng}]`);
    }
    
    override onDoubleClick(lng: number, lat: number): void 
    {
        console.log(`[TestingController] Double Click detected - Position: [${lat}, ${lng}]`);
    }

    override onDoubleClickLongFirst(lng: number, lat: number): void 
    {
        console.log(`[TestingController] Double Click long first - Position: [${lat}, ${lng}]`);
    }

    override onDoubleClickLongLast(lng: number, lat: number): void 
    {
        console.log(`[TestingController] Double Click long last - Position: [${lat}, ${lng}]`);
    }

    override onPanStart(lng: number, lat: number): void {
        console.log(`[TestingController] Pan start detected - Position: [${lng}, ${lat}]`);
    }

    override onSimplePanMove(lng: number, lat: number): void 
    {
        console.log(`[TestingController] Simple Pan Move - Position: [${lat}, ${lng}]`);
    }
    
    override onDoublePanMove(lng: number, lat: number): void {
        console.log(`[TestingController] Double Pan Move detected - Position: [${lat}, ${lng}]`);
    }

    override onPanStop(lng: number, lat: number): void {
        console.log(`[TestingController] Pan stop detected - Position: [${lat}, ${lng}]`);
    }
    
    override onPinch(scale: number): void {
        console.log(`[TestingController] Pinch detected - Scale: ${scale}`);
    }
    
    override onSwipeUp(): void {
        console.log(`[TestingController] Swipe up detected`);
    }

    override onSwipeDown(): void {
        console.log(`[TestingController] Swipe down detected`);
    }

    override onSwipeRight(): void {
        console.log(`[TestingController] Swipe right detected`);
    }

    override onSwipeLeft(): void {
        console.log(`[TestingController] Swipe left detected`);
    }

    override onPointerDelete(): void 
    {
        console.log(`[TestingController] Pointer delete`);
    }
}