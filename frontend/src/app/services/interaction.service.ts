import { Injectable } from '@angular/core';

export type SwipeDirection = 'left' | 'right' | 'up' | 'down';
export type FourFingerPosition = 'top' | 'bottom';

export interface InteractionCallbacks {
  onTap?: (center: {x: number, y: number}) => void;
  onDoubleTap?: (center: {x: number, y: number}) => void;
  onSwipe?: (direction: SwipeDirection, fingers: number) => void;
  onLongPress?: (center: {x: number, y: number}) => void;
  onPinch?: (delta: number, scale: number, center: {x: number, y: number}) => void;
  onRotate?: (angle: number, center: {x: number, y: number}) => void;
  onTwoFingerTap?: (center: {x: number, y: number}) => void;
  onThreeFingerTap?: (center: {x: number, y: number}) => void;
  onThreeFingerDoubleTap?: (center: {x: number, y: number}) => void;
  onFourFingerTap?: (position: FourFingerPosition, center: {x: number, y: number}) => void;
  onMove?: (center: {x: number, y: number}, fingers: number) => void;
  onDown?: (center: {x: number, y: number}, fingers: number) => void;
  onUp?: (center: {x: number, y: number}, fingers: number) => void;
}

@Injectable({
  providedIn: 'root'
})
export class InteractionService {
  private activePointers: Map<number, PointerEvent> = new Map();
  private element: HTMLElement | null = null;
  private callbacks: InteractionCallbacks = {};

  // Configuration
  private readonly TAP_THRESHOLD = 20; // pixels movement allowed for tap
  private readonly DOUBLE_TAP_DELAY = 300; // ms
  private readonly LONG_PRESS_DELAY = 500; // ms
  private readonly SWIPE_THRESHOLD = 50; // pixels
  private readonly SWIPE_TIMEOUT = 500; // ms

  // State
  private tapCount = 0;
  private tapTimeout: any = null;
  private longPressTimeout: any = null;
  private startPoints: Map<number, {x: number, y: number}> = new Map();
  private startTime: number = 0;
  private initialPinchDistance: number = 0;
  private initialRotateAngle: number = 0;
  private maxPointersInSession: number = 0;
  
  // For 3-finger double tap
  private threeFingerTapCount = 0;
  private threeFingerTapTimeout: any = null;

  constructor() {}

