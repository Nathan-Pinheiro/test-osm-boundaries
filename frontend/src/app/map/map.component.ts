import { Component, Input, ViewChild, ElementRef, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MapController } from '../services/map_controllers/MapController'
import { InteractionType, InteractionEvent, InteractionService } from '../services/interaction.service';

import * as L from 'leaflet';

@Component({
  selector: 'app-map',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './map.component.html',
  styleUrls: ['./map.component.css']
})

export class TestMapComponent 
{
  @Input() mapStyleLink: string = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
  @Input() controllerClasses: (new (map: L.Map) => MapController)[] = [];

  @Input() maxZoom: number = 18;
  @Input() minZoom: number = 3;
  @Input() defaultZoom: number = 13;
  @Input() defaultCenter: L.LatLngExpression = [48.8566, 2.3522];
  
  @ViewChild('mapElement', { static: true }) mapElement!: ElementRef;

  private map!: L.Map;
  private mapControllers: MapController[] = [];

  constructor(
    private interactionService: InteractionService
  ) {}

  ngOnInit(): void {
    this.initMap();
  }

  private initMap(): void 
  {
    this.map = L.map(this.mapElement.nativeElement, {
      dragging: false,
      touchZoom: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      boxZoom: false,
      keyboard: true,
      zoomControl: false
    }).setView(this.defaultCenter, this.defaultZoom);

    L.tileLayer(this.mapStyleLink, {
      maxZoom: this.maxZoom,
      minZoom: this.minZoom,
    }).addTo(this.map);

    this.mapControllers = this.controllerClasses.map(ControllerClass => new ControllerClass(this.map));

    const mapElement = this.mapElement.nativeElement;

    this.interactionService.observe(mapElement, (event) => {
      console.log('Interaction event:', event);
    });
  }

  ngOnDestroy(): void {
    if (this.map) this.map.remove();
  }

  handleInteractions(evt : InteractionEvent) : void {
    if (evt.type == InteractionType.Pinch)
    {
      for(const controller of this.mapControllers) controller.onPinch();
    }
    else if (evt.type.includes('swipe'))
    {
      for(const controller of this.mapControllers) controller.onSwipe();
    }
    else if (evt.type == InteractionType.PanMove)
    {
      if (evt.currentPos)
        for(const controller of this.mapControllers) controller.onSimplePanMove();
    }
    else if (evt.type == InteractionType.PointerSingleTap)
    {
      for(const controller of this.mapControllers) controller.onSimpleClick();
    }
    else if (evt.type == InteractionType.PointerDoubleTap)
    {
      for(const controller of this.mapControllers) controller.onDoubleClick();
    }
    else if (evt.type == InteractionType.PointerPress)
    {
      for(const controller of this.mapControllers) controller.onLongClick();
    }
    else if (evt.type != InteractionType.PointerDown && evt.type != InteractionType.PanStart)
    {
      for(const controller of this.mapControllers) controller.onLongClick();
    }
  }
}