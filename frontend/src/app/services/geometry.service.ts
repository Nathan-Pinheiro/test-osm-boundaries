import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class GeometryService {

  /**
   * Calcule la distance minimale d'un point à une géométrie
   */
  calculateDistanceToBoundary(
    lat: number,
    lon: number,
    geometry: any
  ): number {
    if (!geometry) return Infinity;

    switch (geometry.type) {
      case 'Polygon':
        return this.distanceToPolygon(lat, lon, geometry.coordinates);
      case 'MultiPolygon':
        return Math.min(
          ...geometry.coordinates.map((polygon: any) =>
            this.distanceToPolygon(lat, lon, polygon)
          )
        );
      default:
        return Infinity;
    }
  }

  /**
   * Calcule la distance d'un point à un polygone
   */
  private distanceToPolygon(lat: number, lon: number, rings: any[]): number {
    let minDistance = Infinity;

    // Vérifier tous les anneaux (extérieur + trous)
    for (const ring of rings) {
      for (let i = 0; i < ring.length - 1; i++) {
        const [lon1, lat1] = ring[i];
        const [lon2, lat2] = ring[i + 1];
        
        const distance = this.distanceToSegment(lat, lon, lat1, lon1, lat2, lon2);
        minDistance = Math.min(minDistance, distance);
      }
    }

    return minDistance;
  }

  /**
   * Calcule la distance d'un point à un segment de ligne
   */
  private distanceToSegment(
    lat: number,
    lon: number,
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    // Convertir en coordonnées cartésiennes approximatives
    const x = lon;
    const y = lat;
    const x1 = lon1;
    const y1 = lat1;
    const x2 = lon2;
    const y2 = lat2;

    const A = x - x1;
    const B = y - y1;
    const C = x2 - x1;
    const D = y2 - y1;

    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    let param = -1;

    if (lenSq !== 0) {
      param = dot / lenSq;
    }

    let xx, yy;

    if (param < 0) {
      xx = x1;
      yy = y1;
    } else if (param > 1) {
      xx = x2;
      yy = y2;
    } else {
      xx = x1 + param * C;
      yy = y1 + param * D;
    }

    const dx = x - xx;
    const dy = y - yy;

    // Convertir la distance en kilomètres (approximation)
    const distance = Math.sqrt(dx * dx + dy * dy);
    return distance * 111; // 1 degré ≈ 111 km
  }

  /**
   * Vérifie si un point est à l'intérieur d'un polygone (ray casting)
   */
  isPointInPolygon(lat: number, lon: number, rings: any[]): boolean {
    const ring = rings[0]; // Anneau extérieur
    let inside = false;

    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i];
      const [xj, yj] = ring[j];

      const intersect =
        yi > lat !== yj > lat &&
        lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;

      if (intersect) inside = !inside;
    }

    return inside;
  }

  /**
   * Trouve le point le plus proche sur la frontière d'une géométrie
   * @returns {lat, lng} du point le plus proche sur la frontière
   */
  findNearestBorderPoint(
    lat: number,
    lon: number,
    geometry: any
  ): { lat: number; lng: number } | null {
    if (!geometry) return null;

    switch (geometry.type) {
      case 'Polygon':
        return this.nearestPointOnPolygon(lat, lon, geometry.coordinates);
      case 'MultiPolygon':
        let closestPoint: { lat: number; lng: number } | null = null;
        let minDistance = Infinity;
        
        for (const polygon of geometry.coordinates) {
          const point = this.nearestPointOnPolygon(lat, lon, polygon);
          if (point) {
            const dist = this.haversineDistance(lat, lon, point.lat, point.lng);
            if (dist < minDistance) {
              minDistance = dist;
              closestPoint = point;
            }
          }
        }
        return closestPoint;
      default:
        return null;
    }
  }

  /**
   * Trouve le point le plus proche sur un polygone
   */
  private nearestPointOnPolygon(
    lat: number,
    lon: number,
    rings: any[]
  ): { lat: number; lng: number } | null {
    let closestPoint: { lat: number; lng: number } | null = null;
    let minDistance = Infinity;

    for (const ring of rings) {
      for (let i = 0; i < ring.length - 1; i++) {
        const [lon1, lat1] = ring[i];
        const [lon2, lat2] = ring[i + 1];
        
        const point = this.nearestPointOnSegment(lat, lon, lat1, lon1, lat2, lon2);
        const dist = this.haversineDistance(lat, lon, point.lat, point.lng);
        
        if (dist < minDistance) {
          minDistance = dist;
          closestPoint = point;
        }
      }
    }

    return closestPoint;
  }

  /**
   * Trouve le point le plus proche sur un segment de ligne
   */
  private nearestPointOnSegment(
    lat: number,
    lon: number,
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): { lat: number; lng: number } {
    const x = lon;
    const y = lat;
    const x1 = lon1;
    const y1 = lat1;
    const x2 = lon2;
    const y2 = lat2;

    const A = x - x1;
    const B = y - y1;
    const C = x2 - x1;
    const D = y2 - y1;

    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    let param = -1;

    if (lenSq !== 0) {
      param = dot / lenSq;
    }

    let nearestLat, nearestLon;

    if (param < 0) {
      nearestLat = lat1;
      nearestLon = lon1;
    } else if (param > 1) {
      nearestLat = lat2;
      nearestLon = lon2;
    } else {
      nearestLon = x1 + param * C;
      nearestLat = y1 + param * D;
    }

    return { lat: nearestLat, lng: nearestLon };
  }

  /**
   * Calcule la distance entre deux points en utilisant la formule de Haversine (en km)
   */
  private haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Rayon de la Terre en km
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }
}
