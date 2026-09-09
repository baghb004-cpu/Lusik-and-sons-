// ============================================================
// CLOTH — procedural weave textures
// ============================================================
// Generated on a canvas at first use and cached, so nothing is
// downloaded and no texture files bloat the repo. That is not only a
// size decision: the blanket comes in several body colours, and a
// procedural weave takes the colour as a parameter instead of needing a
// separate image per colourway.
//
// The waffle is the one that matters most. Lusik's thermal blanket has a
// honeycomb weave where every other square carries an embossed
// pomegranate medallion, and the cross-stitch cubes sit in the plain
// squares between them (see public/img/abc-blanket/07.jpg and 08.jpg).
// Getting the cell pitch right is what makes the 3D piece read as her
// cloth rather than as generic fabric.
// ============================================================

import {
  CanvasTexture, LinearMipmapLinearFilter, RepeatWrapping, SRGBColorSpace, type Texture,
} from "three";

export type Weave = "waffle" | "terry" | "knit" | "satin";

export interface ClothMaps {
  map: Texture;
  normalMap: Texture;
  roughnessMap: Texture;
}

const cache = new Map<string, ClothMaps>();

function surface(size: number): CanvasRenderingContext2D {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("cloth: no 2d context");
  return ctx;
}

function toTexture(ctx: CanvasRenderingContext2D, srgb: boolean, repeat: number): Texture {
  const texture = new CanvasTexture(ctx.canvas);
  // Colour maps are sRGB; normal and roughness are raw data and must NOT
  // be colour-converted or the lighting goes subtly wrong.
  if (srgb) texture.colorSpace = SRGBColorSpace;
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.repeat.set(repeat, repeat);
  texture.minFilter = LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

/**
 * One waffle cell: a raised honeycomb ridge around a sunken square.
 * `cells` is how many cells fit across the generated tile.
 */
function drawWaffle(ctx: CanvasRenderingContext2D, size: number, cells: number, base: string) {
  const pitch = size / cells;
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);

  // The ridge is drawn as a light inset square outline; the shadow side
  // is a second, offset stroke. Two strokes read as a raised edge far
  // more cheaply than any gradient.
  for (let y = 0; y < cells; y += 1) {
    for (let x = 0; x < cells; x += 1) {
      const px = x * pitch;
      const py = y * pitch;
      const inset = pitch * 0.16;
      ctx.strokeStyle = "rgba(255,255,255,0.55)";
      ctx.lineWidth = Math.max(1, pitch * 0.07);
      ctx.strokeRect(px + inset, py + inset, pitch - inset * 2, pitch - inset * 2);
      ctx.strokeStyle = "rgba(0,0,0,0.16)";
      ctx.strokeRect(px + inset + 1, py + inset + 1, pitch - inset * 2, pitch - inset * 2);
    }
  }
}

function drawTerry(ctx: CanvasRenderingContext2D, size: number, base: string) {
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  // Terry is loops: many small arcs at jittered positions. Deterministic
  // jitter (a hash, not Math.random) so the texture is identical every
  // run and a visual baseline stays stable.
  const loops = Math.round(size * size * 0.02);
  for (let i = 0; i < loops; i += 1) {
    const h = (i * 2654435761) >>> 0;
    const x = (h % size);
    const y = ((h >>> 8) % size);
    const r = 1 + ((h >>> 16) % 3);
    ctx.strokeStyle = (h >>> 24) % 2 ? "rgba(255,255,255,0.30)" : "rgba(0,0,0,0.12)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI);
    ctx.stroke();
  }
}

function drawKnit(ctx: CanvasRenderingContext2D, size: number, base: string) {
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  // Stockinette: columns of V shapes.
  const cols = 28;
  const pitch = size / cols;
  ctx.lineWidth = Math.max(1, pitch * 0.22);
  for (let y = 0; y < size; y += pitch) {
    for (let x = 0; x < size; x += pitch) {
      ctx.strokeStyle = "rgba(255,255,255,0.32)";
      ctx.beginPath();
      ctx.moveTo(x, y + pitch);
      ctx.lineTo(x + pitch / 2, y);
      ctx.lineTo(x + pitch, y + pitch);
      ctx.stroke();
      ctx.strokeStyle = "rgba(0,0,0,0.10)";
      ctx.beginPath();
      ctx.moveTo(x, y + pitch + 1);
      ctx.lineTo(x + pitch / 2, y + 1);
      ctx.lineTo(x + pitch, y + pitch + 1);
      ctx.stroke();
    }
  }
}

