// ============================================================
// SCRIPT DECAL — machine satin stitch, not cross stitch
// ============================================================
// The name bib is not hand cross-stitched. It is machine embroidered:
// dense satin stitching that reads as a solid, slightly raised script
// with the thread running ACROSS the stroke. Rendering it as thousands
// of tiny crosses would be both wrong and expensive.
//
// So it is a decal instead. The name is drawn in the site's script face
// onto a canvas; a normal map is derived from that with ridges running
// perpendicular to each stroke, which is what gives satin stitch its
// characteristic sheen; and both are projected onto the cloth. Cheaper
// than geometry and much closer to the real thing.
// ============================================================

import {
  CanvasTexture, LinearFilter, SRGBColorSpace, type Texture,
} from "three";

export interface ScriptDecal {
  map: Texture;
  normalMap: Texture;
  /** True when the text actually drew something. */
  hasInk: boolean;
}

export interface ScriptDecalOptions {
  text: string;
  /** Thread colour, a DMC hex. */
  color: string;
  /** Canvas width in pixels; height is derived. */
  width?: number;
  height?: number;
  /** Font family list. No weight, no size — see rasterize.js for why. */
  fontFamily?: string;
  fontWeight?: number | string;
}

function surface(w: number, h: number): CanvasRenderingContext2D {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("script decal: no 2d context");
  return ctx;
}

/**
 * Fit text to the box by measuring, not by guessing. A four-letter name
 * and a nine-letter one are stitched at different scales on the real bib
 * so both fill the panel.
 */
function fitText(
  ctx: CanvasRenderingContext2D,
  text: string,
  boxW: number,
  boxH: number,
  family: string,
  weight: number | string,
): number {
  let size = Math.floor(boxH * 0.8);
  for (let i = 0; i < 12; i += 1) {
    ctx.font = `${weight} ${size}px ${family}`;
    const w = ctx.measureText(text).width;
    if (w <= boxW) break;
    size = Math.max(8, Math.floor(size * (boxW / w) * 0.98));
  }
  return size;
}

export function scriptDecal({
  text, color, width = 1024, height = 512,
  fontFamily = '"Allura", cursive', fontWeight = 400,
}: ScriptDecalOptions): ScriptDecal {
  const ctx = surface(width, height);
  ctx.clearRect(0, 0, width, height);

  const trimmed = (text ?? "").trim();
  if (!trimmed) {
    return {
      map: plainTexture(ctx, true),
      normalMap: flatNormal(width, height),
      hasInk: false,
    };
  }

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const size = fitText(ctx, trimmed, width * 0.86, height * 0.7, fontFamily, fontWeight);
  ctx.font = `${fontWeight} ${size}px ${fontFamily}`;
  ctx.fillStyle = color;
  ctx.fillText(trimmed, width / 2, height / 2);

  const pixels = ctx.getImageData(0, 0, width, height);
  const hasInk = hasAnyAlpha(pixels.data);

  return {
    map: plainTexture(ctx, true),
    normalMap: satinNormal(pixels, width, height),
    hasInk,
  };
}

function hasAnyAlpha(data: Uint8ClampedArray): boolean {
  for (let i = 3; i < data.length; i += 4) if (data[i] > 8) return true;
  return false;
}

function plainTexture(ctx: CanvasRenderingContext2D, srgb: boolean): Texture {
  const texture = new CanvasTexture(ctx.canvas);
  if (srgb) texture.colorSpace = SRGBColorSpace;
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

function flatNormal(w: number, h: number): Texture {
  const ctx = surface(w, h);
  ctx.fillStyle = "rgb(128,128,255)";
  ctx.fillRect(0, 0, w, h);
  return plainTexture(ctx, false);
}

/**
 * Derive a satin-stitch normal map.
 *
 * The trick that makes it read as embroidery rather than as printed ink:
 * the ridges run PERPENDICULAR to the stroke direction. The stroke
 * direction is estimated from the alpha gradient — the gradient points
 * across the stroke, so the thread runs along it — and a sine ripple is
 * laid along that estimate at the pitch of a satin stitch.
 */
function satinNormal(image: ImageData, w: number, h: number): Texture {
  const src = image.data;
  const ctx = surface(w, h);
  const out = ctx.createImageData(w, h);
  const alphaAt = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return 0;
    return src[(y * w + x) * 4 + 3] / 255;
  };
  /** Stitches per pixel. Satin stitch is dense; this is roughly 0.6mm. */
  const PITCH = 0.55;

  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const i = (y * w + x) * 4;
      const a = alphaAt(x, y);
      if (a < 0.5) {
        out.data[i] = 128; out.data[i + 1] = 128; out.data[i + 2] = 255; out.data[i + 3] = 255;
        continue;
      }
      // Gradient of alpha points across the stroke.
      const gx = alphaAt(x + 1, y) - alphaAt(x - 1, y);
      const gy = alphaAt(x, y + 1) - alphaAt(x, y - 1);
      const len = Math.hypot(gx, gy) || 1;
      // Thread runs along the stroke: perpendicular to the gradient.
      const tx = -gy / len;
      const ty = gx / len;
      // Ripple across the thread direction.
      const phase = (x * ty - y * tx) * PITCH;
      const ridge = Math.sin(phase) * 0.6;
      const nx = tx * ridge;
      const ny = ty * ridge;
      const nl = Math.hypot(nx, ny, 1);
      out.data[i] = ((nx / nl) * 0.5 + 0.5) * 255;
      out.data[i + 1] = ((ny / nl) * 0.5 + 0.5) * 255;
      out.data[i + 2] = ((1 / nl) * 0.5 + 0.5) * 255;
      out.data[i + 3] = 255;
    }
  }
  ctx.putImageData(out, 0, 0);
  return plainTexture(ctx, false);
}
