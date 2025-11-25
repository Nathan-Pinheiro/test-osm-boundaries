import { CONFIG } from './config.js';
import { getCountryAtPoint, type FeatureProperties } from './geocoding.js';
import { showLoading, showInfo, showError } from '../js/ui.js';
import { audioFeedback } from './audio.js';
import { calculateDistanceToBoundary } from './geometry.js';

declare const L: any;

interface LeafletLatLng {
  lat: number;
  lng: number;
}

interface LeafletMouseEvent {
  latlng: LeafletLatLng;
}

let map: any;
let currentCountryLayer: any = null;
let currentMarker: any = null;

// État pour gérer le drag
let isDragging: boolean = false;
let currentCountryCode: string = '';
let currentCountryGeometry: any = null;
let dragInterval: number | null = null;

function countGeometryPointsLocal(geometry: any): number {
  if (!geometry) return 0;
  
  let count = 0;
  
  if (geometry.type === 'Point') {
    return 1;
  } else if (geometry.type === 'LineString') {
    return geometry.coordinates.length;
  } else if (geometry.type === 'Polygon') {
    geometry.coordinates.forEach((ring: any) => {
      count += ring.length;
    });
  } else if (geometry.type === 'MultiPolygon') {
    geometry.coordinates.forEach((polygon: any) => {
      polygon.forEach((ring: any) => {
        count += ring.length;
      });
    });
  } else if (geometry.type === 'MultiLineString') {
    geometry.coordinates.forEach((line: any) => {
      count += line.length;
    });
  } else if (geometry.type === 'MultiPoint') {
    return geometry.coordinates.length;
  } else if (geometry.type === 'GeometryCollection') {
    geometry.geometries.forEach((geom: any) => {
      count += countGeometryPointsLocal(geom);
    });
  }
  
  return count;
}

function initMap(): void {
  const initialView: [number, number] = [46, 2];
  const initialZoom = 5;
  
  map = L.map('map', {
    dragging: true,         // Active le drag pour capturer les événements
    touchZoom: false,       // Désactive le zoom tactile
    scrollWheelZoom: false, // Désactive le zoom à la molette
    doubleClickZoom: false, // Désactive le zoom par double-clic
    boxZoom: false,         // Désactive le zoom par sélection
    keyboard: false,        // Désactive le contrôle au clavier
    zoomControl: false      // Cache les boutons de zoom
  }).setView(initialView, initialZoom);
  
  // Empêcher la carte de bouger visuellement
  map.on('drag', function() {
    map.panTo(initialView, { animate: false, duration: 0 });
  });
  
  const basemaps: Record<string, any> = {
    'OpenMapTiles (Streets)': L.tileLayer('https://api.maptiler.com/maps/streets-v2/{z}/{x}/{y}.png?key={apikey}', {
      attribution: '<a href="https://www.maptiler.com/copyright/" target="_blank">&copy; MapTiler</a> <a href="https://www.openstreetmap.org/copyright" target="_blank">&copy; OpenStreetMap contributors</a>',
      apikey: CONFIG.OPENMAPTILES_API_KEY,
      tileSize: 512,
      zoomOffset: -1,
      minZoom: 1,
      maxZoom: 19
    }),
    'OpenStreetMap': L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19
    }),
    'OpenMapTiles (Satellite)': L.tileLayer('https://api.maptiler.com/maps/hybrid/{z}/{x}/{y}.jpg?key={apikey}', {
      attribution: '<a href="https://www.maptiler.com/copyright/" target="_blank">&copy; MapTiler</a> <a href="https://www.openstreetmap.org/copyright" target="_blank">&copy; OpenStreetMap contributors</a>',
      apikey: CONFIG.OPENMAPTILES_API_KEY,
      tileSize: 512,
      zoomOffset: -1,
      minZoom: 1,
      maxZoom: 19
    })
  };
  
  if (CONFIG.OPENMAPTILES_API_KEY) {
    basemaps['OpenMapTiles (Streets)'].addTo(map);
  } else {
    basemaps['OpenStreetMap'].addTo(map);
  }
  
  L.control.layers(basemaps, {}, {position: 'topright'}).addTo(map);
  
  map.on('click', handleMapClick);

  // Utiliser mousedown/mousemove/mouseup pour un meilleur contrôle du drag
  map.on('mousedown', handleMouseDown);
  map.on('mousemove', handleMouseMove);
  map.on('mouseup', handleMouseUp);
  map.on('mouseout', handleMouseUp); // Au cas où la souris sortirait de la carte
}