  init(element: HTMLElement, callbacks: InteractionCallbacks) {
    this.element = element;
    this.callbacks = callbacks;
    this.cleanup(); // Remove old listeners if any

    // Prevent default touch actions to handle gestures manually
    this.element.style.touchAction = 'none';

    // Bind methods to preserve 'this'
    this.handlePointerDown = this.handlePointerDown.bind(this);
    this.handlePointerMove = this.handlePointerMove.bind(this);
    this.handlePointerUp = this.handlePointerUp.bind(this);

    this.element.addEventListener('pointerdown', this.handlePointerDown, { capture: true });
    this.element.addEventListener('pointermove', this.handlePointerMove, { capture: true });
    this.element.addEventListener('pointerup', this.handlePointerUp, { capture: true });
    this.element.addEventListener('pointercancel', this.handlePointerUp, { capture: true });
    this.element.addEventListener('pointerleave', this.handlePointerUp, { capture: true });
    
    // Disable context menu for long press
    this.element.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  destroy() {
    this.cleanup();
  }

  private cleanup() {
    if (!this.element) return;
    this.element.removeEventListener('pointerdown', this.handlePointerDown, { capture: true });
    this.element.removeEventListener('pointermove', this.handlePointerMove, { capture: true });
    this.element.removeEventListener('pointerup', this.handlePointerUp, { capture: true });
    this.element.removeEventListener('pointercancel', this.handlePointerUp, { capture: true });
    this.element.removeEventListener('pointerleave', this.handlePointerUp, { capture: true });
    this.element.removeEventListener('contextmenu', (e) => e.preventDefault());
  }

  private handlePointerDown(event: PointerEvent) 
{
    if (this.activePointers.size === 0) {
      this.maxPointersInSession = 0;
      this.startTime = Date.now();
    }

    this.activePointers.set(event.pointerId, event);
    this.startPoints.set(event.pointerId, {x: event.clientX, y: event.clientY});
    this.maxPointersInSession = Math.max(this.maxPointersInSession, this.activePointers.size);

    if (this.activePointers.size === 1) {
      // Start Long Press Timer
      this.longPressTimeout = setTimeout(() => {
        if (this.activePointers.size === 1 && this.callbacks.onLongPress) {
           const p = this.activePointers.values().next().value;
           if (p) {
             this.callbacks.onLongPress({x: p.clientX, y: p.clientY});
           }
        }
      }, this.LONG_PRESS_DELAY);
    } else if (this.activePointers.size === 2) {
      // Initialize Pinch/Rotate
      const points = Array.from(this.activePointers.values());
      this.initialPinchDistance = this.getDistance(points[0], points[1]);
      this.initialRotateAngle = this.getAngle(points[0], points[1]);
      clearTimeout(this.longPressTimeout); // Cancel long press if 2nd finger down
    } else {
      clearTimeout(this.longPressTimeout);
    }

    // Trigger onDown
    if (this.callbacks.onDown) {
      const points = Array.from(this.activePointers.values());
      const center = this.getCenter(points);
      this.callbacks.onDown(center, this.activePointers.size);
    }
  }

  private handlePointerMove(event: PointerEvent) {
    // event.preventDefault();
    if (!this.activePointers.has(event.pointerId)) return;
    
    this.activePointers.set(event.pointerId, event);

    // Check movement for Long Press cancellation
    const start = this.startPoints.get(event.pointerId);
    if (start && this.getDistanceBetween(start.x, start.y, event.clientX, event.clientY) > this.TAP_THRESHOLD) {
      clearTimeout(this.longPressTimeout);
    }

    if (this.activePointers.size === 2) {
      const points = Array.from(this.activePointers.values());
      const center = this.getCenter(points);
      
      // Pinch
      if (this.callbacks.onPinch) {
        const currentDistance = this.getDistance(points[0], points[1]);
        const scale = this.initialPinchDistance > 0 ? currentDistance / this.initialPinchDistance : 1;
        const delta = currentDistance - this.initialPinchDistance;
        this.callbacks.onPinch(delta, scale, center);
      }

      // Rotate
      if (this.callbacks.onRotate) {
        const currentAngle = this.getAngle(points[0], points[1]);
        const angle = currentAngle - this.initialRotateAngle;
        this.callbacks.onRotate(angle, center);
      }
    }

    // Trigger onMove
    if (this.callbacks.onMove) {
      const points = Array.from(this.activePointers.values());
      const center = this.getCenter(points);
      this.callbacks.onMove(center, this.activePointers.size);
    }
  }

  private handlePointerUp(event: PointerEvent) {
    // event.preventDefault();
    if (!this.activePointers.has(event.pointerId)) return;

    const start = this.startPoints.get(event.pointerId);
    const end = {x: event.clientX, y: event.clientY};
    const duration = Date.now() - this.startTime;
    const distance = start ? this.getDistanceBetween(start.x, start.y, end.x, end.y) : 0;

    this.activePointers.delete(event.pointerId);
    this.startPoints.delete(event.pointerId);
    clearTimeout(this.longPressTimeout);

    // Trigger onUp
    if (this.callbacks.onUp) {
      this.callbacks.onUp(end, this.activePointers.size + 1); // +1 because we just deleted one
    }

    if (this.activePointers.size === 0) {
      // All fingers lifted. Analyze gesture based on maxPointersInSession.
      
      // Swipe Detection (1 or 3 fingers)
      if (distance > this.SWIPE_THRESHOLD && duration < this.SWIPE_TIMEOUT) {
        const dir = this.getSwipeDirection(start!, end);
        if (this.maxPointersInSession === 1 && this.callbacks.onSwipe) {
           this.callbacks.onSwipe(dir, 1);
        } else if (this.maxPointersInSession === 3 && this.callbacks.onSwipe) {
           this.callbacks.onSwipe(dir, 3);
        }
        return; // It was a swipe, not a tap
      }

      // Tap Detection (minimal movement)
      if (distance < this.TAP_THRESHOLD) {
        if (this.maxPointersInSession === 1) {
          this.handleSingleFingerTap(end);
        } else if (this.maxPointersInSession === 2 && this.callbacks.onTwoFingerTap) {
          this.callbacks.onTwoFingerTap(end);
        } else if (this.maxPointersInSession === 3) {
          this.handleThreeFingerTap(end);
        } else if (this.maxPointersInSession === 4 && this.callbacks.onFourFingerTap) {
          const position = end.y < (window.innerHeight / 2) ? 'top' : 'bottom';
          this.callbacks.onFourFingerTap(position, end);
        }
      }
    }
  }

  private handleSingleFingerTap(center: {x: number, y: number}) {
    this.tapCount++;
    if (this.tapCount === 1) {
      this.tapTimeout = setTimeout(() => {
        if (this.callbacks.onTap) this.callbacks.onTap(center);
        this.tapCount = 0;
      }, this.DOUBLE_TAP_DELAY);
    } else if (this.tapCount === 2) {
      clearTimeout(this.tapTimeout);
      if (this.callbacks.onDoubleTap) this.callbacks.onDoubleTap(center);
      this.tapCount = 0;
    }
  }

  private handleThreeFingerTap(center: {x: number, y: number}) {
    this.threeFingerTapCount++;
    if (this.threeFingerTapCount === 1) {
      this.threeFingerTapTimeout = setTimeout(() => {
        if (this.callbacks.onThreeFingerTap) this.callbacks.onThreeFingerTap(center);
        this.threeFingerTapCount = 0;
      }, this.DOUBLE_TAP_DELAY);
    } else if (this.threeFingerTapCount === 2) {
      clearTimeout(this.threeFingerTapTimeout);
      if (this.callbacks.onThreeFingerDoubleTap) this.callbacks.onThreeFingerDoubleTap(center);
      this.threeFingerTapCount = 0;
    }
  }

  // Helpers
  private getDistance(p1: PointerEvent, p2: PointerEvent): number {
    return Math.sqrt(Math.pow(p2.clientX - p1.clientX, 2) + Math.pow(p2.clientY - p1.clientY, 2));
  }

  private getDistanceBetween(x1: number, y1: number, x2: number, y2: number): number {
    return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
  }

  private getCenter(points: PointerEvent[]): {x: number, y: number} {
    const x = points.reduce((sum, p) => sum + p.clientX, 0) / points.length;
    const y = points.reduce((sum, p) => sum + p.clientY, 0) / points.length;
    return {x, y};
  }

  private getAngle(p1: PointerEvent, p2: PointerEvent): number {
    return Math.atan2(p2.clientY - p1.clientY, p2.clientX - p1.clientX) * 180 / Math.PI;
  }

  private getSwipeDirection(start: {x: number, y: number}, end: {x: number, y: number}): SwipeDirection {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    if (Math.abs(dx) > Math.abs(dy)) {
      return dx > 0 ? 'right' : 'left';
    } else {
      return dy > 0 ? 'down' : 'up';
    }
  }
}
