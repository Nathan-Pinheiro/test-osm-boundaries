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

export class MapComponent 
{
  @Input() mapStyleLink: string = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
  @Input() controllerClasses: (new (map: L.Map) => MapController)[] = [];
  @Input() controllers: ((map: L.Map) => MapController)[] = [];

  @Input() maxZoom: number = 18;
  @Input() minZoom: number = 3;
  @Input() defaultZoom: number = 13;
  @Input() defaultCenter: L.LatLngExpression = [48.8566, 2.3522];
  
  @ViewChild('mapElement', { static: true }) mapElement!: ElementRef;

  private map!: L.Map;
  private mapControllers: MapController[] = [];
  private logInterval: any;

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

    const controllersFromClasses = this.controllerClasses.map(ControllerClass => new ControllerClass(this.map));
    const controllersFromFactories = this.controllers.map(factory => factory(this.map));
    this.mapControllers = [...controllersFromClasses, ...controllersFromFactories];

    const mapElement = this.mapElement.nativeElement;

    this.interactionService.observe(mapElement, 
      (event) => { this.handleInteractions(event); },
      (x: number, y: number) => {
          const rect = this.map.getContainer().getBoundingClientRect();
          const point = L.point(x - rect.left, y - rect.top);
          return this.map.containerPointToLatLng(point);
      }
    );
  }

  public get mapInstance(): L.Map 
  {
    return this.map;
  }

  public setControllers(controllers: MapController[]): void 
  {
    this.mapControllers.forEach(element => {
      element.layers.forEach(layer => {
        layer.remove();
      });
    });

    this.mapControllers = controllers;

    this.mapControllers.forEach(element => {
      element.layers.forEach(layer => {
        layer.addTo(this.map);
      });
    });
  }

  ngOnDestroy(): void {
    if (this.logInterval) {
      clearInterval(this.logInterval);
    }
    if (this.map) this.map.remove();
  }

  handleInteractions(evt : InteractionEvent) : void 
  {
    if (evt.type == InteractionType.Pinch)
    {
      if(evt.scale)
        for(const controller of this.mapControllers) controller.onPinch(evt.scale);
    }
    else if (evt.type == InteractionType.SwipeUp)
    {
      for(const controller of this.mapControllers) controller.onSwipeUp();
    }
    else if (evt.type == InteractionType.SwipeDown)
    {
      for(const controller of this.mapControllers) controller.onSwipeDown();
    }
    else if (evt.type == InteractionType.SwipeRight)
    {
      for(const controller of this.mapControllers) controller.onSwipeRight();
    }
    else if (evt.type == InteractionType.SwipeLeft)
    {
      for(const controller of this.mapControllers) controller.onSwipeLeft();
    }
    else if (evt.type == InteractionType.PanStart)
    {
      if (evt.startPos)
        for(const controller of this.mapControllers) controller.onPanStart(evt.startPos.y, evt.startPos.x);
    }
    else if (evt.type == InteractionType.PanMove)
    {
      if (evt.currentPos)
        for(const controller of this.mapControllers) controller.onSimplePanMove(evt.currentPos.y, evt.currentPos.x);
    }
    else if (evt.type == InteractionType.PanMoveDouble)
    {
      if (evt.currentPos)
        for(const controller of this.mapControllers) controller.onDoublePanMove(evt.currentPos.y, evt.currentPos.x);
    }
    else if (evt.type == InteractionType.PanEnd)
    {
      if (evt.endPos)
        for(const controller of this.mapControllers) controller.onPanStop(evt.endPos.y, evt.endPos.x);
    }
    else if (evt.type == InteractionType.PointerSingleTap)
    {
      if (evt.currentPos)
        for(const controller of this.mapControllers) controller.onSimpleClick(evt.currentPos.y, evt.currentPos.x);
    }
    else if (evt.type == InteractionType.PointerDoubleTap)
    {
      if (evt.currentPos)
        for(const controller of this.mapControllers) controller.onDoubleClick(evt.currentPos.y, evt.currentPos.x);
    }
    else if (evt.type == InteractionType.PointerPress)
    {
      if (evt.currentPos)
        for(const controller of this.mapControllers) controller.onLongClick(evt.currentPos.y, evt.currentPos.x);
    }
    else if (evt.type == InteractionType.PointerDoubleTapLastPress)
    {
      if (evt.currentPos)
        for(const controller of this.mapControllers) controller.onDoubleClickLongLast(evt.currentPos.y, evt.currentPos.x);
    }
    else if (evt.type == InteractionType.PointerDoubleTapFirstPress)
    {
      if (evt.currentPos)
        for(const controller of this.mapControllers) controller.onDoubleClickLongFirst(evt.currentPos.y, evt.currentPos.x);
    }
    else if (evt.type == InteractionType.PointerDelete)
    {
        for(const controller of this.mapControllers) controller.onPointerDelete();
    }
    else if (evt.type == InteractionType.PointerDown)
    {
      if (evt.startPos)
        for(const controller of this.mapControllers) controller.onPointerDown(evt.startPos.y, evt.startPos.x);
    }
    else if (evt.type == InteractionType.PointerUp)
    {
      if (evt.endPos)
        for(const controller of this.mapControllers) controller.onPointerUp(evt.endPos.y, evt.endPos.x);
    }
  }
}