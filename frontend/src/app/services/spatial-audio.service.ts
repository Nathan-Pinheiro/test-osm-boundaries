import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class SpatialAudioService {
  private audioContext: AudioContext;
  private listener: AudioListener;

  constructor() {
    // 1. Initialiser le contexte audio
    this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    this.listener = this.audioContext.listener;

    // 2. Définir la position et l'orientation initiales de l'auditeur (l'utilisateur)
    // Nous supposons que l'auditeur est au centre de l'espace 3D (0, 0, 0)
    if (this.listener.positionX) {
      this.listener.positionX.setValueAtTime(0, this.audioContext.currentTime);
      this.listener.positionY.setValueAtTime(0, this.audioContext.currentTime);
      this.listener.positionZ.setValueAtTime(0, this.audioContext.currentTime);
    } else {
      // Fallback pour les anciennes implémentations
      this.listener.setPosition(0, 0, 0);
    }
  }

  /**
   * Crée un PannerNode 3D pour positionner une source sonore dans l'espace.
   * @returns Un PannerNode connecté à la sortie principale.
   */
  public createPanner(): PannerNode {
    const panner = this.audioContext.createPanner();
    
    // Configuration pour un meilleur effet spatial (peut être ajustée)
    panner.panningModel = 'HRTF'; // Utilisation de Head-Related Transfer Function (meilleur réalisme)
    panner.distanceModel = 'inverse'; // Modèle d'atténuation du volume avec la distance
    panner.refDistance = 1;          // Volume à 100% à cette distance
    panner.maxDistance = 10000;      // Distance maximale pour l'atténuation

    // Connecter le PannerNode à la destination (haut-parleurs)
    panner.connect(this.audioContext.destination);
    
    return panner;
  }

  /**
   * Crée une source audio à partir d'une URL et la connecte à un panner.
   * @param url L'URL du fichier audio.
   * @param panner Le PannerNode pour la spatialisation.
   */
  public async playSpatialSound(url: string, panner: PannerNode): Promise<AudioBufferSourceNode> {
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);

    const source = this.audioContext.createBufferSource();
    source.buffer = audioBuffer;
    
    // Connecter la source au panner (le panner est déjà connecté à la sortie)
    source.connect(panner);
    
    // S'assurer que le contexte est actif (important pour les interactions utilisateur)
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }
    
    source.start(0);
    return source;
  }
  
  /**
   * Met à jour la position de l'auditeur (par exemple, si la caméra bouge)
   * @param x Position X
   * @param y Position Y
   * @param z Position Z
   */
  public updateListenerPosition(x: number, y: number, z: number): void {
    if (this.listener.positionX) {
      this.listener.positionX.setValueAtTime(x, this.audioContext.currentTime);
      this.listener.positionY.setValueAtTime(y, this.audioContext.currentTime);
      this.listener.positionZ.setValueAtTime(z, this.audioContext.currentTime);
    } else {
      // Fallback
      this.listener.setPosition(x, y, z);
    }
  }

  /**
   * Crée un oscillateur pour générer un beep continu spatialisé
   * @param frequency Fréquence du beep
   * @param panner Le PannerNode pour la spatialisation
   * @param volume Volume initial (0.0 à 1.0, défaut 0.3)
   * @returns L'oscillateur et le gain pour contrôle
   */
  public createSpatialBeep(frequency: number, panner: PannerNode, volume: number = 0.3): { oscillator: OscillatorNode, gain: GainNode } {
    const oscillator = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);
    
    // Set initial volume
    gain.gain.setValueAtTime(volume, this.audioContext.currentTime);

    oscillator.connect(gain);
    gain.connect(panner);

    return { oscillator, gain };
  }

  /**
   * Met à jour la fréquence d'un oscillateur existant
   */
  public updateBeepFrequency(oscillator: OscillatorNode, frequency: number): void {
    oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);
  }

  /**
   * Retourne le contexte audio pour accéder au currentTime
   */
  public getAudioContext(): AudioContext {
    return this.audioContext;
  }

  /**
   * Met à jour le volume d'un gain node
   * @param gain Le GainNode à modifier
   * @param volume Le nouveau volume (0.0 à 1.0)
   * @param rampTime Temps de transition en secondes (défaut 0.05)
   */
  public updateVolume(gain: GainNode, volume: number, rampTime: number = 0.05): void {
    const clampedVolume = Math.max(0, Math.min(1, volume));
    gain.gain.linearRampToValueAtTime(clampedVolume, this.audioContext.currentTime + rampTime);
  }

  /**
   * Calcule le volume basé sur la distance (plus proche = plus fort)
   * @param distance Distance en km
   * @param maxDistance Distance maximale pour le volume minimal
   * @param minVolume Volume minimal (défaut 0.05)
   * @param maxVolume Volume maximal (défaut 0.5)
   * @returns Volume entre minVolume et maxVolume
   */
  public calculateVolumeFromDistance(distance: number, maxDistance: number, minVolume: number = 0.05, maxVolume: number = 0.5): number {
    const normalizedDistance = Math.min(distance / maxDistance, 1);
    return minVolume + (maxVolume - minVolume) * (1 - normalizedDistance);
  }

  /**
   * S'assure que le contexte audio est actif
   */
  public async resumeContext(): Promise<void> {
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }
  }
}