function drawSatin(ctx: CanvasRenderingContext2D, size: number, base: string) {
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  // Satin is nearly smooth; only a faint directional grain.
  for (let y = 0; y < size; y += 2) {
    ctx.strokeStyle = y % 4 === 0 ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.05)";
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(size, y);
    ctx.stroke();
  }
}

/**
 * Derive a normal map from a colour tile's luminance (a Sobel-ish
 * gradient). Cheap, and for cloth at this scale it is indistinguishable
 * from a properly authored one.
 */
function normalFrom(ctx: CanvasRenderingContext2D, size: number, strength: number): CanvasRenderingContext2D {
  const src = ctx.getImageData(0, 0, size, size).data;
  const out = surface(size);
  const img = out.createImageData(size, size);
  const lum = (x: number, y: number) => {
    const xx = ((x % size) + size) % size;
    const yy = ((y % size) + size) % size;
    const i = (yy * size + xx) * 4;
    return (src[i] * 0.299 + src[i + 1] * 0.587 + src[i + 2] * 0.114) / 255;
  };
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const dx = (lum(x + 1, y) - lum(x - 1, y)) * strength;
      const dy = (lum(x, y + 1) - lum(x, y - 1)) * strength;
      // Normalise (-dx, -dy, 1) into 0..255
      const len = Math.hypot(dx, dy, 1);
      const i = (y * size + x) * 4;
      img.data[i] = ((-dx / len) * 0.5 + 0.5) * 255;
      img.data[i + 1] = ((-dy / len) * 0.5 + 0.5) * 255;
      img.data[i + 2] = (1 / len) * 0.5 * 255 + 127;
      img.data[i + 3] = 255;
    }
  }
  out.putImageData(img, 0, 0);
  return out;
}

function roughnessFrom(size: number, value: number, variation: number): CanvasRenderingContext2D {
  const ctx = surface(size);
  const img = ctx.createImageData(size, size);
  for (let i = 0; i < size * size; i += 1) {
    const h = (i * 2246822519) >>> 0;
    const v = Math.max(0, Math.min(255, (value + ((h % 100) / 100 - 0.5) * variation) * 255));
    img.data[i * 4] = v;
    img.data[i * 4 + 1] = v;
    img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return ctx;
}

export interface ClothOptions {
  weave: Weave;
  /** Body colour as a CSS colour string. */
  color: string;
  /** Texture resolution; comes from the tier's settings. */
  size?: number;
  /** How many times the tile repeats across the piece. */
  repeat?: number;
}

export function clothMaps({ weave, color, size = 1024, repeat = 6 }: ClothOptions): ClothMaps {
  const key = `${weave}|${color}|${size}|${repeat}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const ctx = surface(size);
  if (weave === "waffle") drawWaffle(ctx, size, 16, color);
  else if (weave === "terry") drawTerry(ctx, size, color);
  else if (weave === "knit") drawKnit(ctx, size, color);
  else drawSatin(ctx, size, color);

  const strength = weave === "satin" ? 1.2 : weave === "knit" ? 4 : 6;
  const rough = weave === "satin" ? 0.28 : weave === "terry" ? 0.95 : 0.82;

  const maps: ClothMaps = {
    map: toTexture(ctx, true, repeat),
    normalMap: toTexture(normalFrom(ctx, size, strength), false, repeat),
    roughnessMap: toTexture(roughnessFrom(size, rough, 0.12), false, repeat),
  };
  cache.set(key, maps);
  return maps;
}

/** Free every cached texture. Call on unmount of the last stage. */
export function disposeClothCache(): void {
  for (const maps of cache.values()) {
    maps.map.dispose();
    maps.normalMap.dispose();
    maps.roughnessMap.dispose();
  }
  cache.clear();
}
