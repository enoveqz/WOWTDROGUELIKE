import type { Action } from '../config/keybinds.ts';

/**
 * Eingabeverwaltung. Tastatur wird über KeyboardEvent.code auf Aktionen
 * abgebildet (frei belegbar). Mauseingaben zählen nur auf der Spielfläche,
 * damit Klicks auf UI-Elemente niemals Kampfaktionen auslösen.
 */
export class Input {
  private down = new Set<string>();
  private pressedCodes = new Set<string>();
  private keys: Record<Action, string>;
  private canvas: HTMLCanvasElement;
  /** Normalisierte Gerätekoordinaten (-1..1). */
  readonly mouse = { x: 0, y: 0, inside: false };
  mouseDown = false;
  mouseClicked = false;
  rightDown = false;
  dragDX = 0;
  wheel = 0;
  /** Wird gesetzt, wenn ein Menü Tastatureingaben beansprucht (z. B. Tastenbelegung). */
  captureNext: ((code: string) => void) | null = null;
  private listeners: [EventTarget, string, EventListener, AddEventListenerOptions?][] = [];

  constructor(canvas: HTMLCanvasElement, keys: Record<Action, string>) {
    this.canvas = canvas;
    this.keys = keys;
    this.listen(window, 'keydown', (e) => this.onKeyDown(e as KeyboardEvent));
    this.listen(window, 'keyup', (e) => this.down.delete((e as KeyboardEvent).code));
    this.listen(window, 'blur', () => this.releaseAll());
    this.listen(canvas, 'pointermove', (e) => this.onMove(e as PointerEvent));
    this.listen(canvas, 'pointerdown', (e) => this.onPointerDown(e as PointerEvent));
    this.listen(window, 'pointerup', (e) => this.onPointerUp(e as PointerEvent));
    this.listen(canvas, 'pointerleave', () => (this.mouse.inside = false));
    this.listen(canvas, 'contextmenu', (e) => e.preventDefault());
    this.listen(canvas, 'wheel', (e) => {
      this.wheel += Math.sign((e as WheelEvent).deltaY);
      e.preventDefault();
    }, { passive: false });
  }

  private listen(t: EventTarget, type: string, fn: EventListener, opts?: AddEventListenerOptions) {
    t.addEventListener(type, fn, opts);
    this.listeners.push([t, type, fn, opts]);
  }

  setKeys(keys: Record<Action, string>): void {
    this.keys = keys;
  }

  private onKeyDown(e: KeyboardEvent): void {
    const target = e.target as HTMLElement | null;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
    if (this.captureNext) {
      e.preventDefault();
      const cb = this.captureNext;
      this.captureNext = null;
      cb(e.code);
      return;
    }
    if (e.code === 'Space' || e.code === 'Tab' || e.code.startsWith('Arrow')) e.preventDefault();
    if (!e.repeat) this.pressedCodes.add(e.code);
    this.down.add(e.code);
  }

  private onMove(e: PointerEvent): void {
    const r = this.canvas.getBoundingClientRect();
    this.mouse.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    this.mouse.y = -((e.clientY - r.top) / r.height) * 2 + 1;
    this.mouse.inside = true;
    if (this.rightDown) this.dragDX += e.movementX;
  }

  private onPointerDown(e: PointerEvent): void {
    this.onMove(e);
    if (e.button === 0) {
      this.mouseDown = true;
      this.mouseClicked = true;
    } else if (e.button === 2) {
      this.rightDown = true;
    }
  }

  private onPointerUp(e: PointerEvent): void {
    if (e.button === 0) this.mouseDown = false;
    if (e.button === 2) this.rightDown = false;
  }

  releaseAll(): void {
    this.down.clear();
    this.pressedCodes.clear();
    this.mouseDown = false;
    this.rightDown = false;
    this.mouseClicked = false;
  }

  held(a: Action): boolean {
    return this.down.has(this.keys[a]);
  }

  pressed(a: Action): boolean {
    return this.pressedCodes.has(this.keys[a]);
  }

  /** Für UI-Shortcuts (z. B. 1–3 im Turmmenü) unabhängig von Aktionen. */
  pressedCode(code: string): boolean {
    return this.pressedCodes.has(code);
  }

  /** Am Ende jedes Frames aufrufen. */
  endFrame(): void {
    this.pressedCodes.clear();
    this.mouseClicked = false;
    this.wheel = 0;
    this.dragDX = 0;
  }

  dispose(): void {
    for (const [t, type, fn, opts] of this.listeners) t.removeEventListener(type, fn, opts);
    this.listeners = [];
  }
}
