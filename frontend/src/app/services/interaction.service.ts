import { Injectable } from "@angular/core";
import Hammer from "hammerjs";

export enum InteractionType {
    PointerDown = "pointer-down",
    PointerUp = "pointer-up",
    PointerPress = "pointer-press",
    PointerSingleTap = "pointer-single-tap",
    PointerDoubleTap = "pointer-double-tap",
    PointerDelete = "pointer-delete",
    PanStart = "pan-start",
    PanMove = "pan-move",
    SwipeLeft = "swipe-left",
    SwipeRight = "swipe-right",
    SwipeUp = "swipe-up",
    SwipeDown = "swipe-down",
    Pinch = "pinch"
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
    providedIn: 'root'
})
export class InteractionService{
    private element!: HTMLElement;

    private hammer!: HammerManager; // gestion swipe + pan+ pinch

    // fonction de conversion de coordonnées / si on utilise une carte par exemple ...
    private mapProject: ((x: number, y:number) => {lat: number; lng: number}) | null = null;

    // timestamp jusqu'auquel on ignore les taps/press ...
    private ingorePointerUntil = 0;

    // coordonnées de début et de fin
    private startPos = {x: 0, y: 0};
    private endPos = {x: 0, y: 0};
    private currentPos = {x: 0, y: 0};

    // durée de l'event pour pan et swip
    private startTime = 0;

    // déplacement du doigts ?? -> différencier clic de pan etc
    private isSwiping = false;
    
    // variable d'état entre hammer et pointerevent
    private move = false;


    //pour les pointers
    private activePointers = new Map<number, PointerEvent>();
    // timer pour savoir si clic ou press
    private downtime = 0;
    // timer entre les clics
    private lastTapTime = 0;
    // essaie pour le nombre de doigts
    private lastTapFingers = 0;
    // utilie pour essaie plusieurs doigts
    private tapTimeout: any;

    // méthode pour regarder / écouter un élément
    observe(
        element: HTMLElement, 
        callback: (event: InteractionEvent) => void, // fonction à redéfinir selon l'element html
        mapProject?: (x: number, y:number) => {lat: number; lng:number}
    ){
        this.element = element;
        this.mapProject = mapProject ?? null; // null si undefined
        this.initHammer(callback);
        this.initPointerEvent(callback);
    }

    // gestion pan, pinch, swipe
    private initHammer(callback: (e: InteractionEvent) => void){
        this.hammer = new Hammer(this.element);

        // pinch
        this.hammer.get('pinch').set({ enable: true});
        this.hammer.on('pinch', (e) => {
            callback({
                type: InteractionType.Pinch,
                scale: Math.round((e.scale ?? 1) * 100) / 100,
                // startPos : {...this.startPos}, // ... -> étend pour avoir startPos.x etc
                // endPos: {...this.endPos}
            })
        })
        this.hammer.on('pinchend', (e) => {
            this.ingorePointerUntil = performance.now() + 200;
        })

        // PAN
        this.hammer.get('pan').set({ direction: Hammer.DIRECTION_ALL});

            // pan-start
        this.hammer.on('panstart', (e) => {
            this.startTime = performance.now();
            this.isSwiping = true;
            if (this.mapProject){
                let coord = this.mapProject(e.center.x, e.center.y);
                this.startPos = {x: coord.lat, y: coord.lng}
            }
            else{
                this.startPos.x = e.center.x;
                this.startPos.y = e.center.y;
            }

            callback({
                type: InteractionType.PanStart,
                startPos : {...this.startPos}, // ... -> étend pour avoir startPos.x etc
            })
        })

            // pan-move
        this.hammer.on('pan', (e) => {
            if (this.mapProject){
                let coord = this.mapProject(e.center.x, e.center.y);
                this.currentPos = {x: coord.lat, y: coord.lng}
            }
            else{
                this.currentPos.x = e.center.x;
                this.currentPos.y = e.center.y;
            }

            if (this.move){
                callback({
                    type: InteractionType.PanMove,
                    startPos : {...this.startPos},
                    currentPos : {...this.currentPos},
                    endPos : {...this.endPos},
                })
            }
            else{
                if (performance.now() - this.startTime > 200){
                    this.move = true;
                }
            }
        })

            // pan-end / swipe
        this.hammer.on('panend', (e) => {
            if (performance.now() < this.ingorePointerUntil){
                return;
            }

            if (this.mapProject){
                let coord = this.mapProject(e.center.x, e.center.y);
                this.endPos = {x: coord.lat, y: coord.lng}
            }
            else{
                this.endPos.x = e.center.x;
                this.endPos.y = e.center.y;
            }

            if (!this.move){
                switch (e.direction) {
                    case Hammer.DIRECTION_LEFT:
                        callback({
                            type: InteractionType.SwipeLeft,
                            startPos : {...this.startPos},
                            endPos : {...this.endPos},
                        });
                        break;
                    case Hammer.DIRECTION_RIGHT:
                        callback({
                            type: InteractionType.SwipeRight,
                            startPos : {...this.startPos},
                            endPos : {...this.endPos},
                        });
                        break;
                    case Hammer.DIRECTION_UP:
                        callback({
                            type: InteractionType.SwipeUp,
                            startPos : {...this.startPos},
                            endPos : {...this.endPos},
                        });
                        break;
                    case Hammer.DIRECTION_DOWN: 
                        callback({
                            type: InteractionType.SwipeDown,
                            startPos : {...this.startPos},
                            endPos : {...this.endPos},
                        });
                        break;
                }
            }

            this.ingorePointerUntil = performance.now() + 200;

            // reset
            this.move = false;
            this.isSwiping = false;
        })

    }

