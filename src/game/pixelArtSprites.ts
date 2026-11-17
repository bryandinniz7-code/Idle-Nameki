import { getTransformationById } from './engine.ts';
import type { RaceId } from './types.ts';

export type FacingDir = 'down' | 'up' | 'left' | 'right';
export const SPRITE_SIZE = 64;

interface WarriorPalette {
  outline: string;
  skin: string;
  skinShadow: string;
  skinDeep: string;
  skinHighlight: string;
  hair: string;
  hairShadow: string;
  hairHighlight: string;
  eye: string;
  brow: string;
  giMain: string;
  giShadow: string;
  giHighlight: string;
  undershirt: string;
  undershirtShadow: string;
  belt: string;
  beltHighlight: string;
  boots: string;
  bootsShadow: string;
  bootTrim: string;
  cape: string;
  capeShadow: string;
  aura: string;
  isTransformed: boolean;
  isKaioken: boolean;
  isSSJ3: boolean;
  isUI: boolean;
  isGodOrBlue: boolean;
  isYamchaUI: boolean;
  isFused: boolean;
}

// ============================================================================
// COLOR MATH & HUE-SHIFTED CEL-SHADING HELPERS
// ============================================================================
function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return [128, 128, 128];
  const n = parseInt(clean, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex(r: number, g: number, b: number): string {
  const cr = Math.max(0, Math.min(255, Math.round(r)));
  const cg = Math.max(0, Math.min(255, Math.round(g)));
  const cb = Math.max(0, Math.min(255, Math.round(b)));
  return `#${((1 << 24) | (cr << 16) | (cg << 8) | cb).toString(16).slice(1)}`;
}

function mixHex(hexA: string, hexB: string, t: number): string {
  const [ar, ag, ab] = hexToRgb(hexA);
  const [br, bg, bb] = hexToRgb(hexB);
  return rgbToHex(ar + (br - ar) * t, ag + (bg - ag) * t, ab + (bb - ab) * t);
}

/** Cool-shifted deep shadow & warm-shifted specular tones */
function shadeColor(hex: string, amount: number): string {
  if (amount < 0) {
    return mixHex(hex, '#0b0e1e', Math.min(0.85, Math.abs(amount)));
  }
  return mixHex(hex, '#fffbeb', Math.min(0.85, amount));
}

// ============================================================================
// 16-BIT PIXEL ART RASTERIZER (ANATOMICAL CURVES, CAPSULES, SEL-OUT)
// ============================================================================
class PixelGrid {
  readonly w: number;
  readonly h: number;
  readonly cells: (string | null)[];

  constructor(w = SPRITE_SIZE, h = SPRITE_SIZE) {
    this.w = w;
    this.h = h;
    this.cells = new Array<string | null>(w * h).fill(null);
  }

  set(x: number, y: number, color: string | null) {
    const ix = Math.round(x);
    const iy = Math.round(y);
    if (ix < 0 || ix >= this.w || iy < 0 || iy >= this.h) return;
    this.cells[iy * this.w + ix] = color;
  }

  get(x: number, y: number): string | null {
    const ix = Math.round(x);
    const iy = Math.round(y);
    if (ix < 0 || ix >= this.w || iy < 0 || iy >= this.h) return null;
    return this.cells[iy * this.w + ix];
  }

  rect(x: number, y: number, w: number, h: number, color: string | null) {
    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) {
        this.set(x + dx, y + dy, color);
      }
    }
  }

  symRect(y: number, halfW: number, h: number, color: string, cx = 32) {
    for (let dy = 0; dy < h; dy++) {
      for (let x = cx - halfW; x < cx + halfW; x++) {
        this.set(x, y + dy, color);
      }
    }
  }

  line(x0: number, y0: number, x1: number, y1: number, color: string | null) {
    let ix0 = Math.round(x0);
    let iy0 = Math.round(y0);
    const ix1 = Math.round(x1);
    const iy1 = Math.round(y1);
    const dx = Math.abs(ix1 - ix0);
    const dy = -Math.abs(iy1 - iy0);
    const sx = ix0 < ix1 ? 1 : -1;
    const sy = iy0 < iy1 ? 1 : -1;
    let err = dx + dy;
    while (true) {
      this.set(ix0, iy0, color);
      if (ix0 === ix1 && iy0 === iy1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        ix0 += sx;
      }
      if (e2 <= dx) {
        err += dx;
        iy0 += sy;
      }
    }
  }

  ellipse(cx: number, cy: number, rx: number, ry: number, color: string | null) {
    const x0 = Math.floor(cx - rx);
    const x1 = Math.ceil(cx + rx);
    const y0 = Math.floor(cy - ry);
    const y1 = Math.ceil(cy + ry);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const nx = (x - cx) / Math.max(0.5, rx);
        const ny = (y - cy) / Math.max(0.5, ry);
        if (nx * nx + ny * ny <= 1) {
          this.set(x, y, color);
        }
      }
    }
  }

  /** Cel-shaded sphere/dome with top-left highlight & bottom-right shadow */
  shadedSphere(
    cx: number,
    cy: number,
    rx: number,
    ry: number,
    main: string,
    shadow = shadeColor(main, -0.35),
    hi = shadeColor(main, 0.36)
  ) {
    const x0 = Math.floor(cx - rx);
    const x1 = Math.ceil(cx + rx);
    const y0 = Math.floor(cy - ry);
    const y1 = Math.ceil(cy + ry);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const nx = (x - cx) / Math.max(0.5, rx);
        const ny = (y - cy) / Math.max(0.5, ry);
        const d = nx * nx + ny * ny;
        if (d <= 1) {
          const light = nx * -0.58 + ny * -0.68;
          if (light > 0.36 && d < 0.72) {
            this.set(x, y, hi);
          } else if (light < -0.22) {
            this.set(x, y, shadow);
          } else {
            this.set(x, y, main);
          }
        }
      }
    }
  }

  /** Tapered limb/tail capsule between (x0,y0) radius r0 and (x1,y1) radius r1 */
  capsule(
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    r0: number,
    r1: number,
    color: string | null
  ) {
    const maxR = Math.max(r0, r1) + 1;
    const minX = Math.max(0, Math.floor(Math.min(x0, x1) - maxR));
    const maxX = Math.min(this.w - 1, Math.ceil(Math.max(x0, x1) + maxR));
    const minY = Math.max(0, Math.floor(Math.min(y0, y1) - maxR));
    const maxY = Math.min(this.h - 1, Math.ceil(Math.max(y0, y1) + maxR));
    const vx = x1 - x0;
    const vy = y1 - y0;
    const lenSq = vx * vx + vy * vy;

    for (let py = minY; py <= maxY; py++) {
      for (let px = minX; px <= maxX; px++) {
        const t =
          lenSq > 0.0001
            ? Math.max(0, Math.min(1, ((px - x0) * vx + (py - y0) * vy) / lenSq))
            : 0;
        const projX = x0 + vx * t;
        const projY = y0 + vy * t;
        const r = r0 + (r1 - r0) * t;
        const distSq = (px - projX) * (px - projX) + (py - projY) * (py - projY);
        if (distSq <= r * r + 0.15) {
          this.set(px, py, color);
        }
      }
    }
  }

  /** 3-tone cel-shaded anatomical limb with top-left highlight & lower-right shadow */
  shadedLimb(
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    r0: number,
    r1: number,
    main: string,
    shadow = shadeColor(main, -0.34),
    hi = shadeColor(main, 0.28)
  ) {
    this.capsule(x0, y0, x1, y1, r0, r1, shadow);
    this.capsule(x0 - 0.35, y0 - 0.35, x1 - 0.35, y1 - 0.35, Math.max(0.8, r0 - 0.55), Math.max(0.8, r1 - 0.55), main);
    if (r0 >= 2 || r1 >= 2) {
      this.line(x0 - r0 * 0.45, y0 - r0 * 0.35, x1 - r1 * 0.4, y1 - r1 * 0.35, hi);
    }
  }

  /** Quadratic Bezier tapered curve for dynamic tails, hair locks, and horns */
  curve(
    x0: number,
    y0: number,
    cx: number,
    cy: number,
    x1: number,
    y1: number,
    r0: number,
    r1: number,
    color: string
  ) {
    const steps = 16;
    let prevX = x0;
    let prevY = y0;
    let prevR = r0;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const omt = 1 - t;
      const nx = omt * omt * x0 + 2 * omt * t * cx + t * t * x1;
      const ny = omt * omt * y0 + 2 * omt * t * cy + t * t * y1;
      const nr = r0 + (r1 - r0) * t;
      this.capsule(prevX, prevY, nx, ny, prevR, nr, color);
      prevX = nx;
      prevY = ny;
      prevR = nr;
    }
  }

  tri(x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, color: string) {
    this.poly(
      [
        [x0, y0],
        [x1, y1],
        [x2, y2],
      ],
      color
    );
  }

  poly(pts: [number, number][], color: string) {
    if (pts.length < 3) return;
    let minX = this.w - 1;
    let maxX = 0;
    let minY = this.h - 1;
    let maxY = 0;
    for (const [x, y] of pts) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
    minX = Math.max(0, Math.floor(minX));
    maxX = Math.min(this.w - 1, Math.ceil(maxX));
    minY = Math.max(0, Math.floor(minY));
    maxY = Math.min(this.h - 1, Math.ceil(maxY));

    for (let py = minY; py <= maxY; py++) {
      const sy = py + 0.5;
      const nodes: number[] = [];
      let j = pts.length - 1;
      for (let i = 0; i < pts.length; i++) {
        const [xi, yi] = pts[i];
        const [xj, yj] = pts[j];
        if ((yi < sy && yj >= sy) || (yj < sy && yi >= sy)) {
          nodes.push(xi + ((sy - yi) / (yj - yi)) * (xj - xi));
        }
        j = i;
      }
      nodes.sort((a, b) => a - b);
      for (let k = 0; k + 1 < nodes.length; k += 2) {
        const startX = Math.max(minX, Math.floor(nodes[k]));
        const endX = Math.min(maxX, Math.ceil(nodes[k + 1] - 0.5));
        for (let px = startX; px <= endX; px++) {
          this.set(px, py, color);
        }
      }
    }
  }

  /**
   * 16-bit Selective Outline (Sel-Out) pass:
   * Darkens outer contour pixels relative to adjacent sprite hue for crisp, cohesive GBA/SNES separation
   */
  toCanvas(outlineColor = '#080a14'): HTMLCanvasElement {
    const out = [...this.cells];
    const dirs = [
      [0, -1],
      [-1, 0],
      [1, 0],
      [0, 1],
    ];
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (this.cells[y * this.w + x] !== null) continue;
        let sample: string | null = null;
        for (const [dx, dy] of dirs) {
          const n = this.get(x + dx, y + dy);
          if (n !== null) {
            sample = n;
            break;
          }
        }
        if (sample) {
          out[y * this.w + x] = mixHex(sample, outlineColor, 0.78);
        }
      }
    }

    const canvas = document.createElement('canvas');
    canvas.width = this.w;
    canvas.height = this.h;
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const c = out[y * this.w + x];
        if (!c) continue;
        ctx.fillStyle = c;
        ctx.fillRect(x, y, 1, 1);
      }
    }
    return canvas;
  }
}

// ============================================================================
// PALETTES
// ============================================================================
function getWarriorPalette(
  race: RaceId,
  transformationId: string,
  isFused = false
): WarriorPalette {
  const tf = getTransformationById(transformationId);
  const isTransformed = tf.id !== 'base';
  const isKaioken = tf.id === 'kaioken';
  const isSSJ3 = tf.id === 'ssj3';
  const isUI = tf.id === 'ultra_instinct';
  const isYamchaUI = tf.id === 'yamcha_ui';
  const isGodOrBlue = tf.id === 'ssg' || tf.id === 'ssb';

  let baseSkin = isYamchaUI
    ? { skin: '#f6bc87', shadow: '#d07a42', deep: '#853816', hi: '#ffe5cb' }
    : race === 'namekian'
    ? { skin: '#4ade80', shadow: '#16a34a', deep: '#14532d', hi: '#bbf7d0' }
    : race === 'frieza_clan'
    ? { skin: '#f8fafc', shadow: '#cbd5e1', deep: '#64748b', hi: '#ffffff' }
    : race === 'android'
    ? { skin: '#fbd8b2', shadow: '#cc8c5a', deep: '#7c4722', hi: '#fff1e0' }
    : { skin: '#f6bc87', shadow: '#d07a42', deep: '#853816', hi: '#ffe5cb' };

  if (isKaioken && race !== 'namekian' && race !== 'frieza_clan') {
    baseSkin = {
      skin: '#fb7185',
      shadow: '#be123c',
      deep: '#7f1d1d',
      hi: '#fecdd3',
    };
  }

  const outfit = isFused
    ? {
        main: '#111827',
        shadow: '#030712',
        hi: '#374151',
        under: '#facc15',
        underShadow: '#ca8a04',
        belt: '#0ea5e9',
        beltHi: '#7dd3fc',
        boots: '#0f172a',
        bootsShadow: '#020617',
        bootTrim: '#facc15',
        cape: '#facc15',
        capeShadow: '#b45309',
      }
    : isYamchaUI
    ? {
        main: '#ea580c',
        shadow: '#9a3412',
        hi: '#fb923c',
        under: '#1e3a8a',
        underShadow: '#172554',
        belt: '#38bdf8',
        beltHi: '#e0f2fe',
        boots: '#1e3a8a',
        bootsShadow: '#0f172a',
        bootTrim: '#facc15',
        cape: '#e0f2fe',
        capeShadow: '#94a3b8',
      }
    : race === 'namekian'
    ? {
        main: '#6d28d9',
        shadow: '#3b0764',
        hi: '#8b5cf6',
        under: '#1e1b4b',
        underShadow: '#0f0d2e',
        belt: '#dc2626',
        beltHi: '#f87171',
        boots: '#78350f',
        bootsShadow: '#451a03',
        bootTrim: '#facc15',
        cape: '#f8fafc',
        capeShadow: '#cbd5e1',
      }
    : race === 'saiyan'
    ? {
        main: '#1d4ed8',
        shadow: '#1e3a8a',
        hi: '#3b82f6',
        under: '#0f172a',
        underShadow: '#020617',
        belt: '#d97706',
        beltHi: '#facc15',
        boots: '#f8fafc',
        bootsShadow: '#cbd5e1',
        bootTrim: '#facc15',
        cape: '#78350f',
        capeShadow: '#451a03',
      }
    : race === 'frieza_clan'
    ? {
        main: '#f8fafc',
        shadow: '#cbd5e1',
        hi: '#ffffff',
        under: '#6b21a8',
        underShadow: '#3b0764',
        belt: '#9333ea',
        beltHi: '#d8b4fe',
        boots: '#f8fafc',
        bootsShadow: '#94a3b8',
        bootTrim: '#7e22ce',
        cape: '#7e22ce',
        capeShadow: '#4c1d95',
      }
    : race === 'android'
    ? {
        main: '#1e293b',
        shadow: '#0f172a',
        hi: '#475569',
        under: '#0f766e',
        underShadow: '#134e4a',
        belt: '#dc2626',
        beltHi: '#f87171',
        boots: '#111827',
        bootsShadow: '#030712',
        bootTrim: '#94a3b8',
        cape: '#dc2626',
        capeShadow: '#7f1d1d',
      }
    : {
        main: isKaioken ? '#dc2626' : '#ea580c',
        shadow: isKaioken ? '#991b1b' : '#c2410c',
        hi: isKaioken ? '#f87171' : '#fb923c',
        under: '#1e3a8a',
        underShadow: '#172554',
        belt: '#1d4ed8',
        beltHi: '#60a5fa',
        boots: '#1e3a8a',
        bootsShadow: '#0f172a',
        bootTrim: '#facc15',
        cape: '#38bdf8',
        capeShadow: '#0284c7',
      };

  let hairMain = '#151926';
  let hairShadow = '#090b12';
  let hairHi = '#475569';

  if (isKaioken) {
    hairMain = '#3f151d';
    hairShadow = '#7f1d1d';
    hairHi = '#f87171';
  } else if (isYamchaUI || isUI) {
    hairMain = '#e2e8f0';
    hairShadow = '#64748b';
    hairHi = '#ffffff';
  } else if (tf.id === 'ssg') {
    hairMain = '#e11d48';
    hairShadow = '#881337';
    hairHi = '#fda4af';
  } else if (tf.id === 'ssb') {
    hairMain = '#0ea5e9';
    hairShadow = '#0369a1';
    hairHi = '#bae6fd';
  } else if (isTransformed) {
    hairMain = '#facc15';
    hairShadow = '#b45309';
    hairHi = '#fef9c3';
  }

  return {
    outline: '#080a14',
    skin: baseSkin.skin,
    skinShadow: baseSkin.shadow,
    skinDeep: baseSkin.deep,
    skinHighlight: baseSkin.hi,
    hair: hairMain,
    hairShadow,
    hairHighlight: hairHi,
    eye: isTransformed ? tf.eyeColor : '#111827',
    brow: isTransformed && !isKaioken ? hairShadow : '#0b0e18',
    giMain: outfit.main,
    giShadow: outfit.shadow,
    giHighlight: outfit.hi,
    undershirt: outfit.under,
    undershirtShadow: outfit.underShadow,
    belt: outfit.belt,
    beltHighlight: outfit.beltHi,
    boots: outfit.boots,
    bootsShadow: outfit.bootsShadow,
    bootTrim: outfit.bootTrim,
    cape: outfit.cape,
    capeShadow: outfit.capeShadow,
    aura: tf.auraColor,
    isTransformed,
    isKaioken,
    isSSJ3,
    isUI,
    isGodOrBlue,
    isYamchaUI,
    isFused,
  };
}

