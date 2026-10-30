import type { Action } from '../config/keybinds.ts';

export interface Click {
  x: number;
  y: number;
}

/**
 * Eingabeverwaltung im Stil klassischer MMORPGs:
 * - Linke Maustaste ziehen: Kamera drehen (Figur bleibt)
 * - Rechte Maustaste ziehen: Kamera drehen, Figur dreht mit
 * - Beide Tasten gedrückt: vorwärts laufen
 * - Kurzer Klick (ohne Ziehen): links = Ziel wählen, rechts = angreifen/interagieren
 * Tastatur wird über KeyboardEvent.code auf Aktionen abgebildet (frei belegbar).
 * Mauseingaben zählen nur auf der Spielfläche – Klicks auf UI lösen keine Kampfaktionen aus.
 */
export class Input {
  private down = new Set<string>();
  private pressedCodes = new Set<string>();
  private keys: Record<Action, string>;
  private canvas: HTMLCanvasElement;
  /** Normalisierte Gerätekoordinaten (-1..1). */
  readonly mouse = { x: 0, y: 0, inside: false };
  leftDown = false;
  rightDown = false;
  /** Taste gedrückt und über die Klickschwelle hinaus bewegt. */
  leftDrag = false;
  rightDrag = false;
  /** Mausbewegung (Pixel) seit letztem Frame während eines Zieh-Vorgangs. */
  lookDX = 0;
  lookDY = 0;
  leftClick: Click | null = null;
  rightClick: Click | null = null;
  wheel = 0;
  private downPos = [{ x: 0, y: 0, moved: 0 }, { x: 0, y: 0, moved: 0 }];
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
    this.listen(canvas, 'pointerup', (e) => this.onPointerUp(e as PointerEvent));
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

  private setNdc(e: PointerEvent): void {
    const r = this.canvas.getBoundingClientRect();
    this.mouse.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    this.mouse.y = -((e.clientY - r.top) / r.height) * 2 + 1;
    this.mouse.inside = true;
  }

  /**
   * Liest den echten Tastenzustand aus e.buttons. Wichtig: Wird eine zweite
   * Maustaste gedrückt, während die erste gehalten wird, feuert der Browser
   * kein pointerdown, sondern nur pointermove – deshalb kein button-basiertes
   * Down/Up-Tracking.
   */
  private syncButtons(e: PointerEvent): void {
    const left = (e.buttons & 1) !== 0;
    const right = (e.buttons & 2) !== 0;
    for (const [i, now] of [[0, left], [1, right]] as const) {
      const was = i === 0 ? this.leftDown : this.rightDown;
      if (now && !was) {
        this.downPos[i] = { x: this.mouse.x, y: this.mouse.y, moved: 0 };
        if (i === 0) this.leftDown = true;
        else this.rightDown = true;
      } else if (!now && was) {
        const dragged = i === 0 ? this.leftDrag : this.rightDrag;
        const p = this.downPos[i];
        if (!dragged) {
          if (i === 0) this.leftClick = { x: p.x, y: p.y };
          else this.rightClick = { x: p.x, y: p.y };
        }
        if (i === 0) ((this.leftDown = false), (this.leftDrag = false));
        else ((this.rightDown = false), (this.rightDrag = false));
      }
    }
    if (!this.leftDown && !this.rightDown) this.endLook();
  }

  private onMove(e: PointerEvent): void {
    const dragging = this.leftDown || this.rightDown;
    if (!dragging) this.setNdc(e);
    this.syncButtons(e);
    if (!this.leftDown && !this.rightDown) return;
    const mx = e.movementX || 0;
    const my = e.movementY || 0;
    if (this.leftDown) this.downPos[0].moved += Math.abs(mx) + Math.abs(my);
    if (this.rightDown) this.downPos[1].moved += Math.abs(mx) + Math.abs(my);
    if (this.leftDown && this.downPos[0].moved > 4) this.leftDrag = true;
    if (this.rightDown && this.downPos[1].moved > 4) this.rightDrag = true;
    if (this.leftDrag || this.rightDrag) {
      this.lookDX += mx;
      this.lookDY += my;
      this.beginLook();
    }
  }

  private onPointerDown(e: PointerEvent): void {
    if (!this.leftDown && !this.rightDown) this.setNdc(e);
    this.syncButtons(e);
    try {
      this.canvas.setPointerCapture(e.pointerId);
    } catch {
      /* optional */
    }
  }

  private onPointerUp(e: PointerEvent): void {
    this.syncButtons(e);
  }

  /** Maus fangen (optional) bzw. Cursor verstecken, solange gedreht wird. */
  private looking = false;
  pointerLock = false;
  private beginLook(): void {
    if (this.looking) return;
    this.looking = true;
    this.canvas.style.cursor = 'none';
    if (this.pointerLock && document.pointerLockElement !== this.canvas) {
      try {
        const r = this.canvas.requestPointerLock() as unknown;
        if (r instanceof Promise) r.catch(() => undefined);
      } catch {
        /* nicht verfügbar */
      }
    }
  }

  private endLook(): void {
    if (!this.looking) return;
    this.looking = false;
    this.canvas.style.cursor = '';
    if (document.pointerLockElement === this.canvas) document.exitPointerLock();
  }

  releaseAll(): void {
    this.down.clear();
    this.pressedCodes.clear();
    this.leftDown = this.rightDown = this.leftDrag = this.rightDrag = false;
    this.leftClick = this.rightClick = null;
    this.lookDX = this.lookDY = 0;
    this.endLook();
  }

  held(a: Action): boolean {
    return this.down.has(this.keys[a]);
  }

  pressed(a: Action): boolean {
    return this.pressedCodes.has(this.keys[a]);
  }

  pressedCode(code: string): boolean {
    return this.pressedCodes.has(code);
  }

  /** Am Ende jedes Frames aufrufen. */
  endFrame(): void {
    this.pressedCodes.clear();
    this.leftClick = this.rightClick = null;
    this.wheel = 0;
    this.lookDX = this.lookDY = 0;
  }

  dispose(): void {
    for (const [t, type, fn, opts] of this.listeners) t.removeEventListener(type, fn, opts);
    this.listeners = [];
  }
}