    // tap, press
    private initPointerEvent(callback: (e: InteractionEvent) => void){

        const pressThreshold = 500;
        const doubleTapThreshold = 300;
        
        // ~ désactive le menu clic droit 
        this.element.addEventListener('contextmenu', (e) => {
            e.preventDefault();
        })

        // pointer down, un doigt appuie
        this.element.addEventListener('pointerdown', (e) => {
            this.activePointers.set(e.pointerId, e);
            if (this.activePointers.size === 1) {
                this.downtime = performance.now();
                if (this.mapProject){
                    let coord = this.mapProject(e.clientX, e.clientY);
                    this.startPos = {x: coord.lat, y: coord.lng}
                }
                else{
                    this.startPos.x = e.clientX;
                    this.startPos.y = e.clientY;
                }
            }
            callback({
                type: InteractionType.PointerDown,
                fingers: this.activePointers.size,
                startPos : {...this.startPos},
            });
        })

        // pointer-up
        this.element.addEventListener('pointerup', (e) => {

            if (performance.now() < this.ingorePointerUntil){
                this.activePointers.delete(e.pointerId);
                return;
            }

            if (this.mapProject){
                let coord = this.mapProject(e.clientX, e.clientY);
                this.endPos = {x: coord.lat, y: coord.lng}
            }
            else{
                this.endPos.x = e.clientX;
                this.endPos.y = e.clientY;
            }
            
            if (!this.isSwiping){
                // press
                if (performance.now() - this.downtime >= pressThreshold){
                    callback({
                        type: InteractionType.PointerPress,
                        fingers: this.activePointers.size,
                        startPos : {...this.startPos},
                        endPos : {...this.endPos}
                    });
                }
                // double tap
                else if(performance.now()- this.lastTapTime < doubleTapThreshold){
                    // annule le single tap
                    if (this.tapTimeout){
                        clearTimeout(this.tapTimeout);
                        this.tapTimeout = null;
                    }
                    callback({
                        type: InteractionType.PointerDoubleTap,
                        fingers: this.activePointers.size,
                        startPos : {...this.startPos},
                        endPos : {...this.endPos}
                    });
                    this.lastTapTime = 0;

                }
                // single tap
                else{
                    this.lastTapFingers = this.activePointers.size;
                    this.tapTimeout = setTimeout(() => {
                        callback({
                            type: InteractionType.PointerSingleTap,
                            fingers: this.lastTapFingers,
                            startPos : {...this.startPos},
                            endPos : {...this.endPos}
                        }); 
                    }, 300)
                }
                this.lastTapTime = performance.now();
            }
            this.activePointers.delete(e.pointerId);
        })

        // pas sûr de ça 
        this.element.addEventListener('pointercancel', (e) => {
            /*
            if (this.tapTimeout) {
                clearTimeout(this.tapTimeout);
                this.tapTimeout = null;
            }
            */

            callback({
                type: InteractionType.PointerDelete,
                fingers: this.lastTapFingers,
                startPos : {...this.startPos},
                endPos : {...this.endPos}
            }); 
            this.activePointers.delete(e.pointerId)
        })



    }
}