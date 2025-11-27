import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-map-info',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="info" *ngIf="visible">
      <div *ngIf="loading">
        Identification du pays <div class="loading"></div>
      </div>
      <div *ngIf="error">
        Erreur: {{ errorMessage }}
      </div>
      <div *ngIf="!loading && !error && locationName">
        <div class="country">{{ locationName }}</div>
        <div *ngFor="let detail of details">{{ detail }}</div>
        <div><small>Lat: {{ lat | number:'1.4-4' }}, Lon: {{ lng | number:'1.4-4' }}</small></div>
      </div>
    </div>
  `,
  styles: [`
    .info {
      position: absolute;
      left: 10px;
      top: 10px;
      z-index: 1000;
      background: rgba(255, 255, 255, 0.9);
      padding: 10px;
      border-radius: 4px;
      box-shadow: 0 0 15px rgba(0, 0, 0, 0.2);
      max-width: 300px;
    }

    .country {
      font-weight: bold;
      font-size: 18px;
      color: #2c3e50;
    }

    .loading {
      display: inline-block;
      border: 3px solid #f3f3f3;
      border-top: 3px solid #3498db;
      border-radius: 50%;
      width: 16px;
      height: 16px;
      animation: spin 1s linear infinite;
      margin-left: 10px;
      vertical-align: middle;
    }

    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  `]
})
export class MapInfoComponent {
  @Input() visible: boolean = false;
  @Input() loading: boolean = false;
  @Input() error: boolean = false;
  @Input() errorMessage: string = '';
  @Input() locationName: string = '';
  @Input() details: string[] = [];
  @Input() lat: number = 0;
  @Input() lng: number = 0;
}
