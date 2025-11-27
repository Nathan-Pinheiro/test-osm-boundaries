import * as L from 'leaflet';
import { GeocodingService } from '../../services/geocoding.service';
import { AudioService } from '../../services/audio.service';
import { GeometryService } from '../../services/geometry.service';
import { SpatialAudioService } from '../../services/spatial-audio.service';

export class MapDragHandler {
  private isDragging: boolean = false;
  private currentCountryCode: string = '';
  private currentCountryGeometry: any = null;
  private dragInterval: any = null;
  private lastMousePosition: L.LatLng | null = null;
  
  // Spatial audio properties
  private spatialPanner: PannerNode | null = null;
  private spatialOscillator: OscillatorNode | null = null;
  private spatialGain: GainNode | null = null;
  
  // Smoothing and debounce properties
  private lastUpdatePosition: L.LatLng | null = null;
  private minMovementThreshold: number = 0.0001; // Minimum distance to trigger update (in degrees, ~11 meters)
  private updateDebounceTime: number = 50; // Minimum time between updates in ms
  private lastUpdateTime: number = 0;

  constructor(
    private geocodingService: GeocodingService,
    private audioService: AudioService,
    private geometryService: GeometryService,
    private spatialAudioService: SpatialAudioService,
    private getLatLng: (point: {x: number, y: number}) => L.LatLng | null
  ) {}

  async handlePanStart(point: {x: number, y: number}): Promise<void> {
    console.log("Pan start");
    this.isDragging = true;
    
    const latlng = this.getLatLng(point);
    if (!latlng) return;
    
    const lat = latlng.lat;
    const lng = latlng.lng;
    
    try {
      const data = await this.geocodingService.getCountryAtPoint(lat, lng);
      if (data.features && data.features.length > 0) {
        const country = data.features[0];
        const countryName = country.properties.name || country.properties.country;
        this.currentCountryCode = country.properties.country_code || '';
        this.currentCountryGeometry = country.geometry;
        
        this.audioService.speakCountry(countryName);
        console.log(`Starting drag in: ${countryName}`);
        
        setTimeout(() => {
          if (this.isDragging) {
            const initialDistance = this.geometryService.calculateDistanceToBoundary(lat, lng, this.currentCountryGeometry);
            const initialFrequency = this.audioService.calculateFrequencyFromDistance(initialDistance, 1000);
            this.startSpatialBeep(initialFrequency, lat, lng);
            this.startDistanceTracking();
            console.log(`Spatial beep started at ${initialFrequency.toFixed(0)} Hz`);
          }
        }, 600);
      }
    } catch (error) {
      console.error('Error getting country on drag start:', error);
    }
  }

  async handlePanMove(point: {x: number, y: number}): Promise<void> {
    if (!this.isDragging) return;
    
    const latlng = this.getLatLng(point);
    if (!latlng) return;
    
    // Check if movement is significant enough
    if (this.lastMousePosition && !this.hasMovedEnough(this.lastMousePosition, latlng)) {
      return;
    }
    
    this.lastMousePosition = latlng;
    
    const lat = latlng.lat;
    const lng = latlng.lng;
    
    try {
      const data = await this.geocodingService.getCountryAtPoint(lat, lng);
      if (data.features && data.features.length > 0) {
        const country = data.features[0];
        const newCountryCode = country.properties.country_code || '';
        
        if (newCountryCode !== this.currentCountryCode && this.currentCountryCode !== '') {
          const countryName = country.properties.name || country.properties.country;
          this.currentCountryCode = newCountryCode;
          this.currentCountryGeometry = country.geometry;
          
          this.audioService.speakCountry(countryName);
          console.log(`Country changed to: ${countryName}`);
        }
      }
    } catch (error) {
      // Ignore errors during drag
    }
  }

  async handlePanEnd(point: {x: number, y: number}): Promise<void> {
    if (!this.isDragging) return;
    
    console.log("Pan end");
    this.isDragging = false;
    this.stopDistanceTracking();
    this.stopSpatialBeep();
    
    const latlng = this.getLatLng(point);
    
    if (latlng) {
      try {
        const data = await this.geocodingService.getCountryAtPoint(latlng.lat, latlng.lng);
        if (data.features && data.features.length > 0) {
          const country = data.features[0];
          const countryName = country.properties.name || country.properties.country;
          
          setTimeout(() => {
            this.audioService.speakCountry(countryName);
          }, 300);
        }
      } catch (error) {
        console.error('Error getting final country:', error);
      }
    }
    
    this.currentCountryCode = '';
    this.currentCountryGeometry = null;
    this.lastMousePosition = null;
  }

