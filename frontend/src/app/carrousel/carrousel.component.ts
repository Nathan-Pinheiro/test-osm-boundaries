import { Component, ViewChild, AfterViewInit } from '@angular/core';
import { MapComponent } from '../map/map.component';
import * as L from 'leaflet';
import { AudioService } from '../services/audio.service';
import { CountryBorderController } from '../services/map_controllers/CountryBorderController';
import { CarrouselController } from '../services/map_controllers/CarrouselController';
import { MapController } from '../services/map_controllers/MapController';
import { HttpClient } from '@angular/common/http';
import { ConfigService } from '../services/config.service';
import { GeometryService } from '../services/geometry.service';
import { TopologyController } from '../services/map_controllers/TopologyController';
import { MapMovementController } from '../services/map_controllers/MapMovementController';

@Component({
  selector: 'border-test',
  standalone: true,
  imports: [MapComponent],
  providers: [],
  templateUrl: './carrousel.component.html',
  styleUrls: ['./carrousel.component.css']
})
export class CarrouselPage implements AfterViewInit {
  
  fixedComponents: MapController[] = [];
  changingComponents: MapController[][] = [];
  current: number = 0;

  @ViewChild(MapComponent) mapComponent!: MapComponent;

  constructor(
    private http: HttpClient, 
    private configService: ConfigService,
    private audioService: AudioService,
    private geometryService: GeometryService
  ) {}

  ngAfterViewInit()
  {
    const map = this.mapComponent.mapInstance;
    map.setView([45, 5], 5);

    this.fixedComponents = [
      new CarrouselController(
        map, 
        () => this.next(), 
        () => this.previous()
      )
    ];

    this.changingComponents = [
      [
        new CountryBorderController(map, this.http, this.configService, this.audioService, this.geometryService),
        new MapMovementController(map),
      ],
      [
        new TopologyController(map, this.audioService, this.http)
      ],
    ];

    this.current = 0;
    this.updateController();
  }

  next() 
  {
    this.current = (this.current + 1) % this.changingComponents.length;
    this.updateController();
  }

  previous() 
  {
    this.current = (this.current - 1 + this.changingComponents.length) % this.changingComponents.length;
    this.updateController();
  }

  updateController()
  {
    const currentSet = this.changingComponents[this.current] || [];
    const allControllers = [...this.fixedComponents, ...currentSet];
    this.mapComponent.setControllers(allControllers);
    this.audioService.speakCountry(`Mode ${currentSet[0].getName()} activé`);
  }
}