const spriteCache = new Map<string, HTMLCanvasElement>();

// ============================================================================
// UPLOADED LEGACY OF GOKU (LOG-STYLE) SPRITE SHEET LOADER & RECOLOR ENGINE
// ============================================================================
export const LOG_SPRITE_SHEET_URL =
  '/assets/aistudio/dbvr_sprites___log_style__by_royalz_bho-d6pxgn4.png.b3d2bbf6e7eb22bf641a86a71acc89a6__1__d9b9fe8f.png';

interface SpriteRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const LOG_SPRITES = {
  bardock_scouter: { x: 3, y: 41, w: 25, h: 32 },
  bardock_oozaru: { x: 37, y: 9, w: 32, h: 64 },
  bardock_base: { x: 77, y: 41, w: 25, h: 32 },
  bardock_rage: { x: 112, y: 39, w: 18, h: 34 },
  bardock_ssj: { x: 140, y: 39, w: 18, h: 34 },
  bardock_ssj3: { x: 171, y: 39, w: 23, h: 34 },

  goku_base: { x: 2, y: 81, w: 25, h: 32 },
  goku_kaioken: { x: 40, y: 78, w: 25, h: 35 },
  goku_ssj: { x: 81, y: 79, w: 18, h: 34 },
  goku_buff: { x: 109, y: 79, w: 21, h: 34 },
  goku_ssj2: { x: 140, y: 79, w: 20, h: 34 },
  goku_ssj3: { x: 171, y: 79, w: 23, h: 34 },

  frieza_1: { x: 2, y: 133, w: 27, h: 26 },
  frieza_2: { x: 34, y: 127, w: 30, h: 32 },
  frieza_3: { x: 71, y: 127, w: 31, h: 32 },
  frieza_final: { x: 113, y: 128, w: 22, h: 31 },
  frieza_100: { x: 145, y: 128, w: 19, h: 31 },
  mecha_frieza: { x: 176, y: 129, w: 22, h: 30 },

  cooler_1: { x: 2, y: 196, w: 27, h: 26 },
  cooler_2: { x: 34, y: 190, w: 30, h: 32 },
  cooler_3: { x: 72, y: 190, w: 31, h: 32 },
  cooler_4: { x: 113, y: 190, w: 21, h: 31 },
  cooler_5: { x: 134, y: 170, w: 39, h: 52 },
  meta_cooler: { x: 179, y: 190, w: 21, h: 31 },

  vegeta_scouter: { x: 7, y: 258, w: 19, h: 32 },
  vegeta_oozaru: { x: 38, y: 228, w: 32, h: 61 },
  vegeta_base: { x: 83, y: 258, w: 17, h: 32 },
  vegeta_ssj: { x: 111, y: 255, w: 19, h: 35 },
  vegeta_ssj2: { x: 141, y: 255, w: 19, h: 35 },
  vegeta_majin: { x: 174, y: 256, w: 20, h: 34 },
} as const satisfies Record<string, SpriteRect>;

type LogSpriteId = keyof typeof LOG_SPRITES;
type LogRecolorKind = 'none' | 'ssg' | 'ssb' | 'ui' | 'gold_emperor' | 'black_emperor' | 'namekian';

let logSheetImage: HTMLImageElement | null = null;
let logSheetLoaded = false;
const sheetLoadListeners = new Set<() => void>();

export function onSpriteSheetLoaded(cb: () => void): () => void {
  if (logSheetLoaded) {
    cb();
    return () => {};
  }
  sheetLoadListeners.add(cb);
  return () => {
    sheetLoadListeners.delete(cb);
  };
}

if (typeof window !== 'undefined' && typeof Image !== 'undefined') {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    logSheetImage = img;
    logSheetLoaded = true;
    spriteCache.clear();
    for (const cb of sheetLoadListeners) {
      try {
        cb();
      } catch {
        // Ignore listener errors
      }
    }
  };
  img.src = LOG_SPRITE_SHEET_URL;
}

function applyLogRecolor(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  recolor: LogRecolorKind
) {
  if (recolor === 'none') return;
  const imgData = ctx.getImageData(0, 0, w, h);
  const d = imgData.data;

  for (let i = 0; i < d.length; i += 4) {
    const a = d[i + 3];
    if (a < 128) continue;
    const r = d[i];
    const g = d[i + 1];
    const b = d[i + 2];
    const y = Math.floor((i / 4) / w);

    // Preserve dark outlines
    if (r < 36 && g < 36 && b < 36) continue;

    if (recolor === 'namekian') {
      // Shift peach/tan skin tones -> Namekian emerald green
      const isSkin =
        (r >= 135 && g >= 90 && b >= 65 && r > g && g >= b - 10 && r - b >= 22 && r - g <= 95) ||
        (r >= 120 && r <= 185 && g >= 78 && g <= 135 && b >= 50 && b <= 105 && r > g && g > b);
      // Shift orange/brown gi tones -> Piccolo Demon Clan purple
      const isOrangeGi = r >= 115 && g >= 40 && g <= 155 && b <= 45 && r - b >= 85;
      if (isSkin) {
        const lum = (r * 0.3 + g * 0.59 + b * 0.11) / 255;
        d[i] = Math.round(28 + lum * 45);
        d[i + 1] = Math.round(105 + lum * 125);
        d[i + 2] = Math.round(45 + lum * 55);
      } else if (isOrangeGi) {
        const lum = (r * 0.3 + g * 0.59 + b * 0.11) / 255;
        d[i] = Math.round(80 + lum * 95);
        d[i + 1] = Math.round(24 + lum * 40);
        d[i + 2] = Math.round(125 + lum * 120);
      }
      continue;
    }

    if (recolor === 'gold_emperor') {
      // Shift silver/white armor plates to radiant Golden Frieza palette
      if (r > 165 && g > 165 && b > 165) {
        d[i] = Math.min(255, Math.round(r * 1.02));
        d[i + 1] = Math.round(g * 0.84);
        d[i + 2] = Math.round(b * 0.18);
      } else if (r > 110 && g > 110 && b > 125 && Math.abs(r - g) < 25) {
        d[i] = Math.min(255, Math.round(r * 1.15));
        d[i + 1] = Math.round(g * 0.78);
        d[i + 2] = Math.round(b * 0.12);
      }
      continue;
    }

    if (recolor === 'black_emperor') {
      if (r > 165 && g > 165 && b > 165) {
        d[i] = Math.round(r * 0.28);
        d[i + 1] = Math.round(g * 0.3);
        d[i + 2] = Math.round(b * 0.38);
      }
      continue;
    }

    // Golden SSJ hair tones -> SSG crimson, SSB cyan-blue, or UI silver-white
    const isGoldHair = r > 115 && g > 65 && b < 55 && r - b > 65 && y < h * 0.56;
    if (isGoldHair) {
      const lum = Math.min(1, (r * 0.5 + g * 0.5) / 235);
      if (recolor === 'ssg') {
        d[i] = Math.round(145 + lum * 108);
        d[i + 1] = Math.round(20 + lum * 72);
        d[i + 2] = Math.round(48 + lum * 78);
      } else if (recolor === 'ssb') {
        d[i] = Math.round(14 + lum * 98);
        d[i + 1] = Math.round(115 + lum * 125);
        d[i + 2] = Math.round(185 + lum * 70);
      } else if (recolor === 'ui') {
        d[i] = Math.round(135 + lum * 116);
        d[i + 1] = Math.round(145 + lum * 108);
        d[i + 2] = Math.round(165 + lum * 90);
      }
    }
  }
  ctx.putImageData(imgData, 0, 0);
}

export const LOG_CANVAS_SIZE = 72;

/**
 * Pixel-Art Image Processing Layer (Sel-Out+, Alpha Snap & Vivid Palette Grading):
 * - Snaps semi-transparent fringes to razor-sharp pixel alpha
 * - Boosts chromatic saturation & cel-shade contrast without washing highlights
 * - Enforces a crisp 1px dark chromatic outline (Sel-Out+) on outer silhouette edges
 */
function createProcessedLogSpriteCanvas(
  img: HTMLImageElement,
  rect: SpriteRect,
  recolor: LogRecolorKind
): HTMLCanvasElement {
  const pw = rect.w + 2;
  const ph = rect.h + 2;
  const work = document.createElement('canvas');
  work.width = pw;
  work.height = ph;
  const wCtx = work.getContext('2d')!;
  wCtx.imageSmoothingEnabled = false;
  wCtx.drawImage(img, rect.x, rect.y, rect.w, rect.h, 1, 1, rect.w, rect.h);

  // First apply race/form recolor if needed
  applyLogRecolor(wCtx, pw, ph, recolor);

  const imgData = wCtx.getImageData(0, 0, pw, ph);
  const d = imgData.data;

  // 1. Alpha Snap + Vivid Palette Grading (Saturation & Cel-Contrast Boost)
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 128) {
      d[i + 3] = 0;
      continue;
    }
    d[i + 3] = 255;

    let r = d[i];
    let g = d[i + 1];
    let b = d[i + 2];

    // Deep dark outlines stay crisp obsidian-ink
    if (r < 34 && g < 34 && b < 34) {
      d[i] = 10;
      d[i + 1] = 12;
      d[i + 2] = 22;
      continue;
    }

    // Vivid saturation & S-curve cel contrast
    const maxC = Math.max(r, g, b);
    const minC = Math.min(r, g, b);
    const chroma = maxC - minC;
    const avg = (r + g + b) / 3;

    if (chroma > 10) {
      const satBoost = 1.24;
      r = avg + (r - avg) * satBoost;
      g = avg + (g - avg) * satBoost;
      b = avg + (b - avg) * satBoost;
    }

    // Crisp tonal separation: cool deep shadows, bright warm highlights
    const luma = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    if (luma < 0.36) {
      r *= 0.9;
      g *= 0.91;
      b = Math.min(255, b * 0.98 + 4);
    } else if (luma > 0.72) {
      r = Math.min(255, r * 1.05 + 4);
      g = Math.min(255, g * 1.04 + 3);
      b = Math.min(255, b * 1.02 + 2);
    }

    d[i] = Math.max(0, Math.min(255, Math.round(r)));
    d[i + 1] = Math.max(0, Math.min(255, Math.round(g)));
    d[i + 2] = Math.max(0, Math.min(255, Math.round(b)));
  }

  // 2. Sel-Out+ Pass: Ensure every outer edge pixel adjacent to transparency has a crisp dark chromatic ink outline
  const copy = new Uint8ClampedArray(d);
  const dirs: [number, number][] = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ];
  for (let y = 0; y < ph; y++) {
    for (let x = 0; x < pw; x++) {
      const idx = (y * pw + x) * 4;
      if (copy[idx + 3] === 0) {
        // Check if adjacent to a bright/non-outline opaque sprite pixel that lacks an outer border
        let neighborR = 0;
        let neighborG = 0;
        let neighborB = 0;
        let hasOpaque = false;
        let hasDarkBorder = false;
        for (const [ox, oy] of dirs) {
          const nx = x + ox;
          const ny = y + oy;
          if (nx < 0 || nx >= pw || ny < 0 || ny >= ph) continue;
          const nIdx = (ny * pw + nx) * 4;
          if (copy[nIdx + 3] > 0) {
            hasOpaque = true;
            const nr = copy[nIdx];
            const ng = copy[nIdx + 1];
            const nb = copy[nIdx + 2];
            if (nr < 45 && ng < 45 && nb < 45) {
              hasDarkBorder = true;
            } else {
              neighborR = nr;
              neighborG = ng;
              neighborB = nb;
            }
          }
        }
        if (hasOpaque && !hasDarkBorder) {
          // Chromatic Sel-Out ink derived from adjacent sprite hue
          d[idx] = Math.max(8, Math.round(neighborR * 0.16));
          d[idx + 1] = Math.max(10, Math.round(neighborG * 0.16));
          d[idx + 2] = Math.max(18, Math.round(neighborB * 0.22));
          d[idx + 3] = 255;
        }
      }
    }
  }

  wCtx.putImageData(imgData, 0, 0);
  return work;
}

