import * as L from 'leaflet';

export class MapController {
    /**
     * A template used by map "controllers", aka. classes that provide a specific
     * feature to the map by updating layers and/or handling given user interactions
     */

    map: L.Map;
    layers: L.Layer[] = [];

    constructor(map: L.Map) {
        /**
         * @param map the leaflet map object to bind to the controller
         */
        this.map = map;
    }
    refreshData(): void {
        /**
         * force the controller to update its data according to the current state of the map
         */
    }

    //[ Interactions methods ]//

    onPointerDown(lng: number, lat: number): void {}    // pointer-down
    onPointerUp(lng: number, lat: number): void {}      // pointer-up

    onLongClick(lng: number, lat: number): void {}      // pointer-press
    onSimpleClick(lng: number, lat: number): void {}    // pointer-single-tap
    onDoubleClick(lng: number, lat: number): void {}    // pointer-double-tap

    onDoubleClickLongLast(lng: number, lat: number): void {}      // pointer-double-tap-last-press
    onDoubleClickLongFirst(lng: number, lat: number): void {}    // pointer-double-tap-first-press

    onPointerDelete(): void {}  // pointer-delete

    onPanStart(lng: number, lat: number): void {}       // pan-start
    onSimplePanMove(lng: number, lat: number): void {}  // pan-move
    onDoublePanMove(lng: number, lat: number): void {}  // pan-move-double
    onPanStop(lng: number, lat: number): void {}        // pan-end

    onPinch(scale: number): void {}      // pinch

    onSwipeUp(): void {}    // swipe-up
    onSwipeDown(): void {}  // swipe-down
    onSwipeRight(): void {} // swipe-right
    onSwipeLeft(): void {}  // swipe-left
}