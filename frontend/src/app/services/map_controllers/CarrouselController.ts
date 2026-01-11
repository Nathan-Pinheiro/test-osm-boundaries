import { MapController } from './MapController';
import * as L from 'leaflet';

export class CarrouselController extends MapController 
{
    private onNext: () => void;
    private onPrevious: () => void;

    constructor(map: L.Map, onNext: () => void, onPrevious: () => void) 
    {
        super(map);
        this.onNext = onNext;
        this.onPrevious = onPrevious;
    }

    override onSwipeLeft(): void 
    {
        this.onNext();
    }

    override onSwipeRight(): void 
    {
        this.onPrevious();
    }
}
