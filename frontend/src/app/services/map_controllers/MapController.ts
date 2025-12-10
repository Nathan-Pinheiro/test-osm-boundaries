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
    onSimpleClick(): void {}
    onLongClick(): void {}
    onDoubleClick(): void {}
    onSimplePanMove(): void {}
    onDoublePanMove(): void {}
    onPinch(): void {}
    onSwipe(): void {}
}