async function handleMouseDown(e: LeafletMouseEvent): Promise<void> {
  console.log("Mouse down - drag start");
  isDragging = true;
  
  const lat = e.latlng.lat;
  const lng = e.latlng.lng;
  
  try {
    const data = await getCountryAtPoint(lat, lng);
    if (data.features && data.features.length > 0) {
      const country = data.features[0];
      const countryName = country.properties.name || country.properties.country;
      currentCountryCode = country.properties.country_code || '';
      currentCountryGeometry = country.geometry;
      
      // Annoncer le pays immédiatement
      audioFeedback.speakCountry(countryName);
      console.log(`Starting drag in: ${countryName}`);
      
      // Démarrer le bip après un court délai pour laisser parler
      setTimeout(() => {
        if (isDragging) {
          const initialDistance = calculateDistanceToBoundary(lat, lng, currentCountryGeometry);
          const initialFrequency = audioFeedback.calculateFrequencyFromDistance(initialDistance, 50);
          audioFeedback.startBeep(initialFrequency);
          startDistanceTracking();
          console.log(`Beep started at ${initialFrequency.toFixed(0)} Hz`);
        }
      }, 600);
    }
  } catch (error) {
    console.error('Error getting country on drag start:', error);
  }
}

let lastMousePosition: LeafletLatLng | null = null;

function startDistanceTracking(): void {
  if (dragInterval) return;
  
  dragInterval = window.setInterval(() => {
    if (!isDragging || !currentCountryGeometry || !lastMousePosition) return;
    
    const distance = calculateDistanceToBoundary(
      lastMousePosition.lat,
      lastMousePosition.lng,
      currentCountryGeometry
    );
    
    // Calculer la fréquence basée sur la distance
    const frequency = audioFeedback.calculateFrequencyFromDistance(distance, 50);
    audioFeedback.updateBeepFrequency(frequency);
    
    console.log(`Distance to boundary: ${distance.toFixed(2)} km, Frequency: ${frequency.toFixed(0)} Hz`);
  }, 100); // Mise à jour toutes les 100ms
}

function stopDistanceTracking(): void {
  if (dragInterval) {
    clearInterval(dragInterval);
    dragInterval = null;
  }
}

async function handleMouseMove(e: LeafletMouseEvent): Promise<void> {
  if (!isDragging) return;
  
  lastMousePosition = e.latlng;
  
  // Vérifier si on a changé de pays (throttle pour ne pas surcharger)
  const lat = e.latlng.lat;
  const lng = e.latlng.lng;
  
  try {
    const data = await getCountryAtPoint(lat, lng);
    if (data.features && data.features.length > 0) {
      const country = data.features[0];
      const newCountryCode = country.properties.country_code || '';
      
      // Si on change de pays
      if (newCountryCode !== currentCountryCode && currentCountryCode !== '') {
        const countryName = country.properties.name || country.properties.country;
        currentCountryCode = newCountryCode;
        currentCountryGeometry = country.geometry;
        
        // Annoncer le nouveau pays
        audioFeedback.speakCountry(countryName);
        console.log(`Country changed to: ${countryName}`);
      }
    }
  } catch (error) {
    // Ignorer les erreurs pendant le drag (trop de requêtes)
  }
}

async function handleMouseUp(e: LeafletMouseEvent): Promise<void> {
  if (!isDragging) return;
  
  console.log("Mouse up - drag finished");
  isDragging = false;
  stopDistanceTracking();
  audioFeedback.stopBeep();
  
  // Annoncer le pays final
  const lat = e.latlng?.lat;
  const lng = e.latlng?.lng;
  
  if (lat !== undefined && lng !== undefined) {
    try {
      const data = await getCountryAtPoint(lat, lng);
      if (data.features && data.features.length > 0) {
        const country = data.features[0];
        const countryName = country.properties.name || country.properties.country;
        
        setTimeout(() => {
          audioFeedback.speakCountry(countryName);
        }, 300);
      }
    } catch (error) {
      console.error('Error getting final country:', error);
    }
  }
  
  // Réinitialiser
  currentCountryCode = '';
  currentCountryGeometry = null;
  lastMousePosition = null;
}

