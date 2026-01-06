import { Injectable } from '@angular/core';

export enum InteractionType {
    PointerDown = "pointer-down",
    PointerUp = "pointer-up",
    PointerPress = "pointer-press",
    PointerSingleTap = "pointer-single-tap",
    PointerDoubleTap = "pointer-double-tap",

    PointerDoubleTapLastPress = "pointer-double-tap-last-press",
    PointerDoubleTapFirstPress = "pointer-double-tap-first-press",

    PointerDelete = "pointer-delete",


    PanStart = "pan-start",
    PanMove = "pan-move",
    PanEnd = "pan-end",
    PanMoveDouble = "pan-move-double",
    SwipeLeft = "swipe-left",
    SwipeRight = "swipe-right",
    SwipeUp = "swipe-up",
    SwipeDown = "swipe-down",
    Pinch = "pinch",
}

export interface InteractionEvent {
    type : InteractionType;      // tap-2, swipe-left ...
    fingers?: number;   // nombre de doigts
    scale?: number;     // pinch

    startPos?: { x:number, y:number };
    endPos?: {x:number, y:number };
    currentPos?: {x:number, y:number}

}


@Injectable({
  providedIn: 'root',
})
export class InteractionService {
  private element!: HTMLElement;


  private mapProject: ((x: number, y:number) => {lat: number; lng: number}) | null = null;

  // ~ le nombre de doigts sur l'écran en même temps
  private activePointer = new Map<number, PointerEvent>();

  // clic ou press
  private downtime = 0;

  // timer entre les clics
  private lastTatpTime = 0;

  // savoir si le dernier tap est un press
  private islastpress = false;

  // savoir si c'est un doubletap
  private isDoubleTap = false;

  //
  private ignorePointerUntil = 0;

  // 
  private tapTimeout: any;

  // différence entre tap et pan
  private isSwipping = false;

  // différence entre swipe et pan
  private move = false;

  // début du pan
  private startTime = 0;

  //
  private swipeStart = {x: 0, y: 0};

  //
  private pinchStartDist : number | null = null;
  private ispinching = false;


  observe(
      element: HTMLElement, 
      callback: (event: InteractionEvent) => void, // fonction à redéfinir selon l'element html
      mapProject?: (x: number, y:number) => {lat: number; lng:number},
  ){
      this.element = element;
      this.mapProject = mapProject ?? null; // null si undefined
      this.initPointerEvent(callback);
  }

