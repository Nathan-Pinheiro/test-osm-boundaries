import { Component, ViewChild } from '@angular/core';
import { MapComponent as MapComponent } from '../map/map.component';
import { TopologyController } from '../services/map_controllers/TopologyController';
import * as L from 'leaflet';
import { AudioService } from '../services/audio.service';
import { TestingController } from '../services/map_controllers/TestingController';

@Component({
  selector: 'app-map-test',
  standalone: true,
  imports: [MapComponent],
  providers: [AudioService],
  templateUrl: './map-test.component.html',
  styleUrls: ['./map-test.component.css']
})
export class MapPage {
  @ViewChild(MapComponent, { static: true }) mapComponent!: MapComponent;

  constructor(private audioService: AudioService) {}

  ngOnInit() 
  {
    this.mapComponent.defaultZoom = 5;
    this.mapComponent.defaultCenter = [45, 5];
    this.mapComponent.controllers = [
      (map: L.Map) => new TestingController(map)
    ];
  }
}
