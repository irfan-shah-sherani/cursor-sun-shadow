// src/index.ts

// 1. Define the Interface so users get perfect autocomplete in their editors
export interface CursorSunShadowOptions {
  elements?: string | Element | NodeList | Element[];
  minBlur?: number;
  maxBlur?: number;
  minSpread?: number;
  maxSpread?: number;
  minAlpha?: number;
  maxAlpha?: number;
  maxOffset?: number;
  maxDistance?: number | null;
  color?: string;
  inset?: boolean;
  ease?: number;
  multiLayer?: boolean;
  onUpdate?: ((
    el: Element, 
    shadowCSS: string, 
    details: { dist: number; t: number; offsetX: number; offsetY: number; blur: number; spread: number; alpha: number }
  ) => void) | null;
}

export class CursorSunShadow {
  public options: Required<CursorSunShadowOptions>;
  public elements: Element[];
  private mouseX: number;
  private mouseY: number;
  private targetX: number;
  private targetY: number;
  private _rafId: number | null = null;
  private _running: boolean = false;
  private _maxDistanceCache: number | null = null;

  constructor(options: CursorSunShadowOptions = {}) {
    // SSR Guard: Safely fallback if window is not defined during server build
    const isBrowser = typeof window !== 'undefined';

    this.options = Object.assign({
      elements: '.shadowed',
      minBlur: 2,
      maxBlur: 50,
      minSpread: -2,
      maxSpread: 8,
      minAlpha: 0.1,
      maxAlpha: 0.45,
      maxOffset: 60,
      maxDistance: null,
      color: '0,0,0',
      inset: false,
      ease: 0.15,
      multiLayer: false,
      onUpdate: null
    }, options) as Required<CursorSunShadowOptions>;

    this.elements = this._resolveElements(this.options.elements);
    this.mouseX = isBrowser ? window.innerWidth / 2 : 0;
    this.mouseY = isBrowser ? window.innerHeight / 2 : 0;
    this.targetX = this.mouseX;
    this.targetY = this.mouseY;

    this._onMouseMove = this._onMouseMove.bind(this);
    this._onScroll = this._onScroll.bind(this);
    this._onResize = this._onResize.bind(this);
    this._tick = this._tick.bind(this);
    
    if (isBrowser) {
        this.start(); 
      }
  }

  private _resolveElements(input: any): Element[] {
    if (typeof window === 'undefined') return []; // SSR Guard
    if (typeof input === 'string') return Array.from(document.querySelectorAll(input));
    if (input instanceof Element) return [input];
    if (input instanceof NodeList || Array.isArray(input)) return Array.from(input as any);
    return [];
  }

  private _onMouseMove(e: MouseEvent) {
    this.targetX = e.clientX;
    this.targetY = e.clientY;
  }

  private _onScroll() {
    this._updateAll();
  }

  private _onResize() {
    this._maxDistanceCache = null;
    this._updateAll();
  }

  private _getMaxDistance(): number {
    if (this.options.maxDistance) return this.options.maxDistance;
    if (!this._maxDistanceCache && typeof window !== 'undefined') {
      this._maxDistanceCache = Math.hypot(window.innerWidth, window.innerHeight);
    }
    return this._maxDistanceCache || 1000;
  }

  private _lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
  }

  private _updateAll() {
    const o = this.options;
    const maxDist = this._getMaxDistance();

    this.elements.forEach(el => {
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;

      const dx = cx - this.mouseX;
      const dy = cy - this.mouseY;
      const dist = Math.hypot(dx, dy);

      const t = Math.min(dist / maxDist, 1);

      const offsetX = (dx / (dist || 1)) * t * o.maxOffset;
      const offsetY = (dy / (dist || 1)) * t * o.maxOffset;

      const blur = this._lerp(o.minBlur, o.maxBlur, t);
      const spread = this._lerp(o.minSpread, o.maxSpread, t);
      const alpha = this._lerp(o.minAlpha, o.maxAlpha, t);

      const insetStr = o.inset ? 'inset ' : '';
      let shadow = `${insetStr}${offsetX.toFixed(2)}px ${offsetY.toFixed(2)}px ${blur.toFixed(2)}px ${spread.toFixed(2)}px rgba(${o.color},${alpha.toFixed(3)})`;

      if (o.multiLayer) {
        const blur2 = blur * 0.4;
        const alpha2 = Math.min(alpha * 1.4, 1);
        shadow += `, ${insetStr}${(offsetX * 0.4).toFixed(2)}px ${(offsetY * 0.4).toFixed(2)}px ${blur2.toFixed(2)}px 0px rgba(${o.color},${alpha2.toFixed(3)})`;
      }

      if (typeof o.onUpdate === 'function') {
        o.onUpdate(el, shadow, { dist, t, offsetX, offsetY, blur, spread, alpha });
      } else if (el instanceof HTMLElement) {
        el.style.boxShadow = shadow;
      }
    });
  }

  private _tick() {
    const ease = this.options.ease;
    this.mouseX = this._lerp(this.mouseX, this.targetX, ease);
    this.mouseY = this._lerp(this.mouseY, this.targetY, ease);

    this._updateAll();
    this._rafId = requestAnimationFrame(this._tick);
  }

  public start() {
    if (typeof window === 'undefined' || this._running) return;
    this._running = true;
    document.addEventListener('mousemove', this._onMouseMove);
    document.addEventListener('scroll', this._onScroll, { passive: true });
    window.addEventListener('resize', this._onResize);
    this._tick();
  }

  public stop() {
    if (!this._running) return;
    this._running = false;
    if (this._rafId) cancelAnimationFrame(this._rafId);
    document.removeEventListener('mousemove', this._onMouseMove);
    document.removeEventListener('scroll', this._onScroll);
    window.removeEventListener('resize', this._onResize);
  }

  public refresh() {
    this._maxDistanceCache = null;
    this._updateAll();
  }

  public updateOptions(newOptions: CursorSunShadowOptions = {}) {
    Object.assign(this.options, newOptions);
  }

  public addElements(els: any) {
    this.elements.push(...this._resolveElements(els));
  }

  public destroy() {
    this.stop();
    this.elements.forEach(el => {
      if (el instanceof HTMLElement) el.style.boxShadow = '';
    });
    this.elements = [];
  }
}