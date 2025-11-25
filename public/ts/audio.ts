// Audio feedback system for map interaction

class AudioFeedback {
  private audioContext: AudioContext | null = null;
  private oscillator: OscillatorNode | null = null;
  private gainNode: GainNode | null = null;
  private isBeeping: boolean = false;
  private currentFrequency: number = 440;

  constructor() {
    // AudioContext sera créé au premier clic utilisateur (requis par les navigateurs)
  }

  private initAudioContext(): void {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
  }

  /**
   * Démarre un bip continu avec une fréquence variable
   */
  startBeep(frequency: number = 440): void {
    this.initAudioContext();
    
    if (!this.audioContext) return;

    // Si on est déjà en train de biper, on met juste à jour la fréquence
    if (this.isBeeping && this.oscillator) {
      this.oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);
      this.currentFrequency = frequency;
      return;
    }

    // Créer un nouvel oscillateur
    this.oscillator = this.audioContext.createOscillator();
    this.gainNode = this.audioContext.createGain();

    this.oscillator.type = 'sine'; // Son sinusoïdal doux
    this.oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);
    
    // Volume modéré
    this.gainNode.gain.setValueAtTime(0.15, this.audioContext.currentTime);

    this.oscillator.connect(this.gainNode);
    this.gainNode.connect(this.audioContext.destination);

    this.oscillator.start();
    this.isBeeping = true;
    this.currentFrequency = frequency;
  }

  /**
   * Met à jour la fréquence du bip en cours
   */
  updateBeepFrequency(frequency: number): void {
    if (!this.isBeeping || !this.oscillator || !this.audioContext) return;
    
    // Transition douce pour éviter les clics audio
    this.oscillator.frequency.exponentialRampToValueAtTime(
      frequency,
      this.audioContext.currentTime + 0.1
    );
    this.currentFrequency = frequency;
  }

  /**
   * Arrête le bip continu
   */
  stopBeep(): void {
    if (!this.isBeeping || !this.oscillator || !this.gainNode) return;

    try {
      // Fade out pour éviter le clic
      if (this.audioContext) {
        this.gainNode.gain.exponentialRampToValueAtTime(
          0.01,
          this.audioContext.currentTime + 0.05
        );
      }
      
      setTimeout(() => {
        if (this.oscillator) {
          this.oscillator.stop();
          this.oscillator.disconnect();
        }
        this.oscillator = null;
        this.gainNode = null;
        this.isBeeping = false;
      }, 60);
    } catch (e) {
      console.error('Error stopping beep:', e);
      this.isBeeping = false;
    }
  }

  /**
   * Dit le nom d'un pays avec synthèse vocale
   */
  speakCountry(countryName: string): void {
    // Arrêter toute parole en cours
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(countryName);
    utterance.lang = 'fr-FR';
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    window.speechSynthesis.speak(utterance);
  }

  /**
   * Calcule la fréquence basée sur la distance à la frontière
   * @param distance Distance à la frontière en kilomètres
   * @param maxDistance Distance maximale considérée (km)
   * @returns Fréquence en Hz (plus proche = plus aigu)
   */
  calculateFrequencyFromDistance(distance: number, maxDistance: number = 50): number {
    // Normaliser la distance entre 0 et 1
    const normalizedDistance = Math.min(distance / maxDistance, 1);
    
    // Plage de fréquences : 200 Hz (loin) à 1000 Hz (proche)
    const minFreq = 200; // Hz - loin de la frontière
    const maxFreq = 1000; // Hz - proche de la frontière
    
    // Inverser : plus on est proche (distance faible), plus la fréquence est haute
    const frequency = minFreq + (maxFreq - minFreq) * (1 - normalizedDistance);
    
    return frequency;
  }

  isCurrentlyBeeping(): boolean {
    return this.isBeeping;
  }
}

// Instance singleton
export const audioFeedback = new AudioFeedback();