async function handleMapClick(e: LeafletMouseEvent): Promise<void> 
{
  if (currentMarker) map.removeLayer(currentMarker);
  if (currentCountryLayer) map.removeLayer(currentCountryLayer);
  
  const lat = e.latlng.lat;
  const lng = e.latlng.lng;
  
  currentMarker = L.marker(e.latlng).addTo(map);
  showLoading();
  
  try {
    const data = await getCountryAtPoint(lat, lng);
    
    if (!data.features || data.features.length === 0) 
  {
      showError('Aucun pays trouvé');
      currentMarker.bindTooltip("Aucun pays").openTooltip();
      return;
    }
    
    const country = data.features[0];
    const props = country.properties;
    const enhanced = props._enhanced || {};
    
    const locationName = enhanced.best_name || props.name || props.country || 'Lieu inconnu';
    const adminType = enhanced.admin_type || (props.admin_level ? `Niveau administratif ${props.admin_level}` : 'Lieu');
    const isCountry = adminType.includes('Country') || adminType.includes('Pays');
    
    let totalPoints = 0;
    data.features.forEach((f: any) => {
      const points = countGeometryPointsLocal(f.geometry);
      totalPoints += points;
      console.log(`[FEATURE] ${f.properties.name || 'Unknown'}: ${points} points (${f.geometry.type})`);
    });
    console.log(`[TOTAL] Displaying ${data.features.length} feature(s) with ${totalPoints} total points`);
    
    if (data.features.length > 1) {
      currentCountryLayer = L.geoJSON(data, {
        style: () => ({
          color: '#2980b9',
          weight: 4,
          fillColor: '#3498db',
          fillOpacity: 0.2,
          dashArray: '0',
          smoothFactor: 1
        }),
        onEachFeature: (feature: any, layer: any) => {
          if (feature.properties) {
            const p = feature.properties;
            const e = p._enhanced || {};
            const name = e.best_name || p.name || p.country || 'Unknown';
            const level = p.admin_level || 'Unknown';
            const type = e.admin_type || `Level ${level}`;
            
            let popupContent = `<b>${name}</b><br>Type: ${type}`;
            if (p.country_code) popupContent += `<br>Country Code: ${p.country_code}`;
            
            layer.bindPopup(popupContent);
          }
        }
      }).addTo(map);
    } else {
      currentCountryLayer = L.geoJSON(country, {
        style: {
          color: isCountry ? '#2980b9' : '#e67e22',
          weight: isCountry ? 4 : 3,
          fillColor: isCountry ? '#3498db' : '#f39c12',
          fillOpacity: 0.2,
          dashArray: isCountry ? '0' : '5, 5',
          smoothFactor: 1
        },
        onEachFeature: (feature: any, layer: any) => {
          if (feature.properties) {
            const p = feature.properties;
            const e = p._enhanced || {};
            const name = e.best_name || p.name || p.country || 'Unknown';
            const level = p.admin_level || 'Unknown';
            const type = e.admin_type || `Level ${level}`;
            
            let popupContent = `<b>${name}</b><br>Type: ${type}`;
            if (p.country_code) popupContent += `<br>Country Code: ${p.country_code}`;
            
            layer.bindPopup(popupContent);
          }
        }
      }).addTo(map);
    }
    
    if (map.getZoom() > 6 && currentCountryLayer) {
      try {
        const bounds = currentCountryLayer.getBounds();
        if (bounds.isValid()) {
          map.flyToBounds(bounds, {
            padding: [50, 50],
            maxZoom: 8,
            duration: 1
          });
        }
      } catch(err) {
        console.warn('Cannot zoom to bounds:', err);
      }
    }
    
    const details: string[] = [];
    if (props.country && props.country !== locationName) 
      details.push(`Pays: ${props.country}`);
    if (props.state && props.state !== locationName) 
      details.push(`Région: ${props.state}`);
    if (props.county && props.county !== locationName) 
      details.push(`Département: ${props.county}`);
    if (props.city && props.city !== locationName) 
      details.push(`Ville: ${props.city}`);
    
    if (details.length === 0) {
      details.push(adminType);
    }
    
    showInfo(locationName, details, lat, lng);
    currentMarker.bindTooltip(locationName).openTooltip();
    
    // Annoncer le pays avec le système audio
    audioFeedback.speakCountry(locationName);
    
  } catch (error) {
    console.error('Error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    showError(errorMessage);
  }
}

document.addEventListener('DOMContentLoaded', initMap);
