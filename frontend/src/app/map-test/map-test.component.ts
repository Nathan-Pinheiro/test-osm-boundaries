import { Component } from '@angular/core';
import { TestMapComponent } from '../map/map.component';
import { TestingController } from '../services/map_controllers/TestingController';

@Component({
  selector: 'app-map-test',
  standalone: true,
  imports: [TestMapComponent],
  templateUrl: './map-test.component.html',
  styleUrls: ['./map-test.component.css']
})
export class MapComponent {
  TestingController = TestingController;
}
