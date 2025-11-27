import { Directive, Input, OnChanges, OnInit, OnDestroy } from '@angular/core';
import { SpatialAudioService } from '../services/spatial-audio.service';

@Directive({
  selector: '[appSpatialSource]',
  standalone: true
})
export class SpatialSourceDirective implements OnInit, OnChanges, OnDestroy {
  @Input() audioUrl!: string;
  @Input() sourcePositionX: number = 0;
  @Input() sourcePositionY: number = 0;
  @Input() sourcePositionZ: number = 0;

  private panner!: PannerNode;
  private audioSource!: AudioBufferSourceNode;

  constructor(private audioService: SpatialAudioService) {}

  ngOnInit(): void {
    // 1. Créer le PannerNode pour cette source
    this.panner = this.audioService.createPanner();
    
    // 2. Lancer la lecture audio et la connecter au panner
    if (this.audioUrl) {
      this.audioService.playSpatialSound(this.audioUrl, this.panner)
        .then(source => {
          this.audioSource = source;
          this.audioSource.loop = true; // Optionnel: faire boucler le son
          this.updatePannerPosition();
        })
        .catch(error => console.error("Erreur de lecture audio :", error));
    }
  }

  ngOnChanges(): void {
    // 3. Mettre à jour la position du panner si les Inputs changent (l'objet bouge)
    if (this.panner) {
      this.updatePannerPosition();
    }
  }

  private updatePannerPosition(): void {
    // Utiliser setValueAtTime pour les changements en douceur
    const currentTime = this.audioService.getAudioContext().currentTime;

    this.panner.positionX.setValueAtTime(this.sourcePositionX, currentTime);
    this.panner.positionY.setValueAtTime(this.sourcePositionY, currentTime);
    this.panner.positionZ.setValueAtTime(this.sourcePositionZ, currentTime);

    console.log(`Panner position updated: (${this.sourcePositionX}, ${this.sourcePositionY}, ${this.sourcePositionZ})`);
  }

  ngOnDestroy(): void {
    // Arrêter la lecture et déconnecter les nœuds lors de la destruction du composant/directive
    if (this.audioSource) {
      this.audioSource.stop();
      this.audioSource.disconnect();
    }
    if (this.panner) {
      this.panner.disconnect();
    }
  }
}