  private startDistanceTracking(): void {
    if (this.dragInterval) return;
    
    this.dragInterval = window.setInterval(() => {
      if (!this.isDragging || !this.currentCountryGeometry || !this.lastMousePosition) return;
      
      const distance = this.geometryService.calculateDistanceToBoundary(
        this.lastMousePosition.lat,
        this.lastMousePosition.lng,
        this.currentCountryGeometry
      );
      
      const frequency = this.audioService.calculateFrequencyFromDistance(distance, 500);
      const volume = 0.8;
      
      // Update spatial beep frequency and position with debouncing
      const now = Date.now();
      if (now - this.lastUpdateTime >= this.updateDebounceTime) {
        if (this.spatialOscillator && this.spatialGain) {
          this.spatialAudioService.updateBeepFrequency(this.spatialOscillator, frequency);
          this.spatialAudioService.updateVolume(this.spatialGain, volume);
        }
        
        // Only update spatial position if significant movement
        if (!this.lastUpdatePosition || this.hasMovedEnough(this.lastUpdatePosition, this.lastMousePosition)) {
          this.updateSpatialPosition(this.lastMousePosition.lat, this.lastMousePosition.lng);
          this.lastUpdatePosition = this.lastMousePosition;
        }
        
        this.lastUpdateTime = now;
      }
      
      console.log(`Distance: ${distance.toFixed(2)} km, Freq: ${frequency.toFixed(0)} Hz, Vol: ${volume.toFixed(2)}`);
    }, 100);
  }

  private stopDistanceTracking(): void {
    if (this.dragInterval) {
      clearInterval(this.dragInterval);
      this.dragInterval = null;
    }
  }

  private startSpatialBeep(frequency: number, lat: number, lng: number): void {
    // Ensure audio context is resumed
    this.spatialAudioService.resumeContext();
    
    // Create spatial panner
    this.spatialPanner = this.spatialAudioService.createPanner();
    
    // Calculate initial volume based on distance
    const distance = this.geometryService.calculateDistanceToBoundary(lat, lng, this.currentCountryGeometry);
    const initialVolume = 0.8;
    
    // Create oscillator with spatial audio and initial volume
    const beepNodes = this.spatialAudioService.createSpatialBeep(frequency, this.spatialPanner, initialVolume);
    this.spatialOscillator = beepNodes.oscillator;
    this.spatialGain = beepNodes.gain;
    
    // Start oscillator
    this.spatialOscillator.start();
    
    // Set initial position
    this.updateSpatialPosition(lat, lng);
    
    // Set listener position at center (user position)
    this.spatialAudioService.updateListenerPosition(0, 0, 0);
  }

  private stopSpatialBeep(): void {
    if (this.spatialOscillator) {
      this.spatialOscillator.stop();
      this.spatialOscillator.disconnect();
      this.spatialOscillator = null;
    }
    if (this.spatialGain) {
      this.spatialGain.disconnect();
      this.spatialGain = null;
    }
    if (this.spatialPanner) {
      this.spatialPanner.disconnect();
      this.spatialPanner = null;
    }
    // Reset tracking positions
    this.lastUpdatePosition = null;
    this.lastUpdateTime = 0;
  }

  /**
   * Check if the position has moved enough to warrant an update
   */
  private hasMovedEnough(pos1: L.LatLng, pos2: L.LatLng): boolean {
    const deltaLat = Math.abs(pos2.lat - pos1.lat);
    const deltaLng = Math.abs(pos2.lng - pos1.lng);
    return deltaLat > this.minMovementThreshold || deltaLng > this.minMovementThreshold;
  }

  private updateSpatialPosition(lat: number, lng: number): void {
    if (!this.spatialPanner || !this.currentCountryGeometry) return;
    
    // Get nearest border point from geometry service
    const nearestPoint = this.geometryService.findNearestBorderPoint(lat, lng, this.currentCountryGeometry);
    
    if (!nearestPoint) return;
    
    // Calculate direction vector from current position to nearest border point
    // We map lat/lng to a 3D coordinate system:
    // X: longitude difference (east-west)
    // Y: 0 (we keep it planar for now)
    // Z: latitude difference (north-south, negated for proper direction)
    const deltaLng = nearestPoint.lng - lng;
    const deltaLat = nearestPoint.lat - lat;
    
    // Scale the coordinates to make the spatial effect more pronounced
    // (you can adjust this scale factor based on testing)
    const scale = 100;
    const x = deltaLng * scale;
    const z = -deltaLat * scale; // Negative because in 3D audio, negative Z is forward
    const y = 0; // Keep it in the horizontal plane
    
    // Update panner position smoothly using linearRampToValueAtTime for smoother transitions
    const currentTime = this.spatialAudioService.getAudioContext().currentTime;
    const rampTime = 0.1; // 100ms smooth transition
    
    this.spatialPanner.positionX.linearRampToValueAtTime(x, currentTime + rampTime);
    this.spatialPanner.positionY.linearRampToValueAtTime(y, currentTime + rampTime);
    this.spatialPanner.positionZ.linearRampToValueAtTime(z, currentTime + rampTime);
    
    console.log(`Spatial position: (${x.toFixed(2)}, ${y.toFixed(2)}, ${z.toFixed(2)})`);
  }

  destroy() {
    this.stopDistanceTracking();
    this.stopSpatialBeep();
  }
}