function renderLogSpriteToCanvas(
  spriteId: LogSpriteId,
  options?: {
    flipX?: boolean;
    walkFrame?: 0 | 1 | 2 | 3;
    recolor?: LogRecolorKind;
    drawAntennae?: boolean;
    auraRimColor?: string;
    isHitFlash?: boolean;
  }
): HTMLCanvasElement | null {
  if (!logSheetLoaded || !logSheetImage) return null;
  const rect = LOG_SPRITES[spriteId];
  const recolor = options?.recolor ?? 'none';

  // Extract, recolor & run Sel-Out+ / vivid color processing at native resolution
  const processedCanvas = createProcessedLogSpriteCanvas(logSheetImage, rect, recolor);
  const pw = processedCanvas.width;
  const ph = processedCanvas.height;

  const outSize = LOG_CANVAS_SIZE;
  const out = document.createElement('canvas');
  out.width = outSize;
  out.height = outSize;
  const ctx = out.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;

  // Pixel-perfect integer scaling (exact 2x for all standard sprites <= 35px tall!)
  const maxW = outSize - 2;
  const maxH = outSize - 2;
  const intScale = Math.floor(Math.min(maxW / pw, maxH / ph));
  const scale = intScale >= 2 ? intScale : Math.min(maxW / pw, maxH / ph);
  const drawW = Math.round(pw * scale);
  const drawH = Math.round(ph * scale);

  const wf = options?.walkFrame ?? 0;
  // Smooth 4-phase stride hop & sway snapped to integer pixel grid
  const stepY = wf === 1 ? -2 : wf === 3 ? -2 : 0;
  const stepX = wf === 1 ? -1 : wf === 3 ? 1 : 0;
  const dx = Math.round((outSize - drawW) / 2) + stepX;
  const dy = outSize - 2 - drawH + stepY;

  ctx.save();
  if (options?.flipX) {
    ctx.translate(outSize, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(processedCanvas, 0, 0, pw, ph, dx, dy, drawW, drawH);

  // Add crisp pixel Namekian antennae when rendering Namekian race
  if (options?.drawAntennae) {
    const headTop = Math.max(2, dy + 4);
    const center = Math.round(outSize / 2);
    ctx.fillStyle = '#090c18';
    ctx.fillRect(center - 8, headTop - 6, 4, 6);
    ctx.fillRect(center + 4, headTop - 6, 4, 6);
    ctx.fillStyle = '#4ade80';
    ctx.fillRect(center - 7, headTop - 5, 2, 5);
    ctx.fillRect(center + 5, headTop - 5, 2, 5);
  }
  ctx.restore();

  if (options?.isHitFlash) {
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.78)';
    ctx.fillRect(0, 0, outSize, outSize);
  }

  return out;
}

function resolveWarriorLogSprite(
  race: RaceId,
  transformationId: string,
  isFused: boolean
): { id: LogSpriteId; recolor: LogRecolorKind; antennae?: boolean } {
  if (isFused) {
    if (race === 'frieza_clan' || race === 'android') {
      return { id: 'cooler_5', recolor: 'gold_emperor' };
    }
    return { id: 'vegeta_ssj2', recolor: 'none' };
  }

  if (transformationId === 'yamcha_ui') {
    return { id: 'bardock_rage', recolor: 'ui', antennae: race === 'namekian' };
  }

  if (race === 'frieza_clan') {
    switch (transformationId) {
      case 'kaioken':
        return { id: 'frieza_2', recolor: 'none' };
      case 'ssj':
        return { id: 'frieza_3', recolor: 'none' };
      case 'ssj2':
        return { id: 'frieza_final', recolor: 'none' };
      case 'ssj3':
        return { id: 'cooler_5', recolor: 'none' };
      case 'ssg':
        return { id: 'frieza_100', recolor: 'none' };
      case 'ssb':
        return { id: 'frieza_final', recolor: 'gold_emperor' };
      case 'ultra_instinct':
        return { id: 'cooler_5', recolor: 'black_emperor' };
      default:
        return { id: 'frieza_1', recolor: 'none' };
    }
  }

  if (race === 'android') {
    switch (transformationId) {
      case 'kaioken':
        return { id: 'mecha_frieza', recolor: 'none' };
      case 'ssj':
        return { id: 'cooler_4', recolor: 'none' };
      case 'ssj2':
        return { id: 'cooler_5', recolor: 'none' };
      case 'ssj3':
        return { id: 'cooler_5', recolor: 'gold_emperor' };
      case 'ssg':
        return { id: 'mecha_frieza', recolor: 'ssg' };
      case 'ssb':
        return { id: 'meta_cooler', recolor: 'none' };
      case 'ultra_instinct':
        return { id: 'cooler_5', recolor: 'black_emperor' };
      default:
        return { id: 'meta_cooler', recolor: 'none' };
    }
  }

  if (race === 'earthling') {
    switch (transformationId) {
      case 'kaioken':
        return { id: 'bardock_rage', recolor: 'none' };
      case 'ssj':
        return { id: 'bardock_ssj', recolor: 'none' };
      case 'ssj2':
        return { id: 'vegeta_ssj2', recolor: 'none' };
      case 'ssj3':
        return { id: 'bardock_ssj3', recolor: 'none' };
      case 'ssg':
        return { id: 'bardock_ssj', recolor: 'ssg' };
      case 'ssb':
        return { id: 'vegeta_ssj2', recolor: 'ssb' };
      case 'ultra_instinct':
        return { id: 'goku_buff', recolor: 'ui' };
      default:
        return { id: 'bardock_base', recolor: 'none' };
    }
  }

  if (race === 'namekian') {
    switch (transformationId) {
      case 'kaioken':
        return { id: 'goku_kaioken', recolor: 'namekian', antennae: true };
      case 'ssj':
        return { id: 'goku_ssj', recolor: 'namekian', antennae: true };
      case 'ssj2':
        return { id: 'goku_ssj2', recolor: 'namekian', antennae: true };
      case 'ssj3':
        return { id: 'goku_ssj3', recolor: 'namekian', antennae: true };
      case 'ssg':
        return { id: 'goku_ssj', recolor: 'namekian', antennae: true };
      case 'ssb':
        return { id: 'goku_ssj2', recolor: 'namekian', antennae: true };
      case 'ultra_instinct':
        return { id: 'goku_buff', recolor: 'namekian', antennae: true };
      default:
        return { id: 'goku_base', recolor: 'namekian', antennae: true };
    }
  }

  // Saiyan (Goku progression)
  switch (transformationId) {
    case 'kaioken':
      return { id: 'goku_kaioken', recolor: 'none' };
    case 'ssj':
      return { id: 'goku_ssj', recolor: 'none' };
    case 'ssj2':
      return { id: 'goku_ssj2', recolor: 'none' };
    case 'ssj3':
      return { id: 'goku_ssj3', recolor: 'none' };
    case 'ssg':
      return { id: 'goku_ssj', recolor: 'ssg' };
    case 'ssb':
      return { id: 'goku_ssj2', recolor: 'ssb' };
    case 'ultra_instinct':
      return { id: 'goku_buff', recolor: 'ui' };
    default:
      return { id: 'goku_base', recolor: 'none' };
  }
}

function resolveMonsterLogSprite(
  archetype: string,
  isBoss: boolean
): { id: LogSpriteId; recolor: LogRecolorKind } | null {
  switch (archetype) {
    case 'saiyan_grunt':
      return { id: 'bardock_scouter', recolor: 'none' };
    case 'saiyan_boss':
      return { id: isBoss ? 'vegeta_ssj' : 'vegeta_scouter', recolor: 'none' };
    case 'saiyan_heavy':
      return { id: 'vegeta_oozaru', recolor: 'none' };
    case 'beast_boss':
      return { id: 'bardock_oozaru', recolor: 'none' };
    case 'frieza_soldier':
      return { id: 'cooler_1', recolor: 'none' };
    case 'frieza_boss':
      return { id: isBoss ? 'cooler_5' : 'frieza_final', recolor: 'none' };
    case 'android':
      return { id: isBoss ? 'mecha_frieza' : 'meta_cooler', recolor: 'none' };
    case 'martial':
      return { id: 'vegeta_base', recolor: 'none' };
    default:
      return null;
  }
}

// ============================================================================
// ANIME HEAD + LAYERED CEL-SHADED HAIR
// ============================================================================
function drawAnimeHeadFront(
  g: PixelGrid,
  cx: number,
  topY: number,
  pal: WarriorPalette,
  race: RaceId,
  isBack: boolean
) {
  // Neck with chin cast shadow
  g.rect(cx - 3, topY + 11, 6, 4, pal.skinShadow);
  g.rect(cx - 2, topY + 13, 4, 2, pal.skinDeep);

  // Tapered anime skull -> jawline -> pointed chin
  g.poly(
    [
      [cx - 6, topY + 1],
      [cx + 6, topY + 1],
      [cx + 7, topY + 6],
      [cx + 5, topY + 11],
      [cx, topY + 13],
      [cx - 5, topY + 11],
      [cx - 7, topY + 6],
    ],
    pal.skin
  );

  // Ears
  if (race === 'namekian') {
    g.tri(cx - 6, topY + 5, cx - 6, topY + 9, cx - 11, topY + 3, pal.skin);
    g.tri(cx + 6, topY + 5, cx + 6, topY + 9, cx + 11, topY + 3, pal.skin);
    g.line(cx - 7, topY + 6, cx - 9, topY + 5, pal.skinDeep);
    g.line(cx + 7, topY + 6, cx + 9, topY + 5, pal.skinDeep);
  } else {
    g.ellipse(cx - 7, topY + 7, 1.5, 2.2, pal.skinShadow);
    g.ellipse(cx + 7, topY + 7, 1.5, 2.2, pal.skin);
  }

  if (isBack) {
    // Back of head shading
    g.ellipse(cx, topY + 6, 6.5, 6, pal.skinShadow);
    return;
  }

  // Facial planes: brow shadow, nose shadow, cheek contour, highlight
  g.rect(cx - 5, topY + 2, 10, 2, pal.skinShadow);
  g.rect(cx - 4, topY + 3, 4, 2, pal.skinHighlight);
  g.line(cx - 5, topY + 10, cx - 1, topY + 12, pal.skinShadow);
  g.line(cx + 5, topY + 10, cx + 1, topY + 12, pal.skinShadow);

  // Expressive DBZ eyes (sclera + iris + glint + fierce brow)
  g.rect(cx - 5, topY + 6, 4, 2, '#ffffff');
  g.rect(cx + 1, topY + 6, 4, 2, '#ffffff');
  g.rect(cx - 3, topY + 6, 2, 2, pal.eye);
  g.rect(cx + 1, topY + 6, 2, 2, pal.eye);
  g.set(cx - 3, topY + 6, '#ffffff');
  g.set(cx + 1, topY + 6, '#ffffff');

  // Furrowed anime eyebrows
  g.line(cx - 5, topY + 5, cx - 2, topY + 6, pal.brow);
  g.line(cx + 5, topY + 5, cx + 2, topY + 6, pal.brow);
  if (pal.isSSJ3) {
    g.rect(cx - 5, topY + 4, 10, 2, pal.skinShadow);
  }

  // Nose & confident smirk
  g.set(cx, topY + 9, pal.skinShadow);
  g.line(cx - 2, topY + 11, cx + 2, topY + 11, pal.skinDeep);
  g.set(cx + 2, topY + 10, pal.skinShadow);

  // Yamcha's iconic face scar
  if (pal.isYamchaUI) {
    g.line(cx - 5, topY + 8, cx - 3, topY + 10, '#9a3412');
  }

  // Saiyan Scouter (base form)
  if (race === 'saiyan' && !pal.isTransformed && !pal.isFused) {
    g.rect(cx + 1, topY + 5, 6, 4, '#16a34a');
    g.rect(cx + 2, topY + 6, 4, 2, '#4ade80');
    g.set(cx + 2, topY + 6, '#dcfce7');
    g.rect(cx + 6, topY + 5, 2, 4, '#cbd5e1');
  }
}

function drawSpikyAnimeHairFront(
  g: PixelGrid,
  cx: number,
  topY: number,
  pal: WarriorPalette,
  race: RaceId,
  isBack: boolean
) {
  const flared = pal.isTransformed && !pal.isKaioken;
  const peak = flared ? -4 : -1;

  if (race === 'android' && !pal.isTransformed) {
    // Sleek parted 17/18 style hair
    g.poly(
      [
        [cx - 8, topY + 6],
        [cx - 7, topY - 1],
        [cx, topY - 3],
        [cx + 7, topY - 1],
        [cx + 8, topY + 6],
        [cx + 6, topY + 2],
        [cx, topY + 1],
        [cx - 6, topY + 2],
      ],
      pal.hair
    );
    g.line(cx - 5, topY, cx + 5, topY, pal.hairHighlight);
    if (!isBack) {
      g.tri(cx - 5, topY + 1, cx - 2, topY + 1, cx - 5, topY + 6, pal.hair);
      g.tri(cx + 2, topY + 1, cx + 5, topY + 1, cx + 5, topY + 6, pal.hair);
      g.tri(cx - 1, topY + 1, cx + 1, topY + 1, cx, topY + 5, pal.hairHighlight);
    } else {
      g.rect(cx - 7, topY + 2, 14, 10, pal.hair);
      g.line(cx - 3, topY + 3, cx - 3, topY + 10, pal.hairShadow);
      g.line(cx + 3, topY + 3, cx + 3, topY + 10, pal.hairShadow);
    }
    return;
  }

  // Multi-layered curved & pointed Goku/Vegeta anime hair locks
  const spikes: [number, number, number, number, number, number][] = [
    [cx - 4, topY + 2, cx + 4, topY + 2, cx - 1, topY - 11 + peak],
    [cx + 1, topY + 2, cx + 6, topY + 3, cx + 5, topY - 9 + peak],
    [cx - 6, topY + 3, cx - 1, topY + 2, cx - 7, topY - 8 + peak],
    [cx - 8, topY + 4, cx - 3, topY + 1, cx - 14, topY - 3 + peak],
    [cx + 3, topY + 1, cx + 8, topY + 4, cx + 14, topY - 3 + peak],
    [cx - 9, topY + 6, cx - 5, topY + 3, cx - 16, topY + 3],
    [cx + 5, topY + 3, cx + 9, topY + 6, cx + 16, topY + 3],
    [cx - 8, topY + 8, cx - 5, topY + 5, cx - 13, topY + 8],
    [cx + 5, topY + 5, cx + 8, topY + 8, cx + 13, topY + 8],
  ];

  // Root shadow layer first
  for (const [x0, y0, x1, y1, tx, ty] of spikes) {
    g.tri(x0, y0, x1, y1, tx, ty, pal.hairShadow);
  }
  // Midtone sculpted body slightly offset up-left
  for (const [x0, y0, x1, y1, tx, ty] of spikes) {
    g.tri(x0, y0 - 1, x1, y1 - 1, tx, ty + 1, pal.hair);
  }

  // Crown mass
  g.ellipse(cx, topY + 1, 7.5, 4, pal.hair);

  // Diagonal anime specular bands
  g.line(cx - 4, topY - 2, cx - 1, topY - 8 + peak, pal.hairHighlight);
  g.line(cx + 2, topY - 1, cx + 4, topY - 6 + peak, pal.hairHighlight);
  g.line(cx - 10, topY + 1, cx - 6, topY - 1, pal.hairHighlight);
  g.line(cx + 6, topY - 1, cx + 10, topY + 1, pal.hairHighlight);

  if (!isBack) {
    // Iconic forehead bangs framing intense eyes
    g.tri(cx - 5, topY + 1, cx - 2, topY + 1, cx - 5, topY + 7, pal.hair);
    g.tri(cx - 1, topY + 1, cx + 2, topY + 1, cx + 1, topY + 8, pal.hairHighlight);
    g.tri(cx + 3, topY + 1, cx + 6, topY + 1, cx + 6, topY + 6, pal.hair);
    if (pal.isYamchaUI) {
      g.curve(cx - 7, topY + 3, cx - 9, topY + 8, cx - 7, topY + 14, 1.5, 0.8, pal.hair);
      g.curve(cx + 7, topY + 3, cx + 9, topY + 8, cx + 7, topY + 14, 1.5, 0.8, pal.hair);
    }
  } else {
    g.poly(
      [
        [cx - 8, topY + 2],
        [cx + 8, topY + 2],
        [cx + 6, topY + 12],
        [cx, topY + 14],
        [cx - 6, topY + 12],
      ],
      pal.hair
    );
    g.line(cx - 3, topY + 4, cx - 2, topY + 11, pal.hairShadow);
    g.line(cx + 3, topY + 4, cx + 2, topY + 11, pal.hairShadow);
    g.line(cx, topY + 2, cx, topY + 10, pal.hairHighlight);
    if (pal.isYamchaUI) {
      g.tri(cx - 4, topY + 12, cx + 4, topY + 12, cx, topY + 24, pal.hair);
      g.line(cx, topY + 12, cx, topY + 21, pal.hairHighlight);
    }
  }
}

function drawAnimeHeadAndHairSide(
  g: PixelGrid,
  cx: number,
  topY: number,
  pal: WarriorPalette,
  race: RaceId
) {
  // Neck
  g.rect(cx - 2, topY + 11, 5, 4, pal.skinShadow);
  // 3/4 Profile Face
  g.poly(
    [
      [cx - 6, topY + 1],
      [cx + 6, topY + 1],
      [cx + 7, topY + 6],
      [cx + 8, topY + 8], // Nose bridge
      [cx + 6, topY + 10],
      [cx + 4, topY + 13],
      [cx - 4, topY + 12],
      [cx - 6, topY + 7],
    ],
    pal.skin
  );
  g.line(cx - 3, topY + 11, cx + 4, topY + 12, pal.skinShadow);
  g.ellipse(cx - 4, topY + 7, 1.4, 2.2, pal.skinShadow);

  // Sharp side anime eye
  g.rect(cx + 2, topY + 6, 4, 2, '#ffffff');
  g.rect(cx + 4, topY + 6, 2, 2, pal.eye);
  g.set(cx + 4, topY + 6, '#ffffff');
  g.line(cx + 1, topY + 5, cx + 6, topY + 5, pal.brow);

  if (pal.isYamchaUI) {
    g.line(cx + 1, topY + 8, cx + 3, topY + 10, '#9a3412');
  }
  if (race === 'saiyan' && !pal.isTransformed && !pal.isFused) {
    g.rect(cx + 1, topY + 5, 6, 4, '#16a34a');
    g.rect(cx + 2, topY + 6, 3, 2, '#4ade80');
  }

  if (race === 'namekian') {
    g.ellipse(cx, topY + 3, 6, 4, pal.skin);
    g.line(cx - 4, topY + 1, cx + 3, topY + 1, pal.skinHighlight);
    g.tri(cx - 5, topY + 6, cx - 5, topY + 9, cx - 10, topY + 4, pal.skinShadow);
    g.curve(cx - 1, topY + 1, cx - 2, topY - 4, cx - 6, topY - 6, 1.4, 0.8, pal.skin);
    g.curve(cx + 3, topY + 1, cx + 2, topY - 4, cx - 1, topY - 6, 1.4, 0.8, pal.skinHighlight);
  } else if (race === 'frieza_clan') {
    g.shadedSphere(cx, topY + 1, 6, 3.5, pal.undershirt, pal.undershirtShadow, '#e9d5ff');
    g.curve(cx - 4, topY + 2, cx - 10, topY - 2, cx - 13, topY - 7, 2.0, 0.7, '#1e293b');
  } else {
    const flared = pal.isTransformed && !pal.isKaioken;
    const peak = flared ? -4 : -1;
    g.tri(cx - 6, topY + 4, cx + 2, topY, cx - 13, topY - 5 + peak, pal.hair);
    g.tri(cx - 6, topY + 7, cx + 1, topY + 3, cx - 15, topY + 2, pal.hair);
    g.tri(cx - 5, topY + 10, cx, topY + 6, cx - 12, topY + 8, pal.hairShadow);
    g.tri(cx - 2, topY + 2, cx + 5, topY + 2, cx - 1, topY - 10 + peak, pal.hair);
    g.tri(cx + 2, topY + 2, cx + 7, topY + 4, cx + 6, topY - 7 + peak, pal.hair);
    g.tri(cx + 4, topY + 2, cx + 7, topY + 4, cx + 9, topY + 7, pal.hair);
    g.ellipse(cx - 1, topY + 1, 6.5, 3.5, pal.hair);
    g.line(cx - 3, topY - 2, cx - 1, topY - 7 + peak, pal.hairHighlight);
    g.line(cx - 9, topY - 2, cx - 5, topY, pal.hairHighlight);
  }
}

// ============================================================================
// MAIN WARRIOR SPRITE GENERATOR (DYNAMIC STANCE, ANATOMY & CEL SHADING)
// ============================================================================
export function getWarriorSpriteCanvas(
  race: RaceId,
  transformationId: string,
  facing: FacingDir,
  walkFrame: 0 | 1 | 2 | 3,
  isFused = false
): HTMLCanvasElement {
  const key = `log72_${logSheetLoaded ? 'S' : 'F'}_${race}_${transformationId}_${facing}_${walkFrame}_${isFused ? 'F' : 'N'}`;
  const cached = spriteCache.get(key);
  if (cached) return cached;

  if (logSheetLoaded) {
    const spec = resolveWarriorLogSprite(race, transformationId, isFused);
    const sheetCanvas = renderLogSpriteToCanvas(spec.id, {
      flipX: facing === 'left',
      walkFrame,
      recolor: spec.recolor,
      drawAntennae: spec.antennae,
    });
    if (sheetCanvas) {
      spriteCache.set(key, sheetCanvas);
      return sheetCanvas;
    }
  }

  const fallbackWalk: 0 | 1 | 2 = walkFrame === 1 ? 1 : walkFrame === 3 ? 2 : 0;
  if (facing === 'left') {
    const rightCanvas = getWarriorSpriteCanvas(race, transformationId, 'right', fallbackWalk, isFused);
    const c = document.createElement('canvas');
    c.width = SPRITE_SIZE;
    c.height = SPRITE_SIZE;
    const ctx = c.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    ctx.save();
    ctx.translate(SPRITE_SIZE, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(rightCanvas, 0, 0);
    ctx.restore();
    spriteCache.set(key, c);
    return c;
  }

  const pal = getWarriorPalette(race, transformationId, isFused);
  const g = new PixelGrid(SPRITE_SIZE, SPRITE_SIZE);
  const cx = 32;

  const stride = fallbackWalk === 1 ? 1 : fallbackWalk === 2 ? -1 : 0;
  const tailWag = fallbackWalk === 1 ? -3 : fallbackWalk === 2 ? 3 : 0;
  const bobY = fallbackWalk === 0 ? 0 : -1;

  if (facing === 'down' || facing === 'up') {
    const isBack = facing === 'up';

    // 1. Back Accessories: Namekian Cape / Saiyajin Tail / Frieza Tail / SSJ3 Mane
    if (race === 'namekian' && !isFused) {
      g.poly(
        [
          [21, 27 + bobY],
          [43, 27 + bobY],
          [49 + stride, 52],
          [38, 50],
          [26, 51],
          [15 + stride, 52],
        ],
        pal.capeShadow
      );
      g.poly(
        [
          [22, 27 + bobY],
          [42, 27 + bobY],
          [46 + stride, 49],
          [32, 48],
          [18 + stride, 49],
        ],
        pal.cape
      );
      g.line(25, 31 + bobY, 22 + stride, 48, pal.capeShadow);
      g.line(39, 31 + bobY, 42 + stride, 48, pal.capeShadow);
      g.line(32, 30 + bobY, 32, 47, pal.capeShadow);
    } else if (race === 'saiyan') {
      g.curve(26, 40 + bobY, 16, 43 + tailWag, 12, 32 + tailWag, 2.2, 1.8, '#78350f');
      g.line(16, 42 + tailWag, 12, 33 + tailWag, '#b45309');
    } else if (race === 'frieza_clan') {
      g.curve(27, 41 + bobY, 14, 46 + tailWag, 10, 31 + tailWag, 2.8, 1.0, pal.capeShadow);
      g.curve(27, 40 + bobY, 14, 44 + tailWag, 11, 30 + tailWag, 2.0, 0.7, pal.cape);
    }

    if (isBack && pal.isSSJ3 && race !== 'namekian' && race !== 'frieza_clan') {
      g.poly(
        [
          [21, 17],
          [43, 17],
          [41, 43],
          [32, 54],
          [23, 43],
        ],
        pal.hairShadow
      );
      g.poly(
        [
          [23, 17],
          [41, 17],
          [38, 41],
          [32, 51],
          [26, 41],
        ],
        pal.hair
      );
      g.line(28, 21, 29, 44, pal.hairHighlight);
      g.line(36, 21, 35, 44, pal.hairHighlight);
    }

    // 2. Dynamic Martial-Arts Legs & Boots
    const pants = isFused ? '#f1f5f9' : pal.giMain;
    const pantsSh = isFused ? '#94a3b8' : pal.giShadow;
    const pantsHi = isFused ? '#ffffff' : pal.giHighlight;

    const lFootX = 24 - stride * 2;
    const lFootY = 56 - (walkFrame === 1 ? 3 : 0);
    const rFootX = 40 + stride * 2;
    const rFootY = 56 - (walkFrame === 2 ? 3 : 0);

    // Thighs (wide baggy DBZ martial arts trousers)
    g.shadedLimb(27, 40 + bobY, 24 - stride, 49, 4.4, 3.6, pants, pantsSh, pantsHi);
    g.shadedLimb(37, 40 + bobY, 40 + stride, 49, 4.4, 3.6, pants, pantsSh, pantsHi);
    // Trousers fold creases
    g.line(25, 44 + bobY, 28, 47 + bobY, pantsSh);
    g.line(39, 44 + bobY, 36, 47 + bobY, pantsSh);

    // Shins / Boots
    g.shadedLimb(24 - stride, 49, lFootX, lFootY, 3.2, 2.7, pal.boots, pal.bootsShadow, pal.bootTrim);
    g.shadedLimb(40 + stride, 49, rFootX, rFootY, 3.2, 2.7, pal.boots, pal.bootsShadow, pal.bootTrim);
    // Boot cuff trim + sole
    g.rect(21 - stride, 48, 6, 2, pal.bootTrim);
    g.rect(37 + stride, 48, 6, 2, pal.bootTrim);
    g.ellipse(lFootX - 1, lFootY + 2, 4, 2, pal.bootsShadow);
    g.ellipse(rFootX + 1, rFootY + 2, 4, 2, pal.bootsShadow);

    // 3. Athletic V-Tapered Torso, Gi Folds / Battle Armor / Fusion Vest
    const tY = 27 + bobY;
    if (isFused) {
      // Sculpted bare torso + open Metamoru vest
      g.poly(
        [
          [22, tY],
          [42, tY],
          [39, tY + 14],
          [25, tY + 14],
        ],
        pal.skin
      );
      g.line(27, tY + 4, 31, tY + 5, pal.skinShadow);
      g.line(37, tY + 4, 33, tY + 5, pal.skinShadow);
      g.rect(29, tY + 7, 6, 4, pal.skinShadow);
      // Black vest panels
      g.poly(
        [
          [21, tY],
          [28, tY],
          [27, tY + 12],
          [22, tY + 12],
        ],
        pal.giMain
      );
      g.poly(
        [
          [36, tY],
          [43, tY],
          [42, tY + 12],
          [37, tY + 12],
        ],
        pal.giMain
      );
      // Puffy gold bolsters
      g.shadedSphere(22, tY, 5, 2.6, pal.undershirt, pal.undershirtShadow, '#fef08a');
      g.shadedSphere(42, tY, 5, 2.6, pal.undershirt, pal.undershirtShadow, '#fef08a');
      // Flowing teal sash
      g.rect(24, tY + 11, 16, 4, pal.belt);
      g.line(25, tY + 12, 38, tY + 12, pal.beltHighlight);
      g.tri(30, tY + 14, 34, tY + 14, 28 + stride, tY + 20, pal.belt);
    } else if (race === 'saiyan') {
      // Dark navy suit + white sculpted Saiyan battle armor + golden ribbed plates
      g.poly(
        [
          [22, tY],
          [42, tY],
          [39, tY + 14],
          [25, tY + 14],
        ],
        '#f8fafc'
      );
      g.poly(
        [
          [22, tY],
          [27, tY],
          [27, tY + 13],
          [25, tY + 13],
        ],
        '#cbd5e1'
      );
      // Amber ribbed chest/abs
      g.rect(26, tY + 4, 12, 7, '#d97706');
      g.line(26, tY + 6, 37, tY + 6, '#92400e');
      g.line(26, tY + 8, 37, tY + 8, '#92400e');
      g.rect(24, tY, 4, 4, '#facc15');
      g.rect(36, tY, 4, 4, '#facc15');
      // Flared Saiyan shoulder pauldrons
      g.poly(
        [
          [16, tY + 1],
          [24, tY - 1],
          [24, tY + 4],
          [17, tY + 5],
        ],
        '#f8fafc'
      );
      g.poly(
        [
          [40, tY - 1],
          [48, tY + 1],
          [47, tY + 5],
          [40, tY + 4],
        ],
        '#f8fafc'
      );
      g.line(17, tY + 1, 23, tY, '#facc15');
      g.line(41, tY, 47, tY + 1, '#facc15');
      // Waist armor belt
      g.rect(24, tY + 11, 16, 3, '#1e3a8a');
    } else if (race === 'frieza_clan') {
      g.poly(
        [
          [22, tY],
          [42, tY],
          [39, tY + 14],
          [25, tY + 14],
        ],
        pal.giMain
      );
      g.poly(
        [
          [22, tY],
          [26, tY],
          [26, tY + 14],
          [25, tY + 14],
        ],
        pal.giShadow
      );
      // Purple exoskeleton plates & chest bio-gem
      g.rect(26, tY + 5, 12, 7, pal.undershirt);
      g.line(26, tY + 8, 37, tY + 8, pal.undershirtShadow);
      g.shadedSphere(32, tY + 3, 3.2, 2.2, pal.isTransformed ? pal.aura : '#9333ea', '#3b0764', '#f3e8ff');
      g.shadedSphere(21, tY + 1, 3.5, 2.5, pal.giMain, pal.giShadow, '#ffffff');
      g.shadedSphere(43, tY + 1, 3.5, 2.5, pal.giMain, pal.giShadow, '#ffffff');
    } else {
      // Namekian / Earthling / Android martial arts Gi
      g.poly(
        [
          [22, tY],
          [42, tY],
          [39, tY + 14],
          [25, tY + 14],
        ],
        pal.giMain
      );
      g.poly(
        [
          [22, tY],
          [27, tY],
          [27, tY + 13],
          [25, tY + 13],
        ],
        pal.giShadow
      );
      g.line(35, tY + 2, 39, tY + 8, pal.giHighlight);
      if (!isBack) {
        g.tri(26, tY, 38, tY, 32, tY + 8, pal.undershirt);
        g.tri(28, tY, 36, tY, 32, tY + 4, pal.skin);
        g.line(26, tY, 32, tY + 8, pal.giShadow);
        g.line(38, tY, 32, tY + 8, pal.giShadow);
        if (race === 'android') {
          g.poly(
            [
              [25, tY - 1],
              [39, tY - 1],
              [37, tY + 3],
              [27, tY + 3],
            ],
            '#dc2626'
          );
          g.tri(35, tY + 2, 39, tY + 2, 38, tY + 8, '#b91c1c');
        }
      }
      // Knotted martial arts obi belt + flowing sash tails
      g.rect(24, tY + 10, 16, 4, pal.belt);
      g.line(25, tY + 11, 38, tY + 11, pal.beltHighlight);
      if (!isBack) {
        g.rect(30, tY + 10, 4, 4, pal.beltHighlight);
        g.tri(30, tY + 13, 33, tY + 13, 28 + stride, tY + 19, pal.belt);
        g.tri(32, tY + 13, 35, tY + 13, 35 + stride, tY + 18, pal.belt);
      }
    }

    // Namekian shoulder armor pads over cape
    if (race === 'namekian' && !isFused) {
      g.poly(
        [
          [15, tY],
          [25, tY - 1],
          [24, tY + 4],
          [16, tY + 4],
        ],
        pal.cape
      );
      g.poly(
        [
          [39, tY - 1],
          [49, tY],
          [48, tY + 4],
          [40, tY + 4],
        ],
        pal.cape
      );
      g.line(16, tY + 3, 24, tY + 3, pal.capeShadow);
      g.line(40, tY + 3, 48, tY + 3, pal.capeShadow);
    }

    // 4. Muscular Fighting-Guard Arms & Clenched Fists
    const armSkin = race === 'saiyan' ? '#1e3a8a' : pal.skin;
    const armSh = race === 'saiyan' ? '#0f172a' : pal.skinShadow;
    const armHi = race === 'saiyan' ? '#3b82f6' : pal.skinHighlight;
    const fistColor = race === 'saiyan' ? '#f8fafc' : pal.skin;

    const lElbowX = 17;
    const lElbowY = tY + 6 + stride;
    const lHandX = 19;
    const lHandY = tY + 11 + stride * 2;
    const rElbowX = 47;
    const rElbowY = tY + 6 - stride;
    const rHandX = 45;
    const rHandY = tY + 11 - stride * 2;

    g.shadedLimb(22, tY + 2, lElbowX, lElbowY, 2.7, 2.4, armSkin, armSh, armHi);
    g.shadedLimb(lElbowX, lElbowY, lHandX, lHandY, 2.3, 2.1, armSkin, armSh, armHi);
    g.shadedLimb(42, tY + 2, rElbowX, rElbowY, 2.7, 2.4, armSkin, armSh, armHi);
    g.shadedLimb(rElbowX, rElbowY, rHandX, rHandY, 2.3, 2.1, armSkin, armSh, armHi);

    if (race === 'namekian') {
      g.rect(lElbowX - 1, lElbowY - 2, 2, 3, '#f9a8d4');
      g.rect(rElbowX - 1, rElbowY - 2, 2, 3, '#f9a8d4');
    }
    // Wristbands & Fists
    g.ellipse(lHandX, lHandY - 2, 2.4, 1.5, pal.undershirt);
    g.ellipse(rHandX, rHandY - 2, 2.4, 1.5, pal.undershirt);
    g.shadedSphere(lHandX, lHandY + 1, 2.5, 2.4, fistColor, armSh, '#ffffff');
    g.shadedSphere(rHandX, rHandY + 1, 2.5, 2.4, fistColor, armSh, '#ffffff');

    // 5. Head & Race Crown
    const headTopY = 13 + bobY;
    drawAnimeHeadFront(g, cx, headTopY, pal, race, isBack);

    if (race === 'namekian') {
      g.shadedSphere(cx, headTopY + 2, 6.2, 3.2, pal.skin, pal.skinShadow, pal.skinHighlight);
      if (isBack) {
        g.ellipse(cx, headTopY + 5, 6.5, 5, pal.skinShadow);
      }
      g.curve(cx - 3, headTopY + 1, cx - 5, headTopY - 4, cx - 8, headTopY - 6, 1.5, 0.7, pal.skin);
      g.curve(cx + 3, headTopY + 1, cx + 5, headTopY - 4, cx + 8, headTopY - 6, 1.5, 0.7, pal.skin);
      g.set(cx - 8, headTopY - 6, pal.skinHighlight);
      g.set(cx + 8, headTopY - 6, pal.skinHighlight);
      if (pal.isTransformed) {
        g.line(cx - 4, headTopY + 1, cx + 4, headTopY + 1, pal.aura);
      }
    } else if (race === 'frieza_clan') {
      g.shadedSphere(cx, headTopY + 2, 6.2, 3.4, pal.undershirt, pal.undershirtShadow, '#e9d5ff');
      g.rect(cx - 2, headTopY, 4, 2, '#f3e8ff');
      g.curve(cx - 6, headTopY + 3, cx - 11, headTopY - 1, cx - 15, headTopY - 6, 2.0, 0.7, '#1e293b');
      g.curve(cx + 6, topYOr(headTopY) + 3, cx + 11, headTopY - 1, cx + 15, headTopY - 6, 2.0, 0.7, '#1e293b');
      g.set(cx - 12, headTopY - 3, '#cbd5e1');
      g.set(cx + 12, headTopY - 3, '#cbd5e1');
    } else {
      drawSpikyAnimeHairFront(g, cx, headTopY, pal, race, isBack);
    }
  } else {
    // FACING RIGHT (Dynamic 3/4 Fighting Profile)
    const tY = 27 + bobY;

    if (race === 'namekian' && !isFused) {
      g.poly(
        [
          [24, tY],
          [30, tY],
          [27, 50],
          [16 + stride, 51],
        ],
        pal.capeShadow
      );
      g.poly(
        [
          [25, tY],
          [30, tY],
          [26, 48],
          [18 + stride, 49],
        ],
        pal.cape
      );
      g.line(23, tY + 6, 20 + stride, 47, pal.capeShadow);
    } else if (race === 'saiyan') {
      g.curve(26, tY + 12, 17, tY + 11 + tailWag, 14, tY + 3 + tailWag, 2.1, 1.7, '#78350f');
    } else if (race === 'frieza_clan') {
      g.curve(26, tY + 13, 14, tY + 15 + tailWag, 10, tY + 4 + tailWag, 2.7, 0.9, pal.cape);
    }

    if (pal.isSSJ3 && race !== 'namekian' && race !== 'frieza_clan') {
      g.poly(
        [
          [18, 17],
          [28, 17],
          [26, 44],
          [15, 51],
        ],
        pal.hairShadow
      );
      g.poly(
        [
          [19, 17],
          [27, 17],
          [25, 42],
          [17, 48],
        ],
        pal.hair
      );
      g.line(21, 21, 19, 44, pal.hairHighlight);
    }

    const pants = isFused ? '#f1f5f9' : pal.giMain;
    const pantsSh = isFused ? '#94a3b8' : pal.giShadow;
    const pantsHi = isFused ? '#ffffff' : pal.giHighlight;

    // Back leg
    g.shadedLimb(28, 41 + bobY, 24 - stride * 3, 50, 3.8, 3.2, pantsSh, shadeColor(pantsSh, -0.3), pants);
    g.shadedLimb(24 - stride * 3, 50, 23 - stride * 4, 56, 3.0, 2.5, pal.bootsShadow, '#05070e', pal.bootTrim);
    g.rect(21 - stride * 3, 49, 6, 2, pal.bootTrim);

    // Front leg
    g.shadedLimb(34, 41 + bobY, 37 + stride * 3, 50, 4.0, 3.4, pants, pantsSh, pantsHi);
    g.shadedLimb(37 + stride * 3, 50, 39 + stride * 4, 56, 3.2, 2.6, pal.boots, pal.bootsShadow, pal.bootTrim);
    g.rect(34 + stride * 3, 49, 7, 2, pal.bootTrim);
    g.ellipse(40 + stride * 4, 58, 4.2, 2, pal.bootsShadow);

    // Side Torso
    g.poly(
      [
        [25, tY],
        [38, tY],
        [37, tY + 14],
        [26, tY + 14],
      ],
      isFused ? pal.skin : pal.giMain
    );
    g.rect(25, tY, 4, 14, isFused ? pal.skinShadow : pal.giShadow);
    if (isFused) {
      g.rect(25, tY, 6, 12, pal.giMain);
      g.shadedSphere(29, tY, 4.5, 2.5, pal.undershirt, pal.undershirtShadow, '#fef08a');
      g.rect(26, tY + 11, 12, 4, pal.belt);
    } else if (race === 'saiyan') {
      g.rect(26, tY, 12, 11, '#f8fafc');
      g.rect(30, tY + 4, 8, 6, '#d97706');
      g.line(30, tY + 6, 37, tY + 6, '#92400e');
      g.shadedSphere(30, tY + 1, 4.5, 2.4, '#f8fafc', '#cbd5e1', '#facc15');
    } else if (race === 'frieza_clan') {
      g.rect(30, tY + 5, 8, 6, pal.undershirt);
      g.shadedSphere(35, tY + 3, 2.8, 2.0, pal.isTransformed ? pal.aura : '#9333ea', '#3b0764', '#f3e8ff');
    } else if (race === 'android') {
      g.rect(26, tY, 12, 3, '#dc2626');
    }
    if (!isFused) {
      g.rect(26, tY + 10, 12, 4, pal.belt);
      g.line(27, tY + 11, 37, tY + 11, pal.beltHighlight);
    }

    // Side Arm in guard pose
    const armSkin = race === 'saiyan' ? '#1e3a8a' : pal.skin;
    const armSh = race === 'saiyan' ? '#0f172a' : pal.skinShadow;
    const armHi = race === 'saiyan' ? '#3b82f6' : pal.skinHighlight;
    const elbowX = 29 - stride;
    const elbowY = tY + 7;
    const handX = 37 + stride * 2;
    const handY = tY + 6;
    g.shadedLimb(30, tY + 2, elbowX, elbowY, 2.7, 2.4, armSkin, armSh, armHi);
    g.shadedLimb(elbowX, elbowY, handX, handY, 2.4, 2.2, armSkin, armSh, armHi);
    g.ellipse(handX - 1, handY, 2.2, 2.4, pal.undershirt);
    g.shadedSphere(handX + 2, handY, 2.5, 2.4, race === 'saiyan' ? '#f8fafc' : pal.skin, armSh, '#ffffff');

    drawAnimeHeadAndHairSide(g, 31, 13 + bobY, pal, race);
  }

  const canvas = g.toCanvas(pal.outline);
  spriteCache.set(key, canvas);
  return canvas;
}

function topYOr(y: number): number {
  return y;
}

// ============================================================================
// ALL 24 MONSTER & BOSS SPRITES (BESPOKE 16-BIT ANATOMY)
// ============================================================================
export function getMonsterSpriteCanvas(
  archetype: string,
  colorPrimary: string,
  colorSecondary: string,
  isBoss: boolean,
  isHitFlash = false
): HTMLCanvasElement {
  const key = `logmob64_${logSheetLoaded ? 'S' : 'F'}_${archetype}_${colorPrimary}_${colorSecondary}_${isBoss ? 'B' : 'M'}_${isHitFlash ? 'H' : 'N'}`;
  const cached = spriteCache.get(key);
  if (cached) return cached;

  if (logSheetLoaded) {
    const spec = resolveMonsterLogSprite(archetype, isBoss);
    if (spec) {
      const sheetCanvas = renderLogSpriteToCanvas(spec.id, {
        recolor: spec.recolor,
        isHitFlash,
      });
      if (sheetCanvas) {
        spriteCache.set(key, sheetCanvas);
        return sheetCanvas;
      }
    }
  }

  if (isHitFlash) {
    const base = getMonsterSpriteCanvas(archetype, colorPrimary, colorSecondary, isBoss, false);
    const c = document.createElement('canvas');
    c.width = SPRITE_SIZE;
    c.height = SPRITE_SIZE;
    const ctx = c.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(base, 0, 0);
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.72)';
    ctx.fillRect(0, 0, SPRITE_SIZE, SPRITE_SIZE);
    spriteCache.set(key, c);
    return c;
  }

  const g = new PixelGrid(SPRITE_SIZE, SPRITE_SIZE);
  const pSh = shadeColor(colorPrimary, -0.35);
  const pHi = shadeColor(colorPrimary, 0.3);
  const sSh = shadeColor(colorSecondary, -0.35);
  const sHi = shadeColor(colorSecondary, 0.3);
  const skin = '#f6bc87';
  const skinSh = '#d07a42';
  const skinHi = '#ffe5cb';
  const cx = 32;

  switch (archetype) {
    case 'saibaman': {
      // Hunched alien bio-beast with veined cranium, crimson eyes, razor grin & claws
      g.shadedLimb(24, 28, 15, 36, 2.5, 2.0, colorPrimary, pSh, pHi);
      g.shadedLimb(15, 36, 17, 42, 2.0, 1.8, colorPrimary, pSh, pHi);
      g.shadedLimb(40, 28, 49, 36, 2.5, 2.0, colorPrimary, pSh, pHi);
      g.shadedLimb(49, 36, 47, 42, 2.0, 1.8, colorPrimary, pSh, pHi);
      g.line(16, 43, 14, 46, '#e2e8f0');
      g.line(48, 43, 50, 46, '#e2e8f0');

      g.shadedLimb(27, 39, 22, 54, 3.2, 2.4, colorPrimary, pSh, pHi);
      g.shadedLimb(37, 39, 42, 54, 3.2, 2.4, colorPrimary, pSh, pHi);

      g.shadedSphere(cx, 32, 8.5, 9, colorPrimary, pSh, pHi);
      g.shadedSphere(cx, 32, 5, 6, colorSecondary, sSh, sHi);
      // Veined bulbous brain-head
      g.shadedSphere(cx, 17, 10.5, 8.5, colorPrimary, pSh, pHi);
      g.shadedSphere(cx, 12, 8.5, 4.5, colorSecondary, sSh, sHi);
      g.line(32, 8, 32, 16, '#0b0e18');
      g.line(27, 11, 29, 15, '#0b0e18');
      g.line(37, 11, 35, 15, '#0b0e18');
      // Glowing red eyes & jagged fang grin
      g.rect(25, 16, 4, 3, '#ef4444');
      g.rect(35, 16, 4, 3, '#ef4444');
      g.set(26, 16, '#fef08a');
      g.set(36, 16, '#fef08a');
      g.poly(
        [
          [26, 20],
          [38, 20],
          [36, 24],
          [28, 24],
        ],
        '#ffffff'
      );
      g.line(27, 22, 37, 22, '#090b12');
      break;
    }

    case 'dino': {
      // Ferocious bipedal DBZ dragon-raptor with jagged crest, tail & fangs
      g.curve(36, 36, 48, 41, 56, 29, 5.0, 1.4, colorPrimary);
      g.line(41, 37, 54, 31, pHi);
      // Dorsal spikes
      g.tri(33, 18, 37, 22, 41, 16, colorSecondary);
      g.tri(37, 24, 41, 29, 46, 23, colorSecondary);
      // Muscular legs & talons
      g.shadedLimb(26, 39, 22, 55, 4.2, 3.0, colorPrimary, pSh, pHi);
      g.shadedLimb(35, 39, 36, 55, 4.2, 3.0, colorPrimary, pSh, pHi);
      g.line(20, 56, 17, 58, '#f8fafc');
      g.line(34, 56, 31, 58, '#f8fafc');
      // Reptilian body & scaled belly
      g.shadedSphere(31, 33, 10, 11, colorPrimary, pSh, pHi);
      g.shadedSphere(27, 34, 5.5, 8, colorSecondary, sSh, sHi);
      // Tiny clawed forearms
      g.shadedLimb(23, 30, 16, 35, 2.2, 1.5, colorPrimary, pSh, pHi);
      // Fierce snout & open jaw
      g.poly(
        [
          [11, 10],
          [32, 10],
          [34, 21],
          [10, 20],
        ],
        colorPrimary
      );
      g.poly(
        [
          [11, 10],
          [30, 10],
          [28, 13],
          [12, 13],
        ],
        pHi
      );
      g.poly(
        [
          [12, 22],
          [29, 21],
          [28, 25],
          [14, 25],
        ],
        colorSecondary
      );
      g.rect(13, 19, 2, 3, '#ffffff');
      g.rect(18, 19, 2, 3, '#ffffff');
      g.rect(23, 19, 2, 3, '#ffffff');
      g.rect(22, 12, 4, 3, '#facc15');
      g.set(23, 13, '#0b0e18');
      break;
    }

    case 'beast':
    case 'beast_boss': {
      // Sabretooth / Beast Warrior (with Golden Pillar / Power Pole for boss!)
      if (isBoss) {
        g.shadedLimb(48, 9, 44, 57, 2.2, 2.2, '#d97706', '#78350f', '#fef08a');
      }
      g.curve(36, 41, 47, 44, 53, 33, 2.4, 1.4, colorPrimary);
      g.shadedLimb(26, 40, 23, 55, 3.8, 2.8, colorPrimary, pSh, pHi);
      g.shadedLimb(38, 40, 41, 55, 3.8, 2.8, colorPrimary, pSh, pHi);
      g.shadedSphere(cx, 33, 9.5, 10, colorPrimary, pSh, pHi);
      g.shadedSphere(cx, 34, 5.5, 7, colorSecondary, sSh, sHi);
      g.shadedLimb(23, 28, 16, 38, 3.0, 2.4, colorPrimary, pSh, pHi);
      g.shadedLimb(41, 28, 47, 36, 3.0, 2.4, colorPrimary, pSh, pHi);
      // Beast head + pointed ears + fangs
      g.tri(21, 15, 27, 13, 20, 4, colorPrimary);
      g.tri(43, 15, 37, 13, 44, 4, colorPrimary);
      g.shadedSphere(cx, 19, 9.5, 8, colorPrimary, pSh, pHi);
      g.shadedSphere(cx, 23, 5.5, 3.5, colorSecondary, sSh, sHi);
      g.rect(26, 17, 4, 3, '#facc15');
      g.rect(34, 17, 4, 3, '#facc15');
      g.set(27, 18, '#dc2626');
      g.set(35, 18, '#dc2626');
      g.rect(29, 24, 2, 3, '#ffffff');
      g.rect(33, 24, 2, 3, '#ffffff');
      break;
    }

    case 'demon': {
      // Tambourine / Demon King Minion with ribbed bat wings & horns
      g.poly(
        [
          [23, 25],
          [7, 12],
          [5, 28],
          [13, 35],
          [23, 36],
        ],
        colorSecondary
      );
      g.poly(
        [
          [41, 25],
          [57, 12],
          [59, 28],
          [51, 35],
          [41, 36],
        ],
        colorSecondary
      );
      g.line(22, 26, 7, 13, pHi);
      g.line(22, 29, 8, 25, sSh);
      g.line(42, 26, 57, 13, pHi);
      g.line(42, 29, 56, 25, sSh);

      g.shadedLimb(26, 40, 22, 55, 3.6, 2.7, colorPrimary, pSh, pHi);
      g.shadedLimb(38, 40, 42, 55, 3.6, 2.7, colorPrimary, pSh, pHi);
      g.shadedSphere(cx, 33, 9, 10, colorPrimary, pSh, pHi);
      g.shadedSphere(cx, 33, 5.5, 6.5, colorSecondary, sSh, sHi);
      g.shadedLimb(23, 27, 15, 37, 2.8, 2.2, colorPrimary, pSh, pHi);
      g.shadedLimb(41, 27, 49, 37, 2.8, 2.2, colorPrimary, pSh, pHi);
      // Horned reptilian skull
      g.curve(26, 13, 24, 7, 20, 4, 2.0, 0.8, '#e2e8f0');
      g.curve(38, 13, 40, 7, 44, 4, 2.0, 0.8, '#e2e8f0');
      g.shadedSphere(cx, 18, 8.5, 7.5, colorPrimary, pSh, pHi);
      g.rect(26, 17, 4, 3, '#ef4444');
      g.rect(34, 17, 4, 3, '#ef4444');
      g.rect(28, 22, 8, 3, '#ffffff');
      break;
    }

    case 'bandit':
    case 'bandit_boss': {
      // Desert Bandit / Mercenary with cloak, headband & jagged scimitar
      g.poly(
        [
          [20, 26],
          [44, 26],
          [48, 49],
          [16, 49],
        ],
        sSh
      );
      g.shadedLimb(26, 41, 23, 56, 3.6, 2.7, colorSecondary, sSh, sHi);
      g.shadedLimb(38, 41, 41, 56, 3.6, 2.7, colorSecondary, sSh, sHi);
      g.shadedSphere(cx, 33, 8.5, 9, colorPrimary, pSh, pHi);
      g.rect(24, 39, 16, 3, '#78350f');
      // Scimitar blade in right hand
      g.curve(48, 35, 55, 24, 52, 11, 1.8, 0.8, '#e2e8f0');
      g.line(48, 35, 53, 14, '#ffffff');
      g.shadedLimb(23, 28, 17, 38, 2.7, 2.2, skin, skinSh, skinHi);
      g.shadedLimb(41, 28, 48, 35, 2.7, 2.2, skin, skinSh, skinHi);
      // Scarred head + desert bandana/mohawk
      g.shadedSphere(cx, 19, 7.5, 7.5, skin, skinSh, skinHi);
      g.poly(
        [
          [24, 14],
          [40, 14],
          [38, 10],
          [26, 10],
        ],
        colorPrimary
      );
      g.line(40, 12, 47, 17, colorPrimary);
      g.rect(26, 18, 4, 2, '#ffffff');
      g.rect(34, 18, 4, 2, '#ffffff');
      g.set(28, 18, '#0b0e18');
      g.set(35, 18, '#0b0e18');
      g.line(26, 21, 28, 23, '#9a3412');
      if (isBoss) {
        g.tri(29, 10, 35, 10, 32, 2, '#facc15');
      }
      break;
    }

    case 'human_boss': {
      // Tao Pai Pai / Crane Master assassin with long braid & embroidered robes
      g.curve(36, 18, 44, 24, 43, 43, 2.0, 1.2, '#151926');
      g.shadedLimb(27, 41, 24, 56, 3.6, 2.7, '#1e293b', '#0f172a', '#475569');
      g.shadedLimb(37, 41, 40, 56, 3.6, 2.7, '#1e293b', '#0f172a', '#475569');
      g.poly(
        [
          [22, 26],
          [42, 26],
          [40, 44],
          [24, 44],
        ],
        colorPrimary
      );
      g.rect(29, 27, 6, 13, colorSecondary);
      g.rect(24, 38, 16, 3, '#facc15');
      g.shadedLimb(22, 28, 15, 36, 2.6, 2.2, colorPrimary, pSh, pHi);
      g.shadedLimb(42, 28, 47, 25, 2.6, 2.2, colorPrimary, pSh, pHi);
      g.shadedSphere(cx, 18, 7.2, 7.5, skin, skinSh, skinHi);
      g.ellipse(cx, 12, 7, 3, '#151926');
      g.rect(27, 17, 3, 2, '#0f172a');
      g.rect(34, 17, 3, 2, '#0f172a');
      g.line(28, 22, 36, 22, '#151926'); // Mustache
      break;
    }

    case 'martial': {
      // Tenkaichi Martial Artist in dynamic guard
      g.shadedLimb(27, 40, 23, 56, 3.7, 2.8, colorPrimary, pSh, pHi);
      g.shadedLimb(37, 40, 41, 56, 3.7, 2.8, colorPrimary, pSh, pHi);
      g.poly(
        [
          [22, 26],
          [42, 26],
          [39, 41],
          [25, 41],
        ],
        colorPrimary
      );
      g.tri(27, 26, 37, 26, 32, 33, colorSecondary);
      g.rect(25, 38, 14, 3, colorSecondary);
      g.shadedLimb(22, 28, 17, 37, 2.7, 2.2, skin, skinSh, skinHi);
      g.shadedLimb(42, 28, 47, 33, 2.7, 2.2, skin, skinSh, skinHi);
      g.shadedSphere(cx, 18, 7.2, 7.4, skin, skinSh, skinHi);
      g.poly(
        [
          [24, 15],
          [40, 15],
          [37, 9],
          [27, 9],
        ],
        '#151926'
      );
      g.rect(25, 13, 14, 2, colorSecondary);
      g.rect(27, 18, 3, 2, '#ffffff');
      g.rect(34, 18, 3, 2, '#ffffff');
      g.set(28, 18, '#0b0e18');
      g.set(35, 18, '#0b0e18');
      break;
    }

    case 'android': {
      // Red Ribbon Bio-Cybernetic Android with glowing chest core & visor
      g.shadedLimb(27, 40, 24, 56, 3.5, 2.7, '#1e293b', '#0f172a', '#475569');
      g.shadedLimb(37, 40, 40, 56, 3.5, 2.7, '#1e293b', '#0f172a', '#475569');
      g.poly(
        [
          [22, 26],
          [42, 26],
          [40, 41],
          [24, 41],
        ],
        colorPrimary
      );
      g.shadedSphere(cx, 33, 3.5, 3.5, '#ef4444', '#7f1d1d', '#fecaca');
      g.rect(24, 38, 16, 3, '#dc2626');
      g.shadedLimb(22, 27, 16, 39, 2.7, 2.3, colorSecondary, sSh, sHi);
      g.shadedLimb(42, 27, 48, 39, 2.7, 2.3, colorSecondary, sSh, sHi);
      g.shadedSphere(cx, 18, 7.2, 7.2, skin, skinSh, skinHi);
      g.rect(25, 16, 14, 4, '#0f172a');
      g.line(26, 18, 37, 18, '#ef4444');
      g.tri(25, 14, 39, 14, 32, 7, colorSecondary);
      break;
    }

    case 'patrol': {
      // Galactic Patrol / Supreme Kai Elite with cape & cyan visor
      g.poly(
        [
          [21, 26],
          [43, 26],
          [47, 49],
          [17, 49],
        ],
        colorSecondary
      );
      g.shadedLimb(27, 40, 24, 56, 3.5, 2.6, '#1e293b', '#0f172a', '#475569');
      g.shadedLimb(37, 40, 40, 56, 3.5, 2.6, '#1e293b', '#0f172a', '#475569');
      g.poly(
        [
          [22, 26],
          [42, 26],
          [39, 41],
          [25, 41],
        ],
        colorPrimary
      );
      g.rect(28, 30, 8, 5, '#38bdf8');
      g.shadedLimb(22, 27, 16, 38, 2.6, 2.1, colorPrimary, pSh, pHi);
      g.shadedLimb(42, 27, 48, 38, 2.6, 2.1, colorPrimary, pSh, pHi);
      g.shadedSphere(cx, 18, 7.2, 7.4, '#e2e8f0', '#94a3b8', '#ffffff');
      g.rect(26, 16, 12, 4, '#0284c7');
      g.line(27, 17, 36, 17, '#bae6fd');
      g.tri(26, 12, 38, 12, 32, 5, colorSecondary);
      break;
    }

    case 'saiyan_grunt':
    case 'saiyan_boss':
    case 'saiyan_heavy':
    case 'broly_boss': {
      const isBald = archetype === 'saiyan_heavy';
      const isBroly = archetype === 'broly_boss';
      const isRaditzBoss = archetype === 'saiyan_boss';

      if (isRaditzBoss) {
        g.poly(
          [
            [17, 15],
            [47, 15],
            [50, 46],
            [32, 50],
            [14, 46],
          ],
          '#090b12'
        );
        g.poly(
          [
            [19, 15],
            [45, 15],
            [46, 44],
            [32, 47],
            [18, 44],
          ],
          '#151926'
        );
      }

      if (isBroly) {
        // Massive LSSJ Hulk Silhouette
        g.shadedLimb(25, 41, 21, 57, 4.8, 3.6, '#f8fafc', '#cbd5e1', '#ffffff');
        g.shadedLimb(39, 41, 43, 57, 4.8, 3.6, '#f8fafc', '#cbd5e1', '#ffffff');
        g.poly(
          [
            [19, 25],
            [45, 25],
            [42, 43],
            [22, 43],
          ],
          skin
        );
        g.line(25, 30, 31, 32, skinSh);
        g.line(39, 30, 33, 32, skinSh);
        g.rect(28, 33, 8, 6, skinSh);
        // Broly gold collar + crimson waist sash
        g.rect(26, 25, 12, 3, '#facc15');
        g.rect(23, 39, 18, 5, '#dc2626');
        g.tri(28, 43, 36, 43, 32, 50, '#dc2626');
        g.shadedLimb(19, 27, 12, 38, 3.8, 3.2, skin, skinSh, skinHi);
        g.shadedLimb(45, 27, 52, 38, 3.8, 3.2, skin, skinSh, skinHi);
        g.shadedSphere(cx, 17, 7.5, 7.5, skin, skinSh, skinHi);
        // Radiant LSSJ Lime-Green Spikes
        g.tri(24, 15, 39, 15, 32, 1, '#a3e635');
        g.tri(17, 16, 29, 11, 12, 3, '#84cc16');
        g.tri(35, 11, 47, 16, 52, 3, '#84cc16');
        g.ellipse(cx, 12, 8, 4, '#a3e635');
        g.line(31, 4, 32, 11, '#ecfccb');
        g.rect(26, 17, 4, 2, '#ffffff');
        g.rect(34, 17, 4, 2, '#ffffff');
      } else {
        g.shadedLimb(27, 40, 23, 56, 3.9, 3.0, colorPrimary, pSh, pHi);
        g.shadedLimb(37, 40, 41, 56, 3.9, 3.0, colorPrimary, pSh, pHi);
        g.rect(21, 51, 6, 6, '#f8fafc');
        g.rect(37, 51, 6, 6, '#f8fafc');
        // Saiyan Battle Armor
        g.poly(
          [
            [21, 26],
            [43, 26],
            [40, 41],
            [24, 41],
          ],
          '#f8fafc'
        );
        g.rect(26, 31, 12, 7, '#d97706');
        g.line(26, 34, 37, 34, '#92400e');
        g.poly(
          [
            [16, 26],
            [24, 25],
            [24, 30],
            [17, 30],
          ],
          colorSecondary
        );
        g.poly(
          [
            [40, 25],
            [48, 26],
            [47, 30],
            [40, 30],
          ],
          colorSecondary
        );
        g.shadedLimb(20, 29, 15, 40, 2.8, 2.3, skin, skinSh, skinHi);
        g.shadedLimb(44, 29, 49, 40, 2.8, 2.3, skin, skinSh, skinHi);

        g.shadedSphere(cx, 18, 7.5, 7.5, skin, skinSh, skinHi);
        g.rect(26, 17, 4, 2, '#ffffff');
        g.rect(34, 17, 4, 2, '#ffffff');
        g.set(28, 17, '#0b0e18');
        g.set(35, 17, '#0b0e18');
        if (!isBald) {
          g.tri(25, 14, 39, 14, 32, 1, '#151926');
          g.tri(18, 16, 29, 10, 14, 4, '#151926');
          g.tri(35, 10, 46, 16, 50, 4, '#151926');
          g.ellipse(cx, 11, 7.5, 3.5, '#151926');
          g.line(31, 4, 32, 10, '#475569');
        } else {
          g.line(30, 12, 34, 12, skinHi);
          g.rect(28, 22, 8, 2, '#151926'); // Nappa mustache
        }
        if (archetype === 'saiyan_grunt' || isRaditzBoss) {
          g.rect(33, 16, 7, 4, '#16a34a');
          g.rect(34, 17, 4, 2, '#4ade80');
        }
      }
      break;
    }

    case 'frieza_soldier':
    case 'frieza_boss': {
      const isFrieza = archetype === 'frieza_boss';
      if (isFrieza) {
        // Sleek Emperor Frieza with muscular curling tail & purple bio-armor
        g.curve(36, 40, 50, 46, 55, 29, 3.4, 1.0, colorPrimary);
        g.line(42, 42, 54, 31, colorSecondary);
        g.shadedLimb(27, 40, 23, 56, 3.4, 2.5, colorPrimary, pSh, pHi);
        g.shadedLimb(37, 40, 41, 56, 3.4, 2.5, colorPrimary, pSh, pHi);
        g.shadedSphere(cx, 33, 8.5, 9, colorPrimary, pSh, pHi);
        g.shadedSphere(cx, 31, 4.2, 3.2, colorSecondary, sSh, sHi);
        g.rect(27, 36, 10, 3, colorSecondary);
        g.shadedLimb(23, 28, 16, 39, 2.5, 2.0, colorPrimary, pSh, pHi);
        g.shadedLimb(41, 28, 48, 39, 2.5, 2.0, colorPrimary, pSh, pHi);
        g.shadedSphere(cx, 18, 7.5, 8, colorPrimary, pSh, pHi);
        g.shadedSphere(cx, 13, 5.8, 3.6, colorSecondary, sSh, sHi);
        g.rect(26, 18, 4, 2, '#ef4444');
        g.rect(34, 18, 4, 2, '#ef4444');
        g.line(29, 22, 35, 22, '#7e22ce');
      } else {
        g.shadedLimb(27, 40, 23, 56, 3.6, 2.7, colorSecondary, sSh, sHi);
        g.shadedLimb(37, 40, 41, 56, 3.6, 2.7, colorSecondary, sSh, sHi);
        g.poly(
          [
            [22, 26],
            [42, 26],
            [39, 41],
            [25, 41],
          ],
          '#f8fafc'
        );
        g.rect(26, 31, 12, 6, colorSecondary);
        g.shadedLimb(22, 28, 16, 39, 2.6, 2.1, colorPrimary, pSh, pHi);
        g.shadedLimb(42, 28, 48, 39, 2.6, 2.1, colorPrimary, pSh, pHi);
        g.shadedSphere(cx, 18, 7.8, 7.8, colorPrimary, pSh, pHi);
        g.rect(25, 16, 14, 4, '#16a34a');
        g.line(27, 17, 35, 17, '#bbf7d0');
      }
      break;
    }

    case 'namek_warrior':
    case 'namek_boss': {
      if (isBoss) {
        g.poly(
          [
            [18, 25],
            [46, 25],
            [50, 51],
            [14, 51],
          ],
          sSh
        );
        g.poly(
          [
            [20, 25],
            [44, 25],
            [46, 49],
            [18, 49],
          ],
          colorSecondary
        );
      }
      g.shadedLimb(27, 40, 23, 56, 3.6, 2.7, colorSecondary, sSh, sHi);
      g.shadedLimb(37, 40, 41, 56, 3.6, 2.7, colorSecondary, sSh, sHi);
      g.poly(
        [
          [22, 26],
          [42, 26],
          [39, 41],
          [25, 41],
        ],
        colorSecondary
      );
      g.rect(24, 38, 16, 3, '#dc2626');
      g.shadedLimb(22, 28, 16, 39, 2.7, 2.2, colorPrimary, pSh, pHi);
      g.shadedLimb(42, 28, 48, 39, 2.7, 2.2, colorPrimary, pSh, pHi);
      g.rect(17, 33, 2, 3, '#f9a8d4');
      g.rect(45, 33, 2, 3, '#f9a8d4');

      g.shadedSphere(cx, 18, 7.6, 7.8, colorPrimary, pSh, pHi);
      g.tri(25, 17, 25, 21, 19, 15, colorPrimary);
      g.tri(39, 17, 39, 21, 45, 15, colorPrimary);
      g.curve(29, 11, 27, 6, 24, 5, 1.5, 0.7, colorPrimary);
      g.curve(35, 11, 37, 6, 40, 5, 1.5, 0.7, colorPrimary);
      g.rect(26, 17, 4, 2, '#ef4444');
      g.rect(34, 17, 4, 2, '#ef4444');
      break;
    }

    case 'cell_jr':
    case 'cell_boss': {
      // Speckled bio-android chitin, crown crest & beetle wings
      g.poly(
        [
          [23, 27],
          [8, 17],
          [11, 36],
          [24, 38],
        ],
        sSh
      );
      g.poly(
        [
          [41, 27],
          [56, 17],
          [53, 36],
          [40, 38],
        ],
        sSh
      );
      g.shadedLimb(27, 40, 23, 56, 3.6, 2.7, colorPrimary, pSh, pHi);
      g.shadedLimb(37, 40, 41, 56, 3.6, 2.7, colorPrimary, pSh, pHi);
      g.poly(
        [
          [22, 26],
          [42, 26],
          [39, 41],
          [25, 41],
        ],
        colorPrimary
      );
      g.shadedSphere(cx, 32, 4.5, 5, colorSecondary, sSh, sHi);
      g.shadedLimb(22, 28, 16, 39, 2.6, 2.1, colorPrimary, pSh, pHi);
      g.shadedLimb(42, 28, 48, 39, 2.6, 2.1, colorPrimary, pSh, pHi);
      // Cell's tall twin crown fins
      g.poly(
        [
          [22, 15],
          [28, 13],
          [19, 3],
          [16, 6],
        ],
        colorSecondary
      );
      g.poly(
        [
          [42, 15],
          [36, 13],
          [45, 3],
          [48, 6],
        ],
        colorSecondary
      );
      g.shadedSphere(cx, 18, 7.6, 7.8, colorPrimary, pSh, pHi);
      g.rect(27, 17, 9, 4, '#f8fafc');
      g.rect(26, 17, 3, 2, '#ef4444');
      g.rect(35, 17, 3, 2, '#ef4444');
      // Bio-android speckles
      g.set(24, 30, sSh);
      g.set(39, 31, sSh);
      g.set(25, 46, sSh);
      g.set(38, 47, sSh);
      break;
    }

    case 'buu':
    case 'buu_boss': {
      // Majin Buu with curling head tentacle, Majin M belt & baggy pants
      if (isBoss) {
        g.poly(
          [
            [21, 26],
            [43, 26],
            [47, 46],
            [17, 46],
          ],
          '#f8fafc'
        );
      }
      g.shadedLimb(26, 40, 22, 54, 4.4, 3.6, '#f8fafc', '#cbd5e1', '#ffffff');
      g.shadedLimb(38, 40, 42, 54, 4.4, 3.6, '#f8fafc', '#cbd5e1', '#ffffff');
      g.rect(20, 52, 7, 4, '#facc15');
      g.rect(37, 52, 7, 4, '#facc15');
      g.shadedSphere(cx, 33, 9.5, 9.5, colorPrimary, pSh, pHi);
      if (isBoss) {
        g.rect(24, 27, 4, 11, '#0b0e18');
        g.rect(36, 27, 4, 11, '#0b0e18');
      }
      g.rect(24, 39, 16, 4, '#0b0e18');
      g.rect(29, 39, 6, 4, '#facc15');
      g.shadedLimb(22, 28, 15, 38, 2.8, 2.3, colorPrimary, pSh, pHi);
      g.shadedLimb(42, 28, 49, 38, 2.8, 2.3, colorPrimary, pSh, pHi);
      // Head & drooping Majin tentacle
      g.curve(cx, 12, cx + 4, 4, cx + 10, 9, 2.6, 1.3, colorPrimary);
      g.shadedSphere(cx, 18, 8.2, 7.6, colorPrimary, pSh, pHi);
      g.line(25, 17, 29, 18, '#0b0e18');
      g.line(39, 17, 35, 18, '#0b0e18');
      g.line(29, 22, 35, 22, '#0b0e18');
      break;
    }

    case 'beerus_boss': {
      // God of Destruction Beerus: tall pointed Sphynx ears, Egyptian collar & purple tail
      g.curve(36, 41, 48, 44, 53, 28, 2.5, 1.1, colorPrimary);
      g.shadedLimb(27, 40, 23, 56, 3.3, 2.4, colorPrimary, pSh, pHi);
      g.shadedLimb(37, 40, 41, 56, 3.3, 2.4, colorPrimary, pSh, pHi);
      g.rect(24, 41, 16, 7, '#1e293b');
      g.poly(
        [
          [23, 26],
          [41, 26],
          [38, 41],
          [26, 41],
        ],
        colorPrimary
      );
      // Egyptian gold & cyan deity collar
      g.poly(
        [
          [23, 25],
          [41, 25],
          [38, 30],
          [26, 30],
        ],
        '#facc15'
      );
      g.rect(28, 26, 8, 2, '#0ea5e9');
      g.rect(25, 38, 14, 3, '#38bdf8');
      g.shadedLimb(23, 28, 16, 39, 2.3, 1.9, colorPrimary, pSh, pHi);
      g.shadedLimb(41, 28, 48, 39, 2.3, 1.9, colorPrimary, pSh, pHi);
      // Tall feline ears + fierce golden eyes
      g.tri(23, 15, 29, 14, 21, 1, colorPrimary);
      g.tri(35, 14, 41, 15, 43, 1, colorPrimary);
      g.tri(25, 13, 28, 13, 23, 4, '#f9a8d4');
      g.tri(36, 13, 39, 13, 41, 4, '#f9a8d4');
      g.shadedSphere(cx, 19, 6.8, 6.6, colorPrimary, pSh, pHi);
      g.rect(27, 18, 3, 2, '#facc15');
      g.rect(34, 18, 3, 2, '#facc15');
      g.set(28, 18, '#0b0e18');
      g.set(35, 18, '#0b0e18');
      break;
    }

    default: {
      // Crisp martial fallback
      g.shadedLimb(27, 40, 23, 56, 3.6, 2.7, colorSecondary, sSh, sHi);
      g.shadedLimb(37, 40, 41, 56, 3.6, 2.7, colorSecondary, sSh, sHi);
      g.poly(
        [
          [22, 26],
          [42, 26],
          [39, 41],
          [25, 41],
        ],
        colorPrimary
      );
      g.shadedLimb(22, 28, 16, 39, 2.6, 2.1, skin, skinSh, skinHi);
      g.shadedLimb(42, 28, 48, 39, 2.6, 2.1, skin, skinSh, skinHi);
      g.shadedSphere(cx, 18, 7.2, 7.4, skin, skinSh, skinHi);
      g.ellipse(cx, 12, 7.5, 3.5, colorSecondary);
      g.rect(27, 17, 3, 2, '#0b0e18');
      g.rect(34, 17, 3, 2, '#0b0e18');
    }
  }

  const canvas = g.toCanvas('#080a14');
  spriteCache.set(key, canvas);
  return canvas;
}

export type MapNpcKind = 'kame' | 'forja' | 'shenlong' | 'mercado' | 'torneio';

// ============================================================================
// INTERACTIVE MAP NPC SPRITES (16-BIT CRAFT)
// ============================================================================
export function getNpcSpriteCanvas(kind: MapNpcKind): HTMLCanvasElement {
  const key = `snesnpc64_${kind}`;
  const cached = spriteCache.get(key);
  if (cached) return cached;

  const g = new PixelGrid(SPRITE_SIZE, SPRITE_SIZE);
  const cx = 32;

  if (kind === 'kame') {
    // Turtle shell + Pink floral Hawaiian shirt + White beard + Sunglasses + Staff
    g.shadedSphere(cx, 33, 14, 11, '#a16207', '#713f12', '#eab308');
    g.ellipse(cx, 33, 11, 8, '#ca8a04');
    g.shadedLimb(26, 41, 24, 56, 3.4, 2.5, '#1e3a8a', '#0f172a', '#3b82f6');
    g.shadedLimb(38, 41, 40, 56, 3.4, 2.5, '#1e3a8a', '#0f172a', '#3b82f6');
    g.poly(
      [
        [22, 27],
        [42, 27],
        [40, 42],
        [24, 42],
      ],
      '#ec4899'
    );
    g.rect(26, 31, 3, 3, '#facc15');
    g.rect(35, 35, 3, 3, '#38bdf8');
    g.shadedLimb(47, 13, 46, 56, 1.6, 1.5, '#92400e', '#451a03', '#d97706');
    g.shadedSphere(cx, 18, 7.8, 7.6, '#f6bc87', '#d07a42', '#ffe5cb');
    g.rect(25, 17, 6, 4, '#0f172a');
    g.rect(33, 17, 6, 4, '#0f172a');
    g.set(26, 18, '#f8fafc');
    g.set(34, 18, '#f8fafc');
    g.poly(
      [
        [26, 22],
        [38, 22],
        [35, 31],
        [29, 31],
      ],
      '#f8fafc'
    );
    g.line(30, 26, 34, 29, '#cbd5e1');
  } else if (kind === 'forja') {
    g.shadedLimb(26, 41, 23, 56, 3.7, 2.8, '#1e293b', '#0f172a', '#475569');
    g.shadedLimb(38, 41, 41, 56, 3.7, 2.8, '#1e293b', '#0f172a', '#475569');
    g.poly(
      [
        [22, 26],
        [42, 26],
        [40, 43],
        [24, 43],
      ],
      '#78350f'
    );
    g.rect(28, 29, 8, 4, '#f97316');
    g.shadedLimb(22, 28, 16, 39, 2.7, 2.2, '#4ade80', '#16a34a', '#bbf7d0');
    g.shadedLimb(42, 28, 47, 36, 2.7, 2.2, '#4ade80', '#16a34a', '#bbf7d0');
    // Giant Steel Forge Hammer
    g.shadedLimb(47, 16, 47, 43, 1.5, 1.5, '#92400e', '#451a03', '#d97706');
    g.rect(42, 9, 13, 8, '#94a3b8');
    g.rect(43, 10, 11, 2, '#f1f5f9');
    g.shadedSphere(cx, 18, 7.5, 7.5, '#4ade80', '#16a34a', '#bbf7d0');
    g.curve(29, 11, 27, 6, 24, 5, 1.4, 0.7, '#4ade80');
    g.curve(35, 11, 37, 6, 40, 5, 1.4, 0.7, '#4ade80');
    g.rect(26, 17, 4, 2, '#0f172a');
    g.rect(34, 17, 4, 2, '#0f172a');
  } else if (kind === 'shenlong') {
    // Golden Dragon Altar + Coiled Jade Shenlong + Glowing 4-Star Dragon Ball
    g.rect(14, 47, 36, 9, '#78350f');
    g.rect(16, 44, 32, 4, '#facc15');
    g.rect(20, 40, 24, 5, '#cbd5e1');
    // Coiled jade dragon
    g.curve(20, 38, 12, 24, 28, 16, 3.6, 3.0, '#16a34a');
    g.curve(28, 16, 44, 21, 44, 36, 3.0, 3.4, '#22c55e');
    g.shadedSphere(cx, 13, 8.5, 6.2, '#22c55e', '#15803d', '#86efac');
    g.curve(26, 9, 23, 3, 19, 2, 1.8, 0.7, '#facc15');
    g.curve(38, 9, 41, 3, 45, 2, 1.8, 0.7, '#facc15');
    g.rect(27, 12, 3, 2, '#ef4444');
    g.rect(34, 12, 3, 2, '#ef4444');
    // Glowing Dragon Ball on Pedestal
    g.shadedSphere(cx, 34, 7.2, 7.2, '#f59e0b', '#b45309', '#fef08a');
    g.set(30, 32, '#dc2626');
    g.set(34, 32, '#dc2626');
    g.set(30, 36, '#dc2626');
    g.set(34, 36, '#dc2626');
  } else if (kind === 'mercado') {
    g.shadedLimb(26, 41, 23, 56, 3.5, 2.6, '#334155', '#0f172a', '#64748b');
    g.shadedLimb(38, 41, 41, 56, 3.5, 2.6, '#334155', '#0f172a', '#64748b');
    g.poly(
      [
        [22, 26],
        [42, 26],
        [40, 43],
        [24, 43],
      ],
      '#f8fafc'
    );
    g.rect(29, 28, 6, 12, '#38bdf8');
    g.shadedLimb(22, 28, 16, 38, 2.5, 2.0, '#f8fafc', '#cbd5e1', '#ffffff');
    g.shadedLimb(42, 28, 46, 36, 2.5, 2.0, '#f8fafc', '#cbd5e1', '#ffffff');
    g.rect(45, 34, 12, 13, '#d97706');
    g.rect(46, 36, 10, 3, '#facc15');
    g.shadedSphere(cx, 19, 7.2, 6.8, '#fbd8b2', '#cc8c5a', '#fff1e0');
    g.ellipse(cx, 14, 9, 5.5, '#38bdf8');
    g.rect(26, 18, 11, 3, '#facc15');
  } else {
    g.shadedLimb(26, 41, 23, 56, 3.5, 2.6, '#0f172a', '#020617', '#334155');
    g.shadedLimb(38, 41, 41, 56, 3.5, 2.6, '#0f172a', '#020617', '#334155');
    g.poly(
      [
        [22, 26],
        [42, 26],
        [40, 42],
        [24, 42],
      ],
      '#1e293b'
    );
    g.rect(30, 27, 4, 9, '#f8fafc');
    g.rect(31, 28, 2, 7, '#ef4444');
    g.shadedLimb(45, 21, 46, 35, 1.4, 1.4, '#cbd5e1', '#64748b', '#ffffff');
    g.shadedSphere(46, 19, 3.6, 3.6, '#94a3b8', '#475569', '#f1f5f9');
    g.shadedSphere(cx, 19, 7, 6.5, '#f6bc87', '#d07a42', '#ffe5cb');
    g.ellipse(cx, 13, 8, 5, '#facc15');
    g.rect(26, 18, 12, 3, '#0f172a');
  }

  const canvas = g.toCanvas('#080a14');
  spriteCache.set(key, canvas);
  return canvas;
}

// ============================================================================
// PET COMPANION SPRITES (16-BIT CRAFT)
// ============================================================================
export function getPetSpriteCanvas(petId: string): HTMLCanvasElement {
  const key = `snespet64_${petId}`;
  const cached = spriteCache.get(key);
  if (cached) return cached;

  const g = new PixelGrid(SPRITE_SIZE, SPRITE_SIZE);
  const cx = 32;

  if (petId === 'puar') {
    g.curve(26, 44, 16, 48, 14, 34, 2.4, 1.4, '#60a5fa');
    g.tri(21, 26, 28, 25, 18, 11, '#60a5fa');
    g.tri(36, 25, 43, 26, 46, 11, '#60a5fa');
    g.tri(23, 24, 27, 24, 20, 14, '#f9a8d4');
    g.tri(37, 24, 41, 24, 44, 14, '#f9a8d4');
    g.shadedSphere(cx, 42, 6.5, 7, '#60a5fa', '#2563eb', '#bfdbfe');
    g.shadedSphere(cx, 29, 9.5, 8.5, '#60a5fa', '#2563eb', '#bfdbfe');
    g.ellipse(cx, 31, 6.5, 5, '#fef08a');
    g.rect(27, 28, 3, 3, '#0f172a');
    g.rect(34, 28, 3, 3, '#0f172a');
    g.set(27, 28, '#ffffff');
    g.set(34, 28, '#ffffff');
  } else if (petId === 'karin_pet') {
    g.tri(22, 24, 28, 24, 22, 13, '#f8fafc');
    g.tri(36, 24, 42, 24, 42, 13, '#f8fafc');
    g.shadedSphere(cx, 42, 7.5, 8, '#f8fafc', '#cbd5e1', '#ffffff');
    g.shadedSphere(cx, 29, 9, 8, '#f8fafc', '#cbd5e1', '#ffffff');
    g.shadedLimb(42, 22, 42, 50, 1.5, 1.5, '#b45309', '#78350f', '#f59e0b');
    g.rect(27, 28, 3, 2, '#0f172a');
    g.rect(34, 28, 3, 2, '#0f172a');
  } else if (petId === 'chibi_cell') {
    g.poly(
      [
        [24, 34],
        [14, 26],
        [16, 40],
      ],
      '#15803d'
    );
    g.poly(
      [
        [40, 34],
        [50, 26],
        [48, 40],
      ],
      '#15803d'
    );
    g.tri(22, 22, 28, 21, 19, 10, '#16a34a');
    g.tri(36, 21, 42, 22, 45, 10, '#16a34a');
    g.shadedSphere(cx, 40, 7.5, 8, '#38bdf8', '#0284c7', '#bae6fd');
    g.shadedSphere(cx, 27, 8.8, 8, '#38bdf8', '#0284c7', '#bae6fd');
    g.rect(27, 26, 3, 3, '#ef4444');
    g.rect(34, 26, 3, 3, '#ef4444');
  } else if (petId === 'mini_buu') {
    g.curve(cx, 19, cx + 4, 12, cx + 9, 15, 2.2, 1.1, '#f472b6');
    g.poly(
      [
        [23, 34],
        [41, 34],
        [44, 51],
        [20, 51],
      ],
      '#f8fafc'
    );
    g.shadedSphere(cx, 40, 8, 8, '#f472b6', '#db2777', '#fbcfe8');
    g.rect(26, 44, 12, 3, '#facc15');
    g.shadedSphere(cx, 27, 8.8, 8, '#f472b6', '#db2777', '#fbcfe8');
    g.rect(27, 26, 3, 2, '#0f172a');
    g.rect(34, 26, 3, 2, '#0f172a');
  } else {
    // whis_jr
    g.ellipse(cx, 10, 11, 3, '#38bdf8');
    g.ellipse(cx, 10, 7, 1, null);
    g.tri(27, 22, 37, 22, 32, 12, '#f8fafc');
    g.shadedSphere(cx, 27, 7.8, 7, '#a5f3fc', '#0891b2', '#ecfeff');
    g.rect(28, 26, 2, 2, '#7e22ce');
    g.rect(34, 26, 2, 2, '#7e22ce');
    g.poly(
      [
        [24, 34],
        [40, 34],
        [42, 51],
        [22, 51],
      ],
      '#7e22ce'
    );
    g.shadedLimb(43, 17, 43, 50, 1.3, 1.3, '#facc15', '#b45309', '#fef08a');
  }

  const canvas = g.toCanvas('#080a14');
  spriteCache.set(key, canvas);
  return canvas;
}

// ============================================================================
// GOLDEN NUVEM VOADORA (KINTO-UN / FLYING NIMBUS) ANIMATED PIXEL SPRITE
// ============================================================================
export function getNuvemVoadoraCanvas(animFrame: 0 | 1 | 2): HTMLCanvasElement {
  const key = `nuvem_voadora_kinto_${animFrame}`;
  const cached = spriteCache.get(key);
  if (cached) return cached;

  const g = new PixelGrid(SPRITE_SIZE, 36);
  const puffShift = animFrame === 1 ? 1 : animFrame === 2 ? -1 : 0;

  // Cel-shaded golden Nimbus core lobes
  const goldDark = '#d97706';
  const goldMid = '#facc15';
  const goldBright = '#fef08a';
  const goldSpark = '#fffbeb';

  // Trailing nimble wisps behind the main cloud
  g.shadedSphere(11 + puffShift, 20, 5.2, 3.8, goldMid, goldDark, goldBright);
  g.shadedSphere(5 + (animFrame === 2 ? 1 : 0), 21, 3.0, 2.2, goldBright, goldMid, goldSpark);

  // Main fluffy Nimbus cloud lobes
  g.shadedSphere(21, 19, 8.2, 6.2, goldMid, goldDark, goldBright);
  g.shadedSphere(32, 16 + (animFrame === 1 ? -1 : 0), 10.5, 7.8, goldMid, goldDark, goldBright);
  g.shadedSphere(44, 19, 8.0, 6.0, goldMid, goldDark, goldBright);
  g.shadedSphere(52 - puffShift, 20, 4.5, 3.4, goldMid, goldDark, goldBright);

  // Flat soft undersides & specular highlights
  g.ellipse(32, 22, 18, 3.2, goldDark);
  g.ellipse(32, 20, 17, 3.5, goldMid);
  g.ellipse(29, 13 + (animFrame === 1 ? -1 : 0), 6.5, 2.2, goldBright);
  g.ellipse(42, 16, 4.0, 1.6, goldBright);
  g.rect(28, 11 + (animFrame === 1 ? -1 : 0), 3, 2, goldSpark);

  const canvas = g.toCanvas('#1c1003');
  spriteCache.set(key, canvas);
  return canvas;
}

