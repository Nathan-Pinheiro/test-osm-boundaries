import { Component, ViewChild } from '@angular/core';
import { MapComponent as MapComponent } from '../map/map.component';
import * as L from 'leaflet';
import { AudioService } from '../services/audio.service';
import { CountryBorderController } from '../services/map_controllers/CountryBorderController';
import { HttpClient } from '@angular/common/http';
import { ConfigService } from '../services/config.service';
import { GeometryService } from '../services/geometry.service';

@Component({
  selector: 'border-test',
  standalone: true,
  imports: [MapComponent],
  providers: [],
  templateUrl: './country-borders.component.html',
  styleUrls: ['./country-borders.component.css']
})
export class BorderTestPage {
  @ViewChild(MapComponent, { static: true }) mapComponent!: MapComponent;

  constructor(
    private http: HttpClient, 
    private configService: ConfigService,
    private audioService: AudioService,
    private geometryService: GeometryService
  ) {}

  ngOnInit() 
  {
    this.mapComponent.defaultZoom = 5;
    this.mapComponent.defaultCenter = [45, 5];
    this.mapComponent.controllers = [
      (map: L.Map) => new CountryBorderController(map, this.http, this.configService, this.audioService, this.geometryService)
    ];
  }
}
