import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import * as turf from '@turf/turf';

@Injectable({
  providedIn: 'root'
})
export class DataService {
  private pnrData: any = null;
  private randoData: any = null;

  constructor(private http: HttpClient) {}

  async getParcAtPoint(lat: number, lng: number): Promise<any | null> {
    if (!this.pnrData) {
      this.pnrData = await firstValueFrom(this.http.get('data/PNR.geojson'));
    }

    const pt = turf.point([lng, lat]);
    
    for (const feature of this.pnrData.features) {
      if (feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon') {
        if (turf.booleanPointInPolygon(pt, feature as any)) {
          return feature;
        }
      }
    }
    return null;
  }

  async getRandoAtPoint(lat: number, lng: number, thresholdKm: number = 0.05): Promise<any | null> {
    if (!this.randoData) {
      this.randoData = await firstValueFrom(this.http.get('data/reseau-2000-rando.geojson'));
    }

    const pt = turf.point([lng, lat]);
    let closestFeature = null;
    let minDistance = Infinity;

    for (const feature of this.randoData.features) {
      if (feature.geometry.type === 'LineString' || feature.geometry.type === 'MultiLineString') {
        const distance = turf.pointToLineDistance(pt, feature as any, { units: 'kilometers' });
        if (distance < thresholdKm && distance < minDistance) {
          minDistance = distance;
          closestFeature = feature;
        }
      }
    }

    return closestFeature;
  }
}
