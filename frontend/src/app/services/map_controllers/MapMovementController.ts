import * as L from 'leaflet';
import { MapController } from './MapController';

export class MapMovementController extends MapController 
{
    constructor ( map: L.Map ) 
    {
        super(map);
    }

    override onDoublePanMove(directionX: number, directionY: number): void 
    {
        const moveSensitivity = 0.5; 
        this.map.panBy([directionX * moveSensitivity, directionY * moveSensitivity], { animate: true });
    }
}