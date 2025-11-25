// Fonctions géométriques pour calculer la distance aux frontières

/**
 * Calcule la distance minimale d'un point à une géométrie
 */
export function calculateDistanceToBoundary(
  lat: number,
  lon: number,
  geometry: any
): number {
  if (!geometry) return Infinity;

  switch (geometry.type) {
    case 'Polygon':
      return distanceToPolygon(lat, lon, geometry.coordinates);
    case 'MultiPolygon':
      return Math.min(
        ...geometry.coordinates.map((polygon: any) =>
          distanceToPolygon(lat, lon, polygon)
        )
      );
    default:
      return Infinity;
  }
}

/**
 * Calcule la distance d'un point à un polygone
 */
function distanceToPolygon(lat: number, lon: number, rings: any[]): number {
  let minDistance = Infinity;

  // Vérifier tous les anneaux (extérieur + trous)
  for (const ring of rings) {
    for (let i = 0; i < ring.length - 1; i++) {
      const [lon1, lat1] = ring[i];
      const [lon2, lat2] = ring[i + 1];
      
      const distance = distanceToSegment(lat, lon, lat1, lon1, lat2, lon2);
      minDistance = Math.min(minDistance, distance);
    }
  }

  return minDistance;
}

/**
 * Calcule la distance d'un point à un segment de ligne
 */
function distanceToSegment(
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
export function isPointInPolygon(lat: number, lon: number, rings: any[]): boolean {
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
