import { HttpClient } from '@angular/common/http';
import { TilezenService } from './tilezen.service';

export class ElevationService {
  /**
   * Service that load and unload elevation tiles and provide elevation data at given coordinates
   * @author Louis BOSSY
   * TODO : Calculate min and max elevation values among all loaded tiles
   */

    private tilezenService: TilezenService;

    // Maximum elevation value among all loaded tiles
    minValue: number | null = null;

    // Minimum elevation value among all loaded tiles
    maxValue: number | null = null;

    private currentZoom: number = 0;
    private tiles: { [coords: string]: Array<number> } = {};

    constructor(http: HttpClient, z: number, x: number, y: number) {
        this.tilezenService = new TilezenService(http);
    }
    initElevation(z: number, nwTile: [number, number], seTile: [number, number]): void {
        /**
         * Initialize the elevation tiles for the given zoom level and tile coordinates
         * Should only be called once at the begining and then updateElevation should be used
         * @param z Zoom level (comprised between 1 (whole world) and 15)
         * @param nwTile Tile coordinates [x,y] of the north-west corner of the view
         * @param seTile Tile coordinates [x,y] of the south-east corner of the view
         */
        for (let x = nwTile[0]; x <= seTile[0]; x++) {
            for (let y = nwTile[1]; y <= seTile[1]; y++) {
                this.loadTile(z, x, y);
            }
        }
        this.currentZoom = z;
    }
    updateElevation(z: number, nwTile: [number, number], seTile: [number, number]): void {
        /**
         * Update the elevation tiles for the given zoom level and tile coordinates
         * Should be used when the view changes to load new tiles and unload out of view tiles
         * @param z Zoom level (comprised between 1 (whole world) and 15)
         * @param nwTile Tile coordinates [x,y] of the north-west corner of the view
         * @param seTile Tile coordinates [x,y] of the south-east corner of the view
         */
        if (z != this.currentZoom) {
            // Zoom level changed, we don't bother and unload all tiles
            for (let key in this.tiles) {
                delete this.tiles[key];
            }
        } else {
            // Zoom level is the same, we only unload tiles that are out of view
            for (let key in this.tiles) {
                let coords = key.split('_').map(Number);
                let x = coords[1];
                let y = coords[2];
                if (x < nwTile[0] || x > seTile[0] || y < nwTile[1] || y > seTile[1]) {
                    this.unloadTile(z, x, y);
                }
            }
        }
        this.initElevation(z, nwTile, seTile); // And then load the new tiles in view
    }
    getElevation(lat: number, lon: number): number {
        /**
         * Get the elevation at the given coordinates
         * @param lat Latitude in degrees
         * @param lon Longitude in degrees
         * @returns Elevation in meters
         */
        let tileX = Math.floor((lon + 180) / 360 * (2 ** this.currentZoom));
        let tileY = Math.floor(this.getMercatorLatitude(lat));
        let x = ((lon + 180) / 360 * (2 ** this.currentZoom) - tileX) * 256;
        let y = (this.getMercatorLatitude(lat) - tileY) * 256;

        return this.tiles[`${this.currentZoom}_${tileX}_${tileY}`][Math.floor(y) * 256 + Math.floor(x)];
    }
    private loadTile(z: number, x: number, y: number): void {
        const key = `${z}_${x}_${y}`;
        if (!(key in this.tiles)) {
            this.tilezenService.getTile(z, x, y).then((tile) => {
                this.tiles[key] = tile;

                let minTileValue = Math.min(...this.tiles[key]);
                let maxTileValue = Math.max(...this.tiles[key]);
                if (this.minValue === null || minTileValue < this.minValue) {
                    this.minValue = minTileValue;
                }
                if (this.maxValue === null || maxTileValue > this.maxValue) {
                    this.maxValue = maxTileValue;
                }
            });
        }
    }
    private unloadTile(z: number, x: number, y: number): void {
        const key = `${z}_${x}_${y}`;
        if (!(key in this.tiles)) {
            let minTileValue = Math.min(...this.tiles[key]);
            let maxTileValue = Math.max(...this.tiles[key]);
            if (minTileValue === this.minValue || maxTileValue === this.maxValue) {
                // Recalculate min and max values
                this.minValue = null;
                this.maxValue = null;
                for (let tileKey in this.tiles) {
                    let tileMin = Math.min(...this.tiles[tileKey]);
                    let tileMax = Math.max(...this.tiles[tileKey]);
                    if (this.minValue === null || tileMin < this.minValue) {
                        this.minValue = tileMin;
                    }
                    if (this.maxValue === null || tileMax > this.maxValue) {
                        this.maxValue = tileMax;
                    }
                }
            }
            delete this.tiles[key];
        }
    }
    private getMercatorLatitude(lat: number): number {
        /**
         * Convert latitude in degrees to Mercator Y tile coordinate
         * @param lat Latitude in degrees
         * @returns Mercator Y tile coordinate
         * @author unknown internet hero...
         */
        const maxlat = Math.PI;

        if (lat > 90) lat = lat - 180;
        if (lat < -90) lat = lat + 180;

        // conversion degre=>radians
        const phi = Math.PI * lat / 180;

        let res;
        //double temp = Math.Tan(Math.PI / 4 - phi / 2);
        //res = Math.Log(temp);
        res = 0.5 * Math.log((1 + Math.sin(phi)) / (1 - Math.sin(phi)));
        let maxTileY = Math.pow(2, this.currentZoom);
        let result = (((1 - res / maxlat) / 2) * (maxTileY));

        return (result);
    }
}