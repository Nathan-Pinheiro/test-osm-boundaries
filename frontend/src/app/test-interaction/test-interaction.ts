import { AfterViewInit, Component, ViewChild, ElementRef, ChangeDetectorRef } from '@angular/core';
import { InteractionEvent, InteractionService, InteractionType } from '../services/interaction.service';

@Component({
  selector: 'app-test-interaction',
  imports: [],
  templateUrl: './test-interaction.html',
  styleUrl: './test-interaction.css',
})
export class TestInteraction implements AfterViewInit{
  currentinte: string = 'rien';

  @ViewChild('zone', {static: false}) zoneRef!: ElementRef;

  constructor(private interaction: InteractionService,
    private cdr: ChangeDetectorRef
  ){}

  ngAfterViewInit(): void {
    const zoneEl = this.zoneRef.nativeElement as HTMLElement;

    // observer la div
    this.interaction.observe(zoneEl, (evt: InteractionEvent) => {
      this.handlerex(evt);
    });

    // exemple pour avoir un convertisseur vers coordonnées leaflet directe
    /*      
    this.interaction.observe(
      zoneEl,
      (evt: InteractionEvent) => { console.log(evt); },
      (x: number, y: number) => {
        const rect = this.map.getContainer().getBoundingClientRect();
        const point = L.point(x - rect.left, y - rect.top);
        return this.map.containerPointToLatLng(point);
      }
    );

    */

  }

  
  private handlerex(evt: InteractionEvent): void{
    // const msg = JSON.stringify(evt);
    // console.log("inte : ", evt.type);

    if (evt.type == InteractionType.Pinch){
      this.currentinte = evt.type + ' : ' + evt.scale;
    }
    else if (evt.type.includes('swipe')){
      this.currentinte = evt.type;
    }
    else if (evt.type == InteractionType.PanMove){
      if (evt.currentPos){
        this.currentinte = `${evt.type} (${evt.currentPos.x}, ${evt.currentPos.y} )`
      }
      else{
        this.currentinte = `${evt.type}`
      }
    }
    else if (evt.type == InteractionType.PointerSingleTap){
      this.currentinte = evt.type ;
    }
    else if (evt.type == InteractionType.PointerDoubleTap){
      this.currentinte = evt.type ;
    }
    else if (evt.type == InteractionType.PointerPress){
      this.currentinte = evt.type ;
    }
    // j'ignore pointer down -> se déclenche à chaque fois 
    else if (evt.type != InteractionType.PointerDown && evt.type != InteractionType.PanStart){
      //this.currentinte = evt.type;
      console.log(evt.type)
    }
    this.cdr.detectChanges();
  }

}
