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
    onSimpleClick(lng: number, lat: number): void {}
    onLongClick(lng: number, lat: number): void {}
    onDoubleClick(lng: number, lat: number): void {}
    onSimplePanStart(lng: number, lat: number): void {}
    onSimplePanMove(lng: number, lat: number): void {}
    onSimplePanStop(lng: number, lat: number): void {}
    onDoublePanStart(): void {}
    onDoublePanMove(): void {}
    onDoublePanStop(): void {}
    onPinch(): void {}
    onSwipe(): void {}
}