  private initPointerEvent(callback: (e: InteractionEvent) => void){

    const pressThreshold = 500;
    const doubleTapThreshold = 300;
    let ignoreThreshold = 0;
  
    // ~ désactive le menu clic droit 
    this.element.addEventListener('contextmenu', (e) => {
        e.preventDefault();
    })

    // pointer down
    this.element.addEventListener('pointerdown', (e) => {

      // Ignore mouse events, only accept touch and pen
      if (e.pointerType === 'mouse') return;

      this.activePointer.set(e.pointerId, e);
      let co = this.convcoord(e.clientX, e.clientY);

      if (this.activePointer.size == 1){
        this.downtime = performance.now();
        this.isDoubleTap = performance.now() - this.lastTatpTime < doubleTapThreshold;

      }

      callback({
        type: InteractionType.PointerDown,
        startPos: {...co},
      })

    })

    this.element.addEventListener('pointermove', (e) => {
      // Ignore mouse events, only accept touch and pen
      if (e.pointerType === 'mouse') return;

      let co = this.convcoord(e.clientX, e.clientY);

      this.activePointer.set(e.pointerId, e);

      if (this.isSwipping){
        if (!this.move){
          this.move = performance.now() - this.startTime > 200;
        }
        else{
          if (this.activePointer.size >= 2){

            const pts = [...this.activePointer.values()]; 
            const dist = Math.hypot( pts[0].clientX - pts[1].clientX, pts[0].clientY - pts[1].clientY );

            if (!this.pinchStartDist){
              this.pinchStartDist = dist
            }
            else if ( Math.abs(this.pinchStartDist - dist) > 10 || this.ispinching){
              this.ispinching = true;
              callback({
                type: InteractionType.Pinch,
                scale: dist / this.pinchStartDist,
              })
            }
            else{
              callback({
                  type: InteractionType.PanMoveDouble,
                  startPos : {...this.swipeStart},
                  currentPos : {...co},
              })
            }

          }
          else{
            callback({
                type: InteractionType.PanMove,
                startPos : {...this.swipeStart},
                currentPos : {...co},
            })
          }

          this.ignorePointerUntil = performance.now() + 100
        }
      }
      else{
        this.startTime = performance.now();
        this.isSwipping = true;
        callback({
          type: InteractionType.PanStart,
          startPos: {...co},
        });
        this.swipeStart = {...co};

        if (this.tapTimeout){ // toujours vrai normalement
          clearTimeout(this.tapTimeout);
          this.tapTimeout = null;
        }

      }
    })

    // pointerup à chaque fois
    this.element.addEventListener('pointerup', (e) => {
      // Ignore mouse events, only accept touch and pen
      if (e.pointerType === 'mouse') return;

      let co = this.convcoord(e.clientX, e.clientY);

      if (this.isSwipping){
        if (!this.move && performance.now() > this.ignorePointerUntil){
          let dx = this.swipeStart.x - co.x;
          let dy = this.swipeStart.y - co.y;

          if (Math.abs(dx) > Math.abs(dy)){
            callback({
              type: dx > 0 ? InteractionType.SwipeLeft : InteractionType.SwipeRight,
            })
          }
          else{
            callback({
              type : dy > 0 ? InteractionType.SwipeUp : InteractionType.SwipeDown,
            })
          }
        }

        callback({
          type: InteractionType.PanEnd,
          endPos : {...co},
        })
        
        if (this.activePointer.size <= 1){
          this.pinchStartDist = null;
          this.ispinching = false;
        }

        this.isSwipping = false;
        this.move = false;
      }
      else if (this.activePointer.size == 1){
        let datenow = performance.now();

        if (datenow > this.ignorePointerUntil){
          this.ignorePointerUntil = datenow + 0; // peut être modifié


          // double tap
          if (this.isDoubleTap){
            if (this.tapTimeout){ // toujours vrai normalement
              clearTimeout(this.tapTimeout);
              this.tapTimeout = null;
            }

            if (datenow - this.downtime >= pressThreshold){

              callback({
                type: InteractionType.PointerDoubleTapLastPress,
                currentPos: {...co},
              })

              this.islastpress = false;
            }
            else{
              if (this.islastpress){
                callback({
                  type: InteractionType.PointerDoubleTapFirstPress,
                  currentPos: {...co},
                })
              }
              else{
                callback({
                  type: InteractionType.PointerDoubleTap,
                  currentPos: {...co},
                })
              }
              this.islastpress = false;
            }
            this.isDoubleTap = false;
            this.ignorePointerUntil = datenow + doubleTapThreshold + 10;
          }

          // press
          else if (datenow - this.downtime >= pressThreshold){

            this.islastpress = true;

            this.tapTimeout = setTimeout(() => {

              if (this.isDoubleTap) return;

              callback({
                type: InteractionType.PointerPress,
                currentPos: {...co},
              })
            }, doubleTapThreshold) 


          }
          // singletap
          else {
            this.islastpress = false;
            
            this.tapTimeout = setTimeout(() => {

              if (this.isDoubleTap) return;

              callback({
                type: InteractionType.PointerSingleTap,
                currentPos: {...co},
              });
            }, doubleTapThreshold) 

          }

          this.lastTatpTime = datenow;

          callback({
            type: InteractionType.PointerUp,
            endPos: {...co},
          })
        }
      }

      this.activePointer.delete(e.pointerId);

    })

    // pas sûr de ça
    this.element.addEventListener('pointercancel', (e) => {
      // Ignore mouse events, only accept touch and pen
      if (e.pointerType === 'mouse') return;

      callback({
        type: InteractionType.PointerDelete,
      });

      this.activePointer.delete(e.pointerId);
    })



  

  }


  private convcoord(xb: number, yb: number) : {x: number, y: number} {
    if (this.mapProject){
      let coord = this.mapProject(xb, yb);
      return {x: coord.lat, y: coord.lng};
    }
    else{
      return {x: xb, y: yb}; 
    }
  }



}
