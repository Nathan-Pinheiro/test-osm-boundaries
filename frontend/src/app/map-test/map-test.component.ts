import { Component, ViewChild, NgZone, ApplicationRef, ChangeDetectorRef } from '@angular/core';
import { MapComponent as MapComponent } from '../map/map.component';
import { TopologyController } from '../services/map_controllers/TopologyController';
import * as L from 'leaflet';
import { AudioService } from '../services/audio.service';
import { TestingController } from '../services/map_controllers/TestingController';
import { CommonModule } from '@angular/common';

interface LogEntry {
  timestamp: Date;
  message: string;
  type: string;
}

// Global console interceptor setup
const globalLogs: LogEntry[] = [];
let globalLogCallback: ((log: LogEntry) => void) | null = null;
let originalLog: any;
let originalWarn: any;
let originalError: any;

if (!(window as any).__consoleIntercepted) {
  (window as any).__consoleIntercepted = true;
  originalLog = console.log;
  originalWarn = console.warn;
  originalError = console.error;

  console.log = (...args: any[]) => {
    const log = {
      timestamp: new Date(),
      message: args.join(' '),
      type: 'log'
    };
    globalLogs.push(log);
    if (globalLogCallback) globalLogCallback(log);
    originalLog.apply(console, args);
  };

  console.warn = (...args: any[]) => {
    const log = {
      timestamp: new Date(),
      message: args.join(' '),
      type: 'warn'
    };
    globalLogs.push(log);
    if (globalLogCallback) globalLogCallback(log);
    originalWarn.apply(console, args);
  };

  console.error = (...args: any[]) => {
    const log = {
      timestamp: new Date(),
      message: args.join(' '),
      type: 'error'
    };
    globalLogs.push(log);
    if (globalLogCallback) globalLogCallback(log);
    originalError.apply(console, args);
  };
} else {
  originalLog = (window as any).__originalLog;
  originalWarn = (window as any).__originalWarn;
  originalError = (window as any).__originalError;
}

(window as any).__originalLog = originalLog;
(window as any).__originalWarn = originalWarn;
(window as any).__originalError = originalError;

@Component({
  selector: 'app-map-test',
  standalone: true,
  imports: [MapComponent, CommonModule],
  providers: [AudioService],
  templateUrl: './map-test.component.html',
  styleUrls: ['./map-test.component.css']
})
export class MapPage 
{
  @ViewChild(MapComponent, { static: true }) mapComponent!: MapComponent;
  logs: LogEntry[] = [];

  controllers = [
    (map: L.Map) => new TestingController(map)
  ];

  defaultZoom = 5;
  defaultCenter: L.LatLngExpression = [45, 5];

  constructor(
    private audioService: AudioService, 
    private ngZone: NgZone, 
    private appRef: ApplicationRef,
    private cdr: ChangeDetectorRef
  ) 
  {
    // Copy existing global logs
    this.logs = [...globalLogs];
    
    // Set up callback for new logs
    globalLogCallback = (log: LogEntry) => {
      this.logs.push(log);
      // Keep only last 100 logs
      if (this.logs.length > 100) {
        this.logs.shift();
      }
      this.cdr.detectChanges();
    };
  }

  ngOnInit() 
  {
    console.log('MapPage initialized - testing console interception');
    console.log('Controllers set up, logs count:', this.logs.length);
  }

  ngOnDestroy() {
    // Clear the callback when component is destroyed
    globalLogCallback = null;
  }
}
